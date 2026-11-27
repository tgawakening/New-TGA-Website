"use client";
import { useEffect, useRef, useState } from "react";
import { UPLOAD_MAX_BYTES, uploadFileProblem, type UploadPurpose } from "@/lib/sirah/direct-upload-policy";
import styles from "./direct-upload.module.css";

type Item = { id: string; file: File; status: "uploading" | "done" | "error" | "cancelled"; progress: number; token?: string; error?: string };
export function DirectUpload({ purpose, scope, name = "uploadToken", multiple = false, required = false, onScope }: { purpose: UploadPurpose; scope: string; name?: string; multiple?: boolean; required?: boolean; onScope?: (scope: string) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("");
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const attempts = useRef(new Map<string, string>());
  const root = useRef<HTMLDivElement>(null);
  const current = useRef<Item[]>([]); current.current = items;
  useEffect(() => { const active = requests.current; return () => { for (const request of active.values()) request.abort(); }; }, []);
  useEffect(() => {
    const form = root.current?.closest("form"); if (!form) return;
    const guard = (event: SubmitEvent) => {
      const list = current.current;
      if (list.some(item => item.status !== "done") || (required && !list.some(item => item.status === "done"))) {
        event.preventDefault(); event.stopImmediatePropagation();
        setMessage(list.some(item => item.status === "uploading") ? "Wait for the upload to finish." : required && list.length === 0 && ["registration", "evidence", "legacy-evidence"].includes(purpose) ? "Please attach your payment receipt to continue." : "Complete or remove each upload before continuing.");
      }
    };
    form.addEventListener("submit", guard, true); return () => form.removeEventListener("submit", guard, true);
  }, [required, purpose]);
  function update(id: string, patch: Partial<Item>) { setItems(list => list.map(item => item.id === id ? { ...item, ...patch } : item)); }
  async function start(item: Item) {
    const attempt = crypto.randomUUID();
    attempts.current.set(item.id, attempt);
    update(item.id, { status: "uploading", progress: 0, error: undefined, token: undefined });
    try {
      const response = await fetch("/api/sirah/direct-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, scope, filename: item.file.name, size: item.file.size }) });
      const result = await response.json();
      if (!response.ok || !result.url || !result.token) throw new Error("Could not start upload. Tap retry.");
      if (attempts.current.get(item.id) !== attempt) return;
      const xhr = new XMLHttpRequest(); requests.current.set(item.id, xhr); xhr.open("PUT", result.url);
      xhr.upload.onprogress = event => { if (event.lengthComputable) update(item.id, { progress: Math.round(event.loaded * 100 / event.total) }); };
      xhr.onload = () => { void (async () => {
        if (attempts.current.get(item.id) !== attempt) return;
        requests.current.delete(item.id);
        if (xhr.status < 200 || xhr.status >= 300) { update(item.id, { status: "error", error: "Upload failed - tap retry." }); return; }
        try {
          const completed = await fetch("/api/sirah/direct-upload/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, scope, token: result.token }) });
          const detail = await completed.json();
          if (attempts.current.get(item.id) !== attempt) return;
          if (!completed.ok) { update(item.id, { status: "error", error: detail.error || "Upload failed - tap retry." }); return; }
          update(item.id, { status: "done", progress: 100, token: result.token });
        } catch { if (attempts.current.get(item.id) === attempt) update(item.id, { status: "error", error: "Upload failed - tap retry." }); }
      })(); };
      xhr.onerror = () => { if (attempts.current.get(item.id) !== attempt) return; requests.current.delete(item.id); update(item.id, { status: "error", error: "Upload failed — tap retry." }); };
      xhr.onabort = () => { if (attempts.current.get(item.id) !== attempt) return; requests.current.delete(item.id); update(item.id, { status: "cancelled", error: "Upload cancelled." }); };
      xhr.send(item.file);
    } catch { if (attempts.current.get(item.id) === attempt) update(item.id, { status: "error", error: "Upload failed - tap retry." }); }
  }
  function choose(files: FileList | null) {
    if (!files?.length) return;
    setMessage(""); onScope?.(scope);
    const selected = Array.from(files).slice(0, multiple ? Math.max(0, 5 - current.current.length) : 1);
    if (!multiple) { attempts.current.clear(); for (const request of requests.current.values()) request.abort(); requests.current.clear(); }
    const added = selected.map(file => { const error = uploadFileProblem(purpose, file.name, file.size); return { id: crypto.randomUUID(), file, status: error ? "error" as const : "uploading" as const, progress: 0, error }; });
    const next = multiple ? [...current.current, ...added] : added;
    current.current = next; setItems(next);
    if (files.length > selected.length) setMessage("You can add up to 5 files.");
    for (const item of added) if (!item.error) void start(item);
  }
  return <div ref={root} className={styles.root}>
    <label className={styles.choose}>{multiple ? "Add files" : "Choose file"}<input type="file" accept={purpose === "agreement" ? ".pdf" : purpose === "task" ? ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.doc,.docx" : ".jpg,.jpeg,.png,.webp,.pdf"} multiple={multiple} onChange={event => { choose(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
    <small>Maximum {UPLOAD_MAX_BYTES[purpose] / 1024 / 1024} MB per file{multiple ? "; up to 5 files" : ""}.</small>
    {items.map(item => <div key={item.id} className={styles.item}>
      <span className={styles.filename}>{item.file.name}</span>
      {item.status === "uploading" && <><progress max={100} value={item.progress} aria-label={`Uploading ${item.file.name}`} /><span>{item.progress}%</span><button type="button" onClick={() => { attempts.current.delete(item.id); requests.current.get(item.id)?.abort(); requests.current.delete(item.id); update(item.id, { status: "cancelled", error: "Upload cancelled." }); }}>Cancel</button></>}
      {item.status === "done" && <><span>Uploaded</span><input type="hidden" name={name} value={item.token} /></>}
      {(item.status === "error" || item.status === "cancelled") && <><span role="alert">{item.error}</span>{!uploadFileProblem(purpose, item.file.name, item.file.size) && <button type="button" onClick={() => void start(item)}>Retry</button>}</>}
      {item.status !== "uploading" && <button type="button" onClick={() => setItems(list => list.filter(entry => entry.id !== item.id))}>Remove</button>}
    </div>)}
    {message && <p role="alert">{message}</p>}
  </div>;
}
