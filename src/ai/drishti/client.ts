import type { DrishtiModelId } from "./registry";

export const DRISHTI_RUNTIME_URL = "http://127.0.0.1:7860";
export const DRISHTI_COMPANION_SCHEME = "satyaai-drishti://start";
export const DRISHTI_COMPANION_INSTALL_URL =
  "https://github.com/SatyajitBeura2468/SatyaAI/releases/download/drishti-companion-latest/SatyaAI-Drishti-Setup.exe";

export type DrishtiModelAvailability = {
  available: boolean;
  reason: string;
  license: string;
  recommended_hardware: string;
};

export type DrishtiRuntimeHealth = {
  ok: boolean;
  service: string;
  version: string;
  device: "cuda" | "cpu" | "unavailable";
  device_name: string | null;
  vram_total_gb: number | null;
  vram_free_gb: number | null;
  ram_available_gb: number;
  free_disk_gb: number;
  loaded_model: DrishtiModelId | null;
  busy: boolean;
  models: Record<DrishtiModelId, DrishtiModelAvailability>;
};

function loopbackInit(init: RequestInit): RequestInit {
  return { ...init, targetAddressSpace: "loopback" } as RequestInit;
}

export type DrishtiRuntimeStatus = {
  phase: "idle" | "checking" | "loading_model" | "generating" | "complete" | "error";
  message: string;
  progress: number | null;
  step: number;
  total_steps: number;
  model_id: DrishtiModelId | null;
  busy: boolean;
  loaded_model: DrishtiModelId | null;
};

export type DrishtiGenerationResult = {
  image_data_url: string;
  model_id: DrishtiModelId;
  elapsed_seconds: number;
  seed: number;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown; error?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (typeof body.error === "string") return body.error;
  } catch {
    // The runtime may have returned a plain-text error.
  }
  return "The local image runtime returned HTTP " + response.status + ".";
}

export async function checkDrishtiRuntime(
  signal?: AbortSignal,
): Promise<DrishtiRuntimeHealth> {
  let response: Response;
  try {
    response = await fetch(DRISHTI_RUNTIME_URL + "/health", loopbackInit({
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      signal,
    }));
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Could not reach the local Drishti companion. Start it on this device and allow this site’s Local Network Access permission when your browser asks.",
    );
  }

  if (!response.ok) throw new Error(await readError(response));
  const health = (await response.json()) as DrishtiRuntimeHealth;
  if (health.ok !== true || health.service !== "satyaai-drishti-runtime") {
    throw new Error("The address responded, but it is not a compatible Drishti runtime.");
  }
  return health;
}

export function requestDrishtiCompanionStart(): void {
  const link = document.createElement("a");
  link.href = DRISHTI_COMPANION_SCHEME;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function getDrishtiRuntimeStatus(): Promise<DrishtiRuntimeStatus | null> {
  try {
    const response = await fetch(
      DRISHTI_RUNTIME_URL + "/v1/status",
      loopbackInit({
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "omit",
      }),
    );
    if (!response.ok) return null;
    return (await response.json()) as DrishtiRuntimeStatus;
  } catch {
    return null;
  }
}

export async function generateDrishtiImage(
  modelId: DrishtiModelId,
  prompt: string,
  signal?: AbortSignal,
): Promise<DrishtiGenerationResult> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) throw new Error("Write an image prompt first.");
  if (cleanPrompt.length > 4000) {
    throw new Error("Image prompts are limited to 4,000 characters.");
  }

  let response: Response;
  try {
    response = await fetch(DRISHTI_RUNTIME_URL + "/v1/generate", loopbackInit({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SatyaAI-Client": "SatyaAI-Web",
      },
      credentials: "omit",
      cache: "no-store",
      signal,
      body: JSON.stringify({
        model_id: modelId,
        prompt: cleanPrompt,
        width: 512,
        height: 512,
      }),
    }));
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Could not reach the local image runtime. Confirm it is running and that this site has Local Network Access permission.",
    );
  }

  if (!response.ok) throw new Error(await readError(response));
  const result = (await response.json()) as DrishtiGenerationResult;
  if (
    typeof result.image_data_url !== "string" ||
    !result.image_data_url.startsWith("data:image/png;base64,")
  ) {
    throw new Error("The local runtime returned an invalid image response.");
  }
  return result;
}
