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
  '### 本版更新（1.2.5）',
  '',
  '- **镜像站识别修复**：`sbxz.org` 这类会跳转到 `www.` 的站点、以及从未见过的新镜像域名，现在都能被识别（域名变体 + 页面结构双重判定）',
  '- **内置镜像站换新**：`sbxz.org`、`notfun.one`、`z.aoyu.moe`、`mera.moe`，装好即用，无需再手动授权',
  '- **访问验证页不再漏判**：镜像站的「访问验证 / Just a moment」挑战页会被识别为"正在验证"，验证通过后自动重新检测并弹横幅',
  '- **不再误报"油猴脚本版没有运行时权限"**：网页内的面板不能申请权限，现在会引导到扩展设置页，且自动检测区块在设置页正常显示',
  '- **启用镜像不再失败**：修复点「启用」后按钮变成「重试」、以及启用后刷新又弹一次横幅（清单现在会在页面加载时同步）',
  '- **扩展重载后镜像页仍可用**：修复动态注册的内容脚本在扩展更新/重载后丢失、导致镜像页没有悬浮球的问题',
  '- **深色模式下的悬浮球修复**：镜像站切主题会重建页面、`invert` 滤镜会让固定定位失准，现在都会自愈并保持在视口内',
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
