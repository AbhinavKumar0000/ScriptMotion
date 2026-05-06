import re
from pathlib import Path
from rich.console import Console

from src.component_writer import COMPONENT_PATH

console = Console(force_terminal=True, highlight=False)

_ERR_LINE_RE = re.compile(r"EducationVideo\.tsx\((\d+),(\d+)\)")


def _truncate_at_error_line(code: str, error_summary: str) -> str:
    """
    If the model truncated mid-string/JSX near EOF, TypeScript reports TS1002.
    We cut off the file at (error line - 1) and then attempt to close tags.
    """
    matches = _ERR_LINE_RE.findall(error_summary)
    if not matches:
        return code

    # Use the largest line number mentioned (usually the deepest parse point).
    max_line = max(int(m[0]) for m in matches)
    if max_line <= 2:
        return code

    lines = code.splitlines()
    if max_line > len(lines):
        max_line = len(lines)

    return "\n".join(lines[: max_line - 1]).rstrip() + "\n"


def _ensure_component_closure(code: str) -> str:
    """
    Ensure the file ends with a closing component brace/semicolon.
    This is a best-effort for truncated outputs after truncation/closers insertion.
    """
    tail = code.strip()[-200:]
    if tail.endswith("};"):
        return code
    if "export const EducationVideo" not in code:
        return code
    if code.strip().endswith("}"):
        return code.rstrip() + ";\n"
    return code.rstrip() + "\n};\n"


def _close_common_unclosed_tags(code: str) -> str:
    tags = ("g", "div", "svg", "AbsoluteFill")
    missing: list[str] = []

    for tag in tags:
        open_count = len(re.findall(rf"<{tag}(?=[\s>])", code))
        self_close_count = len(re.findall(rf"<{tag}(?=[\s>])[^>]*\/>", code))
        close_count = len(re.findall(rf"</{tag}>", code))
        net_open = open_count - self_close_count - close_count
        if net_open > 0:
            missing.extend([tag] * net_open)

    if not missing:
        return code

    closing_block = "".join(f"</{tag}>\n" for tag in missing)

    # Insert closers right before the final component return close, if possible.
    marker = "\n  );"
    idx = code.rfind(marker)
    if idx != -1:
        return code[:idx] + "\n" + closing_block + code[idx:]

    return code + "\n" + closing_block


def _fix_common_jsx_text_tokens(code: str) -> str:
    # Common parse issue in JSX text content.
    code = code.replace("->", "→")
    return code


def _fix_color_interpolate_to_ternary(code: str) -> str:
    """
    Remotion's interpolate() is numeric, but models sometimes use it for colors:
      const c = interpolate(x, [0,1], ["#fff", PRIMARY_COLOR])
    This causes TS2322 and runtime issues. Rewrite to a stable ternary.
    """
    # Match: const <name> = interpolate(<var>, [0, 1], [<a>, <b>]);
    pattern = re.compile(
        r"""const\s+(?P<name>[A-Za-z0-9_]+)\s*=\s*interpolate\(\s*
            (?P<x>[A-Za-z0-9_\.]+)\s*,\s*\[\s*0\s*,\s*1\s*\]\s*,\s*
            \[\s*(?P<a>"[^"]*"|'[^']*'|[A-Za-z0-9_\.]+)\s*,\s*(?P<b>"[^"]*"|'[^']*'|[A-Za-z0-9_\.]+)\s*\]
            \s*\)\s*;""",
        re.VERBOSE,
    )

    def repl(m: re.Match) -> str:
        name = m.group("name")
        x = m.group("x")
        a = m.group("a")
        b = m.group("b")
        # Only rewrite when either side is clearly a string literal color OR a constant likely used as color.
        is_colorish = lambda s: s.startswith(("'", '"')) or "COLOR" in s.upper() or s.startswith("#")
        if not (is_colorish(a) or is_colorish(b)):
            return m.group(0)
        return f"const {name} = {x} < 0.5 ? {a} : {b};"

    return pattern.sub(repl, code)


def try_auto_fix_component(error_summary: str) -> bool:
    """
    Applies low-risk local fixes for common LLM TSX mistakes to reduce paid retries.
    Returns True if file changed.
    """
    path = Path(COMPONENT_PATH)
    if not path.exists():
        return False

    code = path.read_text(encoding="utf-8")
    original = code

    # Unterminated string literals usually mean the model truncated mid-line near EOF.
    if "TS1002" in error_summary:
        code = _truncate_at_error_line(code, error_summary)

    # Color interpolate misuse is a common Gemini error (interpolate with string ranges).
    if "TS2322" in error_summary and "interpolate(" in code:
        code = _fix_color_interpolate_to_ternary(code)

    # Token parse errors frequently caused by JSX text arrows.
    if "TS1382" in error_summary or "TS1005" in error_summary:
        code = _fix_common_jsx_text_tokens(code)

    # Missing closing JSX tags are common in generated content.
    if "TS17008" in error_summary:
        code = _close_common_unclosed_tags(code)

    # After truncation/tag closes, ensure we end with a component closure.
    if "TS1002" in error_summary or "TS17008" in error_summary:
        code = _ensure_component_closure(code)

    if code == original:
        return False

    path.write_text(code, encoding="utf-8")
    console.print("[yellow][FIX] Applied local TSX auto-fixes before retry[/yellow]")
    return True

