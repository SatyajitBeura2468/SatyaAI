import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Archive, ArrowUp, Bot, ChevronDown, FileText, Library, Menu, Mic, Plus, Search, Settings, Sparkles, Sun, X, Zap } from 'lucide-react';
import './styles.css';
import { hasWebGPU, localWebLLM, openAICompatible, type ProviderSettings } from './ai/providers';

type Mode = 'fast' | 'smart' | 'deep';
type Message = { role: 'user' | 'ai'; text: string; pending?: boolean };
type Chat = { id: number; title: string; preview: string; time: string };
const modes: Record<Mode, { label: string; desc: string; icon: React.ReactNode }> = { fast: { label: 'Fast', desc: 'Quick, efficient answers', icon: <Zap size={15} /> }, smart: { label: 'Smart', desc: 'Balanced reasoning & quality', icon: <Sparkles size={15} /> }, deep: { label: 'Deep Think', desc: 'Maximum reasoning & verification', icon: <Bot size={15} /> } };
const seed: Chat[] = [{ id: 1, title: 'Understanding the quiet sky', preview: 'Why do stars look different...', time: 'Today' }, { id: 2, title: 'A better way to learn', preview: 'Design a study plan for...', time: 'Yesterday' }, { id: 3, title: 'The future of open models', preview: 'Compare local inference...', time: 'Aug 08' }];

function App() {
  const [mode, setMode] = useState<Mode>('smart');
  const [query, setQuery] = useState('');
  const [chats, setChats] = useState(seed);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tools, setTools] = useState({ search: false, research: false });
  const [settings, setSettings] = useState(false);
  const [menu, setMenu] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [provider] = useState<ProviderSettings>(() => {
    const saved = localStorage.getItem('satya-provider');
    return saved ? JSON.parse(saved) : { baseUrl: import.meta.env.VITE_OPENAI_COMPATIBLE_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:11434/v1' : undefined), model: import.meta.env.VITE_OPENAI_COMPATIBLE_MODEL || (import.meta.env.DEV ? 'qwen2.5:1.5b' : undefined) };
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const current = modes[mode];
  const capability = useMemo(() => provider.baseUrl ? 'Ollama-compatible endpoint configured' : hasWebGPU() ? 'WebGPU model available' : 'Configure an inference endpoint', [provider.baseUrl]);

  async function send() {
    const text = query.trim();
    if (!text || busy) return;
    setQuery(''); setBusy(true); setStatus(provider.baseUrl ? 'Generating with Ollama…' : 'Preparing the browser model…');
    setMessages(prev => [...prev, { role: 'user', text }, { role: 'ai', text: provider.baseUrl ? 'Generating…' : 'Preparing the model for the first response. This can take a few minutes while the browser downloads the model.', pending: true }]);
    try {
      const answer = provider.baseUrl && provider.model ? await openAICompatible(provider, [{ role: 'user', content: text }], mode) : await localWebLLM(mode, text, progress => setStatus(progress || 'Loading browser model…'));
      setMessages(prev => { const next = [...prev]; const last = next.length - 1; next[last] = { role: 'ai', text: answer }; return next; });
      setStatus('Ready'); setChats(prev => prev.map(chat => chat.id === 1 ? { ...chat, preview: text, time: 'Just now' } : chat));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown model error';
      setMessages(prev => { const next = [...prev]; const last = next.length - 1; next[last] = { role: 'ai', text: `I couldn't generate a response: ${message}\n\nCheck that Ollama is running locally, or use Settings to configure a reachable endpoint.` }; return next; });
      setStatus('Needs attention');
    } finally { setBusy(false); }
  }

  return <div className="app-shell"><aside className={`sidebar ${menu ? 'open' : ''}`}><div className="brand"><div className="brand-mark">S</div><span>SatyaAI</span><button className="icon-btn mobile-close" onClick={() => setMenu(false)}><X size={17} /></button></div><button className="new-chat" onClick={() => { setMessages([]); setStatus('Ready'); }}><Plus size={17} /> New chat <span>⌘ K</span></button><div className="side-section"><div className="section-label">Workspace</div><button className="side-link active"><Library size={16} /> Conversations</button><button className="side-link"><Archive size={16} /> Saved answers</button></div><div className="side-section history"><div className="section-label">Recent</div>{chats.map(chat => <button className="chat-row" key={chat.id}><div><strong>{chat.title}</strong><small>{chat.preview}</small></div><time>{chat.time}</time></button>)}</div><div className="sidebar-bottom"><div className="local-state"><span className="status-dot" /><div><strong>{busy ? status : 'Inference ready'}</strong><small>{capability}</small></div></div><button className="side-link" onClick={() => setSettings(true)}><Settings size={16} /> Settings</button><button className="side-link"><Sun size={16} /> Appearance</button></div></aside><main className="main"><header className="topbar"><button className="icon-btn menu-btn" onClick={() => setMenu(true)}><Menu size={19} /></button><div className="crumb">Conversations <ChevronDown size={14} /></div><div className="top-actions"><button className="icon-btn" onClick={() => setSettings(true)}><Settings size={18} /></button><div className="avatar">SB</div></div></header><section className="conversation"><div className="hero"><div className="orb"><span /><span /><span /></div><h1>What would you like<br /><em>to understand?</em></h1><p>Truth-first intelligence for reasoning, research, and creation.</p></div>{messages.length > 0 && <div className="messages">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${index}-${message.text.slice(0, 10)}`}><div className="message-avatar">{message.role === 'ai' ? <Sparkles size={15} /> : 'SB'}</div><div><div className="message-role">{message.role === 'ai' ? 'SatyaAI' : 'You'}</div><p className={message.pending ? 'pending-copy' : ''}>{message.text}</p></div></div>)}</div>}<div className="composer-wrap">{file && <div className="attachment"><FileText size={16} /><span>{file}</span><button onClick={() => setFile(null)}><X size={14} /></button></div>}<div className="composer"><textarea value={query} disabled={busy} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={busy ? status : 'Ask anything…'} aria-label="Message SatyaAI" /><div className="composer-bottom"><div className="composer-tools"><button className="tool-btn" onClick={() => inputRef.current?.click()} disabled={busy}><Plus size={17} /> Attach</button><input ref={inputRef} hidden type="file" accept="image/*,.pdf,.txt,.md,.docx" onChange={event => setFile(event.target.files?.[0]?.name || null)} /><button className={`tool-btn ${tools.search ? 'selected' : ''}`} onClick={() => setTools(value => ({ ...value, search: !value.search }))}><Search size={16} /> Search Web</button><button className={`tool-btn ${tools.research ? 'selected' : ''}`} onClick={() => setTools(value => ({ ...value, research: !value.research }))}><Library size={16} /> Research</button></div><button className={`send ${query.trim() && !busy ? 'ready' : ''}`} disabled={busy || !query.trim()} onClick={() => void send()} aria-label="Send message">{busy ? <span className="spinner" /> : query.trim() ? <ArrowUp size={18} /> : <Mic size={18} />}</button></div></div><div className="composer-meta"><span>{busy ? `${status} Keep this tab open.` : 'SatyaAI can make mistakes. Verify important information.'}</span><button onClick={() => setSettings(true)}>Privacy-first · Local storage</button></div></div></section><div className="mode-dock"><div className="mode-label">Reasoning mode</div><div className="mode-switch">{(Object.keys(modes) as Mode[]).map(key => <button key={key} className={mode === key ? 'chosen' : ''} onClick={() => setMode(key)}>{modes[key].icon}<span>{modes[key].label}</span></button>)}</div><div className="mode-description">{current.desc}</div></div></main>{settings && <div className="modal-backdrop" onClick={() => setSettings(false)}><section className="settings" onClick={event => event.stopPropagation()}><div className="settings-head"><div><div className="section-label">Configuration</div><h2>Settings</h2></div><button className="icon-btn" onClick={() => setSettings(false)}><X size={18} /></button></div><div className="setting-group"><h3>Inference endpoint</h3><p>Local development connects to Ollama. Production needs a reachable remote endpoint configured server-side.</p><div className="diag-row"><span>Current model</span><strong>{provider.model || 'Browser WebLLM'}</strong></div><div className="diag-row"><span>Status</span><strong>{busy ? status : capability}</strong></div></div></section></div>}</div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
