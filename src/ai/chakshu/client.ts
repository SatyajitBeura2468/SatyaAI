import type { ChakshuModelId } from "./registry";
import { DRISHTI_RUNTIME_URL } from "../drishti/client";

function loopbackInit(init: RequestInit): RequestInit {
  return { ...init, targetAddressSpace: "loopback" } as RequestInit;
}

export type ChakshuRuntimeStatus = {
  phase: "idle" | "checking" | "loading_model" | "generating" | "complete" | "error";
  message: string;
  progress: number | null;
  step: number;
  total_steps: number;
  model_id: ChakshuModelId | null;
  busy: boolean;
  loaded_model: ChakshuModelId | null;
};

export type ChakshuGenerationResult = {
  blob: Blob;
  model_id: ChakshuModelId;
  elapsed_seconds: number;
  seed: number;
};

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown; error?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (typeof body.error === "string") return body.error;
  } catch {
    // The companion may return a plain-text error.
  }
  return "The local video runtime returned HTTP " + response.status + ".";
}

export async function getChakshuRuntimeStatus(): Promise<ChakshuRuntimeStatus | null> {
  try {
    const response = await fetch(DRISHTI_RUNTIME_URL + "/v1/video/status", loopbackInit({
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
    }));
    if (!response.ok) return null;
    return (await response.json()) as ChakshuRuntimeStatus;
  } catch {
    return null;
  }
}

export async function generateChakshuVideo(
  modelId: ChakshuModelId,
  prompt: string,
  acceptLicense = false,
  signal?: AbortSignal,
): Promise<ChakshuGenerationResult> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) throw new Error("Write a video prompt first.");
  if (cleanPrompt.length > 4000) throw new Error("Video prompts are limited to 4,000 characters.");
  if (modelId === "divya" && !acceptLicense) {
    throw new Error("Review and accept the LTX-2.x Community License before using Divya Chakshu 1.");
  }

  let response: Response;
  try {
    response = await fetch(DRISHTI_RUNTIME_URL + "/v1/video/generate", loopbackInit({
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
        accept_license: acceptLicense,
      }),
    }));
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Could not reach the local video runtime. Confirm the updated companion is running and that this site has Local Network Access permission.");
  }

  if (!response.ok) throw new Error(await errorMessage(response));
  const blob = await response.blob();
  if (blob.size < 1024 || !blob.type.startsWith("video/")) {
    throw new Error("The local runtime returned an invalid video file.");
  }

  const elapsed = Number(response.headers.get("X-SatyaAI-Elapsed") || 0);
  const seed = Number(response.headers.get("X-SatyaAI-Seed") || 0);
  return {
    blob,
    model_id: modelId,
    elapsed_seconds: Number.isFinite(elapsed) ? elapsed : 0,
    seed: Number.isFinite(seed) ? seed : 0,
  };
}
