import { readCourseSource, youtubeId } from "@/lib/course-sources";
import { isMock } from "@/lib/course-mock";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const b = await request.json() as { kind: "link" | "youtube"; url: string; mock?: boolean; transcript?: string };
    if (!["link", "youtube"].includes(b.kind) || typeof b.url !== "string" || b.url.length > 2048) return Response.json({ error: "Choose Website or YouTube and enter a link." }, { status: 400 });
    if (b.kind === "youtube") youtubeId(b.url);
    if (b.kind === "youtube" && b.transcript?.trim()) {
      if (b.transcript.length > 100000) return Response.json({ error: "Use a transcript under 100,000 characters." }, { status: 400 });
      return Response.json({ source: { name: "YouTube transcript", kind: b.kind, text: `YouTube: ${b.url}\nUser-supplied transcript:\n${b.transcript}`, chars: b.transcript.length, url: b.url, note: "Transcript supplied by you" } });
    }
    if (isMock(b.mock)) return Response.json({ source: { name: b.kind === "youtube" ? "Demo video transcript" : "Demo website", kind: b.kind, url: b.url, text: `Demo source from ${b.url}: Compound interest means interest earns interest. Starting earlier gives your money more time to compound.`, chars: 120, note: "Demo source, no website fetched" } });
    return Response.json({ source: await readCourseSource(b.kind, b.url, request.signal) });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Couldn't read this source.", help: "For YouTube, try a public video with captions or paste its transcript below." }, { status: 422 }); }
}
