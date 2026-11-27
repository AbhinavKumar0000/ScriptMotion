// Visual system for every lesson video. Components read only from here so
// the whole library looks like one product.

export const W = 1920;
export const H = 1080;
export const FPS = 30;

export const C = {
  bg: "#0E1014",
  bgRaise: "#151820",
  panel: "#171B23",
  ink: "#ECEEF2",
  muted: "#A4ACB8",
  faint: "#6C7581",
  hair: "rgba(236,238,242,0.12)",
  hairStrong: "rgba(236,238,242,0.24)",
  grid: "rgba(236,238,242,0.055)",

  // semantic accents
  light: "#FFC857", // light rays, photons
  lightSoft: "rgba(255,200,87,0.18)",
  blue: "#5AA9F0", // E field, primary data, axis objects
  red: "#F0706A", // B field, positive charge, warnings
  green: "#5FCB8E", // correct, results
  violet: "#A98BFA",
  teal: "#3FC1C9",
  orange: "#F59E4B",
  pos: "#F0706A",
  neg: "#5AA9F0",
  glass: "rgba(140,190,235,0.16)",
  glassEdge: "rgba(160,205,245,0.55)",
  water: "rgba(90,169,240,0.14)",
} as const;

export const SERIES = [C.blue, C.orange, C.green, C.violet, C.red, C.teal];

export const F = {
  // display serif pairs with KaTeX's Computer Modern math; Inter carries labels and subtitles
  serif: "'Source Serif 4', 'Georgia', serif",
  sans: "'Inter', 'Segoe UI', 'Nirmala UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Cascadia Mono', Consolas, monospace",
};

// Layout grid (px, 1920x1080). No persistent chrome: a scene title top-left,
// the stage, and subtitles at the bottom.
export const L = {
  padX: 120,
  headerTop: 64,
  stageTop: 168,
  stageBottom: 872,
  captionTop: 912,
  notesWidth: 440,
  gap: 72,
};
export const STAGE_W = W - L.padX * 2; // 1680
export const STAGE_H = L.stageBottom - L.stageTop; // 704
export const DIAGRAM_W = STAGE_W - L.notesWidth - L.gap; // 1168

/** frames two neighbouring scenes overlap while one hands over to the next */
export const OVERLAP = 30;

export const T = {
  title: { fontSize: 50, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.1 },
  body: { fontSize: 36, fontWeight: 500, lineHeight: 1.38 },
  note: { fontSize: 29, fontWeight: 400, lineHeight: 1.4 },
  label: { fontSize: 26, fontWeight: 500 },
  small: { fontSize: 22, fontWeight: 500 },
} as const;
