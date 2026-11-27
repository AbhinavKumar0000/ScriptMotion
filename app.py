"""ScriptMotion studio: local web UI for generating lesson videos.

    python app.py            # http://127.0.0.1:8000
    python app.py --port 9000 --no-browser

The server runs main.py as a subprocess with SM_EVENTS=1 and turns its
structured event lines into a Server-Sent-Events stream that drives the
pipeline graph, key panel and log table in ui/index.html.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

from src.catalog import CATALOG
from src.events import PREFIX
from src.llm.client import DEFAULT_MODEL, MODELS
from src.llm.keypool import KeyPool

ROOT = Path(__file__).resolve().parent
UI_DIR = ROOT / "ui"
VIDEOS = ROOT / "output" / "videos"
HOST = "127.0.0.1"


# ===================================================================== jobs
@dataclass
class Job:
    id: str
    request: dict
    status: str = "running"  # running | done | failed | cancelled
    started: float = field(default_factory=time.time)
    events: list[dict] = field(default_factory=list)
    result: dict | None = None
    proc: subprocess.Popen | None = None
    cond: threading.Condition = field(default_factory=threading.Condition)

    def push(self, event: dict) -> None:
        with self.cond:
            self.events.append(event)
            self.cond.notify_all()

    def summary(self) -> dict:
        return {"id": self.id, "status": self.status, "request": self.request, "started": self.started,
                "result": self.result, "events": len(self.events)}


JOBS: dict[str, Job] = {}
JOBS_LOCK = threading.Lock()
KEY_STATE: dict = {"checked": 0.0, "keys": [], "error": ""}


def active_job() -> Job | None:
    with JOBS_LOCK:
        return next((j for j in JOBS.values() if j.status == "running"), None)


def run_job(job: Job) -> None:
    req = job.request
    cmd = [sys.executable, "-u", str(ROOT / "main.py"), req["topic"],
           "--duration", str(req["duration"]), "--model", req["model"], "--audience", req["audience"]]
    if req.get("brief"):
        cmd += ["--brief", req["brief"]]
    env = {**os.environ, "SM_EVENTS": "1", "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    job.push({"type": "log", "stage": "server", "level": "info", "t": 0, "message": f"Job {job.id} started"})
    try:
        job.proc = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    text=True, encoding="utf-8", errors="replace", bufsize=1)
        assert job.proc.stdout is not None
        for raw in job.proc.stdout:
            line = raw.rstrip("\n")
            if not line.strip():
                continue
            if line.startswith(PREFIX):
                try:
                    event = json.loads(line[len(PREFIX):])
                except json.JSONDecodeError:
                    continue
                if event.get("type") == "result":
                    job.result = event
                if event.get("type") == "key":
                    _merge_key(event)
                job.push(event)
            else:
                job.push({"type": "log", "stage": "stderr", "level": "debug", "t": round(time.time() - job.started, 1),
                          "message": line[:400]})
        code = job.proc.wait()
    except Exception as exc:  # noqa: BLE001
        job.push({"type": "log", "stage": "server", "level": "error", "message": str(exc)})
        code = 1
    if job.status == "cancelled":
        pass
    elif code == 0 and job.result and job.result.get("ok"):
        job.status = "done"
    else:
        job.status = "failed"
        if not job.result:
            job.result = {"ok": False, "error": f"pipeline exited with code {code}"}
    job.push({"type": "status", "status": job.status, "result": job.result})


def _merge_key(event: dict) -> None:
    keys = {k["name"]: k for k in KEY_STATE["keys"]}
    data = {k: v for k, v in event.items() if k not in ("type", "t")}
    keys[data["name"]] = {**keys.get(data["name"], {}), **data}
    KEY_STATE["keys"] = sorted(keys.values(), key=lambda k: k["name"])
    KEY_STATE["checked"] = time.time()


def check_keys(model: str) -> dict:
    try:
        pool = KeyPool.from_env()
        KEY_STATE["keys"] = pool.health_check(MODELS[model]["id"])
        KEY_STATE["error"] = ""
    except Exception as exc:  # noqa: BLE001
        KEY_STATE["error"] = str(exc)
    KEY_STATE["checked"] = time.time()
    return KEY_STATE


def history(limit: int = 40) -> list[dict]:
    items = []
    if not VIDEOS.exists():
        return items
    for run in sorted(VIDEOS.glob("*/run.json"), reverse=True)[:limit]:
        try:
            data = json.loads(run.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        folder = run.parent.name
        video = run.parent / "lesson.mp4"
        items.append({
            "id": folder, "title": data.get("title"), "topic": data.get("topic"), "brief": data.get("brief", ""),
            "subject": data.get("subject"), "chapter": data.get("chapter"), "level": data.get("level"),
            "seconds": data.get("seconds"), "elapsed": data.get("elapsed"), "model": data.get("model"),
            "chapters": data.get("chapters", []),
            "video": f"/media/{quote(folder)}/lesson.mp4" if video.exists() else None,
            "poster": f"/media/{quote(folder)}/poster.jpg" if (video.parent / "poster.jpg").exists() else None,
            "created": run.stat().st_mtime,
        })
    return items


# =================================================================== server
class Handler(BaseHTTPRequestHandler):
    server_version = "ScriptMotion/2"

    def log_message(self, fmt: str, *args) -> None:  # quiet access log
        pass

    # ------------------------------------------------------------- helpers
    def _json(self, data, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}

    def _file(self, path: Path) -> None:
        if not path.is_file():
            self.send_error(404)
            return
        size = path.stat().st_size
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        start, end, status = 0, size - 1, 200
        rng = self.headers.get("Range")
        if rng and rng.startswith("bytes="):
            a, _, b = rng[6:].split(",")[0].partition("-")
            try:
                if a:
                    start = int(a)
                    end = int(b) if b else size - 1
                else:
                    start = max(0, size - int(b))
                end = min(end, size - 1)
                if start > end:
                    raise ValueError
                status = 206
            except ValueError:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        try:
            with path.open("rb") as fh:
                fh.seek(start)
                left = end - start + 1
                while left > 0:
                    chunk = fh.read(min(1 << 20, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def _sse(self, job: Job) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        sent = 0
        try:
            while True:
                with job.cond:
                    if sent >= len(job.events) and job.status == "running":
                        job.cond.wait(timeout=15)
                    batch = job.events[sent:]
                if batch:
                    for event in batch:
                        self.wfile.write(f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n".encode("utf-8"))
                    sent += len(batch)
                    self.wfile.flush()
                elif job.status != "running":
                    break
                else:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    # -------------------------------------------------------------- routes
    def do_GET(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        path = unquote(url.path)
        if path in ("/", "/index.html"):
            return self._file(UI_DIR / "index.html")
        if path.startswith("/ui/"):
            target = (UI_DIR / path[4:]).resolve()
            return self._file(target) if UI_DIR.resolve() in target.parents else self.send_error(404)
        if path.startswith("/media/"):
            target = (VIDEOS / path[7:]).resolve()
            if VIDEOS.resolve() not in target.parents or target.suffix not in (".mp4", ".json", ".jpg"):
                return self.send_error(404)
            return self._file(target)
        if path == "/api/config":
            subjects: dict[str, list[str]] = {}
            for name, spec in CATALOG.items():
                subjects.setdefault(spec.subject, []).append(name)
            return self._json({
                "models": [{"id": k, "label": v["label"], "note": v.get("note", ""), "default": k == DEFAULT_MODEL} for k, v in MODELS.items()],
                "components": {k: len(v) for k, v in subjects.items()}, "total_components": sum(not s.hidden for s in CATALOG.values()),
            })
        if path == "/api/keys":
            return self._json(KEY_STATE)
        if path == "/api/history":
            return self._json(history())
        if path == "/api/active":
            job = active_job()
            return self._json(job.summary() if job else None)
        if path.startswith("/api/jobs/"):
            parts = path.split("/")
            job = JOBS.get(parts[3]) if len(parts) > 3 else None
            if not job:
                return self._json({"error": "unknown job"}, 404)
            if len(parts) > 4 and parts[4] == "events":
                return self._sse(job)
            return self._json(job.summary())
        self.send_error(404)

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        body = self._body()
        if path == "/api/keys/check":
            model = body.get("model") if body.get("model") in MODELS else DEFAULT_MODEL
            return self._json(check_keys(model))
        if path == "/api/build":
            topic = str(body.get("topic") or "").strip()
            if len(topic) < 3:
                return self._json({"error": "Enter a topic (at least 3 characters)."}, 400)
            if active_job():
                return self._json({"error": "A lesson is already being generated. Wait for it to finish."}, 409)
            req = {
                "topic": topic[:200],
                "brief": str(body.get("brief") or "").strip()[:1500],
                "audience": str(body.get("audience") or "Class 10 student")[:60],
                "duration": max(30, min(300, int(body.get("duration") or 90))),
                "model": body.get("model") if body.get("model") in MODELS else DEFAULT_MODEL,
            }
            job = Job(id=uuid.uuid4().hex[:10], request=req)
            with JOBS_LOCK:
                JOBS[job.id] = job
            threading.Thread(target=run_job, args=(job,), daemon=True).start()
            return self._json(job.summary(), 201)
        if path.startswith("/api/jobs/") and path.endswith("/cancel"):
            job = JOBS.get(path.split("/")[3])
            if not job or job.status != "running":
                return self._json({"error": "job is not running"}, 400)
            job.status = "cancelled"
            if job.proc and job.proc.poll() is None:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(job.proc.pid)], capture_output=True)
                else:
                    job.proc.kill()
            job.push({"type": "log", "stage": "server", "level": "warn", "message": "Cancelled by user"})
            return self._json(job.summary())
        self.send_error(404)


def main() -> int:
    ap = argparse.ArgumentParser(description="ScriptMotion studio")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    mimetypes.add_type("video/mp4", ".mp4")
    server = ThreadingHTTPServer((HOST, args.port), Handler)
    server.daemon_threads = True
    url = f"http://{HOST}:{args.port}"
    print(f"ScriptMotion studio running at {url}  (Ctrl+C to stop)")
    threading.Thread(target=check_keys, args=(DEFAULT_MODEL,), daemon=True).start()
    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
