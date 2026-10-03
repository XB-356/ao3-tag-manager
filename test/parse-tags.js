/* 标签解析单元测试：直接喂真实 AO3 结构的 HTML，检查 D.blurbTags 结果
   用法：node test/parse-tags.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function loadScripts(relativePaths) {
  const sandbox = {
    console,
    document: null,
    window: null,
    NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    chrome: undefined
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  relativePaths.forEach(function (rel) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    vm.runInContext(code, sandbox, { filename: rel });
  });
  return sandbox;
}

/* 极简 DOM 实现：只覆盖解析标签所需的接口 */
class TextNode {
  constructor(text) {
    this.nodeType = 3;
    this.nodeValue = text;
    this.parentElement = null;
  }
  get textContent() {
    return this.nodeValue;
  }
}

class Element {
  constructor(tagName, attrs) {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.attributes = Object.assign({}, attrs || {});
    this.childNodes = [];
    this.parentElement = null;
  }
  get className() {
    return this.attributes.class || '';
  }
  set className(value) {
    this.attributes.class = String(value);
  }
  get classList() {
    const self = this;
    const list = (self.attributes.class || '').split(/\s+/).filter(Boolean);
    return {
      contains: (name) => list.indexOf(name) !== -1,
      add: (name) => {
        if (list.indexOf(name) === -1) list.push(name);
        self.attributes.class = list.join(' ');
      },
      remove: (name) => {
        const i = list.indexOf(name);
        if (i !== -1) list.splice(i, 1);
        self.attributes.class = list.join(' ');
      },
      toggle: (name, on) => (on ? list.indexOf(name) === -1 && list.push(name) : list.splice(list.indexOf(name), 1)),
      toString: () => list.join(' ')
    };
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  removeAttribute(name) {
    delete this.attributes[name];
  }
  appendChild(node) {
    // 简化版 fragment：把子节点逐个挂过来（真实 DOM 也是这个效果）
    if (node && node.tagName === 'FRAGMENT') {
      node.childNodes.slice().forEach((child) => this.appendChild(child));
      node.childNodes.length = 0;
      return node;
    }
    if (node.parentElement && node.parentElement !== this) {
      const i = node.parentElement.childNodes.indexOf(node);
      if (i !== -1) node.parentElement.childNodes.splice(i, 1);
    }
    node.parentElement = this;
    this.childNodes.push(node);
    return node;
  }
  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }
  get textContent() {
    return this.childNodes.map((n) => n.textContent).join('');
  }
  set textContent(value) {
    this.childNodes = [];
    if (value) this.appendChild(new TextNode(String(value)));
  }
  /** 只支持本测试用到的选择器：标签名、.class、tag.class、[attr]、前缀匹配 a[href*=x] */
  matches(selector) {
    const parts = selector.split(',').map((s) => s.trim());
    return parts.some((sel) => {
      const m = sel.match(/^([a-zA-Z]*)((?:\.[\w-]+)*)(?:\[([\w-]+)(?:([*^$]?=)"?([^"\]]*)"?)?\])?$/);
      if (!m) return false;
      const tag = m[1];
      const classes = m[2];
      const attrName = m[3];
      const op = m[4];
      const attrValue = m[5];
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      if (classes) {
        const wanted = classes.split('.').filter(Boolean);
        if (!wanted.every((c) => this.classList.contains(c))) return false;
      }
      if (attrName) {
        const value = this.getAttribute(attrName);
        if (value == null) return false;
        if (op === '*=' && value.indexOf(attrValue) === -1) return false;
        if (op === '=' && value !== attrValue) return false;
      }
      return true;
    });
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (node.nodeType === 1 && node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      node.children.forEach((child) => {
        if (child.matches(selector)) out.push(child);
        walk(child);
      });
    };
    walk(this);
    return out;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  cloneNode(deep) {
    const copy = new Element(this.tagName, Object.assign({}, this.attributes));
    if (deep) this.childNodes.forEach((child) => copy.appendChild(child.nodeType === 1 ? child.cloneNode(true) : new TextNode(child.nodeValue)));
    return copy;
  }
  remove() {
    if (!this.parentElement) return;
    const i = this.parentElement.childNodes.indexOf(this);
    if (i !== -1) this.parentElement.childNodes.splice(i, 1);
  }
}

function el(tag, attrs, children) {
  const node = new Element(tag, attrs);
  (children || []).forEach((child) => {
    node.appendChild(typeof child === 'string' ? new TextNode(child) : child);
  });
  return node;
}

/* ---- 构造：真实的 AO3 作品卡片标签区 ---- */
function makeBlurb(inner) {
  const blurb = el('li', { class: 'work blurb group', id: 'work_1' }, [
    el('div', { class: 'header module' }, [el('h4', { class: 'heading' }, [el('a', { href: '/works/1' }, ['标题'])])]),
    inner
  ]);
  const root = el('ol', { class: 'work index group' }, [blurb]);
  return { root, blurb };
}

/** 真实 AO3 结构：<ul class="tags"><li class="warnings"><a class="tag">x</a>, </li>...</ul> */
function ao3TagsStructure(tags) {
  return el(
    'ul',
    { class: 'tags' },
    tags.map((tag) => el('li', { class: 'freeforms' }, [el('a', { class: 'tag', href: '/tags/x/works' }, [tag]), ', ']))
  );
}

/** 另一种结构：标签之间没有逗号，全靠 a 元素分隔 */
function noCommaStructure(tags) {
  return el(
    'ul',
    { class: 'tags' },
    tags.map((tag) => el('li', { class: 'freeforms' }, [el('a', { class: 'tag', href: '/tags/x/works' }, [tag])]))
  );
}

const cases = [
  {
    name: '标准结构：每个 a.tag 一个标签',
    build: () => makeBlurb(ao3TagsStructure(['Major Character Death', 'Luminescence/The Chariot', 'Gino (Phigros)'])),
    expect: ['Major Character Death', 'Luminescence/The Chariot', 'Gino (Phigros)']
  },
  {
    name: '没有逗号分隔也必须拆开',
    build: () => makeBlurb(noCommaStructure(['Major Character Death', 'Luminescence/The Chariot', 'Gino (Phigros)'])),
    expect: ['Major Character Death', 'Luminescence/The Chariot', 'Gino (Phigros)']
  },
  {
    name: '标签里带逗号（如 "A, B and C"）不能拆散',
    build: () => makeBlurb(ao3TagsStructure(['A, B and C', 'Fluff'])),
    expect: ['A, B and C', 'Fluff']
  },
  {
    name: '标签里带 / ~ 等符号原样保留',
    build: () => makeBlurb(ao3TagsStructure(['~REVIVAL~', 'Geopelia/Gino (Phigros)', 'Micro/d/wav'])),
    expect: ['~REVIVAL~', 'Geopelia/Gino (Phigros)', 'Micro/d/wav']
  },
  {
    name: '带 (+1 more) 的收起标签会被忽略',
    build: () =>
      makeBlurb(
        el('ul', { class: 'tags' }, [
          el('li', { class: 'freeforms' }, [el('a', { class: 'tag', href: '/tags/a/works' }, ['Fluff']), el('a', { class: 'tag', href: '/tags/more' }, ['+1 more'])]),
          el('li', { class: 'freeforms' }, [el('a', { class: 'tag', href: '/tags/b/works' }, ['Angst'])])
        ])
      ),
    expect: ['Fluff', 'Angst']
  },
  {
    name: '作者区不会被当成标签（只看 .tags 容器）',
    build: () =>
      makeBlurb(
        el('div', { class: 'header module' }, [
          ao3TagsStructure(['Fluff']),
          el('ul', { class: 'stats' }, [el('li', { class: 'author' }, [el('a', { href: '/users/writer_x' }, ['writer_x'])]), el('li', { class: 'language' }, ['English'])])
        ])
      ),
    expect: ['Fluff']
  }
];
const sandbox = loadScripts(['src/lib/match.js', 'src/lib/dom.js']);
const D = sandbox.AO3TM.dom;

let failed = 0;
cases.forEach(function (item) {
  const built = item.build();
  sandbox.document = {
    querySelectorAll: (sel) => built.root.querySelectorAll(sel),
    querySelector: (sel) => built.root.querySelector(sel),
    body: built.root,
    documentElement: built.root
  };
  const blurb = built.blurb;
  let actual;
  try {
    actual = D.blurbTags(blurb);
  } catch (err) {
    actual = ['<异常: ' + err.message + '>'];
  }
  const ok = JSON.stringify(actual) === JSON.stringify(item.expect);
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + item.name);
  if (!ok) {
    console.log('   期望: ' + JSON.stringify(item.expect));
    console.log('   实际: ' + JSON.stringify(actual));
  }
});

/* ---- 展示层：ensureTagSpans 也不能粘标签 ---- */
const spanCases = [
  { name: '切 span：标准结构', tags: ['Fluff', 'Angst', 'A, B and C'], structure: ao3TagsStructure },
  { name: '切 span：没有逗号的结构', tags: ['Major Character Death', 'Luminescence/The Chariot', 'Gino (Phigros)'], structure: noCommaStructure },
  { name: '切 span：标签自带逗号与斜杠', tags: ['A, B and C', 'Geopelia/Gino (Phigros)'], structure: noCommaStructure }
];

spanCases.forEach(function (item) {
  const built = makeBlurb(item.structure(item.tags));
  sandbox.document = {
    querySelectorAll: (sel) => built.root.querySelectorAll(sel),
    querySelector: (sel) => built.root.querySelector(sel),
    body: built.root,
    documentElement: built.root,
    createDocumentFragment: () => new Element('fragment'),
    createElement: (tag) => new Element(tag),
    createTextNode: (text) => new TextNode(text)
  };
  const container = built.blurb.querySelector('.tags');
  D.ensureTagSpans(container);
  const spans = container.querySelectorAll('.ao3tm-tag');
  const dataTags = spans.map((s) => s.getAttribute('data-tag'));
  // 切完之后 blurbTags 仍应得到同样的标签集合
  const roundTrip = D.blurbTags(built.blurb);
  const ok = JSON.stringify(dataTags) === JSON.stringify(item.tags) && JSON.stringify(roundTrip) === JSON.stringify(item.tags);
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + item.name);
  if (!ok) {
    console.log('   期望: ' + JSON.stringify(item.tags));
    console.log('   span: ' + JSON.stringify(dataTags));
    console.log('   回读: ' + JSON.stringify(roundTrip));
  }
});

console.log('\n' + (cases.length + spanCases.length - failed) + '/' + (cases.length + spanCases.length) + ' 通过');
process.exit(failed ? 1 : 0);
