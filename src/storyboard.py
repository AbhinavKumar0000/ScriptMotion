"""Normalize, sanity-check and time a storyboard.

`clean_scene` turns whatever a model produced into a scene the renderer can
draw without surprises, or raises SchemaError with a message precise enough
to send back to the model.
"""

from __future__ import annotations

import re
from collections import Counter

from src import mathexpr
from src.catalog import CATALOG, COMMON_FIELDS, MAX_BEATS, beat_fields
from src.schema import Num, SchemaError

FPS = 30
OVERLAP = 30  # frames neighbouring scenes share during a handover (theme.ts OVERLAP)


def scene_starts(scenes: list[dict]) -> tuple[list[float], float]:
    """Start time (s) of each scene and the video length, matching Lesson.tsx."""
    starts, at = [], 0
    for i, scene in enumerate(scenes):
        starts.append(at / FPS)
        at += scene["duration"] - (OVERLAP if i < len(scenes) - 1 else 0)
    return starts, at / FPS

ELEMENTS = [
    ("H", "Hydrogen"), ("He", "Helium"), ("Li", "Lithium"), ("Be", "Beryllium"), ("B", "Boron"),
    ("C", "Carbon"), ("N", "Nitrogen"), ("O", "Oxygen"), ("F", "Fluorine"), ("Ne", "Neon"),
    ("Na", "Sodium"), ("Mg", "Magnesium"), ("Al", "Aluminium"), ("Si", "Silicon"), ("P", "Phosphorus"),
    ("S", "Sulfur"), ("Cl", "Chlorine"), ("Ar", "Argon"), ("K", "Potassium"), ("Ca", "Calcium"),
]
SYMBOL_TO_Z = {s.lower(): i + 1 for i, (s, _) in enumerate(ELEMENTS)}
NAME_TO_Z = {n.lower(): i + 1 for i, (_, n) in enumerate(ELEMENTS)}
NAME_TO_Z.update({"aluminum": 13, "sulphur": 16})
ELECTRODE_POTENTIALS = {
    "Li": -3.04, "K": -2.93, "Ca": -2.87, "Na": -2.71, "Mg": -2.37, "Al": -1.66, "Zn": -0.76,
    "Cr": -0.74, "Fe": -0.44, "Co": -0.28, "Ni": -0.25, "Sn": -0.14, "Pb": -0.13, "H": 0.0,
    "Cu": 0.34, "Ag": 0.80, "Hg": 0.85, "Pt": 1.18, "Au": 1.50,
}


def element_z(value: str) -> int:
    key = re.sub(r"[^a-z]", "", str(value).lower())
    z = SYMBOL_TO_Z.get(key) or NAME_TO_Z.get(key)
    if not z:
        raise SchemaError(f"'{value}' is not one of the first 20 elements (H to Ca)")
    return z


def symbol(value: str) -> str:
    return ELEMENTS[element_z(value) - 1][0]


# ------------------------------------------------------------ formula atoms
def _atoms(formula: str) -> Counter:
    text = re.sub(r"\^\{?[0-9]*[+-]\}?|\((?:s|l|g|aq)\)|\s", "", formula)
    text = text.replace("·", ".").replace("*", ".")
    text = re.sub(r"[=#≡–—\-]", "", text)  # structural bond symbols carry no atoms
    total: Counter = Counter()
    for part in text.split("."):
        lead = re.match(r"^(\d+)", part)
        mult = int(lead.group(1)) if lead else 1
        part = part[lead.end():] if lead else part
        total.update({k: v * mult for k, v in _parse_group(part).items()})
    return total


def _parse_group(text: str) -> Counter:
    stack = [Counter()]
    i = 0
    while i < len(text):
        ch = text[i]
        if ch in "([":
            stack.append(Counter())
            i += 1
        elif ch in ")]":
            i += 1
            num = re.match(r"\d+", text[i:])
            mult = int(num.group()) if num else 1
            i += num.end() if num else 0
            group = stack.pop()
            for k, v in group.items():
                stack[-1][k] += v * mult
        else:
            match = re.match(r"([A-Z][a-z]?)(\d*)", text[i:])
            if not match:
                raise SchemaError(f"cannot read formula '{text}'")
            stack[-1][match.group(1)] += int(match.group(2) or 1)
            i += match.end()
    if len(stack) != 1:
        raise SchemaError(f"unbalanced brackets in '{text}'")
    return stack[0]


def _side(terms) -> Counter:
    total: Counter = Counter()
    for term in terms:
        for k, v in _atoms(term["formula"]).items():
            total[k] += v * term["coefficient"]
    return total


# ------------------------------------------------------------ type checks
_QNUM = re.compile(r"[-−]?\d+(?:\.\d+)?")


def _fix_quiz_answer(scene: dict) -> None:
    """For numeric options, trust the explanation's final result over the answer index.

    Models often compute the right value in the explanation but mark the wrong option.
    """
    nums = []
    for option in scene["options"]:
        found = _QNUM.findall(option)
        if len(found) != 1:
            return  # not a purely numeric question
        nums.append(float(found[0].replace("−", "-")))
    tail = scene.get("explanation", "").rsplit("=", 1)[-1]
    found = _QNUM.findall(tail)
    if not found:
        return
    result = float(found[0].replace("−", "-"))
    hits = [i for i, n in enumerate(nums) if abs(n - result) < 1e-6]
    if len(hits) == 1 and hits[0] != scene["answer"]:
        scene["answer"] = hits[0]


def _check(scene: dict) -> None:
    kind = scene["type"]
    if kind in ("lens", "mirror"):
        f, u = scene["focal_length"], scene["object_distance"]
        converging = scene.get("lens", scene.get("mirror")) in ("convex",) if kind == "lens" else scene["mirror"] == "concave"
        if converging and abs(u - f) < 0.25 * f:
            scene["object_distance"] = round(f * (1.4 if u > f else 0.6), 1)  # avoid image at infinity
    elif kind == "function_graph":
        if scene["x_max"] <= scene["x_min"]:
            scene["x_min"], scene["x_max"] = min(scene["x_min"], scene["x_max"]) - 1, max(scene["x_min"], scene["x_max"]) + 1
        for fn in scene["functions"]:
            try:
                fn["expr"] = mathexpr.check(fn["expr"], scene["x_min"], scene["x_max"])
            except ValueError as exc:
                raise SchemaError(f"functions.expr: {exc}. Use plain syntax like '0.5*x^2 - 3' or 'sin(x)'") from None
        lo, hi = scene["x_min"], scene["x_max"]
        scene["points"] = [p for p in scene["points"] if lo <= p["x"] <= hi]
        if scene.get("tangent_at") is not None and not lo <= scene["tangent_at"] <= hi:
            scene["tangent_at"] = None
        if scene.get("area"):
            a, b = sorted((scene["area"]["from"], scene["area"]["to"]))
            scene["area"] = {"from": max(lo, a), "to": min(hi, b)} if b > a else None
        if scene.get("y_min") is not None and scene.get("y_max") is not None and scene["y_max"] <= scene["y_min"]:
            scene["y_min"] = scene["y_max"] = None
    elif kind == "number_line":
        if scene["max"] <= scene["min"]:
            raise SchemaError("number_line.max must be greater than min")
        if scene["max"] - scene["min"] > 40:
            raise SchemaError("number_line range must span at most 40 units")
    elif kind == "matrix_multiply":
        a, b = scene["A"], scene["B"]
        if len({len(r) for r in a}) != 1 or len({len(r) for r in b}) != 1:
            raise SchemaError("matrix rows must all have the same length")
        if len(a[0]) != len(b):
            raise SchemaError(f"cannot multiply: A is {len(a)}×{len(a[0])} but B is {len(b)}×{len(b[0])}")
    elif kind == "venn":
        names = set(scene["sets"])
        for region in scene["regions"]:
            region["in"] = [s for s in region["in"] if s in names]
    elif kind == "geometry":
        ids = {p["id"] for p in scene["points"]}
        scene["segments"] = [s for s in scene["segments"] if s["from"] in ids and s["to"] in ids]
        scene["circles"] = [c for c in scene["circles"] if c["center"] in ids]
        scene["polygons"] = [p for p in scene["polygons"] if all(v in ids for v in p)]
        scene["angles"] = [a for a in scene["angles"] if {a["at"], a["from"], a["to"]} <= ids]
    elif kind == "atom":
        scene["z"] = element_z(scene["element"])
        scene["element"] = symbol(scene["element"])
    elif kind == "bonding":
        scene["atom_a"], scene["atom_b"] = symbol(scene["atom_a"]), symbol(scene["atom_b"])
    elif kind == "vsepr":
        scene["central"] = scene["central"].strip()[:2].capitalize()
        scene["outer"] = scene["outer"].strip()[:2].capitalize()
    elif kind == "electrochemical_cell":
        for key in ("anode", "cathode"):
            sym = scene[key].strip().capitalize()
            if sym not in ELECTRODE_POTENTIALS:
                raise SchemaError(f"{key} must be one of {', '.join(ELECTRODE_POTENTIALS)}")
            scene[key] = sym
        if ELECTRODE_POTENTIALS[scene["anode"]] > ELECTRODE_POTENTIALS[scene["cathode"]]:
            scene["anode"], scene["cathode"] = scene["cathode"], scene["anode"]
        if scene["anode"] == scene["cathode"]:
            raise SchemaError("anode and cathode must be different metals")
    elif kind == "reaction":
        try:
            left, right = _side(scene["reactants"]), _side(scene["products"])
        except SchemaError:
            raise
        if left != right:
            diff = {k: (left.get(k, 0), right.get(k, 0)) for k in set(left) | set(right) if left.get(k, 0) != right.get(k, 0)}
            detail = ", ".join(f"{k}: {a} vs {b}" for k, a, b in ((k, *v) for k, v in diff.items()))
            raise SchemaError(f"equation is not balanced ({detail}); fix the coefficients")
        scene["atoms"] = dict(sorted(left.items()))
    elif kind == "quiz":
        if scene["answer"] >= len(scene["options"]):
            raise SchemaError("quiz.answer index is out of range")
        _fix_quiz_answer(scene)
    elif kind == "energy_levels":
        if scene["from_level"] == scene["to_level"]:
            raise SchemaError("from_level and to_level must differ")
    elif kind == "pv_diagram":
        if abs(scene["v2"] - scene["v1"]) < 0.5 and scene["process"] not in ("isochoric", "carnot"):
            scene["v2"] = scene["v1"] + 3
    elif kind in ("equation", "worked_example"):
        if kind == "equation" and scene["result_index"] >= len(scene["steps"]):
            scene["result_index"] = -1
    elif kind == "mechanism":
        _check_mechanism(scene)
    elif kind == "bond_orbitals":
        caps = {"H": 1, "F": 1, "Cl": 1, "Br": 1, "I": 1, "O": 2, "S": 2, "N": 3, "C": 3}
        for f in ("atom_a", "atom_b"):
            el = _element(scene[f])
            if el not in caps:
                raise SchemaError(f"bond_orbitals.{f} '{scene[f]}' must be one of {', '.join(caps)}")
            scene[f] = el
        top = min(caps[scene["atom_a"]], caps[scene["atom_b"]])
        if scene["atom_a"] == scene["atom_b"] == "O":
            top = 2
        if scene["order"] > top:
            raise SchemaError(f"bond_orbitals: a {scene['atom_a']}-{scene['atom_b']} bond can be at most order {top}")
        if scene["breaking"] != "none" and scene["order"] > 1:
            raise SchemaError("bond_orbitals: only a single bond (order 1) can be shown breaking")


# ------------------------------------------------------------ mechanisms
# valence electrons for the formal-charge check; group labels count as one bond
_VALENCE = {"H": 1, "He": 2, "Li": 1, "Be": 2, "B": 3, "C": 4, "N": 5, "O": 6, "F": 7, "Na": 1, "Mg": 2, "Al": 3,
            "Si": 4, "P": 5, "S": 6, "Cl": 7, "K": 1, "Ca": 2, "Br": 7, "I": 7}
_OCTET = {"H": 2, "He": 2, "Li": 2, "Be": 4, "B": 8, "C": 8, "N": 8, "O": 8, "F": 8}
_GROUPS = {"R", "R1", "R2", "R3", "Me", "Et", "Pr", "Bu", "Ph", "Ar", "CH3", "C2H5", "C3H7", "C6H5", "Nu", "X"}


def _element(el: str) -> str:
    el = el.strip()
    if el.lower() == "e":
        return "e"
    if el in _GROUPS or len(el) > 2 or not el.isalpha():
        return el
    return el[:1].upper() + el[1:].lower()


def _pair(text: str, ids: set, where: str) -> tuple[str, str]:
    parts = [p.strip() for p in re.split(r"\s*[-–—]\s*", str(text)) if p.strip()]
    if len(parts) != 2 or parts[0] not in ids or parts[1] not in ids or parts[0] == parts[1]:
        raise SchemaError(f"{where}: '{text}' must be two different atom ids joined by '-', e.g. 'C1-Br'")
    return parts[0], parts[1]


def _relax(atoms: dict, bonds: dict) -> None:
    """Clean the 2D structure like a drawing program's "clean" command.

    The model's coordinates are only a starting guess: bonds settle to standard lengths,
    the bonds around each atom spread to 180/120/90 degrees (lone pairs take a slot on bent
    atoms), and atoms are pushed off each other and off bonds they do not belong to. A weak
    pull toward the authored positions keeps the layout the model intended.
    """
    import math
    ids = list(atoms)
    if len(ids) < 2:
        return
    P = {i: [float(atoms[i]["x"]), float(atoms[i]["y"])] for i in ids}
    anchor = {i: tuple(P[i]) for i in ids}
    el = {i: atoms[i]["el"] for i in ids}
    nb: dict[str, list] = {i: [] for i in ids}
    for (p, q) in bonds:
        nb[p].append(q)
        nb[q].append(p)
    # small deterministic nudge so atoms placed exactly on top of each other can separate
    for k, i in enumerate(ids):
        P[i][0] += 1e-3 * math.cos(k * 2.4)
        P[i][1] += 1e-3 * math.sin(k * 2.4)

    def rest(p, q):
        o = bonds.get(tuple(sorted((p, q))), 1)
        base = 1.0 if "H" in (el[p], el[q]) else 1.4
        return base * (1.0, 0.93, 0.87)[o - 1]

    def lone_pairs(i):
        v = _VALENCE.get(el[i])
        if v is None:
            return 0
        used = sum(bonds.get(tuple(sorted((i, j))), 1) for j in nb[i])
        return max(0, (v - used - atoms[i]["charge"] - atoms[i]["radical"]) // 2)

    pairs13 = {tuple(sorted((a, b))) for c in ids for a in nb[c] for b in nb[c] if a != b}
    for _ in range(400):
        F = {i: [0.0, 0.0] for i in ids}

        def push(i, dx, dy):
            F[i][0] += dx
            F[i][1] += dy

        for (p, q) in bonds:
            dx, dy = P[q][0] - P[p][0], P[q][1] - P[p][1]
            d = math.hypot(dx, dy) or 1e-6
            f = 0.5 * (d - rest(p, q)) / d
            push(p, dx * f, dy * f)
            push(q, -dx * f, -dy * f)
        for c in ids:
            deg = len(nb[c])
            if deg < 2:
                continue
            dom = deg + (1 if deg == 2 and lone_pairs(c) > 0 else 0)
            theta = 2 * math.pi / max(2, dom)
            ring = sorted(nb[c], key=lambda j: math.atan2(P[j][1] - P[c][1], P[j][0] - P[c][0]))
            for x in range(deg):
                for y in range(x + 1, deg):
                    a, b = ring[x], ring[y]
                    m = min(y - x, deg - (y - x))
                    ang = min(m * theta, 2 * math.pi - m * theta) if deg > 2 else theta
                    la = math.hypot(P[a][0] - P[c][0], P[a][1] - P[c][1])
                    lb = math.hypot(P[b][0] - P[c][0], P[b][1] - P[c][1])
                    target = math.sqrt(max(1e-6, la * la + lb * lb - 2 * la * lb * math.cos(ang)))
                    dx, dy = P[b][0] - P[a][0], P[b][1] - P[a][1]
                    d = math.hypot(dx, dy) or 1e-6
                    f = 0.22 * (d - target) / d
                    push(a, dx * f, dy * f)
                    push(b, -dx * f, -dy * f)
        for x, p in enumerate(ids):
            for q in ids[x + 1:]:
                key = tuple(sorted((p, q)))
                if key in bonds or key in pairs13:
                    continue
                dmin = 1.1 if "H" in (el[p], el[q]) or "e" in (el[p], el[q]) else 1.5
                dx, dy = P[q][0] - P[p][0], P[q][1] - P[p][1]
                d = math.hypot(dx, dy) or 1e-6
                if d < dmin:
                    f = 0.4 * (dmin - d) / d
                    push(p, -dx * f, -dy * f)
                    push(q, dx * f, dy * f)
        # keep atoms off bonds they are not part of
        for (p, q) in bonds:
            ax, ay, bx, by = P[p][0], P[p][1], P[q][0], P[q][1]
            vx, vy = bx - ax, by - ay
            L2 = vx * vx + vy * vy or 1e-6
            for i in ids:
                if i in (p, q):
                    continue
                t = max(0.0, min(1.0, ((P[i][0] - ax) * vx + (P[i][1] - ay) * vy) / L2))
                cx, cy = ax + vx * t, ay + vy * t
                dx, dy = P[i][0] - cx, P[i][1] - cy
                d = math.hypot(dx, dy) or 1e-6
                if d < 0.7 and 0.05 < t < 0.95:
                    f = 0.4 * (0.7 - d) / d
                    push(i, dx * f, dy * f)
                    push(p, -dx * f * 0.5, -dy * f * 0.5)
                    push(q, -dx * f * 0.5, -dy * f * 0.5)
        for i in ids:
            push(i, (anchor[i][0] - P[i][0]) * 0.012, (anchor[i][1] - P[i][1]) * 0.012)
            fx, fy = F[i]
            n = math.hypot(fx, fy)
            if n > 0.15:
                fx, fy = fx * 0.15 / n, fy * 0.15 / n
            P[i][0] += fx
            P[i][1] += fy
    for i in ids:
        atoms[i]["x"], atoms[i]["y"] = round(P[i][0], 3), round(P[i][1], 3)


def _check_mechanism(scene: dict) -> None:
    """Replay every step, check each state is chemically sound, and store the states for the renderer.

    Lone pairs are not authored: they follow from each atom's valence, bonds, charge and radical
    (formal charge = valence - 2*lone pairs - radical - bonds), so a state whose charges do not
    fit its bonds is refused with a reason the model can fix.
    """
    atoms: dict[str, dict] = {}
    for a in scene["atoms"]:
        aid = re.sub(r"[^A-Za-z0-9]", "", a["id"])
        if not aid or aid in atoms:
            raise SchemaError(f"atoms: id '{a['id']}' is empty or repeated; give every atom a unique id")
        atoms[aid] = {"el": _element(a["el"]), "x": a["x"], "y": a["y"], "charge": a["charge"], "radical": a["radical"]}
    ids = set(atoms)
    bonds: dict[tuple, int] = {}
    for b in scene["bonds"]:
        bonds[tuple(sorted(_pair(f"{b['a']}-{b['b']}", ids, "bonds")))] = b["order"]

    def snapshot(label: str) -> dict:
        _relax(atoms, bonds)
        order_sum = {i: 0 for i in ids}
        for (p, q), o in bonds.items():
            order_sum[p] += o
            order_sum[q] += o
        out = {}
        for i, a in atoms.items():
            el = a["el"]
            if el == "e":
                if order_sum[i]:
                    raise SchemaError(f"{label}: free electron '{i}' cannot be bonded")
                out[i] = [round(a["x"], 3), round(a["y"], 3), -1, 0, 0]
                continue
            v = _VALENCE.get(el, 1 if (el in _GROUPS or len(el) > 2) else None)
            lp = 0
            if v is not None:
                rest = v - order_sum[i] - a["charge"] - a["radical"]
                if rest < 0 or rest % 2:
                    raise SchemaError(
                        f"{label}: atom {i} ({el}) has bond order {order_sum[i]}, charge {a['charge']:+d}, radical {a['radical']}; "
                        f"that does not fit the {v} valence electrons of {el}. Fix its bonds, charge or radical")
                lp = rest // 2
                if el in _OCTET and 2 * order_sum[i] + 2 * lp + a["radical"] > _OCTET[el]:
                    raise SchemaError(f"{label}: atom {i} ({el}) would exceed its octet; break a bond to it in the same step")
            out[i] = [round(a["x"], 3), round(a["y"], 3), a["charge"], a["radical"], lp]
        # geometry: bonded atoms close, everything else apart
        pts = {i: (a["x"], a["y"]) for i, a in atoms.items()}
        dist = lambda p, q: ((pts[p][0] - pts[q][0]) ** 2 + (pts[p][1] - pts[q][1]) ** 2) ** 0.5
        for (p, q) in bonds:
            d = dist(p, q)
            if d > 2.3 or d < 0.6:
                raise SchemaError(f"{label}: bonded atoms {p} and {q} are {d:.1f} apart; keep bonds 0.9-1.8 long (move them)")
        keys = sorted(ids)
        for x, p in enumerate(keys):
            for q in keys[x + 1:]:
                if tuple(sorted((p, q))) not in bonds and dist(p, q) < 0.75:
                    raise SchemaError(f"{label}: atoms {p} and {q} overlap ({dist(p, q):.2f} apart); keep them at least 0.9 apart")
        return {"atoms": out, "bonds": [[p, q, o] for (p, q), o in sorted(bonds.items())],
                "el": {i: a["el"] for i, a in atoms.items()}}

    states = [snapshot("starting structure")]
    for n, step in enumerate(scene["steps"], 1):
        where = f"steps[{n - 1}]"
        for arrow in step["arrows"]:
            for end in ("from", "to"):
                ref = re.sub(r"\s+", "", str(arrow[end]))
                if ref in ids:
                    arrow[end] = ref
                    continue
                p, q = _pair(ref, ids, f"{where}.arrows.{end}")
                if end == "from" and tuple(sorted((p, q))) not in bonds:
                    raise SchemaError(f"{where}.arrows.from '{ref}' is not a bond at the start of this step")
                arrow[end] = f"{p}-{q}"
        broken = []
        for text in step["break"]:
            key = tuple(sorted(_pair(text, ids, f"{where}.break")))
            if key not in bonds:
                raise SchemaError(f"{where}.break: there is no bond {text} at this point")
            broken.append(key)
        formed = {tuple(sorted((f["a"], f["b"]))) for f in step["form"]}
        # an arrow that starts on a bond takes one electron pair out of it; if the model forgot to say
        # so (a common slip with pi bonds), lower that bond's order instead of rejecting the scene
        for arrow in step["arrows"]:
            if "-" in arrow["from"]:
                key = tuple(sorted(arrow["from"].split("-")))
                if key not in broken and key not in formed and key in bonds:
                    broken.append(key)
        for key in dict.fromkeys(broken):
            # breaking a multiple bond removes its pi bond first; the sigma bond goes only from a single bond
            if bonds[key] > 1:
                bonds[key] -= 1
            else:
                bonds.pop(key)
        for f in step["form"]:
            bonds[tuple(sorted(_pair(f"{f['a']}-{f['b']}", ids, f"{where}.form")))] = f["order"]
        for key, field in (("move", None), ("charge", "charge"), ("radical", "n")):
            for item in step[key]:
                if item["id"] not in atoms:
                    raise SchemaError(f"{where}.{key}: unknown atom '{item['id']}'")
                if key == "move":
                    atoms[item["id"]]["x"], atoms[item["id"]]["y"] = item["x"], item["y"]
                else:
                    atoms[item["id"]][key] = item[field]
        if not (step["arrows"] or broken or step["form"] or step["move"] or step["charge"] or step["radical"]):
            raise SchemaError(f"{where} changes nothing; every step must break, form or move something")
        states.append(snapshot(f"after step {n}"))
    for lab in scene["labels"]:
        lab["to_step"] = max(lab["from_step"], min(lab["to_step"], len(scene["steps"])))
    scene["states"] = states


def clean_scene(raw: dict, expected_type: str | None = None) -> dict:
    if not isinstance(raw, dict):
        raise SchemaError("scene must be a JSON object")
    kind = str(raw.get("type") or expected_type or "").strip().lower().replace("-", "_")
    if expected_type and kind != expected_type:
        kind = expected_type
    if kind not in CATALOG:
        raise SchemaError(f"unknown scene type '{kind}'")
    spec = CATALOG[kind]
    scene: dict = {"type": kind}
    for key, fld in COMMON_FIELDS.items():
        scene[key] = fld.resolve(raw.get(key), key)
    for key, fld in spec.fields.items():
        scene[key] = fld.resolve(raw.get(key), key)
    _check(scene)
    scene["beats"] = clean_beats(scene, raw.get("beats"))
    if kind == "mechanism":
        # each mechanism step is a beat: it gets its own caption, title and time on screen
        scene["beats"] = [{"set": {"step": i + 1}, "caption": st["caption"], "title": st["title"]}
                          for i, st in enumerate(scene["steps"])]
    return scene


def clean_beats(scene: dict, raw) -> list[dict]:
    """Validate beats: each changes some top-level setup values of the same diagram.

    Every beat state is re-checked with the type's own rules, so a beat can never
    produce a setup the renderer would refuse (e.g. object exactly at F).
    """
    movable = beat_fields(scene["type"])
    if not movable or not isinstance(raw, list):
        return []
    beats: list[dict] = []
    state = {k: scene[k] for k in movable}
    for i, item in enumerate(raw[:MAX_BEATS]):
        if not isinstance(item, dict):
            continue
        changes = item.get("set") if isinstance(item.get("set"), dict) else {
            k: v for k, v in item.items() if k in movable}
        clean: dict = {}
        for key, value in (changes or {}).items():
            if key not in movable:
                continue
            try:
                clean[key] = movable[key].resolve(value, f"beats[{i}].set.{key}")
            except SchemaError:
                continue
        clean = {k: v for k, v in clean.items() if v != state.get(k)}
        if not clean:
            continue
        probe = {**scene, **state, **clean}
        _check(probe)  # applies the same physical guards as the base setup
        clean = {k: probe[k] for k in clean}
        state.update(clean)
        caption = COMMON_FIELDS["caption"].resolve(item.get("caption") or scene["caption"], f"beats[{i}].caption")
        beat = {"set": clean, "caption": caption,
                "ints": [k for k in clean if isinstance(movable[k], Num) and movable[k].integer]}
        if item.get("title"):
            beat["title"] = COMMON_FIELDS["title"].resolve(item["title"], f"beats[{i}].title")
        beats.append(beat)
    return beats


def merge_runs(scenes: list[dict]) -> list[dict]:
    """Fold a scene into the previous one when it shows the same diagram with a new setup.

    Two consecutive projectile scenes at 45° and 30° become one scene whose angle
    animates from 45° to 30°, instead of a cut between two near-identical frames.
    """
    out: list[dict] = []
    for scene in scenes:
        prev = out[-1] if out else None
        if prev and prev["type"] == scene["type"] and beat_fields(scene["type"]) \
                and len(prev.get("beats") or []) < MAX_BEATS:
            movable = beat_fields(scene["type"])
            fixed = [k for k in CATALOG[scene["type"]].fields if k not in movable]
            if all(prev.get(k) == scene.get(k) for k in fixed):
                last = {k: prev[k] for k in movable}
                for beat in prev.get("beats") or []:
                    last.update(beat["set"])
                changes = {k: scene[k] for k in movable if scene.get(k) != last.get(k)}
                if changes:
                    prev.setdefault("beats", []).append({
                        "set": changes, "caption": scene["caption"], "title": scene["title"],
                        "ints": [k for k in changes if isinstance(movable[k], Num) and movable[k].integer]})
                    prev["beats"].extend((scene.get("beats") or [])[: MAX_BEATS - len(prev["beats"])])
                    continue
        out.append(scene)
    return out


# ------------------------------------------------------------------ timing
def _words(text: str) -> int:
    return len(re.findall(r"\w+", text or ""))


MORPH = 40  # frames a beat takes to animate from one setup to the next (Lesson.tsx MORPH)


def _say(caption: str) -> float:
    """Seconds a viewer needs to read one subtitle."""
    return _words(caption) / 2.6 + 1.2


def scene_seconds(scene: dict) -> float:
    """Length of the scene's first segment: the build-up animation and its caption."""
    kind = scene["type"]
    base = CATALOG[kind].base_seconds if kind in CATALOG else 8
    read = _say(scene.get("caption", "")) + 1.0
    extra = 0.0
    if kind == "equation":
        extra = 2.4 * len(scene["steps"]) + 1.5
    elif kind == "worked_example":
        extra = 4.5 + 2.6 * len(scene["steps"]) + 1.0 * len(scene["given"])
    elif kind in ("key_points", "recap"):
        extra = 2.4 * len(scene["items"]) + 1.5
    elif kind == "table":
        extra = 1.6 * len(scene["rows"]) + 2.5
    elif kind in ("process", "cycle"):
        extra = 2.0 * len(scene.get("steps") or scene.get("stages")) + 2
    elif kind == "quiz":
        extra = _words(scene["question"]) / 2.6 + 7.5
    elif kind == "compare":
        extra = 1.4 * (len(scene["left"]["items"]) + len(scene["right"]["items"])) + 2
    elif kind == "matrix_multiply":
        extra = 1.6 * len(scene["A"]) * len(scene["B"][0]) + 3
    elif kind == "definition":
        extra = _words(scene["meaning"]) / 2.6 + 2.5 + 1.2 * len(scene["symbols"])
    elif kind == "sequence":
        extra = 1.0 * scene["terms"] + 5
    return max(4.0, min(24.0, max(base, read, extra)))


def beat_seconds(beat: dict) -> float:
    return max(3.6, MORPH / FPS + _say(beat.get("caption", "")) + 0.6)


def time_storyboard(scenes: list[dict], target_seconds: float | None = None) -> None:
    """Set each scene's duration (frames) and each beat's start frame inside it."""
    # a mechanism step needs time for its arrows, the bond change and a moment to read the result
    parts = [[scene_seconds(s)] + [max(6.0 if s["type"] == "mechanism" else 0, beat_seconds(b)) for b in s.get("beats") or []]
             for s in scenes]
    # the title card is a fixed short beat; only the teaching scenes stretch to fit the target
    fixed = sum(sum(p) for s, p in zip(scenes, parts) if s["type"] == "title")
    total = sum(sum(p) for p in parts) - fixed
    scale = 1.0
    if target_seconds and total > 0:
        scale = max(0.85, min(1.4, (target_seconds - fixed) / total))
    for scene, segs in zip(scenes, parts):
        at = 0
        if scene["type"] == "title":
            scene["duration"] = int(round(min(5.0, max(3.6, segs[0])) * FPS))
            continue
        frames = [int(round(max(3.4, seg * scale) * FPS)) for seg in segs]
        for beat, start in zip(scene.get("beats") or [], frames[:-1]):
            at += start
            beat["at"] = at
        scene["duration"] = sum(frames)
