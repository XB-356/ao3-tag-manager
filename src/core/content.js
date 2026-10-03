/* AO3 标签管家 —— 内容脚本侧消息响应 + 页面事件桥
   事件桥：页面上的脚本（或书签小工具）可以 dispatch 一个 CustomEvent('ao3tm:command')
   来调用插件，插件用 CustomEvent('ao3tm:result') 回传结果。 */
(function (root) {
  'use strict';

  const COMMAND_EVENT = 'ao3tm:command';
  const RESULT_EVENT = 'ao3tm:result';

  function stateSnapshot() {
    const stats = root.AO3TM.ui ? root.AO3TM.ui.lastStats : null;
    return {
      total: stats ? stats.total : 0,
      hidden: stats ? stats.hidden : 0,
      only: stats ? stats.only : 0,
      revealed: root.AO3TM.filter ? root.AO3TM.filter.countRevealed() : 0,
      hiddenDom: document.querySelectorAll('.ao3tm-hidden').length,
      fabOn: !!document.querySelector('.ao3tm-fab-toggle.is-on'),
      revealList: root.AO3TM.filter && root.AO3TM.filter.listRevealed ? root.AO3TM.filter.listRevealed() : [],
      workPage: root.AO3TM.dom ? root.AO3TM.dom.isWorkPage() : false,
      counts: root.AO3TM.store ? root.AO3TM.store.counts() : null
    };
  }

  function handle(message, sendResponse) {
    if (!message || typeof message.type !== 'string') return false;
    if (message.type === 'ao3tm:state') {
      sendResponse(stateSnapshot());
      return true;
    }
    if (message.type === 'ao3tm:refresh') {
      if (root.AO3TM.ui) root.AO3TM.ui.refresh();
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === 'ao3tm:panel') {
      if (root.AO3TM.panel) root.AO3TM.panel.open(document.body);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === 'ao3tm:reveal') {
      if (root.AO3TM.filter) root.AO3TM.filter.revealAll();
      if (root.AO3TM.ui) root.AO3TM.ui.refresh();
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === 'ao3tm:context-action') {
      // 原生右键菜单点击后回到页面里执行（右键目标是页面状态，只有内容脚本知道）
      if (!root.AO3TM.ui) {
        sendResponse({ ok: false, reason: 'not-ready' });
        return true;
      }
      sendResponse(root.AO3TM.ui.applyContextAction(message.action));
      return true;
    }
    if (message.type === 'ao3tm:debug') {
      // 给自动化测试/排查用：先按当前设置应用一次主题与汉化，再返回状态
      const D = root.AO3TM.dom;
      const M = root.AO3TM.match;
      const store = root.AO3TM.store;
      if (message.clear) store.clearAll('all');
      if (message.revealReset && root.AO3TM.filter) root.AO3TM.filter.resetReveal();
      if (message.apply) {
        if (root.AO3TM.ui) root.AO3TM.ui.applyTheme();
        if (root.AO3TM.i18n) {
          if (store.get().settings.i18n) {
            root.AO3TM.i18n.start();
            root.AO3TM.i18n.pass();
          } else {
            root.AO3TM.i18n.stop();
          }
        }
      }
      const state = store.get();
      sendResponse({
        rules: {
          tag: store.rulesOf('tag').map(function (r) {
            return r.mode + ':' + r.pattern;
          }),
          author: store.rulesOf('author').map(function (r) {
            return r.mode + ':' + r.pattern;
          })
        },
        revision: state.revision,
        counts: store.counts(),
        settings: state.settings,
        theme: document.documentElement.getAttribute('data-ao3tm-theme'),
        translated: document.querySelectorAll('[data-ao3tm-i18n]').length,
        translate: root.AO3TM.i18n ? root.AO3TM.i18n.translate(message.probe || 'Sort and Filter') : null,
        contextHit: root.AO3TM.ui ? root.AO3TM.ui.lastContextHit() : null,
        contextMenu: (function () {
          const menu = document.querySelector('.ao3tm-menu');
          if (!menu) return null;
          const head = menu.querySelector('.ao3tm-menu-head');
          return {
            label: head ? (head.childNodes[0] || {}).textContent || '' : '',
            sub: ((menu.querySelector('.ao3tm-menu-head small') || {}).textContent || '').trim(),
            actions: Array.prototype.map.call(menu.querySelectorAll('button[data-act]'), function (b) {
              return b.getAttribute('data-act');
            }),
            rows: Array.prototype.map.call(menu.querySelectorAll('.ao3tm-menu-row .ao3tm-menu-name'), function (n) {
              return n.textContent.trim();
            }),
            iconSize: (function () {
              const svg = menu.querySelector('.ao3tm-menu-item svg');
              if (!svg) return null;
              const rect = svg.getBoundingClientRect();
              return { w: Math.round(rect.width), h: Math.round(rect.height) };
            })()
          };
        })(),
        blurbs: D.blurbs().map(function (el) {
          const verdict = M.evaluate({
            tags: D.blurbTags(el),
            authors: D.authorsOf(el),
            settings: state.settings,
            rules: state.rules
          });
          return {
            path: D.pathOf(el),
            tags: D.blurbTags(el),
            blocked: verdict.blocked,
            only: verdict.only,
            reasons: verdict.reasons
          };
        })
      });
      return true;
    }
    return false;
  }

  try {
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (handle(message, sendResponse)) return true;
      return undefined;
    });
  } catch (err) {
    /* 非扩展环境忽略 */
  }

  // 页面事件桥
  window.addEventListener(COMMAND_EVENT, function (event) {
    let message = null;
    try {
      message = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
    } catch (err) {
      return;
    }
    handle(message || {}, function (response) {
      window.dispatchEvent(
        new CustomEvent(RESULT_EVENT, {
          detail: JSON.stringify(Object.assign({ type: message && message.type, id: message && message.id }, response))
        })
      );
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
