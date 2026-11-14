import React from "react";

// Tiny, dependency-free markdown renderer for chat answers.
// It builds React elements only (never innerHTML), so model output cannot inject HTML or scripts.

const BULLET = /^\s*[-*•]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;
const SPECIAL = /^```|^#{1,4}\s|^\s*[-*•]\s|^\s*\d+[.)]\s/;

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = keyBase + "-" + index++;
    if (token.startsWith("`")) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("**")) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence; may be absent while the answer is still streaming
      blocks.push(
        <pre key={key++}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <div key={key++} className={"md-h md-h" + heading[1].length}>
          {inline(heading[2], "h" + key)}
        </div>,
      );
      i += 1;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line) && !BULLET.test(line);
      const marker = ordered ? ORDERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) {
        items.push(lines[i].replace(marker, ""));
        i += 1;
      }
      const listKey = key++;
      const children = items.map((item, j) => (
        <li key={j}>{inline(item, "l" + listKey + "-" + j)}</li>
      ));
      blocks.push(ordered ? <ol key={listKey}>{children}</ol> : <ul key={listKey}>{children}</ul>);
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const paragraph = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !SPECIAL.test(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    const paraKey = key++;
    blocks.push(<p key={paraKey}>{inline(paragraph.join("\n"), "p" + paraKey)}</p>);
  }

  return <div className="md">{blocks}</div>;
}
