import { describe, expect, it } from "vitest";
import {
  DEFAULT_USER_MEMORY,
  buildSatyaSystemPrompt,
  extractNameCorrection,
  getIdentityReply,
  sanitizeMemory,
} from "./identity";

describe("SatyaAI identity and saved memory", () => {
  it("keeps the creator identity separate from the underlying model", () => {
    const prompt = buildSatyaSystemPrompt(DEFAULT_USER_MEMORY);
    expect(prompt).toContain("created and developed by Satyajit Beura");
    expect(prompt).toContain("Model publisher/authorship and the creator");
    expect(prompt).toContain("Never identify yourself as Meta AI");
  });

  it("answers creator questions deterministically", () => {
    expect(getIdentityReply("Who built you?", DEFAULT_USER_MEMORY))
      .toContain("Satyajit Beura");
  });

  it("answers user identity from saved memory", () => {
    expect(getIdentityReply("Who am I?", DEFAULT_USER_MEMORY))
      .toContain("Satyajit Beura");
  });

  it("extracts a corrected name without the rejected name", () => {
    expect(extractNameCorrection("I said Satyajit Beura, not Ray!"))
      .toBe("Satyajit Beura");
  });

  it("bounds and normalizes editable memory", () => {
    expect(sanitizeMemory({ name: "  Omm  ", notes: "  Creator profile  " }))
      .toEqual({ name: "Omm", notes: "Creator profile" });
    expect(sanitizeMemory({ name: "", notes: "" }))
      .toEqual(DEFAULT_USER_MEMORY);
  });
});
