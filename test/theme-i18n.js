/* 验证深色适配与界面汉化：不需要 mock 服务器，直接用 data: / about:blank 页面 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9511);
const ART = path.resolve(__dirname, 'artifacts');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const httpJson = (url) =>
  new Promise((resolve, reject) => {
    require('http').get(url, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); }).on('error', reject);
  });

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
    });
  }
  send(method, params, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP 超时: ' + method)); }, 30000);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.ws.send(JSON.stringify(Object.assign({ id, method, params: params || {} }, sessionId ? { sessionId } : {})));
    });
  }
}

async function main() {
  fs.mkdirSync(ART, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-theme-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + dir,
    '--disable-extensions-except=' + EXT,
    '--load-extension=' + EXT,
    'about:blank'
  ], { stdio: 'ignore' });
  const cleanup = () => { try { chrome.kill(); } catch (e) {} };
  process.on('exit', cleanup);

  let version = null;
  for (let i = 0; i < 80 && !version; i++) {
    try { version = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/version'); } catch (e) { await sleep(250); }
  }
  if (!version) throw new Error('Chrome CDP 未就绪');

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const cdp = new Cdp(ws);

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => cdp.send(m, p, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('页面执行出错: ' + ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text));
    return r.result.value;
  };
  const waitFor = async (expression, label, timeout = 10000) => {
    const started = Date.now();
    let last;
    while (Date.now() - started < timeout) {
      last = await evaluate(expression);
      if (last) return last;
      await sleep(150);
    }
    throw new Error('等待超时: ' + label + '（最后 ' + JSON.stringify(last) + '）');
  };
  const command = (type, payload) =>
    evaluate(`(() => new Promise(resolve => {
      const id = String(Math.random());
      const on = ev => { const d = JSON.parse(ev.detail); if (d.id !== id) return; window.removeEventListener('ao3tm:result', on); resolve(d); };
      window.addEventListener('ao3tm:result', on);
      window.dispatchEvent(new CustomEvent('ao3tm:command', { detail: JSON.stringify(Object.assign({ type: ${JSON.stringify(type)}, id: id }, ${JSON.stringify(payload || {})})) }));
      setTimeout(() => resolve({ timeout: true }), 5000);
    }))()`);
  /** 让扩展按当前设置应用主题与汉化，再取状态 */
  const debugApply = (probe) => command('ao3tm:debug', { apply: true, probe: probe });
  const shot = async (name) => {
    for (let i = 0; i < 3; i++) {
      try {
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ART, name + '.png'), Buffer.from(data, 'base64'));
        return;
      } catch (err) { await sleep(1000); }
    }
  };

  const results = [];
  const record = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail });
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  -> ' + JSON.stringify(detail)));
  };

  const open = async (url, readyExpr) => {
    await send('Page.navigate', { url: url });
    await sleep(400);
    await waitFor(`!!document.documentElement && document.documentElement.getAttribute('data-ao3tm-ready') === '1'`, '扩展就绪 ' + url, 15000);
    if (readyExpr) await waitFor(readyExpr, '页面条件 ' + url, 15000);
    await sleep(400);
  };

  /* ------------------------- 1. 深色适配（实测背景亮度） ------------------------- */

  const page = (title, style, body) =>
    '<!doctype html><html><head><meta charset="utf-8"><title>' + title + '</title><style>' + style + '</style></head><body>' + body + '</body></html>';
  const dataUrl = (html) => 'data:text/html;charset=utf-8,' + encodeURIComponent(html);

  const lightHtml = page('Light page', '#main{background:#fff;color:#111;padding:20px;min-height:600px}', '<div id="main"><h2>Light page</h2></div>');
  const darkHtml = page('Dark page', 'html,body{background:#141414}#main{background:#141414;color:#eee;padding:20px;min-height:600px}', '<div id="main"><h2>Dark page</h2></div>');

  // 扩展只注入 AO3 与本地测试域，先导航到本地页面再写入样式和内容
  await open('http://127.0.0.1:' + PORT + '/i18n.html');
  const mount = async (style, body) => {
    await evaluate(`(() => {
      let s = document.getElementById('__probe');
      if (!s) { s = document.createElement('style'); s.id = '__probe'; document.head.appendChild(s); }
      s.textContent = ${JSON.stringify(style)};
      document.body.innerHTML = ${JSON.stringify(body)};
      document.body.setAttribute('style', 'margin:0');
      return true;
    })()`);
    // 主题是页面渲染后实测背景色决定的，改动后让扩展重新判定
    await command('ao3tm:refresh');
    await sleep(800);
  };

  await mount('#main{background:#fff;color:#111;padding:20px;min-height:600px}', '<div id="main"><h2>Light page</h2></div>');
  let theme = (await debugApply()).theme;
  record('浅色页面 -> 判定为 light', theme === 'light', { theme: theme });

  await mount('html,body{background:#141414}#main{background:#141414;color:#eee;padding:20px;min-height:600px}', '<div id="main"><h2>Dark page</h2></div>');
  theme = (await debugApply()).theme;
  record('深色页面 -> 判定为 dark（不依赖皮肤选择器）', theme === 'dark', { theme: theme });

  await command('ao3tm:panel');
  await sleep(600);
  const darkStyles = await evaluate(`(() => {
    const root = document.querySelector('.ao3tm-panel-root');
    const panel = root.querySelector('.ao3tm-panel');
    const ta = root.querySelector('textarea');
    const cs = (n) => { const s = getComputedStyle(n); return { bg: s.backgroundColor, color: s.color }; };
    const lum = (c) => { const p = (c.match(/\\d+/g) || [255,255,255]).map(Number).slice(0,3); return (0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]) / 255; };
    const ratio = (pair) => {
      const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
      const l = (c) => { const p = (c.match(/\\d+/g) || [255,255,255]).map(Number).slice(0,3); return 0.2126*f(p[0]) + 0.7152*f(p[1]) + 0.0722*f(p[2]); };
      const a = l(pair.bg), b = l(pair.color);
      return (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
    };
    return {
      panel: cs(panel),
      panelRatio: Number(ratio(cs(panel)).toFixed(2)),
      textarea: cs(ta),
      textareaRatio: Number(ratio(cs(ta)).toFixed(2)),
      panelIsDark: lum(cs(panel).bg) < 0.3
    };
  })()`);
  record(
    '深色页面上插件面板自动变深色且文字清晰',
    darkStyles.panelIsDark && darkStyles.panelRatio >= 4.5 && darkStyles.textareaRatio >= 4.5,
    darkStyles
  );
  await shot('18-dark-adaptive');
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);

  // 设置里强制浅色应覆盖自动判定
  const openSettingsTab = async () => {
    await command('ao3tm:panel');
    await waitFor(`!!document.querySelector('.ao3tm-panel-root.is-open')`, '面板打开');
    await evaluate(`(() => {
      const tab = document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="settings"]');
      if (tab) tab.click();
      return !!tab;
    })()`);
    await waitFor(`!!document.querySelector('.ao3tm-panel-root [data-setting="caseInsensitive"]')`, '设置页渲染');
  };

  await openSettingsTab();
  const forced = await evaluate(`(() => {
    const sel = document.querySelector('.ao3tm-panel-root [data-setting="themeMode"]');
    if (!sel) return { error: 'no-select' };
    sel.value = 'light';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  })()`);
  await sleep(700);
  const forcedTheme = (await debugApply()).theme;
  record('设置里强制浅色可覆盖自动判定', forced.ok === true && forcedTheme === 'light', { forced: forced, theme: forcedTheme });
  await evaluate(`(() => {
    const sel = document.querySelector('.ao3tm-panel-root [data-setting="themeMode"]');
    if (sel) { sel.value = 'auto'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  })()`);
  await sleep(500);
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);
  await sleep(300);

  /* ------------------------------- 2. 界面汉化 ------------------------------- */

  await open('http://127.0.0.1:' + PORT + '/i18n.html');
  const before = await evaluate(`(() => ({
    works: document.querySelector('h2').textContent.trim(),
    button: document.querySelector('#filter-area button').textContent.trim(),
    placeholder: document.querySelector('input[type="search"]').placeholder,
    stats: document.querySelectorAll('#filter-area p')[1].textContent.trim(),
    nav: document.querySelector('#header a').textContent.trim()
  }))()`);

  // 打开汉化开关（走面板设置项，点真实的 checkbox）
  await openSettingsTab();
  await evaluate(`document.querySelector('.ao3tm-panel-root input[data-setting="i18n"]').click()`);
  await sleep(800);
  const i18nOn = await debugApply('Sort and Filter');
  record('汉化开关能把设置写入打开状态', i18nOn.settings && i18nOn.settings.i18n === true, i18nOn.settings && i18nOn.settings.i18n);
  record('词典查询正确（Sort and Filter -> 排序与筛选）', i18nOn.translate === '排序与筛选', { translate: i18nOn.translate });
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);
  await sleep(500);

  const after = await evaluate(`(() => ({
    works: document.querySelector('h2').textContent.trim(),
    button: document.querySelector('#filter-area button').textContent.trim(),
    placeholder: document.querySelector('input[type="search"]').placeholder,
    stats: document.querySelectorAll('#filter-area p')[1].textContent.trim(),
    nav: document.querySelector('#header a').textContent.trim(),
    count: document.querySelectorAll('[data-ao3tm-i18n]').length
  }))()`);
  record('汉化：导航与标题被翻译', after.works === '作品' && after.nav === '同人圈', { before: before, after: after });
  record('汉化：按钮与占位符被翻译', after.button === '筛选' && after.placeholder === '在结果中搜索', { button: after.button, placeholder: after.placeholder });
  record('汉化：统计标签被翻译', /字数：/.test(after.stats) && /Kudos：/.test(after.stats), after.stats);

  const preserved = await evaluate(`(() => ({
    body: document.getElementById('user-body').textContent,
    summary: document.getElementById('user-summary').textContent,
    tag: document.getElementById('tag-text').textContent,
    author: document.getElementById('author-text').textContent
  }))()`);
  record(
    '汉化：用户内容（正文/摘要/标签/作者名）原样保留',
    preserved.body === 'The quick brown fox says: Words: 999 and Search for nothing.' &&
      preserved.summary === "Summary: this is the author's own summary text." &&
      preserved.tag === 'Fluff, Angst, Coffee Shop AU' &&
      preserved.author === 'by writer_alpha',
    preserved
  );
  await shot('19-i18n');

  // 悬停显示原文
  await openSettingsTab();
  await evaluate(`document.querySelector('.ao3tm-panel-root input[data-setting="i18nBilingual"]').click()`);
  await sleep(1500);
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);
  await sleep(700);
  const bilingual = await evaluate(`(() => {
    const el = Array.from(document.querySelectorAll('[data-ao3tm-bilingual]')).filter(n => n.textContent.trim() === '筛选')[0]
      || document.querySelector('[data-ao3tm-bilingual]');
    return el ? { text: el.textContent.trim(), title: el.getAttribute('title') } : null;
  })()`);
  record('汉化：悬停显示原文（title 保留英文）', !!bilingual && bilingual.title === 'Filters', bilingual);

  // 关闭汉化：刷新后应恢复英文
  await openSettingsTab();
  await evaluate(`document.querySelector('.ao3tm-panel-root input[data-setting="i18n"]').click()`);
  await sleep(900);
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);
  await sleep(300);
  await open('http://127.0.0.1:' + PORT + '/i18n.html');
  await waitFor(`!!document.querySelector('h2')`, '页面标题存在');
  const restored = await evaluate(`document.querySelector('h2').textContent.trim()`);
  record('关闭汉化后刷新页面恢复英文', restored === 'Works', { restored: restored });

  /* ---------------- 个人资料页汉化 ---------------- */

  // 重新打开汉化：在 i18n.html 上跑命令（内容脚本就在这个页面）
  await open('http://127.0.0.1:' + PORT + '/i18n.html');
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, 'i18n 页就绪');
  await command('ao3tm:debug', { setSetting: { i18n: true } });
  await sleep(800);
  const i18nOnProfile = await command('ao3tm:debug');
  record('个人资料页测试前：汉化开关已打开', i18nOnProfile.settings && i18nOnProfile.settings.i18n === true, i18nOnProfile.settings && i18nOnProfile.settings.i18n);

  await open('http://127.0.0.1:' + PORT + '/profile.html');
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, '个人资料页就绪', 25000);
  await sleep(1500);

  const profileText = await evaluate(`(() => {
    const grab = (sel) => {
      const n = document.querySelector(sel);
      return n ? n.textContent.replace(/\\s+/g, ' ').trim() : null;
    };
    const head = document.querySelector('h3.heading');
    return {
      url: location.href,
      ready: document.documentElement.getAttribute('data-ao3tm-ready'),
      i18nMarked: document.querySelectorAll('[data-ao3tm-i18n]').length,
      headMarked: head ? head.getAttribute('data-ao3tm-i18n') : null,
      headText: head ? head.textContent.trim() : null,
      dt: Array.prototype.map.call(document.querySelectorAll('dl.meta dt'), n => n.textContent.trim()),
      dd: Array.prototype.map.call(document.querySelectorAll('dl.meta dd'), n => n.textContent.trim()),
      actions: Array.prototype.map.call(document.querySelectorAll('.navigation.actions a'), n => n.textContent.trim()),
      headings: Array.prototype.map.call(document.querySelectorAll('h3.heading'), n => n.textContent.trim()),
      bio: grab('#user-bio'),
      pseudNote: grab('.pseud .note'),
      subsText: grab('.subscriptions p'),
      tableHead: Array.prototype.map.call(document.querySelectorAll('table thead th'), n => n.textContent.trim())
    };
  })()`);
  console.log('   [profile diag] url=' + profileText.url + ' ready=' + profileText.ready + ' marked=' + profileText.i18nMarked + ' head=' + profileText.headMarked + '/' + profileText.headText);

  record(
    '个人资料页：dl/dt 标签（Joined / Kudos Given 等）已汉化',
    profileText.dt.indexOf('加入时间：') !== -1 &&
      profileText.dt.indexOf('送出的 Kudos：') !== -1 &&
      profileText.dt.indexOf('收到的 Kudos：') !== -1 &&
      profileText.dt.indexOf('作品：') !== -1,
    profileText.dt
  );
  record(
    '个人资料页：小标题（Profile / Pseuds / Bio / Preferences）已汉化',
    profileText.headings.indexOf('个人资料') !== -1 &&
      profileText.headings.indexOf('笔名') !== -1 &&
      profileText.headings.indexOf('简介') !== -1,
    profileText.headings
  );
  record(
    '个人资料页：操作链接（管理笔名 / 偏好 / 浏览历史）已汉化',
    profileText.actions.indexOf('管理我的笔名') !== -1 &&
      profileText.actions.some((t) => /偏好/.test(t)) &&
      profileText.actions.indexOf('浏览历史') !== -1,
    profileText.actions
  );
  record(
    '个人资料页：句子型文案（You have no subscriptions.）已汉化',
    profileText.subsText === '你还没有订阅。',
    profileText.subsText
  );
  record(
    '个人资料页：表格表头（Title / Fandoms / Words / Kudos）已汉化',
    profileText.tableHead.indexOf('标题') !== -1 && profileText.tableHead.indexOf('同人圈') !== -1,
    profileText.tableHead
  );
  record(
    '个人资料页：用户自己写的简介一个字都不能改',
    profileText.bio === 'I write fluffy things and I like tea. Works: 12 is my favourite number.',
    profileText.bio
  );

  console.log('\n===== 结果 =====');
  const failed = results.filter((r) => !r.ok);
  console.log(results.length - failed.length + '/' + results.length + ' 通过');
  failed.forEach((f) => console.log('  - ' + f.name + ' :: ' + JSON.stringify(f.detail)));
  fs.writeFileSync(path.join(ART, 'theme-i18n-results.json'), JSON.stringify(results, null, 2));
  cleanup();
  process.exit(failed.length ? 1 : 0);
}
main().catch((err) => {
  console.error('测试异常: ' + (err && err.stack ? err.stack : err));
  process.exit(2);
});
