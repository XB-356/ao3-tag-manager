/* 生成 README 用的效果图（输出到 docs/images/）。
   用法：
     node test/server.js          # 另开一个终端跑 mock 服务
     node test/shoot-docs.js
   需要本机有 Chrome（可用环境变量 CHROME 指定路径）。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const OUT = path.resolve(EXT, 'docs', 'images');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9533);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  fs.mkdirSync(OUT, { recursive: true });

  if (!(await httpOk('http://127.0.0.1:' + PORT + '/list.html'))) {
    console.error('mock 服务没起来，请先在另一个终端运行：node test/server.js');
    process.exit(2);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-docs-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + dir,
    '--disable-extensions-except=' + EXT,
    '--load-extension=' + EXT,
    'about:blank'
  ], { stdio: 'ignore' });
  process.on('exit', () => chrome.kill());

  let version = null;
  for (let i = 0; i < 60 && !version; i++) {
    try { version = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/version'); } catch (e) { await sleep(250); }
  }
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const cdp = new Cdp(ws);

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => cdp.send(m, p, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 760, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('页面执行出错: ' + ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text));
    return r.result.value;
  };
  const waitFor = async (expression, label, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return true;
      await sleep(150);
    }
    throw new Error('等待超时: ' + label);
  };
  const command = (type, payload) =>
    evaluate(`(() => new Promise(resolve => {
      const id = String(Math.random());
      const on = ev => { const d = JSON.parse(ev.detail); if (d.id !== id) return; window.removeEventListener('ao3tm:result', on); resolve(d); };
      window.addEventListener('ao3tm:result', on);
      window.dispatchEvent(new CustomEvent('ao3tm:command', { detail: JSON.stringify(Object.assign({ type: ${JSON.stringify(type)}, id: id }, ${JSON.stringify(payload || {})})) }));
      setTimeout(() => resolve({ timeout: true }), 4000);
    }))()`);

  const shot = async (name) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data, 'base64'));
        console.log('docs/images/' + name + '.png');
        return;
      } catch (err) {
        await sleep(1200);
      }
    }
    console.error('截图失败: ' + name);
  };

  const openList = async () => {
    await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/list.html' });
    await waitFor(`!!document.documentElement && document.documentElement.getAttribute('data-ao3tm-ready') === '1'`, '扩展就绪');
    await sleep(500);
  };
  const reset = async () => {
    await command('ao3tm:debug', { clear: true, revealReset: true });
    await sleep(800);
  };

  /* 1. 列表页：标签屏蔽 + 只看 + 快捷按钮 */
  await openList();
  await reset();
  await evaluate(`document.querySelector('.ao3tm-tag[data-tag="Fluff"] .ao3tm-tag-btn[data-mode="block"]').click()`);
  await sleep(1200);
  await shot('list-blocked');

  /* 2. 右键标签菜单 */
  await reset();
  await evaluate(`(() => { const t = document.getElementById('ao3tm-toast'); if (t) t.classList.remove('ao3tm-toast-show'); return true; })()`);
  const tagPoint = await evaluate(`(() => {
    const node = Array.from(document.querySelectorAll('.ao3tm-tag[data-tag="Major Character Death"]'))[0]
      || document.querySelector('.ao3tm-tag[data-tag]');
    const r = node.getBoundingClientRect();
    return { x: Math.round(r.x + Math.min(r.width / 2, 12)), y: Math.round(r.y + r.height / 2) };
  })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: tagPoint.x, y: tagPoint.y, button: 'right', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tagPoint.x, y: tagPoint.y, button: 'right', clickCount: 1 });
  await sleep(600);
  await shot('context-menu');

  /* 2b. 只看模式 */
  await evaluate(`(() => { const el = document.querySelector('.ao3tm-menu'); if (el) el.remove(); return true; })()`);
  await reset();
  await evaluate(`(() => {
    const btn = document.querySelector('.ao3tm-tag[data-tag="Horror"] .ao3tm-tag-btn[data-mode="allow"]');
    if (btn) btn.click();
    const t = document.getElementById('ao3tm-toast');
    if (t) t.classList.remove('ao3tm-toast-show');
    return true;
  })()`);
  await sleep(1400);
  await evaluate(`(() => { const t = document.getElementById('ao3tm-toast'); if (t) t.classList.remove('ao3tm-toast-show'); return true; })()`);
  await shot('only-mode');
  await reset();

  /* 3. 设置面板 */
  await evaluate(`(() => { const el = document.querySelector('.ao3tm-menu'); if (el) el.remove(); return true; })()`);
  await command('ao3tm:panel');
  await sleep(700);
  await shot('panel');

  /* 4. 深色适配 */
  await evaluate(`(() => {
    document.querySelector('.ao3tm-panel-root [data-act="close"]').click();
    let s = document.getElementById('__docdark');
    if (!s) { s = document.createElement('style'); s.id = '__docdark'; document.head.appendChild(s); }
    s.textContent = 'html,body,#main{background:#141414 !important;color:#e6e6e6 !important}';
    return true;
  })()`);
  await command('ao3tm:refresh');
  await waitFor(`document.documentElement.getAttribute('data-ao3tm-theme') === 'dark'`, '识别为深色');
  await command('ao3tm:panel');
  await sleep(800);
  await shot('dark-mode');
  await evaluate(`(() => {
    document.querySelector('.ao3tm-panel-root [data-act="close"]').click();
    const s = document.getElementById('__docdark');
    if (s) s.remove();
    return true;
  })()`);

  /* 5. 界面汉化 */
  await openList();
  await reset();
  await command('ao3tm:panel');
  await sleep(400);
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="settings"]').click()`);
  await sleep(300);
  await evaluate(`document.querySelector('.ao3tm-panel-root input[data-setting="i18n"]').click()`);
  await sleep(1200);
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);
  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/i18n.html' });
  await waitFor(`!!document.documentElement && document.documentElement.getAttribute('data-ao3tm-ready') === '1'`, '汉化页就绪');
  await sleep(900);
  await shot('i18n');
  // 复原设置，避免影响手动试用的默认值
  await command('ao3tm:debug', {});
  await evaluate(`new Promise(r => r())`);
  await evaluate(`(() => { return true; })()`);

  console.log('\n完成。如果 i18n 开关被打开，记得在小面板里关掉。');
  chrome.kill();
  process.exit(0);
})().catch((err) => {
  console.error('生成失败: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
