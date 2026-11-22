"use client";
// Chat history, saved in this browser (localStorage). Each conversation keeps
// its messages and lessons so it can be reopened later.
import { useSyncExternalStore } from "react";
import type { Conversation, Msg } from "./types";

const KEY = "learn-otg:history:v1";
const MAX_CONVERSATIONS = 50;
const MAX_IMAGE_CHARS = 250_000; // keep small thumbnails only; drop big photos

const EMPTY: Conversation[] = [];
let cache: Conversation[] | null = null;
const listeners = new Set<() => void>();

function read(): Conversation[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): Conversation[] {
  if (!cache) cache = read();
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = read();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function persist(list: Conversation[]) {
  const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
  cache = sorted;
  let attempt = sorted;
  for (let i = 0; i < 4; i++) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(attempt));
      break;
    } catch {
      // Storage full: first drop images, then the oldest conversations.
      attempt =
        i === 0
          ? attempt.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m, image: undefined })) }))
          : attempt.slice(0, Math.max(1, Math.floor(attempt.length / 2)));
    }
  }
  listeners.forEach((l) => l());
}

function cleanMessage(m: Msg): Msg {
  return {
    ...m,
    streaming: undefined,
    reasoning: undefined, // can be very long; not needed to reopen a lesson
    image: m.image && m.image.length <= MAX_IMAGE_CHARS ? m.image : undefined,
  };
}

export function titleFor(messages: Msg[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = (first?.display ?? first?.text ?? "New chat").replace(/\s+/g, " ").trim();
  return text.length > 60 ? `${text.slice(0, 57)}…` : text || "New chat";
}

export function saveConversation(id: string, modelId: string, messages: Msg[]) {
  if (!messages.length) return;
  const list = getSnapshot();
  const existing = list.find((c) => c.id === id);
  const now = Date.now();
  const conv: Conversation = {
    id,
    title: existing?.title ?? titleFor(messages),
    starred: existing?.starred,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    modelId,
    messages: messages.map(cleanMessage),
  };
  persist([conv, ...list.filter((c) => c.id !== id)]);
}

export function getConversation(id: string): Conversation | undefined {
  return getSnapshot().find((c) => c.id === id);
}

export function toggleStar(id: string) {
  persist(getSnapshot().map((c) => (c.id === id ? { ...c, starred: !c.starred } : c)));
}

export function renameConversation(id: string, title: string) {
  persist(getSnapshot().map((c) => (c.id === id ? { ...c, title: title.trim() || c.title } : c)));
}

export function deleteConversation(id: string) {
  persist(getSnapshot().filter((c) => c.id !== id));
}

export function clearHistory() {
  persist([]);
}

export function useHistory(): Conversation[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
