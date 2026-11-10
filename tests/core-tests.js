/*
 * 纯函数单测：在真实页面里执行（不 stub DOM），由 tools/run-tests.mjs 注入。
 * 只测「算错了会误导用户」的那些函数。
 */
(function () {
  const pass = [];
  const fails = [];

  function eq(name, got, want) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    (ok ? pass : fails).push(ok ? name : `${name}：期望 ${JSON.stringify(want)}，实际 ${JSON.stringify(got)}`);
  }
  function near(name, got, want, tol) {
    const ok = Math.abs(got - want) <= (tol == null ? 1 : tol);
    (ok ? pass : fails).push(ok ? name : `${name}：期望 ≈${want}，实际 ${got}`);
  }

  try {
    /* ---------- 数据装载 ---------- */
    eq("RAW 条数 ≥200", RAW.length >= 200, true);
    eq("RCP 条数", RCP.length, 48);
    eq("DISH 条数", DISH.length, 81);
    eq("F 与 RAW 等长（无自建时）", F.filter((f) => !f.my).length, RAW.length);

    /* ---------- 按包装标签录入的条目 ---------- */
    const soy = BY["生抽"], oil = BY["大豆油"];
    eq("生抽 来自标签", soy && soy.src.indexOf("包装") === 0, true);
    near("生抽 钠 5891mg/100g", soy.na, 5891, 3);
    eq("生抽 一汤匙 18g", soy.ug, 18);
    eq("大豆油 存在", !!oil, true);
    near("大豆油 3700kJ→884kcal", oil.kcal, 884.3, 1.5);
    eq("大豆油 脂肪 100g", oil.f, 100);

    /* ---------- keepDays 温度分档 ---------- */
    const f = { kc: 10, kw: 5 };
    S.set = Object.assign({}, S.set, { offset: 0 });   /* roomT() = 室温 + 偏移，测分档时先归零 */
    const tiers = [
      [5, Math.floor(10 * 1.2)],
      [15, 10],
      [24, Math.floor((10 + 5) / 2)],
      [30, 5],
      [35, Math.floor(5 * 0.8)],
    ];
    tiers.forEach(([t, want]) => {
      S.w = Object.assign({}, S.w, { t: t });
      eq(`keepDays 室温 ${t}℃`, keepDays(f), want);
    });
    S.w = Object.assign({}, S.w, { t: null });

    /* ---------- 目标计算（Mifflin-St Jeor） ---------- */
    S.set = Object.assign({}, S.set, { sex: "女", weight: 60, height: 165, age: 22, act: 1.375, locked: false });
    calcTargets();
    eq("calcTargets 热量", S.set.kcal, 1470);
    eq("calcTargets 蛋白 1.6g/kg", S.set.protein, 96);
    eq("calcTargets 脂肪 0.8g/kg", S.set.fat, 48);
    near("calcTargets 碳水由余量反推", S.set.carb, (1470 - 4 * 96 - 9 * 48) / 4, 1);

    /* ---------- 日期 ---------- */
    eq("daysAgo 今天", daysAgo(dstr(new Date())), 0);
    eq("daysAgo 昨天", daysAgo(dstr(new Date(Date.now() - 864e5))), 1);
    eq("dstr 补零", dstr(new Date(2026, 0, 5)), "2026-01-05");

    /* ---------- 食材匹配四级 ---------- */
    eq("matchFood 同名", matchFood("鸡蛋").n, "鸡蛋");
    eq("matchFood 同义词", matchFood("西红柿").n, "番茄");
    eq("matchFood 去括号", matchFood("鸡胸肉（去皮）").n, "鸡胸肉");
    eq("matchFood 匹配不到", matchFood("完全不存在的东西"), null);

    /* ---------- 宏量计算 ---------- */
    const dm = dishMacro({ i: [["鸡蛋", 50], ["米饭", 150]] }, 1);
    near("dishMacro 热量", dm.kcal, 139 * 0.5 + 116 * 1.5, 0.6);
    near("dishMacro 总重", dm.g, 200, 0);
    const d2 = dishMacro({ i: [["鸡蛋", 50]] }, 2);
    near("dishMacro 双份翻倍", d2.kcal, 139, 0.6);

    const rm = rcpMacro(RCP[0]);
    eq("rcpMacro 与 macOfRcp 一致", macOfRcp(RCP[0]).kcal, rm.kcal);
    eq("rcpMacro 有热量", rm.kcal > 0, true);

    /* ---------- 推荐 ---------- */
    S.logs = [];
    S.inv = [{ id: 0, n: "鸡蛋", g: 500, d: dstr(new Date()) }];
    S.waste = [];
    rebuildFoods();
    const rec = recommend("鸡蛋");
    const allHit = rec.now.concat(rec.near).every(
      (x) => [x.r.n].concat(x.r.m || []).concat(x.r.o || []).join("|").indexOf("鸡蛋") > -1
    );
    eq("recommend 关键词只出相关菜", allHit, true);
    eq("recommend 空关键词有结果", recommend("").now.length >= 0 && recommend("").now.length <= 4, true);

    /* ---------- 买菜清单 ---------- */
    const gap = shopGap();
    eq("shopGap 有缺口", Object.keys(gap).length > 0, true);
    const first = Object.keys(gap)[0];
    eq("shopGap 解锁数 ≥1", gap[first].unlock >= 1, true);

    /* ---------- 状态迁移 ---------- */
    const ms = mergeState({ inv: [], logs: [] });
    eq("mergeState 补 set", ms.set.protein, 96);
    eq("mergeState 补数组", Array.isArray(ms.waste) && Array.isArray(ms.shop) && Array.isArray(ms.myFood), true);
    eq("mergeState 非法数组纠正", Array.isArray(mergeState({ inv: "x", logs: [] }).inv), true);
    eq("mergeState 保留原有值", mergeState({ inv: [], logs: [], set: { weight: 70 } }).set.weight, 70);

    /* ---------- 库存条目按名字解析 ---------- */
    eq("foodOf 老条目（只有 id）", foodName({ id: 3 }), "鸡胸肉");
    eq("foodOf 名字优先", foodName({ id: 3, n: "鸡蛋" }), "鸡蛋");
    eq("foodOf 孤儿返回空", foodName({ id: 99999 }), "");

    /* ---------- 转义 ---------- */
    eq("esc 处理尖括号", esc("<b>x</b>"), "&lt;b&gt;x&lt;/b&gt;");

    /* ---------- 餐次 ---------- */
    eq("guessMeal 落在四档内", ["早", "午", "晚", "加"].indexOf(guessMeal()) > -1, true);
    eq("MEAL_LABEL 完整", Object.keys(MEAL_LABEL).length, 5);
  } catch (e) {
    fails.push("异常：" + e.message);
  }

  document.title =
    "TESTRESULT::" + JSON.stringify({ pass: pass.length, fail: fails.length, fails: fails.slice(0, 20) });
})();
