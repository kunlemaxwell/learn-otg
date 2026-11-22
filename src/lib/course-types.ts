export type Auto<T> = "auto" | T;

/** fixed = pages follow the plan (some may adapt); freeform = every page after the first is written from the learner's answers. */
export type LessonMode = "fixed" | "freeform";
/** For fixed lessons: write pages as the learner goes (just ahead of them), or write the whole course in the background now. */
export type GenMode = "onthego" | "all";
/** Course memory: share with everything you learn, keep to this course, or don't remember. */
export type MemoryScope = "global" | "course" | "off";

export type CourseOptions = {
  sizeMode?: "auto" | "manual";
  length?: "short" | "medium" | "detailed";
  lessonCount?: number;
  sourcePolicy?: "strict" | "mixed";
  style: "auto" | "visual" | "text" | "balanced"; // auto = follow the learner's profile
  depth: "auto" | "quick" | "standard" | "deep";
  sections: Auto<number>; // number of sections
  lessonsPerSection: Auto<number>;
  lessonMode: LessonMode;
  genMode: GenMode;
  pagesPerLesson: Auto<number>;
  memory: MemoryScope;
  quizAfterLesson: boolean;
  quizAfterSection: boolean;
  quizAtEnd: boolean;
  questionsPerLesson: Auto<number>; // questions inside each lesson's check
  questionsPerSection: Auto<number>;
  questionsAtEnd: Auto<number>;
  certificate: boolean;
  certificateTemplate: string; // template id
};

export const DEFAULT_COURSE_OPTIONS: CourseOptions = {
  sizeMode: "auto",
  length: "medium",
  lessonCount: 12,
  sourcePolicy: "mixed",
  style: "auto",
  depth: "auto",
  sections: "auto",
  lessonsPerSection: "auto",
  lessonMode: "fixed",
  genMode: "onthego",
  pagesPerLesson: "auto",
  memory: "global",
  quizAfterLesson: true,
  quizAfterSection: true,
  quizAtEnd: true,
  questionsPerLesson: "auto",
  questionsPerSection: "auto",
  questionsAtEnd: "auto",
  certificate: true,
  certificateTemplate: "forest-classic",
};

export type QuizQuestion = {
  q: string;
  options: string[];
  answer: number; // index into options
  why: string;
};

export type CourseQuiz = {
  id: string;
  kind: "lesson" | "section" | "final";
  sectionId?: string;
  lessonId?: string;
  title: string;
  status: "idle" | "generating" | "ready" | "error";
  questions: QuizQuestion[];
  score?: number; // best score 0..1
  attempts: number;
  error?: string;
};

/** Something the learner answered inside a lesson page. */
export type Answer = {
  kind: "choice" | "guess" | "text" | "image" | "cards" | "game" | "scenario" | "simulation";
  question: string;
  response: string;
  correct?: boolean | null; // null = not graded
  score?: number; // 0..1
  feedback?: string;
  ts: number;
};

export type PagePlan = { title: string; goal: string; adaptive?: boolean };

export type PageStatus = "idle" | "generating" | "ready" | "error";

export type LessonPage = {
  id: string;
  title: string;
  goal: string;
  adaptive?: boolean; // written only after the learner answers the page before
  status: PageStatus;
  code?: string; // openui-lang, complete when ready
  error?: string;
  heartbeat?: number; // last progress while generating (lets a reloaded tab spot an orphaned job)
  answers?: Answer[];
  adaptedTo?: string; // summary of the answers this page was written for
  generatedAt?: number;
  ms?: number; // time it took to write
};

export type CourseLesson = {
  id: string;
  title: string;
  summary: string;
  notes?: string; // excerpts from the learner's files that this lesson should use
  plan?: PagePlan[]; // suggested pages, from the outline
  pages?: LessonPage[];
  page?: number; // the page the learner is on (0-based)
  /** @deprecated single-page lessons from before pages existed; read through lessonPages(). */
  status?: PageStatus;
  /** @deprecated */
  code?: string;
  mood?: string;
  done?: boolean;
  quizScore?: number; // in-lesson check result 0..1
  error?: string;
};

export type CourseSection = {
  id: string;
  title: string;
  summary: string;
  lessons: CourseLesson[];
};

export type ContextFile = { name: string; kind: string; chars: number; note?: string; url?: string };

export type Course = {
  id: string;
  title: string;
  topic: string;
  blurb: string;
  mood: string;
  level: string;
  createdAt: number;
  updatedAt: number;
  options: CourseOptions;
  status: "outlining" | "ready" | "error";
  error?: string;
  sections: CourseSection[];
  quizzes: CourseQuiz[];
  files: ContextFile[];
  referenceCourseIds?: string[];
  contextDigest?: string; // condensed text from the files, reused for each lesson
  saved: boolean; // saved for later
  /** Writing the whole course in the background (genMode "all"); resumes after a reload until done or stopped. */
  writingAll?: boolean;
  completedAt?: number;
  certificateId?: string;
};
