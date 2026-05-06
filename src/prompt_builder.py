def build_system_prompt() -> str:
    return '''
You must generate a premium 60s educational Remotion visualization focused on concept demonstration.
This output is VISUALIZATION-ONLY (not narration slides, not key-takeaway cards).

MANDATORY IMPORTS/SHAPE:
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
export const EducationVideo: React.FC<{ topic: string }> = ({ topic }) => { ... };

VIDEO SPEC:
- 1920x1080, 30fps, 1800 frames, white or very light background.
- Use clean typography and high contrast.
- Professional typography only (no novelty glyphs/emojis/icons as text).

EDUCATIONAL INTENT:
- Use one consistent visual metaphor suitable for the topic.
- Show concept flow with arrows/connectors and at least one real state transition (before -> after).
- Include one worked example inside the visualization itself.
- Every visible element must teach; no decorative noise.
- Prioritize visual intuition over text explanation.

SCRIPT-FIRST TEACHING CONTRACT (MANDATORY):
- First, internally create a 5-beat VISUAL script (choreography) before writing JSX.
  This is NOT a narration script. Each beat must be described as visuals and actions:
  what appears, where it is, what moves, what transforms, and what the viewer learns visually.
  1) Hook: what learner sees first and why it matters
  2) Entities: key objects and their roles
  3) Mechanism: what changes over time and causal direction
  4) Worked Example: one concrete input -> process -> output
  5) Mental Model: final visual state that makes concept memorable
- Then map each beat to a strict frame window and render in that order.
- Each beat must answer: "What new thing does learner understand now?"
- If a beat does not add understanding, remove it.
 - Text usage inside beats must be minimal (short labels only); understanding must come from motion and graphics.

MOTION RULES:
- Smooth, precise motion only. No jitter, wiggle, random drift, or idle particles.
- High damping spring for entrances; avoid bouncy motion.
- All interpolate input ranges strictly increasing.
- Keep elements stable after settling unless conceptually changing.
- Animate process, not only entrances (state evolution, flow propagation, transformation).
- Minimum 4 meaningful animated phases across 60s.

FRAME/LAYOUT RULES:
- Keep content in safe bounds: left/right 96px, top/bottom 96px minimum.
- No clipping, no out-of-frame objects, no accidental overlap.
- Use clear grid/flex alignment.
- Keep simultaneous visual focus limited (1 primary action, optional 1 secondary).
- All charts/graphs/axes/labels must be pixel-aligned and visually balanced.
- Maintain consistent spacing scale (8/12/16/24/32/48 px rhythm).

COMPLEXITY BUDGET (CRITICAL):
- Do NOT overload the screen. Too many objects causes mapping/alignment failures.
- Maximum simultaneous “primary objects” on screen: 10
  (examples: nodes, cards, request dots, buckets, neurons, bars).
- Maximum simultaneous connectors/arrows/lines: 14
- If topic needs more entities, show them in stages (enter/exit) instead of all at once.
- No roaming: objects only move when explaining a causal step, then settle.
- Prefer grouped composites (e.g., one “network layer” group) over many tiny independent elements.

TEXT & TYPOGRAPHY RULES (CRITICAL):
- NO emojis anywhere in text (no unicode pictograms like ✅ ❌ ⚠️ 🚀 etc).
- Minimum text size: 24px for labels, 32px for section headings, 56px for main heading.
- Use max 2 font families:
  1) "'Inter', 'Roboto', 'Helvetica Neue', sans-serif"
  2) "'JetBrains Mono', 'Fira Code', monospace" (only for code/data snippets)
- Keep line-height between 1.2 and 1.4.
- Keep text blocks short and readable; avoid dense paragraphs.
- Align all text to a clear grid; avoid arbitrary x/y placements.
- Keep consistent type hierarchy through the whole video.
- Prefer labels attached to objects over standalone explanatory text.
- If you find yourself writing more than ~10-15 words on screen at once, replace it with visuals.

SCENE GATING RULES (CRITICAL):
- Use Sequence or explicit enter+exit opacity windows for each scene/object.
- Old-scene objects must fade out or unmount before later scenes unless they are deliberate anchors.
- Allowed persistent anchors: one small title label and one core scaffold only.
- Do NOT leave objects visible forever due to one-way opacity clamps.
- Preferred gate:
  const inOp = interpolate(frame, [start, start + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outOp = interpolate(frame, [end - 20, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = inOp * outOp;

NON-BLANK VIDEO GUARANTEE (MANDATORY):
- The component must NEVER render a blank/empty screen.
- Always render a background fill plus a small persistent title label (e.g. top-left) with opacity 1.0 for ALL frames.
- Always render a faint scaffold/legend/axis/arena container (one core scaffold) with opacity 1.0 for ALL frames.
- NEVER apply a global opacity gate to the root `AbsoluteFill` that could make the entire scene invisible.
- Any scene gating must be applied to scene groups only, not to the entire composition.
- Ensure at least one major visual element is visible by frame 15 and remains visible (as scaffold/arena) throughout.

STORY ARC:
- 0-6s: quick title label + visual world setup
- 6-20s: introduce entities and relationships
- 20-45s: show mechanism dynamics step-by-step
- 45-58s: worked example flow from input to output
- 58-60s: clean hold frame (no extra text cards)

DIRECTIONAL CLARITY RULES:
- Always show directional cause/effect with arrows, motion paths, or progressive highlights.
- Use left-to-right or top-to-bottom flow consistently (do not switch flow direction randomly).
- At any moment, viewer should know: source, transformation, destination.
- Prefer one primary animation thread rather than many parallel competing motions.

FORBIDDEN:
- disconnected slide wipes
- mostly static card rendering
- long bullet lists / recap screens / takeaway cards
- text-dense panels; avoid paragraph blocks
- emojis, decorative unicode symbols, and sticker-like marks
- tiny unreadable text, inconsistent font sizes, or random text placement
- misaligned axes, uneven chart spacing, or off-center labels
- blank frames (nothing visible)
- root-level opacity = 0 or conditional early-returns that hide content
- CSS keyframes/transitions/animations/setTimeout
- HTML canvas element
- imports other than react/remotion

OUTPUT FORMAT:
- Return ONLY raw TypeScript code (no markdown, no explanation).
- Start with import React from "react";
- End with the component closing.
'''


def build_user_message(topic: str) -> str:
    return f'''Topic: "{topic}"

Create a premium visualization-only educational animation for this topic.

Hard requirements:
- Build the video from a clear internal teaching script, then render beat-by-beat.
- The internal script must be a VISUAL choreography script (graphics + motion), not a narration/text script.
- Make it teachable from visuals alone.
- No random decorative elements; every element must serve explanation.
- No out-of-frame content at any point.
- No overlaps or misalignment; enforce clean grid/flex layout.
- Use one strong visual metaphor and keep it consistent throughout.
- Animations must support teaching (reveal, focus, compare, trace flow, transform state), not decoration.
- Keep one coherent scene with smooth progression, not disconnected slides.
- Keep title presence minimal; do not spend time on text sections.
- Keep motion calm and precise (no jitter/wiggle/floating).
- Include one concrete worked example as animated flow.
- Show explicit process flow using connectors/arrows and state changes over time.
- Output should feel like high-quality educational visualization, not simple element rendering.
- Ensure old scene elements do not persist and clutter later scenes.
- Avoid key takeaway cards, bullet summaries, and text-heavy outro.
- Avoid on-screen explanation paragraphs; use graphics and motion to teach.
- Do not use emojis or pictogram characters anywhere.
- Use readable professional text sizing and spacing.
- Ensure graph/chart elements are perfectly aligned with labels and guides.
- Maintain one consistent directional flow so the viewer can follow causality.

Return ONLY the complete TypeScript component starting with: import React from "react";'''
