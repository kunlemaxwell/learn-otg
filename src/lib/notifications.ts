"use client";
import { createStore } from "./local-store";
export type Notice = { id: string; title: string; detail?: string; href?: string; ts: number; read: boolean };
const store = createStore<Notice[]>("learn-otg:notifications:v1", []);
export const useNotifications = () => store.useValue();
export function notify(n: Omit<Notice, "read" | "ts"> & { ts?: number }) {
  if (store.get().some(x => x.id === n.id)) return;
  const notice = { ...n, ts: n.ts ?? Date.now(), read: false };
  store.set([notice, ...store.get()].slice(0, 100));
  window.dispatchEvent(new CustomEvent("learn-otg:notice", { detail: notice }));
}
export function markRead(id?: string) { store.update(list => list.map(n => !id || n.id === id ? { ...n, read: true } : n)); }
export function clearNotifications() { store.set([]); }
