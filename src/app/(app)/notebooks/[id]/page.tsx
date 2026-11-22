"use client";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { editNote, removeNote, saveNote, useNotebooks } from "@/lib/notebooks";
export default function NotebookPage() {
  const { id } = useParams<{ id: string }>();
  const mounted = useMounted();
  const books = useNotebooks();
  const book = books.find(b => b.id === id);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState("");
  const notes = (book?.notes ?? []).filter(n => `${n.text} ${n.title}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeader title={mounted ? book?.name ?? "Notebook not found" : "Notebook"} actions={<Link href="/notebooks" className="btn btn-sm">All notebooks</Link>} /><div className="page-body narrow">{mounted && book && <>
    <form className="card" onSubmit={e => { e.preventDefault(); saveNote(id, text, "Your note"); setText(""); }}><label className="field"><span>Write a note</span><textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={20000} placeholder="Something you want to remember" /></label><button className="btn btn-sm" disabled={!text.trim()}><Plus size={16} /> Save note</button></form>
    <label className="field"><span>Search notes</span><input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(10); }} /></label>
    {!notes.length && <p className="hint">No notes here yet. Select text in a lesson and choose Save to notebook.</p>}
    {notes.slice(0, limit).map(n => <article className="card saved-note" key={n.id}><div className="row spread"><strong>{n.title}</strong><button className="icon-btn" aria-label="Delete note" onClick={() => window.confirm("Delete this saved note?") && removeNote(id, n.id)}><Trash2 size={16} /></button></div>
      {editing === n.id ? <form onSubmit={e => { e.preventDefault(); editNote(id, n.id, draft); setEditing(undefined); }}><label className="field"><span>Edit note</span><textarea value={draft} onChange={e => setDraft(e.target.value)} rows={5} maxLength={20000} /></label><div className="row"><button className="btn btn-sm" disabled={!draft.trim()}>Save changes</button><button className="btn btn-sm btn-ghost" type="button" onClick={() => setEditing(undefined)}>Cancel</button></div></form> : <><details><summary className="note-preview line-clamp">{n.text}</summary><p className="note-full">{n.text}</p></details><div className="row"><button className="link-btn" onClick={() => { setEditing(n.id); setDraft(n.text); }}>Edit</button>{n.url && <Link className="link-btn" href={n.url}>Back to lesson</Link>}</div></>}
    </article>)}
    {notes.length > limit && <button className="btn" onClick={() => setLimit(n => n + 10)}>View 10 more</button>}
  </>}</div></>;
}
