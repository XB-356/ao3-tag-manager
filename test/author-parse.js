/* 作者名解析单元测试：用极简 HTML 解析器建真实结构，跑真正的 D.authorsOf / D.workPageAuthors
   用法：node test/author-parse.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/* ------------------------------ 极简 HTML → DOM ------------------------------ */

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
    const self = this;
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
    return this.childNodes
      .map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent))
      .join('');
  }
  appendChild(node) {
    node.parentElement = this;
    this.childNodes.push(node);
    return node;
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
    return selector.split(',').some((part) => this._matchOne(part.trim()));
  }
  _matchOne(sel) {
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
      const op = /[*^$]$/.test(body.slice(0, eq).trim()) ? body.slice(0, eq).trim().slice(-1) : '';
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
}

const VOID_TAGS = { meta: 1, link: 1, br: 1, hr: 1, img: 1, input: 1 };

/** 够用的 HTML 解析：属性、自闭合、文本节点 */
function parseHtml(html) {
  const root = new HtmlEl('html', {});
  root.documentElement = root;
  root.body = root;
  const stack = [root];
  const tokens = String(html).match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  tokens.forEach(function (token) {
    if (token.slice(0, 4) === '<!--') return;
    if (token.charAt(0) !== '<') {
      const text = token.replace(/\s+/g, ' ').trim();
      if (text) stack[stack.length - 1].appendChild({ nodeType: 3, nodeValue: text, parentElement: stack[stack.length - 1] });
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

/** 从整页 HTML 里取出 li.blurb 列表 */
function blurbsOf(html) {
  return parseHtml(html).querySelectorAll('li.blurb, li.work');
}

/* ------------------------------ 载入被测代码 ------------------------------ */

function loadDom(documentImpl) {
  const sandbox = {
    console,
    document: documentImpl,
    window: documentImpl,
    location: { pathname: '/works', protocol: 'https:', hostname: 'archiveofourown.org' },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => setTimeout(fn, 0)
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  ['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/match.js', 'src/lib/dom.js'].forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  });
  return sandbox.AO3TM;
}

/* ------------------------------ 用例 ------------------------------ */

const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok });
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) console.log('   实际: ' + JSON.stringify(detail));
}

const searchHtml = fs.readFileSync(path.join(__dirname, 'mock', 'search.html'), 'utf8');
const listHtml = fs.readFileSync(path.join(__dirname, 'mock', 'list.html'), 'utf8');

/* --- 列表/搜索页作者解析 --- */

const searchDoc = parseHtml(searchHtml);
const D1 = loadDom(searchDoc);
check('沙箱里 dom 模块可用', typeof D1.dom.authorsOf === 'function', Object.keys(D1));

const searchAuthors = blurbsOf(searchHtml).map(function (el) {
  return { id: el.getAttribute('id'), authors: D1.dom.authorsOf(el) };
});
const byId = {};
searchAuthors.forEach(function (row) {
  byId[row.id] = row.authors;
});

check('普通用户名：解析正确', JSON.stringify(byId.work_201) === JSON.stringify(['plain_user']), byId.work_201);
check(
  '伪名（href 指到 /pseuds/）：解析出页面显示的名字，而不是登录名',
  byId.work_202.indexOf('My Pseud') === 0,
  byId.work_202
);
check(
  '伪名：同时保留登录名作为别名（按登录名写的旧规则也不会失效）',
  byId.work_202.indexOf('login_name') !== -1,
  byId.work_202
);
check('非 ASCII 用户名：解析出可读名字', JSON.stringify(byId.work_203) === JSON.stringify(['测试作者']), byId.work_203);
check('orphan_account：解析正确', JSON.stringify(byId.work_204) === JSON.stringify(['orphan_account']), byId.work_204);
check(
  '作者链接不在 li.author/.byline 里（特殊皮肤）：兜底也能解析出作者',
  JSON.stringify(byId.work_205) === JSON.stringify(['odd_skin_user']),
  byId.work_205
);

/* --- 列表页真实 mock --- */

const listDoc = parseHtml(listHtml);
const D2 = loadDom(listDoc);
const listAuthors = blurbsOf(listHtml).map(function (el) {
  return D2.dom.authorsOf(el);
});
check(
  '列表页 mock：每篇都能解析出作者',
  listAuthors.length === 5 && listAuthors.every((a) => a.length === 1),
  listAuthors
);

/* --- 用规则匹配验证"屏蔽作者能命中" --- */

const M = D2.match;
const rule = (pattern) => ({ key: pattern.toLowerCase(), pattern: pattern, mode: 'block', caseSensitive: false, ts: 1 });
function blocksAuthor(pattern, authorName) {
  const verdict = M.evaluate({
    tags: [],
    authors: [authorName],
    settings: { blockTags: true, blockAuthors: true, onlyTags: true, onlyAuthors: true, caseInsensitive: true, fuzzy: true },
    rules: { tag: { block: {}, allow: {} }, author: { block: { [pattern.toLowerCase()]: rule(pattern) }, allow: {} } }
  });
  return !!verdict.blocked;
}

check('规则命中：屏蔽 plain_user', blocksAuthor('plain_user', 'plain_user'));
check('规则命中：屏蔽 My Pseud（伪名）', blocksAuthor('My Pseud', 'My Pseud'));
check('规则命中：屏蔽 测试作者（非 ASCII）', blocksAuthor('测试作者', '测试作者'));
check('规则命中：大小写不敏感', blocksAuthor('PLAIN_USER', 'plain_user'));
check('规则命中：子串匹配', blocksAuthor('plain', 'plain_user'));
check('规则命中：不相关规则不误伤', blocksAuthor('someone_else', 'plain_user') === false);

/* --- 端到端：屏蔽 search.html 里的作者，应当真的隐藏对应作品 --- */

const filterSandbox = (function () {
  const sandbox = {
    console,
    document: parseHtml(searchHtml),
    window: null,
    location: { pathname: '/works', protocol: 'https:', hostname: 'archiveofourown.org' },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => setTimeout(fn, 0)
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  [
    'src/lib/env-core.js',
    'src/lib/env.js',
    'src/lib/storage.js',
    'src/lib/match.js',
    'src/lib/dom.js',
    'src/core/filter.js'
  ].forEach(function (rel) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  });
  return sandbox;
})();

const F = filterSandbox;
F.AO3TM.dom.isWorkPage = () => false;
F.AO3TM.store.addRule('author', 'My Pseud', 'block');
const verdictResult = F.AO3TM.filter.apply();
const hiddenIds = F.AO3TM.dom
  .blurbs()
  .filter((el) => el.getAttribute('data-ao3tm-hidden') === '1')
  .map((el) => el.getAttribute('id'));
check(
  '端到端：屏蔽伪名后，只隐藏该作者的作品（202）',
  JSON.stringify(hiddenIds) === JSON.stringify(['work_202']),
  { hidden: hiddenIds, stats: verdictResult.stats }
);

console.log('\n===== 结果 =====');
console.log(results.length - failed + '/' + results.length + ' 通过');
if (failed) console.log('失败项见上');
process.exit(failed ? 1 : 0);
