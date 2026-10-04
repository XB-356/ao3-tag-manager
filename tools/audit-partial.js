/* 系统性排查：官方 locale 里哪些界面文案会被"片段替换"破坏
   ——即：整段没命中，但其中某个短词命中词典，导致翻出中英夹杂。
   用法：node tools/audit-partial.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '.cache', 'en.yml');
if (!fs.existsSync(SRC)) {
  console.error('缺 .cache/en.yml');
  process.exit(2);
}

const s = { console, document: null, window: null, setTimeout, clearTimeout };
s.globalThis = s;
s.self = s;
vm.createContext(s);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), s, { filename: r })
);
const t = s.AO3TM.i18n.translate;

// 解析 en.yml 的叶子值
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const values = new Set();
lines.forEach((raw) => {
  const line = raw.replace(/\t/g, '  ');
  const m = line.match(/^\s*(?:[^\s:#][^:]*):\s*(.+)$/);
  if (!m) return;
  let v = m[1].trim();
  if ((v.charAt(0) === '"' && v.slice(-1) === '"') || (v.charAt(0) === "'" && v.slice(-1) === "'")) v = v.slice(1, -1);
  if (!v || v.length < 4 || v.length > 90) return;
  if (/%\{/.test(v) || /<[a-z/]/.test(v)) return;
  values.add(v);
});

const problems = [];
values.forEach((v) => {
  const out = t(v);
  if (out === v) {
    // 没翻：检查是否"部分命中"（translateInline 会返回中英夹杂）
    const partial = s.AO3TM.i18n.translateInline(v);
    if (partial && partial !== v) problems.push({ v, out: partial, kind: '片段替换' });
    return;
  }
  // 翻了，但结果里混着英文单词（可能是部分命中）
  if (partialMix(out)) problems.push({ v, out, kind: '结果夹英文' });
});

function partialMix(text) {
  return /[\u4e00-\u9fa5]/.test(text) && /\b[A-Za-z]{3,}\b/.test(text.replace(/AO3|OTW|Kudos|RSS|CSV|HTML|PNG|JPEG|GIF|TWC|Fanlore|Jira|URL|FAQ|FAQ|TOS|DMCA|TIDA|AO3/gi, ''));
}

console.log('扫描 ' + values.size + ' 条官方界面文案，发现 ' + problems.length + ' 条可能被片段替换：');
problems.slice(0, 45).forEach((p) => {
  console.log('  [' + p.kind + '] ' + JSON.stringify(p.v.slice(0, 60)));
  console.log('        => ' + JSON.stringify(p.out.slice(0, 80)));
});
