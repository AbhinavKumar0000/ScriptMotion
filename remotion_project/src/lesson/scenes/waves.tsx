import React from "react";
import { useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { clamp, fmt, lin, phases, prog } from "../lib/anim";
import { SceneProps } from "../types";
import { Arrow, Label, Pt, pathOf } from "../ui/svg";

const TAU = Math.PI * 2;

// ================================================================ EM wave
export const EMWave: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const ph = phases(dur, [1, 2.2, 2]);
  const pAx = prog(frame, ph[0].start, ph[0].len);
  const front = lin(frame, ph[1].start, ph[1].len);
  const pLab = prog(frame, ph[2].start, 20);
  const x0 = 90, x1 = box.w - 70, oy = box.h * 0.5;
  const L = x1 - x0;
  const amp = box.h * 0.32;
  // oblique projection for z (depth)
  const zx = -0.55, zy = 0.42;
  const P = (x: number, y: number, z: number): Pt => ({ x: x0 + x + z * zx * amp, y: oy - y + z * zy * amp });
  const k = (TAU * s.cycles) / L;
  const w = 0.11;
  const t = frame;
  const N = 140;
  const reach = L * front;
  const E: Pt[] = [], B: Pt[] = [];
  const eLines: React.ReactNode[] = [], bLines: React.ReactNode[] = [];
  for (let i = 0; i <= N; i++) {
    const x = (L * i) / N;
    if (x > reach) break;
    const env = clamp((reach - x) / 60, 0, 1);
    const v = Math.sin(k * x - w * t) * env;
    E.push(P(x, v * amp, 0));
    B.push(P(x, 0, v * 0.78));
    if (i % 4 === 0) {
      const a = P(x, 0, 0), e = P(x, v * amp, 0), b = P(x, 0, v * 0.78);
      eLines.push(<line key={`e${i}`} x1={a.x} y1={a.y} x2={e.x} y2={e.y} stroke={C.blue} strokeWidth={2} opacity={0.45} />);
      bLines.push(<line key={`b${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.red} strokeWidth={2} opacity={0.45} />);
    }
  }
  const lam = TAU / k;
  const crest = (Math.PI / 2 + w * t) / k % lam;
  return (
    <svg width={box.w} height={box.h}>
      <g opacity={pAx}>
        <Arrow from={P(-20, 0, 0)} to={P(L + 30, 0, 0)} color={C.muted} width={2.5} head={14} />
        <Arrow from={P(0, -amp * 1.1, 0)} to={P(0, amp * 1.15, 0)} color={C.muted} width={2} head={12} />
        <Arrow from={P(0, 0, -1.05)} to={P(0, 0, 1.1)} color={C.muted} width={2} head={12} />
        <Label x={P(L + 40, 0, 0).x} y={P(L + 40, 0, 0).y + 30} size={24} color={C.muted} italic>x</Label>
        <Label x={P(0, amp * 1.15, 0).x + 18} y={P(0, amp * 1.15, 0).y} size={24} color={C.muted} anchor="start" italic>y</Label>
        <Label x={P(0, 0, 1.1).x - 14} y={P(0, 0, 1.1).y + 18} size={24} color={C.muted} anchor="end" italic>z</Label>
      </g>
      {bLines}
      <path d={pathOf(B)} stroke={C.red} strokeWidth={4} fill="none" />
      {eLines}
      <path d={pathOf(E)} stroke={C.blue} strokeWidth={4} fill="none" />
      {s.show_labels ? (
        <g opacity={pLab}>
          <rect x={box.w - 300} y={10} width={18} height={18} rx={4} fill={C.blue} />
          <Label x={box.w - 270} y={19} anchor="start" size={24} color={C.ink}>Electric field E</Label>
          <rect x={box.w - 300} y={50} width={18} height={18} rx={4} fill={C.red} />
          <Label x={box.w - 270} y={59} anchor="start" size={24} color={C.ink}>Magnetic field B</Label>
          <Arrow from={P(L * 0.55, -amp * 1.25, 0)} to={P(L * 0.8, -amp * 1.25, 0)} color={C.light} width={3.5} head={16} />
          <Label x={P(L * 0.82, -amp * 1.25, 0).x + 10} y={P(0, -amp * 1.25, 0).y} anchor="start" size={26} color={C.light}>c = 3 × 10⁸ m/s</Label>
          {crest + lam < L ? (
            <g>
              <line x1={P(crest, amp * 1.02, 0).x} x2={P(crest + lam, amp * 1.02, 0).x} y1={P(0, amp * 1.08, 0).y} y2={P(0, amp * 1.08, 0).y} stroke={C.ink} strokeWidth={2} />
              <line x1={P(crest, 0, 0).x} x2={P(crest, 0, 0).x} y1={P(0, amp * 1.02, 0).y} y2={P(0, amp * 1.14, 0).y} stroke={C.ink} strokeWidth={2} />
              <line x1={P(crest + lam, 0, 0).x} x2={P(crest + lam, 0, 0).x} y1={P(0, amp * 1.02, 0).y} y2={P(0, amp * 1.14, 0).y} stroke={C.ink} strokeWidth={2} />
              <Label x={P(crest + lam / 2, 0, 0).x} y={P(0, amp * 1.2, 0).y} size={28} color={C.ink} italic>λ</Label>
            </g>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
};

// ================================================================== waves
export const Wave: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const ph = phases(dur, [0.8, 3, 1.2]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const pAnn = prog(frame, ph[2].start, 20);
  const x0 = 70, x1 = box.w - 60, L = x1 - x0;
  const lamPx = (L / 6) * s.wavelength;
  const k = TAU / lamPx;
  const w = 0.1;
  const t = frame;

  if (s.mode === "longitudinal") {
    const cols = 70, rows = 9;
    const top = box.h * 0.12, hgt = box.h * 0.42;
    const A = lamPx * 0.16 * s.amplitude * 1.4;
    const parts: React.ReactNode[] = [];
    for (let i = 0; i < cols; i++) {
      const xe = (L * i) / (cols - 1);
      const dx = A * Math.sin(k * xe - w * t) * pIn;
      for (let j = 0; j < rows; j++) {
        const jitter = ((i * 7 + j * 13) % 10) / 10 - 0.5;
        parts.push(<circle key={`${i}-${j}`} cx={x0 + xe + dx + jitter * 4} cy={top + (hgt * (j + 0.5)) / rows + jitter * 6} r={4.5} fill={i === 30 && j === 4 ? C.red : C.blue} opacity={i === 30 && j === 4 ? 1 : 0.8} />);
      }
    }
    // pressure curve below: compression where density highest  (−dξ/dx)
    const gy = box.h * 0.8, gA = box.h * 0.12;
    const pts: Pt[] = [];
    for (let i = 0; i <= 200; i++) {
      const xe = (L * i) / 200;
      pts.push({ x: x0 + xe, y: gy - gA * -Math.cos(k * xe - w * t) * pIn });
    }
    // label compressions: where cos(kx - wt) = -1  => kx - wt = π
    const labels: React.ReactNode[] = [];
    for (let n = -2; n < 10; n++) {
      const xc = (Math.PI + w * t + TAU * n) / k;
      const xr = (w * t + TAU * n) / k;
      if (xc > 20 && xc < L - 20) labels.push(<Label key={`c${n}`} x={x0 + xc} y={top - 22} size={22} color={C.light} opacity={pAnn}>C</Label>);
      if (xr > 20 && xr < L - 20) labels.push(<Label key={`r${n}`} x={x0 + xr} y={top - 22} size={22} color={C.muted} opacity={pAnn}>R</Label>);
    }
    return (
      <svg width={box.w} height={box.h}>
        {parts}
        {labels}
        <line x1={x0} x2={x1} y1={gy} y2={gy} stroke={C.hairStrong} strokeWidth={2} opacity={pIn} />
        <path d={pathOf(pts)} stroke={C.light} strokeWidth={3.5} fill="none" opacity={pIn} />
        <Label x={x0} y={gy - gA - 26} anchor="start" size={22} color={C.muted} opacity={pIn}>pressure</Label>
        <g opacity={pAnn}>
          <Label x={x1} y={top - 22} anchor="end" size={22} color={C.muted}>C = compression · R = rarefaction</Label>
        </g>
      </svg>
    );
  }

  const oy = s.mode === "superposition" ? box.h * 0.22 : box.h * 0.5;
  const amp = (s.mode === "superposition" ? box.h * 0.12 : box.h * 0.3) * s.amplitude;
  const sample = (f: (x: number) => number, y0: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 260; i++) { const x = (L * i) / 260; pts.push({ x: x0 + x, y: y0 - f(x) }); }
    return pts;
  };

  if (s.mode === "standing") {
    const n = s.harmonic;
    const kk = (Math.PI * n) / L;
    const env = Math.cos(w * 1.3 * t);
    const f = (x: number) => amp * Math.sin(kk * x) * env * pIn;
    const ghosts = [1, -1].map((sg) => sample((x) => amp * Math.sin(kk * x) * sg * pIn, oy));
    const nodes = Array.from({ length: n + 1 }, (_, i) => (L * i) / n);
    const anti = Array.from({ length: n }, (_, i) => (L * (i + 0.5)) / n);
    return (
      <svg width={box.w} height={box.h}>
        <line x1={x0} x2={x1} y1={oy} y2={oy} stroke={C.hair} strokeWidth={2} />
        {ghosts.map((g, i) => <path key={i} d={pathOf(g)} stroke={C.blue} strokeWidth={2} strokeDasharray="6 8" fill="none" opacity={0.45} />)}
        <path d={pathOf(sample(f, oy))} stroke={C.blue} strokeWidth={4.5} fill="none" />
        <rect x={x0 - 14} y={oy - amp - 30} width={14} height={2 * amp + 60} fill={C.muted} opacity={0.6} />
        <rect x={x1} y={oy - amp - 30} width={14} height={2 * amp + 60} fill={C.muted} opacity={0.6} />
        <g opacity={pAnn}>
          {nodes.map((x, i) => <g key={`n${i}`}><circle cx={x0 + x} cy={oy} r={8} fill={C.light} /><Label x={x0 + x} y={oy + 40} size={24} color={C.light}>N</Label></g>)}
          {anti.map((x, i) => <Label key={`a${i}`} x={x0 + x} y={oy - amp - 40} size={24} color={C.teal}>A</Label>)}
          <Label x={x1} y={box.h - 20} anchor="end" size={24} color={C.muted} baseline="auto">{`n = ${n}: L = ${n}λ/2 · N node · A antinode`}</Label>
        </g>
      </svg>
    );
  }

  if (s.mode === "superposition") {
    const k2 = TAU / ((L / 6) * s.wave2_wavelength);
    const f1 = (x: number) => amp * Math.sin(k * x - w * t);
    const f2 = (x: number) => amp * 0.8 * Math.sin(k2 * x - w * t * 1.1);
    const y1 = box.h * 0.16, y2 = box.h * 0.43, y3 = box.h * 0.77;
    const pSum = prog(frame, ph[1].start + ph[1].len * 0.35, 30);
    return (
      <svg width={box.w} height={box.h}>
        {[y1, y2, y3].map((y) => <line key={y} x1={x0} x2={x1} y1={y} y2={y} stroke={C.hair} strokeWidth={2} />)}
        <path d={pathOf(sample(f1, y1))} stroke={C.blue} strokeWidth={3.5} fill="none" opacity={pIn} />
        <path d={pathOf(sample(f2, y2))} stroke={C.orange} strokeWidth={3.5} fill="none" opacity={pIn} />
        <path d={pathOf(sample((x) => f1(x) + f2(x), y3))} stroke={C.green} strokeWidth={4.5} fill="none" opacity={pSum} />
        <Label x={x0} y={y1 - amp - 18} anchor="start" size={24} color={C.blue}>wave 1</Label>
        <Label x={x0} y={y2 - amp - 18} anchor="start" size={24} color={C.orange}>wave 2</Label>
        <Label x={x0} y={y3 - amp * 1.8 - 18} anchor="start" size={24} color={C.green} opacity={pSum}>sum: y = y₁ + y₂</Label>
      </svg>
    );
  }

  // transverse: beads on a string
  const f = (x: number) => amp * Math.sin(k * x - w * t) * clamp((frame - ph[0].start) / 20, 0, 1);
  const beads = Array.from({ length: 41 }, (_, i) => (L * i) / 40);
  const tracked = beads[13];
  const crestX = ((Math.PI / 2 + w * t) / k) % lamPx;
  return (
    <svg width={box.w} height={box.h}>
      <line x1={x0} x2={x1} y1={oy} y2={oy} stroke={C.hair} strokeWidth={2} strokeDasharray="4 8" />
      <path d={pathOf(sample(f, oy))} stroke={C.blue} strokeWidth={3} fill="none" opacity={0.6} />
      {beads.map((x, i) => <circle key={i} cx={x0 + x} cy={oy - f(x)} r={i === 13 ? 11 : 7} fill={i === 13 ? C.red : C.blue} />)}
      <line x1={x0 + tracked} x2={x0 + tracked} y1={oy - amp - 10} y2={oy + amp + 10} stroke={C.red} strokeWidth={2} strokeDasharray="4 6" opacity={0.6} />
      <Arrow from={{ x: x1 - 220, y: oy - amp - 80 }} to={{ x: x1 - 60, y: oy - amp - 80 }} color={C.light} width={3} head={14} opacity={pIn} />
      <Label x={x1 - 230} y={oy - amp - 80} anchor="end" size={24} color={C.light} opacity={pIn}>wave travels</Label>
      {s.annotate ? (
        <g opacity={pAnn}>
          {crestX + lamPx < L ? (
            <g>
              <line x1={x0 + crestX} x2={x0 + crestX + lamPx} y1={oy - amp - 30} y2={oy - amp - 30} stroke={C.ink} strokeWidth={2} />
              <line x1={x0 + crestX} x2={x0 + crestX} y1={oy - amp - 42} y2={oy - amp - 18} stroke={C.ink} strokeWidth={2} />
              <line x1={x0 + crestX + lamPx} x2={x0 + crestX + lamPx} y1={oy - amp - 42} y2={oy - amp - 18} stroke={C.ink} strokeWidth={2} />
              <Label x={x0 + crestX + lamPx / 2} y={oy - amp - 56} size={28} color={C.ink} italic>λ</Label>
            </g>
          ) : null}
          <Arrow from={{ x: x0 - 30, y: oy }} to={{ x: x0 - 30, y: oy - amp }} color={C.teal} width={2.5} head={12} />
          <Label x={x0 - 30} y={oy + 30} size={26} color={C.teal} italic>A</Label>
        </g>
      ) : null}
    </svg>
  );
};

// ============================================================== AC phasor
export const ACPhasor: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const ph = phases(dur, [0.8, 3.2]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const R = Math.min(box.h * 0.34, 220);
  const cx = R + 60, cy = box.h / 2;
  const gx0 = cx + R + 120, gx1 = box.w - 40;
  const omega = 0.06;
  const t = Math.max(0, frame - ph[1].start);
  const theta = omega * t;
  const phi = (s.phase_deg * Math.PI) / 180;
  const two = Math.abs(s.phase_deg) > 0.5;
  const R2 = R * 0.7;
  const tip1 = { x: cx + Math.cos(theta) * R, y: cy - Math.sin(theta) * R };
  const tip2 = { x: cx + Math.cos(theta + phi) * R2, y: cy - Math.sin(theta + phi) * R2 };
  const pxPerRad = (gx1 - gx0) / (4 * Math.PI);
  const trace = (rad: number, off: number) => {
    const pts: Pt[] = [];
    for (let a = Math.max(0, theta - 4 * Math.PI); a <= theta; a += 0.04) pts.push({ x: gx0 + (theta - a) * pxPerRad, y: cy - Math.sin(a + off) * rad });
    pts.push({ x: gx0, y: cy - Math.sin(theta + off) * rad });
    return pts.filter((p) => p.x <= gx1);
  };
  // sinusoid scrolls: newest value at gx0
  const tr1 = trace(R, 0), tr2 = trace(R2, phi);
  return (
    <svg width={box.w} height={box.h}>
      <g opacity={pIn}>
        <circle cx={cx} cy={cy} r={R} stroke={C.hair} strokeWidth={2} fill="none" />
        <line x1={cx - R - 20} x2={gx1} y1={cy} y2={cy} stroke={C.hairStrong} strokeWidth={2} />
        <line x1={gx0} x2={gx0} y1={cy - R - 30} y2={cy + R + 30} stroke={C.hairStrong} strokeWidth={2} />
        <Label x={gx1} y={cy + 30} anchor="end" size={22} color={C.muted} italic>time</Label>
      </g>
      <path d={pathOf(tr1)} stroke={C.blue} strokeWidth={4} fill="none" />
      {two ? <path d={pathOf(tr2)} stroke={C.orange} strokeWidth={4} fill="none" /> : null}
      <line x1={tip1.x} x2={gx0} y1={tip1.y} y2={tip1.y} stroke={C.blue} strokeWidth={1.5} strokeDasharray="5 6" opacity={0.6} />
      {two ? <line x1={tip2.x} x2={gx0} y1={tip2.y} y2={tip2.y} stroke={C.orange} strokeWidth={1.5} strokeDasharray="5 6" opacity={0.6} /> : null}
      <Arrow from={{ x: cx, y: cy }} to={tip1} color={C.blue} width={5} head={18} opacity={pIn} />
      {two ? <Arrow from={{ x: cx, y: cy }} to={tip2} color={C.orange} width={5} head={18} opacity={pIn} /> : null}
      <Label x={tip1.x + Math.cos(theta) * 30} y={tip1.y - Math.sin(theta) * 30} size={28} color={C.blue} weight={600}>{s.label1}</Label>
      {two ? <Label x={tip2.x + Math.cos(theta + phi) * 30} y={tip2.y - Math.sin(theta + phi) * 30} size={28} color={C.orange} weight={600}>{s.label2}</Label> : null}
      {two ? (
        <g opacity={pIn}>
          <Label x={cx} y={cy + R + 50} size={26} color={C.ink}>{`${s.label2} ${s.phase_deg < 0 ? "lags" : "leads"} ${s.label1} by ${fmt(Math.abs(s.phase_deg), 0)}°`}</Label>
        </g>
      ) : null}
      <text x={0} y={0} fontFamily={F.sans} />
    </svg>
  );
};
