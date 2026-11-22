"use client";

import { DEFAULT_COURSE_OPTIONS, type Auto, type CourseOptions } from "@/lib/course-types";
import { allDesigns, useCertStore } from "@/lib/certificates";
import { CourseLengthForm } from "./CourseLengthForm";
import { CertificateThumb } from "./CertificateView";

function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "is-on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const autoNums = (nums: number[]) => [{ value: "auto" as Auto<number>, label: "Auto" }, ...nums.map((n) => ({ value: n as Auto<number>, label: String(n) }))];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

/** Shared by Settings (defaults) and the course creator (per-course overrides). */
export function CourseOptionsForm({ value, onChange, showCertificate = true, showLength = true }: { value: CourseOptions; onChange: (v: CourseOptions) => void; showCertificate?: boolean; showLength?: boolean }) {
  const set = <K extends keyof CourseOptions>(k: K, v: CourseOptions[K]) => onChange({ ...value, [k]: v });
  const certs = useCertStore();
  const designs = allDesigns(certs);

  const quizRow = (
    on: boolean,
    key: "quizAfterLesson" | "quizAfterSection" | "quizAtEnd",
    qKey: "questionsPerLesson" | "questionsPerSection" | "questionsAtEnd",
    title: string,
    sub: string,
    nums: number[],
  ) => (
    <div className="quiz-opt">
      <div className="toggle-row">
        <span>
          <strong>{title}</strong>
          <small>{sub}</small>
        </span>
        <Switch checked={on} onChange={(v) => set(key, v)} label={title} />
      </div>
      {on && (
        <div className="quiz-opt-count">
          <span className="muted">Questions</span>
          <Seg label={`${title}: number of questions`} value={value[qKey]} options={autoNums(nums)} onChange={(v) => set(qKey, v)} />
        </div>
      )}
    </div>
  );

  return (
    <div className="opts">
      {showLength && <CourseLengthForm value={value} onChange={onChange}/>}
      <div className="opts-group">
        <h3 className="opts-title">How lessons are written</h3>
        <div className="opt-line">
          <span>Lesson type</span>
          <Seg
            label="Lesson type"
            value={value.lessonMode}
            options={[
              { value: "fixed", label: "Fixed" },
              { value: "freeform", label: "Free-form" },
            ]}
            onChange={(v) => set("lessonMode", v)}
          />
        </div>
        <p className="opt-help">
          {value.lessonMode === "fixed"
            ? "Fixed: every lesson follows its plan. Pages that depend on your answers still adapt, but the lesson stays on its path."
            : "Free-form: after the first page, each page is written from your answers: struggling brings a different explanation and easier practice, doing well moves you faster."}
        </p>
        {value.lessonMode === "fixed" ? (
          <>
            <div className="opt-line">
              <span>When to write</span>
              <Seg
                label="When to write"
                value={value.genMode}
                options={[
                  { value: "onthego", label: "As I go" },
                  { value: "all", label: "Everything now" },
                ]}
                onChange={(v) => set("genMode", v)}
              />
            </div>
            <p className="opt-help">
              {value.genMode === "onthego"
                ? "As I go: a page or two is written just ahead of you while you read, so you can start in seconds."
                : "Everything now: the whole course is written in the background, page by page. You'll see how long it will take, and you can start before it finishes."}
            </p>
          </>
        ) : (
          <p className="opt-help">Free-form lessons can&apos;t be written in advance, because each page depends on your answers.</p>
        )}
        <div className="opt-line">
          <span>Memory</span>
          <Seg
            label="Memory"
            value={value.memory}
            options={[
              { value: "global", label: "Everything I learn" },
              { value: "course", label: "This course only" },
              { value: "off", label: "Off" },
            ]}
            onChange={(v) => set("memory", v)}
          />
        </div>
        <p className="opt-help">
          {value.memory === "global"
            ? "Lessons can refer back to anything you've learned, and this course adds to your memory."
            : value.memory === "course"
              ? "Lessons only remember this course, and nothing from it is used elsewhere."
              : "This course won't remember your answers or use what you learned before."}
        </p>
      </div>

      <div className="opts-group">
        <h3 className="opts-title">Lessons</h3>
        <div className="opt-line">
          <span>Style</span>
          <Seg
            label="Lesson style"
            value={value.style}
            options={[
              { value: "auto", label: "My profile" },
              { value: "visual", label: "Visual" },
              { value: "balanced", label: "Balanced" },
              { value: "text", label: "Text-heavy" },
            ]}
            onChange={(v) => set("style", v)}
          />
        </div>
        <div className="opt-line">
          <span>Depth</span>
          <Seg
            label="Depth"
            value={value.depth}
            options={[
              { value: "auto", label: "Auto" },
              { value: "quick", label: "Quick" },
              { value: "standard", label: "Standard" },
              { value: "deep", label: "Deep" },
            ]}
            onChange={(v) => set("depth", v)}
          />
        </div>

      </div>

      <div className="opts-group">
        <h3 className="opts-title">Quizzes</h3>
        {quizRow(value.quizAfterLesson, "quizAfterLesson", "questionsPerLesson", "After every lesson", "A quick check at the end of each lesson", [1, 2, 3])}
        {quizRow(value.quizAfterSection, "quizAfterSection", "questionsPerSection", "After every section", "A short quiz that covers the whole section", [3, 5, 8])}
        {quizRow(value.quizAtEnd, "quizAtEnd", "questionsAtEnd", "At the end of the course", "A final quiz across everything", [5, 10, 15, 20])}
      </div>

      {showCertificate && (
        <div className="opts-group">
          <h3 className="opts-title">Certificate</h3>
          <div className="toggle-row">
            <span>
              <strong>Certificate of completion</strong>
              <small>Awarded when every lesson is done and each quiz is passed (50% or more)</small>
            </span>
            <Switch checked={value.certificate} onChange={(v) => set("certificate", v)} label="Certificate of completion" />
          </div>
          {value.certificate && (
            <div className="cert-pick" role="radiogroup" aria-label="Certificate template">
              {designs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={value.certificateTemplate === d.id}
                  className={`cert-pick-item ${value.certificateTemplate === d.id ? "is-on" : ""}`}
                  onClick={() => set("certificateTemplate", d.id)}
                >
                  <CertificateThumb design={d} data={{ recipient: "Your name", course: "Course title", date: "Today", code: "OTG-0000" }} />
                  <span>{d.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { DEFAULT_COURSE_OPTIONS };
