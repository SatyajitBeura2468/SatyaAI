export const KANA_CONFIG = Object.freeze({
  publicName: "Kaṇa",
  sanskritName: "कण",
  tier: "Micro",
  parameterCount: 135_000_000,
  modelId: "onnx-community/SmolLM2-135M-Instruct-ONNX-MHA",
  revision: "main",
  dtype: "int8" as const,
  device: "wasm" as const,
  estimatedModelBytes: 137_479_596,
  contextTokens: 1_024,
  maxNewTokens: 256,
  lowMemoryContextTokens: 768,
  lowMemoryMaxNewTokens: 160,
  wasmThreads: 1,
  temperature: 0.35,
  topP: 0.9,
  smokeTestTokens: 4,
});

export type KanaResourceProfile = Readonly<{
  contextTokens: number;
  maxNewTokens: number;
  wasmThreads: 1;
}>;

/** Hardware values are advisory hints, never compatibility guarantees. */
export function getKanaResourceProfile(deviceMemory?: number, hardwareConcurrency?: number): KanaResourceProfile {
  const lowMemory = (
    typeof deviceMemory === "number" && deviceMemory > 0 &&
    (deviceMemory <= 2 || (deviceMemory <= 4 && hardwareConcurrency !== undefined && hardwareConcurrency <= 4))
  ) || (deviceMemory === undefined && hardwareConcurrency !== undefined && hardwareConcurrency <= 2);

  return {
    contextTokens: lowMemory ? KANA_CONFIG.lowMemoryContextTokens : KANA_CONFIG.contextTokens,
    maxNewTokens: lowMemory ? KANA_CONFIG.lowMemoryMaxNewTokens : KANA_CONFIG.maxNewTokens,
    wasmThreads: 1,
  };
}

export type KanaCapabilitySnapshot = Readonly<{
  webAssembly: boolean;
  webAssemblySimd: boolean | null;
  worker: boolean;
  browserCache: boolean;
  persistentStorage: boolean;
  webGPUAvailable: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}>;

export function getKanaCapabilitySnapshot(): KanaCapabilitySnapshot {
  const nav = typeof navigator === "undefined" ? undefined : navigator as Navigator & { deviceMemory?: number; gpu?: unknown };
  let webAssemblySimd: boolean | null = null;

  if (typeof WebAssembly !== "undefined") {
    try {
      webAssemblySimd = WebAssembly.validate(new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123,
        3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 11,
      ]));
    } catch {
      webAssemblySimd = false;
    }
  }

  return {
    webAssembly: typeof WebAssembly !== "undefined",
    webAssemblySimd,
    worker: typeof Worker !== "undefined",
    browserCache: typeof caches !== "undefined",
    persistentStorage: typeof nav?.storage?.persist === "function",
    webGPUAvailable: Boolean(nav?.gpu),
    ...(typeof nav?.deviceMemory === "number" ? { deviceMemory: nav.deviceMemory } : {}),
    ...(typeof nav?.hardwareConcurrency === "number" ? { hardwareConcurrency: nav.hardwareConcurrency } : {}),
  };
}
