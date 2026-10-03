/* AO3 标签管家 —— service worker
   职责：
     1. 右键菜单：选中文字「屏蔽 / 只看」+「打开规则设置…」
        （标签 / 作品 / 作者的右键快捷操作由内容脚本直接弹页内菜单，避免菜单时序问题）
     2. 镜像站：按已启用域名动态注册内容脚本（权限由内容脚本或弹窗申请） */

/* 公共模块在页面侧是普通脚本（挂在 AO3TM 上），在 service worker 里是 ES 模块。
   注意：MV3 的 service worker 禁止动态 import()，必须静态导入；
   而内容脚本又禁止 ESM 语法，所以共享逻辑放在 env-core.js / mirrors.js，
   用 env.mjs / mirrors.mjs 这两个薄包装给 service worker 用。 */
import { AO3TM } from './lib/env.mjs';
import './lib/mirrors.mjs';

const READY = Promise.resolve(AO3TM || self.AO3TM || null);
const MENU = {
  selBlock: 'ao3tm-sel-block',
  selOnly: 'ao3tm-sel-only',
  openPanel: 'ao3tm-open-panel'
};

const STORAGE_KEY = 'ao3tm_state_v1';
const STATIC_PATTERNS = ['https://archiveofourown.org/*', 'http://127.0.0.1/*', 'http://localhost/*', 'file:///*'];

/* -------------------------------- 右键菜单 -------------------------------- */
async function menuPatterns() {
  const mod = await READY;
  const env = mod && mod.env;
  if (!env) return STATIC_PATTERNS;
  let enabled = [];
  try {
    enabled = await mod.mirrors.listEnabled();
  } catch (err) {
    enabled = [];
  }
  const patterns = STATIC_PATTERNS.concat(
    env.PRESET_MIRRORS.reduce(function (acc, host) {
      return acc.concat(env.hostToMatchPatterns ? env.hostToMatchPatterns(host) : [env.hostToMatchPattern(host)]);
    }, []),
    enabled.reduce(function (acc, host) {
      return acc.concat(env.hostToMatchPatterns ? env.hostToMatchPatterns(host) : [env.hostToMatchPattern(host)]);
    }, [])
  );
  return patterns.filter(function (item, index) {
    return patterns.indexOf(item) === index;
  });
}

function create(id, patterns, props) {
  chrome.contextMenus.create(Object.assign({ id: id, documentUrlPatterns: patterns }, props), function () {
    void chrome.runtime.lastError;
  });
}

async function buildMenus() {
  const patterns = await menuPatterns();
  chrome.contextMenus.removeAll(function () {
    void chrome.runtime.lastError;
    create(MENU.selBlock, patterns, {
      title: '标签管家：屏蔽选中文字「%s」',
      contexts: ['selection'],
      visible: true
    });
    create(MENU.selOnly, patterns, {
      title: '标签管家：只看选中文字「%s」',
      contexts: ['selection'],
      visible: true
    });
    create(MENU.openPanel, patterns, { title: '标签管家：打开规则设置…', contexts: ['all'], visible: true });
  });
}

/* ------------------------------- 镜像站注册 ------------------------------- */

async function syncMirrors() {
  const mod = await READY;
  try {
    if (mod && mod.mirrors) await mod.mirrors.sync();
  } catch (err) {
    console.error('[AO3 标签管家] 同步镜像站失败', err);
  }
}

async function enableMirror(host) {
  const mod = await READY;
  if (!mod || !mod.mirrors || !host) return { ok: false, reason: 'unsupported' };
  try {
    const result = await mod.mirrors.enable(host);
    if (result && result.ok) buildMenus();
    return result;
  } catch (err) {
    return { ok: false, reason: String(err && err.message ? err.message : err) };
  }
}

async function disableMirror(host) {
  const mod = await READY;
  if (!mod || !mod.mirrors || !host) return { ok: false, reason: 'unsupported' };
  try {
    const result = await mod.mirrors.disable(host);
    buildMenus();
    return result;
  } catch (err) {
    return { ok: false, reason: String(err && err.message ? err.message : err) };
  }
}

/* -------------------------------- 生命周期 -------------------------------- */

chrome.runtime.onInstalled.addListener(function (details) {
  buildMenus();
  syncMirrors();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'https://archiveofourown.org/' });
  }
});

chrome.runtime.onStartup.addListener(function () {
  buildMenus();
  syncMirrors();
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || typeof message.type !== 'string') return undefined;
  if (message.type === 'ao3tm:save-mirror') {
    // 权限已在调用方申请（内容脚本的点击 / 弹窗的点击都带用户手势）
    enableMirror(message.host).then(sendResponse);
    return true;
  }
  if (message.type === 'ao3tm:remove-mirror') {
    disableMirror(message.host).then(sendResponse);
    return true;
  }
  if (message.type === 'ao3tm:mirror-enable-for-test' || message.type === 'ao3tm:mirror-disable-for-test') {
    // 测试用：跳过权限弹窗，但注册/注销走真实链路
    const method = message.type === 'ao3tm:mirror-enable-for-test' ? 'enableForTest' : 'disableForTest';
    READY.then(function (mod) {
      if (!mod || !mod.mirrors || !mod.mirrors[method]) {
        sendResponse({ ok: false, reason: 'unsupported' });
        return;
      }
      mod.mirrors[method](message.host)
        .then(function (result) {
          buildMenus();
          sendResponse(result);
        })
        .catch(function (err) {
          sendResponse({ ok: false, reason: String(err && err.message ? err.message : err) });
        });
    });
    return true;
  }
  if (message.type === 'ao3tm:mirror-debug') {
    // 给自动化测试用：回报动态注册的实际内容
    Promise.all([READY, new Promise(function (resolve) {
      chrome.scripting.getRegisteredContentScripts({ ids: [self.AO3TM && self.AO3TM.mirrors ? self.AO3TM.mirrors.SCRIPT_ID : 'ao3tm-mirror'] }, function (scripts) {
        void chrome.runtime.lastError;
        resolve(scripts || []);
      });
    })]).then(function (results) {
      const mod = results[0];
      const scripts = results[1];
      sendResponse({
        ok: true,
        registered: scripts.map(function (s) {
          return { id: s.id, matches: s.matches, js: s.js.length, persist: s.persistAcrossSessions };
        }),
        enabled: mod && mod.mirrors ? 'pending' : null
      });
    });
    return true;
  }
  if (message.type === 'ao3tm:mirror-status') {
    READY.then(function (mod) {
      if (!mod || !mod.mirrors) {
        sendResponse({ ok: false });
        return;
      }
      mod.mirrors.overview().then(function (rows) {
        sendResponse({ ok: true, rows: rows });
      });
    });
    return true;
  }
  return undefined;
});

/* ------------------------------- 选中文字的快捷屏蔽 ------------------------------- */

function writeRule(text, mode) {
  chrome.storage.local.get(STORAGE_KEY, function (items) {
    const state = items[STORAGE_KEY] || {};
    const rules = state.rules || (state.rules = {});
    const kinds = rules.tag || (rules.tag = {});
    const bucket = kinds[mode] || (kinds[mode] = {});
    bucket[text.toLowerCase()] = {
      key: text.toLowerCase(),
      pattern: text,
      mode: mode,
      caseSensitive: false,
      ts: Date.now()
    };
    state.revision = (Number(state.revision) || 0) + 1;
    chrome.storage.local.set({ [STORAGE_KEY]: state }, function () {
      void chrome.runtime.lastError;
    });
  });
}

function askTab(tabId, message) {
  return new Promise(function (resolve) {
    if (tabId == null) {
      resolve(null);
      return;
    }
    chrome.tabs.sendMessage(tabId, message, function (response) {
      void chrome.runtime.lastError;
      resolve(response || null);
    });
  });
}

chrome.contextMenus.onClicked.addListener(function (info) {
  const tabId = info.tab && info.tab.id;

  if (info.menuItemId === MENU.selBlock || info.menuItemId === MENU.selOnly) {
    const text = String(info.selectionText || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    writeRule(text, info.menuItemId === MENU.selOnly ? 'allow' : 'block');
    askTab(tabId, { type: 'ao3tm:refresh' });
    return;
  }

  if (info.menuItemId === MENU.openPanel) {
    askTab(tabId, { type: 'ao3tm:panel' });
  }
});

// service worker 被回收后重新拉起时，菜单可能已经不存在，这里补一次
buildMenus();
syncMirrors();
