"use client";
// What the learner has studied, kept in this browser. Lessons and chats add to it;
// later lessons read the most relevant items so they can build on earlier learning.
import { createStore, uid } from "./local-store";
import { readSettings } from "./settings";

export type MemoryKind = "learned" | "struggled" | "interest" | "note";

export type MemoryItem = {
  id: string;
  kind: MemoryKind;
  text: string; // one line, written for the model and the learner
  topic: string; // lesson or course title it came from
  scope: "global" | "course";
  courseId?: string;
  ts: number;
};

const MAX_ITEMS = 400;
const store = createStore<MemoryItem[]>("learn-otg:memory:v1", [], (raw) => (Array.isArray(raw) ? (raw as MemoryItem[]) : []));

export const useMemory = () => store.useValue();
export const readMemory = () => store.get();

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Add an item (ignored when memory is off, or when the same thing is already remembered). */
export function remember(item: Omit<MemoryItem, "id" | "ts">) {
  if (!readSettings().memory) return;
  const text = item.text.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!text) return;
  const list = store.get();
  const key = norm(text);
  const rest = list.filter((m) => !(norm(m.text) === key && m.courseId === item.courseId));
  store.set([{ ...item, text, id: uid(), ts: Date.now() }, ...rest].slice(0, MAX_ITEMS));
}

export function forget(id: string) {
  store.set(store.get().filter((m) => m.id !== id));
}

export function forgetAll() {
  store.set([]);
}

const STOP = new Set(
  "a an and are as at be by can do does for from has have how i in is it its of on or so that the this to was what when where which who why will with you your about into than then them they their there these those".split(" "),
);
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

/**
 * The most relevant memories for a request, as context lines for the model.
 * scope "course" only uses that course's memories; "global" uses everything that isn't private to another course.
 */
export function memoryContext(query: string, opts: { courseId?: string; scope?: "global" | "course" | "off"; limit?: number } = {}): string {
  const s = readSettings();
  if (!s.memory || opts.scope === "off") return "";
  const q = new Set(words(query));
  const now = Date.now();
  const pool = store.get().filter((m) => {
    if (opts.scope === "course") return m.courseId === opts.courseId;
    return m.scope === "global" || m.courseId === opts.courseId;
  });
  const scored = pool
    .map((m) => {
      const overlap = words(`${m.text} ${m.topic}`).filter((w) => q.has(w)).length;
      const ageDays = (now - m.ts) / 86_400_000;
      const kindBoost = m.kind === "struggled" ? 1.5 : m.kind === "note" ? 2 : m.kind === "interest" ? 0.5 : 1;
      return { m, score: overlap * 2 * kindBoost + Math.max(0, 1 - ageDays / 30) };
    })
    .filter((x) => x.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 8);
  if (!scored.length) return "";
  const label: Record<MemoryKind, string> = { learned: "Learned", struggled: "Found hard", interest: "Interested in", note: "Note from learner" };
  return scored.map(({ m }) => `- ${label[m.kind]}: ${m.text}`).join("\n");
}

/* ---------- Pull memory lines out of a finished lesson ---------- */

const STRING = /"((?:[^"\\]|\\.)*)"/g;
const unq = (s: string) => s.replace(/\\"/g, '"').replace(/\\n/g, " ");

/** "Big idea" and takeaways of a lesson, as one line. */
export function lessonGist(code: string): string {
  const bits: string[] = [];
  const idea = code.match(/BigIdea\(\s*"((?:[^"\\]|\\.)*)"/);
  if (idea) bits.push(unq(idea[1]));
  const take = code.match(/Takeaways\(\s*\[([^\]]*)\]/);
  if (take) bits.push(...[...take[1].matchAll(STRING)].slice(0, 2).map((m) => unq(m[1])));
  if (!bits.length) {
    const terms = code.match(/KeyTerms\(\s*\[([\s\S]*?)\]\s*[,)]/);
    if (terms) bits.push(...[...terms[1].matchAll(/term:\s*"((?:[^"\\]|\\.)*)"/g)].slice(0, 4).map((m) => unq(m[1])));
  }
  return bits.join(" ").slice(0, 220);
}
