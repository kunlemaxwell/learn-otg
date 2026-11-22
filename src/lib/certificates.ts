"use client";
import { createStore, uid } from "./local-store";

export type CertDesign = {
  id: string;
  name: string;
  builtin?: boolean;
  bg: string;
  ink: string;
  accent: string;
  frame: "none" | "line" | "double" | "corners";
  heading: "serif" | "display" | "sans";
  pattern: "none" | "dots" | "stripes" | "rings";
  title: string; // "Certificate of completion"
  line: string; // "is awarded to"
  signer: string;
  signerRole: string;
};

export const BUILTIN_CERTS: CertDesign[] = [
  { id: "forest-classic", name: "Forest classic", builtin: true, bg: "#FBFAF5", ink: "#12201A", accent: "#0B6E4F", frame: "double", heading: "serif", pattern: "none", title: "Certificate of completion", line: "is proudly awarded to", signer: "Learn OTG", signerRole: "Learning platform" },
  { id: "sun-bold", name: "Sunrise", builtin: true, bg: "#FDF0D2", ink: "#2A1D00", accent: "#D98E04", frame: "corners", heading: "display", pattern: "rings", title: "Certificate of achievement", line: "has successfully completed", signer: "Learn OTG", signerRole: "Learning platform" },
  { id: "lagoon-clean", name: "Lagoon", builtin: true, bg: "#F1F7FB", ink: "#0E2638", accent: "#1A639A", frame: "line", heading: "sans", pattern: "dots", title: "Certificate of completion", line: "has completed the course", signer: "Learn OTG", signerRole: "Learning platform" },
  { id: "midnight", name: "Midnight", builtin: true, bg: "#0E1512", ink: "#E8EFEA", accent: "#4FD1A1", frame: "double", heading: "display", pattern: "stripes", title: "Certificate of completion", line: "is awarded to", signer: "Learn OTG", signerRole: "Learning platform" },
  { id: "berry-studio", name: "Berry studio", builtin: true, bg: "#FFF6F9", ink: "#3A1022", accent: "#B0285C", frame: "line", heading: "serif", pattern: "none", title: "Certificate of excellence", line: "is recognised for completing", signer: "Learn OTG", signerRole: "Learning platform" },
];

export type CertStore = { custom: CertDesign[] };
const store = createStore<CertStore>("learn-otg:certs:v1", { custom: [] }, (raw) => ({
  custom: ((raw as Partial<CertStore>)?.custom ?? []) as CertDesign[],
}));

export const useCertStore = () => store.useValue();
export const allDesigns = (s: CertStore) => [...BUILTIN_CERTS, ...s.custom];
export const findDesign = (id: string | undefined) =>
  [...BUILTIN_CERTS, ...store.get().custom].find((d) => d.id === id) ?? BUILTIN_CERTS[0];

export function saveDesign(d: CertDesign) {
  const cur = store.get();
  const exists = cur.custom.some((c) => c.id === d.id);
  store.set({ custom: exists ? cur.custom.map((c) => (c.id === d.id ? d : c)) : [...cur.custom, d] });
}
export function removeDesign(id: string) {
  store.set({ custom: store.get().custom.filter((c) => c.id !== id) });
}
export function newDesignFrom(base: CertDesign): CertDesign {
  return { ...base, id: "c-" + uid(), name: `${base.name} copy`, builtin: false };
}

/** A certificate earned by finishing a course. */
export type Earned = {
  id: string;
  courseId: string;
  courseTitle: string;
  recipient: string;
  designId: string;
  issuedAt: number;
  code: string;
};
const earnedStore = createStore<Earned[]>("learn-otg:earned:v1", [], (raw) => (Array.isArray(raw) ? (raw as Earned[]) : []));
export const useEarned = () => earnedStore.useValue();
export function issueCertificate(e: Omit<Earned, "id" | "issuedAt" | "code">): Earned {
  const existing = earnedStore.get().find((x) => x.courseId === e.courseId);
  if (existing) return existing;
  const rec: Earned = {
    ...e,
    id: uid(),
    issuedAt: Date.now(),
    code: "OTG-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
  };
  earnedStore.set([rec, ...earnedStore.get()]);
  return rec;
}
export function removeEarned(id: string) {
  earnedStore.set(earnedStore.get().filter((x) => x.id !== id));
}
