// A tiny, safe expression evaluator for Simulation components.
// Supports numbers, variables, + - * / % ^, parentheses, comparisons (< <= > >= == !=),
// and/or/not (also && || !), and the functions min, max, abs, sqrt, log, ln, log10, exp, round, floor, ceil, pow, clamp.
// No property access, no calls to anything else: model-written formulas cannot run code.

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  sqrt: Math.sqrt,
  log: Math.log,
  ln: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  floor: Math.floor,
  ceil: Math.ceil,
  pow: Math.pow,
  clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
    if (num) {
      out.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (id) {
      const w = id[0];
      if (w === "and") out.push({ t: "op", v: "&&" });
      else if (w === "or") out.push({ t: "op", v: "||" });
      else if (w === "not") out.push({ t: "op", v: "!" });
      else out.push({ t: "id", v: w });
      i += w.length;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (["<=", ">=", "==", "!=", "&&", "||", "**"].includes(two)) {
      out.push({ t: "op", v: two === "**" ? "^" : two });
      i += 2;
      continue;
    }
    if ("+-*/%^()<>!,=".includes(c)) {
      out.push({ t: "op", v: c === "=" ? "==" : c });
      i++;
      continue;
    }
    throw new Error(`Unexpected "${c}"`);
  }
  return out;
}

type Node =
  | { k: "num"; v: number }
  | { k: "var"; v: string }
  | { k: "un"; op: string; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "call"; f: string; args: Node[] };

const BP: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6, "^": 8 };

function parse(tokens: Tok[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (v: string) => {
    const t = next();
    if (!t || t.t !== "op" || t.v !== v) throw new Error(`Expected ${v}`);
  };
  const prefix = (): Node => {
    const t = next();
    if (!t) throw new Error("Unexpected end");
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "id") {
      const p = peek();
      if (p && p.t === "op" && p.v === "(") {
        next();
        const args: Node[] = [];
        if (!(peek()?.t === "op" && peek()?.v === ")")) {
          for (;;) {
            args.push(expr(0));
            if (peek()?.t === "op" && peek()?.v === ",") {
              next();
              continue;
            }
            break;
          }
        }
        expect(")");
        if (!FUNCS[t.v.toLowerCase()]) throw new Error(`Unknown function ${t.v}`);
        return { k: "call", f: t.v.toLowerCase(), args };
      }
      return { k: "var", v: t.v };
    }
    if (t.v === "(") {
      const e = expr(0);
      expect(")");
      return e;
    }
    if (t.v === "-" || t.v === "+") return { k: "un", op: t.v, a: expr(7) };
    if (t.v === "!") return { k: "un", op: "!", a: expr(7) };
    throw new Error(`Unexpected ${t.v}`);
  };
  const expr = (minBp: number): Node => {
    let left = prefix();
    for (;;) {
      const t = peek();
      if (!t || t.t !== "op" || !(t.v in BP)) break;
      const bp = BP[t.v];
      if (bp < minBp) break;
      next();
      // ^ is right-associative
      const right = expr(t.v === "^" ? bp : bp + 1);
      left = { k: "bin", op: t.v, a: left, b: right };
    }
    return left;
  };
  const tree = expr(0);
  if (pos < tokens.length) throw new Error("Unexpected input");
  return tree;
}

function run(n: Node, vars: Record<string, number>): number {
  switch (n.k) {
    case "num":
      return n.v;
    case "var": {
      if (n.v in vars) return vars[n.v];
      const lower = n.v.toLowerCase();
      if (lower in CONSTS) return CONSTS[lower];
      // Tolerate case differences between formula and input keys.
      const key = Object.keys(vars).find((k) => k.toLowerCase() === lower);
      if (key) return vars[key];
      throw new Error(`Unknown value ${n.v}`);
    }
    case "un": {
      const a = run(n.a, vars);
      return n.op === "-" ? -a : n.op === "!" ? Number(!a) : a;
    }
    case "call":
      return FUNCS[n.f](...n.args.map((x) => run(x, vars)));
    case "bin": {
      const a = run(n.a, vars);
      if (n.op === "&&") return a ? run(n.b, vars) : 0;
      if (n.op === "||") return a ? a : run(n.b, vars);
      const b = run(n.b, vars);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "%": return a % b;
        case "^": return Math.pow(a, b);
        case "<": return Number(a < b);
        case "<=": return Number(a <= b);
        case ">": return Number(a > b);
        case ">=": return Number(a >= b);
        case "==": return Number(Math.abs(a - b) < 1e-9);
        case "!=": return Number(Math.abs(a - b) >= 1e-9);
      }
    }
  }
  return NaN;
}

const cache = new Map<string, Node | Error>();

/** Compile once, evaluate many times. Returns NaN when the formula is invalid. */
export function evaluate(formula: string, vars: Record<string, number>): number {
  let tree = cache.get(formula);
  if (!tree) {
    try {
      tree = parse(tokenize(formula));
    } catch (e) {
      tree = e instanceof Error ? e : new Error("Invalid formula");
    }
    cache.set(formula, tree);
  }
  if (tree instanceof Error) return NaN;
  try {
    return run(tree, vars);
  } catch {
    return NaN;
  }
}

/** Why a formula can't be used, or null when it's fine. */
export function formulaError(formula: string, vars: Record<string, number>): string | null {
  try {
    const v = run(parse(tokenize(formula)), vars);
    return Number.isFinite(v) ? null : "gives no number at these values";
  } catch (e) {
    return e instanceof Error ? e.message : "invalid";
  }
}
