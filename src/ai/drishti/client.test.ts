import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelDrishtiGeneration,
  checkDrishtiRuntime,
  DRISHTI_RUNTIME_URL,
  generateDrishtiImage,
} from "./client";

const health = {
  ok: true,
  service: "satyaai-drishti-runtime",
  version: "0.1.0",
  device: "cpu" as const,
  device_name: null,
  vram_total_gb: null,
  vram_free_gb: null,
  ram_available_gb: 16,
  free_disk_gb: 100,
  loaded_model: null,
  busy: false,
  models: {
    lite: { available: true, reason: "CPU fallback", license: "Apache-2.0", recommended_hardware: "CPU" },
    core: { available: false, reason: "Requires CUDA", license: "Apache-2.0", recommended_hardware: "GPU" },
    ultra: { available: false, reason: "Requires high-memory CUDA", license: "Apache-2.0", recommended_hardware: "GPU" },
    max: { available: false, reason: "License and hardware gate", license: "Community", recommended_hardware: "GPU" },
  },
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Drishti local runtime client", () => {
  it("pins all model traffic to the loopback companion", () => {
    expect(DRISHTI_RUNTIME_URL).toBe("http://127.0.0.1:7860");
  });

  it("accepts health only from the expected companion identity", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(health), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await checkDrishtiRuntime();

    expect(result.service).toBe("satyaai-drishti-runtime");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:7860/health",
      expect.objectContaining({ credentials: "omit", cache: "no-store", targetAddressSpace: "loopback" }),
    );
  });

  it("refuses a different local service", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, service: "some-other-service" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(checkDrishtiRuntime()).rejects.toThrow(
      "not a compatible Drishti runtime",
    );
  });

  it("sends image prompts only to the loopback generation route", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          image_data_url: "data:image/png;base64,aGVsbG8=",
          model_id: "lite",
          elapsed_seconds: 1.2,
          seed: 42,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await generateDrishtiImage("lite", "a dog on a boat");

    expect(result.seed).toBe(42);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:7860/v1/generate",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        targetAddressSpace: "loopback",
        body: JSON.stringify({
          model_id: "lite",
          prompt: "a dog on a boat",
          width: 512,
          height: 512,
        }),
      }),
    );
  });

  it("posts cancellation to the loopback image runtime", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ accepted: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(cancelDrishtiGeneration()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:7860/v1/cancel",
      expect.objectContaining({ method: "POST", targetAddressSpace: "loopback", credentials: "omit" }),
    );
  });

  it("rejects empty and oversized prompts before making a request", async () => {
    await expect(generateDrishtiImage("lite", "   ")).rejects.toThrow(
      "Write an image prompt first",
    );
    await expect(generateDrishtiImage("lite", "x".repeat(4001))).rejects.toThrow(
      "4,000 characters",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
