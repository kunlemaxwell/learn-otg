"use client";
import { createStore, uid } from "./local-store";
import { currentModel } from "./settings";
import type { ChatAttachment } from "./chat-attachments";
import { mockFlag } from "./mock-flag";
export type TutorMessage = { id: string; role: "user" | "assistant"; text: string; quote?: string; image?: string; attachments?: ChatAttachment[]; pending?: boolean; error?: string; model?: string };
const store = createStore<Record<string, TutorMessage[]>>("learn-otg:lesson-chats:v1", {}, raw => {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, (value as TutorMessage[]).map(m => m.pending ? { ...m, pending: false, error: "This reply was interrupted. Your question is saved; try again." } : m)]));
});
const controllers = new Map<string, AbortController>();
export const useLessonChats = () => store.useValue();
function patch(key: string, id: string, p: Partial<TutorMessage>) { store.update(s => ({ ...s, [key]: (s[key] ?? []).map(m => m.id === id ? { ...m, ...p } : m) })); }
export function stopTutor(key: string) { controllers.get(key)?.abort(); }
export async function askTutor(key: string, input: { question: string; context: string; sourcePolicy?: "strict" | "mixed"; quote?: string; image?: string; attachments?: ChatAttachment[]; visual?: boolean }) {
  if (controllers.has(key)) return;
  const history = (store.get()[key] ?? []).map(m => m.pending ? { ...m, pending: false, error: "This reply was interrupted. Ask again to continue." } : m);
  const id = uid();
  store.update(s => ({ ...s, [key]: [...history, { id: uid(), role: "user" as const, text: input.question, quote: input.quote, image: input.image, attachments: input.attachments }, { id, role: "assistant" as const, text: "", pending: true }].slice(-100) }));
  const ctrl = new AbortController();
  controllers.set(key, ctrl);
  const timer = setTimeout(() => ctrl.abort("timeout"), 160000);
  try {
    const { model, params } = currentModel();
    const res = await fetch("/api/lesson-tutor", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal, body: JSON.stringify({ ...input, model: model.id, params, mock: mockFlag(), history: history.filter(m => !m.error && !m.pending).slice(-6).map(m => ({ role: m.role, content: m.text })) }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Couldn't get a reply.");
    patch(key, id, { text: j.text, model: j.model });
  } catch (e) { patch(key, id, { error: ctrl.signal.aborted ? ctrl.signal.reason === "timeout" ? "The tutor took too long. Your question is saved; try again." : "Reply stopped. Your question is saved." : e instanceof Error ? e.message : "Couldn't get a reply." }); }
  finally { clearTimeout(timer); controllers.delete(key); patch(key, id, { pending: false }); }
}
export const tutorRunning = (key: string) => controllers.has(key);
