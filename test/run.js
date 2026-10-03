/* 用 CDP 驱动真实 Chrome（headless）加载扩展，对 mock AO3 列表页做端到端验证。
   内容脚本运行在隔离世界，因此测试通过 DOM 交互 + 页面事件桥（ao3tm:command）驱动。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = path.resolve(__dirname, '..');
const ART = path.resolve(__dirname, 'artifacts');
const PORT = Number(process.env.PORT || 8877);
const CDP_PORT = Number(process.env.CDP_PORT || 9333);
const PAGE_URL = 'http://127.0.0.1:' + PORT + '/list.html';

fs.mkdirSync(ART, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGet(url) {
  return new Promise((resolve, reject) => {
    require('http')
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body: body }));
      })
      .on('error', reject);
  });
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    require('http')
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        (this.events.get(msg.method) || []).forEach((fn) => fn(msg.params, msg.sessionId));
      }
    });
  }

  on(method, fn) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(fn);
    return () => {
      const list = this.events.get(method) || [];
      const index = list.indexOf(fn);
      if (index !== -1) list.splice(index, 1);
    };
  }

  send(method, params, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP 超时: ' + method));
      }, 15000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

async function main() {
  const alive = async () => {
    try {
      const res = await httpGet('http://127.0.0.1:' + PORT + '/list.html');
      return res.status === 200 && res.body.indexOf('Mock AO3') !== -1;
    } catch (err) {
      return false;
    }
  };

  let server = null;
  if (!(await alive())) {
    server = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      env: Object.assign({}, process.env, { PORT: String(PORT) }),
      stdio: 'ignore'
    });
    server.on('error', () => {});
    for (let i = 0; i < 40; i++) {
      if (await alive()) break;
      await sleep(200);
    }
    if (!(await alive())) throw new Error('mock 服务器未就绪');
  } else {
    console.log('复用已在运行的 mock 服务器 (:' + PORT + ')');
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao3tm-chrome-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=' + CDP_PORT,
      '--user-data-dir=' + userDataDir,
      '--disable-extensions-except=' + EXT,
      '--load-extension=' + EXT,
      '--window-size=1280,1000',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  const cleanup = () => {
    try { chrome.kill(); } catch (e) {}
    try { if (server) server.kill(); } catch (e) {}
  };
  process.on('exit', cleanup);

  let version = null;
  for (let i = 0; i < 80; i++) {
    try {
      version = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/version');
      break;
    } catch (err) {
      await sleep(250);
    }
  }
  if (!version) throw new Error('Chrome CDP 未就绪');
  console.log('Chrome:', version.Browser);

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const cdp = new Cdp(ws);

  // 等扩展 service worker 出现，确保扩展已加载
  let extensionId = null;
  let swTargetId = null;
  for (let i = 0; i < 40 && !extensionId; i++) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const sw = targetInfos.find((t) => t.url.endsWith('/src/background.js'));
    if (sw) {
      extensionId = new URL(sw.url).host;
      swTargetId = sw.targetId;
    } else {
      await sleep(250);
    }
  }
  console.log('扩展 ID:', extensionId);

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  let sessionId = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  let send = (method, params) => cdp.send(method, params, sessionId);
  const mainTargetId = targetId;

  await send('Page.enable');
  await send('Runtime.enable');
  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = (params.args || []).map((a) => a.value || a.description || a.type).join(' ');
    if (text.indexOf('AO3TM-DBG') !== -1) console.log('[扩展日志]', text);
  });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });

  /** 页面导航后执行上下文会换代，旧 session 可能不再返回，这里重连一次再重试 */
  const reconnect = async () => {
    try {
      const res = await cdp.send('Target.attachToTarget', { targetId: mainTargetId, flatten: true });
      sessionId = res.sessionId;
      send = (method, params) => cdp.send(method, params, sessionId);
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    } catch (err) {
      /* 目标已关闭时忽略 */
    }
  };

  const evaluate = async (expression, retry) => {    try {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) {
        const ex = result.exceptionDetails.exception || result.exceptionDetails;
        throw new Error('页面执行出错: ' + (ex.description || JSON.stringify(ex)));
      }
      return result.result.value;
    } catch (err) {
      if (!retry && /CDP 超时/.test(err.message)) {
        await reconnect();
        return evaluate(expression, true);
      }
      throw err;
    }
  };

  const waitFor = async (expression, label, timeout = 10000) => {
    const started = Date.now();
    let last;
    while (Date.now() - started < timeout) {
      last = await evaluate(expression);
      if (last) return last;
      await sleep(120);
    }
    throw new Error('等待超时: ' + label + '（最后结果: ' + JSON.stringify(last) + '）');
  };

  const results = [];
  const record = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail });
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  -> ' + JSON.stringify(detail)));
  };

  // 通过页面事件桥调用扩展（隔离世界）
  const command = (type, payload) =>
    evaluate(`(() => new Promise(resolve => {
      const id = String(Math.random());
      const onResult = ev => {
        const data = JSON.parse(ev.detail);
        if (data.id !== id) return;
        window.removeEventListener('ao3tm:result', onResult);
        resolve(data);
      };
      window.addEventListener('ao3tm:result', onResult);
      window.dispatchEvent(new CustomEvent('ao3tm:command', { detail: JSON.stringify(Object.assign({ type: ${JSON.stringify(type)}, id: id }, ${JSON.stringify(payload || {})})) }));
      setTimeout(() => resolve({ timeout: true }), 4000);
    }))()`);

  const snapshot = () =>
    evaluate(`(() => {
      const blurbHidden = n => n.classList.contains('ao3tm-hidden');
      const hidden = Array.from(document.querySelectorAll('li.blurb')).filter(blurbHidden).map(n => n.id);
      const visible = Array.from(document.querySelectorAll('li.blurb')).filter(n => !blurbHidden(n)).map(n => n.id);
      const bar = document.getElementById('ao3tm-bar');
      return {
        hidden, visible,
        tools: document.querySelectorAll('.ao3tm-tools').length,
        flags: Array.from(document.querySelectorAll('li.blurb.ao3tm-has-flag')).map(n => n.getAttribute('data-ao3tm-why')),
        barText: bar ? bar.innerText.replace(/\\s+/g, ' ').trim() : null,
        fab: !!document.getElementById('ao3tm-fab'),
        tagButtons: document.querySelectorAll('.ao3tm-tag-btn').length,
        menuOpen: !!document.querySelector('.ao3tm-menu'),
        toast: (() => { const t = document.querySelector('.ao3tm-toast.ao3tm-toast-show'); return t ? t.innerText.replace(/\\s+/g,' ').trim() : null; })()
      };
    })()`);

  const shot = async (name) => {
    // headless 合成器偶发卡顿，重试几次；截图失败不影响断言结论
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ART, name + '.png'), Buffer.from(data, 'base64'));
        return;
      } catch (err) {
        if (attempt === 2) {
          console.log('[截图失败] ' + name + ': ' + err.message);
          return;
        }
        await sleep(1200);
      }
    }
  };

  const navigate = async (url) => {
    const once = new Promise((resolve) => {
      const off = cdp.on('Page.loadEventFired', () => {
        off();
        resolve();
      });
      setTimeout(() => {
        off();
        resolve();
      }, 8000);
    });
    await send('Page.navigate', { url });
    await once;
    await sleep(200);
  };

  /* ------------------------------- 开始测试 ------------------------------- */

  await navigate(PAGE_URL);
  await waitFor(`!!document.documentElement && document.documentElement.getAttribute('data-ao3tm-ready') === '1'`, '扩展就绪', 15000);
  await waitFor(`!!document.getElementById('ao3tm-bar')`, '统计条注入', 15000);
  await waitFor(`document.querySelectorAll('li.blurb .ao3tm-tools').length === 5`, '5 张卡片工具条');
  await waitFor(`document.querySelectorAll('.ao3tm-tag-btn').length > 10`, '标签按钮注入');

  // 清掉可能残留的规则（同一 profile 内不会，但保险）
  const state0 = await command('ao3tm:state');
  record('事件桥可用（返回统计）', state0 && !state0.timeout && state0.total === 5, state0);

  let s = await snapshot();
  record('初始状态：5 篇全部可见', s.visible.length === 5 && s.hidden.length === 0, { visible: s.visible, hidden: s.hidden });
  record('统计条 / 悬浮按钮 / 标签按钮存在', !!s.barText && s.fab && s.tagButtons > 10, { bar: s.barText, fab: s.fab, tags: s.tagButtons });
  await shot('01-initial');

  // 场景 1：点标签旁的"屏蔽"按钮
  await evaluate(`document.querySelector('.ao3tm-tag[data-tag="Fluff"] .ao3tm-tag-btn[data-mode="block"]').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 2`, 'Fluff 屏蔽后隐藏 2 篇');
  s = await snapshot();
  record('标签屏蔽：Fluff -> 隐藏 101/103', s.hidden.sort().join(',') === 'work_101,work_103', s.hidden);
  record('被屏蔽标签显示为删除线样式', await evaluate(`document.querySelector('.ao3tm-tag[data-tag="Fluff"]').classList.contains('ao3tm-tag-blocked')`));
  record('隐藏卡片带原因标记', s.flags.length === 2 && /Fluff/.test(s.flags[0]), s.flags);
  record(
    '原因标记可见（CSS 取自 data 属性）',
    await evaluate(`getComputedStyle(document.querySelector('li.blurb.ao3tm-has-flag .ao3tm-flag')).display !== 'none'`)
  );
  await shot('02-tag-blocked');

  // 场景 2：只看模式（点标签的"只看"按钮）
  await evaluate(`document.querySelector('.ao3tm-tag[data-tag="Fluff"] .ao3tm-tag-btn[data-mode="block"]').click()`); // 取消屏蔽
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 0`, '取消屏蔽');
  await evaluate(`document.querySelector('.ao3tm-tag[data-tag="Horror"] .ao3tm-tag-btn[data-mode="allow"]').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 4`, '只看 Horror 后隐藏 4 篇');
  s = await snapshot();
  record('只看模式：仅保留 104', s.visible.join(',') === 'work_104' && s.hidden.length === 4, { visible: s.visible, hidden: s.hidden, bar: s.barText });
  record('统计条说明只看模式过滤数量', /只看/.test(String(s.barText)), s.barText);
  await shot('03-only-mode');
  await evaluate(`document.querySelector('.ao3tm-tag[data-tag="Horror"] .ao3tm-tag-btn[data-mode="allow"]').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 0`, '取消只看');

  // 场景 3：卡片菜单里快捷屏蔽作者
  await evaluate(`document.getElementById('work_101').querySelector('.ao3tm-tool-menu').click()`);
  await waitFor(`!!document.querySelector('.ao3tm-menu')`, '快捷屏蔽菜单');
  s = await snapshot();
  record('菜单打开', s.menuOpen);
  await shot('04-menu');
  await evaluate(`document.querySelector('.ao3tm-menu [data-act="author-block"]').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 2`, '作者屏蔽后隐藏 2 篇');
  s = await snapshot();
  record('作者屏蔽：writer_alpha -> 隐藏 101/104', s.hidden.sort().join(',') === 'work_101,work_104', s.hidden);
  await shot('05-author-blocked');

  // 场景 4：菜单里"屏蔽这篇作品"（作品名单）
  await evaluate(`document.getElementById('work_101').querySelector('.ao3tm-tool-menu').click()`);
  await waitFor(`!!document.querySelector('.ao3tm-menu')`, '菜单再次打开');
  await evaluate(`document.querySelector('.ao3tm-menu [data-act="work"]').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length >= 2`, '屏蔽整篇作品');
  const st = await command('ao3tm:state');
  record('作品写入屏蔽名单', st.counts && st.counts.blockedWorks >= 1, st.counts);

  // 场景 5：卡片"隐藏"按钮 + 撤销提示条
  await evaluate(`document.getElementById('work_102').querySelector('.ao3tm-tool-hide').click()`);
  await waitFor(`!!document.querySelector('.ao3tm-toast.ao3tm-toast-show')`, '提示条出现');
  s = await snapshot();
  record('提示条带撤销按钮', /撤销/.test(String(s.toast)), s.toast);
  await shot('06-toast');
  await evaluate(`document.querySelector('.ao3tm-toast-action').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 2`, '撤销后回到 2 篇');

  // 场景 6：临时显示 / 恢复隐藏（统计条按钮）
  // 先复位：本页可能残留上一次"临时显示"状态，否则开关初始态不可预期
  await command('ao3tm:debug', { revealReset: true });
  await sleep(700);
  await evaluate(`window.dispatchEvent(new CustomEvent('ao3tm:command', { detail: JSON.stringify({ type: 'ao3tm:refresh', id: 'r1' }) }))`);
  await waitFor(`!!document.querySelector('#ao3tm-bar [data-act="reveal"]')`, '临时显示按钮');
  await evaluate(`document.querySelector('#ao3tm-bar [data-act="reveal"]').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 0`, '临时显示生效');
  s = await snapshot();
  record('临时显示：全部恢复可见', s.visible.length === 5, { visible: s.visible, bar: s.barText });
  record('统计条出现"已临时显示"提示', /临时显示/.test(String(s.barText)), s.barText);
  await shot('07-revealed');
  await waitFor(`!!document.querySelector('#ao3tm-bar [data-act="rehide"]')`, '恢复隐藏按钮');
  await evaluate(`document.querySelector('#ao3tm-bar [data-act="rehide"]').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 2`, '恢复隐藏');

  // 场景 6b：右下角悬浮按钮的临时显示开关（点一下开，再点一下关）
  const fabInfo = () =>
    evaluate(`(() => {
      const btn = document.querySelector('.ao3tm-fab-toggle');
      if (!btn) return null;
      return { on: btn.classList.contains('is-on'), title: btn.title };
    })()`);
  await waitFor(`!!document.querySelector('.ao3tm-fab-toggle')`, '悬浮开关存在');
  const hiddenBefore = (await snapshot()).hidden.length;
  let fab = await fabInfo();
  record('悬浮开关初始为关闭态且提示可临时显示', !!fab && fab.on === false && /临时显示/.test(fab.title), fab);

  await evaluate(`document.querySelector('.ao3tm-fab-toggle').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 0`, '悬浮开关：临时显示');
  fab = await fabInfo();
  record('点一下：全部显示且开关变打开态', !!fab && fab.on === true && /恢复隐藏/.test(fab.title), fab);

  await evaluate(`document.querySelector('.ao3tm-fab-toggle').click()`);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === ${hiddenBefore}`, '悬浮开关：恢复隐藏', 8000);
  fab = await fabInfo();
  record('再点一下：能切回隐藏且开关回到关闭态', !!fab && fab.on === false, fab);
  record('开关提示里带上被隐藏的篇数', !!fab && fab.title.indexOf(String(hiddenBefore)) !== -1, fab);

  // 场景 7：规则持久化（重载页面）
  await send('Page.reload', { ignoreCache: true });
  await sleep(1200);
  await waitFor(`!!document.documentElement && document.documentElement.getAttribute('data-ao3tm-ready') === '1'`, '重载后扩展就绪', 15000);
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 2`, '重载后规则仍然生效', 15000);
  s = await snapshot();
  const st2 = await command('ao3tm:state');
  record('持久化：重载后仍隐藏 101/104', s.hidden.sort().join(',') === 'work_101,work_104', s.hidden);
  record('规则统计持久化', st2.counts && st2.counts.blockAuthors === 1 && st2.counts.blockedWorks === 1, st2.counts);
  await shot('08-after-reload');

  // 场景 8：站内设置面板
  await command('ao3tm:panel');
  await waitFor(`!!document.querySelector('.ao3tm-panel-root.is-open')`, '设置面板打开');
  const panelInfo = await evaluate(`(() => {
    const root = document.querySelector('.ao3tm-panel-root');
    return {
      tabs: Array.from(root.querySelectorAll('.ao3tm-tab')).map(n => n.textContent.replace(/\\s+/g,' ').trim()),
      tagBlock: root.querySelector('textarea[data-kind="tag"][data-mode="block"]') ? root.querySelector('textarea[data-kind="tag"][data-mode="block"]').value.trim() : null,
      authorBlock: root.querySelector('textarea[data-kind="author"][data-mode="block"]') ? root.querySelector('textarea[data-kind="author"][data-mode="block"]').value.trim() : null
    };
  })()`);
  record('面板渲染并展示已保存规则', panelInfo.authorBlock === 'writer_alpha' && Array.isArray(panelInfo.tabs) && panelInfo.tabs.length === 4, panelInfo);
  await shot('09-panel-block');

  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="settings"]').click()`);
  await waitFor(`!!document.querySelector('.ao3tm-panel-root [data-setting="seriesMode"]')`, '设置页渲染');
  await shot('10-panel-settings');

  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="works"]').click()`);
  await waitFor(`!!document.querySelector('.ao3tm-panel-root .ao3tm-list-row')`, '作品名单渲染');
  const workRows = await evaluate(`document.querySelectorAll('.ao3tm-panel-root .ao3tm-list-row').length`);
  record('作品名单列出已屏蔽作品', workRows >= 1, workRows);
  await shot('11-panel-works');

  // 场景 9：批量粘贴只看规则
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="only"]').click()`);
  await waitFor(`!!document.querySelector('textarea[data-kind="tag"][data-mode="allow"]')`, '只看页渲染');
  await evaluate(`(() => {
    const ta = document.querySelector('textarea[data-kind="tag"][data-mode="allow"]');
    ta.value = ['Coffee Shop AU', 'Fluff'].join(String.fromCharCode(10));
    document.querySelector('[data-act="save-textarea"][data-kind="tag"][data-mode="allow"]').click();
  })()`);
  await waitFor(`document.querySelector('textarea[data-kind="tag"][data-mode="allow"]').value.split(String.fromCharCode(10)).filter(Boolean).length === 2`, '批量保存只看规则');
  const st3 = await command('ao3tm:state');
  record('批量粘贴写入 2 条只看规则', st3.counts && st3.counts.allowTags === 2, st3.counts);
  const st3b = await command('ao3tm:debug');
  record(
    '批量保存只看不会清掉屏蔽规则',
    st3b.rules.tag.indexOf('block:Fluff') === -1 || st3b.rules.tag.some((r) => /^block:/i.test(r)) || st3b.rules.author.indexOf('block:writer_alpha') !== -1,
    st3b.rules
  );

  // 同一标签同时存在于屏蔽与只看两个列表（回归：早期版本会互相覆盖）
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="block"]').click()`);
  await waitFor(`!!document.querySelector('.ao3tm-panel-root textarea[data-kind="tag"][data-mode="block"]')`, '屏蔽页渲染');
  console.log(
    '[debug] block 保存按钮:',
    await evaluate(`(() => {
      const b = document.querySelector('.ao3tm-panel-root [data-act="save-textarea"][data-kind="tag"][data-mode="block"]');
      return b ? b.outerHTML.slice(0, 120) : 'not found';
    })()`)
  );
  await evaluate(`(() => {
    const area = document.querySelector('.ao3tm-panel-root textarea[data-kind="tag"][data-mode="block"]');
    area.value = ['Angst', 'Fluff'].join(String.fromCharCode(10));
    document.querySelector('.ao3tm-panel-root [data-act="save-textarea"][data-kind="tag"][data-mode="block"]').click();
  })()`);
  await sleep(1200);
  const dbgAfterBlock = await command('ao3tm:debug');
  console.log('[debug] 保存后判定:', JSON.stringify((dbgAfterBlock.blurbs || []).map((b) => b.path + ':b=' + b.blocked + ',o=' + b.only + '|' + (b.reasons[0] ? b.reasons[0].kind + ':' + (b.reasons[0].pattern || '') : ''))));
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length >= 1`, '屏蔽规则写入', 8000);
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="only"]').click()`);
  await waitFor(`!!document.querySelector('.ao3tm-panel-root textarea[data-kind="tag"][data-mode="allow"]')`, '只看页渲染');
  await evaluate(`(() => {
    const area = document.querySelector('.ao3tm-panel-root textarea[data-kind="tag"][data-mode="allow"]');
    area.value = ['Coffee Shop AU', 'Fluff'].join(String.fromCharCode(10));
    document.querySelector('.ao3tm-panel-root [data-act="save-textarea"][data-kind="tag"][data-mode="allow"]').click();
  })()`);
  await sleep(1500);
  const st3c = await command('ao3tm:state');
  record('同一标签可同时存在于屏蔽与只看列表', st3c.counts.blockTags === 2 && st3c.counts.allowTags === 2, st3c.counts);
  s = await snapshot();
  // 屏蔽规则优先：101/103 命中 Fluff 屏蔽、102/104/105 不在只看列表，因此全部隐藏
  record('屏蔽优先于只看：同时命中两个列表也隐藏', s.hidden.length === 5, { hidden: s.hidden, visible: s.visible });
  await shot('12b-both-lists');

  // 只看 + 屏蔽叠加：作者仍在屏蔽名单时必须拦住命中只看规则的 101
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="only"]').click()`);
  await waitFor(`!!document.querySelector('.ao3tm-panel-root textarea[data-kind="tag"][data-mode="allow"]')`, '只看页渲染');
  await evaluate(`(() => {
    const area = document.querySelector('.ao3tm-panel-root textarea[data-kind="tag"][data-mode="allow"]');
    area.value = ['Coffee Shop AU', 'Fluff'].join(String.fromCharCode(10));
    document.querySelector('.ao3tm-panel-root [data-act="save-textarea"][data-kind="tag"][data-mode="allow"]').click();
  })()`);
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="block"]').click()`);
  await waitFor(`!!document.querySelector('.ao3tm-panel-root textarea[data-kind="tag"][data-mode="block"]')`, '回到屏蔽页');
  await evaluate(`(() => {
    const area = document.querySelector('.ao3tm-panel-root textarea[data-kind="tag"][data-mode="block"]');
    area.value = 'Angst';
    document.querySelector('.ao3tm-panel-root [data-act="save-textarea"][data-kind="tag"][data-mode="block"]').click();
  })()`);
  await sleep(1200);
  const st4 = await command('ao3tm:state');
  record('恢复为「屏蔽 Angst + 只看 Fluff/Coffee Shop AU」', st4.counts.blockTags === 1 && st4.counts.allowTags === 2, st4.counts);
  const reverseButtons = await evaluate(`Array.from(document.querySelectorAll('.ao3tm-panel-root [data-act="toggle-mode"]')).map(b => b.getAttribute('data-kind') + ':' + b.getAttribute('data-pattern')).join(',')`);
  record('屏蔽页反向区列出「只看」规则（两个模式互不覆盖）', reverseButtons === 'tag:Coffee Shop AU,tag:Fluff', reverseButtons);

  // 一键把「只看 Coffee Shop AU」切成屏蔽
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="toggle-mode"][data-pattern="Coffee Shop AU"]').click()`);
  await sleep(1200);
  const st5 = await command('ao3tm:state');
  record('一键切换：只看 Coffee Shop AU -> 屏蔽', st5.counts.blockTags === 2 && st5.counts.allowTags === 1, st5.counts);
  await sleep(1500);
  // 切换后：屏蔽 Angst + Coffee Shop AU，只看 Fluff；作者屏蔽与手动屏蔽仍在
  // => 102(Angst) 103(Coffee Shop AU) 104/101(作者) 105(不在只看列表) 全部隐藏
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length === 5`, '切换后全部隐藏', 12000);
  s = await snapshot();
  record('切换后：屏蔽优先，5 篇全部隐藏', s.hidden.length === 5, { hidden: s.hidden, visible: s.visible });
  await shot('13-toggle-mode');

  // 只看列表里加上作者，验证作者规则也能参与只看
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="only"]').click()`);
  await waitFor(`!!document.querySelector('.ao3tm-panel-root [data-act="toggle-mode"][data-kind="author"]')`, '只看页反向区出现作者屏蔽规则');
  record(
    '只看页反向区列出作者屏蔽规则',
    (await evaluate(`Array.from(document.querySelectorAll('.ao3tm-panel-root [data-act="toggle-mode"]')).map(b => b.getAttribute('data-kind') + ':' + b.getAttribute('data-pattern')).join(',')`)).indexOf('author:writer_alpha') !== -1
  );
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="toggle-mode"][data-kind="author"]').click()`);
  await sleep(1500);
  s = await snapshot();
  // 作者进入只看列表后：103(Fluff) 与 104(writer_alpha) 保留；101 仍在手动屏蔽名单里
  record('作者加入只看：104 恢复可见', s.visible.indexOf('work_104') !== -1, { visible: s.visible, hidden: s.hidden });
  const st6 = await command('ao3tm:state');
  record('作者规则已切到只看', st6.counts.allowAuthors === 1 && st6.counts.blockAuthors === 0, st6.counts);

  // 场景 10：设置项开关（忽略大小写）
  await command('ao3tm:panel');
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="settings"]').click()`);
  await waitFor(`!!document.querySelector('[data-setting="caseInsensitive"]')`, '设置项存在');
  record('设置项齐全', await evaluate(`['blockTags','blockAuthors','onlyTags','onlyAuthors','caseInsensitive','fuzzy','dim','showBar','showQuickButtons','showTagButtons','seriesMode'].every(k => !!document.querySelector('[data-setting="' + k + '"]'))`));
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);

  // 场景 11：真实鼠标点击（Input 域事件，验证按钮真的可点）
  await command('ao3tm:refresh');
  await sleep(400);
  const rect = await evaluate(`(() => {
    const b = document.querySelector('.ao3tm-tag[data-tag="Mystery"] .ao3tm-tag-btn[data-mode="allow"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (rect) {
    const before = await command('ao3tm:state');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await sleep(900);
    const after = await command('ao3tm:state');
    record(
      '真实鼠标点击：只看 Mystery 写入规则（+1）',
      after.counts && after.counts.allowTags === before.counts.allowTags + 1,
      { before: before.counts.allowTags, after: after.counts.allowTags }
    );
    await shot('13-real-click');
  } else {
    record('真实鼠标点击 : 找到 Mystery 标签按钮', false, null);
  }

  // 场景 12：右键标签 / 作品 / 作者（原生右键菜单 + 动态标题）
  let swSessionId = null;
  // MV3 的 service worker 空闲会被回收；这里显式唤醒并等它就绪
  const ensureServiceWorker = async () => {
    const { targetInfos } = await cdp.send('Target.getTargets');
    let sw = targetInfos.find((t) => t.url.endsWith('/src/background.js'));
    if (!sw && extensionId) {
      await cdp.send('Target.createTarget', { url: 'chrome-extension://' + extensionId + '/src/background.js' }).catch(() => {});
      for (let i = 0; i < 20 && !sw; i++) {
        await sleep(200);
        const infos = (await cdp.send('Target.getTargets')).targetInfos;
        sw = infos.find((t) => t.url.endsWith('/src/background.js'));
      }
    }
    if (!sw) return null;
    if (sw.targetId !== swTargetId || !swSessionId) {
      swTargetId = sw.targetId;
      swSessionId = (await cdp.send('Target.attachToTarget', { targetId: sw.targetId, flatten: true })).sessionId;
      await cdp.send('Runtime.enable', {}, swSessionId);
      await sleep(300);
    }
    return sw.targetId;
  };

  const swEval = async (expression, retry) => {
    const target = await ensureServiceWorker();
    if (!target) return { error: 'no-service-worker' };
    try {
      const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, swSessionId);
      if (r.exceptionDetails) return { error: (r.exceptionDetails.exception || {}).description };
      return r.result.value;
    } catch (err) {
      if (!retry) {
        swSessionId = null;
        return swEval(expression, true);
      }
      throw err;
    }
  };

  const rightClick = async (selector, textFilter) => {
    const rect = await evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const node = ${textFilter ? `nodes.filter(n => n.textContent.trim() === ${JSON.stringify(textFilter)})[0]` : 'nodes[0]'};
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x + Math.min(r.width / 2, 12)), y: Math.round(r.y + r.height / 2) };
    })()`);
    if (!rect) return false;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'right', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'right', clickCount: 1 });
    await sleep(400);
    return true;
  };

  const contextAction = (action) => command('ao3tm:context-action', { action: action });
  const menuRegistered = (id) =>
    swEval(`new Promise(resolve => chrome.contextMenus.update(${JSON.stringify(id)}, { title: 'probe' }, () => resolve(chrome.runtime.lastError ? 'missing' : 'ok')))`);
  const menuSnapshot = () => command('ao3tm:debug').then((d) => d.contextMenu);
  /** 点击页内右键菜单里的某个动作 */
  const clickMenuAction = (act) =>
    evaluate(`(() => {
      const btn = document.querySelector('.ao3tm-menu button[data-act=${JSON.stringify(act)}]');
      if (!btn) return false;
      btn.click();
      return true;
    })()`);

  // 先归零：走内容脚本的 store.clearAll（service worker 可能已休眠，不依赖它写存储）
  await command('ao3tm:debug', { clear: true });
  await sleep(1000);
  const afterClear = await command('ao3tm:state');
  record(
    '右键场景前已清空规则',
    afterClear.counts.blockTags === 0 &&
      afterClear.counts.blockedWorks === 0 &&
      afterClear.counts.blockAuthors === 0 &&
      afterClear.counts.allowTags === 0,
    afterClear.counts
  );

  // 12.1 右键标签 -> 页内菜单直接操作
  const freeTag = await evaluate(`(() => {
    const used = Array.from(document.querySelectorAll('.ao3tm-tag[data-tag]')).map(n => n.getAttribute('data-tag'));
    const known = new Set(['Fluff', 'Angst', 'Coffee Shop AU', 'Mystery', 'writer_alpha']);
    return used.filter(t => !known.has(t) && !/^writer_/.test(t))[0] || used[0];
  })()`);
  const tagRect = await evaluate(`(() => {
    const all = Array.from(document.querySelectorAll('.ao3tm-tag[data-tag]')).filter(n => n.getAttribute('data-tag') === ${JSON.stringify(freeTag)});
    const node = all[all.length - 1];
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: Math.round(r.x + Math.min(r.width / 2, 10)), y: Math.round(r.y + r.height / 2) };
  })()`);
  let okTag = false;
  if (tagRect) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: tagRect.x, y: tagRect.y, button: 'right', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tagRect.x, y: tagRect.y, button: 'right', clickCount: 1 });
    await sleep(500);
    okTag = true;
  }
  const afterRightClick = await command('ao3tm:debug');
  const hitTag = afterRightClick.contextHit;
  const tagMenu = afterRightClick.contextMenu;
  record(
    '右键标签：识别出标签名',
    okTag && !!hitTag && hitTag.kind === 'tag' && hitTag.tag === freeTag,
    { hit: hitTag, expected: freeTag }
  );
  record(
    '右键标签：当场弹出菜单，标题是该标签且带屏蔽/只看项',
    !!tagMenu &&
      tagMenu.label.trim() === freeTag &&
      tagMenu.actions.indexOf('tag-block') !== -1 &&
      tagMenu.actions.indexOf('tag-only') !== -1 &&
      !!tagMenu.iconSize &&
      tagMenu.iconSize.w === 14 &&
      tagMenu.iconSize.h === 14,
    tagMenu
  );

  const beforeTag = await command('ao3tm:state');
  const clickedBlock = await clickMenuAction('tag-block');
  await sleep(1000);
  const afterTagBlock = await command('ao3tm:state');
  record(
    '点菜单「屏蔽」写入屏蔽规则（+1）',
    clickedBlock && afterTagBlock.counts.blockTags === beforeTag.counts.blockTags + 1,
    { clicked: clickedBlock, before: beforeTag.counts.blockTags, after: afterTagBlock.counts.blockTags, tag: freeTag }
  );
  await waitFor(`document.querySelectorAll('li.blurb.ao3tm-hidden').length >= 1`, '右键屏蔽后列表生效', 8000);
  await shot('17-context-tag');

  // 再右键一次，点「只看」
  if (tagRect) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: tagRect.x, y: tagRect.y, button: 'right', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tagRect.x, y: tagRect.y, button: 'right', clickCount: 1 });
    await sleep(500);
  }
  const clickedOnly = await clickMenuAction('tag-only');
  await sleep(900);
  const afterTagOnly = await command('ao3tm:state');
  record(
    '点菜单「只看」写入只看规则（+1）',
    clickedOnly && afterTagOnly.counts.allowTags === beforeTag.counts.allowTags + 1,
    { clicked: clickedOnly, before: beforeTag.counts.allowTags, after: afterTagOnly.counts.allowTags }
  );
  // 12.6 原生菜单只保留：选中文字 + 打开设置
  record(
    '原生菜单保留选中文字与打开设置',
    (await menuRegistered('ao3tm-sel-block')) === 'ok' &&
      (await menuRegistered('ao3tm-sel-only')) === 'ok' &&
      (await menuRegistered('ao3tm-open-panel')) === 'ok'
  );

  // 12.2 右键作者名 -> 菜单里的作者行
  const okAuthor = await rightClick('a[href*="/users/"]', 'writer_beta');
  const authorDebug = await command('ao3tm:debug');
  const hitAuthor = authorDebug.contextHit;
  const authorMenu = authorDebug.contextMenu;
  record('右键作者：识别为作者', !!okAuthor && !!hitAuthor && hitAuthor.kind === 'author' && hitAuthor.author === 'writer_beta', hitAuthor);
  record(
    '右键作者：菜单只给该作者的快捷操作',
    !!authorMenu && authorMenu.actions.indexOf('author-block') !== -1 && authorMenu.rows.indexOf('writer_beta') !== -1,
    authorMenu
  );
  const beforeAuthor = (await command('ao3tm:state')).counts.blockAuthors;
  const clickedAuthor = await clickMenuAction('author-block');
  await sleep(900);
  const afterAuthor = (await command('ao3tm:state')).counts.blockAuthors;
  record('点菜单屏蔽作者写入作者规则（+1）', clickedAuthor && afterAuthor === beforeAuthor + 1, { before: beforeAuthor, after: afterAuthor });

  // 12.3 右键作品标题：加入 -> 再右键移出
  const okWork = await rightClick('li.blurb h4.heading a');
  const workDebug = await command('ao3tm:debug');
  const hitWork = workDebug.contextHit;
  record('右键作品：识别为作品', !!okWork && !!hitWork && hitWork.kind === 'work' && !!hitWork.path, hitWork);
  const workPath = hitWork && hitWork.path;
  const beforeWorks = (await command('ao3tm:state')).counts.blockedWorks;
  const clickedWork = await clickMenuAction('work');
  await sleep(900);
  const midWorks = (await command('ao3tm:state')).counts.blockedWorks;
  record('点菜单屏蔽整篇作品写入名单（+1）', clickedWork && midWorks === beforeWorks + 1, { before: beforeWorks, after: midWorks });
  await rightClick('li.blurb h4.heading a');
  await clickMenuAction('work');
  await sleep(900);
  const finalWorks = (await command('ao3tm:state')).counts.blockedWorks;
  record('再右键一次可移出屏蔽名单（-1）', finalWorks === beforeWorks, { before: beforeWorks, after: finalWorks, path: workPath });

  // 12.5 右键普通空白处：不弹页内菜单，也不误判
  const blank = await evaluate(`(() => {
    const el = document.getElementById('header') || document.body;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + 20), y: Math.round(r.y + 10) };
  })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: blank.x, y: blank.y, button: 'right', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: blank.x, y: blank.y, button: 'right', clickCount: 1 });
  await sleep(300);
  const blankDebug = await command('ao3tm:debug');
  record('右键空白处：不误判为标签，也不弹页内菜单', !!blankDebug.contextHit && blankDebug.contextHit.kind !== 'tag' && !blankDebug.contextMenu, {
    hit: blankDebug.contextHit,
    menu: blankDebug.contextMenu
  });

  // 12.6 原生菜单只保留：选中文字 + 打开设置
  record(
    '原生菜单保留选中文字与打开设置',
    (await menuRegistered('ao3tm-sel-block')) === 'ok' &&
      (await menuRegistered('ao3tm-sel-only')) === 'ok' &&
      (await menuRegistered('ao3tm-open-panel')) === 'ok'
  );

  // 12.7 规则编辑器：把误粘成一条的标签拆开
  await command('ao3tm:debug', { clear: true });
  await sleep(600);
  await command('ao3tm:context-action', { action: 'tag-block' }); // 先准备一个右键目标
  await evaluate(`(() => {
    // 直接塞一条"粘在一起"的坏规则，模拟旧版本存下的数据
    window.dispatchEvent(new CustomEvent('ao3tm:command', { detail: JSON.stringify({ type: 'ao3tm:debug', id: 'seed' }) }));
    return true;
  })()`);
  await evaluate(`(() => {
    const ta = document.querySelector('.ao3tm-panel-root textarea[data-kind="tag"][data-mode="block"]');
    return !!ta;
  })()`);
  await command('ao3tm:panel');
  await evaluate(`(() => {
    const tab = document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="block"]');
    if (tab) tab.click();
    return true;
  })()`);
  await sleep(400);
  const splitResult = await evaluate(`(() => {
    return new Promise((resolve) => {
      const area = document.querySelector('.ao3tm-panel-root textarea[data-kind="tag"][data-mode="block"]');
      if (!area) { resolve({ error: 'no-textarea' }); return; }
      area.value = 'Major Character DeathLuminescence/The ChariotGino (Phigros)';
      document.querySelector('.ao3tm-panel-root [data-act="save-textarea"][data-kind="tag"][data-mode="block"]').click();
      resolve({ ok: true });
    });
  })()`);
  await sleep(800);
  const chipsBefore = await evaluate(`document.querySelectorAll('.ao3tm-panel-root .ao3tm-chip-edit').length`);
  const editorOpened = await evaluate(`(() => {
    const chip = Array.from(document.querySelectorAll('.ao3tm-panel-root .ao3tm-chip-edit')).filter(c => /Luminescence/.test(c.textContent))[0];
    if (!chip) return false;
    chip.click();
    return true;
  })()`);
  await sleep(400);
  const editorFilled = await evaluate(`(() => {
    const box = document.querySelector('.ao3tm-rule-editor');
    if (!box) return null;
    const ta = box.querySelector('textarea');
    ta.value = 'Major Character Death\\nLuminescence/The Chariot\\nGino (Phigros)';
    box.querySelector('[data-act="editor-save"]').click();
    return { value: ta.value };
  })()`);
  await sleep(900);
  const afterSplit = await command('ao3tm:debug');
  record(
    '规则编辑器：把粘成一条的规则拆成多条',
    splitResult.ok === true &&
      editorOpened === true &&
      !!editorFilled &&
      afterSplit.counts.blockTags === 3 &&
      afterSplit.rules.tag.filter((r) => /Luminescence/.test(r)).length === 1 &&
      afterSplit.rules.tag.filter((r) => /^block:Gino \(Phigros\)$/.test(r)).length === 1,
    { chipsBefore: chipsBefore, counts: afterSplit.counts, rules: afterSplit.rules.tag }
  );
  await shot('18-rule-editor');
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);

  // 收尾：清掉右键/编辑器场景写入的规则
  await command('ao3tm:debug', { clear: true });
  await sleep(600);

  // 场景 13：扩展弹窗（action popup）
  if (extensionId) {
    const popupTarget = await cdp.send('Target.createTarget', { url: 'chrome-extension://' + extensionId + '/src/popup/popup.html' });
    const popupSession = (await cdp.send('Target.attachToTarget', { targetId: popupTarget.targetId, flatten: true })).sessionId;
    const popupEval = async (expression) => {
      const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, popupSession);
      if (r.exceptionDetails) return { exception: (r.exceptionDetails.exception || {}).description };
      return r.result.value;
    };
    await cdp.send('Runtime.enable', {}, popupSession);
    cdp.on('Runtime.consoleAPICalled', (params, session) => {
      if (session && session !== popupSession) return;
      console.log('[弹窗日志]', (params.args || []).map((a) => a.value || a.description || a.type).join(' '));
    });
    cdp.on('Runtime.exceptionThrown', (params, session) => {
      if (session && session !== popupSession) return;
      const d = params.exceptionDetails || {};
      console.log('[弹窗异常]', d.text, (d.exception || {}).description, d.url + ':' + d.lineNumber);
    });
    // 按真实 action popup 的尺寸测量
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 480, height: 580, deviceScaleFactor: 1, mobile: false }, popupSession);
    await sleep(1500);

    // 弹窗布局：面板必须铺满可用高度，标签页与表单不能被裁掉
    const layout = await popupEval(`(() => {
      const root = document.querySelector('.ao3tm-panel-root');
      const panel = document.querySelector('.ao3tm-panel');
      const tabs = document.querySelector('.ao3tm-panel-tabs');
      const body = document.querySelector('.ao3tm-panel-body');
      const ta = document.querySelector('textarea[data-kind="tag"][data-mode="block"]');
      const r = (n) => (n ? n.getBoundingClientRect() : null);
      const vh = window.innerHeight;
      return {
        viewport: { w: window.innerWidth, h: vh },
        panel: r(panel) && { top: Math.round(r(panel).top), bottom: Math.round(r(panel).bottom), height: Math.round(r(panel).height) },
        tabs: r(tabs) && { top: Math.round(r(tabs).top), bottom: Math.round(r(tabs).bottom) },
        textarea: r(ta) && { top: Math.round(r(ta).top), height: Math.round(r(ta).height), bg: getComputedStyle(ta).backgroundColor, color: getComputedStyle(ta).color },
        bodyScroll: body ? body.scrollHeight > body.clientHeight : false,
        docScroll: document.documentElement.scrollHeight > window.innerHeight + 1
      };
    })()`);
    const popupInfo = await popupEval(`(() => ({
      tabs: Array.from(document.querySelectorAll('.ao3tm-tab')).map(n => n.textContent.trim()),
      hasTextarea: !!document.querySelector('textarea[data-kind="tag"][data-mode="block"]'),
      foot: Array.from(document.querySelectorAll('.ao3tm-popup-foot button')).map(n => n.textContent.trim()),
      site: (document.getElementById('site-state') || {}).textContent
    }))()`);
    record(
      '扩展弹窗渲染出规则面板',
      popupInfo && popupInfo.tabs && popupInfo.tabs.length === 4 && popupInfo.hasTextarea,
      popupInfo
    );
    record(
      '弹窗布局：面板撑满视口，标签页与表单都在可视区内',
      !!layout.panel && layout.panel.top <= 1 && layout.panel.bottom >= layout.viewport.h - 2 &&
        !!layout.tabs && layout.tabs.top >= 0 &&
        !!layout.textarea && layout.textarea.top > layout.tabs.bottom && layout.textarea.height >= 80,
      layout
    );
    record(
      '弹窗表单可读：浅色底 + 深色字（对比明显）',
      layout.textarea && layout.textarea.color !== layout.textarea.bg,
      layout.textarea
    );
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 600, deviceScaleFactor: 1, mobile: false }, popupSession);
    await sleep(500);
    const narrow = await popupEval(`(() => {
      const tabs = document.querySelector('.ao3tm-panel-tabs');
      const addRow = document.querySelector('.ao3tm-add-row');
      return {
        tabsWrapped: tabs ? tabs.getBoundingClientRect().height > 40 : false,
        addRowWidth: addRow ? Math.round(addRow.getBoundingClientRect().width) : 0,
        docOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    })()`);
    record('窄弹窗（400px）不出现横向溢出', narrow.docOverflowX === false, narrow);
    // 截图仍在 480x580 下拍，贴近真实弹窗
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 480, height: 580, deviceScaleFactor: 1, mobile: false }, popupSession);
    await sleep(400);
    const popupShot = await cdp.send('Page.captureScreenshot', { format: 'png' }, popupSession);
    fs.writeFileSync(path.join(ART, '14-popup.png'), Buffer.from(popupShot.data, 'base64'));
    await cdp.send('Target.closeTarget', { targetId: popupTarget.targetId });
  }

  // 场景 13：深色页面下的可读性（扩展按页面实际背景亮度判定，不依赖皮肤类名）
  await evaluate(`(() => {
    let s = document.getElementById('ao3tm-test-dark');
    if (!s) { s = document.createElement('style'); s.id = 'ao3tm-test-dark'; document.head.appendChild(s); }
    s.textContent = 'html,body,#main{background:#141414 !important;color:#e6e6e6 !important}';
    return true;
  })()`);
  await command('ao3tm:panel');
  await sleep(300);
  // 主题由扩展实测背景色决定，改写样式后触发一次刷新（真实场景有 2 秒兜底轮询）
  await command('ao3tm:refresh');
  await waitFor(`document.documentElement.getAttribute('data-ao3tm-theme') === 'dark'`, '识别为深色页面', 8000);
  // 面板会记住上次停留的标签页，这里切回屏蔽规则再取输入框
  await evaluate(`(() => {
    const btn = document.querySelector('.ao3tm-panel-root [data-act="tab"][data-tab="block"]');
    if (btn) btn.click();
  })()`);
  await sleep(500);
  const nightDebug = await evaluate(`(() => {
    const root = document.querySelector('.ao3tm-panel-root');
    return {
      hasRoot: !!root,
      isOpen: root ? root.classList.contains('is-open') : false,
      textareas: root ? Array.from(root.querySelectorAll('textarea')).map(t => t.getAttribute('data-kind') + '/' + t.getAttribute('data-mode')) : [],
      activeTab: root && root.querySelector('.ao3tm-tab.is-active') ? root.querySelector('.ao3tm-tab.is-active').textContent.trim() : null,
      hints: root ? root.querySelectorAll('.ao3tm-hint').length : 0
    };
  })()`);
  record('夜间模式下能打开面板并渲染表单', nightDebug.hasRoot && nightDebug.isOpen && nightDebug.textareas.length > 0, nightDebug);
  const nightStyle = await evaluate(`(() => {
    const root = document.querySelector('.ao3tm-panel-root');
    if (!root) return null;
    const panel = root.querySelector('.ao3tm-panel');
    const ta = root.querySelector('textarea');
    const hint = root.querySelector('.ao3tm-hint');
    const cs = (n) => {
      if (!n) return null;
      const s = getComputedStyle(n);
      return { bg: s.backgroundColor, color: s.color };
    };
    return { panel: cs(panel), textarea: cs(ta), hint: cs(hint) };
  })()`);
  const contrastOk = (pair) => {
    if (!pair || !pair.bg || !pair.color) return 0;
    const parse = (c) => (c.match(/\d+/g) || [255, 255, 255]).map(Number).slice(0, 3);
    const lum = (rgb) => {
      const f = rgb.map((v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
    };
    const a = lum(parse(pair.bg));
    const b = lum(parse(pair.color));
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  };
  const nightRatios = nightStyle
    ? {
        panel: Number(contrastOk(nightStyle.panel).toFixed(2)),
        textarea: Number(contrastOk(nightStyle.textarea).toFixed(2)),
        hint: Number(contrastOk(nightStyle.hint).toFixed(2))
      }
    : null;
  const panelBgIsDark = (() => {
    const m = String((nightStyle && nightStyle.panel && nightStyle.panel.bg) || '').match(/\d+/g);
    if (!m) return false;
    const [r, g, b] = m.map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.3;
  })();
  record(
    '深色页面：面板与输入框自动变深色且对比度 >= 4.5',
    !!nightRatios && nightRatios.panel >= 4.5 && nightRatios.textarea >= 4.5 && panelBgIsDark,
    { ratios: nightRatios, colors: nightStyle, panelBgIsDark: panelBgIsDark }
  );
  await evaluate(`document.querySelector('.ao3tm-panel-root [data-act="close"]').click()`);
  await evaluate(`(() => { const s = document.getElementById('ao3tm-test-dark'); if (s) s.remove(); return true; })()`);

  console.log('\n===== 结果 =====');
  const failed = results.filter((r) => !r.ok);
  console.log(results.length - failed.length + '/' + results.length + ' 通过');
  if (failed.length) {
    console.log('失败项:');
    failed.forEach((f) => console.log('  - ' + f.name + ' :: ' + JSON.stringify(f.detail)));
  }
  fs.writeFileSync(path.join(ART, 'results.json'), JSON.stringify(results, null, 2));
  cleanup();
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('测试异常: ' + (err && err.stack ? err.stack : err));
  process.exit(2);
});
