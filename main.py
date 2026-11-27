"""ScriptMotion: turn a topic (plus an optional teacher's brief) into an animated lesson video.

Pipeline
  keys      ping every NVIDIA key in parallel; unhealthy keys are skipped
  outline   one call: lesson structure, chosen from the pre-built component library
  scenes    scene data written in parallel batches across healthy keys
  repair    invalid scenes are re-asked with their validation error, then fall back to text
  validate  every formula is compiled with KaTeX; timings are derived from content
  render    Remotion renders the declarative storyboard to MP4

The model only chooses components and fills their data. All geometry, physics and
layout are computed by the components, so output quality does not depend on the model.

Usage
  python main.py "Refraction through a glass slab" --brief "Class 10, focus on Snell's law" --duration 90
  python main.py "Matrix multiplication" --model kimi --out output/videos
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from src.events import emit, log, node
from src.llm.client import DEFAULT_MODEL, LLM, MODELS, LLMError
from src.llm.keypool import KeyPool
from src.planner import check_tex, plan_outline, write_scenes
from src.storyboard import FPS, OVERLAP, scene_starts, time_storyboard

ROOT = Path(__file__).resolve().parent
REMOTION = ROOT / "remotion_project"
VIDEOS = ROOT / "output" / "videos"


def chapters(scenes: list[dict], starts: list[float]) -> list[dict]:
    """One chapter per scene and per titled beat, in video seconds."""
    out = []
    for i, scene in enumerate(scenes):
        out.append({"title": scene.get("title") or scene["type"], "type": scene["type"], "start": round(starts[i], 2)})
        for beat in scene.get("beats") or []:
            if beat.get("title") and beat["title"] != out[-1]["title"]:
                out.append({"title": beat["title"], "type": scene["type"], "start": round(starts[i] + beat["at"] / FPS, 2)})
    return out


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48] or "lesson"


def render(props_file: Path, out_file: Path, concurrency: int | None) -> None:
    cmd = ["node", "scripts/render-video.mjs", str(props_file), str(out_file)]
    if concurrency:
        cmd.append(str(concurrency))
    node("render", "running", detail="bundling")
    proc = subprocess.Popen(cmd, cwd=REMOTION, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            text=True, encoding="utf-8", errors="replace", shell=sys.platform == "win32")
    error = ""
    last_logged = -10
    assert proc.stdout is not None
    for line in proc.stdout:
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        stage, p = msg.get("stage"), float(msg.get("progress") or 0)
        if stage == "bundle":
            emit("progress", stage="bundle", value=round(p, 3))
        elif stage == "render":
            emit("progress", stage="render", value=round(p, 3), frames=msg.get("frames"), rendered=msg.get("rendered"))
            pct = int(p * 100)
            if msg.get("frames"):
                log("render", f"Rendering {msg['frames']} frames ({msg['frames'] / FPS:.0f}s of video)")
            elif pct >= last_logged + 10:
                last_logged = pct - pct % 10
                node("render", "running", detail=f"{pct}%")
                log("render", f"{pct}% rendered")
        elif stage == "error":
            error = msg.get("message", "render failed")
    proc.wait()
    if proc.returncode != 0:
        stderr = (proc.stderr.read() if proc.stderr else "")[-600:]
        raise RuntimeError(error or stderr.strip() or f"renderer exited with {proc.returncode}")


def build(topic: str, brief: str, audience: str, seconds: int, model: str,
          concurrency: int | None, out_dir: Path, skip_render: bool = False) -> dict:
    started = time.time()
    run_dir = out_dir / f"{datetime.now():%Y%m%d-%H%M%S}-{slugify(topic)}"
    run_dir.mkdir(parents=True, exist_ok=True)
    os.environ["SM_TRACE_DIR"] = str(run_dir / "trace")
    emit("run", topic=topic, brief=brief, audience=audience, seconds=seconds, model=model, dir=str(run_dir))

    # 1. keys -------------------------------------------------------------
    node("keys", "running", detail="checking keys")
    pool = KeyPool.from_env()
    log("keys", f"Checking {len(pool.slots)} NVIDIA keys in parallel")
    pool.health_check(MODELS[model]["id"])
    healthy = pool.healthy_count
    for slot in pool.slots:
        state = f"ok in {slot.latency}s" if slot.healthy and not slot.last_error else (slot.last_error or "ok")
        log("keys", f"{slot.name} (…{slot.key[-4:]}): {state}", "success" if slot.healthy else "error")
    if not healthy:
        node("keys", "failed", detail="no working keys")
        raise RuntimeError("No NVIDIA key passed the health check. Check .env")
    node("keys", "done", detail=f"{healthy}/{len(pool.slots)} healthy")
    llm = LLM(pool, model)

    # 2. outline ----------------------------------------------------------
    outline = plan_outline(llm, topic, brief, audience, seconds)
    emit("outline", title=outline["title"], subject=outline["subject"], chapter=outline["chapter"],
         scenes=[{"index": i, "type": s["type"], "title": s["title"]} for i, s in enumerate(outline["scenes"])])

    # 3-4. scenes + repair --------------------------------------------------
    node("scenes", "running", detail=f"{len(outline['scenes'])} scenes")
    scenes = write_scenes(llm, outline, brief, audience, parallel=healthy)
    node("scenes", "done", detail=f"{len(scenes)} scenes")

    # 5. validate ---------------------------------------------------------
    node("validate", "running", detail="KaTeX + timing")
    fixed = check_tex(scenes)
    time_storyboard(scenes, seconds + OVERLAP * (len(scenes) - 1) / FPS)
    starts, total = scene_starts(scenes)
    log("validate", f"Formulas checked ({fixed} repaired); storyboard is {total:.0f}s", "success")
    node("validate", "done", detail=f"{total:.0f}s storyboard")

    props = {"meta": {"title": outline["title"], "subject": outline["subject"],
                      "chapter": outline["chapter"], "level": outline["level"] or audience},
             "scenes": scenes}
    props_file = run_dir / "storyboard.json"
    props_file.write_text(json.dumps(props, indent=1, ensure_ascii=False), encoding="utf-8")
    (run_dir / "outline.json").write_text(json.dumps(outline, indent=1, ensure_ascii=False), encoding="utf-8")

    # 6. render -----------------------------------------------------------
    video = run_dir / "lesson.mp4"
    if skip_render:
        node("render", "skipped", detail="--no-render")
    else:
        render_started = time.time()
        render(props_file, video, concurrency)
        node("render", "done", detail=f"{time.time() - render_started:.0f}s")
        log("render", f"Video written in {time.time() - render_started:.0f}s", "success")

    usage = [{"name": s.name, "calls": s.calls, "failures": s.failures, "healthy": s.healthy} for s in pool.slots]
    result = {
        "ok": True, "topic": topic, "brief": brief, "title": outline["title"], "subject": outline["subject"],
        "chapter": outline["chapter"], "level": props["meta"]["level"], "model": model,
        "seconds": round(total, 1), "elapsed": round(time.time() - started, 1),
        "dir": str(run_dir), "video": str(video) if video.exists() else None, "storyboard": str(props_file),
        "chapters": chapters(scenes, starts),
        "keys": usage,
    }
    (run_dir / "run.json").write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
    node("done", "done", detail=f"{result['elapsed']:.0f}s total")
    emit("result", **result)
    log("done", f"Lesson ready in {result['elapsed']:.0f}s: {video if video.exists() else props_file}", "success")
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate an animated school lesson video.")
    ap.add_argument("topic", help="what the lesson is about")
    ap.add_argument("--brief", "--instructions", dest="brief", default="",
                    help="teacher's description: focus, examples, values to use, what to skip")
    ap.add_argument("--audience", default="Class 10 student")
    ap.add_argument("--duration", type=int, default=90, help="target length in seconds (30-300)")
    ap.add_argument("--model", default=DEFAULT_MODEL, choices=list(MODELS))
    ap.add_argument("--concurrency", type=int, default=None, help="render concurrency")
    ap.add_argument("--out", default=str(VIDEOS))
    ap.add_argument("--no-render", action="store_true", help="plan and validate only")
    ap.add_argument("--result-file", default=None, help="write the result JSON here")
    args = ap.parse_args()
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    seconds = max(30, min(300, args.duration))
    try:
        result = build(args.topic, args.brief, args.audience, seconds, args.model,
                       args.concurrency, Path(args.out), args.no_render)
    except (LLMError, RuntimeError) as exc:
        log("error", str(exc), "error")
        emit("result", ok=False, error=str(exc))
        if args.result_file:
            Path(args.result_file).write_text(json.dumps({"ok": False, "error": str(exc)}), encoding="utf-8")
        return 1
    if args.result_file:
        Path(args.result_file).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
