"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MINUTE = 60_000;

type Unit = { value: number; label: string };

function units(ms: number): Unit[] {
  const total = Math.max(0, ms);
  const days = Math.floor(total / (1440 * MINUTE));
  const hours = Math.floor((total % (1440 * MINUTE)) / (60 * MINUTE));
  const minutes = Math.floor((total % (60 * MINUTE)) / MINUTE);
  const seconds = Math.floor((total % MINUTE) / 1000);
  const name = (n: number, one: string, many: string) => (n === 1 ? one : many);
  return days > 0
    ? [
        { value: days, label: name(days, "day", "days") },
        { value: hours, label: name(hours, "hour", "hours") },
        { value: minutes, label: name(minutes, "minute", "minutes") },
      ]
    : [
        { value: hours, label: name(hours, "hour", "hours") },
        { value: minutes, label: name(minutes, "minute", "minutes") },
        { value: seconds, label: name(seconds, "second", "seconds") },
      ];
}

export type CountdownClasses = {
  root?: string;
  units?: string;
  unit?: string;
  value?: string;
  label?: string;
  note?: string;
};

/** Ticks down to the session start. The first render uses the server's clock
 * so the markup matches; it then follows the browser's clock. When the join
 * window opens or the session starts it refreshes the server component, which
 * is what decides whether the Join link is sent at all. */
export function ClassroomCountdown({
  startsAt,
  serverNow,
  joinWindowMinutes,
  classes = {},
}: {
  startsAt: string;
  serverNow: string;
  joinWindowMinutes: number;
  classes?: CountdownClasses;
}) {
  const router = useRouter();
  const start = new Date(startsAt).getTime();
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  const refreshed = useRef(new Set<string>());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = start - now;
  useEffect(() => {
    const crossings: [string, boolean][] = [
      ["join", remaining <= joinWindowMinutes * MINUTE],
      ["start", remaining <= 0],
    ];
    for (const [key, crossed] of crossings) {
      if (crossed && !refreshed.current.has(key)) {
        refreshed.current.add(key);
        // The initial render is already correct for whatever window we are in.
        if (now !== new Date(serverNow).getTime()) router.refresh();
      }
    }
  }, [remaining, joinWindowMinutes, now, serverNow, router]);

  const parts = units(remaining);
  const spoken =
    remaining > 0 ? `${parts.map((part) => `${part.value} ${part.label}`).join(", ")} until the session starts` : "Starting now";

  return (
    <div className={classes.root} role="timer" aria-live="off" aria-label={spoken}>
      <div className={classes.units} aria-hidden="true">
        {parts.map((part) => (
          <span key={part.label.replace(/s$/, "")} className={classes.unit}>
            <span className={classes.value}>{String(part.value).padStart(2, "0")}</span>
            <span className={classes.label}>{part.label}</span>
          </span>
        ))}
      </div>
      <p className={classes.note} aria-hidden="true">
        {remaining > 0 ? "until the session starts" : "Starting now"}
      </p>
    </div>
  );
}
