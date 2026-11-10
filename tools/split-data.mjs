#!/usr/bin/env node
/*
 * 一次性迁移：把 index.html 里内联的 RAW / RCP / DISH 抽到 data/*.json，
 * 并把 HTML 里的字面量换成 JSON.parse(...)，数据以
 * <script type="application/json" id="d-*"> 的形式内联回去（仍然是单文件）。
 *
 * 只需要跑一次；重复执行会检测到已迁移并直接退出。
 * 之后改数据：编辑 data/*.json → node tools/build-data.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML = path.join(ROOT, "index.html");
const SETS = [
  { id: "d-foods", file: "data/foods.json", varName: "RAW" },
  { id: "d-recipes", file: "data/recipes.json", varName: "RCP" },
  { id: "d-dishes", file: "data/dishes.json", varName: "DISH" },
];

let html = fs.readFileSync(HTML, "utf8");

if (html.includes('id="d-foods"')) {
  console.log("已经迁移过（发现 #d-foods），无需再跑");
  process.exit(0);
}

function extract(src, varName) {
  const start = src.indexOf(`const ${varName}=[`);
  if (start < 0) throw new Error(`找不到 const ${varName}=[`);
  const open = src.indexOf("[", start);
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) throw new Error(`${varName} 括号不配平`);
  return { start, open, end, text: src.slice(open, end + 1) };
}

fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });

const inline = [];
for (const set of SETS) {
  const { start, open, end, text } = extract(html, set.varName);
  const data = JSON.parse(text);                    // 数据本身必须是合法 JSON
  // 一条一行，便于 review / diff
  const pretty = "[\n" + data.map((row) => JSON.stringify(row)).join(",\n") + "\n]";
  fs.writeFileSync(path.join(ROOT, set.file), pretty + "\n");
  inline.push({ id: set.id, compact: JSON.stringify(data) });
  // 字面量 → JSON.parse
  const decl = `const ${set.varName}=JSON.parse(document.getElementById("${set.id}").textContent)`;
  html = html.slice(0, start) + decl + html.slice(end + 1);
  console.log(`${set.varName}: ${data.length} 条 → ${set.file}`);
}

// 数据块插到第一个 <script> 之前（JSON 必须在脚本之前解析）
const firstScript = html.indexOf("<script>");
const blocks = inline
  .map(({ id, compact }) => `<script type="application/json" id="${id}">${compact}</script>`)
  .join("\n");
html = html.slice(0, firstScript) + blocks + "\n" + html.slice(firstScript);

fs.writeFileSync(HTML, html);
console.log(`index.html 已改写（${html.length} 字节）`);
