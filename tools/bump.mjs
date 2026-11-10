#!/usr/bin/env node
/*
 * 一次改齐四处版本号，并打印结果。
 *
 *   node tools/bump.mjs 3.10
 *   node tools/bump.mjs 3.10 --note "修好更新提示"
 *
 * 改的地方：index.html 的 APP_VER、version.json、AndroidManifest 的
 * versionName/versionCode、package.json。versionCode 固定为 major×10+minor。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const ver = (args.find((a) => !a.startsWith("--")) || "").trim();
const noteIdx = args.indexOf("--note");
const note = noteIdx > -1 ? args[noteIdx + 1] : null;

if (!/^[0-9]+\.[0-9]+(\.[0-9]+)?$/.test(ver)) {
  console.error("用法：node tools/bump.mjs <主.次[.修订]> [--note \"一句话说明\"]");
  process.exit(1);
}

const parts = ver.split(".").map(Number);
const code = String(parts[0] * 10 + parts[1]);
const pkg = parts[0] + "." + parts[1] + ".0";
const todayStr = (() => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
})();

const rw = (file, fn) => {
  const p = path.join(ROOT, file);
  const before = fs.readFileSync(p, "utf8");
  const after = fn(before);
  fs.writeFileSync(p, after, "utf8");
  console.log(before === after ? `= ${file}（无变化）` : `✓ ${file}`);
};

rw("index.html", (s) => s.replace(/const APP_VER="[^"]*"/, `const APP_VER="${ver}"`));

rw("version.json", (s) => {
  const d = JSON.parse(s);
  d.version = ver;
  d.released = todayStr;
  if (note) d.note = note;
  return JSON.stringify(d, null, 2) + "\n";
});

rw("_apk/AndroidManifest.xml", (s) =>
  s
    .replace(/android:versionCode="[^"]*"/, `android:versionCode="${code}"`)
    .replace(/android:versionName="[^"]*"/, `android:versionName="${ver}"`)
);

rw("package.json", (s) => {
  const d = JSON.parse(s);
  d.version = pkg;
  return JSON.stringify(d, null, 2) + "\n";
});

console.log(`\n版本 ${ver} ｜ versionCode ${code} ｜ package.json ${pkg} ｜ ${todayStr}`);
if (!note) console.log("提示：version.json 的 note 没改，应用内更新提示会沿用旧说明（可用 --note 覆盖）");
