"use client";
import { FileText, Globe, LoaderCircle, Plus, X, Youtube } from "lucide-react";
import { useRef, useState } from "react";
import { extractFiles, type PickedFile } from "@/lib/course-gen";
import { mockFlag } from "@/lib/mock-flag";
export function CourseMaterials({ files, setFiles, onReading }: { files: PickedFile[]; setFiles: React.Dispatch<React.SetStateAction<PickedFile[]>>; onReading: (v: boolean) => void }) {
  const [kind, setKind] = useState<"file" | "link" | "youtube">("file");
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const add = async (list?: FileList | null) => {
    if (busy || (list && !list.length)) return;
    setBusy(true); onReading(true); setError("");
    try {
      const sources: PickedFile[] = list ? await extractFiles(Array.from(list)) : await (async () => {
        const res = await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(45000), body: JSON.stringify({ kind, url: url.trim(), transcript: kind === "youtube" ? transcript.trim() : undefined, mock: mockFlag() }) });
        const j = await res.json(); if (!res.ok) throw new Error([j.error, j.help].filter(Boolean).join(" ")); return [j.source];
      })();
      setFiles(old => [...old, ...sources]); setUrl(""); setTranscript("");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't read this material."); }
    finally { setBusy(false); onReading(false); }
  };
  return <section className="card"><h2>Your material</h2><p className="hint">Add files, websites or YouTube captions. The tutor builds the course from the material you add.</p>
    <div className="seg" role="radiogroup" aria-label="Source type">{(["file", "link", "youtube"] as const).map(k => <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? "is-on" : ""} onClick={() => { setKind(k); setError(""); }} disabled={busy}>{k === "file" ? "File" : k === "link" ? "Website" : "YouTube"}</button>)}</div>
    {kind === "file" ? <div className="drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void add(e.dataTransfer.files); }}><FileText size={22} /><strong>Drop files here</strong><button className="btn btn-sm" type="button" onClick={() => file.current?.click()} disabled={busy}>{busy ? "Reading…" : "Add files"}</button><input hidden ref={file} type="file" multiple onChange={e => { void add(e.target.files); e.target.value = ""; }} /><small>Documents, PDFs, slides, spreadsheets and text. Up to 15 MB per file.</small></div> : <form className="source-form" onSubmit={e => { e.preventDefault(); void add(); }}>
      <label className="field"><span>{kind === "youtube" ? "YouTube video link" : "Website link"}</span><input type="url" required value={url} onChange={e => setUrl(e.target.value)} placeholder={kind === "youtube" ? "https://www.youtube.com/watch?v=…" : "https://example.com/article"} disabled={busy} /></label>
      {kind === "youtube" && <><p className="hint">Reads the video&apos;s captions to create lessons and questions. If captions can&apos;t be fetched, paste the transcript.</p><details><summary>Paste a transcript instead</summary><label className="field"><span>Video transcript</span><textarea rows={5} value={transcript} onChange={e => setTranscript(e.target.value)} maxLength={100000} /></label></details></>}
      <button className="btn btn-sm" disabled={busy || !url.trim()}>{busy ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}{busy ? "Reading source…" : "Add source"}</button>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {files.length > 0 && <ul className="file-list">{files.map((f, i) => <li key={`${f.name}-${i}`} className={f.text ? "" : "is-skipped"}>{f.kind === "youtube" ? <Youtube size={18} /> : f.kind === "link" ? <Globe size={18} /> : <FileText size={18} />}<span className="grow"><strong>{f.name}</strong><small>{f.text ? `${f.chars.toLocaleString()} characters read` : "Not used"}{f.note ? ` · ${f.note}` : ""}</small>{f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="source-url">{f.url}</a>}</span><button className="icon-btn" onClick={() => setFiles(old => old.filter((_, j) => j !== i))} disabled={busy} aria-label={`Remove ${f.name}`}><X size={16} /></button></li>)}</ul>}
  </section>;
}
