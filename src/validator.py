import ast
import re
import subprocess

from rich.console import Console

from src.component_writer import COMPONENT_PATH

console = Console(force_terminal=True, highlight=False)

CONST_RE = re.compile(
    r"^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*;",
    re.MULTILINE,
)
INTERPOLATE_RE = re.compile(
    r"interpolate\s*\(\s*frame\s*,\s*\[([^\]]+)\]",
    re.MULTILINE,
)


def _eval_number(node: ast.AST, constants: dict[str, float]) -> float:
    if isinstance(node, ast.Expression):
        return _eval_number(node.body, constants)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)
    if isinstance(node, ast.Name):
        return constants[node.id]
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        value = _eval_number(node.operand, constants)
        return -value if isinstance(node.op, ast.USub) else value
    if isinstance(node, ast.BinOp) and isinstance(
        node.op,
        (ast.Add, ast.Sub, ast.Mult, ast.Div),
    ):
        left = _eval_number(node.left, constants)
        right = _eval_number(node.right, constants)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        return left / right
    raise ValueError("unsupported expression")


def check_svg_wrapper() -> str:
    if not COMPONENT_PATH.exists():
        return ""

    source = COMPONENT_PATH.read_text(encoding="utf-8")
    if "<svg" in source:
        if source.count("<svg") != source.count("</svg>"):
            return (
                f"{COMPONENT_PATH.as_posix()} has an unclosed <svg> element. "
                "Ensure every <svg> has a matching </svg>."
            )
        return ""

    if any(tag in source for tag in ("<g", "<text", "<defs")):
        return (
            f"{COMPONENT_PATH.as_posix()} is missing an <svg> wrapper. "
            "SVG elements such as <g>, <text>, and <defs> must be inside "
            "<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}> ... </svg>, "
            "otherwise they render as plain HTML text."
        )

    return ""


def check_interpolate_ranges() -> str:
    if not COMPONENT_PATH.exists():
        return ""

    source = COMPONENT_PATH.read_text(encoding="utf-8")
    constants = {
        match.group(1): float(match.group(2))
        for match in CONST_RE.finditer(source)
    }

    errors: list[str] = []
    for match in INTERPOLATE_RE.finditer(source):
        expressions = [part.strip() for part in match.group(1).split(",")]
        if len(expressions) < 2:
            continue
        try:
            values = [
                _eval_number(ast.parse(expression, mode="eval"), constants)
                for expression in expressions
            ]
        except (KeyError, SyntaxError, ValueError, ZeroDivisionError):
            continue
        if all(right > left for left, right in zip(values, values[1:])):
            continue
        line = source.count("\n", 0, match.start()) + 1
        formatted = ", ".join(
            str(int(value)) if value.is_integer() else f"{value:g}"
            for value in values
        )
        errors.append(
            f"{COMPONENT_PATH.as_posix()}:{line} "
            f"interpolate inputRange must be strictly increasing, got [{formatted}]"
        )

    return "\n".join(errors[:10])


def validate_component() -> tuple[bool, str]:
    """
    Runs the TypeScript compiler (tsc --noEmit) inside the Remotion project
    to catch syntax and type errors BEFORE rendering.
    Returns (is_valid: bool, error_message: str).
    """
    svg_error = check_svg_wrapper()
    if svg_error:
        console.print(f"[red][FAIL] Invalid SVG structure in generated component:[/red]\n{svg_error}")
        return False, svg_error

    static_errors = check_interpolate_ranges()
    if static_errors:
        console.print(
            "[red][FAIL] Non-monotonic interpolate range in generated component:"
            f"[/red]\n{static_errors}"
        )
        return False, static_errors

    result = subprocess.run(
        "npx tsc --noEmit --skipLibCheck",
        cwd="remotion_project",
        capture_output=True,
        text=True,
        shell=True,   # Required on Windows for npx.cmd resolution
    )

    if result.returncode == 0:
        console.print("[green][OK] TypeScript validation passed[/green]")
        return True, ""

    errors = result.stdout + result.stderr
    # Only surface errors in our generated component, not scaffold files (Root.tsx, etc.)
    relevant = [
        line for line in errors.splitlines()
        if "EducationVideo.tsx" in line
    ]

    if not relevant:
        # No errors in the generated component — other file errors are not our concern
        console.print("[green][OK] TypeScript validation passed (no errors in generated component)[/green]")
        return True, ""

    error_summary = "\n".join(relevant[:20])  # Cap at 20 lines
    console.print(f"[red][FAIL] TypeScript errors in generated component:[/red]\n{error_summary}")
    return False, error_summary
