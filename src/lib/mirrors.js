/* AO3 标签管家 —— 镜像站支持
   思路：
     · manifest 静态声明官方站、本地测试域与 file://
     · 预置镜像 + 用户自定义域名走 optional_host_permissions：
       用户点"启用"时申请权限（必须有用户手势），再交给 service worker 动态注册内容脚本
     · 已启用域名记在 chrome.storage.local，service worker 启动时按需重新注册
   油猴版不需要这套，@match 由脚本头负责。 */
var _ao3tmExport = (function (root) {
  'use strict';

  // 页面侧由 env.js 挂好 AO3TM.env；service worker 里只有 env-core.js 写的 envGlobal
  const env = (root.AO3TM && (root.AO3TM.env || root.AO3TM.envGlobal)) || null;
  if (!env) {
    console.error('[AO3 标签管家] 镜像模块缺少环境层，请先加载 env-core.js');
    return root.AO3TM || {};
  }
  const api = env.chrome;

  const HOSTS_KEY = 'ao3tm_hosts_v1';

  /** 静态声明的域名，无需动态注册 */
  function isStaticHost(host) {
    const name = String(host || '').toLowerCase();
    return env.DEFAULT_HOSTS.indexOf(name) !== -1 || env.TEST_HOSTS.indexOf(name) !== -1;
  }

  /* ------------------------------ 已启用域名清单 ------------------------------ */

  function listEnabled() {
    return new Promise(function (resolve) {
      if (!api || !api.storage) {
        resolve(env.readCustomHosts());
        return;
      }
      api.storage.local.get(HOSTS_KEY, function (items) {
        void api.runtime.lastError;
        const list = items && Array.isArray(items[HOSTS_KEY]) ? items[HOSTS_KEY] : [];
        resolve(list);
      });
    });
  }

  function saveEnabled(list) {
    return new Promise(function (resolve) {
      const unique = [];
      (list || []).forEach(function (host) {
        const name = env.normalizeHost(host);
        if (name && unique.indexOf(name) === -1 && !isStaticHost(name)) unique.push(name);
      });
      // 内容脚本靠 localStorage 判断"当前域名算不算 AO3"，两边都写
      env.saveCustomHosts(unique);
      if (!api || !api.storage) {
        resolve(unique);
        return;
      }
      const payload = {};
      payload[HOSTS_KEY] = unique;
      api.storage.local.set(payload, function () {
        void api.runtime.lastError;
        resolve(unique);
      });
    });
  }

  /* --------------------------------- 权限 --------------------------------- */

  /** 一个域名对应的所有 match pattern（http + https） */
  function patternsFor(host) {
    return env.hostToMatchPatterns ? env.hostToMatchPatterns(host) : [env.hostToMatchPattern(host)];
  }

  function hasPermission(host) {
    if (!api || !api.permissions) return Promise.resolve(false);
    return new Promise(function (resolve) {
      api.permissions.contains({ origins: patternsFor(host) }, function (granted) {
        void api.runtime.lastError;
        resolve(!!granted);
      });
    });
  }

  /** 申请权限。必须由用户点击触发（Chrome 要求用户手势） */
  function requestPermission(host) {
    if (!api || !api.permissions) return Promise.resolve(false);
    return new Promise(function (resolve) {
      // 只申请用户填的那个域名；manifest 里声明 <all_urls> 是为了允许任意域名，
      // 而非一次性索要全部权限——Chrome 只授予这里列出的 origin。
      api.permissions.request({ origins: patternsFor(host) }, function (granted) {
        void api.runtime.lastError;
        resolve(!!granted);
      });
    });
  }

  function dropPermission(host) {
    if (!api || !api.permissions) return Promise.resolve(false);
    return new Promise(function (resolve) {
      api.permissions.remove({ origins: patternsFor(host) }, function (removed) {
        void api.runtime.lastError;
        resolve(!!removed);
      });
    });
  }

  /** 把"记录 + 注册"交给 service worker（那边还能顺手刷新右键菜单） */
  function askBackground(type, host) {
    return new Promise(function (resolve) {
      if (!api || !api.runtime || !api.runtime.sendMessage) {
        resolve(null);
        return;
      }
      try {
        api.runtime.sendMessage({ type: type, host: host }, function (response) {
          void api.runtime.lastError;
          resolve(response || null);
        });
      } catch (err) {
        resolve(null);
      }
    });
  }

  /* ------------------------------ 内容脚本注册 ------------------------------ */

  const SCRIPT_ID = 'ao3tm-mirror';
  const JS_FILES = [
    'src/lib/env-core.js',
    'src/lib/env.js',
    'src/lib/storage.js',
    'src/lib/match.js',
    'src/lib/dom.js',
    'src/lib/i18n.js',
    'src/lib/detect.js',
    'src/lib/mirrors.js',
    'src/lib/auto-detect.js',
    'src/lib/panel.js',
    'src/core/filter.js',
    'src/core/ui.js',
    'src/core/focus.js',
    'src/core/content.js',
    'src/core/main.js'
  ];
  const CSS_FILES = ['src/lib/panel.css'];

  /** 把已授权域名合并成一次注册（matches 支持多条） */
  function registerHosts(hosts) {
    if (!api || !api.scripting) return Promise.resolve({ ok: false, reason: 'no-scripting-api' });
    const patterns = [];
    (hosts || []).forEach(function (host) {
      patternsFor(host).forEach(function (pattern) {
        if (patterns.indexOf(pattern) === -1) patterns.push(pattern);
      });
    });
    return new Promise(function (resolve) {
      const finishWith = function (value) {
        resolve(value);
      };
      api.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] }, function (existing) {
        if (api.runtime.lastError) console.warn('[AO3 标签管家] 读取注册信息失败', api.runtime.lastError.message);
        const has = !!(existing && existing.length);
        if (!patterns.length) {
          if (!has) {
            finishWith({ ok: true, registered: 0 });
            return;
          }
          api.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }, function () {
            finishWith({ ok: true, registered: 0 });
          });
          return;
        }
        const script = {
          id: SCRIPT_ID,
          matches: patterns,
          js: JS_FILES,
          css: CSS_FILES,
          runAt: 'document_idle',
          allFrames: false,
          persistAcrossSessions: true
        };
        const done = function () {
          const err = api.runtime.lastError;
          if (err) {
            console.warn('[AO3 标签管家] 注册镜像内容脚本失败：' + err.message);
            finishWith({ ok: false, reason: err.message, patterns: patterns });
            return;
          }
          finishWith({ ok: true, registered: patterns.length, patterns: patterns });
        };
        if (has) api.scripting.updateContentScripts([script], done);
        else api.scripting.registerContentScripts([script], done);
      });
    });
  }

  /** 把清单同步到动态注册（service worker 启动、或增删域名后调用） */
  async function sync() {
    if (!api || !api.scripting) return listEnabled();
    const enabled = await listEnabled();
    const granted = [];
    for (let i = 0; i < enabled.length; i++) {
      if (await hasPermission(enabled[i])) granted.push(enabled[i]);
    }
    await registerHosts(granted);
    return enabled;
  }

  /* ------------------------------- 增删（对外） ------------------------------- */

  /** 启用一个域名。权限必须在调用方（内容脚本点击 / 弹窗点击）申请好 */
  async function enable(rawHost) {
    const host = env.normalizeHost(rawHost);
    if (!host) return { ok: false, reason: 'invalid' };
    if (isStaticHost(host)) return { ok: false, reason: 'static', host: host };

    if (!env.isExtension) {
      // 油猴版：只能记下来，让用户自行把域名加进脚本头
      const list = env.readCustomHosts();
      if (list.indexOf(host) === -1) list.push(host);
      env.saveCustomHosts(list);
      return { ok: true, host: host, userscript: true };
    }

    const granted = await hasPermission(host);
    if (!granted) return { ok: false, reason: 'denied', host: host };
    const list = await listEnabled();
    if (list.indexOf(host) === -1) list.push(host);
    await saveEnabled(list);
    await sync();
    return { ok: true, host: host };
  }

  /**
   * 测试专用：跳过权限检查，走真实的"记录 + 动态注册"链路。
   * 无头环境点不掉 Chrome 的权限弹窗，contains 只能打桩；
   * 注册本身仍是真实调用，能否成功由 Chrome 自己判断。
   */
  function withStubbedPermission(fn) {
    const realContains = api.permissions ? api.permissions.contains : null;
    if (api.permissions) {
      api.permissions.contains = function (detail, cb) {
        cb(true);
      };
    }
    return Promise.resolve()
      .then(fn)
      .catch(function (err) {
        return { ok: false, reason: String(err && err.message ? err.message : err) };
      })
      .then(function (result) {
        if (api.permissions && realContains) api.permissions.contains = realContains;
        return result;
      });
  }

  /** 测试专用：启用（跳过权限检查） */
  function enableForTest(rawHost) {
    const host = env.normalizeHost(rawHost);
    if (!host) return Promise.resolve({ ok: false, reason: 'invalid' });
    return withStubbedPermission(async function () {
      await requestPermission(host);
      const list = await listEnabled();
      if (list.indexOf(host) === -1) list.push(host);
      await saveEnabled(list);
      const reg = await registerHosts(list);
      return { ok: true, host: host, enabled: list, register: reg };
    });
  }

  /** 测试专用：停用（跳过权限检查） */
  function disableForTest(rawHost) {
    const host = env.normalizeHost(rawHost);
    if (!host) return Promise.resolve({ ok: false, reason: 'invalid' });
    return withStubbedPermission(async function () {
      const list = (await listEnabled()).filter(function (item) {
        return item !== host;
      });
      await saveEnabled(list);
      await registerHosts(list);
      return { ok: true, host: host, enabled: list };
    });
  }

  async function disable(rawHost) {
    const host = env.normalizeHost(rawHost);
    if (!host) return { ok: false, reason: 'invalid' };
    const list = (await listEnabled()).filter(function (item) {
      return item !== host;
    });
    await saveEnabled(list);
    if (env.isExtension) await dropPermission(host);
    await sync();
    return { ok: true, host: host };
  }

  /**
   * 页面里的"启用当前镜像"：
   * 内容脚本的点击带着用户手势，所以权限申请放在这里做，成功后再让 service worker 记录并注册。
   */
  async function enableFromPage(rawHost) {
    const host = env.normalizeHost(rawHost || location.hostname);
    if (!host) return { ok: false, reason: 'invalid' };
    if (!env.isExtension) return enable(host);
    if (isStaticHost(host)) return { ok: true, host: host, already: true };
    const granted = await requestPermission(host);
    if (!granted) return { ok: false, reason: 'denied', host: host };
    const saved = await askBackground('ao3tm:save-mirror', host);
    if (saved && saved.ok === false) return { ok: false, reason: saved.reason || 'register-failed', host: host };
    const list = await listEnabled();
    if (list.indexOf(host) === -1) list.push(host);
    await saveEnabled(list);
    await sync();
    return { ok: true, host: host };
  }

  /** 面板用的完整清单：预置的 + 用户加的，带启用状态 */
  async function overview() {
    const enabled = await listEnabled();
    const seen = {};
    const rows = [];
    const push = function (host, preset) {
      if (!host || seen[host] || isStaticHost(host)) return;
      seen[host] = true;
      rows.push({ host: host, preset: !!preset, enabled: enabled.indexOf(host) !== -1 });
    };
    env.PRESET_MIRRORS.forEach(function (host) {
      push(host, true);
    });
    enabled.forEach(function (host) {
      push(host, false);
    });
    return rows;
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.mirrors = {
    HOSTS_KEY: HOSTS_KEY,
    SCRIPT_ID: SCRIPT_ID,
    JS_FILES: JS_FILES,
    CSS_FILES: CSS_FILES,
    isStaticHost: isStaticHost,
    listEnabled: listEnabled,
    saveEnabled: saveEnabled,
    hasPermission: hasPermission,
    requestPermission: requestPermission,
    registerHosts: registerHosts,
    sync: sync,
    enable: enable,
    enableForTest: enableForTest,
    disableForTest: disableForTest,
    disable: disable,
    enableFromPage: enableFromPage,
    overview: overview,
    isCurrentHostEnabled: function () {
      return env.isAo3Host(location.hostname);
    }
  };
  return root.AO3TM;
})(typeof globalThis !== 'undefined' ? globalThis : self);
