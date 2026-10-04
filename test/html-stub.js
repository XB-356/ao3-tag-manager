/* 测试用的极简 HTML → DOM 桩：够跑 dom.js / i18n.js 的真实逻辑
   （不是通用解析器，只覆盖 AO3 页面结构里用到的那些选择器） */
'use strict';

class HtmlEl {
  constructor(tag, attrs) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.attrs = attrs || {};
    this.childNodes = [];
    this.parentElement = null;
  }
  get className() {
    return this.attrs.class || '';
  }
  get classList() {
    const list = this.className.split(/\s+/).filter(Boolean);
    const self = this;
    return {
      contains: (name) => list.indexOf(name) !== -1,
      add: (name) => {
        if (list.indexOf(name) === -1) {
          list.push(name);
          self.attrs.class = list.join(' ');
        }
      },
      remove: (name) => {
        const i = list.indexOf(name);
        if (i !== -1) {
          list.splice(i, 1);
          self.attrs.class = list.join(' ');
        }
      },
      toggle: (name, force) => {
        const has = list.indexOf(name) !== -1;
        const want = force === undefined ? !has : !!force;
        if (want && !has) list.push(name);
        if (!want && has) list.splice(list.indexOf(name), 1);
        self.attrs.class = list.join(' ');
        return want;
      }
    };
  }
  get style() {
    this.attrs.style = this.attrs.style || {};
    const store = this.attrs.style;
    return {
      display: store.display || '',
      removeProperty: (name) => {
        delete store[name];
      },
      setProperty: (name, value) => {
        store[name] = value;
      }
    };
  }
  get textContent() {
    return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
  }
  set textContent(value) {
    this.childNodes = [{ nodeType: 3, nodeValue: String(value), parentElement: this }];
  }
  appendChild(node) {
    node.parentElement = this;
    this.childNodes.push(node);
    return node;
  }
  insertBefore(node, ref) {
    node.parentElement = this;
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i === -1) this.childNodes.push(node);
    else this.childNodes.splice(i, 0, node);
    return node;
  }
  remove() {
    if (this.parentElement) {
      const i = this.parentElement.childNodes.indexOf(this);
      if (i !== -1) this.parentElement.childNodes.splice(i, 1);
    }
  }
  getAttribute(name) {
    if (name === 'class') return this.className || null;
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }
  setAttribute(name, value) {
    this.attrs[name] = value;
  }
  removeAttribute(name) {
    delete this.attrs[name];
  }
  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name);
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }
  get descendants() {
    const out = [];
    (function walk(node) {
      (node.childNodes || []).forEach((child) => {
        out.push(child);
        walk(child);
      });
    })(this);
    return out;
  }
  matches(selector) {
    return String(selector)
      .split(',')
      .some((part) => this._matchOne(part.trim()));
  }
  _matchOne(sel) {
    // 支持 #id 前缀（简单情形：#id / tag#id / .cls#id）
    const idMatch = sel.match(/#([\w-]+)/);
    if (idMatch) {
      if (this.getAttribute('id') !== idMatch[1]) return false;
      sel = sel.replace(/#[\w-]+/, '');
      if (!sel) return true;
    }
    const m = sel.match(/^([a-zA-Z]*)((?:\.[\w-]+)*)((?:\[[^\]]*\])*)$/);
    if (!m) return false;
    const [, tag, classes, attrs] = m;
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    if (classes) {
      const wanted = classes.split('.').filter(Boolean);
      const have = this.className.split(/\s+/);
      if (!wanted.every((c) => have.indexOf(c) !== -1)) return false;
    }
    for (const raw of (attrs || '').match(/\[[^\]]*\]/g) || []) {
      const body = raw.slice(1, -1);
      const eq = body.indexOf('=');
      if (eq === -1) {
        if (this.getAttribute(body) == null) return false;
        continue;
      }
      const opMatch = body.slice(0, eq).trim().match(/[*^$]$/);
      const op = opMatch ? opMatch[0] : '';
      const name = op ? body.slice(0, eq).trim().slice(0, -1) : body.slice(0, eq).trim();
      const actual = this.getAttribute(name);
      if (actual == null) return false;
      const value = body.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (op === '*' && actual.indexOf(value) === -1) return false;
      if (op === '^' && actual.indexOf(value) !== 0) return false;
      if (op === '$' && actual.slice(-value.length) !== value) return false;
      if (!op && actual !== value) return false;
    }
    return true;
  }
  querySelectorAll(selector) {
    return this.descendants.filter((n) => n.nodeType === 1 && n.matches(selector));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (node.nodeType === 1 && node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
  contains(node) {
    return this.descendants.indexOf(node) !== -1;
  }
}

const VOID_TAGS = { meta: 1, link: 1, br: 1, hr: 1, img: 1, input: 1 };

function parseHtml(html) {
  const root = new HtmlEl('html', {});
  root.documentElement = root;
  root.body = root;
  root.createElement = function (tag) {
    return new HtmlEl(tag, {});
  };
  root.createTextNode = function (text) {
    return { nodeType: 3, nodeValue: String(text), parentElement: null };
  };
  // 极简 TreeWalker：只实现 i18n 扫描用到的 nextNode()
  root.createTreeWalker = function (start, whatToShow, filter) {
    const nodes = [start].concat(start.descendants);
    let i = -1;
    const walker = {
      currentNode: start,
      nextNode: function () {
        while (++i < nodes.length) {
          const node = nodes[i];
          if (node.nodeType === 3 && whatToShow !== 4) continue;
          if (typeof filter === 'function') {
            if (filter(node) === 2) continue; // FILTER_REJECT
          } else if (filter && typeof filter.acceptNode === 'function') {
            if (filter.acceptNode(node) === 2) continue;
          }
          walker.currentNode = node;
          return node;
        }
        return null;
      }
    };
    return walker;
  };
  const stack = [root];
  const tokens = String(html).match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  tokens.forEach(function (token) {
    if (token.slice(0, 4) === '<!--') return;
    if (token.charAt(0) !== '<') {
      const text = token.replace(/\s+/g, ' ').trim();
      if (text) {
        const node = { nodeType: 3, nodeValue: text, parentElement: stack[stack.length - 1] };
        stack[stack.length - 1].childNodes.push(node);
      }
      return;
    }
    const close = /^<\//.test(token);
    const name = (token.match(/^<\/?\s*([a-zA-Z0-9-]+)/) || [])[1];
    if (!name) return;
    if (close) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === name.toUpperCase()) {
          stack.length = i;
          return;
        }
      }
      return;
    }
    const attrs = {};
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*'([^']*)'/g;
    let m;
    while ((m = attrRe.exec(token))) {
      attrs[m[1] || m[3]] = m[2] !== undefined ? m[2] : m[4];
    }
    const el = new HtmlEl(name, attrs);
    stack[stack.length - 1].appendChild(el);
    if (!VOID_TAGS[name.toLowerCase()] && !/\/>$/.test(token)) stack.push(el);
  });
  return root;
}

module.exports = { HtmlEl, parseHtml };
