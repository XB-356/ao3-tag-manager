/* 从真实快照里找出"中英夹杂"的替换结果（说明某个片段被替换了但剩下的英文没处理）
   用法：node tools/audit-mixed.js <html...> */
const fs = require('fs');
const path = require('path');

process.argv.slice(2).forEach((file) => {
  const h = fs.readFileSync(file, 'utf8');
  const re = /data-ao3tm-orig="([^"]+)"[^>]*>([^<]{0,60})</g;
  let m;
  const seen = new Set();
  const rows = [];
  while ((m = re.exec(h))) {
    const orig = m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const now = m[2].replace(/\s+/g, ' ').trim();
    if (!now) continue;
    if (!/[\u4e00-\u9fa5]/.test(now)) continue; // 没中文，不是"夹杂"
    if (!/[A-Za-z]{2}/.test(now)) continue; // 没英文，正常
    if (seen.has(orig)) continue;
    seen.add(orig);
    rows.push({ orig, now });
  }
  console.log('===== ' + path.basename(file).slice(0, 55) + ' =====');
  console.log('中英夹杂 ' + rows.length + ' 处：');
  rows.forEach((r) => console.log('  [' + r.orig + ']\n    -> ' + r.now));
  console.log('');
});
