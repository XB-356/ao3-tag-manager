/* AO3 标签管家 —— 界面注入（普通脚本，挂在 globalThis.AO3TM.ui）
   负责：列表底部/顶部统计条、卡片快捷按钮、标签旁屏蔽按钮、作品页工具栏、站内设置面板入口、提示条 */
(function (root) {
  'use strict';

  const store = root.AO3TM.store;
  const M = root.AO3TM.match;
  const D = root.AO3TM.dom;
  const filter = root.AO3TM.filter;

  const NS = 'ao3tm';
  const TOAST_MS = 4200;
  const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (ch) {
      return HTML_ESCAPE[ch];
    });
  }

  function icon(name) {
    const paths = {
      block: '<path d="M6.5 6.5l11 11M12 3a9 9 0 100 18 9 9 0 000-18z"/>',
      only: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
      eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
      eyeOff: '<path d="M3 3l18 18M10.6 6.1A9.9 9.9 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.2 3.9M6.3 7.8C3.7 9.5 2 12 2 12s3.6 6.5 10 6.5c1 0 2-.2 2.8-.5"/>',
      cog: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.4 2.4 2.7-.4.6 2.7 2.3 1.5-1.3 2.4 1.3 2.4-2.3 1.5-.6 2.7-2.7-.4L12 21.2l-1.4-2.4-2.7.4-.6-2.7L5 15l1.3-2.4L5 10.2l2.3-1.5.6-2.7 2.7.4z"/>',
      dash: '<path d="M4 6h16M4 12h10M4 18h7"/>',
      undo: '<path d="M4 10h9a5 5 0 110 10H8"/><path d="M4 10l4-4M4 10l4 4"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>'
    };
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (paths[name] || '') +
      '</svg>'
    );
  }

  function keyOf(el) {
    return D.pathOf(el);
  }

  /* ---------------------------------- 提示条 -------------------------------- */

  let toastTimer = null;

  function toast(message, options) {
    const opts = options || {};
    let node = document.getElementById(NS + '-toast');
    if (!node) {
      node = document.createElement('div');
      node.id = NS + '-toast';
      node.className = NS + '-toast';
      document.body.appendChild(node);
    }
    node.innerHTML =
      '<span class="ao3tm-toast-text">' +
      esc(message) +
      (opts.hint ? '<small class="ao3tm-toast-hint">' + esc(opts.hint) + '</small>' : '') +
      '</span>' +
      (opts.actionLabel ? '<button type="button" class="ao3tm-toast-action">' + esc(opts.actionLabel) + '</button>' : '');
    if (opts.onAction) {
      const btn = node.querySelector('.ao3tm-toast-action');
      btn.addEventListener('click', function () {
        hideToast();
        opts.onAction();
      });
    }
    node.classList.add('ao3tm-toast-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, opts.duration || TOAST_MS);
  }

  function hideToast() {
    const node = document.getElementById(NS + '-toast');
    if (node) node.classList.remove('ao3tm-toast-show');
  }

  /* --------------------------------- 统计条 -------------------------------- */

  function barRoot() {
    let node = document.getElementById(NS + '-bar');
    if (node) return node;
    node = document.createElement('div');
    node.id = NS + '-bar';
    node.className = NS + '-bar';
    const target = document.querySelector('#main') || document.body;
    target.insertBefore(node, target.firstChild);
    return node;
  }

  function renderBar(result) {
    const settings = store.get().settings;
    const existing = document.getElementById(NS + '-bar');
    if (!settings.showBar || !result || !result.stats.total || D.isWorkPage()) {
      if (existing) existing.remove();
      return;
    }
    const node = barRoot();
    const stats = result.stats;
    const revealedCount = filter.countRevealed();
    node.classList.toggle(NS + '-bar-active', stats.hidden > 0 || revealedCount > 0);
    node.innerHTML =
      '<div class="ao3tm-bar-info">' +
      '<span class="ao3tm-bar-title">本页 ' +
      stats.total +
      ' 篇' +
      (stats.hidden ? '，已隐藏 <b>' + stats.hidden + '</b> 篇' : '，没有命中规则的隐藏项') +
      (stats.only ? '（只看模式过滤 ' + stats.only + ' 篇）' : '') +
      (stats.series ? '（同系列 ' + stats.series + ' 篇）' : '') +
      '</span>' +
      (revealedCount ? '<span class="ao3tm-bar-warn">已临时显示 ' + revealedCount + ' 篇</span>' : '') +
      '</div>' +
      '<div class="ao3tm-bar-actions">' +
      (stats.hidden
        ? '<button type="button" class="ao3tm-btn" data-act="reveal">' + icon('eye') + '临时显示</button>'
        : '') +
      (revealedCount
        ? '<button type="button" class="ao3tm-btn" data-act="rehide">' + icon('eyeOff') + '恢复隐藏</button>'
        : '') +
      '<button type="button" class="ao3tm-btn" data-act="panel">' + icon('cog') + '规则设置</button>' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="collapse" title="收起">' +
      icon('close') +
      '</button>' +
      '</div>';

    node.onclick = function (event) {
      const btn = event.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'reveal') {
        filter.revealAll();
        updateFab();
        refresh();
      } else if (act === 'rehide') {
        filter.resetReveal();
        updateFab();
        refresh();
      } else if (act === 'panel') {
        openPanel();
      } else if (act === 'collapse') {
        node.classList.add(NS + '-bar-collapsed');
      }
    };
  }

  /* -------------------------------- 快捷按钮 ------------------------------- */

  function injectBlurb(el) {
    if (el.querySelector(':scope > .ao3tm-tools')) return;
    const settings = store.get().settings;
    const tools = document.createElement('div');
    tools.className = NS + '-tools';

    if (settings.showQuickButtons) {
      const hideBtn = document.createElement('button');
      hideBtn.type = 'button';
      hideBtn.className = NS + '-btn ao3tm-tool ao3tm-tool-hide';
      hideBtn.title = '隐藏这篇（写进屏蔽名单，可用底部的临时显示恢复）';
      hideBtn.innerHTML = icon('eyeOff') + '<span>隐藏</span>';
      hideBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        const path = keyOf(el);
        if (!path) return;
        store.hideWork(path);
        toast('已隐藏《' + (D.titleOf(el) || path) + '》', {
          actionLabel: '撤销',
          onAction: function () {
            store.unhideWork(path);
          }
        });
      });
      tools.appendChild(hideBtn);

      const blockBtn = document.createElement('button');
      blockBtn.type = 'button';
      blockBtn.className = NS + '-btn ao3tm-tool ao3tm-tool-menu';
      blockBtn.title = '屏蔽这篇作品 / 作者 / 标签';
      blockBtn.innerHTML = icon('block') + '<span>屏蔽</span>';
      blockBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        openBlurbMenu(el, blockBtn);
      });
      tools.appendChild(blockBtn);
    }

    const flag = document.createElement('span');
    flag.className = NS + '-flag';
    flag.setAttribute('aria-hidden', 'true');
    tools.appendChild(flag);

    const heading = el.querySelector('h4.heading, .heading');
    const header = el.querySelector('.header.module, .header');
    if (heading && heading.parentElement === el) {
      el.insertBefore(tools, heading.nextSibling);
    } else if (header && header.parentElement === el) {
      el.insertBefore(tools, header.nextSibling);
    } else if (heading && heading.parentElement) {
      // 标题在 .header 里，工具条要放到 .header 之后，保证 flag 是卡片的直接子元素
      const box = heading.closest('.header.module, .header') || heading;
      if (box !== el && box.parentElement === el) el.insertBefore(tools, box.nextSibling);
      else if (box !== el) box.parentElement.insertBefore(tools, box.nextSibling);
      else el.insertBefore(tools, heading.nextSibling);
    } else {
      el.insertBefore(tools, el.firstChild);
    }
  }

  function closeMenus() {
    Array.prototype.forEach.call(document.querySelectorAll('.' + NS + '-menu'), function (node) {
      node.remove();
    });
  }

  /**
   * 打开卡片菜单。
   * @param {Element} el 作品卡片
   * @param {Element|null} anchor 定位参照（按钮）；为空时用 point
   * @param {{x:number,y:number}|null} point 视口坐标（右键位置）
   * @param {{tag?:string, author?:string}} [focus] 只显示某个标签 / 作者的快捷操作（右键时用）
   */
  function openBlurbMenu(el, anchor, point, focus) {
    closeMenus();
    const path = keyOf(el);
    const title = D.titleOf(el);
    const authors = D.authorsOf(el);
    const tags = D.blurbTags(el).slice(0, 12);
    const blocked = path && store.isWorkBlocked(path);
    const onlyTag = focus && focus.tag;
    const onlyAuthor = focus && !onlyTag && focus.author;

    const row = function (kind, text, isBlock, isOnly, index) {
      return (
        '<div class="ao3tm-menu-row"><span class="ao3tm-menu-name" title="' +
        esc(text) +
        '">' +
        esc(text) +
        '</span>' +
        '<button type="button" class="ao3tm-chip' +
        (isBlock ? ' is-on' : '') +
        '" data-act="' +
        kind +
        '-block" data-index="' +
        index +
        '">屏蔽</button>' +
        '<button type="button" class="ao3tm-chip' +
        (isOnly ? ' is-on' : '') +
        '" data-act="' +
        kind +
        '-only" data-index="' +
        index +
        '">只看</button></div>'
      );
    };

    const authorRows = authors
      .map(function (author, index) {
        return row('author', author, store.hasRule('author', author, 'block'), store.hasRule('author', author, 'allow'), index);
      })
      .join('');

    const tagRows = tags
      .map(function (tag, index) {
        return row('tag', tag, store.hasRule('tag', tag, 'block'), store.hasRule('tag', tag, 'allow'), index);
      })
      .join('');

    const headText = onlyTag ? onlyTag : onlyAuthor ? onlyAuthor + store.AUTHOR_LABEL_SUFFIX : title || path || '这篇作品';
    const headSub = onlyTag || onlyAuthor ? title || path || '' : authors.length ? authors.join('、') : '';

    let body = '';
    if (onlyTag) {
      // 右键标签：把该标签的操作放在最上面
      body = '<div class="ao3tm-menu-label">这个标签</div>' + tagRows;
    } else if (onlyAuthor) {
      body = '<div class="ao3tm-menu-label">这个作者</div>' + authorRows;
    } else {
      body = authors.length ? '<div class="ao3tm-menu-label">作者</div>' + authorRows : '';
      body += tags.length ? '<div class="ao3tm-menu-label">标签</div>' + tagRows : '';
    }

    const menu = document.createElement('div');
    menu.className = NS + '-menu';
    menu.innerHTML =
      '<div class="ao3tm-menu-head">' +
      esc(headText) +
      (headSub ? '<small>' + esc(headSub) + '</small>' : '') +
      '</div>' +
      '<button type="button" class="ao3tm-menu-item" data-act="work">' +
      icon(blocked ? 'undo' : 'block') +
      (blocked ? '移出屏蔽名单' : '屏蔽这篇作品') +
      '</button>' +
      body +
      '<div class="ao3tm-menu-foot"><button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="panel">' +
      icon('cog') +
      '规则设置</button></div>';

    document.body.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();
    const viewW = document.documentElement.clientWidth;
    const viewH = document.documentElement.clientHeight;
    let left;
    let top;
    if (point) {
      // 右键：以鼠标位置为锚
      left = window.scrollX + point.x;
      top = window.scrollY + point.y;
    } else {
      const rect = anchor.getBoundingClientRect();
      left = window.scrollX + rect.left;
      top = window.scrollY + rect.bottom + 6;
    }
    if (left + menuRect.width > window.scrollX + viewW - 12) {
      left = window.scrollX + viewW - menuRect.width - 12;
    }
    if (top + menuRect.height > window.scrollY + viewH - 12) {
      const above = point ? window.scrollY + point.y - menuRect.height : window.scrollY + (anchor ? anchor.getBoundingClientRect().top : 0) - menuRect.height - 6;
      top = Math.max(window.scrollY + 8, above);
    }
    menu.style.left = Math.max(window.scrollX + 8, left) + 'px';
    menu.style.top = top + 'px';

    menu.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      const btn = event.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      const index = Number(btn.getAttribute('data-index'));
      if (act === 'work' && path) {
        if (store.isWorkBlocked(path)) {
          store.unblockWork(path);
          toast('已移出屏蔽名单');
        } else {
          store.blockWork(path, title);
          toast('已屏蔽《' + (title || path) + '》', {
            actionLabel: '撤销',
            onAction: function () {
              store.unblockWork(path);
            }
          });
        }
        closeMenus();
      } else if (act === 'panel') {
        closeMenus();
        openPanel();
      } else if (act.indexOf('tag-') === 0 && tags[index]) {
        const result = store.toggleRule('tag', tags[index], act === 'tag-only' ? 'allow' : 'block');
        toast(ruleMessage(result, tags[index]));
        refresh();
      } else if (act.indexOf('author-') === 0 && authors[index]) {
        const result = store.toggleRule('author', authors[index], act === 'author-only' ? 'allow' : 'block');
        toast(ruleMessage(result, authors[index] + store.AUTHOR_LABEL_SUFFIX));
        refresh();
      }
    });
    return menu;
  }

  function ruleMessage(result, label) {
    if (!result) return '规则未变化';
    if (result.action === 'removed') return '已取消规则：' + label;
    return (result.mode === 'allow' ? '已加入只看：' : '已加入屏蔽：') + label;
  }

  /** 标签旁的屏蔽 / 只看小按钮 */
  function injectTagButtons(el) {
    const settings = store.get().settings;
    const containers = el.querySelectorAll('.tags');
    Array.prototype.forEach.call(containers, function (container) {
      D.ensureTagSpans(container);
      const spans = container.querySelectorAll('.ao3tm-tag');
      Array.prototype.forEach.call(spans, function (span) {
        const tag = span.getAttribute('data-tag');
        if (!tag) return;
        // 每次都重新同步状态：规则可能从别处（面板/弹窗/右键菜单）变更
        const existing = span.querySelector(':scope > .ao3tm-tag-actions');
        const isBlock = store.hasRule('tag', tag, 'block');
        const isOnly = store.hasRule('tag', tag, 'allow');
        span.classList.toggle('ao3tm-tag-blocked', isBlock);
        span.classList.toggle('ao3tm-tag-only', isOnly);
        if (!settings.showTagButtons) {
          if (existing) existing.remove();
          return;
        }
        if (existing) {
          const blockBtn = existing.querySelector('button[data-mode="block"]');
          const allowBtn = existing.querySelector('button[data-mode="allow"]');
          if (blockBtn) blockBtn.classList.toggle('is-on', isBlock);
          if (allowBtn) allowBtn.classList.toggle('is-on', isOnly);
          return;
        }
        const actions = document.createElement('span');
        actions.className = 'ao3tm-tag-actions';
        actions.innerHTML =
          '<button type="button" class="ao3tm-tag-btn' +
          (isBlock ? ' is-on' : '') +
          '" data-mode="block" title="屏蔽这个标签">' +
          icon('block') +
          '</button>' +
          '<button type="button" class="ao3tm-tag-btn' +
          (isOnly ? ' is-on' : '') +
          '" data-mode="allow" title="只看这个标签">' +
          icon('only') +
          '</button>';
        actions.addEventListener('click', function (event) {
          const btn = event.target.closest('button[data-mode]');
          if (!btn) return;
          event.preventDefault();
          event.stopPropagation();
          const mode = btn.getAttribute('data-mode');
          const result = store.toggleRule('tag', tag, mode);
          toast(ruleMessage(result, tag));
          refresh();
        });
        span.appendChild(actions);
      });
    });
  }

  /* ------------------------------- 作品页工具栏 ------------------------------ */

  function injectWorkPage() {
    if (document.getElementById(NS + '-workbar')) return;
    const target = document.querySelector('#workskin .preface .tags, #workskin .preface');
    if (!target) return;
    const settings = store.get().settings;
    const path = D.hrefToPath(location.pathname);
    const title = D.workPageTitle();
    const authors = D.workPageAuthors();

    const bar = document.createElement('div');
    bar.id = NS + '-workbar';
    bar.className = NS + '-workbar';
    const blocked = store.isWorkBlocked(path);
    bar.innerHTML =
      '<span class="ao3tm-workbar-label">标签管家</span>' +
      '<button type="button" class="ao3tm-btn" data-act="work">' +
      icon(blocked ? 'undo' : 'block') +
      (blocked ? '移出屏蔽名单' : '屏蔽这篇作品') +
      '</button>' +
      authors
        .map(function (author, index) {
          return (
            '<button type="button" class="ao3tm-btn" data-act="author-block" data-index="' +
            index +
            '">' +
            icon('block') +
            '屏蔽作者 ' +
            esc(author) +
            '</button>' +
            '<button type="button" class="ao3tm-btn" data-act="author-only" data-index="' +
            index +
            '">' +
            icon('only') +
            '只看 TA' +
            '</button>'
          );
        })
        .join('') +
      '<button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="panel">' +
      icon('cog') +
      '规则设置</button>';

    bar.addEventListener('click', function (event) {
      const btn = event.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      const index = Number(btn.getAttribute('data-index'));
      if (act === 'work' && path) {
        if (store.isWorkBlocked(path)) {
          store.unblockWork(path);
          toast('已移出屏蔽名单');
        } else {
          store.blockWork(path, title);
          toast('已屏蔽《' + (title || path) + '》', {
            actionLabel: '撤销',
            onAction: function () {
              store.unblockWork(path);
            }
          });
        }
      } else if (act === 'panel') {
        openPanel();
      } else if (act.indexOf('author-') === 0 && authors[index]) {
        const result = store.toggleRule('author', authors[index], act === 'author-only' ? 'allow' : 'block');
        toast(ruleMessage(result, authors[index] + store.AUTHOR_LABEL_SUFFIX));
        refresh();
      }
    });

    if (settings.showQuickButtons) target.appendChild(bar);

    // 作品页标签也挂按钮
    const tags = D.workPageTags();
    tags.forEach(function (item) {
      const a = item.node;
      if (a.parentElement && a.parentElement.classList.contains('ao3tm-tag-wrap')) return;
      const wrap = document.createElement('span');
      wrap.className = 'ao3tm-tag-wrap';
      a.parentNode.insertBefore(wrap, a);
      wrap.appendChild(a);
      const actions = document.createElement('span');
      actions.className = 'ao3tm-tag-actions is-static';
      const isBlock = store.hasRule('tag', item.tag, 'block');
      const isOnly = store.hasRule('tag', item.tag, 'allow');
      actions.innerHTML =
        '<button type="button" class="ao3tm-tag-btn' +
        (isBlock ? ' is-on' : '') +
        '" data-mode="block" title="屏蔽这个标签">' +
        icon('block') +
        '</button>' +
        '<button type="button" class="ao3tm-tag-btn' +
        (isOnly ? ' is-on' : '') +
        '" data-mode="allow" title="只看这个标签">' +
        icon('only') +
        '</button>';
      actions.addEventListener('click', function (event) {
        const btn = event.target.closest('button[data-mode]');
        if (!btn) return;
        event.preventDefault();
        event.stopPropagation();
        const result = store.toggleRule('tag', item.tag, btn.getAttribute('data-mode'));
        toast(ruleMessage(result, item.tag));
        refresh();
      });
      wrap.appendChild(actions);
      a.classList.toggle('ao3tm-tag-blocked', isBlock);
      a.classList.toggle('ao3tm-tag-only', isOnly);
    });
  }

  /* --------------------------------- 悬浮按钮 ------------------------------- */

  function injectFab() {
    if (document.getElementById(NS + '-fab')) return;
    const fab = document.createElement('div');
    fab.id = NS + '-fab';
    fab.className = NS + '-fab';
    fab.innerHTML =
      '<button type="button" class="ao3tm-fab-main" title="AO3 标签管家：规则设置">' + icon('dash') + '</button>' +
      '<button type="button" class="ao3tm-fab-toggle" title="临时显示本页被隐藏的作品">' + icon('eye') + '</button>' +
      '<button type="button" class="ao3tm-fab-sub" title="收起悬浮按钮">' + icon('close') + '</button>';
    document.body.appendChild(fab);
    const buttons = fab.querySelectorAll('button');
    buttons[0].addEventListener('click', function () {
      openPanel();
    });
    // 临时显示 / 恢复隐藏：同一个按钮来回切
    const toggleBtn = buttons[1];
    toggleBtn.addEventListener('click', function () {
      if (filter.countRevealed() > 0) {
        filter.resetReveal();
        toast('已恢复隐藏');
      } else if (document.querySelectorAll('.ao3tm-hidden').length === 0) {
        toast('本页没有被隐藏的作品');
        return;
      } else {
        filter.revealAll();
        toast('已临时显示本页被隐藏的作品', {
          actionLabel: '恢复隐藏',
          onAction: function () {
            filter.resetReveal();
            updateFab();
            refresh();
          }
        });
      }
      // 立即同步开关外观，不等下一次 run()
      updateFab();
      refresh();
    });
    buttons[2].addEventListener('click', function () {
      fab.remove();
    });
    updateFab(toggleBtn);
  }

  /** 悬浮按钮的"临时显示"状态同步：图标与提示随状态变化 */
  function updateFab(toggleBtn) {
    const btn = toggleBtn || document.querySelector('.' + NS + '-fab-toggle');
    if (!btn) return;
    filter.pruneRevealed();
    const revealed = filter.countRevealed();
    const hidden = document.querySelectorAll('.ao3tm-hidden').length;
    btn.classList.toggle('is-on', revealed > 0);
    btn.innerHTML = icon(revealed > 0 ? 'eyeOff' : 'eye');
    btn.title =
      revealed > 0
        ? '恢复隐藏（已临时显示 ' + revealed + ' 篇）'
        : hidden > 0
          ? '临时显示本页被隐藏的 ' + hidden + ' 篇作品'
          : '临时显示本页被隐藏的作品（当前没有隐藏项）';
  }

  /* ---------------------------------- 面板 --------------------------------- */

  function openPanel() {
    if (root.AO3TM.panel) root.AO3TM.panel.open(document.body);
  }

  /* ---------------------------------- 调度 --------------------------------- */

  let scheduled = false;
  let lastStats = null;

  function refresh() {
    if (scheduled) return;
    scheduled = true;
    let done = false;
    const execute = function () {
      if (done) return;
      done = true;
      scheduled = false;
      try {
        run();
      } catch (err) {
        console.error('[AO3 标签管家] 刷新出错', err);
      }
    };
    // requestAnimationFrame 在后台标签页里可能不触发，用定时器兜底
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(execute);
    setTimeout(execute, 250);
  }

  function run() {
    const result = filter.apply();
    lastStats = result.stats;
    if (root.AO3TM.ui) root.AO3TM.ui.lastStats = result.stats;
    applyTheme();
    injectAll(result);
    renderBar(result);
    updateFab();
    // 界面汉化：注入完成后跑一轮（字典里没有的文案不会被改动）
    if (root.AO3TM.i18n) root.AO3TM.i18n.schedule();
    document.documentElement.setAttribute('data-ao3tm-ready', '1');
  }

  function injectAll() {
    const settings = store.get().settings;
    if (D.isWorkPage()) {
      injectWorkPage();
      return;
    }
    D.blurbs().forEach(function (el) {
      injectBlurb(el);
      if (settings.showTagButtons) {
        try {
          injectTagButtons(el);
        } catch (err) {
          /* 标签区结构异常时忽略这一篇 */
        }
      } else {
        Array.prototype.forEach.call(el.querySelectorAll('.ao3tm-tag-actions'), function (n) {
          n.remove();
        });
      }
    });
  }

  /* ------------------------------ 右键目标识别 ----------------------------- */

  /** 当前右键指向的标签 / 作品 / 作者（供原生右键菜单动态切换） */
  let lastContextHit = null;
  let contextHintShown = false;

  function tagNameFromLink(node) {
    if (!node || node.tagName !== 'A' || !node.classList.contains('tag')) return '';
    const href = node.getAttribute('href') || '';
    const match = href.match(/\/tags\/([^/?#]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]).replace(/\+/g, ' ').replace(/\*/g, '/').trim();
      } catch (err) {
        /* 解码失败时退回链接文字 */
      }
    }
    return D.clean(node.textContent);
  }

  function tagOf(node) {
    if (!node || !node.closest) return '';
    // 内容脚本切分过的标签
    const span = node.closest('.ao3tm-tag[data-tag]');
    if (span) return span.getAttribute('data-tag');
    // 作品页上的标签链接
    const link = node.closest('a.tag');
    if (link) return tagNameFromLink(link);
    // blurb 里的标签是纯文本：用坐标在标签区里定位
    const container = node.closest('.tags');
    if (container && node.nodeType === 1) {
      const spans = Array.prototype.slice.call(container.querySelectorAll('.ao3tm-tag'));
      const hit = spans.filter(function (item) {
        const rect = item.getBoundingClientRect();
        return item === node || (item.contains(node) && rect.width > 0);
      })[0];
      if (hit) return hit.getAttribute('data-tag');
    }
    return '';
  }

  function authorOf(node) {
    if (!node || !node.closest) return '';
    const link = node.closest('a[href*="/users/"]');
    if (link) {
      const match = (link.getAttribute('href') || '').match(/\/users\/([^/?#]+)/);
      if (match) {
        try {
          return decodeURIComponent(match[1]).trim();
        } catch (err) {
          return match[1];
        }
      }
    }
    return '';
  }

  function recordContextHit(event) {
    const target = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
    let hit = { kind: 'none' };

    if (target) {
      const tag = tagOf(target);
      const author = authorOf(target);
      const blurb = target.closest('.blurb, li.work, li.bookmark');

      if (tag) {
        hit = { kind: 'tag', tag: tag };
      } else if (author && !target.closest('.tags')) {
        hit = { kind: 'author', author: author };
      } else if (author) {
        // 作者名也在 .stats 之类的列表里，同样按作者处理
        hit = { kind: 'author', author: author };
      } else if (blurb) {
        hit = { kind: 'work', path: D.pathOf(blurb), title: D.titleOf(blurb) };
      } else if (D.isWorkPage()) {
        hit = { kind: 'work', path: D.hrefToPath(location.pathname), title: D.workPageTitle() };
      }
    }

    lastContextHit = hit;
    return hit;
  }

  /**
   * 右键直接弹页内菜单。
   * 不依赖 service worker 的菜单可见性时序（MV3 worker 休眠时，原生菜单项往往还没更新就被弹出来了），
   * 所以右键标签 / 作品 / 作者时由页面自己接管。
   */
  function openContextMenuAt(event, target) {
    const tag = tagOf(target);
    const author = authorOf(target);
    const blurb = target.closest('.blurb, li.work, li.bookmark');
    const point = { x: event.clientX, y: event.clientY };

    if (tag && blurb) {
      event.preventDefault();
      event.stopPropagation();
      openBlurbMenu(blurb, null, point, { tag: tag });
      return true;
    }
    if (author && blurb) {
      event.preventDefault();
      event.stopPropagation();
      openBlurbMenu(blurb, null, point, { author: author });
      return true;
    }
    if (blurb) {
      event.preventDefault();
      event.stopPropagation();
      openBlurbMenu(blurb, null, point, null);
      return true;
    }
    // 作品页：没有卡片容器时，也能对页面上任意标签 / 作者操作
    if (D.isWorkPage()) {
      if (tag || author) {
        event.preventDefault();
        event.stopPropagation();
        openWorkPageContextMenu(tag, author, point);
        return true;
      }
    }
    return false;
  }

  /** 作品页上的右键菜单（没有卡片容器，直接给标签 / 作者操作） */
  function openWorkPageContextMenu(tag, author, point) {
    closeMenus();
    const title = D.workPageTitle();
    const path = D.hrefToPath(location.pathname);
    const label = tag || author + store.AUTHOR_LABEL_SUFFIX;
    const kind = tag ? 'tag' : 'author';
    const value = tag || author;
    const isBlock = store.hasRule(kind, value, 'block');
    const isOnly = store.hasRule(kind, value, 'allow');
    const blocked = path && store.isWorkBlocked(path);

    const menu = document.createElement('div');
    menu.className = NS + '-menu';
    menu.innerHTML =
      '<div class="ao3tm-menu-head">' +
      esc(label) +
      '<small>' +
      esc(title || '') +
      '</small></div>' +
      '<div class="ao3tm-menu-row"><span class="ao3tm-menu-name">' +
      (tag ? '这个标签' : '这个作者') +
      '</span><button type="button" class="ao3tm-chip' +
      (isBlock ? ' is-on' : '') +
      '" data-act="one-block">屏蔽</button><button type="button" class="ao3tm-chip' +
      (isOnly ? ' is-on' : '') +
      '" data-act="one-only">只看</button></div>' +
      '<button type="button" class="ao3tm-menu-item" data-act="work">' +
      icon(blocked ? 'undo' : 'block') +
      (blocked ? '移出屏蔽名单' : '屏蔽这篇作品') +
      '</button>' +
      '<div class="ao3tm-menu-foot"><button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="panel">' +
      icon('cog') +
      '规则设置</button></div>';

    document.body.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();
    const viewW = document.documentElement.clientWidth;
    const viewH = document.documentElement.clientHeight;
    let left = window.scrollX + point.x;
    let top = window.scrollY + point.y;
    if (left + menuRect.width > window.scrollX + viewW - 12) left = window.scrollX + viewW - menuRect.width - 12;
    if (top + menuRect.height > window.scrollY + viewH - 12) {
      top = Math.max(window.scrollY + 8, window.scrollY + point.y - menuRect.height);
    }
    menu.style.left = Math.max(window.scrollX + 8, left) + 'px';
    menu.style.top = top + 'px';

    menu.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      const btn = event.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'one-block' || act === 'one-only') {
        const result = store.toggleRule(kind, value, act === 'one-only' ? 'allow' : 'block');
        toast(ruleMessage(result, label));
        refresh();
      } else if (act === 'work' && path) {
        if (store.isWorkBlocked(path)) {
          store.unblockWork(path);
          toast('已移出屏蔽名单');
        } else {
          store.blockWork(path, title);
          toast('已屏蔽《' + (title || path) + '》', {
            actionLabel: '撤销',
            onAction: function () {
              store.unblockWork(path);
            }
          });
        }
        closeMenus();
      } else if (act === 'panel') {
        closeMenus();
        openPanel();
      }
    });
  }

  /* ------------------------------ 右键菜单执行 ----------------------------- */

  function applyContextAction(action) {
    // 内容脚本刚重载过时可能没有右键目标，退化成"在当前页重新识别不到就报失败"
    const hit = lastContextHit;
    if (!hit || hit.kind === 'none') return { ok: false, reason: 'no-context' };

    if (action === 'tag-block' || action === 'tag-only') {
      if (!hit.tag) return { ok: false, reason: 'no-tag' };
      const result = store.toggleRule('tag', hit.tag, action === 'tag-only' ? 'allow' : 'block');
      const added = result && result.action === 'added';
      toast(ruleMessage(result, hit.tag), {
        // 首次用右键时提一句，之后不再打扰
        hint: added && !contextHintShown ? '右键标签即可屏蔽 / 只看' : '',
        actionLabel: added ? '撤销' : '',
        onAction: added
          ? function () {
              store.toggleRule('tag', hit.tag, action === 'tag-only' ? 'allow' : 'block');
            }
          : null
      });
      if (added) contextHintShown = true;
      refresh();
      return { ok: true, action: action, tag: hit.tag };
    }

    if (action === 'work-block') {
      const path = hit.path || D.hrefToPath(location.pathname);
      if (!path) return { ok: false, reason: 'no-work' };
      const title = hit.title || D.workPageTitle();
      if (store.isWorkBlocked(path)) {
        store.unblockWork(path);
        toast('已移出屏蔽名单：' + (title || path));
      } else {
        store.blockWork(path, title);
        toast('已屏蔽《' + (title || path) + '》', {
          actionLabel: '撤销',
          onAction: function () {
            store.unblockWork(path);
          }
        });
      }
      refresh();
      return { ok: true, action: action, path: path };
    }

    if (action === 'author-block') {
      if (!hit.author) return { ok: false, reason: 'no-author' };
      const result = store.toggleRule('author', hit.author, 'block');
      toast(ruleMessage(result, hit.author + store.AUTHOR_LABEL_SUFFIX));
      refresh();
      return { ok: true, action: action, author: hit.author };
    }

    return { ok: false, reason: 'unknown-action' };
  }

  /* ------------------------------ 主题（深色）适配 ---------------------------- */

  /**
   * AO3 的夜间外观可能来自：
   *   1. 系统深色 + 官方默认皮肤
   *   2. 官方夜间皮肤
   *   3. 用户自己写的第三方皮肤（选择器千奇百怪，猜不出来）
   * 所以这里不猜选择器，直接量页面实际背景色的亮度，再决定用深色还是浅色配色。
   */
  function parseRgb(value) {
    const match = String(value || '').match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(function (n) {
      return isNaN(n);
    })) {
      return null;
    }
    const alpha = parts.length > 3 ? parts[3] : 1;
    if (alpha === 0) return null; // 全透明，要看上层
    return { r: parts[0], g: parts[1], b: parts[2] };
  }

  function luminance(rgb) {
    return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  }

  /** 返回 'dark' | 'light' */
  function detectPageTheme() {
    const anchors = [document.querySelector('#main'), document.querySelector('#outer'), document.body];
    for (let i = 0; i < anchors.length; i++) {
      const node = anchors[i];
      if (!node) continue;
      let current = node;
      let depth = 0;
      while (current && depth < 4) {
        const rgb = parseRgb(getComputedStyle(current).backgroundColor);
        if (rgb) return luminance(rgb) < 0.45 ? 'dark' : 'light';
        current = current.parentElement;
        depth += 1;
      }
    }
    // 量不到就退回系统偏好
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  let lastAppliedTheme = null;

  function applyTheme() {
    const settings = store.get().settings;
    const mode = settings.themeMode || 'auto';
    let theme;
    if (mode === 'dark') theme = 'dark';
    else if (mode === 'light') theme = 'light';
    else theme = detectPageTheme();
    // 只在真正变化时写属性，避免与站点自身的样式更新互相触发
    if (theme !== lastAppliedTheme) {
      lastAppliedTheme = theme;
      document.documentElement.setAttribute('data-ao3tm-theme', theme);
    }
    return theme;
  }

  /** 主题检测只依赖"当前计算出来的背景色"，所以轮询兜底即可，成本极低 */
  let themeTimer = null;

  function watchTheme() {
    if (themeTimer) return;
    themeTimer = setInterval(function () {
      try {
        applyTheme();
      } catch (err) {
        /* ignore */
      }
    }, 2000);
  }

  /* -------------------------------- 页面监听 ------------------------------- */

  function watch() {
    const observer = new MutationObserver(function (mutations) {
      let relevant = false;
      mutations.forEach(function (mutation) {
        if (!relevant && mutation.addedNodes && mutation.addedNodes.length) {
          Array.prototype.forEach.call(mutation.addedNodes, function (node) {
            if (relevant || node.nodeType !== 1) return;
            if (node.classList && (node.classList.contains('ao3tm-bar') || node.classList.contains('ao3tm-panel'))) return;
            if (node.classList && (node.classList.contains('blurb') || node.classList.contains('work'))) relevant = true;
            else if (node.querySelector && node.querySelector('.blurb, #workskin')) relevant = true;
          });
        }
      });
      if (relevant) refresh();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    store.ready().then(function () {
      run();
      injectFab();
      watch();
      document.addEventListener('click', function (event) {
        if (!event.target.closest('.' + NS + '-menu, .ao3tm-tool-menu')) closeMenus();
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          closeMenus();
          if (root.AO3TM.panel) root.AO3TM.panel.close();
        }
      });
      // 右键：先记录目标（供原生菜单/快捷键用），命中标签或卡片则由页面自己弹菜单
      document.addEventListener(
        'contextmenu',
        function (event) {
          const target = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
          recordContextHit(event);
          if (!target) return;
          openContextMenuAt(event, target);
        },
        true
      );
      store.subscribe(function () {
        refresh();
      });
      // 站内通知 / 其它标签页写入后刷新页内按钮状态
      try {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area !== 'local' || !changes[store.STORAGE_KEY]) return;
          store.read();
        });
      } catch (err) {
        /* ignore */
      }
      // 站点换肤（html/body 的 class 或内联样式变化）后重新判定深浅色
      try {
        const themeObserver = new MutationObserver(function () {
          applyTheme();
        });
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-theme']
        });
        themeObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-theme']
        });
      } catch (err) {
        /* ignore */
      }
      // 有些皮肤是切换 <style>/<link> 内容，不会改属性，用低频轮询兜底
      watchTheme();
      // 系统深浅色切换
      if (window.matchMedia) {
        try {
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
        } catch (err) {
          /* 老浏览器忽略 */
        }
      }
    });
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.ui = {
    init: init,
    refresh: refresh,
    toast: toast,
    openPanel: openPanel,
    injectAll: injectAll,
    icon: icon,
    esc: esc,
    renderBar: renderBar,
    applyContextAction: applyContextAction,
    recordContextHit: recordContextHit,
    applyTheme: applyTheme,
    detectPageTheme: detectPageTheme,
    lastContextHit: function () {
      return lastContextHit;
    },
    lastStats: null
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
