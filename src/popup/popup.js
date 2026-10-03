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

  /**
   * 只靠域名判断"值不值得检测"。
   * 页面结构判定要读 DOM，而内容脚本没注入时读不到，
   * 所以这里仍用域名线索做第一道筛子（detect.domainSignals），
   * 用户点"检测并启用"获得权限后，内容脚本会在页面里做完整的结构判定。
   */
  function domainLooksLikeAo3(host) {
    const detector = window.AO3TM.detect;
    if (!detector || !host) return false;
    return detector.domainSignals(host).length > 0;
  }

  function describeSite(tab) {
    const el = document.getElementById('site-state');
    const enableBtn = document.getElementById('enable-site');
    const host = tab && tab.url ? hostOf(tab.url) : '';
    const httpish = /^https?:/.test(tab && tab.url ? tab.url : '');
    const suspicious = httpish && domainLooksLikeAo3(host);

    if (!host || (!isStaticHost(host) && !suspicious)) {
      el.textContent = '当前标签页不是 AO3——规则仍会保存，打开 AO3 后自动生效。';
      el.classList.add('is-muted');
      document.getElementById('refresh-page').disabled = true;
      if (enableBtn) enableBtn.hidden = true;
      return;
    }

    el.classList.remove('is-muted');
    // 先看内容脚本在不在：在的话能直接给本页统计；不在就说明这个域名还没启用
    sendToTab(tab.id, { type: 'ao3tm:state' }).then(function (state) {
      if (!state) {
        if (isStaticHost(host)) {
          el.textContent = '已打开 AO3 页面（刷新一次后弹窗即可读取本页统计）。';
          if (enableBtn) enableBtn.hidden = true;
        } else {
          const detector = window.AO3TM.detect;
          const signals = detector ? detector.domainSignals(host) : [];
          const why = signals.length
            ? '（域名特征：' + signals.map(function (s) { return s.label; }).join('、') + '）'
            : '';
          el.textContent =
            host + ' 还没启用，扩展看不到这个页面的内容' + why + '。点下面的按钮授权并检测这个网站。';
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
            // 刷新后内容脚本注入，页面里会自动跑一次结构检测并给出结论
            el.textContent = '已启用 ' + normalized + '，正在刷新，刷新后会在页面顶部给出检测结论。';
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
