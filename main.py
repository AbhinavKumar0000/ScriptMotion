import sys
from rich.console import Console
from rich.panel import Panel
from src.prompt_builder import build_system_prompt, build_user_message
from src.gemini_client import get_component_from_gemini
from src.component_writer import write_component
from src.validator import validate_component
from src.renderer import render_video

console = Console(force_terminal=True, highlight=False)
MAX_RETRIES = 2


def run(topic: str):
    console.print(Panel(
        f"[bold cyan]Educational Video Pipeline[/bold cyan]\n\n"
        f"Topic: [yellow]{topic}[/yellow]",
        border_style="cyan"
    ))

    system_prompt = build_system_prompt()
    user_message  = build_user_message(topic)

    last_error: str | None = None

    for attempt in range(1, MAX_RETRIES + 2):
        if attempt > 1:
            console.print(
                f"[yellow]Retry {attempt - 1}/{MAX_RETRIES} — "
                "sending compile error back to Gemini...[/yellow]"
            )

        # Step 1: Generate component (or regenerate with error context)
        tsx_code = get_component_from_gemini(
            system_prompt,
            user_message,
            retry_with_error=last_error,
        )

        # Step 2: Write to Remotion project
        write_component(tsx_code)

        # Step 3: TypeScript compile check
        valid, error = validate_component()
        if valid:
            break

        last_error = error
        if attempt == MAX_RETRIES + 1:
            console.print(Panel(
                f"[red]Failed after {MAX_RETRIES} retries.[/red]\n\n"
                "The TypeScript component still has errors.\n"
                "Inspect manually:\n"
                "  cd remotion_project && npx remotion studio",
                title="Error", border_style="red"
            ))
            sys.exit(1)

    # Step 4: Render to MP4
    output_path = render_video(topic)
    console.print(f"\n[bold green]Done![/bold green] Video saved to:\n{output_path.resolve()}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        run(" ".join(sys.argv[1:]))
    else:
        console.print("[red]Usage: python main.py 'Topic'[/red]")
        sys.exit(1)
