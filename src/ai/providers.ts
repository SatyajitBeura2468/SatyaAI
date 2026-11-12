export type SatyaMode = 'fast' | 'smart' | 'deep';
export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
export type ProviderCapabilities = { text: boolean; vision: boolean; streaming: boolean; tools: boolean; local: boolean };
export type ProviderSettings = { baseUrl?: string; apiKey?: string; model?: string };

export const MODE_CONFIG: Record<SatyaMode, { model: string; temperature: number; maxTokens: number; passes: number }> = {
  fast: { model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', temperature: 0.3, maxTokens: 256, passes: 1 },
  smart: { model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', temperature: 0.4, maxTokens: 512, passes: 1 },
  deep: { model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', temperature: 0.25, maxTokens: 1536, passes: 2 },
};

export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export const ONLINE_MODELS = [
  { family: 'Qwen', id: 'Qwen/Qwen3-8B', capability: 'text + reasoning' },
  { family: 'GLM', id: 'THUDM/GLM-4-9B-0414', capability: 'text + reasoning' },
  { family: 'Mistral', id: 'mistralai/Mistral-7B-Instruct-v0.3', capability: 'text + tools' },
  { family: 'gpt-oss', id: 'openai/gpt-oss-20b', capability: 'text + reasoning' },
];

type WebLLMModule = typeof import('@mlc-ai/web-llm');
type WebLLMEngine = Awaited<ReturnType<WebLLMModule['CreateMLCEngine']>>;

// Keep one WebLLM engine alive for this page. Recreating it per message repeats
// engine setup and creates avoidable GPU memory churn.
let webLLMModulePromise: Promise<WebLLMModule> | null = null;
let localEngine: WebLLMEngine | null = null;
let loadedLocalModel: string | null = null;
let activeProgressCallback: ((text: string) => void) | undefined;

// A single WebGPU engine must not be reloaded while another request is using it.
let localOperationQueue: Promise<void> = Promise.resolve();

// Cache the gateway check so an unconfigured remote provider does not add a
// failed POST to every browser-local inference request.
let remoteGatewayReadyPromise: Promise<boolean> | null = null;

function withLocalEngineLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = localOperationQueue.then(operation, operation);
  localOperationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function getWebLLMModule(): Promise<WebLLMModule> {
  if (!webLLMModulePromise) {
    webLLMModulePromise = import('@mlc-ai/web-llm');
  }

  try {
    return await webLLMModulePromise;
  } catch (error) {
    webLLMModulePromise = null;
    throw error;
  }
}

async function hasConfiguredRemoteGateway(): Promise<boolean> {
  if (!remoteGatewayReadyPromise) {
    remoteGatewayReadyPromise = fetch('/api/health')
      .then(async response => {
        if (!response.ok) return false;
        const health = await response.json() as { configured?: boolean };
        return health.configured === true;
      })
      .catch(() => false);
  }
  return remoteGatewayReadyPromise;
}

async function discardLocalEngine(): Promise<void> {
  const previousEngine = localEngine;
  localEngine = null;
  loadedLocalModel = null;

  if (previousEngine) {
    try {
      await previousEngine.unload();
    } catch {
      // A lost WebGPU device may make cleanup impossible. Drop the reference
      // anyway so the next attempt can create a fresh engine.
    }
  }
}

async function ensureLocalModel(model: string, onProgress?: (text: string) => void): Promise<WebLLMEngine> {
  const webllm = await getWebLLMModule();
  activeProgressCallback = onProgress;

  if (!localEngine) {
    localEngine = await webllm.CreateMLCEngine(model, {
      initProgressCallback: progress => activeProgressCallback?.(progress.text || 'Loading browser model…'),
    });
    loadedLocalModel = model;
    return localEngine;
  }

  if (loadedLocalModel !== model) {
    // Keep only one model resident in GPU memory. Smart and Deep Think share
    // the same 3B model, so switching between them does not trigger a reload.
    try {
      await localEngine.unload();
      loadedLocalModel = null;
      await localEngine.reload(model);
      loadedLocalModel = model;
    } catch (error) {
      await discardLocalEngine();
      throw error;
    }
  }

  return localEngine;
}

export async function remoteChat(messages: ChatMessage[], mode: SatyaMode): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: MODE_CONFIG[mode].model,
      temperature: MODE_CONFIG[mode].temperature,
      max_tokens: MODE_CONFIG[mode].maxTokens,
    }),
  });
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: string };
  if (!response.ok) throw new Error(data.error || `Remote provider failed (${response.status})`);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Remote provider returned no assistant content.');
  return content;
}

export async function openAICompatible(settings: ProviderSettings, messages: ChatMessage[], mode: SatyaMode): Promise<string> {
  if (!settings.baseUrl || !settings.model) throw new Error('Configure a compatible endpoint and model in Settings first.');
  const base = settings.baseUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: MODE_CONFIG[mode].temperature,
      max_tokens: MODE_CONFIG[mode].maxTokens,
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`Provider request failed (${response.status}). Check the endpoint, model, and CORS policy.`);
  const data: unknown = await response.json();
  const content = (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
  if (!content) throw new Error('The provider returned no assistant content.');
  return content;
}

export async function localWebLLM(
  mode: SatyaMode,
  prompt: string,
  onProgress?: (text: string) => void,
  onToken?: (partialText: string) => void,
): Promise<string> {
  // Skip the remote POST entirely when production has no provider configured.
  if (await hasConfiguredRemoteGateway()) {
    try {
      const online = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODE_CONFIG[mode].model,
          messages: [{ role: 'user', content: prompt }],
          temperature: MODE_CONFIG[mode].temperature,
          max_tokens: MODE_CONFIG[mode].maxTokens,
        }),
      });
      const data = await online.json() as { choices?: Array<{ message?: { content?: string } }>; error?: string };
      if (!online.ok) throw new Error(data.error || `Remote provider failed (${online.status})`);
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Remote provider returned no assistant content.');
      return content;
    } catch {
      onProgress?.('Remote provider unavailable; switching to browser-local inference…');
    }
  }

  onProgress?.('Using browser-local inference…');
  if (!hasWebGPU()) {
    throw new Error('WebGPU is unavailable in this browser. Configure an Ollama or OpenAI-compatible endpoint instead.');
  }

  return withLocalEngineLock(async () => {
    const primary = MODE_CONFIG[mode].model;
    const models = [primary, 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC']
      .filter((value, index, all) => all.indexOf(value) === index);
    let lastError: unknown;

    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];
      try {
        onProgress?.(index === 0 ? 'Loading browser model…' : 'GPU recovery: switching to a lighter model…');
        const engine = await ensureLocalModel(model, onProgress);
        const chunks = await engine.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are SatyaAI, a concise and honest assistant. Say when you are uncertain.' },
            { role: 'user', content: prompt },
          ],
          temperature: MODE_CONFIG[mode].temperature,
          max_tokens: MODE_CONFIG[mode].maxTokens,
          stream: true,
        });

        let answer = '';
        for await (const chunk of chunks) {
          const piece = chunk.choices?.[0]?.delta?.content;
          if (typeof piece === 'string' && piece.length > 0) {
            answer += piece;
            onToken?.(answer);
          }
        }

        if (answer.trim()) return answer;
        throw new Error('The local model returned an empty response.');
      } catch (error) {
        lastError = error;
        await discardLocalEngine();
      }
    }

    const raw = lastError instanceof Error ? lastError.message : 'WebGPU model failed to initialize.';
    if (/DEVICE_REMOVED|GPU|D3D12|requestDevice|out of memory|out-of-memory|oom/i.test(raw)) {
      throw new Error('The browser graphics device ran out of resources or reset while loading the model. Refresh the page, close other GPU-heavy tabs, or use a smaller local model.');
    }
    throw new Error(raw);
  });
}
