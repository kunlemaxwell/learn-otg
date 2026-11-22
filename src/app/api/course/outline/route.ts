import { courseSize } from "@/lib/course-size";
import { complete, LlmError, parseJson } from "@/lib/llm";
import { isMock, mockOutline } from "@/lib/course-mock";
import { getModel, type ParamValues } from "@/lib/models";
import { backupModel, fastModel } from "@/lib/model-pick";
import type { CourseOptions } from "@/lib/course-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Req = {
  model: string;
  params?: ParamValues;
  topic: string;
  level?: string;
  goal?: string;
  options: CourseOptions;
  profile?: string;
  files?: { name: string; text: string }[];
  mock?: boolean;
  allowBackup?: boolean;
  fast?: boolean; // use the fast planning model when there's no material
};

type Outline = {
  title?: string;
  blurb?: string;
  mood?: string;
  level?: string;
  digest?: string;
  sections?: { title?: string; summary?: string; lessons?: { title?: string; summary?: string; notes?: string; pages?: unknown[] }[] }[];
};

const SYSTEM = `You design short, practical courses for a mobile learning app. Reply with ONE JSON object and nothing else.
Shape: {"title": string, "blurb": string (one sentence), "mood": "forest"|"sun"|"lagoon"|"berry"|"clay"|"graphite", "level": string, "digest": string, "sections": [{"title": string, "summary": string, "lessons": [{"title": string, "summary": string, "notes": string, "pages": [string]}]}]}
Rules:
- Order sections and lessons so each builds on the one before. Lesson titles are specific, phrased as a question or a short claim, 10 words at most. Sentence case.
- summary = one sentence saying what the learner will understand by the end of that section or lesson.
- mood by subject: life science forest; physics, earth, space, geography lagoon; money, business sun; health, psychology, arts berry; history, culture, language, society clay; maths, computing, logic graphite.
- Follow SOURCE POLICY. With source-only policy, build the course FROM the material: cover what it covers, in a teachable order, and do not invent facts it does not contain. digest = a faithful 5-8 sentence summary of the material. notes = for each lesson, the specific facts, figures, definitions or quotes from the material that the lesson should use (up to 450 characters, empty string if none apply).
- With no material, digest and notes are empty strings.
- pages: the short pages each lesson is split into, in order, each written as "Page title | what this page does" (under 16 words). The first page introduces the idea; later pages explain, show it working (a visual, worked example, simulation or scenario) and let the learner practise. Start a page with "*" when it should be written AFTER the learner answers the page before (practice that should get easier or harder depending on how they did).
- No emoji. No exclamation marks.`;

function shape(o: CourseOptions): string {
  if(o.sizeMode){const s=courseSize(o);return `EXACTLY ${s.lessons} lessons total, organized into suitable sections, EXACTLY ${s.pages} pages in every lesson. Never exceed or undershoot the lesson total. A single lesson/page is one focused article with practice.`;}
  const depth = o.depth === "auto" ? "standard" : o.depth;
  const sections = o.sections === "auto" ? (depth === "quick" ? "2 to 3" : depth === "deep" ? "5 to 7" : "3 to 5") : String(o.sections);
  const per = o.lessonsPerSection === "auto" ? (depth === "quick" ? "2" : depth === "deep" ? "4 to 5" : "3 to 4") : String(o.lessonsPerSection);
  const pages = typeof o.pagesPerLesson === "number" ? String(o.pagesPerLesson) : depth === "quick" ? "2" : depth === "deep" ? "4" : "3";
  return `${sections} sections, ${per} lessons in each, ${pages} pages per lesson (depth: ${depth}).`;
}

function material(files: Req["files"], lean: boolean): string {
  const list = (files ?? []).filter((f) => f.text.trim());
  if (!list.length) return "";
  const budget = lean ? 7000 : 26000;
  const each = Math.max(1200, Math.floor(budget / list.length));
  return list.map((f) => `--- ${f.name} ---\n${f.text.slice(0, each)}`).join("\n\n");
}

/** "Title | goal" strings (or {title, goal} objects) → page plans. A leading * marks a page that adapts to answers. */
function parsePages(raw: unknown): { title: string; goal: string; adaptive?: boolean }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .map((p) => {
      if (p && typeof p === "object") {
        const o = p as { title?: unknown; goal?: unknown; adaptive?: unknown };
        return o.title ? { title: String(o.title), goal: String(o.goal ?? ""), adaptive: Boolean(o.adaptive) } : null;
      }
      const t = String(p ?? "").trim();
      if (!t) return null;
      const adaptive = t.startsWith("*");
      const [title, ...rest] = t.replace(/^\*\s*/, "").split("|");
      return { title: title.trim().slice(0, 80), goal: rest.join("|").trim().slice(0, 200) || title.trim(), adaptive };
    })
    .filter((x): x is { title: string; goal: string; adaptive: boolean } => Boolean(x?.title));
  return out.length ? out.slice(0, 8) : undefined;
}

export async function POST(request: Request) {
  let body: Req;
  try {
    body = (await request.json()) as Req;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const topic = (body.topic ?? "").trim();
  const hasFiles = (body.files ?? []).some((f) => f.text?.trim());
  if (!topic && !hasFiles) return Response.json({ error: "Tell me what the course is about, or add a file." }, { status: 400 });

  if (isMock(body.mock)) {
    const o = mockOutline(topic);
    if(body.options.sizeMode){const size=courseSize(body.options);const samples=o.sections.flatMap(s=>s.lessons);o.sections=[{title:"Your learning plan",summary:o.blurb,lessons:Array.from({length:size.lessons},(_,i)=>({...samples[i % samples.length],title:size.lessons===1?topic:samples[i % samples.length].title,plan:undefined}))}];}
    return new Response(
      [{ type: "progress", thinking: 0, sections: 1, lessons: 2, title: o.title }, { type: "done", outline: o }].map((x) => JSON.stringify(x)).join("\n") + "\n",
      { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } },
    );
  }
  const model = getModel(body.model);
  const mat = material(body.files, model.lean);
  const user = [
    `Topic: ${topic || "(derive it from the material)"}`,
    body.level && body.level !== "auto" ? `Level: ${body.level}` : "Level: choose what fits the learner and say it in the level field.",
    body.goal ? `Learner's goal: ${body.goal}` : "",
    `Size: ${shape(body.options)}`,
    body.options.sourcePolicy === "strict" ? "SOURCE POLICY: Use only the supplied sources and course references. Do not fill gaps with outside facts. If the material is insufficient, keep scope within what it establishes." : "SOURCE POLICY: Supplied sources are the foundation; general knowledge may add explanations and examples. Label additional context in notes. Never attribute outside information to a supplied source.",
    body.profile ? `Learner: ${body.profile}` : "",
    mat ? `LEARNER MATERIAL:\n${mat}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Stream progress lines (NDJSON) so the page can show what's happening, then the outline itself.
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      let last = 0;
      try {
        const messages = [
          { role: "system" as const, content: SYSTEM },
          { role: "user" as const, content: user },
        ];
        const onProgress = (content: string, thinking: number) => {
          const now = Date.now();
          if (now - last < 700) return;
          last = now;
          send({
            type: "progress",
            thinking: content ? 0 : thinking,
            sections: (content.match(/"lessons"\s*:/g) ?? []).length,
            lessons: (content.match(/"pages"\s*:/g) ?? []).length,
            title: content.match(/"title"\s*:\s*"([^"]+)"/)?.[1],
          });
        };
        // Outlines from the learner's own material use the chosen model (bigger context, more careful).
        const fast = body.fast !== false && !hasFiles ? fastModel() : null;
        let raw = "";
        let parsed: ReturnType<typeof toOutline> | null = null;
        if (fast) {
          try {
            raw = await complete(fast.model.id, fast.params, messages, { maxTokens: Math.min(6000,1200+courseSize(body.options).lessons*(100+courseSize(body.options).pages*25)), signal: request.signal, timeoutMs: 60_000, idleMs: 30_000, onProgress });
            parsed = toOutline(parseJson<Outline>(raw), topic, body.level, body.options);
          } catch (e) {
            if (request.signal.aborted) throw e;
            send({ type: "progress", thinking: 0, sections: 0, lessons: 0, note: `${fast.label} couldn't do it, using ${model.name}` });
          }
        }
        if (!parsed) {
          try {
            raw = await complete(body.model, body.params, messages, { maxTokens: Math.min(14000,1600+courseSize(body.options).lessons*(150+courseSize(body.options).pages*35)), signal: request.signal, timeoutMs: 120_000, idleMs: 45_000, onProgress });
            parsed = toOutline(parseJson<Outline>(raw), topic, body.level, body.options);
          } catch(e) {
            const backup = body.allowBackup !== false ? backupModel(body.model) : null;
            if(request.signal.aborted || !backup)throw e;
            send({type:"progress",thinking:0,sections:0,lessons:0,note:`${model.name} did not finish. Trying ${backup.label}.`});
            const backupMessages=[messages[0],{role:"user" as const,content:mat?user.replace(mat,material(body.files,true)):user}];
            raw=await complete(backup.model.id,backup.params,backupMessages,{maxTokens:4500,signal:request.signal,timeoutMs:75000,idleMs:30000,onProgress});
            parsed=toOutline(parseJson<Outline>(raw),topic,body.level,body.options);
          }
        }
        send({ type: "done", outline: parsed });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : "Something went wrong.", status: e instanceof LlmError ? e.status : 500 });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}

function toOutline(o: Outline, topic: string, level?: string, options?:CourseOptions) {
  const sections = (o.sections ?? [])
    .filter((s) => s?.title && Array.isArray(s.lessons) && s.lessons.length)
    .map((s) => ({
      title: String(s.title),
      summary: String(s.summary ?? ""),
      lessons: (s.lessons ?? [])
        .filter((l) => l?.title)
        .map((l) => ({ title: String(l.title), summary: String(l.summary ?? ""), notes: String(l.notes ?? "").slice(0, 600), plan: parsePages(l.pages) })),
    }))
    .filter((s) => s.lessons.length);
  if(options?.sizeMode){
    const wanted=courseSize(options).lessons;
    if(sections.reduce((n,s)=>n+s.lessons.length,0)<wanted)throw new LlmError(`The planner returned fewer than ${wanted} lessons. Try again.`,502);
    let remaining=wanted;
    for(const section of sections){section.lessons=section.lessons.slice(0,remaining);remaining-=section.lessons.length;}
    for(let i=sections.length-1;i>=0;i--)if(!sections[i].lessons.length)sections.splice(i,1);
  }
  if (!sections.length) throw new LlmError("The outline came back empty. Try again, or give a little more detail.", 502);
  return {
    title: String(o.title ?? topic ?? "New course").slice(0, 120),
    blurb: String(o.blurb ?? ""),
    mood: ["forest", "sun", "lagoon", "berry", "clay", "graphite"].includes(String(o.mood)) ? String(o.mood) : "forest",
    level: String(o.level ?? level ?? "Beginner"),
    digest: String(o.digest ?? "").slice(0, 1800),
    sections,
  };
}
