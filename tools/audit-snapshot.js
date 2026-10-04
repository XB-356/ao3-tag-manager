/* 分析快照：被扩展标记过（data-ao3tm-orig）但文本仍是纯英文的节点
   用法：node tools/audit-snapshot.js <html...> */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const files = process.argv.slice(2);
const s = { console, document: null, window: null, setTimeout, clearTimeout };
s.globalThis = s;
s.self = s;
vm.createContext(s);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), s, { filename: r })
);
const i18n = s.AO3TM.i18n;

const decode = (t) =>
  String(t).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

files.forEach((file) => {
  const html = fs.readFileSync(file, 'utf8');
  const rows = [];
  // 元素级：有 orig 标记，但元素文本里没有中文
  const elRe = /<([a-z0-9]+)([^>]*data-ao3tm-orig="([^"]*)"[^>]*)>([\s\S]{0,500}?)<\/\1>/gi;
  let m;
  while ((m = elRe.exec(html))) {
    const orig = decode(m[3]).replace(/\s+/g, ' ').trim();
    const now = m[4].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!orig || !/[A-Za-z]{3}/.test(orig)) continue;
    if (/[\u4e00-\u9fa5]/.test(now)) continue; // 已含中文 = 翻过了
    const out = i18n.translate(orig);
    rows.push({ orig, engine: out && out !== orig ? out : null });
  }
  console.log('===== ' + path.basename(file).slice(0, 60) + ' =====');
  console.log('被标记但仍是纯英文的节点 ' + rows.length + ' 个：');
  rows.forEach((r) => {
    console.log('  ' + (r.engine ? '[引擎能翻] ' : '[引擎也不能] ') + JSON.stringify(r.orig.slice(0, 80)));
  });

  // 未被标记的英文文本（扩展根本没碰到）
  const noMark = [];
  const textRe = /<([a-z0-9]+)((?![^>]*data-ao3tm-orig)[^>]*)>([^<]{4,200})</gi;
  while ((m = textRe.exec(html))) {
    const text = decode(m[3]).replace(/\s+/g, ' ').trim();
    if (!text || !/[A-Za-z]{4}/.test(text)) continue;
    if (/[\u4e00-\u9fa5]/.test(text)) continue;
    if (/^(http|\/|\.|\{|\/\/)/.test(text)) continue;
    const out = i18n.translate(text);
    if (out && out !== text) noMark.push({ text, out });
  }
  console.log('未被标记但引擎能翻的文本 ' + noMark.length + ' 个：');
  noMark.slice(0, 40).forEach((r) => console.log('  ' + JSON.stringify(r.text.slice(0, 70)) + '  ->  ' + JSON.stringify(r.out.slice(0, 70))));
  console.log('');
});
