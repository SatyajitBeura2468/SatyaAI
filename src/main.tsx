import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  ArrowUp,
  Bot,
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
  X,
  Zap,
} from "lucide-react";
import "./styles.css";
import "./layout-fixes.css";
import "./motion.css";
import "./premium-polish.css";
import "./launch-fixes.css";
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
  sanitizeMemory,
  type UserMemory,
} from "./ai/identity";
import { loadJSON, saveJSON } from "./storage";

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

function readSavedMemory(): UserMemory {
  try {
    const saved = localStorage.getItem("satya-memory");
    return saved ? sanitizeMemory(JSON.parse(saved)) : DEFAULT_USER_MEMORY;
  } catch {
    return DEFAULT_USER_MEMORY;
  }
}

function readSavedTheme(): Theme {
  try {
    return localStorage.getItem("satya-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
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
  const conversationRef = useRef<HTMLElement>(null);
  const followLatestRef = useRef(true);
  const activeRef = useRef(activeId);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const canSpeak = typeof window !== "undefined" && !!speechCtor();
  activeRef.current = activeId;
  const current = modes[mode];

  const capability = useMemo(
    () =>
      provider.baseUrl
        ? "OpenAI-compatible endpoint configured"
        : hasWebGPU()
          ? "WebGPU · browser-local inference"
          : "This browser has no WebGPU, so the on-device model cannot run",
    [provider.baseUrl],
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
    container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
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
      setStatus("Personal memory saved on this device.");
    } catch {
      setStatus("Memory could not be saved in this browser.");
    }
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
    setMenu(false);
    setActiveId(newId());
    setMessages([]);
    setStatus("Ready");
    setFile(null);
    followLatestRef.current = true;
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
    <div className="app-shell">
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
          <Plus size={17} /> New chat <span>⌘ K</span>
        </button>

        <div className="side-section">
          <div className="section-label">Workspace</div>
          <button className="side-link active">
            <Library size={16} /> Conversations
          </button>
          <button className="side-link">
            <Archive size={16} /> Saved answers
          </button>
        </div>

        <div className="side-section history">
          <div className="section-label">Recent</div>
          {chats.length === 0 && (
            <div className="empty-history">No conversations yet</div>
          )}
          {chats.map((chat) => (
            <button
              className={"chat-row " + (chat.id === activeId ? "active" : "")}
              key={chat.id}
              onClick={() => openChat(chat)}
            >
              <div>
                <strong>{chat.title}</strong>
                <small>
                  {(chat.messages[chat.messages.length - 1]?.text || "").slice(0, 60)}
                </small>
              </div>
              <time>{dayLabel(chat.updatedAt)}</time>
            </button>
          ))}
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
          <div className="crumb">
            Conversations <ChevronDown size={14} />
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              onClick={openSettings}
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            <div className="avatar">SB</div>
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
          </div>

          {messages.length > 0 && (
            <div className="messages">
              {messages.map((message, index) => (
                <div
                  className={"message " + message.role}
                  key={index + "-" + message.text.slice(0, 10)}
                >
                  <div className="message-avatar">
                    {message.role === "ai" ? <Sparkles size={15} /> : "SB"}
                  </div>
                  <div className="message-content">
                    <div className="message-role">
                      {message.role === "ai" ? "SatyaAI" : "You"}
                    </div>
                    <p className={message.pending ? "pending-copy" : ""}>
                      {message.text}
                    </p>
                    {message.file && (
                      <small className="file-note">
                        <FileText size={12} /> {message.file.name}
                      </small>
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

            <div className="composer">
              <textarea
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

        <div className="mode-dock">
          <div className="mode-label">Reasoning mode</div>
          <div className="mode-switch">
            {(Object.keys(modes) as Mode[]).map((key) => (
              <button
                key={key}
                className={mode === key ? "chosen" : ""}
                onClick={() => setMode(key)}
              >
                {modes[key].icon}
                <span>{modes[key].label}</span>
              </button>
            ))}
          </div>
          <div className="mode-description">{current.desc}</div>
        </div>
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
                <strong>{provider.model || "Browser WebLLM"}</strong>
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
              <h3>SatyaAI memory</h3>
              <p>
                This profile helps SatyaAI remember who it was built for and
                who created this application. It is stored locally in this
                browser and can be edited or replaced at any time.
              </p>
              <label>
                Primary user
                <input
                  value={memoryNameDraft}
                  onChange={(event) => setMemoryNameDraft(event.target.value)}
                  maxLength={80}
                  placeholder="Your name"
                />
              </label>
              <label>
                Personal memory and context
                <textarea
                  value={memoryNotesDraft}
                  onChange={(event) => setMemoryNotesDraft(event.target.value)}
                  rows={4}
                  maxLength={3000}
                  placeholder="What should SatyaAI remember?"
                />
              </label>
              <button className="save-btn" onClick={saveMemory}>
                Save memory on this device
              </button>
              <div className="memory-footnote">
                Current profile: {memory.name}
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
