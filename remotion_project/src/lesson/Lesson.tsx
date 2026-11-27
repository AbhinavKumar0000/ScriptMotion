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
import { AbsoluteFill, CalculateMetadataFunction, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C, F, H, L, OVERLAP, STAGE_H, STAGE_W, T, W } from "./theme";
import { LessonProps, SceneData } from "./types";
import { REGISTRY } from "./registry";
import { Stage, subjectColor } from "./ui/Shell";
import { TitleScene } from "./scenes/general";
import { easeInOut } from "./lib/anim";
import { beatData, introFrames, segments } from "./lib/beats";

/** Start frame of every scene: neighbours overlap by OVERLAP frames while the camera travels. */
export const sceneStarts = (scenes: SceneData[]) => {
  const starts: number[] = [];
  let at = 0;
  scenes.forEach((s, i) => {
    starts.push(at);
    at += s.duration - (i < scenes.length - 1 ? OVERLAP : 0);
  });
  return { starts, total: Math.max(30, at) };
};

/*
 * The video is one continuous canvas. Scenes sit side by side on a strip and the
 * camera glides from one to the next, so a change of diagram is a movement, not a
 * cut or a dissolve. The dot lattice is fixed to the canvas and travels with it.
 */
const PAN = W;
const travel = (frame: number, starts: number[]) =>
  starts.slice(1).reduce((x, s) => x + PAN * interpolate(frame, [s, s + OVERLAP], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut,
  }), 0);

const Backdrop: React.FC<{ color: string; cam: number }> = ({ color, cam }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const dx = (((-cam + t * 4) % 48) + 48) % 48, dy = (t * 2.5) % 48;
  const gx = 50 + 16 * Math.sin(t * 0.07), gy = 40 + 10 * Math.cos(t * 0.05);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(70% 60% at ${gx}% ${gy}%, ${color}12 0%, transparent 70%)` }} />
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

/** One scene on the strip. Its data glides through its beats. */
const SceneBody: React.FC<{ s: SceneData; meta: LessonProps["meta"] }> = ({ s, meta }) => {
  const frame = useCurrentFrame();
  if (s.type === "title") return <TitleScene s={s} subject={meta.subject} meta={meta} />;
  const entry = REGISTRY[s.type] || REGISTRY.equation;
  const Comp = entry.C;
  const data = beatData(s, frame);
  return (
    <Stage dur={s.duration}>
      <Comp s={data} dur={introFrames(s)} box={{ w: STAGE_W, h: STAGE_H }} />
    </Stage>
  );
};

type Span = { start: number; end: number; text: string };

/** Global caption and title timelines (frames), built from every scene's segments. */
const timelines = (scenes: SceneData[], starts: number[]) => {
  const titles: Span[] = [];
  const captions: Span[] = [];
  scenes.forEach((s, i) => {
    const segs = segments(s);
    const first = i === 0, last = i === scenes.length - 1;
    segs.forEach((g, k) => {
      const enter = k === 0 ? starts[i] + (first ? 12 : Math.round(OVERLAP * 0.55)) : starts[i] + g.start + 6;
      const leave = k === segs.length - 1 ? starts[i] + s.duration - (last ? 20 : Math.round(OVERLAP * 0.6)) : starts[i] + g.end;
      // the title card already carries its title and question: no subtitle over it
      if (s.type === "title") return;
      if (g.caption) captions.push({ start: enter, end: leave, text: g.caption });
      const prev = titles[titles.length - 1];
      const tStart = k === 0 ? starts[i] + Math.round(OVERLAP * 0.35) : starts[i] + g.start;
      const tEnd = k === segs.length - 1 ? starts[i] + s.duration - Math.round(OVERLAP * 0.7) : starts[i] + g.end;
      if (prev && prev.text === g.title && prev.end >= tStart - 2) prev.end = tEnd;
      else titles.push({ start: tStart, end: tEnd, text: g.title });
    });
  });
  return { titles, captions };
};

const clampOpt = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut } as const;

/** Scene title, top-left. A change of title rolls: the old line slides up out, the new one slides up in. */
const Header: React.FC<{ spans: Span[] }> = ({ spans }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: L.padX, top: L.headerTop - 10, right: L.padX, height: 78, overflow: "hidden" }}>
      {spans.map((sp, i) => {
        if (frame < sp.start - 2 || frame > sp.end + 18) return null;
        const pin = interpolate(frame, [sp.start, sp.start + 18], [0, 1], clampOpt);
        const pout = interpolate(frame, [sp.end, sp.end + 16], [0, 1], clampOpt);
        return (
          <div key={i} style={{
            position: "absolute", left: 0, top: 10, whiteSpace: "nowrap",
            color: C.ink, fontFamily: F.serif, ...T.title,
            transform: `translateY(${(1 - pin) * 78 - pout * 78}px)`,
          }}>{sp.text}</div>
        );
      })}
    </div>
  );
};

/** Subtitles: one sentence at a time, centred low over a soft scrim. They stay put while the camera moves. */
const Subtitles: React.FC<{ spans: Span[] }> = ({ spans }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 230, background: "linear-gradient(180deg, rgba(14,16,20,0) 0%, rgba(14,16,20,0.78) 60%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: L.captionTop, height: 120, display: "flex", justifyContent: "center" }}>
        {spans.map((sp, i) => {
          const pin = interpolate(frame, [sp.start, sp.start + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const pout = interpolate(frame, [sp.end - 6, sp.end + 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const o = Math.min(pin, 1 - pout);
          if (o <= 0) return null;
          return (
            <div key={i} style={{
              position: "absolute", top: 0, maxWidth: 1360, textAlign: "center", opacity: o,
              color: C.ink, fontFamily: F.sans, ...T.body, letterSpacing: "-0.003em",
              transform: `translateY(${(1 - pin) * 8}px)`, textWrap: "balance" as any,
              textShadow: "0 2px 18px rgba(8,10,14,0.85)",
            }}>{sp.text}</div>
          );
        })}
      </div>
    </>
  );
};

/** Fade up from black at the start and down at the very end. */
const Bookends: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const o = Math.max(interpolate(frame, [0, 14], [1, 0], { extrapolateRight: "clamp" }), interpolate(frame, [total - 18, total - 1], [0, 1], { extrapolateLeft: "clamp" }));
  return o > 0 ? <AbsoluteFill style={{ background: "#000", opacity: o }} /> : null;
};

export const Lesson: React.FC<LessonProps> = ({ meta, scenes }) => {
  const frame = useCurrentFrame();
  const color = subjectColor(meta.subject);
  const { starts, total } = sceneStarts(scenes);
  const { titles, captions } = React.useMemo(() => timelines(scenes, starts), [scenes]);
  const cam = travel(frame, starts);
  // horizontal motion blur proportional to camera speed
  const speed = Math.abs(travel(frame + 0.5, starts) - travel(frame - 0.5, starts));
  const blur = Math.min(22, speed * 0.2);
  return (
    <AbsoluteFill style={{ background: C.bg, width: W, height: H }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id="camblur" x="-5%" y="0" width="110%" height="100%">
          <feGaussianBlur stdDeviation={`${blur.toFixed(2)} 0`} />
        </filter>
      </svg>
      <Backdrop color={color} cam={cam} />
      <AbsoluteFill style={{ filter: blur > 0.4 ? "url(#camblur)" : undefined }}>
        {scenes.map((s, i) => {
          const x = i * PAN - cam;
          if (Math.abs(x) >= W) return null;
          return (
            <Sequence key={i} from={starts[i]} durationInFrames={s.duration} name={`${i + 1}. ${s.type}`}>
              <AbsoluteFill style={{ transform: `translateX(${x}px)` }}>
                <SceneBody s={s} meta={meta} />
              </AbsoluteFill>
            </Sequence>
          );
        })}
      </AbsoluteFill>
      <Header spans={titles} />
      <Subtitles spans={captions} />
      <Bookends total={total} />
    </AbsoluteFill>
  );
};

export const calculateLessonMetadata: CalculateMetadataFunction<LessonProps> = ({ props }) => ({
  durationInFrames: sceneStarts(props.scenes.map((s) => ({ ...s, duration: s.duration || 240 }))).total,
});
