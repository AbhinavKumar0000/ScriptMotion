import React from "react";
import { useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { clamp, easeInOut, easeOut, lerp } from "../lib/anim";
import { SceneProps } from "../types";

/*
 * Reaction mechanism, drawn the way a textbook draws it: element symbols joined by
 * line bonds, lone pairs as dot pairs, formal charges as circled signs, and curly
 * arrows that start on the electrons that move.
 *
 * The storyboard carries one validated, geometry-cleaned state per step. Each step plays as
 *   1. the camera eases in on the atoms that react,
 *   2. curly arrows draw from a lone pair or a bond to where the electrons go,
 *   3. the electrons ride the arrows while breaking bonds dash out and new bonds dash in,
 *   4. the new bonds turn solid, charges and lone pairs settle and the camera eases back.
 */

type AtomS = [number, number, number, number, number]; // x, y, charge, radical, lone pairs
type State = { atoms: Record<string, AtomS>; bonds: [string, string, number][]; el: Record<string, string> };
type ArrowSpec = { from: string; to: string; kind: "pair" | "single" };
type Step = { title: string; caption: string; arrows: ArrowSpec[]; break: string[]; form: { a: string; b: string; order: number }[] };
type Pt = { x: number; y: number };

// element colours (CPK-inspired, tuned for a dark board); carbon stays neutral like a skeletal drawing
const INK: Record<string, string> = {
  C: "#E8EBF0", H: "#A9B2BF", O: "#FF8F87", N: "#86BEFF", F: "#7EDC9F", Cl: "#7EDC9F", Br: "#F0A07A",
  I: "#C4A8FF", S: "#FFD66B", P: "#FFB46B", B: "#F5B7A8", Si: "#D8C49A",
};
const METALS = ["Li", "Na", "K", "Mg", "Ca", "Al", "Fe", "Cu", "Zn", "Ag"];
const inkOf = (el: string) => INK[el] || (METALS.includes(el) ? "#C4A8FF" : C.ink);
const BOND = "#C9D0DA";
const PAIR = C.light, SINGLE = C.teal;

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const bondMap = (s: State) => new Map(s.bonds.map(([a, b, o]) => [key(a, b), o] as const));
const sub = (a: Pt, b: Pt) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const len = (v: Pt) => Math.hypot(v.x, v.y) || 1;
const unit = (v: Pt) => { const l = len(v); return { x: v.x / l, y: v.y / l }; };
const angDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Directions (radians) for n electron sites around an atom, spread into the gaps between its bonds. */
const sites = (n: number, taken0: number[]) => {
  const taken = [...taken0], out: number[] = [];
  for (let k = 0; k < n; k++) {
    let best = -Math.PI / 2, score = -1;
    for (let c = 0; c < 72; c++) {
      const a = -Math.PI / 2 + (c * Math.PI * 2) / 72;
      const d = taken.length ? Math.min(...taken.map((t) => angDiff(a, t))) : Math.PI;
      if (d > score + 1e-6) { score = d; best = a; }
    }
    taken.push(best); out.push(best);
  }
  return out;
};

/** "CH3" -> C H ₃ as tspans so group labels read like a printed formula. */
const Formula: React.FC<{ text: string; size: number }> = ({ text, size }) => (
  <>
    {text.split(/(\d+)/).filter(Boolean).map((part, i) => /\d/.test(part)
      ? <tspan key={i} fontSize={size * 0.62} dy={size * 0.22}>{part}</tspan>
      : <tspan key={i} dy={i ? -size * 0.22 : 0}>{part}</tspan>)}
  </>
);

export const Mechanism: React.FC<SceneProps> = ({ s, box }) => {
  const frame = useCurrentFrame();
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const states = (s.states || []) as State[];
  const steps = (s.steps || []) as Step[];
  if (!states.length) return null;
  const beats = ((s.beats || []) as { at: number }[]).map((b) => b.at);
  const total = s.duration as number;

  // ---------------------------------------------------------------- timeline
  let k = 0;
  while (k < beats.length && frame >= beats[k]) k++;
  const prev = states[Math.max(0, k - 1)], next = states[Math.min(k, states.length - 1)];
  const start = k ? beats[k - 1] : 0, end = k < beats.length ? beats[k] : total;
  const stepLen = Math.min(150, Math.max(80, (end - start) * 0.78));
  const p = k ? clamp((frame - start) / stepLen, 0, 1) : 1;
  const pArrow = clamp((p - 0.1) / 0.3, 0, 1);
  const pMove = easeInOut(clamp((p - 0.38) / 0.4, 0, 1));
  const pSolid = clamp((pMove - 0.8) / 0.2, 0, 1);
  const pSettle = easeOut(clamp((p - 0.7) / 0.22, 0, 1));
  const arrowFade = 1 - clamp((p - 0.7) / 0.14, 0, 1);
  const zoomE = k ? easeInOut(clamp(p / 0.22, 0, 1)) * (1 - easeInOut(clamp((p - 0.8) / 0.2, 0, 1))) : 0;
  const step = k ? steps[k - 1] : null;

  const order = Object.keys(states[0].atoms);
  const nb0 = states[0].bonds.length;
  const bondIn = (i: number) => easeOut(clamp((frame - 4 - i * 2.5) / 16, 0, 1));
  const atomIn = (i: number) => easeOut(clamp((frame - 8 - i * 2) / 12, 0, 1));
  const ready = easeOut(clamp((frame - 14 - Math.max(nb0 * 2.5, order.length * 2)) / 14, 0, 1));

  // ------------------------------------------------------------- projection
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const st of states) for (const a of Object.values(st.atoms)) { x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]); }
  const U = Math.min(165, (box.w - 300) / Math.max(1, x1 - x0), (box.h - 200) / Math.max(1, y1 - y0));
  const ox = box.w / 2 - ((x0 + x1) / 2) * U, oy = box.h / 2 + 14 + ((y0 + y1) / 2) * U;
  const scr = (x: number, y: number): Pt => ({ x: ox + x * U, y: oy - y * U });
  const sz = clamp(U / 125, 0.72, 1.2);
  const els = states[states.length - 1].el;
  const isGroup = (el: string) => el.length > 2 || ["R", "Me", "Et", "Pr", "Bu", "Ph", "Ar", "Nu", "X"].includes(el);
  const font = (el: string) => (el === "H" ? 30 : isGroup(el) ? 30 : 38) * sz;
  /** how far a bond stops short of the symbol (the "knockout") */
  const trim = (id: string, dir: Pt) => {
    const el = els[id];
    if (el === "e") return 14 * sz;
    if (isGroup(el)) { // ellipse around the label
      const rx = (el.replace(/\d/g, "").length * 11 + 14) * sz, ry = 22 * sz;
      return 1 / Math.sqrt((dir.x / rx) ** 2 + (dir.y / ry) ** 2) + 3 * sz;
    }
    return (el === "H" ? 17 : el.length === 2 ? 27 : 22) * sz;
  };
  const halo = (id: string) => trim(id, { x: 0, y: 1 }) + 4 * sz;

  const pos: Record<string, Pt> = {};
  for (const id of order) {
    const a = prev.atoms[id], b = next.atoms[id];
    pos[id] = scr(lerp(a[0], b[0], pMove), lerp(a[1], b[1], pMove));
  }

  // atoms the current step works on: they get the camera, the glow and the arrows
  const involved = new Set<string>();
  if (step) {
    const addRef = (r: string) => r.split("-").forEach((x) => x && pos[x] && involved.add(x));
    step.arrows.forEach((a) => { addRef(a.from); addRef(a.to); });
    step.break.forEach(addRef);
    step.form.forEach((f) => { involved.add(f.a); involved.add(f.b); });
  }

  // ------------------------------------------------------------------- camera
  let cam = "";
  if (step && involved.size) {
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (const id of involved) for (const st of [prev, next]) {
      const q = scr(st.atoms[id][0], st.atoms[id][1]);
      bx0 = Math.min(bx0, q.x); bx1 = Math.max(bx1, q.x); by0 = Math.min(by0, q.y); by1 = Math.max(by1, q.y);
    }
    const z = clamp(Math.min(box.w / (bx1 - bx0 + 420), box.h / (by1 - by0 + 300)), 1, 1.4);
    const Fc = { x: (bx0 + bx1) / 2, y: (by0 + by1) / 2 }, mid = { x: box.w / 2, y: box.h / 2 + 10 };
    const T = { x: lerp(Fc.x, lerp(Fc.x, mid.x, 0.55), zoomE), y: lerp(Fc.y, lerp(Fc.y, mid.y, 0.55), zoomE) };
    cam = `translate(${T.x},${T.y}) scale(${lerp(1, z, zoomE)}) translate(${-Fc.x},${-Fc.y})`;
  }

  // ------------------------------------------------------------------ bonds
  const bp = bondMap(prev), bn = bondMap(next);
  const bondKeys = Array.from(new Set([...bp.keys(), ...bn.keys()]));
  const introOrder = states[0].bonds.map(([a, b]) => key(a, b));
  const bondEls: React.ReactNode[] = [];
  const BW = 4.2 * sz, GAP = 12 * sz;
  bondKeys.forEach((bk, bi) => {
    const [a, b] = bk.split("|");
    const o0 = bp.get(bk) || 0, o1 = bn.get(bk) || 0;
    const A = pos[a], B = pos[b], dir = unit(sub(B, A)), perp = { x: -dir.y, y: dir.x };
    const pa = add(A, dir, trim(a, dir)), pb = add(B, dir, -trim(b, { x: -dir.x, y: -dir.y }));
    const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    const ii = introOrder.indexOf(bk);
    const draw = k ? 1 : ii < 0 ? 1 : bondIn(ii);
    const n = Math.max(o0, o1);
    const off = (i: number, o: number) => (i - (o - 1) / 2) * GAP;
    for (let i = 0; i < n; i++) {
      const inPrev = i < o0, inNext = i < o1;
      const o = inPrev && inNext ? lerp(off(i, o0), off(i, o1), pMove) : inPrev ? off(i, o0) : off(i, o1);
      const shift = { x: perp.x * o, y: perp.y * o };
      const forming = k > 0 && !inPrev && inNext, breaking = k > 0 && inPrev && !inNext;
      if (!forming && !breaking) {
        // steady bond (intro: draws on from its middle outwards)
        const h = draw / 2;
        const s0 = { x: lerp(mid.x, pa.x, h * 2), y: lerp(mid.y, pa.y, h * 2) }, s1 = { x: lerp(mid.x, pb.x, h * 2), y: lerp(mid.y, pb.y, h * 2) };
        if (draw > 0.01) bondEls.push(<line key={`${bi}-${i}`} x1={s0.x + shift.x} y1={s0.y + shift.y} x2={s1.x + shift.x} y2={s1.y + shift.y}
          stroke={BOND} strokeWidth={BW} strokeLinecap="round" />);
        continue;
      }
      // forming: dashed amber halves grow from each atom, meet, then turn solid
      // breaking: the bond turns dashed, dims and retracts into each atom
      const f = forming ? clamp(pMove / 0.85, 0, 1) : 1 - pMove;
      if (f <= 0.01) continue;
      const col = forming ? (pSolid > 0.5 ? BOND : PAIR) : C.red;
      const op = forming ? 1 : 0.25 + 0.75 * (1 - pMove);
      for (const [from, sgn] of [[pa, 1], [pb, -1]] as const) {
        const tip = { x: from.x + (mid.x - from.x) * f, y: from.y + (mid.y - from.y) * f };
        // a forming bond's dashes close up into a solid line; a breaking bond opens into dashes
        const gapF = forming ? 1 - pSolid : clamp(pMove / 0.15, 0, 1);
        bondEls.push(<line key={`${bi}-${i}-${sgn}`} x1={from.x + shift.x} y1={from.y + shift.y} x2={tip.x + shift.x} y2={tip.y + shift.y}
          stroke={col} strokeWidth={BW} strokeLinecap="round" opacity={op}
          strokeDasharray={gapF > 0.03 ? `${8 * sz} ${7 * sz * gapF}` : undefined} />);
      }
    }
  });

  // ------------------------------------------- electrons: lone pairs, radicals
  const bondAngles = (st: Map<string, number>, id: string) => {
    const out: number[] = [];
    for (const bk of st.keys()) {
      const [a, b] = bk.split("|");
      if (a !== id && b !== id) continue;
      const v = sub(pos[a === id ? b : a], pos[id]);
      out.push(Math.atan2(v.y, v.x));
    }
    return out;
  };
  const CHARGE_DIR = -Math.PI / 4;
  const siteDirs = (id: string, at: AtomS, bm: Map<string, number>) =>
    sites(at[4] + at[3], [...bondAngles(bm, id), ...(at[2] ? [CHARGE_DIR] : [])]);
  const dotEls: React.ReactNode[] = [];
  const drawElectrons = (id: string, at: AtomS, bm: Map<string, number>, opacity: number, tag: string,
    keep: (pair: boolean, n: number) => number = () => 1) => {
    if (els[id] === "e" || opacity <= 0.01) return;
    const lp = at[4], rad = at[3];
    if (!lp && !rad) return;
    const R = halo(id) + 9 * sz, c = pos[id];
    siteDirs(id, at, bm).forEach((a, j) => {
      const along = { x: Math.cos(a), y: Math.sin(a) }, side = { x: -along.y, y: along.x };
      const base = add(c, along, R);
      const pair = j < lp;
      const op = opacity * keep(pair, pair ? j : j - lp);
      if (op <= 0.01) return;
      (pair ? [-1, 1] : [0]).forEach((sd) => dotEls.push(
        <circle key={`${tag}${id}${j}${sd}`} cx={base.x + side.x * sd * 6.5 * sz} cy={base.y + side.y * sd * 6.5 * sz} r={3.8 * sz}
          fill={pair ? "#D5DBE4" : C.light} opacity={op} />));
    });
  };
  for (const id of order) {
    const a = prev.atoms[id], b = next.atoms[id];
    const sameBonds = bondAngles(bp, id).length === bondAngles(bn, id).length;
    const base = k ? 1 : ready;
    if (a[3] === b[3] && a[4] === b[4] && a[2] === b[2] && sameBonds) drawElectrons(id, b, pMove < 0.5 ? bp : bn, base, "s");
    else {
      // electrons that move leave as the riders set off and appear where the riders land
      const gone = clamp(pMove / 0.1, 0, 1), here = clamp((pMove - 0.55) / 0.15, 0, 1);
      const kLp = Math.min(a[4], b[4]), kRad = Math.min(a[3], b[3]), early = pMove < 0.5;
      drawElectrons(id, a, bp, base, "a", (pair, n) => (n < (pair ? kLp : kRad) ? (early ? 1 : 0) : 1 - gone));
      drawElectrons(id, b, bn, base, "b", (pair, n) => (n < (pair ? kLp : kRad) ? (early ? 0 : 1) : here));
    }
  }

  // ------------------------------------------------------------ curly arrows
  // Arrows stay attached to the atoms as they move; the electrons ride them and they fade once the move is done.
  const arrowEls: React.ReactNode[] = [];
  if (step) {
    const P = (id: string) => pos[id];
    const angles0 = (id: string) => {
      const out: number[] = [];
      for (const bk of bp.keys()) {
        const [a, b] = bk.split("|");
        if (a !== id && b !== id) continue;
        const v = sub(P(a === id ? b : a), P(id));
        out.push(Math.atan2(v.y, v.x));
      }
      return out;
    };
    const centroid = order.reduce((acc, id) => add(acc, P(id), 1 / order.length), { x: 0, y: 0 });
    // which side of a line through m (normal n) faces away from the molecule; above when it is level
    const outward = (m: Pt, n: Pt) => {
      const dd = (m.x + n.x - centroid.x) ** 2 + (m.y + n.y - centroid.y) ** 2 - ((m.x - n.x - centroid.x) ** 2 + (m.y - n.y - centroid.y) ** 2);
      return Math.abs(dd) < 4 ? (n.y <= 0 ? 1 : -1) : dd > 0 ? 1 : -1;
    };
    const mid2 = (ref: string): Pt => { const [a, b] = ref.split("-"); return { x: (P(a).x + P(b).x) / 2, y: (P(a).y + P(b).y) / 2 }; };
    const center = (ref: string): Pt => (ref.includes("-") ? mid2(ref) : P(ref));
    step.arrows.forEach((ar, i) => {
      const target = center(ar.to), source = center(ar.from);
      let P0: Pt, P1: Pt, c1: Pt, c2: Pt, flip = 1;
      const ends = ar.from.includes("-") ? ar.from.split("-") : [];
      if (ends.length && !ar.to.includes("-") && ends.includes(ar.to)) {
        // a bond's electrons going to one of its own atoms: a short curl over the bond
        const other = ends[0] === ar.to ? ends[1] : ends[0];
        const d = unit(sub(P(ar.to), P(other))), m = mid2(ar.from);
        let nrm = { x: -d.y, y: d.x };
        const side = outward(m, nrm);
        nrm = { x: nrm.x * side, y: nrm.y * side };
        const o = bp.get(key(ends[0], ends[1])) || 1;
        P0 = add(add(m, d, 6 * sz), nrm, o > 1 ? GAP * (o - 1) / 2 : 0);
        P1 = add(add(P(ar.to), nrm, halo(ar.to) + 4 * sz), d, -4 * sz);
        const bend = 46 * sz + len(sub(P1, P0)) * 0.25;
        c1 = add(P0, nrm, bend); c2 = add(add(P1, nrm, bend * 0.9), d, 10 * sz);
        flip = -((d.x * nrm.y - d.y * nrm.x) >= 0 ? 1 : -1);
      } else {
        // tail: on the lone pair (or radical) that moves, or on the bond whose electrons move
        let out0: Pt;
        if (ends.length) {
          const [a, b] = ends;
          const o = bp.get(key(a, b)) || 1;
          const d = unit(sub(P(b), P(a))), nrm = { x: -d.y, y: d.x };
          const side = (target.x - source.x) * nrm.x + (target.y - source.y) * nrm.y >= 0 ? 1 : -1;
          out0 = { x: nrm.x * side, y: nrm.y * side };
          P0 = add(mid2(ar.from), out0, o > 1 ? GAP * (o - 1) / 2 : 0);
        } else {
          const at = prev.atoms[ar.from];
          const dirs = els[ar.from] === "e" ? [] : sites(at[4] + at[3], [...angles0(ar.from), ...(at[2] ? [CHARGE_DIR] : [])]);
          const want = Math.atan2(target.y - source.y, target.x - source.x);
          if (dirs.length) {
            const best = dirs.reduce((b, d) => (angDiff(d, want) < angDiff(b, want) ? d : b), dirs[0]);
            out0 = { x: Math.cos(best), y: Math.sin(best) };
            P0 = add(P(ar.from), out0, halo(ar.from) + 9 * sz);
          } else {
            out0 = unit(sub(target, source));
            P0 = add(P(ar.from), out0, halo(ar.from) + 4 * sz);
          }
        }
        // head: beside the atom that receives, or onto the middle of the bond being made
        if (ar.to.includes("-")) {
          const [a, b] = ar.to.split("-");
          const recv = ends.length ? null : a === ar.from ? b : b === ar.from ? a : null;
          P1 = recv ? add(P(recv), unit(sub(P0, P(recv))), halo(recv) + 14 * sz) : mid2(ar.to);
        } else P1 = add(P(ar.to), unit(sub(P0, P(ar.to))), halo(ar.to) + 8 * sz);
        const d = sub(P1, P0), L = len(d), nrm = { x: -d.y / L, y: d.x / L };
        const away = outward({ x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 }, nrm);
        const bend = clamp(L * 0.45, 56 * sz, 130 * sz);
        c1 = add(P0, out0, bend);
        c2 = add(add(P1, nrm, bend * 0.6 * away), d, -0.1);
        flip = away;
      }
      const bez = (t: number): Pt => ({
        x: (1 - t) ** 3 * P0.x + 3 * (1 - t) ** 2 * t * c1.x + 3 * (1 - t) * t * t * c2.x + t ** 3 * P1.x,
        y: (1 - t) ** 3 * P0.y + 3 * (1 - t) ** 2 * t * c1.y + 3 * (1 - t) * t * t * c2.y + t ** 3 * P1.y,
      });
      const dpath = `M${P0.x},${P0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${P1.x},${P1.y}`;
      const pa = clamp(pArrow * 1.3 - i * 0.3, 0, 1);
      if (pa <= 0 || arrowFade <= 0) return;
      const col = ar.kind === "single" ? SINGLE : PAIR;
      const t = unit(sub(P1, bez(0.93))), tn = { x: -t.y, y: t.x }, H = 20 * sz, W = 9 * sz;
      const base = add(P1, t, -H);
      // full head for an electron pair, half head (fish-hook) for one electron
      const head = ar.kind === "single"
        ? `M${P1.x},${P1.y} L${base.x + tn.x * W * flip},${base.y + tn.y * W * flip} L${base.x + t.x * 4 * sz},${base.y + t.y * 4 * sz} Z`
        : `M${P1.x},${P1.y} L${base.x + tn.x * W},${base.y + tn.y * W} L${base.x + t.x * 5 * sz},${base.y + t.y * 5 * sz} L${base.x - tn.x * W},${base.y - tn.y * W} Z`;
      const headP = clamp((pa - 0.88) / 0.12, 0, 1);
      const tE = clamp((pMove - 0.02) / 0.58, 0, 1);
      const rider = tE > 0 && tE < 1 ? (() => {
        const c = bez(tE), ahead = bez(Math.min(1, tE + 0.02)), tg = unit(sub(ahead, c)), nn = { x: -tg.y, y: tg.x };
        const fade = Math.sin(Math.PI * tE) ** 0.4;
        return (ar.kind === "pair" ? [-1, 1] : [0]).map((o) => (
          <g key={o} opacity={fade}>
            <circle cx={c.x + nn.x * o * 6.5 * sz} cy={c.y + nn.y * o * 6.5 * sz} r={11 * sz} fill={col} opacity={0.22} />
            <circle cx={c.x + nn.x * o * 6.5 * sz} cy={c.y + nn.y * o * 6.5 * sz} r={4.6 * sz} fill="#FFFFFF" />
          </g>));
      })() : null;
      arrowEls.push(
        <g key={`ar${i}`}>
          <g opacity={arrowFade}>
            <g filter={`url(#glow${uid})`} opacity={0.5}>
              <path d={dpath} fill="none" stroke={col} strokeWidth={7 * sz} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - pa} />
            </g>
            <path d={dpath} fill="none" stroke={col} strokeWidth={3.6 * sz} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - pa} />
            <path d={head} fill={col} opacity={headP} />
          </g>
          {rider}
        </g>);
    });
  }

  // ------------------------------------------------------------------ atoms
  const focus = step ? Math.sin(Math.PI * clamp(p, 0, 1)) : 0;
  const glowEls: React.ReactNode[] = [];
  const atomEls = order.map((id, i) => {
    const el = els[id], c = pos[id];
    const show = k ? 1 : atomIn(i);
    const a = prev.atoms[id], b = next.atoms[id];
    if (involved.has(id) && focus > 0.01)
      glowEls.push(<circle key={id} cx={c.x} cy={c.y} r={58 * sz} fill={`url(#halo${uid})`} opacity={focus} />);
    if (el === "e") {
      return (
        <g key={id} opacity={show}>
          <circle cx={c.x} cy={c.y} r={16 * sz} fill={C.blue} opacity={0.18} />
          <circle cx={c.x} cy={c.y} r={6 * sz} fill={C.blue} />
          <text x={c.x + 12 * sz} y={c.y - 10 * sz} fontSize={24 * sz} fill="#BFDFFF" fontFamily={F.serif} fontStyle="italic">e⁻</text>
        </g>);
    }
    const charge = (v: number, op: number, tag: string) => {
      if (!v || op <= 0.01) return null;
      const r = 12 * sz, at = add(c, { x: Math.cos(CHARGE_DIR), y: Math.sin(CHARGE_DIR) }, halo(id) + 10 * sz);
      const col = v > 0 ? "#FF9A92" : "#8EC5FF", pop = 0.5 + 0.5 * op;
      return (
        <g key={tag} opacity={op} transform={`translate(${at.x},${at.y}) scale(${pop})`}>
          <circle r={r} fill={C.bg} stroke={col} strokeWidth={2.2 * sz} />
          <line x1={-r * 0.5} y1={0} x2={r * 0.5} y2={0} stroke={col} strokeWidth={2.4 * sz} strokeLinecap="round" />
          {v > 0 ? <line x1={0} y1={-r * 0.5} x2={0} y2={r * 0.5} stroke={col} strokeWidth={2.4 * sz} strokeLinecap="round" /> : null}
          {Math.abs(v) > 1 ? <text x={-r - 4 * sz} y={1} textAnchor="end" dominantBaseline="middle" fontSize={18 * sz} fill={col} fontFamily={F.sans} fontWeight={700}>{Math.abs(v)}</text> : null}
        </g>);
    };
    const base = k ? 1 : ready;
    const fs = font(el);
    return (
      <g key={id}>
        <g opacity={show} transform={`translate(${c.x},${c.y}) scale(${0.7 + 0.3 * show})`}>
          <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={600}
            fill={inkOf(el)} fontFamily={F.sans} letterSpacing={-0.5}>
            {isGroup(el) ? <Formula text={el} size={fs} /> : el}
          </text>
        </g>
        {a[2] === b[2] ? charge(b[2], base, "q") : [charge(a[2], base * (1 - pSettle), "qa"), charge(b[2], base * pSettle, "qb")]}
      </g>);
  });

  // ------------------------------------------------------------------ labels
  const labelEls = ((s.labels || []) as { text: string; x: number; y: number; from_step: number; to_step: number }[]).map((lb, i) => {
    const vis = (n: number) => (n >= lb.from_step && n <= lb.to_step ? 1 : 0);
    const op = k ? lerp(vis(k - 1), vis(k), pSettle) : vis(0) * ready;
    if (op <= 0.01) return null;
    const c = scr(lb.x, lb.y);
    return <text key={i} x={c.x} y={c.y} textAnchor="middle" fontSize={24} fill={C.muted} fontFamily={F.serif} fontStyle="italic" opacity={op}>{lb.text}</text>;
  });

  // -------------------------------------------------------- step indicator
  const nSteps = steps.length;
  const ind = nSteps > 1 ? (
    <g transform={`translate(${box.w - 20}, 20)`} opacity={ready}>
      <text x={0} y={0} textAnchor="end" dominantBaseline="hanging" fontSize={22} fill={C.faint} fontFamily={F.mono}>{k ? `step ${k} of ${nSteps}` : "start"}</text>
      {Array.from({ length: nSteps }).map((_, i) => (
        <rect key={i} x={-((nSteps - i) * 30) + 6} y={34} width={24} height={5} rx={2.5} fill={i < k - 1 || (i === k - 1 && p >= 1) ? C.light : i === k - 1 ? C.lightSoft : C.hair} />
      ))}
    </g>
  ) : null;

  return (
    <svg width={box.w} height={box.h} style={{ overflow: "visible" }}>
      <defs>
        <filter id={`glow${uid}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={5 * sz} /></filter>
        <radialGradient id={`halo${uid}`}>
          <stop offset="0%" stopColor={C.light} stopOpacity={0.2} />
          <stop offset="100%" stopColor={C.light} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g transform={cam}>
        <g>{glowEls}</g>
        {labelEls}
        <g>{bondEls}</g>
        <g>{dotEls}</g>
        <g>{atomEls}</g>
        <g>{arrowEls}</g>
      </g>
      {ind}
    </svg>
  );
};
