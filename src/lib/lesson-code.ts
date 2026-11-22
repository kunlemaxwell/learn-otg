// Helpers that read an openui-lang lesson without running it: split statements,
// pull out the parts that matter for memory recaps and reusable components.

export type Statement = { name: string; expr: string };

export function extractCode(text: string): string | null {
  const start = text.indexOf("```");
  if (start === -1) return /^\s*root\s*=/.test(text) ? text : null;
  const after = text.slice(start + 3);
  const nl = after.indexOf("\n");
  const body = after.slice(nl + 1);
  const end = body.indexOf("```");
  return end === -1 ? body : body.slice(0, end);
}

export function chatLine(text: string): string {
  const i = text.indexOf("```");
  return (i === -1 ? text : text.slice(0, i)).trim();
}

export function parseStatements(code: string): Statement[] {
  const out: Statement[] = [];
  let current: Statement | null = null;
  for (const line of code.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      current = { name: m[1], expr: m[2] };
      out.push(current);
    } else if (current && line.trim()) {
      current.expr += "\n" + line;
    }
  }
  return out;
}

const STRING = /"((?:[^"\\]|\\.)*)"/g;
const unq = (s: string) => s.replace(/\\"/g, '"').replace(/\\n/g, " ");

function strings(expr: string): string[] {
  return [...expr.matchAll(STRING)].map((m) => unq(m[1]));
}

export function lessonTitle(code: string | null): string | null {
  if (!code) return null;
  const m =
    code.match(/LessonHeader\(\s*"((?:[^"\\]|\\.)+)"/) ?? code.match(/TextContent\(\s*"((?:[^"\\]|\\.)+)"\s*,\s*"large-heavy"/);
  return m ? unq(m[1]) : null;
}

/** ~100-token recap of a lesson: title, big idea, what was covered, quiz and answer. */
export function recapLesson(text: string): string {
  const code = extractCode(text);
  if (!code) return chatLine(text).slice(0, 300);
  const st = parseStatements(code);
  const title = lessonTitle(code) ?? "Lesson";
  const parts = [`"${title}"`];
  const idea = st.find((s) => s.expr.startsWith("BigIdea("));
  if (idea) parts.push(`Big idea: ${(strings(idea.expr)[0] ?? "").replace(/[.\s]+$/, "")}`);
  const covered: string[] = [];
  for (const s of st) {
    if (/^StepsItem\(|^TabItem\(|^AccordionItem\(|^CardHeader\(/.test(s.expr)) {
      const str = strings(s.expr);
      const label = s.expr.startsWith("TabItem(") || s.expr.startsWith("AccordionItem(") ? str[1] : str[0];
      if (label) covered.push(label);
    }
    if (/^(BarChart|LineChart|HorizontalBarChart|PieChart)\(/.test(s.expr)) covered.push(`a ${s.expr.split("(")[0]}`);
    if (/^(Flow|Timeline|Compare|StatGrid)\(/.test(s.expr)) {
      for (const m of s.expr.matchAll(/(?:title|label):\s*"((?:[^"\\]|\\.)*)"/g)) covered.push(unq(m[1]));
    }
  }
  if (covered.length) parts.push(`Covered: ${[...new Set(covered)].slice(0, 8).join("; ")}`);
  const quiz = st.find((s) => s.expr.startsWith("Quiz("));
  if (quiz) {
    const str = strings(quiz.expr);
    const answer = Number(quiz.expr.match(/\]\s*,\s*(\d+)/)?.[1] ?? -1);
    const options = quiz.expr.match(/\[([^\]]*)\]/)?.[1];
    const opts = options ? strings(options) : [];
    parts.push(`Quiz: ${str[0]} → ${opts[answer] ?? "?"}`);
  }
  return parts.map((p) => p.replace(/[.\s]+$/, "")).join(". ") + ".";
}

/** Statements reachable from `name` (the subtree of one lesson section). */
export function subtree(st: Statement[], name: string): Statement[] {
  const byName = new Map(st.map((s) => [s.name, s]));
  const seen = new Set<string>();
  const order: Statement[] = [];
  const visit = (n: string) => {
    if (seen.has(n)) return;
    const s = byName.get(n);
    if (!s) return;
    seen.add(n);
    order.push(s);
    for (const ref of s.expr.replace(STRING, '""').match(/\b[a-z_][A-Za-z0-9_]*\b/g) ?? []) {
      if (byName.has(ref) && ref !== n) visit(ref);
    }
  };
  visit(name);
  return order;
}

export function componentKinds(st: Statement[]): string[] {
  const kinds: string[] = [];
  for (const s of st) {
    for (const m of s.expr.replace(STRING, '""').matchAll(/\b([A-Z][A-Za-z]+)\(/g)) kinds.push(m[1]);
  }
  return kinds;
}

export function rootChildren(st: Statement[]): string[] {
  const root = st.find((s) => s.name === "root");
  const inner = root?.expr.match(/Stack\(\s*\[([^\]]*)\]/)?.[1] ?? "";
  return inner
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^[a-z_][A-Za-z0-9_]*$/.test(x));
}

export const MOOD_NAMES = ["forest", "sun", "lagoon", "berry", "clay", "graphite"] as const;

/** The colour mood a lesson chose in its LessonHeader (the whole lesson uses it). */
export function moodOf(code: string | null | undefined): string {
  if (!code) return "forest";
  const header = code.match(/LessonHeader\(([^\n]*)/)?.[1] ?? "";
  const m = header.match(/"(forest|sun|lagoon|berry|clay|graphite)"/);
  return m ? m[1] : "forest";
}

/** Moods and opener variants of the last lessons in a chat, so the next one can differ. */
export function recentLook(texts: string[]): { mood: string; variant: string }[] {
  const out: { mood: string; variant: string }[] = [];
  for (const t of texts) {
    const code = extractCode(t);
    if (!code || !/LessonHeader\(/.test(code)) continue;
    const header = code.match(/LessonHeader\(([^\n]*)/)?.[1] ?? "";
    out.push({ mood: moodOf(code), variant: header.match(/"(question|numeral|spotlight|split)"/)?.[1] ?? "question" });
  }
  return out.slice(-2);
}

/** OpenUI calls are positional; Python-style named arguments cause silent missing components. */
export function hasNamedArguments(text: string): boolean {
  const code = extractCode(text);
  if(!code)return false;
  const withoutStrings=code.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,'""');
  return /(?:\(|,)\s*[A-Za-z_]\w*\s*=/.test(withoutStrings);
}
