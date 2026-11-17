export const SATYAAI_FOUNDATION = "SatyaSom Engine";

export const SATYAAI_TIERS = Object.freeze({
  nano: Object.freeze({ name: "Anu", symbol: "⚛", modeLabel: "Nano" }),
  fast: Object.freeze({ name: "Indu", symbol: "☾", modeLabel: "Fast" }),
  smart: Object.freeze({ name: "Dhara", symbol: "🌍", modeLabel: "Smart" }),
  deep: Object.freeze({ name: "Aditya", symbol: "☀", modeLabel: "Deep Think" }),
});

export function getSatyaTier(mode) {
  return typeof mode === "string" &&
    Object.prototype.hasOwnProperty.call(SATYAAI_TIERS, mode)
    ? SATYAAI_TIERS[mode]
    : null;
}

// Backward-compatible aliases for any cached or older internal imports.
export const SATYAAI_ENGINES = SATYAAI_TIERS;
export const getSatyaEngine = getSatyaTier;
