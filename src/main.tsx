import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUp,
  Camera,
  Bookmark,
  BookmarkCheck,
  ArrowDown,
  Aperture,
  Clapperboard,
  Film,
  Images,
  WandSparkles,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Menu,
  MessageSquare,
  Mic,
  Plus,
  Settings,
  Search,
  Sparkles,
  Square,
  Pencil,
  User,
  X,
  Zap,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ConfirmDialog, type ConfirmRequest } from "./components/ConfirmDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { KanaLogo } from "./components/KanaLogo";
import { DrishtiStudio } from "./components/DrishtiStudio";
import { ChakshuStudio } from "./components/ChakshuStudio";
import "./cosmos.css";
import "./reasoning-profile.css";
import "./drishti.css";
import { Starfield } from "./Starfield";
import { freshStarters } from "./starters";
import { HOME_HERO_OPTIONS, pickOnLoad } from "./ui-copy";
import { createThinkingPhraseOrder, THINKING_PHRASES } from "./thinking-phrases";
import {
  createLoadingPhraseOrder,
  LOADING_MESSAGE_POOLS,
  LOADING_PHRASE_ROTATION_MS,
  DOWNLOAD_STALL_THRESHOLD_MS,
  DOWNLOAD_PROGRESS_STEP_PERCENT,
  PROGRESS_COMMENTARY_DURATION_MS,
  type LoadingMessageStage,
} from "./loading-phrases";
import {
  hasWebGPU,
  localWebLLM,
  openAICompatible,
  type ChatMessage,
  type ModelProgressSnapshot,
  type ProviderSettings,
} from "./ai/providers";
import { localKana, unloadKana } from "./ai/kana.provider";
import {
  DEFAULT_USER_MEMORY,
  buildSatyaSystemPrompt,
  extractNameCorrection,
  getIdentityReply,
  getInitials,
  sanitizeMemory,
  getSatyaTier,
  type SatyaTierMode,
  type UserMemory,
} from "./ai/identity";
import { loadJSON, saveJSON } from "./storage";
import { DEFAULT_DRISHTI_MODEL_ID, DRISHTI_MODELS, getDrishtiModel, isDrishtiModelId, type DrishtiModelId } from "./ai/drishti/registry";
import { cancelDrishtiGeneration, checkDrishtiRuntime, generateDrishtiImage, getDrishtiRuntimeStatus, requestDrishtiCompanionStart, type DrishtiRuntimeHealth, type DrishtiRuntimeStatus } from "./ai/drishti/client";
import { CHAKSHU_MODELS, DEFAULT_CHAKSHU_MODEL_ID, getChakshuModel, isChakshuModelId, type ChakshuModelId } from "./ai/chakshu/registry";
import { generateChakshuVideo, getChakshuRuntimeStatus, type ChakshuRuntimeStatus } from "./ai/chakshu/client";
import { loadChakshuHistory, saveChakshuHistoryItem, type ChakshuHistoryItem } from "./ai/chakshu/history";
import { Markdown } from "./markdown";
import { loadDrishtiHistory, saveDrishtiHistoryItem, type DrishtiHistoryItem } from "./ai/drishti/history";

type Mode = SatyaTierMode;
type WorkspaceMode = "chat" | "image" | "video";
type Theme = "light" | "dark";
type AttachmentKind = "text" | "image" | "video" | "audio" | "document";
type AttachedFile = {
  name: string;
  text: string;
  kind?: AttachmentKind;
  mediaType?: string;
  previewUrl?: string;
};
type Message = {
  role: "user" | "ai";
  text: string;
  pending?: boolean;
  modelProgress?: ModelProgressSnapshot;
  tierName?: string;
  error?: boolean;
  remoteFallbackAvailable?: boolean;
  interrupted?: boolean;
  versions?: string[];
  versionIndex?: number;
  file?: AttachedFile;
  createdAt?: number;
};
type Chat = { id: string; title: string; updatedAt: number; messages: Message[] };
type AppPreferences = {
  defaultMode: Mode;
  language: "auto" | "English" | "Hindi" | "Odia";
  responseStyle: "balanced" | "friendly" | "formal" | "academic";
  responseLength: "short" | "balanced" | "detailed";
  personalityStyle: "subtle-wit" | "clever-sarcastic" | "playfully-chaotic" | "dry-intelligence" | "warm-companion";
  humorIntensity: "minimal" | "occasional" | "frequent";
  preferConversational: boolean;
  preferDirect: boolean;
  includeExamples: boolean;
  skipLongIntroductions: boolean;
  expandWhenUseful: boolean;
  enterToSend: boolean;
  compactMode: boolean;
  showTimestamps: boolean;
  reduceMotion: boolean;
  saveChatHistory: boolean;
  fontSize: "small" | "medium" | "large";
};
type SettingsTab = "general" | "personalization" | "models" | "privacy" | "shortcuts";
type SavedAnswer = { id: string; question: string; answer: string; savedAt: number };
type SidebarView = "chats" | "saved";
type ConfirmState = ConfirmRequest;
type LoadingPhraseDeck = { order: number[]; position: number };

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const total = Math.round(seconds);
  if (total < 60) return total + "s";

  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return minutes + "m " + String(remainder).padStart(2, "0") + "s";
}

const modes: Record<Mode, { desc: string }> = {
  micro: { desc: "Feather-light answers for quick, simple questions." },
  nano: { desc: "A compact step up for longer chats and more context." },
  fast: { desc: "Straight to the point. Less waiting, more doing." },
  smart: { desc: "Thoughtful answers without making things needlessly complicated." },
  deep: { desc: "For the big questions that deserve a proper deep dive." },
};

const CHATS_KEY = "satya-chats-v1";
const SAVED_KEY = "satya-saved-v1";
const PREFERENCES_KEY = "satya-preferences-v1";
const DRISHTI_MODEL_KEY = "satya-drishti-model-v1";
const CHAKSHU_MODEL_KEY = "satya-chakshu-model-v1";
const DIVYA_LICENSE_KEY = "satya-divya-chakshu-license-v1";
const DEFAULT_PREFERENCES: AppPreferences = {
  defaultMode: "smart",
  language: "auto",
  responseStyle: "balanced",
  responseLength: "balanced",
  personalityStyle: "playfully-chaotic",
  humorIntensity: "occasional",
  preferConversational: true,
  preferDirect: false,
  includeExamples: false,
  skipLongIntroductions: true,
  expandWhenUseful: true,
  enterToSend: typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches,
  compactMode: false,
  showTimestamps: false,
  reduceMotion: false,
  saveChatHistory: true,
  fontSize: "medium",
};
function readPreferences(): AppPreferences {
  const stored = loadJSON<Partial<AppPreferences>>(PREFERENCES_KEY, {});
  const touchDevice = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  let touchOptIn = false;
  try { touchOptIn = localStorage.getItem("satya-enter-to-send-touch") === "true"; } catch { /* default off on touch devices */ }
  const personalityStyles = ["subtle-wit", "clever-sarcastic", "playfully-chaotic", "dry-intelligence", "warm-companion"] as const;
  const humourLevels = ["minimal", "occasional", "frequent"] as const;
  return {
    ...DEFAULT_PREFERENCES,
    ...stored,
    personalityStyle: personalityStyles.includes(stored.personalityStyle as (typeof personalityStyles)[number])
      ? stored.personalityStyle!
      : DEFAULT_PREFERENCES.personalityStyle,
    humorIntensity: humourLevels.includes(stored.humorIntensity as (typeof humourLevels)[number])
      ? stored.humorIntensity!
      : DEFAULT_PREFERENCES.humorIntensity,
    preferConversational: typeof stored.preferConversational === "boolean" ? stored.preferConversational : DEFAULT_PREFERENCES.preferConversational,
    preferDirect: typeof stored.preferDirect === "boolean" ? stored.preferDirect : DEFAULT_PREFERENCES.preferDirect,
    includeExamples: typeof stored.includeExamples === "boolean" ? stored.includeExamples : DEFAULT_PREFERENCES.includeExamples,
    skipLongIntroductions: typeof stored.skipLongIntroductions === "boolean" ? stored.skipLongIntroductions : DEFAULT_PREFERENCES.skipLongIntroductions,
    expandWhenUseful: typeof stored.expandWhenUseful === "boolean" ? stored.expandWhenUseful : DEFAULT_PREFERENCES.expandWhenUseful,
    enterToSend: touchDevice ? touchOptIn : (stored.enterToSend ?? DEFAULT_PREFERENCES.enterToSend),
  };
}
const MAX_SAVED = 100;
const AVATAR_KEY = "satya-avatar";
const AVATAR_SIZE = 256;
const ATTACH_MAX_CHARS = 6000;
const ATTACH_MAX_BYTES = 12_000_000;
const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const isChatList = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (chat) =>
      chat &&
      typeof chat.id === "string" &&
      typeof chat.title === "string" &&
      Array.isArray(chat.messages),
  );
const isSavedList = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      item &&
      typeof item.id === "string" &&
      typeof item.question === "string" &&
      typeof item.answer === "string",
  );
const dayLabel = (timestamp: number) =>
  new Date(timestamp).toDateString() === new Date().toDateString()
    ? "Today"
    : new Date(timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
      });
const readText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

async function createImagePreview(file: File): Promise<string> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This image could not be opened."));
      element.src = sourceUrl;
    });
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image preview is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
const speechCtor = (): SpeechCtor | undefined => {
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

// A new set of four every page load (see starters.ts).
const STARTERS = freshStarters();
const HOME_HERO_COPY = pickOnLoad(HOME_HERO_OPTIONS);
const preview = (text: string) =>
  text.replace(/[*`#>_]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const drishtiWindowsDesktopSupported =
  typeof navigator !== "undefined" &&
  /Windows|Win32|Win64|WinCE/i.test(navigator.userAgent + " " + navigator.platform);
const nextDrishtiSeed = (previous?: number) => {
  const values = new Uint32Array(1);
  let seed = 0;
  do {
    crypto.getRandomValues(values);
    seed = values[0] % 2_147_483_647;
  } while (seed === previous);
  return seed;
};
const DRISHTI_MODEL_ICONS = {
  lite: ImageIcon,
  core: Images,
  ultra: Aperture,
  max: WandSparkles,
} as const;

const CHAKSHU_MODEL_ICONS = {
  light: VideoIcon,
  chakshu: Film,
  divya: Clapperboard,
} as const;

function trackPointer(event: React.PointerEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--px", event.clientX - box.left + "px");
  event.currentTarget.style.setProperty("--py", event.clientY - box.top + "px");
}

function readSavedMemory(): UserMemory {
  try {
    const saved = localStorage.getItem("satya-memory");
    return saved ? sanitizeMemory(JSON.parse(saved)) : DEFAULT_USER_MEMORY;
  } catch {
    return DEFAULT_USER_MEMORY;
  }
}

function readSavedAvatar(): string | null {
  try {
    const saved = localStorage.getItem(AVATAR_KEY);
    return saved && saved.startsWith("data:image/") ? saved : null;
  } catch {
    return null;
  }
}

// Centre-crops the chosen image to a square and shrinks it, so a big photo
// still fits comfortably in localStorage.
async function resizeAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not decode image"));
      image.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("Image has no size");
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readSavedTheme(): Theme {
  try {
    return localStorage.getItem("satya-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function App() {
  const [preferences, setPreferences] = useState<AppPreferences>(readPreferences);
  const [mode, setMode] = useState<Mode>(() => preferences.defaultMode);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("chat");
  const [drishtiModelId, setDrishtiModelId] = useState<DrishtiModelId>(() => {
    try {
      const saved = localStorage.getItem(DRISHTI_MODEL_KEY);
      return isDrishtiModelId(saved) ? saved : DEFAULT_DRISHTI_MODEL_ID;
    } catch {
      return DEFAULT_DRISHTI_MODEL_ID;
    }
  });
  const [drishtiRuntimeHealth, setDrishtiRuntimeHealth] = useState<DrishtiRuntimeHealth | null>(null);
  const [drishtiChecking, setDrishtiChecking] = useState(false);
  const [drishtiStarting, setDrishtiStarting] = useState(false);
  const [drishtiRuntimeStatus, setDrishtiRuntimeStatus] = useState<DrishtiRuntimeStatus | null>(null);
  const [drishtiRuntimeError, setDrishtiRuntimeError] = useState("");
  const [drishtiGenerating, setDrishtiGenerating] = useState(false);
  const [drishtiError, setDrishtiError] = useState("");
  const [drishtiResult, setDrishtiResult] = useState<DrishtiHistoryItem | null>(null);
  const [drishtiHistory, setDrishtiHistory] = useState<DrishtiHistoryItem[]>([]);
  const [drishtiActiveHistoryId, setDrishtiActiveHistoryId] = useState<string | null>(null);
  const [drishtiHistoryWarning, setDrishtiHistoryWarning] = useState("");
  const drishtiAbortRef = useRef<AbortController | null>(null);
  const drishtiActivityRef = useRef<HTMLDivElement>(null);
  const [chakshuModelId, setChakshuModelId] = useState<ChakshuModelId>(() => {
    try { const saved = localStorage.getItem(CHAKSHU_MODEL_KEY); return isChakshuModelId(saved) ? saved : DEFAULT_CHAKSHU_MODEL_ID; }
    catch { return DEFAULT_CHAKSHU_MODEL_ID; }
  });
  const [chakshuGenerating, setChakshuGenerating] = useState(false);
  const [chakshuError, setChakshuError] = useState("");
  const [chakshuResult, setChakshuResult] = useState<(ChakshuHistoryItem & { video_url: string }) | null>(null);
  const [chakshuRuntimeStatus, setChakshuRuntimeStatus] = useState<ChakshuRuntimeStatus | null>(null);
  const [chakshuHistory, setChakshuHistory] = useState<Array<ChakshuHistoryItem & { video_url: string }>>([]);
  const [chakshuActiveHistoryId, setChakshuActiveHistoryId] = useState<string | null>(null);
  const [chakshuHistoryWarning, setChakshuHistoryWarning] = useState("");
  const chakshuAbortRef = useRef<AbortController | null>(null);
  const chakshuObjectUrlsRef = useRef<Set<string>>(new Set());
  const [divyaLicenseAccepted, setDivyaLicenseAccepted] = useState(() => {
    try { return localStorage.getItem(DIVYA_LICENSE_KEY) === "true"; } catch { return false; }
  });
  const [theme, setTheme] = useState<Theme>(readSavedTheme);
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<Chat[]>(() =>
    loadJSON<Chat[]>(CHATS_KEY, [], isChatList),
  );
  const [activeId, setActiveId] = useState<string>(newId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [menu, setMenu] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [chatTitleDraft, setChatTitleDraft] = useState("");
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [copiedAction, setCopiedAction] = useState("");
  const [messageFeedback, setMessageFeedback] = useState<Record<number, "up" | "down" | undefined>>({});
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [endpointFeedback, setEndpointFeedback] = useState("");
  const [confirmRequest, setConfirmRequest] = useState<ConfirmState | null>(null);
  const [file, setFile] = useState<AttachedFile | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [thinkingActive, setThinkingActive] = useState(false);
  // Keep a shuffled deck for the whole session so all phrases get a turn
  // before reshuffling, without repeating across deck boundaries.
  const thinkingPhraseOrderRef = useRef<number[] | null>(null);
  if (thinkingPhraseOrderRef.current === null) {
    thinkingPhraseOrderRef.current = createThinkingPhraseOrder();
  }
  const thinkingPhrasePositionRef = useRef(0);
  const [thinkingPhrasePosition, setThinkingPhrasePosition] = useState(0);
  const [loadingMessageStage, setLoadingMessageStage] = useState<LoadingMessageStage | null>(null);
  const loadingMessageStageRef = useRef<LoadingMessageStage | null>(null);
  const loadingMessageRef = useRef("");
  const loadingPhraseDecksRef = useRef<Partial<Record<LoadingMessageStage, LoadingPhraseDeck>>>({});
  const lastDownloadProgressAtRef = useRef(0);
  const lastDownloadPercentRef = useRef<number | null>(null);
  const progressCommentaryUntilRef = useRef(0);
  const [memory, setMemory] = useState<UserMemory>(readSavedMemory);
  const [memoryNameDraft, setMemoryNameDraft] = useState(memory.name);
  const [memoryNotesDraft, setMemoryNotesDraft] = useState(memory.notes);
  const [saved, setSaved] = useState<SavedAnswer[]>(() =>
    loadJSON<SavedAnswer[]>(SAVED_KEY, [], isSavedList),
  );
  const [sidebarView, setSidebarView] = useState<SidebarView>("chats");
  const [avatar, setAvatar] = useState<string | null>(readSavedAvatar);
  const [avatarNote, setAvatarNote] = useState("");
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const [provider, setProvider] = useState<ProviderSettings>(() => {
    try {
      const saved = localStorage.getItem("satya-provider");
      const parsed = saved ? JSON.parse(saved) as Partial<ProviderSettings> : {};
      const baseUrl = parsed.baseUrl || import.meta.env.VITE_OPENAI_COMPATIBLE_BASE_URL ||
        (import.meta.env.DEV ? "http://127.0.0.1:11434/v1" : undefined);
      const model = parsed.model || import.meta.env.VITE_OPENAI_COMPATIBLE_MODEL ||
        (import.meta.env.DEV ? "qwen2.5:1.5b" : undefined);
      // Older builds persisted the key with the rest of the provider settings.
      // Remove it from persistent storage on the next load.
      localStorage.setItem("satya-provider", JSON.stringify({ baseUrl, model }));
      return { baseUrl, model };
    } catch {
      return {};
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const composerMenuRef = useRef<HTMLDivElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const reasoningRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const newChatRef = useRef<() => void>(() => {});
  const conversationRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLElement>(null);
  const activeAbortRef = useRef<AbortController | null>(null);
  const partialAnswerRef = useRef("");
  const followLatestRef = useRef(true);
  const activeRef = useRef(activeId);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const canSpeak = typeof window !== "undefined" && !!speechCtor();
  activeRef.current = activeId;
  const current = getSatyaTier(mode)!;
  useEffect(() => {
    if (mode !== "micro" && !busy) unloadKana();
  }, [mode, busy]);
  useEffect(() => () => unloadKana(), []);
  const currentDrishti = getDrishtiModel(drishtiModelId);
  const drishtiModelRuntime = drishtiRuntimeHealth?.models?.[drishtiModelId];
  const drishtiCanGenerate = Boolean(!drishtiChecking && !drishtiStarting && !drishtiGenerating && drishtiRuntimeHealth?.ok && drishtiModelRuntime?.available);
  const currentChakshu = getChakshuModel(chakshuModelId);
  const chakshuModelRuntime = drishtiRuntimeHealth?.video_models?.[chakshuModelId];
  const chakshuCanGenerate = Boolean(!drishtiChecking && !drishtiStarting && !chakshuGenerating && drishtiRuntimeHealth?.ok && chakshuModelRuntime?.available && (chakshuModelId !== "divya" || divyaLicenseAccepted));
  const initials = getInitials(memory.name);

  const capability = useMemo(
    () => mode === "micro"
      ? "WebAssembly CPU · browser-local inference"
      : provider.baseUrl
        ? "Optional compatible endpoint configured"
        : hasWebGPU()
          ? "WebGPU · browser-local inference"
          : "This browser has no WebGPU, so the existing local model cannot run",
    [mode, provider.baseUrl],
  );
  const engineTitle = mode === "micro"
    ? "Kaṇa · CPU/WASM"
    : provider.baseUrl
      ? "Custom endpoint"
      : hasWebGPU()
        ? "Browser model"
        : "No inference available";

  useEffect(() => {
    if (!attachmentMenuOpen && !cameraOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAttachmentMenuOpen(false);
        setCameraOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    if (!attachmentMenuOpen) {
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!composerMenuRef.current?.contains(event.target as Node)) {
        setAttachmentMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [attachmentMenuOpen, cameraOpen]);

  useEffect(() => {
    if (!cameraOpen) {
      setCameraReady(false);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      return;
    }
    let cancelled = false;
    setCameraReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is unavailable here. Open SatyaAI over HTTPS in a browser that supports camera access.");
      return;
    }
    void navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    }).then(async (stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      const video = cameraVideoRef.current;
      if (video) {
        video.srcObject = stream;
        try { await video.play(); } catch { /* Metadata event can still signal readiness. */ }
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        setCameraError(error instanceof Error ? error.message : "Camera access was blocked. Check your browser permissions.");
      }
    });
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraOpen]);

  useEffect(() => {
    if (preferences.saveChatHistory) saveJSON(CHATS_KEY, chats);
    else {
      try { localStorage.removeItem(CHATS_KEY); } catch { /* storage unavailable */ }
    }
  }, [chats, preferences.saveChatHistory]);

  useEffect(() => {
    saveJSON(PREFERENCES_KEY, preferences);
  }, [preferences]);

  useEffect(() => {
    let active = true;
    void loadDrishtiHistory()
      .then((items) => {
        if (!active) return;
        setDrishtiHistory(items);
        if (items.length) {
          setDrishtiResult(items[0]);
          setDrishtiActiveHistoryId(items[0].id);
        }
      })
      .catch(() => {
        if (active) setDrishtiHistoryWarning("Image history storage is unavailable in this browser. Results remain visible until the page is closed.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRISHTI_MODEL_KEY, drishtiModelId);
    } catch {
      // Model selection remains available for this session if storage is unavailable.
    }
  }, [drishtiModelId]);

  useEffect(() => {
    try { localStorage.setItem(CHAKSHU_MODEL_KEY, chakshuModelId); } catch { /* keep the selection for this session */ }
  }, [chakshuModelId]);

  useEffect(() => {
    try { localStorage.setItem(DIVYA_LICENSE_KEY, String(divyaLicenseAccepted)); } catch { /* keep acknowledgement for this session */ }
  }, [divyaLicenseAccepted]);

  function saveEndpointSettings() {
    const baseUrl = provider.baseUrl?.trim();
    const model = provider.model?.trim();
    if (baseUrl) {
      try {
        const parsed = new URL(baseUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol");
      } catch {
        setEndpointFeedback("Enter a valid HTTP or HTTPS endpoint URL before saving.");
        return;
      }
      if (!model) {
        setEndpointFeedback("Enter the model name before saving this endpoint.");
        return;
      }
    }
    try {
      localStorage.setItem("satya-provider", JSON.stringify({ baseUrl, model }));
      setEndpointFeedback("Endpoint URL and model saved. The API key remains in memory only and is never written to browser storage.");
    } catch {
      setEndpointFeedback("Endpoint settings could not be saved in this browser.");
    }
  }

  function clearEndpointSettings() {
    setProvider({});
    try {
      localStorage.removeItem("satya-provider");
    } catch { /* state is still cleared */ }
    setEndpointFeedback("Custom endpoint and session key removed.");
  }

  useEffect(() => {
    saveJSON(SAVED_KEY, saved);
  }, [saved]);

  useEffect(() => {
    let active = true;
    void loadChakshuHistory().then((items) => {
      if (!active) return;
      const hydrated = items.map((item) => {
        const video_url = URL.createObjectURL(item.blob);
        chakshuObjectUrlsRef.current.add(video_url);
        return { ...item, video_url };
      });
      setChakshuHistory(hydrated);
      if (hydrated.length) {
        setChakshuResult(hydrated[0]);
        setChakshuActiveHistoryId(hydrated[0].id);
      }
    }).catch(() => {
      if (active) setChakshuHistoryWarning("Video history could not be loaded in this browser.");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    for (const url of chakshuObjectUrlsRef.current) URL.revokeObjectURL(url);
    chakshuObjectUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        document.documentElement.style.setProperty("--mx", event.clientX + "px");
        document.documentElement.style.setProperty("--my", event.clientY + "px");
        document.documentElement.style.setProperty("--tx", String((event.clientX / window.innerWidth - 0.5) * 2));
        document.documentElement.style.setProperty("--ty", String((event.clientY / window.innerHeight - 0.5) * 2));
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        newChatRef.current();
      } else if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMenu(true);
        setSidebarView("chats");
        window.setTimeout(() => document.querySelector<HTMLInputElement>(".chat-list-search input")?.focus(), 40);
      } else if (event.key === "Escape") {
        setConfirmRequest(null);
        setAttachmentMenuOpen(false);
        setSettings(false);
        setMenu(false);
        setReasoningOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!reasoningOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!reasoningRef.current?.contains(event.target as Node)) {
        setReasoningOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [reasoningOpen]);

  function nextLoadingLine(stage: LoadingMessageStage): string {
    const pool = LOADING_MESSAGE_POOLS[stage];
    let deck = loadingPhraseDecksRef.current[stage];
    if (!deck || deck.position >= deck.order.length - 1) {
      const previousLast = deck?.order[deck.order.length - 1];
      deck = { order: createLoadingPhraseOrder(stage, previousLast), position: 0 };
    } else {
      deck.position += 1;
    }
    loadingPhraseDecksRef.current[stage] = deck;
    return pool[deck.order[deck.position]];
  }

  function updatePendingLoadingText(line: string, details?: ModelProgressSnapshot) {
    loadingMessageRef.current = line;
    setStatus(line);
    setMessages((previous) => {
      const lastIndex = previous.length - 1;
      const last = previous[lastIndex];
      if (lastIndex < 0 || last.role !== "ai" || !last.pending) return previous;
      const next = [...previous];
      next[lastIndex] = {
        ...last,
        text: line,
        ...(details ? { modelProgress: details } : {}),
      };
      return next;
    });
  }

  function activateLoadingStage(stage: LoadingMessageStage, details?: ModelProgressSnapshot) {
    loadingMessageStageRef.current = stage;
    setLoadingMessageStage(stage);
    if (stage === "download") {
      lastDownloadProgressAtRef.current = Date.now();
      lastDownloadPercentRef.current = details?.percent ?? 0;
    }
    if (stage === "download-progress") {
      progressCommentaryUntilRef.current = Date.now() + PROGRESS_COMMENTARY_DURATION_MS;
    }
    updatePendingLoadingText(nextLoadingLine(stage), details);
  }

  function rotateLoadingStage() {
    const stage = loadingMessageStageRef.current;
    if (!stage || stage === "ready") return;
    updatePendingLoadingText(nextLoadingLine(stage));
  }

  useEffect(() => {
    if (!busy || !loadingMessageStage) return;
    const interval = window.setInterval(() => {
      const stage = loadingMessageStageRef.current;
      const now = Date.now();
      if (!stage || stage === "ready") return;

      if (stage === "download" || stage === "download-progress") {
        const lastProgressAt = lastDownloadProgressAtRef.current;
        if (lastProgressAt && now - lastProgressAt >= DOWNLOAD_STALL_THRESHOLD_MS) {
          activateLoadingStage("download-slow");
          return;
        }
        if (stage === "download-progress") {
          if (now >= progressCommentaryUntilRef.current) {
            activateLoadingStage("download");
          }
          return;
        }
      }

      rotateLoadingStage();
    }, LOADING_PHRASE_ROTATION_MS);
    return () => window.clearInterval(interval);
  }, [busy, loadingMessageStage]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("satya-theme", theme);
    } catch {
      // Theme still works for this session if storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    if (!settings) return;
    const dialog = settingsRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
    ));
    (focusables()[0] ?? dialog).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [settings]);

  useEffect(() => {
    if (!thinkingActive) return;

    const interval = window.setInterval(() => {
      const currentOrder = thinkingPhraseOrderRef.current ?? createThinkingPhraseOrder();
      if (thinkingPhrasePositionRef.current >= THINKING_PHRASES.length - 1) {
        // Start a fresh random cycle, but don't repeat the previous cycle's last line.
        thinkingPhraseOrderRef.current = createThinkingPhraseOrder(
          currentOrder[currentOrder.length - 1],
        );
        thinkingPhrasePositionRef.current = 0;
      } else {
        thinkingPhrasePositionRef.current += 1;
      }
      setThinkingPhrasePosition(thinkingPhrasePositionRef.current);
    }, 2300);

    return () => window.clearInterval(interval);
  }, [thinkingActive]);

  // Keep the newest message visible while the user is following the bottom of
  // the chat. If they deliberately scroll up, do not yank them back down.
  useEffect(() => {
    const container = conversationRef.current;
    if (!container || !followLatestRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  function openSettings(tab: SettingsTab = "general") {
    setMemoryNameDraft(memory.name);
    setMemoryNotesDraft(memory.notes);
    setSettingsTab(tab);
    setSettings(true);
  }

  function saveMemory() {
    const nextMemory = sanitizeMemory({
      name: memoryNameDraft,
      notes: memoryNotesDraft,
    });
    setMemory(nextMemory);
    try {
      localStorage.setItem("satya-memory", JSON.stringify(nextMemory));
      setStatus("Profile saved on this device.");
    } catch {
      setStatus("Profile could not be saved in this browser.");
    }
  }

  function clearMemory() {
    setMemory(DEFAULT_USER_MEMORY);
    setMemoryNameDraft("");
    setMemoryNotesDraft("");
    try {
      localStorage.removeItem("satya-memory");
    } catch {
      // Nothing stored, or storage unavailable: either way the profile is empty now.
    }
    setStatus("Profile cleared.");
  }

  async function pickAvatar(chosen: File | undefined) {
    if (!chosen) return;
    if (!chosen.type.startsWith("image/")) {
      setAvatarNote("Please choose an image file.");
      return;
    }
    try {
      const resized = await resizeAvatar(chosen);
      setAvatar(resized);
      try {
        localStorage.setItem(AVATAR_KEY, resized);
        setAvatarNote("Profile picture updated.");
      } catch {
        setAvatarNote("Picture applied, but it could not be saved in this browser.");
      }
    } catch {
      setAvatarNote("Could not read that image. Try a JPG or PNG.");
    }
  }

  function removeAvatar() {
    setAvatar(null);
    try {
      localStorage.removeItem(AVATAR_KEY);
    } catch {
      // Nothing stored, or storage unavailable: either way the picture is gone.
    }
    setAvatarNote("Profile picture removed.");
  }

  function upsertChat(id: string, list: Message[]) {
    const saved = list
      .filter((message) => !message.pending)
      .map((message) => ({
        role: message.role,
        text: message.text,
        ...(message.error ? { error: true } : {}),
        ...(message.interrupted ? { interrupted: true } : {}),
        ...(message.versions?.length ? { versions: message.versions, versionIndex: message.versionIndex } : {}),
        ...(message.file ? { file: message.file } : {}),
        ...(message.createdAt ? { createdAt: message.createdAt } : {}),
      })) as Message[];
    const first =
      saved.find((message) => message.role === "user")?.text.trim() ||
      "New chat";
    const cleanTitle = first.replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
    const autoTitle = cleanTitle.length > 58 ? cleanTitle.slice(0, 55).trimEnd() + "…" : cleanTitle;
    setChats((previous) => {
      const existing = previous.find((chat) => chat.id === id);
      return [
        { id, title: existing?.title ?? (autoTitle || "New chat"), updatedAt: Date.now(), messages: saved },
        ...previous.filter((chat) => chat.id !== id),
      ];
    });
  }

  function questionFor(index: number) {
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].text;
    }
    return "";
  }

  function isSaved(index: number) {
    const message = messages[index];
    const question = questionFor(index);
    return saved.some(
      (item) => item.answer === message.text && item.question === question,
    );
  }

  function toggleSaved(index: number) {
    const message = messages[index];
    if (!message || message.role !== "ai" || message.pending || message.error) return;
    const question = questionFor(index);
    setSaved((previous) => {
      const existing = previous.find(
        (item) => item.answer === message.text && item.question === question,
      );
      if (existing) return previous.filter((item) => item !== existing);
      return [
        { id: newId(), question, answer: message.text, savedAt: Date.now() },
        ...previous,
      ].slice(0, MAX_SAVED);
    });
  }

  function removeSaved(id: string) {
    setSaved((previous) => previous.filter((item) => item.id !== id));
  }

  function downloadText(filename: string, contents: string, mime = "text/markdown") {
    const blob = new Blob([contents], { type: mime + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportChat(chat: Chat) {
    const markdown = [
      "# " + chat.title,
      "",
      "Exported from SatyaAI on " + new Date().toLocaleString(),
      "",
      ...chat.messages.map((message) =>
        (message.role === "user" ? "## You" : "## SatyaAI") + "\n\n" + message.text +
        (message.file ? "\n\n_Attached file: " + message.file.name + "_" : ""),
      ),
      "",
    ].join("\n");
    downloadText((chat.title || "satyaai-conversation").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 48) + ".md", markdown);
  }

  function beginRenameChat(chat: Chat) {
    setEditingChatId(chat.id);
    setChatTitleDraft(chat.title);
  }

  function saveChatTitle(chatId: string) {
    const title = chatTitleDraft.trim();
    if (!title) return;
    setChats((previous) => previous.map((chat) =>
      chat.id === chatId ? { ...chat, title: title.slice(0, 80) } : chat,
    ));
    setEditingChatId(null);
    setChatTitleDraft("");
  }

  function deleteChat(chatId: string) {
    const chat = chats.find((item) => item.id === chatId);
    if (!chat) return;
    setConfirmRequest({
      title: "Delete conversation?",
      message: 'Delete "' + chat.title + '" from this browser? This cannot be undone.',
      confirmLabel: "Delete",
      onConfirm: () => {
        setChats((previous) => previous.filter((item) => item.id !== chatId));
        if (chatId === activeRef.current) {
          activeAbortRef.current?.abort();
          activeRef.current = newId();
          setActiveId(activeRef.current);
          setBusy(false);
          setMessages([]);
          setStatus("Ready");
          followLatestRef.current = true;
        }
      },
    });
  }

  async function copyText(text: string, actionId: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        const copied = document.execCommand("copy");
        helper.remove();
        if (!copied) throw new Error("Clipboard unavailable");
      }
      setCopiedAction(actionId);
      window.setTimeout(() => setCopiedAction((current) => current === actionId ? "" : current), 1800);
    } catch {
      setStatus("Copy was blocked by this browser. Select the text and copy it manually.");
    }
  }

  function stopGeneration() {
    if (!activeAbortRef.current) return;
    setStatus("Stopping generation…");
    activeAbortRef.current.abort();
  }

  function scrollToLatest() {
    const container = conversationRef.current;
    if (!container) return;
    followLatestRef.current = true;
    container.scrollTo({ top: container.scrollHeight, behavior: preferences.reduceMotion ? "auto" : "smooth" });
    setShowJumpToLatest(false);
  }

  function clearConversationData() {
    setConfirmRequest({
      title: "Delete all local data?",
      message: "Delete every saved conversation and answer from this browser? This action cannot be undone.",
      confirmLabel: "Delete all data",
      onConfirm: () => {
        activeAbortRef.current?.abort();
        setBusy(false);
        setChats([]);
        setSaved([]);
        setMessages([]);
        activeRef.current = newId();
        setActiveId(activeRef.current);
        setChatSearch("");
        try {
          localStorage.removeItem(CHATS_KEY);
          localStorage.removeItem(SAVED_KEY);
        } catch { /* state is still cleared for this session */ }
        setStatus("Conversation data cleared.");
      },
    });
  }

  function exportAllData() {
    downloadText("satyaai-data-export.json", JSON.stringify({
      exportedAt: new Date().toISOString(),
      conversations: chats,
      savedAnswers: saved,
      profile: memory,
      preferences,
      theme,
    }, null, 2), "application/json");
  }

  // Opens a saved answer as a fresh, unsaved conversation. It only becomes a
  // chat in "Conversations" if the user actually sends a follow-up.
  function openSaved(item: SavedAnswer) {
    if (busy) return;
    setWorkspaceMode("chat");
    setMessages([
      { role: "user", text: item.question || "Saved answer" },
      { role: "ai", text: item.answer },
    ]);
    setActiveId(newId());
    setStatus("Ready");
    setMenu(false);
    followLatestRef.current = true;
  }

  function openChat(chat: Chat) {
    if (busy) return;
    setWorkspaceMode("chat");
    setMessages(chat.messages);
    setActiveId(chat.id);
    setStatus("Ready");
    setMenu(false);
    followLatestRef.current = true;
  }

  async function pickFile(chosen: File | undefined) {
    if (!chosen) return;
    if (chosen.size > ATTACH_MAX_BYTES) {
      setStatus("That file is larger than 12 MB.");
      return;
    }
    const extension = chosen.name.split(".").pop()?.toLowerCase() ?? "";
    const isTextFile = chosen.type.startsWith("text/") ||
      ["txt", "md", "csv", "json", "log"].includes(extension);
    try {
      if (isTextFile) {
        const text = await readText(chosen);
        setFile({
          name: chosen.name,
          kind: "text",
          mediaType: chosen.type || "text/plain",
          text: text.length > ATTACH_MAX_CHARS
            ? text.slice(0, ATTACH_MAX_CHARS) + "\n…[file truncated]"
            : text,
        });
        setStatus("Text file attached and ready.");
        return;
      }
      if (chosen.type.startsWith("image/")) {
        const previewUrl = await createImagePreview(chosen);
        setFile({
          name: chosen.name,
          kind: "image",
          mediaType: chosen.type,
          previewUrl,
          text: "[A photo is attached. Visual understanding is not available yet; the image itself is not sent to the text model.]",
        });
        setStatus("Photo attached. Image understanding is coming soon.");
        return;
      }
      const kind: AttachmentKind | null = chosen.type.startsWith("video/")
        ? "video"
        : chosen.type.startsWith("audio/")
          ? "audio"
          : extension === "pdf" || chosen.type === "application/pdf"
            ? "document"
            : null;
      if (!kind) {
        setStatus("That file type is not supported yet. Try a text file, photo, video, audio file, or PDF.");
        return;
      }
      const label = kind === "document" ? "Document" : kind[0].toUpperCase() + kind.slice(1);
      setFile({
        name: chosen.name,
        kind,
        mediaType: chosen.type,
        text: "[" + label + " attached. Reading this format is coming soon; the file itself is not sent to the text model.]",
      });
      setStatus(label + " attached. Media and document understanding are coming soon.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read that file.");
    }
  }

  function openCamera() {
    setAttachmentMenuOpen(false);
    setCameraError("");
    setCameraOpen(true);
  }

  function captureCameraPhoto() {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("The camera is not ready yet. Give the preview a moment to load.");
      return;
    }
    const scale = Math.min(1, 1400 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Photo capture is unavailable in this browser.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const previewUrl = canvas.toDataURL("image/jpeg", 0.82);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    setFile({
      name: "SatyaAI-camera-" + stamp + ".jpg",
      kind: "image",
      mediaType: "image/jpeg",
      previewUrl,
      text: "[A photo was captured with the device camera. Visual understanding is not available yet; the image itself is not sent to the text model.]",
    });
    setStatus("Photo captured and attached. Image understanding is coming soon.");
    setCameraOpen(false);
  }

  function toggleMic() {
    const Ctor = speechCtor();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Ctor();
    const base = query.trim();
    recognition.lang = preferences.language === "Hindi" ? "hi-IN" : preferences.language === "Odia" ? "or-IN" : navigator.language || "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setQuery(base ? base + " " + spoken : spoken);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function startNewChat() {
    if (busy) return;
    setWorkspaceMode("chat");
    setSidebarView("chats");
    setMenu(false);
    setActiveId(newId());
    setMessages([]);
    setMode(preferences.defaultMode);
    setStatus("Ready");
    setFile(null);
    followLatestRef.current = true;
  }

  newChatRef.current = startNewChat;

  function pickSuggestion(text: string) {
    if (busy) return;
    setQuery(text);
    textareaRef.current?.focus();
  }

  function waitForDrishtiDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Image generation cancelled.", "AbortError"));
        return;
      }
      const abort = () => {
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        reject(new DOMException("Image generation cancelled.", "AbortError"));
      };
      const timer = window.setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, milliseconds);
      signal?.addEventListener("abort", abort, { once: true });
    });
  }

  async function ensureDrishtiRuntimeReady(signal?: AbortSignal): Promise<DrishtiRuntimeHealth> {
    if (!drishtiWindowsDesktopSupported) {
      throw new Error("Drishti image generation currently requires a Windows desktop and the SatyaAI companion.");
    }
    setDrishtiStarting(true);
    setDrishtiRuntimeError("");
    setStatus("Starting the local Drishti companion…");

    // Start the loopback check and native companion launch directly from the
    // user's click, so the browser can display its local-access permission.
    const firstHealthCheck = checkDrishtiRuntime(signal);
    requestDrishtiCompanionStart();

    try {
      try {
        const health = await firstHealthCheck;
        setDrishtiRuntimeHealth(health);
        return health;
      } catch (error) {
        if (signal?.aborted) throw error;
        // The companion may still be starting. Retry below.
      }

      // The old eight-minute wait is now abortable and capped at two minutes.
      for (let attempt = 0; attempt < 120; attempt++) {
        await waitForDrishtiDelay(1000, signal);
        try {
          const health = await checkDrishtiRuntime(signal);
          setDrishtiRuntimeHealth(health);
          setDrishtiRuntimeError("");
          return health;
        } catch (error) {
          if (signal?.aborted) throw error;
          // Continue waiting while the one-time-installed companion boots.
        }
      }

      throw new Error(
        "The local companion is not responding. Install the Windows companion once using the installer link in the workspace. It prepares its own private Python and image runtime automatically on first launch; no separate Python installation or terminal commands are required.",
      );
    } finally {
      setDrishtiStarting(false);
    }
  }

  async function connectDrishtiRuntime() {
    if (drishtiAbortRef.current) return;
    const controller = new AbortController();
    drishtiAbortRef.current = controller;
    setDrishtiChecking(true);
    try {
      const health = await ensureDrishtiRuntimeReady(controller.signal);
      if (controller.signal.aborted) return;
      const availability = health.models?.[drishtiModelId];
      if (!availability?.available) {
        setDrishtiRuntimeError(availability?.reason || "This Drishti tier is not available on the detected hardware.");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus("Local engine connection stopped.");
      } else {
        setDrishtiRuntimeHealth(null);
        setDrishtiRuntimeError(error instanceof Error ? error.message : "Could not start the local Drishti companion.");
      }
    } finally {
      if (drishtiAbortRef.current === controller) drishtiAbortRef.current = null;
      setDrishtiChecking(false);
    }
  }

  useEffect(() => {
    if (!drishtiGenerating) return;
    let active = true;
    const poll = async () => {
      const snapshot = await getDrishtiRuntimeStatus();
      if (active && snapshot) setDrishtiRuntimeStatus(snapshot);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 900);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [drishtiGenerating]);

  useEffect(() => {
    if (!chakshuGenerating) return;
    let active = true;
    const poll = async () => {
      const snapshot = await getChakshuRuntimeStatus();
      if (active && snapshot) setChakshuRuntimeStatus(snapshot);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 900);
    return () => { active = false; window.clearInterval(timer); };
  }, [chakshuGenerating]);

  useEffect(() => {
    if (workspaceMode !== "image" || !(drishtiStarting || drishtiGenerating || drishtiResult || drishtiError)) return;
    const frame = window.requestAnimationFrame(() => {
      drishtiActivityRef.current?.scrollIntoView({
        behavior: preferences.reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [workspaceMode, drishtiStarting, drishtiGenerating, drishtiResult, drishtiError, preferences.reduceMotion]);

  async function generateDrishti(promptOverride?: string, seedOverride?: number) {
    const prompt = (promptOverride ?? query).trim();
    if (!prompt || drishtiGenerating || drishtiStarting) return;
    if (!drishtiWindowsDesktopSupported) {
      setDrishtiError("Drishti currently requires a Windows desktop and the one-time SatyaAI companion installation.");
      return;
    }

    const controller = new AbortController();
    drishtiAbortRef.current = controller;
    setDrishtiGenerating(true);
    setDrishtiRuntimeStatus(null);
    setDrishtiError("");
    setStatus("Preparing local Drishti generation…");
    try {
      const health = await ensureDrishtiRuntimeReady(controller.signal);
      if (controller.signal.aborted) return;
      const availability = health.models?.[drishtiModelId];
      if (!availability?.available) {
        throw new Error(availability?.reason || "The selected Drishti model is not available on this computer.");
      }

      setStatus("Generating locally with " + currentDrishti.name + "…");
      const result = await generateDrishtiImage(drishtiModelId, prompt, controller.signal, seedOverride);
      if (controller.signal.aborted) return;

      const historyItem: DrishtiHistoryItem = {
        ...result,
        id: newId(),
        prompt,
        created_at: Date.now(),
      };
      setDrishtiResult(historyItem);
      setDrishtiActiveHistoryId(historyItem.id);
      setDrishtiHistory((previous) => [historyItem, ...previous].slice(0, 12));
      void saveDrishtiHistoryItem(historyItem).catch(() => {
        setDrishtiHistoryWarning("This image was generated, but the browser could not save it to persistent history.");
      });
      setStatus("Image generated locally.");
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        setDrishtiError("");
        setStatus("Image generation stopped.");
      } else {
        setDrishtiError(error instanceof Error ? error.message : "Drishti image generation failed.");
      }
    } finally {
      if (drishtiAbortRef.current === controller) drishtiAbortRef.current = null;
      setDrishtiGenerating(false);
    }
  }

  function stopDrishtiGeneration() {
    const controller = drishtiAbortRef.current;
    if (!controller) return;
    setStatus("Stopping image generation…");
    void cancelDrishtiGeneration();
    controller.abort();
  }

  function selectDrishtiHistory(item: DrishtiHistoryItem) {
    setDrishtiResult(item);
    setDrishtiActiveHistoryId(item.id);
    setDrishtiModelId(item.model_id);
    setQuery(item.prompt);
    setDrishtiError("");
  }

  function varyDrishti() {
    if (!drishtiResult) return;
    const prompt = drishtiResult.prompt;
    setQuery(prompt);
    void generateDrishti(prompt, nextDrishtiSeed(drishtiResult.seed));
  }

  function regenerateDrishti() {
    if (!drishtiResult) return;
    setQuery(drishtiResult.prompt);
    void generateDrishti(drishtiResult.prompt);
  }

  function downloadDrishtiImage() {
    if (!drishtiResult) return;
    const anchor = document.createElement("a");
    anchor.href = drishtiResult.image_data_url;
    anchor.download = "satyaai-drishti-" + drishtiResult.seed + ".png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function connectChakshuRuntime() {
    if (chakshuAbortRef.current) return;
    const controller = new AbortController();
    chakshuAbortRef.current = controller;
    setDrishtiChecking(true);
    setChakshuError("");
    try {
      const health = await ensureDrishtiRuntimeReady(controller.signal);
      if (controller.signal.aborted) return;
      const availability = health.video_models?.[chakshuModelId];
      if (!availability?.available) setChakshuError(availability?.reason || "This video tier is not available on this computer.");
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus("Video companion startup stopped.");
      } else {
        setDrishtiRuntimeHealth(null);
        setChakshuError(error instanceof Error ? error.message : "Could not start the local video companion.");
      }
    } finally {
      if (chakshuAbortRef.current === controller) chakshuAbortRef.current = null;
      setDrishtiChecking(false);
    }
  }

  async function generateChakshu() {
    const prompt = query.trim();
    if (!prompt || chakshuGenerating || drishtiStarting) return;
    if (!drishtiWindowsDesktopSupported) {
      setChakshuError("Chakshu video generation currently requires a Windows desktop and the SatyaAI companion.");
      return;
    }
    if (chakshuModelId === "divya" && !divyaLicenseAccepted) {
      setChakshuError("Review and accept the LTX-2.x Community License before using Divya Chakshu 1.");
      return;
    }
    const controller = new AbortController();
    chakshuAbortRef.current = controller;
    setChakshuGenerating(true);
    setChakshuRuntimeStatus(null);
    setChakshuError("");
    setStatus("Preparing local video generation…");
    try {
      const health = await ensureDrishtiRuntimeReady(controller.signal);
      if (controller.signal.aborted) return;
      const availability = health.video_models?.[chakshuModelId];
      if (!availability?.available) throw new Error(availability?.reason || "The selected video model is not available on this computer.");
      setStatus("Generating locally with " + currentChakshu.name + "…");
      const result = await generateChakshuVideo(chakshuModelId, prompt, divyaLicenseAccepted, controller.signal);
      if (controller.signal.aborted) return;
      const videoUrl = URL.createObjectURL(result.blob);
      chakshuObjectUrlsRef.current.add(videoUrl);
      const historyItem: ChakshuHistoryItem = {
        id: newId(),
        prompt,
        blob: result.blob,
        model_id: result.model_id,
        elapsed_seconds: result.elapsed_seconds,
        seed: result.seed,
        created_at: Date.now(),
      };
      const displayItem = { ...historyItem, video_url: videoUrl };
      setChakshuResult(displayItem);
      setChakshuActiveHistoryId(historyItem.id);
      setChakshuHistory((previous) => [displayItem, ...previous].slice(0, 12));
      void saveChakshuHistoryItem(historyItem).catch(() => {
        setChakshuHistoryWarning("This video was generated, but the browser could not save it to history.");
      });
      setStatus("Video generated locally.");
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        setChakshuError("");
        setStatus("Video generation stopped.");
      } else {
        setChakshuError(error instanceof Error ? error.message : "Chakshu video generation failed.");
      }
    } finally {
      if (chakshuAbortRef.current === controller) chakshuAbortRef.current = null;
      setChakshuGenerating(false);
    }
  }

  function stopChakshuGeneration() {
    const controller = chakshuAbortRef.current;
    if (!controller) return;
    setStatus("Stopping video generation…");
    void cancelDrishtiGeneration();
    controller.abort();
  }

  function selectChakshuHistory(item: ChakshuHistoryItem & { video_url: string }) {
    setChakshuResult(item);
    setChakshuActiveHistoryId(item.id);
    setChakshuModelId(item.model_id);
    setQuery(item.prompt);
    setChakshuError("");
  }

  function switchWorkspaceMode(nextMode: WorkspaceMode) {
    if (file && nextMode !== "chat") {
      setConfirmRequest({
        title: "Remove attached file?",
        message: "Switching to the media workspace will remove the current attachment from the composer.",
        confirmLabel: "Switch workspace",
        onConfirm: () => {
          setFile(null);
          setWorkspaceMode(nextMode);
          setReasoningOpen(false);
        },
      });
      return;
    }
    if (nextMode === "chat" && workspaceMode !== "chat") setQuery("");
    setWorkspaceMode(nextMode);
    setReasoningOpen(false);
  }

  function updateStreamingAnswer(partial: string) {
    partialAnswerRef.current = partial;
    setMessages((previous) => {
      const next = [...previous];
      const last = next.length - 1;
      if (last >= 0 && next[last].role === "ai") next[last] = { ...next[last], text: partial };
      return next;
    });
  }

  function send() {
    if (workspaceMode === "image") {
      void generateDrishti();
      return;
    }
    if (workspaceMode === "video") {
      void generateChakshu();
      return;
    }
    void sendMessage(query, file);
  }

  async function sendMessage(
    rawText: string,
    attached: Message["file"] | null = file,
    historyOverride?: Message[],
    clearComposer = true,
    previousVersions?: string[],
    forceConfiguredEndpoint = false,
  ) {
    const text = rawText.trim();
    if (!text || busy) return;

    let memoryForTurn = memory;
    const correctedName = extractNameCorrection(text);
    if (correctedName && correctedName !== memory.name) {
      memoryForTurn = sanitizeMemory({ ...memory, name: correctedName });
      setMemory(memoryForTurn);
      try {
        localStorage.setItem("satya-memory", JSON.stringify(memoryForTurn));
      } catch {
        // The current conversation still uses the corrected name.
      }
    }

    const chatId = activeRef.current;
    const withFile = (message: { text: string; file?: AttachedFile }) =>
      message.file
        ? "[Attached " + (message.file.kind ?? "file") + ": " + message.file.name + "]\n" + message.file.text + "\n\nQuestion: " + message.text
        : message.text;
    const priorMessages = (historyOverride ?? messages).filter((message) => !message.pending);
    const history: ChatMessage[] = priorMessages
      .filter((message) => !message.error)
      .slice(-12)
      .map((message) => ({
        role: message.role === "ai" ? "assistant" : "user",
        content: withFile(message),
      }));

    const useConfiguredEndpoint = Boolean(provider.baseUrl && provider.model && mode !== "nano" && (mode !== "micro" || forceConfiguredEndpoint));
    const inferenceRoute = useConfiguredEndpoint ? "custom-compatible" : "browser-local";
    const preferenceNotes = [
      preferences.language !== "auto" ? "Preferred response language: " + preferences.language + "." : "",
      preferences.responseStyle !== "balanced" ? "Preferred response style: " + preferences.responseStyle + "." : "",
      preferences.responseLength !== "balanced" ? "Preferred response length: " + preferences.responseLength + "." : "",
    ].filter(Boolean).join(" ");
    if (preferenceNotes) {
      memoryForTurn = sanitizeMemory({
        ...memoryForTurn,
        notes: [memoryForTurn.notes, preferenceNotes].filter(Boolean).join("\n\n"),
      });
    }
    const modelMessages: ChatMessage[] = [
      { role: "system", content: buildSatyaSystemPrompt(memoryForTurn, {
          mode,
          inferenceRoute,
          localInferenceAvailable: inferenceRoute === "browser-local",
          remoteInferenceAvailable: inferenceRoute === "custom-compatible",
        }, preferences) },
      ...history,
      { role: "user", content: attached ? withFile({ text, file: attached }) : text },
    ];

    const selectedTier = getSatyaTier(mode)!;
    const identityAnswer = getIdentityReply(text, memoryForTurn, mode);
    const controller = new AbortController();
    activeAbortRef.current = controller;
    partialAnswerRef.current = "";

    if (clearComposer) {
      setQuery("");
      setFile(null);
    }
    setBusy(true);
    setThinkingActive(false);
    loadingMessageStageRef.current = null;
    setLoadingMessageStage(null);
    loadingMessageRef.current = "";
    lastDownloadProgressAtRef.current = 0;
    lastDownloadPercentRef.current = null;
    progressCommentaryUntilRef.current = 0;
    followLatestRef.current = true;
    const usesLocalModel = !identityAnswer && !useConfiguredEndpoint;
    const initialLoadingMessage = identityAnswer
      ? "Preparing a reply…"
      : useConfiguredEndpoint
        ? "Configured model se jud raha hoon…"
        : nextLoadingLine("cache-check");
    const initialModelProgress = usesLocalModel
      ? {
          percent: null,
          elapsedSeconds: null,
          remainingSeconds: null,
          stage: "initializing" as const,
          messagePhase: "cache-check" as const,
        }
      : undefined;

    // Mount the local-model progress card before the first cache callback so
    // its rotating phrase never appears in the standalone pending-message slot.
    if (usesLocalModel) {
      loadingMessageStageRef.current = "cache-check";
      setLoadingMessageStage("cache-check");
      loadingMessageRef.current = initialLoadingMessage;
    }

    setStatus(
      identityAnswer
        ? "Using SatyaAI identity memory…"
        : initialLoadingMessage,
    );
    const userMessage: Message = {
      role: "user",
      text,
      createdAt: Date.now(),
      ...(attached ? {
        file: {
          name: attached.name,
          text: attached.text,
          kind: attached.kind,
          mediaType: attached.mediaType,
        },
      } : {}),
    };
    setMessages([
      ...priorMessages,
      userMessage,
      {
        role: "ai",
        text: initialLoadingMessage,
        createdAt: Date.now(),
        pending: true,
        tierName: selectedTier.name,
        ...(initialModelProgress ? { modelProgress: initialModelProgress } : {}),
      },
    ]);

    try {
      let answer: string;

      if (identityAnswer) {
        // Identity questions are answered from the saved app profile, rather
        // than asking a small language model to guess who it is.
        answer = identityAnswer;
      } else if (useConfiguredEndpoint) {
        setThinkingActive(true);
        answer = await openAICompatible(provider, modelMessages, mode, controller.signal, updateStreamingAnswer);
        setThinkingActive(false);
      } else {
        const onModelProgress = (progress: string, details?: ModelProgressSnapshot) => {
          const phase = details?.messagePhase;
          if (phase === "download" && details?.percent !== null && details?.percent !== undefined) {
            const previousPercent = lastDownloadPercentRef.current;
            const activeStage = loadingMessageStageRef.current;
            const alreadyDownloading = activeStage === "download" ||
              activeStage === "download-progress" ||
              activeStage === "download-slow";

            if (!alreadyDownloading || previousPercent === null) {
              activateLoadingStage("download", details);
            } else if (details.percent > previousPercent) {
              lastDownloadProgressAtRef.current = Date.now();
              lastDownloadPercentRef.current = details.percent;
              const advancedBy = details.percent - previousPercent;
              if (advancedBy >= DOWNLOAD_PROGRESS_STEP_PERCENT) {
                activateLoadingStage("download-progress", details);
              } else if (activeStage === "download-slow") {
                activateLoadingStage("download", details);
              } else {
                updatePendingLoadingText(loadingMessageRef.current || nextLoadingLine("download"), details);
              }
            } else {
              updatePendingLoadingText(loadingMessageRef.current || nextLoadingLine("download"), details);
            }
          } else if (phase) {
            if (loadingMessageStageRef.current !== phase) {
              activateLoadingStage(phase, details);
            } else {
              updatePendingLoadingText(loadingMessageRef.current || nextLoadingLine(phase), details);
            }
          } else {
            updatePendingLoadingText(progress || "Model load ho raha hai…", details);
          }
        };
        const onThinking = (active: boolean) => setThinkingActive(active);
        if (mode === "micro") {
          answer = await localKana(modelMessages, onModelProgress, updateStreamingAnswer, onThinking, controller.signal);
        } else {
          answer = await localWebLLM(mode, modelMessages, onModelProgress, updateStreamingAnswer, onThinking, memoryForTurn, controller.signal);
        }
      }

      setMessages((previous) => {
        const next = [...previous];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === "ai") {
          const versions = [...(previousVersions ?? []), answer];
          next[last] = { ...next[last], role: "ai", text: answer, pending: false, versions, versionIndex: versions.length - 1 };
        }
        return next;
      });
      setStatus("Ready");
      upsertChat(chatId, [
        ...priorMessages,
        userMessage,
        { role: "ai", text: answer, tierName: selectedTier.name, createdAt: Date.now(), versions: [...(previousVersions ?? []), answer], versionIndex: (previousVersions?.length ?? 0) },
      ]);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        const wasInterrupted = Boolean(partialAnswerRef.current.trim());
        const stoppedText = partialAnswerRef.current || "Generation stopped.";
        setMessages((previous) => {
          const next = [...previous];
          const last = next.length - 1;
          if (last >= 0 && next[last].role === "ai") {
            next[last] = { ...next[last], text: stoppedText, pending: false, modelProgress: undefined, ...(wasInterrupted ? { interrupted: true } : {}) };
          }
          return next;
        });
        if (chatId === activeRef.current) {
          upsertChat(chatId, [
            ...priorMessages,
            userMessage,
            { role: "ai", text: stoppedText, tierName: selectedTier.name, createdAt: Date.now(), ...(wasInterrupted ? { interrupted: true } : {}) },
          ]);
        }
        setStatus("Generation stopped.");
        return;
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown model error";
      const remoteFallbackAvailable = mode === "micro" && !forceConfiguredEndpoint && Boolean(provider.baseUrl && provider.model);
      const privacyNote = mode === "micro" && !forceConfiguredEndpoint
        ? "\n\nKaṇa stayed on-device; no remote inference was contacted."
        : "";
      const completeErrorText = "I couldn't generate a response: " + errorMessage + privacyNote +
        "\n\nCheck the model status or choose a supported inference endpoint in Settings.";
      setMessages((previous) => {
        const next = [...previous];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === "ai") {
          next[last] = {
            ...next[last],
            role: "ai",
            text: completeErrorText,
            error: true,
            pending: false,
            ...(remoteFallbackAvailable ? { remoteFallbackAvailable: true } : {}),
          };
        }
        return next;
      });
      upsertChat(chatId, [
        ...priorMessages,
        userMessage,
        {
          role: "ai",
          text: completeErrorText,
          error: true,
          ...(remoteFallbackAvailable ? { remoteFallbackAvailable: true } : {}),
          tierName: selectedTier.name,
          createdAt: Date.now(),
        },
      ]);
      setStatus("Needs attention");
    } finally {
      setThinkingActive(false);
      loadingMessageStageRef.current = null;
      setLoadingMessageStage(null);
      loadingMessageRef.current = "";
      if (activeAbortRef.current === controller) activeAbortRef.current = null;
      setBusy(false);
    }
  }

  function retryFailedAnswer(index: number, useConfiguredEndpoint = false) {
    if (busy || index !== messages.length - 1 || !messages[index]?.error) return;
    if (useConfiguredEndpoint && (mode !== "micro" || !provider.baseUrl || !provider.model)) return;
    let userIndex = index - 1;
    while (userIndex >= 0 && messages[userIndex].role !== "user") userIndex -= 1;
    if (userIndex < 0) return;
    const question = messages[userIndex];
    const previousVersions = messages[messages.length - 1].versions?.length
      ? messages[messages.length - 1].versions
      : [messages[messages.length - 1].text];
    void sendMessage(question.text, question.file ?? null, messages.slice(0, userIndex), false, previousVersions, useConfiguredEndpoint);
  }

  function continueAnswer(index: number) {
    if (busy || index !== messages.length - 1 || !messages[index]?.interrupted) return;
    void sendMessage(
      "Continue the previous answer from the exact point where it stopped. Do not repeat material already provided; complete the unfinished thought and continue.",
      null,
      messages,
      false,
    );
  }

  function voteOnAnswer(index: number, vote: "up" | "down") {
    setMessageFeedback((previous) => ({ ...previous, [index]: previous[index] === vote ? undefined : vote }));
  }

  function readAloud(text: string) {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setStatus("Read aloud is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = preferences.language === "Hindi"
      ? "hi-IN"
      : preferences.language === "Odia"
        ? "or-IN"
        : navigator.language || "en-IN";
    window.speechSynthesis.speak(utterance);
  }

  function regenerateLastAnswer() {
    if (busy || messages.length < 2 || messages[messages.length - 1]?.role !== "ai") return;
    let userIndex = messages.length - 2;
    while (userIndex >= 0 && messages[userIndex].role !== "user") userIndex -= 1;
    if (userIndex < 0) return;
    const question = messages[userIndex];
    setEditingMessageIndex(null);
    void sendMessage(question.text, question.file ?? null, messages.slice(0, userIndex), false);
  }

  function moveMessageVersion(index: number, direction: -1 | 1) {
    const message = messages[index];
    if (!message?.versions || message.versions.length < 2) return;
    const current = message.versionIndex ?? message.versions.length - 1;
    const nextIndex = Math.max(0, Math.min(message.versions.length - 1, current + direction));
    if (nextIndex === current) return;
    const nextMessages = messages.map((item, itemIndex) => itemIndex === index
      ? { ...item, versionIndex: nextIndex, text: message.versions![nextIndex] }
      : item);
    setMessages(nextMessages);
    upsertChat(activeRef.current, nextMessages);
  }

  async function shareAnswer(text: string) {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "SatyaAI answer", text });
      } else {
        await copyText(text, "share");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        await copyText(text, "share");
      }
    }
  }

  function submitEditedMessage(index: number) {
    const original = messages[index];
    if (!original || original.role !== "user" || !editDraft.trim() || busy) return;
    const submit = () => {
      setEditingMessageIndex(null);
      void sendMessage(editDraft, original.file ?? null, messages.slice(0, index), false);
    };
    if (index < messages.length - 1) {
      setConfirmRequest({ title: "Resubmit this message?", message: "Later messages and replies in this conversation will be removed from the current thread.", confirmLabel: "Resubmit", onConfirm: submit });
      return;
    }
    submit();
  }

  const visibleChats = chats.filter((chat) => {
    const queryText = chatSearch.trim().toLowerCase();
    if (!queryText) return true;
    return chat.title.toLowerCase().includes(queryText) ||
      chat.messages.some((message) => message.text.toLowerCase().includes(queryText));
  });
  const appearanceLabel = theme === "dark" ? "Light appearance" : "Dark appearance";
  const shellClasses = [
    "app-shell",
    busy ? "is-busy" : "",
    preferences.compactMode ? "compact-mode" : "",
    preferences.reduceMotion ? "reduce-motion" : "",
    "text-" + preferences.fontSize,
  ].filter(Boolean).join(" ");

  return (
    <div className={shellClasses}>
      <div className="cosmos" aria-hidden="true">
        <i className="nebula n1" />
        <i className="nebula n2" />
        <i className="nebula n3" />
        <Starfield active={theme === "dark" && !preferences.reduceMotion} busy={busy || drishtiStarting || drishtiGenerating || chakshuGenerating} />
        <i className="vignette" />
        <i className="grain" />
      </div>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <div className={"side-backdrop" + (menu ? " open" : "")} aria-hidden="true" />
      <Sidebar
        menu={menu} setMenu={setMenu} isMac={isMac} startNewChat={startNewChat}
        sidebarView={sidebarView} setSidebarView={setSidebarView} chats={chats} saved={saved}
        chatSearch={chatSearch} setChatSearch={setChatSearch} visibleChats={visibleChats}
        editingChatId={editingChatId} setEditingChatId={setEditingChatId}
        chatTitleDraft={chatTitleDraft} setChatTitleDraft={setChatTitleDraft}
        saveChatTitle={saveChatTitle} openChat={openChat} preview={preview} dayLabel={dayLabel}
        beginRenameChat={beginRenameChat} exportChat={exportChat} deleteChat={deleteChat}
        busy={busy} activeId={activeId} openSaved={openSaved} removeSaved={removeSaved}
        status={status} engineTitle={engineTitle} capability={capability} openSettings={openSettings}
        theme={theme} setTheme={setTheme} appearanceLabel={appearanceLabel}
      />

      <main className="main">
        <header className="topbar">
          <button
            className="icon-btn menu-btn"
            onClick={() => setMenu(true)}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>
          <div className="reasoning" ref={reasoningRef}>
            <button
              className={"crumb reasoning-btn" + (reasoningOpen ? " open" : "")}
              onClick={() => setReasoningOpen((open) => !open)}
              onKeyDown={(event) => {
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                if (!reasoningOpen) setReasoningOpen(true);
                window.requestAnimationFrame(() => {
                  const options = Array.from(reasoningRef.current?.querySelectorAll<HTMLButtonElement>('button[role="option"]:not(:disabled)') ?? []);
                  if (!options.length) return;
                  const index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
                    : event.key === "ArrowUp" ? options.length - 1 : 0;
                  options[index].focus();
                });
              }}
              aria-haspopup="listbox"
              aria-expanded={reasoningOpen}
              aria-label={workspaceMode === "image"
                ? "Image model: " + currentDrishti.name
                : workspaceMode === "video"
                  ? "Video model: " + currentChakshu.name
                  : "Reasoning mode: " + current.modeLabel + ", engine " + current.name}
            >
              <span className="reasoning-symbol" aria-hidden="true">
                {workspaceMode === "image" ? <ImageIcon size={18} /> : workspaceMode === "video" ? <VideoIcon size={18} /> : mode === "micro" ? <KanaLogo size={18} /> : current.symbol}
              </span>
              <span className="reasoning-full-label">{workspaceMode === "image" ? "Image model" : workspaceMode === "video" ? "Video model" : "Reasoning"}</span>
              <em className="reasoning-current">{workspaceMode === "image" ? currentDrishti.selectorLabel : workspaceMode === "video" ? currentChakshu.selectorLabel : current.modeLabel}</em>
              <ChevronDown size={14} className="chev" />
            </button>
            {reasoningOpen && (
              <div
                className="reasoning-menu"
                role="listbox"
                aria-label={workspaceMode === "image" ? "Drishti image model" : workspaceMode === "video" ? "Chakshu video model" : "Reasoning mode"}
                onKeyDown={(event) => {
                  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                  const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="option"]:not(:disabled)'));
                  if (!options.length) return;
                  event.preventDefault();
                  const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
                  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
                    : event.key === "ArrowDown" ? (currentIndex + 1 + options.length) % options.length
                    : (currentIndex - 1 + options.length) % options.length;
                  options[nextIndex].focus();
                }}
              >
                {workspaceMode === "chat" ? (
                  (Object.keys(modes) as Mode[]).map((key) => (
                    <button
                      key={key}
                      role="option"
                      aria-selected={mode === key}
                      className={"reasoning-option" + (mode === key ? " chosen" : "")}
                      onClick={() => {
                        setMode(key);
                        setReasoningOpen(false);
                      }}
                    >
                      <span className="ro-icon ro-symbol" aria-hidden="true">{key === "micro" ? <KanaLogo size={19} /> : getSatyaTier(key)!.symbol}</span>
                      <span className="ro-text">
                        <span className="ro-primary">
                          <strong>{getSatyaTier(key)!.name}</strong>
                          <small className="ro-mode">{getSatyaTier(key)!.modeLabel}</small>
                        </span>
                        <small>{modes[key].desc}</small>
                      </span>
                      {mode === key && <Check size={15} className="ro-check" />}
                    </button>
                  ))
                ) : workspaceMode === "image" ? (
                  DRISHTI_MODELS.map((model) => (
                    <button
                      key={model.id}
                      role="option"
                      aria-selected={drishtiModelId === model.id}
                      className={"reasoning-option" + (drishtiModelId === model.id ? " chosen" : "")}
                      disabled={drishtiGenerating || drishtiChecking}
                      onClick={() => {
                        setDrishtiModelId(model.id);
                        setDrishtiResult(null);
                        setDrishtiError("");
                        setReasoningOpen(false);
                      }}
                    >
                      <span className="ro-icon ro-symbol" aria-hidden="true">
                        {React.createElement(DRISHTI_MODEL_ICONS[model.id], { size: 19 })}
                      </span>
                      <span className="ro-text">
                        <span className="ro-primary">
                          <strong>{model.name}</strong>
                          {model.experimental && <small className="drishti-experimental">EXPERIMENTAL</small>}
                        </span>
                        <small>{model.description}</small>
                      </span>
                      {drishtiModelId === model.id && <Check size={15} className="ro-check" />}
                    </button>
                  ))
                ) : (
                  CHAKSHU_MODELS.map((model) => (
                    <button key={model.id} role="option" aria-selected={chakshuModelId === model.id}
                      className={"reasoning-option" + (chakshuModelId === model.id ? " chosen" : "")}
                      disabled={chakshuGenerating || drishtiChecking}
                      onClick={() => { setChakshuModelId(model.id); setChakshuError(""); setReasoningOpen(false); }}>
                      <span className="ro-icon ro-symbol" aria-hidden="true">{React.createElement(CHAKSHU_MODEL_ICONS[model.id], { size: 19 })}</span>
                      <span className="ro-text"><span className="ro-primary"><strong>{model.name}</strong>{model.experimental && <small className="drishti-experimental">EXPERIMENTAL</small>}</span><small>{model.description}</small></span>
                      {chakshuModelId === model.id && <Check size={15} className="ro-check" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              onClick={() => openSettings()}
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            <button
              className="avatar"
              onClick={() => avatarInputRef.current?.click()}
              aria-label="Change profile picture"
              title={memory.name ? memory.name + " · change picture" : "Change profile picture"}
            >
              {avatar ? <img src={avatar} alt="" /> : initials || <User size={16} />}
              <span className="avatar-edit-hint" aria-hidden="true"><Pencil size={10} /></span>
            </button>
            <input
              ref={avatarInputRef}
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => {
                void pickAvatar(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
        </header>

        <section
          className="conversation"
          ref={conversationRef}
          onScroll={() => {
            const container = conversationRef.current;
            if (!container) return;
            const distanceFromBottom =
              container.scrollHeight -
              container.scrollTop -
              container.clientHeight;
            followLatestRef.current = distanceFromBottom < 140;
            setShowJumpToLatest(distanceFromBottom >= 180);
          }}
          aria-label="Conversation"
        >
          {workspaceMode === "image" && (
            <DrishtiStudio
              drishtiChecking={drishtiChecking}
              drishtiStarting={drishtiStarting}
              drishtiRuntimeHealth={drishtiRuntimeHealth}
              connectDrishtiRuntime={connectDrishtiRuntime}
              drishtiWindowsDesktopSupported={drishtiWindowsDesktopSupported}
              drishtiGenerating={drishtiGenerating}
              drishtiActivityRef={drishtiActivityRef}
              drishtiResult={drishtiResult}
              varyDrishti={varyDrishti}
              regenerateDrishti={regenerateDrishti}
              downloadDrishtiImage={downloadDrishtiImage}
              onNewImage={() => { setDrishtiResult(null); setDrishtiActiveHistoryId(null); setDrishtiError(""); setQuery(""); }}
              drishtiError={drishtiError}
              drishtiRuntimeStatus={drishtiRuntimeStatus}
              stopDrishtiGeneration={stopDrishtiGeneration}
              drishtiHistory={drishtiHistory}
              drishtiActiveHistoryId={drishtiActiveHistoryId}
              selectDrishtiHistory={selectDrishtiHistory}
              drishtiHistoryWarning={drishtiHistoryWarning}
              drishtiModelRuntime={drishtiModelRuntime}
              drishtiRuntimeError={drishtiRuntimeError}
              pickSuggestion={pickSuggestion}
            />
          )}
          
          {workspaceMode === "video" && (
            <ChakshuStudio
              drishtiChecking={drishtiChecking}
              drishtiStarting={drishtiStarting}
              drishtiRuntimeHealth={drishtiRuntimeHealth}
              drishtiWindowsDesktopSupported={drishtiWindowsDesktopSupported}
              connectChakshuRuntime={connectChakshuRuntime}
              chakshuGenerating={chakshuGenerating}
              currentChakshu={currentChakshu}
              chakshuModelId={chakshuModelId}
              divyaLicenseAccepted={divyaLicenseAccepted}
              setDivyaLicenseAccepted={setDivyaLicenseAccepted}
              chakshuResult={chakshuResult}
              chakshuHistory={chakshuHistory}
              chakshuActiveHistoryId={chakshuActiveHistoryId}
              selectChakshuHistory={selectChakshuHistory}
              chakshuHistoryWarning={chakshuHistoryWarning}
              chakshuError={chakshuError}
              chakshuRuntimeStatus={chakshuRuntimeStatus}
              stopChakshuGeneration={stopChakshuGeneration}
              chakshuModelRuntime={chakshuModelRuntime}
              pickSuggestion={pickSuggestion}
            />
          )}
          
          {workspaceMode === "chat" && messages.length === 0 && (
            <div className="hero">
              <div className="orb">
                <span />
                <span />
                <span />
              </div>
              <h1>
                {HOME_HERO_COPY.lead}
                <br />
                <em>{HOME_HERO_COPY.accent}</em>
              </h1>
              <p>{HOME_HERO_COPY.tagline}</p>
              <div className="suggestions">
                {STARTERS.map((item, index) => (
                  <button
                    key={item.title}
                    className="suggestion"
                    onPointerMove={trackPointer}
                    onClick={() => pickSuggestion(item.title)}
                    style={{ "--i": index } as React.CSSProperties}
                  >
                    <strong>{item.title}</strong>
                    <small>{item.hint}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {workspaceMode === "chat" && messages.length > 0 && (
            <div className="messages" role="log" aria-live="polite" aria-relevant="additions text">
              {messages.map((message, index) => (
                <div
                  className={"message " + message.role + (message.error ? " error" : "")}
                  key={index}
                >
                  <div className="message-avatar">
                    {message.role === "ai" ? (
                      <Sparkles size={15} />
                    ) : avatar ? (
                      <img src={avatar} alt="" />
                    ) : (
                      initials || <User size={15} />
                    )}
                  </div>
                  <div className="message-content">
                    <div className="message-role">
                      {message.role === "ai" ? (
                        <>SatyaAI{message.tierName ? <span className="message-tier">({message.tierName})</span> : null}</>
                      ) : "You"}
                    </div>
                    {message.role === "ai" && !message.pending ? (
                      <Markdown text={message.text} onCopy={(code) => void copyText(code, "code-" + index)} />
                    ) : message.pending && message.modelProgress ? null : (
                      <p className={message.pending ? "pending-copy" : ""}>
                        {message.text}
                      </p>
                    )}
                    {message.role === "ai" && !message.pending && (message.versions?.length ?? 0) > 1 && (
                      <div className="message-version-pager" aria-label="Answer versions">
                        <button className="msg-action" onClick={() => moveMessageVersion(index, -1)} disabled={(message.versionIndex ?? message.versions!.length - 1) <= 0} aria-label="Previous answer version">‹</button>
                        <span>{(message.versionIndex ?? message.versions!.length - 1) + 1} / {message.versions!.length}</span>
                        <button className="msg-action" onClick={() => moveMessageVersion(index, 1)} disabled={(message.versionIndex ?? message.versions!.length - 1) >= message.versions!.length - 1} aria-label="Next answer version">›</button>
                      </div>
                    )}
                    {preferences.showTimestamps && message.createdAt && (
                      <time className="message-timestamp">{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                    )}
                    {message.role === "user" && !message.pending && (
                      editingMessageIndex === index ? (
                        <div className="message-edit">
                          <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} rows={3} aria-label="Edit sent message" />
                          <div>
                            <button className="msg-action primary-action" onClick={() => submitEditedMessage(index)} disabled={!editDraft.trim() || busy}>Save and resubmit</button>
                            <button className="msg-action" onClick={() => setEditingMessageIndex(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="message-actions">
                          <button className="msg-action" onClick={() => { setEditingMessageIndex(index); setEditDraft(message.text); }} disabled={busy}><Pencil size={13} /> Edit</button>
                          <button className="msg-action" onClick={() => void copyText(message.text, "user-" + index)}><Copy size={13} /> {copiedAction === "user-" + index ? "Copied" : "Copy"}</button>
                        </div>
                      )
                    )}
                    {message.role === "ai" && message.error && !message.pending && index === messages.length - 1 && (
                      <div className="message-actions">
                        <button className="msg-action primary-action" onClick={() => retryFailedAnswer(index)} disabled={busy}>Retry</button>
                        {message.remoteFallbackAvailable && provider.baseUrl && provider.model && (
                          <button className="msg-action" onClick={() => retryFailedAnswer(index, true)} disabled={busy}>Use configured endpoint once</button>
                        )}
                        <button className="msg-action" onClick={() => void copyText(message.text, "error-" + index)}><Copy size={13} /> Copy error</button>
                      </div>
                    )}
                    {message.file && (
                      <small className="file-note">
                        {message.file.kind === "image" ? <ImageIcon size={12} /> : message.file.kind === "video" ? <VideoIcon size={12} /> : message.file.kind === "audio" ? <Mic size={12} /> : <FileText size={12} />}
                        {message.file.name}
                      </small>
                    )}
                    {message.role === "ai" &&
                      !message.pending &&
                      !message.error &&
                      !(busy && index === messages.length - 1) && (
                        <div className="message-actions">
                          <button className="msg-action" onClick={() => void copyText(message.text, "answer-" + index)}>
                            <Copy size={14} /> {copiedAction === "answer-" + index ? "Copied" : "Copy"}
                          </button>
                          <button
                            className={"msg-action" + (isSaved(index) ? " on" : "")}
                            onClick={() => toggleSaved(index)}
                            aria-pressed={isSaved(index)}
                          >
                            {isSaved(index) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                            {isSaved(index) ? "Saved" : "Save answer"}
                          </button>
                          <button className={"msg-action" + (messageFeedback[index] === "up" ? " on" : "")} onClick={() => voteOnAnswer(index, "up")} aria-pressed={messageFeedback[index] === "up"} aria-label="Mark answer helpful">👍</button>
                          <button className={"msg-action" + (messageFeedback[index] === "down" ? " on" : "")} onClick={() => voteOnAnswer(index, "down")} aria-pressed={messageFeedback[index] === "down"} aria-label="Mark answer not helpful">👎</button>
                          <button className="msg-action" onClick={() => readAloud(message.text)}>Read aloud</button>
                          <button className="msg-action" onClick={() => void shareAnswer(message.text)}>Share</button>
                          {message.interrupted && index === messages.length - 1 && (
                            <button className="msg-action primary-action" onClick={() => continueAnswer(index)} disabled={busy}>Continue</button>
                          )}
                          {index === messages.length - 1 && (
                            <button className="msg-action" onClick={regenerateLastAnswer} disabled={busy}>
                              <Zap size={13} /> Regenerate
                            </button>
                          )}
                        </div>
                      )}
                    {message.pending && message.modelProgress && (
                      <div className="model-progress">
                        <div className="model-progress-heading">
                          <span className="model-progress-copy pending-copy" aria-live="polite">
                            {message.text}
                          </span>
                          <strong>
                            {message.modelProgress.percent === null
                              ? "Preparing"
                              : message.modelProgress.percent + "%"}
                          </strong>
                        </div>
                        <div
                          className="model-progress-track"
                          role="progressbar"
                          aria-label="Model loading progress"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={message.modelProgress.percent ?? 0}
                          aria-valuetext={
                            message.modelProgress.percent === null
                              ? "Preparing model"
                              : message.modelProgress.percent + " percent complete"
                          }
                        >
                          <div
                            className={
                              "model-progress-fill " +
                              (message.modelProgress.percent === null
                                ? "indeterminate"
                                : "")
                            }
                            style={{
                              width:
                                message.modelProgress.percent === null
                                  ? "14%"
                                  : message.modelProgress.percent + "%",
                            }}
                          />
                        </div>
                        <div className="model-progress-meta">
                          {message.modelProgress.percent === null
                            ? message.modelProgress.messagePhase === "cache-check"
                              ? "Checking whether the model is already saved on this device…"
                              : message.modelProgress.messagePhase === "cache-load"
                                ? "Retrieving previously downloaded model files…"
                                : message.modelProgress.messagePhase === "switching"
                                  ? "Loading the selected model…"
                                  : message.modelProgress.messagePhase === "recovery"
                                    ? "Trying the fallback model…"
                                    : "Preparing model for inference…"
                            : message.modelProgress.percent +
                              "% complete · " +
                              (100 - message.modelProgress.percent) +
                              "% baaki"}
                          {formatDuration(message.modelProgress.elapsedSeconds) &&
                            " · " +
                              formatDuration(message.modelProgress.elapsedSeconds) +
                              " elapsed"}
                          {formatDuration(message.modelProgress.remainingSeconds) &&
                            " · ~" +
                              formatDuration(message.modelProgress.remainingSeconds) +
                              " baaki"}
                        </div>
                      </div>
                    )}
                    {message.pending && thinkingActive && (
                      <p className="thinking-aside" aria-live="polite">
                        {THINKING_PHRASES[thinkingPhraseOrderRef.current?.[thinkingPhrasePosition] ?? 0]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div className="messages-end" aria-hidden="true" />
            </div>
          )}

          <div className="composer-wrap">
            {workspaceMode === "chat" && file && (
              <div className="attachment">
                {file.previewUrl ? (
                  <img className="attachment-preview" src={file.previewUrl} alt="Attached photo preview" />
                ) : file.kind === "video" ? (
                  <VideoIcon size={16} />
                ) : file.kind === "audio" ? (
                  <Mic size={16} />
                ) : (
                  <FileText size={16} />
                )}
                <div className="attachment-copy">
                  <span>{file.name}</span>
                  <small>{file.kind === "image" ? "Photo attached · image understanding coming soon" : file.kind === "video" || file.kind === "audio" || file.kind === "document" ? "Attached · reading this format is coming soon" : "Ready to include in your message"}</small>
                </div>
                <button onClick={() => setFile(null)} aria-label="Remove attachment">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="composer" onPointerMove={trackPointer}>
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && preferences.enterToSend) {
                    event.preventDefault();
                    if (workspaceMode === "image") {
                      if (!drishtiGenerating && !drishtiStarting) void send();
                    } else if (workspaceMode === "video") {
                      if (!chakshuGenerating && !drishtiStarting) void send();
                    } else if (!busy) void send();
                  }
                }}
                placeholder={workspaceMode === "image" ? "Describe the image you have in mind…" : workspaceMode === "video" ? "Describe the scene you want to see in motion…" : busy ? status : "What's on your mind? Weird questions welcome…"}
                aria-label={workspaceMode === "image" ? "Image prompt for Drishti" : workspaceMode === "video" ? "Video prompt for Chakshu" : "Message SatyaAI"}
              />
              <div className="composer-bottom">
                <div className="composer-tools composer-actions" aria-label="Workspace controls">
                  {workspaceMode === "chat" && (
                    <div className="composer-plus-wrap" ref={composerMenuRef}>
                      <button
                        type="button"
                        className="composer-action-pill composer-add-action"
                        onClick={() => setAttachmentMenuOpen((open) => !open)}
                        disabled={busy}
                        aria-label="Open add menu"
                        aria-expanded={attachmentMenuOpen}
                        aria-haspopup="menu"
                      >
                        <Plus size={17} /> <span>Add</span>
                      </button>
                      {attachmentMenuOpen && (
                        <div className="composer-plus-menu" role="menu" aria-label="Add to message">
                          <div className="composer-menu-section-label">ATTACH FROM DEVICE</div>
                          <button type="button" role="menuitem" className="composer-menu-item" onClick={openCamera}>
                            <Camera size={17} />
                            <span><strong>Camera</strong><small>Take a photo with your device</small></span>
                          </button>
                          <button type="button" role="menuitem" className="composer-menu-item" onClick={() => { setAttachmentMenuOpen(false); inputRef.current?.click(); }}>
                            <FileText size={17} />
                            <span><strong>Add media &amp; files</strong><small>Photos, videos, audio and documents</small></span>
                          </button>
                          <div className="composer-plus-divider" />
                          <div className="composer-menu-section-label">MORE TOOLS</div>
                          <button type="button" role="menuitem" className="composer-menu-item composer-menu-soon" disabled title="Web search is coming soon">
                            <Search size={17} />
                            <span><strong>Web search</strong><small>Search and cite live sources</small></span>
                            <small className="composer-coming-soon">Coming soon</small>
                          </button>
                        </div>
                      )}
                      <input
                        ref={inputRef}
                        hidden
                        type="file"
                        accept="image/*,video/*,audio/*,.txt,.md,.csv,.json,.log,.pdf,text/plain,application/pdf"
                        onChange={(event) => {
                          void pickFile(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </div>
                  )}
                  <div className="workspace-mode-tabs" role="tablist" aria-label="SatyaAI workspace">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={workspaceMode === "chat"}
                      className={"composer-action-pill workspace-mode-tab composer-chat-action" + (workspaceMode === "chat" ? " active" : "")}
                      onClick={() => switchWorkspaceMode("chat")}
                      disabled={busy || drishtiStarting || drishtiGenerating || chakshuGenerating}
                      title="Chat"
                    >
                      <MessageSquare size={15} /><span>Chat</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={workspaceMode === "image"}
                      className={"composer-action-pill workspace-mode-tab composer-image-action" + (workspaceMode === "image" ? " active" : "")}
                      onClick={() => switchWorkspaceMode("image")}
                      disabled={busy || drishtiStarting || drishtiGenerating || chakshuGenerating}
                      title="Create image"
                    >
                      <ImageIcon size={15} /><span>Create image</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={workspaceMode === "video"}
                      className={"composer-action-pill workspace-mode-tab composer-video-action" + (workspaceMode === "video" ? " active" : "")}
                      onClick={() => switchWorkspaceMode("video")}
                      disabled={busy || drishtiStarting || drishtiGenerating || chakshuGenerating}
                      title="Create video"
                    >
                      <VideoIcon size={15} /><span>Create video</span>
                    </button>
                  </div>
                </div>
                <button
                  className={"send " + (workspaceMode === "image"
                    ? (drishtiGenerating ? "stop " : query.trim() ? "ready " : "mic ")
                    : workspaceMode === "video"
                      ? (chakshuGenerating ? "stop " : query.trim() ? "ready " : "mic ")
                      : busy ? "stop " : query.trim() ? "ready " : "mic ") + (listening ? "listening" : "")}
                  disabled={workspaceMode === "image"
                    ? (!drishtiGenerating && !drishtiStarting && (!query.trim() || !drishtiWindowsDesktopSupported))
                    : workspaceMode === "video"
                      ? (!chakshuGenerating && !drishtiStarting && (!query.trim() || !drishtiWindowsDesktopSupported || (chakshuModelId === "divya" && !divyaLicenseAccepted)))
                      : (!busy && (!query.trim() && !canSpeak))}
                  onClick={() => workspaceMode === "image"
                    ? drishtiGenerating || drishtiStarting ? stopDrishtiGeneration() : void send()
                    : workspaceMode === "video"
                      ? chakshuGenerating || drishtiStarting ? stopChakshuGeneration() : void send()
                      : busy ? stopGeneration() : (query.trim() ? void send() : toggleMic())}
                  aria-label={workspaceMode === "image"
                    ? drishtiGenerating || drishtiStarting ? "Stop image generation" : !drishtiWindowsDesktopSupported ? "Image generation requires Windows desktop" : drishtiCanGenerate ? "Generate image locally" : "Start local engine and generate image"
                    : workspaceMode === "video"
                      ? chakshuGenerating || drishtiStarting ? "Stop video generation" : !drishtiWindowsDesktopSupported ? "Video generation requires Windows desktop" : chakshuCanGenerate ? "Generate video locally" : "Start local engine and generate video"
                      : busy ? "Stop generation" : query.trim() ? "Send message" : listening ? "Stop voice input" : canSpeak ? "Start voice input" : "Voice input isn't supported in this browser"}
                  title={workspaceMode === "image"
                    ? drishtiGenerating || drishtiStarting ? "Stop image generation" : !drishtiWindowsDesktopSupported ? "Windows desktop required" : drishtiCanGenerate ? "Generate locally with " + currentDrishti.name : "Start the local companion and generate"
                    : workspaceMode === "video"
                      ? chakshuGenerating || drishtiStarting ? "Stop video generation" : !drishtiWindowsDesktopSupported ? "Windows desktop required" : chakshuCanGenerate ? "Generate locally with " + currentChakshu.name : "Start the local companion and generate"
                      : busy ? "Stop generation" : query.trim() ? "Send message" : "Voice input"}
                >
                  {workspaceMode === "image"
                    ? drishtiGenerating || drishtiStarting ? <Square size={17} /> : <ImageIcon size={17} />
                    : workspaceMode === "video"
                      ? chakshuGenerating || drishtiStarting ? <Square size={17} /> : <VideoIcon size={17} />
                      : busy ? <Square size={17} /> : query.trim() ? <ArrowUp size={18} /> : <Mic size={18} />}
                </button>
              </div>
            </div>
            {workspaceMode === "chat" && showJumpToLatest && messages.length > 0 && (
              <button className="jump-latest" onClick={scrollToLatest}>
                <ArrowDown size={15} /> Jump to latest
              </button>
            )}

            <div className="composer-meta">
              <span>
                {workspaceMode === "image"
                  ? drishtiStarting
                    ? "Starting the desktop companion…"
                    : drishtiGenerating
                      ? drishtiRuntimeStatus?.message || "Generating locally on this device…"
                      : drishtiCanGenerate
                        ? "Local runtime connected. Image prompts stay on this device."
                        : "Submitting a prompt can start the installed local companion automatically."
                  : workspaceMode === "video"
                    ? drishtiStarting
                      ? "Starting the local video companion…"
                      : chakshuGenerating
                        ? chakshuRuntimeStatus?.message || "Rendering video locally…"
                        : chakshuCanGenerate
                          ? "Local runtime connected. Video prompts stay on this device."
                          : "Video tiers require compatible GPU memory. The installed companion starts automatically."
                    : busy
                      ? status + " Keep this tab open."
                      : "SatyaAI can make mistakes. Verify important information."}
              </span>
              <span className="composer-engine-note">SatyaSom Engine · Local-first</span>
              <button onClick={() => openSettings("privacy")}>Privacy & data</button>
            </div>
          </div>
        </section>
      </main>

      {cameraOpen && (
        <div
          className="camera-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCameraOpen(false);
          }}
        >
          <section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-dialog-title">
            <header className="camera-dialog-header">
              <div>
                <span className="camera-dialog-kicker">SATYA SOM · CAMERA</span>
                <h2 id="camera-dialog-title">Capture a photo</h2>
                <p>Use your device camera to add a photo to this conversation.</p>
              </div>
              <button type="button" className="camera-close" onClick={() => setCameraOpen(false)} aria-label="Close camera">
                <X size={18} />
              </button>
            </header>
            <div className="camera-preview-frame">
              <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setCameraReady(true)}
              />
              {!cameraReady && (
                <div className="camera-preview-message" role="status">
                  <Camera size={24} />
                  <strong>{cameraError ? "Camera unavailable" : "Starting your camera…"}</strong>
                  <span>{cameraError || "Allow camera permission when your browser asks."}</span>
                </div>
              )}
            </div>
            <footer className="camera-dialog-footer">
              <small>Photo previews can be attached now. Image understanding is coming soon.</small>
              <button type="button" className="camera-capture-button" onClick={captureCameraPhoto} disabled={!cameraReady || Boolean(cameraError)}>
                <Camera size={16} /> Capture photo
              </button>
            </footer>
          </section>
        </div>
      )}
      <ConfirmDialog request={confirmRequest} onCancel={() => setConfirmRequest(null)} onConfirm={() => {
        const request = confirmRequest;
        setConfirmRequest(null);
        request?.onConfirm();
      }} />
      <SettingsPanel
        open={settings}
        onClose={() => setSettings(false)}
        settingsRef={settingsRef}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        theme={theme}
        setTheme={setTheme}
        preferences={preferences}
        setPreferences={setPreferences}
        avatar={avatar}
        initials={initials}
        avatarInputRef={avatarInputRef}
        removeAvatar={removeAvatar}
        avatarNote={avatarNote}
        memoryNameDraft={memoryNameDraft}
        setMemoryNameDraft={setMemoryNameDraft}
        memoryNotesDraft={memoryNotesDraft}
        setMemoryNotesDraft={setMemoryNotesDraft}
        saveMemory={saveMemory}
        clearMemory={clearMemory}
        memory={memory}
        current={current}
        capability={capability}
        mode={mode}
        provider={provider}
        setProvider={setProvider}
        endpointFeedback={endpointFeedback}
        saveEndpointSettings={saveEndpointSettings}
        clearEndpointSettings={clearEndpointSettings}
        chats={chats}
        saved={saved}
        exportAllData={exportAllData}
        clearConversationData={clearConversationData}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
