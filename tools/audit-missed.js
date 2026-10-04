/* 从真实页面 HTML 里提取扩展存下的英文原文（data-ao3tm-orig），
   用当前引擎离线跑一遍，列出"还没翻成"的条目。
   用法：node tools/audit-missed.js <html...> */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const files = process.argv.slice(2);
if (!files.length) {
  console.error('用法：node tools/audit-missed.js <html...>');
  process.exit(2);
}

const s = { console, document: null, window: null, setTimeout, clearTimeout };
s.globalThis = s;
s.self = s;
vm.createContext(s);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), s, { filename: r })
);
const i18n = s.AO3TM.i18n;

/** HTML 实体解码 */
function decode(text) {
  return String(text)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

const allMissed = new Map();
files.forEach((file) => {
  const html = fs.readFileSync(file, 'utf8');
  const origs = new Map();
  // 收集每个元素的"原文"和"当前文本"，判断它到底翻成了什么
  const tagRe = /<([a-z0-9]+)([^>]*data-ao3tm-orig="([^"]*)"[^>]*)>([\s\S]{0,400}?)<\/\1>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const raw = decode(m[3]).replace(/\s+/g, ' ').trim();
    const now = m[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    if (!origs.has(raw)) origs.set(raw, now);
  }
  const missed = [];
  origs.forEach((now, raw) => {
    if (!/[A-Za-z]{3}/.test(raw)) return; // 原文里没英文，不用管
    const out = i18n.translate(raw);
    const translatedNow = out && out !== raw;
    // 页面里现在仍是纯英文（没中文）且引擎也翻不出来 -> 真漏翻
    const stillEnglish = !/[\u4e00-\u9fa5]/.test(now);
    if (stillEnglish && !translatedNow) missed.push(raw);
  });
  console.log('===== ' + path.basename(file) + ' =====');
  console.log('原文 ' + origs.size + ' 条，其中"页面仍是英文且引擎翻不出" ' + missed.length + ' 条：');
  missed.sort().forEach((t) => {
    console.log('  ' + t.slice(0, 110));
    allMissed.set(t, (allMissed.get(t) || 0) + 1);
  });
  console.log('');
});

console.log('合计待补 ' + allMissed.size + ' 条（去重）');
