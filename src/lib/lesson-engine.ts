"use client";
// Writes course lessons one PAGE at a time.
//
// - Each page is its own short model call, saved the moment it finishes (a checkpoint):
//   stopping, an error or a reload never loses finished pages, and writing resumes from the next one.
// - Pages are queued with priorities: the page the learner is waiting for first, then the pages
//   just ahead of them, then (when "write everything now" is on) the rest of the course.
// - Failed calls are retried with backoff. Rate limits wait (60 s, or what the provider asks).
//   A stream that goes quiet is cut off and retried instead of spinning forever.
// - Adaptive pages are only written once the learner has answered the page before, using those answers.
// - A page left "generating" by a closed or reloaded tab is spotted by its stale heartbeat and reset.
import { useSyncExternalStore } from "react";
import type { Answer, Course, CourseLesson, LessonPage } from "./course-types";
import { allLessons, getCourse, lessonPages, patchCourse, patchLesson, patchPage, patchQuiz, readCourses } from "./courses";
import { extractCode, recapLesson } from "./lesson-code";
import { lessonGist, memoryContext, remember } from "./learner-memory";
import { mockFlag } from "./mock-flag";
import { profileContext, readProfile } from "./profile";
import type { PageBrief } from "./prompt";
import { currentModel } from "./settings";

/* ---------- Live state (memory only) ---------- */

export type LivePage = {
  status: "queued" | "writing" | "waiting";
  code: string; // what has streamed in so far
  attempt: number;
  retryAt?: number; // when waiting before a retry
  note?: string; // why it is waiting
  startedAt: number;
};

type Job = { key: string; courseId: string; lessonId: string; pageId: string; priority: number; seq: number };

const live = new Map<string, LivePage>();
const queue: Job[] = [];
const running = new Map<string, AbortController>();
const runningPriority = new Map<string, number>();
const subs = new Set<() => void>();
let seq = 0;
let version = 0;

const notify = () => {
  version++;
  subs.forEach((f) => f());
};
const setLive = (key: string, v: LivePage | null) => {
  if (v) live.set(key, v);
  else live.delete(key);
  notify();
};

export const pageKey = (courseId: string, lessonId: string, pageId: string) => `${courseId}:${lessonId}:${pageId}`;

const MAX_ATTEMPTS = 4;
const HEARTBEAT_MS = 5_000;
const ORPHAN_MS = 20_000;
const stallMs = () => (mockFlag() ? 8_000 : 75_000);
const attemptCapMs = () => (mockFlag() ? 30_000 : 4 * 60_000);
const concurrency = () => (currentModel().model.lean ? 1 : 2);

/* ---------- Errors ---------- */

class PageError extends Error {
  retryable: boolean;
  waitMs: number;
  constructor(message: string, retryable: boolean, waitMs = 0) {
    super(message);
    this.retryable = retryable;
    this.waitMs = waitMs;
  }
}

function classify(status: number, message: string, retryAfter?: number): PageError {
  if (status === 429 || /rate.?limit|429|tokens a minute/i.test(message)) {
    const secs = retryAfter && retryAfter > 0 ? retryAfter : mockFlag() ? 3 : 60;
    return new PageError(message || "Rate limit reached.", true, secs * 1000);
  }
  if (status === 401 || status === 403 || status === 404 || status === 400 || status === 413 || /API key|missing|isn't enabled/i.test(message))
    return new PageError(message || `Request failed (${status}).`, false);
  return new PageError(message || `Request failed (${status}).`, true);
}

const backoff = (attempt: number) => (mockFlag() ? 1000 : [5_000, 15_000, 45_000][Math.min(attempt - 1, 2)]);

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/* ---------- Building the request for one page ---------- */

function outlineText(c: Course): string {
  return c.sections.map((s, i) => `${i + 1}. ${s.title}: ${s.lessons.map((l) => l.title).join(" | ")}`).join("\n");
}

const verdict = (a: Answer) => (a.correct === true ? "right" : a.correct === false ? "wrong" : a.score != null ? `${Math.round(a.score * 100)}%` : "not marked");

export function answersSummary(pages: LessonPage[], upTo: number): string {
  const lines: string[] = [];
  pages.slice(0, upTo).forEach((p, i) => {
    for (const a of p.answers ?? []) lines.push(`- Page ${i + 1} (${a.kind}) "${a.question.slice(0, 120)}": ${a.response.slice(0, 160)} [${verdict(a)}]`);
  });
  return lines.join("\n").slice(0, 1600);
}

function buildBody(c: Course, lesson: CourseLesson, pageIndex: number, attempt: number) {
  const { s, model, params } = currentModel();
  const profile = readProfile();
  const o = c.options;
  const flat = allLessons(c);
  const pos = flat.findIndex((x) => x.lesson.id === lesson.id);
  const section = flat[pos].section;
  const sIdx = c.sections.findIndex((x) => x.id === section.id);
  const lIdx = section.lessons.findIndex((x) => x.id === lesson.id);
  const pages = lessonPages(lesson, o);
  const page = pages[pageIndex];
  const noCheck = !o.quizAfterLesson || (typeof o.questionsPerLesson === "number" && o.questionsPerLesson >= 2);

  const previous = pages
    .slice(0, pageIndex)
    .map((p, i) => `${i + 1}. ${p.title}: ${p.code ? recapLesson(p.code) : p.goal}`)
    .join("\n")
    .slice(0, 1800);
  const answers = answersSummary(pages, pageIndex);
  const brief: PageBrief = {
    index: pageIndex,
    total: pages.length,
    title: page.title,
    goal: page.goal,
    isLast: pageIndex === pages.length - 1,
    adaptive: Boolean(page.adaptive),
    freeform: o.lessonMode === "freeform",
    previous,
    answers: answers || undefined,
    later: pages
      .slice(pageIndex + 1)
      .map((p) => p.title)
      .join("; "),
  };
  const fail = mockFlag() && attempt === 1 ? sessionMockFail() : undefined;
  return {
    // After two failed tries, switch to another provider's model (when there is one) instead of hammering the same one.
    allowBackup: s.backupModel,
    useBackup: attempt >= 3 && s.backupModel,
    model: model.id,
    params,
    messages: [{ role: "user", content: `Teach this lesson: ${lesson.title}` }],
    // Only the first page looks things up; later pages build on it (faster, fewer calls).
    browsing: s.browsing && o.sourcePolicy !== "strict" && c.files.length === 0 && pageIndex === 0,
    mock: mockFlag(),
    componentMode: "off",
    instant: false,
    profile: profileContext({ ...profile, style: o.style === "auto" ? profile.style : o.style }),
    progress: [],
    learned: o.sourcePolicy === "strict" ? undefined : memoryContext(`${c.title} ${lesson.title} ${lesson.summary}`, { courseId: c.id, scope: o.memory }) || undefined,
    mockFail: fail,
    course: {
      title: c.title,
      section: section.title,
      lesson: lesson.title,
      summary: `${lesson.summary}${lesson.notes ? `\nMaterial to use: ${lesson.notes}` : ""}`,
      index: `Section ${sIdx + 1} of ${c.sections.length}, lesson ${lIdx + 1} of ${section.lessons.length}`,
      outline: outlineText(c),
      level: c.level,
      depth: o.depth === "auto" ? undefined : o.depth,
      noCheck,
      contextDigest: c.contextDigest,
      sourcePolicy: o.sourcePolicy,
      mood: c.mood,
      page: brief,
    },
  };
}

/** Demo only: see mock-flag.ts. */
function sessionMockFail(): "429" | "500" | "stall" | undefined {
  try {
    const v = window.sessionStorage.getItem("learn-otg:mockfail");
    return v === "429" || v === "500" || v === "stall" ? v : undefined;
  } catch {
    return undefined;
  }
}

/* ---------- One attempt at one page ---------- */

async function streamOnce(job: Job, attempt: number, signal: AbortSignal, onText: (code: string) => void): Promise<string> {
  const c = getCourse(job.courseId);
  const lesson = c && allLessons(c).find((x) => x.lesson.id === job.lessonId)?.lesson;
  if (!c || !lesson) throw new PageError("This lesson no longer exists.", false);
  const pages = lessonPages(lesson, c.options);
  const idx = pages.findIndex((p) => p.id === job.pageId);
  if (idx < 0) throw new PageError("This page no longer exists.", false);

  const ctrl = new AbortController();
  const stop = () => ctrl.abort();
  signal.addEventListener("abort", stop, { once: true });
  let stalled = false;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  const armStall = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      stalled = true;
      ctrl.abort();
    }, stallMs());
  };
  const cap = setTimeout(() => {
    stalled = true;
    ctrl.abort();
  }, attemptCapMs());

  try {
    armStall();
    let res: Response;
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(c, lesson, idx, attempt)),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (signal.aborted) throw e;
      if (stalled) throw new PageError("The model took too long to start.", true);
      throw new PageError("Couldn't reach the app server. Check your connection.", true);
    }
    if (!res.ok || !res.body) {
      const j = (await res.json().catch(() => ({}))) as { error?: string; retryAfter?: number };
      throw classify(res.status, j.error ?? "", j.retryAfter);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    let lastBeat = Date.now();
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (e) {
        if (signal.aborted) throw e;
        if (stalled) throw new PageError("The model stopped responding part-way through.", true);
        throw new PageError("The connection dropped part-way through.", true);
      }
      if (chunk.done) break;
      armStall();
      buf += dec.decode(chunk.value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.trim()) continue;
        let e: { type: string; text?: string; message?: string; status?: number; retryAfter?: number };
        try {
          e = JSON.parse(l);
        } catch {
          continue;
        }
        if (e.type === "content" && e.text) {
          text += e.text;
          onText(extractCode(text) ?? "");
        } else if (e.type === "reset") text = "";
        else if (e.type === "error") throw classify(e.status ?? 500, e.message ?? "The model stopped with an error.", e.retryAfter);
      }
      if (Date.now() - lastBeat > HEARTBEAT_MS) {
        lastBeat = Date.now();
        patchPage(job.courseId, job.lessonId, job.pageId, { heartbeat: lastBeat });
      }
    }
    const code = extractCode(text);
    if (!code || !/root\s*=/.test(code) || code.split("\n").filter((x) => /^[a-zA-Z_]\w*\s*=/.test(x)).length < 2)
      throw new PageError("The model didn't return a usable page.", true);
    return code;
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
    clearTimeout(cap);
    signal.removeEventListener("abort", stop);
  }
}

/* ---------- Running jobs ---------- */

function readPage(job: Job): LessonPage | undefined {
  const c = getCourse(job.courseId);
  const lesson = c && allLessons(c).find((x) => x.lesson.id === job.lessonId)?.lesson;
  return c && lesson ? lessonPages(lesson, c.options).find((p) => p.id === job.pageId) : undefined;
}

async function run(job: Job) {
  const ctrl = new AbortController();
  running.set(job.key, ctrl);
  runningPriority.set(job.key, job.priority);
  const t0 = Date.now();
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      setLive(job.key, { status: "writing", code: "", attempt, startedAt: t0 });
      patchPage(job.courseId, job.lessonId, job.pageId, { status: "generating", error: undefined, heartbeat: Date.now() });
      try {
        let last = 0;
        const code = await streamOnce(job, attempt, ctrl.signal, (partial) => {
          // Re-render at most ~8 times a second while streaming.
          const now = Date.now();
          if (now - last < 120) return;
          last = now;
          setLive(job.key, { status: "writing", code: partial, attempt, startedAt: t0 });
        });
        const c = getCourse(job.courseId);
        const lesson = c && allLessons(c).find((x) => x.lesson.id === job.lessonId)?.lesson;
        const pages = c && lesson ? lessonPages(lesson, c.options) : [];
        const idx = pages.findIndex((p) => p.id === job.pageId);
        patchPage(job.courseId, job.lessonId, job.pageId, {
          status: "ready",
          code,
          error: undefined,
          heartbeat: undefined,
          generatedAt: Date.now(),
          ms: Date.now() - t0,
          adaptedTo: idx > 0 ? answersSummary(pages, idx) || undefined : undefined,
        });
        recordSpeed(Date.now() - t0);
        return;
      } catch (e) {
        if (ctrl.signal.aborted) {
          patchPage(job.courseId, job.lessonId, job.pageId, (p) => (p.status === "ready" ? p : { ...p, status: "idle", heartbeat: undefined }));
          return;
        }
        const err = e instanceof PageError ? e : new PageError(e instanceof Error ? e.message : "Something went wrong.", true);
        if (!err.retryable || attempt === MAX_ATTEMPTS) {
          patchPage(job.courseId, job.lessonId, job.pageId, {
            status: "error",
            heartbeat: undefined,
            error: attempt > 1 ? `${err.message} (tried ${attempt} times)` : err.message,
          });
          return;
        }
        const switching = attempt === 2 && currentModel().s.backupModel;
        const wait = switching ? Math.min(err.waitMs || 2000, 3000) : err.waitMs || backoff(attempt);
        setLive(job.key, { status: "waiting", code: "", attempt, retryAt: Date.now() + wait, note: switching ? `${err.message} Switching to the backup model.` : err.message, startedAt: t0 });
        patchPage(job.courseId, job.lessonId, job.pageId, { heartbeat: Date.now() + wait });
        try {
          await sleep(wait, ctrl.signal);
        } catch {
          patchPage(job.courseId, job.lessonId, job.pageId, (p) => (p.status === "ready" ? p : { ...p, status: "idle", heartbeat: undefined }));
          return;
        }
      }
    }
  } finally {
    running.delete(job.key);
    runningPriority.delete(job.key);
    setLive(job.key, null);
    finishCourseIfDone(job.courseId);
    pump();
  }
}

function pump() {
  while (running.size < concurrency() && queue.length) {
    queue.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    // While the learner is waiting for a page, it gets the model to itself (pages ahead start once it's done).
    const waitingOnOne = [...runningPriority.values()].some((p) => p === 0);
    if (waitingOnOne && queue[0].priority > 0) break;
    const job = queue.shift()!;
    const page = readPage(job);
    if (!page || page.status === "ready" || running.has(job.key)) {
      setLive(job.key, null);
      continue;
    }
    void run(job);
  }
}

/* ---------- Public API ---------- */

/** 0 = the learner is waiting for it, 1 = just ahead of them, 2 = background. */
export function requestPage(courseId: string, lessonId: string, pageIndex: number, priority: 0 | 1 | 2 = 1) {
  const c = getCourse(courseId);
  const lesson = c && allLessons(c).find((x) => x.lesson.id === lessonId)?.lesson;
  if (!c || !lesson) return;
  const page = lessonPages(lesson, c.options)[pageIndex];
  if (!page || page.status === "ready") return;
  const key = pageKey(courseId, lessonId, page.id);
  if (running.has(key)) return;
  const queued = queue.find((j) => j.key === key);
  if (queued) {
    if (priority < queued.priority) queued.priority = priority;
  } else {
    queue.push({ key, courseId, lessonId, pageId: page.id, priority, seq: seq++ });
    setLive(key, { status: "queued", code: "", attempt: 0, startedAt: Date.now() });
  }
  pump();
}

/** Write one page again (after an error, or the learner asked for a rewrite). */
export function rewritePage(courseId: string, lessonId: string, pageIndex: number) {
  const c = getCourse(courseId);
  const lesson = c && allLessons(c).find((x) => x.lesson.id === lessonId)?.lesson;
  if (!c || !lesson) return;
  const page = lessonPages(lesson, c.options)[pageIndex];
  if (!page) return;
  const key = pageKey(courseId, lessonId, page.id);
  running.get(key)?.abort();
  patchPage(courseId, lessonId, page.id, { status: "idle", code: undefined, error: undefined });
  setTimeout(() => requestPage(courseId, lessonId, pageIndex, 0), 0);
}

/**
 * Called whenever the learner is on a page: queue it, then the next pages that don't depend on
 * answers, and (on the last page) the first page of the next lesson.
 */
export function prefetchAround(courseId: string, lessonId: string, pageIndex: number) {
  const c = getCourse(courseId);
  if (!c) return;
  const flat = allLessons(c);
  const pos = flat.findIndex((x) => x.lesson.id === lessonId);
  if (pos < 0) return;
  const pages = lessonPages(flat[pos].lesson, c.options);
  const cur = pages[pageIndex];
  // Pages that failed wait for the learner to press "Try again" (no retry loops).
  if (cur && cur.status !== "error" && !(cur.adaptive && pageIndex > 0 && cur.status !== "ready" && !lessonAnsweredBefore(pages, pageIndex))) requestPage(courseId, lessonId, pageIndex, 0);
  for (let j = pageIndex + 1; j < pages.length; j++) {
    if (pages[j].adaptive) break; // wait for the learner's answers
    if (pages[j].status !== "error") requestPage(courseId, lessonId, j, 1);
  }
  const nextLesson = flat[pos + 1];
  if (pageIndex >= pages.length - 1 && nextLesson && lessonPages(nextLesson.lesson, c.options)[0]?.status !== "error") requestPage(courseId, nextLesson.lesson.id, 0, 2);
}

/** An adaptive page can be written once the learner has reached it (they have seen the page before). */
function lessonAnsweredBefore(pages: LessonPage[], idx: number) {
  return idx === 0 || pages[idx - 1]?.status === "ready";
}

/** Write the next (adaptive) page now, using the answers given so far. */
export function writeNextFromAnswers(courseId: string, lessonId: string, nextIndex: number) {
  requestPage(courseId, lessonId, nextIndex, 0);
}

/** Write the whole course in the background ("write everything now"). Survives reloads until done or stopped. */
export function startWritingAll(courseId: string, retryErrors = true) {
  const c = getCourse(courseId);
  if (!c) return;
  if (!c.writingAll) patchCourse(courseId, (x) => ({ ...x, writingAll: true }));
  for (const { lesson } of allLessons(c)) {
    lessonPages(lesson, c.options).forEach((p, i) => {
      if (p.status !== "ready" && !p.adaptive && (retryErrors || p.status !== "error")) requestPage(courseId, lesson.id, i, 2);
    });
  }
  finishCourseIfDone(courseId);
}

/** Stop writing a course: queued pages are dropped, the page being written is cancelled. Finished pages stay. */
export function stopCourse(courseId: string) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].courseId === courseId) {
      setLive(queue[i].key, null);
      queue.splice(i, 1);
    }
  }
  for (const [key, ctrl] of running) if (key.startsWith(`${courseId}:`)) ctrl.abort();
  patchCourse(courseId, (x) => ({ ...x, writingAll: false }));
}

function finishCourseIfDone(courseId: string) {
  const c = getCourse(courseId);
  if (!c?.writingAll) return;
  const busy = queue.some((j) => j.courseId === courseId) || [...running.keys()].some((k) => k.startsWith(`${courseId}:`));
  if (busy) return;
  const left = allLessons(c).some(({ lesson }) => lessonPages(lesson, c.options).some((p) => !p.adaptive && p.status !== "ready" && p.status !== "error"));
  if (!left) patchCourse(courseId, (x) => ({ ...x, writingAll: false }));
}

/**
 * After a reload: pages stuck in "generating" with no live job are reset, and courses that were
 * being written in full carry on. Safe to call repeatedly (pages this tab is writing are never touched).
 */
let booted = false;
export function recoverAndResume() {
  const now = Date.now();
  for (const c of readCourses()) {
    for (const { lesson } of allLessons(c)) {
      for (const p of lesson.pages ?? []) {
        const key = pageKey(c.id, lesson.id, p.id);
        if (p.status === "generating" && !running.has(key) && (p.heartbeat ?? 0) < now - ORPHAN_MS) {
          patchPage(c.id, lesson.id, p.id, { status: "idle", heartbeat: undefined });
        }
      }
      // Legacy single-page lessons that were mid-write when the old version was closed.
      if (!lesson.pages && lesson.status === "generating" && !lesson.code) patchLesson(c.id, lesson.id, { status: undefined });
    }
    // Quizzes are written while their page is open; one left "generating" by a closed tab starts over.
    if (!booted) for (const q of c.quizzes) if (q.status === "generating") patchQuiz(c.id, q.id, { status: "idle" });
    if (c.writingAll) startWritingAll(c.id, false);
  }
  booted = true;
}

/* ---------- Answers and memory ---------- */

/** Save an answer on its page (one per question; a new try replaces the old one) and note struggles in memory. */
export function recordAnswer(courseId: string, lessonId: string, pageId: string, a: Answer) {
  patchPage(courseId, lessonId, pageId, (p) => {
    const rest = (p.answers ?? []).filter((x) => !(x.kind === a.kind && x.question === a.question));
    return { ...p, answers: [...rest, a].slice(-20) };
  });
  const c = getCourse(courseId);
  if (!c || c.options.memory === "off") return;
  const lesson = allLessons(c).find((x) => x.lesson.id === lessonId)?.lesson;
  if (a.kind !== "simulation" && (a.score != null ? a.score < 0.6 : a.correct === false)) {
    remember({ kind: "struggled", text: `${a.question.slice(0, 120)} (${a.response.slice(0, 90)})`, topic: lesson?.title ?? c.title, scope: c.options.memory, courseId });
  }
}

/** When a lesson is finished, remember what it taught. */
export function rememberLesson(courseId: string, lessonId: string) {
  const c = getCourse(courseId);
  if (!c || c.options.memory === "off") return;
  const lesson = allLessons(c).find((x) => x.lesson.id === lessonId)?.lesson;
  if (!lesson) return;
  const gist = lessonPages(lesson, c.options)
    .map((p) => (p.code ? lessonGist(p.code) : ""))
    .filter(Boolean)
    .join(" ")
    .slice(0, 200);
  remember({ kind: "learned", text: `${lesson.title}${gist ? `: ${gist}` : ""}`, topic: c.title, scope: c.options.memory, courseId });
}

/* ---------- Speed estimate for "come back in about N minutes" ---------- */

const SPEED_KEY = "learn-otg:gen-speed:v1";
function recordSpeed(ms: number) {
  try {
    const prev = JSON.parse(localStorage.getItem(SPEED_KEY) ?? "null") as { avg: number; n: number } | null;
    const n = Math.min(20, (prev?.n ?? 0) + 1);
    const avg = prev ? prev.avg + (ms - prev.avg) / n : ms;
    localStorage.setItem(SPEED_KEY, JSON.stringify({ avg, n }));
  } catch {}
}

/** Rough time left to write the given number of pages. */
export function estimateMs(pages: number): number {
  let avg = mockFlag() ? 3_000 : 45_000;
  try {
    const s = JSON.parse(localStorage.getItem(SPEED_KEY) ?? "null") as { avg: number } | null;
    if (s?.avg) avg = s.avg;
  } catch {}
  return Math.ceil(pages / concurrency()) * avg;
}

/* ---------- React hooks ---------- */

const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => subs.delete(cb);
};

/** Live progress for one page (undefined when nothing is happening). */
export function useLivePage(key: string | null): LivePage | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (key ? live.get(key) : undefined),
    () => undefined,
  );
}

/** Counts for a course: pages queued, being written, or waiting to retry. */
export function useCourseJobs(courseId: string) {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  let queued = 0;
  let writing = 0;
  let waiting = 0;
  let note = "";
  let retryAt = 0;
  for (const [key, v] of live) {
    if (!key.startsWith(`${courseId}:`)) continue;
    if (v.status === "queued") queued++;
    else if (v.status === "writing") writing++;
    else {
      waiting++;
      note = v.note ?? note;
      retryAt = v.retryAt ?? retryAt;
    }
  }
  return { queued, writing, waiting, note, retryAt, active: queued + writing + waiting > 0 };
}
