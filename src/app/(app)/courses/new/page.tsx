"use client";

import { LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CourseLengthForm } from "@/components/CourseLengthForm";
import { useCourses } from "@/lib/courses";
import { courseSize } from "@/lib/course-size";
import { CourseMaterials } from "@/components/CourseMaterials";
import { CourseOptionsForm } from "@/components/CourseOptionsForm";
import { PageHeader } from "@/components/shell/AppShell";
import { createCourse, type OutlineProgress, type PickedFile } from "@/lib/course-gen";
import { useProfile } from "@/lib/profile";
import { useSettings } from "@/lib/settings";
import type { CourseOptions } from "@/lib/course-types";

const SUGGEST: Record<string, string> = {
  Leadership: "Leading a small team",
  Communication: "Clear writing at work",
  "Data & analytics": "Reading charts and data",
  Technology: "How the internet works",
  "Product & strategy": "Product strategy for beginners",
  "Money & finance": "Personal finance basics",
  "Health & wellbeing": "Sleep, stress and energy",
  Science: "How the Earth works",
  Languages: "Learning a language faster",
  Writing: "Writing that people finish reading",
  "Creativity & design": "Design thinking",
  "Critical thinking": "Thinking clearly and spotting bias",
};

export default function NewCoursePage() {
  const router = useRouter();
  const { settings } = useSettings();
  const profile = useProfile();
  const courses = useCourses();
  const [references, setReferences] = useState<string[]>([]);
  const search = useSearchParams();
  const [topic, setTopic] = useState(() => search.get("topic") ?? "");
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("auto");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [reading, setReading] = useState(false);
  const [custom, setCustom] = useState(false);
  const [opts, setOpts] = useState<CourseOptions>(settings.courseDefaults);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<OutlineProgress | null>(null);
  const [err, setErr] = useState("");

  const suggestions = profile.areas.map((a) => SUGGEST[a]).filter(Boolean).concat(Object.values(SUGGEST).slice(0, 4)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);

  const usable = files.filter((f) => f.text);
  const validSize = opts.sizeMode !== "manual" || (Number.isInteger(opts.lessonCount) && (opts.lessonCount ?? 0) >= 1 && (opts.lessonCount ?? 0) <= 40 && typeof opts.pagesPerLesson === "number" && Number.isInteger(opts.pagesPerLesson) && opts.pagesPerLesson >= 1 && opts.pagesPerLesson <= 8);
  const canCreate = (topic.trim().length > 2 || usable.length > 0 || references.length > 0) && validSize && !busy && !reading;

  const create = async () => {
    setBusy(true);
    setErr("");
    try {
      setProgress(null);
      const id = await createCourse({ topic: topic.trim(), level, goal: goal.trim(), options: {...opts,sourcePolicy:usable.length || references.length ? opts.sourcePolicy : "mixed"}, referenceCourseIds: references, files, onProgress: setProgress });
      router.push(`/courses/${id}?gen=1`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't build the course.");
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="New course" subtitle="Describe it, add your material, and choose how it runs" />
      <div className="page-body narrow">
        <section className="card">
          <label className="field">
            <span>What do you want to learn?</span>
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. How to read a balance sheet, for someone who works in product" rows={3} />
          </label>
          {!topic && (
            <div className="chip-wrap" style={{ marginBottom: 14 }}>
              {suggestions.map((s) => (
                <button key={s} type="button" className="pick-chip" onClick={() => setTopic(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <label className="field">
            <span>What is it for? (optional)</span>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. a promotion interview next month" />
          </label>
          <div className="field">
            <span>Level</span>
            <div className="seg" role="radiogroup" aria-label="Level">
              {["auto", "Beginner", "Intermediate", "Advanced"].map((l) => (
                <button key={l} type="button" role="radio" aria-checked={level === l} className={level === l ? "is-on" : ""} onClick={() => setLevel(l)}>
                  {l === "auto" ? "Auto" : l}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card"><CourseLengthForm value={opts} onChange={setOpts}/></section>
        <CourseMaterials files={files} setFiles={setFiles} onReading={setReading} />

        <section className="card">
          <h2>Reference knowledge</h2><p className="hint">Use material from an existing course alongside your sources. Your private answers and chats are excluded.</p>
          {courses.length ? <label className="field"><span>Add a course reference</span><select value="" disabled={references.length >= 6} onChange={e => { if(e.target.value && !references.includes(e.target.value))setReferences([...references,e.target.value]); }}><option value="">Choose a course</option>{courses.filter(c=>!references.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label> : <p className="muted small">Your courses will appear here after you create one.</p>}
          {references.map(id=><div className="row spread" key={id}><span>{courses.find(c=>c.id===id)?.title}</span><button className="btn btn-sm btn-ghost" onClick={()=>setReferences(references.filter(x=>x!==id))} aria-label={`Remove reference ${courses.find(c=>c.id===id)?.title}`}>Remove</button></div>)}
          {(usable.length>0 || references.length>0) && <label className="field"><span>How to use the sources</span><select value={opts.sourcePolicy ?? "mixed"} onChange={e=>setOpts({...opts,sourcePolicy:e.target.value as "strict"|"mixed"})}><option value="strict">Only my sources and course references</option><option value="mixed">My sources plus general knowledge</option></select><small>{opts.sourcePolicy === "strict" ? "Stay within the supplied material. Gaps are called out instead of filled with outside facts." : "Use the supplied material as a foundation, with general knowledge for explanations and examples."}</small></label>}
        </section>
        <section className="card">
          <div className="row spread">
            <div>
              <h2>Course options</h2>
              <p className="hint" style={{ margin: 0 }}>
                {custom ? "Changes here apply to this course only." : "Using your defaults from Settings. Most things are on Auto."}
              </p>
            </div>
            {custom ? (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setOpts(settings.courseDefaults);
                  setCustom(false);
                }}
              >
                <RotateCcw size={15} aria-hidden="true" /> Use defaults
              </button>
            ) : (
              <button
                className="btn btn-sm"
                onClick={() => {
                  setCustom(true);
                }}
              >
                Customize
              </button>
            )}
          </div>
          {!custom && <DefaultsSummary o={opts} />}
          {custom && (
            <div style={{ marginTop: 14 }}>
              <CourseOptionsForm value={opts} onChange={setOpts} showLength={false} />
            </div>
          )}
        </section>

        {err && (
          <p className="form-error" role="alert">
            {err}
          </p>
        )}
        <div className="row create-bar">
          <button className="btn btn-primary" onClick={create} disabled={!canCreate}>
            {busy ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
            {busy ? "Designing your course…" : "Create course"}
          </button>
          <span className="muted small">
            {busy
              ? progress?.retrying
                ? `${progress.retrying} Trying once more…`
                : progress?.note ? progress.note
                : progress && progress.lessons > 0
                  ? `Planning section ${Math.max(1, progress.sections)}: ${progress.lessons} lesson${progress.lessons === 1 ? "" : "s"} so far${progress.title ? ` for “${progress.title}”` : ""}…`
                  : progress && progress.thinking > 0
                    ? "Thinking through how to structure it…"
                    : "Designing the outline. This usually takes under a minute."
              : (custom ? opts : settings.courseDefaults).lessonMode === "fixed" && (custom ? opts : settings.courseDefaults).genMode === "all"
                ? "We'll design the outline, then write every page in the background. You can start learning straight away."
                : "We'll design the outline. Lessons are written page by page as you go, so you can start in seconds."}
          </span>
        </div>
      </div>
    </>
  );
}

function DefaultsSummary({ o }: { o: CourseOptions }) {
  const q = (on: boolean, n: "auto" | number, label: string) => (on ? `${label}${n === "auto" ? "" : ` (${n})`}` : null);
  const parts = [
    o.lessonMode === "freeform" ? "free-form lessons" : o.genMode === "all" ? "fixed lessons, written in advance" : "fixed lessons, written as you go",
    o.style === "auto" ? "style from your profile" : `${o.style} style`,
    o.depth === "auto" ? "auto depth" : `${o.depth} depth`,
    `${courseSize(o).lessons} lesson${courseSize(o).lessons===1?"":"s"}, ${courseSize(o).pages} page${courseSize(o).pages===1?"":"s"} each`,
    q(o.quizAfterLesson, o.questionsPerLesson, "quiz after each lesson"),
    q(o.quizAfterSection, o.questionsPerSection, "quiz after each section"),
    q(o.quizAtEnd, o.questionsAtEnd, "final quiz"),
    o.certificate ? "certificate" : "no certificate",
    o.memory === "global" ? "uses your memory" : o.memory === "course" ? "course-only memory" : "no memory",
  ].filter(Boolean);
  return <p className="defaults-line">{(parts as string[]).join(" · ")}</p>;
}
