"use client";
import { useSyncExternalStore } from "react";
import { RESIDENCE_KEY, resolveResidence, validResidence } from "./residence";
let memoryChoice: string | null = null;
function saved() {
  try {
    const value = localStorage.getItem(RESIDENCE_KEY);
    return validResidence(value) ? value : null;
  } catch {
    return memoryChoice;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("sirah-residence", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("sirah-residence", callback);
  };
}
export function saveResidence(value: string) {
  if (!validResidence(value)) return;
  memoryChoice = value;
  try {
    localStorage.setItem(RESIDENCE_KEY, value);
  } catch {}
  window.dispatchEvent(new Event("sirah-residence"));
}
export function useResidence(detected?: string) {
  const choice = useSyncExternalStore(subscribe, saved, () => null);
  return resolveResidence(null, choice, detected);
}
