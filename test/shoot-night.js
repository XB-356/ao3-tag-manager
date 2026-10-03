/* 只拍两件事：AO3 夜间皮肤下的面板、页内注入元素（供人工核对可读性） */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const ART = path.resolve(__dirname, 'artifacts');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9499);
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
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    });
  }
  send(method, params, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP 超时: ' + method)); }, 20000);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.ws.send(JSON.stringify(Object.assign({ id, method, params: params || {} }, sessionId ? { sessionId } : {})));
    });
  }
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-night-'));
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
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

  const evaluate = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) return { exception: (r.exceptionDetails.exception || {}).description };
    return r.result.value;
  };
  const shot = async (name) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        fs.writeFileSync(path.join(ART, name), Buffer.from(data, 'base64'));
        console.log('screenshot -> ' + name);
        return;
      } catch (err) {
        console.log('重试截图 ' + name + ': ' + err.message);
        await sleep(1500);
      }
    }
  };

  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/list.html' }, sessionId);
  for (let i = 0; i < 60; i++) {
    if (await evaluate(`document.documentElement.getAttribute('data-ao3tm-ready') === '1'`)) break;
    await sleep(200);
  }
  // 打开 AO3 夜间皮肤
  await evaluate(`document.documentElement.classList.add('night')`);
  // 加两条规则，方便看隐藏卡片与标签状态
  await evaluate(`document.querySelector('.ao3tm-tag[data-tag="Fluff"] .ao3tm-tag-btn[data-mode="block"]').click()`);
  await sleep(1200);
  await shot('15-night-list.png');

  await evaluate(`window.dispatchEvent(new CustomEvent('ao3tm:command', { detail: JSON.stringify({ type: 'ao3tm:panel', id: 'p' }) }))`);
  await sleep(900);
  await shot('16-night-panel.png');

  chrome.kill();
  process.exit(0);
})();
