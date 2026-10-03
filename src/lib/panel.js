/* AO3 标签管家 —— 规则设置面板（普通脚本，挂在 globalThis.AO3TM.panel）
   同一份代码同时服务站内浮层与扩展弹窗：只依赖传入的挂载节点。 */
(function (root) {
  'use strict';

  const store = root.AO3TM.store;
  const M = root.AO3TM.match;

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
      cog: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.4 2.4 2.7-.4.6 2.7 2.3 1.5-1.3 2.4 1.3 2.4-2.3 1.5-.6 2.7-2.7-.4L12 21.2l-1.4-2.4-2.7.4-.6-2.7L5 15l1.3-2.4L5 10.2l2.3-1.5.6-2.7 2.7.4z"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
      save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M9 20v-6h6v6"/>',
      file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'
    };
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (paths[name] || '') +
      '</svg>'
    );
  }

  const TABS = [
    { id: 'block', label: '屏蔽规则' },
    { id: 'only', label: '只看规则' },
    { id: 'works', label: '作品名单' },
    { id: 'settings', label: '设置' }
  ];

  let panelEl = null;
  let mountPoint = null;
  let activeTab = 'block';
  let searchTerm = '';

  /* --------------------------------- 结构搭建 ------------------------------- */

  function open(mount) {
    mountPoint = mount;
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.className = 'ao3tm-panel-root';
      panelEl.innerHTML =
        '<div class="ao3tm-panel-overlay" data-act="overlay"></div>' +
        '<div class="ao3tm-panel" role="dialog" aria-label="AO3 标签管家">' +
        '<div class="ao3tm-panel-head">' +
        '<div class="ao3tm-panel-title">AO3 标签管家<small>屏蔽 / 只看规则会自动生效并长期记忆</small></div>' +
        '<button type="button" class="ao3tm-icon-btn" data-act="close" title="关闭">' +
        icon('close') +
        '</button>' +
        '</div>' +
        '<div class="ao3tm-panel-tabs"></div>' +
        '<div class="ao3tm-panel-body"></div>' +
        '<div class="ao3tm-panel-foot"></div>' +
        '</div>' +
        '<input type="file" class="ao3tm-file-input" accept="application/json,.json,.txt" tabindex="-1" aria-hidden="true" />';
      panelEl.querySelector('.ao3tm-file-input').addEventListener('change', function (event) {
        handleImportFile(event.target);
      });
      panelEl.addEventListener('click', onClick);
      panelEl.addEventListener('change', onChange);
      panelEl.addEventListener('input', onInput);
    }
    if (panelEl.parentElement !== mount) mount.appendChild(panelEl);
    panelEl.classList.add('is-open');
    render();
    return panelEl;
  }

  function close() {
    if (panelEl) panelEl.classList.remove('is-open');
  }

  function isOpen() {
    return !!(panelEl && panelEl.classList.contains('is-open'));
  }

  function onClick(event) {
    const target = event.target.closest('[data-act]');
    if (!target) return;
    const act = target.getAttribute('data-act');
    if (act === 'close' || act === 'overlay') {
      close();
    } else if (act === 'tab') {
      activeTab = target.getAttribute('data-tab');
      render();
    } else if (act === 'add-rule') {
      addFromInputs();
    } else if (act === 'mirror-add') {
      addMirrorFromInput();
    } else if (act === 'mirror-enable') {
      const host = target.getAttribute('data-host');
      const mod = mirrorModule();
      if (mod && host) {
        mod.enableFromPage(host).then(function (result) {
          if (root.AO3TM.ui) root.AO3TM.ui.toast(mirrorStatusText(result));
          mirrorRows = null;
          loadMirrors();
        });
      }
    } else if (act === 'mirror-disable') {
      removeMirror(target.getAttribute('data-host'));
    } else if (act === 'save-textarea') {
      saveTextarea(target);
    } else if (act === 'export') {
      exportRules();
    } else if (act === 'import') {
      importRules(target);
    } else if (act === 'clear-hidden') {
      store.clearHiddenWorks();
      render();
    } else if (act === 'clear-works') {
      if (window.confirm('清空所有已屏蔽的作品？标签与作者规则不受影响。')) {
        store.clearAll('works');
        render();
      }
    } else if (act === 'clear-all') {
      if (window.confirm('清空全部规则与名单？此操作不可撤销，建议先导出备份。')) {
        store.clearAll('all');
        render();
      }
    } else if (act === 'remove') {
      store.removeRule(target.getAttribute('data-kind'), target.getAttribute('data-pattern'), target.getAttribute('data-mode'));
      render();
    } else if (act === 'edit-rule') {
      openRuleEditor(target.getAttribute('data-kind'), target.getAttribute('data-pattern'), target.getAttribute('data-mode'));
    } else if (act === 'toggle-mode') {
      const kind = target.getAttribute('data-kind');
      const pattern = target.getAttribute('data-pattern');
      const rule = store.rulesOf(kind).filter(function (r) {
        return r.pattern.toLowerCase() === pattern.toLowerCase();
      })[0];
      if (rule) {
        store.updateRule(kind, pattern, { mode: rule.mode === 'block' ? 'allow' : 'block' });
        render();
      }
    } else if (act === 'unblock-work') {
      store.unblockWork(target.getAttribute('data-path'));
      render();
    } else if (act === 'unhide-work') {
      store.unhideWork(target.getAttribute('data-path'));
      render();
    }
  }

  function onChange(event) {
    const input = event.target;
    if (input.matches('[data-setting]')) {
      const key = input.getAttribute('data-setting');
      const patch = {};
      patch[key] = input.type === 'checkbox' ? input.checked : input.value;
      store.updateSettings(patch);
      render();
    }
  }

  let searchTimer = null;

  function onInput(event) {
    const input = event.target;
    if (input.matches('[data-search]')) {
      clearTimeout(searchTimer);
      const value = input.value;
      searchTimer = setTimeout(function () {
        searchTerm = value.trim().toLowerCase();
        render();
      }, 180);
    }
  }

  /* ---------------------------------- 渲染 --------------------------------- */

  function render() {
    if (!panelEl) return;
    const state = store.get();
    const counts = store.counts();

    panelEl.querySelector('.ao3tm-panel-tabs').innerHTML = TABS.map(function (tab) {
      const badge =
        tab.id === 'block'
          ? counts.blockTags + counts.blockAuthors
          : tab.id === 'only'
            ? counts.allowTags + counts.allowAuthors
            : tab.id === 'works'
              ? counts.blockedWorks
              : 0;
      return (
        '<button type="button" class="ao3tm-tab' +
        (activeTab === tab.id ? ' is-active' : '') +
        '" data-act="tab" data-tab="' +
        tab.id +
        '">' +
        esc(tab.label) +
        (badge ? '<span class="ao3tm-tab-badge">' + badge + '</span>' : '') +
        '</button>'
      );
    }).join('');

    const body = panelEl.querySelector('.ao3tm-panel-body');
    if (activeTab === 'block') body.innerHTML = renderRulesTab(state, 'block');
    else if (activeTab === 'only') body.innerHTML = renderRulesTab(state, 'allow');
    else if (activeTab === 'works') body.innerHTML = renderWorksTab(state);
    else body.innerHTML = renderSettingsTab(state);
    if (activeTab === 'settings' && mirrorRows === null) loadMirrors();

    panelEl.querySelector('.ao3tm-panel-foot').innerHTML =
      '<div class="ao3tm-foot-stat">标签规则 ' +
      (counts.blockTags + counts.allowTags) +
      ' 条 · 作者规则 ' +
      (counts.blockAuthors + counts.allowAuthors) +
      ' 条 · 屏蔽作品 ' +
      counts.blockedWorks +
      ' 篇</div>' +
      '<div class="ao3tm-foot-actions">' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="export">' +
      icon('save') +
      '导出</button>' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="import">' +
      icon('file') +
      '导入</button>' +
      '</div>';
  }

  function renderRulesTab(state, mode) {
    const isBlock = mode === 'block';
    const tags = store.rulesToText('tag', mode);
    const authors = store.rulesToText('author', mode);
    const otherModeRules = filterRules(state, 'tag', isBlock ? 'allow' : 'block').concat(
      filterRules(state, 'author', isBlock ? 'allow' : 'block')
    );

    return (
      '<div class="ao3tm-section">' +
      '<div class="ao3tm-hint">' +
      (isBlock
        ? '命中任意一条即隐藏该作品。标签与作者规则都支持：<code>Tag</code> 子串、<code>=Tag</code> 严格相等、<code>~Tag</code> 忽略空格标点、<code>re:正则</code>。'
        : '开启只看后，只保留命中列表的作品；同一标签想反过来用，可在下方"反向规则"里一键切换。') +
      '<br />在 AO3 页面上<b>右键标签</b>也可以直接屏蔽 / 只看，右键作品或作者名同理。' +
      '</div>' +
      '<div class="ao3tm-add-row">' +
      '<select data-kind="tag" class="ao3tm-select"><option value="tag">标签</option><option value="author">作者</option></select>' +
      '<input type="text" class="ao3tm-input" data-add-input="1" placeholder="' +
      (isBlock ? '例如 Fluff 或 re:^A/B/O' : '例如 Fluff 或 某位作者的用户名') +
      '" />' +
      '<button type="button" class="ao3tm-btn" data-act="add-rule" data-mode="' +
      mode +
      '">加入' +
      (isBlock ? '屏蔽' : '只看') +
      '</button>' +
      '</div>' +
      '<div class="ao3tm-textareas">' +
      textareaBlock('标签（每行一条，' + store.rulesToText('tag', mode).split('\n').filter(Boolean).length + '）', 'tag', mode, tags) +
      textareaBlock('作者（每行一条，' + store.rulesToText('author', mode).split('\n').filter(Boolean).length + '）', 'author', mode, authors) +
      '</div>' +
      (otherModeRules.length
        ? '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">' +
          (isBlock ? '当前处于「只看」的规则' : '当前处于「屏蔽」的规则') +
          '（点一下即可切换）</div><div class="ao3tm-chips">' +
          otherModeRules
            .map(function (rule) {
              return (
                '<button type="button" class="ao3tm-chip" data-act="toggle-mode" data-kind="' +
                rule.kind +
                '" data-pattern="' +
                esc(rule.pattern) +
                '" title="切换到' +
                (isBlock ? '屏蔽' : '只看') +
                '">' +
                esc(rule.pattern) +
                '<small>' +
                (rule.kind === 'author' ? '作者' : '标签') +
                '</small></button>'
              );
            })
            .join('') +
          '</div></div>'
        : '') +
      rulesListBlock(state, isBlock ? 'block' : 'allow') +
      '</div>'
    );
  }

  /** 逐条规则列表：每条都能编辑或删除，方便修正以前存错的规则 */
  function rulesListBlock(state, mode) {
    const list = filterRules(state, 'tag', mode)
      .concat(filterRules(state, 'author', mode))
      .sort(function (a, b) {
        return a.pattern.localeCompare(b.pattern, 'zh-Hans-CN');
      });
    if (!list.length) return '';
    return (
      '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">逐条管理（' +
      list.length +
      ' 条，点规则可以改名 / 拆开）</div><div class="ao3tm-chips">' +
      list
        .map(function (rule) {
          return (
            '<span class="ao3tm-chip ao3tm-chip-editable">' +
            '<button type="button" class="ao3tm-chip-edit" data-act="edit-rule" data-kind="' +
            rule.kind +
            '" data-pattern="' +
            esc(rule.pattern) +
            '" data-mode="' +
            mode +
            '" title="点这条可以改名、拆分或删除">' +
            esc(rule.pattern) +
            '<small>' +
            (rule.kind === 'author' ? '作者' : '标签') +
            '</small></button>' +
            '<button type="button" class="ao3tm-chip-x" data-act="remove" data-kind="' +
            rule.kind +
            '" data-pattern="' +
            esc(rule.pattern) +
            '" title="删除这条规则">×</button>' +
            '</span>'
          );
        })
        .join('') +
      '</div></div>'
    );
  }

  /**
   * 规则编辑弹窗：把一条规则改名，或把误粘成一条的多个标签拆开。
   * 用顿号 / 竖线 / 换行分割即可，保存后逐条写入。
   */  function openRuleEditor(kind, pattern, mode) {
    const existing = panelEl.querySelector('.ao3tm-rule-editor');
    if (existing) existing.remove();
    const box = document.createElement('div');
    box.className = 'ao3tm-rule-editor';
    box.innerHTML =
      '<div class="ao3tm-rule-editor-head">编辑' +
      (kind === 'author' ? '作者' : '标签') +
      '规则<small>改完点保存；把误粘成一条的标签用「|」或换行分开即可拆成多条</small></div>' +
      '<textarea class="ao3tm-textarea" spellcheck="false">' +
      esc(pattern) +
      '</textarea>' +
      '<div class="ao3tm-rule-editor-foot">' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-danger" data-act="editor-delete">删除这条</button>' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="editor-cancel">取消</button>' +
      '<button type="button" class="ao3tm-btn" data-act="editor-save">保存</button>' +
      '</div>';
    panelEl.querySelector('.ao3tm-panel').appendChild(box);

    const close = function () {
      box.remove();
    };
    box.addEventListener('click', function (event) {
      const btn = event.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'editor-cancel') {
        close();
        return;
      }
      if (act === 'editor-delete') {
        store.removeRule(kind, pattern, mode);
        close();
        render();
        if (root.AO3TM.ui) root.AO3TM.ui.toast('已删除规则：' + pattern);
        return;
      }
      if (act === 'editor-save') {
        const lines = box
          .querySelector('textarea')
          .value.split(/[\n|｜、]+/)
          .map(function (line) {
            return line.replace(/\s+/g, ' ').trim();
          })
          .filter(Boolean);
        if (!lines.length) {
          store.removeRule(kind, pattern, mode);
        } else {
          // 第一条直接改名，其余作为新规则加进来
          const first = lines[0];
          if (first.toLowerCase() === pattern.toLowerCase()) {
            store.updateRule(kind, pattern, { pattern: first, key: first.toLowerCase() });
          } else {
            store.removeRule(kind, pattern, mode);
            store.addRule(kind, first, mode);
          }
          lines.slice(1).forEach(function (line) {
            store.addRule(kind, line, mode);
          });
        }
        close();
        render();
        if (root.AO3TM.ui) root.AO3TM.ui.toast('已保存 ' + lines.length + ' 条规则');
      }
    });
  }

  function filterRules(state, kind, mode) {
    const bucket = (state.rules[kind] || {})[mode === 'allow' ? 'allow' : 'block'] || {};
    return Object.keys(bucket)
      .map(function (k) {
        return Object.assign({ kind: kind }, bucket[k]);
      })
      .sort(function (a, b) {
        return a.pattern.localeCompare(b.pattern, 'zh-Hans-CN');
      });
  }

  function textareaBlock(label, kind, mode, value) {
    return (
      '<div class="ao3tm-textarea-wrap">' +
      '<div class="ao3tm-subtitle">' +
      esc(label) +
      '</div>' +
      '<textarea class="ao3tm-textarea" data-kind="' +
      kind +
      '" data-mode="' +
      mode +
      '" spellcheck="false" placeholder="每行一个">' +
      esc(value) +
      '</textarea>' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-small" data-act="save-textarea" data-kind="' +
      kind +
      '" data-mode="' +
      mode +
      '">保存这份列表</button>' +
      '</div>'
    );
  }

  function renderWorksTab(state) {
    const blocked = Object.keys(state.blockedWorks)
      .map(function (path) {
        return Object.assign({ path: path }, state.blockedWorks[path]);
      })
      .sort(function (a, b) {
        return (b.ts || 0) - (a.ts || 0);
      });
    const hidden = Object.keys(state.hiddenWorks)
      .map(function (path) {
        return Object.assign({ path: path }, state.hiddenWorks[path]);
      })
      .sort(function (a, b) {
        return (b.ts || 0) - (a.ts || 0);
      });

    const filterFn = function (item) {
      if (!searchTerm) return true;
      return (item.title || item.path).toLowerCase().indexOf(searchTerm) !== -1;
    };

    const rows = function (items, act, emptyText) {
      const list = items.filter(filterFn);
      if (!list.length) return '<div class="ao3tm-empty">' + esc(emptyText) + '</div>';
      return (
        '<div class="ao3tm-list">' +
        list
          .map(function (item) {
            return (
              '<div class="ao3tm-list-row">' +
              '<a class="ao3tm-list-link" href="' +
              esc(item.path) +
              '" target="_blank" rel="noreferrer">' +
              esc(item.title || item.path) +
              '</a>' +
              '<button type="button" class="ao3tm-btn ao3tm-btn-small ao3tm-btn-ghost" data-act="' +
              act +
              '" data-path="' +
              esc(item.path) +
              '">移出</button>' +
              '</div>'
            );
          })
          .join('') +
        '</div>'
      );
    };

    return (
      '<div class="ao3tm-section">' +
      '<div class="ao3tm-add-row">' +
      '<input type="text" class="ao3tm-input" data-search="1" placeholder="按标题筛选…" value="' +
      esc(searchTerm) +
      '" />' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="clear-hidden">清空临时隐藏</button>' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="clear-works">清空屏蔽名单</button>' +
      '</div>' +
      '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">屏蔽名单（' +
      blocked.length +
      '）—— 点快捷屏蔽的作品会记在这里</div>' +
      rows(blocked, 'unblock-work', '还没有屏蔽任何作品') +
      '</div>' +
      '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">临时隐藏（' +
      hidden.length +
      '）—— 只在点"隐藏"时记录，可一键清空</div>' +
      rows(hidden, 'unhide-work', '没有临时隐藏的作品') +
      '</div>' +
      '</div>'
    );
  }

  /* -------------------------------- 镜像站 -------------------------------- */

  /** 镜像站列表（设置页渲染时异步拉取） */
  let mirrorRows = null;
  let mirrorCurrentHost = '';

  function mirrorModule() {
    return root.AO3TM.mirrors || null;
  }

  function loadMirrors() {
    const mod = mirrorModule();
    if (!mod || !mod.overview) return;
    mirrorCurrentHost = location.hostname || '';
    mod
      .overview()
      .then(function (rows) {
        mirrorRows = rows || [];
        if (activeTab === 'settings' && panelEl) render();
      })
      .catch(function () {
        mirrorRows = [];
      });
  }

  function renderMirrorsBlock() {
    const mod = mirrorModule();
    if (!mod) {
      // 油猴脚本版没有 chrome.permissions，域名写死在脚本头里
      return (
        '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">镜像站</div>' +
        '<div class="ao3tm-hint">当前是油猴脚本版：镜像域名写在脚本头的 <code>@match</code> 里。' +
        '需要新增镜像时，编辑脚本头部加一行 <code>@match https://你的域名/*</code> 即可。</div>' +
        '</div>'
      );
    }
    const rows = mirrorRows;
    const body =
      rows === null
        ? '<div class="ao3tm-empty">正在读取已启用的域名…</div>'
        : rows.length
          ? '<div class="ao3tm-list">' +
            rows
              .map(function (row) {
                return (
                  '<div class="ao3tm-list-row">' +
                  '<span class="ao3tm-list-link ao3tm-mirror-host">' +
                  esc(row.host) +
                  (row.preset ? '<small>预置</small>' : '') +
                  '</span>' +
                  '<button type="button" class="ao3tm-btn ao3tm-btn-small' +
                  (row.enabled ? ' ao3tm-btn-ghost' : '') +
                  '" data-act="' +
                  (row.enabled ? 'mirror-disable' : 'mirror-enable') +
                  '" data-host="' +
                  esc(row.host) +
                  '">' +
                  (row.enabled ? '停用' : '启用') +
                  '</button></div>'
                );
              })
              .join('') +
            '</div>'
          : '<div class="ao3tm-empty">还没有启用任何镜像站</div>';

    return (
      '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">镜像站</div>' +
      '<div class="ao3tm-add-row">' +
      '<input type="text" class="ao3tm-input" data-mirror-input="1" placeholder="镜像域名，例如 ao3.example.com" />' +
      '<button type="button" class="ao3tm-btn" data-act="mirror-add">启用</button>' +
      '</div>' +
      '<div class="ao3tm-hint">填域名即可（不用带 https://）。启用时浏览器会弹出授权，只授权你填的那个域名；停用会同时收回授权。</div>' +
      body +
      '</div>'
    );
  }
  function mirrorStatusText(result) {
    if (!result) return '操作失败';
    if (result.ok) return '已启用镜像：' + result.host;
    if (result.reason === 'static') return '这是官方站或本地地址，无需启用';
    if (result.reason === 'invalid') return '域名格式不对，示例：ao3.example.com';
    if (result.reason === 'denied') return '你取消了授权，未启用';
    if (result.reason === 'userscript') return '油猴版请把域名加进脚本头的 @match';
    return '启用失败：' + (result.reason || '未知原因');
  }

  function addMirrorFromInput() {
    const mod = mirrorModule();
    if (!mod || !panelEl) return;
    const input = panelEl.querySelector('input[data-mirror-input]');
    const host = root.AO3TM.env ? root.AO3TM.env.normalizeHost(input ? input.value : '') : '';
    if (!host) {
      if (root.AO3TM.ui) root.AO3TM.ui.toast('域名格式不对，示例：ao3.example.com');
      return;
    }
    // 注意：权限申请必须在用户手势里发起，所以这里直接调，不要放进 await 之后的回调
    mod
      .enableFromPage(host)
      .then(function (result) {
        if (input) input.value = '';
        if (root.AO3TM.ui) root.AO3TM.ui.toast(mirrorStatusText(result));
        mirrorRows = null;
        loadMirrors();
      })
      .catch(function (err) {
        if (root.AO3TM.ui) root.AO3TM.ui.toast('启用失败：' + (err && err.message ? err.message : err));
      });
  }

  function removeMirror(host) {
    const mod = mirrorModule();
    if (!mod) return;
    mod
      .disable(host)
      .then(function () {
        if (root.AO3TM.ui) root.AO3TM.ui.toast('已停用镜像：' + host);
        mirrorRows = null;
        loadMirrors();
      })
      .catch(function () {
        if (root.AO3TM.ui) root.AO3TM.ui.toast('停用失败');
      });
  }

  function renderSettingsTab(state) {
    const s = state.settings;
    const toggle = function (key, label, hint) {
      return (
        '<label class="ao3tm-switch"><input type="checkbox" data-setting="' +
        key +
        '"' +
        (s[key] ? ' checked' : '') +
        ' /><span class="ao3tm-switch-label">' +
        esc(label) +
        (hint ? '<small>' + esc(hint) + '</small>' : '') +
        '</span></label>'
      );
    };

    return (
      '<div class="ao3tm-section">' +
      '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">生效范围</div>' +
      toggle('blockTags', '屏蔽：标签规则', '命中屏蔽标签的作品会被隐藏') +
      toggle('blockAuthors', '屏蔽：作者规则', '命中屏蔽作者的作品会被隐藏') +
      toggle('onlyTags', '只看：标签规则', '开启后只保留命中只看标签的作品') +
      toggle('onlyAuthors', '只看：作者规则', '开启后只保留命中只看作者的作品') +
      toggle('onlyIncludeBlocked', '只看同时受屏蔽规则限制', '关掉后只看模式会强制显示命中只看规则的作品') +
      '</div>' +
      '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">匹配方式</div>' +
      toggle('caseInsensitive', '忽略大小写', '默认开启；关掉后规则严格区分大小写') +
      toggle('fuzzy', '忽略空格与标点差异', '让 A/B/O 与 A B O 视为同一标签') +
      '</div>' +
      '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">显示</div>' +
      toggle('dim', '隐藏项变灰淡出（而非直接移除）', '方便随时确认被隐藏了什么') +
      toggle('showBar', '显示页面统计条', '页面顶部显示本页隐藏数量') +
      toggle('showQuickButtons', '显示卡片快捷按钮', '隐藏 / 屏蔽 按钮') +
      toggle('showTagButtons', '显示标签旁的屏蔽按钮', '鼠标移到标签上时出现') +
      '<label class="ao3tm-field"><span class="ao3tm-switch-label">同系列作品处理<small>列表里出现同一系列的多篇时</small></span>' +
      '<select class="ao3tm-select" data-setting="seriesMode">' +
      option('off', '不处理', s.seriesMode) +
      option('dim', '标记变灰', s.seriesMode) +
      option('hide', '一并隐藏', s.seriesMode) +
      '</select></label>' +
      '<label class="ao3tm-field"><span class="ao3tm-switch-label">深浅色<small>自动=按页面实际背景亮度判定，任何第三方夜间皮肤都能适配</small></span>' +
      '<select class="ao3tm-select" data-setting="themeMode">' +
      option('auto', '自动识别', s.themeMode) +
      option('light', '始终浅色', s.themeMode) +
      option('dark', '始终深色', s.themeMode) +
      '</select></label>' +
      '</div>' +
      '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">界面汉化</div>' +
      toggle('i18n', '开启 AO3 界面汉化', '只翻译站点固定文案（导航、按钮、筛选、统计标签）；正文、摘要、标签、用户名、评论一律不动') +
      toggle('i18nBilingual', '悬停显示原文', '汉化后的元素鼠标悬停会显示英文原句') +
      '<div class="ao3tm-hint">切换开关后当前页面立即生效；已汉化的文案刷新页面会恢复英文。词典在 <code>src/lib/i18n.js</code>，可以自己加词条。</div>' +
      '</div>' +
      renderMirrorsBlock() +
      '<div class="ao3tm-subsection"><div class="ao3tm-subtitle">数据</div>' +
      '<div class="ao3tm-add-row">' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="export">' +
      icon('save') +
      '导出规则</button>' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-ghost" data-act="import">' +
      icon('file') +
      '导入规则</button>' +
      '<button type="button" class="ao3tm-btn ao3tm-btn-danger" data-act="clear-all">' +
      icon('trash') +
      '清空全部规则</button>' +
      '</div>' +
      '<div class="ao3tm-hint">导出的 JSON 含标签/作者规则、屏蔽名单与设置项，可在另一台设备导入。</div>' +
      '</div>' +
      '</div>'
    );
  }

  function option(value, label, current) {
    return '<option value="' + value + '"' + (current === value ? ' selected' : '') + '>' + label + '</option>';
  }

  /* ---------------------------------- 行为 --------------------------------- */

  function addFromInputs() {
    if (!panelEl) return;
    const kind = panelEl.querySelector('.ao3tm-add-row .ao3tm-select').value;
    const input = panelEl.querySelector('.ao3tm-add-row .ao3tm-input[data-add-input]');
    const mode = panelEl.querySelector('[data-act="add-rule"]').getAttribute('data-mode');
    const text = (input.value || '').trim();
    if (!text) return;
    const added = store.addRule(kind, text, mode);
    if (added) {
      input.value = '';
      render();
      if (root.AO3TM.ui) {
        root.AO3TM.ui.toast((mode === 'allow' ? '已加入只看：' : '已加入屏蔽：') + added.pattern);
      }
    }
  }

  function saveTextarea(button) {
    const kind = button.getAttribute('data-kind');
    const mode = button.getAttribute('data-mode');
    const textarea = panelEl.querySelector('textarea[data-kind="' + kind + '"][data-mode="' + mode + '"]');
    const lines = M.textToRules(textarea.value);
    store.replaceRules(kind, lines, mode);
    render();
    if (root.AO3TM.ui) root.AO3TM.ui.toast('已保存 ' + lines.length + ' 条' + (kind === 'tag' ? '标签' : '作者') + '规则');
  }

  function exportRules() {
    const data = JSON.stringify(store.exportData(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ao3-tag-manager-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
    if (root.AO3TM.ui) root.AO3TM.ui.toast('规则已导出');
  }

  function importRules() {
    const input = panelEl && panelEl.querySelector('.ao3tm-file-input');
    if (!input) return;
    input.value = '';
    input.click();
  }

  function handleImportFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      const text = String(reader.result || '');
      let payload = text;
      if (/^\s*[{[]/.test(text)) {
        try {
          payload = JSON.parse(text);
        } catch (err) {
          if (root.AO3TM.ui) root.AO3TM.ui.toast('导入失败：JSON 解析错误');
          return;
        }
      }
      const result = store.importData(payload, { merge: false });
      render();
      if (root.AO3TM.ui) root.AO3TM.ui.toast(result.imported ? '导入完成' : '导入失败：格式无法识别');
    };
    reader.readAsText(file);
  }

  /* ---------------------------------- 导出接口 ------------------------------ */

  function mount(node) {
    return open(node);
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.panel = {
    open: open,
    close: close,
    isOpen: isOpen,
    render: render,
    mount: mount,
    setTab: function (tab) {
      activeTab = tab;
      render();
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
