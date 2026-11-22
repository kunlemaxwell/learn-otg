import "server-only";
// Auto-saved component library: proven lesson sections (a Tabs comparison, a
// chart card, a step flow...) are saved after each lesson and offered back to
// the model as layouts to reuse, so lessons stay consistent and render cleanly.
import { createHash } from "node:crypto";
import { componentKinds, extractCode, lessonTitle, parseStatements, rootChildren, subtree } from "./lesson-code";
import { componentStore, DAY, type SavedComponent } from "./store";

export type ComponentMode = "auto" | "reuse" | "off";

const KEEP_FOREVER = 3650 * DAY;
const MAX_CODE = 1100;
const SKIP_ROOT = new Set(["LessonHeader", "Flow", "StatGrid", "Compare", "Timeline", "TextContent", "BigIdea", "Quiz", "KeyTerms", "Takeaways", "Buttons", "Callout", "TextCallout", "Separator", "Predict", "WorkedExample", "Analogy", "ConceptMap", "Layers", "Scale", "RaceChart", "Explorable", "Recall", "FlipCards", "MythFact", "NextSteps", "PageTitle", "OpenQuestion", "PhotoAnswer", "Simulation", "SortGame", "OrderGame", "MatchGame", "Scenario"]);
const RICH = new Set(["Card", "Tabs", "Accordion", "Steps", "Table", "BarChart", "LineChart", "HorizontalBarChart", "PieChart", "CodeBlock"]);
const STOP = new Set(
  "the and for with what how why does are was were that this from into about your you explain tell show give more than then they them their have has had can could would should which when where who whom whose".split(" "),
);

export function keywords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP.has(w)),
    ),
  ].slice(0, 20);
}

function labelFor(kinds: string[], code: string): string {
  const header = code.match(/CardHeader\(\s*"((?:[^"\\]|\\.)+)"/)?.[1];
  const main = [...new Set(kinds.filter((k) => RICH.has(k)))].slice(0, 3).join(" + ");
  return header ? `${main} — “${header}”` : main;
}

/** Save the reusable sections of a finished lesson. Returns how many were new. */
export function saveFromLesson(text: string, question: string, mode: ComponentMode): number {
  if (mode !== "auto") return 0;
  const code = extractCode(text);
  if (!code) return 0;
  const st = parseStatements(code);
  const topic = lessonTitle(code) ?? question.slice(0, 60);
  let added = 0;
  for (const child of rootChildren(st)) {
    const sub = subtree(st, child);
    if (sub.length < 3) continue;
    const kinds = componentKinds(sub);
    if (SKIP_ROOT.has(kinds[0]) || !kinds.some((k) => RICH.has(k))) continue;
    const body = sub.map((s) => `${s.name} = ${s.expr}`).join("\n");
    if (body.length > MAX_CODE) continue;
    const signature = [...new Set(kinds)].join(">");
    const id = createHash("sha1").update(signature).digest("hex").slice(0, 10);
    const existing = componentStore.get(id);
    const now = Date.now();
    componentStore.set(
      id,
      {
        id,
        label: labelFor(kinds, body),
        kinds: [...new Set(kinds)],
        topic,
        keywords: [...new Set([...(existing?.keywords ?? []), ...keywords(`${topic} ${question}`)])].slice(0, 30),
        code: body,
        uses: (existing?.uses ?? 0) + 1,
        createdAt: existing?.createdAt ?? now,
        lastUsed: now,
      },
      KEEP_FOREVER,
    );
    if (!existing) added++;
  }
  return added;
}

/** Pick up to `n` saved components relevant to this question, formatted for the prompt. */
export function pickComponents(question: string, mode: ComponentMode, n = 2): { text: string; count: number } {
  if (mode === "off") return { text: "", count: 0 };
  const words = new Set(keywords(question));
  const scored = componentStore
    .values()
    .map((c) => ({ c, score: c.keywords.filter((k) => words.has(k)).length * 3 + Math.log2(1 + c.uses) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
  if (!scored.length) return { text: "", count: 0 };
  const text = scored
    .map(({ c }) => `# ${c.label} (from "${c.topic}", used ${c.uses}×)\n${c.code}`)
    .join("\n\n");
  return { text, count: scored.length };
}

export function listComponents(): SavedComponent[] {
  return componentStore.values().sort((a, b) => b.lastUsed - a.lastUsed);
}

export function deleteComponent(id: string) {
  componentStore.delete(id);
}

export function clearComponents() {
  componentStore.clear();
}
