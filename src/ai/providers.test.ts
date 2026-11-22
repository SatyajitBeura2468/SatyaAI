import { describe, expect, it } from "vitest";
import { MODE_CONFIG } from "./providers";
import { SATYAAI_TIERS } from "./core/index.js";

describe("SatyaAI inference modes", () => {
  it("routes Nano to the bundled WebLLM SmolLM2 360M model", () => {
    expect(MODE_CONFIG.nano.model).toBe("SmolLM2-360M-Instruct-q4f16_1-MLC");
    expect(MODE_CONFIG.nano.maxTokens).toBe(512);
    expect(MODE_CONFIG.nano.maxTokens).toBeLessThan(MODE_CONFIG.fast.maxTokens);
  });

  it("keeps existing Fast, Smart, and Deep Think model assignments intact", () => {
    expect(MODE_CONFIG.fast.model).toBe("Llama-3.2-1B-Instruct-q4f16_1-MLC");
    expect(MODE_CONFIG.smart.model).toBe("Llama-3.2-3B-Instruct-q4f16_1-MLC");
    expect(MODE_CONFIG.deep.model).toBe("Llama-3.2-3B-Instruct-q4f16_1-MLC");
  });
});


describe("SatyaAI branded tier routing", () => {
  it("maps each reasoning mode to its permanent public tier identity", () => {
    expect(SATYAAI_TIERS).toEqual({
      nano: { name: "Anu", symbol: "⚛", modeLabel: "Nano" },
      fast: { name: "Indu", symbol: "☾", modeLabel: "Fast" },
      smart: { name: "Dhara", symbol: "🌍", modeLabel: "Smart" },
      deep: { name: "Aditya", symbol: "☀", modeLabel: "Deep Think" },
    });
  });
  it("keeps Deep Think distinct by its larger reasoning budget", () => {
    expect(MODE_CONFIG.deep.maxTokens).toBeGreaterThan(MODE_CONFIG.smart.maxTokens);
    expect(MODE_CONFIG.deep.temperature).toBeLessThan(MODE_CONFIG.smart.temperature);
  });
});
