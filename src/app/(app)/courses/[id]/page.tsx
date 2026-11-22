"use client";
import { EvidenceButton } from "@/components/EvidenceButton";

import { Award, Check, CircleDashed, Clock, FileText, LoaderCircle, Play, Square, Star, Trash2, TriangleAlert, Wand2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { CertificateThumb } from "@/components/CertificateView";
import { findDesign, useEarned } from "@/lib/certificates";
import { allLessons, courseProgress, deleteCourse, lessonState, pendingPages, putCourse, useCourses } from "@/lib/courses";
import { estimateMs, requestPage, startWritingAll, stopCourse, useCourseJobs } from "@/lib/lesson-engine";

function minutes(ms: number) {
  const m = Math.round(ms / 60000);
  return m <= 1 ? "about a minute" : `about ${m} minutes`;
}

export default function CourseOverview() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const mounted = useMounted();
  const courses = useCourses();
  const earned = useEarned();
  const jobs = useCourseJobs(id);
  const c = courses.find((x) => x.id === id);
  const started = useRef(false);

  // Right after creation (?gen=1): get the first page ready, and write everything if that was chosen.
  useEffect(() => {
    if (c && search.get("gen") === "1" && !started.current) {
      started.current = true;
      const first = allLessons(c)[0];
      if (first) requestPage(c.id, first.lesson.id, 0, 0);
      if (c.options.lessonMode === "fixed" && c.options.genMode === "all") startWritingAll(c.id);
      router.replace(`/courses/${id}`);
    }
  }, [c, id, search, router]);

  if (!mounted) return <PageHeader title="Course" />;
  if (!c)
    return (
      <>
        <PageHeader title="Course" />
        <div className="page-body">
          <div className="empty">
            <h3>Course not found</h3>
            <p>It may have been deleted.</p>
            <Link href="/courses" className="btn">
              Back to courses
            </Link>
          </div>
        </div>
      </>
    );

  const flat = allLessons(c);
  const p = courseProgress(c);
  const next = flat.find((x) => !x.lesson.done) ?? flat[0];
  const pending = pendingPages(c).length;
  const writing = Boolean(c.writingAll) || jobs.writing + jobs.queued + jobs.waiting > 0;
  const freeform = c.options.lessonMode === "freeform";
  const cert = earned.find((e) => e.courseId === c.id);
  const failedQuizzes = c.quizzes.filter((q) => (q.score ?? 0) < 0.5 && q.attempts > 0);
  const remainingQuizzes = c.quizzes.filter((q) => (q.score ?? 0) < 0.5);

  return (
    <>
      <PageHeader title="Course" subtitle={c.level} />
      <div className={`page-body m-${c.mood}`}>
        <section className="course-hero">
          <span className="eyebrow">{c.completedAt ? "Completed" : c.level}</span>
          <h1>{c.title}</h1>
          <p>{c.blurb}</p>
          <div className="progress" aria-label={`${Math.round(p.pct * 100)}% complete`}>
            <i style={{ width: `${Math.round(p.pct * 100)}%` }} />
          </div>
          <div className="course-hero-meta">
            <span>
              {p.done} of {p.total} lessons
            </span>
            {c.quizzes.length > 0 && (
              <span>
                {p.quizzes} of {c.quizzes.length} quizzes passed
              </span>
            )}
            {c.files.length > 0 && (
              <span>
                <FileText size={14} aria-hidden="true" /> Built from {c.files.filter((f) => f.chars > 0).length} source{c.files.filter((f) => f.chars > 0).length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="row">
            {next ? (
              <Link href={`/courses/${c.id}/lesson/${next.lesson.id}`} className="btn btn-primary">
                <Play size={16} aria-hidden="true" /> {p.done === 0 ? "Start course" : p.done === p.total ? "Review" : "Continue"}
              </Link>
            ) : null}
            {pending > 0 && !writing && !freeform && (
              <button className="btn" onClick={() => startWritingAll(c.id)} title="Write every page now in the background">
                <Wand2 size={16} aria-hidden="true" /> Write all now
              </button>
            )}
            {writing && (
              <button className="btn" onClick={() => stopCourse(c.id)}>
                <Square size={15} aria-hidden="true" /> Stop writing
              </button>
            )}
            <button className={`icon-btn ${c.saved ? "is-starred" : ""}`} onClick={() => putCourse({ ...c, saved: !c.saved })} aria-pressed={c.saved} aria-label={c.saved ? "Remove from saved" : "Save for later"} title="Save for later">
              <Star size={19} fill={c.saved ? "currentColor" : "none"} />
            </button>
            <button
              className="icon-btn"
              aria-label="Delete course"
              onClick={() => {
                if (window.confirm(`Delete “${c.title}”? This can't be undone.`)) {
                  deleteCourse(c.id);
                  router.push("/courses");
                }
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
          {jobs.waiting > 0 && (
            <div className="gen-note" role="status">
              <Clock size={16} aria-hidden="true" />
              <span>
                {jobs.note} Retrying {jobs.retryAt ? "shortly" : "soon"}. Finished pages are saved.
              </span>
            </div>
          )}
          {c.writingAll && jobs.waiting === 0 && (
            <div className="gen-note" role="status">
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
              <span>
                Writing the course: {pending} page{pending === 1 ? "" : "s"} to go, {minutes(estimateMs(pending))}. Start learning now; finished pages are saved as they land, and it picks up where it left off if you close the app.
              </span>
            </div>
          )}
          {!c.writingAll && pending === 0 && !freeform && c.options.genMode === "all" && !c.completedAt && (
            <p className="hero-note">
              <Check size={14} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Course written. Pages that adapt to your answers are written when you reach them.
            </p>
          )}
          {!c.writingAll && pending > 0 && jobs.waiting === 0 && (
            <p className="hero-note">
              {freeform
                ? "Free-form: each page is written from your answers as you go, so there's nothing to wait for up front."
                : "Pages are written as you go, a page or two ahead of you, so you can start straight away."}
            </p>
          )}
        </section>

        <div className="course-sections">
          {c.sections.map((s, si) => {
            const sq = c.quizzes.find((q) => q.kind === "section" && q.sectionId === s.id);
            return (
              <section key={s.id} className="card csec">
                <div className="csec-head">
                  <span className="csec-num">{si + 1}</span>
                  <div>
                    <h2>{s.title}</h2>
                    <p className="hint" style={{ margin: 0 }}>
                      {s.summary}
                    </p>
                  </div>
                </div>
                <ol className="clist">
                  {s.lessons.map((l) => {
                    const lq = c.quizzes.find((q) => q.kind === "lesson" && q.lessonId === l.id);
                    const st = lessonState(l, c.options);
                    return (
                      <li key={l.id}>
                        <Link href={`/courses/${c.id}/lesson/${l.id}`} className="clesson">
                          <span className={`cstate ${l.done ? "is-done" : st.started ? "is-ready" : ""}`} aria-hidden="true">
                            {l.done ? <Check size={14} /> : st.writing ? <LoaderCircle size={14} className="spin" /> : st.failed ? <TriangleAlert size={14} /> : st.started ? <Play size={12} /> : <CircleDashed size={14} />}
                          </span>
                          <span className="grow">
                            <strong>{l.title}</strong>
                            <small>
                              {l.done
                                ? "Done"
                                : st.writing
                                  ? `Writing… ${st.ready} of ${st.total} pages ready`
                                  : st.failed
                                    ? "A page needs another try"
                                    : st.allReady
                                      ? `Ready · ${st.total} pages`
                                      : st.readyAhead && st.started
                                        ? `Ready · ${st.total} pages, ${st.total - st.ready === 1 ? "the last adapts" : `${st.total - st.ready} adapt`} to your answers`
                                      : st.started
                                        ? `${st.ready} of ${st.total} pages ready${freeform ? " · the rest adapt to you" : ""}`
                                        : `${st.total} pages · written when you start`}
                            </small>
                          </span>
                        </Link>
                        {lq && (
                          <Link href={`/courses/${c.id}/quiz/${lq.id}`} className="cquiz is-sub">
                            <span>Lesson quiz</span>
                            <small>{lq.score != null ? `${Math.round(lq.score * 100)}%` : "Not taken"}</small>
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
                {sq && (
                  <Link href={`/courses/${c.id}/quiz/${sq.id}`} className="cquiz">
                    <span>Section quiz</span>
                    <small>{sq.score != null ? `${Math.round(sq.score * 100)}%${sq.score >= 0.5 ? " · passed" : ""}` : "Not taken"}</small>
                  </Link>
                )}
              </section>
            );
          })}

          {c.quizzes
            .filter((q) => q.kind === "final")
            .map((q) => (
              <Link key={q.id} href={`/courses/${c.id}/quiz/${q.id}`} className="card final-quiz">
                <div>
                  <span className="eyebrow">Final quiz</span>
                  <strong>Test everything you&apos;ve learned</strong>
                </div>
                <small>{q.score != null ? `${Math.round(q.score * 100)}%${q.score >= 0.5 ? " · passed" : ""}` : "Not taken"}</small>
              </Link>
            ))}
        </div>

        {c.completedAt && <section className="card"><h2>Your learning record</h2><p className="hint">Turn your completed learning into a summary you can share.</p><EvidenceButton courseIds={[c.id]}/></section>}
        {c.options.certificate && (
          <section className="card cert-card">
            <h2>
              <Award size={19} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Certificate of completion
            </h2>
            {cert ? (
              <>
                <CertificateThumb
                  design={findDesign(cert.designId)}
                  data={{ recipient: cert.recipient, course: cert.courseTitle, date: new Date(cert.issuedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }), code: cert.code }}
                />
                <div className="row" style={{ marginTop: 12 }}>
                  <Link href="/certificates" className="btn btn-primary btn-sm">
                    Open and download
                  </Link>
                </div>
              </>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                {p.total - p.done > 0 ? `Finish ${p.total - p.done} more lesson${p.total - p.done === 1 ? "" : "s"}` : "All lessons done"}
                {remainingQuizzes.length > 0 ? `${p.total - p.done > 0 ? " and p" : "P"}ass ${remainingQuizzes.length} quiz${remainingQuizzes.length === 1 ? "" : "zes"} (50% or more)` : ""} to earn it.
                {failedQuizzes.length > 0 ? " You can retake any quiz." : ""}
              </p>
            )}
          </section>
        )}
      </div>
    </>
  );
}
