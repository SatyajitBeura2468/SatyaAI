import React from "react";
import { Download, Moon, Sun, Trash2, User, X } from "lucide-react";
import type { ProviderSettings } from "./ai/providers";
import type { UserMemory } from "./ai/identity";

type Mode = "nano" | "fast" | "smart" | "deep";
type SettingsTab = "general" | "personalization" | "models" | "privacy" | "shortcuts";
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

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  settingsRef: React.RefObject<HTMLElement>;
  settingsTab: SettingsTab;
  setSettingsTab: React.Dispatch<React.SetStateAction<SettingsTab>>;
  theme: "dark" | "light";
  setTheme: React.Dispatch<React.SetStateAction<"dark" | "light">>;
  preferences: AppPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
  avatar: string | null;
  initials: string;
  avatarInputRef: React.RefObject<HTMLInputElement>;
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
  gateway: "online" | "offline";
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
    mode, provider, setProvider, gateway, endpointFeedback, saveEndpointSettings,
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
                      <p>Make SatyaAI work the way you think.</p>
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
                            <label className="setting-toggle"><span><strong>Enter sends a message</strong><small>Off by default on touch devices. Use Shift + Enter for a new line.</small></span><input type="checkbox" checked={preferences.enterToSend} onChange={(event) => {
                        if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
                          try { localStorage.setItem("satya-enter-to-send-touch", String(event.target.checked)); } catch { /* keep the session setting */ }
                        }
                        setPreferences((p) => ({ ...p, enterToSend: event.target.checked }));
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
                            <div className="memory-footnote">Endpoint URL and model are saved on this device. The API key remains in memory only and is never written to browser storage. Nano always stays on-device.</div>
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
    </>
  );
}
