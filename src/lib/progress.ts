"use client";
// Learner record: recent quiz results, kept on this device and sent with each
// question so the tutor can revisit weak spots (Khan Academy saw +3.4% next-question
// accuracy from a summary like this).
export type ProgressItem = { topic: string; question: string; correct: boolean; attempts: number; ts: number };

const KEY = "learn-otg:progress:v1";
const MAX = 40;

export function readProgress(): ProgressItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressItem[]) : [];
  } catch {
    return [];
  }
}

export function recordProgress(item: ProgressItem) {
  try {
    const list = [item, ...readProgress()].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage unavailable
  }
}
