"use client";
import { AttachmentList } from "../ChatAttachments";

import { BookOpen, ChevronRight, Globe, LayoutPanelLeft, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { setActive, useChat } from "@/lib/chat-store";
import { lessonTitle, parseReply } from "@/lib/parse";
import { messageSources } from "@/lib/types";
import { LessonView } from "./LessonView";

/**
 * The conversation. "chips": each lesson is a chip that opens it on the canvas (beside the canvas).
 * "inline": lessons render right in the thread (full-page chat and the side dock).
 */
export function ChatThread({ variant, onOpenLesson, empty }: { variant: "chips" | "inline"; onOpenLesson?: (id: string) => void; empty?: React.ReactNode }) {
  const { messages, activeId } = useChat();
  const endRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => new Map(messages.filter((m) => m.role === "assistant").map((m) => [m.id, parseReply(m.text)])), [messages]);
  const lastBot = [...messages].reverse().find((m) => m.role === "assistant");
  const userCount = messages.filter((m) => m.role === "user").length;

  // Follow new messages, but don't yank the learner while a long inline lesson streams in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: variant === "inline" ? "nearest" : "end" });
  }, [userCount, variant]);
  useEffect(() => {
    if (variant === "chips") endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, variant]);

  if (messages.length === 0)
    return (
      <div className="chat-empty">
        {empty ?? (
          <>
            <BookOpen size={22} aria-hidden="true" />
            <p>Your questions and lessons will appear here.</p>
          </>
        )}
      </div>
    );

  return (
    <div className={`thread thread--${variant}`}>
      {messages.map((m) => {
        if (m.role === "user")
          return (
            <div key={m.id} className="bubble-user">
              {m.attachments && <AttachmentList files={m.attachments} />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.image && <img src={m.image} alt="Your attached image" className="bubble-img" />}
              <span>{m.display ?? m.text}</span>
            </div>
          );
        const p = parsed.get(m.id);
        const title = lessonTitle(p?.code ?? null);
        const running = m.tools?.find((t) => t.status === "running");
        return (
          <div key={m.id} className="bot">
            <div className="bot-avatar" aria-hidden="true">
              OTG
            </div>
            <div className="bot-body">
              {variant === "chips" && m.error ? (
                <p className="bot-error">{m.error}</p>
              ) : (
                <>
                  {variant === "chips" && m.tools && m.tools.length > 0 && (
                    <p className="bot-tools">
                      {running ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Globe size={14} aria-hidden="true" />}
                      {running ? running.label : `Searched the web · ${messageSources(m).length} sources`}
                    </p>
                  )}
                  {m.quick && variant === "chips" ? <p>{m.quick}</p> : p?.chat ? <p>{p.chat}</p> : m.streaming && !m.tools?.length && !m.quick ? <p className="muted shimmer-text">Thinking…</p> : null}
                  {variant === "chips" && p?.code && (
                    <button
                      className={`lesson-chip ${activeId === m.id ? "is-active" : ""}`}
                      onClick={() => {
                        setActive(m.id);
                        onOpenLesson?.(m.id);
                      }}
                    >
                      <LayoutPanelLeft size={16} aria-hidden="true" />
                      <span className="lesson-chip-text">
                        <strong>{title ?? "Lesson"}</strong>
                        <small>{m.streaming ? "Building on canvas…" : "Open on canvas"}</small>
                      </span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  )}
                  {variant === "inline" && <LessonView msg={m} parsed={p} latest={m.id === lastBot?.id} compact />}
                </>
              )}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
