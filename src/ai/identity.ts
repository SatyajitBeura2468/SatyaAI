import { buildSatyaCorePrompt, sanitizeCoreUserMemory, CORE_METADATA, FOUNDER, TEAM, CAPABILITIES, getSatyaEngine, SATYAAI_ENGINES, type CoreRuntimeContext, type CoreUserMemory, type SatyaEngineMode } from "./core/index.js";

export { getSatyaEngine, SATYAAI_ENGINES };
export type { SatyaEngineMode };

export const APP_IDENTITY = { appName: CORE_METADATA.productName, creator: FOUNDER.fullName } as const;
export type UserMemory = CoreUserMemory;
export type RuntimeContext = CoreRuntimeContext;
export const DEFAULT_USER_MEMORY: UserMemory = { name: "", notes: "" };

export function sanitizeMemory(value: unknown): UserMemory {
  return sanitizeCoreUserMemory(value);
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters.map((word) => Array.from(word)[0]?.toUpperCase() ?? "").join("");
}

const NOT_A_NAME = new Set([
  "later", "back", "tomorrow", "tonight", "today", "maybe", "soon", "now", "please", "when", "if",
  "anytime", "again", "first", "tired", "hungry", "sorry", "fine", "good", "okay", "ok", "ready",
]);

export function extractNameCorrection(input: string): string | null {
  const match = input.match(/\b(?:my name is|call me|i said)\s+([\p{L}][\p{L}\s.'-]{1,58}?)(?=\s*,?\s+not\b|[.!?,]|$)/iu);
  if (!match?.[1]) return null;
  const name = match[1].trim().replace(/\s+/g, " ");
  const words = name.split(" ");
  if (name.length < 2 || name.length > 60 || words.length > 4) return null;
  if (NOT_A_NAME.has(words[0].toLowerCase())) return null;
  return name;
}

export function buildSatyaSystemPrompt(memory: UserMemory, runtimeContext?: RuntimeContext): string {
  return buildSatyaCorePrompt({ userMemory: memory, runtimeContext });
}

function capabilityReply(id: string): string | null {
  const capability = CAPABILITIES.find((item) => item.id === id);
  return capability ? capability.name + " is currently marked " + capability.status + ". " + capability.details : null;
}

export function getIdentityReply(input: string, memory: UserMemory, mode: SatyaEngineMode = "smart"): string | null {
  const question = input.trim().toLowerCase()
    .replace(/\bu\b/g, "you")
    .replace(/\bur\b/g, "your")
    .replace(/\bn\b/g, "and");
  const safe = sanitizeMemory(memory);
  const correctedName = extractNameCorrection(input);
  const engine = getSatyaEngine(mode) ?? SATYAAI_ENGINES.smart;
  const engineFamily = Object.values(SATYAAI_ENGINES)
    .map((item) => item.name + " (" + item.modeLabel + ")")
    .join(", ");
  const asksCreator = /\bwho\s+(?:built|created|made|developed)\s+(?:you|yourself|satyaai)\b|\bwho\s+(?:is|was)\s+(?:your\s+creator|(?:the\s+)?(?:sole\s+)?founder)\b|\bwho\s+founded\s+satyaai\b|\bwho\s+is\s+behind\s+satyaai\b/.test(question);
  const asksEngine = /\b(?:which|what)\s+(?:(?:is|are)\s+)?(?:your\s+)?(?:(?:core|foundational|underlying|base)\s+)?(?:model|engine)\b|\bwhich\s+model\b|\bwhat\s+model\b|\b(?:foundational|underlying|base|core)\s+(?:model|engine)\b|\bwhat\s+(?:do|are)\s+you\s+(?:run|running|use|using|powered)\b|\bwhat\s+powers\s+you\b/.test(question);
  const asksPriorIdentityCorrection = /\b(?:you just said|you said|you mentioned|you claimed|earlier you said)\b/.test(question) && /\b(?:model|engine|ai|foundation|base|powered)\b/.test(question);
  const asksAboutExternalIdentity = /\b(?:are you|is satyaai|is this)\s+(?:an?\s+)?(?:meta\s+ai|llama|qwen|mistral|gemini|claude|chatgpt|gpt(?:[- ]?\d)?|deepseek|glm|grok|phi|smollm|ray)\b/i.test(question);
  const engineAnswer = "I'm SatyaAI. The currently selected reasoning mode is " + engine.modeLabel + ", powered by my " + engine.name + " engine. My official engine family is " + engineFamily + ". Internal implementation identifiers are not part of my user-facing identity.";
  const correctionAnswer = "You're right to question that. Any earlier answer that identified SatyaAI with another AI product or exposed an internal implementation label as my identity was incorrect. I'm SatyaAI, and the selected engine is " + engine.name + " (" + engine.modeLabel + ").";
  const creatorAnswer = "SatyaAI was founded on 21 February 2026 by " + FOUNDER.fullName + ", its Sole Founder. He initiated the project as an independent technology builder with the vision of creating India's Truth-First Private AI.";

  if (correctedName) return "Got it. I'll call you " + correctedName + " from now on.";
  if (asksPriorIdentityCorrection || asksAboutExternalIdentity) return correctionAnswer;
  if (asksCreator && asksEngine) return "I'm SatyaAI, founded on 21 February 2026 by " + FOUNDER.fullName + ", my Sole Founder. " + engineAnswer;
  if (asksEngine) return engineAnswer;
  if (asksCreator) return creatorAnswer;
  if (/\b(when was satyaai founded|when did satyaai start|satyaai founding date|what is satyaai'?s founding date)\b/.test(question)) {
    return "SatyaAI was founded on 21 February 2026 by " + FOUNDER.fullName + ", its Sole Founder.";
  }
  if (/\b(who is the project lead|who leads the project|who is satyaai'?s project lead)\b/.test(question)) return "Amit Kumar Panigrahi is SatyaAI's Project Lead. The Sole Founder remains Satyajit Beura.";
  if (/\b(who is the collaborator|who is satyaai'?s collaborator)\b/.test(question)) return "Krishna Sharma is recorded as a Collaborator on the SatyaAI team.";
  if (/\b(who is the product designer|who designs satyaai)\b/.test(question)) return "Aditya Soni contributes as SatyaAI's Product Designer.";
  if (/\b(who is the lead researcher|who leads research)\b/.test(question)) return "Vaibhav Mishra is recorded as SatyaAI's Lead Researcher.";
  if (/\b(who (?:is|are) (?:on|in) the (?:team|team roster)|list (?:the )?(?:satyaai )?(?:team|contributors)|who works on satyaai)\b/.test(question)) {
    return "SatyaAI's current team records are: " + TEAM.map((member) => member.name + " (" + member.designation + ")").join("; ") + ".";
  }
  if (/\b(who are you|what is satyaai|what are you|what is your purpose|what is your mission|why were you created)\b/.test(question)) {
    return "I'm SatyaAI, India's Truth-First Private AI: an independent AI application and orchestration system founded by " + FOUNDER.fullName + " on 21 February 2026. My guiding philosophy is truth before confidence, evidence before assumptions, and privacy before unnecessary exposure. My selected engine is " + engine.name + " (" + engine.modeLabel + ").";
  }
  if (/\b(can you (?:do )?web search|is web search (?:available|working|ready)|do you support web search)\b/.test(question)) return capabilityReply("web-search");
  if (/\b(can you (?:do )?deep research|is deep research (?:available|working|ready)|do you support deep research)\b/.test(question)) return capabilityReply("deep-research");
  if (/\b(can you (?:create|generate|make) images|do you generate images|is image creation available)\b/.test(question)) return capabilityReply("image-creation");
  if (/\b(who am i|what is my name|what's my name|do you know my name)\b/.test(question)) {
    if (!safe.name) return "I don't know your name yet. Say \"call me …\" or add it under Settings → Your profile, and I'll remember it on this device.";
    return "I have you down as " + safe.name + "." + (safe.notes ? " Here's what you've told me about yourself: " + safe.notes : "");
  }
  return null;
}
