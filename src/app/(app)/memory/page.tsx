"use client";

import { Brain, Lightbulb, NotebookPen, Plus, RotateCcw, Sparkles, Target, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { useCourses } from "@/lib/courses";
import { relativeTime, useHistory } from "@/lib/history";
import { forget, forgetAll, remember, useMemory, type MemoryKind } from "@/lib/learner-memory";
import { useProfile } from "@/lib/profile";
import { useSettings } from "@/lib/settings";
import { suggestionsFor } from "@/lib/suggestions";

const KINDS: { id: MemoryKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "learned", label: "Learned" },
  { id: "struggled", label: "Found hard" },
  { id: "note", label: "Notes" },
  { id: "interest", label: "Interests" },
];
const ICON: Record<MemoryKind, typeof Brain> = { learned: Lightbulb, struggled: RotateCcw, note: NotebookPen, interest: Target };

/** What Learn OTG remembers about your learning, and what it suggests next. */
export function MemoryContent({ full = false }: { full?: boolean }) {
  const mounted = useMounted();
  const memory = useMemory();
  const courses = useCourses();
  const chats = useHistory();
  const profile = useProfile();
  const { settings, update } = useSettings();
  const [kind, setKind] = useState<MemoryKind | "all">("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const [note, setNote] = useState("");
  const suggestions = useMemo(() => suggestionsFor({ profile, courses, memory, chats, auto: true }), [profile, courses, memory, chats]);
  const shown = memory.filter((m) => (kind === "all" || m.kind === kind) && `${m.text} ${m.topic}`.toLowerCase().includes(search.toLowerCase()));
  const courseName = (id?: string) => courses.find((c) => c.id === id)?.title;

  const addNote = () => {
    if (!note.trim()) return;
    remember({ kind: "note", text: note.trim(), topic: "Note", scope: "global" });
    setNote("");
  };

  if (!mounted) return <PageHeader title="Memory" />;
  return (
    <>
      <PageHeader title={full ? "All memory" : "Memory"} subtitle="What lessons know about your learning" actions={full ? <Link href="/memory" className="btn btn-sm">Back to overview</Link> : <Link href="/notebooks" className="btn btn-sm">Notebooks</Link>} />
      <div className="page-body narrow">
        <section className="card mem-switches">
          <div className="toggle-row">
            <span>
              <strong>Memory is {settings.memory ? "on" : "off"}</strong>
              <small>{settings.memory ? "Lessons build on what you've learned and revisit what you found hard." : "Nothing new is remembered and lessons don't use your history."}</small>
            </span>
            <button type="button" role="switch" aria-checked={settings.memory} aria-label="Memory" className="switch" onClick={() => update({ ...settings, memory: !settings.memory })} />
          </div>
          <div className="toggle-row">
            <span>
              <strong>Suggestions are {settings.autoSuggest ? "on" : "off"}</strong>
              <small>Ideas for what to learn next on the Learn page.</small>
            </span>
            <button type="button" role="switch" aria-checked={settings.autoSuggest} aria-label="Suggestions" className="switch" onClick={() => update({ ...settings, autoSuggest: !settings.autoSuggest })} />
          </div>
        </section>

        {!full && settings.autoSuggest && suggestions.length > 0 && (
          <section className="card">
            <h2>
              <Sparkles size={18} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Suggested for you
            </h2>
            <ul className="sugg-list">
              {suggestions.slice(0, 3).map((s) => (
                <li key={s.label}>
                  <Link href={s.href ?? `/chats/new?q=${encodeURIComponent(s.ask ?? s.label)}`} className="sugg">
                    <span aria-hidden="true">{s.icon}</span>
                    <span className="grow">
                      <strong>{s.label}</strong>
                      {s.reason && <small>{s.reason}</small>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!full && <section className="card">
          <h2>Tell it something to remember</h2>
          <p className="hint">Goals, context or preferences, e.g. “I&apos;m preparing for a PMP exam in March” or “I prefer examples from banking”.</p>
          <div className="goal-add">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Add a note" aria-label="Add a note to memory" disabled={!settings.memory} />
            <button className="btn btn-sm btn-primary" onClick={addNote} disabled={!note.trim() || !settings.memory}>
              <Plus size={16} aria-hidden="true" /> Add
            </button>
          </div>
        </section>}

        <section className="card">
          <div className="row spread">
            <h2 style={{ margin: 0 }}>Remembered ({memory.length})</h2>
            {memory.length > 0 && (
              <button className="btn btn-sm btn-danger" onClick={() => window.confirm("Forget everything?") && forgetAll()}>
                <Trash2 size={15} aria-hidden="true" /> Forget all
              </button>
            )}
          </div>
          <div className="seg" role="radiogroup" aria-label="Filter" style={{ margin: "12px 0" }}>
            {KINDS.map((k) => (
              <button key={k.id} role="radio" aria-checked={kind === k.id} className={kind === k.id ? "is-on" : ""} onClick={() => { setKind(k.id); setLimit(10); }}>
                {k.label}
              </button>
            ))}
          </div>
          {full && <label className="field"><span>Search memory</span><input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(10); }} placeholder="Find a topic or remembered detail" /></label>}
          {shown.length === 0 ? (
            <div className="empty" style={{ padding: "24px 8px" }}>
              <span className="empty-icon">
                <Brain size={26} />
              </span>
              <p>{memory.length === 0 ? "Nothing yet. Finish a lesson or answer some questions and it will show up here." : "Nothing in this group."}</p>
            </div>
          ) : (
            <ul className="mem-list">
              {shown.slice(0, full ? limit : 3).map((m) => {
                const Icon = ICON[m.kind];
                return (
                  <li key={m.id} className={`mem-item is-${m.kind}`}>
                    <span className="mem-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="grow">
                      <details><summary className="mem-text line-clamp">{m.text}</summary><p>{m.text}</p></details>
                      <small>
                        {m.topic !== "Note" ? `${m.topic} · ` : ""}
                        {m.scope === "course" ? `only for “${courseName(m.courseId) ?? "a course"}” · ` : ""}
                        {relativeTime(m.ts)}
                      </small>
                    </span>
                    <button className="icon-btn" onClick={() => forget(m.id)} aria-label="Forget this">
                      <Trash2 size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!full && shown.length > 3 && <Link href="/memory/all" className="btn btn-sm">View all memory ({shown.length})</Link>}
          {full && shown.length > limit && <button className="btn btn-sm" onClick={() => setLimit(n => n + 10)}>View 10 more</button>}
        </section>
      </div>
    </>
  );
}

export default function MemoryPage() { return <MemoryContent />; }
