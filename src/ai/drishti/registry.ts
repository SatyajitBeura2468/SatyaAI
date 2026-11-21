export const DEFAULT_DRISHTI_MODEL_ID = "lite" as const;

export const DRISHTI_MODELS = [
  {
    id: "lite",
    name: "Drishti Lite 1.0",
    selectorLabel: "Lite 1.0",
    description: "Entry-level local image generation for more modest hardware.",
    tier: "Entry-level",
    sourceModelId: "segmind/SSD-1B",
    license: "Apache-2.0",
    modelSize: "About 4.47 GB of checkpoint weights",
    hardware: "CUDA recommended; best-effort CPU fallback with 12 GB available system RAM, limited to 512px",
    experimental: false,
    readiness: "local-runtime-required",
  },
  {
    id: "core",
    name: "Drishti Core 1.5",
    selectorLabel: "Core 1.5",
    description: "Balanced image quality and performance for capable local GPUs.",
    tier: "Balanced",
    sourceModelId: "black-forest-labs/FLUX.2-klein-4B",
    license: "Apache-2.0",
    modelSize: "About 7.75 GB BF16 transformer weights",
    hardware: "NVIDIA CUDA GPU with about 13 GB free VRAM recommended",
    experimental: false,
    readiness: "local-runtime-required",
  },
  {
    id: "ultra",
    name: "Drishti Ultra 2.0",
    selectorLabel: "Ultra 2.0",
    description: "High-fidelity generation for high-memory workstations.",
    tier: "Advanced",
    sourceModelId: "Qwen/Qwen-Image-2512",
    license: "Apache-2.0",
    modelSize: "20B parameters; BF16 weights",
    hardware: "High-memory accelerator; a published BF16 serving benchmark reports about 59 GiB peak VRAM on an A800",
    experimental: false,
    readiness: "local-runtime-required",
  },
  {
    id: "max",
    name: "Drishti X 3.0 MAX",
    selectorLabel: "X 3.0 MAX",
    description: "Experimental flagship for specialist high-memory systems.",
    tier: "Experimental",
    sourceModelId: "MiniMaxAI/MiniMax-H3-Image",
    license: "MiniMax-H3-Image Community License Agreement",
    modelSize: "33.1B parameters; approximately 68.65 GB image model plus a separate 66.7 GB text encoder",
    hardware: "About 70 GB free VRAM on an 80 GB-class GPU and 140 GB free disk; licence and territory acknowledgement required",
    experimental: true,
    readiness: "local-runtime-required",
  },
] as const;

export type DrishtiModelId = (typeof DRISHTI_MODELS)[number]["id"];
export type DrishtiModel = (typeof DRISHTI_MODELS)[number];

export function isDrishtiModelId(value: unknown): value is DrishtiModelId {
  return typeof value === "string" &&
    DRISHTI_MODELS.some((model) => model.id === value);
}

export function getDrishtiModel(id: DrishtiModelId): DrishtiModel {
  return DRISHTI_MODELS.find((model) => model.id === id) ?? DRISHTI_MODELS[0];
}
