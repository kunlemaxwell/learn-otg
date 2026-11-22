"use client";

import { Maximize2, MessageSquarePlus, PanelRightClose, X } from "lucide-react";
import Link from "next/link";
import { newChat, useChat } from "@/lib/chat-store";
import { ChatComposer } from "./ChatComposer";
import { ChatThread } from "./ChatThread";

/** Chat in a side panel: beside the canvas on the Learn page, or docked on any other page. */
export function ChatPanel({
  variant,
  onClose,
  closeLabel = "Hide chat",
  closeIcon = "fold",
  onOpenLesson,
  showContext,
}: {
  variant: "chips" | "inline";
  onClose?: () => void;
  closeLabel?: string;
  closeIcon?: "fold" | "x";
  onOpenLesson?: (id: string) => void;
  showContext?: boolean;
}) {
  const { convId, messages, context } = useChat();
  return (
    <section className="chat-panel" aria-label="Chat">
      <header className="chat-panel-head">
        <strong>Chat</strong>
        <div className="chat-panel-actions">
          <button className="icon-btn" onClick={newChat} disabled={messages.length === 0} aria-label="New chat" title="New chat">
            <MessageSquarePlus size={18} />
          </button>
          <Link href={`/chats/${messages.length ? convId : "new"}`} className="icon-btn" aria-label="Open full-page chat" title="Expand to full page">
            <Maximize2 size={17} />
          </Link>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
              {closeIcon === "x" ? <X size={19} /> : <PanelRightClose size={18} />}
            </button>
          )}
        </div>
      </header>
      {showContext && context && (
        <p className="chat-context" title={context}>
          Asking about: <span>{context.replace(/^Course "[^"]*" \([^)]*\)\. /, "")}</span>
        </p>
      )}
      <div className="chat-panel-scroll">
        <ChatThread
          variant={variant}
          onOpenLesson={onOpenLesson}
          empty={
            showContext && context ? (
              <p>Ask anything about what you&apos;re looking at. The tutor sees the page you&apos;re on.</p>
            ) : undefined
          }
        />
      </div>
      <div className="chat-panel-foot">
        <ChatComposer placeholder={showContext && context ? "Ask about this page…" : "Ask a question…"} />
      </div>
    </section>
  );
}
