import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, DIAGRAM_W, F, L, OVERLAP, STAGE_H, STAGE_W, T, W } from "../theme";
import { enter, prog } from "../lib/anim";
import { SceneData } from "../types";

const SUBJECT_COLOR: Record<string, string> = {
  physics: C.blue, chemistry: C.green, maths: C.orange, general: C.violet,
};
export const subjectColor = (s?: string) => SUBJECT_COLOR[(s || "").toLowerCase()] || C.violet;

/** Split narration into sentences and give each a share of the scene by length. */
const sentenceWindows = (caption: string, dur: number) => {
  // split only at sentence punctuation followed by whitespace/end (keeps 109.5°, 3.0 × 10⁸, e.g.)
  const parts = caption.split(/(?<=[.!?;])\s+(?=[A-Z0-9"'(])/).map((s) => s.trim()).filter(Boolean);
  // merge very short fragments into the previous sentence
  const merged: string[] = [];
  for (const p of parts) {
    if (merged.length && p.split(" ").length < 4) merged[merged.length - 1] += " " + p;
    else merged.push(p);
  }
  const weights = merged.map((s) => Math.max(4, s.split(/\s+/).length));
  const total = weights.reduce((a, b) => a + b, 0);
  const usable = dur - 34; // leave the handover frames free of text
  let t = 14;
  return merged.map((text, i) => {
    const len = (usable * weights[i]) / total;
    const w = { text, start: t, end: t + len };
    t += len;
    return w;
  });
};

/** Subtitles: one sentence at a time, centred low in frame over a soft scrim. */
const Caption: React.FC<{ caption: string; dur: number }> = ({ caption, dur }) => {
  const frame = useCurrentFrame();
  const wins = sentenceWindows(caption, dur);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: L.captionTop, height: 120, display: "flex", justifyContent: "center" }}>
      {wins.map((w, i) => {
        const last = i === wins.length - 1;
        const fadeIn = interpolate(frame, [w.start, w.start + 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const fadeOut = last
          ? interpolate(frame, [dur - OVERLAP - 2, dur - OVERLAP + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : interpolate(frame, [w.end - 6, w.end + 3], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const o = Math.min(fadeIn, fadeOut);
        if (o <= 0) return null;
        return (
          <div key={i} style={{
            position: "absolute", top: 0, maxWidth: 1360, textAlign: "center", opacity: o,
            color: C.ink, fontFamily: F.sans, ...T.body, letterSpacing: "-0.003em",
            transform: `translateY(${(1 - fadeIn) * 6}px)`, textWrap: "balance" as any,
            textShadow: "0 2px 18px rgba(8,10,14,0.85)",
          }}>
            {w.text}
          </div>
        );
      })}
    </div>
  );
};

/** Annotations arrive one at a time beside the diagram; the newest is in focus. */
const Notes: React.FC<{ notes: string[]; dur: number; color: string }> = ({ notes, dur, color }) => {
  const frame = useCurrentFrame();
  const start = Math.round(dur * 0.2);
  const end = Math.round(dur * 0.74);
  const times = notes.map((_, i) => start + ((end - start) * i) / Math.max(1, notes.length));
  const current = times.filter((t) => frame >= t).length - 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30, paddingTop: 18 }}>
      {notes.map((n, i) => {
        const p = prog(frame, times[i], 18);
        if (p <= 0) return null;
        const focus = i === current;
        const bar = prog(frame, times[i] + 4, 16);
        return (
          <div key={i} style={{ position: "relative", paddingLeft: 26, opacity: p * (focus ? 1 : 0.5), transform: `translateX(${(1 - p) * 18}px)` }}>
            <div style={{ position: "absolute", left: 0, top: 6, width: 4, height: `calc(${bar * 100}% - 12px)`, borderRadius: 2, background: focus ? color : C.hairStrong }} />
            <div style={{ color: C.ink, fontFamily: F.sans, ...T.note }}>{n}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Scene frame: a title that wipes in, the stage (with a slow camera drift), annotations, subtitles. */
export const Shell: React.FC<{
  s: SceneData; index: number; total: number; kicker: string; subject: string;
  split: boolean; children: React.ReactNode;
}> = ({ s, subject, split, children }) => {
  const frame = useCurrentFrame();
  const color = subjectColor(subject);
  const wipe = prog(frame, 4, 22);
  const rule = prog(frame, 14, 26);
  // continuous, barely perceptible push-in so the frame is never frozen
  const drift = 1 + 0.022 * Math.min(1, frame / Math.max(1, s.duration));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: L.padX, top: L.headerTop, right: L.padX }}>
        <div style={{
          display: "inline-block", color: C.ink, fontFamily: F.serif, ...T.title,
          clipPath: `inset(-10% ${(1 - wipe) * 100}% -10% 0)`, transform: `translateX(${(1 - wipe) * -14}px)`,
        }}>
          {s.title}
        </div>
        <div style={{ marginTop: 14, width: 96 * rule, height: 3, borderRadius: 2, background: color, opacity: 0.9 }} />
      </div>

      <div style={{ position: "absolute", left: L.padX, top: L.stageTop, width: STAGE_W, height: STAGE_H, display: "flex", gap: L.gap }}>
        <div style={{ position: "relative", width: split ? DIAGRAM_W : STAGE_W, height: STAGE_H, transform: `scale(${drift})`, transformOrigin: "50% 50%" }}>{children}</div>
        {split ? (
          <div style={{ width: L.notesWidth }}>
            <Notes notes={s.notes || []} dur={s.duration} color={color} />
          </div>
        ) : null}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 230, background: "linear-gradient(180deg, rgba(14,16,20,0) 0%, rgba(14,16,20,0.78) 60%)", pointerEvents: "none" }} />
      <Caption caption={s.caption} dur={s.duration} />
    </AbsoluteFill>
  );
};
