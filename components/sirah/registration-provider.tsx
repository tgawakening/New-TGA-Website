"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { RegistrationControls } from "./registration-form";
const SirahRegistrationForm = dynamic(
  () =>
    import("./registration-form").then(
      (module) => module.SirahRegistrationForm,
    ),
  {
    ssr: false,
    loading: () => (
      <p style={{ padding: 28 }} role="status">
        Loading registration…
      </p>
    ),
  },
);
import styles from "./registration.module.css";
type Selection = {
  country?: string;
  plan?: "MONTHLY" | "ANNUAL";
  replacePreferences?: boolean;
};
const RegistrationContext = createContext<(selection?: Selection) => void>(
  () => {},
);
export const useSirahRegistration = () => useContext(RegistrationContext);
export function SirahRegistrationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<Selection>({});
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const lastSelection = useRef<Selection>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const controls = useRef<RegistrationControls>(null);
  useEffect(() => {
    if (!open) return;
    previous.current = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const viewport = window.visualViewport;
    const measure = () => {
      dialog.current?.style.setProperty(
        "--sirah-viewport-height",
        `${viewport?.height || window.innerHeight}px`,
      );
      dialog.current?.style.setProperty(
        "--sirah-viewport-top",
        `${viewport?.offsetTop || 0}px`,
      );
    };
    const resize = () => {
      measure();
      requestAnimationFrame(() => {
        const target = document.activeElement;
        if (target instanceof HTMLElement && dialog.current?.contains(target))
          target.scrollIntoView({ block: "nearest" });
      });
    };
    measure();
    dialog.current?.showModal();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", measure);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", measure);
      document.body.style.overflow = old;
      previous.current?.focus();
    };
  }, [open]);
  return (
    <RegistrationContext.Provider
      value={(choice) => {
        const next = choice || {};
        const changes: Selection = {};
        if (
          next.replacePreferences ||
          next.country !== lastSelection.current.country
        )
          changes.country = next.country;
        if (
          next.plan &&
          (next.replacePreferences || next.plan !== lastSelection.current.plan)
        )
          changes.plan = next.plan;
        controls.current?.setPreferences(changes);
        lastSelection.current = next;
        setSelection(next);
        setMounted(true);
        setOpen(true);
      }}
    >
      {children}
      {mounted && (
        <dialog
          ref={dialog}
          className={styles.dialog}
          aria-label="Register for Sīrah Beyond Chronology"
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) dialog.current?.close();
          }}
        >
          <div className={styles.dialogInner}>
            <button
              className={styles.close}
              type="button"
              aria-label="Close registration"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
            <SirahRegistrationForm
              controlRef={controls}
              initialCountry={selection.country}
              initialPlan={selection.plan}
              requireBillingCountry={Boolean(
                selection.country && !/^[A-Z]{2}$/.test(selection.country),
              )}
            />
          </div>
        </dialog>
      )}
    </RegistrationContext.Provider>
  );
}
