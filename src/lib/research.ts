import "server-only";
// Fast research: decide up front whether a question needs fresh facts, then run
// searches and page reads in parallel and hand the model one compact digest.
// One model call instead of a slow plan → search → read → answer loop.
import { HOUR, searchCache } from "./store";
import { openUrl, webSearch, type Source } from "./tools";

const FRESH =
  /\b(latest|current(ly)?|today|tonight|yesterday|this (week|month|year)|right now|now|recent(ly)?|news|update[sd]?|breaking|20(2[4-9]|3\d)|price[sd]?|cost[s]?|rate[s]?|exchange|inflation|stock|shares?|market|score[sd]?|fixture|match(es)?|result[s]?|election|elected|president|governor|minister|ceo|chair(man)?|who (is|are|won|runs|leads)|weather|forecast|release[sd]?|version|launch(ed)?|deadline|announced?|statistics?|population|ranking|top \d+)\b/i;

const FOLLOW_UP = /^(check my answer|go deeper|explain it differently|another question|quiz me|give me (another|3|three|a harder)|real-life example|next question)/i;

export function needsFreshInfo(q: string): boolean {
  return FRESH.test(q);
}

export function isFollowUp(q: string): boolean {
  return FOLLOW_UP.test(q.trim());
}

export type ResearchStep = { id: string; name: string; label: string; ok: boolean; summary: string; sources: Source[] };
type Emit = (event: Record<string, unknown>) => void;

function cleanQuery(q: string): string {
  return q
    .replace(/[?!.]+$/g, "")
    .replace(/^(please\s+)?(can you\s+|could you\s+)?(explain|tell me|teach me|show me)( about)?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

async function cachedSearch(query: string, n: number, signal?: AbortSignal): Promise<Source[]> {
  const key = `s:${query.toLowerCase()}:${n}`;
  const hit = searchCache.get(key) as Source[] | undefined;
  if (hit) return hit;
  const results = await webSearch(query, n, signal);
  if (results.length) searchCache.set(key, results, 3 * HOUR);
  return results;
}

async function cachedPage(url: string, chars: number, signal?: AbortSignal): Promise<{ title: string; url: string; text: string } | null> {
  const key = `p:${url}`;
  const hit = searchCache.get(key) as { title: string; url: string; text: string } | undefined;
  if (hit) return { ...hit, text: hit.text.slice(0, chars) };
  try {
    const t = AbortSignal.timeout(4500);
    const page = await openUrl(url, signal ? AbortSignal.any([signal, t]) : t);
    searchCache.set(key, page, 3 * HOUR);
    return { ...page, text: page.text.slice(0, chars) };
  } catch {
    return null;
  }
}

/** Runs parallel searches + page reads. Emits tool_start/tool_end events for the UI. */
export async function research(
  question: string,
  opts: { lean: boolean; signal?: AbortSignal; emit: Emit; onSnippets?: (digest: string) => void },
): Promise<{ digest: string; steps: ResearchStep[]; ms: number }> {
  const t0 = Date.now();
  const base = cleanQuery(question);
  const year = new Date().getFullYear();
  const queries = [base];
  if (needsFreshInfo(question) && !base.includes(String(year))) queries.push(`${base} ${year}`);
  const perQuery = opts.lean ? 4 : 5;
  const steps: ResearchStep[] = [];

  const searchResults = await Promise.all(
    queries.map(async (q, i) => {
      const id = `r_s${i}`;
      opts.emit({ type: "tool_start", id, name: "web_search", label: `Searching “${q}”` });
      try {
        const res = await cachedSearch(q, perQuery, opts.signal);
        const step = { id, name: "web_search", label: `Searching “${q}”`, ok: true, summary: `${res.length} results`, sources: res };
        steps.push(step);
        opts.emit({ type: "tool_end", id, ok: true, summary: step.summary, sources: res });
        return res;
      } catch (e) {
        const summary = e instanceof Error ? e.message.slice(0, 80) : "Search failed";
        steps.push({ id, name: "web_search", label: `Searching “${q}”`, ok: false, summary, sources: [] });
        opts.emit({ type: "tool_end", id, ok: false, summary: "Search failed", sources: [] });
        return [] as Source[];
      }
    }),
  );

  // Merge, de-duplicate, keep the best few.
  const seen = new Set<string>();
  const merged: Source[] = [];
  for (let i = 0; i < perQuery; i++) {
    for (const list of searchResults) {
      const s = list[i];
      if (!s) continue;
      const key = s.url.replace(/[#?].*$/, "").replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }
  }
  const top = merged.slice(0, opts.lean ? 4 : 5);
  if (!top.length) return { digest: "", steps, ms: Date.now() - t0 };
  opts.onSnippets?.(top.map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet ?? ""}`).join("\n\n"));

  // Read the top pages in parallel (short timeout; snippets are the fallback).
  const readCount = opts.lean ? 2 : 3;
  const chars = opts.lean ? 900 : 1500;
  const pages = await Promise.all(
    top.slice(0, readCount).map(async (s, i) => {
      const id = `r_p${i}`;
      let host = s.url;
      try {
        host = new URL(s.url).hostname.replace(/^www\./, "");
      } catch {}
      opts.emit({ type: "tool_start", id, name: "open_url", label: `Reading ${host}` });
      const page = await cachedPage(s.url, chars, opts.signal);
      const ok = Boolean(page?.text);
      const sources = page ? [{ title: page.title || s.title, url: s.url }] : [];
      steps.push({ id, name: "open_url", label: `Reading ${host}`, ok, summary: ok ? (page!.title || host).slice(0, 80) : "Used the snippet instead", sources });
      opts.emit({ type: "tool_end", id, ok: true, summary: ok ? (page!.title || host).slice(0, 80) : "Used the snippet instead", sources });
      return page;
    }),
  );

  const digest = top
    .map((s, i) => {
      const page = pages[i];
      const body = page?.text ? page.text.replace(/\s+/g, " ").trim() : (s.snippet ?? "");
      return `[${i + 1}] ${s.title} — ${new URL(s.url).hostname.replace(/^www\./, "")}\n${body}`;
    })
    .join("\n\n");
  return { digest, steps, ms: Date.now() - t0 };
}
