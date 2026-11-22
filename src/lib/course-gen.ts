"use client";
// Client-side orchestration for courses: outline, lessons, quizzes.
import type { Course, CourseOptions, CourseQuiz, CourseSection, ContextFile, PagePlan } from "./course-types";
import { getCourse, patchCourse, patchQuiz, planQuizzes, putCourse, allLessons, lessonPages } from "./courses";
import { remember } from "./learner-memory";
import { sizedOptions } from "./course-size";
import { lessonGist } from "./learner-memory";
import { uid } from "./local-store";
import { callName, profileContext, readProfile } from "./profile";
import { mockFlag } from "./mock-flag";
import { currentModel } from "./settings";

const modelAndParams = currentModel;

export type PickedFile = { name: string; kind: string; chars: number; text: string; note?: string; url?: string };

export async function extractFiles(files: File[]): Promise<PickedFile[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch("/api/extract", { method: "POST", body: form });
  const j = (await res.json().catch(() => ({}))) as { files?: PickedFile[]; error?: string };
  if (!res.ok || !j.files) throw new Error(j.error ?? "Couldn't read those files.");
  return j.files;
}

export type OutlineProgress = { note?: string; thinking: number; sections: number; lessons: number; title?: string; attempt?: number; retrying?: string };
type OutlineResult = { title: string; blurb: string; mood: string; level: string; digest: string; sections: unknown[] };

class OutlineError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchOutline(body: string, onProgress: (p: OutlineProgress) => void): Promise<OutlineResult> {
  const res = await fetch("/api/course/outline", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new OutlineError(j.error ?? "Couldn't build the outline.", res.status);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.trim()) continue;
      const e = JSON.parse(l) as { type: string; outline?: OutlineResult; error?: string; status?: number } & OutlineProgress;
      if (e.type === "progress") onProgress(e);
      else if (e.type === "done" && e.outline) return e.outline;
      else if (e.type === "error") throw new OutlineError(e.error ?? "Couldn't build the outline.", e.status ?? 500);
    }
  }
  throw new OutlineError("The connection closed before the outline arrived.", 502);
}

export async function createCourse(input: {
  topic: string;
  level: string;
  goal: string;
  options: CourseOptions;
  files: PickedFile[];
  referenceCourseIds?: string[];
  mock?: boolean;
  onProgress?: (p: OutlineProgress) => void;
}): Promise<string> {
  const { model, params } = modelAndParams();
  const options = sizedOptions(input.options);
  const references = (input.referenceCourseIds ?? []).slice(0,6).map(getCourse).filter((c):c is Course=>!!c);
  const referenceFiles: PickedFile[] = references.map(c=>({name:`Course reference: ${c.title}`,kind:"course",chars:0,text:[c.contextDigest, ...allLessons(c).map(({lesson:l})=>`${l.title}: ${l.summary} ${l.notes??""} ${lessonPages(l,c.options).filter(p=>p.status==="ready").map(p=>lessonGist(p.code??"")).join(" ")}`)].filter(Boolean).join("\n").slice(0,16000)}));
  referenceFiles.forEach(f=>f.chars=f.text.length);
  const materials=[...input.files,...referenceFiles];
  const profile = readProfile();
  const body = JSON.stringify({
    model: model.id,
    params,
    topic: input.topic,
    level: input.level,
    goal: input.goal,
    options,
    profile: profileContext(profile),
    files: materials.filter((f) => f.text).map((f) => ({ name: f.name, text: f.text })),
    mock: input.mock ?? mockFlag(),
    fast: currentModel().s.fastPlanning,
    allowBackup: currentModel().s.backupModel,
  });

  // One automatic retry when the provider times out or errors; the learner sees it happen.
  let j: OutlineResult | null = null;
  for (let attempt = 1; attempt <= 2 && !j; attempt++) {
    try {
      j = await fetchOutline(body, (p) => input.onProgress?.({ ...p, attempt }));
    } catch (e) {
      const retryable = e instanceof OutlineError && (e.status >= 500 || e.status === 429);
      if (!retryable || attempt === 2) throw e;
      input.onProgress?.({ thinking: 0, sections: 0, lessons: 0, attempt: 2, retrying: e.message });
      await new Promise((r) => setTimeout(r, e.status === 429 ? 20_000 : 2_000));
    }
  }
  if (!j) throw new Error("Couldn't build the outline.");

  const sections: CourseSection[] = (j.sections as { title: string; summary: string; lessons: { title: string; summary: string; notes?: string; plan?: PagePlan[] }[] }[]).map((s) => ({
    id: uid(),
    title: s.title,
    summary: s.summary,
    lessons: s.lessons.map((l) => ({ id: uid(), title: l.title, summary: l.summary, notes: l.notes || undefined, plan: l.plan?.length ? l.plan : undefined })),
  }));
  // Fix each lesson's pages now, so every page has a stable id from the start.
  for (const sec of sections) for (const l of sec.lessons) l.pages = lessonPages(l, options);
  const files: ContextFile[] = materials.map((f) => ({ name: f.name, kind: f.kind, chars: f.chars, note: f.note, url: f.url }));
  const course: Course = {
    id: uid(),
    title: j.title,
    topic: input.topic,
    blurb: j.blurb,
    mood: j.mood,
    level: j.level,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    options,
    referenceCourseIds: references.map(c=>c.id),
    status: "ready",
    sections,
    quizzes: planQuizzes(sections, options),
    files,
    contextDigest: j.digest || undefined,
    saved: false,
  };
  putCourse(course);
  if (input.options.memory !== "off")
    remember({ kind: "interest", text: `Started the course "${course.title}"${input.goal ? ` to ${input.goal}` : ""}`, topic: course.title, scope: input.options.memory, courseId: course.id });
  return course.id;
}

export function quizCount(c: Course, q: CourseQuiz): number {
  const o = c.options;
  if (q.kind === "lesson") return typeof o.questionsPerLesson === "number" ? o.questionsPerLesson : 2;
  const lessons = q.kind === "section" ? (c.sections.find((s) => s.id === q.sectionId)?.lessons.length ?? 3) : allLessons(c).length;
  if (q.kind === "section") return typeof o.questionsPerSection === "number" ? o.questionsPerSection : Math.min(8, 2 + lessons);
  return typeof o.questionsAtEnd === "number" ? o.questionsAtEnd : Math.min(15, 4 + c.sections.length * 2);
}

export async function generateQuiz(courseId: string, quizId: string, mock?: boolean): Promise<void> {
  const c = getCourse(courseId);
  const q = c?.quizzes.find((x) => x.id === quizId);
  if (!c || !q) throw new Error("Quiz not found.");
  const { model, params } = modelAndParams();
  patchQuiz(courseId, quizId, { status: "generating", error: undefined });
  const summaryOf = (l: (typeof c.sections)[number]["lessons"][number]) => {
    const covered = lessonPages(l, c.options)
      .filter((p) => p.status === "ready")
      .map((p) => p.title)
      .join("; ");
    return covered ? `${l.summary} (pages: ${covered})` : l.summary;
  };
  const lessons =
    q.kind === "final"
      ? allLessons(c).map((x) => x.lesson)
      : q.kind === "section"
        ? (c.sections.find((s) => s.id === q.sectionId)?.lessons ?? [])
        : allLessons(c)
            .filter((x) => x.lesson.id === q.lessonId)
            .map((x) => x.lesson);
  try {
    const res = await fetch("/api/course/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        params,
        courseTitle: c.title,
        kind: q.kind,
        scopeTitle: q.kind === "final" ? c.title : q.title.replace(/: .*$/, ""),
        lessons: lessons.map((l) => ({ title: l.title, summary: summaryOf(l), notes: l.notes })),
        count: quizCount(c, q),
        digest: c.contextDigest,
        sourcePolicy: c.options.sourcePolicy,
        mock: mock ?? mockFlag(),
        fast: currentModel().s.fastPlanning,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Couldn't write the quiz.");
    patchQuiz(courseId, quizId, { status: "ready", questions: j.questions });
  } catch (e) {
    patchQuiz(courseId, quizId, { status: "error", error: e instanceof Error ? e.message : "Couldn't write the quiz." });
    throw e;
  }
}

export { callName, patchCourse };

