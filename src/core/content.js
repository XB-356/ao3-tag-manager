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
    // 测试用：权限弹窗没法在无头环境点掉，转发给 service worker 走真实注册链路
    if (message.mirrorEnableForTest || message.mirrorDisableForTest) {
      const api = root.AO3TM.env.chrome;
      const host = message.mirrorEnableForTest || message.mirrorDisableForTest;
      const type = message.mirrorEnableForTest ? 'ao3tm:mirror-enable-for-test' : 'ao3tm:mirror-disable-for-test';
      api.runtime.sendMessage({ type: type, host: host }, function (result) {
        void api.runtime.lastError;
        root.AO3TM.mirrors.listEnabled().then(function (enabled) {
          sendResponse({ ok: true, mirrorResult: result, enabled: enabled });
        });
      });
      return true;
    }

    // 测试用：查询动态注册的实际 matches（内容脚本读不到，转发给 service worker）
    if (message.mirrorRegistered) {
      const api = root.AO3TM.env.chrome;
      api.runtime.sendMessage({ type: 'ao3tm:mirror-debug' }, function (result) {
        void api.runtime.lastError;
        sendResponse(result);
      });
      return true;
    }

    // 测试用/排查用：返回当前页面的 AO3 识别结果
    if (message.detect || message.mirrorDetect) {
      const auto = root.AO3TM.autoDetect;
      const detector = root.AO3TM.detect;
      if (!detector) {
        sendResponse(null);
        return true;
      }
      const finish = function (result) {
        sendResponse({
          level: result.level,
          isAo3: result.isAo3,
          score: result.score,
          host: result.host,
          enabledHere: result.enabledHere,
          canAutoScan: !!result.canAutoScan,
          reasons: result.reasons.map(function (item) {
            return item.key + ':' + item.weight;
          }),
          banner: !!document.getElementById(auto ? auto.BANNER_ID : 'ao3tm-auto-banner'),
          skipped: (function () {
            try {
              return JSON.parse(root.localStorage.getItem(auto ? auto.SKIP_KEY : 'ao3tm_detect_skip') || '[]');
            } catch (err) {
              return [];
            }
          })()
        });
      };
      if (auto) auto.checkAsync().then(finish);
      else finish(detector.detect(document, location));
      return true;
    }

    // 测试用：把当前页面按指定域名挂一次检测横幅（页面侧在隔离世界，测试点不到）
    if (message.autoMountForTest) {
      const auto = root.AO3TM.autoDetect;
      if (!auto) {
        sendResponse({ ok: false, reason: 'no-auto-detect' });
        return true;
      }
      const result = auto.check(document, {
        hostname: message.autoMountForTest,
        protocol: location.protocol || 'https:'
      });
      // 允许测试指定"是否算已启用"，用来覆盖两种分支
      if (message.autoMountEnabled !== undefined) result.enabledHere = !!message.autoMountEnabled;
      const banner = auto.mountBanner(result);
      sendResponse({
        ok: true,
        mounted: !!banner,
        isAo3: result.isAo3,
        level: result.level,
        enabledHere: result.enabledHere
      });
      return true;
    }

    // 测试用：清空忽略名单（内存 + localStorage 都要清，否则同一次会话里仍会被拒）
    if (message.autoResetSkip) {
      const auto = root.AO3TM.autoDetect;
      if (auto) auto.clearSkipped();
      try {
        root.localStorage.removeItem(auto ? auto.SKIP_KEY : 'ao3tm_detect_skip');
      } catch (err) {
        /* ignore */
      }
      sendResponse({ ok: true });
      return true;
    }

    // 测试用：跑一次自动检测（不挂横幅）
    if (message.autoRun) {
      const auto = root.AO3TM.autoDetect;
      if (!auto) {
        sendResponse({ ok: false, reason: 'no-auto-detect' });
        return true;
      }
      auto.autoRun().then(function (result) {
        sendResponse({
          ok: true,
          level: result ? result.level : null,
          enabledHere: result ? result.enabledHere : null,
          canAutoScan: result ? !!result.canAutoScan : null
        });
      });
      return true;
    }

    // 排查用：把"右键这一下到底识别成了什么"以及菜单实际渲染出的动作列出来
    if (message.probeContext) {
      const D = root.AO3TM.dom;
      const hit = root.AO3TM.ui.lastContextHit ? root.AO3TM.ui.lastContextHit() : null;
      const menu = document.querySelector('.ao3tm-menu');
      const blurbs = D.blurbs();
      sendResponse({
        hit: hit,
        menu: menu
          ? {
              head: (menu.querySelector('.ao3tm-menu-head') || {}).textContent || '',
              labels: Array.prototype.map.call(menu.querySelectorAll('.ao3tm-menu-label'), function (n) {
                return n.textContent.trim();
              }),
              actions: Array.prototype.map.call(menu.querySelectorAll('button[data-act]'), function (b) {
                return b.getAttribute('data-act');
              }),
              rows: Array.prototype.map.call(menu.querySelectorAll('.ao3tm-menu-row .ao3tm-menu-name'), function (n) {
                return n.textContent.trim();
              })
            }
          : null,
        sample: blurbs.slice(0, 3).map(function (el) {
          const authorLinks = el.querySelectorAll('a[href*="/users/"]');
          return {
            id: el.getAttribute('id') || '',
            authors: D.authorsOf(el),
            fandoms: D.blurbFandoms ? D.blurbFandoms(el) : null,
            tagCount: D.blurbTags(el).length,
            authorLinkCount: authorLinks.length,
            authorLinkHrefs: Array.prototype.map.call(authorLinks, function (a) {
              return a.getAttribute('href');
            }),
            authorLinkTexts: Array.prototype.map.call(authorLinks, function (a) {
              return (a.textContent || '').trim();
            }),
            liAuthorCount: el.querySelectorAll('li.author').length,
            bylineCount: el.querySelectorAll('.byline').length,
            statsHtml: (function () {
              const box = el.querySelector('ul.stats, dl.stats, .stats');
              return box ? box.outerHTML.slice(0, 400) : null;
            })()
          };
        })
      });
      return true;
    }

    // 排查用：开关汉化的调试缓冲，并读回最近处理过的文本节点
    if (message.i18nDebug) {
      root.AO3TM.__i18nDebug = root.AO3TM.__i18nDebug || [];
      if (message.i18nDebug === 'reset') root.AO3TM.__i18nDebug.length = 0;
      sendResponse({ log: root.AO3TM.__i18nDebug.slice(-60) });
      return true;
    }

    if (message.type === 'ao3tm:debug') {
      // 给自动化测试/排查用：先按当前设置应用一次主题与汉化，再返回状态
      const D = root.AO3TM.dom;
      const M = root.AO3TM.match;
      const store = root.AO3TM.store;
      if (message.clear) store.clearAll('all');
      // 测试用：直接改设置（避免依赖面板点击时序）
      if (message.setSetting) store.updateSettings(message.setSetting);
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
        env: root.AO3TM.env
          ? {
              mode: root.AO3TM.env.mode,
              driver: store.driverName,
              host: location.hostname,
              protocol: location.protocol,
              isAo3: root.AO3TM.env.isAo3Host(location.hostname),
              presets: root.AO3TM.env.PRESET_MIRRORS,
              probes: message.probes || null
            }
          : null,
        probe: message.probe
          ? (function () {
              const env = root.AO3TM.env;
              const out = {};
              (message.probeHosts || []).forEach(function (host) {
                out[host] = env.isAo3Host(host);
              });
              return {
                hosts: out,
                normalized: (message.probeRaw || []).map(function (value) {
                  return env.normalizeHost(value);
                }),
                pattern: env.hostToMatchPattern('ao3.example.com'),
                customHosts: env.readCustomHosts()
              };
            })()
          : null,
        settings: state.settings,
        theme: document.documentElement.getAttribute('data-ao3tm-theme'),
        translated: document.querySelectorAll('[data-ao3tm-i18n]').length,
        translate: root.AO3TM.i18n && typeof message.probe === 'string' ? root.AO3TM.i18n.translate(message.probe) : null,
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
