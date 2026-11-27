"""Tiny declarative schema used for both prompting and validation.

A field knows how to describe itself to a model (`describe`) and how to
coerce whatever a model returned into a safe value (`clean`). Numbers are
clamped, strings trimmed at a word boundary, enums matched loosely, lists
cut to size. Only truly unusable input raises `SchemaError`, which triggers
a targeted re-ask.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

MISSING = object()


class SchemaError(ValueError):
    pass


def trim_words(text: str, limit: int) -> str:
    """Shorten to `limit` chars, keeping whole sentences when at least one fits."""
    text = re.sub(r"\s+", " ", str(text)).strip()
    if len(text) <= limit:
        return text
    kept = ""
    for sentence in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", text):
        candidate = f"{kept} {sentence}".strip()
        if len(candidate) > limit:
            break
        kept = candidate
    if kept:
        return kept
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",;:-–— ")
    return cut + "…"


@dataclass
class Field:
    desc: str = ""
    default: Any = MISSING
    optional: bool = False

    def type_hint(self) -> str:  # pragma: no cover - overridden
        return "any"

    def describe(self) -> str:
        hint = self.type_hint()
        extra = f" — {self.desc}" if self.desc else ""
        # Scalar defaults are a safety net, not a choice for the model: present those
        # fields as required so the model always sets them from the scene's goal.
        opt = "?" if (self.optional or callable(self.default)) else ""
        return f"{opt}{hint}{extra}"

    def clean(self, value: Any, path: str) -> Any:  # pragma: no cover
        return value

    def resolve(self, value: Any, path: str) -> Any:
        if value is None or value == "" or value is MISSING:
            if self.default is not MISSING:
                return self.default() if callable(self.default) else self.default
            if self.optional:
                return None
            raise SchemaError(f"{path} is required")
        return self.clean(value, path)


@dataclass
class Str(Field):
    max: int = 80

    def type_hint(self) -> str:
        return f"string (max {self.max} chars)"

    def clean(self, value, path):
        if isinstance(value, (list, tuple)):
            value = " ".join(str(v) for v in value)
        text = trim_words(str(value), self.max)
        if not text and not self.optional and self.default is MISSING:
            raise SchemaError(f"{path} is empty")
        return text


@dataclass
class Tex(Field):
    max: int = 160

    def type_hint(self) -> str:
        return "LaTeX string (KaTeX, no $ delimiters)"

    def clean(self, value, path):
        text = str(value).strip().strip("$").strip()
        text = re.sub(r"^\\\[|\\\]$|^\\\(|\\\)$", "", text).strip()
        if len(text) > self.max:
            raise SchemaError(f"{path} is too long ({len(text)} > {self.max} chars)")
        if not text:
            raise SchemaError(f"{path} is empty")
        return text


@dataclass
class Num(Field):
    lo: float = 0
    hi: float = 1
    integer: bool = False
    unit: str = ""

    def type_hint(self) -> str:
        unit = f" {self.unit}" if self.unit else ""
        kind = "integer" if self.integer else "number"
        return f"{kind} in [{self.lo:g}, {self.hi:g}]{unit}"

    def clean(self, value, path):
        if isinstance(value, str):
            match = re.search(r"-?\d+(?:\.\d+)?", value)
            if not match:
                raise SchemaError(f"{path} must be a number")
            value = float(match.group())
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise SchemaError(f"{path} must be a number")
        value = max(self.lo, min(self.hi, float(value)))
        return int(round(value)) if self.integer else round(value, 4)


@dataclass
class Bool(Field):
    def type_hint(self) -> str:
        return "boolean"

    def clean(self, value, path):
        if isinstance(value, str):
            return value.strip().lower() in ("true", "yes", "1")
        return bool(value)


@dataclass
class Enum(Field):
    options: tuple = ()

    def type_hint(self) -> str:
        return " | ".join(f'"{o}"' for o in self.options)

    def clean(self, value, path):
        text = str(value).strip().lower().replace(" ", "_").replace("-", "_")
        for option in self.options:
            if text == option.lower():
                return option
        for option in self.options:
            if option.lower() in text or text in option.lower():
                return option
        if self.default is not MISSING:
            return self.default
        raise SchemaError(f"{path} must be one of {', '.join(self.options)}")


@dataclass
class Obj(Field):
    fields: dict = field(default_factory=dict)

    def type_hint(self) -> str:
        inner = ", ".join(f"{k}: {f.describe()}" for k, f in self.fields.items())
        return "{ " + inner + " }"

    def clean(self, value, path):
        if not isinstance(value, dict):
            raise SchemaError(f"{path} must be an object")
        return {k: f.resolve(value.get(k), f"{path}.{k}") for k, f in self.fields.items()}


@dataclass
class List(Field):
    item: Field = field(default_factory=Str)
    lo: int = 0
    hi: int = 6

    def type_hint(self) -> str:
        return f"array of {self.lo}-{self.hi} × {self.item.type_hint()}"

    def clean(self, value, path):
        if isinstance(value, dict):
            value = list(value.values())
        if not isinstance(value, (list, tuple)):
            value = [value]
        out = []
        dropped: list[str] = []
        for i, item in enumerate(value):
            try:
                cleaned = self.item.resolve(item, f"{path}[{i}]")
            except SchemaError as exc:
                dropped.append(str(exc))
                continue  # drop bad items; the min-length check below decides
            if cleaned is not None:
                out.append(cleaned)
        out = out[: self.hi]
        if len(out) < self.lo:
            why = f"; dropped: {dropped[0]}" if dropped else ""
            raise SchemaError(f"{path} needs at least {self.lo} valid items (got {len(out)}){why}")
        return out
