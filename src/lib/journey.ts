"use client";
import { notify } from "./notifications";
import { createStore, uid } from "./local-store";

export type PointKind =
  | "lesson" // built a lesson from a question
  | "quiz-correct"
  | "quiz-retry"
  | "course-lesson"
  | "section-quiz"
  | "final-quiz"
  | "course"
  | "certificate"
  | "share"
  | "daily";

export type PointEvent = { id: string; kind: PointKind; points: number; label: string; ts: number };
export type Goal = { id: string; text: string; createdAt: number; doneAt?: number };

export type Journey = { events: PointEvent[]; goals: Goal[]; dailyTarget: number };

const store = createStore<Journey>("learn-otg:journey:v1", { events: [], goals: [], dailyTarget: 1 }, (raw) => {
  const r = raw as Partial<Journey>;
  return { events: r.events ?? [], goals: r.goals ?? [], dailyTarget: r.dailyTarget ?? 1 };
});

export const useJourney = () => store.useValue();

export const POINTS: Record<PointKind, number> = {
  lesson: 20,
  "quiz-correct": 5,
  "quiz-retry": 2,
  "course-lesson": 30,
  "section-quiz": 40,
  "final-quiz": 80,
  course: 150,
  certificate: 25,
  share: 5,
  daily: 10,
};

export const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Award points. Every activity also earns the daily bonus once per day. */
export function award(kind: PointKind, label: string, points = POINTS[kind]) {
  const now = Date.now();
  const j = store.get();
  const events: PointEvent[] = [{ id: uid(), kind, points, label, ts: now }, ...j.events];
  if (kind !== "daily" && !j.events.some((e) => e.kind === "daily" && dayKey(e.ts) === dayKey(now)))
    events.unshift({ id: uid(), kind: "daily", points: POINTS.daily, label: "First learning of the day", ts: now });
  store.set({ ...j, events: events.slice(0, 600) });
  for (const e of events.filter(e => e.ts === now && !j.events.some(old => old.id === e.id))) notify({ id: `points-${e.id}`, title: `You gained ${e.points} points`, detail: e.label, href: kind === "certificate" ? "/certificates" : "/journey" });
}

export function addGoal(text: string) {
  const j = store.get();
  store.set({ ...j, goals: [{ id: uid(), text: text.trim(), createdAt: Date.now() }, ...j.goals] });
}
export function toggleGoal(id: string) {
  const j = store.get();
  store.set({ ...j, goals: j.goals.map((g) => (g.id === id ? { ...g, doneAt: g.doneAt ? undefined : Date.now() } : g)) });
}
export function removeGoal(id: string) {
  const j = store.get();
  store.set({ ...j, goals: j.goals.filter((g) => g.id !== id) });
}

export function totalPoints(j: Journey) {
  return j.events.reduce((n, e) => n + e.points, 0);
}

export function levelOf(points: number) {
  const level = Math.floor(Math.sqrt(points / 60)) + 1;
  const base = 60 * (level - 1) ** 2;
  const next = 60 * level ** 2;
  return { level, base, next, into: points - base, span: next - base };
}

const LEVEL_NAMES = ["Curious", "Explorer", "Builder", "Thinker", "Scholar", "Sage", "Master"];
export const levelName = (level: number) => LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];

export function streakOf(j: Journey, now = Date.now()) {
  const days = new Set(j.events.map((e) => dayKey(e.ts)));
  const dayMs = 86_400_000;
  // Current streak counts back from today, or from yesterday if today is still empty.
  let cursor = days.has(dayKey(now)) ? now : now - dayMs;
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current++;
    cursor -= dayMs;
  }
  // Best streak.
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of sorted) {
    const t = new Date(k + "T12:00:00").getTime();
    run = prev !== null && Math.round((t - prev) / dayMs) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return { current, best, today: days.has(dayKey(now)), days };
}

/** Last N days, oldest first, with points per day. */
export function lastDays(j: Journey, n = 14, now = Date.now()) {
  const dayMs = 86_400_000;
  const by = new Map<string, number>();
  for (const e of j.events) by.set(dayKey(e.ts), (by.get(dayKey(e.ts)) ?? 0) + e.points);
  return Array.from({ length: n }, (_, i) => {
    const t = now - (n - 1 - i) * dayMs;
    const k = dayKey(t);
    return { key: k, label: new Date(t).toLocaleDateString(undefined, { weekday: "narrow" }), points: by.get(k) ?? 0 };
  });
}

export type Badge = { id: string; name: string; blurb: string; earned: boolean };
export function badgesOf(j: Journey): Badge[] {
  const count = (k: PointKind) => j.events.filter((e) => e.kind === k).length;
  const s = streakOf(j);
  const pts = totalPoints(j);
  return [
    { id: "first", name: "First step", blurb: "Learn your first lesson", earned: count("lesson") + count("course-lesson") >= 1 },
    { id: "ten", name: "Ten lessons", blurb: "Finish 10 lessons", earned: count("lesson") + count("course-lesson") >= 10 },
    { id: "streak3", name: "On a roll", blurb: "3-day streak", earned: s.best >= 3 },
    { id: "streak7", name: "Week strong", blurb: "7-day streak", earned: s.best >= 7 },
    { id: "ace", name: "Sharp mind", blurb: "10 quiz answers right first time", earned: count("quiz-correct") >= 10 },
    { id: "course", name: "Course complete", blurb: "Complete a course", earned: count("course") >= 1 },
    { id: "cert", name: "Certified", blurb: "Earn a certificate", earned: count("certificate") >= 1 },
    { id: "k", name: "1,000 points", blurb: "Reach 1,000 points", earned: pts >= 1000 },
  ];
}
