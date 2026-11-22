"use client";
import { useEffect, useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "learn-otg:theme:v1";
const listeners = new Set<() => void>();

export function readThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  return pref === "system" ? (systemDark() ? "dark" : "light") : pref;
}

export function applyTheme(pref: ThemePref) {
  const t = resolveTheme(pref);
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "dark" ? "#0E1512" : "#F3F5F1");
}

export function setThemePref(pref: ThemePref) {
  try {
    window.localStorage.setItem(KEY, pref);
  } catch {
    // ignore
  }
  applyTheme(pref);
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readThemePref() === "system") applyTheme("system");
    cb();
  };
  mq.addEventListener("change", onChange);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onChange);
  };
};

/** Returns the preference and the theme actually showing. */
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readThemePref, () => "system" as ThemePref);
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolveTheme(readThemePref()),
    () => "light" as const,
  );
  useEffect(() => applyTheme(pref), [pref]);
  return { pref, resolved, setPref: setThemePref };
}

/** Inline script run before paint so there is no flash of the wrong theme. */
export const THEME_BOOT = `(function(){try{var p=localStorage.getItem("${KEY}")||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;
