export const SATYAAI_ENGINES = Object.freeze({
  nano: Object.freeze({ name: "Anu", symbol: "⚛", modeLabel: "Nano" }),
  fast: Object.freeze({ name: "Indu", symbol: "☾", modeLabel: "Fast" }),
  smart: Object.freeze({ name: "Dhara", symbol: "🌍", modeLabel: "Smart" }),
  deep: Object.freeze({ name: "Aditya", symbol: "☀", modeLabel: "Deep Think" }),
});

export function getSatyaEngine(mode) {
  return typeof mode === "string" &&
    Object.prototype.hasOwnProperty.call(SATYAAI_ENGINES, mode)
    ? SATYAAI_ENGINES[mode]
    : null;
}
