"use client";

import { LayoutGrid, List, MessageCircle, MessageSquarePlus, Search, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader, useMounted } from "@/components/shell/AppShell";
import { deleteConversation, relativeTime, toggleStar, useHistory } from "@/lib/history";
import { moodOf } from "@/lib/lesson-code";
import { createStore } from "@/lib/local-store";
import { lessonTitle, parseReply } from "@/lib/parse";

type Item = { id: string; title: string; snippet: string; mood: string; updatedAt: number; starred: boolean; lessons: number };

const viewStore = createStore<{ view: "list" | "cards"; filter: "all" | "saved" }>("learn-otg:chats-view:v1", { view: "list", filter: "all" });

/** Every chat: as a list (like a chat app) or as cards (a library of what you've learned). */
export default function ChatsPage() {
  const mounted = useMounted();
  const chats = useHistory();
  const prefs = viewStore.useValue();
  const [q, setQ] = useState("");

  const items = useMemo<Item[]>(
    () =>
      chats.map((c) => {
        const bots = c.messages.filter((m) => m.role === "assistant" && parseReply(m.text).code);
        const last = bots.at(-1);
        const code = last ? parseReply(last.text).code : null;
        return {
          id: c.id,
          title: c.title,
          snippet: (last ? parseReply(last.text).chat : "") || lessonTitle(code) || "",
          mood: moodOf(code),
          updatedAt: c.updatedAt,
          starred: Boolean(c.starred),
          lessons: bots.length,
        };
      }),
    [chats],
  );

  const shown = items.filter((i) => (prefs.filter === "saved" ? i.starred : true) && (!q.trim() || `${i.title} ${i.snippet}`.toLowerCase().includes(q.trim().toLowerCase())));
  const remove = (i: Item) => {
    if (window.confirm(`Delete “${i.title}”? This can't be undone.`)) deleteConversation(i.id);
  };

  return (
    <>
      <PageHeader
        title="Chats"
        subtitle="Your questions and the lessons they became"
        actions={
          <>
            <div className="seg" role="radiogroup" aria-label="View">
              <button role="radio" aria-checked={prefs.view === "list"} className={prefs.view === "list" ? "is-on" : ""} onClick={() => viewStore.set({ ...prefs, view: "list" })} aria-label="List view" title="List">
                <List size={16} />
              </button>
              <button role="radio" aria-checked={prefs.view === "cards"} className={prefs.view === "cards" ? "is-on" : ""} onClick={() => viewStore.set({ ...prefs, view: "cards" })} aria-label="Card view" title="Cards">
                <LayoutGrid size={16} />
              </button>
            </div>
            <Link href="/chats/new" className="btn btn-sm btn-primary">
              <MessageSquarePlus size={16} aria-hidden="true" /> <span className="hide-sm">New chat</span>
            </Link>
          </>
        }
      />
      <div className="page-body">
        <div className="lib-tools">
          <label className="search">
            <Search size={17} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your chats" aria-label="Search your chats" />
          </label>
          <div className="seg" role="radiogroup" aria-label="Filter">
            {(
              [
                ["all", "All"],
                ["saved", "Saved"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} role="radio" aria-checked={prefs.filter === v} className={prefs.filter === v ? "is-on" : ""} onClick={() => viewStore.set({ ...prefs, filter: v })}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {mounted && shown.length === 0 && (
          <div className="empty">
            <span className="empty-icon">
              <MessageCircle size={26} />
            </span>
            <h3>{items.length === 0 ? "No chats yet" : "No matches"}</h3>
            <p>{items.length === 0 ? "Ask a question and your lesson will be saved here." : "Try a different search or filter."}</p>
            {items.length === 0 && (
              <Link href="/chats/new" className="btn btn-primary">
                Start a chat
              </Link>
            )}
          </div>
        )}

        {mounted &&
          (prefs.view === "cards" ? (
            <div className="lib-cards">
              {shown.map((i) => (
                <article key={i.id} className={`lib-card m-${i.mood}`}>
                  <Link href={`/chats/${i.id}`} className="lib-card-main">
                    <span className="lib-card-art" aria-hidden="true">
                      <MessageCircle size={24} />
                    </span>
                    <span className="eyebrow">
                      {i.lessons} lesson{i.lessons === 1 ? "" : "s"}
                    </span>
                    <strong>{i.title}</strong>
                    <span className="lib-snippet">{i.snippet}</span>
                    <span className="lib-meta">{relativeTime(i.updatedAt)}</span>
                  </Link>
                  <div className="lib-actions">
                    <Link href={`/?c=${i.id}`} className="btn btn-sm btn-ghost">
                      Open on canvas
                    </Link>
                    <button className={`icon-btn ${i.starred ? "is-starred" : ""}`} onClick={() => toggleStar(i.id)} aria-pressed={i.starred} aria-label={i.starred ? "Remove from saved" : "Save"}>
                      <Star size={18} fill={i.starred ? "currentColor" : "none"} />
                    </button>
                    <button className="icon-btn" onClick={() => remove(i)} aria-label={`Delete ${i.title}`}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <ul className="lib-list">
              {shown.map((i) => (
                <li key={i.id} className={`lib-row m-${i.mood}`}>
                  <Link href={`/chats/${i.id}`} className="lib-row-main">
                    <span className="lib-dot" aria-hidden="true">
                      <MessageCircle size={17} />
                    </span>
                    <span className="lib-row-text">
                      <strong>{i.title}</strong>
                      <small>
                        {i.lessons} lesson{i.lessons === 1 ? "" : "s"} · {relativeTime(i.updatedAt)}
                      </small>
                    </span>
                  </Link>
                  <button className={`icon-btn ${i.starred ? "is-starred" : ""}`} onClick={() => toggleStar(i.id)} aria-pressed={i.starred} aria-label={i.starred ? "Remove from saved" : "Save"}>
                    <Star size={18} fill={i.starred ? "currentColor" : "none"} />
                  </button>
                  <button className="icon-btn" onClick={() => remove(i)} aria-label={`Delete ${i.title}`}>
                    <Trash2 size={17} />
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </>
  );
}
