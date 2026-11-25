"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "@/components/sirah/admin-classroom.module.css";
import bunny from "./bunny-admin.module.css";

type Source = "bunny" | "link";
type Ticket = { endpoint: string; libraryId: string; videoId: string; expires: number; signature: string };
export type StartBunnyUpload = (title: string) => Promise<{ ok: true; ticket: Ticket } | { ok: false; error: string }>;
type Upload = { state: "idle" } | { state: "uploading"; percent: number; name: string } | { state: "done"; name: string } | { state: "error"; message: string };

/**
 * Source picker for a recording. "Bunny video (protected)" stores only a
 * Bunny video ID, either by uploading a file straight to the Bunny library
 * from this browser (resumable TUS, never through our server) or by pasting
 * an existing video's ID. "Public link (shareable)" stores a plain URL.
 */
export function RecordingSourceFields({
  defaultSource = "bunny",
  defaultUrl = "",
  defaultVideoId = "",
  bunnyReady,
  uploadReady,
  startUpload,
}: {
  defaultSource?: Source;
  defaultUrl?: string;
  defaultVideoId?: string;
  bunnyReady: boolean;
  uploadReady: boolean;
  startUpload: StartBunnyUpload;
}) {
  const [source, setSource] = useState<Source>(defaultSource);
  const [videoId, setVideoId] = useState(defaultVideoId);
  const [upload, setUpload] = useState<Upload>({ state: "idle" });
  const idInput = useRef<HTMLInputElement>(null);
  const abort = useRef<(() => void) | null>(null);
  const name = useId();
  const uploading = upload.state === "uploading";

  // While a file is uploading the form cannot be submitted, and leaving the page asks first.
  useEffect(() => {
    idInput.current?.setCustomValidity(uploading ? "Wait for the video upload to finish." : "");
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading, source]);

  async function send(file: File) {
    const titleField = idInput.current?.form?.elements.namedItem("title");
    const title = titleField instanceof HTMLInputElement && titleField.value.trim() ? titleField.value.trim() : file.name;
    setUpload({ state: "uploading", percent: 0, name: file.name });
    const started = await startUpload(title).catch(() => ({ ok: false as const, error: "Could not start the upload. Please try again." }));
    if (!started.ok) return setUpload({ state: "error", message: started.error });
    const { ticket } = started;
    const { Upload: TusUpload } = await import("tus-js-client");
    const tus = new TusUpload(file, {
      endpoint: ticket.endpoint,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000, 60000, 120000],
      storeFingerprintForResuming: false,
      headers: { AuthorizationSignature: ticket.signature, AuthorizationExpire: String(ticket.expires), VideoId: ticket.videoId, LibraryId: ticket.libraryId },
      metadata: { filetype: file.type || "video/mp4", title },
      onProgress: (sent, total) => setUpload({ state: "uploading", percent: total ? Math.floor((sent / total) * 100) : 0, name: file.name }),
      onError: () => setUpload({ state: "error", message: "The upload stopped. Check your connection and choose the file again." }),
      onSuccess: () => {
        setVideoId(ticket.videoId);
        setUpload({ state: "done", name: file.name });
      },
    });
    abort.current = () => {
      void tus.abort(true);
      setUpload({ state: "idle" });
    };
    tus.start();
  }

  return (
    <>
      <div className={styles.checks} role="radiogroup" aria-label="Recording source">
        <label className={styles.check}>
          <input type="radio" name="source" value="bunny" checked={source === "bunny"} onChange={() => setSource("bunny")} disabled={uploading} />
          Bunny video (protected){bunnyReady ? "" : " — not configured on this server yet"}
        </label>
        <label className={styles.check}>
          <input type="radio" name="source" value="link" checked={source === "link"} onChange={() => setSource("link")} disabled={uploading} />
          Public link (shareable) — anyone with the link can watch
        </label>
      </div>
      {source === "bunny" ? (
        <div className={bunny.box}>
          {uploadReady ? (
            <label className={styles.label} htmlFor={`${name}-file`}>
              Upload a video file
              <input
                id={`${name}-file`}
                className={styles.input}
                type="file"
                accept="video/*"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void send(file);
                  event.target.value = "";
                }}
              />
            </label>
          ) : (
            <p className={bunny.note}>Direct upload needs the Bunny API key on this server. Paste the ID of a video already in the Bunny library instead.</p>
          )}
          {upload.state === "uploading" && (
            <div className={bunny.progress} role="status">
              <progress max={100} value={upload.percent} aria-label={`Uploading ${upload.name}`} />
              <span>Uploading {upload.name}: {upload.percent}% — keep this page open.</span>
              <button type="button" className={styles.secondarySmall} onClick={() => abort.current?.()}>Cancel upload</button>
            </div>
          )}
          {upload.state === "done" && <p className={bunny.note} role="status">Uploaded {upload.name}. Bunny is processing it; save the recording now.</p>}
          {upload.state === "error" && <p className={bunny.error} role="alert">{upload.message}</p>}
          <label className={styles.label} htmlFor={`${name}-bunny`}>
            {uploadReady ? "Bunny video ID (filled in by the upload, or paste one)" : "Bunny video ID"}
            <input
              ref={idInput}
              id={`${name}-bunny`}
              className={styles.input}
              name="bunnyVideoId"
              value={videoId}
              onChange={(event) => setVideoId(event.target.value)}
              placeholder="1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
              maxLength={1024}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
        </div>
      ) : (
        <label className={styles.label} htmlFor={`${name}-url`}>
          Public link
          <input id={`${name}-url`} className={styles.input} type="url" name="url" defaultValue={defaultUrl} placeholder="https://" maxLength={1024} required />
        </label>
      )}
    </>
  );
}

export type AdminBunnyPreviewAction = (resourceId: string) => Promise<{ ok: true; src: string } | { ok: false; error: string }>;

/** Plays a stored Bunny recording for staff via a server-signed embed. */
export function AdminBunnyPreview({ resourceId, title, preview }: { resourceId: string; title: string; preview: AdminBunnyPreviewAction }) {
  const [state, setState] = useState<{ src?: string; error?: string; loading?: boolean } | null>(null);
  if (state?.src)
    return (
      <div className={bunny.player}>
        <iframe src={state.src} title={`Preview: ${title}`} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        <button type="button" className={styles.secondarySmall} onClick={() => setState(null)}>Close preview</button>
      </div>
    );
  return (
    <span className={bunny.previewRow}>
      <button
        type="button"
        className={styles.secondarySmall}
        disabled={state?.loading}
        onClick={async () => {
          setState({ loading: true });
          const result = await preview(resourceId).catch(() => ({ ok: false as const, error: "Preview is unavailable right now." }));
          setState(result.ok && result.src.startsWith("https://iframe.mediadelivery.net/") ? { src: result.src } : { error: result.ok ? "Preview is unavailable right now." : result.error });
        }}
      >
        {state?.loading ? "Loading preview…" : "Preview video"}
      </button>
      {state?.error && <span className={bunny.error} role="alert">{state.error}</span>}
    </span>
  );
}
