// Learn OTG's lesson components: names, prop schemas and descriptions.
// Shared by the prompt (server, via scripts/gen-spec.mjs) and the renderer (client).
// Plain JS so the spec script can import it without a TypeScript step.
// Trailing optional args are layout/mood choices: they are what keeps lessons from looking alike.
import { z } from "zod";

const mood = z.enum(["forest", "sun", "lagoon", "berry", "clay", "graphite"]);

export const LESSON_COMPONENT_DEFS = [
  {
    name: "LessonHeader",
    description:
      "Opens every lesson (always first child of root). variant: question (a 'why/how' title), numeral (one striking figure; also pass figure), spotlight (full colour fill, for 'what is…'), split (symbol/formula in emoji slot, e.g. 'CO₂', 'π'). mood sets the colour of the WHOLE lesson. Pass tag as \"\" if none.",
    props: z.object({
      title: z.string(),
      subtitle: z.string(),
      emoji: z.string(),
      tag: z.string().optional(),
      mood: mood.optional(),
      variant: z.enum(["question", "numeral", "spotlight", "split"]).optional(),
      figure: z.object({ value: z.string(), caption: z.string().optional() }).optional(),
    }),
  },
  {
    name: "BigIdea",
    description: "The one-sentence core idea. variant: banner (tinted block), quote (large pull quote), sticky (sticky note). Root level only.",
    props: z.object({ text: z.string(), emoji: z.string().optional(), variant: z.enum(["banner", "quote", "sticky"]).optional() }),
  },
  {
    name: "Predict",
    description:
      "Pre-question BEFORE explaining, for topics with a famous wrong belief. The learner guesses; no guess is marked wrong; reveal explains. answer is the 0-based index of the right option.",
    props: z.object({ question: z.string(), options: z.array(z.string()), answer: z.number(), reveal: z.string() }),
  },
  {
    name: "Flow",
    description:
      "A process in order, 3–6 steps, one-sentence details. layout: rail (steps with detail), snake (short causal chain), cycle (loops back; set center to the cycle's name). Root level only.",
    props: z.object({
      title: z.string(),
      steps: z.array(z.object({ title: z.string(), detail: z.string().optional() })),
      layout: z.enum(["rail", "snake", "cycle"]).optional(),
      center: z.string().optional(),
    }),
  },
  {
    name: "WorkedExample",
    description:
      "A method solved step by step. Each step says what is being done (say) and optionally the working (work, e.g. a calculation). The last step is hidden until tapped. Root level only.",
    props: z.object({
      problem: z.string(),
      steps: z.array(z.object({ say: z.string(), work: z.string().optional() })),
      answer: z.string().optional(),
    }),
  },
  {
    name: "Compare",
    description:
      "Two things to tell apart. layout: split (side by side), versus (opposites), table (3+ aspects: pass rows [{label,left,right}]). Root level only.",
    props: z.object({
      left: z.object({ title: z.string(), points: z.array(z.string()).optional() }),
      right: z.object({ title: z.string(), points: z.array(z.string()).optional() }),
      verdict: z.string().optional(),
      layout: z.enum(["split", "versus", "table"]).optional(),
      rows: z.array(z.object({ label: z.string(), left: z.string(), right: z.string() })).optional(),
    }),
  },
  {
    name: "Analogy",
    description:
      "Explain something abstract by likening it to something familiar. mappings pairs parts of each (a = the concept's part, b = the familiar part). breaks says where the analogy fails. Root level only.",
    props: z.object({
      concept: z.string(),
      like: z.string(),
      mappings: z.array(z.object({ a: z.string(), b: z.string() })),
      breaks: z.string().optional(),
    }),
  },
  {
    name: "ConceptMap",
    description: "A centre idea with 3–8 connected parts or causes that have no fixed order. Root level only.",
    props: z.object({
      title: z.string(),
      center: z.string(),
      nodes: z.array(z.object({ label: z.string(), note: z.string().optional() })),
    }),
  },
  {
    name: "Layers",
    description: "Parts stacked in their physical order, top to bottom (atmosphere, a network stack, soil). Root level only.",
    props: z.object({
      title: z.string(),
      layers: z.array(z.object({ name: z.string(), detail: z.string().optional(), value: z.string().optional() })),
    }),
  },
  {
    name: "Timeline",
    description: "Dated events (3–6). layout: vertical, or track (many short events, scrolls sideways). Root level only.",
    props: z.object({
      events: z.array(z.object({ when: z.string(), title: z.string(), detail: z.string().optional() })),
      layout: z.enum(["vertical", "track"]).optional(),
      title: z.string().optional(),
    }),
  },
  {
    name: "StatGrid",
    description:
      "2–4 key figures (value like '23.7%', label, note = source/date). layout: tiles, ribbon (one full colour band), rings (shares of a whole; give pct 0-100 on each). Root level only.",
    props: z.object({
      stats: z.array(z.object({ value: z.string(), label: z.string(), note: z.string().optional(), pct: z.number().optional() })),
      layout: z.enum(["tiles", "ribbon", "rings"]).optional(),
    }),
  },
  {
    name: "Scale",
    description:
      "Compare sizes that differ hugely on a log scale (planets, populations, speeds). items [{label, value (number), display (e.g. '8.8 billion'), highlight}]. Root level only.",
    props: z.object({
      title: z.string(),
      items: z.array(z.object({ label: z.string(), value: z.number(), display: z.string().optional(), highlight: z.boolean().optional() })),
      unit: z.string().optional(),
      log: z.boolean().optional(),
    }),
  },
  {
    name: "RaceChart",
    description:
      "ANIMATED bar chart race: bars re-rank as time moves (play/pause and a scrubber). Use for rankings or growth over time (largest economies, populations, company values). steps = the time labels in order (e.g. years, 6–14 of them); series = one per entity, with values[] the same length as steps (use real numbers from sources; label illustrations). Show up to 8 bars. Root level only.",
    props: z.object({
      title: z.string(),
      steps: z.array(z.string()),
      series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })),
      unit: z.string().optional(),
      source: z.string().optional(),
    }),
  },
  {
    name: "Explorable",
    description:
      "One slider the learner drags to see what changes. outcomes are bands in increasing upTo order, the last upTo >= max, each with a short text. Root level only.",
    props: z.object({
      title: z.string(),
      label: z.string(),
      min: z.number(),
      max: z.number(),
      outcomes: z.array(z.object({ upTo: z.number(), title: z.string().optional(), text: z.string() })),
      unit: z.string().optional(),
      step: z.number().optional(),
      initial: z.number().optional(),
    }),
  },
  {
    name: "Quiz",
    description:
      "ONE graded check. answer = 0-based index. hint nudges after a wrong try; explanation says why. variant: list (default), tiles, truefalse (options [\"True\",\"False\"], answer 0 if true), cloze (question contains ___ for the gap).",
    props: z.object({
      question: z.string(),
      options: z.array(z.string()),
      answer: z.number(),
      hint: z.string(),
      explanation: z.string(),
      variant: z.enum(["list", "tiles", "truefalse", "cloze"]).optional(),
    }),
  },
  {
    name: "Recall",
    description:
      "Free recall check: the learner types what they remember, then compares to the key points. points [{text, key (the keyword to look for)}]. Alternative to Quiz.",
    props: z.object({ prompt: z.string(), points: z.array(z.object({ text: z.string(), key: z.string().optional() })) }),
  },
  {
    name: "FlipCards",
    description: "3–6 quiz cards: the learner thinks of the answer, taps to flip, then marks 'got it' or 'not yet' (front = question or term, back = answer). Alternative to Quiz.",
    props: z.object({ title: z.string(), cards: z.array(z.object({ front: z.string(), back: z.string() })) }),
  },
  {
    name: "MythFact",
    description: "Misconceptions corrected: 2–4 pairs, myth stated plainly then the fact. Alternative to Quiz.",
    props: z.object({ title: z.string(), items: z.array(z.object({ myth: z.string(), fact: z.string() })) }),
  },
  {
    name: "PageTitle",
    description:
      "Opens pages 2+ of a multi-page course lesson instead of LessonHeader (always first child of root there). kicker is a short label such as 'Page 2 · Try it'.",
    props: z.object({ title: z.string(), kicker: z.string().optional(), emoji: z.string().optional() }),
  },
  {
    name: "OpenQuestion",
    description:
      "The learner TYPES an answer in their own words and gets it marked by the tutor. modelAnswer = what a strong answer says (used for marking, shown afterwards). size: short (a sentence) or long (a paragraph). Use for 'explain why', 'what would you do', definitions, calculations.",
    props: z.object({
      question: z.string(),
      modelAnswer: z.string(),
      hint: z.string().optional(),
      size: z.enum(["short", "long"]).optional(),
    }),
  },
  {
    name: "PhotoAnswer",
    description:
      "The learner answers with a PHOTO (a sketch, handwritten working, a diagram, something they made or found) and the tutor looks at it. lookFor = 2–4 things a good answer shows. Use when drawing or showing beats typing.",
    props: z.object({ prompt: z.string(), lookFor: z.array(z.string()), hint: z.string().optional() }),
  },
  {
    name: "Simulation",
    description:
      "A live model the learner plays with: sliders change inputs and outputs recompute instantly. inputs [{key (identifier), label, min, max, step, initial, unit}]. outputs [{label, formula, unit, decimals}] where formula is arithmetic over input keys (+ - * / ^, parentheses, min, max, abs, sqrt, log, exp, round). chart (optional) plots one output across one input: {x: input key, y: output label}. insights [{when: condition like 'rate > 8', text}] appear while true. Use for anything with cause and effect you can calculate (interest, speed, dosage, pricing, physics).",
    props: z.object({
      title: z.string(),
      intro: z.string(),
      inputs: z.array(
        z.object({ key: z.string(), label: z.string(), min: z.number(), max: z.number(), step: z.number().optional(), initial: z.number().optional(), unit: z.string().optional() }),
      ),
      outputs: z.array(z.object({ label: z.string(), formula: z.string(), unit: z.string().optional(), decimals: z.number().optional() })),
      chart: z.object({ x: z.string(), y: z.string() }).optional(),
      insights: z.array(z.object({ when: z.string(), text: z.string() })).optional(),
    }),
  },
  {
    name: "SortGame",
    description:
      "Game: the learner sorts 5–8 items into 2–3 buckets (tap an item, then a bucket), then checks. Each item's bucket must exactly match one bucket name. explain = one sentence after checking.",
    props: z.object({
      title: z.string(),
      buckets: z.array(z.string()),
      items: z.array(z.object({ text: z.string(), bucket: z.string() })),
      explain: z.string().optional(),
    }),
  },
  {
    name: "OrderGame",
    description: "Game: the learner puts 4–6 shuffled steps or events in the right order. items = the CORRECT order (the app shuffles). explain = why that order.",
    props: z.object({ title: z.string(), items: z.array(z.string()), explain: z.string().optional() }),
  },
  {
    name: "MatchGame",
    description: "Game: the learner matches 4–6 pairs (term ↔ meaning, cause ↔ effect, problem ↔ fix) against the clock.",
    props: z.object({ title: z.string(), pairs: z.array(z.object({ left: z.string(), right: z.string() })) }),
  },
  {
    name: "Scenario",
    description:
      "A role-play: the learner makes 2–4 decisions in a realistic situation and sees the consequences. role = who they are. steps [{situation, choices [{label, outcome, score: 0 (poor), 1 (okay) or 2 (best)}]}]. debrief = the lesson in one or two sentences. Great for work, money, health and people skills.",
    props: z.object({
      title: z.string(),
      role: z.string(),
      steps: z.array(z.object({ situation: z.string(), choices: z.array(z.object({ label: z.string(), outcome: z.string(), score: z.number() })) })),
      debrief: z.string(),
    }),
  },
  {
    name: "KeyTerms",
    description: "2–5 key words with plain meanings. variant: glossary or chips.",
    props: z.object({ terms: z.array(z.object({ term: z.string(), meaning: z.string() })), variant: z.enum(["glossary", "chips"]).optional() }),
  },
  {
    name: "Takeaways",
    description: "2–4 short points to remember. variant: checklist or cards.",
    props: z.object({ points: z.array(z.string()), variant: z.enum(["checklist", "cards"]).optional() }),
  },
  {
    name: "NextSteps",
    description:
      "Ends the lesson: 2 prompts the learner can tap, written as they would ask. First applies the idea somewhere new, second goes deeper.",
    props: z.object({ prompts: z.array(z.string()) }),
  },
];

// Built-in OpenUI components offered to the model for lessons. The renderer
// still knows every OpenUI component, so older lessons keep working.
export const LESSON_BUILTINS = [
  "Stack",
  "Card",
  "CardHeader",
  "TextContent",
  "Callout",
  "TextCallout",
  "CodeBlock",
  "Table",
  "Col",
  "BarChart",
  "LineChart",
  "HorizontalBarChart",
  "PieChart",
  "Series",
  "Tabs",
  "TabItem",
  "Accordion",
  "AccordionItem",
  "Separator",
  "Button",
  "Buttons",
];
