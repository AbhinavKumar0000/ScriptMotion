// Safe expression evaluator for plots. Mirrors src/mathexpr.py.
type Node =
  | { k: "num"; v: number }
  | { k: "x" }
  | { k: "neg"; a: Node }
  | { k: "fn"; f: string; a: Node }
  | { k: "op"; op: string; a: Node; b: Node };

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, ln: Math.log, log: Math.log10,
  sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const NAME_PARTS = /sinh|cosh|tanh|asin|acos|atan|sin|cos|tan|exp|ln|log|sqrt|abs|floor|ceil|pi|e|x/g;

const normalize = (s: string) =>
  s.trim()
    .replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*/, "")
    .replace(/\*\*/g, "^").replace(/[·×]/g, "*").replace(/−/g, "-").replace(/π/g, "pi").replace(/Math\./g, "");

const tokenize = (src: string): string[] => {
  const s = normalize(src);
  const re = /\s*(\d+\.?\d*|\.\d+|[A-Za-z_]+|[-+*/^(),])/y;
  const out: string[] = [];
  let pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) throw new Error(`bad char ${s[pos]}`);
    pos = re.lastIndex;
    const t = m[1];
    if (/^[A-Za-z_]+$/.test(t) && !(t in FUNCS) && !(t in CONSTS) && t !== "x") {
      const parts = t.match(NAME_PARTS) || [];
      if (parts.join("") !== t) throw new Error(`unknown ${t}`);
      out.push(...parts);
    } else out.push(t);
  }
  return out;
};

export const compile = (src: string): ((x: number) => number | null) => {
  const t = tokenize(src);
  let i = 0;
  const peek = () => t[i];
  const take = () => t[i++];
  const startsAtom = (k?: string) =>
    k !== undefined && (k === "(" || k === "x" || k in FUNCS || k in CONSTS || /^[\d.]/.test(k));

  const expr = (): Node => {
    let n = term();
    while (peek() === "+" || peek() === "-") {
      const op = take();
      n = { k: "op", op, a: n, b: term() };
    }
    return n;
  };
  const term = (): Node => {
    let n = unary();
    for (;;) {
      const k = peek();
      if (k === "*" || k === "/") {
        take();
        n = { k: "op", op: k, a: n, b: unary() };
      } else if (startsAtom(k)) n = { k: "op", op: "*", a: n, b: power() };
      else return n;
    }
  };
  const unary = (): Node => {
    if (peek() === "-") { take(); return { k: "neg", a: unary() }; }
    if (peek() === "+") { take(); return unary(); }
    return power();
  };
  const power = (): Node => {
    const base = atom();
    if (peek() === "^") { take(); return { k: "op", op: "^", a: base, b: unary() }; }
    return base;
  };
  const atom = (): Node => {
    const k = take();
    if (k === undefined) throw new Error("end");
    if (k === "(") { const n = expr(); take(); return n; }
    if (k in FUNCS) {
      if (peek() === "(") { take(); const a = expr(); take(); return { k: "fn", f: k, a }; }
      return { k: "fn", f: k, a: power() };
    }
    if (k === "x") return { k: "x" };
    if (k in CONSTS) return { k: "num", v: CONSTS[k] };
    return { k: "num", v: parseFloat(k) };
  };

  const tree = expr();
  const ev = (n: Node, x: number): number => {
    switch (n.k) {
      case "num": return n.v;
      case "x": return x;
      case "neg": return -ev(n.a, x);
      case "fn": return FUNCS[n.f](ev(n.a, x));
      case "op": {
        const a = ev(n.a, x), b = ev(n.b, x);
        return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : n.op === "/" ? a / b : Math.pow(a, b);
      }
    }
  };
  return (x: number) => {
    const v = ev(tree, x);
    return Number.isFinite(v) && Math.abs(v) < 1e9 ? v : null;
  };
};
