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

  function hostOf(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (err) {
      return '';
    }
  }

  /** 官方站 / 本地测试域：内容脚本是静态注入的 */
  function isStaticHost(host) {
    return (
      host === 'archiveofourown.org' ||
      host === 'www.archiveofourown.org' ||
      host === '127.0.0.1' ||
      host === 'localhost'
    );
  }

  function describeSite(tab) {
    const el = document.getElementById('site-state');
    const enableBtn = document.getElementById('enable-site');
    const host = tab && tab.url ? hostOf(tab.url) : '';
    const onAo3ish = /^https?:/.test(tab && tab.url ? tab.url : '') && /ao3|archiveofourown|transformativeworks/i.test(host);

    if (!host || (!isStaticHost(host) && !onAo3ish)) {
      el.textContent = '当前标签页不是 AO3——规则仍会保存，打开 AO3 后自动生效。';
      el.classList.add('is-muted');
      document.getElementById('refresh-page').disabled = true;
      if (enableBtn) enableBtn.hidden = true;
      return;
    }

    el.classList.remove('is-muted');
    // 镜像站：先看内容脚本在不在
    sendToTab(tab.id, { type: 'ao3tm:state' }).then(function (state) {
      if (!state) {
        if (isStaticHost(host)) {
          el.textContent = '已打开 AO3 页面（刷新一次后弹窗即可读取本页统计）。';
          if (enableBtn) enableBtn.hidden = true;
        } else {
          el.textContent = '这个域名（' + host + '）看起来是 AO3 镜像，但还没启用。启用后才能在这上面使用标签管家。';
          if (enableBtn) enableBtn.hidden = false;
        }
        return;
      }
      if (enableBtn) enableBtn.hidden = true;
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

  /** 在弹窗里启用当前镜像：弹窗的点击同样带用户手势，可以直接申请权限 */
  function enableCurrentSite() {
    const el = document.getElementById('site-state');
    currentTab().then(function (tab) {
      const host = tab && tab.url ? hostOf(tab.url) : '';
      if (!host || !window.AO3TM.env) return;
      const normalized = window.AO3TM.env.normalizeHost(host);
      const origins = window.AO3TM.env.hostToMatchPatterns
        ? window.AO3TM.env.hostToMatchPatterns(normalized)
        : [window.AO3TM.env.hostToMatchPattern(normalized)];
      chrome.permissions.request({ origins: origins }, function (granted) {
        if (chrome.runtime.lastError || !granted) {
          el.textContent = '你取消了授权，未启用 ' + normalized + '。';
          return;
        }
        chrome.runtime.sendMessage({ type: 'ao3tm:save-mirror', host: normalized }, function (result) {
          void chrome.runtime.lastError;
          if (result && result.ok) {
            el.textContent = '已启用 ' + normalized + '，刷新这个页面就能用了。';
            if (activeTabId != null) chrome.tabs.reload(activeTabId);
          } else {
            el.textContent = '启用失败：' + ((result && result.reason) || '未知原因');
          }
        });
      });
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
    const enableBtn = document.getElementById('enable-site');
    if (enableBtn) enableBtn.addEventListener('click', enableCurrentSite);
  }

  store.ready().then(boot);

  // 规则改动后刷新页面统计文案
  if (!IS_OPTIONS) {
    store.subscribe(function () {
      currentTab().then(describeSite);
    });
  }
})();
