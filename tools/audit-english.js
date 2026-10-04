/* 找出真实页面里"现在仍然是英文"的可见文本（真正漏翻的）
   用法：node tools/audit-english.js <html...> */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHtml } = require(path.join(__dirname, '..', 'test', 'html-stub'));

const ROOT = path.resolve(__dirname, '..');
const files = process.argv.slice(2);
if (!files.length) {
  console.error('用法：node tools/audit-english.js <html...>');
  process.exit(2);
}

const s = { console, document: null, window: null, NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1 }, setTimeout, clearTimeout };
s.globalThis = s;
s.self = s;
vm.createContext(s);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), s, { filename: r })
);
const i18n = s.AO3TM.i18n;

// 站点数据 / 专有名词 / 动态格式：翻了反而不对，不算漏翻
const NOT_UI = [
  /^Archive of Our Own$/i,
  /^AO3$/,
  /^OTW$/,
  /^Hi, /i,
  /^[A-Z][a-z]{2},? \d{1,2} [A-Z][a-z]{2}/, // 日期
  /^\d+$/,
  /^[A-Za-z]+ on (Bluesky|Tumblr)$/i,
  /@/,
  /^\d+\/\d+$/,
  /^Fandoms?$/i
];

files.forEach((file) => {
  const doc = parseHtml(fs.readFileSync(file, 'utf8'));
  const nodes = [doc].concat(doc.descendants).filter((n) => n.nodeType === 3);
  const remaining = [];
  nodes.forEach((node) => {
    const text = String(node.nodeValue || '').replace(/\s+/g, ' ').trim();
    if (!text || !/[A-Za-z]{3}/.test(text)) return;
    if (/[\u4e00-\u9fa5]/.test(text)) return; // 已含中文，按混合处理
    const parent = node.parentElement;
    if (!parent || !parent.closest) return;
    if (parent.closest('script, style, noscript, code, pre')) return;
    // 跳过的用户内容区不算漏翻
    if (parent.closest('.userstuff, .bio, blockquote, .comment, .kudos')) return;
    if (NOT_UI.some((re) => re.test(text))) return;
    const canTranslate = i18n.translate(text) !== text || i18n.translateInline(text);
    remaining.push({ text, canTranslate });
  });
  console.log('===== ' + path.basename(file) + ' =====');
  console.log('仍是英文的可见文本 ' + remaining.length + ' 条：');
  remaining.forEach((r) => console.log('  ' + (r.canTranslate ? '[引擎能翻→没被处理] ' : '[词典缺]         ') + r.text.slice(0, 100)));
  console.log('');
});
