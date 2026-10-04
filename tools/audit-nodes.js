/* 用真实页面 HTML 提取"会被扩展翻译的文本节点"，并核对当前词典能覆盖到什么程度
   用法：node tools/audit-nodes.js <html...> [--only English|untranslated] */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHtml } = require(path.join(__dirname, '..', 'test', 'html-stub'));

const ROOT = path.resolve(__dirname, '..');
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const only = process.argv.includes('--only-untranslated');

// 载入真实引擎
const sandbox = { console, document: null, window: null, NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 }, setTimeout, clearTimeout };
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), sandbox, { filename: r })
);
const i18n = sandbox.AO3TM.i18n;

/** 模拟扩展的翻译过程：对每个文本节点判断能不能翻 */
function audit(file) {
  const doc = parseHtml(fs.readFileSync(file, 'utf8'));
  const nodes = [doc].concat(doc.descendants).filter((n) => n.nodeType === 3);
  const rows = [];
  nodes.forEach((node) => {
    const raw = String(node.nodeValue || '');
    const trimmed = raw.trim();
    if (!trimmed || !/[A-Za-z]{3}/.test(trimmed)) return;
    // 真实的 i18n 会跳过 script/style；这里同样跳过，否则满屏 CSS/JS 噪音
    const parent = node.parentElement;
    if (parent && /^(SCRIPT|STYLE|NOSCRIPT|CODE|PRE)$/.test(parent.tagName)) return;
    if (parent && parent.closest && parent.closest('script, style, noscript, code, pre, .ao3tm-panel-root, .ao3tm-menu')) return;
    const exact = i18n.translate(trimmed);
    const inline = exact === trimmed ? i18n.translateInline(trimmed) : exact;
    const translated = exact !== trimmed;
    if (only && translated) return;
    rows.push({ text: trimmed, translated: !!translated || !!inline, via: translated ? 'lookup' : inline ? 'inline' : '—' });
  });
  return rows;
}

files.forEach((file) => {
  const rows = audit(file);
  const bad = rows.filter((r) => !r.translated);
  console.log('===== ' + path.basename(file) + ' =====');
  console.log('含英文的文本节点 ' + rows.length + ' 个，其中翻不了/翻不全 ' + bad.length + ' 个：');
  bad.forEach((r) => console.log('  [' + r.via + '] ' + JSON.stringify(r.text)));
  console.log('');
});
