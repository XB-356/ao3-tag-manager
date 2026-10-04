/* 检查真实页面里"被替换过的文本"——找 data-ao3tm-i18n 标记，看看哪些替换是可疑的
   用法：node tools/audit-replacements.js <html...> */
const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
files.forEach((file) => {
  const html = fs.readFileSync(file, 'utf8');
  console.log('===== ' + path.basename(file) + ' =====');
  // 抓「有 data-ao3tm-orig 且元素内有中文」的标签，打印原文 -> 现文
  const re = /<([a-z]+)([^>]*data-ao3tm-orig="([^"]*)"[^>]*)>([\s\S]{0,160}?)<\/\1>/gi;
  let m;
  let n = 0;
  const rows = [];
  while ((m = re.exec(html)) && n < 400) {
    n += 1;
    const orig = m[3];
    const now = m[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!now) continue;
    if (!/[\u4e00-\u9fa5]/.test(now)) continue; // 没翻的跳过
    // 只看"替换后中文里还夹着英文单词"的（最像误翻）
    if (!/[A-Za-z]{3}/.test(now)) continue;
    rows.push({ orig: orig.replace(/\s+/g, ' ').trim().slice(0, 90), now: now.slice(0, 90) });
  }
  console.log('中英夹杂的替换 ' + rows.length + ' 处：');
  rows.forEach((r) => console.log('  [' + r.orig + ']\n    -> ' + r.now));
  console.log('');
});
