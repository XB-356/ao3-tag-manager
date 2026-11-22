/* 「所有网站」扫描脚本的端到端测试。
   用法：node test/scan-bundle.js  （需先跑 node test/server.js）

   为什么需要这个测试：扫描脚本注册对了、matches 对了，也可能一个横幅都不出——
   因为 SCAN_JS 里如果只有库文件、没有入口文件，浏览器会"加载但不执行"。
   这个测试真的把 SCAN_JS 按顺序注入页面，断言横幅被挂出来。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9614);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const httpJson = (url) =>
  new Promise((resolve, reject) => {
    require('http').get(url, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
const httpOk = (url) =>
  new Promise((resolve) => {
    require('http').get(url, (res) => { res.resume(); resolve(res.statusCode === 200); }).on('error', () => resolve(false));
  });

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
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

/* 页面里没有扩展环境，所以给一份最小 chrome 桩：只让 env-core 认出"扩展模式"。
   关键：**故意不提供 chrome.permissions** —— 真实的扫描脚本跑在内容脚本里也没有这个 API，
   权限只能问 background（ao3tm:auto-status）。桩里若顺手给了 permissions，
   就会把"内容脚本拿不到权限 API"这个真 bug 掩盖掉。 */
const CHROME_STUB = `window.chrome = {
  runtime: {
    id: 'scan-test',
    lastError: null,
    sendMessage: function (m, cb) {
      (window.__sent = window.__sent || []).push(m && m.type);
      var type = m && m.type;
      if (cb) cb(type === 'ao3tm:auto-status' ? { granted: true } : { ok: true, host: m && m.host });
    }
  },
  scripting: {
    getRegisteredContentScripts: function (d, cb) { cb([]); },
    registerContentScripts: function (l, cb) { if (cb) cb(); },
    updateContentScripts: function (l, cb) { if (cb) cb(); },
    unregisterContentScripts: function (d, cb) { if (cb) cb(); }
  }
};`;

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const LIB_FILES = ['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/detect.js', 'src/lib/auto-detect.js'];
const SCAN_FILE = 'src/core/scan.js';

const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok && detail !== undefined) console.log('   ' + JSON.stringify(detail));
}

(async () => {
  if (!(await httpOk('http://127.0.0.1:' + PORT + '/list.html'))) {
    console.error('mock 服务没起来，请先运行：node test/server.js');
    process.exit(2);
  }
  if (!fs.existsSync(path.join(ROOT, SCAN_FILE))) {
    console.error('缺少扫描入口 ' + SCAN_FILE + '：只有库文件时脚本会加载但不执行');
    process.exit(2);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-scan-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-proxy-server',
    '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + dir, 'about:blank'
  ], { stdio: 'ignore' });
  process.on('exit', () => chrome.kill());

  let version = null;
  for (let i = 0; i < 80 && !version; i++) {
    try { version = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/version'); } catch (e) { await sleep(250); }
  }
  if (!version) {
    console.error('Chrome 调试端口没起来');
    process.exit(2);
  }
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const cdp = new Cdp(ws);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const sid = attached.sessionId;
  await cdp.send('Runtime.enable', {}, sid);
  await cdp.send('Page.enable', {}, sid);

  const evaluate = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid);
    if (r.exceptionDetails) {
      const ex = r.exceptionDetails;
      throw new Error('页面脚本异常: ' + ((ex.exception && (ex.exception.description || ex.exception.value)) || ex.text));
    }
    return r.result && r.result.value;
  };

  const goto = async (url) => {
    await cdp.send('Page.navigate', { url }, sid);
    for (let i = 0; i < 100; i++) {
      const state = await evaluate('document.readyState');
      if (state === 'complete') return;
      await sleep(80);
    }
    throw new Error('页面没有加载完成: ' + url);
  };

  /** 按扩展真实顺序注入：库 → （可选改判定）→ 入口 */
  const inject = async (pre) =>
    evaluate(
      [CHROME_STUB]
        .concat(LIB_FILES.map(read))
        .concat(pre ? [pre] : [])
        .concat([read(SCAN_FILE)])
        .join('\n;\n') + '\n;undefined;'
    );

  const bannerInfo = () =>
    evaluate(`(function () {
      const box = document.getElementById('ao3tm-auto-banner');
      if (!box) return null;
      return {
        cls: box.className,
        text: box.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120),
        acts: Array.prototype.map.call(box.querySelectorAll('[data-act]'), function (b) { return b.getAttribute('data-act'); }),
        first: document.body.firstChild === box
      };
    })()`);

  try {
    /* 1. 像 AO3 的页面（127.0.0.1 本身是"已启用"域名，所以先把已启用判定关掉，
          模拟"陌生镜像域名"） */
    await goto('http://127.0.0.1:' + PORT + '/list.html');
    await inject('window.AO3TM.env.isAo3Host = function () { return false; };');
    await sleep(400);
    const ran = await evaluate('!!(window.AO3TM && window.AO3TM.scan && window.AO3TM.scan.ran)');
    check('扫描入口真的执行了（AO3TM.scan.ran）', ran === true, ran);

    const banner = await bannerInfo();
    check('像 AO3 的页面挂出了检测横幅', !!banner, banner);
    check('横幅插在 body 最前面', !!banner && banner.first === true, banner && banner.first);
    check('横幅是"高度确认"样式', !!banner && /is-high/.test(banner.cls), banner && banner.cls);
    check('横幅文案包含站点判定结论', !!banner && /AO3/.test(banner.text), banner && banner.text);
    check(
      '陌生域名上提供"启用 / 以后再说 / 一直忽略"三个操作',
      !!banner && ['enable', 'dismiss', 'never'].every((act) => banner.acts.indexOf(act) !== -1),
      banner && banner.acts
    );

    /* 1b. 点「启用」：内容脚本发不起权限弹窗，但"所有网站"权限已经开着，
           正确的做法是直接让后台注册，而不是立刻变成"重试"。
           （用户报"点击授权后显示重试、刷新后未生效"就是这条路径） */
    const clicked = await evaluate(`(function () {
      const btn = document.querySelector('#ao3tm-auto-banner [data-act="enable"]');
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    await sleep(320);
    const sentAfter = await evaluate('window.__sent || []');
    const labelAfter = await evaluate(`(function () {
      const btn = document.querySelector('#ao3tm-auto-banner [data-act="enable"]');
      return btn ? btn.textContent.trim() : null;
    })()`);
    check(
      '点「启用」直接走后台注册，不出现"重试"',
      clicked === true &&
        sentAfter.indexOf('ao3tm:save-mirror') !== -1 &&
        !/重试/.test(String(labelAfter)) &&
        !/失败/.test(String(labelAfter)),
      { sent: sentAfter, label: labelAfter }
    );

    /* 2. 已启用的域名（127.0.0.1 在测试域名表里）：判定为 AO3，但不该挂横幅 */
    await goto('http://127.0.0.1:' + PORT + '/list.html');
    await inject(null);
    await sleep(400);
    const enabledBanner = await bannerInfo();
    const enabledResult = await evaluate('(function () { const r = AO3TM.autoDetect.check(); return { isAo3: r.isAo3, enabledHere: r.enabledHere }; })()');
    check('已启用域名上判定为 AO3', !!enabledResult && enabledResult.isAo3 === true, enabledResult);
    check('已启用域名上不挂横幅（不打扰用户）', enabledBanner === null, enabledBanner);

    /* 3. 完全不像 AO3 的页面：跑完不该留横幅 */
    await goto('data:text/html,%3Ctitle%3ERandom%20Blog%3C/title%3E%3Ch1%3Ehello%3C/h1%3E%3Cp%3Enothing%20to%20see%3C/p%3E');
    await inject(null);
    await sleep(400);
    const plainRan = await evaluate('!!(window.AO3TM && window.AO3TM.scan && window.AO3TM.scan.ran)');
    const plainBanner = await bannerInfo();
    check('普通页面上扫描入口同样会执行', plainRan === true, plainRan);
    check('普通页面不挂横幅', plainBanner === null, plainBanner);

    /* 4. 「访问验证」挑战页：识别出来但先不挂横幅（等验证通过后重判） */
    await goto(
      'data:text/html;charset=utf-8,%3Ctitle%3E%E8%AE%BF%E9%97%AE%E9%AA%8C%E8%AF%81%20%7C%20AO3%20Mirror%3C/title%3E' +
        '%3Cbody%3E%E6%AD%A3%E5%9C%A8%E9%AA%8C%E8%AF%81%E6%82%A8%E7%9A%84%E6%B5%8F%E8%A7%88%E5%99%A8%EF%BC%8C%E8%AF%B7%E7%A8%8D%E5%80%99%3C/body%3E'
    );
    await inject(null);
    await sleep(400);
    const challenge = await evaluate('(function () { const r = AO3TM.autoDetect.check(); return { challenge: r.challenge, marker: r.challengeMarker, isAo3: r.isAo3 }; })()');
    const challengeBanner = await bannerInfo();
    check('挑战页被识别为"访问验证"而不是"不是 AO3"', !!challenge && challenge.challenge === true && challenge.isAo3 === false, challenge);
    check('挑战页当下不挂横幅（等验证完成再判）', challengeBanner === null, challengeBanner);
  } finally {
    try { chrome.kill(); } catch (e) { /* ignore */ }
  }

  console.log('\n===== 结果 =====');
  console.log(results.length - failed + '/' + results.length + ' 通过');
  if (failed) {
    results.filter((r) => !r.ok).forEach((r) => console.log('  - ' + r.name + ' :: ' + JSON.stringify(r.detail)));
  }
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('测试异常：' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
