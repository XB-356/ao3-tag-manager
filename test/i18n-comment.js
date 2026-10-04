/* 真实浏览器验证：评论区汉化 + 用户评论不被翻译 + 页脚片段不再被切碎
   用法：node test/i18n-comment.js （需先 node test/server.js） */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9612);
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

(async () => {
  if (!(await httpOk('http://127.0.0.1:' + PORT + '/footer.html'))) {
    console.error('mock 服务没起来，请先运行：node test/server.js');
    process.exit(2);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-comment-'));
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

  const evaluate = async (expression, retried) => {
    try {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        const text = (r.exceptionDetails.exception || {}).description || r.exceptionDetails.text || '';
        if (!retried) { await sleep(300); return evaluate(expression, true); }
        throw new Error(text);
      }
      return r.result.value;
    } catch (err) {
      if (!retried) { await sleep(400); return evaluate(expression, true); }
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
  const text = (sel) => evaluate(`(() => { const n = document.querySelector(${JSON.stringify(sel)}); return n ? n.textContent.replace(/\\s+/g, ' ').trim() : 'MISSING'; })()`);

  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/footer.html' });
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, '页面就绪');
  await command('ao3tm:debug', { setSetting: { i18n: true } });
  await sleep(400);
  await command('ao3tm:refresh');
  await waitFor(`!!document.querySelector('[data-ao3tm-orig]')`, '汉化标记出现');
  await sleep(1500);

  const results = [];
  let failed = 0;
  const record = (name, ok, detail) => {
    results.push({ name, ok });
    if (!ok) failed += 1;
    console.log((ok ? 'PASS ' : 'FAIL ') + name);
    if (!ok) console.log('   实际: ' + JSON.stringify(detail));
  };

  const formText = await text('#add_comment_placeholder');
  console.log('   评论表单实际文本: ' + formText);
  record('评论表单：Post Comment 已翻', /发表评论/.test(formText), formText);
  record('评论表单：评论审核提示已翻', /这篇作品的作者开启了评论审核/.test(formText), formText);
  record('评论表单：Comment as 已翻', /评论身份/.test(formText), formText);
  record('评论表单：纯文本提示已翻', /纯文本，支持有限的 HTML/.test(formText), formText);
  record('评论表单：字数提示已翻', /剩余字符|字符剩余/.test(formText) || /characters left/.test(formText) === false, formText);
  record('评论表单：无残留英文界面文案', !/Post Comment|moderate comments on the work|Comment as|Plain text with limited|Brevity/.test(formText), formText);

  const userText = await text('#user_comment_box .userstuff');
  console.log('   用户评论实际文本: ' + userText);
  record('用户评论正文一字未改', /USER WRITTEN COMMENT MUST NOT BE TRANSLATED: Characters Haunting the Narrative and Tags/.test(userText), userText);

  const footerText = await text('#footer');
  console.log('   页脚实际文本: ' + footerText);
  record('页脚：Donate or Volunteer 完整翻译且无残留', /捐赠或参与志愿/.test(footerText) && !/Volunteer/.test(footerText), footerText);
  record('页脚：皮肤名不翻', /Default/.test(footerText) && /Snow Blue/.test(footerText) && !/雪蓝|默认皮肤/.test(footerText), footerText);
  record('页脚：Customize 已翻', /自定义外观/.test(footerText), footerText);

  console.log('\n===== 结果 =====');
  console.log(results.length - failed + '/' + results.length + ' 通过');
  if (failed) results.filter((r) => !r.ok).forEach((r) => console.log('  - ' + r.name));
  chrome.kill();
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('测试异常: ' + (err && err.stack ? err.stack : err));
  process.exit(2);
});
