// Periodic table data used by chemistry components.
export const SYMBOLS = (
  "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr " +
  "Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu " +
  "Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr " +
  "Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og"
).split(" ");

export const NAMES = [
  "Hydrogen", "Helium", "Lithium", "Beryllium", "Boron", "Carbon", "Nitrogen", "Oxygen", "Fluorine", "Neon",
  "Sodium", "Magnesium", "Aluminium", "Silicon", "Phosphorus", "Sulfur", "Chlorine", "Argon", "Potassium", "Calcium",
];
export const MASS = [1, 4, 7, 9, 11, 12, 14, 16, 19, 20, 23, 24, 27, 28, 31, 32, 35, 40, 39, 40];

export const zOf = (sym: string) => SYMBOLS.indexOf(sym) + 1;

/** Bohr shells for Z ≤ 20 as taught in school (2, 8, 8, 2). */
export const shells = (z: number) => {
  const caps = [2, 8, 8, 2];
  const out: number[] = [];
  let left = z;
  for (const c of caps) { if (left <= 0) break; const n = Math.min(c, left); out.push(n); left -= n; }
  return out;
};
export const valenceElectrons = (z: number) => { const s = shells(z); return s[s.length - 1]; };
export const valency = (z: number) => { const v = valenceElectrons(z); const full = z <= 2 ? 2 : 8; return v <= 4 ? v : full - v; };

/** Position in the standard 18-column table. f-block rows are period 8 and 9. */
export const position = (z: number): { row: number; col: number; block: "s" | "p" | "d" | "f" } => {
  if (z === 1) return { row: 1, col: 1, block: "s" };
  if (z === 2) return { row: 1, col: 18, block: "s" };
  const starts = [3, 11, 19, 37, 55, 87];
  let period = 2;
  for (let i = starts.length - 1; i >= 0; i--) if (z >= starts[i]) { period = i + 2; break; }
  const k = z - starts[period - 2]; // 0-based index within period
  if (period <= 3) {
    if (k < 2) return { row: period, col: k + 1, block: "s" };
    return { row: period, col: 13 + (k - 2), block: "p" };
  }
  if (period <= 5) {
    const col = k + 1;
    return { row: period, col, block: col <= 2 ? "s" : col <= 12 ? "d" : "p" };
  }
  if (k < 2) return { row: period, col: k + 1, block: "s" };
  if (k < 17) return { row: period + 2, col: 3 + (k - 2), block: "f" }; // La..Lu / Ac..Lr
  const col = 4 + (k - 17);
  return { row: period, col, block: col <= 12 ? "d" : "p" };
};

export const ION_CHARGE: Record<string, number> = {
  Li: 1, Na: 1, K: 1, Ag: 1, H: 1, Mg: 2, Ca: 2, Zn: 2, Cu: 2, Fe: 2, Ni: 2, Pb: 2, Sn: 2, Co: 2, Hg: 2, Pt: 2, Al: 3, Cr: 3, Au: 3,
};
export const E0: Record<string, number> = {
  Li: -3.04, K: -2.93, Ca: -2.87, Na: -2.71, Mg: -2.37, Al: -1.66, Zn: -0.76, Cr: -0.74, Fe: -0.44, Co: -0.28,
  Ni: -0.25, Sn: -0.14, Pb: -0.13, H: 0.0, Cu: 0.34, Ag: 0.8, Hg: 0.85, Pt: 1.18, Au: 1.5,
};
