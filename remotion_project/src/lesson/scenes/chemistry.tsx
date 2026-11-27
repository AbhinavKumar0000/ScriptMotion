import React from "react";
import { useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { clamp, enter, fmt, lin, phases, prog, stagger } from "../lib/anim";
import { SceneProps } from "../types";
import { Arrow, Label, Pt, Tex } from "../ui/svg";
import { E0, ION_CHARGE, MASS, NAMES, SYMBOLS, position, shells, valenceElectrons, valency, zOf } from "../lib/elements";
import { Readout } from "./mechanics";

const card: React.CSSProperties = { background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 14 };

const Electron: React.FC<{ x: number; y: number; color?: string; r?: number; opacity?: number }> = ({ x, y, color = C.blue, r = 9, opacity = 1 }) => (
  <g opacity={opacity}><circle cx={x} cy={y} r={r * 1.8} fill={color} opacity={0.15} /><circle cx={x} cy={y} r={r} fill={color} /></g>
);

// ==================================================================== atom
export const Atom: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const z = s.z || zOf(s.element);
  const sh = shells(z);
  const A = MASS[z - 1] || 2 * z;
  const cx = box.w * 0.42, cy = box.h / 2;
  const r0 = 56, gap = Math.min(70, (box.h / 2 - r0 - 20) / Math.max(1, sh.length));
  const ph = phases(dur, [0.8, ...sh.map(() => 1), 1]);
  const pN = prog(frame, ph[0].start, ph[0].len);
  const spin = frame * 0.006;
  const val = valenceElectrons(z);
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="nucleus" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#E07A72" /><stop offset="100%" stopColor="#8E3B36" />
          </radialGradient>
        </defs>
        <g opacity={pN} transform={`translate(${cx},${cy}) scale(${0.7 + 0.3 * pN})`}>
          <circle r={r0 * 1.45} fill={C.red} opacity={0.08} />
          <circle r={r0} fill="url(#nucleus)" stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
        </g>
        <Label x={cx} y={cy + r0 + 36} size={22} color={C.muted} opacity={pN} mono>{`${z}p · ${A - z}n`}</Label>
        {sh.map((n, k) => {
          const R = r0 + 60 + gap * k;
          const p = prog(frame, ph[k + 1].start, ph[k + 1].len * 0.5);
          const outer = k === sh.length - 1;
          return (
            <g key={k}>
              <circle cx={cx} cy={cy} r={R} stroke={outer ? C.hairStrong : C.hair} strokeWidth={outer ? 2.5 : 2} fill="none" opacity={p} />
              <Label x={cx + R * Math.cos(-0.7)} y={cy + R * Math.sin(-0.7) - 4} size={20} color={C.faint} opacity={p}>{"KLMN"[k]}</Label>
              {Array.from({ length: n }).map((_, i) => {
                const appear = prog(frame, ph[k + 1].start + (ph[k + 1].len * 0.8 * i) / n, 10);
                const a = (2 * Math.PI * i) / n + spin * (1 + k * 0.35) + k * 0.4;
                return <Electron key={i} x={cx + Math.cos(a) * R} y={cy + Math.sin(a) * R} color={outer && frame > ph[ph.length - 1].start ? C.light : C.blue} opacity={appear} />;
              })}
            </g>
          );
        })}
        <Label x={cx} y={cy - 4} size={44} color={C.ink} weight={700} halo="transparent" opacity={pN}>{s.element}</Label>
      </svg>
      <Readout right p={prog(frame, ph[ph.length - 1].start, 16)} rows={[["Element", NAMES[z - 1] || s.element], ["Atomic number", `${z}`], ["Configuration", sh.join(", ")], ["Valence electrons", `${val}`], ["Valency", `${valency(z)}`]]} />
    </div>
  );
};

// ========================================================== periodic table
export const PeriodicTable: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const hl = new Set((s.highlight as string[]).map((x) => x.trim()));
  const cw = Math.min((box.w - 40) / 18, 88), ch = Math.min((box.h - 50) / 9.6, 64);
  const ox = (box.w - cw * 18) / 2, oy = 10;
  const ph = phases(dur, [1.4, 1.2, 1.6]);
  const pT = lin(frame, ph[0].start, ph[0].len);
  const pH = prog(frame, ph[1].start, ph[1].len);
  const pTr = prog(frame, ph[2].start, ph[2].len);
  const blockColor: Record<string, string> = { s: "rgba(240,112,106,0.22)", p: "rgba(90,169,240,0.2)", d: "rgba(95,203,142,0.2)", f: "rgba(169,139,250,0.22)" };
  const cells = SYMBOLS.map((sym, i) => {
    const z = i + 1;
    const pos = position(z);
    const y = oy + (pos.row - 1) * ch + (pos.row >= 8 ? ch * 0.45 : 0);
    const x = ox + (pos.col - 1) * cw;
    const isHl = hl.has(sym) || (s.highlight_group && pos.col === s.highlight_group && pos.row < 8) || (s.block !== "none" && pos.block === s.block);
    const reveal = clamp(pT * 1.6 - (pos.col + pos.row) / 30, 0, 1);
    const dim = (hl.size || s.highlight_group || s.block !== "none") && pH > 0 && !isHl;
    return (
      <g key={sym} opacity={reveal * (dim ? 1 - 0.55 * pH : 1)}>
        <rect x={x + 2} y={y + 2} width={cw - 4} height={ch - 4} rx={5}
          fill={isHl && pH > 0 ? (s.block !== "none" ? blockColor[pos.block] : "rgba(255,200,87,0.25)") : C.panel}
          stroke={isHl && pH > 0 ? C.light : C.hair} strokeWidth={isHl && pH > 0 ? 2 : 1} />
        <text x={x + 8} y={y + 18} fontSize={13} fill={C.faint} fontFamily={F.mono}>{z}</text>
        <text x={x + cw / 2} y={y + ch / 2 + 9} textAnchor="middle" fontSize={ch * 0.36} fontWeight={600} fill={C.ink} fontFamily={F.sans}>{sym}</text>
      </g>
    );
  });
  const trendDef: Record<string, { across: 1 | -1; down: 1 | -1; label: string }> = {
    atomic_radius: { across: -1, down: 1, label: "Atomic radius" },
    ionisation_energy: { across: 1, down: -1, label: "Ionisation energy" },
    electronegativity: { across: 1, down: -1, label: "Electronegativity" },
    metallic_character: { across: -1, down: 1, label: "Metallic character" },
  };
  const tr = trendDef[s.trend];
  return (
    <svg width={box.w} height={box.h}>
      {cells}
      <text x={ox + 2 * cw + cw / 2} y={oy + 5 * ch + ch / 2 + 6} textAnchor="middle" fontSize={14} fill={C.faint} fontFamily={F.mono} opacity={pT}>57–71</text>
      <text x={ox + 2 * cw + cw / 2} y={oy + 6 * ch + ch / 2 + 6} textAnchor="middle" fontSize={14} fill={C.faint} fontFamily={F.mono} opacity={pT}>89–103</text>
      {tr ? (
        <g opacity={pTr}>
          {/* across: empty row-1 gap (cols 3-16); down: rows 2-3 gap (cols 3-12) */}
          <Arrow from={{ x: tr.across > 0 ? ox + cw * 3 : ox + cw * 15.6, y: oy + ch * 0.62 }} to={{ x: tr.across > 0 ? ox + cw * 15.6 : ox + cw * 3, y: oy + ch * 0.62 }} p={pTr} color={C.light} width={4} head={18} />
          <Label x={ox + cw * 9.3} y={oy + ch * 0.2} size={22} color={C.light}>{`${tr.label} ${tr.across > 0 ? "increases" : "decreases"} across a period`}</Label>
          <Arrow from={{ x: ox + cw * 3.3, y: tr.down > 0 ? oy + ch * 1.15 : oy + ch * 2.85 }} to={{ x: ox + cw * 3.3, y: tr.down > 0 ? oy + ch * 2.85 : oy + ch * 1.15 }} p={pTr} color={C.teal} width={4} head={16} />
          <Label x={ox + cw * 3.75} y={oy + ch * 2} anchor="start" size={22} color={C.teal}>{`${tr.down > 0 ? "increases" : "decreases"} down a group`}</Label>
        </g>
      ) : null}
    </svg>
  );
};

// ================================================================= bonding
export const Bonding: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const za = zOf(s.atom_a), zb = zOf(s.atom_b);
  const va = valenceElectrons(za), vb = valenceElectrons(zb);
  const n = s.count_b;
  const ph = phases(dur, [1, 1.6, 1.4]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const pMove = prog(frame, ph[1].start, ph[1].len);
  const pRes = prog(frame, ph[2].start, ph[2].len);
  const cy = box.h / 2;
  const outerR = 92;
  const octet = (z: number) => (z <= 2 ? 2 : 8);

  if (s.kind === "ionic") {
    const outerR = n > 2 ? 92 : 124, coreR = n > 2 ? 48 : 62, symSize = n > 2 ? 34 : 44;
    const give = va; // metal gives its valence electrons
    const need = octet(zb) - vb;
    const ax = box.w * 0.22;
    const bpos = Array.from({ length: n }, (_, i) => ({ x: box.w * 0.68, y: n === 1 ? cy : cy - 150 + (300 * i) / (n - 1) }));
    const ringE = (c: Pt, count: number, color: string, offset = 0) => Array.from({ length: count }, (_, i) => {
      const a = offset + (2 * Math.PI * i) / Math.max(count, 1);
      return { x: c.x + Math.cos(a) * outerR, y: c.y + Math.sin(a) * outerR, color };
    });
    const moving = Array.from({ length: Math.min(give, need * n) }, (_, i) => {
      const target = bpos[i % n];
      const from = { x: ax + outerR, y: cy + (i - (give - 1) / 2) * 26 };
      const slot = vb + Math.floor(i / n);
      const a = Math.PI + (2 * Math.PI * slot) / 8;
      const to = { x: target.x + Math.cos(a) * outerR, y: target.y + Math.sin(a) * outerR };
      const p = clamp(pMove * 1.3 - i * 0.15, 0, 1);
      const arc = Math.sin(p * Math.PI) * -60;
      return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p + arc };
    });
    const ionA = `\\mathrm{${s.atom_a}}${give > 1 ? `^{${give}+}` : "^{+}"}`;
    const ionB = `\\mathrm{${s.atom_b}}${need > 1 ? `^{${need}-}` : "^{-}"}`;
    return (
      <svg width={box.w} height={box.h}>
        <g opacity={pIn}>
          <circle cx={ax} cy={cy} r={outerR} stroke={pRes > 0.5 ? C.hair : C.hairStrong} strokeWidth={2.5} fill="none" strokeDasharray={pRes > 0.5 ? "4 6" : undefined} />
          <circle cx={ax} cy={cy} r={coreR} fill={C.bgRaise} stroke={C.hairStrong} />
          <Label x={ax} y={cy} size={symSize} weight={700} color={C.ink} halo="transparent">{s.atom_a}</Label>
          {bpos.map((b, i) => (
            <g key={i}>
              <circle cx={b.x} cy={b.y} r={outerR} stroke={C.hairStrong} strokeWidth={2.5} fill="none" />
              <circle cx={b.x} cy={b.y} r={coreR} fill={C.bgRaise} stroke={C.hairStrong} />
              <Label x={b.x} y={b.y} size={symSize} weight={700} color={C.ink} halo="transparent">{s.atom_b}</Label>
              {ringE(b, vb, C.orange, Math.PI + Math.PI / 8).map((e, j) => <Electron key={j} x={e.x} y={e.y} color={C.orange} />)}
            </g>
          ))}
        </g>
        {moving.map((e, i) => <Electron key={i} x={e.x} y={e.y} color={C.blue} />)}
        <g opacity={pRes}>
          <foreignObject x={ax - 120} y={cy + outerR + 16} width={240} height={70}><div style={{ textAlign: "center" }}><Tex tex={ionA} size={44} color={C.blue} /></div></foreignObject>
          {bpos.map((b, i) => <foreignObject key={i} x={b.x + outerR + 10} y={b.y - 34} width={200} height={70}><div><Tex tex={ionB} size={44} color={C.orange} /></div></foreignObject>)}
          <Label x={box.w / 2} y={box.h - 20} size={26} color={C.ink} baseline="auto">{`Electrostatic attraction holds ${s.atom_a}${n > 1 ? s.atom_b + "₂" : s.atom_b} together`}</Label>
        </g>
      </svg>
    );
  }

  // covalent
  const targetB = octet(zb) - vb;
  const order = Math.max(1, Math.min(3, targetB, Math.floor((octet(za) - va) / n) || 1));
  const shared = order * n;
  const loneA = Math.max(0, va - shared);
  const bent = n === 2 && loneA > 0;
  const angles = n === 1 ? [0] : n === 2 ? (bent ? [Math.PI * 0.21, Math.PI * 0.79] : [0, Math.PI]) : n === 3 ? [Math.PI / 2, Math.PI * (7 / 6), Math.PI * (11 / 6)] : [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  const rA = 148, rB = zb <= 2 ? 104 : 128; // sized to fill the stage
  const dist = (rA + rB) * 0.72;
  const ac = { x: box.w / 2, y: n === 1 ? cy : bent ? cy - 70 : cy };
  const ax0 = n === 1 ? box.w / 2 - dist / 2 : ac.x;
  const A = { x: ax0, y: ac.y };
  const Bs = angles.map((a) => ({ x: A.x + Math.cos(a) * dist, y: A.y + Math.sin(a) * dist, a }));
  const approach = pMove;
  const sep = (1 - approach) * 90;
  const els: React.ReactNode[] = [];
  Bs.forEach((b, bi) => {
    const bx = b.x + Math.cos(b.a) * sep, by = b.y + Math.sin(b.a) * sep;
    const mid = { x: (A.x + bx) / 2, y: (A.y + by) / 2 };
    const perp = { x: -Math.sin(b.a), y: Math.cos(b.a) };
    for (let k = 0; k < order; k++) {
      const off = (k - (order - 1) / 2) * 34;
      const along = { x: Math.cos(b.a) * 11, y: Math.sin(b.a) * 11 };
      els.push(<Electron key={`a${bi}${k}`} x={mid.x + perp.x * off - along.x} y={mid.y + perp.y * off - along.y} color={C.blue} r={8} />);
      els.push(<Electron key={`b${bi}${k}`} x={mid.x + perp.x * off + along.x} y={mid.y + perp.y * off + along.y} color={C.orange} r={8} />);
    }
    const restB = vb - order;
    for (let k = 0; k < restB; k++) {
      const a = b.a + (k - (restB - 1) / 2) * 0.55;
      els.push(<Electron key={`rb${bi}${k}`} x={bx + Math.cos(a) * rB} y={by + Math.sin(a) * rB} color={C.orange} r={8} />);
    }
  });
  const freeAngles: number[] = [];
  const usedSet = angles.map((a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
  for (let k = 0; k < 16; k++) {
    const a = (2 * Math.PI * k) / 16;
    if (usedSet.every((u) => Math.abs(Math.atan2(Math.sin(a - u), Math.cos(a - u))) > 0.7)) freeAngles.push(a);
  }
  for (let k = 0; k < loneA; k++) {
    const pair = Math.floor(k / 2);
    const base = freeAngles[Math.floor(((pair + 0.5) * freeAngles.length) / Math.ceil(loneA / 2))] ?? (Math.PI * 1.5);
    const a = base + (k % 2 ? 0.16 : -0.16);
    els.push(<Electron key={`la${k}`} x={A.x + Math.cos(a) * rA} y={A.y + Math.sin(a) * rA} color={C.blue} r={8} />);
  }
  const bondName = order === 1 ? "single" : order === 2 ? "double" : "triple";
  return (
    <svg width={box.w} height={box.h}>
      <g opacity={pIn}>
        <circle cx={A.x} cy={A.y} r={rA} stroke={C.hairStrong} strokeWidth={2.5} fill="rgba(90,169,240,0.05)" />
        <Label x={A.x} y={A.y} size={40} weight={700} color={C.ink} halo="transparent">{s.atom_a}</Label>
        {Bs.map((b, i) => {
          const bx = b.x + Math.cos(b.a) * sep, by = b.y + Math.sin(b.a) * sep;
          return (
            <g key={i}>
              <circle cx={bx} cy={by} r={rB} stroke={C.hairStrong} strokeWidth={2.5} fill="rgba(245,158,75,0.05)" />
              <Label x={bx + Math.cos(b.a) * 6} y={by + Math.sin(b.a) * 6} size={34} weight={700} color={C.ink} halo="transparent">{s.atom_b}</Label>
            </g>
          );
        })}
      </g>
      <g opacity={pIn}>{els}</g>
      <g opacity={pRes}>
        <rect x={20} y={box.h - 70} width={16} height={16} rx={8} fill={C.blue} /><Label x={44} y={box.h - 62} anchor="start" size={22} color={C.muted}>{`from ${s.atom_a}`}</Label>
        <rect x={190} y={box.h - 70} width={16} height={16} rx={8} fill={C.orange} /><Label x={214} y={box.h - 62} anchor="start" size={22} color={C.muted}>{`from ${s.atom_b}`}</Label>
        <Label x={box.w - 20} y={box.h - 62} anchor="end" size={26} color={C.ink}>{`${shared} shared pair${shared > 1 ? "s" : ""} · ${bondName} bond${n > 1 ? "s" : ""}${loneA ? ` · ${loneA / 2} lone pair${loneA > 2 ? "s" : ""} on ${s.atom_a}` : ""}`}</Label>
      </g>
    </svg>
  );
};

// =================================================================== VSEPR
const SHAPES: Record<string, { v: number[][]; lone?: number[][]; angle: string; name: string }> = {
  linear: { v: [[1, 0, 0], [-1, 0, 0]], angle: "180°", name: "Linear" },
  bent: { v: [[0.79, -0.61, 0], [-0.79, -0.61, 0]], lone: [[0, 0.6, 0.8], [0, 0.6, -0.8]], angle: "104.5°", name: "Bent" },
  trigonal_planar: { v: [[1, 0, 0], [-0.5, 0, 0.866], [-0.5, 0, -0.866]], angle: "120°", name: "Trigonal planar" },
  trigonal_pyramidal: { v: [[0.94, -0.33, 0], [-0.47, -0.33, 0.82], [-0.47, -0.33, -0.82]], lone: [[0, 1, 0]], angle: "107°", name: "Trigonal pyramidal" },
  tetrahedral: { v: [[0, 1, 0], [0.94, -0.33, 0], [-0.47, -0.33, 0.82], [-0.47, -0.33, -0.82]], angle: "109.5°", name: "Tetrahedral" },
  trigonal_bipyramidal: { v: [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-0.5, 0, 0.866], [-0.5, 0, -0.866]], angle: "90° and 120°", name: "Trigonal bipyramidal" },
  octahedral: { v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], angle: "90°", name: "Octahedral" },
};
export const VSEPR: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const shape = SHAPES[s.shape] || SHAPES.tetrahedral;
  const ph = phases(dur, [1, 3]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const yaw = frame * 0.012, pitch = -0.32;
  const cx = box.w * 0.42, cy = box.h / 2, Rb = Math.min(box.h * 0.36, 230);
  const proj = (p: number[]) => {
    const [x, y, z] = p;
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw), z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    const sc = 1 / (1 + z2 * 0.18);
    return { x: cx + x1 * Rb * sc * pIn, y: cy - y2 * Rb * sc * pIn, z: z2, sc };
  };
  const atoms = shape.v.map((v) => ({ ...proj(v), kind: "outer" as const }));
  const lones = (shape.lone || []).map((v) => ({ ...proj(v.map((c) => c * 0.62)), kind: "lone" as const }));
  const items = [...atoms, ...lones, { x: cx, y: cy, z: 0, sc: 1, kind: "center" as const }].sort((a, b) => b.z - a.z);
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="vs-c" cx="35%" cy="35%" r="70%"><stop offset="0%" stopColor="#6A7280" /><stop offset="100%" stopColor="#2A2F38" /></radialGradient>
          <radialGradient id="vs-o" cx="35%" cy="35%" r="70%"><stop offset="0%" stopColor="#F4F6F8" /><stop offset="100%" stopColor="#8F98A3" /></radialGradient>
        </defs>
        {items.map((it, i) => {
          if (it.kind === "center") return (
            <g key={i}><circle cx={cx} cy={cy} r={58} fill="url(#vs-c)" /><Label x={cx} y={cy} size={34} weight={700} color={C.ink} halo="transparent">{s.central}</Label></g>
          );
          if (it.kind === "lone") return <ellipse key={i} cx={(cx + it.x) / 2 + (it.x - cx) * 0.3} cy={(cy + it.y) / 2 + (it.y - cy) * 0.3} rx={52 * it.sc} ry={38 * it.sc} fill={C.violet} opacity={0.28} />;
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={it.x} y2={it.y} stroke={C.muted} strokeWidth={10 * it.sc} strokeLinecap="round" />
              <circle cx={it.x} cy={it.y} r={40 * it.sc} fill="url(#vs-o)" opacity={0.95} />
              <Label x={it.x} y={it.y} size={28 * it.sc} weight={700} color={C.bg} halo="transparent">{s.outer}</Label>
            </g>
          );
        })}
      </svg>
      <Readout right p={prog(frame, ph[1].start, 16)} rows={[["Shape", shape.name], ["Bond pairs", `${shape.v.length}`], ["Lone pairs", `${(shape.lone || []).length}`], ["Bond angle", shape.angle]]} foot="Electron pairs repel and spread apart" />
    </div>
  );
};

// ================================================================ reaction
const ce = (terms: { formula: string; coefficient: number }[]) =>
  terms.map((t) => `${t.coefficient > 1 ? t.coefficient + " " : ""}${t.formula}`).join(" + ");
export const Reaction: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const arrow = s.reversible ? "<=>" : "->";
  const cond = s.condition ? `[{\\text{${s.condition.replace(/[{}\\]/g, "")}}}]` : "";
  const tex = `\\ce{${ce(s.reactants)} ${arrow}${cond} ${ce(s.products)}}`;
  const atoms = Object.entries(s.atoms || {}) as [string, number][];
  const at = stagger(atoms.length, dur * 0.4, dur * 0.8);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 56 }}>
      <div style={{ ...card, padding: "48px 40px", display: "flex", justifyContent: "center", ...enter(frame, 8, 22) }}>
        <Tex tex={tex} size={66} />
      </div>
      {atoms.length ? (
        <div style={{ display: "flex", gap: 22, justifyContent: "center", flexWrap: "wrap" }}>
          {atoms.map(([el, n], i) => (
            <div key={el} style={{ ...card, padding: "16px 26px", minWidth: 190, ...enter(frame, at[i], 14) }}>
              <div style={{ color: C.muted, fontFamily: F.sans, fontSize: 22 }}>{el} atoms</div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 14, fontFamily: F.mono, fontSize: 30, color: C.ink }}>
                <span>{n}</span><span style={{ color: C.faint }}>=</span><span>{n}</span>
                <span style={{ marginLeft: "auto", color: C.green, fontSize: 26 }}>✓</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// ================================================================ pH scale
const phColor = (ph: number) => {
  const stops = ["#E5484D", "#F06A3A", "#F59E4B", "#F5C451", "#E2D75A", "#A8D65B", "#5FCB8E", "#46B98C", "#3FA9B6", "#4D8FE0", "#5C78E8", "#6E62E6", "#8456DB", "#9450C9", "#9C4AB4"];
  return stops[Math.round(clamp(ph, 0, 14))];
};
export const PHScale: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const x0 = 60, x1 = box.w - 60, y = box.h * 0.48, hgt = 56;
  const sx = (v: number) => x0 + ((x1 - x0) * v) / 14;
  const pBar = prog(frame, 8, 26);
  const subs = (s.substances as { name: string; ph: number }[]).slice().sort((a, b) => a.ph - b.ph);
  const at = stagger(subs.length, dur * 0.25, dur * 0.72);
  return (
    <svg width={box.w} height={box.h}>
      <defs>
        <linearGradient id="phg" x1="0" x2="1" y1="0" y2="0">
          {Array.from({ length: 15 }).map((_, i) => <stop key={i} offset={`${(i / 14) * 100}%`} stopColor={phColor(i)} />)}
        </linearGradient>
        <clipPath id="phc"><rect x={x0} y={y - hgt / 2} width={(x1 - x0) * pBar} height={hgt} rx={12} /></clipPath>
      </defs>
      <rect x={x0} y={y - hgt / 2} width={x1 - x0} height={hgt} rx={12} fill="url(#phg)" clipPath="url(#phc)" />
      {Array.from({ length: 15 }).map((_, i) => (
        <g key={i} opacity={pBar}>
          <line x1={sx(i)} x2={sx(i)} y1={y + hgt / 2 + 4} y2={y + hgt / 2 + 14} stroke={C.muted} strokeWidth={2} />
          <Label x={sx(i)} y={y + hgt / 2 + 34} size={22} color={i === 7 ? C.ink : C.muted} mono>{i}</Label>
        </g>
      ))}
      <g opacity={pBar}>
        <Label x={x0} y={y - hgt / 2 - 30} anchor="start" size={26} color={C.red}>← more acidic</Label>
        <Label x={sx(7)} y={y - hgt / 2 - 30} size={26} color={C.green}>neutral</Label>
        <Label x={x1} y={y - hgt / 2 - 30} anchor="end" size={26} color={C.violet}>more basic →</Label>
      </g>
      {subs.map((sb, i) => {
        const up = i % 2 === 0;
        const x = sx(sb.ph);
        const p = prog(frame, at[i], 16);
        const ly = up ? y - hgt / 2 - 120 : y + hgt / 2 + 130;
        return (
          <g key={i} opacity={p}>
            <line x1={x} x2={x} y1={up ? y - hgt / 2 - 4 : y + hgt / 2 + 40} y2={up ? ly + 30 : ly - 34} stroke={C.ink} strokeWidth={2} />
            <circle cx={x} cy={y} r={14} fill={C.bg} stroke={C.ink} strokeWidth={3} />
            <Label x={x} y={ly} size={26} color={C.ink} weight={600}>{sb.name}</Label>
            <Label x={x} y={ly + (up ? -32 : 32)} size={20} color={C.muted} mono>{`pH ${fmt(sb.ph, 1)}`}</Label>
          </g>
        );
      })}
    </svg>
  );
};

// ===================================================== electrochemical cell
export const ElectroCell: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const an = s.anode, ca = s.cathode;
  const emf = (E0[ca] ?? 0) - (E0[an] ?? 0);
  const qa = ION_CHARGE[an] || 2, qc = ION_CHARGE[ca] || 2;
  const ph = phases(dur, [1, 2.2, 1.2]);
  const pIn = prog(frame, ph[0].start, ph[0].len);
  const t = Math.max(0, frame - ph[1].start);
  const pEq = prog(frame, ph[2].start, ph[2].len);
  const bw = 300, bh = 240, by = box.h * 0.36;
  const lx = box.w * 0.08, rx = box.w * 0.92 - bw;
  const eA = { x: lx + bw / 2, y: by - 40 }, eC = { x: rx + bw / 2, y: by - 40 };
  const wireY = 50;
  const wire: Pt[] = [eA, { x: eA.x, y: wireY }, { x: eC.x, y: wireY }, eC];
  const wireLen = (wireY < eA.y ? eA.y - wireY : 0) * 2 + (eC.x - eA.x);
  const dots = Array.from({ length: 12 }, (_, i) => {
    let d = ((i * wireLen) / 12 + t * 3.2) % wireLen;
    for (let k = 1; k < wire.length; k++) {
      const seg = Math.hypot(wire[k].x - wire[k - 1].x, wire[k].y - wire[k - 1].y);
      if (d <= seg) return { x: wire[k - 1].x + ((wire[k].x - wire[k - 1].x) * d) / seg, y: wire[k - 1].y + ((wire[k].y - wire[k - 1].y) * d) / seg };
      d -= seg;
    }
    return eC;
  });
  const ionTex = (el: string, q: number) => `\\ce{${el}^{${q > 1 ? q : ""}+}}`;
  const sup = (q: number) => (q > 1 ? q : "");
  const half = (el: string, q: number, ox: boolean) => ox ? `\\ce{${el} -> ${el}^{${sup(q)}+} + ${q > 1 ? q : ""}e-}` : `\\ce{${el}^{${sup(q)}+} + ${q > 1 ? q : ""}e- -> ${el}}`;
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <g opacity={pIn}>
          {[{ x: lx, c: "rgba(160,170,190,0.16)" }, { x: rx, c: "rgba(90,169,240,0.2)" }].map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={by + 40} width={bw} height={bh - 40} fill={b.c} />
              <path d={`M${b.x},${by} L${b.x},${by + bh} L${b.x + bw},${by + bh} L${b.x + bw},${by}`} stroke={C.hairStrong} strokeWidth={3} fill="none" />
            </g>
          ))}
          <rect x={eA.x - 22} y={eA.y} width={44} height={bh - 20} rx={4} fill="#8F98A6" />
          <rect x={eC.x - 22} y={eC.y} width={44} height={bh - 20} rx={4} fill="#C98A5A" />
          <path d={`M${lx + bw * 0.78},${by + 120} L${lx + bw * 0.78},${by - 20} L${rx + bw * 0.22},${by - 20} L${rx + bw * 0.22},${by + 120}`} stroke={C.muted} strokeWidth={30} fill="none" opacity={0.35} strokeLinejoin="round" />
          <Label x={(lx + rx + bw) / 2} y={by - 54} size={22} color={C.muted}>salt bridge</Label>
          <path d={pathOf(wire)} stroke={C.muted} strokeWidth={3} fill="none" />
          <circle cx={(eA.x + eC.x) / 2} cy={wireY} r={38} fill={C.bgRaise} stroke={C.hairStrong} strokeWidth={2.5} />
          <Label x={(eA.x + eC.x) / 2} y={wireY} size={22} color={C.ink} mono halo="transparent">{`${fmt(emf, 2)} V`}</Label>
          <Label x={eA.x} y={by + bh + 34} size={26} color={C.ink} weight={600}>{`${an} anode (−)`}</Label>
          <Label x={eC.x} y={by + bh + 34} size={26} color={C.ink} weight={600}>{`${ca} cathode (+)`}</Label>
          <Label x={eA.x} y={by + bh + 66} size={20} color={C.muted}>oxidation</Label>
          <Label x={eC.x} y={by + bh + 66} size={20} color={C.muted}>reduction</Label>
        </g>
        {frame > ph[1].start ? dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={6} fill={C.light} />) : null}
        {frame > ph[1].start ? <Arrow from={{ x: (eA.x + eC.x) / 2 + 60, y: wireY - 28 }} to={{ x: (eA.x + eC.x) / 2 + 150, y: wireY - 28 }} color={C.light} width={3} head={12} /> : null}
        {frame > ph[1].start ? <Label x={(eA.x + eC.x) / 2 + 160} y={wireY - 28} anchor="start" size={22} color={C.light}>e⁻</Label> : null}
      </svg>
      <div style={{ position: "absolute", left: lx - 20, top: by + bh + 90, width: bw + 140, opacity: pEq }}><Tex tex={half(an, qa, true)} size={30} /></div>
      <div style={{ position: "absolute", left: rx - 100, top: by + bh + 90, width: bw + 140, textAlign: "right", opacity: pEq }}><Tex tex={half(ca, qc, false)} size={30} /></div>
      <div style={{ position: "absolute", left: lx + 20, top: by + 60, opacity: pIn * 0.9 }}><Tex tex={ionTex(an, qa)} size={26} color={C.muted} /></div>
      <div style={{ position: "absolute", left: rx + bw - 90, top: by + 60, opacity: pIn * 0.9 }}><Tex tex={ionTex(ca, qc)} size={26} color={C.muted} /></div>
      <div style={{ position: "absolute", right: 0, top: by + bh + 150, opacity: pEq, color: C.green, fontFamily: F.sans, fontSize: 26 }}>
        {`E°cell = E°(${ca}) − E°(${an}) = ${fmt(E0[ca] ?? 0, 2)} − (${fmt(E0[an] ?? 0, 2)}) = ${fmt(emf, 2)} V`}
      </div>
    </div>
  );
};
const pathOf = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");

// ============================================================ hydrocarbon
const PREFIX = ["meth", "eth", "prop", "but", "pent", "hex"];
export const Hydrocarbon: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const n = s.carbons;
  let group: string = s.group;
  if (group === "ketone" && n < 3) group = "aldehyde";
  const order = n >= 2 ? ({ single: 1, double: 2, triple: 3 } as Record<string, number>)[s.bond] || 1 : 1;
  const sp = Math.min(190, (box.w - 360) / Math.max(1, n));
  const cy = box.h * 0.46;
  const x0 = box.w / 2 - ((n - 1) * sp) / 2 + (group === "alcohol" || group === "carboxylic_acid" || group === "chloro" ? 60 : 0);
  const Cx = (i: number) => x0 + i * sp;
  type Sub = { x: number; y: number; t: string; order: number; color: string; from: Pt };
  const subs: Sub[] = [];
  let hCount = 0, oCount = 0, clCount = 0;
  for (let i = 0; i < n; i++) {
    let used = 0;
    if (i > 0) used += i === 1 ? order : 1;
    if (i < n - 1) used += i === 0 ? order : 1;
    const c = { x: Cx(i), y: cy };
    const slots: { dx: number; dy: number }[] = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }];
    if (i === 0) slots.push({ dx: -1, dy: 0 });
    if (i === n - 1) slots.push({ dx: 1, dy: 0 });
    const take = (pref: { dx: number; dy: number }) => {
      const k = slots.findIndex((sl) => sl.dx === pref.dx && sl.dy === pref.dy);
      if (k >= 0) slots.splice(k, 1);
      return pref;
    };
    if (i === 0 && group === "alcohol") { take({ dx: -1, dy: 0 }); subs.push({ x: c.x - 120, y: cy, t: "O", order: 1, color: C.red, from: c }); subs.push({ x: c.x - 220, y: cy, t: "H", order: 1, color: C.ink, from: { x: c.x - 120, y: cy } }); used += 1; oCount++; hCount++; }
    if (i === 0 && group === "chloro") { take({ dx: -1, dy: 0 }); subs.push({ x: c.x - 130, y: cy, t: "Cl", order: 1, color: C.green, from: c }); used += 1; clCount++; }
    if (i === 0 && (group === "aldehyde" || group === "carboxylic_acid")) {
      take({ dx: 0, dy: -1 }); subs.push({ x: c.x, y: cy - 120, t: "O", order: 2, color: C.red, from: c }); used += 2; oCount++;
      if (group === "carboxylic_acid") { take({ dx: -1, dy: 0 }); subs.push({ x: c.x - 120, y: cy, t: "O", order: 1, color: C.red, from: c }); subs.push({ x: c.x - 220, y: cy, t: "H", order: 1, color: C.ink, from: { x: c.x - 120, y: cy } }); used += 1; oCount++; hCount++; }
    }
    if (i === 1 && group === "ketone") { take({ dx: 0, dy: -1 }); subs.push({ x: c.x, y: cy - 120, t: "O", order: 2, color: C.red, from: c }); used += 2; oCount++; }
    let free = Math.max(0, 4 - used);
    while (free > 0 && slots.length) {
      const sl = slots.shift()!;
      subs.push({ x: c.x + sl.dx * 110, y: cy + sl.dy * 110, t: "H", order: 1, color: C.ink, from: c });
      free--; hCount++;
    }
  }
  const stem = PREFIX[n - 1];
  const unsat = order === 2 ? "en" : order === 3 ? "yn" : "an";
  const name = group === "alcohol" ? `${stem}${unsat}${n > 2 ? "-1-" : ""}ol`
    : group === "aldehyde" ? `${stem}${unsat}al`
      : group === "ketone" ? `${stem}${unsat}${n > 3 ? "-2-" : ""}one`
        : group === "carboxylic_acid" ? `${stem}${unsat}oic acid`
          : group === "chloro" ? `${n > 1 ? "1-" : ""}chloro${stem}${unsat}e`
            : order === 1 ? `${stem}ane` : `${stem}${n > 3 ? "-1-" : ""}${order === 2 ? "ene" : "yne"}`;
  const formula = `\\mathrm{C${n > 1 ? `_{${n}}` : ""}H_{${hCount}}${oCount ? `O${oCount > 1 ? `_{${oCount}}` : ""}` : ""}${clCount ? "Cl" : ""}}`;
  const series: [string, string] = group === "none"
    ? (order === 1 ? ["Alkane", "\\mathrm{C}_n\\mathrm{H}_{2n+2}"] : order === 2 ? ["Alkene", "\\mathrm{C}_n\\mathrm{H}_{2n}"] : ["Alkyne", "\\mathrm{C}_n\\mathrm{H}_{2n-2}"])
    : ({ alcohol: ["Alcohol", "\\mathrm{-OH}"], aldehyde: ["Aldehyde", "\\mathrm{-CHO}"], ketone: ["Ketone", "\\mathrm{C{=}O}"], carboxylic_acid: ["Carboxylic acid", "\\mathrm{-COOH}"], chloro: ["Haloalkane", "\\mathrm{-Cl}"] } as Record<string, [string, string]>)[group];
  const ph = phases(dur, [1.2, 1.4, 1]);
  const pC = lin(frame, ph[0].start, ph[0].len);
  const pS = lin(frame, ph[1].start, ph[1].len);
  const pN = prog(frame, ph[2].start, ph[2].len);
  const bondLines = (a: Pt, b: Pt, ord: number, r1 = 34, r2 = 30, key = "") => {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const pa = { x: a.x + Math.cos(ang) * r1, y: a.y + Math.sin(ang) * r1 };
    const pb = { x: b.x - Math.cos(ang) * r2, y: b.y - Math.sin(ang) * r2 };
    const perp = { x: -Math.sin(ang), y: Math.cos(ang) };
    return Array.from({ length: ord }, (_, k) => {
      const off = (k - (ord - 1) / 2) * 12;
      return <line key={`${key}${k}`} x1={pa.x + perp.x * off} y1={pa.y + perp.y * off} x2={pb.x + perp.x * off} y2={pb.y + perp.y * off} stroke={C.muted} strokeWidth={4} strokeLinecap="round" />;
    });
  };
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: n - 1 }).map((_, i) => {
          const p = clamp(pC * n - i - 0.5, 0, 1);
          return <g key={i} opacity={p}>{bondLines({ x: Cx(i), y: cy }, { x: Cx(i + 1), y: cy }, i === 0 ? order : 1, 34, 34, `c${i}`)}</g>;
        })}
        {Array.from({ length: n }).map((_, i) => {
          const p = clamp(pC * n - i, 0, 1);
          return <g key={i} opacity={p}><circle cx={Cx(i)} cy={cy} r={34} fill={C.bgRaise} stroke={C.hairStrong} strokeWidth={2} /><Label x={Cx(i)} y={cy} size={34} weight={700} color={C.ink} halo="transparent">C</Label></g>;
        })}
        {subs.map((sb, i) => {
          const p = clamp(pS * subs.length - i, 0, 1);
          const r = sb.t === "H" ? 22 : 30;
          return (
            <g key={i} opacity={p}>
              {bondLines(sb.from, { x: sb.x, y: sb.y }, sb.order, sb.from.x === sb.x && sb.from.y === sb.y ? 0 : (subs.some((q) => q.x === sb.from.x && q.y === sb.from.y) ? 24 : 34), r, `s${i}`)}
              <Label x={sb.x} y={sb.y} size={sb.t === "H" ? 30 : 34} weight={700} color={sb.color}>{sb.t}</Label>
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", gap: 60, alignItems: "baseline", opacity: pN, transform: `translateY(${(1 - pN) * 10}px)` }}>
        <div style={{ color: C.ink, fontFamily: F.sans, fontSize: 44, fontWeight: 600 }}>{name.charAt(0).toUpperCase() + name.slice(1)}</div>
        <Tex tex={formula} size={40} color={C.light} />
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: F.sans, fontSize: 26, color: C.muted }}>{series[0]}</span>
          <Tex tex={series[1]} size={28} color={C.muted} />
        </span>
      </div>
    </div>
  );
};

export const _chemUtils = { Arrow };
