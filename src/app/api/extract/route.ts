// Reads the files a learner adds as course context and returns plain text for each.
// Works with documents (PDF, Word, PowerPoint, Excel, OpenDocument, EPUB), web pages, zip archives
// and anything that is text (notes, CSV, JSON, code, subtitles...). Images, audio and video are
// listed but not read, because there is no text to take from them here.
import JSZip from "jszip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_CHARS_PER_FILE = 60_000;

type Out = { name: string; kind: string; chars: number; text: string; note?: string };

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

function clean(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripXml(xml: string): string {
  return xml
    .replace(/<\/(w:p|a:p|text:p|p|div|row|tr)>/gi, "\n")
    .replace(/<(br|w:br)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function looksLikeText(buf: Buffer): boolean {
  const sample = buf.subarray(0, 4000);
  if (sample.length === 0) return true;
  let odd = 0;
  for (const b of sample) if (b === 0 || (b < 9) || (b > 13 && b < 32)) odd++;
  return odd / sample.length < 0.02;
}

const TEXT_EXT = new Set(
  "txt md markdown csv tsv json jsonl xml yaml yml toml ini log rtf srt vtt tex rst org js jsx ts tsx py rb go rs java kt swift c h cpp hpp cs php sql sh bash zsh css scss sass less vue svelte r m lua pl dart ipynb".split(" "),
);
const SKIP_EXT = new Set("png jpg jpeg gif webp bmp svg heic tiff ico mp3 wav m4a aac flac ogg mp4 mov avi mkv webm exe dll dmg iso bin so".split(" "));

async function fromZip(buf: Buffer, wanted: (n: string) => boolean, join = "\n"): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files)
    .filter((n) => !zip.files[n].dir && wanted(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const parts: string[] = [];
  for (const n of names) parts.push(stripXml(await zip.files[n].async("string")));
  return parts.join(join);
}

async function readOne(name: string, buf: Buffer, depth = 0): Promise<Out[]> {
  const e = ext(name);
  const base = { name };
  const done = (kind: string, text: string, note?: string): Out[] => {
    const t = clean(text);
    return [{ ...base, kind, chars: t.length, text: t.slice(0, MAX_CHARS_PER_FILE), note: t.length > MAX_CHARS_PER_FILE ? "Only the first part was used." : note }];
  };

  if (buf.length > MAX_BYTES) return [{ ...base, kind: e || "file", chars: 0, text: "", note: "Too large (over 15 MB)." }];
  if (SKIP_EXT.has(e))
    return [{ ...base, kind: e, chars: 0, text: "", note: "Images, audio and video can't be read yet. Add a transcript or notes as text." }];

  try {
    if (e === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      const t = Array.isArray(text) ? text.join("\n\n") : text;
      if (!t.trim()) return [{ ...base, kind: "pdf", chars: 0, text: "", note: "No selectable text found (it may be a scan)." }];
      return done("pdf", t);
    }
    if (e === "docx") {
      const mammoth = await import("mammoth");
      const r = await mammoth.extractRawText({ buffer: buf });
      return done("docx", r.value);
    }
    if (e === "pptx") return done("pptx", await fromZip(buf, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n), "\n\n"));
    if (e === "xlsx") {
      const text = await fromZip(buf, (n) => n === "xl/sharedStrings.xml");
      return done("xlsx", text, "Cell text only.");
    }
    if (e === "odt" || e === "ods" || e === "odp") return done(e, await fromZip(buf, (n) => n === "content.xml"));
    if (e === "epub") return done("epub", await fromZip(buf, (n) => /\.(x?html?)$/.test(n), "\n\n"));
    if (e === "html" || e === "htm") return done("html", stripXml(buf.toString("utf8").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")));
    if (e === "zip" && depth === 0) {
      const zip = await JSZip.loadAsync(buf);
      const out: Out[] = [];
      for (const n of Object.keys(zip.files).filter((x) => !zip.files[x].dir && !x.startsWith("__MACOSX")).slice(0, 25)) {
        const inner = Buffer.from(await zip.files[n].async("uint8array"));
        out.push(...(await readOne(n, inner, 1)));
      }
      return out.length ? out : [{ ...base, kind: "zip", chars: 0, text: "", note: "The archive was empty." }];
    }
    if (TEXT_EXT.has(e) || looksLikeText(buf)) return done(e || "text", buf.toString("utf8"));
    return [{ ...base, kind: e || "file", chars: 0, text: "", note: "This file type can't be read as text." }];
  } catch (err) {
    return [{ ...base, kind: e || "file", chars: 0, text: "", note: `Couldn't read this file${err instanceof Error ? ` (${err.message.slice(0, 80)})` : ""}.` }];
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Couldn't read the upload." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return Response.json({ error: "No files were sent." }, { status: 400 });
  const out: Out[] = [];
  for (const f of files.slice(0, 20)) out.push(...(await readOne(f.name, Buffer.from(await f.arrayBuffer()))));
  return Response.json({ files: out });
}
