// Bundle once, then render stills for many component fixtures in parallel.
// usage: node scripts/render-stills.mjs jobs.json outDir
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [jobFile, outDir] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobFile, "utf8"));
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome", { chromiumOptions: { gl: process.platform === "win32" ? "angle" : "swiftshader" } });
const tasks = jobs.flatMap((j) => j.frames.map((frame) => ({ ...j, frame })));
const workers = Math.max(2, Math.min(6, Math.floor(os.cpus().length / 2)));
let next = 0, failed = 0;

async function worker() {
  while (next < tasks.length) {
    const t = tasks[next++];
    for (let attempt = 1; attempt <= 3; attempt++) try {
      const composition = await selectComposition({ serveUrl, id: "Lesson", inputProps: t.props, puppeteerInstance: browser });
      await renderStill({
        composition, serveUrl, inputProps: t.props, frame: Math.min(t.frame, composition.durationInFrames - 1),
        output: path.join(outDir, `${t.name}_${t.frame}.jpg`), imageFormat: "jpeg", jpegQuality: 82, puppeteerInstance: browser, scale: 0.5,
      });
      process.stdout.write(`ok   ${t.name} @${t.frame}\n`);
      break;
    } catch (e) {
      if (attempt < 3) continue;
      failed++;
      process.stdout.write(`FAIL ${t.name} @${t.frame}: ${String(e.message || e).split("\n")[0]}\n`);
    }
  }
}
await Promise.all(Array.from({ length: workers }, worker));
await browser.close({ silent: true });
process.stdout.write(`${tasks.length - failed}/${tasks.length} stills rendered\n`);
process.exit(failed ? 1 : 0);
