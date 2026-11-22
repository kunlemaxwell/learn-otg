"use client";
import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { createNotebook, useNotebooks } from "@/lib/notebooks";
export default function NotebooksPage() {
  const mounted = useMounted();
  const books = useNotebooks();
  const router = useRouter();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  return <><PageHeader title="Notebooks" subtitle="Passages and ideas you want to keep" /><div className="page-body narrow">
    <form className="card row" onSubmit={e => { e.preventDefault(); const id = createNotebook(name); router.push(`/notebooks/${id}`); }}><label className="field grow"><span>New notebook</span><input value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="e.g. Ideas from product managers" /></label><button className="btn btn-sm" disabled={!name.trim()}><Plus size={16} /> Create</button></form>
    <label className="field"><span>Find a notebook</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notebook names" /></label>
    <div className="notebook-grid">{mounted && books.filter(b => b.name.toLowerCase().includes(search.toLowerCase())).map(b => <Link key={b.id} className="card notebook-card" href={`/notebooks/${b.id}`}><BookOpen size={22} /><h2>{b.name}</h2><small>{b.notes.length} saved {b.notes.length === 1 ? "note" : "notes"}</small>{b.notes.length ? <p className="line-clamp">{b.notes[0].text}</p> : <p>Save selected lesson text here, or write a note.</p>}</Link>)}</div>
  </div></>;
}
