/* AO3 标签管家 —— 规则存储层（内容脚本 / service worker 共用，普通脚本，挂在 globalThis.AO3TM.store） */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'ao3tm_state_v1';

  const DEFAULT_SETTINGS = {
    blockTags: true, // 屏蔽命中的作品（标签）
    blockAuthors: true, // 屏蔽命中的作品（作者）
    onlyTags: true, // 只看模式：标签
    onlyAuthors: true, // 只看模式：作者
    onlyIncludeBlocked: false, // 只看是否也受屏蔽规则限制
    caseInsensitive: true,
    fuzzy: true, // 关掉 = 严格全等匹配
    dim: true, // 隐藏方式：变灰淡出（否则彻底移除）
    showBar: true, // 显示页面统计条
    showQuickButtons: true, // 显示列表内的快捷屏蔽按钮
    showTagButtons: true, // 在标签旁显示屏蔽按钮
    themeMode: 'auto', // auto=按页面背景亮度自动判定 | light | dark
    i18n: false, // 是否汉化 AO3 界面文案（只翻界面，不碰用户内容）
    i18nBilingual: false, // 汉化后鼠标悬停显示原文
    seriesMode: 'off' // off | dim | hide —— 同系列作品处理（仅列表页可用）
  };

  /** 布尔设置的历史写法（'off'/'on'）统一成布尔，避免 'off' 被当成真值 */
  const BOOLEAN_SETTINGS = ['blockTags', 'blockAuthors', 'onlyTags', 'onlyAuthors', 'onlyIncludeBlocked', 'caseInsensitive', 'fuzzy', 'dim', 'showBar', 'showQuickButtons', 'showTagButtons', 'i18n', 'i18nBilingual'];

  function normalizeSettings(raw) {
    const merged = Object.assign({}, DEFAULT_SETTINGS, raw || {});
    BOOLEAN_SETTINGS.forEach(function (key) {
      const value = merged[key];
      if (typeof value === 'string') merged[key] = value === 'on' || value === 'true';
      else merged[key] = value !== false && value !== 0 && value != null ? !!value : false;
    });
    merged.themeMode = ['auto', 'light', 'dark'].indexOf(merged.themeMode) === -1 ? 'auto' : merged.themeMode;
    merged.seriesMode = ['off', 'dim', 'hide'].indexOf(merged.seriesMode) === -1 ? 'off' : merged.seriesMode;
    return merged;
  }

  const DEFAULT_STATE = {
    version: 1,
    revision: 0,
    settings: Object.assign({}, DEFAULT_SETTINGS),
    /** 作品屏蔽名单: path -> {title, ts} */
    blockedWorks: {},
    /** 本站会话内隐藏的作品: path -> ts */
    hiddenWorks: {},
    /** 规则: "tag"|"author" -> { block: {小写规则: rule}, allow: {小写规则: rule} } */
    rules: { tag: { block: {}, allow: {} }, author: { block: {}, allow: {} } }
  };

  const AUTHOR_LABEL_SUFFIX = '（作者）';

  let cache = null;
  let loading = null;
  let pending = false;
  let lastWritten = null;
  const listeners = new Set();

  function fingerprint(value) {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return String(Math.random());
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(raw) {
    const state = clone(DEFAULT_STATE);
    if (!raw || typeof raw !== 'object') return state;
    state.version = 1;
    state.revision = Number(raw.revision) || 0;
    state.settings = normalizeSettings(raw.settings);
    state.blockedWorks = sanitizeRecord(raw.blockedWorks, ['title']);
    state.hiddenWorks = sanitizeRecord(raw.hiddenWorks, []);
    ['tag', 'author'].forEach(function (kind) {
      const src = (raw.rules && raw.rules[kind]) || {};
      const buckets = { block: {}, allow: {} };
      const put = function (rule) {
        if (rule) buckets[rule.mode][rule.key] = rule;
      };
      if (Array.isArray(src)) {
        // 兼容极早期版本：纯字符串数组
        src.forEach(function (pattern) {
          put(makeRule(pattern, 'block', state.settings.caseInsensitive));
        });
      } else if (src && typeof src === 'object') {
        const nested = !!(src.block || src.allow);
        if (nested) {
          ['block', 'allow'].forEach(function (mode) {
            const bucket = src[mode] || {};
            Object.keys(bucket).forEach(function (key) {
              const value = bucket[key] || {};
              const rule = makeRule(value.pattern || key, mode, value.caseSensitive);
              if (rule) put(Object.assign(rule, { ts: value.ts || rule.ts }));
            });
          });
        } else {
          // 旧版扁平结构：每个模式各占一个键，这里按模式重新分桶
          Object.keys(src).forEach(function (key) {
            const value = src[key];
            const pattern = typeof value === 'string' ? value : value && value.pattern;
            const mode = value && value.mode === 'allow' ? 'allow' : 'block';
            const rule = makeRule(pattern, mode, value ? value.caseSensitive : undefined);
            if (rule) put(Object.assign(rule, { ts: (value && value.ts) || rule.ts }));
          });
        }
      }
      state.rules[kind] = buckets;
    });
    return state;
  }

  function sanitizeRecord(src, extraKeys) {
    const out = {};
    if (!src || typeof src !== 'object') return out;
    Object.keys(src).forEach(function (key) {
      const value = src[key];
      const entry = { ts: (value && value.ts) || Date.now() };
      extraKeys.forEach(function (k) {
        if (value && value[k]) entry[k] = String(value[k]);
      });
      out[key] = entry;
    });
    return out;
  }

  function makeRule(pattern, mode, caseSensitive) {
    const text = String(pattern == null ? '' : pattern).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const cs = caseSensitive === undefined ? false : !!caseSensitive;
    return {
      key: cs ? text : text.toLowerCase(),
      pattern: text,
      mode: mode === 'allow' ? 'allow' : 'block',
      caseSensitive: cs,
      ts: Date.now()
    };
  }

  function get() {
    if (cache) return cache;
    return loadSync();
  }

  function loadSync() {
    // storage.local.get() 在内容脚本里可以同步取值；万一环境不支持，退回默认状态，
    // 之后 ready() 的异步读取会把真实数据补上（见 shouldAdopt）。
    let raw = null;
    try {
      const items = chrome.storage.local.get(STORAGE_KEY);
      raw = items ? items[STORAGE_KEY] : null;
    } catch (err) {
      raw = null;
    }
    if (raw === undefined || raw === null) {
      cache = cache || normalize(null);
      return cache;
    }
    cache = normalize(raw);
    return cache;
  }

  /**
   * 是否采用从存储读到的快照。
   * 关键点：写入后 chrome.storage.onChanged 会在同一个 tick 内触发，那时新值可能还没落盘；
   * 直接采用会把刚加的规则读没（自己覆盖自己）。所以：
   *   1) 内容与最近一次自己写入的一致 -> 忽略；
   *   2) 对方修订号不大于本地 -> 忽略（本地更新）。
   */
  function shouldAdopt(incoming) {
    if (lastWritten !== null && fingerprint(incoming) === lastWritten) return false;
    const current = cache;
    if (current && incoming.revision <= current.revision) return false;
    return true;
  }

  function applyIncoming(raw) {
    const incoming = normalize(raw);
    if (!shouldAdopt(incoming)) return cache;
    cache = incoming;
    return cache;
  }

  function ready() {
    if (loading) return loading;
    loading = new Promise(function (resolve) {
      try {
        chrome.storage.local.get(STORAGE_KEY, function (items) {
          if (chrome.runtime.lastError) {
            cache = cache || normalize(null);
            resolve(cache);
            return;
          }
          resolve(applyIncoming(items && items[STORAGE_KEY]));
        });
      } catch (err) {
        cache = cache || normalize(null);
        resolve(cache);
      }
    });
    return loading;
  }

  function read() {
    try {
      chrome.storage.local.get(STORAGE_KEY, function (items) {
        if (chrome.runtime.lastError) return;
        applyIncoming(items && items[STORAGE_KEY]);
        notify('remote');
      });
    } catch (err) {
      /* ignore */
    }
    return cache;
  }

  function persist() {
    if (!cache) return;
    pending = true;
    const payload = {};
    payload[STORAGE_KEY] = clone(cache);
    lastWritten = fingerprint(cache);
    try {
      chrome.storage.local.set(payload, function () {
        pending = false;
        void chrome.runtime.lastError;
      });
    } catch (err) {
      pending = false;
    }
  }

  function notify(source) {
    const snapshot = clone(cache);
    listeners.forEach(function (fn) {
      try {
        fn(snapshot, source);
      } catch (err) {
        console.error('[AO3 标签管家] listener 出错', err);
      }
    });
  }

  function emit(source) {
    if (cache) cache.revision = (Number(cache.revision) || 0) + 1;
    persist();
    notify(source || 'local');
  }

  function subscribe(fn) {
    listeners.add(fn);
    return function () {
      listeners.delete(fn);
    };
  }

  /* ---------------------------------- 规则 --------------------------------- */

  /** 某个分类下的全部规则（两个模式合并） */
  function rulesOf(kind, mode) {
    const state = get();
    const buckets = state.rules[kind] || { block: {}, allow: {} };
    const modes = mode ? [mode] : ['block', 'allow'];
    const out = [];
    modes.forEach(function (m) {
      const bucket = buckets[m] || {};
      Object.keys(bucket).forEach(function (k) {
        out.push(bucket[k]);
      });
    });
    return out;
  }

  function bucket(kind, mode) {
    const state = get();
    if (!state.rules[kind]) state.rules[kind] = { block: {}, allow: {} };
    const wanted = mode === 'allow' ? 'allow' : 'block';
    if (!state.rules[kind][wanted]) state.rules[kind][wanted] = {};
    return state.rules[kind][wanted];
  }

  function addRule(kind, pattern, mode, options) {
    const state = get();
    const opts = options || {};
    const wanted = mode === 'allow' ? 'allow' : 'block';
    const caseSensitive = opts.caseSensitive === undefined ? state.settings.caseInsensitive === false : !!opts.caseSensitive;
    const rule = makeRule(stripKindLabel(pattern), wanted, caseSensitive);
    if (!rule) return null;
    bucket(kind, wanted)[rule.key] = rule;
    emit(opts.source || 'rule-add');
    return rule;
  }

  function removeRule(kind, pattern, mode) {
    const state = get();
    const text = stripKindLabel(String(pattern == null ? '' : pattern).replace(/\s+/g, ' ').trim());
    if (!text) return false;
    const buckets = state.rules[kind] || {};
    const modes = mode ? [mode] : ['block', 'allow'];
    let removed = false;
    modes.forEach(function (m) {
      const b = buckets[m] || {};
      if (b[text] || b[text.toLowerCase()]) {
        delete b[text];
        delete b[text.toLowerCase()];
        removed = true;
      }
    });
    if (removed) emit('rule-remove');
    return removed;
  }

  function toggleRule(kind, pattern, mode) {
    const state = get();
    const wanted = mode === 'allow' ? 'allow' : 'block';
    const text = stripKindLabel(String(pattern == null ? '' : pattern).replace(/\s+/g, ' ').trim());
    if (!text) return null;
    const key = text.toLowerCase();
    const b = bucket(kind, wanted);
    if (b[key]) {
      delete b[key];
      emit('rule-toggle');
      return { action: 'removed', pattern: text, mode: wanted };
    }
    const rule = makeRule(text, wanted, state.settings.caseInsensitive === false);
    b[key] = rule;
    emit('rule-toggle');
    return { action: 'added', pattern: text, mode: wanted };
  }

  function hasRule(kind, pattern, mode) {
    const state = get();
    const text = stripKindLabel(String(pattern == null ? '' : pattern).replace(/\s+/g, ' ').trim());
    if (!text) return false;
    const buckets = state.rules[kind] || {};
    const modes = mode ? [mode] : ['block', 'allow'];
    return modes.some(function (m) {
      const b = buckets[m] || {};
      return !!(b[text] || b[text.toLowerCase()]);
    });
  }

  function updateRule(kind, pattern, patch) {
    const state = get();
    const text = stripKindLabel(String(pattern == null ? '' : pattern).replace(/\s+/g, ' ').trim());
    if (!text) return false;
    const buckets = state.rules[kind] || {};
    let found = null;
    let foundMode = null;
    ['block', 'allow'].some(function (m) {
      const b = buckets[m] || {};
      const rule = b[text] || b[text.toLowerCase()];
      if (rule) {
        found = rule;
        foundMode = m;
        return true;
      }
      return false;
    });
    if (!found) return false;
    const nextMode = patch && patch.mode && patch.mode !== foundMode ? (patch.mode === 'allow' ? 'allow' : 'block') : foundMode;
    Object.assign(found, patch || {});
    if (nextMode !== foundMode) {
      delete buckets[foundMode][found.key];
      found.mode = nextMode;
      buckets[nextMode][found.key] = found;
    }
    emit('rule-update');
    return true;
  }

  /** 一次性写入某个分类 + 某个模式的完整规则列表（用于批量编辑框） */
  function replaceRules(kind, lines, mode) {
    const wanted = mode === 'allow' ? 'allow' : 'block';
    const next = {};
    const cs = get().settings.caseInsensitive === false;
    lines.forEach(function (line) {
      const rule = makeRule(line, wanted, cs);
      if (rule) next[rule.key] = rule;
    });
    // 只替换该模式所在的桶，另一模式原样保留
    bucket(kind, wanted);
    get().rules[kind][wanted] = next;
    emit('rules-replace');
  }

  function rulesToText(kind, mode) {
    return rulesOf(kind, mode)
      .sort(function (a, b) {
        return a.pattern.localeCompare(b.pattern, 'zh-Hans-CN');
      })
      .map(function (rule) {
        return rule.pattern;
      })
      .join('\n');
  }

  function stripKindLabel(text) {
    return String(text || '').replace(/\s*[（(](作者|author)[)）]\s*$/i, '').trim();
  }

  /* --------------------------------- 作品操作 -------------------------------- */

  function workTitleFromDoc() {
    const node = document.querySelector('h2.title.heading a, h2.title a, .title a');
    return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function blockWork(path, title) {
    const state = get();
    state.blockedWorks[path] = { ts: Date.now(), title: title || workTitleFromDoc() };
    emit('work-block');
  }

  function unblockWork(path) {
    const state = get();
    if (state.blockedWorks[path]) {
      delete state.blockedWorks[path];
      emit('work-unblock');
    }
  }

  function isWorkBlocked(path) {
    return !!get().blockedWorks[path];
  }

  function hideWork(path) {
    const state = get();
    state.hiddenWorks[path] = { ts: Date.now() };
    emit('work-hide');
  }

  function unhideWork(path) {
    const state = get();
    if (state.hiddenWorks[path]) {
      delete state.hiddenWorks[path];
      emit('work-unhide');
    }
  }

  function isWorkHidden(path) {
    return !!get().hiddenWorks[path];
  }

  function clearHiddenWorks() {
    const state = get();
    state.hiddenWorks = {};
    emit('work-unhide-all');
  }

  function updateSettings(patch) {
    const state = get();
    state.settings = Object.assign({}, state.settings, patch || {});
    emit('settings');
    return state.settings;
  }

  function resetSettings() {
    const state = get();
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    emit('settings');
  }

  /* --------------------------------- 导入导出 -------------------------------- */

  function exportData() {
    const state = get();
    return {
      app: 'ao3-tag-manager',
      version: state.version,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      blockedWorks: state.blockedWorks,
      hiddenWorks: state.hiddenWorks,
      rules: state.rules
    };
  }

  function importData(payload, options) {
    const opts = options || {};
    const state = get();
    // 兼容纯文本：一行一条屏蔽规则
    if (typeof payload === 'string') {
      payload.split(/\r?\n/).forEach(function (line) {
        const text = line.trim();
        if (!text || text.charAt(0) === '#') return;
        const authorMatch = text.match(/^(.*?)\s*(?:[（(]作者[)）]|<-|@author:)\s*$/i);
        if (authorMatch) addRule('author', authorMatch[1], 'block');
        else addRule('tag', text, 'block');
      });
      emit('import');
      return { imported: true, mode: 'text' };
    }
    if (!payload || typeof payload !== 'object') return { imported: false };
    const merge = opts.merge !== false;
    const incoming = normalize(payload);
    if (!merge) {
      state.blockedWorks = incoming.blockedWorks;
      state.hiddenWorks = incoming.hiddenWorks;
      state.rules = incoming.rules;
      if (opts.settings !== false) state.settings = incoming.settings;
    } else {
      state.blockedWorks = Object.assign({}, state.blockedWorks, incoming.blockedWorks);
      state.hiddenWorks = Object.assign({}, state.hiddenWorks, incoming.hiddenWorks);
      ['tag', 'author'].forEach(function (kind) {
        state.rules[kind] = {
          block: Object.assign({}, state.rules[kind].block, incoming.rules[kind].block),
          allow: Object.assign({}, state.rules[kind].allow, incoming.rules[kind].allow)
        };
      });
      if (opts.settings) state.settings = Object.assign({}, state.settings, incoming.settings);
    }
    emit('import');
    return {
      imported: true,
      mode: merge ? 'merge' : 'replace',
      counts: counts()
    };
  }

  function counts() {
    return {
      blockedWorks: Object.keys(get().blockedWorks).length,
      hiddenWorks: Object.keys(get().hiddenWorks).length,
      blockTags: countRules('tag', 'block'),
      allowTags: countRules('tag', 'allow'),
      blockAuthors: countRules('author', 'block'),
      allowAuthors: countRules('author', 'allow'),
      totalRules: rulesOf('tag').length + rulesOf('author').length
    };
  }

  function countRules(kind, mode) {
    const b = (get().rules[kind] || {})[mode === 'allow' ? 'allow' : 'block'] || {};
    return Object.keys(b).length;
  }

  function clearAll(scope) {
    const state = get();
    const which = scope || 'all';
    if (which === 'all' || which === 'tags') state.rules.tag = { block: {}, allow: {} };
    if (which === 'all' || which === 'authors') state.rules.author = { block: {}, allow: {} };
    if (which === 'all' || which === 'works') state.blockedWorks = {};
    if (which === 'all' || which === 'hidden') state.hiddenWorks = {};
    emit('clear');
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.store = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    DEFAULT_STATE: DEFAULT_STATE,
    AUTHOR_LABEL_SUFFIX: AUTHOR_LABEL_SUFFIX,
    get: get,
    read: read,
    ready: ready,
    subscribe: subscribe,
    emit: emit,
    rulesOf: rulesOf,
    addRule: addRule,
    removeRule: removeRule,
    toggleRule: toggleRule,
    hasRule: hasRule,
    updateRule: updateRule,
    replaceRules: replaceRules,
    rulesToText: rulesToText,
    stripKindLabel: stripKindLabel,
    blockWork: blockWork,
    unblockWork: unblockWork,
    isWorkBlocked: isWorkBlocked,
    hideWork: hideWork,
    unhideWork: unhideWork,
    isWorkHidden: isWorkHidden,
    clearHiddenWorks: clearHiddenWorks,
    updateSettings: updateSettings,
    resetSettings: resetSettings,
    exportData: exportData,
    importData: importData,
    counts: counts,
    clearAll: clearAll
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
