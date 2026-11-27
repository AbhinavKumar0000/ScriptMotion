import { Easing, interpolate } from "remotion";

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 progress of a window starting at `start` lasting `dur` frames. */
export const prog = (frame: number, start: number, dur: number, ease = easeOut) =>
  interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

/** Linear 0→1 (for physical motion where easing would lie about speed). */
export const lin = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** Standard element entrance: fade + small rise. */
export const enter = (frame: number, start: number, dur = 18, rise = 14) => {
  const p = prog(frame, start, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * rise}px)` } as const;
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Split a scene of `dur` frames into named phases by weight.
 * phases(300, [1, 2, 1]) -> [{start:..., len:...}, ...]
 */
export const phases = (dur: number, weights: number[], lead = 12, tail = 24) => {
  const usable = Math.max(1, dur - lead - tail);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = lead;
  return weights.map((w) => {
    const len = (usable * w) / total;
    const ph = { start: Math.round(cursor), len: Math.max(1, Math.round(len)) };
    cursor += len;
    return ph;
  });
};

/** Evenly stagger `n` items across [start, end]. */
export const stagger = (n: number, start: number, end: number) =>
  Array.from({ length: n }, (_, i) => Math.round(start + ((end - start) * i) / Math.max(1, n)));

export const fmt = (v: number, digits = 2) => {
  if (!isFinite(v)) return "∞";
  const r = Number(v.toFixed(digits));
  return Object.is(r, -0) ? "0" : String(r).replace("-", "−");
};
