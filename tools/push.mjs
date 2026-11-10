#!/usr/bin/env node
/*
 * 把工作区推上 GitHub。这台机器的网络到不了 github.com 的 git 端口，
 * 所以走 Git Data API（blobs → tree → commit → 改 ref），效果等价于 push。
 *
 *   node tools/push.mjs -m "改了什么"
 *   node tools/push.mjs                      # 用上次的提交信息或默认文案
 *
 * Token 来源：环境变量 GH_TOKEN，或 ~/.dormmeal/gh_token（仓库外，不进 git）。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const OWNER = process.env.GH_OWNER || "pany83025-commits";
const REPO = process.env.GH_APP_REPO || "dorm-meal-assistant";
const API = "https://api.github.com";

const tokenFile = path.join(os.homedir(), ".dormmeal", "gh_token");
const TOKEN = process.env.GH_TOKEN || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8").trim() : "");
if (!TOKEN) {
  console.error(`需要 token：设 GH_TOKEN，或把 token 写进 ${tokenFile}`);
  process.exit(1);
}

const mi = process.argv.indexOf("-m");
const MSG =
  mi > -1 && process.argv[mi + 1]
    ? process.argv[mi + 1]
    : "更新：内容与资源同步";

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();

async function call(method, p, body) {
  const res = await fetch(API + p, {
    method,
    headers: {
      Authorization: "Bearer " + TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${p}\n${txt.slice(0, 400)}`);
  return txt ? JSON.parse(txt) : {};
}

// 1) 本地先留一条真实提交（本地历史与远端内容一致，sha 不同）
git("add", "-A");
let localNote = "（工作区无改动）";
try {
  git("-c", "core.autocrlf=false", "commit", "-q", "-m", MSG);
  localNote = git("rev-parse", "--short", "HEAD");
} catch {
  /* 没有改动 */
}
console.log("本地提交：" + localNote);

// 2) 按暂存区清单取 mode + 工作区内容，逐个传 blob
const rows = git("ls-files", "-s").split("\n").filter(Boolean);
const files = rows.map((line) => {
  const m = line.match(/^(\d+)\s+\S+\s+\d+\t(.+)$/);
  return { mode: m[1].startsWith("100755") ? "100755" : "100644", path: m[2] };
});
console.log(`文件 ${files.length} 个，开始上传…`);

const entries = [];
for (const f of files) {
  const buf = fs.readFileSync(path.join(ROOT, f.path));
  const blob = await call("POST", `/repos/${OWNER}/${REPO}/git/blobs`, {
    content: buf.toString("base64"),
    encoding: "base64",
  });
  entries.push({ path: f.path, mode: f.mode, type: "blob", sha: blob.sha });
}

// 3) tree → commit → ref
const parent = (await call("GET", `/repos/${OWNER}/${REPO}/git/ref/heads/main`)).object.sha;
const tree = await call("POST", `/repos/${OWNER}/${REPO}/git/trees`, { tree: entries });
const now = new Date().toISOString();
const who = {
  name: process.env.GH_NAME || "pany83025-commits",
  email: process.env.GH_EMAIL || "283442813+pany83025-commits@users.noreply.github.com",
  date: now,
};
const commit = await call("POST", `/repos/${OWNER}/${REPO}/git/commits`, {
  message: MSG,
  tree: tree.sha,
  parents: [parent],
  author: who,
  committer: who,
});
await call("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha, force: false });

console.log(`✓ 已推送到 ${OWNER}/${REPO}`);
console.log(`  远端提交 ${commit.sha.slice(0, 8)}（父 ${parent.slice(0, 8)}）`);
console.log(`  站点 https://${OWNER}.github.io/${REPO}/`);
