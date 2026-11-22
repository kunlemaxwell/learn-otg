"use client";

import { Check, LoaderCircle, RotateCcw, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { generateQuiz } from "@/lib/course-gen";
import { allLessons, patchQuiz, useCourses } from "@/lib/courses";
import { award } from "@/lib/journey";

export default function QuizPage() {
  const { id, quizId } = useParams<{ id: string; quizId: string }>();
  const router = useRouter();
  const mounted = useMounted();
  const courses = useCourses();
  const c = courses.find((x) => x.id === id);
  const q = c?.quizzes.find((x) => x.id === quizId);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [err, setErr] = useState("");
  const requested = useRef(false);

  const status = q?.status;
  useEffect(() => {
    if (!q || requested.current) return;
    if (status === "idle" || status === "error" || (status === "ready" && q.questions.length === 0)) {
      requested.current = true;
      generateQuiz(id, quizId).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't write the quiz."));
    }
  }, [q, status, id, quizId]);

  if (!mounted) return <PageHeader title="Quiz" />;
  if (!c || !q)
    return (
      <>
        <PageHeader title="Quiz" />
        <div className="page-body">
          <div className="empty">
            <h3>Quiz not found</h3>
            <Link href="/courses" className="btn">
              Back to courses
            </Link>
          </div>
        </div>
      </>
    );

  const total = q.questions.length;
  const cur = q.questions[i];
  const flat = allLessons(c);
  const finalQ = c.quizzes.find((x) => x.kind === "final");
  const afterLast = finalQ && finalQ.id !== q.id && finalQ.score == null ? `/courses/${c.id}/quiz/${finalQ.id}` : `/courses/${c.id}`;
  const nextHref = (() => {
    if (q.kind === "final") return `/courses/${c.id}`;
    const anchor = q.kind === "lesson" ? flat.findIndex((x) => x.lesson.id === q.lessonId) : flat.findLastIndex((x) => x.section.id === q.sectionId);
    const nx = flat[anchor + 1];
    return nx ? `/courses/${c.id}/lesson/${nx.lesson.id}` : afterLast;
  })();

  const answer = (n: number) => {
    if (picked != null || !cur) return;
    setPicked(n);
    if (n === cur.answer) setScore((s) => s + 1);
  };

  const advance = () => {
    if (i + 1 < total) {
      setI(i + 1);
      setPicked(null);
      return;
    }
    const pct = score / total;
    const wasPassed = (q.score ?? 0) >= 0.5;
    patchQuiz(c.id, q.id, { score: Math.max(q.score ?? 0, pct), attempts: q.attempts + 1 });
    if (pct >= 0.5 && !wasPassed) award(q.kind === "final" ? "final-quiz" : q.kind === "section" ? "section-quiz" : "quiz-correct", q.title);
    else if (pct > 0) award("quiz-retry", "Quiz retake", Math.max(2, score));
    setFinished(true);
  };

  const retake = () => {
    setI(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  const pct = total ? Math.round((score / total) * 100) : 0;

  return (
    <>
      <PageHeader title={q.title} subtitle={c.title} actions={<Link href={`/courses/${c.id}`} className="btn btn-sm btn-ghost">Course</Link>} />
      <div className={`page-body narrow m-${c.mood}`}>
        {(q.status === "generating" || (q.status !== "error" && total === 0 && !err)) && (
          <div className="empty">
            <LoaderCircle size={28} className="spin" aria-hidden="true" />
            <h3>Writing your quiz…</h3>
            <p>Questions are written from the lessons in this course.</p>
          </div>
        )}
        {(q.status === "error" || err) && total === 0 && (
          <div className="canvas-error" role="alert">
            <strong>
              <TriangleAlert size={15} aria-hidden="true" /> Couldn&apos;t write the quiz
            </strong>
            <p>{err || q.error}</p>
            <button
              className="btn btn-sm"
              onClick={() => {
                setErr("");
                requested.current = true;
                generateQuiz(id, quizId).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't write the quiz."));
              }}
            >
              <RotateCcw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        )}

        {total > 0 && !finished && cur && (
          <section className="qrun card">
            <div className="qrun-top">
              <span className="eyebrow">
                Question {i + 1} of {total}
              </span>
              <div className="progress" aria-hidden="true">
                <i style={{ width: `${((i + (picked != null ? 1 : 0)) / total) * 100}%` }} />
              </div>
            </div>
            <h2 className="qrun-q">{cur.q}</h2>
            <div className="qrun-opts" role="list">
              {cur.options.map((o, n) => {
                const state = picked == null ? "" : n === cur.answer ? "is-right" : n === picked ? "is-wrong" : "is-dim";
                return (
                  <button key={n} role="listitem" className={`qopt ${state}`} onClick={() => answer(n)} disabled={picked != null}>
                    <span className="qopt-key">{String.fromCharCode(65 + n)}</span>
                    <span className="grow">{o}</span>
                    {picked != null && n === cur.answer && <Check size={18} aria-label="Correct" />}
                    {picked != null && n === picked && n !== cur.answer && <X size={18} aria-label="Wrong" />}
                  </button>
                );
              })}
            </div>
            {picked != null && (
              <div className={`qfeed ${picked === cur.answer ? "is-right" : "is-wrong"}`} role="status">
                <strong>{picked === cur.answer ? "Correct." : `The answer is ${cur.options[cur.answer]}.`}</strong> {cur.why}
              </div>
            )}
            {picked != null && (
              <button className="btn btn-primary" onClick={advance}>
                {i + 1 < total ? "Next question" : "See my result"}
              </button>
            )}
          </section>
        )}

        {finished && (
          <section className="card qresult">
            <span className="eyebrow">{pct >= 50 ? "Passed" : "Not yet"}</span>
            <div className="qscore">{pct}%</div>
            <p>
              {score} of {total} correct. {pct >= 50 ? "Nicely done." : "You need 50% to pass. Review the lessons and try again."}
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" onClick={retake}>
                <RotateCcw size={16} aria-hidden="true" /> Retake
              </button>
              <button className="btn btn-primary" onClick={() => router.push(nextHref)}>
                Continue
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
