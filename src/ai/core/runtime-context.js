import { getSatyaTier, SATYASOM_ENGINE_NAME, SATYASOM_ARCHITECTURE, SATYAAI_TIERS } from "./engines.js";

const VALID_MODES = new Set(["nano", "fast", "smart", "deep"]);
const VALID_ROUTES = new Set(["browser-local", "remote-gateway", "custom-compatible", "unknown"]);

export function normalizeRuntimeContext(input = {}) {
  const mode = VALID_MODES.has(input.mode) ? input.mode : null;
  const inferenceRoute = VALID_ROUTES.has(input.inferenceRoute) ? input.inferenceRoute : "unknown";
  return Object.freeze({
    mode,
    inferenceRoute,
    tier: getSatyaTier(mode),
    availableTools: Array.isArray(input.availableTools)
      ? input.availableTools.filter((item) => typeof item === "string").slice(0, 10)
      : [],
    localInferenceAvailable: typeof input.localInferenceAvailable === "boolean" ? input.localInferenceAvailable : null,
    remoteInferenceAvailable: typeof input.remoteInferenceAvailable === "boolean" ? input.remoteInferenceAvailable : null,
  });
}

export function formatRuntimeContext(input) {
  const runtime = normalizeRuntimeContext(input);
  const tierMap = Object.values(SATYAAI_TIERS)
    .map((tier) => tier.modeLabel + " = " + tier.name)
    .join("; ");
  return [
    "RUNTIME CONTEXT (trusted SatyaAI application configuration)",
    "Product identity: SatyaAI (permanent and unchanging)",
    "Shared model engine: " + SATYASOM_ENGINE_NAME + ".",
    "Shared architecture: " + SATYASOM_ARCHITECTURE + ", designed and developed from scratch.",
    "Shared architecture: " + SATYASOM_ARCHITECTURE + ", developed from scratch by SatyaAI.",
    "Selected reasoning mode: " + (runtime.tier?.modeLabel || "Not supplied"),
    "Selected SatyaAI tier: " + (runtime.tier?.name || "Not supplied by trusted runtime metadata; do not guess"),
    "Official SatyaAI tier mapping: " + tierMap + ".",
    "These names identify reasoning tiers only. They are not foundation-model, architecture, publisher, or checkpoint names.",
    "When asked which SatyaAI tier is active, report only the selected tier name and reasoning mode above.",
    "All SatyaAI model variants are designed as part of the same SatyaSom Engine Architecture. Each tier is a purpose-built variant with its own intended workload, model scale, parameter configuration, capabilities, and generation settings.",
    "There is no single universal foundation model shared across the four tiers. SatyaSom Engine is the shared architecture and engine framework; Anu, Indu, Dhara, and Aditya are its model variants.",
    "Internal implementation identifiers are not part of the user-facing product identity and must not be guessed or disclosed.",
    "Never identify SatyaAI with an external AI product, model brand, model family, publisher, architecture, or checkpoint.",
    "Inference route: " + runtime.inferenceRoute,
    "Available tools in this request: " + (runtime.availableTools.length ? runtime.availableTools.join(", ") : "No tools declared"),
    "Local inference available in this runtime: " + (runtime.localInferenceAvailable === null ? "Unknown" : String(runtime.localInferenceAvailable)),
    "Remote inference available in this runtime: " + (runtime.remoteInferenceAvailable === null ? "Unknown" : String(runtime.remoteInferenceAvailable)),
    "A remote inference route sends request context to the configured remote service; never describe that route as on-device or local.",
  ].join("\n");
}
