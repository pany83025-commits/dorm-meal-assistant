#!/usr/bin/env node
/*
 * 在真实浏览器里跑 tests/core-tests.js（不 stub DOM，测的就是线上那份代码）。
 *   node tools/run-tests.mjs
 * 可用环境变量 CHROME_BIN 指定浏览器路径；找不到浏览器时会失败并提示。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");

const CANDIDATES = [
  process.env.CHROME_BIN,
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

function findBrowser() {
  for (const c of CANDIDATES) {
    try {
      execFileSync(c, ["--version"], { stdio: "pipe", timeout: 15000 });
      return c;
    } catch {
      /* 试下一个 */
    }
  }
  return null;
}

const browser = findBrowser();
if (!browser) {
  console.error("找不到 Chrome/Chromium，请设置 CHROME_BIN");
  process.exit(1);
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const tests = fs.readFileSync(path.join(ROOT, "tests/core-tests.js"), "utf8");
// 注入到 </body> 之前，等页面初始化完再跑
const injected = html.replace(
  "</body>",
  `<script>setTimeout(function(){\n${tests}\n},400);</script>\n</body>`
);

const tmp = path.join(os.tmpdir(), `dorm-meal-test-${process.pid}.html`);
fs.writeFileSync(tmp, injected);

let dom = "";
try {
  dom = execFileSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=520,900",
      "--virtual-time-budget=8000",
      "--dump-dom",
      "file://" + tmp.replace(/\\/g, "/"),
    ],
    { encoding: "utf8", maxBuffer: 40 * 1024 * 1024, timeout: 120000 }
  );
} finally {
  try { fs.unlinkSync(tmp); } catch { /* ignore */ }
}

const m = dom.match(/TESTRESULT::(\{[\s\S]*?\})<\/title>/);
if (!m) {
  console.error("没有拿到测试结果，页面可能在初始化阶段就报错了");
  process.exit(1);
}

const res = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
console.log(`通过 ${res.pass} 项，失败 ${res.fail} 项`);
if (res.fail) {
  res.fails.forEach((f) => console.error("  ✗ " + f));
  process.exit(1);
}
console.log("✓ 单测全部通过");
