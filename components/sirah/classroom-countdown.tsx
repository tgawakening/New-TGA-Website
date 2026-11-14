"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MINUTE = 60_000;

function remainingText(ms: number) {
  if (ms <= 0) return "Starting now";
  const totalMinutes = Math.floor(ms / MINUTE);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"} ${hours} h`;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  const seconds = Math.floor((ms % MINUTE) / 1000);
  return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
}

/** Ticks down to the session start. The first render uses the server's clock
 * so the markup matches; it then follows the browser's clock. When the join
 * window opens or the session starts it refreshes the server component, which
 * is what decides whether the Join link is sent at all. */
export function ClassroomCountdown({
  startsAt,
  serverNow,
  joinWindowMinutes,
  className,
  noteClassName,
}: {
  startsAt: string;
  serverNow: string;
  joinWindowMinutes: number;
  className?: string;
  noteClassName?: string;
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

  return (
    <div role="timer" aria-live="off">
      <span className={className}>{remainingText(remaining)}</span>
      <span className={noteClassName}>{remaining > 0 ? "until the session starts" : "The session is open"}</span>
    </div>
  );
}
