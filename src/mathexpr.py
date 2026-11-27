"""Safe parser for plot expressions like `0.5*x^2 - sin(2x)`.

Mirrors remotion_project/src/lesson/lib/expr.ts so anything accepted here
renders identically there. Supports + - * / ^, unary minus, implicit
multiplication (2x, 3(x+1), x sin(x)), constants pi and e, and the
functions below.
"""

from __future__ import annotations

import math
import re

FUNCS = {
    "sin": math.sin, "cos": math.cos, "tan": math.tan,
    "asin": math.asin, "acos": math.acos, "atan": math.atan,
    "sinh": math.sinh, "cosh": math.cosh, "tanh": math.tanh,
    "exp": math.exp, "ln": math.log, "log": math.log10, "sqrt": math.sqrt,
    "abs": abs, "floor": math.floor, "ceil": math.ceil,
}
CONSTS = {"pi": math.pi, "e": math.e}
TOKEN_RE = re.compile(r"\s*(\d+\.?\d*|\.\d+|[A-Za-z_]+|\*\*|[-+*/^(),])")


def normalize(expr: str) -> str:
    expr = expr.strip()
    expr = re.sub(r"^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*", "", expr)
    expr = expr.replace("**", "^").replace("·", "*").replace("×", "*").replace("−", "-")
    expr = expr.replace("π", "pi").replace("Math.", "")
    return expr


def tokenize(expr: str) -> list[str]:
    pos, out = 0, []
    expr = normalize(expr)
    while pos < len(expr):
        match = TOKEN_RE.match(expr, pos)
        if not match:
            raise ValueError(f"unexpected character '{expr[pos]}'")
        tok = match.group(1)
        pos = match.end()
        if re.fullmatch(r"[A-Za-z_]+", tok) and tok not in FUNCS and tok not in CONSTS and tok != "x":
            # split identifiers like "xsin" or "pix" into known pieces
            parts = re.findall(r"sinh|cosh|tanh|asin|acos|atan|sin|cos|tan|exp|ln|log|sqrt|abs|floor|ceil|pi|e|x", tok)
            if "".join(parts) != tok:
                raise ValueError(f"unknown name '{tok}'")
            out.extend(parts)
        else:
            out.append(tok)
        if len(out) > 400:
            raise ValueError("expression too long")
    return out


class _Parser:
    def __init__(self, tokens: list[str]):
        self.t = tokens
        self.i = 0

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def take(self):
        tok = self.peek()
        self.i += 1
        return tok

    def parse(self):
        node = self.expr()
        if self.peek() is not None:
            raise ValueError(f"unexpected '{self.peek()}'")
        return node

    def expr(self):
        node = self.term()
        while self.peek() in ("+", "-"):
            op = self.take()
            node = (op, node, self.term())
        return node

    def starts_atom(self, tok):
        return tok is not None and (tok == "(" or tok == "x" or tok in FUNCS or tok in CONSTS or tok[0].isdigit() or tok[0] == ".")

    def term(self):
        node = self.unary()
        while True:
            tok = self.peek()
            if tok in ("*", "/"):
                self.take()
                node = (tok, node, self.unary())
            elif self.starts_atom(tok):  # implicit multiplication
                node = ("*", node, self.power())
            else:
                return node

    def unary(self):
        if self.peek() == "-":
            self.take()
            return ("neg", self.unary())
        if self.peek() == "+":
            self.take()
            return self.unary()
        return self.power()

    def power(self):
        base = self.atom()
        if self.peek() == "^":
            self.take()
            return ("^", base, self.unary())
        return base

    def atom(self):
        tok = self.take()
        if tok is None:
            raise ValueError("unexpected end of expression")
        if tok == "(":
            node = self.expr()
            if self.take() != ")":
                raise ValueError("missing ')'")
            return node
        if tok in FUNCS:
            if self.peek() == "(":
                self.take()
                arg = self.expr()
                if self.take() != ")":
                    raise ValueError("missing ')'")
            else:
                arg = self.power()
            return ("fn", tok, arg)
        if tok == "x":
            return ("x",)
        if tok in CONSTS:
            return ("num", CONSTS[tok])
        try:
            return ("num", float(tok))
        except ValueError:
            raise ValueError(f"unexpected '{tok}'") from None


def compile_expr(expr: str):
    tree = _Parser(tokenize(expr)).parse()

    def ev(node, x):
        kind = node[0]
        if kind == "num":
            return node[1]
        if kind == "x":
            return x
        if kind == "neg":
            return -ev(node[1], x)
        if kind == "fn":
            return FUNCS[node[1]](ev(node[2], x))
        a, b = ev(node[1], x), ev(node[2], x)
        if kind == "+":
            return a + b
        if kind == "-":
            return a - b
        if kind == "*":
            return a * b
        if kind == "/":
            return a / b
        return a ** b

    def f(x: float) -> float | None:
        try:
            value = ev(tree, x)
            if isinstance(value, complex) or value != value or abs(value) > 1e9:
                return None
            return float(value)
        except (ValueError, ZeroDivisionError, OverflowError):
            return None

    return f


def check(expr: str, lo: float, hi: float) -> str:
    """Return a normalized expression or raise ValueError if it cannot plot."""
    f = compile_expr(expr)
    samples = [f(lo + (hi - lo) * i / 60) for i in range(61)]
    if sum(1 for s in samples if s is not None) < 10:
        raise ValueError(f"'{expr}' is undefined over x in [{lo}, {hi}]")
    return normalize(expr)
