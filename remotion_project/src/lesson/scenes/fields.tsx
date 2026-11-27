import React from "react";
import { useCurrentFrame } from "remotion";
import { C } from "../theme";
import { clamp, fmt, lin, phases, prog } from "../lib/anim";
import { SceneProps } from "../types";
import { Arrow, Chevron, Label, Pt, pathOf } from "../ui/svg";

type Q = { q: number; x: number; y: number };
const WX = 5.2, WY = 3.1;

const fieldAt = (charges: Q[], x: number, y: number) => {
  let ex = 0, ey = 0;
  for (const c of charges) {
    const dx = x - c.x, dy = y - c.y;
    const r2 = dx * dx + dy * dy + 1e-4;
    const r3 = r2 * Math.sqrt(r2);
    ex += (c.q * dx) / r3;
    ey += (c.q * dy) / r3;
  }
  return { ex, ey };
};

const potentialAt = (charges: Q[], x: number, y: number) =>
  charges.reduce((v, c) => v + c.q / Math.max(0.08, Math.hypot(x - c.x, y - c.y)), 0);

/** Trace a field line from a seed, following +E (dir=1) or −E (dir=-1). */
const trace = (charges: Q[], seed: Pt, dir: number, sinks: Q[], h = 0.03, max = 900) => {
  const pts: Pt[] = [seed];
  let { x, y } = seed;
  for (let i = 0; i < max; i++) {
    const f1 = fieldAt(charges, x, y);
    const m1 = Math.hypot(f1.ex, f1.ey) || 1;
    const mx = x + (dir * h * f1.ex) / m1 / 2, my = y + (dir * h * f1.ey) / m1 / 2;
    const f2 = fieldAt(charges, mx, my);
    const m2 = Math.hypot(f2.ex, f2.ey) || 1;
    x += (dir * h * f2.ex) / m2;
    y += (dir * h * f2.ey) / m2;
    pts.push({ x, y });
    if (Math.abs(x) > WX * 1.05 || Math.abs(y) > WY * 1.05) break;
    if (sinks.some((c) => Math.hypot(x - c.x, y - c.y) < 0.14)) break;
  }
  return pts;
};

const useWorld = (box: { w: number; h: number }) => {
  const s = Math.min(box.w / (2 * WX), box.h / (2 * WY));
  const ox = box.w / 2, oy = box.h / 2;
  return { s, map: (p: Pt) => ({ x: ox + p.x * s, y: oy - p.y * s }) };
};

/** Marching squares for one potential level, returns line segments in world units. */
const contour = (charges: Q[], level: number, n = 90) => {
  const segs: [Pt, Pt][] = [];
  const dx = (2 * WX) / n, dy = (2 * WY) / Math.round(n * (WY / WX));
  const ny = Math.round(n * (WY / WX));
  const V = (i: number, j: number) => potentialAt(charges, -WX + i * dx, -WY + j * dy) - level;
  const grid: number[][] = [];
  for (let i = 0; i <= n; i++) { grid.push([]); for (let j = 0; j <= ny; j++) grid[i].push(V(i, j)); }
  const lerpPt = (a: Pt, b: Pt, va: number, vb: number) => { const t = va / (va - vb); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
  for (let i = 0; i < n; i++) for (let j = 0; j < ny; j++) {
    const p = [
      { x: -WX + i * dx, y: -WY + j * dy }, { x: -WX + (i + 1) * dx, y: -WY + j * dy },
      { x: -WX + (i + 1) * dx, y: -WY + (j + 1) * dy }, { x: -WX + i * dx, y: -WY + (j + 1) * dy },
    ];
    const v = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
    const cross: Pt[] = [];
    for (let k = 0; k < 4; k++) {
      const a = v[k], b = v[(k + 1) % 4];
      if ((a > 0) !== (b > 0)) cross.push(lerpPt(p[k], p[(k + 1) % 4], a, b));
    }
    if (cross.length >= 2) segs.push([cross[0], cross[1]]);
    if (cross.length === 4) segs.push([cross[2], cross[3]]);
  }
  return segs;
};

const lineWithArrows = (pts: Pt[], map: (p: Pt) => Pt, color: string, p: number, key: string) => {
  const px = pts.map(map);
  const n = Math.max(2, Math.round(px.length * p));
  const shown = px.slice(0, n);
  const marks: React.ReactNode[] = [];
  let acc = 0;
  for (let i = 1; i < shown.length; i++) {
    const seg = Math.hypot(shown[i].x - shown[i - 1].x, shown[i].y - shown[i - 1].y);
    acc += seg;
    if (acc > 150) {
      acc = 0;
      marks.push(<Chevron key={i} at={shown[i]} angle={Math.atan2(shown[i].y - shown[i - 1].y, shown[i].x - shown[i - 1].x)} color={color} size={11} />);
    }
  }
  return (
    <g key={key}>
      <path d={pathOf(shown)} stroke={color} strokeWidth={2.4} fill="none" opacity={0.85} strokeLinecap="round" />
      {marks}
    </g>
  );
};

const Charge: React.FC<{ at: Pt; q: number; p: number }> = ({ at, q, p }) => {
  const color = q > 0 ? C.pos : C.neg;
  const r = 22 + Math.abs(q) * 3;
  return (
    <g opacity={p} transform={`translate(${at.x},${at.y}) scale(${0.6 + 0.4 * p})`}>
      <circle r={r * 1.9} fill={color} opacity={0.12} />
      <circle r={r} fill={color} />
      <text textAnchor="middle" dominantBaseline="central" fill={C.bg} fontSize={30} fontWeight={700}>{q > 0 ? "+" : "−"}</text>
    </g>
  );
};

// ============================================================= field lines
export const FieldLines: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const charges: Q[] = s.charges;
  const { map } = useWorld(box);
  const pos = charges.filter((c) => c.q > 0), neg = charges.filter((c) => c.q < 0);
  const seeds = pos.length ? pos : neg;
  const dir = pos.length ? 1 : -1;
  const sinks = pos.length ? neg : [];
  const lines: Pt[][] = [];
  for (const c of seeds) {
    const n = 10 * Math.abs(c.q);
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * (k + 0.5)) / n;
      lines.push(trace(charges, { x: c.x + Math.cos(a) * 0.16, y: c.y + Math.sin(a) * 0.16 }, dir, sinks));
    }
  }
  // lines that end on negatives not reached from positives (net negative charge)
  const netNeg = neg.reduce((a, c) => a + c.q, 0) + pos.reduce((a, c) => a + c.q, 0);
  if (pos.length && netNeg < 0) {
    for (const c of neg) {
      const n = 6 * Math.abs(c.q);
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * (k + 0.25)) / n;
        const l = trace(charges, { x: c.x + Math.cos(a) * 0.16, y: c.y + Math.sin(a) * 0.16 }, -1, pos);
        const end = l[l.length - 1];
        if (Math.abs(end.x) > WX || Math.abs(end.y) > WY) lines.push(l.reverse());
      }
    }
  }
  const ph = phases(dur, [0.8, 2.4, 1.2, 1.4]);
  const pC = prog(frame, ph[0].start, ph[0].len);
  const pL = lin(frame, ph[1].start, ph[1].len);
  const pE = prog(frame, ph[2].start, ph[2].len);
  const levels = s.equipotentials ? [-2, -1, -0.5, -0.25, 0.25, 0.5, 1, 2].map((v) => v * Math.max(1, Math.max(...charges.map((c) => Math.abs(c.q))) * 0.6)) : [];
  // test charge riding the first line
  const ride = lines[Math.floor(lines.length / 4)] || lines[0];
  const pR = lin(frame, ph[3].start, ph[3].len);
  const rideIdx = ride ? Math.min(ride.length - 1, Math.floor(pR * (ride.length - 1))) : 0;
  return (
    <svg width={box.w} height={box.h}>
      {levels.map((lv, i) => (
        <g key={`eq${i}`} opacity={pE * 0.7}>
          {contour(charges, lv).map(([a, b], j) => {
            const A = map(a), B = map(b);
            return <line key={j} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={C.teal} strokeWidth={1.8} strokeDasharray="2 5" />;
          })}
        </g>
      ))}
      {lines.map((l, i) => lineWithArrows(l, map, C.light, clamp(pL * 1.15 - (i % 5) * 0.03, 0, 1), `l${i}`))}
      {charges.map((c, i) => <Charge key={i} at={map(c)} q={c.q} p={pC} />)}
      {ride && pR > 0 && pR < 1 ? (
        <g>
          <circle cx={map(ride[rideIdx]).x} cy={map(ride[rideIdx]).y} r={9} fill={C.ink} />
          <Label x={map(ride[rideIdx]).x + 16} y={map(ride[rideIdx]).y - 18} anchor="start" size={22} color={C.ink}>+q₀</Label>
        </g>
      ) : null}
      {s.equipotentials ? (
        <g opacity={pE}>
          <line x1={box.w - 290} x2={box.w - 250} y1={box.h - 20} y2={box.h - 20} stroke={C.teal} strokeWidth={2} strokeDasharray="2 5" />
          <Label x={box.w - 240} y={box.h - 20} anchor="start" size={22} color={C.muted}>equipotential</Label>
        </g>
      ) : null}
    </svg>
  );
};

// ========================================================== magnetic field
export const MagneticField: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const { s: scale, map } = useWorld(box);
  const ph = phases(dur, [0.8, 2.4, 1.6]);
  const pS = prog(frame, ph[0].start, ph[0].len);
  const pL = lin(frame, ph[1].start, ph[1].len);
  const pX = prog(frame, ph[2].start, ph[2].len);

  if (s.source === "straight_wire") {
    const c = { x: box.w / 2, y: box.h / 2 };
    const out = s.current_out_of_page;
    const radii = [70, 130, 200, 280];
    const rot = frame * (out ? -0.6 : 0.6);
    return (
      <svg width={box.w} height={box.h}>
        {radii.map((r, i) => {
          const pp = clamp(pL * 1.3 - i * 0.12, 0, 1);
          const sw = 4.0 - i * 0.6;
          return (
            <g key={r}>
              <circle cx={c.x} cy={c.y} r={r} stroke={C.blue} strokeWidth={sw} fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - pp} opacity={0.9 - i * 0.12} transform={`rotate(-90 ${c.x} ${c.y})`} />
              {pp >= 1 ? [0, 120, 240].map((a0) => {
                const a = ((a0 + rot + i * 40) * Math.PI) / 180;
                const at = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
                const tang = out ? a - Math.PI / 2 : a + Math.PI / 2;
                return <Chevron key={a0} at={at} angle={tang} color={C.blue} size={12} />;
              }) : null}
            </g>
          );
        })}
        <g opacity={pS}>
          <circle cx={c.x} cy={c.y} r={30} fill={C.bgRaise} stroke={C.orange} strokeWidth={4} />
          {out ? <circle cx={c.x} cy={c.y} r={8} fill={C.orange} /> : (
            <g stroke={C.orange} strokeWidth={4} strokeLinecap="round"><line x1={c.x - 13} y1={c.y - 13} x2={c.x + 13} y2={c.y + 13} /><line x1={c.x + 13} y1={c.y - 13} x2={c.x - 13} y2={c.y + 13} /></g>
          )}
          <Label x={c.x} y={c.y + 62} size={24} color={C.orange}>I {out ? "out of page" : "into page"}</Label>
        </g>
        <g opacity={pX}>
          <Label x={c.x + 300} y={c.y - 250} anchor="start" size={28} color={C.blue} italic>B ∝ I / r</Label>
          <Label x={c.x + 300} y={c.y - 210} anchor="start" size={22} color={C.muted}>{out ? "counter-clockwise" : "clockwise"} (right-hand rule)</Label>
        </g>
      </svg>
    );
  }

  // bar magnet and solenoid share a dipole model with distributed pole charges
  const len = s.source === "solenoid" ? 2.6 : 2.2;
  const thick = s.source === "solenoid" ? 1.0 : 0.62;
  const poles: Q[] = [];
  for (let k = 0; k < 7; k++) {
    const y = -thick / 2 + (thick * (k + 0.5)) / 7;
    poles.push({ q: 1 / 7, x: len / 2, y }, { q: -1 / 7, x: -len / 2, y });
  }
  const lines: Pt[][] = [];
  const sinksS = poles.filter((p) => p.q < 0);
  const inView = (p: Pt) => Math.abs(p.x) <= WX && Math.abs(p.y) <= WY;
  // fan of seeds around the N face; a line that leaves the view is mirrored (x -> -x)
  // so it visibly returns into S, the way a dipole loop does.
  for (const deg of [-78, -58, -38, -20, -6, 6, 20, 38, 58, 78]) {
    const a = (deg * Math.PI) / 180;
    const seed = { x: len / 2 + 0.06 + 0.12 * Math.cos(a), y: (thick / 2 + 0.05) * Math.sin(a) };
    const l = trace(poles, seed, 1, sinksS, 0.03, 1600);
    lines.push(l);
    if (inView(l[l.length - 1]) === false) lines.push(l.map((p) => ({ x: -p.x, y: p.y })).reverse());
  }
  const tl = map({ x: -len / 2, y: thick / 2 }), br = map({ x: len / 2, y: -thick / 2 });
  // iron filings
  const filings: React.ReactNode[] = [];
  for (let gx = -WX + 0.25; gx < WX; gx += 0.42) for (let gy = -WY + 0.25; gy < WY; gy += 0.42) {
    if (Math.abs(gx) < len / 2 + 0.15 && Math.abs(gy) < thick / 2 + 0.15) continue;
    const f = fieldAt(poles, gx, gy);
    const m = Math.hypot(f.ex, f.ey) || 1;
    const a = map({ x: gx - (f.ex / m) * 0.1, y: gy - (f.ey / m) * 0.1 });
    const b = map({ x: gx + (f.ex / m) * 0.1, y: gy + (f.ey / m) * 0.1 });
    filings.push(<line key={`${gx}-${gy}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.muted} strokeWidth={2} opacity={0.35} strokeLinecap="round" />);
  }
  return (
    <svg width={box.w} height={box.h}>
      <g opacity={pS}>{filings}</g>
      {lines.map((l, i) => lineWithArrows(l, map, C.blue, clamp(pL * 1.2 - (i % 4) * 0.05, 0, 1), `m${i}`))}
      {s.source === "solenoid" ? (
        <g opacity={pS}>
          {/* inside field: uniform */}
          {[-0.28, 0, 0.28].map((y, i) => {
            const a = map({ x: -len / 2, y }), b = map({ x: len / 2, y });
            return <Arrow key={i} from={a} to={b} p={pL} color={C.blue} width={2.6} head={14} />;
          })}
          {Array.from({ length: 12 }).map((_, k) => {
            const x = tl.x + ((br.x - tl.x) * (k + 0.5)) / 12;
            return <ellipse key={k} cx={x} cy={(tl.y + br.y) / 2} rx={14} ry={(br.y - tl.y) / 2 + 8} stroke={C.orange} strokeWidth={4} fill="none" opacity={0.9} />;
          })}
          <Label x={(tl.x + br.x) / 2} y={br.y + 50} size={24} color={C.orange}>current I in the coil</Label>
          <Label x={br.x + 40} y={tl.y - 20} size={28} color={C.red} weight={700}>N</Label>
          <Label x={tl.x - 40} y={tl.y - 20} size={28} color={C.blue} weight={700}>S</Label>
        </g>
      ) : (
        <g opacity={pS}>
          <rect x={tl.x} y={tl.y} width={(br.x - tl.x) / 2} height={br.y - tl.y} fill="#3A6FB0" rx={6} />
          <rect x={(tl.x + br.x) / 2} y={tl.y} width={(br.x - tl.x) / 2} height={br.y - tl.y} fill="#C2524C" rx={6} />
          <Label x={tl.x + (br.x - tl.x) * 0.25} y={(tl.y + br.y) / 2} size={40} color={C.ink} weight={700} halo="transparent">S</Label>
          <Label x={tl.x + (br.x - tl.x) * 0.75} y={(tl.y + br.y) / 2} size={40} color={C.ink} weight={700} halo="transparent">N</Label>
        </g>
      )}
      <g opacity={pX}>
        <Label x={box.w - 20} y={30} anchor="end" size={24} color={C.muted}>Lines never cross · denser = stronger field</Label>
      </g>
      {void scale}
    </svg>
  );
};

export const fieldUtils = { fmt };
