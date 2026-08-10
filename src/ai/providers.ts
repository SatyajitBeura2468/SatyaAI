export type SatyaMode = 'fast' | 'smart' | 'deep';
export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
export type ProviderCapabilities = { text: boolean; vision: boolean; streaming: boolean; tools: boolean; local: boolean };
export type ProviderSettings = { baseUrl?: string; apiKey?: string; model?: string };

export const MODE_CONFIG: Record<SatyaMode, { model: string; temperature: number; maxTokens: number; passes: number }> = {
  fast: { model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', temperature: 0.3, maxTokens: 256, passes: 1 },
  smart: { model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', temperature: 0.4, maxTokens: 512, passes: 1 },
  deep: { model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', temperature: 0.25, maxTokens: 1536, passes: 2 },
};

export function hasWebGPU(): boolean { return typeof navigator !== 'undefined' && 'gpu' in navigator; }

export const ONLINE_MODELS = [
  { family: 'Qwen', id: 'Qwen/Qwen3-8B', capability: 'text + reasoning' },
  { family: 'GLM', id: 'THUDM/GLM-4-9B-0414', capability: 'text + reasoning' },
  { family: 'Mistral', id: 'mistralai/Mistral-7B-Instruct-v0.3', capability: 'text + tools' },
  { family: 'gpt-oss', id: 'openai/gpt-oss-20b', capability: 'text + reasoning' },
];

export async function remoteChat(messages: ChatMessage[], mode: SatyaMode): Promise<string> {
  const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, model: MODE_CONFIG[mode].model, temperature: MODE_CONFIG[mode].temperature, max_tokens: MODE_CONFIG[mode].maxTokens }) });
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: string };
  if (!response.ok) throw new Error(data.error || `Remote provider failed (${response.status})`);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Remote provider returned no assistant content.');
  return content;
}

export async function openAICompatible(settings: ProviderSettings, messages: ChatMessage[], mode: SatyaMode): Promise<string> {
  if (!settings.baseUrl || !settings.model) throw new Error('Configure a compatible endpoint and model in Settings first.');
  const base = settings.baseUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) }, body: JSON.stringify({ model: settings.model, messages, temperature: MODE_CONFIG[mode].temperature, max_tokens: MODE_CONFIG[mode].maxTokens, stream: false }) });
  if (!response.ok) throw new Error(`Provider request failed (${response.status}). Check the endpoint, model, and CORS policy.`);
  const data: unknown = await response.json();
  const content = (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
  if (!content) throw new Error('The provider returned no assistant content.');
  return content;
}

export async function localWebLLM(mode: SatyaMode, prompt: string, onProgress?: (text: string) => void): Promise<string> {
  const online = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODE_CONFIG[mode].model, messages: [{ role: 'user', content: prompt }], temperature: MODE_CONFIG[mode].temperature, max_tokens: MODE_CONFIG[mode].maxTokens }) });
  if (online.status !== 404) {
    const data = await online.json() as { choices?: Array<{ message?: { content?: string } }>; error?: string };
    if (!online.ok && online.status !== 503) throw new Error(data.error || `Remote provider failed (${online.status})`);
    if (!online.ok && online.status === 503) onProgress?.('Online provider unavailable; preparing the browser model…');
    else return data.choices?.[0]?.message?.content || 'Remote provider returned no assistant content.';
  }
  if (!hasWebGPU()) throw new Error('WebGPU is unavailable in this browser. Configure an Ollama or OpenAI-compatible endpoint instead.');
  const webllm = await import('@mlc-ai/web-llm');
  const model = MODE_CONFIG[mode].model;
  const engine = await webllm.CreateMLCEngine(model, { initProgressCallback: (p) => onProgress?.(p.text) });
  const result = await engine.chat.completions.create({ messages: [{ role: 'system', content: 'You are SatyaAI, a concise and honest assistant. Say when you are uncertain.' }, { role: 'user', content: prompt }], stream: false });
  return result.choices[0]?.message.content || 'The local model returned an empty response.';
}
