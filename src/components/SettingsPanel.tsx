import React from "react";
import { Download, Moon, Sun, Trash2, User, X } from "lucide-react";
import type { ProviderSettings } from "../ai/providers";
import type { UserMemory } from "../ai/identity";

type Mode = "nano" | "fast" | "smart" | "deep";
type SettingsTab = "general" | "personalization" | "models" | "privacy" | "shortcuts";
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

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  settingsRef: React.RefObject<HTMLElement | null>;
  settingsTab: SettingsTab;
  setSettingsTab: React.Dispatch<React.SetStateAction<SettingsTab>>;
  theme: "dark" | "light";
  setTheme: React.Dispatch<React.SetStateAction<"dark" | "light">>;
  preferences: AppPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
  avatar: string | null;
  initials: string;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  removeAvatar: () => void;
  avatarNote: string;
  memoryNameDraft: string;
  setMemoryNameDraft: React.Dispatch<React.SetStateAction<string>>;
  memoryNotesDraft: string;
  setMemoryNotesDraft: React.Dispatch<React.SetStateAction<string>>;
  saveMemory: () => void;
  clearMemory: () => void;
  memory: UserMemory;
  current: { name: string; modeLabel: string };
  capability: string;
  mode: Mode;
  provider: ProviderSettings;
  setProvider: React.Dispatch<React.SetStateAction<ProviderSettings>>;
  endpointFeedback: string;
  saveEndpointSettings: () => void;
  clearEndpointSettings: () => void;
  chats: { length: number };
  saved: { length: number };
  exportAllData: () => void;
  clearConversationData: () => void;
};

export function SettingsPanel(props: SettingsPanelProps) {
  const {
    open, onClose, settingsRef, settingsTab, setSettingsTab, theme, setTheme,
    preferences, setPreferences, avatar, initials, avatarInputRef, removeAvatar,
    avatarNote, memoryNameDraft, setMemoryNameDraft, memoryNotesDraft,
    setMemoryNotesDraft, saveMemory, clearMemory, memory, current, capability,
    mode, provider, setProvider, endpointFeedback, saveEndpointSettings,
    clearEndpointSettings, chats, saved, exportAllData, clearConversationData,
  } = props;
  return (
    <>
      {open && (
              <div className="modal-backdrop" onClick={() => onClose()}>
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
                      <p>Tune the voice, the vibe and the little details.</p>
                    </div>
                    <button className="icon-btn" onClick={() => onClose()} aria-label="Close settings">
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
                            <label className="setting-toggle"><span><strong>Compact layout</strong><small>Reduce spacing in messages and conversation lists.</small></span><input type="checkbox" checked={preferences.compactMode} onChange={(event) => setPreferences((p: AppPreferences) => ({ ...p, compactMode: event.target.checked }))} /></label>
                            <label className="setting-field">Message text size
                              <select value={preferences.fontSize} onChange={(event) => setPreferences((p) => ({ ...p, fontSize: event.target.value as AppPreferences["fontSize"] }))}>
                                <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                              </select>
                            </label>
                          </div>
                          <div className="setting-group">
                            <h3>Accessibility & input</h3>
                            <label className="setting-toggle"><span><strong>Reduce motion</strong><small>Reduce interface animations and transitions.</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => setPreferences((p) => ({ ...p, reduceMotion: event.target.checked }))} /></label>
                            <label className="setting-toggle"><span><strong>Show message timestamps</strong><small>Show the local time beside each message.</small></span><input type="checkbox" checked={preferences.showTimestamps} onChange={(event) => setPreferences((p: AppPreferences) => ({ ...p, showTimestamps: event.target.checked }))} /></label>
                            <label className="setting-toggle"><span><strong>Enter sends a message</strong><small>Off by default on touch devices. Use Shift + Enter for a new line.</small></span><input type="checkbox" checked={preferences.enterToSend} onChange={(event) => {
                        if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
                          try { localStorage.setItem("satya-enter-to-send-touch", String(event.target.checked)); } catch { /* keep the session setting */ }
                        }
                        setPreferences((p: AppPreferences) => ({ ...p, enterToSend: event.target.checked }));
                      }} /></label>
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
                          <div className="setting-group">
                            <h3>Personality & humour</h3>
                            <p>Choose the conversational flavour. SatyaAI still adapts to the moment, especially when a topic needs a serious answer.</p>
                            <label className="setting-field">Personality style
                              <select value={preferences.personalityStyle} onChange={(event) => setPreferences((p) => ({ ...p, personalityStyle: event.target.value as AppPreferences["personalityStyle"] }))}>
                                <option value="subtle-wit">Subtle wit</option>
                                <option value="clever-sarcastic">Clever & sarcastic</option>
                                <option value="playfully-chaotic">Playfully chaotic</option>
                                <option value="dry-intelligence">Dry intelligence</option>
                                <option value="warm-companion">Warm companion</option>
                              </select>
                            </label>
                            <label className="setting-field">Humour intensity
                              <select value={preferences.humorIntensity} onChange={(event) => setPreferences((p) => ({ ...p, humorIntensity: event.target.value as AppPreferences["humorIntensity"] }))}>
                                <option value="minimal">Minimal</option>
                                <option value="occasional">Occasional</option>
                                <option value="frequent">Frequent, when the moment fits</option>
                              </select>
                            </label>
                          </div>
                          <div className="setting-group">
                            <h3>Conversation preferences</h3>
                            <p>Small preferences that shape how answers are delivered, not what the facts are.</p>
                            <label className="setting-toggle"><span><strong>More conversational</strong><small>Use natural, everyday language where it fits.</small></span><input type="checkbox" checked={preferences.preferConversational} onChange={(event) => setPreferences((p) => ({ ...p, preferConversational: event.target.checked }))} /></label>
                            <label className="setting-toggle"><span><strong>Prefer direct answers</strong><small>Lead with the answer instead of a long runway.</small></span><input type="checkbox" checked={preferences.preferDirect} onChange={(event) => setPreferences((p) => ({ ...p, preferDirect: event.target.checked }))} /></label>
                            <label className="setting-toggle"><span><strong>Use examples when helpful</strong><small>Add practical examples when they make an idea clearer.</small></span><input type="checkbox" checked={preferences.includeExamples} onChange={(event) => setPreferences((p) => ({ ...p, includeExamples: event.target.checked }))} /></label>
                            <label className="setting-toggle"><span><strong>Skip long introductions</strong><small>Get to the useful part sooner.</small></span><input type="checkbox" checked={preferences.skipLongIntroductions} onChange={(event) => setPreferences((p) => ({ ...p, skipLongIntroductions: event.target.checked }))} /></label>
                            <label className="setting-toggle"><span><strong>Go deeper when useful</strong><small>Expand explanations when a topic deserves more depth.</small></span><input type="checkbox" checked={preferences.expandWhenUseful} onChange={(event) => setPreferences((p) => ({ ...p, expandWhenUseful: event.target.checked }))} /></label>
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
                            <div className="diag-row"><span>Route</span><strong>{mode !== "nano" && provider.baseUrl && provider.model ? "Optional custom endpoint" : "Browser-local · " + current.name}</strong></div>
<div className="memory-footnote">All four SatyaAI tiers run locally by default. Model files are downloaded once and reused from this device. Requires WebGPU.</div>
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
                            <div className="memory-footnote">Endpoint URL and model are saved on this device. The API key remains in memory only and is never written to browser storage. This endpoint is optional; all SatyaAI tiers run locally by default.</div>
                            <div className="setting-actions">
                              <button className="save-btn" onClick={saveEndpointSettings}>Save endpoint</button>
                              <button className="ghost-btn" onClick={clearEndpointSettings}>Clear endpoint</button>
                            </div>
                            {endpointFeedback && <div className="memory-footnote" role="status">{endpointFeedback}</div>}
                          </div>
                        </>
                      )}
                      {settingsTab === "privacy" && (
                        <>
                          <div className="setting-group">
                            <h3>Local storage</h3>
                            <p>SatyaAI currently has no account or cloud sync. Conversations, saved answers, profile and preferences are stored in this browser. Prompts stay on this device for browser-local inference. They are sent to a third-party service only when you explicitly configure and select a compatible endpoint.</p>
                            <p><a href="https://github.com/SatyajitBeura2468/SatyaAI/blob/main/docs/privacy.md" target="_blank" rel="noreferrer">Privacy notice</a> · <a href="https://github.com/SatyajitBeura2468/SatyaAI/blob/main/docs/terms.md" target="_blank" rel="noreferrer">Terms of use</a> · <a href="https://github.com/SatyajitBeura2468/SatyaAI/blob/main/docs/model-notices.md" target="_blank" rel="noreferrer">Model notices</a></p>
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
    </>
  );
}
