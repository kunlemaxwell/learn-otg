"use client";
// Home-screen suggestions built from what the learner has been doing: where to pick up,
// what they found hard, what the last lesson suggested next, and areas they want to improve.
import type { Course } from "./course-types";
import { allLessons } from "./courses";
import type { MemoryItem } from "./learner-memory";
import { parseReply } from "./parse";
import type { Profile } from "./profile";
import type { Conversation } from "./types";

export type Suggestion = {
  icon: string;
  label: string;
  kind: "continue" | "review" | "next" | "area" | "starter";
  reason?: string; // why it is suggested
  href?: string; // navigate instead of asking
  ask?: string; // what to send to the tutor
};

const STARTERS: Suggestion[] = [
  { icon: "🫀", label: "How does the heart pump blood?", kind: "starter" },
  { icon: "💸", label: "Explain compound interest with a simulation", kind: "starter" },
  { icon: "🔌", label: "What is an API, simply?", kind: "starter" },
  { icon: "🌍", label: "Why do we have seasons?", kind: "starter" },
];

export const AREA_STARTERS: Record<string, { icon: string; label: string }> = {
  Leadership: { icon: "🧭", label: "Role-play a hard feedback conversation" },
  Communication: { icon: "🗣️", label: "How do I structure a clear message?" },
  "Data & analytics": { icon: "📊", label: "Show how the world's biggest economies have grown" },
  Technology: { icon: "🔌", label: "What is an API, simply?" },
  "Product & strategy": { icon: "🎯", label: "How do I prioritise a product roadmap?" },
  "Money & finance": { icon: "💸", label: "Explain compound interest with a simulation" },
  "Health & wellbeing": { icon: "🫀", label: "How does sleep affect memory?" },
  Science: { icon: "🌍", label: "Why do we have seasons?" },
  Languages: { icon: "🔤", label: "How do children learn a language so fast?" },
  Writing: { icon: "✍️", label: "What makes writing easy to follow?" },
  "Creativity & design": { icon: "🎨", label: "How does colour affect mood?" },
  "Critical thinking": { icon: "🧠", label: "What are the most common thinking traps?" },
};

function lastNextSteps(chats: Conversation[]): string[] {
  for (const c of chats.slice(0, 5)) {
    for (const m of [...c.messages].reverse()) {
      if (m.role !== "assistant") continue;
      const code = parseReply(m.text).code;
      const block = code?.match(/NextSteps\(\s*\[([^\]]*)\]/)?.[1];
      if (block) return [...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1].replace(/\\"/g, '"'));
    }
  }
  return [];
}

export function suggestionsFor(input: { profile: Profile; courses: Course[]; memory: MemoryItem[]; chats: Conversation[]; auto: boolean }): Suggestion[] {
  const { profile, courses, memory, chats, auto } = input;
  const areaCards: Suggestion[] = profile.areas.map((a) => AREA_STARTERS[a]).filter(Boolean).map((x) => ({ ...x, kind: "area" as const }));
  if (!auto) return dedupe([...areaCards, ...STARTERS]).slice(0, 4);

  const out: Suggestion[] = [];
  // 1. Pick up the course you were on.
  const active = [...courses].filter((c) => !c.completedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (active) {
    const next = allLessons(active).find((x) => !x.lesson.done);
    if (next) out.push({ icon: "▶️", label: `Continue: ${next.lesson.title}`, kind: "continue", reason: active.title, href: `/courses/${active.id}/lesson/${next.lesson.id}` });
  }
  // 2. Revisit something you found hard.
  const hard = memory.find((m) => m.kind === "struggled" && Date.now() - m.ts < 14 * 86_400_000);
  if (hard) {
    const q = hard.text.replace(/\s*\(.*\)\s*$/, "");
    out.push({ icon: "🔁", label: `Review: ${q.length > 70 ? `${q.slice(0, 67)}…` : q}`, kind: "review", reason: `You found this hard in “${hard.topic}”`, ask: `I found this hard: "${q}". Teach it to me another way, with a different kind of activity.` });
  }
  // 3. What the last lesson suggested next.
  const next = lastNextSteps(chats)[0];
  if (next) out.push({ icon: "✨", label: next, kind: "next", reason: "Suggested by your last lesson" });
  // 4. An area you want to improve that you haven't studied lately.
  const studied = memory.map((m) => `${m.text} ${m.topic}`.toLowerCase()).join(" ");
  const fresh = profile.areas.find((a) => !studied.includes(a.split(" ")[0].toLowerCase()) && AREA_STARTERS[a]);
  if (fresh) out.push({ ...AREA_STARTERS[fresh], kind: "area", reason: `You wanted to improve ${fresh.toLowerCase()}` });

  return dedupe([...out, ...areaCards, ...STARTERS]).slice(0, 4);
}

function dedupe(list: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = s.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
