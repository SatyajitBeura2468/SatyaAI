export type CoreCapabilityStatus = "AVAILABLE" | "IN_DEVELOPMENT" | "PLANNED" | "UNAVAILABLE";
export type CoreRuntimeContext = {
  mode?: "nano" | "fast" | "smart" | "deep" | null;
  inferenceRoute?: "browser-local" | "remote-gateway" | "custom-compatible" | "unknown";
  provider?: string | null;
  activeModel?: string | null;
  availableTools?: string[];
  localInferenceAvailable?: boolean | null;
  remoteInferenceAvailable?: boolean | null;
};
export type CoreUserMemory = { name: string; notes: string };
export declare const CORE_METADATA: Readonly<{
  name: string; version: string; lastUpdated: string; productName: string; positioning: string; foundedOn: string;
}>;
export declare const CORE_PRINCIPLES: readonly string[];
export declare const BEHAVIOURAL_CONSTITUTION: readonly string[];
export declare const FOUNDER: Readonly<{
  fullName: string; designation: string; location: string; description: string;
  interests: readonly string[]; project: string; foundedOn: string;
  orcid: string | null; orcidStatus: string;
}>;
export declare function founderSummary(): string;
export declare const TEAM: readonly Readonly<{ name: string; designation: string }>[];
export declare function teamMemberByDesignation(designation: string): Readonly<{ name: string; designation: string }> | null;
export declare const DEVELOPMENT_HISTORY: Readonly<{
  foundingEvent: Readonly<{ date: string; description: string }>;
  documentedDevelopmentCycle: readonly string[];
  note: string;
}>;
export declare const CAPABILITY_STATUS: Readonly<Record<CoreCapabilityStatus, CoreCapabilityStatus>>;
export declare const CAPABILITIES: readonly Readonly<{ id: string; name: string; status: CoreCapabilityStatus; details: string }>[];
export declare function capabilityById(id: string): Readonly<{ id: string; name: string; status: CoreCapabilityStatus; details: string }> | null;
export declare const PERSONALITY: Readonly<{
  description: string; traits: readonly string[]; contextStyles: Readonly<Record<string, string>>; boundaries: readonly string[];
}>;
export declare function normalizeRuntimeContext(input?: CoreRuntimeContext): Readonly<{
  mode: "nano" | "fast" | "smart" | "deep" | null;
  inferenceRoute: string; provider: string | null; activeModel: string | null;
  availableTools: string[]; localInferenceAvailable: boolean | null; remoteInferenceAvailable: boolean | null;
}>;
export declare function formatRuntimeContext(input?: CoreRuntimeContext): string;
export declare function sanitizeCoreUserMemory(value: unknown): CoreUserMemory;
export declare function buildSatyaCorePrompt(options?: { userMemory?: unknown; runtimeContext?: CoreRuntimeContext }): string;