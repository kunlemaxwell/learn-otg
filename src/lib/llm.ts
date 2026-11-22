import "server-only";
// One-shot (non-streaming) model calls for course outlines and quizzes.
import { getModel, sanitizeParams, type ParamValues } from "./models";
import { getProvider, providerKeyName } from "./providers";

export class LlmError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type Msg = { role: "system" | "user" | "assistant"; content: string | Part[] };

/**
 * One model call that returns the whole answer. It streams under the hood so that a slow provider
 * can't hang it: if nothing arrives for `idleMs` the call is cut off, and progress is reported as it goes.
 */
export async function complete(
  modelId: string,
  rawParams: ParamValues | undefined,
  messages: Msg[],
  opts: { maxTokens?: number; signal?: AbortSignal; timeoutMs?: number; idleMs?: number; onProgress?: (content: string, reasoningChars: number) => void } = {},
): Promise<string> {
  const model = getModel(modelId);
  const provider = getProvider(model.provider);
  if (!provider.apiKey) throw new LlmError(`${providerKeyName(model.provider)} is missing. Add it to .env.local or pick another model.`, 500);

  const params = sanitizeParams(model, rawParams);
  let req: Record<string, unknown> = { ...params };
  if (model.thinkingSwitch && params.reasoning_effort === "off") {
    const { reasoning_effort: _d, ...rest } = req;
    void _d;
    req = { ...rest, chat_template_kwargs: { enable_thinking: false, thinking: false } };
  } else if (params.reasoning_effort === "off") {
    req = { ...req, reasoning_effort: "low" };
  }
  // Structured output wants steady answers.
  if (typeof req.temperature === "number") req.temperature = Math.min(req.temperature as number, 0.5);
  delete req.max_tokens;
  delete req.max_completion_tokens;

  const ctrl = new AbortController();
  const total = setTimeout(() => ctrl.abort("timeout"), opts.timeoutMs ?? 180_000);
  let idle: ReturnType<typeof setTimeout> | null = null;
  let why: "timeout" | "idle" | null = null;
  const arm = () => {
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => {
      why = "idle";
      ctrl.abort("idle");
    }, opts.idleMs ?? 60_000);
  };
  const onOuterAbort = () => ctrl.abort("client");
  opts.signal?.addEventListener("abort", onOuterAbort, { once: true });

  const send = async (body: Record<string, unknown>) => {
    try {
      return await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw abortError(e);
    }
  };
  const abortError = (e: unknown) => {
    if (why === "idle") return new LlmError(`${provider.name} stopped responding. Try again.`, 504);
    if (ctrl.signal.aborted && ctrl.signal.reason === "timeout") return new LlmError(`${provider.name} took too long to answer. Try again.`, 504);
    if (opts.signal?.aborted) return new LlmError("Cancelled.", 499);
    return new LlmError(`Couldn't reach ${provider.name}: ${e instanceof Error ? e.message : String(e)}`, 502);
  };

  try {
    arm();
    const base = { model: model.id, messages, stream: true, ...(model.fixed ?? {}) };
    const tokenKey = model.provider === "groq" ? "max_completion_tokens" : "max_tokens";
    let res = await send({ ...base, ...req, [tokenKey]: opts.maxTokens ?? 4000 });
    if (!res.ok && (res.status === 400 || res.status === 422) && req.chat_template_kwargs) {
      const { chat_template_kwargs: _k, ...rest } = req;
      void _k;
      res = await send({ ...base, ...rest, reasoning_effort: "low", [tokenKey]: opts.maxTokens ?? 4000 });
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      const msg =
        res.status === 401 || res.status === 403
          ? `${provider.name} rejected the API key.`
          : res.status === 429
            ? `${provider.name} is rate-limiting you. Wait a minute and try again.`
            : res.status === 413
              ? "That is too much material for this model's free tier. Try fewer or smaller files."
              : `${provider.name} returned ${res.status}: ${text.slice(0, 240)}`;
      throw new LlmError(msg, res.status === 429 ? 429 : 502);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let content = "";
    let reasoning = "";
    let finish = "";
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (e) {
        throw abortError(e);
      }
      if (chunk.done) break;
      arm();
      buf += dec.decode(chunk.value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const raw of lines) {
        const l = raw.trim();
        if (!l.startsWith("data:")) continue;
        const data = l.slice(5).trim();
        if (data === "[DONE]") continue;
        let j: { error?: { message?: string } | string; choices?: { delta?: { content?: string; reasoning_content?: string; reasoning?: string }; finish_reason?: string | null }[] };
        try {
          j = JSON.parse(data);
        } catch {
          continue;
        }
        if (j.error) throw new LlmError(typeof j.error === "string" ? j.error : String(j.error.message ?? "Model error"), 502);
        const c = j.choices?.[0];
        if (c?.delta?.content) content += c.delta.content;
        const r = c?.delta?.reasoning_content ?? c?.delta?.reasoning;
        if (r) reasoning += r;
        if (c?.finish_reason) finish = c.finish_reason;
        opts.onProgress?.(content, reasoning.length);
      }
    }
    if (content.trim()) return content;
    // Some models put the whole answer in the reasoning channel when thinking is switched off.
    if (/[{[]/.test(reasoning) && reasoning.includes("}")) return reasoning;
    throw new LlmError(
      finish === "length"
        ? "The model used up its whole answer budget thinking. Try again, or pick a faster model in Settings."
        : "The model returned an empty answer. Try again.",
      502,
    );
  } finally {
    clearTimeout(total);
    if (idle) clearTimeout(idle);
    opts.signal?.removeEventListener("abort", onOuterAbort);
  }
}

/** Pull the first JSON object out of a model reply (handles ``` fences and stray prose). */
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : cleaned;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new LlmError("The model didn't return usable data. Try again.", 502);
  try {
    return JSON.parse(body.slice(start, end + 1)) as T;
  } catch {
    // Trailing commas are the usual culprit.
    try {
      return JSON.parse(body.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1")) as T;
    } catch {
      throw new LlmError("The model's answer was cut off or malformed. Try again.", 502);
    }
  }
}
