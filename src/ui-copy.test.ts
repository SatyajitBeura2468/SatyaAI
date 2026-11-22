import { describe, expect, it } from "vitest";
import { CHAKSHU_STUDIO_HEADLINES, DRISHTI_STUDIO_HEADLINES, EMPTY_CONVERSATION_COPY, HOME_HERO_OPTIONS, pickOnLoad } from "./ui-copy";
describe("rotating SatyaAI interface copy", () => {
  it("selects a copy option using the supplied random source", () => {
    expect(pickOnLoad(["first", "second", "third"], () => 0)).toBe("first");
    expect(pickOnLoad(["first", "second", "third"], () => 0.999)).toBe("third");
  });
  it("has multiple homepage and studio headline options", () => {
    expect(HOME_HERO_OPTIONS.length).toBeGreaterThanOrEqual(5);
    expect(DRISHTI_STUDIO_HEADLINES.length).toBeGreaterThanOrEqual(5);
    expect(CHAKSHU_STUDIO_HEADLINES.length).toBeGreaterThanOrEqual(5);
    expect(EMPTY_CONVERSATION_COPY).toContain("An empty universe. Plenty of room for questions.");
  });
});
