/* AO3 标签管家 —— 入口（普通脚本，最后加载） */
(function (root) {
  'use strict';

  const HIDDEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 临时隐藏超过 30 天自动清掉

  function pruneOldHidden() {
    const store = root.AO3TM.store;
    const state = store.get();
    const now = Date.now();
    let changed = false;
    Object.keys(state.hiddenWorks).forEach(function (path) {
      const entry = state.hiddenWorks[path];
      if (!entry || !entry.ts || now - entry.ts > HIDDEN_TTL_MS) {
        delete state.hiddenWorks[path];
        changed = true;
      }
    });
    if (changed) store.emit('prune');
  }

  function start() {
    const store = root.AO3TM.store;
    store.ready().then(function () {
      pruneOldHidden();
      root.AO3TM.ui.init();
      if (root.AO3TM.focus) root.AO3TM.focus.apply();
      // 界面汉化：按设置决定是否启动
      if (root.AO3TM.i18n && store.get().settings.i18n) root.AO3TM.i18n.start();

      // 设置里开关汉化后立即生效，不必刷新页面
      store.subscribe(function (state) {
        if (!root.AO3TM.i18n) return;
        if (state.settings.i18n) {
          root.AO3TM.i18n.start();
          root.AO3TM.i18n.schedule();
        } else {
          root.AO3TM.i18n.stop();
        }
      });

      // 镜像站自动检测：拿到"所有网站"权限时，会在陌生站点上判定并给出启用横幅
      if (root.AO3TM.autoDetect) {
        root.AO3TM.autoDetect.autoRun();
      }

      // AO3 用 Turbo 做站内跳转，切换页面后重新扫描
      ['turbo:load', 'turbo:render', 'pjax:end'].forEach(function (name) {
        document.addEventListener(name, function () {
          setTimeout(function () {
            root.AO3TM.ui.refresh();
            if (root.AO3TM.focus) root.AO3TM.focus.apply();
            if (root.AO3TM.autoDetect) root.AO3TM.autoDetect.autoRun();
          }, 60);
        });
      });

      let lastUrl = location.href;
      setInterval(function () {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          root.AO3TM.ui.refresh();
          if (root.AO3TM.focus) root.AO3TM.focus.apply();
          if (root.AO3TM.autoDetect) root.AO3TM.autoDetect.autoRun();
        }
      }, 1200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
