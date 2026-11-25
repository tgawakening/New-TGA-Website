"use client";
import { useRef, useState } from "react";
import { TaskBody } from "./task-body";
import s from "./tasks.module.css";

export function TaskEditor({ initial = "" }: { initial?: string }) {
  const [body, setBody] = useState(initial);
  const input = useRef<HTMLTextAreaElement>(null);
  function wrap(prefix: string, suffix: string, fallback: string) {
    const node = input.current;
    if (!node) return;
    const start = node.selectionStart, end = node.selectionEnd;
    const selected = body.slice(start, end) || fallback;
    const next = body.slice(0, start) + prefix + selected + suffix + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { node.focus(); node.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); });
  }
  return <div className={s.editor}>
    <div className={s.toolbar} aria-label="Formatting">
      <button type="button" onClick={() => wrap("**", "**", "bold text")}><strong>Bold</strong></button>
      <button type="button" onClick={() => wrap("*", "*", "italic text")}><em>Italic</em></button>
      <button type="button" onClick={() => wrap(body && !body.endsWith("\n") ? "\n\n1. " : "1. ", "\n2. ", "First question")}>Numbered list</button>
    </div>
    <label htmlFor="task-body">Instructions</label>
    <textarea id="task-body" ref={input} name="body" required maxLength={50000} rows={10} value={body} onChange={e => setBody(e.target.value)} />
    <p>Separate paragraphs with a blank line. For lists, start each line with 1., 2., and so on.</p>
    <details><summary>Preview instructions</summary><TaskBody body={body} /></details>
  </div>;
}
