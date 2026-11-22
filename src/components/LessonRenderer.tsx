"use client";

import { Renderer, type ActionEvent } from "@openuidev/react-lang";
import { ThemeProvider } from "@openuidev/react-ui";
import { useMemo } from "react";
import type { Answer } from "@/lib/course-types";
import { moodOf } from "@/lib/lesson-code";
import { useTheme } from "@/lib/theme";
import { LessonContext, lessonLibrary, type QuizResult } from "./lesson-components";
import { darkTheme, lightTheme } from "./lesson-theme";

/** A lesson (or one page of one) on its own. */
export function LessonRenderer({
  code,
  streaming,
  title,
  mood,
  onAsk,
  onQuizResult,
  onAnswer,
  onStateUpdate,
}: {
  code: string;
  streaming?: boolean;
  title: string;
  mood?: string; // course pages after the first have no LessonHeader, so the course passes its colour
  onAsk?: (text: string) => void;
  onQuizResult?: (r: QuizResult) => void;
  onAnswer?: (a: Answer) => void;
  onStateUpdate?: (state: Record<string, unknown>) => void;
}) {
  const { resolved } = useTheme();
  const headerMood = /LessonHeader\(/.test(code) ? moodOf(code) : null;
  const ctx = useMemo(
    () => ({
      lessonTitle: title,
      lessonContent: code,
      mood: headerMood ?? mood ?? "forest",
      ask: onAsk ?? (() => {}),
      onQuizResult: onQuizResult ?? (() => {}),
      onAnswer: onAnswer ?? (() => {}),
    }),
    [title, code, headerMood, mood, onAsk, onQuizResult, onAnswer],
  );
  const onAction = (e: ActionEvent) => {
    if (e.type === "open_url") {
      const url = String(e.params?.url ?? "");
      if (/^https?:\/\//.test(url)) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const text = e.humanFriendlyMessage || String(e.params?.message ?? e.params?.text ?? "");
    if (text) onAsk?.(text);
  };
  return (
    <ThemeProvider mode={resolved} lightTheme={lightTheme} darkTheme={darkTheme}>
      <div className="lesson">
        <LessonContext.Provider value={ctx}>
          <Renderer response={code} library={lessonLibrary} isStreaming={Boolean(streaming)} onAction={onAction} onStateUpdate={onStateUpdate} />
        </LessonContext.Provider>
      </div>
    </ThemeProvider>
  );
}
