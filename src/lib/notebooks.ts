"use client";
import { createStore, uid } from "./local-store";
export type Note = { id: string; text: string; title: string; url?: string; ts: number };
export type Notebook = { id: string; name: string; notes: Note[] };
const initial: Notebook[] = [{ id: "general", name: "General", notes: [] }];
const store = createStore<Notebook[]>("learn-otg:notebooks:v1", initial);
export const useNotebooks = () => store.useValue();
export function createNotebook(name: string) {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error("Give your notebook a name.");
  const existing = store.get().find(n => n.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing.id;
  const id = uid();
  store.set([...store.get(), { id, name: clean, notes: [] }]);
  return id;
}
export function saveNote(id: string, text: string, title: string, url?: string) {
  if (!text.trim()) return;
  store.update(list => list.map(n => n.id === id ? { ...n, notes: [{ id: uid(), text: text.trim().slice(0, 20000), title, url, ts: Date.now() }, ...n.notes] } : n));
}
export function editNote(book: string, id: string, text: string) {
  store.update(list => list.map(n => n.id === book ? { ...n, notes: n.notes.map(x => x.id === id ? { ...x, text: text.trim() } : x) } : n));
}
export function removeNote(book: string, id: string) {
  store.update(list => list.map(n => n.id === book ? { ...n, notes: n.notes.filter(x => x.id !== id) } : n));
}
