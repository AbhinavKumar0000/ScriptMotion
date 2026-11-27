import React from "react";
import { C, F } from "../theme";
import { fmt } from "../lib/anim";
import { Arrow, Label } from "./svg";

export type Plane = {
  x0: number; x1: number; y0: number; y1: number; // world bounds
  left: number; top: number; width: number; height: number; // pixel box
  sx: (x: number) => number; sy: (y: number) => number;
  unit: number; // px per world unit along x
};

/** Map a world rectangle into a pixel box. `equal` keeps 1:1 aspect (geometry). */
export const plane = (
  x0: number, x1: number, y0: number, y1: number,
  box: { left: number; top: number; width: number; height: number }, equal = false,
): Plane => {
  let { left, top, width, height } = box;
  if (equal) {
    const s = Math.min(width / (x1 - x0), height / (y1 - y0));
    const w = s * (x1 - x0), h = s * (y1 - y0);
    left += (width - w) / 2; top += (height - h) / 2; width = w; height = h;
  }
  const sx = (x: number) => left + ((x - x0) / (x1 - x0)) * width;
  const sy = (y: number) => top + (1 - (y - y0) / (y1 - y0)) * height;
  return { x0, x1, y0, y1, left, top, width, height, sx, sy, unit: width / (x1 - x0) };
};

export const niceStep = (span: number, target = 8) => {
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
};

const ticks = (a: number, b: number, step: number) => {
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
};

export const Axes: React.FC<{
  pl: Plane; opacity?: number; grid?: boolean; xLabel?: string; yLabel?: string; tickLabels?: boolean;
  xStep?: number; yStep?: number; origin?: boolean;
}> = ({ pl, opacity = 1, grid = true, xLabel = "x", yLabel = "y", tickLabels = true, xStep, yStep, origin = true }) => {
  const xs = xStep ?? niceStep(pl.x1 - pl.x0);
  const ys = yStep ?? niceStep(pl.y1 - pl.y0, 6);
  const ax = Math.min(Math.max(0, pl.y0), pl.y1); // y where x-axis sits
  const ay = Math.min(Math.max(0, pl.x0), pl.x1);
  const X = pl.sy(ax), Y = pl.sx(ay);
  return (
    <g opacity={opacity}>
      {grid
        ? (
          <g stroke={C.grid} strokeWidth={1.5}>
            {ticks(pl.x0, pl.x1, xs).map((v) => <line key={`gx${v}`} x1={pl.sx(v)} x2={pl.sx(v)} y1={pl.top} y2={pl.top + pl.height} />)}
            {ticks(pl.y0, pl.y1, ys).map((v) => <line key={`gy${v}`} y1={pl.sy(v)} y2={pl.sy(v)} x1={pl.left} x2={pl.left + pl.width} />)}
          </g>
        )
        : null}
      <Arrow from={{ x: pl.left - 6, y: X }} to={{ x: pl.left + pl.width + 22, y: X }} color={C.muted} width={2.5} head={14} />
      <Arrow from={{ x: Y, y: pl.top + pl.height + 6 }} to={{ x: Y, y: pl.top - 22 }} color={C.muted} width={2.5} head={14} />
      {tickLabels
        ? (
          <g fontFamily={F.mono} fontSize={19} fill={C.faint}>
            {ticks(pl.x0, pl.x1, xs).filter((v) => Math.abs(v) > 1e-9 || !origin).map((v) => (
              <g key={`tx${v}`}>
                <line x1={pl.sx(v)} x2={pl.sx(v)} y1={X - 6} y2={X + 6} stroke={C.muted} strokeWidth={2} />
                <text x={pl.sx(v)} y={X + 30} textAnchor="middle">{fmt(v, 2)}</text>
              </g>
            ))}
            {ticks(pl.y0, pl.y1, ys).filter((v) => Math.abs(v) > 1e-9).map((v) => (
              <g key={`ty${v}`}>
                <line x1={Y - 6} x2={Y + 6} y1={pl.sy(v)} y2={pl.sy(v)} stroke={C.muted} strokeWidth={2} />
                <text x={Y - 14} y={pl.sy(v) + 6} textAnchor="end">{fmt(v, 2)}</text>
              </g>
            ))}
          </g>
        )
        : null}
      <Label x={pl.left + pl.width + 30} y={X - 26} color={C.muted} size={24} anchor="end" italic>{xLabel}</Label>
      <Label x={Y + 16} y={pl.top - 24} color={C.muted} size={24} anchor="start" italic>{yLabel}</Label>
    </g>
  );
};

/** Sample y = f(x) into SVG path segments, breaking at gaps / asymptotes. */
export const samplePath = (f: (x: number) => number | null, pl: Plane, upto = 1, n = 360) => {
  const parts: string[] = [];
  let pen = false;
  let prevY: number | null = null;
  const end = pl.x0 + (pl.x1 - pl.x0) * upto;
  const span = pl.y1 - pl.y0;
  for (let i = 0; i <= n; i++) {
    const x = pl.x0 + ((end - pl.x0) * i) / n;
    const y = f(x);
    const ok = y !== null && y > pl.y0 - span * 2 && y < pl.y1 + span * 2;
    if (!ok || (prevY !== null && y !== null && Math.abs(y - prevY) > span * 1.5)) {
      pen = false;
      prevY = y;
      if (!ok) continue;
    }
    const cy = Math.max(pl.top - 400, Math.min(pl.top + pl.height + 400, pl.sy(y as number)));
    parts.push(`${pen ? "L" : "M"}${pl.sx(x).toFixed(1)},${cy.toFixed(1)}`);
    pen = true;
    prevY = y;
  }
  return parts.join(" ");
};
