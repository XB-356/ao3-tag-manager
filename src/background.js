/* AO3 标签管家 —— service worker
   右键菜单只保留两件事：
     1. 任意位置「打开规则设置…」
     2. 选中文字「屏蔽 / 只看选中文字」
   标签 / 作品 / 作者的右键快捷操作由内容脚本直接弹页内菜单完成，
   不依赖 service worker 唤醒与 contextMenus.update 的时序（MV3 下很容易赶不上菜单弹出）。 */

const MENU = {
  selBlock: 'ao3tm-sel-block',
  selOnly: 'ao3tm-sel-only',
  openPanel: 'ao3tm-open-panel'
};

const STORAGE_KEY = 'ao3tm_state_v1';
const URL_PATTERNS = ['https://archiveofourown.org/*', 'http://127.0.0.1/*', 'http://localhost/*'];

function create(id, props) {
  chrome.contextMenus.create(Object.assign({ id: id, documentUrlPatterns: URL_PATTERNS }, props), function () {
    void chrome.runtime.lastError;
  });
}

function buildMenus() {
  chrome.contextMenus.removeAll(function () {
    void chrome.runtime.lastError;
    create(MENU.selBlock, {
      title: '标签管家：屏蔽选中文字「%s」',
      contexts: ['selection'],
      visible: true
    });
    create(MENU.selOnly, {
      title: '标签管家：只看选中文字「%s」',
      contexts: ['selection'],
      visible: true
    });
    create(MENU.openPanel, { title: '标签管家：打开规则设置…', contexts: ['all'], visible: true });
  });
}

chrome.runtime.onInstalled.addListener(function (details) {
  buildMenus();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'https://archiveofourown.org/' });
  }
});

chrome.runtime.onStartup.addListener(buildMenus);

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
