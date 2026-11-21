import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  Bot,
  ArrowDown,
  Check,
  ChevronDown,
  Copy,
  Cpu,
  Download,
  FileText,
  Image as ImageIcon,
  Library,
  Menu,
  Mic,
  Moon,
  Plus,
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
import { Markdown } from "./markdown";

type Mode = SatyaTierMode;
type WorkspaceMode = "chat" | "image";
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
const DEFAULT_PREFERENCES: AppPreferences = {
  defaultMode: "smart",
  language: "auto",
  responseStyle: "balanced",
  responseLength: "balanced",
  enterToSend: true,
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
      return saved
        ? JSON.parse(saved)
        : {
            baseUrl:
              import.meta.env.VITE_OPENAI_COMPATIBLE_BASE_URL ||
              (import.meta.env.DEV ? "http://127.0.0.1:11434/v1" : undefined),
            model:
              import.meta.env.VITE_OPENAI_COMPATIBLE_MODEL ||
              (import.meta.env.DEV ? "qwen2.5:1.5b" : undefined),
          };
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
    try {
      localStorage.setItem(DRISHTI_MODEL_KEY, drishtiModelId);
    } catch {
      // Model selection remains available for this session if storage is unavailable.
    }
  }, [drishtiModelId]);

  useEffect(() => {
    try { localStorage.setItem("satya-provider", JSON.stringify(provider)); }
    catch { setEndpointFeedback("Endpoint settings could not be saved in this browser."); }
  }, [provider]);

  useEffect(() => {
    saveJSON(SAVED_KEY, saved);
  }, [saved]);

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

  function send() {
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
        <Starfield active={theme === "dark" && !preferences.reduceMotion} busy={busy} />
        <i className="vignette" />
        <i className="grain" />
      </div>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <div className={"side-backdrop" + (menu ? " open" : "")} aria-hidden="true" />
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <div className="brand">
          <div className="brand-mark">S</div>
          <span>SatyaAI</span>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMenu(false)}
            aria-label="Close menu"
          >
            <X size={17} />
          </button>
        </div>

        <button className="new-chat" onClick={startNewChat}>
          <Plus size={17} /> New chat <span>{isMac ? "⌘K" : "Ctrl K"}</span>
        </button>

        <div className="side-section">
          <div className="section-label">Workspace</div>
          <button
            className={"side-link" + (sidebarView === "chats" ? " active" : "")}
            onClick={() => setSidebarView("chats")}
            aria-pressed={sidebarView === "chats"}
          >
            <Library size={16} /> Conversations
            {chats.length > 0 && <span className="side-count">{chats.length}</span>}
          </button>
          <button
            className={"side-link" + (sidebarView === "saved" ? " active" : "")}
            onClick={() => setSidebarView("saved")}
            aria-pressed={sidebarView === "saved"}
          >
            <Archive size={16} /> Saved answers
            {saved.length > 0 && <span className="side-count">{saved.length}</span>}
          </button>
        </div>

        <div className="side-section history">
          {sidebarView === "chats" ? (
            <>
              <div className="section-label">Recent</div>
              <label className="chat-list-search">
                <Search size={14} />
                <input
                  value={chatSearch}
                  onChange={(event) => setChatSearch(event.target.value)}
                  placeholder="Search conversations"
                  aria-label="Search conversations"
                />
                {chatSearch && <button type="button" onClick={() => setChatSearch("")} aria-label="Clear conversation search"><X size={13} /></button>}
              </label>
              {visibleChats.length === 0 && (
                <div className="empty-history">{chats.length ? "No matching conversations" : "No conversations yet"}</div>
              )}
              {visibleChats.map((chat, index) => (
                <div className="chat-entry" key={chat.id} style={{ "--i": index } as React.CSSProperties}>
                  {editingChatId === chat.id ? (
                    <form className="chat-rename" onSubmit={(event) => { event.preventDefault(); saveChatTitle(chat.id); }}>
                      <input value={chatTitleDraft} onChange={(event) => setChatTitleDraft(event.target.value)} maxLength={80} aria-label="Conversation title" autoFocus />
                      <button type="submit" aria-label="Save conversation title"><Check size={14} /></button>
                      <button type="button" onClick={() => setEditingChatId(null)} aria-label="Cancel rename"><X size={14} /></button>
                    </form>
                  ) : (
                    <>
                      <button
                        className={"chat-row " + (chat.id === activeId ? "active" : "")}
                        onClick={() => openChat(chat)}
                        style={{ "--i": index } as React.CSSProperties}
                      >
                        <div>
                          <strong>{chat.title}</strong>
                          <small>{preview(chat.messages[chat.messages.length - 1]?.text || "")}</small>
                        </div>
                        <time>{dayLabel(chat.updatedAt)}</time>
                      </button>
                      <div className="chat-entry-actions">
                        <button className="icon-btn" onClick={() => beginRenameChat(chat)} aria-label={"Rename " + chat.title} title="Rename"><Pencil size={13} /></button>
                        <button className="icon-btn" onClick={() => exportChat(chat)} aria-label={"Export " + chat.title} title="Export"><Download size={13} /></button>
                        <button className="icon-btn danger" onClick={() => deleteChat(chat.id)} disabled={busy && chat.id === activeId} aria-label={"Delete " + chat.title} title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="section-label">Saved</div>
              {saved.length === 0 && (
                <div className="empty-history">
                  Nothing saved yet. Tap “Save answer” under any reply.
                </div>
              )}
              {saved.map((item, index) => (
                <div
                  className="saved-row"
                  key={item.id}
                  style={{ "--i": index } as React.CSSProperties}
                >
                  <button className="chat-row" onClick={() => openSaved(item)}>
                    <div>
                      <strong>{item.question || "Saved answer"}</strong>
                      <small>{preview(item.answer)}</small>
                    </div>
                  </button>
                  <button
                    className="icon-btn saved-remove"
                    onClick={() => removeSaved(item.id)}
                    aria-label="Remove saved answer"
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="local-state">
            <span className="status-dot" />
            <div>
              <strong>{busy ? status : engineTitle}</strong>
              <small>{capability}</small>
            </div>
          </div>
          <button className="side-link" onClick={() => openSettings()}>
            <Settings size={16} /> Settings
          </button>
          <button
            className="side-link"
            onClick={() =>
              setTheme((currentTheme) =>
                currentTheme === "dark" ? "light" : "dark",
              )
            }
            aria-label={appearanceLabel}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {appearanceLabel}
          </button>
        </div>
      </aside>

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
                : "Reasoning mode: " + current.modeLabel + ", engine " + current.name}
            >
              <span className="reasoning-symbol" aria-hidden="true">
                {workspaceMode === "image" ? <ImageIcon size={18} /> : current.symbol}
              </span>
              <span className="reasoning-full-label">{workspaceMode === "image" ? "Image model" : "Reasoning"}</span>
              <em className="reasoning-current">{workspaceMode === "image" ? currentDrishti.selectorLabel : current.modeLabel}</em>
              <ChevronDown size={14} className="chev" />
            </button>
            {reasoningOpen && (
              <div className="reasoning-menu" role="listbox" aria-label={workspaceMode === "image" ? "Drishti image model" : "Reasoning mode"}>
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
                ) : (
                  DRISHTI_MODELS.map((model) => (
                    <button
                      key={model.id}
                      role="option"
                      aria-selected={drishtiModelId === model.id}
                      className={"reasoning-option" + (drishtiModelId === model.id ? " chosen" : "")}
                      onClick={() => {
                        setDrishtiModelId(model.id);
                        setReasoningOpen(false);
                      }}
                    >
                      <span className="ro-icon ro-symbol" aria-hidden="true"><ImageIcon size={19} /></span>
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
            <div className="drishti-studio" aria-label="Drishti image workspace">
              <div className="drishti-studio-mark" aria-hidden="true">
                <ImageIcon size={31} strokeWidth={1.6} />
              </div>
              <div className="drishti-studio-copy">
                <span className="drishti-kicker">SATYAAI · IMAGE STUDIO</span>
                <h1>Create with <em>Drishti.</em></h1>
                <p>Describe the image you have in mind. Your selected Drishti model is ready to be connected to the local image runtime.</p>
              </div>
              <div className="drishti-selected-model">
                <div className="drishti-selected-model-heading">
                  <span>SELECTED MODEL</span>
                  {currentDrishti.experimental && <em className="drishti-experimental">EXPERIMENTAL</em>}
                </div>
                <strong>{currentDrishti.name}</strong>
                <small>{currentDrishti.description}</small>
              </div>
              <div className="drishti-studio-note" role="status">
                The image workspace is in development. No image is generated until the local runtime is connected.
              </div>
            </div>
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
                  if (workspaceMode === "chat" && event.key === "Enter" && !event.shiftKey && preferences.enterToSend) {
                    event.preventDefault();
                    if (!busy) void send();
                  }
                }}
                placeholder={workspaceMode === "image" ? "Describe the image you want Drishti to create…" : busy ? status : "Ask anything…"}
                aria-label={workspaceMode === "image" ? "Image prompt for Drishti" : "Message SatyaAI"}
              />
              <div className="composer-bottom">
                <div className="composer-tools">
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
                  <button
                    className="tool-btn soon"
                    disabled
                    aria-disabled="true"
                    title="Web search is coming soon"
                    aria-label="Search Web (coming soon)"
                  >
                    <Search size={16} /> Search Web <em>Soon</em>
                  </button>
                  <button
                    className="tool-btn soon"
                    disabled
                    aria-disabled="true"
                    title="Deep research is coming soon"
                    aria-label="Research (coming soon)"
                  >
                    <Library size={16} /> Research <em>Soon</em>
                  </button>
                  <button
                    className={"tool-btn drishti-mode-btn" + (workspaceMode === "image" ? " active" : "")}
                    onClick={() => {
                      if (busy) return;
                      setWorkspaceMode((currentMode) => currentMode === "chat" ? "image" : "chat");
                      setReasoningOpen(false);
                    }}
                    disabled={busy}
                    aria-pressed={workspaceMode === "image"}
                    aria-label={workspaceMode === "image" ? "Switch to Chat mode" : "Switch to Image mode"}
                    title={workspaceMode === "image" ? "Return to Chat" : "Create an image with Drishti"}
                  >
                    <ImageIcon size={16} /> Image
                  </button>
                </div>
                <button
                  className={"send " + (busy ? "stop " : query.trim() ? "ready " : "mic ") + (listening ? "listening" : "")}
                  disabled={workspaceMode === "image" || (!busy && (!query.trim() && !canSpeak))}
                  onClick={() => busy ? stopGeneration() : (query.trim() ? void send() : toggleMic())}
                  aria-label={workspaceMode === "image" ? "Drishti image generation is not connected yet" : busy ? "Stop generation" : query.trim() ? "Send message" : listening ? "Stop voice input" : canSpeak ? "Start voice input" : "Voice input isn't supported in this browser"}
                  title={workspaceMode === "image" ? "Drishti image generation is being integrated" : busy ? "Stop generation" : query.trim() ? "Send message" : "Voice input"}
                >
                  {workspaceMode === "image" ? <ImageIcon size={17} /> : busy ? <Square size={17} /> : query.trim() ? <ArrowUp size={18} /> : <Mic size={18} />}
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
                  ? "Drishti image generation is being integrated. Your prompt is not sent to the text model."
                  : busy
                    ? status + " Keep this tab open."
                    : "SatyaAI can make mistakes. Verify important information."}
              </span>
              <button onClick={() => openSettings("privacy")}>Privacy-first · Local memory</button>
            </div>
          </div>
        </section>
      </main>

      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)}>
          <section
            className="settings"
            ref={settingsRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-head">
              <div>
                <div className="section-label">Your workspace</div>
                <h2 id="settings-title">Settings</h2>
                <p>Make SatyaAI work the way you think.</p>
              </div>
              <button className="icon-btn" onClick={() => setSettings(false)} aria-label="Close settings">
                <X size={18} />
              </button>
            </div>
            <div className="settings-layout">
              <nav className="settings-nav" aria-label="Settings sections">
                {([
                  ["general", "General", "Tune the interface"],
                  ["personalization", "Personalization", "Language and response style"],
                  ["models", "Models & inference", "Choose how AI runs"],
                  ["privacy", "Privacy & data", "Your local data"],
                  ["shortcuts", "Keyboard shortcuts", "Work faster"],
                ] as [SettingsTab, string, string][]).map(([key, label, hint]) => (
                  <button key={key} className={settingsTab === key ? "active" : ""} onClick={() => setSettingsTab(key)} aria-current={settingsTab === key ? "page" : undefined}>
                    <strong>{label}</strong><small>{hint}</small>
                  </button>
                ))}
              </nav>
              <div className="settings-content">
                {settingsTab === "general" && (
                  <>
                    <div className="setting-group">
                      <h3>Appearance</h3>
                      <p>Choose a comfortable look for your workspace.</p>
                      <div className="choice-row" role="group" aria-label="Appearance">
                        <button className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")} aria-pressed={theme === "dark"}><Moon size={15} /> Dark</button>
                        <button className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")} aria-pressed={theme === "light"}><Sun size={15} /> Light</button>
                      </div>
                    </div>
                    <div className="setting-group">
                      <h3>Interface density</h3>
                      <label className="setting-toggle"><span><strong>Compact layout</strong><small>Reduce spacing in messages and conversation lists.</small></span><input type="checkbox" checked={preferences.compactMode} onChange={(event) => setPreferences((p) => ({ ...p, compactMode: event.target.checked }))} /></label>
                      <label className="setting-field">Message text size
                        <select value={preferences.fontSize} onChange={(event) => setPreferences((p) => ({ ...p, fontSize: event.target.value as AppPreferences["fontSize"] }))}>
                          <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                        </select>
                      </label>
                    </div>
                    <div className="setting-group">
                      <h3>Accessibility & input</h3>
                      <label className="setting-toggle"><span><strong>Reduce motion</strong><small>Reduce interface animations and transitions.</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => setPreferences((p) => ({ ...p, reduceMotion: event.target.checked }))} /></label>
                      <label className="setting-toggle"><span><strong>Show message timestamps</strong><small>Show the local time beside each message.</small></span><input type="checkbox" checked={preferences.showTimestamps} onChange={(event) => setPreferences((p) => ({ ...p, showTimestamps: event.target.checked }))} /></label>
                      <label className="setting-toggle"><span><strong>Enter sends a message</strong><small>Use Shift + Enter for a new line.</small></span><input type="checkbox" checked={preferences.enterToSend} onChange={(event) => setPreferences((p) => ({ ...p, enterToSend: event.target.checked }))} /></label>
                    </div>
                  </>
                )}
                {settingsTab === "personalization" && (
                  <>
                    <div className="setting-group">
                      <h3>Your profile</h3>
                      <p>Your profile stays in this browser and can be changed or cleared at any time.</p>
                      <div className="avatar-setting">
                        <div className="avatar-preview" aria-hidden="true">{avatar ? <img src={avatar} alt="" /> : initials || <User size={22} />}</div>
                        <div className="avatar-setting-actions">
                          <button className="ghost-btn" onClick={() => avatarInputRef.current?.click()}>{avatar ? "Change picture" : "Upload picture"}</button>
                          {avatar && <button className="ghost-btn" onClick={removeAvatar}>Remove</button>}
                        </div>
                      </div>
                      {avatarNote && <div className="memory-footnote" role="status">{avatarNote}</div>}
                      <label className="setting-field">What should SatyaAI call you?
                        <input value={memoryNameDraft} onChange={(event) => setMemoryNameDraft(event.target.value)} maxLength={80} placeholder="Your name (optional)" autoComplete="off" />
                      </label>
                      <label className="setting-field">About you
                        <textarea value={memoryNotesDraft} onChange={(event) => setMemoryNotesDraft(event.target.value)} rows={4} maxLength={3000} placeholder="Your interests, goals, or how you like answers explained" />
                      </label>
                      <div className="setting-actions">
                        <button className="save-btn" onClick={saveMemory}>Save profile</button>
                        <button className="ghost-btn" onClick={clearMemory}>Clear profile</button>
                      </div>
                      <div className="memory-footnote" role="status">{memory.name ? "SatyaAI calls you " + memory.name + "." : "No name saved yet."}</div>
                    </div>
                    <div className="setting-group">
                      <h3>Response preferences</h3>
                      <p>These preferences guide responses across conversations.</p>
                      <label className="setting-field">Preferred language
                        <select value={preferences.language} onChange={(event) => setPreferences((p) => ({ ...p, language: event.target.value as AppPreferences["language"] }))}>
                          <option value="auto">Automatic</option><option value="English">English</option><option value="Hindi">Hindi</option><option value="Odia">Odia</option>
                        </select>
                      </label>
                      <label className="setting-field">Response style
                        <select value={preferences.responseStyle} onChange={(event) => setPreferences((p) => ({ ...p, responseStyle: event.target.value as AppPreferences["responseStyle"] }))}>
                          <option value="balanced">Balanced</option><option value="friendly">Friendly and conversational</option><option value="formal">Professional and formal</option><option value="academic">Academic and precise</option>
                        </select>
                      </label>
                      <label className="setting-field">Response length
                        <select value={preferences.responseLength} onChange={(event) => setPreferences((p) => ({ ...p, responseLength: event.target.value as AppPreferences["responseLength"] }))}>
                          <option value="short">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option>
                        </select>
                      </label>
                    </div>
                  </>
                )}
                {settingsTab === "models" && (
                  <>
                    <div className="setting-group">
                      <h3>Model selection</h3>
                      <p>Pick the default reasoning mode used when a new chat starts. You can still change it from the header at any time.</p>
                      <label className="setting-field">Default model
                        <select value={preferences.defaultMode} onChange={(event) => setPreferences((p) => ({ ...p, defaultMode: event.target.value as Mode }))}>
                          <option value="nano">Anu · Nano</option><option value="fast">Indu · Fast</option><option value="smart">Dhara · Smart</option><option value="deep">Aditya · Deep Think</option>
                        </select>
                      </label>
                      <div className="diag-row"><span>Currently selected</span><strong>{current.name} · {current.modeLabel}</strong></div>
                      <div className="diag-row"><span>Inference capability</span><strong>{capability}</strong></div>
                      <div className="diag-row"><span>Route</span><strong>{mode === "nano" ? "Browser-local · Anu" : provider.baseUrl && provider.model ? "Custom-compatible endpoint" : gateway === "online" ? "Configured remote gateway" : "Browser-local · " + current.name}</strong></div>
                    </div>
                    <div className="setting-group">
                      <h3>Compatible inference endpoint</h3>
                      <p>Optional. Configure a compatible endpoint for non-Nano modes. The endpoint receives prompts and conversation context. Its privacy terms apply.</p>
                      <label className="setting-field">Endpoint URL
                        <input value={provider.baseUrl || ""} onChange={(event) => setProvider((p) => ({ ...p, baseUrl: event.target.value.trim() || undefined }))} placeholder="https://your-provider.example/v1" inputMode="url" autoComplete="url" />
                      </label>
                      <label className="setting-field">Model identifier
                        <input value={provider.model || ""} onChange={(event) => setProvider((p) => ({ ...p, model: event.target.value.trim() || undefined }))} placeholder="provider/model-name" autoComplete="off" />
                      </label>
                      <label className="setting-field">API key
                        <input type="password" value={provider.apiKey || ""} onChange={(event) => setProvider((p) => ({ ...p, apiKey: event.target.value || undefined }))} placeholder="Optional bearer token" autoComplete="off" />
                      </label>
                      <div className="memory-footnote">The endpoint URL, model name and key are saved in this browser's local storage. Nano always stays on-device.</div>
                      <div className="setting-actions">
                        <button className="save-btn" onClick={() => setEndpointFeedback("Endpoint settings saved on this device.")}>Save endpoint</button>
                        <button className="ghost-btn" onClick={() => { setProvider({}); setEndpointFeedback("Custom endpoint removed."); }}>Clear endpoint</button>
                      </div>
                      {endpointFeedback && <div className="memory-footnote" role="status">{endpointFeedback}</div>}
                    </div>
                  </>
                )}
                {settingsTab === "privacy" && (
                  <>
                    <div className="setting-group">
                      <h3>Local storage</h3>
                      <p>SatyaAI does not require an account. Conversations, saved answers, profile and preferences are stored in this browser. A remote inference endpoint still receives prompts when selected.</p>
                      <label className="setting-toggle"><span><strong>Save conversation history</strong><small>Keep chats on this device between visits.</small></span><input type="checkbox" checked={preferences.saveChatHistory} onChange={(event) => setPreferences((p) => ({ ...p, saveChatHistory: event.target.checked }))} /></label>
                      <div className="diag-row"><span>Conversations saved</span><strong>{chats.length}</strong></div>
                      <div className="diag-row"><span>Saved answers</span><strong>{saved.length}</strong></div>
                    </div>
                    <div className="setting-group">
                      <h3>Export your data</h3>
                      <p>Download conversations, saved answers, profile preferences and appearance settings as a JSON file.</p>
                      <button className="save-btn" onClick={exportAllData}><Download size={15} /> Export all data</button>
                    </div>
                    <div className="setting-group danger-group">
                      <h3>Delete local conversation data</h3>
                      <p>Remove all conversations and saved answers from this browser. This cannot be undone.</p>
                      <button className="danger-btn" onClick={clearConversationData}><Trash2 size={15} /> Delete conversations and saved answers</button>
                    </div>
                  </>
                )}
                {settingsTab === "shortcuts" && (
                  <div className="setting-group">
                    <h3>Keyboard shortcuts</h3>
                    <div className="shortcut-row"><span>New conversation</span><kbd>Ctrl</kbd><kbd>K</kbd></div>
                    <div className="shortcut-row"><span>Send message</span><kbd>Enter</kbd></div>
                    <div className="shortcut-row"><span>Insert new line</span><kbd>Shift</kbd><kbd>Enter</kbd></div>
                    <div className="shortcut-row"><span>Close dialog or menu</span><kbd>Esc</kbd></div>
                    <p>Keyboard shortcuts use the platform's standard modifier where applicable.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
