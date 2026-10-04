/* 创建 GitHub Release 并上传安装包。
   用法：
     node tools/pack.js                 # 先打包
     node tools/release.js              # 用 manifest.json 里的版本号创建 release
     node tools/release.js --notes-only # 只更新说明，不重新上传附件

   凭证来源：优先环境变量 GH_TOKEN / GITHUB_TOKEN，否则问 git 的凭证助手（不落盘）。 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO = process.env.GH_REPO || 'XB-356/ao3-tag-manager';
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const VERSION = manifest.version;
const TAG = 'v' + VERSION;
const ZIP = path.join(ROOT, 'dist', 'ao3-tag-manager-v' + VERSION + '.zip');
const USERSCRIPT = path.join(ROOT, 'dist', 'ao3-tag-manager.user.js');
const NOTES_ONLY = process.argv.includes('--notes-only');

/** 取 token：环境变量优先，其次 git 凭证助手（Windows 凭证管理器），不写磁盘 */
function getToken() {
  const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  const res = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });
  if (res.status !== 0) return '';
  const line = String(res.stdout || '')
    .split(/\r?\n/)
    .filter((l) => l.indexOf('password=') === 0)[0];
  return line ? line.slice('password='.length) : '';
}

const TOKEN = getToken();
if (!TOKEN) {
  console.error('没有可用凭证。请设置 GH_TOKEN，或先用 git 登录过 github.com。');
  process.exit(2);
}
if (!NOTES_ONLY) {
  const need = [ZIP, USERSCRIPT].filter(function (file) {
    return !fs.existsSync(file);
  });
  if (need.length) {
    console.error('缺少产物，请先运行：node tools/pack.js && node tools/build-userscript.js');
    console.error('缺少：' + need.map(function (file) {
      return path.relative(ROOT, file);
    }).join(', '));
    process.exit(2);
  }
}

const API = 'https://api.github.com/repos/' + REPO;
const HEADERS = {
  Authorization: 'Bearer ' + TOKEN,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'ao3-tag-manager-release',
  'X-GitHub-Api-Version': '2022-11-28'
};

async function api(url, options) {
  const res = await fetch(url, Object.assign({ headers: HEADERS }, options || {}));
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (err) {
    json = null;
  }
  if (!res.ok) {
    const message = json && json.message ? json.message : text.slice(0, 300);
    const err = new Error(res.status + ' ' + message);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

const NOTES = [
  '## AO3 标签管家 v' + VERSION,
  '',
  '在 AO3（含镜像站）上记忆并管理标签 / 作者的**屏蔽**与**只看**规则，支持列表内快捷屏蔽、右键标签屏蔽、深色自动适配与界面汉化。',
  '',
  '### 两个安装包怎么选',
  '',
  '| 文件 | 适用 |',
  '| --- | --- |',
  '| `ao3-tag-manager-v' + VERSION + '.zip` | **电脑浏览器**（Chrome / Edge / Brave 等 Chromium 内核） |',
  '| `ao3-tag-manager.user.js` | **手机 / 平板**等装不了扩展的浏览器（先装暴力猴 / 篡改猴） |',
  '',
  '### 电脑：装扩展',
  '',
  '1. 下载 `ao3-tag-manager-v' + VERSION + '.zip` 并**解压**到任意目录（目录别删，扩展会一直从这里读取）',
  '2. 打开 `chrome://extensions/`（Edge 是 `edge://extensions/`）',
  '3. 打开右上角「开发者模式」',
  '4. 点「加载已解压的扩展程序」，选择解压出来的文件夹（能看到 `manifest.json` 那一层）',
  '5. 打开 https://archiveofourown.org/ 即可使用',
  '',
  '> 不要把 zip 直接拖进扩展页，Chrome 需要的是解压后的文件夹。',
  '',
  '### 手机：装油猴脚本',
  '',
  '1. 浏览器里先装 **暴力猴（Violentmonkey）** 或 **篡改猴（Tampermonkey）**',
  '2. 点开 `ao3-tag-manager.user.js`，脚本管理器会弹出安装界面，确认即可',
  '3. 打开 AO3 或镜像站即可使用',
  '4. 想支持新镜像：编辑脚本头部，加一行 `// @match https://你的域名/*`',
  '',
  '### 本版新增',
  '',
  '- **界面汉化大幅扩展**：词典 198 → 575 条，改为按 AO3 官方 locale（`config/locales/views/en.yml`）系统化补词，不再靠截图逐个补',
  '- 新增覆盖：作品页/发布编辑、账号与登录注册、评论、偏好设置、合集与挑战、标签页、屏蔽/静音用户、订阅',
  '- 修复「**About Us**」被译成「关于 Us」这类中英夹杂（`About` 被单独替换导致），所有 About/All 开头的站点短语都补了完整词条',
  '- 修复长句：HTML 折叠空白不再影响匹配（`For help getting started…` 这类跨行句子现在整句翻）',
  '- 修复标点混用（中文句号后残留西文句点）',
  '- 标签类别名（`Additional Tags` 等）不再在新闻标题/标签名里被误翻',
  '',
  '### 上一版（v1.2.1）',
  '',
  '- **右键一键屏蔽作品 / 作者**：作品页任意位置右键都能弹菜单；卡片菜单里作品、作者、每个标签各有屏蔽与只看',
  '- **同人原作（fandom）单独成组**，可单独屏蔽',
  '- 修复「隐藏」按钮点第二次无法取消隐藏',
  '- 修复设置页渲染无限递归导致卡死',
  '- 修复作者屏蔽：伪名（`/users/<登录名>/pseuds/<伪名>`）只取登录名导致规则不命中；作者不在 `li.author` 里的特殊皮肤也会漏解析',
  '',
  '### 更早版本',
  '',
  '- **v1.2.0**：镜像站自动检测（页面结构指纹打分 + 页面顶部横幅）',
  '- **v1.1.0**：镜像站支持（任意镜像域名）、油猴脚本版（手机/平板）、`file://` 本地文件',
  '- **v1.0.0**：首个版本（标签/作者屏蔽与只看、快捷屏蔽、右键标签、深色适配、界面汉化）',
  '',
  '### 说明',
  '',
  '- 所有规则只存在浏览器本地，不联网、不上传',
  '- 本项目全部由 **DeepSeek V4.1 Flash** 代工',
  '- 截图使用 mock 测试页面的假数据，不代表作者喜好',
  '',
  '完整功能与用法见 [README](https://github.com/' + REPO + '#readme)。'
].join('\n');

(async () => {
  // 目标提交：远端 main 的 HEAD
  const branch = await api(API + '/branches/main');
  const target = branch.commit.sha;
  console.log('目标提交: ' + target.slice(0, 7) + '  (' + (branch.commit.commit.message || '').split('\n')[0] + ')');

  let release = null;
  try {
    release = await api(API + '/releases/tags/' + TAG);
    console.log('已存在 Release ' + TAG + '，改为更新');
    release = await api(API + '/releases/' + release.id, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'AO3 标签管家 ' + TAG, body: NOTES, target_commitish: 'main' })
    });
  } catch (err) {
    if (err.status !== 404) throw err;
    console.log('创建 Release ' + TAG);
    release = await api(API + '/releases', {
      method: 'POST',
      body: JSON.stringify({
        tag_name: TAG,
        target_commitish: 'main',
        name: 'AO3 标签管家 ' + TAG,
        body: NOTES,
        draft: false,
        prerelease: false
      })
    });
  }

  console.log('Release 页面: ' + release.html_url);

  // PATCH release 不会移动已存在的 tag，这里显式把 tag 指向最新提交，
  // 否则会出现"附件是新的、源码还是旧提交"的错位（踩过一次）。
  await api(API + '/git/refs/tags/' + TAG, {
    method: 'PATCH',
    body: JSON.stringify({ sha: target, force: true })
  });
  console.log('tag ' + TAG + ' 已指向 ' + target.slice(0, 7));

  if (NOTES_ONLY) {
    console.log('--notes-only：不处理附件');
    return;
  }

  const assets = [
    { file: ZIP, name: 'ao3-tag-manager-v' + VERSION + '.zip', type: 'application/zip' },
    { file: USERSCRIPT, name: 'ao3-tag-manager.user.js', type: 'text/javascript' }
  ];

  const missing = assets.filter(function (item) {
    return !fs.existsSync(item.file);
  });
  if (missing.length) {
    console.error('缺少附件，请先构建：' + missing.map(function (item) {
      return path.relative(ROOT, item.file);
    }).join(', '));
    process.exit(2);
  }

  for (const asset of assets) {
    const buffer = fs.readFileSync(asset.file);

    // 同名附件先删掉再传，避免 422
    const existing = (release.assets || []).filter(function (item) {
      return item.name === asset.name;
    });
    for (const old of existing) {
      console.log('删除旧附件: ' + old.name);
      await api(API + '/releases/assets/' + old.id, { method: 'DELETE' });
    }

    const uploadUrl = 'https://uploads.github.com/repos/' + REPO + '/releases/' + release.id + '/assets?name=' + encodeURIComponent(asset.name);
    const uploaded = await api(uploadUrl, {
      method: 'POST',
      headers: Object.assign({}, HEADERS, { 'Content-Type': asset.type }),
      body: buffer
    });
    console.log('上传完成: ' + uploaded.name + '  (' + Math.round(uploaded.size / 1024) + ' KB)');
    console.log('下载地址: ' + uploaded.browser_download_url);
    release.assets = (release.assets || []).filter(function (item) {
      return item.name !== asset.name;
    });
    release.assets.push(uploaded);
  }
})().catch((err) => {
  console.error('发布失败: ' + err.message);
  if (err.body) console.error(JSON.stringify(err.body).slice(0, 500));
  process.exit(1);
});
