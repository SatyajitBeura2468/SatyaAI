import { buildSatyaSystemPrompt, type UserMemory } from "./identity";
import type { LoadingMessageStage } from "../loading-phrases";
import { getSatyaTier } from "./core/index.js";

export type SatyaMode = "nano" | "fast" | "smart" | "deep";
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
  messagePhase?: LoadingMessageStage;
};

type ModelProgressHandler = (
  message: string,
  details?: ModelProgressSnapshot,
) => void;

export const MODE_CONFIG: Record<
  SatyaMode,
  { model: string; temperature: number; maxTokens: number }
> = {
  nano: {
    model: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    temperature: 0.35,
    maxTokens: 512,
  },
  fast: {
    model: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    temperature: 0.3,
    maxTokens: 1024,
  },
  smart: {
    model: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    temperature: 0.4,
    maxTokens: 2048,
  },
  deep: {
    model: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    temperature: 0.25,
    maxTokens: 4096,
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
let activeTierName = "local";

let localOperationQueue: Promise<void> = Promise.resolve();
let persistentStoragePromise: Promise<void> | null = null;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
}

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

function formatModelProgress(report: {
  progress: number;
  timeElapsed: number;
  text: string;
}): { message: string; details: ModelProgressSnapshot } {
  const rawProgress = report.progress > 1
    ? report.progress / 100
    : report.progress;
  const fraction = Number.isFinite(rawProgress)
    ? Math.min(1, Math.max(0, rawProgress))
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
      ? activeTierName + " · model taiyaar hai"
      : activeTierName + " · " + action + "…",
    details: {
      percent,
      elapsedSeconds,
      remainingSeconds,
      stage: complete ? "complete" : downloading ? "download" : "initializing",
      messagePhase: complete
        ? "ready"
        : activeModelCacheHit && downloading
          ? "cache-load"
          : downloading
            ? "download"
            : "initializing",
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
  recoveryAttempt = false,
  signal?: AbortSignal,
): Promise<WebLLMEngine> {
  throwIfAborted(signal);
  const webllm = await getWebLLMModule();
  throwIfAborted(signal);
  activeProgressCallback = onProgress;
  // Reusing the resident model needs no cache check or model reload.
  if (localEngine && loadedLocalModel === model) return localEngine;

  const initialPhase: LoadingMessageStage = recoveryAttempt
    ? "recovery"
    : localEngine
      ? "switching"
      : "cache-check";
  onProgress?.("Preparing the selected model…", {
    percent: null,
    elapsedSeconds: null,
    remainingSeconds: null,
    stage: "initializing",
    messagePhase: initialPhase,
  });

  await requestPersistentStorage();
  throwIfAborted(signal);
  activeModelCacheHit = await getModelCacheStatus(webllm, model);
  throwIfAborted(signal);

  if (activeModelCacheHit) {
    onProgress?.("Loading the saved model files…", {
      percent: null,
      elapsedSeconds: null,
      remainingSeconds: null,
      stage: "initializing",
      messagePhase: "cache-load",
    });
  } else {
    onProgress?.("Downloading model files…", {
      percent: 0,
      elapsedSeconds: null,
      remainingSeconds: null,
      stage: "download",
      messagePhase: "download",
    });
  }

  if (!localEngine) {
    const worker = new Worker(new URL("./llm.worker.ts", import.meta.url), {
      type: "module",
    });

    try {
      const terminateOnAbort = () => worker.terminate();
      signal?.addEventListener("abort", terminateOnAbort, { once: true });
      const engine = await webllm.CreateWebWorkerMLCEngine(worker, model, {
        appConfig: webllm.prebuiltAppConfig,
        initProgressCallback: (progress) => {
          const update = formatModelProgress(progress);
          activeProgressCallback?.(update.message, update.details);
        },
      });
      signal?.removeEventListener("abort", terminateOnAbort);
      throwIfAborted(signal);
      localWorker = worker;
      localEngine = engine;
      loadedLocalModel = model;
      return engine;
    } catch (error) {
      worker.terminate();
      throw error;
    }
  }

  // reload() replaces the resident model. Downloaded files remain in the
  // browser cache, so switching back can reuse them without another download.
  const worker = localWorker;
  const terminateOnAbort = () => {
    worker?.terminate();
    if (localWorker === worker) {
      localWorker = null;
      localEngine = null;
      loadedLocalModel = null;
    }
  };
  signal?.addEventListener("abort", terminateOnAbort, { once: true });
  try {
    await localEngine.reload(model);
    throwIfAborted(signal);
    loadedLocalModel = model;
    return localEngine;
  } finally {
    signal?.removeEventListener("abort", terminateOnAbort);
  }
}

export async function readOpenAIStream(
  response: Response,
  onToken?: (partialText: string) => void,
): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string } | string;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.length > 0) {
      onToken?.(content);
      return content;
    }
    const detail = typeof data.error === "string" ? data.error : data.error?.message;
    throw new Error(detail || "The provider returned no assistant content.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let finished = false;

  const consume = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") { finished = true; return; }
    let data: {
      choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
      error?: { message?: string } | string;
    };
    try { data = JSON.parse(payload); }
    catch { return; }
    if (data.error) {
      const detail = typeof data.error === "string" ? data.error : data.error.message;
      throw new Error(detail || "The provider interrupted the response.");
    }
    const piece = data.choices?.[0]?.delta?.content ?? data.choices?.[0]?.message?.content;
    if (typeof piece === "string" && piece) {
      answer += piece;
      onToken?.(answer);
    }
  };

  try {
    while (!finished) {
      const result = await reader.read();
      buffer += decoder.decode(result.value, { stream: !result.done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        consume(line);
        if (finished) break;
      }
      if (result.done) {
        if (buffer) consume(buffer);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!answer.trim()) throw new Error("The provider returned no assistant content.");
  return answer;
}

export async function openAICompatible(
  settings: ProviderSettings,
  messages: ChatMessage[],
  mode: SatyaMode | "micro",
  signal?: AbortSignal,
  onToken?: (partialText: string) => void,
): Promise<string> {
  if (!settings.baseUrl || !settings.model) {
    throw new Error("Configure a compatible endpoint and model in Settings first.");
  }
  const base = settings.baseUrl.replace(/\/$/, "");
  const generationConfig = mode === "micro"
    ? { temperature: 0.35, maxTokens: 256 }
    : MODE_CONFIG[mode];
  const response = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey ? { Authorization: "Bearer " + settings.apiKey } : {}),
    },
    signal,
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: generationConfig.temperature,
      max_tokens: generationConfig.maxTokens,
      stream: true,
    }),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json() as { error?: { message?: string } | string };
      detail = typeof data.error === "string" ? data.error : data.error?.message || "";
    } catch { /* Providers may return HTML or plain-text error pages. */ }
    throw new Error("Provider request failed (" + response.status + "). " + (detail || "Check the endpoint, model, and CORS policy."));
  }
  return readOpenAIStream(response, onToken);
}

async function supportsShaderF16(): Promise<boolean> {
  if (!hasWebGPU()) return false;
  const gpu = (navigator as Navigator & {
    gpu?: {
      requestAdapter?: () => Promise<{
        features?: { has: (feature: string) => boolean };
      } | null>;
    };
  }).gpu;
  try {
    const adapter = await gpu?.requestAdapter?.();
    return adapter?.features?.has("shader-f16") ?? false;
  } catch {
    return false;
  }
}

export async function localWebLLM(
  mode: SatyaMode,
  messages: ChatMessage[],
  onProgress?: ModelProgressHandler,
  onToken?: (partialText: string) => void,
  onThinking?: (active: boolean) => void,
  userMemory: UserMemory = { name: "", notes: "" },
  signal?: AbortSignal,
): Promise<string> {
  // Every SatyaAI tier runs in the browser by default. Remote inference is
  // available only when the user explicitly configures a compatible endpoint.
  throwIfAborted(signal);
  if (!hasWebGPU()) {
    throw new Error("WebGPU is required for browser-local inference. Use a supported browser and GPU, or configure an optional compatible endpoint in Settings.");
  }

  return withLocalEngineLock(async () => {
    throwIfAborted(signal);
    const primary = MODE_CONFIG[mode].model;
    const nanoF32 = "SmolLM2-360M-Instruct-q4f32_1-MLC";
    const nanoCandidates = mode === "nano"
      ? (await supportsShaderF16() ? [primary, nanoF32] : [nanoF32])
      : [primary];
    // q4f32 is the compatibility build for adapters without shader-f16.
    // Never silently substitute a different model for the selected SatyaAI engine.
    // Nano may use its q4f32 compatibility build, which is the same engine family.
    const models = nanoCandidates;
    let lastError: unknown;

    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];

      try {
        activeTierName = getSatyaTier(mode)?.name ?? "SatyaAI";
        onProgress?.(
          index === 0
            ? "Is device ka model cache dekh raha hoon…"
            : "GPU recovery · trying the selected engine again…",
        );

        const engine = await ensureLocalModel(model, onProgress, false, signal);
        throwIfAborted(signal);
        const systemPrompt = buildSatyaSystemPrompt(userMemory, {
          mode,
          inferenceRoute: "browser-local",
          localInferenceAvailable: true,
          remoteInferenceAvailable: false,
        });
        const runtimeMessages: ChatMessage[] = messages.some((message) => message.role === "system")
          ? messages.map((message) => message.role === "system" ? { ...message, content: systemPrompt } : message)
          : [{ role: "system", content: systemPrompt }, ...messages];
        onThinking?.(true);
        const stream = await engine.chat.completions.create({
          messages: runtimeMessages,
          temperature: MODE_CONFIG[mode].temperature,
          max_tokens: MODE_CONFIG[mode].maxTokens,
          stream: true,
        });

        const iterator = stream[Symbol.asyncIterator]();
        const closeStream = () => { void iterator.return?.(); };
        signal?.addEventListener("abort", closeStream, { once: true });
        let answer = "";
        try {
          while (true) {
            throwIfAborted(signal);
            const next = await iterator.next();
            if (next.done) break;
            const piece = next.value.choices?.[0]?.delta?.content;
            if (typeof piece === "string" && piece.length > 0) {
              answer += piece;
              onToken?.(answer);
            }
          }
        } finally {
          signal?.removeEventListener("abort", closeStream);
        }
        throwIfAborted(signal);

        if (answer.trim()) return answer;
        throw new Error("The local model returned an empty response.");
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
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

    console.error("[SatyaAI] Selected tier initialization failed:", lastError);
    throw new Error(
      "SatyaAI couldn't initialize the selected " + (getSatyaTier(mode)?.name ?? "reasoning") + " engine. Check your connection or browser compatibility, then try again.",
    );
  });
}
