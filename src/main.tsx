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
import {
  hasWebGPU,
  localWebLLM,
  openAICompatible,
  type ChatMessage,
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

type Mode = "fast" | "smart" | "deep";
type Theme = "light" | "dark";
type Message = { role: "user" | "ai"; text: string; pending?: boolean };
type Chat = { id: number; title: string; preview: string; time: string };

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
    desc: "Maximum reasoning & verification",
    icon: <Bot size={15} />,
  },
};

const seed: Chat[] = [
  {
    id: 1,
    title: "Understanding the quiet sky",
    preview: "Why do stars look different...",
    time: "Today",
  },
  {
    id: 2,
    title: "A better way to learn",
    preview: "Design a study plan for...",
    time: "Yesterday",
  },
  {
    id: 3,
    title: "The future of open models",
    preview: "Compare local inference...",
    time: "Aug 08",
  },
];

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
  const [chats, setChats] = useState(seed);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tools, setTools] = useState({ search: false, research: false });
  const [settings, setSettings] = useState(false);
  const [menu, setMenu] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
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
  const current = modes[mode];

  const capability = useMemo(
    () =>
      provider.baseUrl
        ? "OpenAI-compatible endpoint configured"
        : hasWebGPU()
          ? "WebGPU · browser-local inference"
          : "Configure an inference endpoint",
    [provider.baseUrl],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("satya-theme", theme);
    } catch {
      // Theme still works for this session if storage is unavailable.
    }
  }, [theme]);

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

  function startNewChat() {
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

    const history: ChatMessage[] = messages
      .filter((message) => !message.pending)
      .slice(-12)
      .map((message) => ({
        role: message.role === "ai" ? "assistant" : "user",
        content: message.text,
      }));

    const modelMessages: ChatMessage[] = [
      { role: "system", content: buildSatyaSystemPrompt(memoryForTurn) },
      ...history,
      { role: "user", content: text },
    ];

    const identityAnswer = getIdentityReply(text, memoryForTurn);

    setQuery("");
    setBusy(true);
    followLatestRef.current = true;
    setStatus(
      identityAnswer
        ? "Using SatyaAI identity memory…"
        : provider.baseUrl
          ? "Connecting to the configured model…"
          : "Checking this device's saved model cache…",
    );
    setMessages((previous) => [
      ...previous,
      { role: "user", text },
      {
        role: "ai",
        text: identityAnswer
          ? "Preparing a reply…"
          : "Checking this device's saved model cache…",
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
        answer = await openAICompatible(provider, modelMessages, mode);
      } else {
        answer = await localWebLLM(
          mode,
          modelMessages,
          (progress) => setStatus(progress || "Loading the local model…"),
          (partial) => {
            setMessages((previous) => {
              const next = [...previous];
              const last = next.length - 1;
              if (last >= 0 && next[last].role === "ai") {
                next[last] = { role: "ai", text: partial };
              }
              return next;
            });
          },
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
      setChats((previous) =>
        previous.map((chat) =>
          chat.id === 1
            ? { ...chat, preview: text, time: "Just now" }
            : chat,
        ),
      );
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
          };
        }
        return next;
      });
      setStatus("Needs attention");
    } finally {
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
          {chats.map((chat) => (
            <button className="chat-row" key={chat.id}>
              <div>
                <strong>{chat.title}</strong>
                <small>{chat.preview}</small>
              </div>
              <time>{chat.time}</time>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="local-state">
            <span className="status-dot" />
            <div>
              <strong>{busy ? status : "Inference ready"}</strong>
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
                <span>{file}</span>
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
                  >
                    <Plus size={17} /> Attach
                  </button>
                  <input
                    ref={inputRef}
                    hidden
                    type="file"
                    accept="image/*,.pdf,.txt,.md,.docx"
                    onChange={(event) =>
                      setFile(event.target.files?.[0]?.name || null)
                    }
                  />
                  <button
                    className={"tool-btn " + (tools.search ? "selected" : "")}
                    onClick={() =>
                      setTools((value) => ({ ...value, search: !value.search }))
                    }
                  >
                    <Search size={16} /> Search Web
                  </button>
                  <button
                    className={"tool-btn " + (tools.research ? "selected" : "")}
                    onClick={() =>
                      setTools((value) => ({
                        ...value,
                        research: !value.research,
                      }))
                    }
                  >
                    <Library size={16} /> Research
                  </button>
                </div>
                <button
                  className={"send " + (query.trim() && !busy ? "ready" : "")}
                  disabled={busy || !query.trim()}
                  onClick={() => void send()}
                  aria-label="Send message"
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
