import { getSatyaEngine, SATYAAI_ENGINES } from "./engines.js";

const VALID_MODES = new Set(["nano", "fast", "smart", "deep"]);
const VALID_ROUTES = new Set(["browser-local", "remote-gateway", "custom-compatible", "unknown"]);

export function normalizeRuntimeContext(input = {}) {
  const mode = VALID_MODES.has(input.mode) ? input.mode : null;
  const inferenceRoute = VALID_ROUTES.has(input.inferenceRoute) ? input.inferenceRoute : "unknown";
  return Object.freeze({
    mode,
    inferenceRoute,
    engine: getSatyaEngine(mode),
    availableTools: Array.isArray(input.availableTools)
      ? input.availableTools.filter((item) => typeof item === "string").slice(0, 10)
      : [],
    localInferenceAvailable: typeof input.localInferenceAvailable === "boolean" ? input.localInferenceAvailable : null,
    remoteInferenceAvailable: typeof input.remoteInferenceAvailable === "boolean" ? input.remoteInferenceAvailable : null,
  });
}

export function formatRuntimeContext(input) {
  const runtime = normalizeRuntimeContext(input);
  const engineMap = Object.values(SATYAAI_ENGINES)
    .map((engine) => engine.modeLabel + " = " + engine.name)
    .join("; ");
  return [
    "RUNTIME CONTEXT (trusted SatyaAI application configuration)",
    "Product identity: SatyaAI (permanent and unchanging)",
    "Selected reasoning mode: " + (runtime.engine?.modeLabel || "Not supplied"),
    "Selected SatyaAI engine: " + (runtime.engine?.name || "Not supplied by trusted runtime metadata; do not guess"),
    "Official SatyaAI engine mapping: " + engineMap + ".",
    "When asked which engine is active, report only the selected SatyaAI engine name and reasoning mode above.",
    "Internal inference implementation identifiers are not part of the user-facing product identity and must not be guessed or disclosed.",
    "Never identify SatyaAI with an external AI product, model brand, model family, publisher, architecture, or checkpoint. Never describe one as SatyaAI's base, foundation, core, or underlying engine.",
    "Inference route: " + runtime.inferenceRoute,
    "Available tools in this request: " + (runtime.availableTools.length ? runtime.availableTools.join(", ") : "No tools declared"),
    "Local inference available in this runtime: " + (runtime.localInferenceAvailable === null ? "Unknown" : String(runtime.localInferenceAvailable)),
    "Remote inference available in this runtime: " + (runtime.remoteInferenceAvailable === null ? "Unknown" : String(runtime.remoteInferenceAvailable)),
    "A remote inference route sends request context to the configured remote service; never describe that route as on-device or local.",
  ].join("\n");
}
