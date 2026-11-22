"use client";
import { createStore } from "./local-store";

export type LearningStyle = "visual" | "text" | "balanced";

export const AREAS = [
  "Leadership",
  "Communication",
  "Data & analytics",
  "Technology",
  "Product & strategy",
  "Money & finance",
  "Health & wellbeing",
  "Science",
  "Languages",
  "Writing",
  "Creativity & design",
  "Critical thinking",
] as const;

export type Profile = {
  done: boolean; // onboarding finished
  fullName: string;
  nickname: string; // what to call them
  profession: string;
  style: LearningStyle;
  areas: string[];
  goal?: string; // what they want to learn next
};

export const EMPTY_PROFILE: Profile = {
  done: false,
  fullName: "",
  nickname: "",
  profession: "",
  style: "balanced",
  areas: [],
};

const store = createStore<Profile>("learn-otg:profile:v1", EMPTY_PROFILE, (raw) => ({
  ...EMPTY_PROFILE,
  ...(raw as Partial<Profile>),
}));

export const useProfile = () => store.useValue();
export const readProfile = () => store.get();
export const saveProfile = (patch: Partial<Profile>) => store.set({ ...store.get(), ...patch });

export function callName(p: Profile): string {
  return p.nickname.trim() || p.fullName.trim().split(/\s+/)[0] || "";
}

export const STYLE_INFO: Record<LearningStyle, { label: string; blurb: string }> = {
  visual: { label: "More visuals", blurb: "Diagrams, charts and short captions. Less reading." },
  text: { label: "More explanation", blurb: "Fuller written explanations with worked reasoning." },
  balanced: { label: "Balanced mix", blurb: "A bit of both, shaped by the topic." },
};

/** One line about the learner, added to the model's context block. */
export function profileContext(p: Profile): string {
  const bits: string[] = [];
  const name = callName(p);
  if (name) bits.push(`Call the learner "${name}".`);
  if (p.profession) bits.push(`Profession: ${p.profession}. Use examples from their world when it helps.`);
  if (p.areas.length) bits.push(`Wants to improve: ${p.areas.slice(0, 6).join(", ")}.`);
  if (p.style === "visual")
    bits.push("Learning style: VISUAL. Lead with diagrams, charts and Flow/Compare/ConceptMap components; keep prose to one sentence per block.");
  else if (p.style === "text")
    bits.push("Learning style: TEXT-HEAVY. Give fuller written explanations (2 to 3 sentences per block, a worked example), with visuals only where they carry the idea.");
  else bits.push("Learning style: BALANCED. Pair each short explanation with one visual.");
  return bits.join(" ");
}
