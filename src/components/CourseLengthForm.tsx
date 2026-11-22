"use client";
import type { CourseOptions } from "@/lib/course-types";
import { courseSize } from "@/lib/course-size";

export function CourseLengthForm({ value, onChange }: { value: CourseOptions; onChange: (value: CourseOptions) => void }) {
  const mode = value.sizeMode ?? "auto";
  const size = courseSize(value);
  return <div className="opts-group">
    <h3 className="opts-title">Course length</h3>
    <div className="opt-line"><span>Choose the size</span><div className="seg" role="radiogroup" aria-label="Course length mode">{["auto", "manual"].map(option => <button type="button" role="radio" aria-checked={mode === option} className={mode === option ? "is-on" : ""} key={option} onClick={() => onChange({ ...value, sizeMode: option as "auto" | "manual", lessonCount: size.lessons, pagesPerLesson: size.pages })}>{option === "auto" ? "Auto" : "Manual"}</button>)}</div></div>
    {mode === "auto" ? <><div className="seg" role="radiogroup" aria-label="Automatic course length">{(["short", "medium", "detailed"] as const).map(length => <button type="button" role="radio" aria-checked={(value.length ?? "medium") === length} className={(value.length ?? "medium") === length ? "is-on" : ""} key={length} onClick={() => onChange({ ...value, length })}>{length === "short" ? "Short" : length === "medium" ? "Medium" : "Very detailed"}</button>)}</div><p className="opt-help">{size.lessons} lessons · {size.pages} pages per lesson. The outline organizes these into sections.</p></> : <><div className="row"><label className="field"><span>Number of lessons</span><input type="number" min={1} max={40} value={value.lessonCount ?? 12} onChange={e => onChange({ ...value, lessonCount: Number(e.target.value) })}/></label><label className="field"><span>Pages per lesson</span><input type="number" min={1} max={8} value={typeof value.pagesPerLesson === "number" ? value.pagesPerLesson : 3} onChange={e => onChange({ ...value, pagesPerLesson: Number(e.target.value) })}/></label></div><p className="opt-help">Choose 1–40 lessons and 1–8 pages per lesson. One lesson with one page gives you a single article with a practice check.</p><button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange({ ...value, sizeMode: "manual", lessonCount: 1, pagesPerLesson: 1 })}>One-page article</button></>}
  </div>;
}
