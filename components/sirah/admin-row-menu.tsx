"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./admin-row-menu.module.css";

export type RowMenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  tone?: "default" | "primary" | "danger";
};

/**
 * Row "…" menu for the records table. Presentation only: each item calls the
 * same handler its old inline button did.
 *
 * Keyboard: Enter / Space / ArrowDown open it on the first item, ArrowUp on
 * the last; arrows, Home and End move; Escape closes and returns focus; Tab
 * closes. Choosing an item returns focus to the trigger first, so a dialog
 * the item opens hands focus back to this row when it closes.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const startAt = useRef<"first" | "last">("first");
  const id = useId();

  const entries = () =>
    Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    const list = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    (startAt.current === "last" ? list[list.length - 1] : list[0])?.focus();
    const away = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  if (!items.length) return null;

  function show(at: "first" | "last") {
    const rect = trigger.current?.getBoundingClientRect();
    const needed = items.length * 38 + 16;
    setUp(!!rect && window.innerHeight - rect.bottom < needed && rect.top > needed);
    startAt.current = at;
    setOpen(true);
  }

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }

  function onTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show(event.key === "ArrowUp" ? "last" : "first");
    }
  }

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const list = entries();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (index: number) => list[(index + list.length) % list.length]?.focus();
    if (event.key === "ArrowDown") move(at + 1);
    else if (event.key === "ArrowUp") move(at - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(list.length - 1);
    else if (event.key === "Escape") close(true);
    else if (event.key === "Tab") {
      setOpen(false);
      return;
    } else return;
    event.preventDefault();
  }

  return (
    <div ref={wrap} className={styles.wrap}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={label}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(false) : show("first"))}
        onKeyDown={onTriggerKey}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="4.5" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="15.5" cy="10" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          className={`${styles.menu}${up ? ` ${styles.up}` : ""}`}
          onKeyDown={onMenuKey}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`${styles.item}${item.tone === "danger" ? ` ${styles.danger}` : item.tone === "primary" ? ` ${styles.primary}` : ""}`}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
