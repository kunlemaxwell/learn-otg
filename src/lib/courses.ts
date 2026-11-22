"use client";
import { createStore, uid } from "./local-store";
import type { Course, CourseLesson, CourseOptions, CourseQuiz, CourseSection, LessonPage, PagePlan } from "./course-types";
import { DEFAULT_COURSE_OPTIONS } from "./course-types";

function migrate(raw: unknown): Course[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Course[]).map((c) => ({ ...c, options: { ...DEFAULT_COURSE_OPTIONS, ...(c.options ?? {}) } }));
}

const store = createStore<Course[]>("learn-otg:courses:v1", [], migrate);

export const useCourses = () => store.useValue();
export const readCourses = () => store.get();

export function getCourse(id: string): Course | undefined {
  return store.get().find((c) => c.id === id);
}

export function putCourse(course: Course) {
  const list = store.get();
  const next = list.some((c) => c.id === course.id)
    ? list.map((c) => (c.id === course.id ? { ...course, updatedAt: Date.now() } : c))
    : [{ ...course, updatedAt: Date.now() }, ...list];
  store.set(next);
}

export function patchCourse(id: string, fn: (c: Course) => Course) {
  const c = getCourse(id);
  if (c) putCourse(fn(c));
}

export function patchLesson(courseId: string, lessonId: string, patch: Partial<CourseLesson> | ((l: CourseLesson) => CourseLesson)) {
  patchCourse(courseId, (c) => ({
    ...c,
    sections: c.sections.map((s) => ({
      ...s,
      lessons: s.lessons.map((l) => (l.id === lessonId ? (typeof patch === "function" ? patch(l) : { ...l, ...patch }) : l)),
    })),
  }));
}

/** Update one page of a lesson. Creates the page list from the plan if the lesson has none yet. */
export function patchPage(courseId: string, lessonId: string, pageId: string, patch: Partial<LessonPage> | ((p: LessonPage) => LessonPage)) {
  const c = getCourse(courseId);
  if (!c) return;
  patchLesson(courseId, lessonId, (l) => {
    const pages = lessonPages(l, c.options);
    return { ...l, pages: pages.map((p) => (p.id === pageId ? (typeof patch === "function" ? patch(p) : { ...p, ...patch }) : p)) };
  });
}

export function patchQuiz(courseId: string, quizId: string, patch: Partial<CourseQuiz>) {
  patchCourse(courseId, (c) => ({ ...c, quizzes: c.quizzes.map((q) => (q.id === quizId ? { ...q, ...patch } : q)) }));
}

export function deleteCourse(id: string) {
  store.set(store.get().filter((c) => c.id !== id));
}

export function allLessons(c: Course): { section: CourseSection; lesson: CourseLesson }[] {
  return c.sections.flatMap((section) => section.lessons.map((lesson) => ({ section, lesson })));
}

/* ---------- Pages ---------- */

function pageCount(o: CourseOptions): number {
  if (typeof o.pagesPerLesson === "number") return o.pagesPerLesson;
  return o.depth === "quick" ? 2 : o.depth === "deep" ? 4 : 3;
}

/** Pages to use when the outline didn't plan any. */
export function defaultPlan(lesson: Pick<CourseLesson, "title" | "summary">, o: CourseOptions): PagePlan[] {
  const n = pageCount(o);
  const all: PagePlan[] = [
    { title: lesson.title, goal: `Open the lesson and explain the core idea: ${lesson.summary}` },
    { title: "How it works", goal: "Show the mechanics with the format that suits the content: a visual, a worked example, a simulation or a scenario." },
    { title: "Put it to work", goal: "Apply the idea: a realistic scenario, a game or practice, then check understanding.", adaptive: true },
    { title: "Go further", goal: "Edge cases, common mistakes and how it connects to what comes next, then wrap up.", adaptive: true },
  ];
  if (n === 1) return [{ title: lesson.title, goal: `Explain the core idea, show one example and check understanding: ${lesson.summary}` }];
  if (n <= 2) return [all[0], { ...all[2], title: "Try it yourself" }];
  if (n === 3) return all.slice(0, 3);
  const extra = Array.from({ length: Math.max(0, n - 4) }, (_, i) => ({ title: `Practice ${i + 1}`, goal: "More practice at a slightly harder level, shaped by earlier answers.", adaptive: true }));
  return [...all, ...extra];
}

/** The lesson's pages, creating them from the plan (and folding in single-page lessons from older versions). */
export function lessonPages(l: CourseLesson, o: CourseOptions): LessonPage[] {
  if (l.pages?.length) return l.pages;
  if (l.code) {
    return [{ id: `${l.id}-p0`, title: l.title, goal: l.summary, status: "ready", code: l.code }];
  }
  const want = pageCount(o);
  const fallback = defaultPlan(l, o);
  const planned = l.plan?.length ? l.plan : fallback;
  const plan = typeof o.pagesPerLesson === "number" ? Array.from({length:want},(_,i)=>planned[i] ?? fallback[i]) : planned.slice(0,8);
  return plan.map((p, i) => ({
    id: `${l.id}-p${i}`,
    title: p.title,
    goal: p.goal,
    adaptive: i > 0 && (o.lessonMode === "freeform" || Boolean(p.adaptive)),
    status: "idle",
  }));
}

export function lessonState(l: CourseLesson, o: CourseOptions) {
  const pages = lessonPages(l, o);
  const ready = pages.filter((p) => p.status === "ready").length;
  return {
    pages,
    ready,
    total: pages.length,
    writing: pages.some((p) => p.status === "generating"),
    failed: pages.some((p) => p.status === "error"),
    started: ready > 0,
    allReady: ready === pages.length,
    /** Everything that can be written ahead is written; the rest waits for the learner's answers. */
    readyAhead: pages.every((p) => p.status === "ready" || (p.adaptive && p.status === "idle")),
  };
}

/* ---------- Progress ---------- */

export function courseProgress(c: Course) {
  const ls = allLessons(c);
  const done = ls.filter((x) => x.lesson.done).length;
  const quizzes = c.quizzes.filter((q) => (q.score ?? 0) >= 0.5).length;
  return { done, total: ls.length, pct: ls.length ? done / ls.length : 0, quizzes, quizTotal: c.quizzes.length };
}

/** Pages still to write, across the course (adaptive pages are written when the learner gets there). */
export function pendingPages(c: Course) {
  const out: { lessonId: string; page: LessonPage; index: number }[] = [];
  for (const { lesson } of allLessons(c)) {
    lessonPages(lesson, c.options).forEach((page, index) => {
      if (page.status !== "ready" && !page.adaptive) out.push({ lessonId: lesson.id, page, index });
    });
  }
  return out;
}

/** Build the quiz placeholders implied by the options. */
export function planQuizzes(sections: CourseSection[], opts: Course["options"]): CourseQuiz[] {
  const out: CourseQuiz[] = [];
  // One in-lesson check comes with the lesson itself; two or more questions get a separate lesson quiz.
  if (opts.quizAfterLesson && typeof opts.questionsPerLesson === "number" && opts.questionsPerLesson >= 2)
    for (const s of sections)
      for (const l of s.lessons)
        out.push({
          id: uid(),
          kind: "lesson",
          sectionId: s.id,
          lessonId: l.id,
          title: `${l.title}: quiz`,
          status: "idle",
          questions: [],
          attempts: 0,
        });
  if (opts.quizAfterSection)
    for (const s of sections)
      out.push({
        id: uid(),
        kind: "section",
        sectionId: s.id,
        title: `${s.title}: section quiz`,
        status: "idle",
        questions: [],
        attempts: 0,
      });
  if (opts.quizAtEnd)
    out.push({ id: uid(), kind: "final", title: "Final quiz", status: "idle", questions: [], attempts: 0 });
  return out;
}

export function isComplete(c: Course): boolean {
  const p = courseProgress(c);
  if (p.total === 0 || p.done < p.total) return false;
  return c.quizzes.every((q) => (q.score ?? 0) >= 0.5);
}
