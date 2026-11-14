"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./admin-classroom.module.css";

type Ticket = { ok: true; uploadUrl: string; objectKey: string } | { ok: false; error: string };

/** Browsers leave `type` empty for some files; fall back on the extension. */
const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  epub: "application/epub+zip",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
};

const fileType = (file: File) => file.type || BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() || ""] || "";

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type Upload =
  | { state: "idle" }
  | { state: "uploading"; name: string; size: number; percent: number }
  | { state: "done"; name: string; size: number; objectKey: string }
  | { state: "error"; message: string };

/** Where a material comes from: a pasted link (works without JavaScript) or a
 * file sent straight from the browser to Spaces on a presigned PUT. The form
 * then posts only the object key; the server checks the stored object. */
export function MaterialSource({
  idPrefix,
  requestUpload,
  uploadsEnabled,
}: {
  idPrefix: string;
  requestUpload: (input: { kind: string; filename: string; contentType: string; size: number }) => Promise<Ticket>;
  uploadsEnabled: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const [source, setSource] = useState<"LINK" | "UPLOAD">("LINK");
  const [upload, setUpload] = useState<Upload>({ state: "idle" });
  const [blocked, setBlocked] = useState("");

  // The submit button belongs to the surrounding form: hold the submit until
  // the upload has finished, instead of posting a material with no file.
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const guard = (event: SubmitEvent) => {
      if (source !== "UPLOAD" || upload.state === "done") return;
      event.preventDefault();
      setBlocked(upload.state === "uploading" ? "Wait for the upload to finish." : "Choose a file to upload first.");
    };
    form.addEventListener("submit", guard);
    return () => form.removeEventListener("submit", guard);
  }, [source, upload.state]);

  useEffect(() => () => xhr.current?.abort(), []);

  async function start(file: File) {
    setBlocked("");
    xhr.current?.abort();
    const form = root.current?.closest("form");
    const kind = (form?.elements.namedItem("kind") as HTMLInputElement | null)?.value || "";
    const contentType = fileType(file);
    setUpload({ state: "uploading", name: file.name, size: file.size, percent: 0 });
    let ticket: Ticket;
    try {
      ticket = await requestUpload({ kind, filename: file.name, contentType, size: file.size });
    } catch {
      ticket = { ok: false, error: "Could not start the upload. Try again." };
    }
    if (!ticket.ok) return setUpload({ state: "error", message: ticket.error });
    const { objectKey, uploadUrl } = ticket;
    const request = new XMLHttpRequest();
    xhr.current = request;
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        setUpload({ state: "uploading", name: file.name, size: file.size, percent: Math.round((event.loaded / event.total) * 100) });
    };
    request.onload = () =>
      setUpload(
        request.status >= 200 && request.status < 300
          ? { state: "done", name: file.name, size: file.size, objectKey }
          : { state: "error", message: "The storage service refused the file. Try again, or paste a link." },
      );
    request.onerror = () => setUpload({ state: "error", message: "The upload was interrupted. Check the connection and try again." });
    request.send(file);
  }

  const choose = (value: "LINK" | "UPLOAD") => {
    setSource(value);
    setBlocked("");
  };

  return (
    <div ref={root} className={`${styles.field} ${styles.span4}`}>
      <input type="hidden" name="storage" value={source} />
      {uploadsEnabled && (
        <div className={styles.segmented} role="radiogroup" aria-label="Source">
          {(["LINK", "UPLOAD"] as const).map((value) => (
            <label key={value} className={styles.segment}>
              <input
                type="radio"
                name={`${idPrefix}-source`}
                value={value}
                checked={source === value}
                onChange={() => choose(value)}
              />
              <span>{value === "LINK" ? "Paste a link" : "Upload a file"}</span>
            </label>
          ))}
        </div>
      )}

      {source === "LINK" ? (
        <label className={styles.field}>
          <span className={styles.label}>Link</span>
          <input className={styles.input} name="url" type="url" required maxLength={1024} placeholder="https://" />
        </label>
      ) : (
        <div className={styles.field}>
          <span className={styles.label} id={`${idPrefix}-file-label`}>
            File
          </span>
          <div className={styles.fileRow}>
            <label className={styles.secondary}>
              <input
                className={styles.fileInput}
                type="file"
                aria-labelledby={`${idPrefix}-file-label`}
                aria-describedby={`${idPrefix}-file-status`}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void start(file);
                  event.target.value = "";
                }}
              />
              {upload.state === "done" ? "Replace file" : "Choose a file"}
            </label>
            <span id={`${idPrefix}-file-status`} className={styles.fileStatus} aria-live="polite">
              {upload.state === "idle" && "Recordings up to 5 GB; other files up to 200 MB."}
              {upload.state === "uploading" && `Uploading ${upload.name}: ${upload.percent}%`}
              {upload.state === "done" && `${upload.name} uploaded (${formatSize(upload.size)}). Add the material to save it.`}
              {upload.state === "error" && <span className={styles.fileError}>{upload.message}</span>}
            </span>
          </div>
          {upload.state === "uploading" && (
            <span className={styles.progress} aria-hidden="true">
              <span className={styles.progressFill} style={{ width: `${upload.percent}%` }} />
            </span>
          )}
          {upload.state === "done" && (
            <>
              <input type="hidden" name="objectKey" value={upload.objectKey} />
              <input type="hidden" name="originalFilename" value={upload.name} />
            </>
          )}
          <span className={styles.help}>Students open uploaded files through the classroom only; the file is never public.</span>
        </div>
      )}
      {blocked && (
        <p className={styles.fileError} role="alert">
          {blocked}
        </p>
      )}
    </div>
  );
}
