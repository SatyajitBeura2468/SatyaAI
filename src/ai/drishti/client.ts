import type { DrishtiModelId } from "./registry";

export const DRISHTI_RUNTIME_URL = "http://127.0.0.1:7860";

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
    response = await fetch(DRISHTI_RUNTIME_URL + "/health", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Local Drishti runtime not detected. Start the companion service on this device, then check again.",
    );
  }

  if (!response.ok) throw new Error(await readError(response));
  const health = (await response.json()) as DrishtiRuntimeHealth;
  if (health.ok !== true || health.service !== "satyaai-drishti-runtime") {
    throw new Error("The address responded, but it is not a compatible Drishti runtime.");
  }
  return health;
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
    response = await fetch(DRISHTI_RUNTIME_URL + "/v1/generate", {
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
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Could not reach the local image runtime. Check that it is still running on this device.",
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
