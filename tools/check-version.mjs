#!/usr/bin/env node
/*
 * 版本号一致性检查：一个版本号散落在四个地方，漏改任何一处都会让「更新提示」失灵。
 *   index.html        const APP_VER="3.9"   应用自己用来比较的
 *   version.json      "version": "3.9"      线上用来判断有没有新版的
 *   AndroidManifest   versionName / versionCode
 *   package.json      "version": "3.9.0"
 * 用法：node tools/check-version.mjs   （npm run verify 会调用）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const problems = [];
const pick = (file, re, label) => {
  const m = read(file).match(re);
  if (!m) {
    problems.push(`${label}：在 ${file} 里没找到`);
    return null;
  }
  return m[1];
};

const appVer = pick("index.html", /const APP_VER="([0-9]+(?:\.[0-9]+)*)"/, "index.html 的 APP_VER");

let vjVer = null;
try {
  vjVer = JSON.parse(read("version.json")).version;
  if (!vjVer) problems.push("version.json：缺 version 字段");
} catch (e) {
  problems.push("version.json：不是合法 JSON（" + e.message + "）");
}

const manVer = pick("_apk/AndroidManifest.xml", /android:versionName="([0-9]+(?:\.[0-9]+)*)"/, "Manifest versionName");
const manCode = pick("_apk/AndroidManifest.xml", /android:versionCode="([0-9]+)"/, "Manifest versionCode");

let pkgVer = null;
try {
  pkgVer = JSON.parse(read("package.json")).version;
} catch (e) {
  problems.push("package.json：不是合法 JSON");
}

const parts = String(appVer || "0.0").split(".").map(Number);
const major = parts[0] || 0;
const minor = parts[1] || 0;
const wantCode = String(major * 10 + minor);
const wantPkg = major + "." + minor + ".0";

if (appVer && vjVer && appVer !== vjVer)
  problems.push(`index.html(${appVer}) 与 version.json(${vjVer}) 不一致 → 应用会永远收不到更新`);
if (appVer && manVer && appVer !== manVer)
  problems.push(`index.html(${appVer}) 与 AndroidManifest(${manVer}) 不一致 → 安装包版本与页面自称不符`);
if (manCode && manCode !== wantCode)
  problems.push(`versionCode=${manCode}，按 ${appVer} 应为 ${wantCode}（major×10+minor），否则覆盖安装会被拒`);
if (pkgVer && !String(pkgVer).startsWith(major + "." + minor + "."))
  problems.push(`package.json(${pkgVer}) 与 ${appVer} 不一致，应为 ${wantPkg}`);

if (problems.length) {
  console.error("✗ 版本号不一致：");
  for (const p of problems) console.error("  - " + p);
  console.error("  用 node tools/bump.mjs <版本号> 一次改齐四处。");
  process.exit(1);
}

console.log(`✓ 版本一致：v${appVer}（versionCode ${manCode}，package.json ${pkgVer}，version.json ${vjVer}）`);
