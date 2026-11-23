import os
from openai import OpenAI
from dotenv import load_dotenv
from rich.console import Console

console = Console(force_terminal=True, highlight=False)
load_dotenv()

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
PRIMARY_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
FALLBACK_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
MIN_VALID_LINES = 80


def _call_nvidia(model_name: str, system_prompt: str, user_message: str) -> str:
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise ValueError("NVIDIA_API_KEY not found in .env file. Get one from https://build.nvidia.com")
    if not api_key.startswith("nvapi-"):
        raise ValueError("NVIDIA_API_KEY must start with 'nvapi-'")

    client = OpenAI(
        base_url=NVIDIA_BASE_URL,
        api_key=api_key,
        default_headers={"NVCF-POLL-SECONDS": "1800"},
    )

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        max_tokens=16384,
        temperature=0.25,
        top_p=0.95,
        extra_body={
            "chat_template_kwargs": {"enable_thinking": True},
            "reasoning_budget": 8192,
        },
    )
    return response.choices[0].message.content.strip()


def _clean(raw: str) -> str:
    for fence in ("```tsx", "```typescript", "```ts", "```jsx", "```"):
        if raw.startswith(fence):
            raw = raw.split("\n", 1)[1]
            break
    if raw.endswith("```"):
        raw = raw.rsplit("```", 1)[0]
    raw = raw.strip()

    import_anchor = 'import React from "react";'
    idx = raw.find(import_anchor)
    if idx != -1:
        raw = raw[idx:]

    return raw.strip()


def _is_complete(code: str) -> bool:
    lines = [l for l in code.strip().splitlines() if l.strip()]
    if len(lines) < MIN_VALID_LINES:
        return False
    tail = code.strip()[-30:].strip()
    return tail.endswith("};") or tail.endswith("}")


def _model_sequence(retry_with_error: str | None) -> tuple[str, ...]:
    if retry_with_error:
        return (PRIMARY_MODEL,)
    ordered = (PRIMARY_MODEL, FALLBACK_MODEL)
    deduped: list[str] = []
    for model in ordered:
        if model and model not in deduped:
            deduped.append(model)
    return tuple(deduped)


def get_component_from_nvidia(
    system_prompt: str,
    user_message: str,
    retry_with_error: str | None = None,
) -> str:
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
            console.print(f"[yellow]>> Calling NVIDIA {model_name}...[/yellow]")
            raw = _clean(_call_nvidia(model_name, system_prompt, msg))
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
            console.print(f"[red][FAIL] NVIDIA {model_name} failed: {e}[/red]")
            continue

    raise RuntimeError("All NVIDIA models failed. Check your NVIDIA_API_KEY and quota.")