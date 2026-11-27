"""Scene catalog: every pre-built Remotion component the model may use.

Each entry is the single source of truth for one component:
  - `use`      when the planner should pick it (shown in the outline prompt)
  - `fields`   the exact data contract (shown only to the batch that needs it)
  - `example`  a known-good instance, used in prompts and as the render
               fixture for the component check (`python check_components.py`)

The model never writes code or coordinates for physics: it picks the setup
(focal length, charges, angle...) and the renderer computes the result, so
the diagram is always physically correct whichever model wrote the spec.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from src.schema import Bool, Enum, Field, List, Num, Obj, Str, Tex


@dataclass
class SceneType:
    name: str
    subject: str  # general | physics | chemistry | maths
    use: str
    fields: dict[str, Field]
    example: dict
    base_seconds: float = 9.0
    notes: bool = True  # renders a side column of `notes`
    chapters: str = ""


def pt(desc: str = "") -> Obj:
    return Obj(desc=desc, fields={"x": Num(lo=-10, hi=10), "y": Num(lo=-10, hi=10)})


LABEL = Str(max=28)
SHORT = Str(max=60)
LINE = Str(max=110)

CATALOG: dict[str, SceneType] = {}


def add(scene: SceneType) -> None:
    CATALOG[scene.name] = scene


# ============================================================== general
add(SceneType(
    "title", "general",
    "Opening card. Always the first scene.",
    {
        "kicker": Str(max=64, desc="subject · chapter, e.g. 'Physics · Ray Optics'"),
        "subtitle": Str(max=110, desc="the one question this lesson answers"),
    },
    {"title": "How a convex lens forms an image", "kicker": "Physics · Ray Optics",
     "subtitle": "Why does the image flip, and when does it become virtual?",
     "caption": "In this lesson we trace three rays through a convex lens to find where the image forms."},
    base_seconds=5, notes=False,
))
add(SceneType(
    "key_points", "general",
    "2-4 short ideas with a one-line explanation each. Use sparingly; prefer a visual scene.",
    {"items": List(item=Obj(fields={"label": Str(max=32), "text": Str(max=100)}), lo=2, hi=4)},
    {"title": "What the lens does", "caption": "A convex lens bends every ray toward its axis.",
     "items": [{"label": "Converging", "text": "Parallel rays meet at the principal focus F."},
               {"label": "Optical centre", "text": "A ray through the centre passes undeviated."}]},
    base_seconds=7, notes=False,
))
add(SceneType(
    "definition", "general",
    "A term, its precise meaning, an optional formula with symbol meanings.",
    {
        "term": Str(max=40),
        "meaning": Str(max=170),
        "formula": Tex(optional=True),
        "symbols": List(item=Obj(fields={"symbol": Tex(max=40), "meaning": Str(max=64)}), lo=0, hi=4, default=list),
    },
    {"title": "Power of a lens", "caption": "Power measures how strongly a lens bends light.",
     "term": "Power", "meaning": "The reciprocal of focal length in metres. Converging lenses have positive power.",
     "formula": "P = \\frac{1}{f}", "symbols": [{"symbol": "P", "meaning": "power in dioptre (D)"},
                                               {"symbol": "f", "meaning": "focal length in metres"}]},
    base_seconds=8, notes=False,
))
add(SceneType(
    "equation", "general",
    "A derivation or algebraic manipulation shown line by line (2-6 lines).",
    {"steps": List(item=Obj(fields={"tex": Tex(), "note": Str(max=60, optional=True)}), lo=2, hi=6),
     "result_index": Num(lo=-1, hi=5, integer=True, default=-1, desc="step to box as the result, -1 = last")},
    {"title": "Solving for image distance", "caption": "Rearrange the lens formula to isolate v.",
     "steps": [{"tex": "\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}", "note": "lens formula"},
               {"tex": "\\frac{1}{v} = \\frac{1}{f} + \\frac{1}{u}", "note": "add 1/u to both sides"},
               {"tex": "v = \\frac{uf}{u + f}", "note": "combine fractions"}]},
    base_seconds=4,
))
add(SceneType(
    "worked_example", "general",
    "A numerical problem solved step by step: given values, steps, boxed answer. Include at least one per lesson.",
    {"problem": Str(max=170),
     "given": List(item=Tex(max=100), lo=1, hi=4),
     "steps": List(item=Obj(fields={"tex": Tex(), "note": Str(max=60, optional=True)}), lo=2, hi=5),
     "answer": Str(max=60)},
    {"title": "Worked example", "caption": "Let us find where the image of a 4 cm object forms.",
     "problem": "An object is placed 30 cm in front of a convex lens of focal length 20 cm. Find the image distance.",
     "given": ["u = -30\\,\\text{cm}", "f = +20\\,\\text{cm}"],
     "steps": [{"tex": "\\frac{1}{v} = \\frac{1}{f} + \\frac{1}{u}", "note": "lens formula"},
               {"tex": "\\frac{1}{v} = \\frac{1}{20} - \\frac{1}{30} = \\frac{1}{60}"},
               {"tex": "v = +60\\,\\text{cm}"}],
     "answer": "Real image, 60 cm behind the lens"},
    base_seconds=6, notes=False,
))
add(SceneType(
    "compare", "general",
    "Two things side by side (2-4 rows each).",
    {"left": Obj(fields={"heading": Str(max=44), "items": List(item=Str(max=60), lo=2, hi=4)}),
     "right": Obj(fields={"heading": Str(max=44), "items": List(item=Str(max=60), lo=2, hi=4)})},
    {"title": "Real vs virtual image", "caption": "The difference is whether light actually meets there.",
     "left": {"heading": "Real image", "items": ["Rays actually converge", "Can be caught on a screen", "Inverted"]},
     "right": {"heading": "Virtual image", "items": ["Rays only appear to diverge", "Cannot be projected", "Erect"]}},
    base_seconds=8, notes=False,
))
add(SceneType(
    "process", "general",
    "An ordered sequence of 3-6 stages connected by arrows (lab procedure, industrial process, algorithm).",
    {"steps": List(item=Obj(fields={"label": Str(max=26), "detail": Str(max=70)}), lo=3, hi=6)},
    {"title": "Haber process", "caption": "Ammonia is made in a continuous loop.",
     "steps": [{"label": "Mix N₂ + H₂", "detail": "1 : 3 ratio by volume"},
               {"label": "Compress", "detail": "about 200 atm"},
               {"label": "Iron catalyst", "detail": "450 °C reactor"},
               {"label": "Cool & separate", "detail": "NH₃ liquefies; gases recycled"}]},
    base_seconds=9, notes=False,
))
add(SceneType(
    "cycle", "general",
    "3-6 stages that repeat in a loop (thermodynamic cycle, refrigeration, rock cycle).",
    {"stages": List(item=Obj(fields={"label": Str(max=24), "detail": Str(max=60)}), lo=3, hi=6)},
    {"title": "Carnot cycle", "caption": "An ideal engine passes through four reversible stages.",
     "stages": [{"label": "Isothermal expansion", "detail": "absorbs heat Q₁ at T₁"},
                {"label": "Adiabatic expansion", "detail": "cools from T₁ to T₂"},
                {"label": "Isothermal compression", "detail": "rejects Q₂ at T₂"},
                {"label": "Adiabatic compression", "detail": "heats back to T₁"}]},
    base_seconds=9, notes=False,
))
add(SceneType(
    "table", "general",
    "A compact data table (2-5 columns, 2-6 rows). Cells are short text.",
    {"columns": List(item=Str(max=22), lo=2, hi=5),
     "rows": List(item=List(item=Str(max=26), lo=1, hi=5), lo=2, hi=6),
     "highlight_row": Num(lo=-1, hi=5, integer=True, default=-1)},
    {"title": "Image formation by a convex lens", "caption": "Where the object sits decides the image.",
     "columns": ["Object at", "Image at", "Nature"],
     "rows": [["Beyond 2F", "Between F and 2F", "Real, diminished"],
              ["At 2F", "At 2F", "Real, same size"],
              ["Between F and 2F", "Beyond 2F", "Real, enlarged"],
              ["Inside F", "Same side", "Virtual, enlarged"]], "highlight_row": 2},
    base_seconds=9, notes=False,
))
add(SceneType(
    "chart", "general",
    "Bar or line chart of real data (statistics, experimental readings, trends).",
    {"kind": Enum(options=("bar", "line"), default="bar"),
     "categories": List(item=Str(max=14), lo=2, hi=10),
     "series": List(item=Obj(fields={"name": Str(max=20), "values": List(item=Num(lo=-1e6, hi=1e6), lo=2, hi=10)}), lo=1, hi=3),
     "y_label": Str(max=30, default=""), "x_label": Str(max=30, default="")},
    {"title": "First ionisation energy", "caption": "Ionisation energy rises across period 2.", "kind": "line",
     "categories": ["Li", "Be", "B", "C", "N", "O", "F", "Ne"],
     "series": [{"name": "IE (kJ/mol)", "values": [520, 899, 801, 1086, 1402, 1314, 1681, 2081]}],
     "y_label": "kJ/mol", "x_label": "element"},
))
add(SceneType(
    "quiz", "general",
    "A check-your-understanding question with 3-4 options; the answer is revealed with a reason. Use once near the end.",
    {"question": Str(max=140), "options": List(item=Str(max=60), lo=3, hi=4),
     "answer": Num(lo=0, hi=3, integer=True, desc="index of the correct option"),
     "explanation": Str(max=140)},
    {"title": "Quick check", "caption": "Pause and predict before the answer appears.",
     "question": "An object is placed between F and the optical centre of a convex lens. The image is:",
     "options": ["Real and inverted", "Virtual and erect", "At infinity", "Real and diminished"],
     "answer": 1, "explanation": "Refracted rays diverge, so they only appear to meet on the object's side."},
    base_seconds=10, notes=False,
))
add(SceneType(
    "recap", "general",
    "Closing summary of 3-5 takeaways. Always the last scene.",
    {"items": List(item=Str(max=110, desc="one complete takeaway sentence, max ~14 words"), lo=3, hi=5)},
    {"title": "Recap", "caption": "Three rays are enough to locate any image.",
     "items": ["Parallel ray refracts through F", "Central ray goes straight", "1/v − 1/u = 1/f gives the image distance"]},
    base_seconds=7, notes=False,
))

# ============================================================== physics
add(SceneType(
    "lens", "physics",
    "Thin lens ray diagram with three principal rays; image position, size and nature are computed.",
    {"lens": Enum(options=("convex", "concave"), default="convex"),
     "focal_length": Num(lo=5, hi=50, unit="cm", default=15),
     "object_distance": Num(lo=3, hi=100, unit="cm", default=30, desc="distance from lens, positive"),
     "object_height": Num(lo=1, hi=10, unit="cm", default=4)},
    {"title": "Object between F and 2F", "caption": "Two rays are enough to locate the tip of the image.",
     "lens": "convex", "focal_length": 15, "object_distance": 22, "object_height": 4,
     "notes": ["Ray 1 refracts through F", "Ray 2 passes through O undeviated", "Image is real and enlarged"]},
    chapters="Light: reflection & refraction; Ray optics",
))
add(SceneType(
    "mirror", "physics",
    "Spherical mirror ray diagram (concave or convex); image computed with the mirror formula.",
    {"mirror": Enum(options=("concave", "convex"), default="concave"),
     "focal_length": Num(lo=5, hi=50, unit="cm", default=15),
     "object_distance": Num(lo=3, hi=100, unit="cm", default=30),
     "object_height": Num(lo=1, hi=10, unit="cm", default=4)},
    {"title": "Concave mirror, object beyond C", "caption": "The reflected rays meet between F and C.",
     "mirror": "concave", "focal_length": 12, "object_distance": 34, "object_height": 4},
    chapters="Light: reflection; Ray optics",
))
add(SceneType(
    "refraction", "physics",
    "A ray crossing a boundary between two media with Snell's law; shows normal, angles, partial reflection, total internal reflection past the critical angle.",
    {"n1": Num(lo=1, hi=2.5, default=1.0), "n2": Num(lo=1, hi=2.5, default=1.5),
     "medium1": Str(max=16, default="Air"), "medium2": Str(max=16, default="Glass"),
     "incidence_deg": Num(lo=0, hi=85, default=40),
     "sweep": Bool(default=False, desc="animate the incidence angle up to 85° to show the critical angle")},
    {"title": "Light entering glass", "caption": "The ray bends toward the normal in the denser medium.",
     "n1": 1.0, "n2": 1.5, "medium1": "Air", "medium2": "Glass", "incidence_deg": 45, "sweep": False},
    chapters="Refraction; Total internal reflection",
))
add(SceneType(
    "prism", "physics",
    "White light through a triangular prism: deviation and dispersion into a spectrum.",
    {"apex_deg": Num(lo=30, hi=75, default=60), "dispersion": Bool(default=True)},
    {"title": "Dispersion by a prism", "caption": "Violet bends the most because glass slows it the most.",
     "apex_deg": 60, "dispersion": True},
    chapters="Human eye & colourful world; Ray optics",
))
add(SceneType(
    "interference", "physics",
    "Young's double slit: wavefronts from two slits overlap and form bright and dark fringes on a screen.",
    {"slit_separation": Num(lo=0.5, hi=3, default=1.2, desc="relative units"),
     "wavelength": Num(lo=0.3, hi=1.5, default=0.6, desc="relative units")},
    {"title": "Young's double slit", "caption": "Where crests meet crests, the screen is bright.",
     "slit_separation": 1.2, "wavelength": 0.6},
    chapters="Wave optics",
))
add(SceneType(
    "em_wave", "physics",
    "Electromagnetic wave in 3D: perpendicular E and B fields oscillating in phase and travelling along x.",
    {"cycles": Num(lo=1, hi=4, default=2.5), "show_labels": Bool(default=True)},
    {"title": "An electromagnetic wave", "caption": "E and B oscillate at right angles and in step.",
     "cycles": 2.5, "show_labels": True},
    chapters="Electromagnetic waves",
))
add(SceneType(
    "wave", "physics",
    "1D waves: transverse, longitudinal (particle compressions), standing wave, or superposition of two waves.",
    {"mode": Enum(options=("transverse", "longitudinal", "standing", "superposition"), default="transverse"),
     "amplitude": Num(lo=0.2, hi=1, default=0.7), "wavelength": Num(lo=0.5, hi=4, default=2),
     "wave2_wavelength": Num(lo=0.5, hi=4, default=1.6, desc="second wave, superposition only"),
     "harmonic": Num(lo=1, hi=5, integer=True, default=3, desc="standing mode only"),
     "annotate": Bool(default=True, desc="mark wavelength and amplitude")},
    {"title": "Transverse wave", "caption": "Each particle moves up and down while the wave moves right.",
     "mode": "transverse", "amplitude": 0.7, "wavelength": 2, "annotate": True},
    chapters="Sound; Waves",
))
add(SceneType(
    "field_lines", "physics",
    "Electric field lines (computed) and optional equipotentials around 1-4 point charges.",
    {"charges": List(item=Obj(fields={"q": Num(lo=-3, hi=3, integer=True), "x": Num(lo=-4, hi=4), "y": Num(lo=-2.5, hi=2.5)}), lo=1, hi=4),
     "equipotentials": Bool(default=False)},
    {"title": "Field of an electric dipole", "caption": "Lines leave the positive charge and end on the negative one.",
     "charges": [{"q": 1, "x": -1.6, "y": 0}, {"q": -1, "x": 1.6, "y": 0}], "equipotentials": True},
    chapters="Electric charges & fields; Electrostatic potential",
))
add(SceneType(
    "magnetic_field", "physics",
    "Magnetic field pattern of a bar magnet, a straight current-carrying wire (concentric circles), or a solenoid.",
    {"source": Enum(options=("bar_magnet", "straight_wire", "solenoid"), default="bar_magnet"),
     "current_out_of_page": Bool(default=True, desc="straight_wire only")},
    {"title": "Field around a bar magnet", "caption": "Field lines run from north to south outside the magnet.",
     "source": "bar_magnet"},
    chapters="Magnetic effects of current; Moving charges & magnetism",
))
add(SceneType(
    "circuit", "physics",
    "DC circuit with a battery and 1-3 resistors in series or parallel; currents and voltages are computed, charge flow animated.",
    {"voltage": Num(lo=1, hi=24, unit="V", default=6),
     "resistors": List(item=Num(lo=1, hi=100), lo=1, hi=3, desc="ohms"),
     "arrangement": Enum(options=("series", "parallel"), default="series")},
    {"title": "Resistors in series", "caption": "The same current flows through every resistor.",
     "voltage": 12, "resistors": [2, 4], "arrangement": "series"},
    chapters="Electricity; Current electricity",
))
add(SceneType(
    "induction", "physics",
    "Faraday's law: a bar magnet moves into and out of a coil; the galvanometer needle deflects opposite ways.",
    {"turns": Num(lo=3, hi=10, integer=True, default=6)},
    {"title": "Electromagnetic induction", "caption": "Only a changing flux drives a current.", "turns": 6},
    chapters="Electromagnetic induction",
))
add(SceneType(
    "ac_phasor", "physics",
    "Rotating phasor generating a sinusoid; optional second phasor with a phase lead/lag (AC circuits).",
    {"phase_deg": Num(lo=-90, hi=90, default=0, desc="phase of current relative to voltage; 0 = one wave only"),
     "label1": Str(max=8, default="V"), "label2": Str(max=8, default="I")},
    {"title": "Current lags in an inductor", "caption": "In a pure inductor the current trails the voltage by 90°.",
     "phase_deg": -90, "label1": "V", "label2": "I"},
    chapters="Alternating current",
))
add(SceneType(
    "projectile", "physics",
    "Projectile trajectory with velocity components; range, max height and time of flight computed.",
    {"speed": Num(lo=5, hi=50, unit="m/s", default=20), "angle_deg": Num(lo=10, hi=80, default=45),
     "g": Num(lo=1, hi=25, default=9.8), "show_components": Bool(default=True)},
    {"title": "Projectile at 45°", "caption": "Horizontal velocity stays constant; vertical velocity changes.",
     "speed": 20, "angle_deg": 45, "g": 9.8, "show_components": True},
    chapters="Motion in a plane",
))
add(SceneType(
    "motion_graph", "physics",
    "Uniformly accelerated motion: a moving body plus synchronized position-time and velocity-time graphs.",
    {"initial_velocity": Num(lo=0, hi=30, unit="m/s", default=0), "acceleration": Num(lo=-5, hi=5, unit="m/s²", default=2),
     "time_span": Num(lo=2, hi=12, unit="s", default=6)},
    {"title": "Uniform acceleration", "caption": "The v-t graph is a straight line; its slope is the acceleration.",
     "initial_velocity": 2, "acceleration": 1.5, "time_span": 6},
    chapters="Motion; Motion in a straight line",
))
add(SceneType(
    "free_body", "physics",
    "Block on a horizontal or inclined surface with labelled force vectors (weight, normal, friction, applied); net force computed.",
    {"incline_deg": Num(lo=0, hi=60, default=30), "mass": Num(lo=0.5, hi=50, unit="kg", default=5),
     "friction_coefficient": Num(lo=0, hi=1, default=0.2), "applied_force": Num(lo=0, hi=500, unit="N", default=0)},
    {"title": "Block on an incline", "caption": "Resolve the weight along and perpendicular to the slope.",
     "incline_deg": 30, "mass": 5, "friction_coefficient": 0.2, "applied_force": 0},
    chapters="Force & laws of motion; Laws of motion",
))
add(SceneType(
    "circular_motion", "physics",
    "Uniform circular motion with velocity (tangent) and centripetal acceleration vectors.",
    {"radius": Num(lo=0.5, hi=20, unit="m", default=2), "speed": Num(lo=0.5, hi=30, unit="m/s", default=4)},
    {"title": "Centripetal acceleration", "caption": "Velocity is tangent; acceleration points to the centre.",
     "radius": 2, "speed": 4},
    chapters="Motion in a plane; Laws of motion",
))
add(SceneType(
    "orbit", "physics",
    "Satellite orbiting a planet with gravitational force and velocity vectors; orbital speed and period computed.",
    {"planet": Str(max=16, default="Earth"), "altitude_km": Num(lo=100, hi=40000, default=400)},
    {"title": "A satellite in orbit", "caption": "Gravity supplies exactly the centripetal force needed.",
     "planet": "Earth", "altitude_km": 400},
    chapters="Gravitation",
))
add(SceneType(
    "pendulum", "physics",
    "Simple pendulum with kinetic/potential energy bars exchanging; period computed from length.",
    {"length": Num(lo=0.1, hi=5, unit="m", default=1), "amplitude_deg": Num(lo=5, hi=40, default=25),
     "show_energy": Bool(default=True)},
    {"title": "Energy in a pendulum", "caption": "Potential energy turns into kinetic energy and back.",
     "length": 1, "amplitude_deg": 25, "show_energy": True},
    chapters="Work & energy; Oscillations",
))
add(SceneType(
    "spring_mass", "physics",
    "Mass on a spring in SHM with a live displacement-time graph; period from k and m.",
    {"mass": Num(lo=0.1, hi=10, unit="kg", default=1), "spring_constant": Num(lo=1, hi=500, unit="N/m", default=40),
     "amplitude": Num(lo=0.02, hi=0.5, unit="m", default=0.1)},
    {"title": "Simple harmonic motion", "caption": "Displacement traces a sine curve over time.",
     "mass": 1, "spring_constant": 40, "amplitude": 0.1},
    chapters="Oscillations",
))
add(SceneType(
    "gas_particles", "physics",
    "Kinetic theory: gas molecules bouncing in a container; optional piston compression; temperature sets speed.",
    {"particles": Num(lo=10, hi=80, integer=True, default=40), "temperature": Num(lo=100, hi=1000, unit="K", default=300),
     "compress": Bool(default=False, desc="piston halves the volume (Boyle's law)")},
    {"title": "Pressure from collisions", "caption": "Pressure is the force of molecules striking the walls.",
     "particles": 40, "temperature": 300, "compress": True},
    chapters="Kinetic theory; States of matter",
))
add(SceneType(
    "pv_diagram", "physics",
    "Thermodynamic process on a P-V diagram (isothermal, adiabatic, isobaric, isochoric, or a cycle); work shaded.",
    {"process": Enum(options=("isothermal", "adiabatic", "isobaric", "isochoric", "carnot"), default="isothermal"),
     "v1": Num(lo=1, hi=10, default=2), "v2": Num(lo=1, hi=10, default=6)},
    {"title": "Isothermal expansion", "caption": "The area under the curve is the work done by the gas.",
     "process": "isothermal", "v1": 2, "v2": 6},
    chapters="Thermodynamics",
))
add(SceneType(
    "energy_levels", "physics",
    "Hydrogen atom energy levels with an electron transition emitting or absorbing a photon; energy and wavelength computed.",
    {"from_level": Num(lo=1, hi=6, integer=True, default=3), "to_level": Num(lo=1, hi=6, integer=True, default=2)},
    {"title": "Balmer line Hα", "caption": "An electron dropping from n = 3 to n = 2 emits red light.",
     "from_level": 3, "to_level": 2},
    chapters="Atoms; Dual nature",
))

# ============================================================== chemistry
add(SceneType(
    "atom", "chemistry",
    "Bohr model of an element (Z 1-20): nucleus, shells filling with electrons, electronic configuration and valency.",
    {"element": Str(max=14, desc="symbol or name, e.g. 'Na'")},
    {"title": "Sodium has one valence electron", "caption": "Electrons fill shells as 2, 8, then 1.", "element": "Na"},
    chapters="Structure of the atom",
))
add(SceneType(
    "periodic_table", "chemistry",
    "Periodic table with highlighted elements, groups or a block, and an optional trend arrow.",
    {"highlight": List(item=Str(max=3), lo=0, hi=20, default=list, desc="element symbols"),
     "highlight_group": Num(lo=0, hi=18, integer=True, default=0, desc="0 = none"),
     "block": Enum(options=("none", "s", "p", "d", "f"), default="none"),
     "trend": Enum(options=("none", "atomic_radius", "ionisation_energy", "electronegativity", "metallic_character"), default="none")},
    {"title": "Electronegativity trend", "caption": "Electronegativity rises across a period and falls down a group.",
     "highlight": ["F", "O", "N", "Cl"], "trend": "electronegativity"},
    chapters="Periodic classification",
))
add(SceneType(
    "bonding", "chemistry",
    "Ionic bond (electron transfer) or covalent bond (shared pairs) between two elements, with outer shells drawn.",
    {"kind": Enum(options=("ionic", "covalent"), default="ionic"),
     "atom_a": Str(max=3), "atom_b": Str(max=3),
     "count_b": Num(lo=1, hi=4, integer=True, default=1, desc="number of B atoms, e.g. 2 for H2O with A=O B=H")},
    {"title": "Forming sodium chloride", "caption": "Sodium gives its outer electron to chlorine.",
     "kind": "ionic", "atom_a": "Na", "atom_b": "Cl", "count_b": 1},
    chapters="Chemical bonding; Carbon compounds",
))
add(SceneType(
    "vsepr", "chemistry",
    "3D molecular geometry (VSEPR) rotating slowly, with bond angle.",
    {"shape": Enum(options=("linear", "bent", "trigonal_planar", "trigonal_pyramidal", "tetrahedral", "trigonal_bipyramidal", "octahedral"), default="tetrahedral"),
     "central": Str(max=3, default="C"), "outer": Str(max=3, default="H")},
    {"title": "Methane is tetrahedral", "caption": "Four bond pairs spread out to 109.5°.",
     "shape": "tetrahedral", "central": "C", "outer": "H"},
    chapters="Chemical bonding & molecular structure",
))
add(SceneType(
    "reaction", "chemistry",
    "A chemical equation (mhchem) with optional condition over the arrow and an atom-count check that it balances.",
    {"reactants": List(item=Obj(fields={"formula": Str(max=20), "coefficient": Num(lo=1, hi=20, integer=True, default=1)}), lo=1, hi=4),
     "products": List(item=Obj(fields={"formula": Str(max=20), "coefficient": Num(lo=1, hi=20, integer=True, default=1)}), lo=1, hi=4),
     "condition": Str(max=24, default=""), "reversible": Bool(default=False)},
    {"title": "Combustion of methane", "caption": "Count the atoms on each side to check the balance.",
     "reactants": [{"formula": "CH4", "coefficient": 1}, {"formula": "O2", "coefficient": 2}],
     "products": [{"formula": "CO2", "coefficient": 1}, {"formula": "H2O", "coefficient": 2}], "condition": "", "reversible": False},
    chapters="Chemical reactions & equations",
))
add(SceneType(
    "ph_scale", "chemistry",
    "pH scale 0-14 with colour gradient and 2-5 labelled substances.",
    {"substances": List(item=Obj(fields={"name": Str(max=18), "ph": Num(lo=0, hi=14)}), lo=2, hi=5)},
    {"title": "Where common liquids sit", "caption": "Below 7 is acidic, above 7 is basic.",
     "substances": [{"name": "Lemon juice", "ph": 2.2}, {"name": "Pure water", "ph": 7}, {"name": "Baking soda", "ph": 8.3}, {"name": "Bleach", "ph": 12.5}]},
    chapters="Acids, bases & salts; Equilibrium",
))
add(SceneType(
    "electrochemical_cell", "chemistry",
    "Galvanic cell with two electrodes, salt bridge, electron flow and half reactions; EMF computed from standard potentials.",
    {"anode": Str(max=3, default="Zn"), "cathode": Str(max=3, default="Cu")},
    {"title": "The Daniell cell", "caption": "Zinc is oxidised and copper ions are reduced.", "anode": "Zn", "cathode": "Cu"},
    chapters="Electrochemistry",
))
add(SceneType(
    "hydrocarbon", "chemistry",
    "Structural formula of a straight-chain organic molecule (1-6 carbons) with bond type and functional group; IUPAC name shown.",
    {"carbons": Num(lo=1, hi=6, integer=True, default=2),
     "bond": Enum(options=("single", "double", "triple"), default="single", desc="between C1 and C2"),
     "group": Enum(options=("none", "alcohol", "aldehyde", "ketone", "carboxylic_acid", "chloro"), default="none")},
    {"title": "Ethanol", "caption": "Replacing one hydrogen with –OH makes an alcohol.",
     "carbons": 2, "bond": "single", "group": "alcohol"},
    chapters="Carbon & its compounds; Organic chemistry",
))

# ============================================================== maths
add(SceneType(
    "function_graph", "maths",
    "Cartesian plot of 1-3 functions of x with optional marked points, tangent line, shaded area (integral), or intersection.",
    {"functions": List(item=Obj(fields={"expr": Str(max=60, desc="in x, e.g. 'x^2 - 2*x' or 'sin(x)'"), "label": Tex(max=100)}), lo=1, hi=3),
     "x_min": Num(lo=-50, hi=50, default=-5), "x_max": Num(lo=-50, hi=50, default=5),
     "y_min": Num(lo=-100, hi=100, optional=True), "y_max": Num(lo=-100, hi=100, optional=True),
     "points": List(item=Obj(fields={"x": Num(lo=-50, hi=50), "label": Str(max=20, default="")}), lo=0, hi=4, default=list, desc="points on the first function"),
     "tangent_at": Num(lo=-50, hi=50, optional=True, desc="x where to draw the tangent to the first function"),
     "area": Obj(optional=True, fields={"from": Num(lo=-50, hi=50), "to": Num(lo=-50, hi=50)}),
     "show_intersections": Bool(default=False)},
    {"title": "Slope of a parabola", "caption": "The tangent's slope at x = 1 equals the derivative 2x.",
     "functions": [{"expr": "x^2", "label": "y = x^2"}], "x_min": -3, "x_max": 3,
     "points": [{"x": 1, "label": "(1, 1)"}], "tangent_at": 1},
    chapters="Polynomials; Linear equations; Quadratic equations; Relations & functions; Limits & derivatives; Integrals",
))
add(SceneType(
    "number_line", "maths",
    "Number line with marked points and shaded intervals (inequalities, integers, rationals, absolute value).",
    {"min": Num(lo=-100, hi=100, default=-5), "max": Num(lo=-100, hi=100, default=5),
     "points": List(item=Obj(fields={"value": Num(lo=-100, hi=100), "label": Str(max=10, default=""), "open": Bool(default=False)}), lo=0, hi=6, default=list),
     "intervals": List(item=Obj(fields={"from": Num(lo=-100, hi=100), "to": Num(lo=-100, hi=100)}), lo=0, hi=3, default=list)},
    {"title": "Solving −2 < x ≤ 3", "caption": "Open circle excludes −2; filled circle includes 3.",
     "min": -5, "max": 5, "points": [{"value": -2, "label": "−2", "open": True}, {"value": 3, "label": "3", "open": False}],
     "intervals": [{"from": -2, "to": 3}]},
    chapters="Number systems; Linear inequalities",
))
add(SceneType(
    "unit_circle", "maths",
    "Unit circle with an angle sweeping; sin and cos shown as projections and traced as a wave.",
    {"angle_deg": Num(lo=0, hi=360, default=60, desc="angle highlighted at the end"),
     "trace_wave": Bool(default=True)},
    {"title": "Sine and cosine from the unit circle", "caption": "cos θ is the x-coordinate, sin θ the y-coordinate.",
     "angle_deg": 60, "trace_wave": True},
    chapters="Introduction to trigonometry; Trigonometric functions",
))
add(SceneType(
    "right_triangle", "maths",
    "Right triangle with sides a, b, hypotenuse c, optional squares on sides (Pythagoras) or trig ratios for angle θ.",
    {"a": Num(lo=1, hi=20, default=3), "b": Num(lo=1, hi=20, default=4),
     "mode": Enum(options=("pythagoras", "trig_ratios"), default="pythagoras")},
    {"title": "Pythagoras theorem", "caption": "The square on the hypotenuse equals the sum of the other two squares.",
     "a": 3, "b": 4, "mode": "pythagoras"},
    chapters="Triangles; Trigonometry",
))
add(SceneType(
    "geometry", "maths",
    "Geometric construction on a grid: points, segments, circles, polygons and angle marks drawn in order (coordinate geometry, circles, tangents, theorems).",
    {"points": List(item=Obj(fields={"id": Str(max=3), "x": Num(lo=-10, hi=10), "y": Num(lo=-6, hi=6)}), lo=2, hi=10),
     "segments": List(item=Obj(fields={"from": Str(max=3), "to": Str(max=3), "label": Str(max=12, default=""), "dashed": Bool(default=False)}), lo=0, hi=12, default=list),
     "circles": List(item=Obj(fields={"center": Str(max=3), "radius": Num(lo=0.3, hi=8)}), lo=0, hi=3, default=list),
     "polygons": List(item=List(item=Str(max=3), lo=3, hi=6), lo=0, hi=2, default=list),
     "angles": List(item=Obj(fields={"at": Str(max=3), "from": Str(max=3), "to": Str(max=3), "label": Str(max=10, default="")}), lo=0, hi=4, default=list),
     "show_grid": Bool(default=True)},
    {"title": "Tangent is perpendicular to radius", "caption": "The radius to the point of contact meets the tangent at 90°.",
     "points": [{"id": "O", "x": 0, "y": 0}, {"id": "P", "x": 0, "y": 3}, {"id": "A", "x": -4, "y": 3}, {"id": "B", "x": 4, "y": 3}],
     "segments": [{"from": "O", "to": "P", "label": "r"}, {"from": "A", "to": "B", "label": ""}],
     "circles": [{"center": "O", "radius": 3}], "angles": [{"at": "P", "from": "O", "to": "B", "label": "90°"}], "show_grid": False},
    chapters="Coordinate geometry; Circles; Triangles; Constructions; Straight lines; Conic sections",
))
add(SceneType(
    "solid", "maths",
    "Rotating 3D solid with labelled dimensions; surface area and volume computed.",
    {"shape": Enum(options=("cube", "cuboid", "cylinder", "cone", "sphere", "hemisphere"), default="cylinder"),
     "a": Num(lo=0.5, hi=50, default=3, desc="side / length / radius"),
     "b": Num(lo=0.5, hi=50, default=4, desc="breadth (cuboid) or height (cylinder, cone)"),
     "c": Num(lo=0.5, hi=50, default=2, desc="height (cuboid only)"), "unit": Str(max=4, default="cm")},
    {"title": "Volume of a cylinder", "caption": "Area of the base times the height.", "shape": "cylinder", "a": 3, "b": 7, "unit": "cm"},
    chapters="Surface areas & volumes; Mensuration",
))
add(SceneType(
    "matrix_transform", "maths",
    "A 2×2 matrix transforming the plane: grid and basis vectors morph; determinant shown as area change.",
    {"matrix": List(item=List(item=Num(lo=-4, hi=4), lo=2, hi=2), lo=2, hi=2, desc="[[a, b], [c, d]] row-major"),
     "vector": List(item=Num(lo=-4, hi=4), lo=0, hi=2, default=list, desc="optional [x, y] to follow")},
    {"title": "A shear transformation", "caption": "Columns of the matrix are where î and ĵ land.",
     "matrix": [[1, 1], [0, 1]], "vector": [1, 2]},
    chapters="Matrices; Determinants",
))
add(SceneType(
    "matrix_multiply", "maths",
    "Matrix product computed entry by entry, highlighting each row × column (up to 3×3).",
    {"A": List(item=List(item=Num(lo=-99, hi=99), lo=1, hi=3), lo=1, hi=3),
     "B": List(item=List(item=Num(lo=-99, hi=99), lo=1, hi=3), lo=1, hi=3)},
    {"title": "Multiplying two matrices", "caption": "Each entry is a row of A dotted with a column of B.",
     "A": [[1, 2], [3, 4]], "B": [[5, 6], [7, 8]]},
    chapters="Matrices",
))
add(SceneType(
    "vectors", "maths",
    "2D vectors on a grid with addition (triangle law), subtraction, projection, or components.",
    {"vectors": List(item=Obj(fields={"x": Num(lo=-6, hi=6), "y": Num(lo=-4, hi=4), "label": Str(max=6)}), lo=1, hi=2),
     "operation": Enum(options=("none", "add", "subtract", "projection", "components"), default="add")},
    {"title": "Triangle law of addition", "caption": "Place b at the head of a; the sum joins tail to head.",
     "vectors": [{"x": 3, "y": 1, "label": "a"}, {"x": 1, "y": 2.5, "label": "b"}], "operation": "add"},
    chapters="Vector algebra; Motion in a plane",
))
add(SceneType(
    "venn", "maths",
    "Venn diagram of 2 or 3 sets with elements placed in regions; optional highlighted operation.",
    {"sets": List(item=Str(max=12), lo=2, hi=3),
     "regions": List(item=Obj(fields={"in": List(item=Str(max=12), lo=0, hi=3), "items": List(item=Str(max=6), lo=0, hi=6)}), lo=0, hi=8, default=list,
                     desc="'in' lists the set names the region belongs to; [] means outside all"),
     "highlight": Enum(options=("none", "union", "intersection", "a_minus_b", "complement_a"), default="none")},
    {"title": "A ∩ B", "caption": "The intersection holds elements in both sets.", "sets": ["A", "B"],
     "regions": [{"in": ["A"], "items": ["1", "3"]}, {"in": ["A", "B"], "items": ["2", "4"]}, {"in": ["B"], "items": ["6", "8"]}],
     "highlight": "intersection"},
    chapters="Sets; Probability",
))
add(SceneType(
    "dice_grid", "maths",
    "Sample space of two dice (6×6 grid) with an event highlighted and its probability computed.",
    {"event": Enum(options=("sum_equals", "sum_at_least", "doubles", "first_greater", "product_even"), default="sum_equals"),
     "value": Num(lo=2, hi=12, integer=True, default=7)},
    {"title": "Probability of a sum of 7", "caption": "Six of the 36 outcomes add up to seven.", "event": "sum_equals", "value": 7},
    chapters="Probability",
))
add(SceneType(
    "sequence", "maths",
    "Arithmetic or geometric progression: terms appear with the common difference/ratio, nth term and sum shown.",
    {"kind": Enum(options=("arithmetic", "geometric"), default="arithmetic"),
     "first": Num(lo=-100, hi=100, default=2), "step": Num(lo=-20, hi=20, default=3, desc="d or r"),
     "terms": Num(lo=3, hi=8, integer=True, default=6)},
    {"title": "An arithmetic progression", "caption": "Each term adds the same common difference.",
     "kind": "arithmetic", "first": 2, "step": 3, "terms": 6},
    chapters="Arithmetic progressions; Sequences & series",
))

COMMON_FIELDS: dict[str, Field] = {
    "title": Str(max=64, desc="short, specific scene title (not a question)"),
    "caption": Str(max=220, desc="narration subtitles: 1-2 plain sentences, at most 30 words, that teach"),
    "notes": List(item=Str(max=64), lo=0, hi=4, default=list, desc="2-4 short observations shown beside the diagram"),
}

FIRST, LAST = "title", "recap"


def outline_menu(subject: str | None = None) -> str:
    rows = []
    for scene in CATALOG.values():
        if subject and scene.subject not in ("general", subject):
            continue
        tag = f" [{scene.chapters}]" if scene.chapters else ""
        rows.append(f"- {scene.name} ({scene.subject}): {scene.use}{tag}")
    return "\n".join(rows)


def schema_text(name: str) -> str:
    scene = CATALOG[name]
    lines = [f'type "{name}": {scene.use}']
    for key, fld in COMMON_FIELDS.items():
        if key == "notes" and not scene.notes:
            continue
        lines.append(f"  {key}: {fld.describe()}")
    for key, fld in scene.fields.items():
        lines.append(f"  {key}: {fld.describe()}")
    return "\n".join(lines)
