"use client";
import { useSyncExternalStore } from "react";

/** Small localStorage-backed store with a React hook. Values are plain JSON. */
export function createStore<T>(key: string, initial: T, migrate?: (raw: unknown) => T) {
  let cache: T | null = null;
  const listeners = new Set<() => void>();

  const load = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw) as unknown;
      return migrate ? migrate(parsed) : (parsed as T);
    } catch {
      return initial;
    }
  };

  const get = (): T => {
    if (typeof window === "undefined") return initial;
    if (cache === null) cache = load();
    return cache;
  };

  const set = (next: T) => {
    cache = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage unavailable or full: the value lives for this session. Tell the app so it can warn the learner.
      try {
        window.dispatchEvent(new CustomEvent("learn-otg:storage-full", { detail: key }));
      } catch {}
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        cache = null;
        cb();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };

  const useValue = (): T => useSyncExternalStore(subscribe, get, () => initial);
  return { get, set, useValue, update: (fn: (cur: T) => T) => set(fn(get())) };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
