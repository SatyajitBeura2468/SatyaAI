import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  ArrowDown,
  Aperture,
  Check,
  Crown,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Layers,
  Library,
  Menu,
  Mic,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Square,
  Pencil,
  Trash2,
  Sun,
  User,
  X,
  Zap,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { SettingsPanel } from "./components/SettingsPanel";
import { DrishtiStudio } from "./components/DrishtiStudio";
import { ChakshuStudio } from "./components/ChakshuStudio";
import "./cosmos.css";
import "./reasoning-profile.css";
import "./drishti.css";
import { Starfield } from "./Starfield";
import { freshStarters } from "./starters";
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
import { cancelDrishtiGeneration, checkDrishtiRuntime, generateDrishtiImage, getDrishtiRuntimeStatus, requestDrishtiCompanionStart, DRISHTI_COMPANION_INSTALL_URL, type DrishtiRuntimeHealth, type DrishtiRuntimeStatus } from "./ai/drishti/client";
import { CHAKSHU_MODELS, DEFAULT_CHAKSHU_MODEL_ID, getChakshuModel, isChakshuModelId, type ChakshuModelId } from "./ai/chakshu/registry";
import { generateChakshuVideo, getChakshuRuntimeStatus, type ChakshuRuntimeStatus } from "./ai/chakshu/client";
import { loadChakshuHistory, saveChakshuHistoryItem, type ChakshuHistoryItem } from "./ai/chakshu/history";
import { Markdown } from "./markdown";
import { loadDrishtiHistory, saveDrishtiHistoryItem, type DrishtiHistoryItem } from "./ai/drishti/history";

type Mode = SatyaTierMode;
type WorkspaceMode = "chat" | "image" | "video";
type Theme = "light" | "dark";
type Message = {
  role: "user" | "ai";
  text: string;
  pending?: boolean;
  modelProgress?: ModelProgressSnapshot;
  tierName?: string;
  error?: boolean;
  file?: { name: string; text: string };
  createdAt?: number;
};
type Chat = { id: string; title: string; updatedAt: number; messages: Message[] };
type AppPreferences = {
  defaultMode: Mode;
  language: "auto" | "English" | "Hindi" | "Odia";
  responseStyle: "balanced" | "friendly" | "formal" | "academic";
  responseLength: "short" | "balanced" | "detailed";
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
  nano: { desc: "Lightweight, on-device replies" },
  fast: { desc: "Quick, efficient answers" },
  smart: { desc: "Balanced reasoning & quality" },
  deep: { desc: "Longer, more detailed answers" },
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
  enterToSend: typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches,
  compactMode: false,
  showTimestamps: false,
  reduceMotion: false,
  saveChatHistory: true,
  fontSize: "medium",
};
function readPreferences(): AppPreferences {
  const stored = loadJSON<Partial<AppPreferences>>(PREFERENCES_KEY, {});
  return { ...DEFAULT_PREFERENCES, ...stored };
}
const MAX_SAVED = 100;
const AVATAR_KEY = "satya-avatar";
const AVATAR_SIZE = 256;
const MAX_CHATS = 30;
const ATTACH_MAX_CHARS = 6000;
const ATTACH_MAX_BYTES = 1_000_000;
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
const preview = (text: string) =>
  text.replace(/[*`#>_]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const drishtiWindowsDesktopSupported =
  typeof navigator !== "undefined" &&
  /Windows|Win32|Win64|WinCE/i.test(navigator.userAgent + " " + navigator.platform);
const isCoarsePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
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
  lite: Sparkles,
  core: Layers,
  ultra: Aperture,
  max: Crown,
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
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [endpointFeedback, setEndpointFeedback] = useState("");
  const [file, setFile] = useState<{ name: string; text: string } | null>(
    null,
  );
  const [listening, setListening] = useState(false);
  const [gateway, setGateway] = useState<"online" | "offline">("offline");
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
      return { baseUrl, model, apiKey: sessionStorage.getItem("satya-provider-key") || undefined };
    } catch {
      return {};
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
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
  const currentDrishti = getDrishtiModel(drishtiModelId);
  const drishtiModelRuntime = drishtiRuntimeHealth?.models?.[drishtiModelId];
  const drishtiCanGenerate = Boolean(!drishtiChecking && !drishtiStarting && !drishtiGenerating && drishtiRuntimeHealth?.ok && drishtiModelRuntime?.available);
  const currentChakshu = getChakshuModel(chakshuModelId);
  const chakshuModelRuntime = drishtiRuntimeHealth?.video_models?.[chakshuModelId];
  const chakshuCanGenerate = Boolean(!drishtiChecking && !drishtiStarting && !chakshuGenerating && drishtiRuntimeHealth?.ok && chakshuModelRuntime?.available && (chakshuModelId !== "divya" || divyaLicenseAccepted));
  const initials = getInitials(memory.name);

  const capability = useMemo(
    () =>
      provider.baseUrl
        ? "OpenAI-compatible endpoint configured"
        : gateway === "online"
          ? "Answers come from the online gateway"
          : hasWebGPU()
            ? "WebGPU · browser-local inference"
            : "This browser has no WebGPU, so the on-device model cannot run",
    [provider.baseUrl, gateway],
  );
  const engineTitle = provider.baseUrl
    ? "Custom endpoint"
    : gateway === "online"
      ? "Hosted model"
      : hasWebGPU()
        ? "Browser model"
        : "No inference available";

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
      if (provider.apiKey) sessionStorage.setItem("satya-provider-key", provider.apiKey);
      else sessionStorage.removeItem("satya-provider-key");
      setEndpointFeedback("Endpoint settings saved. The API key is kept only for this browser session.");
    } catch {
      setEndpointFeedback("Endpoint settings could not be saved in this browser.");
    }
  }

  function clearEndpointSettings() {
    setProvider({});
    try {
      localStorage.removeItem("satya-provider");
      sessionStorage.removeItem("satya-provider-key");
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
    if (provider.baseUrl) return;
    let alive = true;
    fetch("/api/health")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => {
        if (alive) setGateway(data?.configured ? "online" : "offline");
      })
      .catch(() => {
        if (alive) setGateway("offline");
      });
    return () => {
      alive = false;
    };
  }, [provider.baseUrl]);

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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        newChatRef.current();
      } else if (event.key === "Escape") {
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
        ...(message.file ? { file: message.file } : {}),
        ...(message.createdAt ? { createdAt: message.createdAt } : {}),
      })) as Message[];
    const first =
      saved.find((message) => message.role === "user")?.text.trim() ||
      "New chat";
    setChats((previous) => {
      const existing = previous.find((chat) => chat.id === id);
      return [
        { id, title: existing?.title ?? first.slice(0, 40), updatedAt: Date.now(), messages: saved },
        ...previous.filter((chat) => chat.id !== id),
      ].slice(0, MAX_CHATS);
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
    if (!chat || !window.confirm('Delete "' + chat.title + '"? This cannot be undone.')) return;
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
    if (!window.confirm("Delete all local conversations and saved answers from this browser? This action cannot be undone.")) return;
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
      setStatus("That file is larger than 1 MB.");
      return;
    }
    try {
      const text = await readText(chosen);
      setFile({
        name: chosen.name,
        text:
          text.length > ATTACH_MAX_CHARS
            ? text.slice(0, ATTACH_MAX_CHARS) + "\n…[file truncated]"
            : text,
      });
    } catch {
      setStatus("Could not read that file.");
    }
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
    recognition.lang = navigator.language || "en-IN";
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
    setDrishtiChecking(true);
    setChakshuError("");
    try {
      const health = await ensureDrishtiRuntimeReady();
      const availability = health.video_models?.[chakshuModelId];
      if (!availability?.available) setChakshuError(availability?.reason || "This video tier is not available on the detected hardware.");
    } catch (error) {
      setDrishtiRuntimeHealth(null);
      setChakshuError(error instanceof Error ? error.message : "Could not start the local video companion.");
    } finally {
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
    if (file && nextMode !== "chat" && !window.confirm("Switching workspace will remove the attached text file from the composer. Continue?")) return;
    if (file && nextMode !== "chat") setFile(null);
    setWorkspaceMode(nextMode);
    setReasoningOpen(false);
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
    const withFile = (message: { text: string; file?: { name: string; text: string } }) =>
      message.file
        ? "[Attached file: " + message.file.name + "]\n" + message.file.text + "\n\nQuestion: " + message.text
        : message.text;
    const priorMessages = (historyOverride ?? messages).filter((message) => !message.pending);
    const history: ChatMessage[] = priorMessages
      .filter((message) => !message.error)
      .slice(-12)
      .map((message) => ({
        role: message.role === "ai" ? "assistant" : "user",
        content: withFile(message),
      }));

    const inferenceRoute = mode !== "nano" && provider.baseUrl && provider.model
      ? "custom-compatible"
      : mode !== "nano" && gateway === "online"
        ? "remote-gateway"
        : "browser-local";
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
          remoteInferenceAvailable: inferenceRoute !== "browser-local",
        }) },
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
    const usesLocalModel = !identityAnswer && !(provider.baseUrl && provider.model && mode !== "nano");
    const initialLoadingMessage = identityAnswer
      ? "Preparing a reply…"
      : provider.baseUrl && mode !== "nano"
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
      ...(attached ? { file: attached } : {}),
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
      } else if (provider.baseUrl && provider.model && mode !== "nano") {
        setThinkingActive(true);
        answer = await openAICompatible(provider, modelMessages, mode, controller.signal);
        setThinkingActive(false);
      } else {
        answer = await localWebLLM(
          mode,
          modelMessages,
          (progress, details) => {
            const phase = details?.messagePhase;
            if (phase === "download" && details?.percent !== null && details?.percent !== undefined) {
              const previousPercent = lastDownloadPercentRef.current;
              const activeStage = loadingMessageStageRef.current;
              const alreadyDownloading = activeStage === "download" ||
                activeStage === "download-progress" ||
                activeStage === "download-slow";

              // A new download stage starts its own stall clock. During an
              // active download, only a higher reported percentage resets it.
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
                // Same-percent callbacks must not make a stalled download
                // look active or postpone the long-wait messages.
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
          },
          (partial) => {
            partialAnswerRef.current = partial;
            setMessages((previous) => {
              const next = [...previous];
              const last = next.length - 1;
              if (last >= 0 && next[last].role === "ai") {
                next[last] = { ...next[last], text: partial };
              }
              return next;
            });
          },
          (active) => setThinkingActive(active),
          memoryForTurn,
          controller.signal,
        );
      }

      setMessages((previous) => {
        const next = [...previous];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === "ai") {
          next[last] = { ...next[last], role: "ai", text: answer, pending: false };
        }
        return next;
      });
      setStatus("Ready");
      upsertChat(chatId, [
        ...priorMessages,
        userMessage,
        { role: "ai", text: answer, tierName: selectedTier.name, createdAt: Date.now() },
      ]);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        const stoppedText = partialAnswerRef.current || "Generation stopped.";
        setMessages((previous) => {
          const next = [...previous];
          const last = next.length - 1;
          if (last >= 0 && next[last].role === "ai") {
            next[last] = { ...next[last], text: stoppedText, pending: false, modelProgress: undefined };
          }
          return next;
        });
        if (chatId === activeRef.current) {
          upsertChat(chatId, [
            ...priorMessages,
            userMessage,
            { role: "ai", text: stoppedText, tierName: selectedTier.name, createdAt: Date.now() },
          ]);
        }
        setStatus("Generation stopped.");
        return;
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown model error";
      setMessages((previous) => {
        const next = [...previous];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === "ai") {
          next[last] = {
            ...next[last],
            role: "ai",
            text:
              "I couldn't generate a response: " +
              errorMessage +
              "\n\nCheck the model status or choose a supported inference endpoint in Settings.",
            error: true,
            pending: false,
          };
        }
        return next;
      });
      upsertChat(chatId, [
        ...priorMessages,
        userMessage,
        {
          role: "ai",
          text: "I couldn't generate a response: " + errorMessage,
          error: true,
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

  function regenerateLastAnswer() {
    if (busy || messages.length < 2 || messages[messages.length - 1]?.role !== "ai") return;
    let userIndex = messages.length - 2;
    while (userIndex >= 0 && messages[userIndex].role !== "user") userIndex -= 1;
    if (userIndex < 0) return;
    const question = messages[userIndex];
    setEditingMessageIndex(null);
    void sendMessage(question.text, question.file ?? null, messages.slice(0, userIndex), false);
  }

  function submitEditedMessage(index: number) {
    const original = messages[index];
    if (!original || original.role !== "user" || !editDraft.trim() || busy) return;
    if (index < messages.length - 1 && !window.confirm("Resubmitting this message will remove all later messages and replies from this conversation. Continue?")) return;
    setEditingMessageIndex(null);
    void sendMessage(editDraft, original.file ?? null, messages.slice(0, index), false);
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
              aria-haspopup="listbox"
              aria-expanded={reasoningOpen}
              aria-label={workspaceMode === "image"
                ? "Image model: " + currentDrishti.name
                : workspaceMode === "video"
                  ? "Video model: " + currentChakshu.name
                  : "Reasoning mode: " + current.modeLabel + ", engine " + current.name}
            >
              <span className="reasoning-symbol" aria-hidden="true">
                {workspaceMode === "image" ? <ImageIcon size={18} /> : workspaceMode === "video" ? <VideoIcon size={18} /> : current.symbol}
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
                      <span className="ro-icon ro-symbol" aria-hidden="true">{getSatyaTier(key)!.symbol}</span>
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
                      <span className="ro-icon ro-symbol" aria-hidden="true"><VideoIcon size={19} /></span>
                      <span className="ro-text"><span className="ro-primary"><strong>{model.name}</strong>{model.experimental && <small className="drishti-experimental">FLAGSHIP</small>}</span><small>{model.description}</small></span>
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
                What would you like
                <br />
                <em>to understand?</em>
              </h1>
              <p>Truth-first intelligence for reasoning, research, and creation.</p>
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
            <div className="messages">
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
                    {message.file && (
                      <small className="file-note">
                        <FileText size={12} /> {message.file.name}
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
                <FileText size={16} />
                <span>{file.name}</span>
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
                  if (event.key === "Enter" && !event.shiftKey && preferences.enterToSend && !isCoarsePointer()) {
                    event.preventDefault();
                    if (workspaceMode === "image") {
                      if (!drishtiGenerating && !drishtiStarting) void send();
                    } else if (workspaceMode === "video") {
                      if (!chakshuGenerating && !drishtiStarting) void send();
                    } else if (!busy) void send();
                  }
                }}
                placeholder={workspaceMode === "image" ? "Describe the image you want Drishti to create…" : workspaceMode === "video" ? "Describe the video you want Chakshu to create…" : busy ? status : "Ask anything…"}
                aria-label={workspaceMode === "image" ? "Image prompt for Drishti" : workspaceMode === "video" ? "Video prompt for Chakshu" : "Message SatyaAI"}
              />
              <div className="composer-bottom">
                <div className="composer-tools">
                  {workspaceMode === "chat" && (
                    <>
                      <button
                        className="tool-btn"
                        onClick={() => inputRef.current?.click()}
                        disabled={busy}
                        aria-label="Attach a text file"
                      >
                        <Plus size={17} /> Attach
                      </button>
                      <input
                        ref={inputRef}
                        hidden
                        type="file"
                        accept=".txt,.md,.csv,.json,text/plain"
                        onChange={(event) => {
                          void pickFile(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </>
                  )}
                  
                  
                  <button
                    className={"tool-btn drishti-mode-btn" + (workspaceMode === "image" ? " active" : "")}
                    disabled={busy || drishtiGenerating || chakshuGenerating}
                    onClick={() => { if (busy || drishtiGenerating || chakshuGenerating) return; switchWorkspaceMode(workspaceMode === "image" ? "chat" : "image"); }}
                    aria-pressed={workspaceMode === "image"}
                    aria-label={workspaceMode === "image" ? "Return to Chat mode" : "Switch to Image mode"}
                    title={workspaceMode === "image" ? "Return to Chat" : "Create an image with Drishti"}
                  ><ImageIcon size={16} /> Image <small className="drishti-mode-hint">Desktop · Windows</small></button>
                  <button
                    className={"tool-btn drishti-mode-btn chakshu-mode-btn" + (workspaceMode === "video" ? " active" : "")}
                    disabled={busy || drishtiGenerating || chakshuGenerating}
                    onClick={() => { if (busy || drishtiGenerating || chakshuGenerating) return; switchWorkspaceMode(workspaceMode === "video" ? "chat" : "video"); }}
                    aria-pressed={workspaceMode === "video"}
                    aria-label={workspaceMode === "video" ? "Return to Chat mode" : "Switch to Video mode"}
                    title={workspaceMode === "video" ? "Return to Chat" : "Create a video with Chakshu"}
                  ><VideoIcon size={16} /> Video <small className="drishti-mode-hint">Desktop · Windows</small></button>
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
                      ? chakshuGenerating ? stopChakshuGeneration() : void send()
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
              <button onClick={() => openSettings("privacy")}>Privacy-first · Local memory</button>
            </div>
          </div>
        </section>
      </main>

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
        gateway={gateway}
        endpointFeedback={endpointFeedback}
        saveEndpointSettings={saveEndpointSettings}
        clearEndpointSettings={clearEndpointSettings}
        chats={chats}
        saved={saved}
        exportAllData={exportAllData}
        clearConversationData={clearConversationData}
      />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
