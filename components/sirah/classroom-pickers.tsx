"use client";
/**
 * Branded form controls for the Sīrah classroom editor: a listbox select, a
 * calendar date picker and a combined date + time field. No dependencies.
 * Each writes a hidden input, so the server actions read the same fields as
 * before (`scheduledLocal` stays "YYYY-MM-DDTHH:mm").
 *
 * Keyboard: listbox (arrows, Home/End, type-ahead, Enter, Escape); calendar
 * grid (arrows by day/week, PageUp/PageDown by month, Home/End of week,
 * Enter, Escape). Focus returns to the trigger on close.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import styles from "./classroom-pickers.module.css";

export type Option = { value: string; label: string; hint?: string };

/** Closes a popover on a pointer press outside `ref`. */
function useOutside(open: boolean, close: () => void, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close, ref]);
}

/* ---------------- Listbox ---------------- */

export function Listbox({
  labelId,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  invalid,
}: {
  labelId: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  const show = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    setActive(index);
    setOpen(true);
  };
  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  };
  const dismiss = useCallback(() => setOpen(false), []);
  useOutside(open, dismiss, wrap);

  useEffect(() => {
    const box = list.current;
    if (!open || !box) return;
    box.focus({ preventScroll: true });
    // Scroll the list only. scrollIntoView would also scroll the page, sliding
    // the list under a resting pointer so hover hijacks the active option.
    const option = box.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!option) return;
    if (option.offsetTop < box.scrollTop) box.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTop = option.offsetTop + option.offsetHeight - box.clientHeight;
  }, [open, active]);

  const onButtonKey = (event: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      show();
    }
  };
  const onListKey = (event: KeyboardEvent) => {
    const last = options.length - 1;
    const move = (index: number) => {
      event.preventDefault();
      setActive(Math.max(0, Math.min(last, index)));
    };
    switch (event.key) {
      case "ArrowDown":
        return move(active + 1);
      case "ArrowUp":
        return move(active - 1);
      case "PageDown":
        return move(active + 8);
      case "PageUp":
        return move(active - 8);
      case "Home":
        return move(0);
      case "End":
        return move(last);
      case "Enter":
      case " ":
        event.preventDefault();
        return choose(active);
      case "Escape":
        event.preventDefault();
        return close();
      case "Tab":
        return close(false);
      default:
        if (event.key.length === 1) {
          const now = Date.now();
          typed.current = {
            text: (now - typed.current.at < 600 ? typed.current.text : "") + event.key.toLowerCase(),
            at: now,
          };
          const hit = options.findIndex((option) => option.label.toLowerCase().startsWith(typed.current.text));
          if (hit >= 0) setActive(hit);
        }
    }
  };

  return (
    <div className={styles.control} ref={wrap}>
      <button
        ref={button}
        type="button"
        id={`${id}-button`}
        className={`${styles.trigger} ${invalid ? styles.invalid : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${id}-button`}
        onClick={() => (open ? close() : show())}
        onKeyDown={onButtonKey}
      >
        <span className={selected ? styles.value : styles.placeholder}>{selected?.label ?? placeholder}</span>
        <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          role="listbox"
          tabIndex={-1}
          className={styles.popover}
          aria-labelledby={labelId}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onListKey}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-opt-${index}`}
              data-index={index}
              role="option"
              aria-selected={option.value === value}
              className={`${styles.option} ${index === active ? styles.optionActive : ""}`}
              onPointerMove={() => setActive(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.hint && <span className={styles.hint}>{option.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A listbox that posts its value under `name`. */
export function SelectField({
  name,
  labelId,
  options,
  defaultValue,
}: {
  name: string;
  labelId: string;
  options: Option[];
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <Listbox labelId={labelId} value={value} onChange={setValue} options={options} />
      <input type="hidden" name={name} value={value} />
    </>
  );
}

/* ---------------- Calendar ---------------- */

type Ymd = { y: number; m: number; d: number }; // m: 0-11
const pad = (n: number) => String(n).padStart(2, "0");
const toIso = ({ y, m, d }: Ymd) => `${y}-${pad(m + 1)}-${pad(d)}`;
const fromIso = (iso: string): Ymd | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? { y: +match[1], m: +match[2] - 1, d: +match[3] } : null;
};
const shift = ({ y, m, d }: Ymd, days: number): Ymd => {
  const t = new Date(Date.UTC(y, m, d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
};
const shiftMonth = ({ y, m, d }: Ymd, months: number): Ymd => {
  const first = new Date(Date.UTC(y, m + months, 1));
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return { y: first.getUTCFullYear(), m: first.getUTCMonth(), d: Math.min(d, days) };
};
const weekday = ({ y, m, d }: Ymd) => (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7; // Monday = 0
const sameDay = (a: Ymd | null, b: Ymd | null) => !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthName = (y: number, m: number) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m, 1)));
const longName = (v: Ymd) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(v.y, v.m, v.d)),
  );
const fullName = (v: Ymd) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(v.y, v.m, v.d)),
  );

function todayYmd(): Ymd {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}

export function DatePicker({
  labelId,
  value,
  onChange,
}: {
  labelId: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  const id = useId();
  const selected = fromIso(value);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<Ymd>(() => selected ?? todayYmd());
  const button = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLTableElement>(null);
  const today = useMemo(() => todayYmd(), []);
  const dismiss = useCallback(() => setOpen(false), []);
  useOutside(open, dismiss, wrap);

  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-date="${toIso(focus)}"]`)?.focus();
  }, [open, focus]);

  const openPicker = () => {
    setFocus(selected ?? today);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const pick = (day: Ymd) => {
    onChange(toIso(day));
    close();
  };

  const onGridKey = (event: KeyboardEvent) => {
    const moves: Record<string, () => Ymd> = {
      ArrowLeft: () => shift(focus, -1),
      ArrowRight: () => shift(focus, 1),
      ArrowUp: () => shift(focus, -7),
      ArrowDown: () => shift(focus, 7),
      PageUp: () => shiftMonth(focus, -1),
      PageDown: () => shiftMonth(focus, 1),
      Home: () => shift(focus, -weekday(focus)),
      End: () => shift(focus, 6 - weekday(focus)),
    };
    if (moves[event.key]) {
      event.preventDefault();
      setFocus(moves[event.key]());
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const first = { y: focus.y, m: focus.m, d: 1 };
  const start = shift(first, -weekday(first));
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => shift(start, w * 7 + d)));

  return (
    <div className={styles.control} ref={wrap}>
      <button
        ref={button}
        type="button"
        id={`${id}-button`}
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${id}-button`}
        onClick={() => (open ? close() : openPicker())}
      >
        <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12" />
          <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
        </svg>
        <span className={selected ? styles.value : styles.placeholder}>{selected ? longName(selected) : "Choose a date"}</span>
      </button>
      {open && (
        <div role="dialog" aria-modal="false" aria-label="Choose a date" className={`${styles.popover} ${styles.calendar}`}>
          <div className={styles.calHead}>
            <button type="button" className={styles.calNav} aria-label="Previous month" onClick={() => setFocus(shiftMonth(focus, -1))}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 4L6 8l4 4" />
              </svg>
            </button>
            <p className={styles.calMonth} aria-live="polite">
              {monthName(focus.y, focus.m)}
            </p>
            <button type="button" className={styles.calNav} aria-label="Next month" onClick={() => setFocus(shiftMonth(focus, 1))}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          </div>
          <table ref={grid} role="grid" className={styles.calGrid} onKeyDown={onGridKey} aria-label={monthName(focus.y, focus.m)}>
            <thead>
              <tr>
                {WEEKDAYS.map((day) => (
                  <th key={day} scope="col" abbr={day}>
                    {day.slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={toIso(week[0])}>
                  {week.map((day) => {
                    const inMonth = day.m === focus.m;
                    const isSelected = sameDay(day, selected);
                    return (
                      <td key={toIso(day)} role="gridcell" aria-selected={isSelected}>
                        <button
                          type="button"
                          data-date={toIso(day)}
                          tabIndex={sameDay(day, focus) ? 0 : -1}
                          aria-label={fullName(day)}
                          aria-current={sameDay(day, today) ? "date" : undefined}
                          className={[
                            styles.day,
                            inMonth ? "" : styles.dayOutside,
                            isSelected ? styles.daySelected : "",
                            sameDay(day, today) ? styles.dayToday : "",
                          ].join(" ")}
                          onClick={() => pick(day)}
                        >
                          {day.d}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.calFoot}>
            <button type="button" className={styles.linkButton} onClick={() => pick(today)}>
              Today
            </button>
            <button type="button" className={styles.linkButton} onClick={close}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Date + time ---------------- */

const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`);
const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "am" : "pm"}`;
};

/** A labelled date + time pair laid out as two fields. */
export function ScheduleFields({ name, defaultValue, idPrefix }: { name: string; defaultValue: string; idPrefix: string }) {
  const [date, setDate] = useState(defaultValue.slice(0, 10));
  const [time, setTime] = useState(defaultValue.slice(11, 16) || "19:00");
  const slots = useMemo(
    () => (TIME_SLOTS.includes(time) ? TIME_SLOTS : [...TIME_SLOTS, time].sort()).map((value) => ({ value, label: timeLabel(value) })),
    [time],
  );
  return (
    <>
      <div className={styles.field}>
        <span id={`${idPrefix}-date`} className={styles.label}>
          Date
        </span>
        <DatePicker labelId={`${idPrefix}-date`} value={date} onChange={setDate} />
      </div>
      <div className={styles.field}>
        <span id={`${idPrefix}-time`} className={styles.label}>
          Start time
        </span>
        <Listbox labelId={`${idPrefix}-time`} value={time} onChange={setTime} options={slots} />
      </div>
      <input type="hidden" name={name} value={date ? `${date}T${time}` : ""} />
    </>
  );
}
