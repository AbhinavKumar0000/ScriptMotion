import React from "react";
import { useCurrentFrame } from "remotion";
import { C, F, FPS } from "../theme";
import { clamp, fmt, lin, phases, prog } from "../lib/anim";
import { SceneProps } from "../types";
import { Arrow, Label, Pt, pathOf } from "../ui/svg";
import { Axes, plane } from "../ui/axes";
import { Readout } from "./mechanics";

// ------------------------------------------------------------- helpers
const polyLen = (pts: Pt[]) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
const along = (pts: Pt[], d: number): Pt => {
  let rem = d;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (rem <= seg) { const t = rem / seg; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; }
    rem -= seg;
  }
  return pts[pts.length - 1];
};

const Resistor: React.FC<{ a: Pt; b: Pt; color?: string }> = ({ a, b, color = C.ink }) => {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const zz: Pt[] = [{ x: 0, y: 0 }, { x: len * 0.2, y: 0 }];
  const n = 6;
  for (let i = 0; i < n; i++) zz.push({ x: len * 0.2 + (len * 0.6 * (i + 0.5)) / n, y: i % 2 ? 16 : -16 });
  zz.push({ x: len * 0.8, y: 0 }, { x: len, y: 0 });
  return (
    <g transform={`translate(${a.x},${a.y}) rotate(${ang})`}>
      <rect x={len * 0.18} y={-24} width={len * 0.64} height={48} fill={C.bg} />
      <path d={pathOf(zz)} stroke={color} strokeWidth={3.5} fill="none" strokeLinejoin="round" />
    </g>
  );
};

const Battery: React.FC<{ at: Pt; vertical?: boolean; label: string }> = ({ at, label }) => (
  <g>
    <rect x={at.x - 34} y={at.y - 30} width={68} height={60} fill={C.bg} />
    <line x1={at.x - 30} x2={at.x + 30} y1={at.y - 12} y2={at.y - 12} stroke={C.ink} strokeWidth={4} />
    <line x1={at.x - 16} x2={at.x + 16} y1={at.y + 12} y2={at.y + 12} stroke={C.ink} strokeWidth={8} />
    <Label x={at.x + 46} y={at.y - 14} anchor="start" size={22} color={C.red} weight={700}>+</Label>
    <Label x={at.x + 46} y={at.y + 16} anchor="start" size={22} color={C.blue} weight={700}>−</Label>
    <Label x={at.x - 48} y={at.y} anchor="end" size={26} color={C.ink} mono>{label}</Label>
  </g>
);

// ============================================================== circuit
export const Circuit: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const V = s.voltage, Rs: number[] = s.resistors;
  const series = s.arrangement === "series" || Rs.length === 1;
  const Req = series ? Rs.reduce((a, b) => a + b, 0) : 1 / Rs.reduce((a, r) => a + 1 / r, 0);
  const I = V / Req;
  const ph = phases(dur, [1, 1, 3]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const pLab = prog(frame, ph[1].start, ph[1].len);
  const t = Math.max(0, frame - ph[1].start) / FPS;
  const L = 120, R = box.w - 120, T = 80, B = box.h - 90;
  const bat = { x: L, y: (T + B) / 2 };
  const dots = (path: Pt[], current: number, key: string, count?: number) => {
    const len = polyLen(path);
    const n = count ?? Math.round(len / 70);
    const speed = 40 + current * 40;
    return Array.from({ length: n }, (_, i) => {
      const d = ((i * len) / n + t * speed) % len;
      const p = along(path, d);
      return <circle key={`${key}${i}`} cx={p.x} cy={p.y} r={6} fill={C.light} opacity={0.9 * pLab} />;
    });
  };
  const wire = (pts: Pt[], k: string) => <path key={k} d={pathOf(pts)} stroke={C.muted} strokeWidth={4} fill="none" strokeLinejoin="round" opacity={pIn} />;

  if (series) {
    // loop: battery(+ at top) -> up -> right along top through resistors -> down -> left -> back up
    const loop: Pt[] = [{ x: L, y: bat.y - 20 }, { x: L, y: T }, { x: R, y: T }, { x: R, y: B }, { x: L, y: B }, { x: L, y: bat.y + 20 }];
    const segW = (R - L) / (Rs.length + 1);
    return (
      <div style={{ position: "relative", width: box.w, height: box.h }}>
        <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
          {wire([...loop], "w")}
          {dots(loop, I, "d")}
          {Rs.map((r, i) => {
            const cx = L + segW * (i + 1);
            const a = { x: cx - 80, y: T }, b = { x: cx + 80, y: T };
            return (
              <g key={i} opacity={pIn}>
                <Resistor a={a} b={b} />
                <Label x={cx} y={T - 46} size={26} color={C.ink} mono>{`R${i + 1} = ${fmt(r, 1)} Ω`}</Label>
                <Label x={cx} y={T + 54} size={24} color={C.green} mono opacity={pLab}>{`V = ${fmt(I * r, 2)} V`}</Label>
              </g>
            );
          })}
          <g opacity={pIn}><Battery at={bat} label={`${fmt(V, 1)} V`} /></g>
          <Arrow from={{ x: (L + R) / 2 - 60, y: B - 30 }} to={{ x: (L + R) / 2 - 140, y: B - 30 }} color={C.light} width={3} head={14} opacity={pLab} />
          <Label x={(L + R) / 2 - 40} y={B - 30} anchor="start" size={24} color={C.light} mono opacity={pLab}>{`I = ${fmt(I, 2)} A`}</Label>
        </svg>
        <Readout right y={box.h / 2 - 70} x={150} p={prog(frame, ph[2].start, 16)} rows={[["R_eq = ΣR", `${fmt(Req, 2)} Ω`], ["I = V/R_eq", `${fmt(I, 2)} A`]]} foot="Same current through each resistor" />
      </div>
    );
  }

  const n = Rs.length;
  const bxs = Rs.map((_, i) => L + ((R - L) * (i + 1)) / (n + 0.6));
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        {wire([{ x: L, y: bat.y - 20 }, { x: L, y: T }, { x: bxs[n - 1], y: T }], "top")}
        {wire([{ x: L, y: bat.y + 20 }, { x: L, y: B }, { x: bxs[n - 1], y: B }], "bot")}
        {bxs.map((x, i) => wire([{ x, y: T }, { x, y: B }], `br${i}`))}
        {Rs.map((r, i) => dots([{ x: L, y: bat.y - 20 }, { x: L, y: T }, { x: bxs[i], y: T }, { x: bxs[i], y: B }, { x: L, y: B }, { x: L, y: bat.y + 20 }], V / r, `p${i}`, 7))}
        {Rs.map((r, i) => {
          const x = bxs[i], cy = (T + B) / 2;
          return (
            <g key={i} opacity={pIn}>
              <Resistor a={{ x, y: cy - 90 }} b={{ x, y: cy + 90 }} />
              <Label x={x + 34} y={cy - 20} anchor="start" size={26} color={C.ink} mono>{`R${i + 1} = ${fmt(r, 1)} Ω`}</Label>
              <Label x={x + 34} y={cy + 20} anchor="start" size={24} color={C.green} mono opacity={pLab}>{`I = ${fmt(V / r, 2)} A`}</Label>
            </g>
          );
        })}
        <g opacity={pIn}><Battery at={bat} label={`${fmt(V, 1)} V`} /></g>
      </svg>
      <Readout right y={0} x={0} p={prog(frame, ph[2].start, 16)} rows={[["1/R_eq = Σ 1/R", `${fmt(Req, 2)} Ω`], ["I total", `${fmt(I, 2)} A`]]} foot="Same voltage across each branch" />
    </div>
  );
};

// ============================================================ induction
export const Induction: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const ph = phases(dur, [0.8, 3.6]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const t = Math.max(0, frame - ph[0].start);
  const period = Math.max(60, ph[1].len / 2);
  // magnet: in (0-0.3), rest (0.3-0.5), out (0.5-0.8), rest
  const cyc = (t % period) / period;
  const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));
  const pos = cyc < 0.3 ? ease(cyc / 0.3) : cyc < 0.5 ? 1 : cyc < 0.8 ? 1 - ease((cyc - 0.5) / 0.3) : 0;
  const vel = cyc < 0.3 ? Math.sin((Math.PI * cyc) / 0.3) : cyc >= 0.5 && cyc < 0.8 ? -Math.sin((Math.PI * (cyc - 0.5)) / 0.3) : 0;
  const coilX = box.w * 0.55, coilY = box.h * 0.36, coilW = 300, coilH = 170;
  const mx = 60 + pos * (coilX - coilW / 2 - 60 - 120 + 90);
  const turns = s.turns;
  const g = { x: coilX, y: box.h - 130 };
  const needle = (-vel * 50 * Math.PI) / 180;
  const state = Math.abs(vel) < 0.05 ? "Magnet at rest: no change in flux, no current" : vel > 0 ? "Magnet moving in: flux increases" : "Magnet moving out: flux decreases";
  return (
    <svg width={box.w} height={box.h}>
      <g opacity={pIn}>
        {/* wires to galvanometer */}
        <path d={`M${coilX - coilW / 2},${coilY + coilH / 2} L${coilX - coilW / 2},${g.y} L${g.x - 70},${g.y}`} stroke={C.muted} strokeWidth={3} fill="none" />
        <path d={`M${coilX + coilW / 2},${coilY + coilH / 2} L${coilX + coilW / 2},${g.y} L${g.x + 70},${g.y}`} stroke={C.muted} strokeWidth={3} fill="none" />
        {/* galvanometer */}
        <circle cx={g.x} cy={g.y} r={70} fill={C.bgRaise} stroke={C.hairStrong} strokeWidth={3} />
        {[-50, -25, 0, 25, 50].map((a) => { const r = (a * Math.PI) / 180; return <line key={a} x1={g.x + Math.sin(r) * 50} y1={g.y - Math.cos(r) * 50} x2={g.x + Math.sin(r) * 60} y2={g.y - Math.cos(r) * 60} stroke={C.muted} strokeWidth={2} />; })}
        <line x1={g.x} y1={g.y + 10} x2={g.x + Math.sin(needle) * 56} y2={g.y - Math.cos(needle) * 56} stroke={C.red} strokeWidth={4} strokeLinecap="round" />
        <circle cx={g.x} cy={g.y + 10} r={6} fill={C.ink} />
        <Label x={g.x} y={g.y + 36} size={22} color={C.muted}>G</Label>
      </g>
      {/* back half of coil */}
      {Array.from({ length: turns }).map((_, i) => {
        const x = coilX - coilW / 2 + (coilW * (i + 0.5)) / turns;
        return <path key={`b${i}`} d={`M${x},${coilY - coilH / 2} A16,${coilH / 2} 0 0 0 ${x},${coilY + coilH / 2}`} stroke={C.orange} strokeWidth={4} fill="none" opacity={0.45 * pIn} />;
      })}
      {/* magnet */}
      <g opacity={pIn}>
        <rect x={mx} y={coilY - 40} width={120} height={80} rx={6} fill="#3A6FB0" />
        <rect x={mx + 120} y={coilY - 40} width={120} height={80} rx={6} fill="#C2524C" />
        <Label x={mx + 60} y={coilY} size={34} color={C.ink} weight={700} halo="transparent">S</Label>
        <Label x={mx + 180} y={coilY} size={34} color={C.ink} weight={700} halo="transparent">N</Label>
        {Math.abs(vel) > 0.05 ? <Arrow from={{ x: mx + 120, y: coilY - 70 }} to={{ x: mx + 120 + Math.sign(vel) * 110, y: coilY - 70 }} color={C.light} width={4} head={16} /> : null}
      </g>
      {/* front half of coil */}
      {Array.from({ length: turns }).map((_, i) => {
        const x = coilX - coilW / 2 + (coilW * (i + 0.5)) / turns;
        return <path key={`f${i}`} d={`M${x},${coilY - coilH / 2} A16,${coilH / 2} 0 0 1 ${x},${coilY + coilH / 2}`} stroke={C.orange} strokeWidth={5} fill="none" opacity={pIn} />;
      })}
      <Label x={coilX} y={coilY - coilH / 2 - 30} size={22} color={C.muted} opacity={pIn}>{`coil, N = ${turns} turns`}</Label>
      <Label x={box.w - 20} y={box.h - 30} anchor="end" size={26} color={Math.abs(vel) < 0.05 ? C.muted : C.light} opacity={lin(frame, ph[1].start, 10)}>{state}</Label>
      <Label x={box.w - 20} y={30} anchor="end" size={30} color={C.ink} italic opacity={pIn}>ε = −N dΦ/dt</Label>
    </svg>
  );
};

// ======================================================== gas particles
const reflect = (v: number) => { const m = ((v % 2) + 2) % 2; return m > 1 ? 2 - m : m; };
export const GasParticles: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const N = s.particles;
  const ph = phases(dur, [0.6, 1.6, 1.4, 1.2]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const comp = s.compress ? prog(frame, ph[2].start, ph[2].len) : 0;
  const left = 40, top = 30, H = box.h - 70;
  const fullW = box.w * 0.62;
  const Wn = fullW * (1 - 0.5 * comp);
  const speed = 0.0045 * Math.sqrt(s.temperature / 300);
  const t = frame;
  const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const parts = Array.from({ length: N }, (_, i) => {
    const a = rnd(i, 1) * Math.PI * 2;
    const sp = speed * (0.6 + rnd(i, 2) * 0.9);
    const u = reflect(rnd(i, 3) + Math.cos(a) * sp * t * (fullW / Wn));
    const v = reflect(rnd(i, 4) + Math.sin(a) * sp * t * (fullW / H));
    const hitting = u < 0.015 || u > 0.985 || v < 0.015 || v > 0.985;
    return { x: left + 12 + u * (Wn - 24), y: top + 12 + v * (H - 24), hit: hitting, hot: i % 9 === 0 };
  });
  const P = (1 / (1 - 0.5 * comp)) * (s.temperature / 300);
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <rect x={left} y={top} width={Wn} height={H} fill="rgba(90,169,240,0.05)" stroke={C.hairStrong} strokeWidth={3} opacity={pIn} />
        {s.compress ? (
          <g opacity={pIn}>
            <rect x={left + Wn} y={top} width={16} height={H} fill={C.muted} />
            <rect x={left + Wn + 16} y={top + H / 2 - 8} width={fullW - Wn + 120} height={16} fill={C.muted} />
          </g>
        ) : null}
        {parts.map((p, i) => (
          <g key={i}>
            {p.hit ? <circle cx={p.x} cy={p.y} r={16} fill={C.light} opacity={0.25} /> : null}
            <circle cx={p.x} cy={p.y} r={8} fill={p.hot ? C.orange : C.blue} opacity={pIn} />
          </g>
        ))}
      </svg>
      <Readout right p={prog(frame, ph[1].start, 16)} rows={[["Molecules", `${N}`], ["Temperature", `${fmt(s.temperature, 0)} K`], ["Volume", `${fmt(1 - 0.5 * comp, 2)} V₀`], ["Pressure", `${fmt(P, 2)} P₀`]]}
        foot={s.compress ? "PV stays constant at fixed T" : "Faster molecules hit the walls harder"} />
    </div>
  );
};

// =========================================================== P-V diagram
export const PVDiagram: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const g = 1.4;
  const v1 = Math.min(s.v1, s.v2), v2 = Math.max(s.v1, s.v2);
  const k = 12;
  type Seg = { pts: { v: number; p: number }[]; label: string; color: string };
  const iso = (a: number, b: number, kk: number) => Array.from({ length: 60 }, (_, i) => { const v = a + ((b - a) * i) / 59; return { v, p: kk / v }; });
  const adi = (a: number, b: number, kk: number) => Array.from({ length: 60 }, (_, i) => { const v = a + ((b - a) * i) / 59; return { v, p: kk / Math.pow(v, g) }; });
  let segs: Seg[] = [];
  let caption = "";
  if (s.process === "isothermal") { segs = [{ pts: iso(v1, v2, k), label: "PV = const", color: C.blue }]; caption = "W = nRT ln(V₂/V₁)"; }
  else if (s.process === "adiabatic") { segs = [{ pts: adi(v1, v2, k * Math.pow(v1, g - 1)), label: "PV^γ = const", color: C.red }]; caption = "W = (P₁V₁ − P₂V₂)/(γ − 1)"; }
  else if (s.process === "isobaric") { segs = [{ pts: [{ v: v1, p: 4 }, { v: v2, p: 4 }], label: "P = const", color: C.green }]; caption = "W = P(V₂ − V₁)"; }
  else if (s.process === "isochoric") { segs = [{ pts: [{ v: v1, p: 2 }, { v: v1, p: 6 }], label: "V = const", color: C.orange }]; caption = "W = 0 (no volume change)"; }
  else {
    const kh = 12, kc = 7;
    const VA = v1, VB = v2;
    const kB = (kh / VB) * Math.pow(VB, g), kA = (kh / VA) * Math.pow(VA, g);
    const VC = Math.pow(kB / kc, 1 / (g - 1)), VD = Math.pow(kA / kc, 1 / (g - 1));
    segs = [
      { pts: iso(VA, VB, kh), label: "1→2 isothermal", color: C.red },
      { pts: adi(VB, VC, kB), label: "2→3 adiabatic", color: C.orange },
      { pts: iso(VC, VD, kc), label: "3→4 isothermal", color: C.blue },
      { pts: adi(VD, VA, kA), label: "4→1 adiabatic", color: C.violet },
    ];
    caption = "Net work = enclosed area";
  }
  const all = segs.flatMap((x) => x.pts);
  const vmax = Math.max(...all.map((p) => p.v)) * 1.15, pmax = Math.max(...all.map((p) => p.p)) * 1.2;
  const pl = plane(0, vmax, 0, pmax, { left: 70, top: 30, width: box.w - 120, height: box.h - 90 });
  const ph = phases(dur, [0.8, 3, 1.2]);
  const pAx = prog(frame, ph[0].start, ph[0].len);
  const pr = lin(frame, ph[1].start, ph[1].len) * segs.length;
  const pW = prog(frame, ph[2].start, ph[2].len);
  const cycle = s.process === "carnot";
  const areaPath = cycle
    ? pathOf(all.map((q) => ({ x: pl.sx(q.v), y: pl.sy(q.p) })), true)
    : s.process === "isochoric" ? "" : pathOf([...segs[0].pts.map((q) => ({ x: pl.sx(q.v), y: pl.sy(q.p) })), { x: pl.sx(segs[0].pts[segs[0].pts.length - 1].v), y: pl.sy(0) }, { x: pl.sx(segs[0].pts[0].v), y: pl.sy(0) }], true);
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <Axes pl={pl} opacity={pAx} xLabel="V" yLabel="P" tickLabels={false} />
        {areaPath ? <path d={areaPath} fill={C.light} opacity={0.14 * pW} /> : null}
        {segs.map((sg, i) => {
          const p = clamp(pr - i, 0, 1);
          if (p <= 0) return null;
          const n = Math.max(2, Math.round(sg.pts.length * p));
          const pts = sg.pts.slice(0, n).map((q) => ({ x: pl.sx(q.v), y: pl.sy(q.p) }));
          const mid = sg.pts[Math.floor(sg.pts.length / 2)];
          const end = pts[pts.length - 1];
          return (
            <g key={i}>
              <path d={pathOf(pts)} stroke={sg.color} strokeWidth={4.5} fill="none" />
              {n >= 2 ? <Arrow from={pts[Math.max(0, n - 3)]} to={end} color={sg.color} width={0.1} head={18} /> : null}
              <Label x={pl.sx(mid.v) + (cycle ? 0 : 20)} y={pl.sy(mid.p) - 30} size={23} color={sg.color} opacity={p}>{sg.label}</Label>
            </g>
          );
        })}
        <Label x={pl.left + pl.width - 10} y={pl.top + 20} anchor="end" size={30} color={C.light} italic opacity={pW}>{caption}</Label>
      </svg>
    </div>
  );
};

// ========================================================= energy levels
const wlColor = (nm: number) => {
  if (nm < 380) return C.violet;
  if (nm > 750) return "#C55";
  const stops: [number, string][] = [[380, "#8B5CF6"], [440, "#4D7CFF"], [490, "#2BC6E0"], [530, "#4FD86B"], [580, "#FFE14D"], [620, "#FF9A3D"], [680, "#FF4D4D"], [750, "#C0392B"]];
  for (let i = 1; i < stops.length; i++) if (nm <= stops[i][0]) return stops[i - 1][1];
  return "#C0392B";
};
const SERIES_NAME: Record<number, string> = { 1: "Lyman (UV)", 2: "Balmer (visible)", 3: "Paschen (IR)", 4: "Brackett (IR)", 5: "Pfund (IR)" };

export const EnergyLevels: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const E = (n: number) => -13.6 / (n * n);
  const from = s.from_level, to = s.to_level;
  const dE = Math.abs(E(from) - E(to));
  const nm = 1240 / dE;
  const emit = to < from;
  const ph = phases(dur, [1, 1, 1.4, 1.4]);
  const pL = prog(frame, ph[0].start, ph[0].len);
  const pJ = prog(frame, ph[1].start + ph[1].len * 0.4, ph[1].len * 0.8);
  const pP = lin(frame, ph[2].start, ph[2].len);
  const pR = prog(frame, ph[3].start, 16);
  const top = 50, bottom = box.h - 40, x0 = 160, x1 = box.w * 0.56;
  const y = (e: number) => top + ((0 - e) / 13.6) * (bottom - top);
  const lx = (x0 + x1) / 2;
  const yF = y(E(from)), yT = y(E(to));
  const ey = emit ? (pJ < 1 ? yF + (yT - yF) * pJ : yT) : (pP < 1 ? yF : yF + (yT - yF) * pJ);
  const col = wlColor(nm);
  const wig = (x0w: number, y0w: number, len: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 80; i++) { const d = (len * i) / 80; pts.push({ x: x0w + d, y: y0w + Math.sin(d * 0.12) * 14 }); }
    return pathOf(pts);
  };
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <line x1={x0} x2={x1} y1={y(0)} y2={y(0)} stroke={C.faint} strokeWidth={2} strokeDasharray="6 8" opacity={pL} />
        <Label x={x1 + 16} y={y(0)} anchor="start" size={20} color={C.faint} opacity={pL}>0 eV (ionised)</Label>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <g key={n} opacity={pL}>
            <line x1={x0} x2={x1} y1={y(E(n))} y2={y(E(n))} stroke={n === from || n === to ? C.ink : C.hairStrong} strokeWidth={n === from || n === to ? 3.5 : 2} />
            {n <= 4 ? <Label x={x0 - 16} y={y(E(n))} anchor="end" size={24} color={C.muted} italic>{`n = ${n}`}</Label> : null}
            {n <= 4 ? <Label x={x1 + 16} y={y(E(n))} anchor="start" size={20} color={C.faint} mono>{`${fmt(E(n), 2)} eV`}</Label> : null}
          </g>
        ))}
        {pJ > 0 ? <Arrow from={{ x: lx, y: yF }} to={{ x: lx, y: yT }} p={pJ} color={C.ink} width={3} head={14} dashed /> : null}
        <circle cx={lx} cy={ey} r={13} fill={C.blue} opacity={pL} />
        {emit && pJ >= 1 ? <path d={wig(lx + 30, yT - 30, (box.w - lx - 60) * pP)} stroke={col} strokeWidth={4} fill="none" /> : null}
        {!emit && pP > 0 ? <path d={wig(lx + 30 + (box.w - lx - 60) * pP, yF - 30, (box.w - lx - 60) * (1 - pP))} stroke={col} strokeWidth={4} fill="none" /> : null}
      </svg>
      <Readout right y={box.h - 210} p={pR} rows={[["Transition", `n = ${from} → ${to}`], ["ΔE", `${fmt(dE, 2)} eV`], ["λ = hc/ΔE", `${fmt(nm, 0)} nm`], ["Series", SERIES_NAME[Math.min(from, to)] || "—"]]} foot={emit ? "Photon emitted" : "Photon absorbed"} />
    </div>
  );
};

export const _f = F;
