/* 验证登录提示横幅（含链接切分的节点）能被完整汉化
   用法：node test/i18n-banner.js （需要先跑 node test/server.js） */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9611);
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
  if (!(await httpOk('http://127.0.0.1:' + PORT + '/footer.html'))) {
    console.error('mock 服务没起来，请先运行：node test/server.js');
    process.exit(2);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-banner-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-proxy-server',
    '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + dir,
    '--disable-extensions-except=' + EXT, '--load-extension=' + EXT, 'about:blank'
  ], { stdio: 'ignore' });
  process.on('exit', () => chrome.kill());

  let version = null;
  for (let i = 0; i < 80 && !version; i++) {
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
  cdp.ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') {
      console.log('[页面异常]', ((m.params.exceptionDetails.exception || {}).description || '').split('\n')[0]);
    }
  });

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
      if (!retried && /CDP 超时/.test(err.message)) {
        await sleep(400);
        return evaluate(expression, true);
      }
      throw err;
    }
  };
  const waitFor = async (expr, label, timeout = 20000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(`!!document.documentElement && (${expr})`)) return true;
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

  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/footer.html' });
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, '页面就绪');
  // 打开汉化并等一轮
  await command('ao3tm:debug', { setSetting: { i18n: true } });
  await sleep(400);
  await command('ao3tm:debug', { i18nDebug: 'reset' });
  await command('ao3tm:refresh');
  await waitFor(`!!document.querySelector('[data-ao3tm-i18n]')`, '汉化标记出现');
  await sleep(1500);

  const results = [];
  let failed = 0;
  const record = (name, ok, detail) => {
    results.push({ name, ok });
    if (!ok) failed += 1;
    console.log((ok ? 'PASS ' : 'FAIL ') + name);
    if (!ok) console.log('   实际: ' + JSON.stringify(detail));
  };


  const text = await evaluate(`document.getElementById('footer').textContent.replace(/\\s+/g, ' ').trim()`);
  console.log('   页脚实际文本: ' + text);

  const commentBox = await evaluate(`(() => {
    const box = document.getElementById('comments_placeholder_for_test');
    if (!box) return 'MISSING';
    return Array.prototype.map.call(box.querySelectorAll('legend, p, h4, span'), function (n) {
      return (n.textContent || '').replace(/\\s+/g, ' ').trim();
    }).filter(Boolean).join(' | ');
  })()`);
  console.log('   评论区实际文本: ' + commentBox);
  const commentExpect = [
    ['评论审核提示已翻', /这篇作品的作者开启了评论审核/.test(commentBox)],
    ['Comment as 已翻', /评论身份/.test(commentBox)],
    ['Plain text with limited HTML 已翻', /纯文本，支持有限的 HTML/.test(commentBox)],
    ['评论内容校验提示已翻', /简洁是智慧的灵魂/.test(commentBox)],
    ['无残留英文', !/moderate comments|Comment as|Plain text|Brevity/.test(commentBox)]
  ];
  commentExpect.forEach(([name, ok]) => record(name, ok, commentBox));
  const expect = [
    ['Donate or Volunteer 不得残留 Volunteer', !/Volunteer/.test(text)],
    ['捐赠或参与志愿应完整出现', /捐赠或参与志愿/.test(text)],
    ['皮肤名 Default 不翻', /Default/.test(text) && !/默认|低视力/.test(text)],
    ['皮肤名 Snow Blue 不翻', /Snow Blue/.test(text)],
    ['Customize 应翻成 自定义外观', /自定义外观/.test(text)],
    ['Contact Us 应翻成 联系我们', /联系我们/.test(text)]
  ];
  expect.forEach(([name, ok]) => record(name, ok, text));
  console.log('\n===== 结果 =====');
  console.log(results.length - failed + '/' + results.length + ' 通过');
  chrome.kill();
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('测试异常: ' + (err && err.stack ? err.stack : err));
  process.exit(2);
});
