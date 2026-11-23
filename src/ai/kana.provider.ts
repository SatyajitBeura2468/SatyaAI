import type { ChatMessage, ModelProgressSnapshot } from "./providers";
import { getKanaCapabilitySnapshot, KANA_CONFIG } from "./kana.config";

type ProgressHandler = (message: string, details?: ModelProgressSnapshot) => void;
type WorkerResponse =
  | { type: "progress"; id: number; stage: "download" | "initializing" | "complete"; phase: "cache-check" | "cache-load" | "download" | "initializing" | "ready"; percent: number | null; message: string }
  | { type: "generation-start"; id: number }
  | { type: "token"; id: number; text: string }
  | { type: "done"; id: number; answer: string }
  | { type: "error"; id: number; message: string }
  | { type: "unloaded"; id: number };

type WorkerRequest =
  | { type: "generate"; id: number; messages: ChatMessage[] }
  | { type: "unload"; id: number };

let kanaWorker: Worker | null = null;
let requestSequence = 0;
let serialQueue: Promise<void> = Promise.resolve();

function ensureWorker(): Worker {
  if (!kanaWorker) kanaWorker = new Worker(new URL("./kana.worker.ts", import.meta.url), { type: "module", name: "satyaai-kana-inference" });
  return kanaWorker;
}

function forceTerminateWorker(worker: Worker) {
  if (kanaWorker === worker) kanaWorker = null;
  worker.terminate();
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const current = serialQueue.then(operation, operation);
  serialQueue = current.then(() => undefined, () => undefined);
  return current;
}

export function unloadKana(): void {
  const worker = kanaWorker;
  kanaWorker = null;
  if (!worker) return;
  const id = ++requestSequence;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    if (timer !== undefined) clearTimeout(timer);
    worker.removeEventListener("message", handleMessage);
    worker.terminate();
  };
  const handleMessage = (event: MessageEvent<WorkerResponse>) => {
    if (event.data?.id === id && event.data.type === "unloaded") cleanup();
  };
  worker.addEventListener("message", handleMessage);
  timer = setTimeout(cleanup, 2_000);
  try { worker.postMessage({ type: "unload", id } satisfies WorkerRequest); }
  catch { cleanup(); }
}

export async function localKana(
  messages: ChatMessage[],
  onProgress?: ProgressHandler,
  onToken?: (partialText: string) => void,
  onThinking?: (active: boolean) => void,
  signal?: AbortSignal,
): Promise<string> {
  return enqueue(async () => {
    if (signal?.aborted) throw new DOMException("Kaṇa inference cancelled.", "AbortError");
    const capabilities = getKanaCapabilitySnapshot();
    if (!capabilities.webAssembly || !capabilities.worker) {
      throw new Error("This browser does not provide WebAssembly and Web Workers, which Kaṇa needs for local CPU inference. No remote request was made.");
    }

    const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
    try { await storage?.persist?.(); } catch { /* Persistent storage is best-effort. */ }
    try {
      const estimate = await storage?.estimate?.();
      if (typeof estimate?.quota === "number" && typeof estimate.usage === "number" &&
          Math.max(0, estimate.quota - estimate.usage) < KANA_CONFIG.estimatedModelBytes) {
        onProgress?.("Browser storage may be limited; cached model files could be evicted.", {
          percent: null, elapsedSeconds: 0, remainingSeconds: null, stage: "initializing", messagePhase: "recovery",
        });
      }
    } catch {
      // Browser privacy modes may hide quota estimates.
    }

    onProgress?.("Checking Kaṇa's local browser cache…", {
      percent: null, elapsedSeconds: 0, remainingSeconds: null, stage: "initializing", messagePhase: "cache-check",
    });
    const worker = ensureWorker();
    const id = ++requestSequence;
    const startedAt = Date.now();

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        signal?.removeEventListener("abort", handleAbort);
      };
      const finish = (error?: Error, answer?: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        onThinking?.(false);
        if (error) reject(error);
        else resolve(answer ?? "");
      };
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;
        if (!data || data.id !== id) return;
        if (data.type === "progress") {
          onProgress?.(data.message, {
            percent: data.percent, elapsedSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
            remainingSeconds: null, stage: data.stage, messagePhase: data.phase,
          });
        } else if (data.type === "generation-start") onThinking?.(true);
        else if (data.type === "token") onToken?.(data.text);
        else if (data.type === "done") finish(undefined, data.answer);
        else if (data.type === "error") {
          finish(new Error(data.message));
          forceTerminateWorker(worker);
        }
      };
      const handleError = (event: ErrorEvent) => {
        finish(new Error(event.message || "Kaṇa's inference worker stopped unexpectedly."));
        forceTerminateWorker(worker);
      };
      const handleAbort = () => {
        forceTerminateWorker(worker);
        finish(new DOMException("Kaṇa inference cancelled.", "AbortError"));
      };
      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      signal?.addEventListener("abort", handleAbort, { once: true });
      if (signal?.aborted) { handleAbort(); return; }
      worker.postMessage({ type: "generate", id, messages } satisfies WorkerRequest);
    });
  });
}
