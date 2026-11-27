import React from "react";
import { SceneProps } from "./types";
import * as G from "./scenes/general";
import * as O from "./scenes/optics";
import * as Fi from "./scenes/fields";
import * as Wv from "./scenes/waves";
import * as M from "./scenes/mechanics";
import * as E from "./scenes/electro";
import * as Ch from "./scenes/chemistry";
import { Mechanism } from "./scenes/mechanism";
import { Aromatic, BondOrbitals } from "./scenes/orbitals";
import * as Ma from "./scenes/maths";

type Entry = { C: React.FC<SceneProps>; notes: boolean };

/** type -> component. `notes` = renders the side notes column when notes exist. */
export const REGISTRY: Record<string, Entry> = {
  key_points: { C: G.KeyPoints, notes: false },
  definition: { C: G.Definition, notes: false },
  equation: { C: G.Equation, notes: true },
  worked_example: { C: G.WorkedExample, notes: false },
  compare: { C: G.Compare, notes: false },
  process: { C: G.Process, notes: false },
  cycle: { C: G.Cycle, notes: false },
  table: { C: G.Table, notes: false },
  chart: { C: G.Chart, notes: true },
  quiz: { C: G.Quiz, notes: false },
  recap: { C: G.Recap, notes: false },

  lens: { C: O.Lens, notes: true },
  mirror: { C: O.Mirror, notes: true },
  refraction: { C: O.Refraction, notes: true },
  prism: { C: O.Prism, notes: true },
  interference: { C: O.Interference, notes: true },
  em_wave: { C: Wv.EMWave, notes: true },
  wave: { C: Wv.Wave, notes: true },
  ac_phasor: { C: Wv.ACPhasor, notes: true },
  field_lines: { C: Fi.FieldLines, notes: true },
  magnetic_field: { C: Fi.MagneticField, notes: true },
  circuit: { C: E.Circuit, notes: true },
  induction: { C: E.Induction, notes: true },
  gas_particles: { C: E.GasParticles, notes: true },
  pv_diagram: { C: E.PVDiagram, notes: true },
  energy_levels: { C: E.EnergyLevels, notes: true },
  projectile: { C: M.Projectile, notes: true },
  motion_graph: { C: M.MotionGraph, notes: true },
  free_body: { C: M.FreeBody, notes: true },
  circular_motion: { C: M.CircularMotion, notes: true },
  orbit: { C: M.Orbit, notes: true },
  pendulum: { C: M.Pendulum, notes: true },
  spring_mass: { C: M.SpringMass, notes: true },

  atom: { C: Ch.Atom, notes: true },
  periodic_table: { C: Ch.PeriodicTable, notes: false },
  bonding: { C: Ch.Bonding, notes: true },
  vsepr: { C: Ch.VSEPR, notes: true },
  reaction: { C: Ch.Reaction, notes: true },
  ph_scale: { C: Ch.PHScale, notes: true },
  electrochemical_cell: { C: Ch.ElectroCell, notes: false },
  hydrocarbon: { C: Ch.Hydrocarbon, notes: true },
  mechanism: { C: Mechanism, notes: false },
  bond_orbitals: { C: BondOrbitals, notes: false },
  aromatic: { C: Aromatic, notes: false },

  function_graph: { C: Ma.FunctionGraph, notes: true },
  number_line: { C: Ma.NumberLine, notes: true },
  unit_circle: { C: Ma.UnitCircle, notes: true },
  right_triangle: { C: Ma.RightTriangle, notes: true },
  geometry: { C: Ma.Geometry, notes: true },
  solid: { C: Ma.Solid, notes: true },
  matrix_transform: { C: Ma.MatrixTransform, notes: false },
  matrix_multiply: { C: Ma.MatrixMultiply, notes: true },
  vectors: { C: Ma.Vectors, notes: true },
  venn: { C: Ma.Venn, notes: true },
  dice_grid: { C: Ma.DiceGrid, notes: false },
  sequence: { C: Ma.Sequence, notes: true },
};
