import { describe, expect, it } from "vitest";
import { MODE_CONFIG } from "./providers";

describe("SatyaAI inference modes", () => {
  it("routes Nano to the bundled WebLLM SmolLM2 360M model", () => {
    expect(MODE_CONFIG.nano.model).toBe("SmolLM2-360M-Instruct-q4f16_1-MLC");
    expect(MODE_CONFIG.nano.maxTokens).toBe(192);
    expect(MODE_CONFIG.nano.maxTokens).toBeLessThan(MODE_CONFIG.fast.maxTokens);
  });

  it("keeps existing Fast, Smart, and Deep Think model assignments intact", () => {
    expect(MODE_CONFIG.fast.model).toBe("Llama-3.2-1B-Instruct-q4f16_1-MLC");
    expect(MODE_CONFIG.smart.model).toBe("Llama-3.2-3B-Instruct-q4f16_1-MLC");
    expect(MODE_CONFIG.deep.model).toBe("Llama-3.2-3B-Instruct-q4f16_1-MLC");
  });
});
