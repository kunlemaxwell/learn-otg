"use client";
// Interactive lesson components: typed and photo answers, simulations, games, scenarios
// and quiz cards. Each reports what the learner did through LessonContext.onAnswer,
// which is how later pages adapt to the learner.
import { Camera, Check, Clock, ImagePlus, LoaderCircle, RotateCcw, Shuffle, Sparkles, Trophy, X } from "lucide-react";
import { useContext, useId, useEffect, useMemo, useRef, useState } from "react";
import { evaluate } from "@/lib/formula";
import { downscaleImage, GradeError, gradeAnswer, type GradeResult } from "@/lib/grade-client";
import { LessonContext } from "./lesson-context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = { props: any };

const nowMs = () => Date.now();
const arr = <T,>(x: T[] | undefined | null): T[] => (Array.isArray(x) ? x.filter((v) => v != null) : []);
const str = (x: unknown) => (x == null ? "" : String(x));

/** Stable shuffle: the same items always come out in the same order (no jumps while a lesson streams in). */
function seededShuffle<T>(items: T[], seedText: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Never hand back the answer already in order.
  if (out.length > 2 && out.every((v, i) => v === items[i])) out.push(out.shift() as T);
  return out;
}

function useMood() {
  const { mood } = useContext(LessonContext);
  return `otg-m-${mood}`;
}

/* ---------- PageTitle ---------- */

export function PageTitleView({ props }: P) {
  const m = useMood();
  return (
    <header className={`otg-pagetitle ${m}`}>
      {props.kicker ? <span className="otg-eyebrow">{str(props.kicker)}</span> : null}
      <h2>
        {props.emoji ? <span aria-hidden="true">{str(props.emoji)} </span> : null}
        {str(props.title)}
      </h2>
    </header>
  );
}

/* ---------- Feedback block shared by typed and photo answers ---------- */

function Verdict({ r }: { r: GradeResult }) {
  const tone = r.verdict === "correct" ? "is-right" : r.verdict === "partial" ? "is-hint" : r.verdict === "incorrect" ? "is-wrong" : "is-hint";
  const label = r.verdict === "correct" ? "Correct." : r.verdict === "partial" ? "Partly right." : r.verdict === "incorrect" ? "Not yet." : "Marked.";
  return (
    <div className={`otg-fb ${tone}`} role="status">
      {r.verdict === "correct" ? <Check size={16} className="otg-icon" /> : r.verdict === "incorrect" ? <X size={16} className="otg-icon" /> : <Sparkles size={16} className="otg-icon" />}
      <div>
        <strong>{label}</strong> {r.feedback}
        {r.seen ? <p className="otg-seen">What I see: {r.seen}</p> : null}
      </div>
    </div>
  );
}

/* ---------- OpenQuestion: typed answer, marked by the tutor ---------- */

export function OpenQuestionView({ props }: P) {
  const m = useMood();
  const { onAnswer, lessonTitle, lessonContent } = useContext(LessonContext);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<GradeResult | null>(null);
  const [err, setErr] = useState("");
  const [showHint, setShowHint] = useState(false);
  const question = str(props.question);
  const questionId = useId();
  const long = props.size === "long";

  const check = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await gradeAnswer({ kind: "text", question, modelAnswer: str(props.modelAnswer), response: text, lesson: `${lessonTitle}\n${lessonContent?.slice(0, 8000) ?? ""}` });
      setRes(r);
      onAnswer({ kind: "text", question, response: text.trim(), correct: r.verdict === "correct" ? true : r.verdict === "incorrect" ? false : null, score: r.score, feedback: r.feedback, ts: Date.now() });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't mark that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`otg-open ${m}`}>
      <span className="otg-eyebrow">Your answer</span>
      <label className="otg-open-q" htmlFor={questionId}>
        {question}
      </label>
      <textarea
        id={questionId}
        rows={long ? 5 : 2}
        value={text}
        disabled={busy}
        placeholder={long ? "Write a few sentences in your own words." : "Type your answer."}
        onChange={(e) => {
          setText(e.target.value);
          if (res) setRes(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) check();
        }}
      />
      <div className="otg-open-actions">
        <button type="button" className="otg-btn otg-btn--primary" onClick={check} disabled={!text.trim() || busy}>
          {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} {busy ? "Marking…" : res ? "Mark again" : "Check my answer"}
        </button>
        {props.hint && !res ? (
          <button type="button" className="otg-btn otg-btn--ghost" onClick={() => setShowHint(true)} disabled={showHint}>
            Hint
          </button>
        ) : null}
      </div>
      {showHint && !res && props.hint ? (
        <div className="otg-fb is-hint">
          <Sparkles size={16} className="otg-icon" />
          <div>{str(props.hint)}</div>
        </div>
      ) : null}
      {err ? <p className="otg-err">{err}</p> : null}
      {res ? <Verdict r={res} /> : null}
      {res && props.modelAnswer ? (
        <details className="otg-model" open={res.verdict !== "correct"}>
          <summary>A strong answer</summary>
          <p>{str(props.modelAnswer)}</p>
        </details>
      ) : null}
    </section>
  );
}

/* ---------- PhotoAnswer: the learner sends a photo, the tutor looks at it ---------- */

export function PhotoAnswerView({ props }: P) {
  const m = useMood();
  const { onAnswer, lessonTitle, lessonContent } = useContext(LessonContext);
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<GradeResult | null>(null);
  const [err, setErr] = useState("");
  const [noVision, setNoVision] = useState(false);
  const [ticks, setTicks] = useState<Record<number, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const prompt = str(props.prompt);
  const lookFor = arr<string>(props.lookFor).map(str);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    setRes(null);
    try {
      setImg(await downscaleImage(f, 1024));
    } catch {
      setErr("That file couldn't be opened as a picture.");
    }
  };

  const send = async () => {
    if (!img || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await gradeAnswer({ kind: "image", question: prompt, lookFor, image: img, lesson: `${lessonTitle}\n${lessonContent?.slice(0, 8000) ?? ""}` });
      setRes(r);
      onAnswer({ kind: "image", question: prompt, response: r.seen ? `Photo: ${r.seen}` : "Sent a photo", correct: r.verdict === "correct" ? true : r.verdict === "incorrect" ? false : null, score: r.score, feedback: r.feedback, ts: Date.now() });
    } catch (e) {
      if (e instanceof GradeError && e.code === "no-vision") setNoVision(true);
      else setErr(e instanceof Error ? e.message : "Couldn't look at that photo.");
    } finally {
      setBusy(false);
    }
  };

  const selfScore = () => {
    const n = Object.values(ticks).filter(Boolean).length;
    onAnswer({ kind: "image", question: prompt, response: `Self-checked ${n} of ${lookFor.length} points`, correct: null, score: lookFor.length ? n / lookFor.length : 0, ts: Date.now() });
  };

  return (
    <section className={`otg-photo ${m}`}>
      <span className="otg-eyebrow">
        <Camera size={13} /> Show your answer
      </span>
      <p className="otg-open-q">{prompt}</p>
      {props.hint ? <p className="otg-photo-hint">{str(props.hint)}</p> : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {img ? (
        <div className="otg-photo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="Your answer" />
          <button type="button" className="otg-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            <RotateCcw size={15} /> Retake
          </button>
        </div>
      ) : (
        <button type="button" className="otg-photo-drop" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={26} />
          <strong>Take or choose a photo</strong>
          <small>A sketch, your working, or something you made</small>
        </button>
      )}
      {img && !noVision ? (
        <button type="button" className="otg-btn otg-btn--primary" onClick={send} disabled={busy} style={{ justifySelf: "start" }}>
          {busy ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />} {busy ? "Looking at your photo…" : res ? "Check again" : "Get feedback"}
        </button>
      ) : null}
      {err ? <p className="otg-err">{err}</p> : null}
      {res ? <Verdict r={res} /> : null}
      {(res || noVision) && lookFor.length ? (
        <div className="otg-photo-check">
          <strong>{noVision ? "Check your photo against this list:" : "A good answer shows:"}</strong>
          <ul>
            {lookFor.map((t, i) => (
              <li key={i}>
                {noVision ? (
                  <label>
                    <input type="checkbox" checked={!!ticks[i]} onChange={(e) => setTicks({ ...ticks, [i]: e.target.checked })} /> {t}
                  </label>
                ) : (
                  <>
                    <Check size={14} className="otg-icon" /> {t}
                  </>
                )}
              </li>
            ))}
          </ul>
          {noVision ? (
            <>
              <p className="otg-photo-hint">Your current model can&apos;t read photos, so this one is self-checked. Pick Qwen or Kimi in Settings for photo feedback.</p>
              <button type="button" className="otg-btn" onClick={selfScore}>
                Done
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/* ---------- Simulation: sliders in, live outputs and chart out ---------- */

type SimInput = { key: string; label: string; min: number; max: number; step?: number; initial?: number; unit?: string };
type SimOutput = { label: string; formula: string; unit?: string; decimals?: number };

function fmtNum(v: number, decimals?: number, unit?: string) {
  if (!Number.isFinite(v)) return "—";
  const d = decimals ?? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
  const n = new Intl.NumberFormat("en", { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(v);
  if (!unit) return n;
  if (["$", "£", "€", "₦", "¥"].includes(unit)) return `${unit}${n}`;
  return unit === "%" ? `${n}%` : `${n} ${unit}`;
}

export function SimulationView({ props }: P) {
  const m = useMood();
  const { onAnswer } = useContext(LessonContext);
  const inputs = arr<SimInput>(props.inputs).filter((i) => i.key && Number.isFinite(Number(i.min)) && Number.isFinite(Number(i.max)));
  const outputs = arr<SimOutput>(props.outputs).filter((o) => o.label && o.formula);
  const [vals, setVals] = useState<Record<string, number>>({});
  const reported = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current: Record<string, number> = {};
  for (const i of inputs) current[i.key] = vals[i.key] ?? Number(i.initial ?? i.min);

  const results = outputs.map((o) => ({ ...o, value: evaluate(o.formula, current) }));
  const broken = results.some((r) => !Number.isFinite(r.value));
  const insights = arr<{ when: string; text: string }>(props.insights).filter((x) => x.when && x.text && evaluate(x.when, current) > 0);

  // Chart: one output across one input's range, others held where they are.
  const chart = props.chart && inputs.find((i) => i.key === props.chart.x) && outputs.find((o) => o.label === props.chart.y) ? props.chart : null;
  const series = (() => {
    if (!chart) return null;
    const xi = inputs.find((i) => i.key === chart.x)!;
    const yo = outputs.find((o) => o.label === chart.y)!;
    const n = 32;
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k <= n; k++) {
      const x = Number(xi.min) + ((Number(xi.max) - Number(xi.min)) * k) / n;
      const y = evaluate(yo.formula, { ...current, [xi.key]: x });
      if (Number.isFinite(y)) pts.push({ x, y });
    }
    return pts.length > 1 ? { pts, xi, yo } : null;
  })();

  const change = (key: string, v: number) => {
    const next = { ...current, [key]: v };
    setVals(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const summary = inputs.map((i) => `${i.label} ${fmtNum(next[i.key], undefined, i.unit)}`).join(", ");
      const out = outputs.map((o) => `${o.label} ${fmtNum(evaluate(o.formula, next), o.decimals, o.unit)}`).join(", ");
      onAnswer({ kind: "simulation", question: str(props.title), response: `Tried ${summary} → ${out}`, correct: null, ts: Date.now() });
      reported.current = true;
    }, 1500);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (!inputs.length || !outputs.length) return null;

  const W = 320;
  const H = 150;
  let path = "";
  let marker: { x: number; y: number } | null = null;
  let yMax = 0;
  let yMin = 0;
  if (series) {
    yMax = Math.max(...series.pts.map((p) => p.y));
    yMin = Math.min(0, ...series.pts.map((p) => p.y));
    const sx = (x: number) => ((x - Number(series.xi.min)) / (Number(series.xi.max) - Number(series.xi.min) || 1)) * W;
    const sy = (y: number) => H - ((y - yMin) / (yMax - yMin || 1)) * (H - 10) - 4;
    path = series.pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
    const cx = current[series.xi.key];
    const cy = evaluate(series.yo.formula, current);
    if (Number.isFinite(cy)) marker = { x: sx(cx), y: sy(cy) };
  }

  return (
    <section className={`otg-sim ${m}`}>
      <span className="otg-eyebrow">Simulation</span>
      <h3 className="otg-title">{str(props.title)}</h3>
      {props.intro ? <p className="otg-sim-intro">{str(props.intro)}</p> : null}
      <div className="otg-sim-grid">
        <div className="otg-sim-inputs">
          {inputs.map((i) => {
            const v = current[i.key];
            const min = Number(i.min);
            const max = Number(i.max);
            const pct = ((v - min) / (max - min || 1)) * 100;
            return (
              <label key={i.key} className="otg-sim-in">
                <span className="otg-sim-in-top">
                  <span>{i.label}</span>
                  <output>{fmtNum(v, undefined, i.unit)}</output>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={Number(i.step) || (max - min) / 100}
                  value={v}
                  style={{ ["--pct" as string]: `${pct}%` }}
                  onChange={(e) => change(i.key, Number(e.target.value))}
                />
              </label>
            );
          })}
        </div>
        <div className="otg-sim-outs" aria-live="polite">
          {results.map((r) => (
            <div key={r.label} className="otg-sim-out">
              <small>{r.label}</small>
              <strong>{fmtNum(r.value, r.decimals, r.unit)}</strong>
            </div>
          ))}
        </div>
      </div>
      {series ? (
        <figure className="otg-sim-chart">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${series.yo.label} against ${series.xi.label}`}>
            <path d={`${path} L${W},${H} L0,${H} Z`} className="otg-sim-area" />
            <path d={path} className="otg-sim-line" />
            {marker ? <circle cx={marker.x} cy={marker.y} r={5} className="otg-sim-dot" /> : null}
          </svg>
          <figcaption>
            <span>
              {series.yo.label} vs {series.xi.label.toLowerCase()}
            </span>
            <span>max {fmtNum(yMax, series.yo.decimals, series.yo.unit)}</span>
          </figcaption>
        </figure>
      ) : null}
      {insights.map((x, k) => (
        <div key={k} className="otg-fb is-right otg-sim-insight">
          <Sparkles size={16} className="otg-icon" />
          <div>{x.text}</div>
        </div>
      ))}
      {broken ? <p className="otg-err">One of these numbers can&apos;t be worked out. Try moving the sliders.</p> : null}
    </section>
  );
}

/* ---------- SortGame ---------- */

export function SortGameView({ props }: P) {
  const m = useMood();
  const { onAnswer } = useContext(LessonContext);
  const buckets = arr<string>(props.buckets).map(str).filter(Boolean);
  const items = arr<{ text: string; bucket: string }>(props.items).filter((i) => i.text && i.bucket);
  const order = useMemo(() => seededShuffle(items.map((_, i) => i), items.map((i) => i.text).join("|")), [items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [sel, setSel] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const norm = (s: string) => s.trim().toLowerCase();
  const isRight = (i: number) => norm(placed[i] ?? "") === norm(items[i].bucket);
  const all = items.length > 0 && items.every((_, i) => placed[i]);
  const score = items.filter((_, i) => isRight(i)).length;

  if (!buckets.length || !items.length) return null;
  const pool = order.filter((i) => i < items.length && !placed[i]);

  const check = () => {
    setChecked(true);
    onAnswer({ kind: "game", question: str(props.title), response: `Sorted ${score} of ${items.length} correctly`, correct: score === items.length, score: score / items.length, ts: Date.now() });
  };
  const retry = () => {
    const keep: Record<number, string> = {};
    items.forEach((_, i) => {
      if (isRight(i)) keep[i] = placed[i];
    });
    setPlaced(keep);
    setChecked(false);
  };

  return (
    <section className={`otg-game otg-sort ${m}`}>
      <span className="otg-eyebrow">
        <Shuffle size={13} /> Sort it
      </span>
      <h3 className="otg-title">{str(props.title)}</h3>
      {!checked ? <p className="otg-game-help">{sel == null ? "Tap a card, then tap where it belongs." : "Now tap a group."}</p> : null}
      {pool.length ? (
        <div className="otg-sort-pool">
          {pool.map((i) => (
            <button key={i} type="button" className={`otg-chip ${sel === i ? "is-selected" : ""}`} onClick={() => setSel(sel === i ? null : i)} aria-pressed={sel === i}>
              {items[i].text}
            </button>
          ))}
        </div>
      ) : null}
      <div className="otg-sort-buckets" style={{ gridTemplateColumns: `repeat(${Math.min(buckets.length, 3)}, minmax(0, 1fr))` }}>
        {buckets.map((b) => (
          <div
            key={b}
            role="button"
            tabIndex={0}
            className={`otg-bucket ${sel != null ? "is-target" : ""}`}
            onClick={() => {
              if (sel == null || checked) return;
              setPlaced({ ...placed, [sel]: b });
              setSel(null);
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && sel != null && !checked) {
                e.preventDefault();
                setPlaced({ ...placed, [sel]: b });
                setSel(null);
              }
            }}
          >
            <strong>{b}</strong>
            <div className="otg-bucket-items">
              {items.map((it, i) =>
                placed[i] === b ? (
                  <button
                    key={i}
                    type="button"
                    className={`otg-placed ${checked ? (isRight(i) ? "is-right" : "is-wrong") : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (checked) return;
                      const next = { ...placed };
                      delete next[i];
                      setPlaced(next);
                    }}
                  >
                    {checked ? isRight(i) ? <Check size={13} /> : <X size={13} /> : null} {it.text}
                  </button>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      {checked ? (
        <div className={`otg-fb ${score === items.length ? "is-right" : "is-hint"}`} role="status">
          <Trophy size={16} className="otg-icon" />
          <div>
            <strong>
              {score} of {items.length} in the right place.
            </strong>{" "}
            {str(props.explain)}
          </div>
        </div>
      ) : null}
      <div className="otg-open-actions">
        {!checked ? (
          <button type="button" className="otg-btn otg-btn--primary" disabled={!all} onClick={check}>
            Check
          </button>
        ) : score < items.length ? (
          <button type="button" className="otg-btn" onClick={retry}>
            <RotateCcw size={15} /> Fix the wrong ones
          </button>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- OrderGame ---------- */

export function OrderGameView({ props }: P) {
  const m = useMood();
  const { onAnswer } = useContext(LessonContext);
  const items = arr<string>(props.items).map(str).filter(Boolean);
  const shuffled = useMemo(() => seededShuffle(items.map((_, i) => i), items.join("|")), [items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [seq, setSeq] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  if (items.length < 2) return null;
  const pool = shuffled.filter((i) => i < items.length && !seq.includes(i));
  const right = seq.filter((v, pos) => v === pos).length;

  const check = () => {
    setChecked(true);
    onAnswer({ kind: "game", question: str(props.title), response: `${right} of ${items.length} steps in the right place`, correct: right === items.length, score: right / items.length, ts: Date.now() });
  };

  return (
    <section className={`otg-game otg-order ${m}`}>
      <span className="otg-eyebrow">Put in order</span>
      <h3 className="otg-title">{str(props.title)}</h3>
      <ol className="otg-order-seq">
        {items.map((_, pos) => {
          const v = seq[pos];
          return (
            <li key={pos} className={v == null ? "is-empty" : checked ? (v === pos ? "is-right" : "is-wrong") : ""}>
              <span className="otg-num">{pos + 1}</span>
              {v == null ? (
                <span className="otg-order-slot">{pos === seq.length ? "Tap the next step below" : ""}</span>
              ) : (
                <button type="button" disabled={checked} onClick={() => setSeq(seq.filter((x) => x !== v))}>
                  {items[v]}
                  {checked ? v === pos ? <Check size={15} /> : <X size={15} /> : null}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {pool.length ? (
        <div className="otg-sort-pool">
          {pool.map((i) => (
            <button key={i} type="button" className="otg-chip" onClick={() => setSeq([...seq, i])}>
              {items[i]}
            </button>
          ))}
        </div>
      ) : null}
      {checked ? (
        <div className={`otg-fb ${right === items.length ? "is-right" : "is-hint"}`} role="status">
          <Trophy size={16} className="otg-icon" />
          <div>
            <strong>{right === items.length ? "Perfect order." : `${right} of ${items.length} in place.`}</strong>{" "}
            {right < items.length ? <>The right order: {items.map((t, i) => `${i + 1}. ${t}`).join(" · ")}. </> : null}
            {str(props.explain)}
          </div>
        </div>
      ) : null}
      <div className="otg-open-actions">
        {!checked ? (
          <button type="button" className="otg-btn otg-btn--primary" disabled={seq.length < items.length} onClick={check}>
            Check order
          </button>
        ) : (
          <button
            type="button"
            className="otg-btn"
            onClick={() => {
              setSeq([]);
              setChecked(false);
            }}
          >
            <RotateCcw size={15} /> Try again
          </button>
        )}
      </div>
    </section>
  );
}

/* ---------- MatchGame ---------- */

export function MatchGameView({ props }: P) {
  const m = useMood();
  const { onAnswer } = useContext(LessonContext);
  const pairs = arr<{ left: string; right: string }>(props.pairs).filter((p) => p.left && p.right);
  const rights = useMemo(() => seededShuffle(pairs.map((_, i) => i), pairs.map((p) => p.right).join("|")), [pairs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [left, setLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [miss, setMiss] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (start == null || end != null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [start, end]);
  if (pairs.length < 2) return null;
  const secs = start == null ? 0 : Math.round(((end ?? (now || start)) - start) / 1000);

  const pickRight = (r: number) => {
    if (left == null || matched.includes(r)) return;
    if (r === left) {
      const next = [...matched, r];
      setMatched(next);
      setLeft(null);
      if (next.length === pairs.length) {
        const t = nowMs();
        setEnd(t);
        const score = pairs.length / (pairs.length + miss);
        onAnswer({ kind: "game", question: str(props.title), response: `Matched all ${pairs.length} pairs in ${Math.round((t - (start ?? t)) / 1000)}s with ${miss} mistake${miss === 1 ? "" : "s"}`, correct: miss === 0, score, ts: t });
      }
    } else {
      setMiss(miss + 1);
      setShake(r);
      setTimeout(() => setShake(null), 350);
    }
  };

  const reset = () => {
    setMatched([]);
    setMiss(0);
    setLeft(null);
    setStart(null);
    setEnd(null);
  };

  return (
    <section className={`otg-game otg-match ${m}`}>
      <div className="otg-match-head">
        <span className="otg-eyebrow">Match the pairs</span>
        <span className="otg-match-stats">
          <Clock size={13} /> {secs}s · {miss} miss{miss === 1 ? "" : "es"}
        </span>
      </div>
      <h3 className="otg-title">{str(props.title)}</h3>
      <div className="otg-match-cols">
        <div>
          {pairs.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`otg-match-card ${matched.includes(i) ? "is-done" : left === i ? "is-selected" : ""}`}
              disabled={matched.includes(i)}
              onClick={() => {
                if (start == null) setStart(Date.now());
                setLeft(left === i ? null : i);
              }}
            >
              {p.left}
            </button>
          ))}
        </div>
        <div>
          {rights.map((r) =>
            r < pairs.length ? (
              <button
                key={r}
                type="button"
                className={`otg-match-card is-right-col ${matched.includes(r) ? "is-done" : ""} ${shake === r ? "is-shake" : ""}`}
                disabled={matched.includes(r)}
                onClick={() => pickRight(r)}
              >
                {pairs[r].right}
              </button>
            ) : null,
          )}
        </div>
      </div>
      {end != null ? (
        <div className="otg-fb is-right" role="status">
          <Trophy size={16} className="otg-icon" />
          <div>
            <strong>All matched in {secs} seconds</strong> with {miss} mistake{miss === 1 ? "" : "s"}.{" "}
            <button type="button" className="otg-link" onClick={reset}>
              Play again
            </button>
          </div>
        </div>
      ) : (
        <p className="otg-game-help">{left == null ? "Tap an item on the left, then its partner on the right." : "Now tap its partner."}</p>
      )}
    </section>
  );
}

/* ---------- Scenario: a short role-play with consequences ---------- */

type Step = { situation: string; choices: { label: string; outcome: string; score: number }[] };

export function ScenarioView({ props }: P) {
  const m = useMood();
  const { onAnswer } = useContext(LessonContext);
  const steps = arr<Step>(props.steps).filter((s) => s.situation && arr(s.choices).length);
  const [k, setK] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  if (!steps.length) return null;
  const step = steps[Math.min(k, steps.length - 1)];
  const choices = arr(step.choices);
  const picked = picks[k];
  const finished = k >= steps.length;
  const total = picks.reduce((s, p, i) => s + Number(arr(steps[i]?.choices)[p]?.score ?? 0), 0);
  const max = steps.length * 2;

  const choose = (i: number) => {
    if (picked != null) return;
    const next = [...picks];
    next[k] = i;
    setPicks(next);
  };

  const advance = () => {
    const nk = k + 1;
    setK(nk);
    if (nk >= steps.length) {
      const sc = picks.reduce((s, p, i) => s + Number(arr(steps[i]?.choices)[p]?.score ?? 0), 0);
      onAnswer({
        kind: "scenario",
        question: str(props.title),
        response: steps.map((s, i) => `${arr(s.choices)[picks[i]]?.label ?? "?"} (${["poor", "okay", "best"][Number(arr(s.choices)[picks[i]]?.score ?? 0)] ?? "?"})`).join("; "),
        correct: sc >= max * 0.75,
        score: max ? sc / max : 0,
        ts: nowMs(),
      });
    }
  };

  const tone = (s: number) => (s >= 2 ? "is-best" : s >= 1 ? "is-ok" : "is-poor");

  return (
    <section className={`otg-scn ${m}`}>
      <div className="otg-scn-top">
        <span className="otg-eyebrow">Scenario</span>
        <span className="otg-scn-role">You are {str(props.role).replace(/^you are\s+/i, "")}</span>
      </div>
      <h3 className="otg-title">{str(props.title)}</h3>
      <div className="otg-scn-progress" aria-hidden="true">
        {steps.map((_, i) => (
          <i key={i} className={i < k || finished ? "is-done" : i === k ? "is-on" : ""} />
        ))}
      </div>
      {!finished ? (
        <>
          <p className="otg-scn-sit">{step.situation}</p>
          <div className="otg-scn-choices">
            {choices.map((c, i) => (
              <button key={i} type="button" className={`otg-opt ${picked === i ? tone(Number(c.score)) : ""}`} disabled={picked != null && picked !== i} onClick={() => choose(i)}>
                <span className="otg-opt-key">{String.fromCharCode(65 + i)}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          {picked != null ? (
            <div className={`otg-scn-outcome ${tone(Number(choices[picked]?.score))}`} role="status">
              <strong>{Number(choices[picked]?.score) >= 2 ? "Strong move." : Number(choices[picked]?.score) >= 1 ? "It works, mostly." : "That backfires."}</strong> {choices[picked]?.outcome}
              <div>
                <button type="button" className="otg-btn otg-btn--primary" onClick={advance}>
                  {k + 1 < steps.length ? "What happens next" : "See how you did"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="otg-scn-end">
          <div className="otg-scn-score">
            <Trophy size={20} /> {total} / {max}
          </div>
          <p>{str(props.debrief)}</p>
          <button
            type="button"
            className="otg-btn"
            onClick={() => {
              setK(0);
              setPicks([]);
            }}
          >
            <RotateCcw size={15} /> Play again
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- FlipCards: think, flip, mark yourself ---------- */

export function FlipCardsView({ props }: P) {
  const m = useMood();
  const { onAnswer } = useContext(LessonContext);
  const cards = arr<{ front: string; back: string }>(props.cards).filter((c) => c.front);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [rated, setRated] = useState<Record<number, boolean>>({});
  const sent = useRef(false);
  const ratedCount = Object.keys(rated).length;
  const known = Object.values(rated).filter(Boolean).length;

  useEffect(() => {
    if (cards.length && ratedCount === cards.length && !sent.current) {
      sent.current = true;
      onAnswer({
        kind: "cards",
        question: str(props.title) || "Quiz cards",
        response: `Knew ${known} of ${cards.length}${known < cards.length ? `; not yet: ${cards.filter((_, i) => rated[i] === false).map((c) => c.front).join(", ")}` : ""}`,
        correct: known === cards.length,
        score: known / cards.length,
        ts: Date.now(),
      });
    }
  }, [ratedCount, cards, known, rated, onAnswer, props.title]);

  if (!cards.length) return null;
  return (
    <section className={`otg-flips ${m}`}>
      <span className="otg-eyebrow">Quiz cards</span>
      {props.title ? <h3 className="otg-title">{str(props.title)}</h3> : null}
      <div className="otg-flips-grid">
        {cards.map((c, i) => {
          const on = !!flipped[i];
          return (
            <div key={i} className="otg-flipwrap">
              <button type="button" className={`otg-flip ${on ? "is-flipped" : ""} ${rated[i] === true ? "is-known" : rated[i] === false ? "is-unknown" : ""}`} aria-pressed={on} onClick={() => setFlipped({ ...flipped, [i]: !on })}>
                <span className="otg-flip-inner">
                  <span className="otg-flip-face is-front">
                    <span>{c.front}</span>
                    <small>Think, then tap</small>
                  </span>
                  <span className="otg-flip-face is-back">{c.back}</span>
                </span>
              </button>
              {on ? (
                <div className="otg-flip-rate">
                  <button type="button" className={rated[i] === true ? "is-on" : ""} onClick={() => setRated({ ...rated, [i]: true })}>
                    <Check size={14} /> Got it
                  </button>
                  <button type="button" className={rated[i] === false ? "is-on" : ""} onClick={() => setRated({ ...rated, [i]: false })}>
                    <RotateCcw size={14} /> Not yet
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {ratedCount === cards.length ? (
        <p className="otg-game-help">
          You knew {known} of {cards.length}.{known < cards.length ? " The ones marked “not yet” will come back later." : ""}
        </p>
      ) : null}
    </section>
  );
}
