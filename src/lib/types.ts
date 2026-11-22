export type Source = { title: string; url: string; snippet?: string };

export type ToolStep = {
  id: string;
  name: string;
  label: string;
  status: "running" | "done" | "failed";
  summary?: string;
  sources?: Source[];
};

export type Timing = {
  totalMs?: number;
  researchMs?: number;
  firstTokenMs?: number | null;
  firstContentMs?: number | null;
  model?: string;
  provider?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number } | null;
  tokensPerSec?: number | null;
  savedComponents?: number;
  reusedComponents?: number;
  cached?: boolean;
  quickFirstMs?: number | null;
  thinkingMs?: number | null;
  waitMs?: number | null;
  thinkingOff?: boolean;
};

export type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  display?: string; // what the chat bubble shows, when different from what the model receives
  image?: string;
  attachments?: { name: string; text?: string }[];
  reasoning?: string;
  error?: string;
  notice?: string;
  streaming?: boolean;
  tools?: ToolStep[];
  timing?: Timing;
  quick?: string;
  thinkStart?: number;
  thinkEnd?: number;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  messages: Msg[];
  starred?: boolean;
};

/** Unique sources across a message's tool steps, in the order they were found. */
export function messageSources(m: Msg, limit = 8): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  // Pages the model actually opened first, then search results.
  const steps = [...(m.tools ?? [])].sort((a, b) => Number(b.name === "open_url") - Number(a.name === "open_url"));
  for (const step of steps) {
    for (const s of step.sources ?? []) {
      const key = s.url.replace(/[#?].*$/, "").replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
