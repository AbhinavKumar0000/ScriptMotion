"""Render-check every component in the library.

1. Builds a fixture scene from each catalog example and validates it through
   the same `clean_scene` path real lessons use.
2. Writes remotion_project/src/lesson/sample.json (default Studio props).
3. Renders stills of every component in parallel from ONE bundle
   (scripts/render-stills.mjs) at 3 points in each scene, and writes a
   contact sheet to output/component-check/index.html.

Usage:
    python check_components.py                 # all components
    python check_components.py lens mirror     # just these
    python check_components.py --no-render     # validate only
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

from src.catalog import CATALOG
from src.planner import check_tex
from src.storyboard import clean_scene, time_storyboard

ROOT = Path(__file__).resolve().parent
REMOTION = ROOT / "remotion_project"
OUT = ROOT / "output" / "component-check"


def fixtures(names: list[str] | None = None) -> list[dict]:
    scenes = []
    for name, spec in CATALOG.items():
        if names and name not in names:
            continue
        raw = dict(spec.example, type=name)
        if spec.notes and not raw.get("notes"):
            raw["notes"] = ["Observe how the diagram is built", "Values are computed, not typed"]
        scenes.append(clean_scene(raw, name))
    time_storyboard(scenes)
    return scenes


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    render = "--no-render" not in sys.argv
    scenes = fixtures(args or None)
    print(f"Validated {len(scenes)} fixtures")
    fixed = check_tex(scenes)
    print(f"KaTeX check: {fixed} repaired")

    sample = {"meta": {"title": "Component library", "subject": "physics", "chapter": "Ray optics", "level": "Class 10"},
              "scenes": [s for s in scenes if s["type"] in ("title", "lens", "field_lines", "function_graph", "quiz", "recap")] or scenes[:3]}
    (REMOTION / "src" / "lesson" / "sample.json").write_text(json.dumps(sample, indent=1, ensure_ascii=False), encoding="utf-8")
    if not render:
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    for scene in scenes:
        props = {"meta": {"title": "Component check", "subject": CATALOG[scene["type"]].subject, "chapter": scene["type"], "level": ""}, "scenes": [scene]}
        frames = [int(scene["duration"] * f) for f in (0.35, 0.7, 0.97)]
        jobs.append({"name": scene["type"], "props": props, "frames": frames})
    job_file = OUT / "jobs.json"
    job_file.write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")
    started = time.time()
    proc = subprocess.run(["node", "scripts/render-stills.mjs", str(job_file), str(OUT)], cwd=REMOTION)
    print(f"Rendered in {time.time() - started:.0f}s (exit {proc.returncode})")

    cards = []
    for job in jobs:
        imgs = "".join(f'<img src="{job["name"]}_{f}.jpg" loading="lazy">' for f in job["frames"])
        cards.append(f'<section><h2>{job["name"]}</h2><div class="row">{imgs}</div></section>')
    (OUT / "index.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Component check</title>"
        "<style>body{background:#0b0d10;color:#e6e8eb;font:14px system-ui;margin:24px}"
        "section{margin:0 0 28px}h2{font-weight:600;font-size:15px;margin:0 0 8px}"
        ".row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}img{width:100%;border-radius:6px;border:1px solid #222}</style>"
        + "".join(cards), encoding="utf-8")
    print(f"Contact sheet: {OUT / 'index.html'}")
    return proc.returncode


if __name__ == "__main__":
    sys.exit(main())
