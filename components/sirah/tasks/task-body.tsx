import type { ReactNode } from "react";
import s from "./tasks.module.css";

/** A small, safe formatting language: paragraphs, line breaks, bold, italics and lists. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> :
    part.startsWith("*") && part.endsWith("*") ? <em key={index}>{part.slice(1, -1)}</em> : part,
  );
}
export function TaskBody({ body }: { body: string }) {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const blocks: { kind: "numbered" | "bullets" | "paragraph"; lines: string[]; start?: number }[] = [];
  let current: typeof blocks[number] | null = null;
  for (const line of lines) {
    if (!line.trim()) { current = null; continue; }
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const kind = numbered ? "numbered" : bullet ? "bullets" : "paragraph";
    if (!current || current.kind !== kind) {
      current = { kind, lines: [], ...(numbered ? { start: Number(numbered[1]) } : {}) };
      blocks.push(current);
    }
    current.lines.push(numbered?.[2] ?? bullet?.[1] ?? line);
  }
  return <div className={s.prose}>{blocks.map((block, index) => {
    if (block.kind === "numbered") return <ol key={index} start={block.start}>{block.lines.map((line, i) => <li key={i}>{inline(line)}</li>)}</ol>;
    if (block.kind === "bullets") return <ul key={index}>{block.lines.map((line, i) => <li key={i}>{inline(line)}</li>)}</ul>;
    return <p key={index}>{block.lines.map((line, i) => <span key={i}>{i > 0 && <br />}{inline(line)}</span>)}</p>;
  })}</div>;
}
