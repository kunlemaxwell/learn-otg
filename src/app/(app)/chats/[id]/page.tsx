"use client";

import { LayoutPanelLeft, MessageSquarePlus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatThread } from "@/components/chat/ChatThread";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { newChat, openConversation, send, useChat } from "@/lib/chat-store";
import { getConversation } from "@/lib/history";

/** Full-page chat: the whole conversation with each lesson inline, like a chat app. */
export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const mounted = useMounted();
  const { convId, messages } = useChat();
  const [missing, setMissing] = useState(false);
  const started = useRef<string | null>(null);

  // Load the chat in the URL (or start a new one, optionally asking ?q= straight away).
  useEffect(() => {
    if (!mounted || started.current === id) return;
    const q = search.get("q");
    if (id === "new") {
      started.current = id;
      if (messages.length && !q) newChat();
      else if (q) {
        newChat();
        void send(q);
      }
      return;
    }
    const t = setTimeout(() => {
      started.current = id;
      setMissing(!openConversation(id) && convId !== id);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mounted]);

  // Once a new chat has its first message, give it its own address.
  useEffect(() => {
    if (id === "new" && messages.length > 0) router.replace(`/chats/${convId}`);
  }, [id, messages.length, convId, router]);

  const title = getConversation(convId)?.title ?? (messages.find((m) => m.role === "user")?.display ?? messages.find((m) => m.role === "user")?.text ?? "New chat");

  return (
    <div className="chat-page">
      <PageHeader
        title={mounted ? (title.length > 60 ? `${title.slice(0, 57)}…` : title) : "Chat"}
        subtitle="Full-page chat"
        actions={
          <>
            {messages.length > 0 && (
              <Link href={`/?c=${convId}`} className="btn btn-sm btn-ghost" title="Show this chat beside the canvas">
                <LayoutPanelLeft size={16} aria-hidden="true" /> <span className="hide-sm">Canvas view</span>
              </Link>
            )}
            <Link href="/chats/new" className="icon-btn" aria-label="New chat" title="New chat" onClick={() => newChat()}>
              <MessageSquarePlus size={19} />
            </Link>
          </>
        }
      />
      <div className="chat-page-scroll">
        <div className="chat-page-inner">
          {missing ? (
            <div className="empty">
              <h3>Chat not found</h3>
              <p>It may have been deleted.</p>
              <Link href="/chats" className="btn">
                All chats
              </Link>
            </div>
          ) : (
            <ChatThread
              variant="inline"
              empty={
                <div className="chat-page-empty">
                  <span className="empty-icon">
                    <Sparkles size={26} />
                  </span>
                  <h2>What do you want to learn?</h2>
                  <p>Every answer becomes a lesson you can explore, practise and come back to.</p>
                </div>
              }
            />
          )}
        </div>
      </div>
      <div className="chat-page-foot">
        <div className="chat-page-inner">
          <ChatComposer autoFocus />
        </div>
      </div>
    </div>
  );
}
