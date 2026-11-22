"use client";

import { MessageCircle } from "lucide-react";
import { useChat } from "@/lib/chat-store";
import { ChatPanel } from "../chat/ChatPanel";

/** Chat on any page: a button bottom-right opens it on the right; it knows which page you're on. */
export function ChatDock({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { busy, messages } = useChat();
  return (
    <>
      {!open && (
        <button className={`dock-fab ${busy ? "is-busy" : ""}`} onClick={() => setOpen(true)} aria-label="Open chat" title="Ask about this page">
          <MessageCircle size={22} />
          {messages.length > 0 && <span className="dock-fab-dot" aria-hidden="true" />}
        </button>
      )}
      {open && (
        <>
          <div className="dock-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="chat-dock" aria-label="Chat">
            <ChatPanel variant="inline" onClose={() => setOpen(false)} closeLabel="Close chat" closeIcon="x" showContext />
          </aside>
        </>
      )}
    </>
  );
}
