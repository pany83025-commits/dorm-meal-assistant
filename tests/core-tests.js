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

    /* ---------- 油脂互认 ---------- */
    S.inv = [{ id: 200, n: "大豆油", g: 400, d: dstr(new Date()) }];
    rebuildFoods();
    eq("只有大豆油也能满足橄榄油", haveIng("橄榄油"), true);
    eq("supplyOf 指向库存那种油", supplyOf("橄榄油"), "大豆油");
    eq("没有油时判定为缺", (S.inv = [], rebuildFoods(), haveIng("橄榄油")), false);
    eq("非油食材不互认", (S.inv = [{ id: 0, n: "鸡蛋", g: 100, d: dstr(new Date()) }], rebuildFoods(), haveIng("鸡胸肉")), false);

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

    /* ---------- 版本比较 ---------- */
    eq("3.8 比 3.7 新", verNewer("3.8", "3.7"), true);
    eq("3.7 不比 3.7 新", verNewer("3.7", "3.7"), false);
    eq("3.10 比 3.9 新（按段比较）", verNewer("3.10", "3.9"), true);
    eq("3.7 不比 3.7.1 新", verNewer("3.7", "3.7.1"), false);
    eq("APP_VER 是 主.次.修订 三段式", /^\d+\.\d+\.\d+$/.test(APP_VER), true);
    eq("补丁号变大算新版", verNewer("3.18.1", "3.18.0"), true);
    eq("三段比两段（老版本）", verNewer("3.18.0", "3.17"), true);

    /* ---------- 甜品 / 饮品 / 烘焙原料 ---------- */
    const tart = BY["葡式蛋挞"], butter = BY["黄油"], cream = BY["淡奶油"], cola = BY["可乐"];
    eq("葡式蛋挞 已入库", !!tart, true);
    near("蛋挞 305 kcal/100g", tart.kcal, 305, 1);
    eq("蛋挞 分类＝甜点", tart.cat, "dessert");
    eq("蛋挞 一只 60g", tart.ug, 60);
    eq("黄油 脂肪 81g", butter.f, 81);
    eq("淡奶油 脂肪 35g", cream.f, 35);
    eq("可乐 分类＝饮品", cola.cat, "drink");
    eq("甜点条目 ≥20", RAW.filter((r) => r[1] === "dessert").length >= 20, true);
    eq("饮品条目 ≥15", RAW.filter((r) => r[1] === "drink").length >= 15, true);
    eq("分类标签含甜点/饮品", CAT.dessert === "甜点" && CAT.drink === "饮品", true);
    /* 一只蛋挞按默认单位记，热量应与 305×60% 吻合 */
    const oneTart = Math.round(tart.kcal * tart.ug / 100);
    near("一只蛋挞 183 kcal", oneTart, 183, 1);

    /* ---------- 更新检查：版本比较与状态记录 ---------- */
    eq("3.9 比 3.8 新", verNewer("3.9", "3.8"), true);
    eq("9.0 比 3.9 新（主版本）", verNewer("9.0", "3.9"), true);
    const _upd = S.upd;
    updSave({ latest: "9.9", newer: true, src: "Pages", err: "" });
    eq("updSave 记下最新版", S.upd.latest, "9.9");
    eq("updSave 默认带 err 字段", typeof S.upd.err, "string");
    updSave({ err: "connect timeout" });
    eq("updSave 追加失败原因", S.upd.err, "connect timeout");
    eq("updSave 不清掉已有值", S.upd.latest, "9.9");
    eq("失败时 newer 仍是上次的值", S.upd.newer, true);
    S.upd = _upd;
    eq("updTime 没查过", updTime(0), "还没查过");
    eq("updTime 格式化 6 月 3 日 08:05", updTime(new Date(2026, 5, 3, 8, 5).getTime()), "6-03 08:05");

    /* ---------- 补记：把一条记录写到昨天 ---------- */
    const _t0 = today(), _y1 = dayAdd(_t0, -1);
    logDay = "";
    eq("logDate 默认今天", logDate(), _t0);
    eq("backfillDay 默认空", backfillDay(), "");
    logDay = _y1;
    eq("logDate 跟随 logDay", logDate(), _y1);
    eq("backfillDay 是昨天", backfillDay(), _y1);
    logDay = dayAdd(_t0, 3);
    eq("未来日期落回今天", logDate(), _t0);
    eq("未来日期不算补记", backfillDay(), "");
    /* 走真实入口：pickLog 开数量页 → doLog 落账 */
    const _n0 = S.logs.length, _k0 = daySum(_y1).t.kcal, _c0 = daySum(_t0).t.kcal;
    logDay = _y1;
    pickLog(BY["米饭"].id);
    const _gi = document.getElementById("addg");
    if (_gi) _gi.value = "200";
    doLog();
    eq("补记多一条记录", S.logs.length, _n0 + 1);
    eq("记录的日期写成昨天", S.logs[S.logs.length - 1].d, _y1);
    near("昨天合计多了 200g 米饭", daySum(_y1).t.kcal - _k0, 232, 6);
    eq("今天合计没被改动", daySum(_t0).t.kcal, _c0);
    const _bk = trendBuckets(dayAdd(_t0, -2), _t0);
    eq("趋势里昨天那天有记录", _bk[1] && _bk[1].to === _y1 && _bk[1].n >= 1, true);
    /* 复原 */
    S.logs.pop(); save(); closeSheet(true);
    if (document.getElementById("page").classList.contains("on")) closePage();
    logDay = "";


    eq("guessMeal 落在四档内", ["早", "午", "晚", "加"].indexOf(guessMeal()) > -1, true);
    eq("MEAL_LABEL 完整", Object.keys(MEAL_LABEL).length, 5);
    /* ---------- 食谱合并：三套进同一个池子，按记录频率排 ---------- */
    eq("logNameKey 去食堂前缀与份数", logNameKey("食堂 · 番茄炒蛋盖饭 ×1.5"), "番茄炒蛋盖饭");
    eq("logNameKey 去外食前缀", logNameKey("外食 · 肉蟹煲"), "肉蟹煲");
    eq("logNameKey 无前缀原样", logNameKey("地锅鸡"), "地锅鸡");
    const _fm = { "地锅鸡": 3, "地锅鸡 等 2 道": 2, "肉蟹煲": 1 };
    eq("freqHit 同名整次＋套餐半次", freqHit(_fm, "地锅鸡"), 4);
    eq("freqHit 没吃过是 0", freqHit(_fm, "酸菜鱼"), 0);
    const _q = q, _src = rcpSrc, _f = rcpFilter, _logs = S.logs.slice();
    q = ""; rcpSrc = "all"; rcpFilter = "all";
    eq("合并后条目数 = 系统 + 自建 + AI",
      rcpSortedList().length, RCP.length + (S.myDish || []).length + (S.myRcp || []).length);
    rcpSrc = "sys";
    eq("系统范围只有系统", rcpSortedList().every((x) => x.k === "sys"), true);
    rcpSrc = "mine";
    eq("自定义范围没有系统", rcpSortedList().every((x) => x.k !== "sys"), true);
    rcpSrc = "all";
    const _hot = RCP[5].n;
    for (let i = 0; i < 5; i++) S.logs.push({ d: dayAdd(today(), -i), m: "午", name: _hot, kcal: 400, p: 20, f: 10, c: 50, na: 600, veg: 0 });
    eq("常吃的排到最前", rcpSortedList()[0].n, _hot);
    eq("常吃的带上次数", rcpSortedList()[0].f, 5);
    S.logs = _logs;
    q = _q; rcpSrc = _src; rcpFilter = _f;

    /* ---------- 外观三态 ---------- */
    const _th = S.set.theme;
    setTheme("dark");
    eq("深色写进 data-theme", document.documentElement.getAttribute("data-theme"), "dark");
    eq("深色记进设置", themeMode(), "dark");
    setTheme("light");
    eq("浅色写进 data-theme", document.documentElement.getAttribute("data-theme"), "light");
    setTheme("auto");
    eq("auto 记进设置", themeMode(), "auto");
    const _sysDark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme:dark)").matches);
    eq("auto 跟着系统深浅", document.documentElement.getAttribute("data-theme"), _sysDark ? "dark" : "light");
    S.set.theme = _th; applyTheme();
    eq("THEME_LABEL 三档齐全", Object.keys(THEME_LABEL).length, 3);

    /* ---------- 外食：菜单 → 拆解 → 记账（AI 打桩，不走网络） ---------- */
    eq("menuName 单道", menuName("地锅鸡"), "地锅鸡");
    eq("menuName 多道", menuName("地锅鸡、手撕包菜、米饭"), "地锅鸡 等 3 道");
    const _ap = window.aiPost, _aiSave = S.ai, _ln = S.logs.length, _nd = (S.myDish || []).length;
    const _alert = window.alert, _confirm = window.confirm;
    window.alert = function () {};
    window.confirm = function () { return true; };
    S.ai = { key: "test", model: "test" };
    let _calls = 0;
    window.aiPost = function (payload, cb) {
      _calls++;
      const body = JSON.stringify(payload);
      const content = body.indexOf("独立估算") > -1
        ? { kcal: 700, lo: 620, hi: 780, p: 42, c: 60, f: 34, note: "按两人份" }
        : { name: "地锅鸡", items: [{ name: "鸡腿肉", g: 180 }, { name: "土豆", g: 100 }, { name: "橄榄油", g: 12 }], note: "两人的量" };
      cb(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
    };
    eoOut = { n: 2, share: 0.5, oil: "一般" };
    eoText = "地锅鸡";
    runEatOut("text");
    eq("外食拆出三项", aiDishItems.length, 3);
    eq("外食上下文记下人数份量", aiOut && aiOut.n === 2 && aiOut.share === "一半", true);
    eq("外食菜名", aiDishName, "地锅鸡");
    eq("发出了两次请求（拆解＋核对）", _calls, 2);
    eq("核对拿到热量", aiEst && aiEst.kcal, 700);
    eq("核对拿到蛋白", aiEst && aiEst.p, 42);
    const _tot = (document.getElementById("ai_total") || {}).textContent || "";
    eq("合计区有 AI 核对", _tot.indexOf("AI 核对") > -1, true);
    eq("合计区逐项列了蛋白", _tot.indexOf("蛋白 本地") > -1, true);
    eq("外食页有外食横幅", (document.getElementById("sheetBox") || {}).textContent.indexOf("外食 · 2 人") > -1, true);
    doAiDish();
    eq("记账落在今天", S.logs[S.logs.length - 1].d, today());
    eq("存成我的菜品", S.myDish.length, _nd + 1);
    eq("备注标了外食", String(S.myDish[S.myDish.length - 1].note).indexOf("外食估算") === 0, true);
    S.logs.length = _ln; S.myDish.length = _nd;
    aiOut = null; S.ai = _aiSave; window.aiPost = _ap; eoText = "";
    window.alert = _alert; window.confirm = _confirm;
    closeSheet(true);
    if (document.getElementById("page").classList.contains("on")) closePage();
    save();
  } catch (e) {
    fails.push("异常：" + e.message);
  }

  document.title =
    "TESTRESULT::" + JSON.stringify({ pass: pass.length, fail: fails.length, fails: fails.slice(0, 20) });
})();
