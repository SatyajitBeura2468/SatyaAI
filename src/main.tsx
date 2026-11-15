import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  Bot,
  Check,
  ChevronDown,
  FileText,
  Library,
  Menu,
  Mic,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  User,
  X,
  Zap,
} from "lucide-react";
import "./cosmos.css";
import "./reasoning-profile.css";
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
  type UserMemory,
} from "./ai/identity";
import { loadJSON, saveJSON } from "./storage";
import { Markdown } from "./markdown";

type Mode = "fast" | "smart" | "deep";
type Theme = "light" | "dark";
type Message = {
  role: "user" | "ai";
  text: string;
  pending?: boolean;
  modelProgress?: ModelProgressSnapshot;
  error?: boolean;
  file?: { name: string; text: string };
};
type Chat = { id: string; title: string; updatedAt: number; messages: Message[] };
type SavedAnswer = { id: string; question: string; answer: string; savedAt: number };
type SidebarView = "chats" | "saved";

const thinkingPhrases = [
  "Zara vichaar kar raha hoon…",
  "Mastishk ko kaam par laga raha hoon…",
  "Soch ko sahi disha de raha hoon…",
  "Vichaaron ko jod raha hoon…",
];

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

const modes: Record<Mode, { label: string; desc: string; icon: React.ReactNode }> = {
  fast: {
    label: "Fast",
    desc: "Quick, efficient answers",
    icon: <Zap size={15} />,
  },
  smart: {
    label: "Smart",
    desc: "Balanced reasoning & quality",
    icon: <Sparkles size={15} />,
  },
  deep: {
    label: "Deep Think",
    desc: "Longer, more detailed answers",
    icon: <Bot size={15} />,
  },
};

const CHATS_KEY = "satya-chats-v1";
const SAVED_KEY = "satya-saved-v1";
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

const SUGGESTIONS = [
  { title: "Explain the mole concept", hint: "Chemistry, simply" },
  { title: "Quiz me on organic reactions", hint: "5 quick questions" },
  { title: "Plan my 7-day revision", hint: "Boards + NEET" },
  { title: "Why is the sky blue?", hint: "Curiosity break" },
];
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
  const [mode, setMode] = useState<Mode>("smart");
  const [theme, setTheme] = useState<Theme>(readSavedTheme);
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<Chat[]>(() =>
    loadJSON<Chat[]>(CHATS_KEY, [], isChatList),
  );
  const [activeId, setActiveId] = useState<string>(newId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState(false);
  const [menu, setMenu] = useState(false);
  const [file, setFile] = useState<{ name: string; text: string } | null>(
    null,
  );
  const [listening, setListening] = useState(false);
  const [gateway, setGateway] = useState<"online" | "offline">("offline");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [thinkingActive, setThinkingActive] = useState(false);
  const [thinkingPhraseIndex, setThinkingPhraseIndex] = useState(0);
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

  const [provider] = useState<ProviderSettings>(() => {
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
  const followLatestRef = useRef(true);
  const activeRef = useRef(activeId);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const canSpeak = typeof window !== "undefined" && !!speechCtor();
  activeRef.current = activeId;
  const current = modes[mode];
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
    saveJSON(CHATS_KEY, chats);
  }, [chats]);

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
    if (!thinkingActive) return;

    const interval = window.setInterval(() => {
      setThinkingPhraseIndex((currentIndex) =>
        (currentIndex + 1) % thinkingPhrases.length,
      );
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

  function openSettings() {
    setMemoryNameDraft(memory.name);
    setMemoryNotesDraft(memory.notes);
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
      })) as Message[];
    const first =
      saved.find((message) => message.role === "user")?.text.trim() ||
      "New chat";
    setChats((previous) =>
      [
        { id, title: first.slice(0, 40), updatedAt: Date.now(), messages: saved },
        ...previous.filter((chat) => chat.id !== id),
      ].slice(0, MAX_CHATS),
    );
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

  // Opens a saved answer as a fresh, unsaved conversation. It only becomes a
  // chat in "Conversations" if the user actually sends a follow-up.
  function openSaved(item: SavedAnswer) {
    if (busy) return;
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
    setSidebarView("chats");
    setMenu(false);
    setActiveId(newId());
    setMessages([]);
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

  async function send() {
    const text = query.trim();
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
    const attached = file;
    const withFile = (message: { text: string; file?: { name: string; text: string } }) =>
      message.file
        ? "[Attached file: " + message.file.name + "]\n" + message.file.text + "\n\nQuestion: " + message.text
        : message.text;
    const priorMessages = messages.filter((message) => !message.pending);
    const history: ChatMessage[] = priorMessages
      .filter((message) => !message.error)
      .slice(-12)
      .map((message) => ({
        role: message.role === "ai" ? "assistant" : "user",
        content: withFile(message),
      }));

    const modelMessages: ChatMessage[] = [
      { role: "system", content: buildSatyaSystemPrompt(memoryForTurn) },
      ...history,
      { role: "user", content: attached ? withFile({ text, file: attached }) : text },
    ];

    const identityAnswer = getIdentityReply(text, memoryForTurn);

    setQuery("");
    setFile(null);
    setBusy(true);
    setThinkingActive(false);
    followLatestRef.current = true;
    const initialLoadingMessage = identityAnswer
      ? "Preparing a reply…"
      : provider.baseUrl
        ? "Configured model se jud raha hoon…"
        : "Is device ka model cache dekh raha hoon…";
    setStatus(
      identityAnswer
        ? "Using SatyaAI identity memory…"
        : initialLoadingMessage,
    );
    setMessages((previous) => [
      ...previous,
      { role: "user", text, ...(attached ? { file: attached } : {}) },
      {
        role: "ai",
        text: initialLoadingMessage,
        pending: true,
      },
    ]);

    try {
      let answer: string;

      if (identityAnswer) {
        // Identity questions are answered from the saved app profile, rather
        // than asking a small language model to guess who it is.
        answer = identityAnswer;
      } else if (provider.baseUrl && provider.model) {
        setThinkingActive(true);
        answer = await openAICompatible(provider, modelMessages, mode);
        setThinkingActive(false);
      } else {
        answer = await localWebLLM(
          mode,
          modelMessages,
          (progress, details) => {
            const message = progress || "Model load ho raha hai…";
            setStatus(message);
            setMessages((previous) => {
              const lastIndex = previous.length - 1;
              const last = previous[lastIndex];
              if (lastIndex < 0 || last.role !== "ai" || !last.pending) {
                return previous;
              }
              const next = [...previous];
              next[lastIndex] = {
                ...last,
                text: message,
                modelProgress: details,
              };
              return next;
            });
          },
          (partial) => {
            setThinkingActive(false);
            setMessages((previous) => {
              const next = [...previous];
              const last = next.length - 1;
              if (last >= 0 && next[last].role === "ai") {
                next[last] = { role: "ai", text: partial };
              }
              return next;
            });
          },
          (active) => setThinkingActive(active),
        );
      }

      setMessages((previous) => {
        const next = [...previous];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === "ai") {
          next[last] = { role: "ai", text: answer };
        }
        return next;
      });
      setStatus("Ready");
      upsertChat(chatId, [
        ...priorMessages,
        { role: "user", text, ...(attached ? { file: attached } : {}) },
        { role: "ai", text: answer },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown model error";
      setMessages((previous) => {
        const next = [...previous];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === "ai") {
          next[last] = {
            role: "ai",
            text:
              "I couldn't generate a response: " +
              errorMessage +
              "\n\nCheck the model status or choose a supported inference endpoint in Settings.",
            error: true,
          };
        }
        return next;
      });
      upsertChat(chatId, [
        ...priorMessages,
        { role: "user", text, ...(attached ? { file: attached } : {}) },
        {
          role: "ai",
          text: "I couldn't generate a response: " + errorMessage,
          error: true,
        },
      ]);
      setStatus("Needs attention");
    } finally {
      setThinkingActive(false);
      setBusy(false);
    }
  }

  const appearanceLabel = theme === "dark" ? "Light appearance" : "Dark appearance";

  return (
    <div className={"app-shell" + (busy ? " is-busy" : "")}>
      <div className="cosmos" aria-hidden="true">
        <i className="nebula n1" />
        <i className="nebula n2" />
        <i className="nebula n3" />
        <i className="stars s1" />
        <i className="stars s2" />
        <i className="stars s3" />
        <i className="grain" />
      </div>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
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
              {chats.length === 0 && (
                <div className="empty-history">No conversations yet</div>
              )}
              {chats.map((chat, index) => (
                <button
                  className={"chat-row " + (chat.id === activeId ? "active" : "")}
                  key={chat.id}
                  onClick={() => openChat(chat)}
                  style={{ "--i": index } as React.CSSProperties}
                >
                  <div>
                    <strong>{chat.title}</strong>
                    <small>
                      {preview(chat.messages[chat.messages.length - 1]?.text || "")}
                    </small>
                  </div>
                  <time>{dayLabel(chat.updatedAt)}</time>
                </button>
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
          <button className="side-link" onClick={openSettings}>
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
              aria-label={"Reasoning mode: " + current.label}
            >
              {current.icon}
              <span>Reasoning</span>
              <em className="reasoning-current">{current.label}</em>
              <ChevronDown size={14} className="chev" />
            </button>
            {reasoningOpen && (
              <div className="reasoning-menu" role="listbox" aria-label="Reasoning mode">
                {(Object.keys(modes) as Mode[]).map((key) => (
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
                    <span className="ro-icon">{modes[key].icon}</span>
                    <span className="ro-text">
                      <strong>{modes[key].label}</strong>
                      <small>{modes[key].desc}</small>
                    </span>
                    {mode === key && <Check size={15} className="ro-check" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              onClick={openSettings}
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
          }}
          aria-label="Conversation"
        >
          {messages.length === 0 && (
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
                {SUGGESTIONS.map((item, index) => (
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

          {messages.length > 0 && (
            <div className="messages">
              {messages.map((message, index) => (
                <div
                  className={"message " + message.role + (message.error ? " error" : "")}
                  key={index + "-" + message.text.slice(0, 10)}
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
                      {message.role === "ai" ? "SatyaAI" : "You"}
                    </div>
                    {message.role === "ai" && !message.pending ? (
                      <Markdown text={message.text} />
                    ) : (
                      <p className={message.pending ? "pending-copy" : ""}>
                        {message.text}
                      </p>
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
                          <button
                            className={"msg-action" + (isSaved(index) ? " on" : "")}
                            onClick={() => toggleSaved(index)}
                            aria-pressed={isSaved(index)}
                          >
                            {isSaved(index) ? (
                              <BookmarkCheck size={14} />
                            ) : (
                              <Bookmark size={14} />
                            )}
                            {isSaved(index) ? "Saved" : "Save answer"}
                          </button>
                        </div>
                      )}
                    {message.pending && message.modelProgress && (
                      <div className="model-progress">
                        <div className="model-progress-heading">
                          <span>
                            {message.modelProgress.stage === "download"
                              ? "Model files aa rahi hain"
                              : message.modelProgress.stage === "complete"
                                ? "Model taiyaar"
                                : "Model taiyaar ho raha hai"}
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
                            ? "Model load ki taiyaari chal rahi hai…"
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
                        {thinkingPhrases[thinkingPhraseIndex]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div className="messages-end" aria-hidden="true" />
            </div>
          )}

          <div className="composer-wrap">
            {file && (
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
                disabled={busy}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder={busy ? status : "Ask anything…"}
                aria-label="Message SatyaAI"
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
                </div>
                <button
                  className={
                    "send " +
                    (query.trim() && !busy ? "ready " : "") +
                    (!query.trim() ? "mic " : "") +
                    (listening ? "listening" : "")
                  }
                  disabled={busy || (!query.trim() && !canSpeak)}
                  onClick={() => (query.trim() ? void send() : toggleMic())}
                  aria-label={
                    query.trim()
                      ? "Send message"
                      : listening
                        ? "Stop voice input"
                        : canSpeak
                          ? "Start voice input"
                          : "Voice input isn't supported in this browser"
                  }
                >
                  {busy ? (
                    <span className="spinner" />
                  ) : query.trim() ? (
                    <ArrowUp size={18} />
                  ) : (
                    <Mic size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="composer-meta">
              <span>
                {busy
                  ? status + " Keep this tab open."
                  : "SatyaAI can make mistakes. Verify important information."}
              </span>
              <button onClick={openSettings}>Privacy-first · Local memory</button>
            </div>
          </div>
        </section>
      </main>

      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)}>
          <section
            className="settings"
            onClick={(event) => event.stopPropagation()}
            aria-label="SatyaAI settings"
          >
            <div className="settings-head">
              <div>
                <div className="section-label">Configuration</div>
                <h2>Settings</h2>
              </div>
              <button
                className="icon-btn"
                onClick={() => setSettings(false)}
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            <div className="setting-group">
              <h3>Inference endpoint</h3>
              <p>
                Local inference runs in a background worker. Downloaded model
                files are kept in this browser's model cache, while only the
                active model occupies GPU memory.
              </p>
              <div className="diag-row">
                <span>Current provider</span>
                <strong>
                  {provider.model ||
                    (gateway === "online" ? "Hosted model" : "Browser WebLLM")}
                </strong>
              </div>
              <div className="diag-row">
                <span>Status</span>
                <strong>{busy ? status : capability}</strong>
              </div>
              <div className="diag-row">
                <span>Selected mode</span>
                <strong>{current.label}</strong>
              </div>
            </div>

            <div className="setting-group">
              <h3>Your profile</h3>
              <p>
                Tell SatyaAI what to call you and anything it should remember
                about you. It is stored only in this browser, and you can
                change or clear it at any time.
              </p>
              <div className="avatar-setting">
                <div className="avatar-preview" aria-hidden="true">
                  {avatar ? <img src={avatar} alt="" /> : initials || <User size={22} />}
                </div>
                <div className="avatar-setting-actions">
                  <button
                    className="ghost-btn"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {avatar ? "Change picture" : "Upload picture"}
                  </button>
                  {avatar && (
                    <button className="ghost-btn" onClick={removeAvatar}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {avatarNote && <div className="memory-footnote" role="status">{avatarNote}</div>}
              <label>
                What should SatyaAI call you?
                <input
                  value={memoryNameDraft}
                  onChange={(event) => setMemoryNameDraft(event.target.value)}
                  maxLength={80}
                  placeholder="Your name (optional)"
                  autoComplete="off"
                />
              </label>
              <label>
                About you
                <textarea
                  value={memoryNotesDraft}
                  onChange={(event) => setMemoryNotesDraft(event.target.value)}
                  rows={4}
                  maxLength={3000}
                  placeholder="Your class, goals, or how you like answers explained (optional)"
                />
              </label>
              <div className="setting-actions">
                <button className="save-btn" onClick={saveMemory}>
                  Save profile
                </button>
                <button className="ghost-btn" onClick={clearMemory}>
                  Clear
                </button>
              </div>
              <div className="memory-footnote">
                {memory.name
                  ? "SatyaAI calls you " + memory.name + "."
                  : "No name saved yet."}
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
