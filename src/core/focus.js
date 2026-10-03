/* AO3 标签管家 —— 键盘快捷键与临时聚焦（普通脚本，挂在 globalThis.AO3TM.focus） */
(function (root) {
  'use strict';

  /** 临时聚焦：只显示含某个关键词的作品，不写规则、刷新即失效 */
  const focusFilter = { active: false, term: '' };

  function applyFocus() {
    const D = root.AO3TM.dom;
    if (!D || !root.AO3TM.filter) return;
    const list = D.blurbs();
    const term = focusFilter.term.toLowerCase();
    list.forEach(function (el) {
      if (!focusFilter.active) {
        el.classList.remove('ao3tm-focus-out');
        return;
      }
      const tags = D.blurbTags(el).join(' , ').toLowerCase();
      const title = (D.titleOf(el) || '').toLowerCase();
      const hit = !term || tags.indexOf(term) !== -1 || title.indexOf(term) !== -1;
      el.classList.toggle('ao3tm-focus-out', !hit);
    });
    let indicator = document.getElementById('ao3tm-focus');
    if (!focusFilter.active) {
      if (indicator) indicator.remove();
      return;
    }
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'ao3tm-focus';
      indicator.className = 'ao3tm-focus';
      document.body.appendChild(indicator);
    }
    indicator.innerHTML =
      '临时聚焦：<b>' +
      escape(focusFilter.term || '全部') +
      '</b>（' +
      document.querySelectorAll('.ao3tm-focus-out').length +
      ' 篇被遮住）<button type="button">退出</button>';
    indicator.querySelector('button').onclick = function () {
      setFocus('');
    };
  }

  function escape(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function setFocus(term) {
    focusFilter.active = !!term;
    focusFilter.term = term || '';
    applyFocus();
  }

  /** 取当前选中的文本或鼠标所在标签，作为聚焦关键词 */
  function currentKeyword() {
    const selection = String(window.getSelection ? window.getSelection().toString() : '').replace(/\s+/g, ' ').trim();
    if (selection) return selection;
    const hovered = document.querySelector('.ao3tm-tag:hover, a.tag:hover');
    if (hovered) return hovered.textContent.replace(/\s+/g, ' ').trim();
    return '';
  }

  function install() {
    document.addEventListener('keydown', function (event) {
      if (event.ctrlKey && event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === 'b' || key === 'f') {
          event.preventDefault();
          if (key === 'b' && root.AO3TM.panel) root.AO3TM.panel.open(document.body);
          if (key === 'f') {
            const term = currentKeyword();
            setFocus(focusFilter.active ? '' : term);
            if (root.AO3TM.ui) {
              root.AO3TM.ui.toast(focusFilter.active ? '临时聚焦：' + (focusFilter.term || '全部') + '（再按一次退出）' : '已退出临时聚焦');
            }
          }
        } else if (key === 'h') {
          event.preventDefault();
          if (root.AO3TM.filter) {
            root.AO3TM.filter.revealAll();
            if (root.AO3TM.ui) root.AO3TM.ui.refresh();
          }
        }
      }
    });

    // 标签按钮的修饰键用法：Shift = 只看，Alt = 屏蔽（在 ui.js 之后监听，先让 ui.js 处理基础点击）
    document.addEventListener(
      'click',
      function (event) {
        const btn = event.target.closest('.ao3tm-tag-btn');
        if (!btn || (!event.shiftKey && !event.altKey)) return;
        const span = btn.closest('.ao3tm-tag');
        const tag = span && span.getAttribute('data-tag');
        if (!tag || !root.AO3TM.store) return;
        event.preventDefault();
        event.stopPropagation();
        const mode = event.shiftKey ? 'allow' : 'block';
        const result = root.AO3TM.store.toggleRule('tag', tag, mode);
        if (root.AO3TM.ui) {
          root.AO3TM.ui.toast(
            result && result.action === 'removed'
              ? '已取消规则：' + tag
              : (mode === 'allow' ? '已加入只看：' : '已加入屏蔽：') + tag
          );
          root.AO3TM.ui.refresh();
        }
      },
      true
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.focus = {
    set: setFocus,
    apply: applyFocus,
    isActive: function () {
      return focusFilter.active;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
