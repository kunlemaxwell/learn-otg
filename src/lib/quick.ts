import "server-only";
// Instant answer: a 2–3 sentence plain-text answer from a fast model on Groq,
// streamed within a second or two while the full visual lesson is being built.
// Grounded with the same web sources as the lesson. Qwen 3.8 27B is used because
// its "makes things up when unsure" rate (~30%) is about the same as GLM-5.3's.
import { getProvider } from "./providers";

export const QUICK_MODEL = "qwen/qwen3.8-27b";

const SYSTEM = `You are Learn OTG's instant-answer helper for learners on their phone.
Answer the question in 2–3 short, plain sentences (max 70 words). No markdown, lists or headings.
Lead with the direct answer. Use SOURCES for facts when given and name the source in passing.
If you are not sure, say so briefly. A full visual lesson follows, so don't promise more.`;

export function quickAvailable(): boolean {
  return Boolean(getProvider("groq").apiKey);
}

export async function streamQuickAnswer(
  question: string,
  opts: { sources?: string; signal?: AbortSignal; onText: (t: string) => void },
): Promise<{ firstMs: number | null; ok: boolean }> {
  const provider = getProvider("groq");
  if (!provider.apiKey) return { firstMs: null, ok: false };
  const t0 = Date.now();
  let firstMs: number | null = null;
  const user = opts.sources
    ? `SOURCES:\n${opts.sources.slice(0, 2600)}\n\nToday is ${new Date().toDateString()}.\n\nQuestion: ${question}`
    : `Today is ${new Date().toDateString()}.\n\nQuestion: ${question}`;
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: QUICK_MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        stream: true,
        temperature: 0.3,
        max_completion_tokens: 220,
        reasoning_effort: "none",
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) return { firstMs: null, ok: false };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const raw of lines) {
        const l = raw.trim();
        if (!l.startsWith("data:")) continue;
        const data = l.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          const t: string | undefined = j.choices?.[0]?.delta?.content;
          if (t) {
            firstMs ??= Date.now() - t0;
            opts.onText(t);
          }
        } catch {}
      }
    }
    return { firstMs, ok: firstMs != null };
  } catch {
    return { firstMs, ok: false };
  }
}
