import { complete, LlmError, parseJson } from "@/lib/llm";
import { isMock } from "@/lib/course-mock";
import { getModel, MODELS, type ParamValues } from "@/lib/models";
import { fastModel } from "@/lib/model-pick";
import { getProvider } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Req = {
  model: string;
  params?: ParamValues;
  kind: "text" | "image";
  question: string;
  modelAnswer?: string;
  lookFor?: string[];
  response?: string;
  image?: string; // data URL
  lesson?: string;
  mock?: boolean;
  fast?: boolean;
};

export type GradeResult = {
  verdict: "correct" | "partial" | "incorrect" | "unsure";
  score: number;
  feedback: string;
  seen?: string;
  model?: string;
};

const SYSTEM = `You mark a learner's answer in a mobile learning app. Be fair, specific and kind, never gushing.
Reply with ONE JSON object and nothing else: {"verdict": "correct"|"partial"|"incorrect", "score": number 0-1, "feedback": string, "seen": string}
- verdict: correct = all key points right (wording can differ); partial = some right or vague; incorrect = wrong or off-topic.
- feedback: 1–3 short sentences, second person. Say what was right, then the one most important thing to fix or add. No praise words like "great" or "amazing". No exclamation marks.
- seen: for a photo, one sentence describing what is in it; otherwise "".
- If a photo is unreadable or unrelated, verdict "incorrect", score 0, and say what to photograph instead.`;

/** The model to use for a photo: the chosen one if it can see, otherwise the first vision model with a key. */
function visionModel(preferred: string) {
  const m = getModel(preferred);
  if (m.supportsImages && getProvider(m.provider).apiKey) return m;
  return MODELS.find((x) => x.supportsImages && getProvider(x.provider).apiKey) ?? null;
}

function mockGrade(b: Req): GradeResult {
  if (b.kind === "image") return { verdict: "partial", score: 0.6, feedback: "Demo mode: the photo arrived. In real use the tutor describes what it sees and marks it against the checklist.", seen: "A demo photo." };
  const want = new Set((b.modelAnswer ?? "").toLowerCase().split(/\W+/).filter((w) => w.length > 4));
  const got = (b.response ?? "").toLowerCase().split(/\W+/).filter((w) => want.has(w));
  const ratio = want.size ? new Set(got).size / want.size : 0;
  const verdict = ratio > 0.45 ? "correct" : ratio > 0.15 ? "partial" : "incorrect";
  return {
    verdict,
    score: Math.min(1, Math.round(ratio * 2 * 100) / 100),
    feedback: verdict === "correct" ? "Demo mode: you covered the main point." : verdict === "partial" ? "Demo mode: you are on the right track; add the key reason." : "Demo mode: compare your answer with the model answer below.",
  };
}

export async function POST(request: Request) {
  let b: Req;
  try {
    b = (await request.json()) as Req;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!b.question) return Response.json({ error: "Missing question." }, { status: 400 });
  if (b.kind === "text" && !b.response?.trim()) return Response.json({ error: "Write an answer first." }, { status: 400 });
  if (b.kind === "image" && !b.image?.startsWith("data:image/")) return Response.json({ error: "Add a photo first." }, { status: 400 });

  if (isMock(b.mock)) {
    await new Promise((r) => setTimeout(r, 700));
    return Response.json(mockGrade(b));
  }

  const model = b.kind === "image" ? visionModel(b.model) : getModel(b.model);
  if (!model) {
    return Response.json(
      { error: "None of your models can read photos. Add a GROQ_API_KEY (Qwen) or use Kimi K3 on NVIDIA to get photo feedback.", code: "no-vision" },
      { status: 422 },
    );
  }

  const brief = [
    b.lesson ? `Lesson: ${b.lesson}` : "",
    `Question: ${b.question}`,
    b.modelAnswer ? `A strong answer says: ${b.modelAnswer}` : "",
    b.lookFor?.length ? `A good answer shows: ${b.lookFor.join("; ")}` : "",
    b.kind === "text" ? `Learner's answer: ${b.response!.slice(0, 3000)}` : "The learner's answer is the attached photo.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const messages = [
      { role: "system" as const, content: SYSTEM },
      {
        role: "user" as const,
        content: b.kind === "image" ? [{ type: "text" as const, text: brief }, { type: "image_url" as const, image_url: { url: b.image! } }] : brief,
      },
    ];
    // Typed answers are marked by the fast model when there is one (a second or two); photos need a model that can see.
    const fast = b.kind === "text" && b.fast !== false ? fastModel() : null;
    let raw = "";
    let markedBy = model.name;
    if (fast) {
      try {
        raw = await complete(fast.model.id, fast.params, messages, { maxTokens: 700, signal: request.signal, timeoutMs: 30_000, idleMs: 20_000 });
        parseJson(raw);
        markedBy = fast.model.name;
      } catch {
        raw = "";
      }
    }
    if (!raw) raw = await complete(model.id, model.id === b.model ? b.params : undefined, messages, { maxTokens: 900, signal: request.signal, timeoutMs: 90_000 });
    const o = parseJson<Partial<GradeResult>>(raw);
    const verdict = (["correct", "partial", "incorrect"] as const).includes(o.verdict as never) ? (o.verdict as GradeResult["verdict"]) : "unsure";
    const score = typeof o.score === "number" ? Math.min(1, Math.max(0, o.score)) : verdict === "correct" ? 1 : verdict === "partial" ? 0.5 : 0;
    return Response.json({ verdict, score, feedback: String(o.feedback ?? "").slice(0, 600), seen: o.seen ? String(o.seen).slice(0, 300) : undefined, model: markedBy } satisfies GradeResult);
  } catch (e) {
    if (e instanceof LlmError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't mark that." }, { status: 500 });
  }
}
