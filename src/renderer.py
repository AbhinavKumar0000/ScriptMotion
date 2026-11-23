import json
import platform
import subprocess
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.panel import Panel

from src.errors import PipelineError

console = Console(force_terminal=True, highlight=False)

# Windows needs --gl=angle to prevent blank/static frame rendering.
GL_FLAG = "--gl=angle" if platform.system() == "Windows" else "--gl=swiftshader"


def _render_once(topic: str, output_filename: str, concurrency: int) -> int:
    props_path = Path("remotion_project") / "props.json"
    props_path.write_text(json.dumps({"topic": topic}), encoding="utf-8")

    cmd = (
        f'npx remotion render src/index.ts EducationVideo "../{output_filename}"'
        f" --props props.json"
        f" --concurrency {concurrency}"
        f" --image-format jpeg"
        f" --jpeg-quality 90"
        f" {GL_FLAG}"
    )

    console.print(f"[dim]$ {cmd}[/dim]")
    try:
        result = subprocess.run(
            cmd,
            cwd="remotion_project",
            capture_output=False,
            shell=True,
        )
        return result.returncode
    finally:
        props_path.unlink(missing_ok=True)


def render_video(topic: str, concurrency: int = 2) -> Path:
    """
    Render the EducationVideo composition to MP4.

    If the requested concurrency fails, retry once with concurrency 1.
    This is the "concurrency works" fallback: high concurrency can exhaust
    memory on some Windows machines, but a single worker usually succeeds.
    """
    safe_topic = topic.replace(" ", "_").replace("/", "-")[:50]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"output/{safe_topic}_{timestamp}.mp4"
    output_path = Path(output_filename)
    output_path.parent.mkdir(exist_ok=True)

    requested = max(1, int(concurrency))
    attempts = [requested]
    if requested > 1:
        attempts.append(1)

    last_code = 1
    for index, worker_count in enumerate(attempts):
        if index > 0:
            console.print(
                f"[yellow][WARN] Render failed with concurrency {attempts[index - 1]}; "
                f"retrying with concurrency 1...[/yellow]"
            )
        console.print(
            f"[yellow]>> Rendering video with Remotion "
            f"(concurrency {worker_count})...[/yellow]"
        )
        try:
            last_code = _render_once(topic, output_filename, worker_count)
        except Exception as exc:  # noqa: BLE001 - surface the real failure
            raise PipelineError(f"Could not start Remotion: {exc}") from exc

        if last_code == 0:
            console.print(Panel(
                f"[bold green]Video rendered successfully![/bold green]\n\n"
                f"Output: [cyan]{output_path.resolve()}[/cyan]",
                title="Done", border_style="green"
            ))
            return output_path

    raise PipelineError(
        "Render failed after retrying with concurrency 1.\n"
        "Common fixes:\n"
        "- Run `python setup.py` first\n"
        "- Run `cd remotion_project && npx remotion studio`\n"
        "- Check the generated TSX for runtime errors\n"
        f"(last exit code: {last_code})"
    )
