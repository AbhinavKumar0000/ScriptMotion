"""
Premium educational video prompt builder.

Applies Remotion Craft rules + cognitive load theory + educational best practices
to prevent AI slop. Every rule is derived from research on what makes AI-generated
Remotion videos look generic vs. studio-quality.

Key research sources:
- Remotion Craft (remocn.dev/docs/craft) - 8 mistakes that make AI videos look generic
- Mayer's Cognitive Theory of Multimedia Learning
- Sweller's Cognitive Load Theory
- Wouters et al. (2008) - Animated models design guidelines
- DEV Community - Remotion explainer video QA gate (21 checks)
"""


# ── Anti-AI-Slop Rules (Remotion Craft) ──────────────────────────────────────

ANTI_SLOP_RULES = """
ANTI-AI-SLOP RULES (MANDATORY - these replace generic AI defaults):

1. NO glow halos, blur >24px, or heavy drop shadows behind headings/cards.
   Use solid fills or slow, muted shaders only. No feDropShadow stdDeviation > 3.

2. NO gradient-filled text as emphasis. Use solid text color, font-weight,
   accent color, or a highlight box to mark the one word that matters.

3. NO ALL-CAPS with wide letter-spacing. Use sentence case, default tracking.

4. NOTHING enters on the same frame. Stagger sibling entrances by 3-6 frames.
   One focal action per beat. Never animate 10 things simultaneously.

5. Animations must NOT be cut off mid-motion. Budget each Sequence or beat
   at least the component's natural length. No abrupt stops.

6. NO CSS transitions, CSS animations, @keyframes, Tailwind animate classes,
   setTimeout, setInterval, or Date.now(). All motion must use useCurrentFrame()
   + interpolate() or spring() only.

7. NO Math.random() or Date.now() in render code (flickers between frames).
   Use seeded random from @remotion/random or derive everything from frame.

8. NO animating top/left/width/height. Animate transform, translate, scale,
   opacity only (GPU-composited, no layout thrashing).
"""

# ── Educational Quality Rules (Cognitive Load Theory) ────────────────────────

EDUCATIONAL_RULES = """
EDUCATIONAL QUALITY RULES (MANDATORY):

A. SEGMENTING - Chunk information into small segments. One concept per scene.
   Beat durations: hook 5-10s, intro 10-20s, content 20-40s, summary 10-20s, outro 5-10s.

B. SIGNALING - Use on-screen cues to highlight important information.
   Color change, underline, or arrow to direct attention to the key element.
   Max 7 words on screen at once (QA gate).

C. WEEDING - Eliminate extraneous information. No decorative particles,
   background music visualization, complex backgrounds, or extra features
   that don't serve the learning goal.

D. MODALITY - Use auditory (narration) + visual channels complementarily.
   Narration explains; visuals illustrate. Never show paragraphs of text
   while narrating (overloads the visual channel).

E. PACING - ~145 words per minute. Internal pauses clamped to 0.18s.
   Exactly one deliberate pause ≤ 0.6s before the key reveal.

F. BODY TEXT ≥ 32px at 1920x1080. Section headings ≥ 40px. Main heading ≥ 56px.
   Max 2 font families. Consistent type hierarchy.

G. VISUAL RICHNESS - Every scene must have at least one non-text visual subject
   (SVG illustration, chart, animated graphic). No text-only cards + boxes.
   Flow diagrams must use icons/illustrations with text, not just colored boxes.

H. CONSISTENT METAPHOR - One visual metaphor runs through the entire video.
   Don't switch metaphors mid-video.
"""

# ── Motion & Layout Rules ────────────────────────────────────────────────────

MOTION_LAYOUT_RULES = """
MOTION & LAYOUT RULES (MANDATORY):

I. NARRATION-SYNCED TIMING - Visual elements that illustrate narrated concepts
   MUST derive their timing from AUDIO_SEGMENTS (narration start frames), not
   hardcoded "visual rhythm" numbers. Correct: arrow appears when narrator says
   the concept. Wrong: arrow appears at frame 30 because it "looks good".

J. SAFE AREA - Content inside 96px margins. Title at top >= 96px.
   No clipping, no out-of-frame objects, no accidental overlap.

K. CONNECTORS - Draw all edges/arrows in a single SVG <line> or <path> layer.
   Define arrowheads with <defs><marker> and reference with markerEnd.
   Never use rotated divs, CSS triangles, or borders as arrowheads.
   Anchor connectors on node boundaries (center +/- radius), never on centers.

L. COMPLEXITY BUDGET - Max 10 simultaneous primary objects, 14 connectors.
   If topic needs more, show them in stages (enter/exit) instead of all at once.
   Objects only move when explaining a causal step, then settle.

M. SCENE GATING - Use Sequence or enter+exit opacity windows. Old-scene objects
   fade out before later scenes. Persistent anchors: one small title + one scaffold.
   Never apply root-level opacity that hides the entire composition.

N. NON-BLANK GUARANTEE - Never render a blank screen. Background fill +
   persistent title label + one scaffold visible at ALL frames.
   At least one major visual element visible by frame 15.
"""

# ── QA Gate (from DEV Community 21-check) ────────────────────────────────────

QA_GATE = """
QA GATE (automated checks - component must pass all):

- Pace: ~145 wpm ± 10%
- ≤ 7 words on screen at once
- No linear easing - use Easing.bezier() or Easing.spring() only
- Body text ≥ 32px at 1920x1080
- Max 2 font families
- No black frames / blank screens
- One CTA (call to action) at end
- No CSS transitions/animations/@keyframes
- All animations use useCurrentFrame() + interpolate/spring
"""


def build_system_prompt() -> str:
    return f"""You are an expert educational video director and Remotion motion designer.
You produce premium 60-second educational animations that do NOT look like AI slop.

ANTI-AI-SLOP PHILOSOPHY:
Most AI Remotion videos look generic because they fall back on defaults:
glow behind every heading, gradient text, ALL-CAPS, everything popping in on
the same frame, CSS transitions, hardcoded "visual rhythm" timing. You must
avoid ALL of these. Every animation must answer: "What is this motion telling
the viewer?" If the answer is "it just looks nice," the motion is wrong.

{ANTI_SLOP_RULES}

{EDUCATIONAL_RULES}

{MOTION_LAYOUT_RULES}

{QA_GATE}

OUTPUT FORMAT:
Return ONLY raw TypeScript code (no markdown, no explanation).
Start with: import React from "react";
End with the component closing brace.

COMPONENT SHAPE (MANDATORY):
- Import React from "react"
- Import {{ AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence }} from "remotion"
- export const EducationVideo: React.FC<{{ topic: string }}> = ({{ topic }}) => {{ ... }};
- 1920x1080, 30fps, 1800 frames
- One consistent visual metaphor throughout
"""


def build_user_message(script_context: dict, instructions: str | None = None) -> str:
    beats_json = json.dumps(script_context.get("beats", []), indent=2)

    extra = ""
    if instructions:
        extra = f"""
ADDITIONAL DIRECTION (follow unless it conflicts with hard requirements):
{instructions.strip()}
"""

    return f"""Topic: "{script_context['topic']}"
Topic type: {script_context.get('topic_type', 'general')}
Subcategory: {script_context.get('subcategory', 'none')}
Grade level: {script_context.get('grade_level', 'none')}
Core message: {script_context.get('core_message', '')}
Visual metaphor: {script_context.get('metaphor', '')}
Duration: {script_context.get('estimated_duration_seconds', 60)} seconds
Audience: {script_context.get('audience', 'student')}
Learning objectives: {json.dumps(script_context.get('learning_objectives', []))}

NARRATION BEATS (frame-accurate - derive ALL animation timing from these):
{beats_json}

HARD REQUIREMENTS:
1. Build the video from this teaching script. Map each beat to its frame window.
2. Derive ALL animation timing from the beat start_frame/end_frame values.
   Do NOT use hardcoded "visual rhythm" frame numbers.
3. Make it teachable from visuals alone. Every element must serve explanation.
4. One consistent visual metaphor: {script_context.get('metaphor', 'abstract diagram')}
5. No random decorative elements; every element teaches.
6. No out-of-frame content at any point.
7. No overlaps or misalignment; clean grid/flex layout.
8. Animations support teaching (reveal, focus, compare, trace flow, transform state), not decoration.
9. Minimum 4 meaningful animated phases across 60s.
10. Stagger sibling entrances by 3-6 frames. One focal action per beat.
11. Body text ≥ 32px. Section headings ≥ 40px. Main heading ≥ 56px.
12. Max 7 words on screen at once.
13. No emojis, decorative unicode, or pictograms.
14. Max 2 font families: Inter (sans) + JetBrains Mono (code only).
15. No CSS transitions/animations/@keyframes/setTimeout. Use useCurrentFrame + interpolate/spring only.
16. All connectors use SVG <line>/<path> with <defs><marker> arrowheads.
17. Max 10 simultaneous primary objects, 14 connectors.
18. Old scene elements fade out before new scenes appear.
19. Never render a blank screen. Background + title + scaffold visible at all frames.
20. One strong visual metaphor consistent throughout.
{extra}
Return ONLY the complete TypeScript component starting with: import React from "react";
"""


def build_script_prompt(topic: str, topic_type: str, instructions: str | None = None) -> str:
    """Prompt for generating the teaching script (narration + visual beats) BEFORE visuals."""
    extra = ""
    if instructions:
        extra = f"\nAdditional direction: {instructions.strip()}\n"

    return f"""You are an expert educational scriptwriter. Write a complete teaching script
for a 60-second animated educational video about: "{topic}"
Topic type: {topic_type}

{extra}

TASK: Write a narration script + visual storyboard. Output ONLY valid JSON.

STRUCTURE:
{{
  "core_message": "One-sentence summary of what the viewer will understand",
  "metaphor": "One visual metaphor that runs through the entire video (e.g., 'spotlight in a dark room', 'water flowing through pipes', 'building blocks assembling')",
  "estimated_duration_seconds": 60,
  "learning_objectives": ["objective 1", "objective 2"],
  "beats": [
    {{
      "id": "hook",
      "type": "hook",
      "title": "Beat title",
      "narration": "Word-for-word what the narrator says (2-3 sentences, ~30-45 words)",
      "visual_intent": "What the viewer sees (1-2 sentences describing visuals only)",
      "start_frame": 0,
      "end_frame": 180,
      "elements": ["token1", "token2", "arrow"],
      "emphasis_words": ["key word to emphasize"]
    }}
  ]
}}

BEAT TYPES: hook, entities, mechanism, worked_example, mental_model, outro

TIMING (60s = 1800 frames at 30fps):
- hook: frames 0-180 (0-6s)
- entities: frames 180-600 (6-20s)
- mechanism: frames 600-1350 (20-45s)
- worked_example: frames 1350-1740 (45-58s)
- outro: frames 1740-1800 (58-60s)

QUALITY RULES:
- Narration: ~145 wpm, short sentences, one idea per beat
- Visual intent: graphics + motion, not text descriptions
- Emphasis words: 1-3 words per beat that should be visually highlighted
- No text-heavy beats; understanding comes from motion and graphics
- One concept per beat
- Each beat answers: "What new thing does the learner understand now?"

Return ONLY the JSON object, no markdown, no explanation.
"""
