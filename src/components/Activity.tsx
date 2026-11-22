"use client";
// Claude/ChatGPT-style activity rows: "Searching the web · 5 sources" and
// "Thought for 12s", folded by default. Click to see the searches, links and reasoning.
import * as Collapsible from "@radix-ui/react-collapsible";
import { Brain, ChevronDown, Globe, LoaderCircle, Search, Zap } from "lucide-react";
import { useState } from "react";
import { messageSources, type Msg, type Source } from "@/lib/types";

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Favicon({ url, size = 16 }: { url: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const host = hostOf(url);
  if (failed) return <span className="fav fav-fallback">{host[0]?.toUpperCase()}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="fav"
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function FaviconStack({ sources }: { sources: Source[] }) {
  const hosts = [...new Map(sources.map((s) => [hostOf(s.url), s])).values()].slice(0, 4);
  return (
    <span className="fav-stack" aria-hidden="true">
      {hosts.map((s) => (
        <Favicon key={s.url} url={s.url} />
      ))}
    </span>
  );
}

function fmtSecs(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function ActivityRows({ msg, now, showThinking }: { msg: Msg; now: number; showThinking: boolean }) {
  const steps = msg.tools ?? [];
  const searching = steps.some((t) => t.status === "running");
  const sources = messageSources(msg, 12);
  const queries = steps.filter((t) => t.name === "web_search").map((t) => t.label.replace(/^Searching\s+/, ""));
  const thinkingLive = msg.streaming && msg.thinkStart != null && msg.thinkEnd == null;
  const thoughtMs = msg.thinkStart != null ? (msg.thinkEnd ?? now) - msg.thinkStart : 0;

  return (
    <div className="activity">
      {steps.length > 0 && (
        <Collapsible.Root className="act-row">
          <Collapsible.Trigger className="act-trigger">
            {searching ? <LoaderCircle size={16} className="spin act-icon" /> : <Globe size={16} className="act-icon" />}
            <span className={`act-label ${searching ? "shimmer-text" : ""}`}>
              {searching ? "Searching the web" : "Searched the web"}
            </span>
            {sources.length > 0 && <span className="act-meta">· {sources.length} sources</span>}
            <FaviconStack sources={sources} />
            <ChevronDown size={16} className="act-chevron" aria-hidden="true" />
          </Collapsible.Trigger>
          <Collapsible.Content className="act-content">
            {queries.length > 0 && (
              <ul className="act-queries">
                {queries.map((q, i) => (
                  <li key={i}>
                    <Search size={13} aria-hidden="true" /> {q}
                  </li>
                ))}
              </ul>
            )}
            <ul className="act-links">
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    <Favicon url={s.url} />
                    <span className="act-link-title">{s.title || hostOf(s.url)}</span>
                    <span className="act-link-host">{hostOf(s.url)}</span>
                  </a>
                </li>
              ))}
              {!sources.length && <li className="act-empty">{searching ? "Looking…" : "No usable results."}</li>}
            </ul>
          </Collapsible.Content>
        </Collapsible.Root>
      )}

      {(msg.thinkStart != null || (msg.streaming && !msg.text && !steps.length && !msg.quick)) && (
        <Collapsible.Root className="act-row">
          <Collapsible.Trigger className="act-trigger" disabled={!showThinking || !msg.reasoning}>
            <Brain size={16} className="act-icon" />
            <span className={`act-label ${thinkingLive || msg.thinkStart == null ? "shimmer-text" : ""}`}>
              {msg.thinkStart == null ? "Getting started" : thinkingLive ? `Thinking · ${fmtSecs(thoughtMs)}` : `Thought for ${fmtSecs(thoughtMs)}`}
            </span>
            {showThinking && msg.reasoning && <ChevronDown size={16} className="act-chevron" aria-hidden="true" />}
          </Collapsible.Trigger>
          {showThinking && msg.reasoning && (
            <Collapsible.Content className="act-content">
              <pre className="act-thinking">{msg.reasoning.slice(-3000)}</pre>
            </Collapsible.Content>
          )}
        </Collapsible.Root>
      )}
    </div>
  );
}

export function QuickAnswer({ text, live }: { text: string; live: boolean }) {
  return (
    <section className="quick" aria-label="Quick answer" aria-live="polite">
      <div className="quick-head">
        <Zap size={14} aria-hidden="true" /> Quick answer
      </div>
      <p>
        {text}
        {live && <span className="caret" aria-hidden="true" />}
      </p>
    </section>
  );
}

export function LessonSkeleton() {
  return (
    <div className="lesson-skel" aria-label="Building your visual lesson">
      <div className="skel-hero" />
      <div className="skel-row">
        <div className="skel-tile" />
        <div className="skel-tile" />
      </div>
      <div className="skel-block" />
      <p className="skel-note shimmer-text">Designing your visual lesson…</p>
    </div>
  );
}
