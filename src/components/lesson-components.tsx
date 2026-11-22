"use client";
// Learn OTG's lesson components. The visuals come from the design system
// (lib/otg-bundle.js); this file maps OpenUI props onto them, adds the animated
// RaceChart, and registers everything with the OpenUI renderer.
import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { Tabs as TabsRoot, TabsContent, TabsList, TabsTrigger } from "@openuidev/react-ui";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { LESSON_COMPONENT_DEFS } from "@/lib/lesson-schemas.mjs";
import { OTG } from "@/lib/otg";
import {
  FlipCardsView,
  MatchGameView,
  OpenQuestionView,
  OrderGameView,
  PageTitleView,
  PhotoAnswerView,
  ScenarioView,
  SimulationView,
  SortGameView,
} from "./lesson-activities";
import { LessonContext } from "./lesson-context";

export { LessonContext, type QuizResult } from "./lesson-context";

const defs = Object.fromEntries(LESSON_COMPONENT_DEFS.map((d) => [d.name, d]));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = { props: any };

/** Legacy lessons used emoji + `Flow` steps with an emoji field; keep them tidy. */
const arr = <T,>(x: T[] | undefined): T[] => (Array.isArray(x) ? x.filter(Boolean) : []);

function make(name: keyof typeof OTG, map?: (p: Record<string, unknown>, ctx: React.ContextType<typeof LessonContext>) => Record<string, unknown>) {
  const Comp = OTG[name] as ComponentType<Record<string, unknown>>;
  function View({ props }: P) {
    const ctx = useContext(LessonContext);
    const mapped = map ? map(props, ctx) : props;
    return <Comp mood={ctx.mood} {...mapped} />;
  }
  View.displayName = `Lesson${String(name)}`;
  return View;
}

const HeaderView = make("Hero", (p) => ({
  variant: p.variant ?? "question",
  title: p.title,
  subtitle: p.subtitle,
  eyebrow: p.tag || undefined,
  glyph: p.emoji,
  figure: p.figure,
}));

const QuizBase = OTG.Quiz as ComponentType<Record<string, unknown>>;
function QuizView({ props }: P) {
  const { mood, onQuizResult, onAnswer } = useContext(LessonContext);
  return (
    <QuizBase
      key={props.question}
      mood={mood}
      variant={props.variant ?? "list"}
      question={props.question}
      options={arr(props.options)}
      answer={props.answer}
      hint={props.hint}
      explanation={props.explanation}
      onResult={(correct: boolean) => {
        onQuizResult({ question: String(props.question ?? ""), correct, attempts: correct ? 1 : 2 });
        const opts = arr<string>(props.options);
        onAnswer({
          kind: "choice",
          question: String(props.question ?? ""),
          response: correct ? `Chose the right answer (${opts[Number(props.answer)] ?? ""})` : `Missed it twice; the answer was ${opts[Number(props.answer)] ?? "?"}`,
          correct,
          score: correct ? 1 : 0,
          ts: Date.now(),
        });
      }}
    />
  );
}

const NextBase = OTG.NextSteps as ComponentType<Record<string, unknown>>;
function NextStepsView({ props }: P) {
  const { mood, ask } = useContext(LessonContext);
  return <NextBase mood={mood} prompts={arr(props.prompts)} onPick={ask} />;
}

/* ---------- RaceChart: animated bar chart race ---------- */

const SERIES_COLORS = ["var(--forest)", "var(--lagoon)", "var(--sun)", "var(--berry)", "var(--clay)", "var(--graphite)"];
const ROW = 40;

function compact(v: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: v >= 100 ? 0 : 1 }).format(v);
}

function RaceChartView({ props }: P) {
  const { mood } = useContext(LessonContext);
  const steps: string[] = arr<string>(props.steps).map(String);
  const series = useMemo(
    () =>
      arr<{ name?: string; values?: number[] }>(props.series)
        .filter((s) => s.name && Array.isArray(s.values))
        .map((s) => ({ name: String(s.name), values: (s.values as number[]).map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0)) })),
    [props.series],
  );
  const n = Math.max(steps.length, ...series.map((s) => s.values.length), 1);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const started = useRef(false);
  const idx = Math.min(i, n - 1);

  // Start once when the chart scrolls into view (unless the learner prefers reduced motion).
  useEffect(() => {
    const el = ref.current;
    if (!el || started.current || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      started.current = true;
      const t = setTimeout(() => setI(n - 1), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !started.current) {
          started.current = true;
          setPlaying(true);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [n]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setI((cur) => {
        if (cur >= n - 1) {
          setPlaying(false);
          return cur;
        }
        return cur + 1;
      });
    }, 1100);
    return () => clearInterval(t);
  }, [playing, n]);

  const rows = series.map((s, k) => ({ name: s.name, v: s.values[idx] ?? 0, k }));
  const ranked = [...rows].sort((a, b) => b.v - a.v);
  const TOP = Math.min(8, ranked.length);
  const rank = new Map(ranked.map((r, pos) => [r.name, pos]));
  const max = Math.max(...ranked.slice(0, TOP).map((r) => r.v), 1);
  const unit = props.unit ? String(props.unit) : "";

  if (series.length === 0) return null;
  return (
    <section ref={ref} className={`otg-race otg-m-${mood}`} aria-label={String(props.title ?? "Bar chart race")}>
      <div className="otg-race-head">
        <span className="otg-eyebrow">{props.title ?? "Race"}</span>
        <span className="otg-race-year" aria-live="polite">
          {steps[idx] ?? idx + 1}
        </span>
      </div>
      <div className="otg-race-board" style={{ height: TOP * ROW }}>
        {rows.map((r) => {
          const pos = rank.get(r.name) ?? 0;
          const shown = pos < TOP;
          return (
            <div
              key={r.name}
              className="otg-race-row"
              style={{ transform: `translateY(${pos * ROW}px)`, opacity: shown ? 1 : 0, height: ROW - 6 }}
              aria-hidden={!shown}
            >
              <div className="otg-race-bar" style={{ width: `${Math.max(3, (r.v / max) * 100)}%`, background: SERIES_COLORS[r.k % SERIES_COLORS.length] }}>
                <span className="otg-race-name">{r.name}</span>
              </div>
              <span className="otg-race-val">
                {compact(r.v)}
                {unit && <small> {unit}</small>}
              </span>
            </div>
          );
        })}
      </div>
      {n > 1 && (
        <div className="otg-race-ctl">
          <button
            type="button"
            className="otg-race-btn"
            onClick={() => {
              if (idx >= n - 1) setI(0);
              setPlaying((p) => !p || idx >= n - 1);
            }}
            aria-label={playing ? "Pause" : idx >= n - 1 ? "Replay" : "Play"}
          >
            {playing ? <Pause size={16} /> : idx >= n - 1 ? <RotateCcw size={16} /> : <Play size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={n - 1}
            value={idx}
            onChange={(e) => {
              setPlaying(false);
              setI(Number(e.target.value));
            }}
            aria-label="Move through time"
          />
        </div>
      )}
      {props.source && <p className="otg-race-src">Source: {String(props.source)}</p>}
    </section>
  );
}

/* ---------- Tabs (always open on the first tab) ---------- */

type TabItemNode = { props?: { value?: string; trigger?: string; content?: unknown } };

/** Same props as OpenUI's Tabs, but always opens on the first tab (OpenUI jumps to the last one that streamed in). */
function FirstTabTabs({ props, renderNode }: { props: { items?: TabItemNode[] }; renderNode: (v: unknown) => ReactNode }) {
  const items = (props.items ?? []).filter((i) => i?.props?.value != null);
  const [picked, setPicked] = useState<string | null>(null);
  if (!items.length) return null;
  const value = picked && items.some((i) => i.props!.value === picked) ? picked : String(items[0].props!.value);
  return (
    <TabsRoot value={value} onValueChange={setPicked}>
      <TabsList>
        {items.map((i) => (
          <TabsTrigger key={String(i.props!.value)} value={String(i.props!.value)} text={i.props!.trigger ?? ""} />
        ))}
      </TabsList>
      {items.map((i) => (
        <TabsContent key={String(i.props!.value)} value={String(i.props!.value)}>
          {renderNode(i.props!.content)}
        </TabsContent>
      ))}
    </TabsRoot>
  );
}

const baseTabs = openuiLibrary.components.Tabs;
const tabs = defineComponent({
  name: "Tabs",
  props: baseTabs.props,
  description: baseTabs.description,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: FirstTabTabs as any,
});

const views: Record<string, ComponentType<P>> = {
  LessonHeader: HeaderView,
  BigIdea: make("BigIdea", (p) => ({ text: p.text, variant: p.variant ?? "banner" })),
  Predict: make("Predict"),
  Flow: make("Flow", (p) => ({
    title: p.title,
    layout: p.layout ?? "rail",
    center: p.center,
    steps: arr(p.steps as { title?: string; detail?: string; emoji?: string }[]).map((s) => ({ title: s.title, detail: s.detail })),
  })),
  WorkedExample: make("WorkedExample"),
  Compare: make("Compare", (p) => ({ ...p, layout: p.layout ?? "split" })),
  Analogy: make("Analogy"),
  ConceptMap: make("ConceptMap"),
  Layers: make("Layers"),
  Timeline: make("Timeline", (p) => ({ ...p, layout: p.layout ?? "vertical" })),
  StatGrid: make("StatGrid", (p) => ({ ...p, layout: p.layout ?? "tiles" })),
  Scale: make("Scale", (p) => ({ ...p, log: p.log ?? true })),
  RaceChart: RaceChartView as ComponentType<P>,
  Explorable: make("Explorable"),
  Quiz: QuizView as ComponentType<P>,
  Recall: make("Recall"),
  FlipCards: FlipCardsView as ComponentType<P>,
  MythFact: make("MythFact"),
  KeyTerms: make("KeyTerms", (p) => ({ ...p, variant: p.variant ?? "glossary" })),
  Takeaways: make("Takeaways", (p) => ({ ...p, variant: p.variant ?? "checklist" })),
  NextSteps: NextStepsView as ComponentType<P>,
  PageTitle: PageTitleView as ComponentType<P>,
  OpenQuestion: OpenQuestionView as ComponentType<P>,
  PhotoAnswer: PhotoAnswerView as ComponentType<P>,
  Simulation: SimulationView as ComponentType<P>,
  SortGame: SortGameView as ComponentType<P>,
  OrderGame: OrderGameView as ComponentType<P>,
  MatchGame: MatchGameView as ComponentType<P>,
  Scenario: ScenarioView as ComponentType<P>,
};

const custom = Object.keys(views).map((name) =>
  defineComponent({
    name,
    props: defs[name].props,
    description: defs[name].description,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: views[name] as any,
  }),
);

/** Renderer library: every OpenUI component (so older lessons still render) plus Learn OTG's own. */
export const lessonLibrary = createLibrary({
  components: [...Object.values(openuiLibrary.components).filter((c) => c.name !== "Tabs"), tabs, ...custom],
  root: "Stack",
});
