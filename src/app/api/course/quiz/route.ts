import { complete, LlmError, parseJson } from "@/lib/llm";
import { isMock, mockQuestions } from "@/lib/course-mock";
import type { ParamValues } from "@/lib/models";
import { fastModel } from "@/lib/model-pick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Req = {
  model: string;
  params?: ParamValues;
  courseTitle: string;
  kind: "lesson" | "section" | "final";
  scopeTitle: string;
  lessons: { title: string; summary: string; notes?: string }[];
  count: number;
  sourcePolicy?: "strict" | "mixed";
  digest?: string;
  mock?: boolean;
  fast?: boolean;
};

const SYSTEM = `You write quiz questions for a mobile learning app. Reply with ONE JSON object and nothing else:
{"questions":[{"q": string, "options": [string, string, string, string], "answer": number, "why": string}]}
Rules:
- answer is the 0-based index of the correct option; spread correct answers across positions.
- Test understanding and application, not memory of a phrase. Wrong options must be plausible mistakes.
- Cover the lessons evenly. Questions are self-contained.
- why = one sentence explaining why the right answer is right.
- Facts must be true; when material is supplied, use only what it supports.
- Sentence case, no emoji, no exclamation marks.`;

export async function POST(request: Request) {
  let body: Req;
  try {
    body = (await request.json()) as Req;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const count = Math.min(25, Math.max(1, Math.round(body.count || 5)));
  const lessons = (body.lessons ?? []).slice(0, 30);
  if (!lessons.length) return Response.json({ error: "Nothing to quiz on yet." }, { status: 400 });

  if (isMock(body.mock)) return Response.json({ questions: mockQuestions(count) });

  const user = [
    `Course: ${body.courseTitle}`,
    `Quiz: ${body.kind === "final" ? "final quiz across the whole course" : body.kind === "section" ? `section quiz on "${body.scopeTitle}"` : `lesson quiz on "${body.scopeTitle}"`}`,
    `Number of questions: ${count}`,
    `Lessons covered:\n${lessons.map((l, i) => `${i + 1}. ${l.title}: ${l.summary}${l.notes ? ` [material: ${l.notes}]` : ""}`).join("\n")}`,
    body.sourcePolicy === "strict" ? "SOURCE POLICY: Questions and answers must use only supplied material and reference-course facts. Do not introduce outside facts." : "SOURCE POLICY: General knowledge may clarify the taught concepts, without attributing additions to the supplied sources.",
    body.digest ? `Material summary: ${body.digest}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const messages = [
      { role: "system" as const, content: SYSTEM },
      { role: "user" as const, content: user },
    ];
    const maxTokens = 800 + count * 330;
    const fast = body.fast !== false ? fastModel() : null;
    let raw = "";
    if (fast) {
      try {
        raw = await complete(fast.model.id, fast.params, messages, { maxTokens, signal: request.signal, timeoutMs: 60_000, idleMs: 30_000 });
        parseJson(raw);
      } catch {
        raw = "";
      }
    }
    if (!raw) raw = await complete(body.model, body.params, messages, { maxTokens, signal: request.signal, idleMs: 75_000 });
    const o = parseJson<{ questions?: { q?: string; options?: string[]; answer?: number; why?: string }[] }>(raw);
    const questions = (o.questions ?? [])
      .filter((q) => q?.q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && (q.answer as number) >= 0 && (q.answer as number) < q.options.length)
      .map((q) => ({ q: String(q.q), options: q.options!.map(String), answer: q.answer as number, why: String(q.why ?? "") }))
      .slice(0, count);
    if (!questions.length) throw new LlmError("No usable questions came back. Try again.", 502);
    return Response.json({ questions });
  } catch (e) {
    if (e instanceof LlmError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: e instanceof Error ? e.message : "Something went wrong." }, { status: 500 });
  }
}
