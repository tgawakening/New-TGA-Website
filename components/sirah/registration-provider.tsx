"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SirahRegistrationForm } from "./registration-form";
import styles from "./registration.module.css";
type Selection = { country?: string; plan?: "MONTHLY" | "ANNUAL" };
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
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previous.current = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = old;
      previous.current?.focus();
    };
  }, [open]);
  return (
    <RegistrationContext.Provider
      value={(choice) => {
        setSelection(choice || {});
        setOpen(true);
      }}
    >
      {children}
      {open && (
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
              initialCountry={selection.country}
              initialPlan={selection.plan}
            />
          </div>
        </dialog>
      )}
    </RegistrationContext.Provider>
  );
}
