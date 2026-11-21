export const DEFAULT_CHAKSHU_MODEL_ID = "light" as const;

export const CHAKSHU_MODELS = [
  {
    id: "light",
    name: "Chakshu Light",
    selectorLabel: "Light",
    description: "The smallest model in the family. 480p text-to-video; still needs a supported GPU.",
    quality: "Wan2.1 · 1.3B · 480p · silent MP4",
    sourceModelId: "Wan-AI/Wan2.1-T2V-1.3B-Diffusers",
    license: "Apache-2.0",
    hardware: "About 9 GB free NVIDIA VRAM, 12 GB available RAM and 15 GB free disk",
    experimental: false,
  },
  {
    id: "chakshu",
    name: "Chakshu",
    selectorLabel: "Chakshu",
    description: "Balanced high-quality text-to-video at 720p-class resolution and 24 fps.",
    quality: "Wan2.2 TI2V · 5B · 720p-class · silent MP4",
    sourceModelId: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
    license: "Apache-2.0",
    hardware: "About 24 GB free NVIDIA VRAM, 24 GB available RAM and 45 GB free disk",
    experimental: false,
  },
  {
    id: "divya",
    name: "Divya Chakshu 1",
    selectorLabel: "Divya Chakshu 1",
    description: "Flagship open-weight 22B audio-video model for high-memory workstations.",
    quality: "LTX-2.5 · 22B · synchronized video and audio",
    sourceModelId: "Lightricks/LTX-2.5-Diffusers",
    license: "LTX-2.x Community License",
    hardware: "About 48 GB free NVIDIA VRAM, 48 GB available RAM and 120 GB free disk",
    experimental: true,
  },
] as const;

export type ChakshuModelId = (typeof CHAKSHU_MODELS)[number]["id"];
export type ChakshuModel = (typeof CHAKSHU_MODELS)[number];

export function isChakshuModelId(value: unknown): value is ChakshuModelId {
  return typeof value === "string" && CHAKSHU_MODELS.some((model) => model.id === value);
}

export function getChakshuModel(id: ChakshuModelId): ChakshuModel {
  return CHAKSHU_MODELS.find((model) => model.id === id) ?? CHAKSHU_MODELS[0];
}
