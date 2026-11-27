"""Normalize, sanity-check and time a storyboard.

`clean_scene` turns whatever a model produced into a scene the renderer can
draw without surprises, or raises SchemaError with a message precise enough
to send back to the model.
"""

from __future__ import annotations

import re
from collections import Counter

from src import mathexpr
from src.catalog import CATALOG, COMMON_FIELDS
from src.schema import SchemaError

FPS = 30
OVERLAP = 20  # frames neighbouring scenes share during a handover (theme.ts OVERLAP)


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
        if key == "notes" and not spec.notes:
            scene[key] = []
            continue
        scene[key] = fld.resolve(raw.get(key), key)
    for key, fld in spec.fields.items():
        scene[key] = fld.resolve(raw.get(key), key)
    _check(scene)
    return scene


def fallback_scene(kind: str, title: str, goal: str) -> dict:
    """Used when a model cannot produce a valid scene after retries."""
    return {
        "type": "key_points",
        "title": title[:64] or "Key idea",
        "caption": goal[:200] or title,
        "notes": [],
        "items": [{"label": title[:32] or "Idea", "text": (goal or title)[:100]}],
        "fallback_for": kind,
    }


# ------------------------------------------------------------------ timing
def _words(text: str) -> int:
    return len(re.findall(r"\w+", text or ""))


def scene_seconds(scene: dict) -> float:
    kind = scene["type"]
    base = CATALOG[kind].base_seconds if kind in CATALOG else 8
    read = _words(scene.get("caption", "")) / 2.5 + 2.0
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
    extra += 1.2 * len(scene.get("notes") or [])
    return max(4.0, min(26.0, max(base, read, extra)))


def time_storyboard(scenes: list[dict], target_seconds: float | None = None) -> None:
    raw = [scene_seconds(s) for s in scenes]
    total = sum(raw)
    scale = 1.0
    if target_seconds and total > 0:
        scale = max(0.85, min(1.4, target_seconds / total))
    for scene, seconds in zip(scenes, raw):
        scene["duration"] = int(round(max(4.0, seconds * scale) * FPS))
