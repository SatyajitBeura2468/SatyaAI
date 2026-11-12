export type SatyaMode = "fast" | "smart" | "deep";
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};
export type ProviderCapabilities = {
  text: boolean;
  vision: boolean;
  streaming: boolean;
  tools: boolean;
  local: boolean;
};
export type ProviderSettings = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

export type ModelProgressSnapshot = {
  percent: number | null;
  elapsedSeconds: number | null;
  remainingSeconds: number | null;
  stage: "download" | "initializing" | "complete";
};

type ModelProgressHandler = (
  message: string,
  details?: ModelProgressSnapshot,
) => void;

export const MODE_CONFIG: Record<
  SatyaMode,
  { model: string; temperature: number; maxTokens: number; passes: number }
> = {
  fast: {
    model: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    temperature: 0.3,
    maxTokens: 256,
    passes: 1,
  },
  smart: {
    model: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    temperature: 0.4,
    maxTokens: 512,
    passes: 1,
  },
  deep: {
    model: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    temperature: 0.25,
    maxTokens: 1536,
    passes: 2,
  },
};

export function hasWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export const ONLINE_MODELS = [
  { family: "Qwen", id: "Qwen/Qwen3-8B", capability: "text + reasoning" },
  { family: "GLM", id: "THUDM/GLM-4-9B-0414", capability: "text + reasoning" },
  {
    family: "Mistral",
    id: "mistralai/Mistral-7B-Instruct-v0.3",
    capability: "text + tools",
  },
  { family: "gpt-oss", id: "openai/gpt-oss-20b", capability: "text + reasoning" },
];

type WebLLMModule = typeof import("@mlc-ai/web-llm");
type WebLLMEngine = Awaited<
  ReturnType<WebLLMModule["CreateWebWorkerMLCEngine"]>
>;

let webLLMModulePromise: Promise<WebLLMModule> | null = null;
let localEngine: WebLLMEngine | null = null;
let localWorker: Worker | null = null;
let loadedLocalModel: string | null = null;
let activeProgressCallback: ModelProgressHandler | undefined;
let activeModelCacheHit = false;
let activeModelLabel = "local";

let localOperationQueue: Promise<void> = Promise.resolve();
let remoteGatewayReadyPromise: Promise<boolean> | null = null;
let persistentStoragePromise: Promise<void> | null = null;

function withLocalEngineLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = localOperationQueue.then(operation, operation);
  localOperationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function getWebLLMModule(): Promise<WebLLMModule> {
  if (!webLLMModulePromise) {
    webLLMModulePromise = import("@mlc-ai/web-llm");
  }

  try {
    return await webLLMModulePromise;
  } catch (error) {
    webLLMModulePromise = null;
    throw error;
  }
}

async function requestPersistentStorage(): Promise<void> {
  if (!persistentStoragePromise) {
    persistentStoragePromise = (async () => {
      try {
        if (navigator.storage?.persist) {
          await navigator.storage.persist();
        }
      } catch {
        // Browsers may decline persistent storage; the normal cache still works.
      }
    })();
  }

  await persistentStoragePromise;
}

async function hasConfiguredRemoteGateway(): Promise<boolean> {
  if (!remoteGatewayReadyPromise) {
    remoteGatewayReadyPromise = fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) return false;
        const health = (await response.json()) as { configured?: boolean };
        return health.configured === true;
      })
      .catch(() => false);
  }

  return remoteGatewayReadyPromise;
}

function modelLabel(model: string): string {
  if (model.includes("1B")) return "Tvarit 1B";
  if (model.includes("3B")) return "Pragya 3B";
  if (model.includes("0.5B")) return "Laghu 0.5B";
  return model;
}

function formatModelProgress(report: {
  progress: number;
  timeElapsed: number;
  text: string;
}): { message: string; details: ModelProgressSnapshot } {
  const fraction = Number.isFinite(report.progress)
    ? Math.min(1, Math.max(0, report.progress))
    : null;
  const elapsedSeconds = Number.isFinite(report.timeElapsed)
    ? Math.max(0, report.timeElapsed)
    : null;
  const percent =
    fraction === null ? null : Math.round(fraction * 100);
  const remainingSeconds =
    fraction !== null &&
    fraction > 0.02 &&
    fraction < 1 &&
    elapsedSeconds !== null
      ? Math.round((elapsedSeconds / fraction) * (1 - fraction))
      : null;
  const complete = fraction !== null && fraction >= 1;
  const downloading = /fetch|download|param|cache/i.test(report.text);

  const action = activeModelCacheHit
    ? "saved model files cache se load ho rahi hain"
    : "model files pehli baar download ho rahi hain";

  return {
    message: complete
      ? activeModelLabel + " · model taiyaar hai"
      : activeModelLabel + " · " + action + "…",
    details: {
      percent,
      elapsedSeconds,
      remainingSeconds,
      stage: complete ? "complete" : downloading ? "download" : "initializing",
    },
  };
}

async function getModelCacheStatus(
  webllm: WebLLMModule,
  model: string,
): Promise<boolean> {
  try {
    return await webllm.hasModelInCache(model);
  } catch {
    return false;
  }
}

async function discardLocalEngine(): Promise<void> {
  const previousEngine = localEngine;
  const previousWorker = localWorker;

  localEngine = null;
  localWorker = null;
  loadedLocalModel = null;

  if (previousEngine) {
    try {
      await previousEngine.unload();
    } catch {
      // A lost WebGPU device can prevent graceful cleanup.
    }
  }

  previousWorker?.terminate();
}

async function ensureLocalModel(
  model: string,
  onProgress?: ModelProgressHandler,
): Promise<WebLLMEngine> {
  const webllm = await getWebLLMModule();
  activeProgressCallback = onProgress;
  activeModelLabel = modelLabel(model);
  await requestPersistentStorage();

  if (!localEngine) {
    activeModelCacheHit = await getModelCacheStatus(webllm, model);
    onProgress?.(
      activeModelCacheHit
        ? activeModelLabel + " · saved model files cache se load ho rahi hain…"
        : activeModelLabel + " · model files pehli baar download ho rahi hain…",
    );

    const worker = new Worker(new URL("./llm.worker.ts", import.meta.url), {
      type: "module",
    });

    try {
      const engine = await webllm.CreateWebWorkerMLCEngine(worker, model, {
        appConfig: webllm.prebuiltAppConfig,
        initProgressCallback: (progress) => {
          const update = formatModelProgress(progress);
          activeProgressCallback?.(update.message, update.details);
        },
      });
      localWorker = worker;
      localEngine = engine;
      loadedLocalModel = model;
      return engine;
    } catch (error) {
      worker.terminate();
      throw error;
    }
  }

  if (loadedLocalModel !== model) {
    activeModelCacheHit = await getModelCacheStatus(webllm, model);
    onProgress?.(
      activeModelCacheHit
        ? activeModelLabel + " · cached model ko dobara load kar raha hoon…"
        : activeModelLabel + " · pehli baar setup ho raha hai…",
    );

    // reload() replaces the resident model. The downloaded model files remain
    // in the browser cache, so switching back restores them instead of fetching
    // the weights from the network again.
    await localEngine.reload(model);
    loadedLocalModel = model;
  }

  return localEngine;
}

export async function openAICompatible(
  settings: ProviderSettings,
  messages: ChatMessage[],
  mode: SatyaMode,
): Promise<string> {
  if (!settings.baseUrl || !settings.model) {
    throw new Error("Configure a compatible endpoint and model in Settings first.");
  }

  const base = settings.baseUrl.replace(/\/$/, "");
  const response = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey
        ? { Authorization: "Bearer " + settings.apiKey }
        : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: MODE_CONFIG[mode].temperature,
      max_tokens: MODE_CONFIG[mode].maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      "Provider request failed (" +
        response.status +
        "). Check the endpoint, model, and CORS policy.",
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("The provider returned no assistant content.");
  return content;
}

export async function localWebLLM(
  mode: SatyaMode,
  messages: ChatMessage[],
  onProgress?: ModelProgressHandler,
  onToken?: (partialText: string) => void,
  onThinking?: (active: boolean) => void,
): Promise<string> {
  if (await hasConfiguredRemoteGateway()) {
    try {
      onThinking?.(true);
      const online = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODE_CONFIG[mode].model,
          messages,
          temperature: MODE_CONFIG[mode].temperature,
          max_tokens: MODE_CONFIG[mode].maxTokens,
        }),
      });

      const data = (await online.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: string;
      };

      if (!online.ok) {
        throw new Error(data.error || "Remote provider failed (" + online.status + ")");
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Remote provider returned no assistant content.");
      return content;
    } catch {
      onThinking?.(false);
      onProgress?.("Remote model unavailable; ab browser par local inference…");
    }
  }

  if (!hasWebGPU()) {
    throw new Error(
      "WebGPU is unavailable in this browser. Configure an Ollama or OpenAI-compatible endpoint instead.",
    );
  }

  return withLocalEngineLock(async () => {
    const primary = MODE_CONFIG[mode].model;
    const models = [
      primary,
      "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    ].filter((value, index, all) => all.indexOf(value) === index);
    let lastError: unknown;

    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];

      try {
        onProgress?.(
          index === 0
            ? "Is device ka model cache dekh raha hoon…"
            : "GPU recovery · Laghu model ko cache se laane ki koshish…",
        );

        const engine = await ensureLocalModel(model, onProgress);
        onThinking?.(true);
        const stream = await engine.chat.completions.create({
          messages,
          temperature: MODE_CONFIG[mode].temperature,
          max_tokens: MODE_CONFIG[mode].maxTokens,
          stream: true,
        });

        let answer = "";
        for await (const chunk of stream) {
          const piece = chunk.choices?.[0]?.delta?.content;
          if (typeof piece === "string" && piece.length > 0) {
            answer += piece;
            onToken?.(answer);
          }
        }

        if (answer.trim()) return answer;
        throw new Error("The local model returned an empty response.");
      } catch (error) {
        lastError = error;
        await discardLocalEngine();
      }
    }

    const raw =
      lastError instanceof Error
        ? lastError.message
        : "WebGPU model failed to initialize.";

    if (
      /DEVICE_REMOVED|GPU|D3D12|requestDevice|out of memory|out-of-memory|oom/i.test(
        raw,
      )
    ) {
      throw new Error(
        "The browser graphics device ran out of resources or reset while loading the model. Refresh the page, close other GPU-heavy tabs, or use a smaller local model.",
      );
    }

    throw new Error(raw);
  });
}
