import React, { useEffect, useRef } from "react";
import { Copy } from "lucide-react";

declare global {
  interface Window {
    MathJax?: {
      startup?: { promise?: Promise<void> };
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      typesetClear?: (elements?: HTMLElement[]) => void;
    };
    hljs?: { highlightElement: (element: HTMLElement) => void };
  }
}

const FENCE = String.fromCharCode(96);
const BULLET = /^\s*[-*+•]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;
const SPECIAL = /^(?:\x60{3}|#{1,6}\s|\s*>|\s*[-*+•]\s|\s*\d+[.)]\s|\s*\|.*\|\s*$)/;

function safeHref(value: string): string | null {
  const href = value.trim();
  return /^(https?:\/\/|mailto:|\/|#)/i.test(href) ? href : null;
}

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /(\x60[^\x60\n]+\x60|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|\[[^\]]+\]\((?:https?:\/\/|mailto:|\/|#)[^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = keyBase + "-" + index++;
    if (token.startsWith(FENCE)) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("**")) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) out.push(<em key={key}>{token.slice(1, -1)}</em>);
    else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link ? safeHref(link[2]) : null;
      out.push(href && link
        ? <a key={key} href={href} target={/^https?:/i.test(href) ? "_blank" : undefined} rel={/^https?:/i.test(href) ? "noreferrer" : undefined}>{link[1]}</a>
        : token);
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}
function isTableRule(line: string): boolean {
  const values = tableCells(line);
  return values.length > 0 && values.every((cell) => /^:?-{3,}:?$/.test(cell));
}
function languageName(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_+-]/g, "");
  const known: Record<string, string> = {
    js: "javascript", ts: "typescript", py: "python", sh: "bash",
    yml: "yaml", md: "markdown", jsx: "jsx", tsx: "tsx",
  };
  return known[normalized] || normalized;
}

export function Markdown({ text, onCopy }: { text: string; onCopy?: (code: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    const typeset = async () => {
      try {
        await window.MathJax?.startup?.promise;
        if (!cancelled && rootRef.current) await window.MathJax?.typesetPromise?.([root]);
      } catch { /* Keep raw TeX visible when the optional renderer is offline. */ }
    };
    const highlight = () => {
      if (cancelled || !rootRef.current || !window.hljs) return;
      rootRef.current.querySelectorAll<HTMLElement>("pre code[class*='language-']").forEach((node) => {
        if (!node.dataset.highlighted) {
          try { window.hljs?.highlightElement(node); } catch { /* Plain text remains readable. */ }
        }
      });
    };
    void typeset();
    highlight();
    window.addEventListener("satya-mathjax-ready", typeset);
    window.addEventListener("satya-highlight-ready", highlight);
    return () => {
      cancelled = true;
      window.removeEventListener("satya-mathjax-ready", typeset);
      window.removeEventListener("satya-highlight-ready", highlight);
      if (rootRef.current) window.MathJax?.typesetClear?.([rootRef.current]);
    };
  }, [text]);

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith(FENCE.repeat(3))) {
      const language = languageName(line.slice(3).trim().split(/\s+/)[0] || "");
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(FENCE.repeat(3))) code.push(lines[i++]);
      if (i < lines.length) i++;
      const codeText = code.join("\n");
      const codeKey = key++;
      blocks.push(
        <div key={codeKey} className="code-block">
          <div className="code-toolbar">
            <span>{language || "Plain text"}</span>
            <button type="button" onClick={() => onCopy?.(codeText)} aria-label="Copy code block">
              <Copy size={13} /> Copy
            </button>
          </div>
          <pre><code className={language ? "language-" + language : undefined}>{codeText}</code></pre>
        </div>,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length, 6);
      const Tag = ("h" + level) as React.ElementType;
      blocks.push(React.createElement(Tag, { key: key++, className: "md-h md-h" + level }, ...inline(heading[2], "heading" + key)));
      i++;
      continue;
    }

    if (i + 1 < lines.length && line.includes("|") && isTableRule(lines[i + 1])) {
      const headers = tableCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(tableCells(lines[i++]));
      blocks.push(
        <div className="md-table-wrap" key={key++}>
          <table className="md-table">
            <thead><tr>{headers.map((cell, column) => <th key={column}>{inline(cell, "th" + column)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{headers.map((_, column) => <td key={column}>{inline(row[column] || "", "td" + rowIndex + "-" + column)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*> ?/, ""));
      blocks.push(<blockquote key={key++}><Markdown text={quote.join("\n")} onCopy={onCopy} /></blockquote>);
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line) && !BULLET.test(line);
      const marker = ordered ? ORDERED : BULLET;
      const items: React.ReactNode[] = [];
      const indent = (line.match(/^\s*/) || [""])[0].length;
      while (i < lines.length) {
        const current = lines[i];
        if ((current.match(/^\s*/) || [""])[0].length !== indent || !marker.test(current)) break;
        items.push(<li key={items.length}>{inline(current.replace(marker, ""), "list" + key + "-" + items.length)}</li>);
        i++;
      }
      const listKey = key++;
      blocks.push(ordered ? <ol key={listKey}>{items}</ol> : <ul key={listKey}>{items}</ul>);
      continue;
    }

    if (!line.trim()) { i++; continue; }
    const paragraph = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !SPECIAL.test(lines[i])) paragraph.push(lines[i++]);
    const paragraphKey = key++;
    blocks.push(<p key={paragraphKey}>{inline(paragraph.join("\n"), "p" + paragraphKey)}</p>);
  }

  return <div className="md" ref={rootRef}>{blocks}</div>;
}
