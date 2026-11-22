/* 验证：自动检测开关能不能被点开（chrome.permissions 只有扩展页面才有）
   背景：内容脚本里没有 chrome.permissions，用户在网页内面板点「开启自动检测」
   时旧代码提示"油猴脚本版没有运行时权限"——装了 Chrome 插件却被当成油猴版。
   用法：node test/auto-detect-options.js （需要先跑 node test/server.js） */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const ART = path.resolve(__dirname, 'artifacts');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9589);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 在页面里找「镜像站自动检测」区块，把按钮与文案带回来 */
const SECTION_JS = `(() => {
  const section = Array.prototype.find.call(
    document.querySelectorAll('.ao3tm-subsection'),
    el => /镜像站自动检测/.test(el.textContent || '')
  );
  if (!section) return { found: false, subsections: document.querySelectorAll('.ao3tm-subsection').length };
  const btn = section.querySelector('button[data-act]');
  return {
    found: true,
    text: section.textContent.replace(/\\s+/g, ' ').trim(),
    acts: Array.prototype.map.call(section.querySelectorAll('button[data-act]'), b => b.getAttribute('data-act')),
    firstBtnText: btn ? btn.textContent.trim() : null,
    // 内容脚本里 window.AO3TM 不存在（隔离世界），用来确认我们看的确实是网页
    pageWorldHasAo3tm: typeof window.AO3TM !== 'undefined'
  };
})()`;

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

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-opts-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run',
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
  await cdp.send('Target.setDiscoverTargets', { discover: true });

  /* -------------------- 1. 找出扩展 id（service worker 的 URL 里带着） -------------------- */

  let extId = null;
  for (let i = 0; i < 60 && !extId; i++) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    for (const info of targetInfos) {
      // 注意：无头 Chrome 里还有别的内置扩展，必须认我们自己的 background.js
      const m = /^chrome-extension:\/\/([a-p]{32})\/src\/background\.js/.exec(info.url || '');
      if (m) { extId = m[1]; break; }
    }
    if (!extId) await sleep(250);
  }
  if (!extId) throw new Error('没找到扩展 id（service worker 未启动？）');

  const results = [];
  const record = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail });
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  -> ' + JSON.stringify(detail)));
  };

  const attach = async (url) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (m, p) => cdp.send(m, p, sessionId);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        const text = (r.exceptionDetails.exception || {}).description || r.exceptionDetails.text || '';
        throw new Error('页面执行出错: ' + text);
      }
      return r.result.value;
    };
    const waitFor = async (expression, label, timeout = 20000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (await evaluate(`!!document.documentElement && (${expression})`)) return true;
        await sleep(150);
      }
      const where = await evaluate(`({ href: location.href, title: document.title, ready: document.readyState })`).catch(() => null);
      throw new Error('等待超时: ' + label + ' @ ' + JSON.stringify(where));
    };
    // 导航可能比 attach 慢，必须确认真的到了目标 URL 再继续（否则会在 about:blank 上求值）
    let arrived = false;
    for (let i = 0; i < 3 && !arrived; i++) {
      await send('Page.navigate', { url: url }).catch(() => {});
      try {
        await waitFor(`location.href.indexOf(${JSON.stringify(url.split('?')[0])}) === 0 && document.readyState === 'complete'`, '导航到 ' + url, 15000);
        arrived = true;
      } catch (err) {
        if (i === 2) throw err;
        await sleep(500);
      }
    }
    return { send, evaluate, waitFor };
  };

  /* -------------------- 2. 扩展页面（设置页）：能申请权限、区块正常渲染 -------------------- */

  const options = await attach('chrome-extension://' + extId + '/src/popup/popup.html?mode=options');
  await options.waitFor(`!!document.getElementById('panel-host')`, '设置页就绪');
  const optsEnv = await options.evaluate(`({
    hasModule: !!(window.AO3TM && window.AO3TM.autoDetect),
    hasPermissions: !!(window.AO3TM && window.AO3TM.env && window.AO3TM.env.chrome && window.AO3TM.env.chrome.permissions),
    protocol: location.protocol
  })`);
  record(
    '扩展设置页：加载了自动检测模块（popup.html 之前漏引 auto-detect.js）',
    optsEnv && optsEnv.hasModule === true,
    optsEnv
  );
  record(
    '扩展设置页：chrome.permissions 可用（只有扩展页面才允许申请权限）',
    optsEnv && optsEnv.hasPermissions === true,
    optsEnv
  );

  const optsBlock = await options.evaluate(`(() => {
    const tab = document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="settings"]');
    if (tab) tab.click();
    return true;
  })()`);
  // 设置页的镜像/权限状态是异步拉的，区块内容会二次渲染，等它稳定
  await sleep(1200);
  const optsSection = await options.evaluate(SECTION_JS);
  const optsBlockInfo = Object.assign({ clicked: !!optsBlock }, optsSection);
  record(
    '设置页渲染出「镜像站自动检测」区块，并给出「开启自动检测」按钮',
    optsBlockInfo && optsBlockInfo.found === true && optsBlockInfo.acts.indexOf('detect-grant') !== -1,
    optsBlockInfo
  );

  /* -------------------- 3. 网页内（内容脚本）：不能申请权限，要引导去设置页 -------------------- */

  const page = await attach('http://127.0.0.1:' + PORT + '/list.html');
  await page.waitFor(`!!document.getElementById('ao3tm-bar')`, '工具条注入');
  // 面板是懒创建的，用页面事件桥打开
  await page.evaluate(`(() => {
    window.dispatchEvent(new CustomEvent('ao3tm:command', { detail: JSON.stringify({ type: 'ao3tm:panel', id: 'open' }) }));
    return true;
  })()`);
  await page.waitFor(`!!document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="settings"]')`, '面板挂载');
  await page.evaluate(`(() => {
    document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="settings"]').click();
    return true;
  })()`);
  await sleep(1200);

  const pageBlock = await page.evaluate(SECTION_JS);
  record(
    '网页内面板：不假装能申请权限，给的是「去设置页开启自动检测」按钮',
    pageBlock &&
      pageBlock.found === true &&
      pageBlock.acts.indexOf('detect-open-options') !== -1 &&
      pageBlock.acts.indexOf('detect-grant') === -1,
    pageBlock
  );
  record(
    '网页内面板文案不再把「在网页里」误报成「油猴脚本版」',
    pageBlock && pageBlock.found === true && pageBlock.text.indexOf('油猴') === -1,
    pageBlock && pageBlock.text
  );

  await page.evaluate(`(() => {
    const btn = document.querySelector('.ao3tm-panel-root [data-act="detect-open-options"]');
    if (btn) btn.click();
    return true;
  })()`);
  await sleep(400);
  const toastText = await page.evaluate(`(() => {
    const el = document.getElementById('ao3tm-toast');
    return el ? el.textContent.replace(/\\s+/g, ' ').trim() : null;
  })()`);
  record(
    '点「去设置页开启自动检测」：明确告知要去设置页，而不是"油猴版没有权限"',
    !!toastText && /设置页/.test(toastText) && toastText.indexOf('油猴') === -1,
    { toast: toastText }
  );

  const { data } = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => ({}));
  if (data) fs.writeFileSync(path.join(ART, '25-auto-detect-options.png'), Buffer.from(data, 'base64'));

  console.log('\n===== 结果 =====');
  const failed = results.filter((r) => !r.ok);
  console.log(results.length - failed.length + '/' + results.length + ' 通过');
  failed.forEach((f) => console.log('  - ' + f.name + ' :: ' + JSON.stringify(f.detail)));
  fs.writeFileSync(path.join(ART, 'auto-detect-options-results.json'), JSON.stringify(results, null, 2));
  cleanup();
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error('测试异常: ' + (err && err.stack ? err.stack : err));
  process.exit(2);
});
