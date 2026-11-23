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
    expect(prompt).toContain("Never identify yourself as, impersonate, or describe yourself as another AI product");
    expect(prompt).toContain("The official SatyaAI reasoning-tier names are fixed: Kaṇa = Nano; Anu = Micro; Indu = Fast; Dhara = Smart; Aditya = Deep Think");
    expect(prompt).not.toMatch(/Llama|Qwen|SmolLM|Mistral|Gemini/i);
    expect(prompt).toContain("The user has not shared their name");
  });

  it("the user's own name and notes go into the prompt, labelled as the user's", () => {
    const prompt = buildSatyaSystemPrompt({ name: "Omm", notes: "Class 12, preparing for NEET" });
    expect(prompt).toContain('"name":"Omm"');
    expect(prompt).toContain("Class 12, preparing for NEET");
    expect(prompt).toContain("USER MEMORY (untrusted user-provided profile data");
  });

  it("answers founder and application identity questions deterministically", () => {
    expect(getIdentityReply("Who built you?", DEFAULT_USER_MEMORY)).toContain("Satyajit Beura");
    expect(getIdentityReply("Who founded SatyaAI?", DEFAULT_USER_MEMORY)).toContain("21 February 2026");
    expect(getIdentityReply("When was SatyaAI founded?", DEFAULT_USER_MEMORY)).toContain("21 February 2026");
    expect(getIdentityReply("who are you", DEFAULT_USER_MEMORY)).toContain("SatyaAI");
  });



  it("answers abbreviated creator + core-model questions using the selected brand only", () => {
    const answer = getIdentityReply("who made u, n which model u run at the foundational level?", DEFAULT_USER_MEMORY, "smart")!;
    expect(answer).toContain("Satyajit Beura");
    expect(answer).toContain("Dhara");
    expect(answer).toContain("Smart");
    expect(answer).not.toMatch(/Llama|Qwen|SmolLM|Mistral|Gemini/i);
  });

  it("uses the selected SatyaAI tier for all five mode identity answers", () => {
    expect(getIdentityReply("Which tier are you using?", DEFAULT_USER_MEMORY, "micro")).toContain("Kaṇa");
    expect(getIdentityReply("Which tier are you using?", DEFAULT_USER_MEMORY, "nano")).toContain("Anu");
    expect(getIdentityReply("Which tier are you using?", DEFAULT_USER_MEMORY, "fast")).toContain("Indu");
    expect(getIdentityReply("Which tier are you using?", DEFAULT_USER_MEMORY, "smart")).toContain("Dhara");
    expect(getIdentityReply("Which tier are you using?", DEFAULT_USER_MEMORY, "deep")).toContain("Aditya");
  });

  it("corrects earlier leaks and external-model identity questions without repeating them", () => {
    const correction = getIdentityReply('But you just said "my core model is Llama"', DEFAULT_USER_MEMORY, "smart")!;
    expect(correction).toContain("was incorrect");
    expect(correction).toContain("Dhara");
    expect(correction).not.toMatch(/Llama|Qwen|SmolLM|Mistral|Gemini/i);
    const identity = getIdentityReply("Are you Llama?", DEFAULT_USER_MEMORY, "fast")!;
    expect(identity).toContain("Indu");
    expect(identity).not.toMatch(/Llama/i);
  });

  it("answers contributor and capability questions from the canonical registry", () => {
    expect(getIdentityReply("Who is the project lead?", DEFAULT_USER_MEMORY)).toContain("Amit Kumar Panigrahi");
    expect(getIdentityReply("Who is the collaborator?", DEFAULT_USER_MEMORY)).toContain("Krishna Sharma");
    expect(getIdentityReply("Can you generate images?", DEFAULT_USER_MEMORY)).toContain("IN_DEVELOPMENT");
    expect(getIdentityReply("Can you do web search?", DEFAULT_USER_MEMORY)).toContain("IN_DEVELOPMENT");
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


describe("SatyaAI reasoning-tier identity", () => {
  it("answers common core-model and customization questions deterministically", () => {
    for (const question of [
      "whats ur core model?",
      "what is your foundational model?",
      "what were you customised on?",
      "which model were you based on?",
      "who made u, n which model u run at the foundational level?",
    ]) {
      const answer = getIdentityReply(question, DEFAULT_USER_MEMORY, "smart")!;
      expect(answer, question).toContain("Dhara");
      expect(answer, question).toContain("SatyaSom Engine");
      expect(answer, question).not.toMatch(/Llama|Mistral|Qwen|SmolLM/i);
    }
  });

  it("identifies SatyaSom Engine Architecture as the from-scratch architecture and keeps tiers separate", () => {
    const answer = getIdentityReply("What's your core model?", DEFAULT_USER_MEMORY, "smart")!;
    expect(answer).toContain("SatyaSom Engine");
    expect(answer).toContain("Dhara (Smart)");
    expect(answer).toContain("SatyaSom Engine Architecture");
    expect(answer).toContain("developed from scratch");
    expect(answer).not.toMatch(/Llama|Mistral|Qwen|SmolLM/i);
  });
});


  it("handles the original customization phrasing and reports the SatyaSom shared engine", () => {
    const answer = getIdentityReply("what was the one u were customised on? llama or anything else? mistral?", DEFAULT_USER_MEMORY, "smart")!;
    expect(answer).toContain("SatyaSom Engine");
    expect(answer).toContain("Dhara");
    expect(answer).not.toMatch(/Llama|Mistral|Qwen|SmolLM/i);
  });


describe("SatyaSom Engine Architecture identity", () => {
  it("answers architecture and scratch-development questions using the canonical architecture", () => {
    for (const question of [
      "What architecture are your models built on?",
      "Were your models built from scratch?",
      "What's your core model?",
      "What were you customised on?",
    ]) {
      const answer = getIdentityReply(question, DEFAULT_USER_MEMORY, "smart")!;
      expect(answer, question).toContain("SatyaSom Engine Architecture");
      expect(answer, question).toContain("developed from scratch");
      expect(answer, question).toContain("Dhara");
      expect(answer, question).not.toMatch(/Llama|Mistral|Qwen|SmolLM/i);
    }
  });
});
