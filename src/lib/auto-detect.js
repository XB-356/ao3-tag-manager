/* AO3 标签管家 —— 镜像站自动检测
   检测能力取决于权限，所以分两种情况：
     1. 已授予「所有网站」权限（设置里可开启）：内容脚本在每个网站都会跑，
        于是可以自动判定并在页面顶部给出横幅，一键启用当前站点。
     2. 只有站点权限：内容脚本压根不会注入到陌生网站，检测退化为
        "可疑域名 → 弹窗里点检测 → 授权 → 重载 → 自动判定"（见 popup.js）。
   判定逻辑本身在 detect.js，这里是"什么时候跑、结果怎么呈现"。 */
(function (root) {
  'use strict';

  const BANNER_ID = 'ao3tm-auto-banner';
  const SKIP_KEY = 'ao3tm_detect_skip';
  const ALL_URLS = ['https://*/*', 'http://*/*'];

  const env = (root.AO3TM && root.AO3TM.env) || null;
  const detector = (root.AO3TM && root.AO3TM.detect) || null;

  /** 最后一个被忽略的域名（内存里记住，避免同一次会话反复弹） */
  const skipped = new Set(readSkipped());

  function readSkipped() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(SKIP_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveSkipped() {
    try {
      root.localStorage.setItem(SKIP_KEY, JSON.stringify(Array.from(skipped)));
    } catch (err) {
      /* ignore */
    }
  }

  /**
   * 当前域名上工具条是否已经能用。
   * 扩展：镜像模块登记的已启用域名（含官方站与预置镜像）。
   * 油猴：脚本既然已经跑在这个页面上了，就说明域名在 @match 名单里，本来就是可用的。
   */
  function isEnabledHere(host) {
    if (!env) return false;
    if (env.isUserscript) return true;
    return env.isAo3Host(host);
  }

  /**
   * 油猴脚本版：用户在横幅上点"启用"后，只能记在 localStorage 里（没有扩展权限可申请），
   * 然后提示他自己去脚本头补一行 @match。
   */
  function rememberUserscriptHost(host) {
    try {
      const raw = root.localStorage && root.localStorage.getItem('ao3tm_hosts');
      const list = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(list) ? list : [];
      if (next.indexOf(host) === -1) next.push(host);
      root.localStorage.setItem('ao3tm_hosts', JSON.stringify(next));
    } catch (err) {
      /* ignore */
    }
  }

  function hasAllSitesPermission() {
    return new Promise(function (resolve) {
      const api = env && env.chrome;
      if (!api || !api.permissions) {
        resolve(false);
        return;
      }
      api.permissions.contains({ origins: ALL_URLS }, function (granted) {
        void api.runtime.lastError;
        resolve(!!granted);
      });
    });
  }

  /**
   * 检测当前页面。返回 detect() 的结果，外加：
   *   enabledHere  —— 这个域名现在能不能用（能不能渲染工具条）
   *   canAutoScan  —— 是否已开启"所有网站"检测权限
   */
  function check(doc, loc) {
    const document_ = doc || document;
    const location_ = loc || location;
    const result = detector
      ? detector.detect(document_, location_)
      : { isAo3: false, level: 'none', score: 0, reasons: [], host: '', domainSignals: [], pageSignals: [] };
    const host = result.host || '';
    result.enabledHere = isEnabledHere(host);
    result.isLocalFile = /^file:/.test(String(location_.protocol || ''));
    return result;
  }

  function checkAsync(doc, loc) {
    return hasAllSitesPermission().then(function (granted) {
      const result = check(doc, loc);
      result.canAutoScan = granted;
      return result;
    });
  }

  /* ------------------------------ 页面顶部横幅 ------------------------------ */

  function removeBanner() {
    const existing = document.getElementById(BANNER_ID);
    if (existing) existing.remove();
  }

  function buildBanner(result) {
    const box = document.createElement('div');
    box.id = BANNER_ID;
    box.className = 'ao3tm-detect-banner is-' + result.level;

    const reasons = result.reasons.slice(0, 4).map(function (item) {
      return '<li>' + escapeText(item.label) + '</li>';
    }).join('');

    const isExtension = !!(env && env.isExtension);
    const conclusion = detector ? detector.summary(result) : '';
    const levelText = detector ? detector.levelLabel(result.level) : '';
    // 结论文案有时已经含了置信度（"高度确认是 AO3 站点"），避免重复显示
    const showLevelChip = levelText && conclusion.indexOf(levelText) === -1;
    box.innerHTML =
      '<div class="ao3tm-detect-main">' +
      '<div class="ao3tm-detect-title">' +
      escapeText(conclusion) +
      (showLevelChip ? '<span class="ao3tm-detect-level">' + escapeText(levelText) + '</span>' : '') +
      (result.host ? '<span class="ao3tm-detect-host">' + escapeText(result.host) + '</span>' : '') +
      '</div>' +
      '<ul class="ao3tm-detect-reasons">' +
      reasons +
      '</ul>' +
      '<div class="ao3tm-detect-actions">' +
      (result.enabledHere
        ? '<span class="ao3tm-detect-ok">本站已启用，工具条已注入</span>'
        : isExtension
          ? '<button type="button" class="ao3tm-detect-btn is-primary" data-act="enable">在 ' + escapeText(result.host) + ' 上启用</button>'
          : '<button type="button" class="ao3tm-detect-btn is-primary" data-act="remember">记下这个域名</button>') +
      '<button type="button" class="ao3tm-detect-btn" data-act="dismiss">以后再说</button>' +
      '<button type="button" class="ao3tm-detect-btn" data-act="never">一直忽略此站</button>' +
      (isExtension && !result.enabledHere
        ? '<button type="button" class="ao3tm-detect-btn is-ghost" data-act="why">为什么需要授权？</button>'
        : '') +
      '</div>' +
      (isExtension && !result.enabledHere
        ? '<div class="ao3tm-detect-note" hidden>扩展需要单独授权的域名才能注入工具条。点「在 ' +
          escapeText(result.host) +
          ' 上启用」时，浏览器只会让你授权这一个域名。</div>'
        : isExtension
          ? ''
          : '<div class="ao3tm-detect-note" hidden>油猴脚本版没法在运行时申请权限：把下面这行加到脚本头部的 @match 里（脚本管理器里编辑脚本即可），刷新后就能用。</div>' +
            '<code class="ao3tm-detect-code">// @match        ' +
            escapeText(result.protocol === 'http:' ? 'http' : 'https') +
            '://' +
            escapeText(result.host) +
            '/*</code>') +
      '</div>' +
      '<button type="button" class="ao3tm-detect-close" data-act="dismiss" aria-label="关闭">×</button>';

    box.addEventListener('click', function (event) {
      const btn = event.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'dismiss') {
        removeBanner();
        return;
      }
      if (act === 'never') {
        skipped.add(result.host);
        saveSkipped();
        removeBanner();
        return;
      }
      if (act === 'why') {
        const note = box.querySelector('.ao3tm-detect-note');
        if (note) note.hidden = !note.hidden;
        return;
      }
      if (act === 'remember') {
        rememberUserscriptHost(result.host);
        const note = box.querySelector('.ao3tm-detect-note');
        if (note) note.hidden = false;
        const code = box.querySelector('.ao3tm-detect-code');
        if (code) code.hidden = false;
        btn.disabled = true;
        btn.textContent = '已记下';
        return;
      }
      if (act === 'enable') {
        btn.disabled = true;
        btn.textContent = '正在申请授权…';
        enableCurrent(result.host)
          .then(function (outcome) {
            if (outcome && outcome.ok) {
              btn.textContent = '已启用，刷新页面后生效';
              if (root.AO3TM.ui) root.AO3TM.ui.toast('已启用 ' + result.host + '，正在刷新…');
              setTimeout(function () {
                location.reload();
              }, 700);
            } else {
              btn.disabled = false;
              const reason =
                outcome && outcome.reason === 'denied'
                  ? '你取消了授权'
                  : '启用失败：' + ((outcome && outcome.reason) || '未知原因');
              btn.textContent = '重试';
              if (root.AO3TM.ui) root.AO3TM.ui.toast(reason);
            }
          })
          .catch(function (err) {
            btn.disabled = false;
            btn.textContent = '重试';
            if (root.AO3TM.ui) root.AO3TM.ui.toast('启用失败：' + (err && err.message ? err.message : err));
          });
      }
    });

    return box;
  }

  /** 在页面顶部插入横幅（插在 body 最前面，不依赖 AO3 的 DOM 结构） */
  function mountBanner(result) {
    removeBanner();
    if (!result || !result.isAo3) return null;
    if (result.enabledHere) return null; // 已经能用，不用提示
    if (skipped.has(result.host)) return null;
    if (!document.body) return null;

    const box = buildBanner(result);
    document.body.insertBefore(box, document.body.firstChild);
    return box;
  }

  /** 申请权限并注册当前域名，成功后刷新页面 */
  function enableCurrent(host) {
    const api = env && env.chrome;
    if (!api || !api.permissions) return Promise.resolve({ ok: false, reason: 'unsupported' });
    const origins = [];
    if (root.AO3TM.env && root.AO3TM.env.hostToMatchPatterns) {
      root.AO3TM.env.hostToMatchPatterns(host).forEach(function (pattern) {
        origins.push(pattern);
      });
    } else {
      origins.push(env.hostToMatchPattern(host));
    }
    // 必须在用户点击的同一个调用栈里发起申请
    return new Promise(function (resolve) {
      api.permissions.request({ origins: origins }, function (granted) {
        if (api.runtime.lastError || !granted) {
          resolve({ ok: false, reason: 'denied' });
          return;
        }
        api.runtime.sendMessage({ type: 'ao3tm:save-mirror', host: host }, function (result) {
          void api.runtime.lastError;
          resolve(result || { ok: false, reason: 'register-failed' });
        });
      });
    });
  }

  function escapeText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * 自动检测入口。只有拿到「所有网站」权限时才会真的扫描陌生站点，
   * 否则内容脚本本来就不会跑到这些站点上，这里什么也不做。
   */
  function autoRun() {
    if (!env || !detector) return Promise.resolve(null);
    const current = check();
    if (current.enabledHere) return Promise.resolve(current);
    if (!env.isExtension) {
      // 油猴：能跑到这里说明域名没被用户删掉过，但既然不在内置名单里，
      // 还是问一句"要不要记下并加进 @match"，用户点"一直忽略"就不会再弹。
      if (current.isAo3) mountBanner(current);
      return Promise.resolve(current);
    }
    return checkAsync().then(function (result) {
      if (result.canAutoScan && result.isAo3) {
        mountBanner(result);
      }
      return result;
    });
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.autoDetect = {
    BANNER_ID: BANNER_ID,
    SKIP_KEY: SKIP_KEY,
    ALL_URLS: ALL_URLS,
    check: check,
    checkAsync: checkAsync,
    isEnabledHere: isEnabledHere,
    hasAllSitesPermission: hasAllSitesPermission,
    mountBanner: mountBanner,
    removeBanner: removeBanner,
    rememberUserscriptHost: rememberUserscriptHost,
    enableCurrent: enableCurrent,
    autoRun: autoRun,
    clearSkipped: function () {
      skipped.clear();
      saveSkipped();
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
