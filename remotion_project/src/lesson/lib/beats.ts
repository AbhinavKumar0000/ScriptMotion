import { interpolate } from "remotion";
import { easeInOut } from "./anim";
import { SceneData } from "../types";

/** Frames one beat takes to carry the diagram from one setup to the next (storyboard.py MORPH). */
export const MORPH = 40;

export type Beat = { at: number; set: Record<string, any>; caption: string; title?: string; ints?: string[] };

/** Every keyframe state of the scene: the base setup, then each beat applied in turn. */
export const beatStates = (s: SceneData): SceneData[] => {
  const out: SceneData[] = [s];
  let cur = s;
  for (const b of (s.beats || []) as Beat[]) {
    cur = { ...cur, ...b.set };
    out.push(cur);
  }
  return out;
};

/**
 * The scene's data at `frame`: numeric setup values glide between beats (like a
 * value tracker), so the component recomputes its physics every frame and the
 * diagram moves instead of cutting. Discrete values switch at the midpoint.
 * `__states` lets a component fit its axes to every state up front, so the view
 * stays put while the setup changes.
 */
export const beatData = (s: SceneData, frame: number): SceneData => {
  const beats = (s.beats || []) as Beat[];
  if (!beats.length) return s;
  const out: SceneData = { ...s, __states: beatStates(s) };
  // frames since the latest beat finished moving (components may replay their motion, e.g. relaunch)
  const done = beats.filter((b) => frame >= b.at + MORPH);
  if (done.length) out.__since = frame - (done[done.length - 1].at + MORPH);
  for (const b of beats) {
    const p = interpolate(frame, [b.at, b.at + MORPH], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut,
    });
    if (p <= 0) break;
    for (const [k, v] of Object.entries(b.set)) {
      const a = out[k];
      if (typeof a === "number" && typeof v === "number") {
        const x = a + (v - a) * p;
        out[k] = b.ints?.includes(k) ? Math.round(x) : x;
      } else if (p >= 0.5) out[k] = v;
    }
  }
  return out;
};

/** Length of the build-up segment: components play their own animation inside it. */
export const introFrames = (s: SceneData) => {
  const beats = (s.beats || []) as Beat[];
  return beats.length ? beats[0].at : s.duration;
};

/** Caption and title in force for each segment of the scene (local frames). */
export const segments = (s: SceneData) => {
  const beats = (s.beats || []) as Beat[];
  const out = [{ start: 0, end: beats.length ? beats[0].at : s.duration, caption: s.caption, title: s.title }];
  beats.forEach((b, i) => {
    out.push({
      start: b.at, end: i + 1 < beats.length ? beats[i + 1].at : s.duration,
      caption: b.caption || "", title: b.title || out[out.length - 1].title,
    });
  });
  return out;
};
