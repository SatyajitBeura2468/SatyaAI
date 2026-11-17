const VALID_MODES = new Set(["nano", "fast", "smart", "deep"]);
const VALID_ROUTES = new Set(["browser-local", "remote-gateway", "custom-compatible", "unknown"]);

function cleanLabel(value, maxLength = 160) {
  return typeof value === "string" ? value.trim().replace(/[\r\n\0]/g, " ").slice(0, maxLength) : "";
}

export function normalizeRuntimeContext(input = {}) {
  const mode = VALID_MODES.has(input.mode) ? input.mode : null;
  const inferenceRoute = VALID_ROUTES.has(input.inferenceRoute) ? input.inferenceRoute : "unknown";
  return Object.freeze({
    mode,
    inferenceRoute,
    provider: cleanLabel(input.provider, 120) || null,
    activeModel: cleanLabel(input.activeModel, 180) || null,
    availableTools: Array.isArray(input.availableTools)
      ? input.availableTools.filter((item) => typeof item === "string").slice(0, 10).map((item) => cleanLabel(item, 60))
      : [],
    localInferenceAvailable: typeof input.localInferenceAvailable === "boolean" ? input.localInferenceAvailable : null,
    remoteInferenceAvailable: typeof input.remoteInferenceAvailable === "boolean" ? input.remoteInferenceAvailable : null,
  });
}

export function formatRuntimeContext(input) {
  const runtime = normalizeRuntimeContext(input);
  const modeNames = { nano: "Nano", fast: "Fast", smart: "Smart", deep: "Deep Think" };
  return [
    "RUNTIME CONTEXT (trusted application configuration)",
    "Operating mode: " + (runtime.mode ? modeNames[runtime.mode] : "Not supplied"),
    "Inference route: " + runtime.inferenceRoute,
    "Provider: " + (runtime.provider || "Not exposed by this runtime"),
    "Active model: " + (runtime.activeModel || "Not exposed by trusted runtime metadata; do not guess or infer a model name"),
    "Available tools in this request: " + (runtime.availableTools.length ? runtime.availableTools.join(", ") : "No tools declared"),
    "Local inference available in this runtime: " + (runtime.localInferenceAvailable === null ? "Unknown" : String(runtime.localInferenceAvailable)),
    "Remote inference available in this runtime: " + (runtime.remoteInferenceAvailable === null ? "Unknown" : String(runtime.remoteInferenceAvailable)),
    "Nano, Fast, Smart, and Deep Think are product modes, not model identities. Never claim a specific active model unless the Active model field above supplies it.",
    "A remote inference route sends request context to the configured remote provider; never describe that route as on-device or local.",
  ].join("\n");
}