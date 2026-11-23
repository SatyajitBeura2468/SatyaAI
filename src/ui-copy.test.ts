import { describe, expect, it } from "vitest";
import { CHAKSHU_STUDIO_HEADLINES, DRISHTI_STUDIO_HEADLINES, EMPTY_CONVERSATION_COPY, HOME_HERO_OPTIONS, MORE_TOOLS_COPY, REASONING_MODE_DESCRIPTIONS, pickOnLoad } from "./ui-copy";
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

  it("keeps the five reasoning descriptions in a clear capability progression", () => {
    expect(REASONING_MODE_DESCRIPTIONS).toEqual({
      micro: "Featherweight intelligence for the simplest of everyday tasks.",
      nano: "Light on resources, ready for a wider range of everyday tasks.",
      fast: "Responsive intelligence that gets things done without the wait.",
      smart: "Balanced reasoning for thoughtful, well-rounded answers.",
      deep: "Deeper analysis for ambitious ideas and challenging problems.",
    });
  });

  it("lists Deep Research beside Web Search as a disabled coming-soon tool", () => {
    expect(MORE_TOOLS_COPY.map((tool) => tool.label)).toEqual(["Web search", "Deep research"]);
    expect(MORE_TOOLS_COPY.every((tool) => tool.status === "Coming soon")).toBe(true);
    expect(MORE_TOOLS_COPY[1].description).toContain("complex questions in depth");
    expect(MORE_TOOLS_COPY[1].description).toContain("detailed reports");
  });
});
