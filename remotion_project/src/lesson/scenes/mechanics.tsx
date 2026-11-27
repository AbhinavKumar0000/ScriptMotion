import React from "react";
import { useCurrentFrame } from "remotion";
import { C, F, FPS } from "../theme";
import { clamp, fmt, lin, phases, prog } from "../lib/anim";
import { SceneProps } from "../types";
import { Arrow, Label, Pt, pathOf } from "../ui/svg";
import { Axes, plane } from "../ui/axes";

const card: React.CSSProperties = { background: "rgba(23,27,35,0.92)", border: `1px solid ${C.hair}`, borderRadius: 12 };

export const Readout: React.FC<{ rows: [string, string][]; p: number; x?: number; y?: number; right?: boolean; foot?: string }> = ({ rows, p, x = 0, y = 0, right, foot }) => (
  <div style={{ position: "absolute", [right ? "right" : "left"]: x, top: y, ...card, padding: "14px 22px", opacity: p, transform: `translateY(${(1 - p) * 10}px)`, minWidth: 240, maxWidth: 380 }}>
    {rows.map(([k, v]) => (
      <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 28, fontSize: 24, lineHeight: 1.6 }}>
        <span style={{ color: C.muted, fontFamily: F.sans }}>{k}</span>
        <span style={{ color: C.ink, fontFamily: F.mono }}>{v}</span>
      </div>
    ))}
    {foot ? <div style={{ marginTop: 6, paddingTop: 8, borderTop: `1px solid ${C.hair}`, color: C.green, fontFamily: F.sans, fontSize: 22 }}>{foot}</div> : null}
  </div>
);

// ============================================================== projectile
export const Projectile: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const { speed: v, g } = s;
  const th = (s.angle_deg * Math.PI) / 180;
  const vx = v * Math.cos(th), vy = v * Math.sin(th);
  const T = (2 * vy) / g, R = vx * T, Hm = (vy * vy) / (2 * g);
  const pl = plane(-R * 0.04, R * 1.12, 0, Math.max(Hm * 1.45, R * 0.22), { left: 40, top: 30, width: box.w - 80, height: box.h - 80 }, true);
  const ph = phases(dur, [0.8, 3, 1]);
  const pAx = prog(frame, ph[0].start, ph[0].len);
  const tt = lin(frame, ph[1].start, ph[1].len) * T;
  const pos = (t: number) => ({ x: vx * t, y: vy * t - 0.5 * g * t * t });
  const trail: Pt[] = [];
  for (let i = 0; i <= 120; i++) { const t = (tt * i) / 120; const p = pos(t); trail.push({ x: pl.sx(p.x), y: pl.sy(p.y) }); }
  const b = pos(tt);
  const bp = { x: pl.sx(b.x), y: pl.sy(b.y) };
  const sc = (Math.min(box.w, box.h) * 0.2) / v;
  const vyNow = vy - g * tt;
  const flying = tt > 0 && tt < T;
  // ghost dots every T/8 to show equal horizontal spacing
  const ghosts = Array.from({ length: 9 }, (_, i) => (T * i) / 8).filter((t) => t <= tt);
  const apex = pos(T / 2);
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <Axes pl={pl} opacity={pAx} xLabel="x (m)" yLabel="y (m)" grid />
        <path d={pathOf(trail)} stroke={C.light} strokeWidth={3} fill="none" strokeDasharray="2 8" strokeLinecap="round" />
        {ghosts.map((t, i) => { const q = pos(t); return <circle key={i} cx={pl.sx(q.x)} cy={pl.sy(q.y)} r={6} fill={C.light} opacity={0.45} />; })}
        {tt >= T / 2 ? (
          <g opacity={prog(frame, ph[1].start + ph[1].len / 2, 12)}>
            <line x1={pl.sx(apex.x)} x2={pl.sx(apex.x)} y1={pl.sy(apex.y)} y2={pl.sy(0)} stroke={C.muted} strokeWidth={2} strokeDasharray="6 6" />
            <Label x={pl.sx(apex.x) + 14} y={pl.sy(apex.y / 2)} anchor="start" size={24} color={C.muted}>H</Label>
            <Label x={pl.sx(apex.x)} y={pl.sy(apex.y) - 30} size={22} color={C.green}>vᵧ = 0</Label>
          </g>
        ) : null}
        {s.show_components && flying ? (
          <g>
            <Arrow from={bp} to={{ x: bp.x + vx * sc, y: bp.y }} color={C.orange} width={3.5} head={14} />
            <Arrow from={bp} to={{ x: bp.x, y: bp.y - vyNow * sc }} color={C.green} width={3.5} head={14} />
            <Arrow from={bp} to={{ x: bp.x + vx * sc, y: bp.y - vyNow * sc }} color={C.blue} width={4} head={16} />
            <Label x={bp.x + vx * sc + 18} y={bp.y} anchor="start" size={22} color={C.orange}>vₓ</Label>
            <Label x={bp.x - 14} y={bp.y - vyNow * sc} anchor="end" size={22} color={C.green}>vᵧ</Label>
          </g>
        ) : null}
        {tt <= 0 ? <Arrow from={{ x: pl.sx(0), y: pl.sy(0) }} to={{ x: pl.sx(0) + vx * sc, y: pl.sy(0) - vy * sc }} color={C.blue} width={4} head={16} opacity={pAx} /> : null}
        <circle cx={bp.x} cy={bp.y} r={13} fill={C.ink} opacity={pAx} />
        {tt >= T ? <Label x={pl.sx(R)} y={pl.sy(0) - 34} size={24} color={C.light}>R</Label> : null}
      </svg>
      <Readout right p={prog(frame, ph[2].start, 16)} rows={[["u", `${fmt(v, 1)} m/s at ${fmt(s.angle_deg, 0)}°`], ["Range R", `${fmt(R, 1)} m`], ["Max height H", `${fmt(Hm, 1)} m`], ["Time of flight", `${fmt(T, 2)} s`]]} />
    </div>
  );
};

// ============================================================ motion graph
export const MotionGraph: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const u = s.initial_velocity, a = s.acceleration, Tt = s.time_span;
  const x = (t: number) => u * t + 0.5 * a * t * t;
  const v = (t: number) => u + a * t;
  const ph = phases(dur, [0.8, 3.4, 0.8]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const t = lin(frame, ph[1].start, ph[1].len) * Tt;
  const xs = Array.from({ length: 61 }, (_, i) => x((Tt * i) / 60));
  const xmin = Math.min(0, ...xs), xmax = Math.max(1, ...xs);
  const vs = [v(0), v(Tt)];
  const vmin = Math.min(0, ...vs), vmax = Math.max(1, ...vs);
  const trackY = 96;
  const tx = (val: number) => 80 + ((val - xmin) / (xmax - xmin)) * (box.w - 200);
  // three columns: s-t graph | v-t graph | readout
  const gw = (box.w - 60 - 320) / 2, gh = box.h - 260;
  const pS = plane(0, Tt, xmin, xmax * 1.1, { left: 60, top: 220, width: gw - 50, height: gh });
  const pV = plane(0, Tt, vmin, vmax * 1.15, { left: 60 + gw + 40, top: 220, width: gw - 50, height: gh });
  const curve = (pl: typeof pS, f: (t: number) => number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 80; i++) { const tt = (t * i) / 80; pts.push({ x: pl.sx(tt), y: pl.sy(f(tt)) }); }
    return pathOf(pts);
  };
  const car = tx(x(t));
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <g opacity={pIn}>
          <line x1={60} x2={box.w - 60} y1={trackY + 32} y2={trackY + 32} stroke={C.hairStrong} strokeWidth={3} />
          {Array.from({ length: 7 }, (_, i) => xmin + ((xmax - xmin) * i) / 6).map((m, i) => (
            <g key={i}><line x1={tx(m)} x2={tx(m)} y1={trackY + 32} y2={trackY + 44} stroke={C.faint} strokeWidth={2} /><Label x={tx(m)} y={trackY + 64} size={18} color={C.faint} mono>{fmt(m, 0)} m</Label></g>
          ))}
        </g>
        {Array.from({ length: Math.floor(t) + 1 }, (_, i) => i).map((i) => (
          <circle key={i} cx={tx(x(i))} cy={trackY + 32} r={5} fill={C.light} opacity={0.8} />
        ))}
        <g transform={`translate(${car - 44}, ${trackY - 20})`} opacity={pIn}>
          <rect width={88} height={40} rx={10} fill={C.blue} />
          <rect x={52} y={8} width={26} height={14} rx={3} fill={C.bg} opacity={0.5} />
          <circle cx={20} cy={42} r={9} fill={C.ink} /><circle cx={68} cy={42} r={9} fill={C.ink} />
        </g>
        <Arrow from={{ x: car, y: trackY - 40 }} to={{ x: car + Math.max(0, v(t)) * 6 + 2, y: trackY - 40 }} color={C.green} width={3.5} head={14} opacity={pIn} />
        <Label x={car} y={trackY - 62} size={22} color={C.green} mono opacity={pIn}>{`v = ${fmt(v(t), 1)} m/s`}</Label>

        <Axes pl={pS} opacity={pIn} xLabel="t (s)" yLabel="s (m)" grid />
        <path d={curve(pS, x)} stroke={C.light} strokeWidth={4} fill="none" />
        <circle cx={pS.sx(t)} cy={pS.sy(x(t))} r={8} fill={C.light} />
        <Axes pl={pV} opacity={pIn} xLabel="t (s)" yLabel="v (m/s)" grid />
        <path d={`${curve(pV, v)} L${pV.sx(t)},${pV.sy(0)} L${pV.sx(0)},${pV.sy(0)} Z`} fill={C.green} opacity={0.12} />
        <path d={curve(pV, v)} stroke={C.green} strokeWidth={4} fill="none" />
        <circle cx={pV.sx(t)} cy={pV.sy(v(t))} r={8} fill={C.green} />
        <Label x={pV.sx(Tt * 0.6)} y={pV.sy(v(Tt * 0.3) / 2)} size={22} color={C.green} opacity={prog(frame, ph[2].start, 14)}>area = displacement</Label>
      </svg>
      <Readout right y={220} p={prog(frame, ph[2].start, 16)} rows={[["u", `${fmt(u, 1)} m/s`], ["a", `${fmt(a, 2)} m/s²`], ["v = u + at", `${fmt(v(Tt), 1)} m/s`], ["s = ut + ½at²", `${fmt(x(Tt), 1)} m`]]} />
    </div>
  );
};

// ============================================================== free body
export const FreeBody: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const g = 9.8;
  const al = (s.incline_deg * Math.PI) / 180;
  const m = s.mass, mu = s.friction_coefficient, Fa = s.applied_force;
  const W = m * g, N = W * Math.cos(al), down = W * Math.sin(al) - Fa;
  const fmax = mu * N;
  const moving = Math.abs(down) > fmax;
  const fr = moving ? Math.sign(down) * fmax : down; // friction opposes tendency (acts up-slope when down>0)
  const net = down - fr;
  const acc = net / m;
  const ph = phases(dur, [1, 0.8, 0.8, 0.8, 0.8, 1.2]);
  const pp = (i: number) => prog(frame, ph[i].start, ph[i].len);
  // geometry
  const baseY = box.h - 50, leftX = 60;
  const run = Math.min(box.w * 0.75, al > 0 ? (box.h - 140) / Math.tan(al) : box.w * 0.75);
  const rise = run * Math.tan(al);
  const P0 = { x: leftX, y: baseY }, P1 = { x: leftX + run, y: baseY }, P2 = { x: leftX + run, y: baseY - rise };
  const along = { x: -Math.cos(al), y: Math.sin(al) }; // pointing down-slope (toward P0 from P2)
  const nrm = { x: -Math.sin(al), y: -Math.cos(al) }; // outward normal (up-left)
  const bs = 120;
  const foot = { x: P0.x + (P2.x - P0.x) * 0.55, y: P0.y + (P2.y - P0.y) * 0.55 };
  const cen = { x: foot.x + nrm.x * bs / 2, y: foot.y + nrm.y * bs / 2 };
  const scale = 230 / Math.max(W, N, Math.abs(Fa), 1);
  const tipOf = (d: Pt, mag: number) => ({ x: cen.x + d.x * mag * scale, y: cen.y + d.y * mag * scale });
  const ang = -(al * 180) / Math.PI;
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <g opacity={pp(0)}>
          <path d={pathOf([P0, P1, P2], true)} fill={C.bgRaise} stroke={C.hairStrong} strokeWidth={2.5} />
          {al > 0 ? <path d={`M${P0.x + 90},${P0.y} A90,90 0 0 0 ${P0.x + 90 * Math.cos(al)},${P0.y - 90 * Math.sin(al)}`} stroke={C.muted} strokeWidth={2} fill="none" /> : null}
          {al > 0 ? <Label x={P0.x + 120} y={P0.y - 24} size={24} color={C.muted}>{`${fmt(s.incline_deg, 0)}°`}</Label> : null}
          <g transform={`translate(${cen.x},${cen.y}) rotate(${ang})`}>
            <rect x={-bs / 2} y={-bs / 2} width={bs} height={bs} rx={8} fill="#2B3445" stroke={C.hairStrong} strokeWidth={2} />
            <text textAnchor="middle" dominantBaseline="central" fill={C.ink} fontSize={26} fontFamily={F.mono}>{fmt(m, 1)} kg</text>
          </g>
        </g>
        <Arrow from={cen} to={tipOf({ x: 0, y: 1 }, W)} p={pp(1)} color={C.red} width={5} head={20} />
        <Label x={tipOf({ x: 0, y: 1 }, W).x + 16} y={tipOf({ x: 0, y: 1 }, W).y} anchor="start" size={26} color={C.red} opacity={pp(1)}>mg</Label>
        <Arrow from={cen} to={tipOf(nrm, N)} p={pp(2)} color={C.blue} width={5} head={20} />
        <Label x={tipOf(nrm, N).x - 14} y={tipOf(nrm, N).y - 14} anchor="end" size={26} color={C.blue} opacity={pp(2)}>N</Label>
        {al > 0 ? (
          <g opacity={pp(3) * 0.85}>
            <Arrow from={cen} to={tipOf(along, W * Math.sin(al))} color={C.red} width={2.5} head={14} dashed />
            <Arrow from={cen} to={tipOf({ x: -nrm.x, y: -nrm.y }, W * Math.cos(al))} color={C.red} width={2.5} head={14} dashed />
            <Label x={tipOf(along, W * Math.sin(al)).x - 10} y={tipOf(along, W * Math.sin(al)).y + 30} size={22} color={C.red}>mg sin θ</Label>
          </g>
        ) : null}
        {Math.abs(fr) > 0.01 ? (
          <g>
            <Arrow from={{ x: foot.x + nrm.x * 6, y: foot.y + nrm.y * 6 }} to={{ x: foot.x + nrm.x * 6 - along.x * Math.sign(fr) * Math.abs(fr) * scale, y: foot.y + nrm.y * 6 - along.y * Math.sign(fr) * Math.abs(fr) * scale }} p={pp(4)} color={C.orange} width={5} head={18} />
            <Label x={foot.x - along.x * Math.sign(fr) * Math.abs(fr) * scale + 10} y={foot.y - along.y * Math.sign(fr) * Math.abs(fr) * scale + 34} size={26} color={C.orange} opacity={pp(4)}>f</Label>
          </g>
        ) : null}
        {Fa > 0 ? (
          <g>
            <Arrow from={cen} to={tipOf({ x: -along.x, y: -along.y }, Fa)} p={pp(4)} color={C.green} width={5} head={20} />
            <Label x={tipOf({ x: -along.x, y: -along.y }, Fa).x + 12} y={tipOf({ x: -along.x, y: -along.y }, Fa).y - 16} anchor="start" size={26} color={C.green} opacity={pp(4)}>F</Label>
          </g>
        ) : null}
      </svg>
      <Readout right p={pp(5)} rows={[["mg", `${fmt(W, 1)} N`], ["N = mg cos θ", `${fmt(N, 1)} N`], ["mg sin θ", `${fmt(W * Math.sin(al), 1)} N`], ["f", `${fmt(Math.abs(fr), 1)} N${moving ? " (kinetic)" : " (static)"}`], ["a", `${fmt(Math.abs(acc), 2)} m/s²`]]}
        foot={moving ? (net > 0 ? "Block slides down the slope" : "Block accelerates up the slope") : "Forces balance: block stays at rest"} />
    </div>
  );
};

// ========================================================= circular motion
export const CircularMotion: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const { radius: r, speed: v } = s;
  const ph = phases(dur, [0.7, 3.5]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const R = Math.min(box.h * 0.4, 260);
  const cx = box.w * 0.34, cy = box.h / 2;
  const th = Math.max(0, frame - ph[0].start) * 0.035;
  const p = { x: cx + Math.cos(th) * R, y: cy - Math.sin(th) * R };
  const tan = { x: -Math.sin(th), y: -Math.cos(th) };
  const trail = Array.from({ length: 40 }, (_, i) => th - i * 0.04).filter((a) => a > 0).map((a) => ({ x: cx + Math.cos(a) * R, y: cy - Math.sin(a) * R }));
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <circle cx={cx} cy={cy} r={R} stroke={C.hair} strokeWidth={2.5} fill="none" opacity={pIn} strokeDasharray="6 8" />
        <circle cx={cx} cy={cy} r={6} fill={C.muted} opacity={pIn} />
        <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={C.muted} strokeWidth={2} opacity={pIn * 0.7} />
        <Label x={(cx + p.x) / 2 + 14} y={(cy + p.y) / 2 - 14} size={24} color={C.muted} italic opacity={pIn}>r</Label>
        <path d={pathOf(trail)} stroke={C.light} strokeWidth={5} fill="none" opacity={0.4} strokeLinecap="round" />
        <Arrow from={p} to={{ x: p.x + tan.x * 170, y: p.y + tan.y * 170 }} color={C.blue} width={5} head={20} opacity={pIn} />
        <Arrow from={p} to={{ x: p.x + (cx - p.x) * 0.55, y: p.y + (cy - p.y) * 0.55 }} color={C.red} width={5} head={20} opacity={pIn} />
        <Label x={p.x + tan.x * 195} y={p.y + tan.y * 195} size={28} color={C.blue} weight={600}>v</Label>
        <Label x={p.x + (cx - p.x) * 0.62 + 18} y={p.y + (cy - p.y) * 0.62 - 18} size={26} color={C.red} weight={600}>a꜀</Label>
        <circle cx={p.x} cy={p.y} r={16} fill={C.ink} />
      </svg>
      <Readout right p={prog(frame, ph[1].start + 30, 16)} rows={[["r", `${fmt(r, 2)} m`], ["v", `${fmt(v, 2)} m/s`], ["a = v²/r", `${fmt((v * v) / r, 2)} m/s²`], ["ω = v/r", `${fmt(v / r, 2)} rad/s`], ["T = 2πr/v", `${fmt((2 * Math.PI * r) / v, 2)} s`]]} foot="Speed is constant; direction keeps changing" />
    </div>
  );
};

// =================================================================== orbit
const PLANETS: Record<string, { gm: number; r: number; color: string }> = {
  earth: { gm: 3.986e14, r: 6.371e6, color: "#3C7DD9" },
  moon: { gm: 4.905e12, r: 1.737e6, color: "#9AA0A8" },
  mars: { gm: 4.283e13, r: 3.39e6, color: "#C8643F" },
  jupiter: { gm: 1.267e17, r: 6.99e7, color: "#C9A27A" },
  sun: { gm: 1.327e20, r: 6.96e8, color: "#F2B33D" },
};
export const Orbit: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const pk = PLANETS[String(s.planet).toLowerCase()] || PLANETS.earth;
  const rr = pk.r + s.altitude_km * 1000;
  const v = Math.sqrt(pk.gm / rr);
  const T = (2 * Math.PI * rr) / v;
  const gHere = pk.gm / (rr * rr);
  const ph = phases(dur, [0.8, 3.4]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const cx = box.w * 0.4, cy = box.h / 2;
  const Rp = Math.min(box.h * 0.2, 140);
  const Ro = Math.min(box.h * 0.44, Math.max(Rp + 70, Rp * (rr / pk.r) ** 0.5));
  const th = Math.max(0, frame - ph[0].start) * 0.022;
  const p = { x: cx + Math.cos(th) * Ro, y: cy - Math.sin(th) * Ro };
  const tan = { x: -Math.sin(th), y: -Math.cos(th) };
  const tMin = T / 60;
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="pl-g" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor={pk.color} stopOpacity={1} />
            <stop offset="100%" stopColor={pk.color} stopOpacity={0.35} />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={Ro} stroke={C.hairStrong} strokeWidth={2} fill="none" strokeDasharray="5 9" opacity={pIn} />
        <circle cx={cx} cy={cy} r={Rp * (0.85 + 0.15 * pIn)} fill="url(#pl-g)" opacity={pIn} />
        <Label x={cx} y={cy} size={28} color={C.ink} weight={600} halo="transparent">{s.planet}</Label>
        <Arrow from={p} to={{ x: p.x + (cx - p.x) * 0.35, y: p.y + (cy - p.y) * 0.35 }} color={C.red} width={4.5} head={18} opacity={pIn} />
        <Arrow from={p} to={{ x: p.x + tan.x * 150, y: p.y + tan.y * 150 }} color={C.blue} width={4.5} head={18} opacity={pIn} />
        <Label x={p.x + (cx - p.x) * 0.42 + 20} y={p.y + (cy - p.y) * 0.42} anchor="start" size={24} color={C.red} weight={600}>F</Label>
        <Label x={p.x + tan.x * 175} y={p.y + tan.y * 175} size={24} color={C.blue} weight={600}>v</Label>
        <g transform={`translate(${p.x},${p.y}) rotate(${(-th * 180) / Math.PI})`}>
          <rect x={-10} y={-10} width={20} height={20} rx={3} fill={C.ink} />
          <rect x={-34} y={-5} width={20} height={10} fill={C.blue} opacity={0.8} />
          <rect x={14} y={-5} width={20} height={10} fill={C.blue} opacity={0.8} />
        </g>
      </svg>
      <Readout right p={prog(frame, ph[1].start + 30, 16)} rows={[["altitude h", `${fmt(s.altitude_km, 0)} km`], ["v = √(GM/r)", `${fmt(v / 1000, 2)} km/s`], ["T = 2πr/v", tMin > 120 ? `${fmt(tMin / 60, 1)} h` : `${fmt(tMin, 0)} min`], ["g at orbit", `${fmt(gHere, 2)} m/s²`]]} foot="Gravity provides the centripetal force" />
    </div>
  );
};

// ================================================================ pendulum
export const Pendulum: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const g = 9.8;
  const Lm = s.length;
  const T = 2 * Math.PI * Math.sqrt(Lm / g);
  const Tshow = clamp(T, 1.2, 3.2);
  const th0 = (s.amplitude_deg * Math.PI) / 180;
  const ph = phases(dur, [0.6, 3.6]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const t = Math.max(0, frame - ph[0].start) / FPS;
  const th = th0 * Math.cos((2 * Math.PI * t) / Tshow);
  const pivot = { x: s.show_energy ? box.w * 0.36 : box.w * 0.45, y: 40 };
  const Lpx = box.h - 150;
  const bob = { x: pivot.x + Math.sin(th) * Lpx, y: pivot.y + Math.cos(th) * Lpx };
  const hNow = 1 - Math.cos(th), hMax = 1 - Math.cos(th0);
  const PE = hMax > 0 ? hNow / hMax : 0, KE = 1 - PE;
  const ext = (a: number) => ({ x: pivot.x + Math.sin(a) * Lpx, y: pivot.y + Math.cos(a) * Lpx });
  const bars = [{ k: "KE", v: KE, c: C.orange }, { k: "PE", v: PE, c: C.blue }, { k: "Total", v: 1, c: C.green }];
  const bx = box.w * 0.7, bh = box.h - 220;
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <line x1={pivot.x - 120} x2={pivot.x + 120} y1={pivot.y} y2={pivot.y} stroke={C.muted} strokeWidth={4} opacity={pIn} />
        <line x1={pivot.x} x2={pivot.x} y1={pivot.y} y2={pivot.y + Lpx + 30} stroke={C.hair} strokeWidth={2} strokeDasharray="6 8" />
        <path d={`M${ext(-th0).x},${ext(-th0).y} A${Lpx},${Lpx} 0 0 0 ${ext(th0).x},${ext(th0).y}`} stroke={C.hair} strokeWidth={2} fill="none" strokeDasharray="4 8" />
        {[-th0, th0].map((a, i) => <circle key={i} cx={ext(a).x} cy={ext(a).y} r={26} fill="none" stroke={C.hair} strokeWidth={2} strokeDasharray="4 5" />)}
        <line x1={pivot.x} y1={pivot.y} x2={bob.x} y2={bob.y} stroke={C.ink} strokeWidth={3} />
        <circle cx={bob.x} cy={bob.y} r={26} fill={C.light} />
        <Label x={pivot.x + 20} y={pivot.y + Lpx / 2} anchor="start" size={24} color={C.muted} italic>L</Label>
        {s.show_energy ? (
          <g opacity={pIn}>
            {bars.map((b, i) => (
              <g key={b.k}>
                <rect x={bx + i * 110} y={40} width={70} height={bh} rx={8} fill={C.bgRaise} stroke={C.hair} />
                <rect x={bx + i * 110} y={40 + bh * (1 - b.v)} width={70} height={bh * b.v} rx={8} fill={b.c} opacity={0.9} />
                <Label x={bx + i * 110 + 35} y={bh + 76} size={24} color={C.ink}>{b.k}</Label>
              </g>
            ))}
          </g>
        ) : null}
      </svg>
      <Readout p={prog(frame, ph[1].start + 40, 16)} y={0} rows={[["L", `${fmt(Lm, 2)} m`], ["T = 2π√(L/g)", `${fmt(T, 2)} s`]]} />
    </div>
  );
};

// ============================================================= spring-mass
export const SpringMass: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const { mass: m, spring_constant: k, amplitude: A } = s;
  const T = 2 * Math.PI * Math.sqrt(m / k);
  const Tshow = clamp(T, 1.2, 3.2);
  const ph = phases(dur, [0.6, 3.6]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const t = Math.max(0, frame - ph[0].start) / FPS;
  const x = Math.cos((2 * Math.PI * t) / Tshow);
  const wallX = 60, floorY = 200, eqX = box.w * 0.42, Apx = 150;
  const bxp = eqX + x * Apx;
  const coils = 14;
  const sp: Pt[] = [{ x: wallX, y: floorY - 45 }];
  const sEnd = bxp - 60;
  for (let i = 1; i < coils * 2; i++) sp.push({ x: wallX + 30 + ((sEnd - wallX - 60) * i) / (coils * 2), y: floorY - 45 + (i % 2 ? -22 : 22) });
  sp.push({ x: sEnd, y: floorY - 45 });
  const gl = 60, gr = box.w - 40, gy = floorY + 240, gA = 120;
  const span = 2.2 * Tshow;
  const trace: Pt[] = [];
  for (let i = 0; i <= 200; i++) {
    const tt = (t * i) / 200;
    if (t - tt > span) continue;
    trace.push({ x: gl + ((tt - Math.max(0, t - span)) / span) * (gr - gl), y: gy - gA * Math.cos((2 * Math.PI * tt) / Tshow) });
  }
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <g opacity={pIn}>
          <rect x={wallX - 20} y={floorY - 140} width={20} height={140} fill={C.muted} />
          <line x1={wallX - 20} x2={box.w - 40} y1={floorY} y2={floorY} stroke={C.hairStrong} strokeWidth={3} />
          <line x1={eqX} x2={eqX} y1={floorY - 130} y2={floorY + 20} stroke={C.hair} strokeWidth={2} strokeDasharray="5 6" />
          <Label x={eqX} y={floorY + 38} size={20} color={C.faint}>x = 0</Label>
          <Label x={eqX - Apx} y={floorY + 38} size={20} color={C.faint}>−A</Label>
          <Label x={eqX + Apx} y={floorY + 38} size={20} color={C.faint}>+A</Label>
        </g>
        <path d={pathOf(sp)} stroke={C.muted} strokeWidth={3.5} fill="none" strokeLinejoin="round" />
        <rect x={bxp - 60} y={floorY - 100} width={120} height={100} rx={8} fill={C.blue} />
        <Label x={bxp} y={floorY - 50} size={24} color={C.bg} halo="transparent" mono weight={600}>{`${fmt(m, 1)} kg`}</Label>
        <Arrow from={{ x: bxp, y: floorY - 120 }} to={{ x: bxp - x * 110 - 0.0001, y: floorY - 120 }} color={C.red} width={3.5} head={14} opacity={Math.abs(x) > 0.08 ? 1 : 0} />
        <Label x={bxp - x * 60} y={floorY - 146} size={22} color={C.red} opacity={Math.abs(x) > 0.08 ? 1 : 0}>F = −kx</Label>
        <g opacity={pIn}>
          <line x1={gl} x2={gr} y1={gy} y2={gy} stroke={C.hairStrong} strokeWidth={2} />
          <Label x={gl} y={gy - gA - 30} anchor="start" size={22} color={C.muted}>displacement x(t)</Label>
          <Label x={gr} y={gy + 30} anchor="end" size={22} color={C.muted} italic>t</Label>
        </g>
        <path d={pathOf(trace)} stroke={C.light} strokeWidth={4} fill="none" />
        {trace.length ? <circle cx={trace[trace.length - 1].x} cy={trace[trace.length - 1].y} r={8} fill={C.light} /> : null}
      </svg>
      <Readout right p={prog(frame, ph[1].start + 40, 16)} rows={[["m", `${fmt(m, 2)} kg`], ["k", `${fmt(k, 1)} N/m`], ["A", `${fmt(A, 2)} m`], ["T = 2π√(m/k)", `${fmt(T, 2)} s`]]} />
    </div>
  );
};
