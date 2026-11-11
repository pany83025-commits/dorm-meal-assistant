# 寝室餐食助手

一个装在自己手机里的「寝室减脂餐」记账 + 配餐工具。**单个 HTML 文件，零依赖，数据只存本机。**

在只有一口 600W 小锅、没有冰箱的寝室里，能做什么、今天该吃多少、买的菜还剩几天、食堂这顿大概多少卡——这个应用想把这四件事算清楚，并且每个数字都能查到来源。

**[在线试用 →](https://pany83025-commits.github.io/dorm-meal-assistant/)**　（手机浏览器打开后可「添加到主屏幕」，离线可用）


<p align="center">
  <img src="docs/screenshot-today.png" width="300" alt="今天">
  <img src="docs/screenshot-recipes.png" width="300" alt="食谱">
</p>

<sub>截图为示例数据。</sub>

## 功能

| 页面 | 做什么 |
|---|---|
| **今天** | 热量 / 蛋白 / 碳水 / 脂肪 / 钠 五条进度；按库存实时推荐「现在就能做」的菜；临期与浪费提醒；一句话简报（早上问早餐、晚上复盘） |
| **食谱** | 48 道寝室可做的菜 + 你自建 / AI 写的，**合成一个列表**，默认按近 30 天吃过的次数排（常吃的在最上面）；按早餐 / 主菜 / 汤锅 / 免开火筛选，可按菜名或食材搜索；**点左上角「食谱 ▾」**切换看全部 / 自定义 / 系统；每道都有分步做法、**判断熟没熟的标准**、**做失败长什么样**；**食用油互认**（库存里任意一种油都能满足食谱里的油，扣的也是你实际有的那瓶） |
| **食材** | **293 条**营养库（每 100g 可食部，标明生重 / 熟重 / 净重 / 干重），含 **24 道常见甜品**（蛋挞 / 瑞士卷 / 泡芙 / 提拉米苏 / 芝士蛋糕 / 蛋黄酥…）、**21 种饮品**（奶茶 / 拿铁 / 可乐 / 乳酸菌饮料 / 豆奶…）与**烘焙原料**（黄油 / 淡奶油 / 炼乳 / 低筋面粉…）；搜不到可**新建食材**，填不动就让 AI 按每 100g 估一份（来源会标成「AI 估算」）；库存按到期排序，临期标红；**买菜清单**把「还差 1 样」的菜缺的食材汇总成一张单，勾选后一键入库；支持计浪费 |
| **记录** | **记这一餐**：自建菜谱与内置食谱同一套页面，可选「吃库存（扣库存）」或「吃食堂（不扣库存）」，可改每样食材的克数、去掉没放的、临时加食材——只影响这一餐，不动食谱；**外食**：贴菜单或拍菜单/餐桌照 + 几个人一起吃 + 你吃了几成 + 这家油不油，AI 按你实际吃到的量拆成食材，热量仍由本地成分表算，再用一次**独立的 AI 核对**把热量与三大营养素逐项对一遍（差得多会标出来）；按早/午/晚/加餐分组并各自小计与占比；点条目看热量来源；整页**日视图**可左右滑换天、上滑开日历，页头 **＋** 就是「给这天记一笔」——翻到昨天及以前即**补记**（写到那天，照常进趋势与日均统计，未来日期不可选）；**趋势页**有日均与热量/营养素竖条图，支持 7 天/30 天/半年/自定义 |
| **设置** | 身体与目标（Mifflin-St Jeor）、本地天气修正保存期、**外观（跟随系统 / 浅色 / 深色）**、AI Key、自定义食谱、数据导出 / 恢复 |

细节：开屏动画、整页子视图从右侧滑入/滑出、弹层分层切换动效、弹层下拉带阻力与回弹（内容到顶才触发，拖够才退一层）、返回键与边缘滑动都是**逐层退出**（弹层→整页→标签页，最后才离开应用）、记录页是**横向分页**：一次渲染前一天/当天/后一天三页，左右拖动时邻居页同时跟手进入，拖够或甩动即翻页、否则回弹；箭头按钮走同一条轨道动画。标签页与子视图在 5 分钟内回到原滚动位置、按压反馈、**深色模式**（跟随系统）、键盘可达与 `aria` 语义、`prefers-reduced-motion` 降级；PWA 可添加到主屏离线使用；Android 壳工程额外提供原生 AI 通道（绕开 CORS）、相册选图、状态栏沉浸。

## 数据来源与边界

这个项目的原则是「**宁可标不确定，也不假装精确**」。

- **营养数值**：198 条来自《中国食物成分表 标准版（第 6 版）》，另有包装标签（荞麦面、辣椒面）、USDA SR Legacy（鸡腿 / 鸭腿去皮）与少量常见值，**每条食材都带来源字段**，界面上直接显示。
- **保存期不是实验数据**，是食品常识估算，再按当地气温分档修正。界面上写的是「常温 N 天」，不是保质期。
- **AI 只做结构化，不写数字**：AI 负责把「香菇滑鸡饭」拆成配料表、把做法写成步骤，所有营养数值一律回到本地库重算。拆不出来的食材会显式标红，可以手动指定或新建。
- **AI 核对是第二条证据，不是真值**：拆完之后会让 AI 不看配料表、只凭菜名再估一份（热量 + 蛋白/碳水/脂肪），两边差得多就把差额标出来，提示你去查漏项或油糖给多。它和本地库是两条独立路径，互相印证只能说明「没明显错」，不能说明「精确」——所以 AI 的数只用来提示，从不自动覆盖本地算出来的值。
- **历史记录不随数据修正而变**：记账那一刻算好的数值就存下来了，后面改库也不会篡改旧账。
- 自建食材会标「自建食材（非成分表）」，不会被伪装成权威数据。

## 项目结构

```
index.html                 主程序（数据 + 逻辑 + 样式全部内联，单文件可直接双击）
data/foods.json            食材营养库（权威源，293 条）
data/recipes.json          寝室食谱（48 道）
data/dishes.json           食堂菜配方（81 道）
tools/build-data.mjs       把 data/*.json 内联回 index.html
tools/check-data.mjs       数据自检（结构 / 引用完整性 / 宏量与热量自洽）
tools/run-tests.mjs        在浏览器里跑纯函数单测
tools/release.mjs          把 APK 传到 GitHub Release（更新提示靠它）
tools/bump.mjs             一次改齐四处版本号
tools/check-version.mjs    四处版本一致性检查（verify 的一环）
tools/build-apk.sh         一条命令打包（工具链与签名参数在仓库外）
tools/push.mjs             走 Git Data API 推送（本机 git 端口不通时用）
version.json               线上版本号，应用启动时读它判断要不要提示更新
tests/core-tests.js        单测用例
manifest.json / sw.js      PWA 配置与离线缓存
icon-*.png                 图标
_apk/                      Android 壳工程
  ├── AndroidManifest.xml
  ├── src/com/dorm/meal/MainActivity.java   WebView 宿主、AI 原生通道、相册选图、insets
  ├── res/                 主题与配色（含 Android 12+ 开屏图标消除）
  ├── assets/              打包时自动拷入的页面与图标
  └── build.sh             aapt2 → javac → d8 → zipalign → apksigner
docs/                      README 截图
```

## 使用

**网页版**：直接用浏览器打开 `index.html`（双击即可，无需服务器），或起个静态服务后访问（添加到主屏、离线缓存需要 http/https）：

```bash
python -m http.server 8000
# 浏览器打开 http://localhost:8000/
```

**Android**：用 `_apk/build.sh` 打包，需要 JDK、Python 3、Android SDK 的 build-tools 与 `android.jar`，无需 Android Studio。

```bash
cd _apk
export ANDROID_BUILD_TOOLS=/path/to/build-tools/34.0.0
export ANDROID_JAR=/path/to/platforms/android-34/android.jar
export DORM_KS=/path/to/your.jks        # 自己的签名密钥，仓库不含
export DORM_KS_ALIAS=dorm
export DORM_KS_PASS='******'            # 只用环境变量传，不要写进仓库
bash build.sh v3.9
```

> **签名密钥不入库。** 同一个包名如果用别人的密钥签名，会直接装不上或覆盖失败，所以 keystore 请自己保管。想二次开发的话，自己生成一个即可：`keytool -genkeypair -keystore release.jks -alias dorm -keyalg RSA -validity 10950`。

**AI 功能**（可选）：设置 → AI 写菜谱，填入兼容 OpenAI 格式的 Key 与模型名。不填也能用全部离线功能。

**发版**：版本号散落在四处（`index.html` 的 `APP_VER`、`version.json`、`AndroidManifest` 的 versionName/versionCode、`package.json`），手动改必漏，所以有脚本：

```bash
node tools/bump.mjs 3.10 --note "一句话说明这次更新"   # 四处一起改，versionCode = 主×10+次
npm run verify                                        # 数据同步 / 数据自检 / 版本一致性 / 115 项单测
bash tools/build-apk.sh                               # 出包，版本号自动取 APP_VER
node tools/push.mjs -m "v3.10：…"                      # 推仓库，Pages 自动重建
GH_TOKEN=xxx node tools/release.mjs ./寝室餐食助手-v3.10.apk   # 传 Release，资源名固定 dorm-meal.apk
```

`tools/build-apk.sh` 会从环境变量或 `~/.dormmeal/secret.env` 读 `DORM_KS_PASS`（密钥与密码都不入库）。`tools/push.mjs` 走 Git Data API 而不是 `git push`——有些网络到不了 `github.com:443` 的 git 端口，这条通路能过就说明 API 能过。token 放在 `~/.dormmeal/gh_token`，同样在仓库之外。

装过的旧版下次打开（或从后台切回前台）就会看到「有新版本 v3.10」的提示条，点「去更新」跳到浏览器下载。网页版不需要最后一步：`index.html` 走 network-first，刷新即新版。

> 侧载 APK 的最后一步安装必须由你点确认，这是 Android 的限制，应用只负责「发现新版 + 打开下载」。

## 改数据 / 开发

数据（食材、食谱、食堂菜）以 `data/*.json` 为权威源，`index.html` 里内联的那段 JSON 是生成物，**别直接改它**：

```bash
node tools/build-data.mjs     # 改完 data/*.json 后同步进 index.html
npm run verify                # 数据同步检查 + 数据自检 + 单测，一次跑完
```

`npm run verify` 会拦四类问题：

1. **数据和 HTML 不同步**——`build-data.mjs --check`，防止改了 JSON 忘了内联；
2. **数据自相矛盾**——引用不存在的食材、热量与 4/4/9 宏量偏差过大（酒精与高纤维食物豁免）、食谱缺「怎么算做好了」、食堂菜克数为 0；
3. **版本号不一致**——`check-version.mjs` 比对四处版本；漏改 `version.json` 会让应用永远收不到更新，漏改 versionCode 会让覆盖安装被拒；
4. **纯函数算错**——`keepDays` 温度分档、`calcTargets` 的 Mifflin-St Jeor、`dishMacro`/`rcpMacro`、`matchFood` 四级匹配、`shopGap` 缺口、`mergeState` 迁移、油脂互认、版本比较与更新状态、补记落到目标日期且不算进今天等 115 个用例，在真实浏览器里跑线上那份代码。


## 已知限制

- 保存期、食堂菜的用油量都是估算，误差在所难免；食堂菜按「配方 + 常见份量」推导，同一道菜不同窗口差别可能很大。
- 营养库以中式常见食材为主，进口 / 预制食品覆盖有限。**甜品与饮品是「常见配方 / 典型包装」的估算值**（例如蛋挞 305 kcal/100g，不同店可差 ±20%），不是实测；有包装标签时以标签为准。
- 「新建食材」里的 AI 估算是按常见做法推的典型值，来源会标成「AI 估算（未核对）」，别当实验室数据用。
- 自建食材目前只能改名重建（同名保存会覆盖原条并沿用原 ID），没有单独的删除入口。
- 单机应用，没有账号、没有云同步；换机请用「设置 → 数据 → 导出备份」（网页版与 APK 都能导出、也都能导入）。备份**不含 AI Key**，恢复后需要重填。
- 只做过 Android（WebView）与桌面 Chrome 的验证，iOS Safari 未系统测试。
- 侧载 APK 无法静默自动安装：应用只负责"发现新版 + 打开下载"，最后一步安装要你点确认。
- 更新检查每小时最多一次；从后台切回前台会补查一次（原生 `onResume` → `window.__onResume`）。
- 检查会依次尝试两个来源：Pages 上的 `version.json`、GitHub API 的 latest release；都失败也不会崩。
- **「设置 → 检查更新」可以直接看结果**：当前版本、线上版本、数据来源、失败原因，以及「立即检查」和「去下载页」两个按钮。查不到时先看这里，再判断是网络问题还是真的没发版。

## 免责声明

个人自用工具，营养数值用于估算参考，不构成医学或营养学建议。有任何健康问题请咨询专业医师或注册营养师。

## 许可证

[MIT](LICENSE)。代码随便用，但如果要分发修改版，请保留版权声明；营养数据的原始来源（《中国食物成分表》）请遵守其自身的使用条款。
