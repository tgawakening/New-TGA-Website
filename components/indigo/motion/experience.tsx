"use client";

import { useEffect } from "react";
import { addTask, easeOut } from "./loop";

/* The Indigo motion layer: progressive enhancement over server-rendered HTML.
 * Without JavaScript, or with reduced motion, every element is already in its
 * final state. With it, this wires:
 *   [data-reveal]        IntersectionObserver adds .is-in (CSS does the move)
 *   [data-count]         counts 0 -> value once, on view, ease-out
 *   [data-nav]           data-scrolled after 40px; scroll-progress bar
 *   [data-rig]           pointer parallax + tilt (fine pointers only)
 *   details[data-menu]   Escape / outside tap / link tap closes the phone menu
 * All listeners are passive; all per-frame work goes through the one loop and
 * writes transform or opacity only. */

export function Experience({ scope = "[data-experience]" }: { scope?: string }) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(scope);
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];
    const on = <K extends keyof WindowEventMap>(target: Window | Document, type: K, fn: (e: WindowEventMap[K]) => void) => {
      target.addEventListener(type, fn as EventListener, { passive: true });
      cleanups.push(() => target.removeEventListener(type, fn as EventListener));
    };

    /* ---- Nav state + scroll progress: one read per frame, at most ---- */
    const nav = root.querySelector<HTMLElement>("[data-nav]");
    const bar = root.querySelector<HTMLElement>("[data-progress]");
    let maxScroll = 1;
    const measure = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    cleanups.push(() => ro.disconnect());
    let scrollQueued = false;
    const applyScroll = () => {
      scrollQueued = false;
      const y = window.scrollY;
      if (nav) nav.toggleAttribute("data-scrolled", y > 40);
      root.toggleAttribute("data-scrolled", y > 40);
      if (bar) bar.style.transform = `scaleX(${Math.min(1, y / maxScroll)})`;
      return false;
    };
    applyScroll();
    let stopScrollTask: (() => void) | null = null;
    cleanups.push(() => stopScrollTask?.());
    on(window, "scroll", () => {
      if (scrollQueued) return;
      scrollQueued = true;
      stopScrollTask = addTask(applyScroll);
    });
    on(window, "resize", measure);

    /* ---- Phone menu (native <details>): close on Escape, outside, link ---- */
    root.querySelectorAll<HTMLDetailsElement>("details[data-menu]").forEach((menu) => {
      const summary = menu.querySelector("summary");
      const close = (focus: boolean) => {
        if (!menu.open) return;
        menu.open = false;
        if (focus) summary?.focus();
      };
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true);
      const onDown = (e: PointerEvent) => !menu.contains(e.target as Node) && close(false);
      const onClick = (e: MouseEvent) => (e.target as HTMLElement).closest("a") && close(false);
      document.addEventListener("keydown", onKey);
      document.addEventListener("pointerdown", onDown, { passive: true });
      menu.addEventListener("click", onClick);
      cleanups.push(() => {
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("pointerdown", onDown);
        menu.removeEventListener("click", onClick);
      });
    });

    if (reduced) {
      return () => cleanups.forEach((fn) => fn());
    }

    /* ---- Count-ups (write into the existing text node so React keeps it) ---- */
    const countUp = (el: HTMLElement) => {
      const target = Number(el.dataset.count);
      const text = el.firstChild;
      if (!Number.isFinite(target) || !text || text.nodeType !== Node.TEXT_NODE) return;
      const duration = 1400;
      let start = 0;
      text.nodeValue = "0";
      cleanups.push(
        addTask((now) => {
          if (!start) start = now;
          const t = Math.min(1, (now - start) / duration);
          text.nodeValue = Math.round(target * easeOut(t)).toLocaleString("en-GB");
          if (t >= 1) {
            el.setAttribute("data-counted", "");
            return false;
          }
        }),
      );
    };

    /* ---- Reveals. Elements already on screen are shown at once (no flash),
     * everything below the fold waits for the observer. ---- */
    const vh = window.innerHeight;
    const reveals = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
    const counters = [...root.querySelectorAll<HTMLElement>("[data-count]")];
    const pending = new Set<HTMLElement>();
    for (const el of reveals) {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add("is-in");
      else pending.add(el);
    }
    // Counters already on screen keep their final value (no jump back to 0);
    // the rest start at 0 and count when they arrive.
    const toCount = counters.filter((el) => {
      const r = el.getBoundingClientRect();
      const onScreen = r.top < vh && r.bottom > 0;
      if (onScreen) el.setAttribute("data-counted", "");
      else if (el.firstChild?.nodeType === Node.TEXT_NODE) el.firstChild.nodeValue = "0";
      return !onScreen;
    });
    root.classList.add("has-motion");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          io.unobserve(el);
          if (el.hasAttribute("data-count")) countUp(el);
          else el.classList.add("is-in");
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    pending.forEach((el) => io.observe(el));
    toCount.forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    /* ---- Living hero: pointer parallax + tilt, fine pointers only ---- */
    const rig = root.querySelector<HTMLElement>("[data-rig]");
    if (rig && window.matchMedia("(pointer: fine)").matches) {
      const scopeEl = rig.closest<HTMLElement>("[data-rig-scope]") ?? rig;
      const layers = [...scopeEl.querySelectorAll<HTMLElement>("[data-depth]")].map((el) => ({
        el,
        depth: Number(el.dataset.depth) || 0,
      }));
      const target = { x: 0, y: 0 };
      const cur = { x: 0, y: 0 };
      let visible = true;
      let running = false;
      let stopStep: (() => void) | null = null;
      cleanups.push(() => stopStep?.());
      const step = (_now: number, dt: number) => {
        const k = 1 - Math.pow(1 - 0.075, dt / 16.7); // frame-rate independent lerp
        cur.x += (target.x - cur.x) * k;
        cur.y += (target.y - cur.y) * k;
        for (const { el, depth } of layers) {
          el.style.transform = `translate3d(${(cur.x * depth * 14).toFixed(2)}px, ${(cur.y * depth * 14).toFixed(2)}px, 0)`;
        }
        rig.style.transform = `rotateX(${(-cur.y * 5).toFixed(2)}deg) rotateY(${(cur.x * 7).toFixed(2)}deg)`;
        const settled = Math.abs(target.x - cur.x) < 0.001 && Math.abs(target.y - cur.y) < 0.001;
        if (settled) running = false;
        return !settled;
      };
      const wake = () => {
        if (running) return;
        running = true;
        stopStep = addTask(step);
      };
      on(window, "pointermove", (e: PointerEvent) => {
        if (!visible || e.pointerType !== "mouse") return;
        target.x = (e.clientX / window.innerWidth) * 2 - 1;
        target.y = (e.clientY / window.innerHeight) * 2 - 1;
        wake();
      });
      // Pointer leaves the window: drift back to rest.
      const settle = () => {
        target.x = 0;
        target.y = 0;
        wake();
      };
      document.documentElement.addEventListener("mouseleave", settle, { passive: true });
      cleanups.push(() => document.documentElement.removeEventListener("mouseleave", settle));
      const rigIo = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) {
          target.x = 0;
          target.y = 0;
          wake();
        }
      });
      rigIo.observe(rig);
      cleanups.push(() => rigIo.disconnect());
    }

    return () => {
      cleanups.forEach((fn) => fn());
      root.classList.remove("has-motion");
    };
  }, [scope]);

  return null;
}
