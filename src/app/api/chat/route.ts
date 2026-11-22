import { pickComponents, saveFromLesson, type ComponentMode } from "@/lib/component-library";
import { compactHistory, learnerRecord, RECALL_TOOL, textOf, type InMsg, type Progress } from "@/lib/memory";
import { MOCK_LESSON } from "@/lib/mock";
import { mockPage } from "@/lib/mock-pages";
import { getModel, MODELS, sanitizeParams, type ModelDef, type ParamValues } from "@/lib/models";
import { backupModel } from "@/lib/model-pick";
import { hasNamedArguments, recentLook } from "@/lib/lesson-code";
import { buildContext, getSystemPrompt, type CourseBrief } from "@/lib/prompt";
import { getProvider, providerKeyName } from "@/lib/providers";
import { isFollowUp, needsFreshInfo, research, type ResearchStep } from "@/lib/research";
import { quickAvailable, streamQuickAnswer } from "@/lib/quick";
import { DAY, HOUR, lessonCache, normalizeQuestion } from "@/lib/store";
import { describeTool, runTool, searchProviderName, TOOL_DEFS } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ChatRequest = {
  model: string;
  params?: ParamValues;
  messages: InMsg[];
  browsing?: boolean;
  componentMode?: ComponentMode;
  progress?: Progress[];
  instant?: boolean;
  mock?: boolean;
  profile?: string;
  course?: CourseBrief; // set when a course lesson is being generated
  learned?: string; // relevant items from the learner's memory
  pageContext?: string; // what the learner is looking at (contextual chat)
  mockFail?: "429" | "500" | "stall"; // demo mode: simulate a failure to exercise retries
  allowBackup?: boolean;
  useBackup?: boolean; // the chosen model keeps failing: write this with the backup model
};

/** A course page whose model has thought this much without writing anything is cut off and retried. */
const THINK_LIMIT = 9000;
// Briefly avoid repeating a stalled provider request on every lesson. The selected model is unchanged.
const stalledModels = new Map<string, number>();

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ApiMessage = Record<string, unknown>;
type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };

const MAX_TOOL_ROUNDS = 2;
const WEB_SEARCH_TOOL = TOOL_DEFS[0];

const encoder = new TextEncoder();
const line = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function friendlyError(model: ModelDef, status: number, body: string): string {
  const p = model.providerName;
  if (status === 401 || status === 403)
    return model.provider === "nvidia"
      ? "NVIDIA rejected the API key, or this model isn't enabled for it yet. Open the model's page on build.nvidia.com and click “Try API” once, then retry."
      : `${p} rejected the API key. Check ${providerKeyName(model.provider)} in .env.local.`;
  if (status === 404) return `${p} couldn't find ${model.name}. It may have been renamed or retired.`;
  if (status === 413) return `This request is too big for ${p}'s free tier. Start a new chat or turn web browsing off.`;
  if (status === 429)
    return model.provider === "groq"
      ? "Groq's free tier allows about 8,000 tokens a minute. Wait a minute, or switch to GLM-5.3 (NVIDIA) for longer lessons."
      : "You've hit NVIDIA's free-tier rate limit (about 40 requests a minute). Wait a moment and try again.";
  if (status >= 500) return `${p}'s service had a problem. Try again in a moment.`;
  return `${p} returned ${status}: ${body.slice(0, 300)}`;
}

function streamCached(text: string, tools: unknown[], extra: Record<string, unknown>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const t0 = Date.now();
      controller.enqueue(line({ type: "status", text: "Loaded from cache" }));
      for (const t of tools as ResearchStep[]) {
        controller.enqueue(line({ type: "tool_start", id: t.id, name: t.name, label: t.label }));
        controller.enqueue(line({ type: "tool_end", id: t.id, ok: t.ok, summary: t.summary, sources: t.sources }));
      }
      for (let i = 0; i < text.length; i += 400) controller.enqueue(line({ type: "content", text: text.slice(i, i + 400) }));
      controller.enqueue(line({ type: "timing", timing: { cached: true, totalMs: Date.now() - t0, firstContentMs: Date.now() - t0, ...extra } }));
      controller.enqueue(line({ type: "done" }));
      controller.close();
    },
  });
}

function mockStream(browsing: boolean, model: ModelDef, mode: ComponentMode, question: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const t0 = Date.now();
      const send = (o: unknown) => controller.enqueue(line(o));
      let researchMs = 0;
      if (browsing) {
        const sources = [
          { title: "Heart rate: What's normal? — Mayo Clinic", url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/expert-answers/heart-rate/faq-20057979" },
          { title: "Target Heart Rates Chart — American Heart Association", url: "https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates" },
        ];
        send({ type: "tool_start", id: "r_s0", name: "web_search", label: "Searching “how the heart pumps blood”" });
        send({ type: "tool_start", id: "r_p0", name: "open_url", label: "Reading mayoclinic.org" });
        await wait(300);
        send({ type: "tool_end", id: "r_s0", ok: true, summary: "2 results", sources });
        send({ type: "tool_end", id: "r_p0", ok: true, summary: "Heart rate: What's normal?", sources: [sources[0]] });
        researchMs = Date.now() - t0;
      }
      const quick = "Your heart is really two pumps side by side. The right side sends used blood to your lungs to pick up oxygen, and the left side, the strongest part, pushes that fresh blood around your whole body (Mayo Clinic).";
      for (let i = 0; i < quick.length; i += 24) {
        send({ type: "quick", text: quick.slice(i, i + 24) });
        await wait(15);
      }
      send({ type: "reasoning", text: "Planning a short visual lesson… " });
      const tFirst = Date.now() - t0;
      for (let i = 0; i < MOCK_LESSON.length; i += 60) {
        send({ type: "content", text: MOCK_LESSON.slice(i, i + 60) });
        await wait(8);
      }
      const saved = saveFromLesson(MOCK_LESSON, question, mode);
      send({
        type: "timing",
        timing: {
          totalMs: Date.now() - t0,
          researchMs,
          firstTokenMs: tFirst,
          firstContentMs: tFirst,
          model: model.name,
          provider: "Demo",
          usage: { prompt_tokens: 4210, completion_tokens: 980 },
          tokensPerSec: 480,
          quickFirstMs: researchMs + 180,
          thinkingMs: 40,
          savedComponents: saved,
          reusedComponents: 0,
          cached: false,
        },
      });
      send({ type: "done" });
      controller.close();
    },
  });
}

function mockPageStream(page: NonNullable<CourseBrief["page"]>, fail?: ChatRequest["mockFail"]): ReadableStream<Uint8Array> {
  const text = mockPage(page.index, page.total, page.answers);
  return new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(line(o));
      try {
        send({ type: "status", text: "Writing" });
        await wait(600);
        const cut = fail === "500" || fail === "stall" ? Math.floor(text.length / 3) : text.length;
        for (let i = 0; i < cut; i += 48) {
          send({ type: "content", text: text.slice(i, Math.min(i + 48, cut)) });
          await wait(22);
        }
        if (fail === "500") {
          send({ type: "error", message: "NVIDIA's service had a problem. Try again in a moment.", status: 502 });
          return;
        }
        if (fail === "stall") {
          await wait(45_000);
          return;
        }
        send({ type: "done" });
      } catch {
        // client went away
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
}

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const selectedName = getModel(body.model).name;
  const cooling = body.allowBackup !== false && !body.useBackup && (stalledModels.get(body.model) ?? 0) > Date.now();
  const backup = body.useBackup || cooling ? backupModel(body.model) : null;
  if (backup) {
    body.model = backup.model.id;
    body.params = backup.params;
  }
  const hasAttachedImage = body.messages?.some(m => Array.isArray(m.content) && m.content.some(p => p.type === "image_url"));
  if (hasAttachedImage && (!getModel(body.model).supportsImages || !getProvider(getModel(body.model).provider).apiKey)) {
    const vision = MODELS.find(m => m.supportsImages && getProvider(m.provider).apiKey);
    if (!vision) return Response.json({ error: "No vision model is configured for screenshots." }, { status: 422 });
    body.model = vision.id;
    body.params = undefined;
  }
  const model = getModel(body.model);
  const provider = getProvider(model.provider);
  const browsing = body.browsing !== false && body.course?.sourcePolicy !== "strict";
  const mode: ComponentMode = body.componentMode ?? "auto";
  const messages = (body.messages ?? []).filter((m) => m && (m.role === "user" || m.role === "assistant"));
  const last = messages.at(-1);
  if (!last || last.role !== "user") return Response.json({ error: "The last message must be from the learner." }, { status: 400 });
  const question = textOf(last.content).trim();
  const hasImage = typeof last.content !== "string" && last.content.some((p) => p.type === "image_url");

  const headers = { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" };

  const useMock = process.env.LEARN_OTG_MOCK === "1" || (!process.env.NVIDIA_API_KEY && !process.env.GROQ_API_KEY) || (body.mock === true && process.env.NODE_ENV !== "production");
  if (useMock && body.course?.page) {
    if (body.mockFail === "429") return Response.json({ error: "You've hit NVIDIA's free-tier rate limit (about 40 requests a minute). Wait a moment and try again.", retryAfter: 3 }, { status: 429 });
    return new Response(mockPageStream(body.course.page, body.mockFail), { headers });
  }
  if (useMock) return new Response(mockStream(browsing, model, mode, question), { headers });

  if (!provider.apiKey) {
    return Response.json(
      { error: `${providerKeyName(model.provider)} is missing. Add it to .env.local and restart, or pick another model.` },
      { status: 500 },
    );
  }

  // ---- Lesson cache: first question of a chat, no image ----
  const firstTurn = messages.filter((m) => m.role === "user").length === 1;
  const cacheKey = firstTurn && !hasImage && !body.course ? `${model.id}${model.lean ? "|compact-v3" : ""}|${browsing ? "web" : "noweb"}|${normalizeQuestion(question)}` : null;
  if (cacheKey) {
    const hit = lessonCache.get(cacheKey);
    if (hit && !hasNamedArguments(hit.text)) return new Response(streamCached(hit.text, hit.tools, { model: model.name, provider: provider.name }), { headers });
  }

  const params = sanitizeParams(model, body.params);
  const compacted = compactHistory(messages, { lean: model.lean, supportsImages: model.supportsImages });
  const components = pickComponents(question, mode, model.lean ? 1 : 2);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(line(obj));
      const t0 = Date.now();
      if(cooling && backup)send({type:"notice",text:`${selectedName} is temporarily unresponsive. Using ${backup.label} for this lesson.`});
      let firstTokenMs: number | null = null;
      let firstContentMs: number | null = null;
      let usage: Usage | null = null;
      let researchMs = 0;
      const researchSteps: ResearchStep[] = [];
      let finalText = "";
      let cleanupUpstream = () => {};
      let quickPromise: Promise<{ firstMs: number | null; ok: boolean }> | null = null;
      const wantQuick =
        body.instant !== false && !body.course && model.provider !== "groq" && quickAvailable() && !/^(another question|quiz me|next question)/i.test(question);
      const startQuick = (sources?: string) => {
        if (!wantQuick || quickPromise) return;
        const qStart = Date.now() - t0;
        quickPromise = streamQuickAnswer(question, {
          sources,
          signal: request.signal,
          onText: (text) => send({ type: "quick", text }),
        }).then((r) => ({ ...r, firstMs: r.firstMs != null ? r.firstMs + qStart : null }));
      };

      try {
        // ---- Research in parallel, before the model starts ----
        let digest = "";
        const prefetch =
          browsing && !(hasImage && question.length < 20) && (needsFreshInfo(question) || (model.groundAlways && !isFollowUp(question) && question.length > 12));
        if (!prefetch) startQuick();
        if (prefetch) {
          send({ type: "status", text: `Researching (${searchProviderName()})` });
          const r = await research(question, {
            lean: model.lean,
            signal: request.signal,
            emit: send,
            onSnippets: (snips) => startQuick(snips),
          });
          digest = r.digest;
          researchMs = r.ms;
          researchSteps.push(...r.steps);
          startQuick(digest || undefined);
        }

        const canSearch = browsing && model.supportsTools && !digest;
        const tools: unknown[] = [];
        if (canSearch) tools.push(WEB_SEARCH_TOOL);
        if (compacted.recallable && model.supportsTools) tools.push(RECALL_TOOL);

        const context = buildContext({
          browsing,
          sources: digest || undefined,
          learnerRecord: learnerRecord(body.progress) || undefined,
          savedComponents: components.text || undefined,
          memory: compacted.memory || undefined,
          canSearch,
          profile: typeof body.profile === "string" ? body.profile.slice(0, 900) : undefined,
          recentLooks: recentLook(messages.filter((m) => m.role === "assistant").map((m) => textOf(m.content))),
          course: body.course,
          learned: typeof body.learned === "string" ? body.learned.slice(0, 1500) : undefined,
          pageContext: typeof body.pageContext === "string" ? body.pageContext.slice(0, 1200) : undefined,
        });

        const userContent =
          typeof last.content === "string"
            ? `${context}\n\n${last.content}`
            : model.supportsImages
              ? [{ type: "text", text: context }, ...last.content]
              : `${context}\n\n${question}`;

        const conversation: ApiMessage[] = [
          { role: "system", content: getSystemPrompt(model.lean) },
          ...compacted.history,
          { role: "user", content: userContent },
        ];

        let toolsAllowed = tools.length > 0;
        // "Thinking off" for models that support a chat-template switch; falls back to low effort if rejected.
        let reqParams: Record<string, unknown> = { ...params };
        let thinkingOff = false;
        if (model.thinkingSwitch && params.reasoning_effort === "off") {
          const { reasoning_effort: _drop, ...rest } = reqParams;
          void _drop;
          // GLM chat templates read either key depending on version; unknown keys are ignored.
          reqParams = { ...rest, chat_template_kwargs: { enable_thinking: false, thinking: false } };
          thinkingOff = true;
        } else if (params.reasoning_effort === "off") {
          reqParams = { ...reqParams, reasoning_effort: "low" };
        }
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const withTools = toolsAllowed && round < MAX_TOOL_ROUNDS;
          let upstream: Response;
          const upstreamCtrl = new AbortController();
          cleanupUpstream();
          let idleTimer: ReturnType<typeof setTimeout>;
          const armIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => upstreamCtrl.abort(new Error(`${provider.name} stopped responding before the lesson was ready.`)), 45_000); };
          const totalTimer = setTimeout(() => upstreamCtrl.abort(new Error(`${model.name} took too long to write the lesson.`)), 180_000);
          const stopUpstream = () => upstreamCtrl.abort();
          cleanupUpstream = () => { clearTimeout(idleTimer); clearTimeout(totalTimer); request.signal.removeEventListener("abort", stopUpstream); };
          armIdle();
          request.signal.addEventListener("abort", stopUpstream, { once: true });
          let overthinking = false;
          try {
            upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
              method: "POST",
              headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
              body: JSON.stringify({
                model: model.id,
                messages: conversation,
                stream: true,
                ...(model.streamUsage ? { stream_options: { include_usage: true } } : {}),
                ...reqParams,
                ...(model.fixed ?? {}),
                ...(withTools ? { tools, tool_choice: "auto" } : {}),
              }),
              signal: upstreamCtrl.signal,
            });
          } catch (err) {
            if (request.signal.aborted) return;
            throw err;
          }

          if (!upstream.ok && thinkingOff && (upstream.status === 400 || upstream.status === 422)) {
            const why = await upstream.text().catch(() => "");
            console.warn(`[learn-otg] ${model.id} rejected thinking-off (${upstream.status}); using low effort. ${why.slice(0, 200)}`);
            const { chat_template_kwargs: _k, ...rest } = reqParams;
            void _k;
            reqParams = { ...rest, reasoning_effort: "low" };
            thinkingOff = false;
            round--;
            continue;
          }
          if (!upstream.ok && withTools && (upstream.status === 400 || upstream.status === 422)) {
            await upstream.text().catch(() => "");
            toolsAllowed = false;
            send({ type: "notice", text: `${model.name} didn't accept tools here, so this answer uses the sources already found.` });
            round--;
            continue;
          }
          if (!upstream.ok || !upstream.body) {
            const text = await upstream.text().catch(() => "");
            send({ type: "error", message: friendlyError(model, upstream.status, text), status: upstream.status, retryAfter: Number(upstream.headers.get("retry-after")) || undefined });
            return;
          }

          const reader = upstream.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let content = "";
          let reasoning = "";
          let finishReason = "";
          const calls: ToolCall[] = [];

          const handle = (data: string) => {
            if (data === "[DONE]") return;
            let json: {
              error?: { message?: string } | string;
              choices?: { delta?: Record<string, unknown>; finish_reason?: string }[];
              usage?: Usage;
              x_groq?: { usage?: Usage };
            };
            try {
              json = JSON.parse(data);
            } catch {
              return;
            }
            if (json.error) {
              const e = json.error;
              throw new Error(typeof e === "string" ? e : String(e.message ?? "Model error"));
            }
            const u = json.usage ?? json.x_groq?.usage;
            if (u) usage = u;
            finishReason = json.choices?.[0]?.finish_reason ?? finishReason;
            const delta = (json.choices?.[0]?.delta ?? {}) as {
              content?: string;
              reasoning_content?: string;
              reasoning?: string;
              tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
            };
            const r = delta.reasoning_content ?? delta.reasoning;
            if (r) {
              firstTokenMs ??= Date.now() - t0;
              reasoning += r;
              if ((body.course || params.reasoning_effort === "off") && !content && reasoning.length > THINK_LIMIT && !overthinking) {
                overthinking = true;
                upstreamCtrl.abort();
              }
              send({ type: "reasoning", text: r });
            }
            if (delta.content) {
              firstTokenMs ??= Date.now() - t0;
              firstContentMs ??= Date.now() - t0;
              content += delta.content;
              send({ type: "content", text: delta.content });
            }
            for (const tc of delta.tool_calls ?? []) {
              const i = tc.index ?? calls.length;
              calls[i] ??= { id: tc.id ?? `call_${round}_${i}`, type: "function", function: { name: "", arguments: "" } };
              if (tc.id) calls[i].id = tc.id;
              if (tc.function?.name) calls[i].function.name += tc.function.name;
              if (tc.function?.arguments) calls[i].function.arguments += tc.function.arguments;
            }
          };

          while (true) {
            let chunk: ReadableStreamReadResult<Uint8Array>;
            try {
              chunk = await reader.read();
            } catch (e) {
              if (overthinking) break;
              throw e;
            }
            const { value, done } = chunk;
            if (done) break;
            armIdle();
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n");
            buffer = events.pop() ?? "";
            for (const raw of events) {
              const evt = raw.trim();
              if (evt.startsWith("data:")) handle(evt.slice(5).trim());
            }
          }
          if (buffer.trim().startsWith("data:") && !overthinking) handle(buffer.trim().slice(5).trim());
          cleanupUpstream();
          if (overthinking) {
            throw new Error(`${model.name} spent too long thinking without writing the lesson.`);
          }

          if (thinkingOff && reasoning.length > 200) {
            console.warn(`[learn-otg] ${model.id} thought anyway with thinking off (${reasoning.length} chars of reasoning).`);
          }
          const toolCalls = calls.filter((c) => c && c.function.name);
          if (!toolCalls.length) {
            if (finishReason === "length") throw new Error(`${model.name} reached its answer limit before finishing. Increase the answer budget or try a shorter lesson.`);
            if (!content.trim()) throw new Error(`${model.name} returned no lesson content. Try again or choose another model.`);
            finalText = content;
            break;
          }

          if (content) {
            send({ type: "reset" });
            firstContentMs = null;
          }
          const assistantTurn: ApiMessage = { role: "assistant", content: content || null, tool_calls: toolCalls };
          if (model.echoReasoning && reasoning) assistantTurn.reasoning_content = reasoning;
          conversation.push(assistantTurn);

          await Promise.all(
            toolCalls.map(async (call) => {
              let result: string;
              if (call.function.name === "recall_lesson") {
                let idx = 0;
                try {
                  idx = Number(JSON.parse(call.function.arguments || "{}").index);
                } catch {}
                const lesson = compacted.lessons.find((l) => l.index === idx);
                send({ type: "status", text: `Recalling lesson ${idx}` });
                result = lesson ? JSON.stringify({ index: idx, title: lesson.title, lesson: lesson.text }) : JSON.stringify({ error: "No such lesson" });
              } else {
                const label = describeTool(call.function.name, call.function.arguments);
                send({ type: "tool_start", id: call.id, name: call.function.name, label });
                const out = await runTool(call.function.name, call.function.arguments, request.signal);
                researchSteps.push({ id: call.id, name: call.function.name, label, ok: out.ok, summary: out.summary, sources: out.sources });
                send({ type: "tool_end", id: call.id, ok: out.ok, summary: out.summary, sources: out.sources });
                result = out.result;
              }
              conversation.push({ role: "tool", tool_call_id: call.id, content: result });
            }),
          );
        }

        if(hasNamedArguments(finalText))throw new Error(`${model.name} returned a lesson format that could not be displayed. Try again.`);

        // ---- Save reusable components and cache the lesson ----
        let saved = 0;
        if (finalText.includes("root")) {
          saved = saveFromLesson(finalText, question, mode);
          if (cacheKey) {
            const usedSources = researchSteps.length > 0;
            lessonCache.set(
              cacheKey,
              { text: finalText, tools: researchSteps, usedSources, modelId: model.id, createdAt: Date.now() },
              usedSources ? 6 * HOUR : 7 * DAY,
            );
          }
        }

        const quickResult = quickPromise ? await (quickPromise as Promise<{ firstMs: number | null; ok: boolean }>) : null;
        const totalMs = Date.now() - t0;
        const u = usage as Usage | null;
        const genMs = firstTokenMs != null ? totalMs - firstTokenMs : totalMs;
        send({
          type: "timing",
          timing: {
            totalMs,
            researchMs,
            firstTokenMs,
            firstContentMs,
            model: model.name,
            provider: provider.name,
            usage: u ? { prompt_tokens: u.prompt_tokens, completion_tokens: u.completion_tokens, cached_tokens: u.prompt_tokens_details?.cached_tokens } : null,
            tokensPerSec: u?.completion_tokens && genMs > 0 ? Math.round((u.completion_tokens / genMs) * 1000) : null,
            savedComponents: saved,
            reusedComponents: components.count,
            quickFirstMs: quickResult?.firstMs ?? null,
            thinkingMs: firstTokenMs != null && firstContentMs != null ? Math.max(0, firstContentMs - firstTokenMs) : null,
            waitMs: firstTokenMs != null ? Math.max(0, firstTokenMs - researchMs) : null,
            thinkingOff,
            cached: false,
          },
        });
        send({ type: "done" });
      } catch (err) {
        if (!request.signal.aborted && firstContentMs === null && !body.useBackup && !backup && body.allowBackup !== false && backupModel(model.id)) {
          if(err instanceof Error && /stopped responding|took too long/.test(err.message))stalledModels.set(model.id,Date.now()+180_000);
          send({ type: "notice", text: `${model.name} did not finish. Trying the backup model.` });
          try {
            const fallback = await POST(new Request(request.url, {method:"POST",headers:{"Content-Type":"application/json"},signal:request.signal,body:JSON.stringify({...body,useBackup:true,instant:false})}));
            if (fallback.ok && fallback.body) { const reader=fallback.body.getReader(); for (;;) {const {value,done}=await reader.read();if(done)break;controller.enqueue(value);} }
            else send({type:"error",message:(await fallback.json().catch(()=>({}))).error ?? "The backup model could not finish the lesson."});
          } catch(fallbackError) { if(!request.signal.aborted)send({type:"error",message:fallbackError instanceof Error?fallbackError.message:"The backup model could not finish the lesson."}); }
        } else if (!request.signal.aborted) send({ type: "error", message: err instanceof Error ? err.message : "Stream interrupted", status: 504 });
      } finally {
        cleanupUpstream();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}
