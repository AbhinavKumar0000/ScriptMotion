"""
ScriptMotion: Model-Agnostic Agentic Orchestration for Declarative Motion Graphics Compilation

Script-first flow:
  1. Classify topic
  2. Generate teaching script (narration + visual beats) via LLM
  3. Generate Remotion component from script context via LLM
  4. Validate TypeScript (tsc + QA gate)
  5. Render MP4 via Remotion
"""

import argparse
from dataclasses import asdict
import asyncio
import json
import sys
import time
from pathlib import Path

from rich.console import Console
from rich.panel import Panel

from src.component_writer import write_component
from src.errors import PipelineError
from src.pipeline.adaptivePipeline import PipelineContext, runPipeline
from src.prompt_builder import build_script_prompt, build_user_message, build_system_prompt
from src.providers import ProviderRegistry, providerRegistry, GeminiProvider, ClaudeProvider, NVIDIAProvider
from src.renderer import render_video
from src.script_generator import script_to_context, TeachingScript, VisualBeat, BeatType
from src.topic_classifier import classify_topic as classifyTopic
from src.validator import validate_component
from src.video_spec import VideoSpec

console = Console(force_terminal=True, highlight=False)
MAX_RETRIES = 2

PROVIDER_LABELS = {
    "gemini": "Gemini",
    "claude": "Claude",
    "nvidia": "NVIDIA Nemotron",
}

DEFAULT_DURATION = 60


def _write_result(path: str, payload: dict) -> None:
    result_path = Path(path)
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _initialize_providers(registry: ProviderRegistry) -> None:
    registry.register(GeminiProvider())
    registry.register(ClaudeProvider())
    registry.register(NVIDIAProvider())


async def _initialize_provider(registry: ProviderRegistry, provider_name: str) -> None:
    provider = registry.get(provider_name)
    if not provider:
        raise PipelineError(f"Unknown provider: {provider_name}")

    import os
    from dotenv import load_dotenv
    load_dotenv()

    api_key_map = {
        "gemini": os.getenv("GEMINI_API_KEY"),
        "claude": os.getenv("ANTHROPIC_API_KEY"),
        "nvidia": os.getenv("NVIDIA_API_KEY"),
    }

    api_key = api_key_map.get(provider_name)
    if not api_key:
        raise PipelineError(f"API key not found for {provider_name}. Set {provider_name.upper()}_API_KEY in .env")

    model_map = {
        "gemini": "gemini-2.5-pro",
        "claude": "claude-sonnet-4-6",
        "nvidia": "nvidia/nemotron-3-ultra-550b-a55b",
    }

    await provider.initialize({
        "apiKey": api_key,
        "model": model_map[provider_name],
        "temperature": 0.25,
        "maxTokens": 65536,
        "timeout": 120,
    })


async def _generate_script(provider, topic: str, topic_type: str, instructions: str | None) -> TeachingScript:
    """Step 2: Generate the teaching script (narration + visual beats) via LLM."""
    system_prompt = build_script_prompt(topic, topic_type, instructions)

    # Use the provider's generate_spec endpoint to get JSON
    raw = await provider.generate_spec({
        "topic": topic,
        "topic_type": topic_type,
        "instructions": instructions or "",
        "task": "script",
    })

    # The provider returns JSON; we need to inject the system prompt.
    # Since generate_spec doesn't take a system_prompt param, we call the
    # provider directly via a custom path. For now, parse what we get.
    if isinstance(raw, dict):
        beats = []
        for b in raw.get("beats", []):
            beats.append(VisualBeat(
                id=b.get("id", ""),
                type=BeatType(b.get("type", "hook")),
                title=b.get("title", ""),
                narration=b.get("narration", ""),
                visual_intent=b.get("visual_intent", ""),
                start_frame=b.get("start_frame", 0),
                end_frame=b.get("end_frame", 180),
                elements=b.get("elements", []),
                emphasis_words=b.get("emphasis_words", []),
            ))
        return TeachingScript(
            topic=topic,
            topic_type=topic_type,
            subcategory=raw.get("subcategory"),
            grade_level=raw.get("grade_level"),
            core_message=raw.get("core_message", ""),
            metaphor=raw.get("metaphor", ""),
            beats=beats,
            estimated_duration_seconds=raw.get("estimated_duration_seconds", DEFAULT_DURATION),
            learning_objectives=raw.get("learning_objectives", []),
        )

    raise PipelineError(f"Script generation returned unexpected format: {type(raw)}")


def _spec_to_tsx(script_context: dict, template_name: str, instructions: str | None) -> str:
    """Generate TSX from script context using the premium prompt."""
    system_prompt = build_system_prompt()
    user_message = build_user_message(script_context, instructions)

    # Combine system + user into one message for the provider
    full_prompt = f"{system_prompt}\n\n{user_message}"

    # Return the prompt so the caller can pass it to the provider
    return full_prompt


async def _generate_component_from_script(
    provider,
    script: TeachingScript,
    instructions: str | None,
) -> str:
    """Step 3: Generate the Remotion component from the teaching script."""
    script_context = script_to_context(script)

    # Build the premium prompt
    system_prompt = build_system_prompt()
    user_message = build_user_message(script_context, instructions)
    full_prompt = f"{system_prompt}\n\n{user_message}"

    # Call provider with the full prompt as a "component" task
    raw = await provider.generate_spec({
        "topic": script.topic,
        "topic_type": script.topic_type,
        "instructions": instructions or "",
        "task": "component",
        "prompt": full_prompt,
    })

    # If the provider returns a dict (VideoSpec), convert to TSX using templates
    if isinstance(raw, dict):
        return _dict_to_tsx(raw, script)

    # If it returns a string, assume it's already TSX
    if isinstance(raw, str):
        return raw

    raise PipelineError(f"Component generation returned unexpected format: {type(raw)}")


def _dict_to_tsx(spec_dict: dict, script: TeachingScript) -> str:
    """Convert a VideoSpec dict to TSX using the appropriate template."""
    scenes = spec_dict.get("scenes", [])
    if not scenes:
        raise PipelineError("No scenes in VideoSpec")

    scene = scenes[0]
    scene_type = scene.get("type", "concept-map")
    total_frames = sum(s.get("duration_frames", 1800) for s in scenes) or 1800

    template_imports = {
        "concept-map": "ConceptMapScene",
        "network-flow": "NetworkFlowScene",
        "timeline": "TimelineScene",
        "math-derivation": "MathDerivationScene",
        "chemistry-reaction": "ChemistryReactionScene",
        "physics-simulation": "PhysicsSimulationScene",
        "biology-diagram": "BiologyDiagramScene",
        "system-design": "SystemDesignScene",
        "code-walkthrough": "CodeWalkthroughScene",
        "terminal": "CodeWalkthroughScene",
        "diff": "CodeWalkthroughScene",
        "call-stack": "CodeWalkthroughScene",
        "memory-diagram": "CodeWalkthroughScene",
        "file-tree": "CodeWalkthroughScene",
        "chart": "PhysicsSimulationScene",
        "quiz": "CodeWalkthroughScene",
        "recap": "CodeWalkthroughScene",
    }

    template_name = template_imports.get(scene_type, "ConceptMapScene")

    scene_props = {
        "title": script.topic,
        "subtitle": script.core_message,
        "durationFrames": total_frames,
        "beats": [
            {
                "id": b.get("id", ""),
                "name": b.get("title", ""),
                "startFrame": b.get("start_frame", 0),
                "endFrame": b.get("end_frame", 180),
                "elements": b.get("elements", []),
            }
            for b in script.beats
        ],
    }

    # Add scene-specific props
    if scene_type == "concept-map" and scene.get("graph"):
        scene_props["nodes"] = scene["graph"].get("nodes", [])
        scene_props["edges"] = scene["graph"].get("edges", [])
    elif scene_type == "network-flow" and scene.get("graph"):
        scene_props["layers"] = scene["graph"].get("nodes", [])
        scene_props["connections"] = scene["graph"].get("edges", [])
    elif scene_type == "math-derivation":
        scene_props["problem"] = script.topic
        scene_props["steps"] = scene.get("layout_config", {}).get("steps", [])
    elif scene_type == "chemistry-reaction" and scene.get("layout_config", {}).get("reaction"):
        scene_props["reactants"] = scene["layout_config"]["reaction"].get("reactants", [])
        scene_props["products"] = scene["layout_config"]["reaction"].get("products", [])
        scene_props["conditions"] = scene["layout_config"]["reaction"].get("conditions", {})
    elif scene_type == "physics-simulation":
        scene_props["simulationType"] = "projectile"
        scene_props["parameters"] = scene.get("layout_config", {}).get("parameters", {})
        scene_props["initialState"] = {}
        scene_props["equations"] = scene.get("layout_config", {}).get("equations", [])
    elif scene_type == "biology-diagram" and scene.get("layout_config", {}).get("structures"):
        scene_props["structures"] = scene["layout_config"]["structures"]
        scene_props["processes"] = scene.get("layout_config", {}).get("processes", [])
    elif scene_type == "system-design" and scene.get("layout_config", {}).get("architecture"):
        scene_props["components"] = scene["layout_config"]["architecture"].get("components", [])
        scene_props["connections"] = scene["layout_config"]["architecture"].get("connections", [])
        scene_props["requirements"] = scene.get("layout_config", {}).get("requirements", [])
    elif scene_type == "code-walkthrough" and scene.get("code_blocks"):
        scene_props["language"] = scene["code_blocks"][0].get("language", "text")
        scene_props["files"] = scene["code_blocks"]
        scene_props["executionTrace"] = scene.get("layout_config", {}).get("trace", [])

    props_json = json.dumps(scene_props, indent=2)

    prop_strings = []
    for k, v in scene_props.items():
        if isinstance(v, str):
            escaped = v.replace("`", "\\`")
            prop_strings.append(f'{k}=`{escaped}`')
        else:
            prop_strings.append(f'{k}={{{json.dumps(v)}}}')

    tsx = f'''import React from "react";
import {{ AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence }} from "remotion";
import {{ {template_name} }} from "./templates";

const FONT_FAMILY_SANS = "'Inter', 'Roboto', 'Helvetica Neue', sans-serif";
const FONT_FAMILY_MONO = "'JetBrains Mono', 'Fira Code', monospace";
const SAFE_AREA_PADDING = 96;

export const EducationVideo: React.FC<{{ topic: string }}> = ({{ topic }}) => {{
  const {{ width, height, fps, durationInFrames }} = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <{template_name} {' '.join(prop_strings)} />
  );
}};'''

    return tsx


async def run(
    topic: str,
    client: str = "gemini",
    concurrency: int = 2,
    instructions: str | None = None,
    duration: int = DEFAULT_DURATION,
    audience: str = "beginner",
) -> Path:
    console.print(Panel(
        f"[bold cyan]ScriptMotion (Script-First)[/bold cyan]\n\n"
        f"Topic: [yellow]{topic}[/yellow]\n"
        f"Client: [yellow]{PROVIDER_LABELS.get(client, client)}[/yellow]\n"
        f"Duration: [yellow]{duration}s[/yellow]\n"
        f"Concurrency: [yellow]{concurrency}[/yellow]",
        border_style="cyan"
    ))

    if instructions:
        console.print(f"[dim]Extra direction: {instructions}[/dim]")

    # Incorporate audience into instructions for the LLM
    audience_prefix = f"Target audience: {audience}."
    if instructions:
        effective_instructions = f"{audience_prefix} {instructions}"
    else:
        effective_instructions = audience_prefix

    registry = ProviderRegistry()
    _initialize_providers(registry)
    await _initialize_provider(registry, client)

    provider = registry.get(client)
    if not provider:
        raise PipelineError(f"Provider {client} not found")

    # Step 1: Classify topic
    classification = classifyTopic(topic, instructions or "")
    console.print(f"[cyan]Detected topic type: {classification.topic_type.value} (confidence: {classification.confidence:.0%})[/cyan]")
    if classification.subcategory:
        console.print(f"[cyan]Subcategory: {classification.subcategory}[/cyan]")
    if classification.grade_level:
        console.print(f"[cyan]Grade level: Class {classification.grade_level}[/cyan]")

    # Step 2: Generate teaching script (narration + visual beats)
    console.print("[cyan]Step 1/3: Generating teaching script...[/cyan]")
    script = await _generate_script(provider, topic, classification.topic_type.value, effective_instructions)
    console.print(f"[green][OK] Script generated with {len(script.beats)} beats[/green]")
    console.print(f"[cyan]Core message: {script.core_message}[/cyan]")
    console.print(f"[cyan]Metaphor: {script.metaphor}[/cyan]")

    # Step 3: Generate Remotion component from script
    console.print("[cyan]Step 2/3: Generating Remotion component...[/cyan]")
    tsx_code = await _generate_component_from_script(provider, script, effective_instructions)

    # Clean TSX (strip markdown fences if provider added them)
    for fence in ("```tsx", "```typescript", "```ts", "```jsx", "```"):
        if tsx_code.startswith(fence):
            tsx_code = tsx_code.split("\n", 1)[1]
            break
    if tsx_code.endswith("```"):
        tsx_code = tsx_code.rsplit("```", 1)[0]
    tsx_code = tsx_code.strip()

    write_component(tsx_code)

    # Step 4: Validate
    console.print("[cyan]Step 3/3: Validating TypeScript...[/cyan]")
    valid, error = validate_component()
    if not valid:
        console.print(f"[red][FAIL] Validation errors:[/red]\n{error}")
        # Retry with error feedback
        for attempt in range(1, MAX_RETRIES + 1):
            console.print(f"[yellow]Retry {attempt}/{MAX_RETRIES} — sending compile error back to {PROVIDER_LABELS.get(client, client)}...[/yellow]")
            try:
                fix_prompt = f"""{build_system_prompt()}

PREVIOUS COMPONENT HAD THESE TYPESCRIPT ERRORS:
{error}

Fix ONLY the errors above. Return the complete corrected component.
Target audience: {audience}.
Start with: import React from "react";
End with the component closing brace."""
                tsx_code = await provider.generate_spec({
                    "topic": topic,
                    "topic_type": classification.topic_type.value,
                    "instructions": effective_instructions or "",
                    "task": "fix",
                    "prompt": fix_prompt,
                    "previous_code": tsx_code,
                })
                if isinstance(tsx_code, str):
                    for fence in ("```tsx", "```typescript", "```ts", "```jsx", "```"):
                        if tsx_code.startswith(fence):
                            tsx_code = tsx_code.split("\n", 1)[1]
                            break
                    if tsx_code.endswith("```"):
                        tsx_code = tsx_code.rsplit("```", 1)[0]
                    tsx_code = tsx_code.strip()
                    write_component(tsx_code)
                    valid, error = validate_component()
                    if valid:
                        break
            except Exception as e:
                console.print(f"[red]Fix attempt {attempt} failed: {e}[/red]")

    if not valid:
        raise PipelineError(
            f"The TypeScript component still has errors after retries.\n"
            f"Last error: {error}\n"
            f"Inspect manually: cd remotion_project && npx remotion studio"
        )

    console.print("[green][OK] TypeScript validation passed[/green]")

    # Step 5: Render
    console.print("[cyan]Rendering video...[/cyan]")
    output_path = render_video(topic, concurrency=concurrency)
    console.print(f"\n[bold green]Done![/bold green] Video saved to:\n{output_path.resolve()}")
    return output_path


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate and render an educational Remotion video.",
    )
    parser.add_argument("topic", nargs="+", help="Video topic")
    parser.add_argument(
        "--provider",
        "--client",
        dest="provider",
        default="gemini",
        choices=sorted(PROVIDER_LABELS.keys()),
        help="LLM provider (default: gemini)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=2,
        help="Remotion render concurrency, 1-8 (default: 2)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=DEFAULT_DURATION,
        help=f"Target video duration in seconds (default: {DEFAULT_DURATION})",
    )
    parser.add_argument(
        "--instructions",
        default=None,
        help="Extra direction for the model (audience, metaphor, constraints)",
    )
    parser.add_argument(
        "--result-file",
        default=None,
        help="Write a JSON build result to this path",
    )
    args = parser.parse_args()
    if not 1 <= args.concurrency <= 8:
        parser.error("--concurrency must be between 1 and 8")
    return args


def main() -> int:
    args = _parse_args()
    topic = " ".join(args.topic).strip()
    started = time.time()
    result = {
        "ok": False,
        "topic": topic,
        "provider": args.provider,
        "concurrency": args.concurrency,
    }

    try:
        output_path = asyncio.run(run(
            topic,
            client=args.provider,
            concurrency=args.concurrency,
            instructions=args.instructions,
            duration=args.duration,
            audience=args.audience,
        ))
        result.update({
            "ok": True,
            "video": output_path.as_posix(),
            "elapsed_seconds": round(time.time() - started, 2),
        })
        if args.result_file:
            _write_result(args.result_file, result)
        return 0
    except Exception as exc:
        result.update({
            "ok": False,
            "error": str(exc),
            "elapsed_seconds": round(time.time() - started, 2),
        })
        if args.result_file:
            _write_result(args.result_file, result)
        console.print(Panel(
            f"[red]Build failed[/red]\n\n{exc}",
            title="Error",
            border_style="red",
        ))
        return 1


if __name__ == "__main__":
    sys.exit(main())
