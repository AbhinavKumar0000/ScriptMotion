import subprocess
from pathlib import Path
from rich.console import Console

console = Console(force_terminal=True, highlight=False)


def validate_component() -> tuple[bool, str]:
    """
    Runs the TypeScript compiler (tsc --noEmit) inside the Remotion project
    to catch syntax and type errors BEFORE rendering.
    Returns (is_valid: bool, error_message: str).
    """
    result = subprocess.run(
        "npx tsc --noEmit --skipLibCheck",
        cwd="remotion_project",
        capture_output=True,
        text=True,
        shell=True,   # Required on Windows for npx.cmd resolution
    )

    if result.returncode == 0:
        console.print("[green][OK] TypeScript validation passed[/green]")
        return True, ""

    errors = result.stdout + result.stderr
    # Only surface errors in our generated component, not scaffold files (Root.tsx, etc.)
    relevant = [
        line for line in errors.splitlines()
        if "EducationVideo.tsx" in line
    ]

    if not relevant:
        # No errors in the generated component — other file errors are not our concern
        console.print("[green][OK] TypeScript validation passed (no errors in generated component)[/green]")
        return True, ""

    error_summary = "\n".join(relevant[:20])  # Cap at 20 lines
    console.print(f"[red][FAIL] TypeScript errors in generated component:[/red]\n{error_summary}")
    return False, error_summary
