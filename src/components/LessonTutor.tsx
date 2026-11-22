"use client";
import { LoaderCircle, Minus, Send, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { askTutor, stopTutor, tutorRunning, useLessonChats } from "@/lib/lesson-chat";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { AttachmentButton, AttachmentList } from "./ChatAttachments";
import { parseReply } from "@/lib/parse";
import { LessonRenderer } from "./LessonRenderer";
export type TutorRequest = { quote?: string; question?: string; serial: number; lessonId: string };
export function LessonTutor({ lessonKey, title, context, request, sourcePolicy }: { lessonKey: string; title: string; context: string; sourcePolicy?: "strict" | "mixed"; request?: TutorRequest }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [quote, setQuote] = useState("");
  const [files, setFiles] = useState<ChatAttachment[]>([]);
  const [reading, setReading] = useState(false);
  const history = useLessonChats();
  const messages = history[lessonKey] ?? [];
  const busy = tutorRunning(lessonKey);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!request) return;
    const t = setTimeout(() => { setOpen(true); setQuote(request.quote ?? ""); setInput(request.question ?? ""); composer.current?.focus(); }, 0);
    return () => clearTimeout(t);
  }, [request]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages.length, busy]);
  const submit = () => {
    if ((!input.trim() && !files.length) || busy || reading) return;
    void askTutor(lessonKey, { question: input.trim() || "Explain the attached material in relation to this lesson.", context, sourcePolicy, quote: quote || undefined, image: files.find(f => f.image)?.image, attachments: files.filter(f => f.text) });
    setInput(""); setFiles([]); setQuote("");
  };
  return <aside className={`lesson-tutor no-export ${open ? "is-open" : "is-hidden"}`} aria-label="Lesson tutor">
    {!open ? null : <>
      <header className="chat-panel-head"><div><strong>Lesson chat</strong><small className="tutor-title">{title}</small></div><button className="icon-btn" onClick={() => setOpen(false)} aria-label="Minimize lesson chat"><Minus size={19} /></button></header>
      <div className="tutor-scroll" ref={scroll} tabIndex={0}>
        {!messages.length && <div className="tutor-empty"><p>Ask about this page, check your understanding or attach a document or image.</p><button className="pick-chip" onClick={() => void askTutor(lessonKey, { question: "Explain this page as a simple visual slide.", context, sourcePolicy, visual: true })} disabled={busy}>Show a simpler visual</button></div>}
        {messages.map(m => { const p = parseReply(m.text); return <div key={m.id} className={`tutor-message is-${m.role}`}>
          {m.attachments && <AttachmentList files={m.attachments} />}
          {m.quote && <blockquote>{m.quote}</blockquote>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {m.image && <img src={m.image} alt="Attached screenshot" />}
          {m.pending && <p role="status"><LoaderCircle size={15} className="spin" /> Thinking about your lesson…</p>}
          {m.error ? <div role="alert"><p>{m.error}</p><button className="btn btn-sm" onClick={() => { const i = messages.indexOf(m); const q = messages[i-1]; if(q?.role === "user") void askTutor(lessonKey, { question: q.text, quote: q.quote, image: q.image, attachments: q.attachments, context, sourcePolicy }); }} disabled={busy}>Try again</button></div> : m.text && <><p>{p.chat || (!p.code ? m.text : "")}</p>{p.code && <LessonRenderer code={p.code} title="Visual explanation" onAsk={question => void askTutor(lessonKey, { question, context, sourcePolicy })} />}</>}
        </div>; })}
      </div>
      <form className="tutor-compose" onSubmit={e => { e.preventDefault(); submit(); }}>
        {quote && <div className="tutor-quote"><span>About: {quote}</span><button className="icon-btn" type="button" onClick={() => setQuote("")} aria-label="Remove selected passage"><X size={15} /></button></div>}
        <AttachmentList files={files} onRemove={i => setFiles(files.filter((_,n) => n !== i))} />
        <textarea ref={composer} aria-label="Question about this lesson" value={input} onChange={e => setInput(e.target.value)} placeholder="I don't understand this part…" rows={2} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <div className="row spread"><AttachmentButton files={files} onChange={setFiles} disabled={busy} onReading={setReading} /><small>{reading ? "Reading files…" : "Saved with this lesson"}</small>{busy ? <button type="button" className="btn btn-sm" onClick={() => stopTutor(lessonKey)}><Square size={14} /> Stop</button> : <button className="btn btn-sm btn-primary" disabled={reading || (!input.trim() && !files.length)}><Send size={14} /> Send</button>}</div>

      </form>
    </>}
  </aside>;
}
