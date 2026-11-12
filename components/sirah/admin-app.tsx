"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./admin-app.module.css";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
type AppContext = { visible: boolean; installing: boolean; install: () => Promise<void> };
const Context = createContext<AppContext | null>(null);
const subscribeReady = () => () => {};
function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function subscribeStandalone(listener: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener); window.addEventListener("offline", listener);
  return () => { window.removeEventListener("online", listener); window.removeEventListener("offline", listener); };
}
function platform() {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/i.test(navigator.userAgent) ? "android" : "desktop";
}

export function SirahAppProvider({ children }: { children: React.ReactNode }) {
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  const isStandalone = useSyncExternalStore(subscribeStandalone, standalone, () => false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const device = useSyncExternalStore(subscribeReady, platform, () => "desktop");
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [setupFailed, setSetupFailed] = useState(false);
  const prompt = useRef<InstallPromptEvent | null>(null);
  const help = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const offered = (event: Event) => { event.preventDefault(); prompt.current = event as InstallPromptEvent; };
    const completed = () => { setInstalled(true); prompt.current = null; help.current?.close(); };
    window.addEventListener("beforeinstallprompt", offered);
    window.addEventListener("appinstalled", completed);
    if (window.isSecureContext && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/", updateViaCache: "none" }).catch(() => setSetupFailed(true));
    }
    return () => { window.removeEventListener("beforeinstallprompt", offered); window.removeEventListener("appinstalled", completed); };
  }, []);

  async function install() {
    const offered = prompt.current;
    if (!offered) { help.current?.showModal(); return; }
    prompt.current = null;
    setInstalling(true);
    try {
      await offered.prompt();
      const choice = await offered.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch { help.current?.showModal(); }
    finally { setInstalling(false); }
  }

  return <Context.Provider value={{ visible: ready && !isStandalone && !installed, installing, install }}>
    {!online && <p role="status" className={styles.offline}>You’re offline. Reconnect to view current records or make changes.</p>}
    {children}
    <dialog ref={help} className={styles.help} aria-labelledby="sirah-install-title">
      <h2 id="sirah-install-title">Add Sīrah Admin to your home screen</h2>
      <p>Open your workspace from its own icon. Your usual sign-in and account permissions still apply.</p>
      {setupFailed && <p role="alert">App setup could not finish. Check your connection and reload this page.</p>}
      {device === "ios" ? <ol><li>Open this page in <strong>Safari</strong>.</li><li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li></ol>
        : device === "android" ? <ol><li>Open this page in <strong>Chrome</strong>.</li><li>Tap the <strong>⋮ menu</strong>.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong> and confirm.</li></ol>
          : <p>In Chrome or Edge, use the install icon in the address bar or the browser menu’s <strong>Install app</strong> option.</p>}
      <p className={styles.hint}>If you opened this link inside WhatsApp or another app, open it in your phone’s browser first.</p>
      <form method="dialog"><button className="ga-admin-primary-btn">Got it</button></form>
    </dialog>
  </Context.Provider>;
}

export function SirahAppInstallButton() {
  const app = useContext(Context);
  if (!app?.visible) return null;
  return <button type="button" className={`ga-admin-outline-btn ${styles.install}`} onClick={() => void app.install()} disabled={app.installing}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" /></svg>
    {app.installing ? "Opening install…" : "Install app"}
  </button>;
}
