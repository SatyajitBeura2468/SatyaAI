import React from "react";
import { EMPTY_CONVERSATION_COPY, EMPTY_SAVED_COPY, EMPTY_SEARCH_COPY, pickOnLoad } from "../ui-copy";
import { resolveTabTitle } from "../tab-identity";

const EMPTY_CONVERSATION_MESSAGE = pickOnLoad(EMPTY_CONVERSATION_COPY);
const EMPTY_SAVED_MESSAGE = pickOnLoad(EMPTY_SAVED_COPY);
const EMPTY_SEARCH_MESSAGE = pickOnLoad(EMPTY_SEARCH_COPY);
import {
  Archive, Check, Download, Library, Moon, Pencil, Plus, Search,
  Settings, Sun, Trash2, User, X, MoreHorizontal,
} from "lucide-react";

export type SidebarChat = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Array<{ role: "user" | "ai"; text: string }>;
};
export type SidebarSavedAnswer = {
  id: string;
  question: string;
  answer: string;
  savedAt: number;
};
type SidebarTheme = "dark" | "light";

type SidebarProps = {
  menu: boolean;
  setMenu: React.Dispatch<React.SetStateAction<boolean>>;
  isMac: boolean;
  startNewChat: () => void;
  sidebarView: "chats" | "saved";
  setSidebarView: React.Dispatch<React.SetStateAction<"chats" | "saved">>;
  chats: SidebarChat[];
  saved: SidebarSavedAnswer[];
  chatSearch: string;
  setChatSearch: React.Dispatch<React.SetStateAction<string>>;
  visibleChats: SidebarChat[];
  editingChatId: string | null;
  setEditingChatId: React.Dispatch<React.SetStateAction<string | null>>;
  chatTitleDraft: string;
  setChatTitleDraft: React.Dispatch<React.SetStateAction<string>>;
  saveChatTitle: (chatId: string) => void;
  openChat: (chat: SidebarChat) => void;
  preview: (text: string) => string;
  dayLabel: (timestamp: number) => string;
  beginRenameChat: (chat: SidebarChat) => void;
  exportChat: (chat: SidebarChat) => void;
  deleteChat: (chatId: string) => void;
  busy: boolean;
  activeId: string;
  openSaved: (item: SidebarSavedAnswer) => void;
  removeSaved: (itemId: string) => void;
  status: string;
  engineTitle: string;
  capability: string;
  openSettings: () => void;
  theme: SidebarTheme;
  setTheme: React.Dispatch<React.SetStateAction<SidebarTheme>>;
  appearanceLabel: string;
};

export function Sidebar(props: SidebarProps) {
  const [chatMenuId, setChatMenuId] = React.useState<string | null>(null);
  const {
    menu, setMenu, isMac, startNewChat, sidebarView, setSidebarView, chats, saved,
    chatSearch, setChatSearch, visibleChats, editingChatId, setEditingChatId,
    chatTitleDraft, setChatTitleDraft, saveChatTitle, openChat, preview, dayLabel,
    beginRenameChat, exportChat, deleteChat, busy, activeId, openSaved, removeSaved,
    status, engineTitle, capability, openSettings, theme, setTheme, appearanceLabel,
  } = props;

  // Keep the browser-tab title in step with the open conversation.
  React.useEffect(() => {
    document.title = resolveTabTitle(chats, activeId);
  }, [chats, activeId, busy]);

  return (
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
                <Plus size={17} /> New chat <span>{isMac ? "⌘⇧O" : "Ctrl ⇧ O"}</span>
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
                      <div className="empty-history">{chats.length ? EMPTY_SEARCH_MESSAGE : EMPTY_CONVERSATION_MESSAGE}</div>
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
                              <button className="icon-btn" onClick={() => setChatMenuId((current) => current === chat.id ? null : chat.id)} aria-label={"More actions for " + chat.title} aria-expanded={chatMenuId === chat.id} title="More actions"><MoreHorizontal size={15} /></button>
                              {chatMenuId === chat.id && (
                                <div className="chat-row-menu" role="menu">
                                  <button role="menuitem" onClick={() => { setChatMenuId(null); beginRenameChat(chat); }}><Pencil size={13} /> Rename</button>
                                  <button role="menuitem" onClick={() => { setChatMenuId(null); exportChat(chat); }}><Download size={13} /> Export</button>
                                  <button role="menuitem" className="danger" onClick={() => { setChatMenuId(null); deleteChat(chat.id); }} disabled={busy && chat.id === activeId}><Trash2 size={13} /> Delete</button>
                                </div>
                              )}
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
                        {EMPTY_SAVED_MESSAGE}
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
                <button className="account-chip" onClick={() => openSettings()}>
                  <span className="account-chip-avatar"><User size={16} /></span>
                  <span><strong>Local profile</strong><small>Account sync · Soon</small></span>
                </button>
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
  );
}
