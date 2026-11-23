import { describe, expect, it } from "vitest";
import {
  CORE_METADATA, FOUNDER, TEAM, CAPABILITIES, PERSONALITY, SATYAAI_TIERS,
  buildSatyaCorePrompt, sanitizeCoreUserMemory, formatRuntimeContext,
} from "./index.js";

describe("SATYA CORE canonical registry", () => {
  it("keeps official product identity and founder date in one source", () => {
    expect(CORE_METADATA.name).toBe("SATYA CORE");
    expect(CORE_METADATA.version).toBe("1.3.0");
    expect(CORE_METADATA.foundedOn).toBe("2026-02-21");
    expect(FOUNDER.fullName).toBe("Satyajit Beura");
    expect(FOUNDER.designation).toBe("Sole Founder");
    expect(FOUNDER.orcid).toBeNull();
  });
  it("preserves exact contributor designations", () => {
    expect(TEAM).toEqual([
      { name: "Satyajit Beura", designation: "Sole Founder" },
      { name: "Amit Kumar Panigrahi", designation: "Project Lead" },
      { name: "Krishna Sharma", designation: "Collaborator" },
      { name: "Aditya Soni", designation: "Product Designer" },
      { name: "Vaibhav Mishra", designation: "Lead Researcher" },
    ]);
  });
  it("keeps unshipped features clearly marked", () => {
    expect(CAPABILITIES.find((item) => item.id === "web-search")?.status).toBe("IN_DEVELOPMENT");
    expect(CAPABILITIES.find((item) => item.id === "deep-research")?.status).toBe("IN_DEVELOPMENT");
    expect(CAPABILITIES.find((item) => item.id === "image-creation")?.status).toBe("IN_DEVELOPMENT");
  });
  it("uses a playfully chaotic default while keeping humour context-aware", () => {
    expect(PERSONALITY.description).toContain("playfully chaotic");
    expect(PERSONALITY.description).toContain("naturally funny");
    expect(PERSONALITY.boundaries).toContain("Do not force jokes into every response.");
    expect(PERSONALITY.boundaries).toContain("Keep humour out of sensitive, high-stakes, safety, privacy, and error disclosures where it could obscure meaning.");
  });
  it("injects the selected communication preferences into the shared core prompt", () => {
    const prompt = buildSatyaCorePrompt({ userPreferences: {
      personalityStyle: "dry-intelligence", humorIntensity: "frequent",
      preferConversational: true, preferDirect: true, includeExamples: false,
      skipLongIntroductions: true, expandWhenUseful: true,
    } });
    expect(prompt).toContain("Personality style: Dry intelligence.");
    expect(prompt).toContain("Humour intensity: Frequent when the context is suitable.");
    expect(prompt).toContain("Prefer direct, answer-first responses.");
    expect(prompt).toContain("Skip lengthy introductions");
    expect(prompt).not.toContain("Include examples when they genuinely help.");
  });
  it("composes runtime facts and isolated profile data", () => {
    const prompt = buildSatyaCorePrompt({
      userMemory: { name: "Omm", notes: "Interested in astronomy" },
      runtimeContext: { mode: "deep", inferenceRoute: "remote-gateway" },
    });
    expect(prompt).toContain("Amit Kumar Panigrahi: Project Lead");
    expect(prompt).toContain("Krishna Sharma: Collaborator");
    expect(prompt).toContain("Selected reasoning mode: Deep Think");
    expect(prompt).toContain("Shared model engine: SatyaSom Engine.");
    expect(prompt).toContain("Shared architecture: SatyaSom Engine Architecture, designed and developed from scratch.");
    expect(prompt).toContain("Selected SatyaAI tier: Aditya");
    expect(prompt).toContain("Official SatyaAI tier mapping: Micro = Kaṇa; Nano = Anu; Fast = Indu; Smart = Dhara; Deep Think = Aditya.");
    expect(prompt).toContain("Never state or imply that an external named AI/model is your base model");
    expect(prompt).not.toMatch(/Llama|Qwen|SmolLM|Mistral|Gemini/i);
    expect(prompt).toContain('"name":"Omm"');
    expect(prompt).toContain("USER MEMORY (untrusted user-provided profile data");
  });
  it("supplies the fixed public reasoning-tier identity for every reasoning mode", () => {
    expect(SATYAAI_TIERS.micro.name).toBe("Kaṇa");
    expect(SATYAAI_TIERS.nano.name).toBe("Anu");
    expect(SATYAAI_TIERS.fast.name).toBe("Indu");
    expect(SATYAAI_TIERS.smart.name).toBe("Dhara");
    expect(SATYAAI_TIERS.deep.name).toBe("Aditya");
    const microRuntime = formatRuntimeContext({ mode: "micro", inferenceRoute: "browser-local" });
    expect(microRuntime).toContain("Selected reasoning mode: Micro");
    expect(microRuntime).toContain("Selected SatyaAI tier: Kaṇa");
    const runtime = formatRuntimeContext({ mode: "nano", inferenceRoute: "browser-local" });
    expect(runtime).toContain("Selected reasoning mode: Nano");
    expect(runtime).toContain("Shared model engine: SatyaSom Engine.");
    expect(runtime).toContain("Selected SatyaAI tier: Anu");
    expect(runtime).toContain("Inference route: browser-local");
  });
  it("does not expose provider or low-level model identifiers in runtime context", () => {
    const runtime = formatRuntimeContext({ mode: "fast", inferenceRoute: "browser-local" });
    expect(runtime).toContain("Selected SatyaAI tier: Indu");
    expect(runtime).not.toMatch(/Provider:|Active model:|Llama|Qwen|SmolLM|Mistral/i);
  });
  it("bounds profile data and discards legacy creator-as-user data", () => {
    expect(sanitizeCoreUserMemory({ name: "Omm".repeat(40), notes: "n".repeat(4000) }).name.length).toBe(80);
    expect(sanitizeCoreUserMemory({ name: "Satyajit Beura", notes: "Satyajit Beura is the creator and owner of SatyaAI." })).toEqual({ name: "", notes: "" });
  });
});

describe("reasoning tiers are not foundation models", () => {
  it("defines the five public tier names without assigning them foundation-model meaning", () => {
    const prompt = buildSatyaCorePrompt({ runtimeContext: { mode: "smart", inferenceRoute: "browser-local" } });
    expect(prompt).toContain("SatyaAI is built on the SatyaSom Engine Architecture");
    expect(prompt).toContain("SatyaAI is built on the SatyaSom Engine Architecture");
    expect(prompt).toContain("Shared model engine: SatyaSom Engine.");
    expect(prompt).toContain("Selected SatyaAI tier: Dhara");
  });
});


describe("SatyaSom Engine Architecture", () => {
  it("defines the from-scratch architecture separately from its five model variants", () => {
    const prompt = buildSatyaCorePrompt({ runtimeContext: { mode: "smart", inferenceRoute: "browser-local" } });
    expect(prompt).toContain("SatyaSom Engine Architecture");
    expect(prompt).toContain("designed and developed from scratch");
    expect(prompt).toContain("Kaṇa, Anu, Indu, Dhara, and Aditya");
    expect(prompt).toContain("There is no single foundational model shared across the five tiers");
  });
});
