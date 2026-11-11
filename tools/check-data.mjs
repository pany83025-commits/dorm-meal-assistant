#!/usr/bin/env node
/*
 * 数据自检：跑在 CI 里，不需要浏览器。
 *   node tools/check-data.mjs
 *
 * 查的是「会算错数」和「会引用到不存在食材」这两类问题，
 * 而不是代码风格。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));

const foods = read("data/foods.json");
const recipes = read("data/recipes.json");
const dishes = read("data/dishes.json");

const CATS = new Set(["protein", "carb", "veg", "fruit", "fat", "dessert", "drink", "other"]);
const LABELS = new Set(["生重", "熟重", "净重", "干重", "可食部", "泡发后", "毛重15g·可食60%"]);
const FIELDS = ["名称", "分类", "kcal", "蛋白", "脂肪", "碳水", "纤维", "单位", "单位克数",
  "可食部", "冬存天数", "夏存天数", "口径", "来源", "备注", "钠", "钙", "铁", "维C", "胆固醇"];

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

/* ---------- 1) foods 结构 ---------- */
const names = new Set();
foods.forEach((r, i) => {
  const tag = `foods[${i}] ${r[0] || "?"}`;
  if (!Array.isArray(r) || r.length !== 20) { err(`${tag}: 字段数应为 20，实际 ${r.length}`); return; }
  if (typeof r[0] !== "string" || !r[0].trim()) err(`${tag}: 名称为空`);
  if (names.has(r[0])) err(`${tag}: 名称重复`);
  names.add(r[0]);
  if (!CATS.has(r[1])) err(`${tag}: 分类非法 ${r[1]}`);
  for (let k = 2; k <= 6; k++) {
    if (typeof r[k] !== "number" || Number.isNaN(r[k])) err(`${tag}: ${FIELDS[k]} 不是数字`);
    else if (r[k] < 0) err(`${tag}: ${FIELDS[k]} 为负`);
  }
  if (!(r[2] >= 0)) err(`${tag}: 热量不能为负`);
  else if (r[2] === 0) warn(`${tag}: 热量为 0，确认是无热量饮品`);
  if (typeof r[7] !== "string" || !r[7].trim()) err(`${tag}: 单位为空`);
  if (!(r[8] > 0)) err(`${tag}: 单位克数必须 > 0`);
  if (!(r[9] > 0 && r[9] <= 100)) err(`${tag}: 可食部应在 (0,100]，实际 ${r[9]}`);
  if (typeof r[12] !== "string" || !r[12].trim()) err(`${tag}: 口径为空`);
  else if (!LABELS.has(r[12])) warn(`${tag}: 口径是「${r[12]}」，不在常见口径列表里`);
  if (typeof r[13] !== "string" || !r[13].trim()) err(`${tag}: 来源为空`);
  for (const k of [10, 11]) if (!(r[k] >= 0)) err(`${tag}: 保存天数不能为负`);
  for (const k of [15, 16, 17, 18, 19]) {
    if (typeof r[k] !== "number" || r[k] < 0) err(`${tag}: 微量元素 ${FIELDS[k]} 异常`);
  }
});

/* ---------- 2) 宏量 vs 热量 ---------- *
 * 4/4/9 系数对两类食物天然不适用：
 *   - 含酒精（料酒）：酒精 7 kcal/g 不计入
 *   - 高膳食纤维（干香料、干菌藻）：纤维按 2 kcal/g，4/4/9 会高估
 * 这两类只做提示，其余偏差 > 30% 视为错误。
 */
const byName = new Map(foods.map((r) => [r[0], r]));
let macroWarn = 0;
foods.forEach((r) => {
  const [n, , kcal, p, fat, carb, fib] = r;
  if (!(kcal > 0)) return;
  const calc = 4 * p + 4 * carb + 9 * fat;
  const dev = (calc - kcal) / kcal;
  /* 低热量食物绝对差很小但相对差很大（娃娃菜 13 vs 19 kcal），按绝对值兜底 */
  if (Math.abs(dev) <= 0.3 || Math.abs(calc - kcal) <= 25) return;
  const excused = /酒/.test(n) || fib >= 5;
  const msg = `${n}: 标 ${kcal} kcal，4/4/9 算 ${Math.round(calc)}（${(dev * 100).toFixed(0)}%）`;
  if (excused) { macroWarn++; if (Math.abs(dev) > 0.8) warn(msg); }
  else err(msg);
});

/* ---------- 3) 食谱 ---------- */
const STEP_MIN = 3;
recipes.forEach((r, i) => {
  const tag = `recipes[${i}] ${r.n || "?"}`;
  if (typeof r.n !== "string" || !r.n.trim()) err(`${tag}: 名称为空`);
  if (!["早", "主", "汤", "免"].includes(r.c)) err(`${tag}: 分类非法 ${r.c}`);
  if (!(r.t > 0)) err(`${tag}: 时长必须 > 0`);
  if (!Array.isArray(r.m) || !r.m.length) err(`${tag}: 必需食材为空`);
  (r.m || []).forEach((n) => { if (!byName.has(n)) err(`${tag}: 必需食材「${n}」不在库里`); });
  (r.o || []).forEach((n) => { if (!byName.has(n)) err(`${tag}: 可选食材「${n}」不在库里`); });
  (r.m || []).forEach((n, k) => { if ((r.m || []).indexOf(n) !== k) err(`${tag}: 必需食材重复「${n}」`); });
  if (!Array.isArray(r.s) || r.s.length < STEP_MIN) err(`${tag}: 步骤少于 ${STEP_MIN} 条`);
  if (!r.chk || !String(r.chk).trim()) err(`${tag}: 缺少「怎么算做好了」`);
  if (!r.bad || !String(r.bad).trim()) err(`${tag}: 缺少「容易翻车的地方」`);
});

/* ---------- 4) 食堂菜 ---------- */
dishes.forEach((d, i) => {
  const tag = `dishes[${i}] ${d.n || "?"}`;
  if (typeof d.n !== "string" || !d.n.trim()) err(`${tag}: 名称为空`);
  if (!Array.isArray(d.i) || !d.i.length) err(`${tag}: 配方为空`);
  (d.i || []).forEach((it) => {
    if (!Array.isArray(it) || it.length !== 2) { err(`${tag}: 配方项格式错误`); return; }
    if (!byName.has(it[0])) err(`${tag}: 食材「${it[0]}」不在库里`);
    if (!(it[1] > 0)) err(`${tag}: 「${it[0]}」克数必须 > 0`);
  });
});

/* ---------- 汇总 ---------- */
const dishNames = new Set(dishes.map((d) => d.n));
if (dishNames.size !== dishes.length) warn("dishes 里有重名菜品");

console.log(`食材 ${foods.length} 条 / 食谱 ${recipes.length} 道 / 食堂菜 ${dishes.length} 道`);
console.log(`宏量偏差豁免 ${macroWarn} 条（酒精 / 高纤维）`);
if (warns.length) {
  console.log(`\n提示 ${warns.length} 条：`);
  warns.slice(0, 20).forEach((w) => console.log("  · " + w));
}
if (errors.length) {
  console.error(`\n✗ 发现 ${errors.length} 个问题：`);
  errors.slice(0, 40).forEach((e) => console.error("  · " + e));
  if (errors.length > 40) console.error(`  …还有 ${errors.length - 40} 条`);
  process.exit(1);
}
console.log("\n✓ 数据自检通过");
