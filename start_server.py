"""Start ScriptMotion with one command:  python start_server.py

Checks the toolchain, installs anything missing (Python packages, the Remotion
node modules), confirms the .env has NVIDIA keys, then starts the studio and
opens it in the browser. Pass --port to change the port, --no-browser to skip
opening a tab.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REMOTION = ROOT / "remotion_project"
WIN = sys.platform == "win32"


def step(msg: str) -> None:
    print(f"  {msg}", flush=True)


def fail(msg: str) -> None:
    print(f"\n  Cannot start: {msg}\n", flush=True)
    sys.exit(1)


def check_python() -> None:
    if sys.version_info < (3, 10):
        fail(f"Python 3.10 or newer is required (found {sys.version.split()[0]}).")
    try:
        import dotenv  # noqa: F401
        import openai  # noqa: F401
    except ImportError:
        step("Installing Python packages...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", str(ROOT / "requirements.txt")], check=True)
    step("Python packages ready")


def check_node() -> None:
    if not shutil.which("node") or not shutil.which("npm"):
        fail("Node.js 18+ is required for rendering. Install it from https://nodejs.org and run this again.")
    if not (REMOTION / "node_modules" / "@remotion" / "renderer").exists():
        step("Installing the renderer (first run only, a few minutes)...")
        subprocess.run(["npm", "install", "--no-audit", "--no-fund"], cwd=REMOTION, check=True, shell=WIN)
    step("Renderer ready")


def check_keys() -> None:
    env = ROOT / ".env"
    if not env.exists():
        fail("No .env file. Create one with NVIDIA_API_KEY_1=... (up to NVIDIA_API_KEY_4).")
    from dotenv import dotenv_values
    keys = [k for k, v in dotenv_values(env).items() if k.startswith("NVIDIA_API_KEY") and v]
    if not keys:
        fail(".env has no NVIDIA_API_KEY entries.")
    step(f"{len(keys)} NVIDIA key(s) found")


def main() -> int:
    os.chdir(ROOT)
    print("\nScriptMotion\n", flush=True)
    check_python()
    check_node()
    check_keys()
    print("", flush=True)
    # app.py serves the studio, runs jobs and opens the browser
    return subprocess.call([sys.executable, str(ROOT / "app.py"), *sys.argv[1:]])


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
    except subprocess.CalledProcessError as exc:
        fail(f"setup command failed: {exc}")
