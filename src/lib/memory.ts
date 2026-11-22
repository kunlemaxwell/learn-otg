import "server-only";
// Layered conversation memory: keeps context without resending every lesson.
// - the latest lesson is sent in full (the learner is looking at it)
// - earlier lessons become ~100-token recaps (title, big idea, what was covered, quiz + answer)
// - very old turns collapse into a list of earlier topics
// - the full text of any earlier lesson stays available through the recall_lesson tool
import { chatLine, extractCode, lessonTitle, recapLesson } from "./lesson-code";

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type InMsg = { role: "user" | "assistant"; content: string | Part[] };
export type ApiMessage = Record<string, unknown>;

export type Progress = { topic: string; question: string; correct: boolean; attempts: number; ts: number };

export function textOf(content: InMsg["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

export type Compacted = {
  history: ApiMessage[]; // everything before the latest user message
  memory: string; // "earlier topics" + lesson index for recall
  lessons: { index: number; title: string; text: string }[];
  recallable: boolean;
};

export function compactHistory(
  messages: InMsg[],
  opts: { lean: boolean; supportsImages: boolean },
): Compacted {
  const prior = messages.slice(0, -1);
  const keepTurns = opts.lean ? 6 : 12;
  const lessons: Compacted["lessons"] = [];
  prior.forEach((m) => {
    if (m.role === "assistant" && extractCode(textOf(m.content))) {
      const text = textOf(m.content);
      lessons.push({ index: lessons.length + 1, title: lessonTitle(extractCode(text)) ?? "Lesson", text });
    }
  });
  const lastLessonText = lessons.at(-1)?.text;

  const recent = prior.slice(-keepTurns);
  const older = prior.slice(0, Math.max(0, prior.length - keepTurns));
  let compacted = false;

  const history: ApiMessage[] = recent.map((m) => {
    if (m.role === "assistant") {
      const text = textOf(m.content);
      if (!extractCode(text)) return { role: "assistant", content: chatLine(text) || text.slice(0, 500) };
      if (text === lastLessonText && !opts.lean) return { role: "assistant", content: text };
      compacted = true;
      const n = lessons.find((l) => l.text === text)?.index;
      return { role: "assistant", content: `[Lesson ${n} recap — full lesson available via recall_lesson] ${recapLesson(text)}` };
    }
    // Earlier user turns: keep text, drop old images (the recap already describes them).
    return { role: "user", content: textOf(m.content) };
  });

  const memoryLines: string[] = [];
  if (older.length) {
    const topics = older.filter((m) => m.role === "user").map((m) => `- ${textOf(m.content).slice(0, 90)}`);
    memoryLines.push(`Earlier questions:\n${topics.join("\n")}`);
    if (older.some((m) => m.role === "assistant" && extractCode(textOf(m.content)))) compacted = true;
  }
  if (compacted && lessons.length) {
    memoryLines.push(`Lessons so far: ${lessons.map((l) => `${l.index}) ${l.title}`).join("; ")}`);
  }
  return { history, memory: memoryLines.join("\n"), lessons, recallable: compacted };
}

export function learnerRecord(progress: Progress[] | undefined): string {
  if (!progress?.length) return "";
  const recent = [...progress].sort((a, b) => b.ts - a.ts).slice(0, 8);
  return recent
    .map((p) => `${p.correct ? (p.attempts > 1 ? "✓ after a hint" : "✓") : "✗"} ${p.topic}: ${p.question.slice(0, 90)}`)
    .join("\n");
}

export const RECALL_TOOL = {
  type: "function",
  function: {
    name: "recall_lesson",
    description: "Get the full text of an earlier lesson in this chat when you need its exact content (e.g. to edit or continue it).",
    parameters: {
      type: "object",
      properties: { index: { type: "integer", description: "Lesson number from 'Lessons so far'." } },
      required: ["index"],
    },
  },
} as const;
