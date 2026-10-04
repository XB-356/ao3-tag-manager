/* 从快照里抽出"被扩展处理过的元素"的原文与现文，逐条对比 */
const fs = require('fs');
const h = fs.readFileSync(process.argv[2], 'utf8');
const re = /data-ao3tm-orig="([^"]*)"[^>]*>([\s\S]{0,260}?)</g;
let m;
const seen = new Set();
const rows = [];
while ((m = re.exec(h))) {
  const orig = m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  const inner = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!inner) continue;
  const key = orig + '||' + inner;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push({ orig, inner });
}
console.log('被处理过的元素 ' + rows.length + ' 个，其中"中英夹杂或有排版问题"的：');
rows.forEach((r) => {
  const mixed = /[\u4e00-\u9fa5]/.test(r.inner) && /[A-Za-z]{3}/.test(r.inner);
  const leftover = !/[\u4e00-\u9fa5]/.test(r.inner);
  if (mixed || leftover) {
    console.log('  [' + r.orig.slice(0, 70) + ']');
    console.log('     现文: ' + r.inner.slice(0, 100));
  }
});
