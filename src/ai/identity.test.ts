import { describe, expect, it } from "vitest";
import {
  APP_IDENTITY,
  DEFAULT_USER_MEMORY,
  buildSatyaSystemPrompt,
  extractNameCorrection,
  getIdentityReply,
  getInitials,
  sanitizeMemory,
} from "./identity";

describe("creator identity is internal; user memory belongs to the user", () => {
  it("user memory is empty by default and never contains creator facts", () => {
    expect(DEFAULT_USER_MEMORY).toEqual({ name: "", notes: "" });
    expect(JSON.stringify(DEFAULT_USER_MEMORY)).not.toMatch(/Satyajit|creator|owner/i);
  });

  it("the model is told who created SatyaAI, even with an empty user profile", () => {
    const prompt = buildSatyaSystemPrompt(DEFAULT_USER_MEMORY);
    expect(prompt).toContain(`created and developed by ${APP_IDENTITY.creator}`);
    expect(prompt).toContain("Model publisher/authorship and the creator");
    expect(prompt).toContain("Never identify yourself as Meta AI");
    expect(prompt).toContain("The user has not shared their name");
  });

  it("the user's own name and notes go into the prompt, labelled as the user's", () => {
    const prompt = buildSatyaSystemPrompt({ name: "Omm", notes: "Class 12, preparing for NEET" });
    expect(prompt).toContain('called "Omm"');
    expect(prompt).toContain("ABOUT THE USER (written by the user): Class 12, preparing for NEET");
  });

  it("answers creator questions deterministically", () => {
    expect(getIdentityReply("Who built you?", DEFAULT_USER_MEMORY)).toContain("Satyajit Beura");
    expect(getIdentityReply("who are you", DEFAULT_USER_MEMORY)).toContain("SatyaAI");
  });

  it("'who am I' uses the user's memory, and asks politely when it is empty", () => {
    expect(getIdentityReply("Who am I?", { name: "Omm", notes: "" })).toContain("Omm");
    const empty = getIdentityReply("What's my name?", DEFAULT_USER_MEMORY)!;
    expect(empty).toContain("don't know your name");
    expect(empty).not.toMatch(/Satyajit/);
  });

  it("discards the old built-in creator 'memory' that earlier builds saved on devices", () => {
    const legacy = {
      name: "Satyajit Beura",
      notes: "Satyajit Beura is the creator and owner of SatyaAI. He created the SatyaAI application.",
    };
    expect(sanitizeMemory(legacy)).toEqual({ name: "", notes: "" });
    expect(sanitizeMemory({ name: "Omm", notes: legacy.notes })).toEqual({ name: "Omm", notes: "" });
  });

  it("bounds and normalizes editable memory, and lets users clear it", () => {
    expect(sanitizeMemory({ name: "  Omm  ", notes: "  likes physics  " })).toEqual({ name: "Omm", notes: "likes physics" });
    expect(sanitizeMemory({ name: "", notes: "" })).toEqual({ name: "", notes: "" });
    expect(sanitizeMemory("garbage")).toEqual({ name: "", notes: "" });
    expect(sanitizeMemory({ name: "x".repeat(500) }).name.length).toBe(80);
  });

  it("only explicit statements set a name", () => {
    expect(extractNameCorrection("My name is Priya Sharma.")).toBe("Priya Sharma");
    expect(extractNameCorrection("call me Omm")).toBe("Omm");
    expect(extractNameCorrection("I said Satyajit Beura, not Ray!")).toBe("Satyajit Beura");
  });

  it("ordinary sentences are never mistaken for a name", () => {
    for (const text of ["I'm preparing for NEET", "I am tired", "I'm hungry", "I am a student", "call me later", "call me tomorrow", "what does call me maybe mean"]) {
      expect(extractNameCorrection(text), text).toBeNull();
    }
  });

  it("builds initials for avatars", () => {
    expect(getInitials("")).toBe("");
    expect(getInitials("omm")).toBe("O");
    expect(getInitials("Priya Sharma")).toBe("PS");
    expect(getInitials("  anil kumar singh ")).toBe("AS");
  });
});
