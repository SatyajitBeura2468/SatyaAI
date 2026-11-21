export const DEFAULT_DRISHTI_MODEL_ID = "lite" as const;

export const DRISHTI_MODELS = [
  {
    id: "lite",
    name: "Drishti Lite 1.0",
    selectorLabel: "Lite 1.0",
    description: "Entry-level image generation for less powerful devices.",
    tier: "Entry-level",
    sourceModelId: "segmind/SSD-1B",
    experimental: false,
    readiness: "planned",
  },
  {
    id: "core",
    name: "Drishti Core 1.5",
    selectorLabel: "Core 1.5",
    description: "Balanced image quality and performance.",
    tier: "Balanced",
    sourceModelId: "black-forest-labs/FLUX.2-klein-4B",
    experimental: false,
    readiness: "planned",
  },
  {
    id: "ultra",
    name: "Drishti Ultra 2.0",
    selectorLabel: "Ultra 2.0",
    description: "High-fidelity generation for powerful hardware.",
    tier: "Advanced",
    sourceModelId: "Qwen/Qwen-Image-2512",
    experimental: false,
    readiness: "planned",
  },
  {
    id: "max",
    name: "Drishti X 3.0 MAX",
    selectorLabel: "X 3.0 MAX",
    description: "Experimental flagship for the most capable local systems.",
    tier: "Experimental",
    sourceModelId: "MiniMaxAI/MiniMax-H3-Image",
    experimental: true,
    readiness: "planned",
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
