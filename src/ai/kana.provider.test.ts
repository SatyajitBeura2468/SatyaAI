import { describe, expect, it } from "vitest";
import { getKanaCapabilitySnapshot, getKanaResourceProfile, KANA_CONFIG } from "./kana.config";

describe("Kaṇa Micro runtime configuration", () => {
  it("selects the dedicated 135M INT8 checkpoint on WebAssembly CPU", () => {
    expect(KANA_CONFIG.modelId).toBe("onnx-community/SmolLM2-135M-Instruct-ONNX-MHA");
    expect(KANA_CONFIG.parameterCount).toBe(135_000_000);
    expect(KANA_CONFIG.dtype).toBe("int8");
    expect(KANA_CONFIG.device).toBe("wasm");
    expect(KANA_CONFIG.estimatedModelBytes).toBe(137_479_596);
    expect(KANA_CONFIG.maxNewTokens).toBe(256);
    expect(KANA_CONFIG.wasmThreads).toBe(1);
  });

  it("uses conservative hints without treating them as compatibility guarantees", () => {
    expect(getKanaResourceProfile(2, 2)).toEqual({ contextTokens: 768, maxNewTokens: 160, wasmThreads: 1 });
    expect(getKanaResourceProfile(4, 4)).toEqual({ contextTokens: 768, maxNewTokens: 160, wasmThreads: 1 });
    expect(getKanaResourceProfile(8, 8)).toEqual({ contextTokens: 1_024, maxNewTokens: 256, wasmThreads: 1 });
  });

  it("reports WebGPU as diagnostic only", () => {
    const capabilities = getKanaCapabilitySnapshot();
    expect(capabilities).toHaveProperty("webAssembly");
    expect(capabilities).toHaveProperty("webAssemblySimd");
    expect(capabilities).toHaveProperty("worker");
    expect(capabilities).toHaveProperty("browserCache");
    expect(capabilities).toHaveProperty("persistentStorage");
    expect(capabilities).toHaveProperty("webGPUAvailable");
  });
});
