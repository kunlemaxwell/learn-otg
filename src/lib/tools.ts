// Server-only web tools the tutor model can call: web_search and open_url.
// Search uses Tavily or Brave if you add a key, otherwise DuckDuckGo with a
// Wikipedia fallback (no key needed). Page fetching blocks private networks.
import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

export type Source = { title: string; url: string; snippet?: string };

export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for up-to-date information. Returns a list of results with title, url and snippet. Use for current events, recent data, prices, statistics, people in roles, versions, and anything you are unsure about.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "A short, specific search query." },
          max_results: { type: "integer", description: "How many results to return (1-8). Default 5." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_url",
      description:
        "Open a web page and return its readable text (truncated). Use on promising URLs from web_search when the snippets are not enough.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full http(s) URL to read." },
        },
        required: ["url"],
      },
    },
  },
] as const;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 LearnOTG/1.0";
const TIMEOUT_MS = 12_000;
const MAX_PAGE_CHARS = 8_000;
const MAX_BODY_BYTES = 1_500_000;

function withTimeout(signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, t]) : t;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
  "#x2F": "/",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    const lower = code.toLowerCase();
    if (lower in ENTITIES) return ENTITIES[lower];
    if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16) || 32);
    if (lower.startsWith("#")) return String.fromCodePoint(parseInt(lower.slice(1), 10) || 32);
    return m;
  });
}

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function htmlToText(html: string): { title: string; text: string } {
  const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const main = body.match(/<(main|article)[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
  if (main && main.length > 500) body = main;
  const text = decodeEntities(
    body
      .replace(/<(script|style|noscript|svg|nav|footer|header|form|aside|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title, text };
}

// ---------- SSRF protection ----------

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That is not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links can be opened.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    throw new Error("Private addresses can't be opened.");
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Private addresses can't be opened.");
  return url;
}

async function readLimited(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BODY_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

/** Fetch a public URL, re-checking every redirect hop against private ranges. */
export async function safeFetch(raw: string, signal?: AbortSignal, init: RequestInit = {}): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop < 4; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: withTimeout(signal),
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5", ...init.headers },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects.");
}

// ---------- Search providers ----------

async function tavilySearch(query: string, n: number, signal?: AbortSignal): Promise<Source[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: n }),
    signal: withTimeout(signal),
  });
  if (!res.ok) throw new Error(`Tavily returned ${res.status}`);
  const json = (await res.json()) as { results?: { title: string; url: string; content?: string }[] };
  return (json.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 400) }));
}

async function braveSearch(query: string, n: number, signal?: AbortSignal): Promise<Source[]> {
  const u = new URL("https://api.search.brave.com/res/v1/web/search");
  u.searchParams.set("q", query);
  u.searchParams.set("count", String(n));
  const res = await fetch(u, {
    headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY ?? "" },
    signal: withTimeout(signal),
  });
  if (!res.ok) throw new Error(`Brave returned ${res.status}`);
  const json = (await res.json()) as { web?: { results?: { title: string; url: string; description?: string }[] } };
  return (json.web?.results ?? []).map((r) => ({ title: stripTags(r.title), url: r.url, snippet: stripTags(r.description ?? "") }));
}

export function parseDuckDuckGo(html: string, n: number): Source[] {
  const results: Source[] = [];
  const opens = [...html.matchAll(/<div[^>]+class="([^"]*\bresult\b[^"]*)"[^>]*>/gi)];
  for (let i = 0; i < opens.length; i++) {
    const cls = opens[i][1];
    if (/result--ad|result--no-result/.test(cls)) continue;
    const start = opens[i].index! + opens[i][0].length;
    const block = html.slice(start, opens[i + 1]?.index ?? html.length);
    const a = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      ?? block.match(/<a[^>]+href="([^"]+)"[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    let href = decodeEntities(a[1]);
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (href.startsWith("//")) href = `https:${href}`;
    if (!/^https?:\/\//.test(href) || /duckduckgo\.com\/y\.js/.test(href)) continue;
    const snippet = block.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(a|div|td)>/i)?.[1];
    results.push({ title: stripTags(a[2]), url: href, snippet: snippet ? stripTags(snippet) : undefined });
    if (results.length >= n) break;
  }
  return results;
}

async function duckDuckGoSearch(query: string, n: number, signal?: AbortSignal): Promise<Source[]> {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ q: query, kl: "wt-wt" }).toString(),
    signal: withTimeout(signal),
  });
  if (!res.ok) throw new Error(`DuckDuckGo returned ${res.status}`);
  return parseDuckDuckGo(await res.text(), n);
}

async function wikipediaSearch(query: string, n: number, signal?: AbortSignal): Promise<Source[]> {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  Object.entries({ action: "query", list: "search", srsearch: query, format: "json", srlimit: String(n), origin: "*" }).forEach(
    ([k, v]) => u.searchParams.set(k, v),
  );
  const res = await fetch(u, { headers: { "User-Agent": UA }, signal: withTimeout(signal) });
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);
  const json = (await res.json()) as { query?: { search?: { title: string; snippet: string }[] } };
  return (json.query?.search ?? []).map((r) => ({
    title: `${r.title} — Wikipedia`,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
    snippet: stripTags(r.snippet),
  }));
}

export function searchProviderName(): string {
  if (process.env.TAVILY_API_KEY) return "Tavily";
  if (process.env.BRAVE_SEARCH_API_KEY) return "Brave";
  return "DuckDuckGo";
}

export async function webSearch(query: string, n = 5, signal?: AbortSignal): Promise<Source[]> {
  const count = Math.min(8, Math.max(1, Math.round(n) || 5));
  const providers: ((q: string, n: number, s?: AbortSignal) => Promise<Source[]>)[] = [];
  if (process.env.TAVILY_API_KEY) providers.push(tavilySearch);
  if (process.env.BRAVE_SEARCH_API_KEY) providers.push(braveSearch);
  providers.push(duckDuckGoSearch, wikipediaSearch);
  const errors: string[] = [];
  for (const p of providers) {
    try {
      const r = await p(query, count, signal);
      if (r.length) return r;
    } catch (e) {
      if (signal?.aborted) throw e;
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (errors.length) throw new Error(`Search failed (${errors.join("; ")})`);
  return [];
}

export async function openUrl(raw: string, signal?: AbortSignal): Promise<{ title: string; url: string; text: string }> {
  const res = await safeFetch(raw, signal);
  if (!res.ok) throw new Error(`The page returned ${res.status}.`);
  const type = res.headers.get("content-type") ?? "";
  if (!/text\/|json|xml/.test(type)) throw new Error(`This page is ${type || "not text"}, which can't be read.`);
  const body = await readLimited(res);
  const { title, text } = /html|xml/.test(type) ? htmlToText(body) : { title: "", text: body };
  const clipped = text.length > MAX_PAGE_CHARS ? `${text.slice(0, MAX_PAGE_CHARS)}\n…(truncated)` : text;
  return { title: title || new URL(res.url || raw).hostname, url: res.url || raw, text: clipped };
}

/** Human-readable label for a tool call, shown while it runs. */
export function describeTool(name: string, argsJson: string): string {
  try {
    const args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
    if (name === "web_search") return `Searching “${String(args.query ?? "").trim()}”`;
    if (name === "open_url") return `Reading ${new URL(String(args.url)).hostname.replace(/^www\./, "")}`;
  } catch {}
  return name === "web_search" ? "Searching the web" : name === "open_url" ? "Reading a page" : name;
}

/** Runs one tool call. Returns the JSON string for the model and display info for the app. */
export async function runTool(
  name: string,
  argsJson: string,
  signal?: AbortSignal,
): Promise<{ result: string; label: string; summary: string; sources: Source[]; ok: boolean }> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return { result: JSON.stringify({ error: "Arguments were not valid JSON." }), label: name, summary: "Bad arguments", sources: [], ok: false };
  }

  if (name === "web_search") {
    const query = String(args.query ?? "").trim();
    const label = `Searching “${query}”`;
    if (!query) return { result: JSON.stringify({ error: "query is required" }), label, summary: "No query", sources: [], ok: false };
    try {
      const results = await webSearch(query, Number(args.max_results ?? 5), signal);
      return {
        result: JSON.stringify({ query, results }),
        label,
        summary: results.length ? `${results.length} results` : "No results",
        sources: results,
        ok: true,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { result: JSON.stringify({ error: msg }), label, summary: "Search failed", sources: [], ok: false };
    }
  }

  if (name === "open_url") {
    const url = String(args.url ?? "").trim();
    let host = url;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {}
    const label = `Reading ${host}`;
    try {
      const page = await openUrl(url, signal);
      return {
        result: JSON.stringify(page),
        label,
        summary: page.title.slice(0, 80),
        sources: [{ title: page.title, url: page.url }],
        ok: true,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { result: JSON.stringify({ error: msg, url }), label, summary: "Couldn't open page", sources: [], ok: false };
    }
  }

  return { result: JSON.stringify({ error: `Unknown tool ${name}` }), label: name, summary: "Unknown tool", sources: [], ok: false };
}
