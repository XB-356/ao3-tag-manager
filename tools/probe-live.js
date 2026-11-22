/* 探查一个线上站点：它的真实 DOM 长什么样、detect() 会给多少分。
   用法：node tools/probe-live.js https://sbxz.org/  [等待秒数] */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const CDP_PORT = Number(process.env.CDP_PORT || 9661);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const URL_ = process.argv[2] || 'https://sbxz.org/';
const WAIT_S = Number(process.argv[3] || 20);

const httpJson = (url) =>
  new Promise((resolve, reject) => {
    require('http').get(url, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
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
  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP 超时: ' + method)); }, 40000);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-probe-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + dir,
    'about:blank'
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 80; i++) {
    try {
      const list = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/list');
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch (e) { /* 还没起来 */ }
    await sleep(250);
  }
  if (!target) { console.error('Chrome 未就绪'); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const cdp = new Cdp(ws);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: URL_ });

  const deadline = Date.now() + WAIT_S * 1000;
  let snap = null;
  while (Date.now() < deadline) {
    await sleep(1500);
    const r = await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        href: location.href, title: document.title, ready: document.readyState,
        hasBlurb: !!document.querySelector('li.work.blurb, li.blurb.group'),
        hasMain: !!document.querySelector('#main'),
        hasFooter: !!document.querySelector('#footer'),
        hasHeader: !!document.querySelector('#header'),
        chapters: document.body ? document.body.innerText.slice(0, 200) : ''
      })`,
      returnByValue: true
    });
    snap = JSON.parse(r.result.value);
    if (snap.hasBlurb || /\/works\/\d+/.test(await (async () => {
      const x = await cdp.send('Runtime.evaluate', { expression: 'location.pathname', returnByValue: true });
      return x.result.value;
    })())) break;
  }

  console.log('=== 当前页面 ===');
  console.log(JSON.stringify(snap, null, 2));

  // 注入 detect.js 在页面上下文里算分
  const detectSrc = fs.readFileSync(path.join(EXT, 'src/lib/detect.js'), 'utf8');
  await cdp.send('Runtime.evaluate', { expression: detectSrc });
  const det = await cdp.send('Runtime.evaluate', {
    expression: `JSON.stringify(window.AO3TM.detect.detect(document, location), null, 2)`,
    returnByValue: true
  });
  console.log('=== detect() ===');
  console.log(det.result.value);

  const html = await cdp.send('Runtime.evaluate', {
    expression: 'document.documentElement.outerHTML',
    returnByValue: true
  });
  fs.writeFileSync(path.join(os.tmpdir(), 'ao3tm-probe.html'), html.result.value, 'utf8');
  console.log('HTML 已存到: ' + path.join(os.tmpdir(), 'ao3tm-probe.html'));

  ws.close();
  chrome.kill();
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
