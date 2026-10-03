/* 生成"镜像站自动检测"的 README 效果图。
   用真实的 mock 页面（test/mock/ao3-like.html，带 AO3 的 generator 与页脚结构），
   通过事件桥让内容脚本按一个虚拟域名挂上检测横幅。
   用法：
     node test/server.js          # 另开一个终端跑 mock 服务
     node test/shoot-detect.js */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const OUT = path.resolve(EXT, 'docs', 'images');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9588);
const FAKE_HOST = 'ao3-mirror.example';
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
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP 超时: ' + method)); }, 20000);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.ws.send(JSON.stringify(Object.assign({ id, method, params: params || {} }, sessionId ? { sessionId } : {})));
    });
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (!(await httpOk('http://127.0.0.1:' + PORT + '/ao3-like.html'))) {
    console.error('mock 服务没起来，请先运行：node test/server.js');
    process.exit(2);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-shoot-detect-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-proxy-server',
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 620, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expression, retried) => {
    try {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        const text = (r.exceptionDetails.exception || {}).description || r.exceptionDetails.text || '';
        if (!retried && /Cannot read properties of null|Execution context was destroyed/i.test(text)) {
          await sleep(300);
          return evaluate(expression, true);
        }
        throw new Error(text);
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
      new Promise((resolve) => setTimeout(() => resolve(null), 9000))
    ]);

  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/ao3-like.html' });
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, '页面就绪');
  await sleep(500);

  await command('ao3tm:debug', { autoResetSkip: true });
  const mounted = await command('ao3tm:debug', { autoMountForTest: FAKE_HOST, autoMountEnabled: false });
  console.log('检测结果:', JSON.stringify(mounted));
  await sleep(400);

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'detect-banner.png'), Buffer.from(data, 'base64'));
  console.log('已生成 docs/images/detect-banner.png');

  chrome.kill();
  process.exit(0);
})().catch((err) => {
  console.error('生成失败: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
