import subprocess
import sys
import os
import json
from pathlib import Path
from rich.console import Console
from rich.panel import Panel

console = Console(force_terminal=True, highlight=False)

REMOTION_PACKAGE_JSON = {
    "name": "scriptmotion",
    "version": "1.0.0",
    "description": "ScriptMotion: Model-Agnostic Agentic Orchestration for Declarative Motion Graphics Compilation",
    "scripts": {
        "build": "remotion render",
        "studio": "remotion studio"
    },
    "dependencies": {
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "remotion": "^4.0.0",
        "@remotion/cli": "^4.0.0"
    },
    "devDependencies": {
        "typescript": "^5.0.0",
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0"
    }
}

TSCONFIG = {
    "compilerOptions": {
        "target": "ES2020",
        "lib": ["dom", "dom.iterable", "esnext"],
        "allowJs": True,
        "skipLibCheck": True,
        "esModuleInterop": True,
        "allowSyntheticDefaultImports": True,
        "strict": True,
        "module": "commonjs",
        "moduleResolution": "node",
        "resolveJsonModule": True,
        "isolatedModules": True,
        "jsx": "react"
    },
    "include": ["src"]
}

REMOTION_CONFIG = """import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
"""

ROOT_TSX = """import React from 'react';
import {Composition} from 'remotion';
import {EducationVideo} from './compositions/EducationVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EducationVideo"
        component={EducationVideo}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{topic: 'Loading...'}}
      />
    </>
  );
};
"""

INDEX_TS = """import {registerRoot} from 'remotion';
import {RemotionRoot} from './Root';
registerRoot(RemotionRoot);
"""

PLACEHOLDER_COMPONENT = """import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';

// This file is OVERWRITTEN by the AI pipeline for every topic.
export const EducationVideo: React.FC<{topic: string}> = ({topic}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1]);
  return (
    <AbsoluteFill style={{background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <h1 style={{opacity, fontSize: 80, fontFamily: 'sans-serif'}}>{topic}</h1>
    </AbsoluteFill>
  );
};
"""

def check_node():
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True, shell=True)
        version = result.stdout.strip()
        console.print(f"[green][OK] Node.js found: {version}[/green]")
        return True
    except FileNotFoundError:
        console.print(Panel(
            "[red]Node.js not found![/red]\n\n"
            "Please install Node.js v18+ from: [link]https://nodejs.org[/link]\n"
            "Then re-run: python setup.py",
            title="Setup Error", border_style="red"
        ))
        return False

def write_if_missing(path: Path, content: str) -> None:
    if not path.exists():
        path.write_text(content, encoding="utf-8")


def create_scaffold():
    base = Path("remotion_project")
    (base / "src" / "compositions").mkdir(parents=True, exist_ok=True)
    Path("output").mkdir(exist_ok=True)

    write_if_missing(base / "package.json", json.dumps(REMOTION_PACKAGE_JSON, indent=2))
    write_if_missing(base / "tsconfig.json", json.dumps(TSCONFIG, indent=2))
    write_if_missing(base / "remotion.config.ts", REMOTION_CONFIG)
    write_if_missing(base / "src" / "Root.tsx", ROOT_TSX)
    write_if_missing(base / "src" / "index.ts", INDEX_TS)
    write_if_missing(base / "src" / "compositions" / "EducationVideo.tsx", PLACEHOLDER_COMPONENT)
    console.print("[green][OK] Remotion project scaffold ready[/green]")

def npm_install():
    console.print("[yellow]Running npm install (this may take 1-2 minutes)...[/yellow]")
    result = subprocess.run(
        'npm install',
        cwd='remotion_project',
        capture_output=False,
        shell=True
    )
    if result.returncode == 0:
        console.print("[green][OK] npm packages installed[/green]")
    else:
        console.print("[red][FAIL] npm install failed. Check error above.[/red]")
        sys.exit(1)

def main():
    console.print(Panel("[bold cyan]ScriptMotion — Setup[/bold cyan]", border_style="cyan"))
    if not check_node():
        sys.exit(1)
    create_scaffold()
    npm_install()
    console.print(Panel(
        "[bold green]Setup complete![/bold green]\n\n"
        "Next steps:\n"
        "1. Copy .env.example to .env and add your API key:\n"
        "   - GEMINI_API_KEY (from aistudio.google.com)\n"
        "   - ANTHROPIC_API_KEY (from console.anthropic.com)\n"
        "   - NVIDIA_API_KEY (from build.nvidia.com, starts with nvapi-)\n"
        "2. Edit TOPIC and CLIENT in test.py\n"
        "3. Run: python test.py",
        title="Done", border_style="green"
    ))

if __name__ == "__main__":
    main()
