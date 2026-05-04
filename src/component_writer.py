from pathlib import Path
from rich.console import Console

console = Console(force_terminal=True, highlight=False)

COMPONENT_PATH = Path("remotion_project/src/compositions/EducationVideo.tsx")


def write_component(tsx_code: str) -> None:
    """Writes the AI-generated TSX to the Remotion project."""
    COMPONENT_PATH.parent.mkdir(parents=True, exist_ok=True)
    COMPONENT_PATH.write_text(tsx_code, encoding="utf-8")
    lines = len(tsx_code.split("\n"))
    console.print(f"[green][OK] Component written ({lines} lines) -> {COMPONENT_PATH}[/green]")
