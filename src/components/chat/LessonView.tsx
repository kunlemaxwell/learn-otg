"use client";

import { ArrowRight, Globe, MessageCircle, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { continueLesson, getChat, send } from "@/lib/chat-store";
import type { Answer } from "@/lib/course-types";
import { award } from "@/lib/journey";
import { remember } from "@/lib/learner-memory";
import { lessonTitle, type ParsedReply } from "@/lib/parse";
import { recordProgress } from "@/lib/progress";
import { useSettings } from "@/lib/settings";
import { messageSources, type Msg, type Source, type Timing } from "@/lib/types";
import { ActivityRows, hostOf, LessonSkeleton, QuickAnswer } from "../Activity";
import { LessonRenderer } from "../LessonRenderer";
import { LessonSelection } from "../LessonSelection";
import { ShareBar } from "../ShareBar";
import type { QuizResult } from "../lesson-context";

function fmtMs(ms?: number | null) {
  if (ms == null) return "–";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function SpeedStats({ t }: { t: Timing }) {
  const tokens = (t.usage?.prompt_tokens ?? 0) + (t.usage?.completion_tokens ?? 0);
  return (
    <details className="speed">
      <summary>
        <Zap size={14} aria-hidden="true" />
        {t.cached ? "Instant (cached)" : fmtMs(t.totalMs)}
        {!t.cached && t.quickFirstMs != null && <span>· instant answer {fmtMs(t.quickFirstMs)}</span>}
        {!t.cached && t.quickFirstMs == null && t.firstContentMs != null && <span>· first words {fmtMs(t.firstContentMs)}</span>}
        {tokens > 0 && <span>· {tokens.toLocaleString()} tokens</span>}
      </summary>
      <dl className="speed-grid">
        <div>
          <dt>Model</dt>
          <dd>
            {t.model} ({t.provider})
          </dd>
        </div>
        {!t.cached && (
          <>
            <div>
              <dt>Web research</dt>
              <dd>{t.researchMs ? fmtMs(t.researchMs) : "none"}</dd>
            </div>
            <div>
              <dt>Waiting for model</dt>
              <dd>{fmtMs(t.waitMs)}</dd>
            </div>
            <div>
              <dt>Thinking</dt>
              <dd>{t.thinkingOff ? "off" : fmtMs(t.thinkingMs)}</dd>
            </div>
            <div>
              <dt>Tokens in / out</dt>
              <dd>
                {t.usage?.prompt_tokens?.toLocaleString() ?? "–"} / {t.usage?.completion_tokens?.toLocaleString() ?? "–"}
              </dd>
            </div>
            <div>
              <dt>Speed</dt>
              <dd>{t.tokensPerSec ? `${t.tokensPerSec} tokens/s` : "–"}</dd>
            </div>
          </>
        )}
      </dl>
    </details>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  return (
    <section className="sources" aria-label="Sources">
      <h3 className="sources-head">
        <Globe size={16} aria-hidden="true" /> Sources from the web
      </h3>
      <ol className="source-list">
        {sources.map((s, i) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="source">
              <span className="source-num">{i + 1}</span>
              <span className="source-text">
                <span className="source-title">{s.title || hostOf(s.url)}</span>
                <span className="source-host">{hostOf(s.url)}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** One assistant reply as a lesson: research and thinking rows, quick answer, the lesson itself, sources and next actions. */
export function LessonView({ msg, parsed, latest, compact }: { msg: Msg; parsed: ParsedReply | undefined; latest: boolean; compact?: boolean }) {
  const { settings } = useSettings();
  const lessonRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!msg.streaming) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [msg.streaming]);
  const code = parsed?.code ?? null;
  const title = lessonTitle(code) ?? "Lesson";

  const onAsk = useCallback((text: string) => void send(text), []);
  const onQuizResult = useCallback(
    (r: QuizResult) => {
      recordProgress({ topic: title, question: r.question, correct: r.correct, attempts: r.attempts, ts: Date.now() });
      if (r.correct) award(r.attempts <= 1 ? "quiz-correct" : "quiz-retry", "Quiz answer");
    },
    [title],
  );
  const onAnswer = useCallback(
    (a: Answer) => {
      if (a.kind !== "choice" && a.correct === true) award("quiz-correct", a.question.slice(0, 60));
      if (a.kind !== "simulation" && (a.score != null ? a.score < 0.6 : a.correct === false))
        remember({ kind: "struggled", text: `${a.question.slice(0, 120)} (${a.response.slice(0, 90)})`, topic: title, scope: "global" });
    },
    [title],
  );

  if (msg.error)
    return (
      <div className="canvas-error" role="alert">
        <strong>Couldn&apos;t build this lesson</strong>
        <p>{msg.error}</p>
      </div>
    );

  const sources = messageSources(msg);
  return (
    <div className="lesson-view">
      <ActivityRows msg={msg} now={now} showThinking={settings.showThinking} />
      {msg.quick && <QuickAnswer text={msg.quick} live={Boolean(msg.streaming) && !code} />}
      {!code && msg.streaming && <LessonSkeleton />}
      {!code && !msg.streaming && (
        <div className="canvas-text">
          <MessageCircle size={20} aria-hidden="true" />
          <p>{parsed?.chat || "No lesson was returned. Try asking again."}</p>
        </div>
      )}
      {msg.notice && (
        <div className="canvas-notice" role="status">
          {msg.notice}
        </div>
      )}
      {code && (
        <LessonSelection title={title} onAsk={quote => void send(`Explain this passage from "${title}": ${quote}`, null, `About: ${quote}`)}>
        <div ref={lessonRef}>
          <LessonRenderer key={msg.id} code={code} streaming={Boolean(msg.streaming)} title={title} onAsk={onAsk} onQuizResult={onQuizResult} onAnswer={onAnswer} />
        </div>
        </LessonSelection>
      )}
      {code && !msg.streaming && latest && (
        <div className="continue-row">
          <button className="btn btn-sm" onClick={() => void continueLesson()} disabled={getChat().busy}>
            <ArrowRight size={15} aria-hidden="true" /> Continue this lesson
          </button>
          <span className="muted small">Builds the next part on what you just learned</span>
        </div>
      )}
      {code && !msg.streaming && !compact && <ShareBar persistent compact title={title} targetRef={lessonRef} text={`I just learned "${title}" on Learn OTG.`} />}
      {settings.showStats && msg.timing && !msg.streaming && <SpeedStats t={msg.timing} />}
      {sources.length > 0 && (code || !msg.streaming) && <SourceList sources={sources} />}
    </div>
  );
}
