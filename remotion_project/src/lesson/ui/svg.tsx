import React from "react";
import katex from "katex";
import { C, F } from "../theme";
import { clamp } from "../lib/anim";

export type Pt = { x: number; y: number };

/** Text label with a background-coloured halo so it stays legible over lines. */
export const Label: React.FC<{
  x: number; y: number; children: React.ReactNode; color?: string; size?: number;
  anchor?: "start" | "middle" | "end"; weight?: number; opacity?: number; mono?: boolean;
  baseline?: "auto" | "middle" | "hanging"; halo?: string; italic?: boolean;
}> = ({ x, y, children, color = C.ink, size = 26, anchor = "middle", weight = 500, opacity = 1, mono, baseline = "middle", halo = C.bg, italic }) => (
  <text
    x={x} y={y} fill={color} fontSize={size} fontWeight={weight} textAnchor={anchor}
    dominantBaseline={baseline} opacity={opacity}
    fontFamily={mono ? F.mono : F.sans} fontStyle={italic ? "italic" : "normal"}
    style={{ paintOrder: "stroke", stroke: halo, strokeWidth: size * 0.32, strokeLinejoin: "round" }}
  >
    {children}
  </text>
);

/** Path that draws itself as `p` goes 0→1. */
export const Draw: React.FC<{
  d: string; p: number; color?: string; width?: number; dash?: string; opacity?: number;
  fill?: string; cap?: "round" | "butt"; glow?: boolean;
}> = ({ d, p, color = C.ink, width = 3, dash, opacity = 1, fill = "none", cap = "round", glow }) => {
  if (p <= 0) return null;
  const pp = clamp(p, 0, 1);
  if (dash) {
    // dashed paths: reveal with a mask-like clip by drawing a solid path into a mask is costly;
    // instead fade + draw a dashed path whose visible length grows.
    return (
      <g opacity={opacity}>
        <path d={d} stroke={color} strokeWidth={width} fill="none" strokeDasharray={dash}
          strokeLinecap={cap} pathLength={1000}
          style={{ strokeDasharray: dash }}
          opacity={pp < 1 ? 0.25 + 0.75 * pp : 1} />
      </g>
    );
  }
  return (
    <g opacity={opacity}>
      {glow ? (
        <path d={d} stroke={color} strokeWidth={width * 4} opacity={0.14} fill="none" pathLength={1}
          strokeDasharray="1 1" strokeDashoffset={1 - pp} strokeLinecap="round" />
      ) : null}
      <path d={d} stroke={color} strokeWidth={width} fill={pp >= 1 ? fill : "none"} pathLength={1}
        strokeDasharray="1 1" strokeDashoffset={1 - pp} strokeLinecap={cap} strokeLinejoin="round" />
    </g>
  );
};

/** Straight arrow that grows from its tail. */
export const Arrow: React.FC<{
  from: Pt; to: Pt; p?: number; color?: string; width?: number; head?: number; dashed?: boolean; opacity?: number; glow?: boolean;
}> = ({ from, to, p = 1, color = C.ink, width = 4, head = 16, dashed, opacity = 1, glow }) => {
  if (p <= 0) return null;
  const tx = from.x + (to.x - from.x) * p;
  const ty = from.y + (to.y - from.y) * p;
  const ang = Math.atan2(ty - from.y, tx - from.x);
  const len = Math.hypot(tx - from.x, ty - from.y);
  const h = Math.min(head, len * 0.6);
  const bx = tx - Math.cos(ang) * h * 0.85;
  const by = ty - Math.sin(ang) * h * 0.85;
  const l = { x: tx - Math.cos(ang - 0.42) * h, y: ty - Math.sin(ang - 0.42) * h };
  const r = { x: tx - Math.cos(ang + 0.42) * h, y: ty - Math.sin(ang + 0.42) * h };
  return (
    <g opacity={opacity}>
      {glow ? <line x1={from.x} y1={from.y} x2={bx} y2={by} stroke={color} strokeWidth={width * 4} opacity={0.14} strokeLinecap="round" /> : null}
      <line x1={from.x} y1={from.y} x2={bx} y2={by} stroke={color} strokeWidth={width}
        strokeLinecap="round" strokeDasharray={dashed ? `${width * 2.5} ${width * 2.5}` : undefined} />
      {len > 4 ? <polygon points={`${tx},${ty} ${l.x},${l.y} ${r.x},${r.y}`} fill={color} /> : null}
    </g>
  );
};

/** Small chevron placed mid-segment to show direction of travel along a ray. */
export const Chevron: React.FC<{ at: Pt; angle: number; color: string; size?: number; opacity?: number }> = ({ at, angle, color, size = 13, opacity = 1 }) => {
  const a = angle;
  const p1 = { x: at.x - Math.cos(a - 0.6) * size, y: at.y - Math.sin(a - 0.6) * size };
  const p2 = { x: at.x - Math.cos(a + 0.6) * size, y: at.y - Math.sin(a + 0.6) * size };
  return <path d={`M${p1.x},${p1.y} L${at.x},${at.y} L${p2.x},${p2.y}`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />;
};

/**
 * A light ray through a list of points, drawn progressively with a soft
 * bloom underlay. `dashedFrom` marks the index after which segments are
 * virtual (dashed back-extensions are drawn separately with `Virtual`).
 */
export const Ray: React.FC<{ pts: Pt[]; p: number; color?: string; width?: number; chevrons?: boolean }> = ({ pts, p, color = C.light, width = 3.5, chevrons = true }) => {
  if (p <= 0 || pts.length < 2) return null;
  const segs = pts.slice(1).map((b, i) => Math.hypot(b.x - pts[i].x, b.y - pts[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  let remaining = total * clamp(p, 0, 1);
  const shown: Pt[] = [pts[0]];
  const marks: { at: Pt; angle: number }[] = [];
  for (let i = 0; i < segs.length && remaining > 0; i++) {
    const a = pts[i], b = pts[i + 1];
    const t = Math.min(1, remaining / segs[i]);
    const end = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    shown.push(end);
    if (t >= 0.55 && segs[i] > 120) {
      marks.push({ at: { x: a.x + (b.x - a.x) * 0.5, y: a.y + (b.y - a.y) * 0.5 }, angle: Math.atan2(b.y - a.y, b.x - a.x) });
    }
    remaining -= segs[i];
  }
  const d = shown.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  const tip = shown[shown.length - 1];
  return (
    <g>
      <path d={d} stroke={color} strokeWidth={width * 5} opacity={0.08} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={color} strokeWidth={width * 2.2} opacity={0.16} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {chevrons ? marks.map((m, i) => <Chevron key={i} at={m.at} angle={m.angle} color={color} />) : null}
      {p < 1 ? <circle cx={tip.x} cy={tip.y} r={width * 1.6} fill={color} opacity={0.9} /> : null}
    </g>
  );
};

export const Dot: React.FC<{ x: number; y: number; r?: number; color?: string; ring?: boolean; opacity?: number }> = ({ x, y, r = 7, color = C.ink, ring, opacity = 1 }) => (
  <g opacity={opacity}>
    {ring ? <circle cx={x} cy={y} r={r * 2.2} fill={color} opacity={0.16} /> : null}
    <circle cx={x} cy={y} r={r} fill={color} />
  </g>
);

/** Render KaTeX to HTML (used inside HTML and SVG foreignObject). */
export const texHtml = (tex: string, display = false) =>
  katex.renderToString(tex, { throwOnError: false, displayMode: display, output: "html", strict: "ignore" });

export const Tex: React.FC<{ tex: string; size?: number; color?: string; display?: boolean; style?: React.CSSProperties }> = ({ tex, size = 40, color = C.ink, display = false, style }) => (
  <span
    style={{ fontSize: size, color, lineHeight: 1.2, display: "inline-block", ...style }}
    dangerouslySetInnerHTML={{ __html: texHtml(tex, display) }}
  />
);

/** KaTeX inside SVG at (x, y) centered. */
export const SvgTex: React.FC<{ x: number; y: number; tex: string; size?: number; color?: string; w?: number; h?: number; opacity?: number; align?: "center" | "left" | "right" }> = ({ x, y, tex, size = 30, color = C.ink, w = 420, h = 90, opacity = 1, align = "center" }) => {
  const left = align === "center" ? x - w / 2 : align === "left" ? x : x - w;
  return (
    <foreignObject x={left} y={y - h / 2} width={w} height={h} opacity={opacity}>
      <div style={{ width: w, height: h, display: "flex", alignItems: "center", justifyContent: align === "center" ? "center" : align === "left" ? "flex-start" : "flex-end" }}>
        <Tex tex={tex} size={size} color={color} />
      </div>
    </foreignObject>
  );
};

export const pathOf = (pts: Pt[], close = false) =>
  pts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ") + (close ? " Z" : "");
