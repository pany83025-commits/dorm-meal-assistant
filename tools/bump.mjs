#!/usr/bin/env node
/*
 * 一次改齐四处版本号，并打印结果。
 *
 *   node tools/bump.mjs 3.18.0
 *   node tools/bump.mjs 3.18.1 --note "修好更新提示"
 *   node tools/bump.mjs 3.19            # 省略修订号＝3.19.0
 *
 * 版本号规则：语义化版本 MAJOR.MINOR.PATCH（SemVer 2.0.0）
 *   主版本 MAJOR：不兼容的改动（数据格式变了、旧存档要迁移）
 *   次版本 MINOR：加功能、改交互，向后兼容
 *   修订 PATCH：只修 bug、改文案、调数值
 * 改的地方：index.html 的 APP_VER、version.json、AndroidManifest 的
 * versionName/versionCode、package.json。
 *
 * versionCode 是安卓要的单调递增整数，由 SemVer 编码而来：
 *   code = 主×10000 + 次×100 + 修订     （次、修订各占两位，须 ≤99）
 * 例：3.18.0 → 31800，3.18.1 → 31801，4.0.0 → 40000
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const raw = (args.find((a) => !a.startsWith("--")) || "").trim();
const noteIdx = args.indexOf("--note");
const note = noteIdx > -1 ? args[noteIdx + 1] : null;

const m = raw.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
if (!m) {
  console.error("用法：node tools/bump.mjs <主.次.修订> [--note \"一句话说明\"]");
  console.error("  例：node tools/bump.mjs 3.18.0（也接受 3.18 ＝ 3.18.0）");
  process.exit(1);
}
const major = Number(m[1]);
const minor = Number(m[2]);
const patch = Number(m[3] || 0);
if (minor > 99 || patch > 99) {
  console.error("次版本与修订号都要 ≤ 99（versionCode 每位占两位，超了会编码冲突）");
  process.exit(1);
}
const ver = `${major}.${minor}.${patch}`;
const code = String(major * 10000 + minor * 100 + patch);

/* 两个前置检查：不能倒退、不能改小 versionCode —— 否则覆盖安装会被系统拒绝 */
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const curVer = (read("index.html").match(/const APP_VER="([^"]*)"/) || [])[1] || "0.0.0";
const curCode = (read("_apk/AndroidManifest.xml").match(/android:versionCode="(\d+)"/) || [])[1] || "0";
const cmp = (a, b) => {
  const A = String(a).split(".").map(Number);
  const B = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] || 0, y = B[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
};
if (cmp(ver, curVer) <= 0) {
  console.error(`新版本 ${ver} 不比当前 ${curVer} 新。降级 / 平级会让更新提示失效。`);
  process.exit(1);
}
if (Number(code) <= Number(curCode)) {
  console.error(`新 versionCode ${code} 不大于当前 ${curCode}，覆盖安装会被拒。`);
  process.exit(1);
}

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
  d.version = ver;
  return JSON.stringify(d, null, 2) + "\n";
});

console.log(`\n版本 ${ver} ｜ versionCode ${code} ｜ package.json ${ver} ｜ ${todayStr}`);
if (!note) console.log("提示：version.json 的 note 没改，应用内更新提示会沿用旧说明（可用 --note 覆盖）");
