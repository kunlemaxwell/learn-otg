"use client";
import { createContext } from "react";
import type { Answer } from "@/lib/course-types";

export type QuizResult = { question: string; correct: boolean; attempts: number };

export type LessonCtx = {
  lessonTitle: string;
  lessonContent?: string;
  mood: string;
  ask: (text: string) => void;
  onQuizResult: (r: QuizResult) => void;
  /** Every answer the learner gives (quizzes, typed, photos, games, scenarios). Later pages adapt to these. */
  onAnswer: (a: Answer) => void;
};

export const LessonContext = createContext<LessonCtx>({
  lessonTitle: "",
  mood: "forest",
  ask: () => {},
  onQuizResult: () => {},
  onAnswer: () => {},
});
