"""
ScriptMotion: Model-Agnostic Agentic Orchestration for Declarative Motion Graphics Compilation

Run:
    python app.py

The process serves the dark UI, runs the ScriptMotion pipeline in a
background thread, streams logs over SSE, and serves the finished MP4 with
HTTP Range support so the browser can seek.
"""

import argparse
import json
import mimetypes
import os
import queue
import re
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterator
from urllib.parse import quote, unquote, urlparse

ROOT = Path(__file__).resolve().parent
UI_DIR = ROOT / "ui"
OUTPUT_DIR = ROOT / "output"
RUNS_DIR = ROOT / ".runs"

HOST = "127.0.0.1"
DEFAULT_PORT = 8000
ANSI_RE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
PROGRESS_RE = re.compile(
    r"(?:Rendered|Encoded|Rendering)\s+(\d+)\s*/\s*(\d+)",
    re.IGNORECASE,
)
BOX_CHARS = "┌┐└┘├┤┬┴┼─│╭╮╰╯╔╗╚╝╠╣╦╩╬═║"
PROVIDERS = {"gemini", "claude", "nvidia"}


def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text)


def clean_log_line(text: str) -> str:
    line = strip_ansi(text).strip()
    return line.strip(BOX_CHARS + " ").strip()


def classify_level(line: str) -> str:
    lower = line.lower()
    if "[fail]" in lower or "traceback" in lower or "error:" in lower or "failed" in lower:
        return "error"
    if "[warn]" in lower or "warning" in lower:
        return "warn"
    if "[ok]" in lower or "success" in lower or "complete" in lower or "done!" in lower:
        return "success"
    if line.startswith(">>") or line.startswith("$ "):
        return "step"
    return "info"


def classify_stage(line: str, current: str) -> str:
    lower = line.lower()
    if "calling" in lower:
        return "Generating component"
    if "component written" in lower:
        return "Validating TypeScript"
    if "typescript validation passed" in lower:
        return "Rendering video"
    if "rendering video with remotion" in lower:
        return "Rendering video"
    if "video rendered successfully" in lower:
        return "Finalizing"
    if "done!" in lower:
        return "Done"
    return current


def parse_progress(line: str) -> float | None:
    match = PROGRESS_RE.search(line)
    if not match:
        return None
    current, total = int(match.group(1)), int(match.group(2))
    if total <= 0:
        return None
    return max(0.0, min(1.0, current / total))


def iter_output(stream) -> Iterator[str]:
    """Yield lines on both \\n and \\r so Remotion's progress bar streams live."""
    buffer: list[str] = []
    while True:
        char = stream.read(1)
        if char == "":
            if buffer:
                yield "".join(buffer)
            return
        if char in ("\r", "\n"):
            if buffer:
                yield "".join(buffer)
                buffer = []
        else:
            buffer.append(char)


def newest_video_after(started_at: float) -> str | None:
    if not OUTPUT_DIR.exists():
        return None
    candidates: list[tuple[float, Path]] = []
    for path in OUTPUT_DIR.glob("*.mp4"):
        try:
            stat = path.stat()
        except OSError:
            continue
        if stat.st_mtime >= started_at - 5:
            candidates.append((stat.st_mtime, path))
    if not candidates:
        return None
    _, path = max(candidates, key=lambda item: item[0])
    return path.relative_to(ROOT).as_posix()


def list_history(limit: int = 30) -> list[dict]:
    if not OUTPUT_DIR.exists():
        return []
    items: list[dict] = []
    for path in OUTPUT_DIR.glob("*.mp4"):
        try:
            stat = path.stat()
        except OSError:
            continue
        items.append({
            "name": path.name,
            "url": f"/output/{quote(path.name)}",
            "size": stat.st_size,
            "mtime": stat.st_mtime,
        })
    items.sort(key=lambda item: item["mtime"], reverse=True)
    return items[:limit]


def open_output_folder() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    if os.name == "nt":
        os.startfile(str(OUTPUT_DIR))  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(OUTPUT_DIR)])
    else:
        subprocess.Popen(["xdg-open", str(OUTPUT_DIR)])


@dataclass
class Job:
    id: str
    topic: str
    provider: str
    instructions: str
    concurrency: int
    duration: int = DEFAULT_DURATION
    audience: str = "beginner"
    status: str = "queued"
    stage: str = "Queued"
    progress: float = 0.0
    video: str | None = None
    error: str | None = None
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None
    events: list[dict] = field(default_factory=list)
    subscribers: list[queue.Queue] = field(default_factory=list)
    seq: int = 0
    process: subprocess.Popen | None = None
    lock: threading.Lock = field(default_factory=threading.Lock)

    def emit(self, event_type: str, **payload) -> None:
        with self.lock:
            self.seq += 1
            event = {
                "seq": self.seq,
                "type": event_type,
                "ts": time.time(),
                **payload,
            }
            self.events.append(event)
            if len(self.events) > 4000:
                del self.events[:1000]
            subscribers = list(self.subscribers)
        for subscriber in subscribers:
            subscriber.put_nowait(event)

    def subscribe(self) -> tuple[queue.Queue, list[dict], bool]:
        subscriber: queue.Queue = queue.Queue()
        with self.lock:
            replay = list(self.events)
            finished = self.status in ("done", "failed", "stopped")
            if not finished:
                self.subscribers.append(subscriber)
        return subscriber, replay, finished

    def unsubscribe(self, subscriber: queue.Queue) -> None:
        with self.lock:
            if subscriber in self.subscribers:
                self.subscribers.remove(subscriber)

    def close_subscribers(self) -> None:
        with self.lock:
            subscribers = list(self.subscribers)
            self.subscribers.clear()
        for subscriber in subscribers:
            subscriber.put_nowait(None)


class JobManager:
    def __init__(self) -> None:
        self.jobs: dict[str, Job] = {}
        self.active_id: str | None = None
        self.lock = threading.Lock()

    def create(
        self,
        topic: str,
        provider: str,
        instructions: str,
        concurrency: int,
        duration: int = DEFAULT_DURATION,
        audience: str = "beginner",
    ) -> Job:
        with self.lock:
            if self.active_id:
                active = self.jobs.get(self.active_id)
                if active and active.status in ("queued", "running"):
                    raise RuntimeError("A build is already running. Wait for it to finish or stop it.")
            job = Job(
                id=uuid.uuid4().hex[:12],
                topic=topic,
                provider=provider,
                instructions=instructions,
                concurrency=concurrency,
                duration=duration,
                audience=audience,
            )
            self.jobs[job.id] = job
            self.active_id = job.id
            if len(self.jobs) > 50:
                for key in list(self.jobs.keys())[:-50]:
                    if key != self.active_id:
                        self.jobs.pop(key, None)
            return job

    def run(self, job: Job) -> None:
        threading.Thread(target=self._run_job, args=(job,), daemon=True).start()

    def _clear_active(self, job: Job) -> None:
        with self.lock:
            if self.active_id == job.id:
                self.active_id = None

    def stop(self, job_id: str) -> bool:
        with self.lock:
            job = self.jobs.get(job_id)
        if not job or not job.process or job.process.poll() is not None:
            return False
        job.status = "stopped"
        job.stage = "Stopped"
        job.emit("status", status=job.status, stage=job.stage)
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(job.process.pid), "/T", "/F"],
                capture_output=True,
            )
        else:
            job.process.terminate()
        return True

    def _run_job(self, job: Job) -> None:
        job.status = "running"
        job.stage = "Starting"
        job.emit("status", status=job.status, stage=job.stage, progress=job.progress)

        RUNS_DIR.mkdir(exist_ok=True)
        result_path = RUNS_DIR / f"{job.id}.json"
        result_path.unlink(missing_ok=True)
        job.emit(
            "log",
            level="info",
            message="Launching pipeline process...",
            stage=job.stage,
        )

        cmd = [
            sys.executable,
            "-u",
            str(ROOT / "main.py"),
            job.topic,
            "--provider",
            job.provider,
            "--concurrency",
            str(job.concurrency),
            "--duration",
            str(job.duration),
            "--audience",
            job.audience,
            "--result-file",
            str(result_path),
        ]
        if job.instructions:
            cmd.extend(["--instructions", job.instructions])

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        env["COLUMNS"] = "200"
        env["LINES"] = "60"
        env.setdefault("NO_COLOR", "1")

        try:
            job.process = subprocess.Popen(
                cmd,
                cwd=str(ROOT),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                env=env,
            )
        except Exception as exc:  # noqa: BLE001
            job.status = "failed"
            job.stage = "Failed"
            job.error = f"Could not start pipeline: {exc}"
            job.emit("log", level="error", message=job.error, stage=job.stage)
            job.emit("status", status=job.status, stage=job.stage, error=job.error)
            job.finished_at = time.time()
            job.close_subscribers()
            self._clear_active(job)
            return

        assert job.process.stdout is not None
        for raw_line in iter_output(job.process.stdout):
            line = clean_log_line(raw_line)
            if not line:
                continue
            print(f"[{job.provider}] {line}", flush=True)

            stage = classify_stage(line, job.stage)
            if stage != job.stage:
                job.stage = stage
                job.emit(
                    "status",
                    status=job.status,
                    stage=job.stage,
                    progress=job.progress,
                )

            progress = parse_progress(line)
            if progress is not None:
                job.progress = progress
                job.emit(
                    "progress",
                    progress=progress,
                    stage=job.stage,
                    message=line,
                )

            job.emit(
                "log",
                level=classify_level(line),
                message=line,
                stage=job.stage,
            )

        returncode = job.process.wait()

        if job.status == "stopped":
            job.finished_at = time.time()
            job.emit("status", status=job.status, stage=job.stage, error=job.error)
            job.close_subscribers()
            self._clear_active(job)
            return

        result: dict | None = None
        if result_path.exists():
            try:
                result = json.loads(result_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                result = None

        if result and result.get("ok") and result.get("video"):
            job.video = str(result["video"])
            job.status = "done"
            job.stage = "Done"
            job.progress = 1.0
            job.emit(
                "status",
                status=job.status,
                stage=job.stage,
                progress=1.0,
                video=job.video,
            )
            job.emit(
                "done",
                video=job.video,
                elapsed_seconds=result.get("elapsed_seconds"),
            )
        elif returncode == 0 and not result:
            fallback = newest_video_after(job.started_at)
            if fallback:
                job.video = fallback
                job.status = "done"
                job.stage = "Done"
                job.progress = 1.0
                job.emit(
                    "status",
                    status=job.status,
                    stage=job.stage,
                    progress=1.0,
                    video=job.video,
                )
                job.emit("done", video=job.video)
            else:
                job.status = "failed"
                job.stage = "Failed"
                job.error = "Build finished but no MP4 was found in output/."
                job.emit("log", level="error", message=job.error, stage=job.stage)
                job.emit(
                    "status",
                    status=job.status,
                    stage=job.stage,
                    error=job.error,
                )
        else:
            job.status = "failed"
            job.stage = "Failed"
            job.error = (result or {}).get("error") or "Build failed. Check the logs."
            job.emit("log", level="error", message=job.error, stage=job.stage)
            job.emit(
                "status",
                status=job.status,
                stage=job.stage,
                error=job.error,
            )

        job.finished_at = time.time()
        job.close_subscribers()
        self._clear_active(job)


def job_payload(job: Job) -> dict:
    return {
        "id": job.id,
        "topic": job.topic,
        "provider": job.provider,
        "instructions": job.instructions,
        "concurrency": job.concurrency,
        "status": job.status,
        "stage": job.stage,
        "progress": job.progress,
        "video": job.video,
        "error": job.error,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }


manager = JobManager()


class Handler(BaseHTTPRequestHandler):
    server_version = "ATGVideoStudio/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # noqa: A003 - silence request spam
        return

    # ---------- GET ----------

    def do_GET(self) -> None:  # noqa: N802
        path = unquote(urlparse(self.path).path)

        if path in ("/", "/index.html"):
            self._serve_file(
                UI_DIR / "index.html",
                "text/html; charset=utf-8",
            )
            return

        if path.startswith("/ui/"):
            self._serve_static(path[len("/ui/"):])
            return

        if path.startswith("/output/"):
            self._serve_video(path[len("/output/"):])
            return

        if path == "/api/history":
            self._send_json(200, {"items": list_history()})
            return

        if path == "/api/health":
            self._send_json(200, {"ok": True, "time": time.time()})
            return

        if path.startswith("/api/jobs/"):
            parts = [part for part in path.split("/") if part]
            # ["api", "jobs", "<id>", ...]
            if len(parts) >= 3:
                job = manager.jobs.get(parts[2])
                if not job:
                    self._send_json(404, {"error": "Job not found"})
                    return
                if len(parts) == 3:
                    self._send_json(200, job_payload(job))
                    return
                if len(parts) == 4 and parts[3] == "events":
                    self._stream_events(job)
                    return
            self._send_json(404, {"error": "Not found"})
            return

        self._send_json(404, {"error": "Not found"})

    def do_HEAD(self) -> None:  # noqa: N802
        path = unquote(urlparse(self.path).path)
        if path.startswith("/output/"):
            self._serve_video(path[len("/output/"):], head_only=True)
            return
        if path in ("/", "/index.html"):
            self._serve_file(
                UI_DIR / "index.html",
                "text/html; charset=utf-8",
                head_only=True,
            )
            return
        self.send_error(404)

    # ---------- POST ----------

    def do_POST(self) -> None:  # noqa: N802
        path = unquote(urlparse(self.path).path)

        if path == "/api/build":
            try:
                body = self._read_json()
            except (ValueError, json.JSONDecodeError):
                self._send_json(400, {"error": "Invalid JSON body"})
                return

            topic = str(body.get("topic", "")).strip()
            provider = str(body.get("provider", "gemini")).strip().lower()
            instructions = str(body.get("instructions", "")).strip()
            try:
                concurrency = int(body.get("concurrency", 2))
            except (TypeError, ValueError):
                concurrency = 2
            try:
                duration = int(body.get("duration", DEFAULT_DURATION))
            except (TypeError, ValueError):
                duration = DEFAULT_DURATION
            audience = str(body.get("audience", "beginner")).strip().lower()

            if not topic:
                self._send_json(400, {"error": "Topic is required"})
                return
            if len(topic) > 300:
                self._send_json(400, {"error": "Topic is too long"})
                return
            if provider not in PROVIDERS:
                self._send_json(400, {"error": "Unknown provider"})
                return
            if not 1 <= concurrency <= 8:
                self._send_json(400, {"error": "Concurrency must be 1-8"})
                return
            if duration not in (30, 60, 90):
                self._send_json(400, {"error": "Duration must be 30, 60, or 90"})
                return
            if audience not in ("beginner", "intermediate", "advanced"):
                self._send_json(400, {"error": "Audience must be beginner, intermediate, or advanced"})
                return

            try:
                job = manager.create(topic, provider, instructions, concurrency, duration, audience)
            except RuntimeError as exc:
                self._send_json(409, {"error": str(exc)})
                return

            manager.run(job)
            self._send_json(202, {"job_id": job.id})
            return

        if path.startswith("/api/jobs/") and path.endswith("/stop"):
            parts = [part for part in path.split("/") if part]
            # ["api", "jobs", "<id>", "stop"]
            if len(parts) == 4:
                ok = manager.stop(parts[2])
                self._send_json(200 if ok else 404, {"ok": ok})
                return
            self._send_json(404, {"error": "Job not found"})
            return

        if path == "/api/open-folder":
            try:
                open_output_folder()
                self._send_json(200, {"ok": True})
            except Exception as exc:  # noqa: BLE001
                self._send_json(500, {"error": str(exc)})
            return

        self._send_json(404, {"error": "Not found"})

    # ---------- helpers ----------

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length else b"{}"
        value = json.loads(raw.decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("Expected a JSON object")
        return value

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(
        self,
        path: Path,
        content_type: str,
        head_only: bool = False,
    ) -> None:
        if not path.is_file():
            self._send_json(404, {"error": "Not found"})
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

    def _serve_static(self, relative: str) -> None:
        target = (UI_DIR / relative).resolve()
        if not target.is_relative_to(UI_DIR.resolve()) or not target.is_file():
            self._send_json(404, {"error": "Not found"})
            return
        content_type, _ = mimetypes.guess_type(str(target))
        self._serve_file(
            target,
            content_type or "application/octet-stream",
        )

    def _serve_video(self, filename: str, head_only: bool = False) -> None:
        target = (OUTPUT_DIR / filename).resolve()
        if not target.is_relative_to(OUTPUT_DIR.resolve()) or not target.is_file():
            self._send_json(404, {"error": "Video not found"})
            return

        file_size = target.stat().st_size
        range_header = self.headers.get("Range")
        start, end = 0, file_size - 1
        status = 200

        if range_header:
            match = re.match(r"bytes=(\d*)-(\d*)", range_header.strip())
            if match:
                if match.group(1):
                    start = int(match.group(1))
                if match.group(2):
                    end = int(match.group(2))
                if start >= file_size:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{file_size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                end = min(end, file_size - 1)
                status = 206

        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        if head_only:
            return

        with target.open("rb") as file:
            file.seek(start)
            remaining = length
            while remaining > 0:
                chunk = file.read(min(1024 * 256, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def _write_sse(self, event: dict) -> None:
        data = json.dumps(event, ensure_ascii=False)
        self.wfile.write(f"data: {data}\n\n".encode("utf-8"))
        self.wfile.flush()

    def _stream_events(self, job: Job) -> None:
        subscriber, replay, finished = job.subscribe()

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        try:
            self.wfile.write(b"retry: 1000\n\n")
            self.wfile.flush()

            for event in replay:
                self._write_sse(event)

            if finished:
                self._write_sse({
                    "seq": job.seq,
                    "type": "end",
                    "ts": time.time(),
                    "status": job.status,
                })
                return

            while True:
                try:
                    event = subscriber.get(timeout=15)
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    continue
                if event is None:
                    self._write_sse({
                        "seq": job.seq,
                        "type": "end",
                        "ts": time.time(),
                        "status": job.status,
                    })
                    break
                self._write_sse(event)
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            job.unsubscribe(subscriber)
            self.close_connection = True


def print_banner(url: str) -> None:
    print("")
    print("  +------------------------------------------+")
    print("  |            ATG VIDEO STUDIO              |")
    print("  +------------------------------------------+")
    print(f"  UI:        {url}")
    print("  Providers: Gemini / Claude / NVIDIA Nemotron")
    print("  Logs:      live in the UI and this terminal")
    print("  Stop:      Ctrl+C")
    print("")


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass

    parser = argparse.ArgumentParser(description="ScriptMotion local UI")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    server: ThreadingHTTPServer | None = None
    for port in range(args.port, args.port + 10):
        try:
            server = ThreadingHTTPServer((HOST, port), Handler)
            break
        except OSError:
            continue

    if server is None:
        print(f"Could not bind to {HOST}:{args.port}-{args.port + 9}.")
        return 1

    server.daemon_threads = True
    url = f"http://{HOST}:{server.server_port}"
    print_banner(url)

    if not args.no_browser:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
