import React from "react";
import { useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { clamp, easeInOut, lerp, phases, prog } from "../lib/anim";
import { SceneProps } from "../types";

/*
 * Two zoom-in views of chemical bonds.
 *   BondOrbitals: a bond drawn as a line, then the camera dives into it: nuclei, the σ cloud
 *                 between them, π lobes that merge side-on, the shared electrons, and finally
 *                 the bond breaking evenly (radicals) or unevenly (ions).
 *   Aromatic:     benzene drawn as a Kekulé structure, curly arrows push the π bonds round
 *                 the ring, the bonds even out into a circle, and the ring tilts to show the
 *                 p orbitals merging into the two π-electron rings above and below it.
 */

type Pt = { x: number; y: number };
const INK: Record<string, string> = {
  C: "#E8EBF0", H: "#A9B2BF", O: "#FF8F87", N: "#86BEFF", F: "#7EDC9F", Cl: "#7EDC9F", Br: "#F0A07A", I: "#C4A8FF", S: "#FFD66B", P: "#FFB46B",
};
const inkOf = (el: string) => INK[el] || C.ink;
const BOND = "#C9D0DA";
const SIGMA = C.blue, PI = C.orange, PI2 = C.teal;

/** "NO2" -> N O ₂ : digits drop to subscripts like a printed formula. */
const Formula: React.FC<{ text: string; size: number }> = ({ text, size }) => (
  <>
    {text.split(/(\d+)/).filter(Boolean).map((part, i) => /\d/.test(part)
      ? <tspan key={i} fontSize={size * 0.62} dy={size * 0.22}>{part}</tspan>
      : <tspan key={i} dy={i ? -size * 0.22 : 0}>{part}</tspan>)}
  </>
);

/** Soft glowing cloud: an ellipse filled with a radial falloff. */
const Cloud: React.FC<{ id: string; cx: number; cy: number; rx: number; ry: number; color: string; opacity?: number; rot?: number }> =
  ({ id, cx, cy, rx, ry, color, opacity = 1, rot = 0 }) => opacity <= 0.01 || rx <= 0.5 || ry <= 0.5 ? null : (
    <g opacity={opacity} transform={`rotate(${rot},${cx},${cy})`}>
      <defs>
        <radialGradient id={id}>
          <stop offset="0%" stopColor={color} stopOpacity={0.55} />
          <stop offset="65%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id})`} />
      <ellipse cx={cx} cy={cy} rx={rx * 0.86} ry={ry * 0.86} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1.5} />
    </g>
  );

const Electron: React.FC<{ x: number; y: number; color?: string; opacity?: number; r?: number }> = ({ x, y, color = "#FFFFFF", opacity = 1, r = 6 }) =>
  opacity <= 0.01 ? null : (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={r * 2.3} fill={color} opacity={0.18} />
      <circle cx={x} cy={y} r={r} fill={color} />
    </g>
  );

/** Curly arrow (cubic) with a full head (pair) or a half head (single electron). */
const Curly: React.FC<{ a: Pt; c1: Pt; c2: Pt; b: Pt; p: number; color: string; single?: boolean; flip?: number; opacity?: number }> =
  ({ a, c1, c2, b, p, color, single, flip = 1, opacity = 1 }) => {
    if (p <= 0 || opacity <= 0.01) return null;
    const d = `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
    const tx = b.x - c2.x, ty = b.y - c2.y, L = Math.hypot(tx, ty) || 1, t = { x: tx / L, y: ty / L }, n = { x: -t.y, y: t.x };
    const H = 20, W = 9, base = { x: b.x - t.x * H, y: b.y - t.y * H };
    const head = single
      ? `M${b.x},${b.y} L${base.x + n.x * W * flip},${base.y + n.y * W * flip} L${base.x + t.x * 4},${base.y + t.y * 4} Z`
      : `M${b.x},${b.y} L${base.x + n.x * W},${base.y + n.y * W} L${base.x + t.x * 5},${base.y + t.y * 5} L${base.x - n.x * W},${base.y - n.y * W} Z`;
    return (
      <g opacity={opacity}>
        <path d={d} fill="none" stroke={color} strokeWidth={8} strokeOpacity={0.18} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
        <path d={d} fill="none" stroke={color} strokeWidth={3.6} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
        <path d={head} fill={color} opacity={clamp((p - 0.88) / 0.12, 0, 1)} />
      </g>
    );
  };

/** A label/value list on the right that fills in as the scene explains the bond. */
const Panel: React.FC<{ x: number; y: number; w: number; title: string; rows: { k: string; v: string; on: number; color?: string }[]; extra?: React.ReactNode; on: number }> =
  ({ x, y, w, title, rows, extra, on }) => (
    <g transform={`translate(${x},${y + (1 - on) * 16})`} opacity={on}>
      <text x={0} y={0} fontSize={34} fontFamily={F.serif} fill={C.ink}>{title}</text>
      <line x1={0} y1={22} x2={w} y2={22} stroke={C.hair} strokeWidth={1.5} />
      {rows.map((r, i) => (
        <g key={i} opacity={r.on} transform={`translate(${(1 - r.on) * 14},${62 + i * 54})`}>
          <text x={0} y={0} fontSize={24} fontFamily={F.sans} fill={C.muted}>{r.k}</text>
          <text x={w} y={0} textAnchor="end" fontSize={27} fontFamily={F.mono} fill={r.color || C.ink}>{r.v}</text>
        </g>
      ))}
      {extra}
    </g>
  );

// ============================================================ bond orbitals
// typical bond lengths (pm) and mean bond enthalpies (kJ/mol), by order
const BONDS: Record<string, [number, number][]> = {
  "C-C": [[154, 348], [134, 614], [120, 839]], "C-O": [[143, 358], [120, 799], [113, 1072]],
  "C-N": [[147, 293], [129, 615], [116, 891]], "N-N": [[145, 163], [125, 418], [110, 945]],
  "O-O": [[148, 146], [121, 498]], "H-H": [[74, 436]], "C-H": [[109, 413]], "H-O": [[96, 463]], "H-N": [[101, 391]],
  "Cl-H": [[127, 431]], "Cl-Cl": [[199, 242]], "Br-Br": [[228, 193]], "Br-H": [[141, 366]], "C-Cl": [[177, 339]],
  "C-Br": [[194, 285]], "F-F": [[142, 159]], "F-H": [[92, 567]], "H-I": [[161, 298]], "I-I": [[267, 151]], "C-F": [[135, 485]],
  "C-I": [[214, 213]], "C-S": [[182, 272]], "H-S": [[134, 363]], "N-O": [[136, 201], [115, 607]],
};
const bondData = (a: string, b: string, order: number) => {
  const row = BONDS[[a, b].sort().join("-")];
  if (!row) return null;
  return row[Math.min(row.length, Math.max(1, order)) - 1];
};
const ORDER_NAME = ["single", "double", "triple"];

export const BondOrbitals: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const A: string = s.atom_a || "C", B: string = s.atom_b || "C";
  const hasH = A === "H" || B === "H";
  const maxOrder = hasH ? 1 : Math.max(1, (BONDS[[A, B].sort().join("-")] || [[0, 0]]).length);
  const ord = clamp(Number(s.order) || 1, 1, Math.min(3, maxOrder)); // fractional while a beat changes it
  const orderI = Math.round(ord);

  // when (if ever) the bond breaks: at the beat that asks for it, else near the end of the build-up
  const beats = (s.beats || []) as { at: number; set: Record<string, any> }[];
  const firstBreak = beats.find((b) => b.set && b.set.breaking && b.set.breaking !== "none");
  const baseBreak = (s.__states?.[0]?.breaking ?? s.breaking ?? "none") as string;
  const breakKind: string = baseBreak !== "none" ? baseBreak : firstBreak ? firstBreak.set.breaking : "none";
  const breakAt = baseBreak !== "none" ? Math.round(dur * 0.6) : firstBreak ? firstBreak.at : Infinity;
  const pb = clamp((frame - breakAt) / 90, 0, 1);
  const pbArrow = clamp(pb / 0.35, 0, 1), pbMove = easeInOut(clamp((pb - 0.32) / 0.6, 0, 1));
  const introEnd = baseBreak !== "none" ? breakAt : dur;

  const ph = phases(introEnd, [0.8, 1.1, 1.1, maxOrder > 1 ? 1.3 : 0.4, 0.9]);
  const pLine = prog(frame, ph[0].start, ph[0].len);
  const pZoom = easeInOut(clamp((frame - ph[1].start) / ph[1].len, 0, 1));
  const pSigma = prog(frame, ph[2].start, ph[2].len);
  const pPi = easeInOut(clamp((frame - ph[3].start) / ph[3].len, 0, 1));
  const pRead = prog(frame, ph[4].start, ph[4].len);

  const data = bondData(A, B, orderI);
  const lenPm = data ? lerp((bondData(A, B, Math.floor(ord)) || data)[0], (bondData(A, B, Math.ceil(ord)) || data)[0], ord - Math.floor(ord)) : 150;
  const energy = data ? lerp((bondData(A, B, Math.floor(ord)) || data)[1], (bondData(A, B, Math.ceil(ord)) || data)[1], ord - Math.floor(ord)) : 0;

  const cx = box.w * 0.36, cy = box.h / 2 + 10;
  // structural view: a short bond; zoomed view: nuclei far apart so the clouds have room
  const half = lerp(80, clamp(lenPm * 1.45, 125, 270), pZoom) + 150 * pbMove;
  const ax = cx - half, bx = cx + half;
  const piOn = (k: number) => clamp(ord - k, 0, 1) * (1 - clamp(pb / 0.3, 0, 1));

  // ------------------------------------------------ structural formula (fades as we zoom)
  const struct = (1 - pZoom) * pLine;
  const gap = 14;
  const lineEls = Array.from({ length: orderI }).map((_, i) => {
    const o = (i - (orderI - 1) / 2) * gap;
    const x0 = ax + 30, x1 = bx - 30, m = (x0 + x1) / 2;
    return <line key={i} x1={lerp(m, x0, pLine)} y1={cy + o} x2={lerp(m, x1, pLine)} y2={cy + o} stroke={BOND} strokeWidth={5} strokeLinecap="round" />;
  });

  // ------------------------------------------------ zoomed view
  const zoomOn = pZoom;
  const t = frame / 30;
  const sigmaRx = half + 80 * (1 - pbMove), sigmaRy = 76;
  const els: React.ReactNode[] = [];
  // back π (perpendicular one, drawn in perspective behind)
  const zDir = { x: 0.5, y: -0.42 };
  const pi2 = piOn(2);
  const mergeOf = (k: number) => clamp((pPi - 0.35) / 0.55, 0, 1) * (k === 2 ? clamp((ord - 2) * 1.5, 0, 1) : 1);
  const lobes = (sign: number, color: string, op: number, merge: number, axis: Pt, tag: string, ry: number) => {
    if (op <= 0.01) return null;
    const off = 94, out: React.ReactNode[] = [];
    // two p lobes (one on each nucleus) that widen and join into one sausage-shaped π cloud
    for (const [nx, j] of [[ax, 0], [bx, 1]] as const) {
      const x = lerp(nx, lerp(nx, cx, 0.5), merge), rx = lerp(30, half * 0.5 + 40, merge);
      out.push(<Cloud key={`${tag}${j}`} id={`${tag}${j}`} cx={x + axis.x * off * sign} cy={cy + axis.y * off * sign} rx={rx} ry={ry} color={color} opacity={op}
        rot={Math.atan2(axis.y, axis.x) * 180 / Math.PI + 90} />);
    }
    return out;
  };
  if (zoomOn > 0.01) {
    els.push(<g key="pi2back" opacity={zoomOn}>{lobes(-1, PI2, pi2 * 0.55, mergeOf(2), zDir, "p2b", 36)}</g>);
    // σ cloud between the nuclei; on breaking it pinches into one cloud per atom (or slides onto B)
    const hetero = breakKind === "heterolytic";
    if (pbMove < 1) {
      els.push(<Cloud key="sig" id="sig" cx={hetero ? lerp(cx, bx, pbMove) : cx} cy={cy} rx={sigmaRx * (1 - 0.5 * pbMove)} ry={sigmaRy * (1 - 0.25 * pbMove)} color={SIGMA}
        opacity={zoomOn * pSigma * (1 - pbMove)} />);
    }
    if (pbMove > 0) {
      const atomCloud = (x: number, k: string, op: number) => <Cloud key={k} id={k} cx={x} cy={cy} rx={76} ry={72} color={SIGMA} opacity={op} />;
      if (hetero) els.push(atomCloud(bx, "cb", pbMove));
      else { els.push(atomCloud(ax, "ca", pbMove)); els.push(atomCloud(bx, "cb", pbMove)); }
    }
    els.push(<g key="pi1" opacity={zoomOn}>{lobes(1, PI, piOn(1), mergeOf(1), { x: 0, y: -1 }, "p1u", 42)}{lobes(-1, PI, piOn(1), mergeOf(1), { x: 0, y: -1 }, "p1d", 42)}</g>);
    // nuclei
    for (const [x, el, k] of [[ax, A, "A"], [bx, B, "B"]] as const) {
      els.push(
        <g key={`n${k}`} opacity={zoomOn}>
          <circle cx={x} cy={cy} r={26} fill={C.bg} stroke={inkOf(el)} strokeWidth={2.5} />
          <text x={x} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontSize={el.length > 1 ? 22 : 27} fontWeight={700} fill={inkOf(el)} fontFamily={F.sans}>{el}</text>
        </g>);
    }
    // electrons: two in σ, two in each π bond
    const eOp = zoomOn * pSigma;
    const sigE = [0, 1].map((i) => {
      const a = t * 2.1 + i * Math.PI;
      if (pbMove > 0) {
        const to = hetero ? bx : i ? bx : ax, from = { x: cx + Math.cos(a) * half * 0.55, y: cy + Math.sin(a * 1.3) * 22 };
        const home = { x: to + Math.cos(a * 1.6) * 34, y: cy + Math.sin(a * 1.6) * 30 };
        return <Electron key={`se${i}`} x={lerp(from.x, home.x, pbMove)} y={lerp(from.y, home.y, pbMove)} opacity={eOp} />;
      }
      return <Electron key={`se${i}`} x={cx + Math.cos(a) * half * 0.55} y={cy + Math.sin(a * 1.3) * 22} opacity={eOp} />;
    });
    els.push(...sigE);
    for (const sign of [-1, 1]) {
      const op = zoomOn * piOn(1) * clamp((pPi - 0.6) / 0.3, 0, 1);
      const a = t * 1.7 + (sign > 0 ? 0 : Math.PI);
      els.push(<Electron key={`pe${sign}`} x={cx + Math.cos(a) * half * 0.6} y={cy + sign * 94 + Math.sin(a * 2) * 12} color="#FFE2C4" opacity={op} />);
    }
    els.push(<g key="pi2front" opacity={zoomOn}>{lobes(1, PI2, pi2 * 0.85, mergeOf(2), zDir, "p2f", 36)}</g>);
    for (const sign of [-1, 1]) {
      const op = zoomOn * pi2 * clamp((pPi - 0.7) / 0.3, 0, 1);
      const a = t * 1.5 + (sign > 0 ? 1 : 1 + Math.PI);
      els.push(<Electron key={`pz${sign}`} x={cx + Math.cos(a) * half * 0.5 + zDir.x * 94 * sign} y={cy + zDir.y * 94 * sign} color="#C6F4F6" opacity={op} />);
    }
    // labels on the clouds
    const lab = (x: number, y: number, text: string, color: string, op: number, key: string) =>
      op > 0.01 ? <text key={key} x={x} y={y} textAnchor="middle" fontSize={32} fontFamily={F.serif} fontStyle="italic" fill={color} opacity={op}>{text}</text> : null;
    els.push(lab(cx, cy + sigmaRy + 44, "σ", "#A8D2FF", zoomOn * pSigma * (1 - pbMove), "ls"));
    els.push(lab(cx + half + 80, cy - 110, "π", "#FFC796", zoomOn * piOn(1) * clamp((pPi - 0.5) / 0.3, 0, 1), "lp"));
    els.push(lab(cx + zDir.x * 140 + half * 0.5 + 40, cy + zDir.y * 140, "π", "#9CE6EA", zoomOn * pi2 * clamp((pPi - 0.7) / 0.3, 0, 1), "lp2"));
  }

  // ------------------------------------------------ breaking: arrows, then radicals or ions
  const brk: React.ReactNode[] = [];
  if (pb > 0 && breakKind !== "none") {
    const fade = 1 - clamp((pb - 0.75) / 0.2, 0, 1);
    const m = { x: cx, y: cy - sigmaRy * 0.2 };
    if (breakKind === "homolytic") {
      for (const [x, flip] of [[ax, -1], [bx, 1]] as const) {
        const to = { x: x + (x < cx ? 10 : -10), y: cy - 34 };
        brk.push(<Curly key={`h${x}`} a={{ x: m.x + (x < cx ? -8 : 8), y: m.y - 30 }} c1={{ x: m.x + (x < cx ? -20 : 20), y: m.y - 150 }} c2={{ x: to.x, y: to.y - 120 }} b={to}
          p={pbArrow} color={C.teal} single flip={flip} opacity={fade} />);
      }
    } else {
      const to = { x: bx - 6, y: cy - 36 };
      brk.push(<Curly key="het" a={{ x: m.x, y: m.y - 30 }} c1={{ x: m.x, y: m.y - 170 }} c2={{ x: to.x, y: to.y - 130 }} b={to} p={pbArrow} color={C.light} opacity={fade} />);
    }
    const res = clamp((pbMove - 0.6) / 0.4, 0, 1);
    const tag = (x: number, text: string, color: string) =>
      <text key={`t${x}`} x={x} y={cy + 130} textAnchor="middle" fontSize={28} fontFamily={F.sans} fontWeight={600} fill={color} opacity={res}>{text}</text>;
    if (breakKind === "homolytic") { brk.push(tag(ax, `${A}•`, C.teal)); brk.push(tag(bx, `•${B}`, C.teal)); }
    else { brk.push(tag(ax, `${A}⁺`, "#FF9A92")); brk.push(tag(bx, `${B}⁻`, "#8EC5FF")); }
  }

  // ------------------------------------------------ readout
  const name = `${A}${["–", "=", "≡"][orderI - 1]}${B} ${ORDER_NAME[orderI - 1]} bond`;
  const comp = orderI === 1 ? "1 σ" : `1 σ + ${orderI - 1} π`;
  const rowOn = (i: number) => clamp((frame - ph[4].start - i * 8) / 14, 0, 1);
  const broken = breakKind !== "none" && pbMove > 0.6;
  const rows = [
    { k: "made of", v: comp, on: rowOn(0) },
    { k: "shared electrons", v: `${orderI * 2}`, on: rowOn(1) },
    ...(data ? [{ k: "length", v: `${Math.round(lenPm)} pm`, on: rowOn(2) }, { k: "energy to break", v: `${Math.round(energy)} kJ/mol`, on: rowOn(3), color: C.light }] : []),
    ...(breakKind !== "none" ? [{ k: breakKind === "homolytic" ? "even split" : "uneven split", v: breakKind === "homolytic" ? "2 radicals" : "2 ions",
      on: clamp((pbMove - 0.6) / 0.3, 0, 1), color: breakKind === "homolytic" ? C.teal : C.light }] : []),
  ];
  const barW = 420, frac = clamp(energy / 1100, 0, 1);
  const bar = data ? (
    <g transform={`translate(0, ${62 + rows.length * 54})`} opacity={rowOn(4)}>
      <rect x={0} y={0} width={barW} height={10} rx={5} fill={C.hair} />
      <rect x={0} y={0} width={barW * frac * rowOn(4)} height={10} rx={5} fill={C.light} />
      <text x={0} y={40} fontSize={20} fontFamily={F.sans} fill={C.faint}>{"stronger bonds are shorter"}</text>
    </g>
  ) : null;

  return (
    <svg width={box.w} height={box.h} style={{ overflow: "visible" }}>
      <g opacity={struct}>
        {lineEls}
        {[[ax, A], [bx, B]].map(([x, el]) => (
          <text key={String(x)} x={x as number} y={cy + 2} textAnchor="middle" dominantBaseline="central" fontSize={46} fontWeight={600} fill={inkOf(el as string)} fontFamily={F.sans}>{el}</text>
        ))}
      </g>
      {els}
      {brk}
      <Panel x={box.w * 0.66} y={110} w={barW} title={broken ? `${A}–${B} broken` : name} rows={rows} extra={bar} on={pRead} />
    </svg>
  );
};

// ============================================================ benzene
const SUBST = ["none", "CH3", "OH", "NH2", "Cl", "Br", "NO2", "CHO", "COOH"];
const SUB_INK: Record<string, string> = { H: "H", CH3: "C", OH: "O", NH2: "N", Cl: "Cl", Br: "Br", NO2: "N", CHO: "O", COOH: "O" };
const SUBST_NAME: Record<string, string> = {
  none: "benzene", CH3: "methylbenzene (toluene)", OH: "phenol", NH2: "aniline", Cl: "chlorobenzene", Br: "bromobenzene",
  NO2: "nitrobenzene", CHO: "benzaldehyde", COOH: "benzoic acid",
};

export const Aromatic: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const sub = SUBST.includes(s.substituent) ? (s.substituent as string) : "none";
  // orbitals are on from the start or switched by a beat; either way they ease in, never jump
  const st0 = (s.__states?.[0] ?? s) as Record<string, any>;
  const baseOrb = st0.show_orbitals !== false;
  const ph = phases(dur, [1, 1.7, 1, baseOrb ? 2 : 0.01, 0.6]);
  let orbP = baseOrb ? clamp((frame - ph[3].start) / (ph[3].len * 0.85), 0, 1) : 0;
  for (const b of (s.beats || []) as { at: number; set: Record<string, any> }[]) {
    if (frame < b.at || b.set?.show_orbitals === undefined) continue;
    orbP = lerp(orbP, b.set.show_orbitals ? 1 : 0, clamp((frame - b.at) / 70, 0, 1));
  }
  const pDraw = clamp((frame - ph[0].start) / ph[0].len, 0, 1);
  const pRes = clamp((frame - ph[1].start) / ph[1].len, 0, 1);
  const pDeloc = easeInOut(clamp((frame - ph[2].start) / ph[2].len, 0, 1));
  const pTilt = easeInOut(clamp(orbP / 0.5, 0, 1));
  const pMerge = easeInOut(clamp((orbP - 0.5) / 0.5, 0, 1));
  const pRead = prog(frame, ph[2].start + ph[2].len * 0.4, 30);

  const cx = box.w * 0.34, cy = box.h / 2 + 10, R = 180;
  const phi = (68 * Math.PI / 180) * pTilt, cphi = Math.cos(phi), sphi = Math.sin(phi);
  // 3D: ring in the X-Y plane, orbitals along Z; tilting about the horizontal axis
  const P3 = (X: number, Y: number, Z: number): Pt => ({ x: cx + X, y: cy + Y * cphi - Z * sphi });
  const ang = (i: number) => -Math.PI / 2 + (i * Math.PI) / 3;
  const V = Array.from({ length: 6 }, (_, i) => ({ X: R * Math.cos(ang(i)), Y: R * Math.sin(ang(i)) }));
  const vp = V.map((v) => P3(v.X, v.Y, 0));

  // edges: 6 single lines drawn one after another
  const edgeEls = V.map((_, i) => {
    const a = vp[i], b = vp[(i + 1) % 6], e = clamp(pDraw * 7 - i, 0, 1);
    if (e <= 0) return null;
    return <line key={`e${i}`} x1={a.x} y1={a.y} x2={lerp(a.x, b.x, e)} y2={lerp(a.y, b.y, e)} stroke={BOND} strokeWidth={5} strokeLinecap="round" />;
  });
  // substituents: H on every carbon, the chosen group on carbon 0
  const hOn = clamp(pDraw * 3 - 1.6, 0, 1);
  const subEls = V.map((v, i) => {
    const u = { x: Math.cos(ang(i)), y: Math.sin(ang(i)) };
    const label = i === 0 && sub !== "none" ? sub : "H";
    const isH = label === "H";
    const a = P3(v.X + u.x * 14, v.Y + u.y * 14, 0), b = P3(v.X + u.x * (isH ? 62 : 70), v.Y + u.y * (isH ? 62 : 70), 0);
    const tp = P3(v.X + u.x * (isH ? 86 : 108), v.Y + u.y * (isH ? 86 : 108), 0);
    const col = inkOf(SUB_INK[label] || "H");
    return (
      <g key={`h${i}`} opacity={hOn}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BOND} strokeWidth={4} strokeLinecap="round" />
        <text x={tp.x} y={tp.y} textAnchor="middle" dominantBaseline="central" fontSize={isH ? 30 : 34} fontWeight={600} fill={col} fontFamily={F.sans}>
          <Formula text={label} size={isH ? 30 : 34} />
        </text>
      </g>);
  });

  // Kekulé double bonds: inner lines on edges 0, 2, 4; resonance glides them to 1, 3, 5
  const glide = easeInOut(clamp((pRes - 0.4) / 0.4, 0, 1));
  const arrowsP = clamp(pRes / 0.35, 0, 1), arrowsFade = 1 - clamp((pRes - 0.78) / 0.15, 0, 1);
  const innerOn = clamp((pDraw - 0.55) / 0.3, 0, 1) * (1 - pDeloc);
  const inner = (e: number) => {
    // edge index may be fractional: positions slide around the ring
    const i0 = Math.floor(e) % 6, f = e - Math.floor(e);
    const seg = (i: number) => {
      const a = V[i % 6], b = V[(i + 1) % 6];
      const pa = { X: lerp(a.X, b.X, 0.18) * 0.86, Y: lerp(a.Y, b.Y, 0.18) * 0.86 }, pb = { X: lerp(a.X, b.X, 0.82) * 0.86, Y: lerp(a.Y, b.Y, 0.82) * 0.86 };
      return [pa, pb];
    };
    const [a0, b0] = seg(i0), [a1, b1] = seg(i0 + 1);
    const A = { X: lerp(a0.X, a1.X, f), Y: lerp(a0.Y, a1.Y, f) }, B = { X: lerp(b0.X, b1.X, f), Y: lerp(b0.Y, b1.Y, f) };
    return [P3(A.X, A.Y, 0), P3(B.X, B.Y, 0)];
  };
  const innerEls = innerOn > 0.01 ? [0, 2, 4].map((e) => {
    const [a, b] = inner(e + glide);
    return <line key={`i${e}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BOND} strokeWidth={5} strokeLinecap="round" opacity={innerOn} />;
  }) : null;
  // three curly arrows: each π pair moves onto the next C–C bond
  const arrowEls = pRes > 0 && arrowsFade > 0 ? [0, 2, 4].map((e, j) => {
    const [a, b] = inner(e), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const [c, d] = inner(e + 1), m2 = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };
    const pull = (p: Pt, k: number) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k });
    return <Curly key={`c${j}`} a={pull(m, 0.92)} c1={pull(m, 0.55)} c2={pull(m2, 0.55)} b={pull(m2, 0.9)} p={clamp(arrowsP * 1.3 - j * 0.15, 0, 1)} color={C.light}
      opacity={arrowsFade * (1 - glide * 0.6)} />;
  }) : null;
  // delocalised ring
  const ringP = pDeloc;
  const circle = ringP > 0.01 ? (
    <ellipse cx={cx} cy={cy} rx={R * 0.6} ry={R * 0.6 * cphi} fill="none" stroke={C.light} strokeWidth={5} strokeLinecap="round"
      pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ringP} opacity={0.9 * (1 - 0.65 * pMerge)} />
  ) : null;

  // p orbitals and π-electron rings (only once tilted)
  const L = 92;
  const orb = (side: number) => {
    if (pTilt <= 0.01) return null;
    const out: React.ReactNode[] = [];
    const lobeOp = pTilt * (1 - pMerge * 0.85);
    const color = side > 0 ? PI : SIGMA;
    V.forEach((v, i) => {
      const c = P3(v.X, v.Y, side * L * 0.62);
      out.push(<Cloud key={`l${side}${i}`} id={`lobe${side}${i}`} cx={c.x} cy={c.y} rx={30} ry={30 + 26 * sphi} color={color} opacity={lobeOp} />);
    });
    if (pMerge > 0.01) {
      const c = P3(0, 0, side * L * 0.62);
      out.push(
        <ellipse key={`t${side}`} cx={c.x} cy={c.y} rx={R} ry={R * cphi} fill="none" stroke={color} strokeOpacity={0.4 * pMerge} strokeWidth={44} />,
        <ellipse key={`t2${side}`} cx={c.x} cy={c.y} rx={R} ry={R * cphi} fill="none" stroke={color} strokeOpacity={0.75 * pMerge} strokeWidth={2} />);
      // three electrons circulate in each ring
      for (let k = 0; k < 3; k++) {
        const a = frame * 0.035 * side + k * (2 * Math.PI) / 3 + (side > 0 ? 0 : 0.5);
        const e = P3(R * Math.cos(a), R * Math.sin(a), side * L * 0.62);
        out.push(<Electron key={`ee${side}${k}`} x={e.x} y={e.y} color={side > 0 ? "#FFE2C4" : "#D4E9FF"} opacity={pMerge} r={5.5} />);
      }
    }
    return out;
  };
  const piLabel = pMerge > 0.3 ? (
    <g opacity={clamp((pMerge - 0.3) / 0.4, 0, 1)} fontFamily={F.serif} fontStyle="italic" fontSize={28}>
      <text x={cx + R + 110} y={P3(0, 0, L * 0.62).y} fill="#FFC796">π cloud above</text>
      <text x={cx + R + 110} y={P3(0, 0, -L * 0.62).y + 10} fill="#A8D2FF">π cloud below</text>
    </g>
  ) : null;

  const name = SUBST_NAME[sub];
  const rowOn = (i: number) => clamp((frame - ph[2].start - ph[2].len * 0.4 - i * 10) / 14, 0, 1);
  const rows = [
    { k: "π electrons", v: "6", on: rowOn(0), color: C.light },
    { k: "Hückel 4n + 2", v: "n = 1", on: rowOn(1) },
    { k: "every C–C bond", v: "139 pm", on: rowOn(2) },
    { k: "single · double", v: "154 · 134 pm", on: rowOn(3), color: C.muted },
    { k: "ring angles", v: "120°", on: rowOn(4) },
  ];
  return (
    <svg width={box.w} height={box.h} style={{ overflow: "visible" }}>
      <g>{orb(-1)}</g>
      {subEls}
      {edgeEls}
      {innerEls}
      {circle}
      {arrowEls}
      <g>{orb(1)}</g>
      {piLabel}
      {pRes > 0.05 && pDeloc < 0.99 ? (
        <text x={cx} y={cy + R + 128} textAnchor="middle" fontSize={24} fontFamily={F.sans} fill={C.muted} opacity={clamp(pRes / 0.2, 0, 1) * (1 - pDeloc)}>
          {glide < 0.5 ? "the π electrons can shift round the ring…" : "…so neither Kekulé structure is the real one"}
        </text>
      ) : null}
      <Panel x={box.w * 0.66} y={110} w={420} title={name.charAt(0).toUpperCase() + name.slice(1)} rows={rows} on={pRead} />
    </svg>
  );
};
