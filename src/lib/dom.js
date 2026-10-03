/* AO3 标签管家 —— 页面结构解析（普通脚本，挂在 globalThis.AO3TM.dom） */
(function (root) {
  'use strict';

  const M = root.AO3TM.match;

  /** 列表页 / 作品页判定 */
  function isWorkPage() {
    return /^\/works\/\d+/.test(location.pathname) || !!document.querySelector('#workskin');
  }

  function isListPage() {
    if (document.querySelector('.work.blurb, .bookmark.blurb, li.blurb')) return true;
    if (document.querySelector('#main .index.group, #main ol.index')) return true;
    return false;
  }

  /** 统一的作品路径：/works/12345 */
  function hrefToPath(href) {
    if (!href) return '';
    const match = String(href).match(/\/works\/(\d+)/);
    return match ? '/works/' + match[1] : '';
  }

  function toPath(url) {
    try {
      const u = new URL(url, location.origin);
      return hrefToPath(u.pathname) || hrefToPath(u.pathname + u.search);
    } catch (err) {
      return '';
    }
  }

  function workIdOf(el) {
    if (!el) return '';
    const own = el.id && el.id.match(/^work_(\d+)$/);
    if (own) return own[1];
    const link = el.querySelector('a[href*="/works/"]');
    const path = link ? hrefToPath(link.getAttribute('href')) : '';
    return path ? path.replace('/works/', '') : '';
  }

  function clean(text) {
    return String(text || '').replace(/[\u3000\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function pathOf(el) {
    const id = workIdOf(el);
    if (id) return '/works/' + id;
    if (isWorkPage()) return hrefToPath(location.pathname);
    return '';
  }

  function titleOf(el) {
    const node = el.querySelector('h4.heading a, h2.title a, .heading a[href*="/works/"], .title a');
    return clean(node ? node.textContent : '');
  }

  function authorsOf(el) {
    const out = [];
    const seen = Object.create(null);
    const list = el.querySelectorAll('li.author, .byline');
    Array.prototype.forEach.call(list, function (li) {
      const links = li.querySelectorAll('a[href*="/users/"]');
      if (links.length) {
        Array.prototype.forEach.call(links, function (a) {
          const href = a.getAttribute('href') || '';
          const match = href.match(/\/users\/([^/?#]+)/);
          const name = decodeURIComponent(match ? match[1] : a.textContent).trim();
          if (name && !seen[name.toLowerCase()]) {
            seen[name.toLowerCase()] = true;
            out.push(name);
          }
        });
      } else {
        const text = clean(li.textContent).replace(/^(by|de|par|por|von)\s+/i, '');
        const orphan = text.match(/^\[?orphan_account\]?/i) ? 'orphan_account' : '';
        if (orphan && !seen[orphan]) {
          seen[orphan] = true;
          out.push(orphan);
        }
      }
    });
    return out;
  }

  /** 解析标签区里的纯文本标签（blurb 里标签是纯文本，不是链接） */
  /** 形如 "5,120" 的数字（AO3 的 stats 区），不是标签 */
  const NUMERIC_TEXT = /^\d[\d,\s.]*$/;

  /** 形如 "Fluff (12)" / "Fluff · 12" 的计数尾注，标签本体要保留 */
  function stripCountSuffix(text) {
    return clean(text)
      .replace(/\s*[（(]\s*\d[\d,]*\s*[)）]\s*$/, '')
      .replace(/\s*[·•]\s*\d[\d,]*\s*$/, '')
      .trim();
  }

  function isJunkTag(text) {
    const t = clean(text);
    if (!t) return true;
    if (NUMERIC_TEXT.test(t)) return true;
    if (/^\(?\+?\s*\d+\s*more\)?$/i.test(t)) return true;
    if (/^(by|de|par|por|von)\s+/i.test(t)) return true; // 作者行 "by xxx"
    return false;
  }

  /**
   * 从标签容器里取标签。
   * 以每个 <a class="tag"> 为一条准：标签名里可能自带逗号（如 "A, B and C"），
   * 而相邻标签之间也可能没有逗号，靠 split(',') 一定出错。
   */
  function tagsFromContainer(container) {
    const out = [];
    const links = container.querySelectorAll('a.tag');
    Array.prototype.forEach.call(links, function (link) {
      if (link.closest('.ao3tm-tag-actions, .ao3tm-tag-btn')) return;
      const text = stripCountSuffix(link.textContent);
      if (!isJunkTag(text)) out.push(text);
    });
    if (out.length) return out;
    // 没有链接（老结构 / 站点改版）：退回按分隔符解析纯文本
    const clone = container.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('.ao3tm-tag, .ao3tm-any'), function (n) {
      n.remove();
    });
    return parseTagText(clone.textContent).filter(function (t) {
      return !isJunkTag(t);
    });
  }

  /**
   * 解析标签文本。
   * 仅在拿不到 <a class="tag"> 时使用：按逗号 / 换行切开，再清掉计数与作者前缀。
   */
  function parseTagText(text) {
    const raw = String(text || '');
    const parts = raw.indexOf(',') !== -1 ? raw.split(',') : raw.split('\n');
    return parts
      .map(function (part) {
        return stripCountSuffix(part.replace(/^[\s,·、]+|[\s,·、]+$/g, ''));
      })
      .filter(Boolean);
  }

  function blurbTags(el) {
    const out = [];
    const seen = Object.create(null);
    const containers = el.querySelectorAll('.tags');
    Array.prototype.forEach.call(containers, function (container) {
      if (container.closest('[aria-hidden="true"]')) return;
      // 已被我们切分成 span 的标签区直接读 data-tag
      const spans = container.querySelectorAll('.ao3tm-tag[data-tag]');
      if (spans.length) {
        Array.prototype.forEach.call(spans, function (span) {
          const tag = clean(span.getAttribute('data-tag'));
          const key = tag.toLowerCase();
          if (tag && !seen[key]) {
            seen[key] = true;
            out.push(tag);
          }
        });
        return;
      }
      tagsFromContainer(container).forEach(function (tag) {
        const key = tag.toLowerCase();
        if (tag && !seen[key]) {
          seen[key] = true;
          out.push(tag);
        }
      });
    });
    return out;
  }

  /** 作品页标签：带分类，用于展示与打标 */
  const TAG_GROUP_SELECTORS = [
    ['rating', 'dd.rating.tags'],
    ['warning', 'dd.warning.tags'],
    ['relationship', 'dd.relationship.tags'],
    ['character', 'dd.character.tags'],
    ['freeform', 'dd.freeform.tags'],
    ['fandom', 'dd.fandom.tags']
  ];

  function workPageTags() {
    const out = [];
    const seen = Object.create(null);
    TAG_GROUP_SELECTORS.forEach(function (pair) {
      const nodes = document.querySelectorAll(pair[1] + ' a.tag');
      Array.prototype.forEach.call(nodes, function (a) {
        const tag = clean(a.textContent);
        const key = tag.toLowerCase();
        if (tag && !seen[key]) {
          seen[key] = true;
          out.push({ tag: tag, group: pair[0], node: a });
        }
      });
    });
    return out;
  }

  function workPageTagNames() {
    const names = workPageTags().map(function (item) {
      return item.tag;
    });
    if (names.length) return names;
    // 兜底：老皮肤 / 特殊页面
    return parseTagText(
      Array.prototype.map
        .call(document.querySelectorAll('.work.meta.group .tags'), function (n) {
          return n.textContent;
        })
        .join(', ')
    );
  }

  function workPageAuthors() {
    const out = [];
    const seen = Object.create(null);
    Array.prototype.forEach.call(document.querySelectorAll('.work.meta.group a[href*="/users/"]'), function (a) {
      const href = a.getAttribute('href') || '';
      const match = href.match(/\/users\/([^/?#]+)/);
      const name = decodeURIComponent(match ? match[1] : a.textContent).trim();
      if (name && !seen[name]) {
        seen[name] = true;
        out.push(name);
      }
    });
    if (!out.length) {
      const byline = clean((document.querySelector('.byline') || {}).textContent);
      if (/orphan_account/i.test(byline)) out.push('orphan_account');
    }
    return out;
  }

  function workPageTitle() {
    const node = document.querySelector('h2.title.heading, .title.heading');
    return clean(node ? node.textContent : document.title);
  }

  /** 取当前列表页的所有作品卡片（去重：嵌套的 blurb 只保留最外层） */
  function blurbs() {
    const nodes = document.querySelectorAll('.blurb, li.work, li.bookmark, li.series');
    const out = [];
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.closest('.ao3tm-panel, .ao3tm-bar, #ao3tm-fab')) return;
      if (node.parentElement && node.parentElement.closest('.blurb, li.work, li.bookmark')) return;
      if (out.indexOf(node) === -1) out.push(node);
    });
    return out;
  }

  function markProcessed(el, value) {
    if (value === false) {
      el.removeAttribute('data-ao3tm');
      return;
    }
    el.setAttribute('data-ao3tm', '1');
  }

  function isProcessed(el) {
    return el.getAttribute('data-ao3tm') === '1';
  }

  /** 给一段 DOM 找到"标签文本区"并按需切分成可点击标签 */
  function ensureTagSpans(container) {
    if (!container || container.getAttribute('data-ao3tm-tags') === '1') return container;
    if (container.querySelector('.ao3tm-tag')) {
      container.setAttribute('data-ao3tm-tags', '1');
      return container;
    }

    // 以 a.tag 为准取标签：相邻标签之间可能没有逗号，纯文本分割会把它们粘成一条
    const tags = tagsFromContainer(container);
    if (tags.length < 2) {
      container.setAttribute('data-ao3tm-tags', '1');
      return container;
    }

    const frag = document.createDocumentFragment();
    tags.forEach(function (tag, index) {
      if (index > 0) frag.appendChild(document.createTextNode(', '));
      const span = document.createElement('span');
      span.className = 'ao3tm-tag';
      span.setAttribute('data-tag', tag);
      span.textContent = tag;
      frag.appendChild(span);
    });

    container.textContent = '';
    container.appendChild(frag);
    container.setAttribute('data-ao3tm-tags', '1');
    return container;
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.dom = {
    isWorkPage: isWorkPage,
    isListPage: isListPage,
    hrefToPath: hrefToPath,
    toPath: toPath,
    workIdOf: workIdOf,
    pathOf: pathOf,
    titleOf: titleOf,
    authorsOf: authorsOf,
    parseTagText: parseTagText,
    blurbTags: blurbTags,
    workPageTags: workPageTags,
    workPageTagNames: workPageTagNames,
    workPageAuthors: workPageAuthors,
    workPageTitle: workPageTitle,
    blurbs: blurbs,
    markProcessed: markProcessed,
    isProcessed: isProcessed,
    ensureTagSpans: ensureTagSpans,
    clean: clean
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
