"""Lesson planning: outline -> batched parallel scene specs -> repair.

Token budget is kept small on purpose. The outline call sees one line per
component. Each batch call sees only the schemas and examples of the
components in that batch. Only failing scenes are re-asked, each with the
exact validation error.
"""

from __future__ import annotations

import json
import math
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from src.catalog import CATALOG, FIRST, LAST, outline_menu, schema_text
from src.events import log, node
from src.llm.client import LLM, LLMError
from src.schema import SchemaError
from src.storyboard import clean_scene, fallback_scene

ROOT = Path(__file__).resolve().parent.parent
REMOTION = ROOT / "remotion_project"

SLOP = [
    (r"\blet'?s (?:dive|delve) (?:in|into)\b[^.]*\.?\s*", ""),
    (r"\b(?:delve|dive) into\b", "look at"),
    (r"\bin this (?:fascinating|exciting|amazing) (?:journey|video)\b", "here"),
    (r"\b(?:fascinating|amazing|incredible|mind-blowing|magical)\s+", ""),
    (r"\bunlock(?:ing)? the (?:secrets|power) of\b", "understand"),
    (r"\bembark on\b", "start"),
    (r"!+", "."),
]

SYSTEM = """You are a senior school teacher and instructional designer writing a short animated lesson.
The video is assembled from a fixed library of pre-built, physically accurate animated components.
You choose components and fill their data. You never write code, coordinates for physics, or styling.

Teaching rules:
- Teach one idea per scene. Build from what the student knows to the new idea.
- Captions are narration subtitles: plain, specific, 1-2 sentences, max ~28 words. Say why, not just what.
- Use concrete numbers a student can check. Prefer a diagram scene over a text scene.
- Never state computed numeric results (image distance, current, range...) in captions or notes for
  physics/chemistry components: the component computes and displays them itself.
- No filler, hype or rhetorical questions ("Let's dive in", "fascinating", "journey", "unlock").
- Titles are short noun phrases in sentence case.
- Follow the teacher's brief exactly when one is given (focus, examples, values, level, language).
- Each scene's Goal fixes its setup: use the Goal's numbers and choices exactly. The example under each
  field contract only shows the JSON shape; never reuse its values unless the Goal asks for them.

Output rules: reply with ONE JSON object only. No markdown, no comments, no trailing commas."""


def _deslop(text: str) -> str:
    for pattern, repl in SLOP:
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text[:1].upper() + text[1:] if text else text


def _brief_block(brief: str, audience: str) -> str:
    parts = [f"Audience: {audience}."]
    if brief.strip():
        parts.append(f"Teacher's brief (follow exactly):\n{brief.strip()}")
    return "\n".join(parts)


# =================================================================== outline
def plan_outline(llm: LLM, topic: str, brief: str, audience: str, seconds: int) -> dict:
    n_lo = max(5, round(seconds / 13))
    n_hi = max(n_lo + 1, round(seconds / 7))
    user = f"""Plan a lesson video.

Topic: {topic}
{_brief_block(brief, audience)}
Target length: about {seconds} seconds, {n_lo}-{n_hi} scenes.

Available components (type (subject): when to use [syllabus chapters]):
{outline_menu()}

Structure:
1. "{FIRST}" first, "{LAST}" last.
2. Mostly visual components from the topic's subject. Use at least 2 different visual components when the topic allows.
3. Include one "worked_example" for any numerical topic and one "quiz" before the recap.
4. Text components (key_points, definition, compare, table) at most 3 in total.
6. Never show the same component with the same setup twice. Each animation already plays out its whole
   story (e.g. "bonding" shows atoms, electron transfer and the resulting ions in one scene), so one
   scene per setup; use the next scene for a different setup or a different component.
5. Each scene's goal says precisely what that scene must show, including the concrete setup
   (e.g. "convex lens f = 15 cm, object at 22 cm, show real enlarged image").

Return:
{{"title": "lesson title", "subject": "physics|chemistry|maths|general", "chapter": "syllabus chapter name",
  "level": "e.g. Class 10", "objectives": ["2-3 measurable learning objectives"],
  "scenes": [{{"type": "component type", "title": "scene title", "goal": "what it shows and teaches"}}]}}"""

    node("outline", "running", detail="planning scenes")
    data, meta = llm.json(SYSTEM, user, task="outline", max_tokens=3000, temperature=0.5)
    scenes = []
    for item in data.get("scenes") or []:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("type", "")).strip().lower().replace("-", "_")
        if kind not in CATALOG:
            log("outline", f"Model picked unknown component '{kind}', using key_points", "warn")
            kind = "key_points"
        scenes.append({
            "type": kind,
            "title": str(item.get("title") or CATALOG[kind].name)[:64],
            "goal": str(item.get("goal") or item.get("title") or "")[:300],
        })
    if not scenes:
        raise LLMError("outline contained no scenes")
    if scenes[0]["type"] != FIRST:
        scenes.insert(0, {"type": FIRST, "title": str(data.get("title") or topic)[:64], "goal": f"Open the lesson on {topic}"})
    if scenes[-1]["type"] != LAST:
        scenes.append({"type": LAST, "title": "Recap", "goal": "Summarise the key takeaways"})
    # Only one title / recap.
    scenes = [s for i, s in enumerate(scenes) if s["type"] not in (FIRST, LAST) or i in (0, len(scenes) - 1)]
    scenes = scenes[: n_hi + 2]
    outline = {
        "title": str(data.get("title") or topic)[:80],
        "subject": str(data.get("subject") or "general").lower(),
        "chapter": str(data.get("chapter") or "")[:60],
        "level": str(data.get("level") or "")[:30],
        "objectives": [str(o)[:120] for o in (data.get("objectives") or [])][:3],
        "scenes": scenes,
    }
    node("outline", "done", detail=f"{len(scenes)} scenes", key=meta["key"], seconds=meta["seconds"])
    log("outline", f"Outline ready: {len(scenes)} scenes via {meta['key']} in {meta['seconds']}s", "success")
    return outline


# ==================================================================== scenes
def _scene_context(outline: dict, brief: str, audience: str) -> str:
    plan = "\n".join(f"{i + 1}. [{s['type']}] {s['title']}" for i, s in enumerate(outline["scenes"]))
    objectives = "; ".join(outline["objectives"])
    return f"""Lesson: {outline['title']} ({outline['subject']}, {outline['chapter']}, {outline['level']})
Objectives: {objectives}
{_brief_block(brief, audience)}
Full scene plan (for continuity, do not repeat other scenes' content):
{plan}"""


def _batch_prompt(context: str, items: list[tuple[int, dict]], errors: dict[int, str] | None = None) -> str:
    blocks = []
    seen_types = set()
    for index, scene in items:
        kind = scene["type"]
        block = f"Scene {index + 1}: type \"{kind}\"\nTitle: {scene['title']}\nGoal: {scene['goal']}"
        if errors and index in errors:
            block += f"\nYour previous attempt was rejected: {errors[index]}. Fix exactly that."
        blocks.append(block)
        seen_types.add(kind)
    schemas = []
    for kind in sorted(seen_types):
        example = dict(CATALOG[kind].example, type=kind)
        schemas.append(f"{schema_text(kind)}\nShape example (do NOT reuse its values): {json.dumps(example, ensure_ascii=False)}")
    return f"""{context}

Write the full data for these scenes:

{chr(10).join(blocks)}

Field contracts (keys marked ? are optional; respect the ranges):

{chr(10).join(schemas)}

Return {{"scenes": [ ... ]}} with exactly {len(items)} object(s): only scene(s) {", ".join(str(i + 1) for i, _ in items)} above,
in that order, each with its "type". Do not write any other scene of the lesson."""


# numbers in a goal ("f = 10 cm", "30°"), but not labels like "2F" or "3D"
_NUM = re.compile(r"(?<![\w.])-?\d+(?:\.\d+)?(?![A-Za-z\d])")


def _numbers(value) -> set[float]:
    if isinstance(value, bool):
        return set()
    if isinstance(value, (int, float)):
        return {round(abs(float(value)), 4)}
    if isinstance(value, dict):
        return set().union(*(_numbers(v) for v in value.values())) if value else set()
    if isinstance(value, list):
        return set().union(*(_numbers(v) for v in value)) if value else set()
    return set()


def _copied_example(scene: dict, planned: dict) -> str | None:
    """Catch a scene that reused the catalog example's numbers instead of its goal's setup.

    Flags only when (a) a top-level number equals the example's and is absent from the goal, and
    (b) the goal names a number the scene never uses.
    """
    example = CATALOG[scene["type"]].example
    goal_nums = {round(abs(float(x)), 4) for x in _NUM.findall(planned.get("goal", ""))}
    if not goal_nums:
        return None
    # small integers (counts, indices, levels) legitimately repeat; only physical setup values count
    copied = {k: v for k, v in example.items()
              if isinstance(v, (int, float)) and not isinstance(v, bool)
              and not (float(v).is_integer() and abs(v) <= 4)
              and scene.get(k) == v and round(abs(float(v)), 4) not in goal_nums}
    body = {k: v for k, v in scene.items() if k not in ("title", "caption", "notes", "duration")}
    missing = goal_nums - _numbers(body)
    if copied and missing:
        return (f"fields {sorted(copied)} reuse the shape example's values {copied}; "
                f"the Goal asks for {sorted(missing)}. Use the Goal's setup")
    return None


def _polish(scene: dict) -> dict:
    scene["caption"] = _deslop(scene["caption"])
    scene["notes"] = [_deslop(n) for n in scene.get("notes") or []]
    return scene


def _norm(text) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(text or "").lower()).strip()


def _match(items: list[tuple[int, dict]], raw: list[dict]) -> list[dict | None]:
    """Pair requested scenes with returned ones. Models sometimes return extra scenes
    (the whole lesson) or reorder them, so match on type + title before position."""
    if len(raw) == len(items) and all(_kind(r) == p["type"] for r, (_, p) in zip(raw, items)):
        return list(raw)
    pool = list(raw)
    out: list[dict | None] = []
    for _, planned in items:
        same = [r for r in pool if _kind(r) == planned["type"]]
        pick = next((r for r in same if _norm(r.get("title")) == _norm(planned["title"])), None) or (same[0] if same else None)
        if pick is None and len(raw) == len(items):
            pick = raw[len(out)]  # same count, type mislabelled: let validation decide
        if pick is not None and pick in pool:
            pool.remove(pick)
        out.append(pick)
    return out


def _kind(raw: dict) -> str:
    return str(raw.get("type", "")).strip().lower().replace("-", "_")


def _run_batch(llm: LLM, context: str, items: list[tuple[int, dict]], label: str,
               errors: dict[int, str] | None = None) -> tuple[dict[int, dict], dict[int, str]]:
    ids = [f"scene-{i}" for i, _ in items]
    for nid in ids:
        node(nid, "running", detail="retry" if errors else "generating")
    max_tokens = min(8000, 900 + 900 * len(items))
    try:
        data, meta = llm.json(SYSTEM, _batch_prompt(context, items, errors), task=label,
                              max_tokens=max_tokens, temperature=0.35)
    except LLMError as exc:
        return {}, {i: str(exc) for i, _ in items}
    raw_scenes = data.get("scenes")
    if not isinstance(raw_scenes, list):
        raw_scenes = [data] if len(items) == 1 else []
    raw_scenes = [r for r in raw_scenes if isinstance(r, dict)]
    good: dict[int, dict] = {}
    bad: dict[int, str] = {}
    for (index, planned), raw in zip(items, _match(items, raw_scenes)):
        if raw is None:
            bad[index] = f"scene {index + 1} ({planned['type']}) missing from the response"
            node(f"scene-{index}", "warn", detail="missing")
            log(label, f"Scene {index + 1}: missing from the response", "warn")
            continue
        try:
            scene = clean_scene(raw, planned["type"])
            # heuristic guard: ask once, but never block a repair attempt with it
            copied = None if errors else _copied_example(scene, planned)
            if copied:
                raise SchemaError(copied)
            if planned.get("title") and planned["type"] != "title":
                scene["title"] = planned["title"]  # the outline is authoritative
            good[index] = _polish(scene)
            node(f"scene-{index}", "done", key=meta["key"], seconds=meta["seconds"])
        except SchemaError as exc:
            bad[index] = str(exc)
            node(f"scene-{index}", "warn", detail=str(exc)[:80])
            log(label, f"Scene {index + 1} ({planned['type']}) rejected: {exc}", "warn")
    log(label, f"{len(good)}/{len(items)} scenes valid via {meta['key']} in {meta['seconds']}s",
        "success" if not bad else "warn")
    return good, bad


def write_scenes(llm: LLM, outline: dict, brief: str, audience: str, parallel: int) -> list[dict]:
    context = _scene_context(outline, brief, audience)
    planned = list(enumerate(outline["scenes"]))
    batch_size = max(1, min(3, math.ceil(len(planned) / max(1, parallel))))
    batches = [planned[i : i + batch_size] for i in range(0, len(planned), batch_size)]
    log("scenes", f"Writing {len(planned)} scenes in {len(batches)} batches across {parallel} keys")

    results: dict[int, dict] = {}
    failures: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=max(1, parallel)) as pool:
        futures = [pool.submit(_run_batch, llm, context, batch, f"batch {n + 1}") for n, batch in enumerate(batches)]
        for future in as_completed(futures):
            good, bad = future.result()
            results.update(good)
            failures.update(bad)

    if failures:
        log("repair", f"Re-asking {len(failures)} scene(s) with the validation errors", "warn")
        node("repair", "running", detail=f"{len(failures)} scenes")
        retry_items = [(i, outline["scenes"][i]) for i in sorted(failures)]
        with ThreadPoolExecutor(max_workers=max(1, parallel)) as pool:
            futures = [pool.submit(_run_batch, llm, context, [item], f"repair {item[0] + 1}", failures) for item in retry_items]
            for future in as_completed(futures):
                good, bad = future.result()
                results.update(good)
                for index in good:
                    failures.pop(index, None)
                failures.update(bad)
        for index, error in failures.items():
            plan = outline["scenes"][index]
            log("repair", f"Scene {index + 1} ({plan['type']}) fell back to text: {error}", "warn")
            results[index] = fallback_scene(plan["type"], plan["title"], plan["goal"])
            node(f"scene-{index}", "fallback", detail="text fallback")
        node("repair", "done", detail=f"{len(failures)} fallbacks" if failures else "all fixed")
    else:
        node("repair", "skipped", detail="nothing to repair")

    return _drop_duplicates([results[i] for i in range(len(planned))])


def _drop_duplicates(scenes: list[dict]) -> list[dict]:
    """Remove a visual scene whose data repeats an earlier one exactly (same diagram twice)."""
    seen: set[str] = set()
    out: list[dict] = []
    for scene in scenes:
        body = {k: v for k, v in scene.items() if k not in ("title", "caption", "notes", "duration")}
        key = json.dumps(body, sort_keys=True, ensure_ascii=False)
        if scene["type"] not in ("title", "recap", "key_points") and key in seen:
            log("scenes", f"Dropped '{scene.get('title')}': same {scene['type']} diagram as an earlier scene", "warn")
            continue
        seen.add(key)
        out.append(scene)
    return out


# ================================================================= tex check
TEX_PATHS = {
    "definition": [("formula",), ("symbols", "*", "symbol")],
    "equation": [("steps", "*", "tex")],
    "worked_example": [("given", "*"), ("steps", "*", "tex")],
    "function_graph": [("functions", "*", "label")],
}


def _collect(obj, path, prefix=()):
    if not path:
        if isinstance(obj, str):
            yield prefix, obj
        return
    head, rest = path[0], path[1:]
    if head == "*":
        for i, item in enumerate(obj or []):
            yield from _collect(item, rest, prefix + (i,))
    elif isinstance(obj, dict) and obj.get(head) is not None:
        yield from _collect(obj[head], rest, prefix + (head,))


def _set(obj, path, value):
    for key in path[:-1]:
        obj = obj[key]
    obj[path[-1]] = value


def check_tex(scenes: list[dict]) -> int:
    """Validate every LaTeX string with the real KaTeX; fix or soften failures."""
    entries = []
    for si, scene in enumerate(scenes):
        for path in TEX_PATHS.get(scene["type"], []):
            for p, tex in _collect(scene, path):
                entries.append((si, p, tex))
    if not entries:
        return 0
    script = REMOTION / "scripts" / "check-tex.cjs"
    proc = subprocess.run(
        ["node", str(script)], input=json.dumps([e[2] for e in entries]),
        capture_output=True, text=True, encoding="utf-8", cwd=str(REMOTION),
    )
    if proc.returncode != 0:
        log("validate", f"KaTeX check could not run: {proc.stderr[:200]}", "warn")
        return 0
    errors = json.loads(proc.stdout or "[]")
    fixed = 0
    for (si, path, tex), err in zip(entries, errors):
        if not err:
            continue
        softened = tex.replace("\\\\", " ").replace("&", " ")
        softened = re.sub(r"\\(?:left|right)\b", "", softened)
        retry = subprocess.run(["node", str(script)], input=json.dumps([softened]), capture_output=True,
                               text=True, encoding="utf-8", cwd=str(REMOTION))
        ok = retry.returncode == 0 and not json.loads(retry.stdout or "[null]")[0]
        if not ok:
            plain = re.sub(r"[\\{}^_$]", "", tex)
            softened = "\\text{" + plain.replace("%", "\\%")[:80] + "}"
        _set(scenes[si], path, softened)
        fixed += 1
        log("validate", f"Scene {si + 1}: repaired LaTeX ({err[:70]})", "warn")
    return fixed
