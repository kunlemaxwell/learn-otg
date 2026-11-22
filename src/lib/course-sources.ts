import "server-only";
import { fetchTranscript, type FetchParams } from "youtube-transcript-plus";
import { decodeEntities, openUrl, safeFetch } from "./tools";
export function youtubeId(raw: string): string {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("Enter a full YouTube video link."); }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || u.username || u.password) throw new Error("Use an https YouTube video link.");
  const id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0] : ["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(host) ? u.pathname === "/watch" ? u.searchParams.get("v") : /^\/(shorts|embed|live)\//.test(u.pathname) ? u.pathname.split("/")[2] : null : null;
  if (!id || !/^[\w-]{11}$/.test(id)) throw new Error("Use a YouTube video link, rather than a channel or playlist.");
  return id;
}
export async function readCourseSource(kind: "link" | "youtube", raw: string, signal?: AbortSignal) {
  if (kind === "link") {
    const page = await openUrl(raw, signal);
    if (page.text.trim().length < 80) throw new Error("This page has too little readable text. Upload its text or a document instead.");
    return { name: page.title, kind, text: `Website: ${page.url}\n\n${page.text}`, chars: page.text.length, url: page.url, note: "Website text read" };
  }
  const id = youtubeId(raw);
  const url = `https://www.youtube.com/watch?v=${id}`;
  const timed = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
  const guarded = async (p: FetchParams) => {
    const res = await safeFetch(p.url, timed, { method: p.method ?? "GET", body: p.body, headers: p.headers });
    if (res.status === 429) throw new Error("YouTube is limiting caption access from this connection. Paste the video's transcript to continue.");
    if (!res.ok) throw new Error(`YouTube couldn't be read (${res.status}). Paste its transcript instead.`);
    return res;
  };
  const result = await fetchTranscript(id, { videoDetails: true, signal: timed, retries: 1, // The Android player endpoint exposes captions without a watch-page bootstrap.
    // Avoid the watch page, which may be rate-limited even when captions are available.
    videoFetch: async () => new Response('{"INNERTUBE_API_KEY":"unused"}'),
    playerFetch: p => guarded({ ...p, url: "https://www.youtube.com/youtubei/v1/player" }),
    transcriptFetch: guarded });
  const text = result.segments.map(s => `[${Math.floor(s.offset / 60)}:${String(Math.floor(s.offset % 60)).padStart(2, "0")}] ${decodeEntities(s.text)}`).join("\n");
  if (!text.trim()) throw new Error("No readable captions were returned for this video.");
  const clipped = text.slice(0, 60000);
  return { name: result.videoDetails.title || `YouTube video ${id}`, kind, text: `YouTube: ${url}\nCaption transcript (spoken content; visuals are not analyzed):\n${clipped}`, chars: clipped.length, url, note: `Caption transcript${text.length > clipped.length ? " (first 60,000 characters)" : ""}` };
}
