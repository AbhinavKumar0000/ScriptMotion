import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, F, L, SERIES, STAGE_H, T, W } from "../theme";
import { enter, fmt, prog, stagger } from "../lib/anim";
import { SceneProps } from "../types";
import { Arrow, Label, Tex, pathOf } from "../ui/svg";
import { Axes, plane } from "../ui/axes";
import { subjectColor } from "../ui/Shell";

const card: React.CSSProperties = {
  background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 14,
};

// ------------------------------------------------------------------ title
export const TitleScene: React.FC<{ s: any; subject: string; meta: any }> = ({ s, subject, meta }) => {
  const frame = useCurrentFrame();
  const color = subjectColor(subject);
  const words = String(s.title || "").split(/\s+/).filter(Boolean);
  const rule = prog(frame, 10 + words.length * 3, 34);
  const context = [meta.level, meta.chapter].filter(Boolean).join(", ");
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      {context ? (
        <div style={{ color: C.muted, fontFamily: F.sans, fontSize: 28, fontWeight: 500, letterSpacing: "0.01em", ...enter(frame, 2, 18, 10) }}>
          {context}
        </div>
      ) : null}
      <div style={{ marginTop: 30, maxWidth: 1500, color: C.ink, fontFamily: F.serif, fontSize: 104, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.06, textWrap: "balance" as any }}>
        {words.map((w, i) => (
          <span key={i} style={{ display: "inline-block", marginRight: "0.24em", ...enter(frame, 8 + i * 3, 20, 26) }}>{w}</span>
        ))}
      </div>
      <div style={{ marginTop: 44, width: 220 * rule, height: 3, borderRadius: 2, background: color }} />
      {s.subtitle ? (
        <div style={{ marginTop: 40, maxWidth: 1180, color: C.muted, fontFamily: F.serif, fontStyle: "italic", fontSize: 42, lineHeight: 1.35, textWrap: "balance" as any, ...enter(frame, 22 + words.length * 3, 22, 12) }}>
          {s.subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------- key points
export const KeyPoints: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const items = s.items as { label: string; text: string }[];
  const at = stagger(items.length, 10, dur * 0.6);
  const cols = items.length === 4 ? 2 : items.length;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 32, height: "100%", alignContent: "center" }}>
      {items.map((it, i) => (
        <div key={i} style={{ ...card, padding: "38px 40px", minHeight: items.length === 4 ? 250 : 340, ...enter(frame, at[i], 20, 18) }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: SERIES[i % SERIES.length] }} />
          <div style={{ marginTop: 18, color: C.ink, fontFamily: F.sans, fontSize: 40, fontWeight: 600, letterSpacing: "-0.01em" }}>{it.label}</div>
          <div style={{ marginTop: 16, color: C.muted, fontFamily: F.sans, fontSize: 30, lineHeight: 1.4 }}>{it.text}</div>
        </div>
      ))}
    </div>
  );
};

// ------------------------------------------------------------- definition
export const Definition: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const sym = s.symbols as { symbol: string; meaning: string }[];
  return (
    <div style={{ display: "flex", gap: 64, height: "100%", alignItems: "center" }}>
      <div style={{ flex: 1.1 }}>
        <div style={{ color: C.teal, fontFamily: F.sans, fontSize: 30, fontWeight: 500, ...enter(frame, 6) }}>Definition</div>
        <div style={{ marginTop: 16, color: C.ink, fontFamily: F.sans, fontSize: 64, fontWeight: 600, letterSpacing: "-0.02em", ...enter(frame, 10) }}>{s.term}</div>
        <div style={{ marginTop: 28, color: C.ink, fontFamily: F.sans, fontSize: 38, lineHeight: 1.45, maxWidth: 820, ...enter(frame, 22) }}>{s.meaning}</div>
      </div>
      {s.formula ? (
        <div style={{ flex: 0.9, ...card, padding: "48px 52px", ...enter(frame, dur * 0.3, 22) }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 26px" }}>
            <Tex tex={s.formula} size={72} display />
          </div>
          {sym.length ? <div style={{ height: 1, background: C.hair, margin: "8px 0 26px" }} /> : null}
          {sym.map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 14, ...enter(frame, dur * 0.42 + i * 14) }}>
              <div style={{ width: 90, textAlign: "right" }}><Tex tex={x.symbol} size={36} color={C.light} /></div>
              <div style={{ color: C.muted, fontFamily: F.sans, fontSize: 29 }}>{x.meaning}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// --------------------------------------------------------------- equation
const StepList: React.FC<{ steps: { tex: string; note?: string }[]; at: number[]; result: number; size?: number; frame: number }> = ({ steps, at, result, size = 50, frame }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: steps.length > 4 ? 14 : 22 }}>
    {steps.map((st, i) => {
      const isResult = i === result;
      const current = frame >= at[i] && (i === steps.length - 1 || frame < at[i + 1]);
      return (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 36, ...enter(frame, at[i], 18, 10) }}>
          <div style={{ width: 44, color: current ? C.light : C.faint, fontFamily: F.mono, fontSize: 22, textAlign: "right" }}>{i + 1}</div>
          <div style={{
            padding: isResult ? "10px 28px" : "10px 0", borderRadius: 12,
            border: isResult ? `2px solid ${C.green}` : "2px solid transparent",
            background: isResult ? "rgba(95,203,142,0.08)" : "transparent",
          }}>
            <Tex tex={st.tex} size={size} color={frame >= at[i] && !current && !isResult ? C.muted : C.ink} />
          </div>
          {st.note ? <div style={{ color: C.muted, fontFamily: F.sans, fontSize: 27, fontStyle: "italic" }}>{st.note}</div> : null}
        </div>
      );
    })}
  </div>
);

export const Equation: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const steps = s.steps as { tex: string; note?: string }[];
  const at = stagger(steps.length, 12, dur * 0.78);
  const result = s.result_index < 0 ? steps.length - 1 : s.result_index;
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center" }}>
      <StepList steps={steps} at={at} result={result} frame={frame} size={steps.length > 4 ? 42 : 50} />
    </div>
  );
};

// --------------------------------------------------------- worked example
export const WorkedExample: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const steps = s.steps as { tex: string; note?: string }[];
  const given = s.given as string[];
  const at = stagger(steps.length, dur * 0.3, dur * 0.8);
  const ans = dur * 0.84;
  return (
    <div style={{ display: "flex", gap: 56, height: "100%" }}>
      <div style={{ width: 560, display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ ...card, padding: "30px 34px", ...enter(frame, 6) }}>
          <div style={{ color: C.orange, fontFamily: F.sans, fontSize: 24, fontWeight: 600 }}>Problem</div>
          <div style={{ marginTop: 12, color: C.ink, fontFamily: F.sans, fontSize: 30, lineHeight: 1.45 }}>{s.problem}</div>
        </div>
        <div style={{ ...card, padding: "26px 34px", ...enter(frame, dur * 0.14) }}>
          <div style={{ color: C.muted, fontFamily: F.sans, fontSize: 24, fontWeight: 600 }}>Given</div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: "10px 34px" }}>
            {given.map((g, i) => <div key={i} style={enter(frame, dur * 0.16 + i * 10)}><Tex tex={g} size={36} /></div>)}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 30 }}>
        <StepList steps={steps} at={at} result={-1} frame={frame} size={steps.length > 3 ? 40 : 46} />
        <div style={{ marginLeft: 80, display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 18, padding: "16px 28px", borderRadius: 12, border: `2px solid ${C.green}`, background: "rgba(95,203,142,0.08)", ...enter(frame, ans, 18) }}>
          <span style={{ color: C.green, fontFamily: F.sans, fontSize: 26, fontWeight: 600 }}>Answer</span>
          <span style={{ color: C.ink, fontFamily: F.sans, fontSize: 32, fontWeight: 500 }}>{s.answer}</span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- compare
export const Compare: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const sides = [{ ...s.left, color: C.blue }, { ...s.right, color: C.orange }];
  const rows = Math.max(s.left.items.length, s.right.items.length);
  const at = stagger(rows, dur * 0.15, dur * 0.7);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, height: "100%", alignContent: "center" }}>
      {sides.map((side, k) => (
        <div key={k} style={{ ...card, padding: "36px 44px", ...enter(frame, 6 + k * 8) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: side.color }} />
            <div style={{ color: C.ink, fontFamily: F.sans, fontSize: 42, fontWeight: 600 }}>{side.heading}</div>
          </div>
          <div style={{ height: 1, background: C.hair, margin: "26px 0 8px" }} />
          {side.items.map((it: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: 18, padding: "18px 0", borderBottom: i < side.items.length - 1 ? `1px solid ${C.hair}` : "none", ...enter(frame, at[i] + k * 6) }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: side.color, marginTop: 14, flex: "0 0 auto" }} />
              <div style={{ color: C.ink, fontFamily: F.sans, fontSize: 32, lineHeight: 1.35 }}>{it}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- process
export const Process: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const steps = s.steps as { label: string; detail: string }[];
  const n = steps.length;
  const at = stagger(n, 10, dur * 0.72);
  const gap = 70;
  const w = (box.w - gap * (n - 1)) / n;
  const h = 300;
  const top = (box.h - h) / 2;
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        {steps.slice(1).map((_, i) => {
          const x1 = (w + gap) * i + w + 10, x2 = (w + gap) * (i + 1) - 10;
          return <Arrow key={i} from={{ x: x1, y: top + h / 2 }} to={{ x: x2, y: top + h / 2 }} p={prog(frame, at[i + 1] - 8, 12)} color={C.muted} width={3} head={14} />;
        })}
      </svg>
      {steps.map((st, i) => {
        const active = frame >= at[i] && (i === n - 1 || frame < at[i + 1]);
        return (
          <div key={i} style={{
            position: "absolute", left: (w + gap) * i, top, width: w, height: h, ...card,
            borderColor: active ? C.teal : C.hair, padding: "30px 28px", ...enter(frame, at[i], 18),
          }}>
            <div style={{ fontFamily: F.mono, fontSize: 22, color: C.teal }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ marginTop: 16, color: C.ink, fontFamily: F.sans, fontSize: n > 4 ? 30 : 36, fontWeight: 600, lineHeight: 1.2 }}>{st.label}</div>
            <div style={{ marginTop: 14, color: C.muted, fontFamily: F.sans, fontSize: n > 4 ? 23 : 27, lineHeight: 1.4 }}>{st.detail}</div>
          </div>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------ cycle
export const Cycle: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const st = s.stages as { label: string; detail: string }[];
  const n = st.length;
  const cx = box.w / 2, cy = box.h / 2;
  const rx = Math.min(box.w * 0.34, 560), ry = box.h * 0.36;
  const at = stagger(n, 10, dur * 0.7);
  const pos = (i: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, a };
  };
  const cw = 360, ch = 132;
  return (
    <div style={{ position: "relative", width: box.w, height: box.h }}>
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={C.hair} strokeWidth={2} fill="none" strokeDasharray="6 10" />
        {st.map((_, i) => {
          const a0 = -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / n;
          const da = 0.18;
          const p1 = { x: cx + Math.cos(a0 - da) * rx, y: cy + Math.sin(a0 - da) * ry };
          const p2 = { x: cx + Math.cos(a0 + da) * rx, y: cy + Math.sin(a0 + da) * ry };
          return <Arrow key={i} from={p1} to={p2} p={prog(frame, at[(i + 1) % n] - 6, 12)} color={C.violet} width={4} head={18} />;
        })}
      </svg>
      {st.map((x, i) => {
        const p = pos(i);
        const active = frame >= at[i] && (i === n - 1 ? true : frame < at[i + 1]);
        return (
          <div key={i} style={{
            position: "absolute", left: p.x - cw / 2, top: p.y - ch / 2, width: cw, minHeight: ch, ...card,
            borderColor: active ? C.violet : C.hair, padding: "18px 24px", ...enter(frame, at[i], 16),
          }}>
            <div style={{ color: C.ink, fontFamily: F.sans, fontSize: 29, fontWeight: 600 }}>{x.label}</div>
            <div style={{ marginTop: 6, color: C.muted, fontFamily: F.sans, fontSize: 23, lineHeight: 1.35 }}>{x.detail}</div>
          </div>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------ table
export const Table: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const cols = s.columns as string[];
  const rows = s.rows as string[][];
  const at = stagger(rows.length, dur * 0.12, dur * 0.7);
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center" }}>
      <div style={{ width: "100%", ...card, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, background: C.bgRaise, ...enter(frame, 4) }}>
          {cols.map((c, i) => <div key={i} style={{ padding: "22px 32px", color: C.muted, fontFamily: F.sans, fontSize: 26, fontWeight: 600 }}>{c}</div>)}
        </div>
        {rows.map((r, i) => {
          const hl = i === s.highlight_row && frame > dur * 0.75;
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, borderTop: `1px solid ${C.hair}`,
              background: hl ? "rgba(255,200,87,0.08)" : "transparent", boxShadow: hl ? `inset 4px 0 0 ${C.light}` : "none", ...enter(frame, at[i], 14, 8),
            }}>
              {cols.map((_, j) => (
                <div key={j} style={{ padding: "22px 32px", color: j === 0 ? C.ink : C.ink, fontFamily: F.sans, fontSize: rows.length > 4 ? 28 : 31, fontWeight: j === 0 ? 500 : 400 }}>{r[j] ?? ""}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ chart
export const Chart: React.FC<SceneProps> = ({ s, dur, box }) => {
  const frame = useCurrentFrame();
  const cats = s.categories as string[];
  const series = (s.series as { name: string; values: number[] }[]).map((x) => ({ ...x, values: x.values.slice(0, cats.length) }));
  const all = series.flatMap((x) => x.values);
  const lo = Math.min(0, ...all), hi = Math.max(...all) * 1.12 || 1;
  const pl = plane(-0.5, cats.length - 0.5, lo, hi, { left: 120, top: 40, width: box.w - 200, height: box.h - 130 });
  const p = prog(frame, 14, dur * 0.5);
  const bw = (pl.width / cats.length) * 0.72 / series.length;
  return (
    <svg width={box.w} height={box.h}>
      <Axes pl={pl} xLabel={s.x_label} yLabel={s.y_label} tickLabels={false} grid={false} />
      {(() => {
        const step = (hi - lo) / 5;
        return Array.from({ length: 6 }, (_, i) => lo + step * i).map((v, i) => (
          <g key={i}>
            <line x1={pl.left} x2={pl.left + pl.width} y1={pl.sy(v)} y2={pl.sy(v)} stroke={C.grid} strokeWidth={1.5} />
            <Label x={pl.left - 16} y={pl.sy(v)} anchor="end" size={20} color={C.faint} mono>{fmt(v, Math.abs(hi) < 10 ? 1 : 0)}</Label>
          </g>
        ));
      })()}
      {cats.map((c, i) => <Label key={c + i} x={pl.sx(i)} y={pl.top + pl.height + 34} size={23} color={C.muted}>{c}</Label>)}
      {series.map((ser, k) => {
        const color = SERIES[k % SERIES.length];
        if (s.kind === "line") {
          const pts = ser.values.map((v, i) => ({ x: pl.sx(i), y: pl.sy(v) }));
          const n = Math.max(1, Math.ceil(p * pts.length));
          return (
            <g key={k}>
              <path d={pathOf(pts)} stroke={color} strokeWidth={4} fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
              {pts.slice(0, n).map((q, i) => (
                <g key={i}>
                  <circle cx={q.x} cy={q.y} r={7} fill={C.bg} stroke={color} strokeWidth={3.5} />
                  {series.length === 1 ? <Label x={q.x} y={q.y - 28} size={20} color={C.muted} mono>{fmt(ser.values[i], 1)}</Label> : null}
                </g>
              ))}
            </g>
          );
        }
        return ser.values.map((v, i) => {
          const pv = prog(frame, 14 + i * 5 + k * 3, 24);
          const x = pl.sx(i) - (bw * series.length) / 2 + k * bw;
          const y0 = pl.sy(0), y1 = pl.sy(v * pv);
          return (
            <g key={`${k}-${i}`}>
              <rect x={x + 3} y={Math.min(y0, y1)} width={bw - 6} height={Math.abs(y1 - y0)} rx={4} fill={color} opacity={0.9} />
              {pv > 0.9 ? <Label x={x + bw / 2} y={Math.min(y0, y1) - 20} size={20} color={C.muted} mono>{fmt(v, 1)}</Label> : null}
            </g>
          );
        });
      })}
      {series.length > 1 ? series.map((ser, k) => (
        <g key={`lg${k}`} transform={`translate(${pl.left + 20 + k * 260}, 10)`}>
          <rect width={18} height={18} rx={4} fill={SERIES[k % SERIES.length]} />
          <Label x={30} y={9} anchor="start" size={22} color={C.muted}>{ser.name}</Label>
        </g>
      )) : null}
    </svg>
  );
};

// ------------------------------------------------------------------- quiz
export const Quiz: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const opts = s.options as string[];
  const reveal = Math.round(dur * 0.62);
  const at = stagger(opts.length, 22, 22 + opts.length * 10);
  const timer = prog(frame, at[opts.length - 1] + 10, reveal - at[opts.length - 1] - 10, (t) => t);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ color: C.ink, fontFamily: F.sans, fontSize: 44, fontWeight: 500, lineHeight: 1.35, maxWidth: 1450, ...enter(frame, 6) }}>{s.question}</div>
      <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {opts.map((o, i) => {
          const shown = frame >= reveal;
          const right = i === s.answer;
          return (
            <div key={i} style={{
              ...card, display: "flex", alignItems: "center", gap: 22, padding: "24px 30px",
              borderColor: shown && right ? C.green : C.hair, background: shown && right ? "rgba(95,203,142,0.1)" : C.panel,
              ...enter(frame, at[i], 14, 8), opacity: (shown && !right ? 0.45 : 1) * enter(frame, at[i], 14, 8).opacity,
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: 23, border: `2px solid ${shown && right ? C.green : C.hairStrong}`,
                color: shown && right ? C.green : C.muted, fontFamily: F.mono, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center",
              }}>{String.fromCharCode(65 + i)}</div>
              <div style={{ color: C.ink, fontFamily: F.sans, fontSize: 31 }}>{o}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 34, height: 64, position: "relative" }}>
        {frame < reveal ? (
          <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: prog(frame, at[opts.length - 1] + 6, 10) }}>
            <span style={{ color: C.muted, fontFamily: F.sans, fontSize: 26 }}>Think it through</span>
            <div style={{ width: 420, height: 4, borderRadius: 2, background: C.hair }}>
              <div style={{ width: `${(1 - timer) * 100}%`, height: 4, borderRadius: 2, background: C.light }} />
            </div>
          </div>
        ) : (
          <div style={{ color: C.green, fontFamily: F.sans, fontSize: 30, lineHeight: 1.4, ...enter(frame, reveal + 6) }}>
            <span style={{ fontWeight: 600 }}>Answer {String.fromCharCode(65 + s.answer)}. </span>
            <span style={{ color: C.ink }}>{s.explanation}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ recap
export const Recap: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const items = s.items as string[];
  const at = stagger(items.length, 12, dur * 0.7);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 0 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 34, padding: "26px 0", borderBottom: i < items.length - 1 ? `1px solid ${C.hair}` : "none", ...enter(frame, at[i], 18, 10) }}>
          <svg width={40} height={40}>
            <circle cx={20} cy={20} r={18} fill="none" stroke={C.green} strokeWidth={2.5} />
            <path d="M12,21 L18,27 L29,14" stroke={C.green} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round"
              pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - prog(frame, at[i] + 8, 12)} />
          </svg>
          <div style={{ color: C.ink, fontFamily: F.sans, fontSize: 38, lineHeight: 1.3 }}>{it}</div>
        </div>
      ))}
    </div>
  );
};

export const FULL_W = W - L.padX * 2;
export const FULL_H = STAGE_H;
