/* 用真实页面 HTML + 当前引擎，离线判断"哪些文本会被替换、哪些不该被替换"
   用法：node tools/audit-engine.js <html...>
   说明：不看 HTML 里已有的翻译结果，而是把每个文本节点的原文喂给当前引擎。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHtml } = require(path.join(__dirname, '..', 'test', 'html-stub'));

const ROOT = path.resolve(__dirname, '..');
const files = process.argv.slice(2);

const s = { console, document: null, window: null, NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1 }, setTimeout, clearTimeout };
s.globalThis = s;
s.self = s;
vm.createContext(s);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), s, { filename: r })
);
const i18n = s.AO3TM.i18n;

/** 期望"不该被替换"的信号：标题/正文/筛选语法/用户文本 */
function suspicious(text, out) {
  if (!out) return false;
  // 替换后中文夹英文单词，且原文里有非界面含义的专有词
  if (!/[\u4e00-\u9fa5]/.test(out)) return false;
  if (!/[A-Za-z]{3}/.test(out)) return false;
  return true;
}

files.forEach((file) => {
  const doc = parseHtml(fs.readFileSync(file, 'utf8'));
  const nodes = [doc].concat(doc.descendants).filter((n) => n.nodeType === 3);
  const hits = [];
  const missed = [];
  nodes.forEach((node) => {
    const raw = String(node.nodeValue || '');
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text || !/[A-Za-z]{3}/.test(text)) return;
    const parent = node.parentElement;
    if (parent && parent.closest && parent.closest('script, style, noscript, code, pre')) return;
    // 用编辑器里的"原文"更准：HTML 里存了 data-ao3tm-orig
    const orig = (parent && parent.getAttribute && parent.getAttribute('data-ao3tm-orig')) || text;
    const out = i18n.translate(orig);
    const changed = out && out !== orig;
    if (changed && suspicious(orig, out)) hits.push({ orig: orig.slice(0, 100), out: out.slice(0, 100) });
    if (!changed && /^[A-Z][a-z]+/.test(orig) && orig.length < 30) missed.push(orig.slice(0, 80));
  });
  console.log('===== ' + path.basename(file).slice(0, 60) + ' =====');
  console.log('会被替换成"中英夹杂"的 ' + hits.length + ' 处：');
  hits.slice(0, 25).forEach((r) => console.log('  [' + r.orig + ']\n    -> ' + r.out));
  console.log('');
});
