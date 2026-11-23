# Roadmap

Goal: make the harness produce consistently good educational videos with any LLM, and scale from 60-second concept clips to chaptered, code-first lessons.

## Principles

1. **The LLM is a director, not a renderer.** It writes content and intent, not absolute coordinates.
2. **The renderer owns visual grammar.** Design tokens, layout, connectors, typography, motion, and safe areas are code, not prompt suggestions.
3. **Model-agnostic by contract.** Every provider implements the same typed interface. Swapping models is a config change.
4. **Validate visually, not just syntactically.** `tsc` passing is not the same as a good frame.
5. **Teach, do not decorate.** Every element must support a learning goal.
6. **Long-form means chapters, not one long monologue.** Research on video engagement favors short, well-segmented lessons.

## Phase 0 - Stabilize and ship the local studio

Status: complete for the local harness; real-provider end-to-end build pending.

### Tasks

- [x] Single-terminal local web UI (`python app.py`).
- [x] Dark, terminal-inspired UI with live logs and stage tracking.
- [x] Provider selector: Gemini, Claude, NVIDIA Nemotron.
- [x] Topic, extra direction, concurrency controls.
- [x] Streaming build logs over SSE.
- [x] Finished-video player, download, open-folder, history.
- [x] Renderer concurrency fallback (`2` -> `1`).
- [x] Rewrite the generated component with SVG connectors.
- [x] Boundary anchors instead of node-center lines.
- [x] Safe-area enforcement for title, cards, and panels.
- [x] Contrast-safe palette.
- [x] Remove duplicate edge labels; move dense values to a side panel.
- [x] Remove the empty "hide previous beats" block.
- [x] Flow packets follow real edges.
- [x] Mental-model overlays avoid the diagram.
- [x] Prompt rules for SVG, safe area, contrast, deduplication, flow, overlays.

### Acceptance criteria

- One command starts the UI and a build end-to-end.
- Logs show generation, validation, render progress, and completion.
- The video is playable in the UI and seekable.
- No connector is a rotated `div`.
- No card is outside the 96px safe area.
- No duplicate weight labels at identical coordinates.
- No blank frames.
- Title and body text pass WCAG contrast.
- A failed render with concurrency 2 retries with 1.

### Verification (2026-11-23)

- `python -m compileall -q main.py app.py src` passed.
- `npx tsc --noEmit` passed in `remotion_project/`.
- Keyframe stills at frames 500, 1300, 1500, 1600, and 1700 rendered and were visually inspected for safe area, contrast, connectors, label overlap, and edge/flow state.
- A 31-frame `npx remotion render ... --concurrency 2 --gl=angle` smoke render passed.
- `app.py` smoke tests passed: health, history, root, 404, invalid build payloads, SSE failed-job lifecycle, HTTP Range `206`, and HEAD `200`.
- UI rendered headlessly at 1440x1000 and was visually inspected.
- Renderer fallback `2 -> 1` passed with a mocked first failure.

### Remaining verification

- [ ] One real-provider build end-to-end with a valid key.
- [ ] Browser click-through: submit, watch logs, play/seek, stop, open folder.
- [ ] Full 1800-frame render timing and memory check.

## Phase 1 - Typed storyboard and deterministic design system

Status: next.

The biggest architectural unlock. Stop asking the model to write 500 lines of laid-out TSX.

### Tasks

- [ ] Define `VideoSpec` with Pydantic + JSON Schema.
- [ ] Add a provider interface: `plan`, `narrate`, `critique`.
- [ ] Make every adapter return `VideoSpec`, not TSX.
- [ ] Schema validation + repair loop (send validation errors back).
- [ ] Design tokens: color roles, type scale, spacing, radii, stroke, z-index, motion.
- [ ] Primitive library: `SafeArea`, `Title`, `Card`, `Node`, `Edge`, `Label`, `Badge`, `Callout`, `CodePanel`, `Terminal`, `StepList`, `Comparison`, `Chart`, `Progress`, `Quiz`.
- [ ] Scene templates: `concept-map`, `network-flow`, `timeline`, `comparison`, `code-walkthrough`, `terminal`, `diff`, `call-stack`, `memory-diagram`, `file-tree`, `chart`, `quiz`, `recap`.
- [ ] Auto-layout: CSS grid/flex for panels, ELK.js/dagre for graphs.
- [ ] Text measurement: `measureText`, `fitText`, overflow assertions.
- [ ] Collision pass: bounding boxes, overlap detection, safe-area assertions.
- [ ] SVG connector primitives with markers and boundary anchors.
- [ ] Golden-topic tests and snapshot fixtures.
- [ ] Keep a TSX escape hatch only for approved custom scenes.

### Acceptance criteria

- Same spec renders the same video with Gemini, Claude, and Nemotron.
- No model-authored CSS or absolute coordinates.
- Schema-invalid responses are repaired without a TypeScript round trip.
- Golden topics render without overlap, overflow, or safe-area violations.
- Swapping providers changes content quality, not visual quality.

## Phase 2 - Code videos, narration, and longer lessons

Status: planned.

### Tasks

- [ ] Shiki syntax highlighting with `delayRender`/`continueRender`.
- [ ] Shiki transformers: line highlight, focus, diff, error level.
- [ ] Shiki Magic Move for token-level code transitions.
- [ ] Code Hike-style scrollycoding and annotations.
- [ ] Code panel primitives: line numbers, active line, dimmed lines, callouts, type hints.
- [ ] Real execution traces: Python `sys.settrace`/`bdb`, sandboxed JS interpreter, Node inspector.
- [ ] Call stack, heap, and variable panels driven by real traces.
- [ ] Terminal replay from captured output (no invented commands).
- [ ] Diff/test arc: failing test -> fix -> passing test.
- [ ] Code-to-visual linking: highlight the line that matches the current animation step.
- [ ] TTS adapter (ElevenLabs, Google, Azure, OpenAI, local).
- [ ] Per-scene audio durations via `calculateMetadata`.
- [ ] Captions and transcripts via `@remotion/captions`.
- [ ] Music bed with ducking; no music under dense explanation.
- [ ] Chapters: 3-6 minute segments, `<Series>` and `<TransitionSeries>`.
- [ ] Pause-and-predict, retrieval prompts, recap.
- [ ] Dynamic duration; no hardcoded 1800 frames.

### Acceptance criteria

- A code walkthrough shows real execution state, not hallucinated values.
- A 20-minute lesson is a sequence of 3-6 minute chapters with markers.
- Captions align with narration.
- No hardcoded 60-second limit.
- Every chapter has a clear learning goal and a recap/check.

## Phase 3 - Automated visual QA and model evals

Status: planned.

### Tasks

- [ ] `renderStill` at scene starts, mid-motion, settles, and ends.
- [ ] Geometry checks: safe area, overlap, overflow, duplicate positions, connector endpoints.
- [ ] Contrast checks from tokens and pixels.
- [ ] Blank-frame and font-load checks.
- [ ] DOM bounding-box extraction from the Remotion preview (Playwright).
- [ ] Pixel/SSIM regression against approved golden frames.
- [ ] VLM critic with a rubric, JSON findings, evidence, severity, bounding boxes.
- [ ] Calibrate the VLM judge against human labels; deterministic checks block first.
- [ ] CI: render keyframes on every prompt/schema/renderer change.
- [ ] Golden-topic eval set across providers.
- [ ] Cost/latency/reliability dashboard.
- [ ] Human review in Remotion Studio.

### Acceptance criteria

- Off-screen cards, overlaps, and low-contrast text fail before the final render.
- Visual regressions are caught by CI.
- Model comparisons use the same spec and rubric.
- Human review time per video drops significantly.

## Phase 4 - Scale and polish

Status: planned.

### Tasks

- [ ] More scene templates and visual metaphors.
- [ ] Topic-to-template routing.
- [ ] RAG/grounding for factual topics; citations.
- [ ] Sandboxed code execution for examples.
- [ ] Asset pipeline: fonts, icons, images, data.
- [ ] Draft/final quality presets.
- [ ] Segment rendering and caching by spec/theme/renderer hash.
- [ ] Remotion Lambda or Cloud Run for scale.
- [ ] Analytics: completion, drop-off, rewatching.
- [ ] Internationalization: voices, captions, translated scripts.
- [ ] Accessibility: transcripts, audio description, colorblind-safe palette.

## Metrics

- Schema validity: 100%.
- Compile success: >99%.
- Render success: >99%.
- Safe-area/overlap/contrast/blank-frame violations: 0 on keyframes.
- Golden-frame regression diff: <1%.
- Human visual rubric and teaching rubric scores.
- Cost per finished minute; render time; time to swap models.
- Chapter completion and drop-off for long-form content.

## Non-goals for Phase 0

- Replacing the TSX pipeline with JSON (Phase 1).
- Full code-execution tracing (Phase 2).
- Cloud rendering (Phase 4).
- Multi-user auth or remote deployment.
