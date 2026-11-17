import { describe, expect, it } from "vitest";
import { createThinkingPhraseOrder, THINKING_PHRASES } from "./thinking-phrases";

describe("SatyaAI thinking-line rotation", () => {
  it("contains the 30 selected English-first Hinglish lines", () => {
    expect(THINKING_PHRASES).toHaveLength(30);
    expect(THINKING_PHRASES[0]).toBe("One sec, logging in to my dimaag…");
    expect(THINKING_PHRASES).toContain("Let's not rush into a beautiful mistake…");
    expect(THINKING_PHRASES).not.toContain("Zara vichaar kar raha hoon…");
  });

  it("shuffles every phrase exactly once per cycle", () => {
    const order = createThinkingPhraseOrder();
    expect(order).toHaveLength(THINKING_PHRASES.length);
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: THINKING_PHRASES.length }, (_, index) => index),
    );
  });

  it("does not repeat the previous cycle's final phrase at the next cycle boundary", () => {
    for (let previousLastIndex = 0; previousLastIndex < THINKING_PHRASES.length; previousLastIndex += 1) {
      const nextOrder = createThinkingPhraseOrder(previousLastIndex);
      expect(nextOrder[0]).not.toBe(previousLastIndex);
    }
  });
});
