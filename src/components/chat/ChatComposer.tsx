"use client";

import { ArrowUp, Globe, Square } from "lucide-react";
import { useRef, useState } from "react";
import { send, stop, useChat } from "@/lib/chat-store";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { AttachmentButton, AttachmentList } from "../ChatAttachments";
import { useSettings } from "@/lib/settings";

/** The box where the learner asks. Shared by every chat surface. */
export function ChatComposer({ placeholder, onSent, autoFocus }: { placeholder?: string; onSent?: () => void; autoFocus?: boolean }) {
  const { settings, update } = useSettings();
  const { busy } = useChat();
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<ChatAttachment[]>([]);
  const [reading, setReading] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if ((!input.trim() && !files.length) || busy || reading) return;
    void send(input || "Explain the attached material", files.find(f=>f.image)?.image ?? null, undefined, files.filter(f=>f.text));
    setInput("");
    setFiles([]);
    if (textRef.current) textRef.current.style.height = "auto";
    onSent?.();
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <AttachmentList files={files} onRemove={i=>setFiles(files.filter((_,n)=>n!==i))} />
      <div className="composer-row">
        <button
          type="button"
          className={`icon-btn web-toggle ${settings.browsing ? "is-on" : ""}`}
          onClick={() => update({ ...settings, browsing: !settings.browsing })}
          aria-pressed={settings.browsing}
          aria-label={settings.browsing ? "Web search is on. Turn off" : "Web search is off. Turn on"}
          title={settings.browsing ? "Web search on" : "Web search off"}
        >
          <Globe size={19} />
        </button>
        <AttachmentButton files={files} onChange={setFiles} disabled={busy} onReading={setReading} />
        <textarea
          ref={textRef}
          rows={1}
          value={input}
          autoFocus={autoFocus}
          placeholder={placeholder ?? "Ask anything you want to learn…"}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          aria-label="Your question"
        />
        {busy ? (
          <button type="button" className="send-btn" onClick={stop} aria-label="Stop">
            <Square size={16} />
          </button>
        ) : (
          <button type="submit" className="send-btn" disabled={reading || (!input.trim() && !files.length)} aria-label="Send">
            <ArrowUp size={18} />
          </button>
        )}
      </div>
    </form>
  );
}
