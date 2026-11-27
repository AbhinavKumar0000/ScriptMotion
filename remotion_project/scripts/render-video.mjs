// Render one lesson to MP4 and report progress as JSON lines on stdout.
// usage: node scripts/render-video.mjs props.json out.mp4 [concurrency]
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
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
  say({ stage: "done", progress: 1, output: outFile });
  process.exit(0);
} catch (e) {
  say({ stage: "error", message: String((e && e.message) || e).split("\n").slice(0, 3).join(" ") });
  process.exit(1);
}
