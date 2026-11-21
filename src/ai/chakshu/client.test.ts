import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DRISHTI_RUNTIME_URL } from "../drishti/client";
import { generateChakshuVideo, getChakshuRuntimeStatus } from "./client";

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Chakshu local video client", () => {
  it("polls the video status endpoint on loopback only", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      phase: "idle", message: "Ready", progress: 0, step: 0, total_steps: 0,
      model_id: null, busy: false, loaded_model: null,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await getChakshuRuntimeStatus();
    expect(result?.phase).toBe("idle");
    expect(fetch).toHaveBeenCalledWith(
      DRISHTI_RUNTIME_URL + "/v1/video/status",
      expect.objectContaining({ credentials: "omit", targetAddressSpace: "loopback" }),
    );
  });

  it("sends a video prompt to the local runtime and returns the MP4 blob", async () => {
    const mp4 = new Blob([new Uint8Array(2048)], { type: "video/mp4" });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(mp4, {
      status: 200,
      headers: { "Content-Type": "video/mp4", "X-SatyaAI-Elapsed": "12.5", "X-SatyaAI-Seed": "42" },
    }));
    const result = await generateChakshuVideo("light", "A train crossing a bridge");
    expect(result.model_id).toBe("light");
    expect(result.elapsed_seconds).toBe(12.5);
    expect(result.seed).toBe(42);
    expect(result.blob.size).toBe(2048);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit & { targetAddressSpace?: string })?.targetAddressSpace).toBe("loopback");
    expect(init?.body).toBe(JSON.stringify({ model_id: "light", prompt: "A train crossing a bridge", accept_license: false }));
  });

  it("requires an explicit acknowledgement for the flagship model", async () => {
    await expect(generateChakshuVideo("divya", "A cinematic ocean")).rejects.toThrow("Community License");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects blank and oversized prompts before making a request", async () => {
    await expect(generateChakshuVideo("light", " ")).rejects.toThrow("video prompt");
    await expect(generateChakshuVideo("light", "x".repeat(4001))).rejects.toThrow("4,000 characters");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports local runtime errors without requiring a remote provider", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Not enough GPU memory" }), {
      status: 409, headers: { "Content-Type": "application/json" },
    }));
    await expect(generateChakshuVideo("chakshu", "A paper kite")).rejects.toThrow("Not enough GPU memory");
  });
});
