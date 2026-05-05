import os
import google.generativeai as genai
from dotenv import load_dotenv
from rich.console import Console

console = Console(force_terminal=True, highlight=False)
load_dotenv()

PRIMARY_MODEL  = "gemini-2.5-pro"
FALLBACK_MODEL = "gemini-2.5-pro"

# Minimum lines for a valid full animation — short responses = truncated
MIN_VALID_LINES = 80


def _call_gemini(model_name: str, system_prompt: str, user_message: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in .env file.")
    genai.configure(api_key=api_key)

    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.25,         # Lower = more syntactically correct code
            max_output_tokens=65536,  # Gemini 2.5 Flash supports large outputs
            candidate_count=1,
        )
    )
    response = model.generate_content(user_message)
    return response.text.strip()


def _clean(raw: str) -> str:
    """Strip markdown code fences Gemini sometimes wraps output in."""
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


def _is_complete(code: str) -> bool:
    """Basic structural check: long enough and ends with a closing brace."""
    lines = [l for l in code.strip().splitlines() if l.strip()]
    if len(lines) < MIN_VALID_LINES:
        return False
    tail = code.strip()[-30:].strip()
    return tail.endswith("};") or tail.endswith("}")


def _model_sequence(retry_with_error: str | None) -> tuple[str, ...]:
    """
    Keep costs down:
    - On first generation, try primary then fallback (deduplicated).
    - On compile-error retries, hit primary only to avoid duplicate paid calls.
    """
    if retry_with_error:
        return (PRIMARY_MODEL,)
    ordered = (PRIMARY_MODEL, FALLBACK_MODEL)
    deduped: list[str] = []
    for model in ordered:
        if model and model not in deduped:
            deduped.append(model)
    return tuple(deduped)


def get_component_from_gemini(
    system_prompt: str,
    user_message: str,
    retry_with_error: str | None = None,
) -> str:
    """
    Calls Gemini to generate a Remotion TSX component.
    Tries PRIMARY_MODEL first, falls back to FALLBACK_MODEL.
    If retry_with_error is provided, appends the compile error so Gemini
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
            raw = _clean(_call_gemini(model_name, system_prompt, msg))
            line_count = len([l for l in raw.splitlines() if l.strip()])
            console.print(f"[cyan]   Received {line_count} lines[/cyan]")

            if not _is_complete(raw):
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

    raise RuntimeError("All Gemini models failed. Check your API key and quota.")
