# 开发文档

面向想改代码 / 跑测试 / 发版的人。使用说明见 [README.md](README.md)。

---

## 从源码加载

```bash
git clone https://github.com/XB-356/ao3-tag-manager.git
```

然后打开 `chrome://extensions/` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选这个仓库目录。

## 打包

```bash
node tools/pack.js             # 生成 dist/ao3-tag-manager-v<版本>.zip（扩展安装包）
node tools/build-userscript.js # 生成 dist/ao3-tag-manager.user.js（油猴脚本）
python tools/make_icons.py     # 重新生成 icons/ 下的图标
```

`pack.js` 会在打包前强制校验版本号——Chrome 只接受 1~4 段纯数字
（`1.2.3.18` 合法，`1.2.3-alpha.1` 会让整个扩展加载失败）。

## 发布

```bash
# 1. 改 manifest.json 与 src/lib/env-core.js 里的版本号（两处必须一致）
# 2. 打包
node tools/pack.js
node tools/build-userscript.js
# 3. 建 Release 并上传（凭证取自 GH_TOKEN / GITHUB_TOKEN，或 git 已登录的凭证助手）
node tools/release.js
```

`release.js` 按版本号自动生成 tag（如 `v1.2.3`）、写入发布说明，
附件同名时先删后传。加 `--notes-only` 可只更新说明。

---

## 测试

`test/` 下是完整的本地测试：把 mock 的 AO3 页面跑在本地，
用 CDP 驱动真实 headless Chrome 加载扩展并断言行为。

### 一次跑完（推荐）

```bash
node test/server.js    # 先另开一个终端起 mock 服务（默认 8877）
node test/all.js       # 全量跑，逐文件报通过数，任一失败即非零退出
```

`all.js` 会自动在浏览器测试之间清理遗留的 headless Chrome。

### 单个测试

| 文件 | 内容 | 项数 |
| --- | --- | --- |
| `test/i18n.js` | 汉化引擎整句/长句 | 25 |
| `test/i18n-guard.js` | **汉化护栏**：用户内容不得改动 + 界面文案必须翻 | 69 |
| `test/i18n-the.js` | 孤立冠词 `The` 的删除 | 9 |
| `test/i18n-homograph.js` | 多义词（Top / Last / Or）不得被片段替换 | 12 |
| `test/i18n-coverage.js` | **模拟环境覆盖**：50 条界面文案 + 11 条用户数据 + 作品卡片双向断言 | 71 |
| `test/i18n-banner.js` | 个人主页欢迎横幅（整句被 `<a>` 切碎） | 5 |
| `test/i18n-media.js` | 媒体页面包屑 + 同人圈条目不得改动 | 4 |
| `test/i18n-about.js` | 「关于我们」整页 | 5 |
| `test/i18n-comment.js` | 评论区界面文案 | 22 |
| `test/theme-i18n.js` | 深色适配 + 资料页汉化 | 19 |
| `test/run.js` | 主流程：屏蔽 / 只看 / 面板 / 右键 / 弹窗 / 规则编辑 | 71 |
| `test/author-parse.js` | 作者名解析（含伪名与登录名） | 15 |
| `test/parse-tags.js` | 标签解析 | 9 |
| `test/detect.js` | 站点识别 | 17 |
| `test/detect-browser.js` | 自动检测横幅 / 忽略名单 / 油猴行为 | 10 |
| `test/mirror-userscript.js` | 镜像域名 / 动态注册 / `file://` / 油猴版 | 22 |

> 测试环境需要本机有 Chrome（可用环境变量 `CHROME` 指定路径）。
> 测试产物输出到 `test/artifacts/`，该目录不入库。

### 校验脚本

```bash
python tools/check_css.py     # 大括号配平、编码、深色适配覆盖
python tools/check_i18n.py    # 词典重复键与格式
```

### 汉化排查工具

改词典时这两个脚本很有用：

```bash
# 对照官方 otwarchive 的 config/locales 盘点未收录条目（默认只盘点，不改词典）
node tools/from-locale.js --sections

# 找"会被片段替换破坏"的文案（翻出半英半中）
node tools/audit-partial.js

# 只扫界面区域的漏翻审计（需要先把真实页面另存为 HTML）
node tools/audit-ui-areas.js <snapshot.html> [更多...]
```

`audit-ui-areas.js` 有两个避免假阳性的关键设计，改动时别退化：

1. **优先用 `data-ao3tm-orig`（扩展存的原文）**对照当前词典。
   直接看快照文本会大量假阳性——页面里已是旧版本翻出来的译文，
   当前词典当然匹配不上（例如已是「筛选 by read」，而词典里是 `Filter by read`）。
2. **"能翻"要同时算三条路径**（整段 lookup / 分段 compound / 内嵌 inline），
   否则 `Works (0)` 这种会被误报（它靠分段路径翻成「作品 (0)」）。

### 重新生成 README 效果图

```bash
node test/shoot-docs.js      # 输出到 docs/images/
node test/shoot-night.js     # 单独拍深色下的截图（供人工核对）
node test/shoot-detect.js    # 自动检测横幅
```

> 效果图不只是"美化"——它是最接近真实用户的验收。
> 曾经出现「作品卡片的统计行没翻」，所有自动测试都是绿的，是截图一眼看出来的。

---

## 站点识别是怎么判定的

`src/lib/detect.js` 是纯函数（接收 document / location），打分规则大致是：

| 证据 | 权重 |
| --- | --- |
| `li.work.blurb` 作品列表项 | 3 |
| `meta[name=generator]` 含 OTW Archive | 3 |
| `a.tag[href*="/works"]` 标签链接 ≥ 2 个 | 2 |
| 作品链接形如 `/works/数字` | 2 |
| AO3 的 `#footer` / `#header` 结构 | 2 |
| 导航含 `/works/search`、`/tags`、`/collections` | 1 |
| 存在 `#main`、`.header.module`（较通用） | 1 |
| 域名带 ao3 / mirror 字样 | 1 |
| **通用建站程序痕迹（WordPress 等）** | **−3 ~ −4** |

判定门槛：**必须有结构证据**，且总分 ≥ 6 为「高度确认」、≥ 3 为「很可能」。
只有域名像、页面没有 AO3 结构时**不会**判定为 AO3——蹭名字的站点很多。

---

## 汉化引擎的设计约束

改汉化相关代码前请先读这段，这里的历史坑最多：

- **界面文案翻；用户内容一个字不动。** 用户内容指作品标题、标签、作者名、
  简介、同人圈/系列列表、评论、可编辑区。
- **替换路径有四条**：整段 `lookup` / 分段 `translateCompound` /
  内嵌 `translateInlinePhrases` / 正则 `PATTERNS`。
  加保护时必须**四条全覆盖**——历史上只堵了两条，导致 PATTERNS 把
  `The 100 Series` 改成 `The 100 个系列`。
- **片段替换只允许在界面区域发生**（`inUiRegion`：按钮/表单/导航白名单）。
  否则会把用户数据改坏。
- **多义词**（`Top` / `Last` / `Or` / `Home` / `From` / `To`）列入
  `EXACT_ONLY` 或 `UI_ONLY_KEYS`，绝不参与片段替换。
- **整段命中不走片段守卫**。长句被 `<a>` 切碎时，正确做法是
  **按真实节点边界逐段收词条**，而不是放宽片段替换。
- 词典在 [`src/lib/i18n.js`](src/lib/i18n.js)，是扁平的「英文 → 中文」表。
  改完跑 `python tools/check_i18n.py` 与 `node test/all.js`。

---

## 目录结构

```
manifest.json               扩展清单（MV3）
icons/                      图标
_locales/zh_CN/             本地化名称
src/lib/env-core.js         宿主观测与域名判定（扩展 / 油猴 / service worker 共用）
src/lib/env.js              页面侧环境适配
src/lib/env.mjs             service worker 侧模块包装（MV3 禁止动态 import）
src/lib/storage.js          规则存储、迁移、导入导出（chrome.storage / localStorage 双驱动）
src/lib/match.js            匹配引擎（子串 / 全等 / 模糊 / 正则 / 只看判定）
src/lib/dom.js              AO3 页面结构解析（卡片、标签、作者、作品页）
src/lib/i18n.js             界面汉化词典与翻译引擎
src/lib/detect.js           AO3 站点识别（纯函数）
src/lib/mirrors.js          镜像站：权限申请与内容脚本动态注册
src/lib/mirrors.mjs         service worker 侧模块包装
src/lib/auto-detect.js      自动检测的触发时机与页面横幅
src/lib/panel.js            规则设置面板（站内浮层与弹窗共用）
src/lib/panel.css           面板与页内注入元素样式
src/core/filter.js          过滤执行（屏蔽 / 只看 / 同系列 / 临时显示）
src/core/ui.js              页内注入（统计条、快捷按钮、标签按钮、菜单、提示）
src/core/focus.js           快捷键与临时聚焦
src/core/content.js         消息响应 + 页面事件桥
src/core/main.js            入口与 Turbo 页面切换
src/background.js           右键菜单 + 镜像注册
src/popup/                  扩展弹窗 / 设置页
test/                       本地测试（端到端 + 解析单测 + 镜像/油猴 + 文档截图）
tools/pack.js               打包成可安装的 zip
tools/build-userscript.js   构建油猴脚本版
tools/bundle.js             两种打包共用的源码拼接（处理 ESM 与普通脚本的双重身份）
tools/release.js            创建 GitHub Release 并上传安装包
```

manifest 里保留了 `http://127.0.0.1/*`、`http://localhost/*` 两条匹配规则，
仅用于本地测试；不需要可以自行删除。

---

## 页面事件桥

页面上的脚本（例如书签小工具）可以这样调用扩展：

```js
window.addEventListener('ao3tm:result', (e) => console.log(JSON.parse(e.detail)));
window.dispatchEvent(
  new CustomEvent('ao3tm:command', { detail: JSON.stringify({ type: 'ao3tm:state', id: '1' }) })
);
```

支持 `ao3tm:state`（当前页统计）、`ao3tm:refresh`、`ao3tm:panel`、`ao3tm:reveal`。

---

## 许可

[GPL-3.0](LICENSE)。
