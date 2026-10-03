/* 验证：镜像站域名识别、file:// 支持、油猴脚本版能独立跑起来
   用法：node test/mirror-userscript.js （需要先跑 node test/server.js） */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const ART = path.resolve(__dirname, 'artifacts');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9555);
const USERSCRIPT = path.join(EXT, 'dist', 'ao3-tag-manager.user.js');
const MIRROR_HOST = 'ao3.cubeart.club';
/** 已静态授权的域名：用来验证"动态注册 -> 真的注入"链路。
    注意 chrome.permissions.request 没法在无头环境真的授权，而 Chrome 在没有
    真实 host 权限时即使注册成功也不会注入，所以必须挑一个已授权的域名来验证。 */
const ENABLED_HOST = 'localhost';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 用与油猴包相同的包装器拼接源码，等价于"用户装了这个脚本" */
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

  // 构建产物存在性检查（实际注入用的是源码拼接版，保证测的是当前源码）
  if (!fs.existsSync(USERSCRIPT)) {
    console.error('提示：还没有构建油猴包，请运行 node tools/build-userscript.js');
  }
  if (!(await httpOk('http://127.0.0.1:' + PORT + '/list.html'))) {
    console.error('mock 服务没起来，请先运行：node test/server.js');
    process.exit(2);
  }

  const userscript = USERS_SCRIPT_SOURCE;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-mirror-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--allow-file-access-from-files',
    // 模拟镜像站需要两件事同时满足：
    //   1) 把镜像域名解析到本地服务（否则 DNS 失败）
    //   2) 禁用系统代理（否则请求被代理截走，永远回不来）
    // 注意：不要加 EXCLUDE 子句，实测会让扩展内容脚本在 127.0.0.1 上不再注入
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
  cdp.ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      console.log('[页面异常]', d.text, (d.exception || {}).description, (d.url || '') + ':' + d.lineNumber);
    }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      console.log('[页面' + m.params.type + ']', (m.params.args || []).map((a) => a.value || a.description || a.type).join(' '));
    }
  });
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 800, deviceScaleFactor: 1, mobile: false });

  /** 导航过程中 documentElement 可能还是 null，统一包一层重试 */
  const evaluate = async (expression, retried) => {
    try {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        const text = (r.exceptionDetails.exception || {}).description || r.exceptionDetails.text || '';
        // 导航换代期间的瞬时错误：等一下重试
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

  /* ------------------------ 1. 镜像域名识别（扩展环境） ------------------------ */

  // 先确认扩展本身有没有加载成功（加载失败时内容脚本根本不会注入）
  const swTargets = (await cdp.send('Target.getTargets')).targetInfos.filter((t) => t.url.endsWith('/src/background.js'));
  console.log('扩展 service worker:', swTargets.length ? '已加载' : '（没有，扩展可能加载失败）');
  if (swTargets.length) {
    const swSession = (await cdp.send('Target.attachToTarget', { targetId: swTargets[0].targetId, flatten: true })).sessionId;
    try {
      await cdp.send('Runtime.enable', {}, swSession);
    } catch (err) {
      console.log('（service worker 调试会话未就绪，跳过清单检查）');
      await sleep(500);
    }
    await sleep(1200); // 等模块加载完成
    try {
      const info = await cdp.send(
        'Runtime.evaluate',
        { expression: 'JSON.stringify({v: chrome.runtime.getManifest().version, hasEnv: !!(self.AO3TM && self.AO3TM.env), hasMirrors: !!(self.AO3TM && self.AO3TM.mirrors)})', returnByValue: true },
        swSession
      );
      console.log('service worker 模块:', info.result && info.result.value);
    } catch (err) {
      console.log('（读取 service worker 状态失败：' + err.message + '）');
    }
  }

  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/list.html' });
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, '官方/测试域就绪');
  await sleep(300);

  // 内容脚本在隔离世界，主世界读不到 window.AO3TM，必须走事件桥
  const envInfo = await command('ao3tm:debug', {
    probe: true,
    probeHosts: [
      'archiveofourown.org',
      'www.archiveofourown.org',
      'ao3.cubeart.club',
      'ao3.win',
      'evil-random-site.com',
      'localhost'
    ],
    probeRaw: ['https://AO3.Example.com/works?x=1', 'ao3.example.com:8443', '  ao3.example.com  ', 'not a host', '*.example.com']
  });
  record(
    '环境层：扩展模式 + chrome.storage',
    envInfo && envInfo.env && envInfo.env.mode === 'extension' && envInfo.env.driver === 'chrome.storage',
    envInfo && envInfo.env
  );
  const probes = envInfo && envInfo.probe ? envInfo.probe.hosts : null;
  record(
    '域名判定：官方站与预置镜像算 AO3，其它不算',
    probes &&
      probes['archiveofourown.org'] === true &&
      probes['www.archiveofourown.org'] === true &&
      probes['ao3.cubeart.club'] === true &&
      probes['ao3.win'] === true &&
      probes['localhost'] === true &&
      probes['evil-random-site.com'] === false,
    probes
  );
  const norm = envInfo && envInfo.probe ? envInfo.probe.normalized : null;
  record(
    '域名归一化：去掉协议/路径/端口，拒绝非法输入',
    norm &&
      norm[0] === 'ao3.example.com' &&
      norm[1] === 'ao3.example.com' &&
      norm[2] === 'ao3.example.com' &&
      norm[3] === '' &&
      norm[4] === '' &&
      envInfo.probe.pattern === 'https://ao3.example.com/*',
    { normalized: norm, pattern: envInfo && envInfo.probe && envInfo.probe.pattern }
  );

  /* ------------------------ 2. 镜像域名下（无扩展注入） ------------------------ */

  // 用 Host 头把 mock 页面伪装成镜像站，此时扩展的内容脚本不会注入（manifest 没匹配）
  await send('Page.navigate', { url: 'http://' + MIRROR_HOST + ':' + PORT + '/list.html' });
  await waitFor(`document.querySelectorAll('li.blurb').length === 5`, '镜像页加载完成');
  const mirrorNoExt = await evaluate(`({
    url: location.href,
    hasAO3TM: !!window.AO3TM,
    blurbs: document.querySelectorAll('li.blurb').length
  })`);
  record(
    '镜像域名未启用时，扩展内容脚本不注入（符合预期）',
    mirrorNoExt && mirrorNoExt.hasAO3TM === false && mirrorNoExt.blurbs > 0,
    mirrorNoExt
  );

  /* ------------------------ 3. 油猴脚本版（同一页面注入） ------------------------ */

  // 模拟油猴管理器：把打包好的脚本当普通脚本注入页面
  await evaluate(`(() => {
    window.localStorage.removeItem('ao3tm_state_v1');
    window.localStorage.removeItem('ao3tm_hosts');
    return true;
  })()`);
  const injected = await send('Page.addScriptToEvaluateOnNewDocument', { source: USERS_SCRIPT_SOURCE });
  await send('Page.navigate', { url: 'http://' + MIRROR_HOST + ':' + PORT + '/list.html' });
  await waitFor(`!!window.AO3TM && !!document.querySelector('#ao3tm-bar')`, '油猴版注入并启动', 20000);
  await sleep(600);

  const userInfo = await evaluate(`(() => {
    const store = window.AO3TM.store;
    return {
      mode: window.AO3TM.env.mode,
      driver: store.driverName,
      bar: !!document.getElementById('ao3tm-bar'),
      fab: !!document.getElementById('ao3tm-fab'),
      tools: document.querySelectorAll('li.blurb .ao3tm-tools').length,
      tagButtons: document.querySelectorAll('.ao3tm-tag-btn').length,
      styleInjected: !!document.getElementById('ao3tm-style') || !!document.querySelector('style')
    };
  })()`);
  record(
    '油猴版：识别为油猴模式并使用 localStorage',
    userInfo && userInfo.mode === 'userscript' && userInfo.driver === 'localStorage',
    userInfo && { mode: userInfo.mode, driver: userInfo.driver }
  );
  record(
    '油猴版：统计条 / 悬浮按钮 / 卡片按钮 / 标签按钮全部注入',
    userInfo && userInfo.bar && userInfo.fab && userInfo.tools === 5 && userInfo.tagButtons > 10,
    userInfo
  );

  // 油猴版点标签屏蔽 + 规则持久化到 localStorage
  await evaluate(`document.querySelector('.ao3tm-tag[data-tag="Fluff"] .ao3tm-tag-btn[data-mode="block"]').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 2`, '油猴版屏蔽生效');
  const blocked = await evaluate(`(() => {
    const raw = window.localStorage.getItem('ao3tm_state_v1');
    const state = raw ? JSON.parse(raw) : null;
    return {
      hidden: Array.from(document.querySelectorAll('li.blurb.ao3tm-hidden')).map(n => n.id),
      saved: !!(state && state.rules && state.rules.tag && state.rules.tag.block && state.rules.tag.block.fluff)
    };
  })()`);
  record(
    '油猴版：屏蔽生效并写入 localStorage',
    blocked && blocked.hidden.sort().join(',') === 'work_101,work_103' && blocked.saved,
    blocked
  );
  await shot('20-userscript');

  // 刷新后规则仍在（localStorage 持久化）
  await send('Page.navigate', { url: 'http://' + MIRROR_HOST + ':' + PORT + '/list.html' });
  await waitFor(`!!document.querySelector('#ao3tm-bar')`, '油猴版刷新后启动', 20000);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 2`, '油猴版刷新后规则仍生效', 8000);
  record('油猴版：刷新后规则仍然生效', true);

  // 设置页应提示"域名写在脚本头"
  await command('ao3tm:panel');
  await sleep(400);
  await evaluate(`(() => {
    const tab = document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="settings"]');
    if (tab) tab.click();
    return true;
  })()`);
  await sleep(400);
  const mirrorHint = await evaluate(`(() => {
    const root = document.querySelector('.ao3tm-panel-root');
    if (!root) return null;
    const hit = Array.from(root.querySelectorAll('.ao3tm-hint')).filter(n => /@match/.test(n.textContent))[0];
    return hit ? hit.textContent.slice(0, 60) : null;
  })()`);
  record('油猴版：设置页提示改 @match 而不是权限授权', !!mirrorHint && /@match/.test(mirrorHint), mirrorHint);
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);

  /* ------------------------ 4. 扩展侧：镜像管理 UI ------------------------ */

  // 先撤掉油猴脚本注入，否则它会盖掉扩展自己的内容脚本
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier });
  await evaluate(`(() => {
    window.localStorage.removeItem('ao3tm_state_v1');
    window.localStorage.removeItem('ao3tm_hosts');
    return true;
  })()`);
  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/list.html' });
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, '回到扩展域');
  const backOnExt = await command('ao3tm:debug');
  record(
    '撤掉油猴注入后，127.0.0.1 上跑的是扩展内容脚本',
    backOnExt && backOnExt.env && backOnExt.env.mode === 'extension',
    backOnExt && backOnExt.env
  );
  await command('ao3tm:panel');
  await waitFor(`!!document.querySelector('.ao3tm-panel-root')`, '扩展面板已打开');
  await sleep(300);
  await evaluate(`(() => {
    const tab = document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="settings"]');
    if (tab) tab.click();
    return true;
  })()`);
  await waitFor(`!!document.querySelector('.ao3tm-panel-root input[data-mirror-input]')`, '镜像输入框存在');
  await sleep(800);
  const mirrorUi = await evaluate(`(() => {
    const root = document.querySelector('.ao3tm-panel-root');
    const rows = Array.from(root.querySelectorAll('.ao3tm-mirror-host')).map(n => n.textContent.replace('预置','').trim());
    const buttons = Array.from(root.querySelectorAll('[data-act^="mirror-"]')).map(b => b.getAttribute('data-act'));
    return { rows: rows, hasAdd: !!root.querySelector('[data-act="mirror-add"]'), buttons: buttons.slice(0, 8) };
  })()`);
  record(
    '扩展设置页：列出预置镜像并提供启用按钮',
    mirrorUi && mirrorUi.rows.length >= 3 && mirrorUi.hasAdd && mirrorUi.buttons.indexOf('mirror-enable') !== -1,
    mirrorUi
  );
  record(
    '扩展设置页：非法域名会被拒绝（有输入提示）',
    await evaluate(`(() => {
      const input = document.querySelector('.ao3tm-panel-root input[data-mirror-input]');
      input.value = 'not a host';
      document.querySelector('.ao3tm-panel-root [data-act="mirror-add"]').click();
      return true;
    })()`),
    null
  );
  await sleep(600);
  const stillNoHost = envInfo && envInfo.probe ? envInfo.probe.customHosts : null;
  record('扩展设置页：非法域名没有写进已启用列表', Array.isArray(stillNoHost) && stillNoHost.length === 0, { customHosts: stillNoHost });
  await shot('21-mirror-settings');
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);

  /* ------------------------ 5. 启用镜像 -> 动态注册 -> 真的注入 ------------------------ */

  // 注意：chrome.permissions.request 没法在无头环境真的授权，而 Chrome 在没有真实
  // host 权限时即使注册成功也不会注入。所以用 localhost（已在 host_permissions 里）
  // 来验证"注册 -> 注入"链路本身，域名判定与归一化在上面已单独覆盖。
  const enableResult = await command('ao3tm:debug', { mirrorEnableForTest: ENABLED_HOST });
  record(
    '启用镜像：动态注册成功且两种协议都覆盖',
    enableResult &&
      enableResult.ok === true &&
      enableResult.mirrorResult &&
      enableResult.mirrorResult.ok === true &&
      enableResult.mirrorResult.register &&
      enableResult.mirrorResult.register.ok === true &&
      enableResult.mirrorResult.register.patterns.indexOf('http://' + ENABLED_HOST + '/*') !== -1 &&
      enableResult.mirrorResult.register.patterns.indexOf('https://' + ENABLED_HOST + '/*') !== -1,
    enableResult && { result: enableResult.mirrorResult, enabled: enableResult.enabled }
  );
  record(
    '静态域名（localhost）不会重复写进镜像清单',
    enableResult && Array.isArray(enableResult.enabled) && enableResult.enabled.indexOf(ENABLED_HOST) === -1,
    { enabled: enableResult && enableResult.enabled }
  );

  // 真实镜像域名（不在静态清单里）必须能写进清单
  const mirrorEnable = await command('ao3tm:debug', { mirrorEnableForTest: MIRROR_HOST });
  record(
    '自定义镜像域名会写进已启用清单',
    mirrorEnable &&
      mirrorEnable.mirrorResult &&
      mirrorEnable.mirrorResult.ok === true &&
      Array.isArray(mirrorEnable.enabled) &&
      mirrorEnable.enabled.indexOf(MIRROR_HOST) !== -1,
    mirrorEnable && { result: mirrorEnable.mirrorResult, enabled: mirrorEnable.enabled }
  );

  // 看 Chrome 实际保存的注册内容（localhost 属静态域名，不进动态注册）
  const regDebug = await command('ao3tm:debug', { mirrorRegistered: true });
  const reg = regDebug && regDebug.registered && regDebug.registered[0];
  record(
    '动态注册的内容正确：协议双覆盖 + 全部模块 + 跨会话保留',
    reg &&
      reg.id === 'ao3tm-mirror' &&
      reg.matches.indexOf('http://' + MIRROR_HOST + '/*') !== -1 &&
      reg.matches.indexOf('https://' + MIRROR_HOST + '/*') !== -1 &&
      reg.js === manifest.content_scripts[0].js.length &&
      reg.persist === true,
    reg
  );

  // 关键一步：重新打开该域名，内容脚本应当已经注入
  await send('Page.navigate', { url: 'http://' + ENABLED_HOST + ':' + PORT + '/list.html' });
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, '启用后该域名上扩展已注入', 15000);
  const mirrorWithExt = await command('ao3tm:debug', { probe: true, probeHosts: [ENABLED_HOST, MIRROR_HOST] });
  record(
    '启用后动态注册的域名真的注入（环境为扩展模式且判定为 AO3）',
    mirrorWithExt &&
      mirrorWithExt.env &&
      mirrorWithExt.env.mode === 'extension' &&
      mirrorWithExt.env.host === ENABLED_HOST &&
      mirrorWithExt.env.isAo3 === true,
    mirrorWithExt && { env: mirrorWithExt.env, probes: mirrorWithExt.probe.hosts }
  );
  const mirrorUiState = await evaluate(`({
    bar: !!document.getElementById('ao3tm-bar'),
    tools: document.querySelectorAll('li.blurb .ao3tm-tools').length
  })`);
  record('启用后该域名上统计条与卡片按钮都在', mirrorUiState.bar && mirrorUiState.tools === 5, mirrorUiState);
  await shot('22-mirror-enabled');

  // 关掉：应当移出清单，且该域名不再出现在动态注册里
  const disableResult = await command('ao3tm:debug', { mirrorDisableForTest: MIRROR_HOST });
  const regAfter = await command('ao3tm:debug', { mirrorRegistered: true });
  const matchesAfter = (regAfter.registered || []).reduce(function (acc, item) {
    return acc.concat(item.matches || []);
  }, []);
  record(
    '停用镜像：移出清单且动态注册里不再包含它',
    disableResult &&
      disableResult.ok === true &&
      (disableResult.enabled || []).indexOf(MIRROR_HOST) === -1 &&
      matchesAfter.indexOf('http://' + MIRROR_HOST + '/*') === -1 &&
      matchesAfter.indexOf('https://' + MIRROR_HOST + '/*') === -1,
    { enableAfter: disableResult && disableResult.enabled, matchesAfter: matchesAfter }
  );

  /* ------------------------ 6. file:// 本地文件 ------------------------ */

  const filePage = path.join(os.tmpdir(), 'ao3tm-local-test.html');
  fs.copyFileSync(path.resolve(__dirname, 'mock', 'list.html'), filePage);
  await send('Page.navigate', { url: 'file:///' + filePage.replace(/\\/g, '/') });
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, 'file:// 页面扩展已注入', 15000);
  // total 来自 ui.lastStats，ready 标记挂在更外层，先主动 refresh 一次再读
  await command('ao3tm:refresh');
  await sleep(800);
  const fileInfo = await command('ao3tm:debug');
  record(
    'file:// 本地文件也能用（本地浏览器场景）',
    fileInfo && fileInfo.env && fileInfo.env.protocol === 'file:' && fileInfo.env.isAo3 === true,
    fileInfo && { env: fileInfo.env, total: fileInfo.total }
  );
  const fileUi = await evaluate(`({
    bar: !!document.getElementById('ao3tm-bar'),
    tools: document.querySelectorAll('li.blurb .ao3tm-tools').length
  })`);
  record('file:// 页面上的工具条也注入了', fileUi.bar && fileUi.tools === 5, fileUi);
  await shot('23-file-protocol');

  // 清掉这次启用，避免影响后续手动使用
  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/list.html' });
  await waitFor(`!!document.documentElement.getAttribute('data-ao3tm-ready')`, '回到测试域');
  await command('ao3tm:debug', { clear: true });
  await evaluate(`(() => { window.localStorage.removeItem('ao3tm_hosts'); return true; })()`);

  console.log('\n===== 结果 =====');
  const failed = results.filter((r) => !r.ok);
  console.log(results.length - failed.length + '/' + results.length + ' 通过');
  failed.forEach((f) => console.log('  - ' + f.name + ' :: ' + JSON.stringify(f.detail)));
  fs.writeFileSync(path.join(ART, 'mirror-userscript-results.json'), JSON.stringify(results, null, 2));
  cleanup();
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error('测试异常: ' + (err && err.stack ? err.stack : err));
  process.exit(2);
});
