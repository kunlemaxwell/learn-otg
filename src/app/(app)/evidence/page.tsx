"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shell/AppShell";
import { isComplete, useCourses } from "@/lib/courses";
import { generateEvidence, useEvidence } from "@/lib/completion-evidence";
export default function EvidenceLibrary() {
  const courses = useCourses().filter(isComplete);
  const records = useEvidence();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"course" | "lesson">("course");
  const [limit, setLimit] = useState(6);
  const router = useRouter();
  const filtered = records.filter(e => kind === "lesson" ? !!e.lessonId : !e.lessonId);
  return <>
    <PageHeader title="Completion evidence" subtitle="A learning record you can share" />
    <main className="page-body">
      <section className="card">
        <div className="row spread"><h2>Your completed learning</h2><Link href="/settings?s=lessons" className="link-btn">Generation settings</Link></div>
        <p className="hint">Choose one course or combine several into one learning profile.</p>
        {!courses.length ? <p className="hint">Finish a course to create its evidence. Finished lessons have their own Generate completion evidence action.</p> : <>
          <div className="evidence-course-list">{courses.map(c => <label key={c.id}>
            <input type="checkbox" aria-label={`Include ${c.title}`} checked={selected.includes(c.id)} disabled={!selected.includes(c.id) && selected.length >= 12} onChange={e => setSelected(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))} />
            <span>{c.title}</span><small>Completed</small>
          </label>)}</div>
          <button className="btn btn-primary btn-sm" disabled={!selected.length || busy} onClick={async () => {
            setBusy(true); setError("");
            try { const e = await generateEvidence(selected); router.push(`/evidence/${e.id}`); }
            catch (err) { setError(err instanceof Error ? err.message : "Try again."); }
            finally { setBusy(false); }
          }}><Sparkles size={16} />{busy ? "Writing evidence…" : "Generate completion evidence"}</button>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
      <section>
        <div className="row spread"><h2>Saved learning records</h2><div className="seg" role="group" aria-label="Evidence type">
          {(["course", "lesson"] as const).map(value => <button key={value} className={kind === value ? "is-on" : ""} aria-pressed={kind === value} onClick={() => { setKind(value); setLimit(6); }}>{value === "course" ? "Courses" : "Lessons"}</button>)}
        </div></div>
        {filtered.length ? <>
          <div className="notebook-grid">{filtered.slice(0, limit).map(e => <Link key={e.id} href={`/evidence/${e.id}`} className="card evidence-record-card">
            <Award size={20} /><h3>{e.title}</h3><p>{e.counts.lessons} {e.counts.lessons === 1 ? "lesson" : "lessons"} · {e.counts.quizzes} {e.counts.quizzes === 1 ? "quiz" : "quizzes"}</p>
            <small>{e.status === "ready" ? "Ready to share" : e.status === "generating" ? "Writing summary…" : "Needs a retry"}</small>
          </Link>)}</div>
          {filtered.length > limit && <button className="btn btn-sm" onClick={() => setLimit(n => n + 6)}>View more ({filtered.length - limit})</button>}
        </> : <p className="hint">Your generated {kind === "course" ? "course" : "lesson"} summaries will appear here.</p>}
      </section>
    </main>
  </>;
}
