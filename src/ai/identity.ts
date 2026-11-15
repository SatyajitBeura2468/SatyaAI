// ---------------------------------------------------------------------------
// Two separate things live here, and they must never be mixed:
//
//  1. APP_IDENTITY  - what SatyaAI itself knows about who made it. This is internal.
//                     It is sent to the model and used for "who created you?" answers,
//                     but it is never shown in, or editable from, the interface.
//  2. UserMemory    - what the *user* chose to tell SatyaAI (what to call them, and a
//                     few notes about themselves). Empty by default, stored only in
//                     the user's own browser, and fully editable by them.
// ---------------------------------------------------------------------------

export const APP_IDENTITY = {
  appName: "SatyaAI",
  creator: "Satyajit Beura",
} as const;

export type UserMemory = {
  name: string;
  notes: string;
};

export const DEFAULT_USER_MEMORY: UserMemory = { name: "", notes: "" };

// Older builds saved the creator's details as if they were the user's own memory.
// Anything matching that old default is discarded so it can never resurface.
const LEGACY_CREATOR_NOTE = /is the creator and owner of SatyaAI/i;

export function sanitizeMemory(value: unknown): UserMemory {
  const candidate = value && typeof value === "object" ? (value as Partial<UserMemory>) : {};

  let name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 80) : "";
  let notes = typeof candidate.notes === "string" ? candidate.notes.trim().slice(0, 3000) : "";

  if (LEGACY_CREATOR_NOTE.test(notes)) {
    notes = "";
    if (name === APP_IDENTITY.creator) name = "";
  }

  return { name, notes };
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

/**
 * Only explicit statements count: "my name is X", "call me X", or a correction like
 * "I said X, not Y". Plain "I am ..." / "I'm ..." is NOT a name ("I'm preparing for NEET").
 */
export function extractNameCorrection(input: string): string | null {
  const match = input.match(
    /\b(?:my name is|call me|i said)\s+([\p{L}][\p{L}\s.'-]{1,58}?)(?=\s*,?\s+not\b|[.!?,]|$)/iu,
  );
  if (!match?.[1]) return null;

  const name = match[1].trim().replace(/\s+/g, " ");
  const words = name.split(" ");
  if (name.length < 2 || name.length > 60 || words.length > 4) return null;
  if (NOT_A_NAME.has(words[0].toLowerCase())) return null;
  return name;
}

export function buildSatyaSystemPrompt(memory: UserMemory): string {
  const safe = sanitizeMemory(memory);

  const lines = [
    `IDENTITY: You are ${APP_IDENTITY.appName}, a distinct AI assistant application. Your name is ${APP_IDENTITY.appName}. Never identify yourself as Meta AI, Llama, Ray, or another assistant.`,
    `CREATOR: ${APP_IDENTITY.appName}'s application, interface, product identity, and orchestration were created and developed by ${APP_IDENTITY.creator}. When asked who built or created ${APP_IDENTITY.appName}, give that answer directly. Do not volunteer this unless it is relevant.`,
    `MODEL PROVENANCE: ${APP_IDENTITY.appName} runs third-party open-weight language models as its underlying engine. Model publisher/authorship and the creator of the ${APP_IDENTITY.appName} application are different facts. Never attribute the ${APP_IDENTITY.appName} application to the publisher of its underlying model. If specifically asked about the underlying model's origin, answer truthfully and distinguish it from ${APP_IDENTITY.appName}'s creator.`,
    "CORRECTIONS: Treat the user's direct corrections as authoritative. If corrected about a name or identity, acknowledge it briefly and use the exact corrected form thereafter.",
    "RELIABILITY: Do not invent biographical details, claim access to information not provided, or guess when uncertain. Be clear about what you know and what you do not know.",
  ];

  lines.push(
    safe.name
      ? `USER: The user asked to be called "${safe.name}". Use this name naturally and exactly; do not invent a different name, spelling, or title.`
      : "USER: The user has not shared their name. Do not guess or invent one.",
  );
  if (safe.notes) lines.push("ABOUT THE USER (written by the user): " + safe.notes);

  return lines.join("\n");
}

export function getIdentityReply(input: string, memory: UserMemory): string | null {
  const question = input.trim().toLowerCase();
  const safe = sanitizeMemory(memory);
  const correctedName = extractNameCorrection(input);

  if (correctedName) {
    return `Got it. I'll call you ${correctedName} from now on.`;
  }

  if (/\b(who (built|created|made|developed) you|who is your creator|who created satyaai|who built satyaai|who is behind satyaai)\b/.test(question)) {
    return `${APP_IDENTITY.appName} was created and developed by ${APP_IDENTITY.creator}. He built the application, interface, product identity, and orchestration. The language model running underneath is an engine used by ${APP_IDENTITY.appName}, not the creator of this application.`;
  }

  if (/\b(who are you|what are you|what is your name|what's your name|introduce yourself)\b/.test(question)) {
    return `I'm ${APP_IDENTITY.appName}, an AI assistant application created by ${APP_IDENTITY.creator}. I provide the interface and assistant experience you are using here.`;
  }

  if (/\b(are you meta ai|are you llama|are you ray)\b/.test(question)) {
    return `No. I'm ${APP_IDENTITY.appName}, a separate AI application created by ${APP_IDENTITY.creator}. I may use an open-weight language model underneath, but that does not change my identity.`;
  }

  if (/\b(who am i|what is my name|what's my name|do you know my name)\b/.test(question)) {
    if (!safe.name) {
      return "I don't know your name yet. Say \"call me …\" or add it under Settings → Your profile, and I'll remember it on this device.";
    }
    return `I have you down as ${safe.name}.` + (safe.notes ? ` Here's what you've told me about yourself: ${safe.notes}` : "");
  }

  return null;
}
