import React from "react";
import { useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { clamp, enter, fmt, lin, phases, prog } from "../lib/anim";
import { SceneProps } from "../types";
import { Arrow, Draw, Label, Pt, Ray, pathOf } from "../ui/svg";

const card: React.CSSProperties = { background: "rgba(23,27,35,0.92)", border: `1px solid ${C.hair}`, borderRadius: 12 };

const Readout: React.FC<{ rows: [string, string][]; verdict?: string; p: number; x?: number; y?: number }> = ({ rows, verdict, p, x = 0, y = 0 }) => (
  <div style={{ position: "absolute", left: x, top: y, ...card, padding: "16px 22px", opacity: p, transform: `translateY(${(1 - p) * 10}px)`, minWidth: 250 }}>
    {rows.map(([k, v]) => (
      <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 28, fontSize: 24, lineHeight: 1.6 }}>
        <span style={{ color: C.muted, fontFamily: F.sans, fontStyle: "italic" }}>{k}</span>
        <span style={{ color: C.ink, fontFamily: F.mono }}>{v}</span>
      </div>
    ))}
    {verdict ? <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px solid ${C.hair}`, color: C.green, fontFamily: F.sans, fontSize: 23, fontWeight: 500 }}>{verdict}</div> : null}
  </div>
);

/** Thick object/image arrow standing on the axis. */
const Upright: React.FC<{ x: number; y0: number; y1: number; p: number; color: string; dashed?: boolean; label: string }> = ({ x, y0, y1, p, color, dashed, label }) => {
  if (p <= 0) return null;
  const up = y1 < y0;
  return (
    <g>
      <Arrow from={{ x, y: y0 }} to={{ x, y: y1 }} p={p} color={color} width={6} head={22} dashed={dashed} />
      <Label x={x} y={y1 + (up ? -30 : 34)} color={color} size={24} opacity={p}>{label}</Label>
    </g>
  );
};

type OpticsModel = {
  kind: "lens" | "mirror";
  curved: "convex" | "concave";
  f: number; d: number; h: number;
};

const solve = ({ kind, curved, f, d }: OpticsModel) => {
  if (kind === "lens") {
    const fs = curved === "convex" ? f : -f;
    const u = -d;
    const v = (u * fs) / (u + fs);
    const m = v / u;
    return { v, m, fs, xF: -fs, real: v > 0 };
  }
  // mirror: mirror at x = 0 facing left; real images form in front (x < 0)
  const fs = curved === "concave" ? -f : f;
  const u = -d;
  const v = 1 / (1 / fs - 1 / u);
  const m = -v / u;
  return { v, m, fs, xF: fs, real: v < 0 };
};

const verdictText = (real: boolean, m: number) => {
  const size = Math.abs(m) > 1.05 ? "enlarged" : Math.abs(m) < 0.95 ? "diminished" : "same size";
  return `${real ? "Real" : "Virtual"}, ${m < 0 ? "inverted" : "erect"}, ${size}`;
};

const OpticsDiagram: React.FC<SceneProps & { model: OpticsModel }> = ({ dur, box, model }) => {
  const frame = useCurrentFrame();
  const { kind, curved, f, d, h } = model;
  const { v, m, xF, real } = solve(model);
  const hi = m * h;
  const isLens = kind === "lens";

  // world extents (cm). Keep the image in view when reasonable.
  const vis = Math.max(-4.2 * f, Math.min(5.5 * f, v));
  const xmin = Math.min(-d, -2.2 * f, isLens ? vis : Math.min(vis, 0)) * 1.12;
  const xmax = isLens ? Math.max(2.4 * f, vis) * 1.1 : Math.max(2.2 * f * (curved === "convex" ? 1 : 0.6), vis, 0.6 * f) * 1.15;
  const yext = Math.max(h, Math.min(Math.abs(hi), 3.2 * h)) * 1.35;
  const padL = 30, padR = 330, padT = 40, padB = 40; // right column reserved for the readout
  const sx = (x: number) => padL + ((x - xmin) / (xmax - xmin)) * (box.w - padL - padR);
  const sy = (y: number) => padT + (1 - (y + yext) / (2 * yext)) * (box.h - padT - padB);
  const P = (x: number, y: number): Pt => ({ x: sx(x), y: sy(y) });
  const axisY = sy(0);
  const ph = phases(dur, [1.2, 0.8, 1.6, 1.6, 1.6, 0.9, 1.6]);
  const pAxis = prog(frame, ph[0].start, ph[0].len);
  const pObj = prog(frame, ph[1].start, ph[1].len);
  const pr = [2, 3, 4].map((k) => lin(frame, ph[k].start, ph[k].len));
  const pImg = prog(frame, ph[5].start, ph[5].len);
  const pRead = prog(frame, ph[6].start, 18);

  // incoming hit heights on the optic (x = 0)
  const tip = { x: -d, y: h };
  const optH = (box.h - padT - padB) * 0.86;
  const half = optH / 2;
  const ox = sx(0);
  const pxPerCm = (box.w - padL - padR) / (xmax - xmin);
  // concave: rim curls toward the object (left); convex: rim curls away
  const sag = curved === "concave" ? -22 : 22;
  const surfaceX = (yScreen: number) => ox + sag * Math.pow((yScreen - axisY) / half, 2);
  const hits = [h, 0, (h * xF) / (xF + d)];
  const I = { x: v, y: hi };
  const rays = hits.map((y) => {
    const Pw = { x: isLens ? 0 : (surfaceX(sy(y)) - ox) / pxPerCm, y };
    // outgoing direction passes through the image point (real) or away from it (virtual)
    let dir = real ? { x: I.x - Pw.x, y: I.y - Pw.y } : { x: Pw.x - I.x, y: Pw.y - I.y };
    if (!isLens) {
      // mirrors send light back to the left
      if (dir.x > 0) dir = { x: -dir.x, y: -dir.y };
    } else if (dir.x < 0) dir = { x: -dir.x, y: -dir.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    dir = { x: dir.x / len, y: dir.y / len };
    const edgeX = isLens ? xmax : xmin;
    const t = Math.abs((edgeX - Pw.x) / (dir.x || 1e-6));
    let end = { x: Pw.x + dir.x * t, y: Pw.y + dir.y * t };
    if (Math.abs(end.y) > yext) {
      const tt = Math.abs((Math.sign(end.y) * yext - Pw.y) / (dir.y || 1e-6));
      end = { x: Pw.x + dir.x * tt, y: Pw.y + dir.y * tt };
    }
    return { pts: [P(tip.x, tip.y), P(Pw.x, y), P(end.x, end.y)], hit: P(Pw.x, y) };
  });

  const imgInView = v > xmin && v < xmax;

  // lens / mirror outline
  const lensShape = () => {
    const bulge = curved === "convex" ? 26 : -18, edge = curved === "convex" ? 6 : 22;
    const top = axisY - half, bot = axisY + half;
    const d1 = `M${ox - edge},${top} Q${ox - edge - bulge * 2},${axisY} ${ox - edge},${bot} L${ox + edge},${bot} Q${ox + edge + bulge * 2},${axisY} ${ox + edge},${top} Z`;
    return <path d={d1} fill={C.glass} stroke={C.glassEdge} strokeWidth={2.5} opacity={pAxis} />;
  };
  const mirrorShape = () => {
    const top = axisY - half, bot = axisY + half;
    const d1 = `M${ox + sag},${top} Q${ox - sag},${axisY} ${ox + sag},${bot}`;
    const hatch = [] as React.ReactNode[];
    for (let i = 1; i < 16; i++) {
      const t = i / 16;
      const y = top + (bot - top) * t;
      const x = ox + sag - 4 * t * (1 - t) * sag; // point on the quadratic curve
      hatch.push(<line key={i} x1={x + 4} y1={y} x2={x + 20} y2={y - 14} stroke={C.muted} strokeWidth={2} opacity={0.5} />);
    }
    return (
      <g opacity={pAxis}>
        {hatch}
        <path d={d1} stroke={C.glassEdge} strokeWidth={5} fill="none" />
      </g>
    );
  };

  const marks: { x: number; t: string }[] = isLens
    ? [{ x: f, t: "F₂" }, { x: -f, t: "F₁" }, { x: 2 * f, t: "2F₂" }, { x: -2 * f, t: "2F₁" }]
    : [{ x: xF, t: "F" }, { x: 2 * xF, t: "C" }];

  const rayColors = [C.light, "#FFD98A", "#FFB547"];
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="opt-clip"><rect x={0} y={0} width={box.w} height={box.h} /></clipPath>
        </defs>
        <g clipPath="url(#opt-clip)">
          <line x1={sx(xmin)} x2={sx(xmin) + (sx(xmax) - sx(xmin)) * pAxis} y1={axisY} y2={axisY} stroke={C.hairStrong} strokeWidth={2} />
          {marks.filter((mk) => mk.x > xmin && mk.x < xmax).map((mk) => (
            <g key={mk.t} opacity={pAxis}>
              <circle cx={sx(mk.x)} cy={axisY} r={5} fill={C.muted} />
              <Label x={sx(mk.x)} y={axisY + 30} size={22} color={C.muted}>{mk.t}</Label>
            </g>
          ))}
          <Label x={ox + (isLens ? 18 : -18)} y={axisY + 30} size={22} color={C.muted} anchor={isLens ? "start" : "end"} opacity={pAxis}>{isLens ? "O" : "P"}</Label>
          {isLens ? lensShape() : mirrorShape()}

          {/* virtual back-extensions */}
          {!real && imgInView ? rays.map((r, i) => (
            <line key={`v${i}`} x1={r.hit.x} y1={r.hit.y} x2={sx(I.x)} y2={sy(I.y)} stroke={C.light} strokeWidth={2.2}
              strokeDasharray="8 9" opacity={0.65 * clamp((pr[i] - 0.55) / 0.3, 0, 1)} />
          )) : null}
          {rays.map((r, i) => <Ray key={i} pts={r.pts} p={pr[i]} color={rayColors[i]} />)}

          <Upright x={sx(-d)} y0={axisY} y1={sy(h)} p={pObj} color={C.blue} label="Object" />
          {imgInView ? <Upright x={sx(v)} y0={axisY} y1={sy(hi)} p={pImg} color={real ? C.green : C.violet} dashed={!real} label="Image" /> : null}
        </g>
      </svg>
      <Readout
        p={pRead}
        x={box.w - 290}
        y={0}
        rows={[["u", `${fmt(-d, 1)} cm`], ["f", `${fmt(model.kind === "lens" ? (curved === "convex" ? f : -f) : (curved === "concave" ? -f : f), 1)} cm`],
          ["v", imgInView || Math.abs(v) < 1e4 ? `${fmt(v, 1)} cm` : "∞"], ["m", fmt(m, 2)]]}
        verdict={verdictText(real, m)}
      />
    </div>
  );
};

export const Lens: React.FC<SceneProps> = (p) => (
  <OpticsDiagram {...p} model={{ kind: "lens", curved: p.s.lens, f: p.s.focal_length, d: p.s.object_distance, h: p.s.object_height }} />
);
export const Mirror: React.FC<SceneProps> = (p) => (
  <OpticsDiagram {...p} model={{ kind: "mirror", curved: p.s.mirror, f: p.s.focal_length, d: p.s.object_distance, h: p.s.object_height }} />
);

// =============================================================== refraction
export const Refraction: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const { n1, n2 } = s;
  const cx = box.w * 0.5, cy = box.h * 0.5;
  const R = Math.min(box.w * 0.42, box.h * 0.46);
  const ph = phases(dur, [1, 1.4, 1.4, 2.2]);
  const sweep = s.sweep ? lin(frame, ph[3].start, ph[3].len) : 0;
  const crit = n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null;
  const thetaDeg = s.sweep ? s.incidence_deg + (85 - s.incidence_deg) * sweep : s.incidence_deg;
  const th = (thetaDeg * Math.PI) / 180;
  const sinR = (n1 / n2) * Math.sin(th);
  const tir = sinR > 1;
  const r = tir ? null : Math.asin(sinR);
  const pIn = lin(frame, ph[1].start, ph[1].len);
  const pOut = lin(frame, ph[2].start, ph[2].len);
  const pSetup = prog(frame, ph[0].start, ph[0].len);
  const src = { x: cx - Math.sin(th) * R, y: cy - Math.cos(th) * R };
  const refl = { x: cx + Math.sin(th) * R, y: cy - Math.cos(th) * R };
  const refr = r !== null ? { x: cx + Math.sin(r) * R, y: cy + Math.cos(r) * R } : null;
  // Fresnel-ish partial reflection strength
  const reflStrength = tir ? 1 : clamp(0.18 + 0.6 * Math.pow(Math.sin(th), 6), 0.18, 0.8);
  const arc = (a0: number, a1: number, rad: number, down: boolean) => {
    const p0 = { x: cx + Math.sin(a0) * rad * (down ? 1 : -1), y: cy + Math.cos(a0) * rad * (down ? 1 : -1) };
    const p1 = { x: cx + Math.sin(a1) * rad * (down ? 1 : -1), y: cy + Math.cos(a1) * rad * (down ? 1 : -1) };
    return `M${p0.x},${p0.y} A${rad},${rad} 0 0 ${down ? 0 : 1} ${p1.x},${p1.y}`;
  };
  const denser2 = n2 > n1;
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <rect x={0} y={cy} width={box.w} height={box.h - cy} fill={denser2 ? C.glass : "rgba(140,190,235,0.05)"} opacity={pSetup} />
        <rect x={0} y={0} width={box.w} height={cy} fill={!denser2 ? C.glass : "transparent"} opacity={pSetup} />
        <line x1={0} x2={box.w} y1={cy} y2={cy} stroke={C.glassEdge} strokeWidth={2.5} opacity={pSetup} />
        <line x1={cx} x2={cx} y1={cy - R - 10} y2={cy + R + 10} stroke={C.muted} strokeWidth={2} strokeDasharray="10 10" opacity={pSetup * 0.8} />
        <Label x={cx + 12} y={cy - R - 4} anchor="start" size={22} color={C.muted} opacity={pSetup}>normal</Label>
        <Label x={40} y={cy - 36} anchor="start" size={28} color={C.ink} opacity={pSetup}>{s.medium1}</Label>
        <Label x={40} y={cy - 72} anchor="start" size={22} color={C.muted} mono opacity={pSetup}>n₁ = {fmt(n1, 2)}</Label>
        <Label x={40} y={cy + 42} anchor="start" size={28} color={C.ink} opacity={pSetup}>{s.medium2}</Label>
        <Label x={40} y={cy + 78} anchor="start" size={22} color={C.muted} mono opacity={pSetup}>n₂ = {fmt(n2, 2)}</Label>

        <Ray pts={[src, { x: cx, y: cy }]} p={pIn} />
        {pIn >= 1 ? <Ray pts={[{ x: cx, y: cy }, refl]} p={pOut} color={C.light} width={tir ? 3.5 : 2.2} chevrons={tir} /> : null}
        {pIn >= 1 && !tir ? <g opacity={1 - reflStrength * 0.6}><Ray pts={[{ x: cx, y: cy }, refr!]} p={pOut} /></g> : null}
        {pIn >= 1 && !tir ? null : null}
        {pIn >= 1 ? <path d={`M${cx},${cy} L${refl.x},${refl.y}`} stroke="transparent" /> : null}

        <path d={arc(0, th, 120, false)} stroke={C.light} strokeWidth={2.5} fill="none" opacity={pIn} />
        <Label x={cx - Math.sin(th / 2) * 160} y={cy - Math.cos(th / 2) * 160} size={26} color={C.light} opacity={pIn}>θ₁</Label>
        {r !== null ? (
          <g opacity={pOut}>
            <path d={arc(0, r, 120, true)} stroke={C.light} strokeWidth={2.5} fill="none" />
            <Label x={cx + Math.sin(r / 2) * 160} y={cy + Math.cos(r / 2) * 160} size={26} color={C.light}>θ₂</Label>
          </g>
        ) : null}
        {tir && pOut > 0.3 ? <Label x={cx + 200} y={cy + 90} size={30} color={C.red} anchor="start" opacity={prog(frame, ph[2].start + ph[2].len * 0.3, 12)}>Total internal reflection</Label> : null}
      </svg>
      <Readout p={prog(frame, ph[2].start + ph[2].len * 0.6, 16)} x={box.w - 330} y={0}
        rows={[["θ₁", `${fmt(thetaDeg, 1)}°`], ["θ₂", r !== null ? `${fmt((r * 180) / Math.PI, 1)}°` : "—"], ...(crit ? [["θc", `${fmt(crit, 1)}°`] as [string, string]] : [])]}
        verdict={tir ? "θ₁ > θc: no refracted ray" : "n₁ sin θ₁ = n₂ sin θ₂"} />
    </div>
  );
};

// ==================================================================== prism
// indices exaggerated (~3x real crown-glass dispersion) so the fan is visible on screen
const SPECTRUM = [
  { c: "#FF4D4D", n: 1.50 }, { c: "#FF9A3D", n: 1.51 }, { c: "#FFE14D", n: 1.52 }, { c: "#5BDB6E", n: 1.53 },
  { c: "#4DA6FF", n: 1.54 }, { c: "#6A5CFF", n: 1.55 }, { c: "#B26BFF", n: 1.56 },
];

type V = { x: number; y: number };
const refractDir = (d: V, n: V, eta: number): V | null => {
  // n points against d's side; normalize
  const cosi = -(d.x * n.x + d.y * n.y);
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const t = { x: eta * d.x + (eta * cosi - Math.sqrt(k)) * n.x, y: eta * d.y + (eta * cosi - Math.sqrt(k)) * n.y };
  const l = Math.hypot(t.x, t.y);
  return { x: t.x / l, y: t.y / l };
};
const hitSeg = (o: V, d: V, a: V, b: V) => {
  const e = { x: b.x - a.x, y: b.y - a.y };
  const den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((a.x - o.x) * e.y - (a.y - o.y) * e.x) / den;
  const u = ((a.x - o.x) * d.y - (a.y - o.y) * d.x) / den;
  return t > 1e-6 && u >= 0 && u <= 1 ? { x: o.x + d.x * t, y: o.y + d.y * t } : null;
};

export const Prism: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const A = (s.apex_deg * Math.PI) / 180;
  const side = Math.min(box.h * 0.92, 560);
  const cx = box.w * 0.46, base = box.h * 0.88;
  const half = Math.tan(A / 2) * side * 0.9;
  const hgt = Math.min(side, (box.h * 0.8));
  const apex = { x: cx, y: base - hgt };
  const L0 = { x: cx - Math.tan(A / 2) * hgt, y: base };
  const R0 = { x: cx + Math.tan(A / 2) * hgt, y: base };
  void half;
  const ph = phases(dur, [1, 1.3, 1.3, 2]);
  const pSetup = prog(frame, ph[0].start, ph[0].len);
  const pIn = lin(frame, ph[1].start, ph[1].len);
  const pMid = lin(frame, ph[2].start, ph[2].len);
  const pOut = lin(frame, ph[3].start, ph[3].len * 0.7);

  // entry point on left face
  const entry = { x: L0.x + (apex.x - L0.x) * 0.55, y: L0.y + (apex.y - L0.y) * 0.55 };
  const nL = (() => { const e = { x: apex.x - L0.x, y: apex.y - L0.y }; const l = Math.hypot(e.x, e.y); return { x: -e.y / l, y: e.x / l }; })();
  // outward normal of left face points left-up; incoming ray from left slightly upward
  const outN = nL.x < 0 ? nL : { x: -nL.x, y: -nL.y };
  const inc = (() => { const a = Math.atan2(outN.y, outN.x) + Math.PI - 0.85; return { x: Math.cos(a), y: Math.sin(a) }; })();
  const start = { x: entry.x - inc.x * 520, y: entry.y - inc.y * 520 };
  const colors = s.dispersion ? SPECTRUM : [{ c: C.light, n: 1.52 }];
  const paths = colors.map(({ c, n }) => {
    const d1 = refractDir(inc, outN, 1 / n)!;
    const exit = hitSeg(entry, d1, apex, R0) || hitSeg(entry, d1, R0, L0) || entry;
    const e = { x: R0.x - apex.x, y: R0.y - apex.y };
    const l = Math.hypot(e.x, e.y);
    let nR = { x: e.y / l, y: -e.x / l };
    if (nR.x < 0) nR = { x: -nR.x, y: -nR.y };
    const inward = { x: -nR.x, y: -nR.y };
    const d2 = refractDir(d1, inward, n) || d1;
    const far = { x: exit.x + d2.x * 900, y: exit.y + d2.y * 900 };
    const yAt = (X: number) => exit.y + ((X - exit.x) * d2.y) / (d2.x || 1e-6);
    return { c, mid: [entry, exit], out: [exit, far], yAt };
  });
  return (
    <svg width={box.w} height={box.h}>
      <path d={pathOf([apex, R0, L0], true)} fill={C.glass} stroke={C.glassEdge} strokeWidth={2.5} opacity={pSetup} />
      <Label x={apex.x} y={apex.y - 26} size={24} color={C.muted} opacity={pSetup}>A = {fmt(s.apex_deg, 0)}°</Label>
      <Ray pts={[start, entry]} p={pIn} color="#F4F1E8" />
      {paths.map((p, i) => (
        <g key={i} opacity={s.dispersion ? 0.95 : 1}>
          {pIn >= 1 ? <Ray pts={p.mid} p={pMid} color={p.c} width={s.dispersion ? 2 : 3.5} chevrons={false} /> : null}
          {pMid >= 1 ? <Ray pts={p.out} p={pOut} color={p.c} width={3} chevrons={false} /> : null}
        </g>
      ))}
      {s.dispersion && pOut > 0.8 ? (
        <g opacity={prog(frame, ph[3].start + ph[3].len * 0.7, 16)}>
          <Label x={box.w - 20} y={paths[0].yAt(box.w - 20) - 22} size={24} color="#FF7A7A" anchor="end">Red: bends least</Label>
          <Label x={box.w - 20} y={paths[6].yAt(box.w - 20) + 30} size={24} color="#C08BFF" anchor="end">Violet: bends most</Label>
        </g>
      ) : null}
    </svg>
  );
};

// ============================================================ interference
export const Interference: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const lam = s.wavelength * 38; // px
  const dsep = s.slit_separation * 80;
  const barrierX = box.w * 0.18;
  const screenX = box.w - 150;
  const cy = box.h / 2;
  const S1 = { x: barrierX, y: cy - dsep / 2 }, S2 = { x: barrierX, y: cy + dsep / 2 };
  const ph = phases(dur, [1, 2.4, 1.6]);
  const pSet = prog(frame, ph[0].start, ph[0].len);
  const grow = lin(frame, ph[1].start, ph[1].len);
  const pScreen = prog(frame, ph[2].start, ph[2].len);
  const travel = frame * 2.2;
  const maxR = (screenX - barrierX) * 1.05 * grow;
  const rings = (src: V, color: string) => {
    const out: React.ReactNode[] = [];
    for (let k = 0; k < 40; k++) {
      const rad = ((travel % lam) + k * lam);
      if (rad > maxR) break;
      const fade = 1 - rad / ((screenX - barrierX) * 1.15);
      out.push(<path key={k} d={`M${src.x},${src.y - rad} A${rad},${rad} 0 0 1 ${src.x},${src.y + rad}`} stroke={color} strokeWidth={2} fill="none" opacity={0.55 * clamp(fade, 0, 1)} />);
    }
    return out;
  };
  // intensity on screen
  const L = screenX - barrierX;
  const bars: React.ReactNode[] = [];
  for (let y = 0; y < box.h; y += 3) {
    const r1 = Math.hypot(L, y - S1.y), r2 = Math.hypot(L, y - S2.y);
    const I = Math.pow(Math.cos((Math.PI * (r1 - r2)) / lam), 2);
    bars.push(<rect key={y} x={screenX + 4} y={y} width={46} height={3} fill={C.light} opacity={I * pScreen} />);
  }
  const fringe = (lam * L) / dsep;
  return (
    <svg width={box.w} height={box.h}>
      <defs><clipPath id="if-clip"><rect x={barrierX} y={0} width={screenX - barrierX} height={box.h} /></clipPath></defs>
      {/* incoming plane waves */}
      {Array.from({ length: 6 }).map((_, k) => {
        const x = barrierX - ((travel % lam) + k * lam);
        return x > 10 ? <line key={k} x1={x} x2={x} y1={cy - 170} y2={cy + 170} stroke={C.light} strokeWidth={2} opacity={0.4 * pSet} /> : null;
      })}
      <g clipPath="url(#if-clip)">{rings(S1, C.light)}{rings(S2, C.light)}</g>
      <g opacity={pSet}>
        <rect x={barrierX - 6} y={0} width={12} height={S1.y - 10} fill={C.muted} />
        <rect x={barrierX - 6} y={S1.y + 10} width={12} height={S2.y - S1.y - 20} fill={C.muted} />
        <rect x={barrierX - 6} y={S2.y + 10} width={12} height={box.h - S2.y - 10} fill={C.muted} />
        <Label x={barrierX - 20} y={S1.y} anchor="end" size={22} color={C.muted}>S₁</Label>
        <Label x={barrierX - 20} y={S2.y} anchor="end" size={22} color={C.muted}>S₂</Label>
        <rect x={screenX} y={0} width={4} height={box.h} fill={C.hairStrong} />
        <Label x={screenX + 28} y={box.h - 8} size={22} color={C.muted} baseline="auto">screen</Label>
      </g>
      {bars}
      {pScreen > 0.6 ? (
        <g opacity={prog(frame, ph[2].start + ph[2].len * 0.6, 14)}>
          <Arrow from={{ x: screenX - 30, y: cy }} to={{ x: screenX - 30, y: cy - fringe }} color={C.ink} width={2.5} head={12} />
          <Arrow from={{ x: screenX - 30, y: cy - fringe }} to={{ x: screenX - 30, y: cy }} color={C.ink} width={2.5} head={12} />
          <Label x={screenX - 46} y={cy - fringe / 2} anchor="end" size={26} color={C.ink} italic>β = λD/d</Label>
        </g>
      ) : null}
    </svg>
  );
};

export { enter };
