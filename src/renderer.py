import subprocess
import sys
import json
import platform
from pathlib import Path
from datetime import datetime
from rich.console import Console
from rich.panel import Panel

console = Console(force_terminal=True, highlight=False)

# Windows needs --gl=angle to prevent blank/static frame rendering
GL_FLAG = "--gl=angle" if platform.system() == "Windows" else "--gl=swiftshader"


def render_video(topic: str) -> Path:
    """
    Calls Remotion CLI to render the EducationVideo composition to MP4.
    Uses a props JSON file instead of inline --props to avoid Windows
    shell quote-escaping issues.
    Returns path to the output file.
    """
    safe_topic = topic.replace(" ", "_").replace("/", "-")[:50]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"output/{safe_topic}_{timestamp}.mp4"
    output_path = Path(output_filename)
    output_path.parent.mkdir(exist_ok=True)

    # Write props to a JSON file — avoids all Windows shell escaping issues
    props_path = Path("remotion_project") / "props.json"
    props_path.write_text(json.dumps({"topic": topic}), encoding="utf-8")

    console.print("[yellow]>> Rendering video with Remotion... (this takes 30-120 seconds)[/yellow]")

    cmd = (
        f'npx remotion render src/index.ts EducationVideo "../{output_filename}"'
        f' --props props.json'
        f' --concurrency 2'           # Reduced from 4 to prevent memory crashes
        f' --image-format jpeg'
        f' --jpeg-quality 90'
        f' {GL_FLAG}'                 # Prevents blank/static frames on Windows
    )

    result = subprocess.run(
        cmd,
        cwd="remotion_project",
        capture_output=False,
        shell=True,
    )

    # Clean up temp props file
    props_path.unlink(missing_ok=True)

    if result.returncode != 0:
        console.print(Panel(
            "[red]Render failed![/red]\n\n"
            "Common fixes:\n"
            "- Run python setup.py first\n"
            "- Check the TSX for syntax errors\n"
            "- Run: cd remotion_project && npx remotion studio",
            title="Render Error", border_style="red"
        ))
        sys.exit(1)

    console.print(Panel(
        f"[bold green]Video rendered successfully![/bold green]\n\n"
        f"Output: [cyan]{output_path.resolve()}[/cyan]",
        title="Done", border_style="green"
    ))
    return output_path
