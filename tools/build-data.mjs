#!/usr/bin/env node
/*
 * 数据源构建：把 data/*.json 内联回 index.html
 *
 * 为什么这么做：产物要保持「单个 HTML、双击即开、零依赖」，
 * 但数据本身需要能 diff / 能校验 / 能让不懂 JS 的人校对，
 * 所以数据放 data/*.json（权威源），这个脚本负责同步进 HTML 的
 * <script type="application/json"> 块。改完数据务必跑一次：
 *
 *   node tools/build-data.mjs          # 写入 index.html
 *   node tools/build-data.mjs --check  # 只校验是否已同步（CI 用）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML = path.join(ROOT, "index.html");

export const SETS = [
  { id: "d-foods", file: "data/foods.json" },
  { id: "d-recipes", file: "data/recipes.json" },
  { id: "d-dishes", file: "data/dishes.json" },
];

const CHECK = process.argv.includes("--check");

function readJson(file) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  const data = JSON.parse(raw);
  const compact = JSON.stringify(data);
  if (compact.includes("</script")) throw new Error(file + " 里出现 </script，会截断 HTML");
  return compact;
}

let html = fs.readFileSync(HTML, "utf8");
let changed = 0;
const stale = [];

for (const { id, file } of SETS) {
  const json = readJson(file);
  const re = new RegExp(`(<script type="application/json" id="${id}">)([\\s\\S]*?)(</script>)`);
  const m = html.match(re);
  if (!m) throw new Error(`index.html 里找不到 #${id} 数据块，先跑一次 tools/split-data.mjs`);
  if (m[2] !== json) {
    stale.push(`${file} 与 #${id} 不一致（${m[2].length} → ${json.length} 字节）`);
    html = html.replace(re, `$1${json}$3`);
    changed++;
  }
}

if (CHECK) {
  if (stale.length) {
    console.error("数据未同步：\n  " + stale.join("\n  ") + "\n请运行 node tools/build-data.mjs");
    process.exit(1);
  }
  console.log("数据已同步 ✓");
  process.exit(0);
}

if (changed) {
  fs.writeFileSync(HTML, html);
  console.log(`已内联 ${changed} 个数据集 → index.html（${html.length} 字节）`);
} else {
  console.log("数据已是最新，无需写入");
}
