// Render one lesson to MP4 and report progress as JSON lines on stdout.
// usage: node scripts/render-video.mjs props.json out.mp4 [concurrency]
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [propsFile, outFile, conc] = process.argv.slice(2);
const inputProps = JSON.parse(fs.readFileSync(propsFile, "utf8"));
const say = (o) => process.stdout.write(JSON.stringify(o) + "\n");

try {
  say({ stage: "bundle", progress: 0 });
  const serveUrl = await bundle({
    entryPoint: path.resolve("src/index.ts"),
    onProgress: (p) => say({ stage: "bundle", progress: p / 100 }),
  });
  const chromiumOptions = { gl: process.platform === "win32" ? "angle" : "swiftshader" };
  const composition = await selectComposition({ serveUrl, id: "Lesson", inputProps, chromiumOptions });
  say({ stage: "render", progress: 0, frames: composition.durationInFrames });
  let last = -1;
  await renderMedia({
    composition, serveUrl, inputProps, chromiumOptions,
    codec: "h264", crf: 18, pixelFormat: "yuv420p", outputLocation: outFile,
    concurrency: Number(conc) || Math.max(2, Math.min(8, Math.floor(os.cpus().length / 2))),
    onProgress: ({ progress, renderedFrames, encodedFrames }) => {
      const pct = Math.floor(progress * 100);
      if (pct !== last) {
        last = pct;
        say({ stage: "render", progress, rendered: renderedFrames, encoded: encodedFrames });
      }
    },
  });
  // poster: the first diagram once it has fully built, so every thumbnail shows real content
  try {
    const OVERLAP = 30;
    const scenes = inputProps.scenes || [];
    let at = 0, frame = Math.floor(composition.durationInFrames / 3);
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      if (s.type !== "title") {
        const intro = s.beats && s.beats.length ? s.beats[0].at : s.duration;
        frame = at + Math.round(intro * 0.85);
        break;
      }
      at += s.duration - OVERLAP;
    }
    await renderStill({
      composition, serveUrl, inputProps, chromiumOptions, frame: Math.min(frame, composition.durationInFrames - 1),
      output: path.join(path.dirname(outFile), "poster.jpg"), imageFormat: "jpeg", jpegQuality: 88,
    });
  } catch (e) {
    say({ stage: "warn", message: "poster: " + String((e && e.message) || e).slice(0, 200) });
  }
  say({ stage: "done", progress: 1, output: outFile });
  process.exit(0);
} catch (e) {
  say({ stage: "error", message: String((e && e.message) || e).split("\n").slice(0, 3).join(" ") });
  process.exit(1);
}
