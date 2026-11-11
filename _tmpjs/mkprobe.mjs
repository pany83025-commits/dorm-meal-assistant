import fs from "node:fs";
const html = fs.readFileSync("index.html", "utf8");
function inject(src, out, delay) {
  const body = fs.readFileSync(src, "utf8");
  const page = html.replace("</body>", "<script>setTimeout(function(){\n" + body + "\n}," + (delay || 350) + ");</script>\n</body>");
  fs.writeFileSync(out, page);
}
inject("_tmpjs/probe-logic.js", "_tmpjs/probe-logic.html");
console.log("ok");
