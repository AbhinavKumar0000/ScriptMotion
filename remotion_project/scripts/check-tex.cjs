// Reads a JSON array of LaTeX strings on stdin, prints an array of
// error messages (null = renders fine) using the same KaTeX as the video.
const katex = require("katex");
require("katex/contrib/mhchem");
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const list = JSON.parse(input || "[]");
  const out = list.map((tex) => {
    try {
      katex.renderToString(String(tex), { throwOnError: true, displayMode: true, strict: "ignore" });
      return null;
    } catch (e) {
      return String(e.message || e).replace(/^KaTeX parse error: /, "");
    }
  });
  process.stdout.write(JSON.stringify(out));
});
