import os
import anthropic
from dotenv import load_dotenv
from rich.console import Console

console = Console(force_terminal=True, highlight=False)
load_dotenv()

PRIMARY_MODEL  = "claude-sonnet-4-6"
FALLBACK_MODEL = "claude-haiku-4-5-20251001"

# Minimum lines for a valid full animation — short responses = truncated
MIN_VALID_LINES = 80


def _call_claude(model_name: str, system_prompt: str, user_message: str) -> tuple[str, str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not found in .env file.")
    
    client = anthropic.Anthropic(api_key=api_key)

    response = client.messages.create(
        model=model_name,
        system=system_prompt,
        max_tokens=8192,
        temperature=0.25,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )
    
    # Extract text from the response blocks
    text = ""
    for block in response.content:
        if block.type == 'text':
            text += block.text
            
    console.print(f"[dim]Stop reason: {response.stop_reason}[/dim]")
    return text.strip(), response.stop_reason


def _clean(raw: str) -> str:
    """Strip markdown code fences Claude sometimes wraps output in."""
    for fence in ("```tsx", "```typescript", "```ts", "```jsx", "```"):
        if raw.startswith(fence):
            raw = raw.split("\n", 1)[1]
            break
    if raw.endswith("```"):
        raw = raw.rsplit("```", 1)[0]
    raw = raw.strip()

    # Keep only the TypeScript file body if the model adds prose.
    import_anchor = 'import React from "react";'
    idx = raw.find(import_anchor)
    if idx != -1:
        raw = raw[idx:]

    return raw.strip()


def _is_complete(code: str, stop_reason: str) -> bool:
    """Check if the code is long enough and structurally complete."""
    lines = [l for l in code.strip().splitlines() if l.strip()]
    if len(lines) < MIN_VALID_LINES:
        return False

    tail = code.strip()[-60:].strip()
    looks_closed = tail.endswith("};") or tail.endswith("}")

    # Treat max_tokens as acceptable if the component appears structurally closed.
    if stop_reason == "max_tokens":
        return looks_closed

    return looks_closed


def _model_sequence(retry_with_error: str | None) -> tuple[str, ...]:
    """
    Keep costs down:
    - On first generation, try primary then fallback.
    - On compile-error retries, use primary only.
    """
    if retry_with_error:
        return (PRIMARY_MODEL,)
    return (PRIMARY_MODEL, FALLBACK_MODEL)


def get_component_from_claude(
    system_prompt: str,
    user_message: str,
    retry_with_error: str | None = None,
) -> str:
    """
    Calls Claude to generate a Remotion TSX component.
    Tries PRIMARY_MODEL first, falls back to FALLBACK_MODEL.
    If retry_with_error is provided, appends the compile error so Claude
    can self-correct.
    """
    msg = user_message
    if retry_with_error:
        msg += (
            "\n\n---\n"
            "Your previous response had this TypeScript compile error:\n"
            f"{retry_with_error}\n\n"
            "Fix ONLY the error above. Return the complete corrected file."
        )

    for model_name in _model_sequence(retry_with_error):
        try:
            console.print(f"[yellow]>> Calling {model_name}...[/yellow]")
            raw_text, stop_reason = _call_claude(model_name, system_prompt, msg)
            raw = _clean(raw_text)
            line_count = len([l for l in raw.splitlines() if l.strip()])
            console.print(f"[cyan]   Received {line_count} lines[/cyan]")

            if not _is_complete(raw, stop_reason):
                if retry_with_error and line_count >= MIN_VALID_LINES:
                    console.print(
                        "[yellow][WARN] Retry output may be partial; "
                        "returning it for local TypeScript validation.[/yellow]"
                    )
                    return raw
                console.print(
                    f"[red][WARN] Output looks truncated ({line_count} lines, "
                    f"min {MIN_VALID_LINES}). Retrying model...[/red]"
                )
                continue

            console.print("[green][OK] Component looks complete[/green]")
            return raw

        except Exception as e:
            console.print(f"[red][FAIL] {model_name} failed: {e}[/red]")
            continue

    raise RuntimeError("All Claude models failed. Check your API key and quota.")
