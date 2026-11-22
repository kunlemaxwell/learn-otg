"use client";
import { EvidenceButton } from "@/components/EvidenceButton";

import { ArrowLeft, ArrowRight, Check, Clock, LoaderCircle, RefreshCw, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LessonSkeleton } from "@/components/Activity";
import { LessonRenderer } from "@/components/LessonRenderer";
import { LessonTutor, type TutorRequest } from "@/components/LessonTutor";
import { LessonSelection } from "@/components/LessonSelection";
import { OpenQuestionView } from "@/components/lesson-activities";
import { LessonContext } from "@/components/lesson-context";
import { exportCourse } from "@/lib/course-export";
import { ShareBar } from "@/components/ShareBar";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { useChatContext } from "@/lib/chat-store";
import type { Answer, LessonPage } from "@/lib/course-types";
import { allLessons, lessonPages, patchLesson, useCourses } from "@/lib/courses";
import { award } from "@/lib/journey";
import { pageKey, prefetchAround, recordAnswer, rememberLesson, rewritePage, useLivePage, writeNextFromAnswers } from "@/lib/lesson-engine";

const ACTIVITY = /\b(Quiz|OpenQuestion|PhotoAnswer|FlipCards|SortGame|OrderGame|MatchGame|Scenario)\(/g;
const activitiesIn = (code?: string) => (code ? (code.match(ACTIVITY) ?? []).length : 0);

function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [on]);
  return now;
}

export default function LessonPage() {
  const { id, lessonId } = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();
  const mounted = useMounted();
  const courses = useCourses();
  const c = courses.find((x) => x.id === id);
  const flat = useMemo(() => (c ? allLessons(c) : []), [c]);
  const idx = flat.findIndex((x) => x.lesson.id === lessonId);
  const cur = idx >= 0 ? flat[idx] : null;
  const pages: LessonPage[] = useMemo(() => (c && cur ? lessonPages(cur.lesson, c.options) : []), [c, cur]);
  const [pi, setPi] = useState<number | null>(null);
  const pageIndex = Math.min(pi ?? cur?.lesson.page ?? 0, Math.max(0, pages.length - 1));
  const page = pages[pageIndex];
  const key = c && cur && page ? pageKey(c.id, cur.lesson.id, page.id) : null;
  const liveState = useLivePage(key);
  const nextPage = pages[pageIndex + 1];
  const nextKey = c && cur && nextPage ? pageKey(c.id, cur.lesson.id, nextPage.id) : null;
  const nextLive = useLivePage(nextKey);
  const now = useNow(liveState?.status === "waiting");
  const bodyRef = useRef<HTMLDivElement>(null);
  const [tutorRequest, setTutorRequest] = useState<TutorRequest>();
  const ask = (quote?: string, question?: string) => setTutorRequest({ quote, question, serial: Date.now(), lessonId });
  const shareRef = useRef<HTMLDivElement>(null);

  useChatContext(
    c && cur && page
      ? `Course "${c.title}" (${c.level}). Lesson "${cur.lesson.title}": ${cur.lesson.summary}. Page ${pageIndex + 1} of ${pages.length}: "${page.title}" (${page.goal}).`
      : null,
  );

  // Queue this page and the ones just ahead whenever the learner arrives on a page.
  useEffect(() => {
    if (!c || !cur || !page) return;
    prefetchAround(c.id, cur.lesson.id, pageIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id, cur?.lesson.id, pageIndex, page?.status]);

  // Remember where the learner is.
  useEffect(() => {
    if (c && cur && cur.lesson.page !== pageIndex && pi != null) patchLesson(c.id, cur.lesson.id, { page: pageIndex });
  }, [c, cur, pageIndex, pi]);

  // When every activity on this page is answered, start writing the next (adaptive) page straight away.
  // Only graded activities count (moving a simulation slider or guessing isn't "answering").
  const answered = (page?.answers ?? []).filter((a) => a.kind !== "simulation" && a.kind !== "guess").length;
  const needed = activitiesIn(page?.code);
  useEffect(() => {
    if (!c || !cur || !nextPage?.adaptive || nextPage.status !== "idle" || page?.status !== "ready") return;
    if (needed > 0 && answered >= needed) writeNextFromAnswers(c.id, cur.lesson.id, pageIndex + 1);
  }, [c, cur, nextPage, page?.status, answered, needed, pageIndex]);

  useEffect(() => {
    window.scrollTo?.({ top: 0 });
    bodyRef.current?.closest(".shell-main")?.scrollTo({ top: 0 });
  }, [lessonId, pageIndex]);

  const onAnswer = useCallback(
    (a: Answer) => {
      if (c && cur && page) recordAnswer(c.id, cur.lesson.id, page.id, a);
      if (a.correct === true && !(page?.answers ?? []).some(previous => previous.question === a.question && previous.correct === true)) award("quiz-correct", a.question.slice(0, 60));
    },
    [c, cur, page],
  );

  if (!mounted) return <PageHeader title="Lesson" />;
  if (!c || !cur || !page)
    return (
      <>
        <PageHeader title="Lesson" />
        <div className="page-body">
          <div className="empty">
            <h3>Lesson not found</h3>
            <Link href="/courses" className="btn">
              Back to courses
            </Link>
          </div>
        </div>
      </>
    );

  const { lesson, section } = cur;
  const isLastPage = pageIndex === pages.length - 1;
  const prevL = flat[idx - 1];
  const nextL = flat[idx + 1];
  const lessonQuiz = c.quizzes.find((q) => q.kind === "lesson" && q.lessonId === lesson.id);
  const sectionQuiz = c.quizzes.find((q) => q.kind === "section" && q.sectionId === section.id);
  const finalQuiz = c.quizzes.find((q) => q.kind === "final");
  const isLastInSection = section.lessons[section.lessons.length - 1].id === lesson.id;
  const freeform = c.options.lessonMode === "freeform";

  const go = (n: number) => {
    const target = pages[n];
    if (!target) return;
    if (target.adaptive && target.status === "idle") writeNextFromAnswers(c.id, lesson.id, n);
    setPi(n);
  };

  const finish = () => {
    if (!lesson.done) {
      patchLesson(c.id, lesson.id, { done: true });
      award("course-lesson", lesson.title);
      rememberLesson(c.id, lesson.id);
    }
    if (lessonQuiz && (lessonQuiz.score ?? -1) < 0) return router.push(`/courses/${c.id}/quiz/${lessonQuiz.id}`);
    if (isLastInSection && sectionQuiz && sectionQuiz.score == null) return router.push(`/courses/${c.id}/quiz/${sectionQuiz.id}`);
    if (nextL) return router.push(`/courses/${c.id}/lesson/${nextL.lesson.id}`);
    if (finalQuiz && finalQuiz.score == null) return router.push(`/courses/${c.id}/quiz/${finalQuiz.id}`);
    router.push(`/courses/${c.id}`);
  };

  const ready = page.status === "ready" && page.code;
  const streamingCode = liveState?.status === "writing" ? liveState.code : "";
  const code = ready ? page.code! : streamingCode;
  const waiting = !ready && liveState?.status === "waiting";
  const writing = !ready && !waiting && (liveState?.status === "writing" || liveState?.status === "queued" || page.status === "generating");
  const secs = waiting && liveState?.retryAt ? Math.max(0, Math.ceil((liveState.retryAt - now) / 1000)) : 0;
  const adaptingNote = page.adaptive && pageIndex > 0;

  const pageState = (p: LessonPage, i: number) => {
    if (i === pageIndex) return "is-current";
    if (p.status === "ready") return "is-ready";
    if (p.status === "error") return "is-error";
    if (p.status === "generating") return "is-writing";
    return "";
  };

  const nextStatus = (() => {
    if (!nextPage) return null;
    if (nextPage.status === "ready") return "ready";
    if (nextLive?.status === "writing" || nextLive?.status === "queued" || nextPage.status === "generating") return "writing";
    if (nextLive?.status === "waiting") return "waiting";
    if (nextPage.status === "error") return "error";
    return nextPage.adaptive ? "adaptive" : "idle";
  })();

  return (
    <>
      <PageHeader
        title={lesson.title}
        subtitle={`${section.title} · lesson ${section.lessons.findIndex((l) => l.id === lesson.id) + 1} of ${section.lessons.length}`}
        actions={
          <Link href={`/courses/${c.id}`} className="btn btn-sm btn-ghost">
            Course
          </Link>
        }
      />
      <div className={`page-body narrow lesson-with-tools m-${c.mood}`} ref={bodyRef}>
        {pages.length > 1 && (
          <nav className="pager" aria-label="Lesson pages">
            <span className="pager-label">
              Page {pageIndex + 1} of {pages.length}
              {freeform && <span className="pager-mode">Adapts to you</span>}
            </span>
            <ol className="pager-dots">
              {pages.map((p, i) => {
                const reachable = i <= pageIndex || p.status === "ready" || pages[i - 1]?.status === "ready";
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`pager-dot ${pageState(p, i)}`}
                      onClick={() => reachable && go(i)}
                      disabled={!reachable}
                      aria-current={i === pageIndex ? "step" : undefined}
                      aria-label={`Page ${i + 1}: ${p.title}${p.status === "ready" ? "" : p.status === "generating" ? " (being written)" : p.adaptive ? " (written from your answers)" : " (not written yet)"}`}
                      title={p.title}
                    >
                      {p.status === "ready" && i !== pageIndex ? <Check size={12} /> : i + 1}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        {ready && page.adaptedTo && pageIndex > 0 && (
          <p className="adapt-note">
            <Sparkles size={15} aria-hidden="true" /> Written for you from your answers on the last page.
          </p>
        )}

        {!ready && writing && (
          <p className="gen-note" role="status">
            <LoaderCircle size={16} className="spin" aria-hidden="true" />
            {liveState?.status === "queued"
              ? "Starting this page…"
              : adaptingNote
                ? "Adapting this page to your answers…"
                : `Writing page ${pageIndex + 1}…`}
            {liveState?.attempt && liveState.attempt > 1 ? ` (try ${liveState.attempt})` : ""}
          </p>
        )}
        {waiting && (
          <div className="retry-note" role="status">
            <Clock size={16} aria-hidden="true" />
            <span>
              {liveState?.note} Trying again in {secs}s (try {(liveState?.attempt ?? 1) + 1} of 4). Finished pages are saved.
            </span>
            <button className="btn btn-sm" onClick={() => rewritePage(c.id, lesson.id, pageIndex)}>
              Try now
            </button>
          </div>
        )}
        {page.status === "error" && !writing && !waiting && (
          <div className="canvas-error" role="alert">
            <strong>
              <TriangleAlert size={15} aria-hidden="true" /> Couldn&apos;t write this page
            </strong>
            <p>{page.error}</p>
            <p className="muted small">Everything you finished is saved. Trying again continues from this page.</p>
            <button className="btn btn-sm" onClick={() => rewritePage(c.id, lesson.id, pageIndex)}>
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        )}
        {!ready && !code && (writing || waiting || page.status === "idle") && <LessonSkeleton />}

        {code && (
          <LessonSelection title={`${c.title}: ${lesson.title}`} onAsk={quote => ask(quote)}>
          <div ref={shareRef}>
            <LessonRenderer
              key={page.id}
              code={code}
              mood={c.mood}
              streaming={!ready}
              title={lesson.title}
              onAsk={(text) => ask(undefined, text)}
              onAnswer={onAnswer}
              onQuizResult={(r) => {
                patchLesson(c.id, lesson.id, { quizScore: r.correct ? 1 : 0 });
              }}
            />
            {ready && isLastPage && !/\bOpenQuestion\(/.test(code) && <LessonContext.Provider value={{ lessonTitle: lesson.title, lessonContent: code, mood: c.mood, ask: text => ask(undefined, text), onAnswer, onQuizResult: () => {} }}><OpenQuestionView props={{ question: `In your own words, explain the main idea of ${lesson.title.toLowerCase()}.`, modelAnswer: `${lesson.summary} ${page.goal}`, hint: "Use an example from this lesson.", size: "short" }} /></LessonContext.Provider>}
          </div>
          </LessonSelection>
        )}

        {ready && (
          <>
            <div className="lesson-foot">
              {!isLastPage && nextPage && (
                <p className="next-note" role="status">
                  {nextStatus === "ready" && (
                    <>
                      <Check size={14} aria-hidden="true" /> Next page is ready
                    </>
                  )}
                  {nextStatus === "writing" && (
                    <>
                      <LoaderCircle size={14} className="spin" aria-hidden="true" /> {nextPage.adaptive ? "Writing the next page from your answers…" : "Writing the next page while you read…"}
                    </>
                  )}
                  {nextStatus === "waiting" && (
                    <>
                      <Clock size={14} aria-hidden="true" /> Next page will retry shortly
                    </>
                  )}
                  {nextStatus === "adaptive" && (
                    <>
                      <Wand2 size={14} aria-hidden="true" /> {needed > 0 ? "Answer the activities above and the next page adapts to you" : "The next page adapts to how you did here"}
                    </>
                  )}
                  {nextStatus === "error" && (
                    <>
                      <TriangleAlert size={14} aria-hidden="true" /> The next page hit a problem; open it to try again
                    </>
                  )}
                </p>
              )}
              <button className="btn btn-sm btn-ghost" onClick={() => rewritePage(c.id, lesson.id, pageIndex)}>
                <RefreshCw size={14} aria-hidden="true" /> Rewrite this page
              </button>
            </div>
            {lesson.done && isLastPage && <div className="lesson-evidence"><EvidenceButton courseIds={[c.id]} lessonId={lesson.id}/></div>}
            <div className="lesson-nav">
              {pageIndex > 0 ? (
                <button className="btn btn-ghost" onClick={() => go(pageIndex - 1)} aria-label="Previous page">
                  <ArrowLeft size={17} aria-hidden="true" /> <span className="hide-sm">Back</span>
                </button>
              ) : prevL ? (
                <Link href={`/courses/${c.id}/lesson/${prevL.lesson.id}`} className="btn btn-ghost" aria-label="Previous lesson">
                  <ArrowLeft size={17} aria-hidden="true" /> <span className="hide-sm">Previous</span>
                </Link>
              ) : null}
              {isLastPage ? (
                <button className="btn btn-primary lesson-done" onClick={finish}>
                  {lesson.done ? <ArrowRight size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
                  {lesson.done ? "Continue" : nextL ? "Finish lesson and continue" : "Finish lesson"}
                </button>
              ) : (
                <button className="btn btn-primary lesson-done" onClick={() => go(pageIndex + 1)}>
                  {nextStatus === "writing" ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                  <span className="lesson-done-text">Next page{nextPage ? `: ${nextPage.title}` : ""}</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <ShareBar title={lesson.title} text={`I just learned "${lesson.title}" in ${c.title} on Learn OTG.`} targetRef={shareRef} persistent compact onAsk={() => ask()} disabled={!ready} exportAll={(scope, kind, progress) => exportCourse(c, lesson.id, scope, kind, progress)} />
      <LessonTutor key={`${c.id}-${lesson.id}`} lessonKey={`${c.id}:${lesson.id}`} title={lesson.title} sourcePolicy={c.options.sourcePolicy} request={tutorRequest?.lessonId === lessonId ? tutorRequest : undefined} context={`Course: ${c.title} (${c.level})\nLesson: ${lesson.title}: ${lesson.summary}\nCurrent page ${pageIndex + 1}: ${page.title}\n${code}\nLearner's answers: ${JSON.stringify(page.answers ?? [])}\nCourse material: ${c.contextDigest ?? ""}`} />
    </>
  );
}
