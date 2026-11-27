import React from "react";
import { useCurrentFrame } from "remotion";
import { C, F, SERIES } from "../theme";
import { clamp, easeInOut, enter, fmt, lin, phases, prog, stagger } from "../lib/anim";
import { compile } from "../lib/expr";
import { SceneProps } from "../types";
import { Arrow, Dot, Label, Pt, SvgTex, Tex, pathOf } from "../ui/svg";
import { Axes, Plane, niceStep, plane, samplePath } from "../ui/axes";
import { Readout } from "./mechanics";

const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 14 };

// ========================================================== function graph
export const FunctionGraph: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const fns = (s.functions as { expr: string; label: string }[]).map((f) => ({ ...f, f: compile(f.expr) }));
  const x0 = s.x_min, x1 = s.x_max;
  let y0 = s.y_min, y1 = s.y_max;
  if (y0 == null || y1 == null) {
    const ys: number[] = [];
    for (const fn of fns) for (let i = 0; i <= 200; i++) { const v = fn.f(x0 + ((x1 - x0) * i) / 200); if (v !== null) ys.push(v); }
    ys.sort((a, b) => a - b);
    const lo = ys[Math.floor(ys.length * 0.03)] ?? -1, hi = ys[Math.ceil(ys.length * 0.97) - 1] ?? 1;
    const pad = Math.max(0.5, (hi - lo) * 0.15);
    y0 = Math.min(lo - pad, 0 - pad * 0.3);
    y1 = Math.max(hi + pad, 0 + pad * 0.3);
  }
  const pl = plane(x0, x1, y0, y1, { left: 60, top: 78, width: box.w - 120, height: box.h - 118 });
  const hasExtras = s.tangent_at != null || s.area || s.show_intersections || (s.points || []).length;
  const ph = phases(dur, hasExtras ? [0.7, 1.8, 2] : [0.7, 2.6]);
  const pAx = prog(frame, ph[0].start, ph[0].len);
  const fnAt = stagger(fns.length, ph[1].start, ph[1].start + ph[1].len * 0.5);
  const f0 = fns[0].f;
  const pX = hasExtras ? prog(frame, ph[2].start, ph[2].len * 0.4) : 0;
  // tangent point slides in from the left, then settles
  let tanX: number | null = null;
  if (s.tangent_at != null) {
    const slide = prog(frame, ph[2].start, ph[2].len * 0.6, easeInOut);
    const startX = x0 + (x1 - x0) * 0.15;
    tanX = startX + (s.tangent_at - startX) * slide;
  }
  const deriv = (x: number) => { const h = (x1 - x0) * 1e-4; const a = f0(x - h), b = f0(x + h); return a !== null && b !== null ? (b - a) / (2 * h) : null; };
  let area: number | null = null;
  let areaPath = "";
  if (s.area) {
    const a = s.area.from, b = s.area.to;
    const pa = prog(frame, ph[2].start, ph[2].len * 0.6);
    const bb = a + (b - a) * pa;
    const pts: Pt[] = [{ x: pl.sx(a), y: pl.sy(0) }];
    for (let i = 0; i <= 120; i++) { const x = a + ((bb - a) * i) / 120; const v = f0(x); pts.push({ x: pl.sx(x), y: pl.sy(clamp(v ?? 0, y0, y1)) }); }
    pts.push({ x: pl.sx(bb), y: pl.sy(0) });
    areaPath = pathOf(pts, true);
    // Simpson's rule over the full interval
    const n = 200, h = (b - a) / n;
    let sum = 0;
    for (let i = 0; i <= n; i++) { const v = f0(a + i * h) ?? 0; sum += v * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2); }
    area = (sum * h) / 3;
  }
  const inters: Pt[] = [];
  if (s.show_intersections && fns.length > 1) {
    const g = (x: number) => { const a = fns[0].f(x), b = fns[1].f(x); return a !== null && b !== null ? a - b : null; };
    for (let i = 0; i < 400; i++) {
      let a = x0 + ((x1 - x0) * i) / 400, b = x0 + ((x1 - x0) * (i + 1)) / 400;
      const ga = g(a), gb = g(b);
      if (ga === null || gb === null || ga * gb > 0) continue;
      for (let k = 0; k < 40; k++) { const m = (a + b) / 2; const gm = g(m); if (gm === null) break; if ((ga as number) * gm <= 0) b = m; else a = m; }
      const x = (a + b) / 2, y = fns[0].f(x);
      if (y !== null && !inters.some((p) => Math.abs(p.x - x) < 1e-3)) inters.push({ x, y });
    }
  }
  const rows: [string, string][] = [];
  if (tanX !== null) { const d = deriv(tanX); rows.push([`slope at x = ${fmt(tanX, 2)}`, d !== null ? fmt(d, 3) : "—"]); }
  if (area !== null) rows.push([`area, x = ${fmt(s.area.from, 2)} to ${fmt(s.area.to, 2)}`, fmt(area, 3)]);
  inters.slice(0, 3).forEach((p, i) => rows.push([`intersection ${i + 1}`, `(${fmt(p.x, 2)}, ${fmt(p.y, 2)})`]));
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <defs><clipPath id="fg-clip"><rect x={pl.left} y={pl.top} width={pl.width} height={pl.height} /></clipPath></defs>
        <Axes pl={pl} opacity={pAx} />
        <g clipPath="url(#fg-clip)">
          {areaPath ? <path d={areaPath} fill={SERIES[0]} opacity={0.22} /> : null}
          {fns.map((fn, i) => {
            const p = prog(frame, fnAt[i], ph[1].len * 0.6, (t) => t);
            return <path key={i} d={samplePath(fn.f, pl, p)} stroke={SERIES[i % SERIES.length]} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
          })}
          {tanX !== null && f0(tanX) !== null && deriv(tanX) !== null ? (() => {
            const y = f0(tanX) as number, m = deriv(tanX) as number;
            const span = (x1 - x0) * 0.28;
            return (
              <g opacity={pX}>
                <line x1={pl.sx(tanX - span)} y1={pl.sy(y - m * span)} x2={pl.sx(tanX + span)} y2={pl.sy(y + m * span)} stroke={C.light} strokeWidth={3.5} />
                <Dot x={pl.sx(tanX)} y={pl.sy(y)} r={8} color={C.light} ring />
              </g>
            );
          })() : null}
        </g>
        {(s.points as { x: number; label: string }[]).map((p, i) => {
          const y = f0(p.x);
          if (y === null || y < y0 || y > y1) return null;
          const o = prog(frame, (ph[2]?.start ?? ph[1].start + ph[1].len * 0.6) + i * 10, 14);
          return (
            <g key={i} opacity={o}>
              <line x1={pl.sx(p.x)} x2={pl.sx(p.x)} y1={pl.sy(y)} y2={pl.sy(Math.max(y0, Math.min(y1, 0)))} stroke={C.muted} strokeWidth={1.8} strokeDasharray="5 6" />
              <line x1={pl.sx(p.x)} x2={pl.sx(Math.max(x0, Math.min(x1, 0)))} y1={pl.sy(y)} y2={pl.sy(y)} stroke={C.muted} strokeWidth={1.8} strokeDasharray="5 6" />
              <Dot x={pl.sx(p.x)} y={pl.sy(y)} r={8} color={C.ink} />
              {p.label ? <Label x={pl.sx(p.x) + 16} y={pl.sy(y) - 22} anchor="start" size={24} color={C.ink}>{p.label}</Label> : null}
            </g>
          );
        })}
        {inters.map((p, i) => <g key={i} opacity={pX}><Dot x={pl.sx(p.x)} y={pl.sy(p.y)} r={9} color={C.light} ring /></g>)}
      </svg>
      {/* legend (top-left) and live readouts (top-right) sit in a strip above the plot */}
      <div style={{ position: "absolute", left: 60, top: 0, height: 64, display: "flex", alignItems: "center", gap: 34 }}>
        {fns.map((fn, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: prog(frame, fnAt[i] + ph[1].len * 0.3, 14) }}>
            <div style={{ width: 28, height: 5, borderRadius: 3, background: SERIES[i % SERIES.length] }} />
            <Tex tex={fn.label} size={30} color={SERIES[i % SERIES.length]} />
          </div>
        ))}
      </div>
      {rows.length ? (
        <div style={{ position: "absolute", right: 60, top: 6, display: "flex", gap: 14, opacity: prog(frame, ph[2].start + ph[2].len * 0.5, 16) }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ ...card, padding: "8px 16px", display: "flex", gap: 14, alignItems: "baseline" }}>
              <span style={{ color: C.muted, fontFamily: F.sans, fontSize: 21 }}>{k}</span>
              <span style={{ color: C.ink, fontFamily: F.mono, fontSize: 24 }}>{v}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// ============================================================= number line
export const NumberLine: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const lo = s.min, hi = s.max;
  const step = hi - lo > 20 ? niceStep(hi - lo, 10) : 1;
  const x0 = 70, x1 = box.w - 70, y = box.h * 0.55;
  const sx = (v: number) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const ph = phases(dur, [1, 1.4, 1.6]);
  const pL = prog(frame, ph[0].start, ph[0].len);
  const pI = prog(frame, ph[2].start, ph[2].len);
  const pts = s.points as { value: number; label: string; open: boolean }[];
  const at = stagger(pts.length, ph[1].start, ph[1].start + ph[1].len);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Number(v.toFixed(8)));
  return (
    <svg width={box.w} height={box.h}>
      <Arrow from={{ x: (x0 + x1) / 2, y }} to={{ x: x1 + 30, y }} p={pL} color={C.muted} width={3} head={16} />
      <Arrow from={{ x: (x0 + x1) / 2, y }} to={{ x: x0 - 30, y }} p={pL} color={C.muted} width={3} head={16} />
      {ticks.map((v) => (
        <g key={v} opacity={pL}>
          <line x1={sx(v)} x2={sx(v)} y1={y - 12} y2={y + 12} stroke={C.muted} strokeWidth={2.5} />
          <Label x={sx(v)} y={y + 44} size={24} color={v === 0 ? C.ink : C.muted} mono>{fmt(v, 2)}</Label>
        </g>
      ))}
      {(s.intervals as { from: number; to: number }[]).map((iv, i) => {
        const a = Math.max(lo, Math.min(iv.from, iv.to)), b = Math.min(hi, Math.max(iv.from, iv.to));
        return <rect key={i} x={sx(a)} y={y - 9} width={(sx(b) - sx(a)) * pI} height={18} rx={9} fill={C.blue} opacity={0.75} />;
      })}
      {pts.map((p, i) => (
        <g key={i} opacity={prog(frame, at[i], 14)}>
          <circle cx={sx(p.value)} cy={y} r={14} fill={p.open ? C.bg : C.light} stroke={C.light} strokeWidth={4} />
          {p.label ? <Label x={sx(p.value)} y={y - 46} size={30} color={C.light} weight={600}>{p.label}</Label> : null}
        </g>
      ))}
      <g opacity={pI}>
        <circle cx={x0} cy={box.h - 40} r={10} fill={C.light} /><Label x={x0 + 20} y={box.h - 40} anchor="start" size={22} color={C.muted}>included</Label>
        <circle cx={x0 + 190} cy={box.h - 40} r={10} fill={C.bg} stroke={C.light} strokeWidth={3} /><Label x={x0 + 210} y={box.h - 40} anchor="start" size={22} color={C.muted}>excluded</Label>
      </g>
    </svg>
  );
};

// ============================================================= unit circle
export const UnitCircle: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const ph = phases(dur, [0.7, 2.6, 0.9]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const final = (s.angle_deg * Math.PI) / 180;
  // with the wave: one full turn traces sin θ, then the radius continues on to the final angle
  const th = s.trace_wave
    ? lin(frame, ph[1].start, ph[1].len) * 2 * Math.PI + prog(frame, ph[2].start, ph[2].len * 0.7, easeInOut) * final
    : prog(frame, ph[1].start, ph[1].len, easeInOut) * final;
  const settle = prog(frame, ph[2].start + ph[2].len * 0.6, 16);
  const shown = th;
  const R = Math.min(box.h * 0.38, 240);
  const cx = R + 70, cy = box.h / 2;
  const P = { x: cx + Math.cos(shown) * R, y: cy - Math.sin(shown) * R };
  const gx0 = cx + R + 110, gx1 = box.w - 40;
  const gsx = (a: number) => gx0 + (a / (2 * Math.PI)) * (gx1 - gx0);
  const wave: Pt[] = [];
  const traced = s.trace_wave ? Math.min(th, 2 * Math.PI) : 0;
  for (let a = 0; a <= traced; a += 0.03) wave.push({ x: gsx(a), y: cy - Math.sin(a) * R });
  const arcR = 60;
  const arc = `M${cx + arcR},${cy} A${arcR},${arcR} 0 ${shown % (2 * Math.PI) > Math.PI ? 1 : 0} 0 ${cx + Math.cos(shown) * arcR},${cy - Math.sin(shown) * arcR}`;
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <g opacity={pIn}>
          <line x1={cx - R - 30} x2={cx + R + 30} y1={cy} y2={cy} stroke={C.hairStrong} strokeWidth={2} />
          <line x1={cx} x2={cx} y1={cy - R - 30} y2={cy + R + 30} stroke={C.hairStrong} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={R} stroke={C.muted} strokeWidth={2.5} fill="none" />
          <Label x={cx + R + 12} y={cy + 22} anchor="start" size={20} color={C.faint} mono>1</Label>
          {s.trace_wave ? (
            <g>
              <line x1={gx0} x2={gx1} y1={cy} y2={cy} stroke={C.hairStrong} strokeWidth={2} />
              {[0.5, 1, 1.5, 2].map((k) => <Label key={k} x={gsx(k * Math.PI)} y={cy + 30} size={20} color={C.faint}>{["π/2", "π", "3π/2", "2π"][k * 2 - 1]}</Label>)}
            </g>
          ) : null}
        </g>
        {shown > 0.02 ? <path d={arc} stroke={C.light} strokeWidth={3} fill="none" /> : null}
        <Label x={cx + Math.cos(shown / 2) * (arcR + 26)} y={cy - Math.sin(shown / 2) * (arcR + 26)} size={26} color={C.light} italic opacity={shown > 0.2 ? 1 : 0}>θ</Label>
        <line x1={cx} y1={cy} x2={P.x} y2={P.y} stroke={C.ink} strokeWidth={3.5} />
        <line x1={cx} y1={cy} x2={P.x} y2={cy} stroke={C.blue} strokeWidth={6} strokeLinecap="round" />
        <line x1={P.x} y1={cy} x2={P.x} y2={P.y} stroke={C.orange} strokeWidth={6} strokeLinecap="round" />
        <Label x={(cx + P.x) / 2} y={cy + (Math.sin(shown) >= 0 ? 30 : -30)} size={24} color={C.blue}>cos θ</Label>
        <Label x={P.x + (Math.cos(shown) >= 0 ? 16 : -16)} y={(cy + P.y) / 2} anchor={Math.cos(shown) >= 0 ? "start" : "end"} size={24} color={C.orange}>sin θ</Label>
        {s.trace_wave ? <path d={pathOf(wave)} stroke={C.orange} strokeWidth={4} fill="none" /> : null}
        {s.trace_wave && frame < ph[1].start + ph[1].len ? (
          <line x1={P.x} y1={P.y} x2={gsx(traced)} y2={cy - Math.sin(traced) * R} stroke={C.orange} strokeWidth={1.5} strokeDasharray="5 6" opacity={0.7} />
        ) : null}
        <Dot x={P.x} y={P.y} r={10} color={C.ink} ring />
      </svg>
      <Readout right p={settle} rows={[["θ", `${fmt(((shown * 180) / Math.PI) % 360, 1)}°`], ["sin θ", fmt(Math.sin(shown), 3)], ["cos θ", fmt(Math.cos(shown), 3)], ["tan θ", Math.abs(Math.cos(shown)) < 1e-6 ? "undefined" : fmt(Math.tan(shown), 3)]]} />
    </div>
  );
};

// ========================================================== right triangle
export const RightTriangle: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const a = s.a, b = s.b, c = Math.hypot(a, b);
  const pyth = s.mode === "pythagoras";
  // world coords (y up): right angle at A, legs a (vertical) and b (horizontal)
  const wA = { x: 0, y: 0 }, wB = { x: b, y: 0 }, wC = { x: 0, y: a };
  const G = { x: b / 3, y: a / 3 };
  const wsq = (p: Pt, q: Pt): Pt[] => {
    const d = { x: q.x - p.x, y: q.y - p.y };
    let n = { x: -d.y, y: d.x };
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    if ((mid.x + n.x * 0.01 - G.x) ** 2 + (mid.y + n.y * 0.01 - G.y) ** 2 < (mid.x - G.x) ** 2 + (mid.y - G.y) ** 2) n = { x: -n.x, y: -n.y };
    return [p, q, { x: q.x + n.x, y: q.y + n.y }, { x: p.x + n.x, y: p.y + n.y }];
  };
  const wSq = pyth ? [wsq(wA, wC), wsq(wB, wA), wsq(wC, wB)] : [];
  const all = [wA, wB, wC, ...wSq.flat()];
  const bx0 = Math.min(...all.map((p) => p.x)), bx1 = Math.max(...all.map((p) => p.x));
  const by0 = Math.min(...all.map((p) => p.y)), by1 = Math.max(...all.map((p) => p.y));
  const availW = pyth ? box.w - 470 : box.w - 520, availH = box.h - 40;
  const sc = Math.min(availW / (bx1 - bx0 || 1), availH / (by1 - by0 || 1)) * (pyth ? 0.96 : 0.8);
  const offX = 20 + (availW - (bx1 - bx0) * sc) / 2, offY = 20 + (availH - (by1 - by0) * sc) / 2;
  const toS = (p: Pt): Pt => ({ x: offX + (p.x - bx0) * sc, y: offY + (by1 - p.y) * sc });
  const A = toS(wA), B = toS(wB), Cc = toS(wC);
  const ph = phases(dur, pyth ? [1, 1, 1, 1, 1.2] : [1, 1, 1.4, 1.2]);
  const pp = (i: number) => prog(frame, ph[i].start, ph[i].len);
  const center = (pts: Pt[]) => ({ x: pts.reduce((s2, p) => s2 + p.x, 0) / pts.length, y: pts.reduce((s2, p) => s2 + p.y, 0) / pts.length });
  const [sqA, sqB, sqC] = pyth ? wSq.map((q) => q.map(toS)) : [[], [], []];
  const nice = (v: number) => fmt(v, 2);
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        {pyth ? (
          <g>
            {[{ q: sqA, c: C.blue, t: `a² = ${nice(a * a)}`, i: 1 }, { q: sqB, c: C.orange, t: `b² = ${nice(b * b)}`, i: 2 }, { q: sqC, c: C.green, t: `c² = ${nice(c * c)}`, i: 3 }].map((S2) => (
              <g key={S2.i} opacity={pp(S2.i)}>
                <path d={pathOf(S2.q, true)} fill={S2.c} opacity={0.16} stroke={S2.c} strokeWidth={2.5} />
                <Label x={center(S2.q).x} y={center(S2.q).y} size={Math.max(20, Math.min(30, Math.hypot(S2.q[1].x - S2.q[0].x, S2.q[1].y - S2.q[0].y) / 5))} color={S2.c} weight={600}>{S2.t}</Label>
              </g>
            ))}
          </g>
        ) : null}
        <g opacity={pp(0)}>
          <path d={pathOf([A, B, Cc], true)} fill="rgba(236,238,242,0.05)" stroke={C.ink} strokeWidth={3.5} strokeLinejoin="round" />
          <path d={`M${A.x + 26},${A.y} L${A.x + 26},${A.y - 26} L${A.x},${A.y - 26}`} stroke={C.ink} strokeWidth={2} fill="none" />
          <Label x={A.x - (pyth ? 0 : 24)} y={(A.y + Cc.y) / 2} anchor="end" size={30} color={C.blue} italic weight={600} opacity={pyth ? 0 : 1}>a</Label>
          <Label x={(A.x + B.x) / 2} y={A.y + 34} size={30} color={C.orange} italic weight={600} opacity={pyth ? 0 : 1}>b</Label>
          <Label x={(B.x + Cc.x) / 2 + 22} y={(B.y + Cc.y) / 2 - 22} anchor="start" size={30} color={C.green} italic weight={600} opacity={pyth ? 0 : 1}>c</Label>
        </g>
        {!pyth ? (() => {
          const th = Math.atan2(a, b);
          return (
            <g opacity={pp(1)}>
              <path d={`M${B.x - 70},${B.y} A70,70 0 0 1 ${B.x - Math.cos(th) * 70},${B.y - Math.sin(th) * 70}`} stroke={C.light} strokeWidth={3} fill="none" />
              <Label x={B.x - 100} y={B.y - 24} size={28} color={C.light} italic>θ</Label>
              <Label x={A.x - 20} y={(A.y + Cc.y) / 2 + 40} anchor="end" size={22} color={C.blue}>opposite</Label>
              <Label x={(A.x + B.x) / 2} y={A.y + 66} size={22} color={C.orange}>adjacent</Label>
              <Label x={(B.x + Cc.x) / 2 + 22} y={(B.y + Cc.y) / 2 + 12} anchor="start" size={22} color={C.green}>hypotenuse</Label>
            </g>
          );
        })() : null}
      </svg>
      {pyth ? (
        <div style={{ position: "absolute", right: 0, top: box.h / 2 - 80, ...card, padding: "26px 34px", ...enter(frame, ph[4].start, 18) }}>
          <Tex tex={`a^2 + b^2 = c^2`} size={44} />
          <div style={{ marginTop: 14 }}><Tex tex={`${nice(a * a)} + ${nice(b * b)} = ${nice(c * c)}`} size={36} color={C.muted} /></div>
          <div style={{ marginTop: 10 }}><Tex tex={`c = ${nice(c)}`} size={40} color={C.green} /></div>
        </div>
      ) : (
        <div style={{ position: "absolute", right: 0, top: 40, ...card, padding: "22px 30px", display: "flex", flexDirection: "column", gap: 16, ...enter(frame, ph[2].start, 18) }}>
          <Tex tex={`\\sin\\theta = \\frac{a}{c} = ${fmt(a / c, 3)}`} size={34} />
          <Tex tex={`\\cos\\theta = \\frac{b}{c} = ${fmt(b / c, 3)}`} size={34} />
          <Tex tex={`\\tan\\theta = \\frac{a}{b} = ${fmt(a / b, 3)}`} size={34} />
          <div style={{ color: C.muted, fontFamily: F.sans, fontSize: 24 }}>{`θ = ${fmt((Math.atan2(a, b) * 180) / Math.PI, 1)}°`}</div>
        </div>
      )}
    </div>
  );
};

// =================================================================== geometry
export const Geometry: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const pts = s.points as { id: string; x: number; y: number }[];
  const map = new Map(pts.map((p) => [p.id, p]));
  let xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  for (const c of s.circles as { center: string; radius: number }[]) {
    const p = map.get(c.center)!; xs.push(p.x - c.radius, p.x + c.radius); ys.push(p.y - c.radius, p.y + c.radius);
  }
  const pad = 1.2;
  const pl: Plane = plane(Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad, { left: 20, top: 20, width: box.w - 40, height: box.h - 40 }, true);
  const P = (id: string) => { const p = map.get(id)!; return { x: pl.sx(p.x), y: pl.sy(p.y) }; };
  const cen = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
  const groups = [pts.length ? 1 : 0, s.circles.length, s.polygons.length, s.segments.length, s.angles.length].map((n) => Math.max(0, n));
  const ph = phases(dur, [0.6, 1, 1, 0.6, 1.6, 1].map((w, i) => (i === 0 ? w : i - 1 < groups.length && groups[i - 1] ? w : 0.01)));
  const pGrid = prog(frame, ph[0].start, ph[0].len);
  const within = (k: number, i: number, n: number) => prog(frame, ph[k].start + (ph[k].len * i) / Math.max(1, n), Math.max(10, ph[k].len / Math.max(1, n)));
  return (
    <svg width={box.w} height={box.h}>
      {s.show_grid ? <Axes pl={pl} opacity={pGrid} /> : null}
      {(s.circles as { center: string; radius: number }[]).map((c, i) => {
        const p = within(2, i, s.circles.length);
        const o = P(c.center);
        const r = c.radius * pl.unit;
        return <circle key={i} cx={o.x} cy={o.y} r={r} stroke={C.blue} strokeWidth={3} fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} transform={`rotate(-90 ${o.x} ${o.y})`} />;
      })}
      {(s.polygons as string[][]).map((poly, i) => <path key={i} d={pathOf(poly.map(P), true)} fill={SERIES[(i + 2) % SERIES.length]} opacity={0.16 * within(3, i, s.polygons.length)} stroke="none" />)}
      {(s.segments as { from: string; to: string; label: string; dashed: boolean }[]).map((sg, i) => {
        const p = within(4, i, s.segments.length);
        const a = P(sg.from), b = P(sg.to);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const n = { x: -(b.y - a.y), y: b.x - a.x }; const nl = Math.hypot(n.x, n.y) || 1;
        const cs = { x: pl.sx(cen.x), y: pl.sy(cen.y) };
        const side = (mid.x - cs.x) * n.x + (mid.y - cs.y) * n.y >= 0 ? 1 : -1;
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * p} y2={a.y + (b.y - a.y) * p} stroke={C.ink} strokeWidth={3.5} strokeDasharray={sg.dashed ? "10 9" : undefined} strokeLinecap="round" />
            {sg.label ? <Label x={mid.x + (n.x / nl) * 28 * side} y={mid.y + (n.y / nl) * 28 * side} size={26} color={C.light} italic opacity={p}>{sg.label}</Label> : null}
          </g>
        );
      })}
      {(s.angles as { at: string; from: string; to: string; label: string }[]).map((an, i) => {
        const p = within(5, i, s.angles.length);
        const o = P(an.at), a = P(an.from), b = P(an.to);
        const a1 = Math.atan2(a.y - o.y, a.x - o.x), a2 = Math.atan2(b.y - o.y, b.x - o.x);
        let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const r = 44;
        const right = Math.abs(Math.abs(d) - Math.PI / 2) < 0.03;
        const mid = a1 + d / 2;
        return (
          <g key={i} opacity={p}>
            {right ? (
              <path d={`M${o.x + Math.cos(a1) * 30},${o.y + Math.sin(a1) * 30} L${o.x + Math.cos(a1) * 30 + Math.cos(a2) * 30},${o.y + Math.sin(a1) * 30 + Math.sin(a2) * 30} L${o.x + Math.cos(a2) * 30},${o.y + Math.sin(a2) * 30}`} stroke={C.light} strokeWidth={2.5} fill="none" />
            ) : (
              <path d={`M${o.x + Math.cos(a1) * r},${o.y + Math.sin(a1) * r} A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${o.x + Math.cos(a2) * r},${o.y + Math.sin(a2) * r}`} stroke={C.light} strokeWidth={3} fill="none" />
            )}
            {an.label ? <Label x={o.x + Math.cos(mid) * (r + 34)} y={o.y + Math.sin(mid) * (r + 34)} size={24} color={C.light}>{an.label}</Label> : null}
          </g>
        );
      })}
      {pts.map((p, i) => {
        const o = within(1, i, pts.length);
        const q = P(p.id);
        const dx = p.x - cen.x, dy = p.y - cen.y; const l = Math.hypot(dx, dy) || 1;
        return (
          <g key={p.id} opacity={o}>
            <Dot x={q.x} y={q.y} r={7} color={C.ink} />
            <Label x={q.x + (dx / l) * 30} y={q.y - (dy / l) * 30} size={28} color={C.ink} weight={600}>{p.id}</Label>
          </g>
        );
      })}
    </svg>
  );
};

// ==================================================================== solid
export const Solid: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const shape = s.shape as string;
  const a = s.a, b = s.b, c = s.c, u = s.unit;
  const ph = phases(dur, [1, 1.2, 1.6]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const pDim = prog(frame, ph[1].start, ph[1].len);
  const pF = prog(frame, ph[2].start, ph[2].len);
  const yaw = 0.6 + frame * 0.005, pitch = 0.42;
  const dims = shape === "cube" ? [a, a, a] : shape === "cuboid" ? [a, b, c] : shape === "sphere" || shape === "hemisphere" ? [2 * a, 2 * a, 2 * a] : [2 * a, b, 2 * a];
  const maxD = Math.max(...dims);
  const S = (Math.min(box.w * 0.55, box.h * 0.9) / maxD) * 0.78 * (0.85 + 0.15 * pIn);
  const cx = box.w * 0.34, cy = box.h * 0.52;
  const pr = (x: number, y: number, z: number) => {
    const x1 = x * Math.cos(yaw) - z * Math.sin(yaw), z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    return { x: cx + x1 * S, y: cy - y1 * S, z: z2 };
  };
  const els: React.ReactNode[] = [];
  const stroke = C.ink;
  const fillC = "rgba(90,169,240,0.12)";
  let rows: [string, string][] = [];
  const pi = Math.PI;
  const ellipse = (y: number, r: number, key: string, backDashed = true) => {
    const ptsF: Pt[] = [], ptsB: Pt[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = (2 * pi * i) / 64;
      const p = pr(Math.cos(t) * r, y, Math.sin(t) * r);
      (p.z < 0 ? ptsF : ptsB).push(p);
    }
    const all: Pt[] = [];
    for (let i = 0; i <= 64; i++) { const t = (2 * pi * i) / 64; all.push(pr(Math.cos(t) * r, y, Math.sin(t) * r)); }
    // split by depth sign into contiguous runs
    const runs: { front: boolean; pts: Pt[] }[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = (2 * pi * i) / 64; const p = pr(Math.cos(t) * r, y, Math.sin(t) * r); const front = p.z <= 0;
      if (!runs.length || runs[runs.length - 1].front !== front) runs.push({ front, pts: runs.length ? [runs[runs.length - 1].pts[runs[runs.length - 1].pts.length - 1]] : [] });
      runs[runs.length - 1].pts.push(p);
    }
    void ptsF; void ptsB;
    return { all, node: runs.map((rn, i) => <path key={`${key}${i}`} d={pathOf(rn.pts)} stroke={stroke} strokeWidth={rn.front ? 3 : 2} strokeDasharray={!rn.front && backDashed ? "6 7" : undefined} opacity={rn.front ? 1 : 0.55} fill="none" />) };
  };
  if (shape === "cube" || shape === "cuboid") {
    const [L, Hh, Bd] = shape === "cube" ? [a, a, a] : [a, c, b];
    const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([x, y, z]) => pr((x * L) / 2, (y * Hh) / 2, (z * Bd) / 2));
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];
    const vis = faces.map((f) => { const [p0, p1, p2] = f.map((i) => v[i]); return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x); });
    faces.forEach((f, i) => { if (vis[i] < 0 === (i % 2 === 0)) els.push(<path key={`f${i}`} d={pathOf(f.map((k) => v[k]), true)} fill={fillC} stroke="none" />); });
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const back = v.reduce((bi, p, i) => (p.z > v[bi].z ? i : bi), 0);
    edges.forEach(([i, j], k) => els.push(<line key={`e${k}`} x1={v[i].x} y1={v[i].y} x2={v[j].x} y2={v[j].y} stroke={stroke} strokeWidth={i === back || j === back ? 2 : 3} strokeDasharray={i === back || j === back ? "6 7" : undefined} opacity={i === back || j === back ? 0.5 : 1} />));
    const lab = (p: Pt, q: Pt, t: string, off: Pt) => <Label key={t} x={(p.x + q.x) / 2 + off.x} y={(p.y + q.y) / 2 + off.y} size={26} color={C.light} italic opacity={pDim}>{t}</Label>;
    els.push(lab(v[0], v[1], shape === "cube" ? `a = ${fmt(a, 2)} ${u}` : `l = ${fmt(a, 2)} ${u}`, { x: 0, y: 34 }));
    if (shape === "cuboid") { els.push(lab(v[1], v[2], `h = ${fmt(c, 2)} ${u}`, { x: 60, y: 0 })); els.push(lab(v[1], v[5], `b = ${fmt(b, 2)} ${u}`, { x: 50, y: 20 })); }
    rows = shape === "cube"
      ? [["Lateral area 4a²", `${fmt(4 * a * a, 2)} ${u}²`], ["Total area 6a²", `${fmt(6 * a * a, 2)} ${u}²`], ["Volume a³", `${fmt(a ** 3, 2)} ${u}³`]]
      : [["Total area 2(lb+bh+hl)", `${fmt(2 * (a * b + b * c + c * a), 2)} ${u}²`], ["Volume lbh", `${fmt(a * b * c, 2)} ${u}³`]];
  } else if (shape === "cylinder" || shape === "cone") {
    const r = a, h = b;
    const bot = ellipse(-h / 2, r, "bot");
    const left = pr(-r * Math.cos(yaw) * 0 - r, -h / 2, 0);
    void left;
    // silhouette: extreme points of ellipse in screen x
    const ex = bot.all.reduce((acc, p) => ({ min: p.x < acc.min.x ? p : acc.min, max: p.x > acc.max.x ? p : acc.max }), { min: bot.all[0], max: bot.all[0] });
    if (shape === "cylinder") {
      const top = ellipse(h / 2, r, "top", false);
      const tx = top.all.reduce((acc, p) => ({ min: p.x < acc.min.x ? p : acc.min, max: p.x > acc.max.x ? p : acc.max }), { min: top.all[0], max: top.all[0] });
      els.push(<path key="body" d={pathOf([ex.min, tx.min, tx.max, ex.max], true)} fill={fillC} />);
      els.push(<path key="topf" d={pathOf(top.all, true)} fill="rgba(90,169,240,0.18)" />);
      els.push(<line key="l1" x1={ex.min.x} y1={ex.min.y} x2={tx.min.x} y2={tx.min.y} stroke={stroke} strokeWidth={3} />);
      els.push(<line key="l2" x1={ex.max.x} y1={ex.max.y} x2={tx.max.x} y2={tx.max.y} stroke={stroke} strokeWidth={3} />);
      els.push(...(top.node as React.ReactNode[]));
      const c0 = pr(0, h / 2, 0), c1 = pr(r, h / 2, 0);
      els.push(<g key="dimr" opacity={pDim}><line x1={c0.x} y1={c0.y} x2={c1.x} y2={c1.y} stroke={C.light} strokeWidth={2.5} /><Label x={(c0.x + c1.x) / 2} y={(c0.y + c1.y) / 2 - 20} size={26} color={C.light} italic>{`r = ${fmt(r, 2)}`}</Label></g>);
      rows = [["Curved area 2πrh", `${fmt(2 * pi * r * h, 2)} ${u}²`], ["Total area 2πr(r+h)", `${fmt(2 * pi * r * (r + h), 2)} ${u}²`], ["Volume πr²h", `${fmt(pi * r * r * h, 2)} ${u}³`]];
    } else {
      const apex = pr(0, h / 2, 0);
      els.push(<path key="body" d={pathOf([ex.min, apex, ex.max], true)} fill={fillC} />);
      els.push(<line key="l1" x1={ex.min.x} y1={ex.min.y} x2={apex.x} y2={apex.y} stroke={stroke} strokeWidth={3} />);
      els.push(<line key="l2" x1={ex.max.x} y1={ex.max.y} x2={apex.x} y2={apex.y} stroke={stroke} strokeWidth={3} />);
      const base = pr(0, -h / 2, 0), c1 = pr(r, -h / 2, 0);
      els.push(<g key="dimh" opacity={pDim}><line x1={base.x} y1={base.y} x2={apex.x} y2={apex.y} stroke={C.light} strokeWidth={2.5} strokeDasharray="6 6" /><Label x={base.x + 16} y={(base.y + apex.y) / 2} anchor="start" size={26} color={C.light} italic>{`h = ${fmt(h, 2)}`}</Label>
        <line x1={base.x} y1={base.y} x2={c1.x} y2={c1.y} stroke={C.light} strokeWidth={2.5} /><Label x={(base.x + c1.x) / 2} y={(base.y + c1.y) / 2 + 26} size={26} color={C.light} italic>{`r = ${fmt(r, 2)}`}</Label></g>);
      const l = Math.hypot(r, h);
      rows = [["Slant height l", `${fmt(l, 2)} ${u}`], ["Curved area πrl", `${fmt(pi * r * l, 2)} ${u}²`], ["Total area πr(l+r)", `${fmt(pi * r * (l + r), 2)} ${u}²`], ["Volume ⅓πr²h", `${fmt((pi * r * r * h) / 3, 2)} ${u}³`]];
    }
    els.unshift(...(bot.node as React.ReactNode[]));
    if (shape === "cylinder") {
      const t0 = pr(r * 1.25, -h / 2, 0), t1 = pr(r * 1.25, h / 2, 0);
      els.push(<g key="dimh" opacity={pDim}><Arrow from={t0} to={t1} color={C.light} width={2.5} head={12} /><Arrow from={t1} to={t0} color={C.light} width={2.5} head={12} /><Label x={t0.x + 18} y={(t0.y + t1.y) / 2} anchor="start" size={26} color={C.light} italic>{`h = ${fmt(h, 2)}`}</Label></g>);
    }
  } else {
    const r = a;
    const o = pr(0, 0, 0);
    const R = r * S;
    if (shape === "sphere") {
      els.push(<circle key="s" cx={o.x} cy={o.y} r={R} fill={fillC} stroke={stroke} strokeWidth={3} />);
      els.push(...(ellipse(0, r, "eq").node as React.ReactNode[]));
      rows = [["Surface area 4πr²", `${fmt(4 * pi * r * r, 2)} ${u}²`], ["Volume ⁴⁄₃πr³", `${fmt((4 / 3) * pi * r ** 3, 2)} ${u}³`]];
    } else {
      const eq = ellipse(0, r, "eq", false);
      const ex = eq.all.reduce((acc, p) => ({ min: p.x < acc.min.x ? p : acc.min, max: p.x > acc.max.x ? p : acc.max }), { min: eq.all[0], max: eq.all[0] });
      els.push(<path key="dome" d={`M${ex.min.x},${ex.min.y} A${R},${R} 0 0 1 ${ex.max.x},${ex.max.y}`} fill={fillC} stroke={stroke} strokeWidth={3} />);
      els.push(<path key="base" d={pathOf(eq.all, true)} fill="rgba(90,169,240,0.18)" />);
      els.push(...(eq.node as React.ReactNode[]));
      rows = [["Curved area 2πr²", `${fmt(2 * pi * r * r, 2)} ${u}²`], ["Total area 3πr²", `${fmt(3 * pi * r * r, 2)} ${u}²`], ["Volume ⅔πr³", `${fmt((2 / 3) * pi * r ** 3, 2)} ${u}³`]];
    }
    const c1 = pr(r, 0, 0);
    els.push(<g key="dimr" opacity={pDim}><line x1={o.x} y1={o.y} x2={c1.x} y2={c1.y} stroke={C.light} strokeWidth={2.5} /><Dot x={o.x} y={o.y} r={5} color={C.light} /><Label x={(o.x + c1.x) / 2} y={(o.y + c1.y) / 2 - 20} size={26} color={C.light} italic>{`r = ${fmt(r, 2)}`}</Label></g>);
  }
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0, opacity: pIn }}>{els}</svg>
      <Readout right y={box.h / 2 - 90} p={pF} rows={rows} />
    </div>
  );
};

/** number inside a product: negatives get parentheses, e.g. 3·(−1) */
const pn = (x: number, d = 2) => (x < 0 ? `(${fmt(x, d)})` : fmt(x, d));

// ======================================================== matrix transform
export const MatrixTransform: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const M = s.matrix as number[][];
  const [[ma, mb], [mc, md]] = M;
  const ph = phases(dur, [0.8, 0.6, 2.2, 1.2]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const t = prog(frame, ph[2].start, ph[2].len, easeInOut);
  const pRes = prog(frame, ph[3].start, ph[3].len);
  const A = 1 + (ma - 1) * t, B = mb * t, Cm = mc * t, D = 1 + (md - 1) * t;
  const apply = (x: number, y: number) => ({ x: A * x + B * y, y: Cm * x + D * y });
  // frame the final image of the unit square (and the vector) instead of a fixed window
  const v = s.vector as number[];
  const finalPts = [[1, 0], [0, 1], [1, 1], ...(v.length === 2 ? [v] : [])].map(([x, y]) => [ma * x + mb * y, mc * x + md * y]);
  const ext = Math.max(1, ...finalPts.flat().map(Math.abs));
  const W = clamp(ext * 1.9, 2.6, 8), Hh = W * (box.h / (box.w * 0.66));
  const pl = plane(-W, W, -Hh, Hh, { left: 0, top: 0, width: box.w * 0.66, height: box.h }, true);
  const P = (x: number, y: number) => { const q = apply(x, y); return { x: pl.sx(q.x), y: pl.sy(q.y) }; };
  const lines: React.ReactNode[] = [];
  const N = 12;
  for (let k = -N; k <= N; k++) {
    const a = P(k, -N), b = P(k, N), c = P(-N, k), d = P(N, k);
    const major = k === 0;
    lines.push(<line key={`v${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={major ? C.muted : C.blue} strokeWidth={major ? 2.5 : 1.5} opacity={major ? 0.8 : 0.35} />);
    lines.push(<line key={`h${k}`} x1={c.x} y1={c.y} x2={d.x} y2={d.y} stroke={major ? C.muted : C.blue} strokeWidth={major ? 2.5 : 1.5} opacity={major ? 0.8 : 0.35} />);
  }
  const det = ma * md - mb * mc;
  const O = P(0, 0);
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w * 0.66} height={box.h} style={{ position: "absolute", left: 0, top: 0, overflow: "hidden" }}>
        <defs><clipPath id="mt-clip"><rect x={0} y={0} width={box.w * 0.66} height={box.h} rx={12} /></clipPath></defs>
        <g clipPath="url(#mt-clip)" opacity={pIn}>
          {Array.from({ length: 2 * N + 1 }, (_, i) => i - N).map((k) => (
            <g key={`o${k}`} stroke={C.grid} strokeWidth={1.5}>
              <line x1={pl.sx(k)} x2={pl.sx(k)} y1={0} y2={box.h} /><line y1={pl.sy(k)} y2={pl.sy(k)} x1={0} x2={box.w} />
            </g>
          ))}
          {lines}
          <path d={pathOf([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], true)} fill={C.light} opacity={0.22} stroke={C.light} strokeWidth={2} />
          <Arrow from={O} to={P(1, 0)} color={C.green} width={5} head={18} />
          <Arrow from={O} to={P(0, 1)} color={C.red} width={5} head={18} />
          <Label x={P(1, 0).x + 18} y={P(1, 0).y + 22} size={28} color={C.green} weight={600}>î</Label>
          <Label x={P(0, 1).x - 22} y={P(0, 1).y - 14} size={28} color={C.red} weight={600}>ĵ</Label>
          {v.length === 2 ? (
            <g>
              <Arrow from={O} to={P(v[0], v[1])} color={C.light} width={4.5} head={18} />
              <Label x={P(v[0], v[1]).x + 20} y={P(v[0], v[1]).y - 18} anchor="start" size={24} color={C.light} mono>{`(${fmt(apply(v[0], v[1]).x, 2)}, ${fmt(apply(v[0], v[1]).y, 2)})`}</Label>
            </g>
          ) : null}
        </g>
      </svg>
      <div style={{ position: "absolute", right: 0, top: 30, width: box.w * 0.3, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ ...card, padding: "26px 30px", ...enter(frame, ph[1].start, 16) }}>
          <Tex tex={`M = \\begin{bmatrix} \\color{#5FCB8E}{${fmt(ma)}} & \\color{#F0706A}{${fmt(mb)}} \\\\ \\color{#5FCB8E}{${fmt(mc)}} & \\color{#F0706A}{${fmt(md)}} \\end{bmatrix}`.replace(/−/g, "-")} size={40} />
          <div style={{ marginTop: 14, color: C.muted, fontFamily: F.sans, fontSize: 24, lineHeight: 1.45 }}>
            <span style={{ color: C.green }}>Column 1</span> is where î lands, <span style={{ color: C.red }}>column 2</span> where ĵ lands.
          </div>
        </div>
        <div style={{ ...card, padding: "22px 30px", ...enter(frame, ph[3].start, 16), opacity: pRes }}>
          <Tex tex={`\\det M = ${fmt(ma)}\\cdot${pn(md)} - ${pn(mb)}\\cdot${pn(mc)} =${fmt(det)}`.replace(/−/g, "-")} size={30} />
          <div style={{ marginTop: 12, color: C.muted, fontFamily: F.sans, fontSize: 23 }}>
            {Math.abs(det) < 1e-9 ? "Area collapses to zero: the plane is squashed onto a line." : `Every area is scaled by ${fmt(Math.abs(det))}${det < 0 ? " and orientation flips" : ""}.`}
          </div>
        </div>
      </div>
    </div>
  );
};

// ========================================================= matrix multiply
export const MatrixMultiply: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const A = s.A as number[][], B = s.B as number[][];
  const n = A.length, m = B[0].length, k = B.length;
  const Cm = A.map((row) => B[0].map((_, j) => row.reduce((acc, v, t) => acc + v * B[t][j], 0)));
  const entries = n * m;
  const ph = phases(dur, [0.8, 4, 0.6]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const step = ph[1].len / entries;
  const idx = Math.floor((frame - ph[1].start) / step);
  const cur = idx >= 0 && idx < entries ? { i: Math.floor(idx / m), j: idx % m } : null;
  const doneCount = clamp(idx + (frame - ph[1].start - idx * step > step * 0.6 ? 1 : 0), 0, entries);
  const cell = 104;
  const Mat: React.FC<{ M: (number | null)[][]; hlRow?: number; hlCol?: number; color: string; hlCell?: { i: number; j: number } }> = ({ M, hlRow, hlCol, color, hlCell }) => (
    <div style={{ position: "relative", display: "inline-grid", gridTemplateColumns: `repeat(${M[0].length}, ${cell}px)`, padding: "10px 18px", borderLeft: `3px solid ${C.muted}`, borderRight: `3px solid ${C.muted}`, borderRadius: 10 }}>
      {M.map((row, i) => row.map((v, j) => {
        const hl = i === hlRow || j === hlCol || (hlCell && hlCell.i === i && hlCell.j === j);
        return (
          <div key={`${i}-${j}`} style={{ height: cell * 0.8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: 38, color: v === null ? C.faint : hl ? color : C.ink, background: hl ? "rgba(255,255,255,0.05)" : "transparent", borderRadius: 8 }}>
            {v === null ? "·" : fmt(v, 2)}
          </div>
        );
      }))}
    </div>
  );
  const shownC = Cm.map((row, i) => row.map((v, j) => (i * m + j < doneCount ? v : null)));
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 50, opacity: pIn }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
        <Mat M={A} hlRow={cur?.i} color={C.blue} />
        <span style={{ color: C.muted, fontSize: 44, fontFamily: F.sans }}>×</span>
        <Mat M={B} hlCol={cur?.j} color={C.orange} />
        <span style={{ color: C.muted, fontSize: 44, fontFamily: F.sans }}>=</span>
        <Mat M={shownC} hlCell={cur || undefined} color={C.green} />
      </div>
      <div style={{ height: 70, fontFamily: F.mono, fontSize: 36, color: C.ink }}>
        {cur ? (
          <span>
            <span style={{ color: C.muted }}>{`c${cur.i + 1}${cur.j + 1} = `}</span>
            {Array.from({ length: k }).map((_, t) => (
              <span key={t}>
                <span style={{ color: C.blue }}>{pn(A[cur.i][t])}</span>·<span style={{ color: C.orange }}>{pn(B[t][cur.j])}</span>
                {t < k - 1 ? " + " : ""}
              </span>
            ))}
            <span style={{ color: C.green }}>{` = ${fmt(Cm[cur.i][cur.j], 2)}`}</span>
          </span>
        ) : <span style={{ color: C.muted, fontFamily: F.sans, fontSize: 30 }}>{`(${n}×${k}) · (${k}×${m}) → ${n}×${m}`}</span>}
      </div>
    </div>
  );
};

// =================================================================== vectors
export const Vectors: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const vs = s.vectors as { x: number; y: number; label: string }[];
  const a = vs[0], b = vs[1] || { x: 0, y: 0, label: "" };
  const op = vs.length < 2 && s.operation !== "components" ? "none" : s.operation;
  const res = op === "add" ? { x: a.x + b.x, y: a.y + b.y } : op === "subtract" ? { x: a.x - b.x, y: a.y - b.y } : null;
  const allPts = [{ x: 0, y: 0 }, a, b, ...(res ? [res] : []), ...(op === "add" ? [{ x: a.x + b.x, y: a.y + b.y }] : []), ...(op === "subtract" ? [{ x: -b.x, y: -b.y }] : [])];
  const pad = 1.2;
  const pl = plane(Math.min(...allPts.map((p) => p.x)) - pad, Math.max(...allPts.map((p) => p.x)) + pad, Math.min(...allPts.map((p) => p.y)) - pad, Math.max(...allPts.map((p) => p.y)) + pad, { left: 20, top: 20, width: box.w * 0.66, height: box.h - 40 }, true);
  const P = (p: { x: number; y: number }) => ({ x: pl.sx(p.x), y: pl.sy(p.y) });
  const O = P({ x: 0, y: 0 });
  const ph = phases(dur, [0.6, 1, 1, 1.4, 1]);
  const pp = (i: number) => prog(frame, ph[i].start, ph[i].len);
  const mag = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
  const rows: [string, string][] = [[`|${a.label}|`, fmt(mag(a), 2)]];
  if (vs.length > 1) rows.push([`|${b.label}|`, fmt(mag(b), 2)]);
  let extra: React.ReactNode = null;
  if (op === "add" || op === "subtract") {
    const bb = op === "add" ? b : { x: -b.x, y: -b.y };
    const head = { x: a.x + bb.x, y: a.y + bb.y };
    extra = (
      <g>
        <Arrow from={P(a)} to={P(head)} p={pp(2)} color={C.orange} width={4} head={16} dashed={op === "subtract"} />
        <Arrow from={O} to={P(head)} p={pp(3)} color={C.green} width={5} head={20} />
        <Label x={(O.x + P(head).x) / 2 - 26} y={(O.y + P(head).y) / 2 - 20} size={28} color={C.green} weight={600} opacity={pp(3)}>{op === "add" ? `${a.label} + ${b.label}` : `${a.label} − ${b.label}`}</Label>
        {op === "add" ? <path d={pathOf([P(b), P(head)])} stroke={C.muted} strokeWidth={2} strokeDasharray="6 7" opacity={pp(3) * 0.7} /> : null}
      </g>
    );
    rows.push([op === "add" ? "|a + b|" : "|a − b|", fmt(mag(res!), 2)]);
  } else if (op === "projection") {
    const bl = mag(b) || 1;
    const sc = (a.x * b.x + a.y * b.y) / bl;
    const proj = { x: (b.x / bl) * sc, y: (b.y / bl) * sc };
    extra = (
      <g>
        <line x1={P(a).x} y1={P(a).y} x2={P(a).x + (P(proj).x - P(a).x) * pp(2)} y2={P(a).y + (P(proj).y - P(a).y) * pp(2)} stroke={C.muted} strokeWidth={2.5} strokeDasharray="6 7" />
        <Arrow from={O} to={P(proj)} p={pp(3)} color={C.green} width={6} head={20} />
        <Label x={P(proj).x + 20} y={P(proj).y + 30} size={24} color={C.green} opacity={pp(3)}>projection</Label>
      </g>
    );
    rows.push(["a · b", fmt(a.x * b.x + a.y * b.y, 2)], ["a·b / |b|", fmt(sc, 2)], ["angle", `${fmt((Math.acos(clamp((a.x * b.x + a.y * b.y) / ((mag(a) || 1) * bl), -1, 1)) * 180) / Math.PI, 1)}°`]);
  } else if (op === "components") {
    extra = (
      <g>
        <Arrow from={O} to={P({ x: a.x, y: 0 })} p={pp(2)} color={C.orange} width={4} head={16} />
        <Arrow from={P({ x: a.x, y: 0 })} to={P(a)} p={pp(3)} color={C.green} width={4} head={16} />
        <Label x={(O.x + P({ x: a.x, y: 0 }).x) / 2} y={O.y + 30} size={24} color={C.orange} opacity={pp(2)}>{`${a.label}ₓ = ${fmt(a.x, 2)}`}</Label>
        <Label x={P(a).x + 16} y={(O.y + P(a).y) / 2} anchor="start" size={24} color={C.green} opacity={pp(3)}>{`${a.label}ᵧ = ${fmt(a.y, 2)}`}</Label>
      </g>
    );
    rows.push(["direction", `${fmt((Math.atan2(a.y, a.x) * 180) / Math.PI, 1)}°`]);
  }
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <Axes pl={pl} opacity={pp(0)} />
        <Arrow from={O} to={P(a)} p={pp(1)} color={C.blue} width={5} head={20} />
        <Label x={P(a).x + 18} y={P(a).y - 18} anchor="start" size={30} color={C.blue} weight={600} opacity={pp(1)}>{a.label}</Label>
        {vs.length > 1 && op !== "add" && op !== "subtract" ? <Arrow from={O} to={P(b)} p={pp(1)} color={C.orange} width={5} head={20} /> : null}
        {vs.length > 1 && op === "add" ? <Arrow from={O} to={P(b)} p={pp(1)} color={C.orange} width={3} head={14} opacity={0.4} /> : null}
        {vs.length > 1 && op !== "subtract" ? <Label x={P(b).x + 18} y={P(b).y - 18} anchor="start" size={30} color={C.orange} weight={600} opacity={pp(1)}>{b.label}</Label> : null}
        {extra}
      </svg>
      <Readout right y={30} p={pp(4)} rows={rows} />
    </div>
  );
};

// ====================================================================== venn
export const Venn: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const sets = s.sets as string[];
  const three = sets.length === 3;
  const R = three ? Math.min(box.h * 0.3, 190) : Math.min(box.h * 0.36, 230);
  const cx = box.w * 0.45, cy = box.h * 0.52;
  const centers = three
    ? [{ x: cx - R * 0.6, y: cy - R * 0.35 }, { x: cx + R * 0.6, y: cy - R * 0.35 }, { x: cx, y: cy + R * 0.62 }]
    : [{ x: cx - R * 0.62, y: cy }, { x: cx + R * 0.62, y: cy }];
  const colors = [C.blue, C.orange, C.green];
  const ph = phases(dur, [1, 1.4, 1.6]);
  const pC = prog(frame, ph[0].start, ph[0].len);
  const pI = lin(frame, ph[1].start, ph[1].len);
  const pH = prog(frame, ph[2].start, ph[2].len);
  const key = (inSets: string[]) => sets.map((n) => (inSets.includes(n) ? "1" : "0")).join("");
  const regionPos: Record<string, Pt> = three
    ? { "100": { x: cx - R * 1.0, y: cy - R * 0.6 }, "010": { x: cx + R * 1.0, y: cy - R * 0.6 }, "001": { x: cx, y: cy + R * 1.1 }, "110": { x: cx, y: cy - R * 0.7 }, "101": { x: cx - R * 0.55, y: cy + R * 0.35 }, "011": { x: cx + R * 0.55, y: cy + R * 0.35 }, "111": { x: cx, y: cy - R * 0.05 }, "000": { x: box.w - 140, y: 60 } }
    : { "10": { x: cx - R * 1.05, y: cy }, "01": { x: cx + R * 1.05, y: cy }, "11": { x: cx, y: cy }, "00": { x: box.w - 140, y: 60 } };
  const regions = s.regions as { in: string[]; items: string[] }[];
  const hl = s.highlight as string;
  const opLabel: Record<string, string> = { union: `${sets[0]} ∪ ${sets[1]}`, intersection: `${sets[0]} ∩ ${sets[1]}`, a_minus_b: `${sets[0]} − ${sets[1]}`, complement_a: `${sets[0]}′` };
  return (
    <svg width={box.w} height={box.h}>
      <defs>
        <clipPath id="vA"><circle cx={centers[0].x} cy={centers[0].y} r={R} /></clipPath>
        <mask id="vNotB"><rect x={0} y={0} width={box.w} height={box.h} fill="white" /><circle cx={centers[1].x} cy={centers[1].y} r={R} fill="black" /></mask>
        <mask id="vNotA"><rect x={0} y={0} width={box.w} height={box.h} fill="white" /><circle cx={centers[0].x} cy={centers[0].y} r={R} fill="black" /></mask>
      </defs>
      <rect x={20} y={20} width={box.w - 40} height={box.h - 40} rx={16} fill="none" stroke={C.hairStrong} strokeWidth={2} opacity={pC} />
      <Label x={44} y={52} anchor="start" size={26} color={C.muted} italic opacity={pC}>U</Label>
      <g opacity={pH * 0.32}>
        {hl === "union" ? <>{centers.slice(0, 2).map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={R} fill={C.light} />)}</> : null}
        {hl === "intersection" ? <circle cx={centers[1].x} cy={centers[1].y} r={R} fill={C.light} clipPath="url(#vA)" /> : null}
        {hl === "a_minus_b" ? <circle cx={centers[0].x} cy={centers[0].y} r={R} fill={C.light} mask="url(#vNotB)" /> : null}
        {hl === "complement_a" ? <rect x={20} y={20} width={box.w - 40} height={box.h - 40} rx={16} fill={C.light} mask="url(#vNotA)" /> : null}
      </g>
      {centers.map((c, i) => (
        <g key={i} opacity={pC}>
          <circle cx={c.x} cy={c.y} r={R * (0.9 + 0.1 * pC)} fill={colors[i]} opacity={0.08} stroke={colors[i]} strokeWidth={3} />
          <Label x={c.x + (i === 0 ? -R * 0.75 : i === 1 ? R * 0.75 : 0)} y={c.y + (i === 2 ? R * 0.95 + 26 : -R * 0.95)} size={32} color={colors[i]} weight={700}>{sets[i]}</Label>
        </g>
      ))}
      {regions.map((rg, i) => {
        const p = regionPos[key(rg.in)];
        if (!p) return null;
        const o = clamp(pI * regions.length - i, 0, 1);
        return <Label key={i} x={p.x} y={p.y} size={28} color={C.ink} opacity={o} mono>{rg.items.join("  ")}</Label>;
      })}
      {hl !== "none" ? <Label x={box.w - 40} y={box.h - 46} anchor="end" size={34} color={C.light} weight={600} opacity={pH}>{opLabel[hl]}</Label> : null}
    </svg>
  );
};

// ================================================================= dice grid
export const DiceGrid: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const ev = s.event as string, v = s.value;
  const test = (i: number, j: number) => ev === "sum_equals" ? i + j === v : ev === "sum_at_least" ? i + j >= v : ev === "doubles" ? i === j : ev === "first_greater" ? i > j : (i * j) % 2 === 0;
  const desc: Record<string, string> = { sum_equals: `sum = ${v}`, sum_at_least: `sum ≥ ${v}`, doubles: "a double", first_greater: "first > second", product_even: "product is even" };
  const cell = Math.min((box.h - 80) / 6.4, 88);
  const ox = 90, oy = 50;
  const ph = phases(dur, [1.2, 1.8, 1]);
  const pG = lin(frame, ph[0].start, ph[0].len);
  const fav: [number, number][] = [];
  for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) if (test(i, j)) fav.push([i, j]);
  const shownFav = Math.floor(lin(frame, ph[1].start, ph[1].len) * fav.length + 0.0001);
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const k = fav.length, d = g(k, 36);
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <g key={n} opacity={pG}>
            <Label x={ox + (n - 0.5) * cell} y={oy - 24} size={22} color={C.muted} mono>{n}</Label>
            <Label x={ox - 26} y={oy + (n - 0.5) * cell} size={22} color={C.muted} mono>{n}</Label>
          </g>
        ))}
        <Label x={ox + 3 * cell} y={oy - 52 + 2} size={20} color={C.faint} opacity={pG}>second die</Label>
        {Array.from({ length: 36 }).map((_, idx) => {
          const i = Math.floor(idx / 6) + 1, j = (idx % 6) + 1;
          const o = clamp(pG * 36 - idx * 0.6, 0, 1);
          const fi = fav.findIndex(([a, b]) => a === i && b === j);
          const on = fi >= 0 && fi < shownFav;
          return (
            <g key={idx} opacity={o}>
              <rect x={ox + (j - 1) * cell + 3} y={oy + (i - 1) * cell + 3} width={cell - 6} height={cell - 6} rx={8} fill={on ? "rgba(255,200,87,0.22)" : C.panel} stroke={on ? C.light : C.hair} strokeWidth={on ? 2 : 1} />
              <text x={ox + (j - 0.5) * cell} y={oy + (i - 0.5) * cell + 8} textAnchor="middle" fontSize={22} fill={on ? C.ink : C.muted} fontFamily={F.mono}>{`${i},${j}`}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: ox + cell * 6 + 80, top: oy + 40, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ color: C.muted, fontFamily: F.sans, fontSize: 28, ...enter(frame, ph[0].start + 20) }}>Event: {desc[ev]}</div>
        <div style={{ color: C.ink, fontFamily: F.mono, fontSize: 40, ...enter(frame, ph[1].start) }}>{`${Math.min(shownFav, k)} favourable`}</div>
        <div style={{ ...card, padding: "24px 30px", ...enter(frame, ph[2].start, 16) }}>
          <Tex tex={`P = \\frac{${k}}{36}${d > 1 ? ` = \\frac{${k / d}}{${36 / d}}` : ""} \\approx ${fmt(k / 36, 3)}`} size={44} />
        </div>
      </div>
    </div>
  );
};

// ================================================================== sequence
export const Sequence: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const ari = s.kind === "arithmetic";
  const a = s.first, d = s.step, n = s.terms;
  const terms = Array.from({ length: n }, (_, i) => (ari ? a + i * d : a * Math.pow(d, i)));
  const sum = terms.reduce((x, y) => x + y, 0);
  const ph = phases(dur, [2.4, 1.2, 1.2]);
  const at = stagger(n, ph[0].start, ph[0].start + ph[0].len);
  const w = Math.min(190, (box.w - 40) / n - 24);
  const y = box.h * 0.32;
  const ox = (box.w - (w + 24) * n + 24) / 2;
  const nth = ari ? `a_n = a + (n-1)d = ${fmt(a)} + (n-1)(${fmt(d)})` : `a_n = a r^{\\,n-1} = ${fmt(a)}\\cdot ${fmt(d)}^{\\,n-1}`;
  const sn = ari ? `S_{${n}} = \\frac{n}{2}\\left[2a + (n-1)d\\right] = ${fmt(sum, 2)}` : `S_{${n}} = \\frac{a(r^{n}-1)}{r-1} = ${fmt(sum, 2)}`;
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        {terms.map((tv, i) => {
          const x = ox + i * (w + 24);
          const o = prog(frame, at[i], 14);
          return (
            <g key={i} opacity={o}>
              <rect x={x} y={y} width={w} height={110} rx={12} fill={C.panel} stroke={C.hair} />
              <text x={x + w / 2} y={y + 68} textAnchor="middle" fontSize={terms.some((t) => Math.abs(t) > 9999) ? 28 : 40} fill={C.ink} fontFamily={F.mono}>{fmt(tv, 2)}</text>
              <Label x={x + w / 2} y={y + 146} size={22} color={C.faint} italic>{`a${["₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈"][i]}`}</Label>
              {i > 0 ? (
                <g>
                  <path d={`M${x - 24 - w / 2 + 10},${y - 8} Q${x - 12},${y - 70} ${x + w / 2 - 10},${y - 8}`} stroke={C.light} strokeWidth={2.5} fill="none" />
                  <Label x={x - 12} y={y - 64} size={24} color={C.light} mono>{ari ? `${d >= 0 ? "+" : "−"}${fmt(Math.abs(d), 2)}` : `×${fmt(d, 2)}`}</Label>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: y + 200, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <div style={enter(frame, ph[1].start, 16)}><Tex tex={nth.replace(/−/g, "-")} size={40} /></div>
        <div style={enter(frame, ph[2].start, 16)}><Tex tex={sn.replace(/−/g, "-")} size={40} color={C.green} /></div>
      </div>
    </div>
  );
};
