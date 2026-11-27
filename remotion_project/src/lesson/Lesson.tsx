import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@fontsource/source-serif-4/latin-400.css";
import "@fontsource/source-serif-4/latin-600.css";
import "@fontsource/source-serif-4/latin-400-italic.css";
import "katex/dist/katex.min.css";
import "katex/contrib/mhchem";

import React from "react";
import { AbsoluteFill, CalculateMetadataFunction, Easing, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C, DIAGRAM_W, H, OVERLAP, STAGE_H, STAGE_W, W } from "./theme";
import { LessonProps, SceneData } from "./types";
import { REGISTRY } from "./registry";
import { Shell, subjectColor } from "./ui/Shell";
import { TitleScene } from "./scenes/general";

/** Start frame of every scene: neighbours overlap by OVERLAP frames for the handover. */
export const sceneStarts = (scenes: SceneData[]) => {
  const starts: number[] = [];
  let at = 0;
  scenes.forEach((s, i) => {
    starts.push(at);
    at += s.duration - (i < scenes.length - 1 ? OVERLAP : 0);
  });
  return { starts, total: Math.max(30, at) };
};

/**
 * One continuous backdrop for the whole video (it never resets at a scene cut):
 * a dot lattice drifting slowly and a soft light that wanders in the subject colour.
 */
const Backdrop: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const dx = (t * 6) % 48, dy = (t * 3.5) % 48;
  const gx = 50 + 18 * Math.sin(t * 0.07), gy = 40 + 12 * Math.cos(t * 0.05);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(70% 60% at ${gx}% ${gy}%, ${color}14 0%, transparent 70%)` }} />
      <AbsoluteFill style={{
        backgroundImage: "radial-gradient(rgba(236,238,242,0.07) 1.2px, transparent 1.4px)",
        backgroundSize: "48px 48px", backgroundPosition: `${dx}px ${dy}px`,
        maskImage: "radial-gradient(90% 80% at 50% 45%, black 30%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(90% 80% at 50% 45%, black 30%, transparent 100%)",
      }} />
      <AbsoluteFill style={{ background: "radial-gradient(120% 100% at 50% 40%, transparent 55%, rgba(5,6,9,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

const ease = Easing.bezier(0.33, 0, 0.2, 1);

/** Handover: the outgoing scene pushes forward and dissolves while the next settles in. */
const SceneSwitch: React.FC<{ s: SceneData; index: number; total: number; meta: LessonProps["meta"] }> = ({ s, index, total, meta }) => {
  const frame = useCurrentFrame();
  const pin = index === 0 ? 1 : interpolate(frame, [0, OVERLAP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const pout = index === total - 1 ? 0 : interpolate(frame, [s.duration - OVERLAP, s.duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const style: React.CSSProperties = {
    opacity: Math.min(pin, 1 - pout),
    transform: `translateY(${(1 - pin) * 26}px) scale(${(0.985 + 0.015 * pin) * (1 + 0.035 * pout)})`,
    filter: pout > 0.01 ? `blur(${pout * 7}px)` : pin < 0.99 ? `blur(${(1 - pin) * 5}px)` : undefined,
  };
  if (s.type === "title") {
    return <AbsoluteFill style={style}><TitleScene s={s} subject={meta.subject} meta={meta} /></AbsoluteFill>;
  }
  const entry = REGISTRY[s.type] || REGISTRY.key_points;
  const split = entry.notes && (s.notes || []).length > 0;
  const box = { w: split ? DIAGRAM_W : STAGE_W, h: STAGE_H };
  const Comp = entry.C;
  return (
    <AbsoluteFill style={style}>
      <Shell s={s} index={index} total={total} kicker="" subject={meta.subject} split={split}>
        <Comp s={s} dur={s.duration} box={box} />
      </Shell>
    </AbsoluteFill>
  );
};

/** Fade up from black at the start and down at the very end. */
const Bookends: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const o = Math.max(interpolate(frame, [0, 14], [1, 0], { extrapolateRight: "clamp" }), interpolate(frame, [total - 18, total - 1], [0, 1], { extrapolateLeft: "clamp" }));
  return o > 0 ? <AbsoluteFill style={{ background: "#000", opacity: o }} /> : null;
};

export const Lesson: React.FC<LessonProps> = ({ meta, scenes }) => {
  const color = subjectColor(meta.subject);
  const { starts, total } = sceneStarts(scenes);
  return (
    <AbsoluteFill style={{ background: C.bg, width: W, height: H }}>
      <Backdrop color={color} />
      {scenes.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={s.duration} name={`${i + 1}. ${s.type}`}>
          <SceneSwitch s={s} index={i} total={scenes.length} meta={meta} />
        </Sequence>
      ))}
      <Bookends total={total} />
    </AbsoluteFill>
  );
};

export const calculateLessonMetadata: CalculateMetadataFunction<LessonProps> = ({ props }) => ({
  durationInFrames: sceneStarts(props.scenes.map((s) => ({ ...s, duration: s.duration || 240 }))).total,
});
