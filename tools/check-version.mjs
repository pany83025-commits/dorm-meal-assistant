#!/usr/bin/env node
/*
 * 版本号一致性检查：一个版本号散落在四个地方，漏改任何一处都会让「更新提示」失灵。
 *   index.html        const APP_VER="3.18.0"   应用自己用来比较的
 *   version.json      "version": "3.18.0"      线上用来判断有没有新版的
 *   AndroidManifest   versionName / versionCode
 *   package.json      "version": "3.18.0"
 * 规则：语义化版本 MAJOR.MINOR.PATCH，四处必须完全一致；
 *      versionCode = 主×10000 + 次×100 + 修订。
 * 用法：node tools/check-version.mjs   （npm run verify 会调用）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const SEMVER = /^\d+\.\d+\.\d+$/;
const problems = [];
const pick = (file, re, label) => {
  const m = read(file).match(re);
  if (!m) {
    problems.push(`${label}：在 ${file} 里没找到`);
    return null;
  }
  return m[1];
};

const appVer = pick("index.html", /const APP_VER="([0-9.]+)"/, "index.html 的 APP_VER");

let vjVer = null;
try {
  vjVer = JSON.parse(read("version.json")).version;
  if (!vjVer) problems.push("version.json：缺 version 字段");
} catch (e) {
  problems.push("version.json：不是合法 JSON（" + e.message + "）");
}

const manVer = pick("_apk/AndroidManifest.xml", /android:versionName="([0-9.]+)"/, "Manifest versionName");
const manCode = pick("_apk/AndroidManifest.xml", /android:versionCode="([0-9]+)"/, "Manifest versionCode");

let pkgVer = null;
try {
  pkgVer = JSON.parse(read("package.json")).version;
} catch (e) {
  problems.push("package.json：不是合法 JSON");
}

/* 四处都必须是 主.次.修订 三段式，不能再用 3.17 这种两段的写法 */
[
  ["index.html", appVer],
  ["version.json", vjVer],
  ["AndroidManifest versionName", manVer],
  ["package.json", pkgVer],
].forEach(function (x) {
  if (x[1] && !SEMVER.test(String(x[1])))
    problems.push(`${x[0]} 的版本号 ${x[1]} 不是 主.次.修订 三段式（如 3.18.0）`);
});

const parts = String(appVer || "0.0.0").split(".").map(Number);
const wantCode = String((parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0));

if (appVer && vjVer && appVer !== vjVer)
  problems.push(`index.html(${appVer}) 与 version.json(${vjVer}) 不一致 → 应用会永远收不到更新`);
if (appVer && manVer && appVer !== manVer)
  problems.push(`index.html(${appVer}) 与 AndroidManifest(${manVer}) 不一致 → 安装包版本与页面自称不符`);
if (appVer && pkgVer && appVer !== pkgVer)
  problems.push(`package.json(${pkgVer}) 与 ${appVer} 不一致`);
if (manCode && manCode !== wantCode)
  problems.push(`versionCode=${manCode}，按 ${appVer} 应为 ${wantCode}（主×10000+次×100+修订），否则覆盖安装会被拒`);

if (problems.length) {
  console.error("✗ 版本号不一致：");
  for (const p of problems) console.error("  - " + p);
  console.error("  用 node tools/bump.mjs <主.次.修订> 一次改齐四处。");
  process.exit(1);
}

console.log(`✓ 版本一致：v${appVer}（versionCode ${manCode}，package.json ${pkgVer}，version.json ${vjVer}）`);
