/* AO3 标签管家 —— 过滤执行（普通脚本，挂在 globalThis.AO3TM.filter） */
(function (root) {
  'use strict';

  const store = root.AO3TM.store;
  const M = root.AO3TM.match;
  const D = root.AO3TM.dom;

  /** 用户点"全部显示"后临时放行的作品（仅本站会话有效） */
  const revealed = new Set();

  const SERIES_MIN_SHARED = 2;

  function setHidden(el, hidden, settings) {
    el.classList.toggle('ao3tm-hidden', hidden);
    if (hidden) {
      el.setAttribute('data-ao3tm-hidden', '1');
      if (settings.dim) {
        el.style.removeProperty('display');
        el.classList.add('ao3tm-dim');
      } else {
        el.style.display = 'none';
        el.classList.remove('ao3tm-dim');
      }
    } else {
      el.removeAttribute('data-ao3tm-hidden');
      el.classList.remove('ao3tm-dim');
      el.style.removeProperty('display');
    }
  }

  function isHidden(el) {
    return el.getAttribute('data-ao3tm-hidden') === '1';
  }

  function stamp(el, reasons, extra) {
    const parts = (reasons || []).map(function (reason) {
      if (reason.kind === 'only') return '不在只看列表';
      if (reason.kind === 'author') return '作者：' + (reason.value || reason.pattern);
      if (reason.kind === 'block-override') return '同时命中屏蔽规则';
      return reason.value || reason.pattern;
    });
    const text = parts.filter(Boolean).slice(0, 4).join('、');
    el.setAttribute('data-ao3tm-why', text || '');
    el.setAttribute('data-ao3tm-reason', (extra || '') || text || '');
    el.classList.toggle('ao3tm-has-flag', !!text);
  }

  function clearStamp(el) {
    el.removeAttribute('data-ao3tm-why');
    el.removeAttribute('data-ao3tm-reason');
    el.classList.remove('ao3tm-has-flag');
  }

  /* ------------------------------- 同系列标记 ------------------------------- */

  function seriesSets(list) {
    const groups = new Map();
    list.forEach(function (el) {
      const parent = el.parentElement;
      if (!parent) return;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });

    const result = new Map(); // el -> groupKey
    groups.forEach(function (items) {
      if (items.length < 3) return;
      const tagSets = items.map(function (el) {
        return D.blurbTags(el).map(function (t) {
          return t.toLowerCase();
        });
      });
      items.forEach(function (el, index) {
        const mine = tagSets[index];
        if (mine.length < SERIES_MIN_SHARED) return;
        const shared = items.some(function (other, otherIndex) {
          if (otherIndex === index) return false;
          const theirs = tagSets[otherIndex];
          const overlap = mine.filter(function (tag) {
            return theirs.indexOf(tag) !== -1;
          });
          return overlap.length >= SERIES_MIN_SHARED;
        });
        if (shared) result.set(el, 'series');
      });
    });
    return result;
  }

  /* ---------------------------------- 主流程 -------------------------------- */

  function apply() {
    const state = store.get();
    const settings = state.settings;
    const stats = { total: 0, visible: 0, hidden: 0, blocked: 0, only: 0, series: 0, matched: false };
    const paths = [];

    const collect = function (el) {
      const path = D.pathOf(el);
      const tags = D.blurbTags(el);
      const authors = D.authorsOf(el);
      return { path: path, tags: tags, authors: authors };
    };

    // 1) 作者 / 标签规则
    if (D.isWorkPage()) {
      applyWorkPage(state, settings, stats);
    } else {
      const list = D.blurbs();
      const series = settings.seriesMode && settings.seriesMode !== 'off' ? seriesSets(list) : new Map();
      list.forEach(function (el) {
        stats.total += 1;
        const info = collect(el);
        if (info.path) paths.push(info.path);

        const verdict = M.evaluate({
          tags: info.tags,
          authors: info.authors,
          settings: settings,
          rules: state.rules
        });
        const manual = info.path && store.isWorkBlocked(info.path);
        const manualHide = info.path && store.isWorkHidden(info.path);

        let hidden = false;
        let why = '';
        let kind = '';
        if (manual) {
          hidden = true;
          why = '手动加入屏蔽名单';
          kind = 'work';
        } else if (verdict.blocked) {
          hidden = true;
          why = '';
          kind = verdict.only ? 'only' : 'rule';
        }
        if (manualHide) {
          hidden = true;
          why = '手动隐藏';
          kind = 'work';
        }
        if (hidden && info.path && revealed.has(info.path)) {
          hidden = false;
          why = '';
          kind = '';
        }

        if (hidden) {
          stats.hidden += 1;
          if (kind === 'only') stats.only += 1;
          else stats.blocked += 1;
          stamp(el, kind === 'work' ? [{ kind: 'work', pattern: why }] : verdict.reasons, kind);
          setHidden(el, true, settings);
        } else {
          stats.visible += 1;
          clearStamp(el);
          setHidden(el, false, settings);
        }

        const isSeries = series.get(el) === 'series';
        el.classList.toggle('ao3tm-series', isSeries);

        if (isSeries && settings.seriesMode === 'hide' && !hidden) {
          hidden = true;
          stats.hidden += 1;
          stats.visible -= 1;
          stats.series += 1;
          clearStamp(el);
          setHidden(el, true, settings);
          el.setAttribute('data-ao3tm-reason', '同系列');
          el.setAttribute('data-ao3tm-why', '同系列作品已被隐藏');
        } else if (isSeries && settings.seriesMode === 'dim' && !hidden) {
          stats.series += 1;
          el.classList.add('ao3tm-series-dim');
        } else {
          el.classList.remove('ao3tm-series-dim');
        }
      });
      stats.matched = stats.hidden > 0;
    }

    document.documentElement.setAttribute('data-ao3tm-hidden-count', String(stats.hidden));
    document.documentElement.setAttribute('data-ao3tm-total', String(stats.total));
    return { stats: stats, paths: paths, state: state };
  }

  function applyWorkPage(state, settings, stats) {
    stats.total = 1;
    stats.visible = 1;
    const path = D.hrefToPath(location.pathname);
    const verdict = M.evaluate({
      tags: D.workPageTagNames(),
      authors: D.workPageAuthors(),
      settings: settings,
      rules: state.rules
    });
    const manual = (path && store.isWorkBlocked(path)) || (path && store.isWorkHidden(path));
    const root = document.querySelector('#main');
    if (!root) return;
    if (verdict.blocked || manual) {
      stats.blocked = 1;
      stats.hidden = 1;
      stats.visible = 0;
      stats.matched = true;
      root.classList.add('ao3tm-work-page-blocked');
      const reasons = manual ? [{ kind: 'work', pattern: '手动加入屏蔽名单' }] : verdict.reasons;
      stamp(root, reasons, 'work');
    } else {
      root.classList.remove('ao3tm-work-page-blocked');
      clearStamp(root);
    }
  }

  function revealAll() {
    const list = D.blurbs();
    list.forEach(function (el) {
      const path = D.pathOf(el);
      if (path && isHidden(el)) revealed.add(path);
    });
    return apply().stats;
  }

  function resetReveal() {
    revealed.clear();
    return apply().stats;
  }

  /**
   * 丢弃已经不需要"临时显示"的记录：
   * 作品还在页面上就保留（它仍然是"被规则隐藏、当前被临时放行"的状态），
   * 已经不在页面上的（翻页、解除屏蔽后重建了卡片）就丢掉，
   * 否则按钮会一直停在"恢复隐藏"，点下去却又什么都没发生。
   */
  function pruneRevealed() {
    if (!revealed.size) return false;
    const onPage = new Set();
    D.blurbs().forEach(function (el) {
      const path = D.pathOf(el);
      if (path) onPage.add(path);
    });
    let changed = false;
    revealed.forEach(function (path) {
      if (!onPage.has(path)) {
        revealed.delete(path);
        changed = true;
      }
    });
    return changed;
  }

  function hasRevealed() {
    return revealed.size > 0;
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.filter = {
    apply: apply,
    revealAll: revealAll,
    resetReveal: resetReveal,
    pruneRevealed: pruneRevealed,
    hasRevealed: hasRevealed,
    listRevealed: function () {
      return Array.from(revealed);
    },
    countRevealed: function () {
      return revealed.size;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
