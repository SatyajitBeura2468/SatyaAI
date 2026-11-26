// Browser-tab identity for SatyaAI.
// The tab icon is the real SatyaAI logo and never changes. The tab title is the
// app name on the home screen, and the conversation name once a chat is open.

export const APP_TAB_TITLE = "SatyaAI (Private Truth-first AI)";

// New URL (note the ?v=) so browsers drop the old cached "S" favicon.
const APP_ICON_HREF = "/icons/satya-icon.svg?v=2";

// Replace every icon link with the logo once at startup. Re-adding the link
// makes the browser fetch the icon again instead of reusing a stale one.
function applyAppIcon() {
  if (typeof document === "undefined") return;
  document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]').forEach((node) => node.remove());
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = APP_ICON_HREF;
  document.head.appendChild(link);
}
applyAppIcon();

type TabChat = { id: string; title: string };

function shortTitle(text: string): string {
  const clean = text.replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > 58 ? clean.slice(0, 55).trimEnd() + "…" : clean;
}

export function resolveTabTitle(chats: TabChat[], activeId: string): string {
  // A saved conversation (including renamed ones) shows its own name.
  const saved = chats.find((chat) => chat.id === activeId)?.title.trim();
  if (saved) return saved;
  if (typeof document === "undefined") return APP_TAB_TITLE;

  // A brand-new chat that is still answering, or an opened saved answer, is
  // not in the history list yet: name it after its first message on screen.
  const first = document.querySelector<HTMLElement>(".messages .message.user .message-content > p");
  const fromScreen = shortTitle(first?.textContent ?? "");
  return fromScreen || APP_TAB_TITLE;
}
