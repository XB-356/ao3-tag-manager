/* AO3 站点识别（src/lib/detect.js）单元测试，不需要浏览器。
   用法：node test/detect.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'detect.js'), 'utf8');

/* ------------------------------ 极简 DOM 桩 ------------------------------ */

class El {
  constructor(tagName, attrs) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.attributes = Object.assign({}, attrs || {});
    this.childNodes = [];
    this.parentElement = null;
    this._classes = String(this.attributes['class'] || '')
      .split(/\s+/)
      .filter(Boolean);
  }
  get className() {
    return this._classes.join(' ');
  }
  get classList() {
    const self = this;
    return {
      contains: (name) => self._classes.indexOf(name) !== -1
    };
  }
  getAttribute(name) {
    // 只支持属性和部分简写：class 走 attributes
    if (name === 'class') return this.className;
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  appendChild(node) {
    node.parentElement = this;
    this.childNodes.push(node);
    return node;
  }
  get descendants() {
    const out = [];
    const walk = (node) => {
      node.childNodes.forEach((child) => {
        out.push(child);
        walk(child);
      });
    };
    walk(this);
    return out;
  }
  /** 只支持测试里用到的选择器形式 */
  matches(selector) {
    const parts = selector.split(',').map((s) => s.trim());
    return parts.some((sel) => this._matchOne(sel));
  }
  _matchOne(sel) {
    const m = sel.match(/^([a-zA-Z]*)((?:\.[\w-]+)*)((?:\[[^\]]*\])*)$/);
    if (!m) return false;
    const [, tag, classes, attrs] = m;
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    if (classes) {
      const wanted = classes.split('.').filter(Boolean);
      if (!wanted.every((c) => this._classes.contains ? this._classes.contains(c) : this._classes.indexOf(c) !== -1)) return false;
    }
    const attrMatches = attrs ? attrs.match(/\[[^\]]*\]/g) || [] : [];
    for (const raw of attrMatches) {
      const body = raw.slice(1, -1);
      const eq = body.indexOf('=');
      if (eq === -1) {
        if (this.getAttribute(body) == null) return false;
        continue;
      }
      const name = body.slice(0, eq);
      const op = name.endsWith('*') || name.endsWith('^') || name.endsWith('$') ? name.slice(-1) : '';
      const realName = op ? name.slice(0, -1) : name;
      const value = body.slice(eq + 1).replace(/^["']|["']$/g, '');
      const actual = this.getAttribute(realName);
      if (actual == null) return false;
      if (op === '*' && actual.indexOf(value) === -1) return false;
      if (op === '^' && actual.indexOf(value) !== 0) return false;
      if (op === '$' && actual.slice(-value.length) !== value) return false;
      if (!op && actual !== value) return false;
    }
    return true;
  }
  querySelectorAll(selector) {
    return this.descendants.filter((node) => node.matches(selector));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

/** 用对象字面量快速搭一棵树：{tag, class, attrs, children} */
function build(node) {
  const el = new El(node.tag || 'div', Object.assign({}, node.attrs, node.class ? { class: node.class } : {}));
  (node.children || []).forEach((child) => el.appendChild(build(child)));
  return el;
}

function makeDoc(html) {
  const root = build(html);
  root.documentElement = root;
  return root;
}

const loc = (hostname, protocol) => ({ hostname: hostname, protocol: protocol || 'https:' });

/* ------------------------------ 测试用例 ------------------------------ */

const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok && detail !== undefined) console.log('   ' + JSON.stringify(detail));
}

// 从 vm 里取出 detect 模块
const sandbox = { console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const D = sandbox.AO3TM.detect;

check('模块导出正常', typeof D.detect === 'function' && typeof D.hostOf === 'function', Object.keys(sandbox.AO3TM.detect));

/* --- 域名归一化 --- */
check(
  '域名归一化：去协议/路径/端口/www',
  D.hostOf('https://WWW.Ao3-Mirror.com:8443/works?q=1') === 'ao3-mirror.com',
  D.hostOf('https://WWW.Ao3-Mirror.com:8443/works?q=1')
);
check('域名线索：带 ao3 字样 +1', D.domainSignals('ao3.win').length === 1 && D.domainSignals('ao3.win')[0].weight === 1);
check(
  '域名线索：ao3 + mirror 两条',
  D.domainSignals('ao3-mirror.com').length === 2,
  D.domainSignals('ao3-mirror.com')
);
check('域名线索：无关域名零条', D.domainSignals('example.com').length === 0);
check(
  '域名线索：transformativeworks / archiveofourown 也算',
  D.domainSignals('archive.transformativeworks.org').length === 1 &&
    D.domainSignals('archiveofourown.org').length === 1,
  { tw: D.domainSignals('archive.transformativeworks.org'), ao3: D.domainSignals('archiveofourown.org') }
);

/* --- 真实 AO3 页面结构（官方站与镜像共用同一套前端） --- */
const ao3Page = {
  tag: 'html',
  children: [
    {
      tag: 'head',
      children: [
        { tag: 'meta', attrs: { name: 'generator', content: 'OTW Archive 0.9.x' } },
        { tag: 'title', children: [] }
      ]
    },
    {
      tag: 'body',
      children: [
        {
          tag: 'div',
          attrs: { id: 'header' },
          children: [{ tag: 'h1', class: 'heading', children: [{ tag: 'img', class: 'logo' }] }]
        },
        {
          tag: 'div',
          attrs: { id: 'main' },
          children: [
            {
              tag: 'ol',
              class: 'work index group',
              children: [
                {
                  tag: 'li',
                  class: 'work blurb group',
                  attrs: { id: 'work_1' },
                  children: [
                    {
                      tag: 'div',
                      class: 'header module',
                      children: [
                        { tag: 'a', attrs: { href: '/works/123' } },
                        { tag: 'a', class: 'tag', attrs: { href: '/tags/Fluff/works' } },
                        { tag: 'a', class: 'tag', attrs: { href: '/tags/Angst/works' } }
                      ]
                    }
                  ]
                },
                {
                  tag: 'li',
                  class: 'work blurb group',
                  attrs: { id: 'work_2' },
                  children: [{ tag: 'a', attrs: { href: '/works/456' } }]
                }
              ]
            },
            { tag: 'a', attrs: { href: '/works/search' } },
            { tag: 'a', attrs: { href: '/collections' } }
          ]
        },
        { tag: 'div', attrs: { id: 'footer' }, children: [{ tag: 'div', class: 'module group' }] }
      ]
    }
  ]
};

const ao3Result = D.detect(makeDoc(ao3Page), loc('archiveofourown.org'));
check(
  '官方站页面：判定为 AO3 且置信度 high',
  ao3Result.isAo3 && ao3Result.level === 'high' && ao3Result.score >= 6,
  { level: ao3Result.level, score: ao3Result.score, reasons: ao3Result.reasons.map((r) => r.key) }
);
check('官方站页面：理由里包含 generator 与作品列表项', ao3Result.reasons.some((r) => r.key === 'generator') && ao3Result.reasons.some((r) => r.key === 'blurb'));

// 同一套页面结构，换个陌生域名（且域名里不含 ao3/mirror 字样，纯靠页面结构判定）
const mirrorResult = D.detect(makeDoc(ao3Page), loc('fanfic-reader.example'));
check(
  '同一套结构 + 陌生域名：仍然判定为 AO3（镜像站场景）',
  mirrorResult.isAo3 && mirrorResult.level === 'high',
  { level: mirrorResult.level, score: mirrorResult.score, host: mirrorResult.host }
);
check(
  '陌生域名会额外给出"结构证据"而非"域名证据"',
  mirrorResult.domainSignals.length === 0 && mirrorResult.pageSignals.length >= 3,
  { domain: mirrorResult.domainSignals.length, page: mirrorResult.pageSignals.length }
);

/* --- 只有域名像、页面不像：不能判定 --- */
const emptyPage = {
  tag: 'html',
  children: [{ tag: 'head', children: [] }, { tag: 'body', children: [{ tag: 'div', attrs: { id: 'main' } }] }]
};
const fakeByDomain = D.detect(makeDoc(emptyPage), loc('ao3-fake.com'));
check(
  '只有域名像 AO3、页面没有结构证据：不判定为 AO3',
  fakeByDomain.isAo3 === false,
  { level: fakeByDomain.level, score: fakeByDomain.score, reasons: fakeByDomain.reasons.map((r) => r.key) }
);

/* --- 通用建站程序：要扣分 --- */
const wpPage = {
  tag: 'html',
  children: [
    { tag: 'head', children: [{ tag: 'meta', attrs: { name: 'generator', content: 'WordPress 6.4' } }] },
    { tag: 'body', children: [{ tag: 'div', attrs: { id: 'main' }, children: [{ tag: 'div', class: 'header module' }] }] }
  ]
};
const wpResult = D.detect(makeDoc(wpPage), loc('my-blog.com'));
check(
  'WordPress 站点：即使有 #main 也判定为"不像"',
  wpResult.isAo3 === false && wpResult.reasons.some((r) => r.key === 'cms' && r.weight < 0),
  { level: wpResult.level, score: wpResult.score, reasons: wpResult.reasons.map((r) => r.key + ':' + r.weight) }
);

/* --- 无内容的通用页面：最多 low --- */
const generic = {
  tag: 'html',
  children: [{ tag: 'body', children: [{ tag: 'div', attrs: { id: 'main' }, children: [{ tag: 'div', class: 'header module' }] }] }]
};
const genericResult = D.detect(makeDoc(generic), loc('example.com'));
check(
  '通用页面（只有 #main 与 .module）：最多 low，不算 AO3',
  genericResult.isAo3 === false && genericResult.level === 'low',
  { level: genericResult.level, score: genericResult.score }
);

/* --- 结论文案 --- */
check('结论文案随置信度变化', D.summary(ao3Result).indexOf('高度确认') === 0 && D.summary(genericResult).indexOf('特征') !== -1, {
  high: D.summary(ao3Result),
  low: D.summary(genericResult)
});
check('层级标签可读', D.levelLabel('high') === '高度确认' && D.levelLabel('none') === '不像');

/* --- 空页面不能抛异常 --- */
check('空 document 不抛异常', (() => {
  try {
    const r = D.detect(null, loc('example.com'));
    return r && r.isAo3 === false;
  } catch (err) {
    return false;
  }
})());

/* --- 真实 mock 页面：应至少达到 medium（它有 AO3 的 blurb 结构） --- */
const mockHtml = fs.readFileSync(path.join(__dirname, 'mock', 'list.html'), 'utf8');
const classCount = (mockHtml.match(/class="[^"]*\bblurb\b[^"]*"/g) || []).length;
const hasNumericWork = /href="\/works\/\d+"/.test(mockHtml);
check(
  '本地 mock 页面具备被识别的特征（blurb 数 + /works/数字 链接）',
  classCount >= 5 && hasNumericWork,
  { blurbs: classCount, numericWork: hasNumericWork }
);

console.log('\n===== 结果 =====');
console.log(results.length - failed + '/' + results.length + ' 通过');
if (failed) {
  results.filter((r) => !r.ok).forEach((r) => console.log('  - ' + r.name + ' :: ' + JSON.stringify(r.detail)));
}
process.exit(failed ? 1 : 0);
