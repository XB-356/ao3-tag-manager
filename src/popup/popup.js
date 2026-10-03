/* AO3 标签管家 —— 扩展弹窗逻辑（普通脚本） */
(function () {
  'use strict';

  const store = window.AO3TM.store;
  const panel = window.AO3TM.panel;

  let activeTabId = null;
  const IS_OPTIONS = /[?&]mode=options/.test(location.search);

  function currentTab() {
    return new Promise(function (resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        resolve((tabs && tabs[0]) || null);
      });
    });
  }

  function sendToTab(tabId, message) {
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

  function describeSite(tab) {
    const el = document.getElementById('site-state');
    if (!tab || !tab.url || tab.url.indexOf('archiveofourown.org') === -1) {
      el.textContent = '当前标签页不是 AO3——规则仍会保存，打开 AO3 后自动生效。';
      el.classList.add('is-muted');
      document.getElementById('refresh-page').disabled = true;
      return;
    }
    el.classList.remove('is-muted');
    sendToTab(tab.id, { type: 'ao3tm:state' }).then(function (state) {
      if (!state) {
        el.textContent = '已打开 AO3 页面（刷新一次后弹窗即可读取本页统计）。';
        return;
      }
      el.textContent =
        '本页 ' +
        state.total +
        ' 篇作品，已隐藏 ' +
        state.hidden +
        ' 篇' +
        (state.only ? '（其中只看模式 ' + state.only + ' 篇）' : '') +
        (state.revealed ? '，临时显示 ' + state.revealed + ' 篇' : '');
    });
  }

  function boot() {
    if (IS_OPTIONS) {
      document.body.classList.add('is-options');
      document.getElementById('site-state').textContent = '规则改动会立即同步到所有已打开的 AO3 页面（无需刷新，正在浏览的页面除外）。';
      document.getElementById('refresh-page').remove();
      document.getElementById('open-options').remove();
    }

    const host = document.getElementById('panel-host');
    panel.mount(host);
    // 弹窗/设置页里不需要浮层遮罩：面板直接铺满
    const overlay = host.querySelector('.ao3tm-panel-overlay');
    if (overlay) overlay.remove();
    host.querySelector('.ao3tm-panel').classList.add('is-inline');
    panel.setTab('block');

    if (IS_OPTIONS) return;

    currentTab().then(function (tab) {
      activeTabId = tab && tab.id;
      describeSite(tab);
    });

    document.getElementById('refresh-page').addEventListener('click', function () {
      if (activeTabId != null) chrome.tabs.reload(activeTabId);
      window.close();
    });
    document.getElementById('open-options').addEventListener('click', function () {
      chrome.runtime.openOptionsPage();
    });
  }

  store.ready().then(boot);

  // 规则改动后刷新页面统计文案
  if (!IS_OPTIONS) {
    store.subscribe(function () {
      currentTab().then(describeSite);
    });
  }
})();
