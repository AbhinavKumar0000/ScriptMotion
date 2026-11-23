"""
Script-first educational video pipeline.

Generates a teaching script (narration + visual beats) BEFORE generating the
Remotion component. This ensures:
1. The story is solid before any visual work
2. Animation timing is derived from narration segments
3. Educational quality (cognitive load, signaling, segmenting) is baked in
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any


class BeatType(str, Enum):
    HOOK = "hook"
    ENTITIES = "entities"
    MECHANISM = "mechanism"
    WORKED_EXAMPLE = "worked_example"
    MENTAL_MODEL = "mental_model"
    OUTRO = "outro"


@dataclass
class VisualBeat:
    id: str
    type: BeatType
    title: str
    narration: str  # What the narrator says (word-for-word)
    visual_intent: str  # What the viewer sees (1-2 sentences)
    start_frame: int
    end_frame: int
    elements: list[str] = field(default_factory=list)
    emphasis_words: list[str] = field(default_factory=list)  # Words to emphasize visually


@dataclass
class TeachingScript:
    topic: str
    topic_type: str
    subcategory: str | None
    grade_level: str | None
    core_message: str  # One-line summary
    metaphor: str  # Core visual metaphor running through the video
    beats: list[VisualBeat]
    estimated_duration_seconds: int
    learning_objectives: list[str]
    audience: str = "student"


def _jsonify(obj: Any) -> Any:
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, dict):
        return {k: _jsonify(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_jsonify(v) for v in obj]
    if hasattr(obj, "__dataclass_fields__"):
        return _jsonify(asdict(obj))
    return obj


def script_to_context(script: TeachingScript) -> dict[str, Any]:
    """Convert a TeachingScript to a JSON-serializable context for the LLM provider."""
    return {
        "topic": script.topic,
        "topic_type": script.topic_type,
        "subcategory": script.subcategory,
        "grade_level": script.grade_level,
        "core_message": script.core_message,
        "metaphor": script.metaphor,
        "estimated_duration_seconds": script.estimated_duration_seconds,
        "learning_objectives": script.learning_objectives,
        "audience": script.audience,
        "beats": _jsonify(script.beats),
    }
