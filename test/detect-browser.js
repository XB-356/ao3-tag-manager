/* 验证：AO3 站点自动识别（横幅、忽略名单、已启用站点不打扰、油猴版行为、首页识别）
   用法：node test/detect-browser.js （需要先跑 node test/server.js） */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const ART = path.resolve(__dirname, 'artifacts');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9577);
const MIRROR_HOST = 'ao3.cubeart.club';
const ENABLED_HOST = '127.0.0.1'; // 不用 localhost：可能解析到 ::1，而 mock 服务只监听 IPv4
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { bundleSources } = require('../tools/bundle');
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
const USERS_SCRIPT_SOURCE = bundleSources(
  manifest.content_scripts[0].js.filter(function (rel) {
    return rel.indexOf('mirrors.js') === -1;
  })
);

const httpJson = (url) =>
  new Promise((resolve, reject) => {
    require('http').get(url, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
const httpOk = (url) =>
  new Promise((resolve) => {
    require('http').get(url, (res) => { res.resume(); resolve(res.statusCode === 200); }).on('error', () => resolve(false));
  });

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
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

(async () => {
  fs.mkdirSync(ART, { recursive: true });
  if (!(await httpOk('http://127.0.0.1:' + PORT + '/list.html'))) {
    console.error('mock 服务没起来，请先运行：node test/server.js');
    process.exit(2);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-detect-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--allow-file-access-from-files',
    '--host-resolver-rules=MAP ' + MIRROR_HOST + ' 127.0.0.1',
    '--no-proxy-server',
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 800, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expression, retried) => {
    try {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        const text = (r.exceptionDetails.exception || {}).description || r.exceptionDetails.text || '';
        if (!retried && /Cannot read properties of null|Execution context was destroyed|uniqueContextId/i.test(text)) {
          await sleep(300);
          return evaluate(expression, true);
        }
        throw new Error('页面执行出错: ' + text);
      }
      return r.result.value;
    } catch (err) {
      if (!retried && /CDP 超时|context was destroyed/i.test(err.message)) {
        await sleep(400);
        return evaluate(expression, true);
      }
      throw err;
    }
  };
  const waitFor = async (expression, label, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(`!!document.documentElement && (${expression})`)) return true;
      await sleep(150);
    }
    throw new Error('等待超时: ' + label);
  };
  const command = (type, payload) =>
    Promise.race([
      evaluate(`(() => new Promise(resolve => {
        const id = String(Math.random());
        const on = ev => { const d = JSON.parse(ev.detail); if (d.id !== id) return; window.removeEventListener('ao3tm:result', on); resolve(d); };
        window.addEventListener('ao3tm:result', on);
        window.dispatchEvent(new CustomEvent('ao3tm:command', { detail: JSON.stringify(Object.assign({ type: ${JSON.stringify(type)}, id: id }, ${JSON.stringify(payload || {})})) }));
        setTimeout(() => resolve({ timeout: true }), 4000);
      }))()`),
      new Promise((resolve) => setTimeout(() => resolve({ nodeTimeout: true }), 9000))
    ]);
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

  const resetSkips = () => command('ao3tm:debug', { autoResetSkip: true });

  /* ------------------------ 1. 官方/已启用站点：安静，不打扰 ------------------------ */

  const open = async (url) => {
    await send('Page.navigate', { url: url });
    await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, '页面就绪: ' + url);
    await sleep(700);
  };

  await open('http://127.0.0.1:' + PORT + '/list.html');
  const on127 = await command('ao3tm:debug', { detect: true });
  record(
    '已启用的域名（127.0.0.1）：识别为 AO3，但不弹横幅',
    on127 && on127.level === 'high' && on127.enabledHere === true && on127.banner === false,
    on127
  );

  /* ------------------------ 2. 陌生站点上出横幅 ------------------------ */

  await open('http://' + ENABLED_HOST + ':' + PORT + '/list.html');
  await resetSkips();

  // 页面侧（内容脚本）在隔离世界，测试读不到 window.AO3TM，所以走事件桥。
  // 用一个虚拟域名模拟"陌生站点"：它不在任何名单里，但页面结构就是 AO3。
  const FAKE_HOST = 'fanfic-reader.example';
  const mounted = await command('ao3tm:debug', { autoMountForTest: FAKE_HOST, autoMountEnabled: false });
  const bannerInfo = await evaluate(`(() => {
    const box = document.getElementById('ao3tm-auto-banner');
    if (!box) return null;
    return {
      cls: box.className,
      title: (box.querySelector('.ao3tm-detect-title') || {}).textContent,
      reasons: Array.prototype.map.call(box.querySelectorAll('.ao3tm-detect-reasons li'), li => li.textContent),
      actions: Array.prototype.map.call(box.querySelectorAll('button[data-act]'), b => b.getAttribute('data-act')),
      mentionsHost: box.textContent.indexOf('${FAKE_HOST}') !== -1
    };
  })()`);
  record(
    '陌生站点：页面顶部出现检测横幅，标题带置信度并列出命中理由',
    mounted && mounted.mounted === true && bannerInfo && bannerInfo.reasons.length >= 3 && /高度确认|很可能/.test(bannerInfo.title),
    { mounted, banner: bannerInfo }
  );
  record(
    '横幅提供启用 / 以后再说 / 一直忽略 三个操作，且点名了当前域名',
    bannerInfo &&
      bannerInfo.actions.indexOf('enable') !== -1 &&
      bannerInfo.actions.indexOf('dismiss') !== -1 &&
      bannerInfo.actions.indexOf('never') !== -1 &&
      bannerInfo.mentionsHost === true,
    bannerInfo && { actions: bannerInfo.actions, mentionsHost: bannerInfo.mentionsHost }
  );
  await shot('24-detect-banner');

  /* ------------------------ 3. 已启用域名：不弹横幅 ------------------------ */

  const onEnabled = await command('ao3tm:debug', { autoMountForTest: FAKE_HOST, autoMountEnabled: true });
  const bannerGone = await evaluate(`!!document.getElementById('ao3tm-auto-banner')`);
  record(
    '判定为已启用时不弹横幅（不打扰用户）',
    onEnabled && onEnabled.mounted === false && bannerGone === false,
    { onEnabled, banner: bannerGone }
  );

  /* ------------------------ 4. "一直忽略此站" 生效并持久化 ------------------------ */

  await command('ao3tm:debug', { autoMountForTest: FAKE_HOST, autoMountEnabled: false });
  await evaluate(`(() => {
    const box = document.getElementById('ao3tm-auto-banner');
    box.querySelector('button[data-act="never"]').click();
    return true;
  })()`);
  await sleep(300);
  const afterNever = await evaluate(`({
    banner: !!document.getElementById('ao3tm-auto-banner'),
    skipped: JSON.parse(window.localStorage.getItem('ao3tm_detect_skip') || '[]')
  })`);
  record(
    '点「一直忽略此站」：横幅消失且域名写入忽略名单',
    afterNever && afterNever.banner === false && afterNever.skipped.indexOf(FAKE_HOST) !== -1,
    afterNever
  );

  // 忽略名单要跨页面生效（localStorage 持久化）
  await send('Page.navigate', { url: 'http://' + ENABLED_HOST + ':' + PORT + '/list.html' });
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, '忽略名单页重载');
  await sleep(700);
  const afterReload = await command('ao3tm:debug', { autoMountForTest: FAKE_HOST, autoMountEnabled: false });
  record(
    '忽略名单跨页面生效：重载后再挂横幅会被拒绝',
    afterReload && afterReload.mounted === false,
    afterReload
  );

  /* ------------------------ 5. "以后再说" 只关本次 ------------------------ */

  await resetSkips();
  await command('ao3tm:debug', { autoMountForTest: FAKE_HOST, autoMountEnabled: false });
  const shownAgain = await evaluate(`!!document.getElementById('ao3tm-auto-banner')`);
  await evaluate(`(() => {
    const box = document.getElementById('ao3tm-auto-banner');
    if (box) box.querySelector('button[data-act="dismiss"]').click();
    return true;
  })()`);
  await sleep(300);
  const afterDismiss = await evaluate(`({
    banner: !!document.getElementById('ao3tm-auto-banner'),
    skipped: JSON.parse(window.localStorage.getItem('ao3tm_detect_skip') || '[]')
  })`);
  record(
    '「以后再说」只收起本次，不写忽略名单',
    shownAgain === true && afterDismiss.banner === false && afterDismiss.skipped.length === 0,
    { showedFirst: shownAgain, after: afterDismiss }
  );

  /* ------------------------ 6. 真实站点上的自动检测（enabledHere 早退分支） ------------------------ */

  await resetSkips();
  const autoOnReal = await command('ao3tm:debug', { autoRun: true, detect: true });
  const realBanner = await evaluate(`!!document.getElementById('ao3tm-auto-banner')`);
  record(
    '已启用域名上自动检测不会挂横幅（早退分支）',
    autoOnReal && autoOnReal.enabledHere === true && realBanner === false,
    { detect: autoOnReal && { enabledHere: autoOnReal.enabledHere, level: autoOnReal.level }, banner: realBanner }
  );

  /* ------------------------ 7. 油猴版：视为已启用，不打扰 ------------------------ */

  const injected = await send('Page.addScriptToEvaluateOnNewDocument', { source: USERS_SCRIPT_SOURCE });
  await evaluate(`(() => {
    window.localStorage.removeItem('ao3tm_detect_skip');
    window.localStorage.removeItem('ao3tm_state_v1');
    return true;
  })()`);
  await send('Page.navigate', { url: 'http://' + ENABLED_HOST + ':' + PORT + '/list.html' });
  await waitFor(`!!window.AO3TM && !!document.querySelector('#ao3tm-bar')`, '油猴版启动');
  await sleep(700);
  const userscriptDetect = await evaluate(`(() => {
    const r = window.AO3TM.autoDetect.check();
    return {
      level: r.level,
      enabledHere: r.enabledHere,
      score: r.score,
      isUserscript: window.AO3TM.env.isUserscript,
      banner: window.AO3TM.autoDetect.autoRun() && !!document.getElementById('ao3tm-auto-banner')
    };
  })()`);
  record(
    '油猴版：能跑到的站点都视为已启用，判定为 AO3 但不弹横幅',
    userscriptDetect &&
      userscriptDetect.isUserscript === true &&
      userscriptDetect.enabledHere === true &&
      userscriptDetect.level === 'high' &&
      userscriptDetect.banner === false,
    userscriptDetect
  );
  await evaluate(`(() => {
    window.AO3TM.autoDetect.clearSkipped();
    return true;
  })()`);

  /* ------------------------ 8. 无关网站：不误判 ------------------------ */

  const notAo3 = await evaluate(`(() => {
    document.body.innerHTML = '<h1>我的博客</h1><p>今天天气不错</p>';
    const r = window.AO3TM.autoDetect.check();
    const banner = window.AO3TM.autoDetect.mountBanner(r);
    return { level: r.level, isAo3: r.isAo3, score: r.score, banner: !!banner };
  })()`);
  record(
    '换成普通页面后：不再判定为 AO3，也不会挂横幅',
    notAo3 && notAo3.isAo3 === false && notAo3.banner === false,
    notAo3
  );
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier });

  console.log('\n===== 结果 =====');
  const failed = results.filter((r) => !r.ok);
  console.log(results.length - failed.length + '/' + results.length + ' 通过');
  failed.forEach((f) => console.log('  - ' + f.name + ' :: ' + JSON.stringify(f.detail)));
  fs.writeFileSync(path.join(ART, 'detect-browser-results.json'), JSON.stringify(results, null, 2));
  cleanup();
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error('测试异常: ' + (err && err.stack ? err.stack : err));
  process.exit(2);
});
