import { useSyncExternalStore } from "react";

const key = "dl-theme";
const eventName = "dayloop:theme";
let fallback = "system";

function readTheme() {
  try { return localStorage.getItem(key) ?? fallback; }
  catch { return fallback; }
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(eventName, listener);
  };
}

export function setTheme(theme: string) {
  fallback = theme;
  try { localStorage.setItem(key, theme); } catch { /* Session preference stays available. */ }
  window.dispatchEvent(new Event(eventName));
}

export function useTheme() {
  return useSyncExternalStore(subscribe, readTheme);
}
