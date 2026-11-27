"""Model-agnostic JSON completion over NVIDIA's OpenAI-compatible API.

The pipeline only ever asks a model for small JSON objects. This client
leases a key from the pool, calls the model, strips reasoning blocks and
fences, extracts the first JSON object, and repairs the common mistakes
weaker models make (trailing commas, smart quotes, comments). Failures move
to another key automatically.
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

from openai import OpenAI

from src.events import log
from src.llm.keypool import BASE_URL, KeyPool

MODELS = {
    "nemotron-ultra": {
        "id": "nvidia/nemotron-3-ultra-550b-a55b",
        "label": "Nemotron 3 Ultra",
        "extra": {"chat_template_kwargs": {"enable_thinking": False}},
    },
    "kimi": {
        "id": "moonshotai/kimi-k3.1-pro",
        "label": "Kimi K3.1 Pro",
        "extra": {},
    },
    "nemotron-lightning": {
        "id": "nvidia/nemotron-3.5-lightning-30b-a3b",
        "label": "Nemotron 3.5 Lightning",
        "extra": {},
    },
}
DEFAULT_MODEL = "nemotron-ultra"

THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _trace(task: str, attempt: int, key: str, prompt: str, response: str) -> None:
    """Keep every prompt/response pair of a run for debugging (SM_TRACE_DIR)."""
    folder = os.getenv("SM_TRACE_DIR")
    if not folder:
        return
    try:
        path = Path(folder)
        path.mkdir(parents=True, exist_ok=True)
        name = re.sub(r"[^a-z0-9]+", "-", task.lower()).strip("-") or "call"
        (path / f"{name}-a{attempt}.txt").write_text(
            f"# {task} · attempt {attempt} · {key}\n\n## prompt\n{prompt}\n\n## response\n{response}\n", encoding="utf-8")
    except OSError:
        pass


class LLMError(RuntimeError):
    pass


def _extract_json(text: str) -> Any:
    text = THINK_RE.sub("", text or "").strip()
    if "</think>" in text:
        text = text.split("</think>", 1)[1]
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    start = text.find("{")
    if start < 0:
        raise ValueError("no JSON object in response")
    # Walk the object with a bracket stack. Models sometimes drop or swap a closer
    # (e.g. `]}]}` for `}]}`); insert the missing closers so the rest is not lost.
    pairs = {"{": "}", "[": "]"}
    stack: list[str] = []
    out: list[str] = []
    in_str = esc = False
    done = False
    for ch in text[start:]:
        if in_str:
            out.append(ch)
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in pairs:
            stack.append(pairs[ch])
        elif ch in "}]":
            if ch not in stack:
                continue  # stray closer
            while stack and stack[-1] != ch:
                out.append(stack.pop())
            stack.pop()
            out.append(ch)
            if not stack:
                done = True
                break
            continue
        out.append(ch)
    if not done:
        # Only closers missing at the very end (a common early stop): close them.
        tail = "".join(out).rstrip()
        if in_str or not stack or tail.endswith((":", ",")):
            raise ValueError("unterminated JSON object (response was cut off)")
        out.extend(reversed(stack))
    blob = "".join(out)
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        repaired = (
            blob.replace("“", '"').replace("”", '"').replace("’", "'")
        )
        repaired = re.sub(r"//[^\n\"]*$", "", repaired, flags=re.MULTILINE)
        repaired = re.sub(r",\s*([}\]])", r"\1", repaired)
        return json.loads(repaired)


class LLM:
    def __init__(self, pool: KeyPool, model: str = DEFAULT_MODEL):
        if model not in MODELS:
            raise LLMError(f"Unknown model '{model}'. Options: {', '.join(MODELS)}")
        self.pool = pool
        self.model_key = model
        self.model = MODELS[model]
        self._clients: dict[str, OpenAI] = {}

    def _client(self, key: str) -> OpenAI:
        if key not in self._clients:
            self._clients[key] = OpenAI(base_url=BASE_URL, api_key=key, timeout=240, max_retries=0)
        return self._clients[key]

    def json(
        self,
        system: str,
        user: str,
        *,
        task: str,
        max_tokens: int = 4096,
        temperature: float = 0.4,
        attempts: int = 3,
    ) -> tuple[dict, dict]:
        """Return (parsed_json, meta). Retries on another key on any failure."""
        tried: set[str] = set()
        last: Exception | None = None
        for attempt in range(1, attempts + 1):
            slot = self.pool.acquire(exclude=tried)
            tried.add(slot.name)
            started = time.time()
            error: Exception | None = None
            try:
                response = self._client(slot.key).chat.completions.create(
                    model=self.model["id"],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    extra_body=self.model["extra"] or None,
                )
                choice = response.choices[0]
                text = choice.message.content or ""
                _trace(task, attempt, slot.label, user, text)
                if not text.strip():
                    raise ValueError("empty response")
                data = _extract_json(text)
                if not isinstance(data, dict):
                    raise ValueError("response JSON is not an object")
                usage = getattr(response, "usage", None)
                meta = {
                    "key": slot.label,
                    "seconds": round(time.time() - started, 1),
                    "attempt": attempt,
                    "tokens": getattr(usage, "total_tokens", None),
                }
                return data, meta
            except (ValueError, json.JSONDecodeError) as exc:
                # The key is fine; the model's output was not usable.
                last = exc
                log(task, f"Unusable output on {slot.label} (attempt {attempt}): {exc}", "warn")
            except Exception as exc:  # noqa: BLE001 - network/auth/quota
                error = exc
                last = exc
                log(task, f"{slot.label} failed (attempt {attempt}): {str(exc)[:160]}", "warn")
            finally:
                self.pool.release(slot, error)
        raise LLMError(f"{task}: all attempts failed ({last})")
