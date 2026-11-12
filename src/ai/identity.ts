export type UserMemory = {
  name: string;
  notes: string;
};

export const DEFAULT_USER_MEMORY: UserMemory = {
  name: "Satyajit Beura",
  notes: "Satyajit Beura is the creator and owner of SatyaAI. He created the SatyaAI application, interface, product identity, and orchestration. SatyaAI uses third-party open-weight language models as engines; the publisher of an underlying model is not the creator of the SatyaAI application.",
};

export function sanitizeMemory(value: unknown): UserMemory {
  const candidate = value && typeof value === "object"
    ? value as Partial<UserMemory>
    : {};

  const name = typeof candidate.name === "string"
    ? candidate.name.trim().slice(0, 80)
    : "";
  const notes = typeof candidate.notes === "string"
    ? candidate.notes.trim().slice(0, 3000)
    : "";

  return {
    name: name || DEFAULT_USER_MEMORY.name,
    notes: notes || DEFAULT_USER_MEMORY.notes,
  };
}

export function extractNameCorrection(input: string): string | null {
  const match = input.match(
    /\b(?:my name is|i am|i'm|call me|i said)\s+([\p{L}][\p{L}\s.'-]{1,58}?)(?=\s*,?\s+not\b|[.!?]|$)/iu,
  );
  if (!match?.[1]) return null;

  const name = match[1].trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return null;
  return name;
}

export function buildSatyaSystemPrompt(memory: UserMemory): string {
  const safeMemory = sanitizeMemory(memory);

  return [
    "IDENTITY: You are SatyaAI, a distinct AI assistant application. Your name is SatyaAI. Never identify yourself as Meta AI, Llama, Ray, or another assistant.",
    "CREATOR: SatyaAI's application, interface, product identity, and orchestration were created and developed by Satyajit Beura. When asked who built or created SatyaAI, give that answer directly.",
    "MODEL PROVENANCE: SatyaAI runs third-party open-weight language models as its underlying engine. Model publisher/authorship and the creator of the SatyaAI application are different facts. Never attribute the SatyaAI application to the publisher of its underlying model. If specifically asked about the underlying model's origin, answer truthfully and distinguish it from SatyaAI's creator.",
    "USER MEMORY: The saved primary-user profile for this browser identifies the user as " + safeMemory.name + ". Use this name accurately when relevant. Do not invent a different name, spelling, title, or identity.",
    "CORRECTIONS: Treat the user's direct corrections as authoritative. If corrected about a name or identity, acknowledge it briefly and use the exact corrected form thereafter.",
    "RELIABILITY: Do not invent biographical details, claim access to information not provided, or guess when uncertain. Be clear about what you know and what you do not know.",
    "SAVED PERSONAL NOTES: " + safeMemory.notes,
  ].join("\n");
}

export function getIdentityReply(input: string, memory: UserMemory): string | null {
  const question = input.trim().toLowerCase();
  const safeMemory = sanitizeMemory(memory);
  const correctedName = extractNameCorrection(input);

  if (correctedName) {
    return "Got it. Your name is " + correctedName + ". I will use that exact name and will not confuse it with another person.";
  }

  if (/\b(who are you|what are you|what is your name|what's your name|introduce yourself)\b/.test(question)) {
    return "I'm SatyaAI, an AI assistant application created by Satyajit Beura. I provide the interface and assistant experience you are using here.";
  }

  if (/\b(who (built|created|made|developed) you|who is your creator|who created satyaai|who built satyaai|who is behind satyaai)\b/.test(question)) {
    return "SatyaAI was created and developed by Satyajit Beura. He built the application, interface, product identity, and orchestration. The language model running underneath is an engine used by SatyaAI, not the creator of this application.";
  }

  if (/\b(are you meta ai|are you llama|are you ray)\b/.test(question)) {
    return "No. I'm SatyaAI, a separate AI application created by Satyajit Beura. I may use an open-weight language model underneath, but that does not change my identity.";
  }

  if (/\b(who am i|what is my name|what's my name|do you know my name)\b/.test(question)) {
    return "The saved profile for this browser identifies you as " + safeMemory.name + ". " + safeMemory.notes;
  }

  return null;
}
