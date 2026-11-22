"use client";
import { NotificationCenter } from "./shell/NotificationCenter";

import { BookOpen, ChevronLeft, ChevronRight, Flame, History, LayoutPanelLeft, Menu, MessageCircle, MessageSquarePlus, PanelRightOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { newChat, openConversation, send, setActive, useChat } from "@/lib/chat-store";
import { useCourses } from "@/lib/courses";
import { relativeTime, useHistory } from "@/lib/history";
import { streakOf, useJourney } from "@/lib/journey";
import { useMemory } from "@/lib/learner-memory";
import { mockFlag } from "@/lib/mock-flag";
import { lessonTitle, parseReply } from "@/lib/parse";
import { callName, useProfile } from "@/lib/profile";
import { useSettings } from "@/lib/settings";
import { suggestionsFor, type Suggestion } from "@/lib/suggestions";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatPanel } from "./chat/ChatPanel";
import { LessonView } from "./chat/LessonView";
import { useMounted, useShell } from "./shell/AppShell";

function greeting(name: string) {
  const h = new Date().getHours();
  const part = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}` : part;
}

/** The Learn page: the canvas, with the chat beside it (right) on desktop, or a Canvas/Chat switch on phones. */
export default function Home() {
  const { messages, activeId, busy } = useChat();
  const { settings } = useSettings();
  const ui = useUiPrefs();
  const mounted = useMounted();
  const profile = useProfile();
  const journey = useJourney();
  const courses = useCourses();
  const memory = useMemory();
  const chats = useHistory();
  const { openNav } = useShell();
  const router = useRouter();
  const search = useSearchParams();
  const [view, setView] = useState<"canvas" | "chat">("canvas");
  const [mock, setMock] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const streak = useMemo(() => streakOf(journey), [journey]);
  const panelOpen = mounted ? ui.homeChat : true;

  useEffect(() => {
    const t = setTimeout(() => setMock(mockFlag()), 0);
    return () => clearTimeout(t);
  }, []);

  // /?q=<question> asks straight away; /?c=<id> opens a saved chat on the canvas.
  const askParam = search.get("q");
  const openParam = search.get("c");
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const k = `${askParam}|${openParam}`;
    if ((!askParam && !openParam) || handled.current === k) return;
    handled.current = k;
    if (openParam) openConversation(openParam);
    if (askParam) {
      if (!openParam) newChat();
      void send(askParam);
    }
    router.replace("/");
  }, [askParam, openParam, router]);

  const parsed = useMemo(() => new Map(messages.filter((m) => m.role === "assistant").map((m) => [m.id, parseReply(m.text)])), [messages]);
  const lessons = useMemo(
    () => messages.filter((m) => m.role === "assistant" && parsed.get(m.id)?.code).map((m) => ({ id: m.id, title: lessonTitle(parsed.get(m.id)?.code ?? null) ?? "Lesson" })),
    [messages, parsed],
  );
  const active = messages.find((m) => m.id === activeId) ?? null;
  const activeParsed = active ? parsed.get(active.id) : undefined;
  const lessonIndex = lessons.findIndex((l) => l.id === activeId);
  const lastBot = [...messages].reverse().find((m) => m.role === "assistant");

  useEffect(() => {
    canvasRef.current?.scrollTo({ top: 0 });
  }, [activeId]);

  const suggestions = useMemo(
    () => suggestionsFor({ profile, courses, memory, chats, auto: settings.autoSuggest }),
    [profile, courses, memory, chats, settings.autoSuggest],
  );

  const pick = (s: Suggestion) => {
    if (s.href) return router.push(s.href);
    newChat();
    void send(s.ask ?? s.label, null, s.ask ? s.label : undefined);
  };

  const goLesson = (dir: -1 | 1) => {
    const next = lessons[lessonIndex + dir];
    if (next) setActive(next.id);
  };

  const welcome = (
    <div className="welcome">
      <div className="welcome-badge">
        <Sparkles size={16} aria-hidden="true" /> Learning on the go
      </div>
      <h1>
        {greeting(mounted ? callName(profile) : "")}.
        <br />
        What do you want to understand today?
      </h1>
      <p>Ask anything. Learn OTG builds a lesson right here: visuals, examples, simulations, games and quick checks.</p>
      <div className="starter-grid">
        {suggestions.map((st) => (
          <button key={st.label} className={`starter starter--${st.kind}`} onClick={() => pick(st)}>
            <span className="starter-icon" aria-hidden="true">
              {st.icon}
            </span>
            <span className="starter-text">
              <span>{st.label}</span>
              {st.reason && <small>{st.reason}</small>}
            </span>
          </button>
        ))}
      </div>
      <div className="welcome-links">
        <Link href="/courses/new" className="btn btn-sm">
          <BookOpen size={16} aria-hidden="true" /> Build a course
        </Link>
        {mounted && streak.current > 0 && (
          <Link href="/journey" className="btn btn-sm btn-ghost">
            <Flame size={16} aria-hidden="true" /> {streak.current}-day streak
          </Link>
        )}
      </div>
      {mounted && chats.length > 0 && (
        <div className="recent">
          <div className="recent-head">
            <h2>Recent chats</h2>
            <Link href="/chats" className="link-btn">
              See all
            </Link>
          </div>
          <ul className="recent-list">
            {chats.slice(0, 3).map((c) => (
              <li key={c.id}>
                <button className="recent-item" onClick={() => openConversation(c.id)}>
                  <History size={16} aria-hidden="true" />
                  <span className="recent-text">
                    <span className="recent-title">{c.title}</span>
                    <span className="recent-meta">{relativeTime(c.updatedAt)}</span>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className={`home ${panelOpen ? "with-chat" : "no-chat"}`}>
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-btn menu-btn" onClick={openNav} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <span className="brand-name">
              Learn <span className="brand-otg">OTG</span>
            </span>
            {mock && <span className="mock-tag">demo</span>}
          </div>
        </div>
        <div className="topbar-right">
          <NotificationCenter />
          <Link href="/journey" className="streak-chip" aria-label={`${streak.current}-day streak`}>
            <Flame size={16} aria-hidden="true" />
            {mounted ? streak.current : 0}
          </Link>
          <Link href="/chats" className="icon-btn" aria-label="Your chats">
            <History size={20} />
          </Link>
          <button className="icon-btn" onClick={newChat} aria-label="New chat" disabled={messages.length === 0}>
            <MessageSquarePlus size={20} />
          </button>
        </div>
      </header>

      <main className="home-main">
        <section className={`canvas ${view === "canvas" ? "is-visible" : ""}`} aria-label="Lesson canvas">
          <div className="canvas-bar">
            <div className="canvas-bar-title">
              <LayoutPanelLeft size={16} aria-hidden="true" />
              <span>{active && activeParsed?.code ? (lessonTitle(activeParsed.code) ?? "Lesson") : "Canvas"}</span>
              {active?.streaming && <span className="live-dot">Building</span>}
              {mock && <span className="mock-tag desk-only">demo</span>}
            </div>
            <div className="canvas-nav">
              {lessons.length > 1 && (
                <>
                  <button className="icon-btn" onClick={() => goLesson(-1)} disabled={lessonIndex <= 0} aria-label="Previous lesson">
                    <ChevronLeft size={18} />
                  </button>
                  <span>
                    {Math.max(1, lessonIndex + 1)} / {lessons.length}
                  </span>
                  <button className="icon-btn" onClick={() => goLesson(1)} disabled={lessonIndex >= lessons.length - 1} aria-label="Next lesson">
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
              {!panelOpen && (
                <button className="btn btn-sm open-chat-btn" onClick={() => setUiPrefs({ homeChat: true })}>
                  <PanelRightOpen size={16} aria-hidden="true" /> Chat
                  {messages.length > 0 && <span className="count">{messages.filter((m) => m.role === "user").length}</span>}
                </button>
              )}
            </div>
          </div>
          <div className="canvas-scroll" ref={canvasRef}>
            <div className="canvas-inner">{active ? <LessonView msg={active} parsed={activeParsed} latest={active.id === lastBot?.id} /> : welcome}</div>
          </div>
          {!panelOpen && (
            <div className="canvas-composer">
              <ChatComposer />
            </div>
          )}
        </section>

        <aside className={`home-chat ${view === "chat" ? "is-visible" : ""}`}>
          <ChatPanel
            variant="chips"
            onClose={() => setUiPrefs({ homeChat: false })}
            onOpenLesson={() => setView("canvas")}
          />
        </aside>
      </main>

      <footer className="dock">
        <div className="view-switch" role="tablist" aria-label="Switch view">
          <button role="tab" aria-selected={view === "canvas"} className={view === "canvas" ? "is-on" : ""} onClick={() => setView("canvas")}>
            <LayoutPanelLeft size={16} aria-hidden="true" /> Canvas
          </button>
          <button role="tab" aria-selected={view === "chat"} className={view === "chat" ? "is-on" : ""} onClick={() => setView("chat")}>
            <MessageCircle size={16} aria-hidden="true" /> Chat
            {messages.length > 0 && <span className="count">{messages.filter((m) => m.role === "user").length}</span>}
          </button>
        </div>
        <ChatComposer onSent={() => setView("canvas")} />
        {busy && <span className="sr-only">Building your lesson</span>}
      </footer>
    </div>
  );
}
