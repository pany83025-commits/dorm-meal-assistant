#!/usr/bin/env node
/*
 * 把打包好的 APK 传到 GitHub Release，供应用内「检查更新」下载。
 *
 *   GH_TOKEN=xxx node tools/release.mjs ./寝室餐食助手-v3.7.apk
 *
 * 版本号取自 version.json；资源名固定为 dorm-meal.apk，
 * 因此下载地址永远是 …/releases/latest/download/dorm-meal.apk，不用跟着版本变。
 * 已存在的同名资源会先删掉再传。
 */
import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) {
  console.error("需要 GH_TOKEN（对仓库有 repo 权限）");
  process.exit(1);
}
const APK = process.argv[2];
if (!APK || !fs.existsSync(APK)) {
  console.error("用法：node tools/release.mjs <apk 路径>");
  process.exit(1);
}

const ROOT = path.resolve(import.meta.dirname, "..");
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, "version.json"), "utf8"));
const [OWNER, REPO] = (process.env.GH_REPO || "pany83025-commits/dorm-meal-assistant").split("/");
const TAG = "v" + VJ.version;
const API = "https://api.github.com";

async function call(method, url, body, raw) {
  const headers = {
    Authorization: "Bearer " + TOKEN,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  let payload;
  if (raw) {
    headers["Content-Type"] = raw;
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(API + url, { method, headers, body: payload });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${url}\n${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const notes = VJ.note || "";

// 1) 建 release（已存在就复用）
let rel;
try {
  rel = await call("POST", `/repos/${OWNER}/${REPO}/releases`, {
    tag_name: TAG,
    name: "寝室餐食助手 " + TAG,
    body: notes,
    draft: false,
    prerelease: false,
  });
  console.log("新建 release", TAG);
} catch (e) {
  if (!/HTTP 422/.test(e.message)) throw e;
  rel = await call("GET", `/repos/${OWNER}/${REPO}/releases/tags/${TAG}`);
  console.log("复用已有 release", TAG, "→ 更新说明");
  await call("PATCH", `/repos/${OWNER}/${REPO}/releases/${rel.id}`, { body: notes });
}

// 2) 删掉旧的同名资源
for (const a of rel.assets || []) {
  if (a.name === "dorm-meal.apk") {
    await call("DELETE", `/repos/${OWNER}/${REPO}/releases/assets/${a.id}`);
    console.log("删除旧资源", a.name);
  }
}

// 3) 上传
const buf = fs.readFileSync(APK);
const up = await fetch(
  `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${rel.id}/assets?name=dorm-meal.apk`,
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + TOKEN,
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(buf.length),
    },
    body: buf,
  }
);
if (!up.ok) throw new Error(`上传失败 HTTP ${up.status} ${(await up.text()).slice(0, 300)}`);
const asset = await up.json();

console.log(`完成：${TAG}  ${(asset.size / 1024).toFixed(0)}KB`);
console.log("下载地址（固定不变）：");
console.log(`https://github.com/${OWNER}/${REPO}/releases/latest/download/dorm-meal.apk`);
