"""Structured pipeline events.

Every stage reports progress through `emit`. In the CLI the events print as
readable log lines; when the web studio runs the pipeline (SM_EVENTS=1) each
event is also written as one JSON line prefixed with `@@EVENT ` so the server
can drive the pipeline graph without parsing free text.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time

_lock = threading.Lock()
_started = time.time()
PREFIX = "@@EVENT "


def _structured() -> bool:
    return os.getenv("SM_EVENTS") == "1"


def emit(event_type: str, **payload) -> None:
    event = {"type": event_type, "t": round(time.time() - _started, 2), **payload}
    with _lock:
        if _structured():
            sys.stdout.write(PREFIX + json.dumps(event, ensure_ascii=False, default=str) + "\n")
            sys.stdout.flush()
        elif event_type == "log":
            level = payload.get("level", "info")
            mark = {"error": "x", "warn": "!", "success": "+"}.get(level, "·")
            stage = payload.get("stage", "")
            sys.stdout.write(f"{event['t']:7.1f}s {mark} [{stage}] {payload.get('message', '')}\n")
            sys.stdout.flush()


def log(stage: str, message: str, level: str = "info", **extra) -> None:
    emit("log", stage=stage, level=level, message=message, **extra)


def node(node_id: str, status: str, label: str | None = None, **extra) -> None:
    """Update a node in the pipeline graph (pending/running/done/failed/skipped)."""
    payload = {"id": node_id, "status": status, **extra}
    if label:
        payload["label"] = label
    emit("node", **payload)
