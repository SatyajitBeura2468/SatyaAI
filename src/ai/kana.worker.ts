import { env, ModelRegistry, pipeline, TextStreamer } from "@huggingface/transformers";
import { KANA_CONFIG, getKanaResourceProfile } from "./kana.config";

type Role = "system" | "user" | "assistant";
type WorkerChatMessage = { role: Role; content: string };
type GenerateRequest = { type: "generate"; id: number; messages: WorkerChatMessage[] };
type UnloadRequest = { type: "unload"; id: number };
type WorkerRequest = GenerateRequest | UnloadRequest;
type ProgressPhase = "cache-check" | "cache-load" | "download" | "initializing" | "ready";
type ProgressStage = "download" | "initializing" | "complete";
type WorkerResponse =
  | { type: "progress"; id: number; stage: ProgressStage; phase: ProgressPhase; percent: number | null; message: string }
  | { type: "generation-start"; id: number }
  | { type: "token"; id: number; text: string }
  | { type: "done"; id: number; answer: string }
  | { type: "error"; id: number; message: string }
  | { type: "unloaded"; id: number };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
  navigator: Navigator & { deviceMemory?: number };
};

type PipelineLike = {
  tokenizer: {
    apply_chat_template?: (messages: WorkerChatMessage[], options: Record<string, unknown>) => Promise<unknown> | unknown;
  };
  dispose?: () => Promise<void> | void;
  (messages: WorkerChatMessage[] | string, options: Record<string, unknown>): Promise<Array<{ generated_text?: unknown }>>;
};

const pipelineOptions = {
  dtype: KANA_CONFIG.dtype,
  device: KANA_CONFIG.device,
  revision: KANA_CONFIG.revision,
};

let generator: PipelineLike | null = null;
let loading: Promise<PipelineLike> | null = null;
let generationActive = false;

function postProgress(id: number, phase: ProgressPhase, message: string, percent: number | null = null) {
  const stage: ProgressStage = phase === "download" ? "download" : phase === "ready" ? "complete" : "initializing";
  workerScope.postMessage({ type: "progress", id, stage, phase, percent, message });
}

function countTokens(encoded: unknown): number | null {
  if (Array.isArray(encoded)) return encoded.length;
  if (!encoded || typeof encoded !== "object") return null;
  const value = encoded as { length?: unknown; dims?: number[]; data?: { length?: unknown }; input_ids?: { length?: unknown; data?: { length?: unknown }; dims?: number[] } };
  if (Array.isArray(value.dims) && value.dims.length) return value.dims.reduce((total, dimension) => total * dimension, 1);
  if (typeof value.length === "number") return value.length;
  if (typeof value.input_ids?.length === "number") return value.input_ids.length;
  if (typeof value.input_ids?.data?.length === "number") return value.input_ids.data.length;
  if (Array.isArray(value.input_ids?.dims) && value.input_ids.dims.length) return value.input_ids.dims.reduce((total, dimension) => total * dimension, 1);
  if (typeof value.data?.length === "number") return value.data.length;
  return null;
}

async function trimToContext(messages: WorkerChatMessage[], instance: PipelineLike, budget: number): Promise<WorkerChatMessage[]> {
  const system = messages.filter((message) => message.role === "system").map((message) => ({ ...message }));
  const turns = messages.filter((message) => message.role !== "system").map((message) => ({ ...message }));
  const measure = async (candidate: WorkerChatMessage[]) => {
    if (typeof instance.tokenizer.apply_chat_template === "function") {
      const encoded = await instance.tokenizer.apply_chat_template(candidate, { tokenize: true, add_generation_prompt: true });
      const length = countTokens(encoded);
      if (length !== null && length > 0) return length;
    }
    return Math.ceil(candidate.reduce((sum, message) => sum + message.content.length, 0) / 3.5);
  };
  let candidate = [...system, ...turns];
  let tokenCount = await measure(candidate);
  while (tokenCount > budget && turns.length > 1) {
    turns.shift();
    candidate = [...system, ...turns];
    tokenCount = await measure(candidate);
  }
  // Keep SATYA CORE and the latest user turn even when the prompt exceeds the target context.
  return candidate;
}

function progressCallback(id: number) {
  return (event: { status?: string; file?: string; loaded?: number; total?: number; progress?: number }) => {
    if (event.status === "progress_total" && typeof event.progress === "number" && Number.isFinite(event.progress)) {
      postProgress(id, "download", "Downloading Kaṇa model assets…", Math.max(0, Math.min(100, Math.round(event.progress))));
    } else if (event.status === "progress" && event.file) {
      // Progress text updates are real, but only aggregate progress moves the percentage.
      postProgress(id, "download", "Downloading " + event.file + "…");
    } else if (event.status === "ready") {
      postProgress(id, "initializing", "The ONNX CPU runtime is ready. Verifying inference…");
    }
  };
}

async function verifyRequiredCheckpoint() {
  const files = await ModelRegistry.get_pipeline_files("text-generation", KANA_CONFIG.modelId, pipelineOptions);
  const onnxFiles = files.filter((file: string) => file.endsWith(".onnx"));
  if (onnxFiles.length !== 1 || !onnxFiles[0].endsWith("model_int8.onnx")) {
    throw new Error("Kaṇa's requested INT8 checkpoint could not be verified. No other precision file will be loaded.");
  }
}

async function ensurePipeline(id: number): Promise<PipelineLike> {
  if (generator) {
    postProgress(id, "ready", "Kaṇa is ready on this device.", 100);
    return generator;
  }
  if (loading) return loading;

  loading = (async () => {
    postProgress(id, "cache-check", "Checking Kaṇa's browser cache…");
    await verifyRequiredCheckpoint();

    let cached: boolean | null = null;
    try {
      cached = await ModelRegistry.is_pipeline_cached("text-generation", KANA_CONFIG.modelId, pipelineOptions);
    } catch {
      // Cache inspection is advisory; pipeline initialization performs its own checks.
    }
    if (cached === true) postProgress(id, "cache-load", "Kaṇa is already cached. Reusing existing model files…");
    else if (cached === false) postProgress(id, "download", "Downloading Kaṇa's INT8 model files…");

    const loaded = await pipeline("text-generation", KANA_CONFIG.modelId, {
      ...pipelineOptions,
      progress_callback: progressCallback(id),
    }) as unknown as PipelineLike;

    postProgress(id, "initializing", "Initializing Kaṇa's WebAssembly CPU runtime…");
    const smoke = await loaded([{ role: "user", content: "Reply with OK." }], {
      max_new_tokens: KANA_CONFIG.smokeTestTokens,
      do_sample: false,
    });
    const generated = smoke?.[0]?.generated_text;
    const smokeText = typeof generated === "string" ? generated :
      Array.isArray(generated) ? (generated[generated.length - 1] as { content?: string } | undefined)?.content : undefined;
    if (typeof smokeText !== "string" || !smokeText.trim()) {
      await loaded.dispose?.();
      throw new Error("Kaṇa downloaded, but its local inference smoke test did not return readable text.");
    }

    generator = loaded;
    postProgress(id, "ready", "Kaṇa is ready on this device.", 100);
    return loaded;
  })().catch(async (error) => {
    const failed = generator;
    generator = null;
    try { await failed?.dispose?.(); } catch { /* Release resources after initialization failure. */ }
    throw error;
  }).finally(() => {
    loading = null;
  });
  return loading;
}

async function generate(request: GenerateRequest) {
  if (generationActive) {
    workerScope.postMessage({ type: "error", id: request.id, message: "Kaṇa is already processing another request. Please try again shortly." });
    return;
  }
  generationActive = true;
  try {
    const instance = await ensurePipeline(request.id);
    const profile = getKanaResourceProfile(workerScope.navigator.deviceMemory, workerScope.navigator.hardwareConcurrency);
    const messages = await trimToContext(request.messages, instance, profile.contextTokens);
    workerScope.postMessage({ type: "generation-start", id: request.id });
    let streamed = "";
    const streamer = new TextStreamer(instance.tokenizer as never, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (chunk: string) => {
        if (!chunk) return;
        streamed += chunk;
        workerScope.postMessage({ type: "token", id: request.id, text: streamed });
      },
    });
    const result = await instance(messages, {
      max_new_tokens: profile.maxNewTokens,
      temperature: KANA_CONFIG.temperature,
      top_p: KANA_CONFIG.topP,
      do_sample: true,
      streamer,
    });
    let answer = streamed.trim();
    if (!answer) {
      const generated = result?.[0]?.generated_text;
      if (typeof generated === "string") answer = generated;
      else if (Array.isArray(generated)) {
        const last = generated[generated.length - 1] as { role?: string; content?: string } | undefined;
        answer = last?.content?.trim() ?? "";
      }
    }
    if (!answer) throw new Error("Kaṇa completed generation but returned no readable text.");
    workerScope.postMessage({ type: "done", id: request.id, answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Kaṇa inference error.";
    const failed = generator;
    generator = null;
    try { await failed?.dispose?.(); } catch { /* Keep worker state recoverable. */ }
    workerScope.postMessage({ type: "error", id: request.id, message });
  } finally {
    generationActive = false;
  }
}

workerScope.onmessage = (event) => {
  const request = event.data;
  if (request.type === "unload") {
    const current = generator;
    generator = null;
    loading = null;
    generationActive = false;
    void Promise.resolve(current?.dispose?.()).finally(() => workerScope.postMessage({ type: "unloaded", id: request.id }));
    return;
  }
  void generate(request);
};

env.useBrowserCache = typeof caches !== "undefined";
env.useWasmCache = typeof caches !== "undefined";
env.backends.onnx.wasm.numThreads = KANA_CONFIG.wasmThreads;
