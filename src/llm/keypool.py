"""NVIDIA API key pool.

Reads NVIDIA_API_KEY and NVIDIA_API_KEY_1..N from the environment, checks
each key individually, and hands out the healthiest, least-busy key for each
request. A key that fails (auth, quota, network) is put on cooldown and the
caller retries on another key, so parallel work keeps going while any key is
alive.
"""

from __future__ import annotations

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from dotenv import load_dotenv

from src.events import emit

BASE_URL = "https://integrate.api.nvidia.com/v1"
COOLDOWN_SECONDS = {"auth": 3600.0, "quota": 45.0, "error": 15.0}


@dataclass
class KeySlot:
    name: str
    key: str
    healthy: bool = True
    checked: bool = False
    latency: float | None = None
    in_flight: int = 0
    calls: int = 0
    failures: int = 0
    cooldown_until: float = 0.0
    last_error: str = ""
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    @property
    def label(self) -> str:
        return self.name.replace("NVIDIA_API_KEY", "key").replace("_", " ").strip() or "key"

    def available(self, now: float) -> bool:
        return self.healthy and now >= self.cooldown_until

    def public(self) -> dict:
        return {
            "name": self.label,
            "hint": f"…{self.key[-4:]}",
            "healthy": self.healthy,
            "checked": self.checked,
            "latency": self.latency,
            "in_flight": self.in_flight,
            "calls": self.calls,
            "failures": self.failures,
            "cooling": max(0.0, round(self.cooldown_until - time.time(), 1)),
            "error": self.last_error,
        }


def classify_error(exc: Exception) -> str:
    text = str(exc).lower()
    status = getattr(exc, "status_code", None)
    if status in (401, 403) or "unauthorized" in text or "invalid api key" in text:
        return "auth"
    if status == 429 or "rate limit" in text or "too many requests" in text or "quota" in text:
        return "quota"
    return "error"


class KeyPool:
    def __init__(self, keys: list[tuple[str, str]]):
        self.slots = [KeySlot(name, key) for name, key in keys]
        self._cv = threading.Condition()

    @classmethod
    def from_env(cls) -> "KeyPool":
        load_dotenv(override=False)
        found: list[tuple[str, str]] = []
        seen: set[str] = set()
        names = ["NVIDIA_API_KEY"] + [f"NVIDIA_API_KEY_{i}" for i in range(1, 17)]
        for name in names:
            value = (os.getenv(name) or "").strip()
            if value and value not in seen:
                seen.add(value)
                found.append((name, value))
        if not found:
            raise RuntimeError(
                "No NVIDIA keys found. Add NVIDIA_API_KEY_1 (and _2, _3, ...) to .env"
            )
        return cls(found)

    # ------------------------------------------------------------------ health
    def health_check(self, model: str) -> list[dict]:
        """Ping every key in parallel with a tiny request."""
        from openai import OpenAI

        def ping(slot: KeySlot) -> None:
            started = time.time()
            try:
                client = OpenAI(base_url=BASE_URL, api_key=slot.key, timeout=45, max_retries=0)
                client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": "Reply with: ok"}],
                    max_tokens=16,
                )
                slot.healthy = True
                slot.latency = round(time.time() - started, 2)
                slot.last_error = ""
            except Exception as exc:  # noqa: BLE001
                kind = classify_error(exc)
                slot.healthy = kind != "auth"
                if kind != "auth":
                    slot.cooldown_until = time.time() + COOLDOWN_SECONDS[kind]
                slot.last_error = f"{kind}: {str(exc)[:120]}"
            slot.checked = True
            emit("key", **slot.public())

        with ThreadPoolExecutor(max_workers=len(self.slots)) as pool:
            list(pool.map(ping, self.slots))
        return [s.public() for s in self.slots]

    @property
    def healthy_count(self) -> int:
        return sum(1 for s in self.slots if s.healthy)

    # ----------------------------------------------------------------- leasing
    def acquire(self, exclude: set[str] | None = None, timeout: float = 120.0) -> KeySlot:
        exclude = exclude or set()
        deadline = time.time() + timeout
        with self._cv:
            while True:
                now = time.time()
                candidates = [s for s in self.slots if s.available(now) and s.name not in exclude]
                if not candidates:
                    # Allow reuse of excluded keys rather than stalling forever.
                    candidates = [s for s in self.slots if s.available(now)]
                if candidates:
                    slot = min(candidates, key=lambda s: (s.in_flight, s.failures, s.calls))
                    slot.in_flight += 1
                    slot.calls += 1
                    emit("key", **slot.public())
                    return slot
                if not any(s.healthy for s in self.slots):
                    raise RuntimeError("All NVIDIA keys are rejected (auth). Check .env")
                if now >= deadline:
                    raise RuntimeError("No NVIDIA key became available in time")
                wait_for = min(
                    [max(0.2, s.cooldown_until - now) for s in self.slots if s.healthy] or [1.0]
                )
                self._cv.wait(timeout=min(wait_for, 5.0))

    def release(self, slot: KeySlot, error: Exception | None = None) -> None:
        with self._cv:
            slot.in_flight = max(0, slot.in_flight - 1)
            if error is not None:
                kind = classify_error(error)
                slot.failures += 1
                slot.last_error = f"{kind}: {str(error)[:120]}"
                if kind == "auth":
                    slot.healthy = False
                else:
                    slot.cooldown_until = time.time() + COOLDOWN_SECONDS[kind]
            emit("key", **slot.public())
            self._cv.notify_all()
