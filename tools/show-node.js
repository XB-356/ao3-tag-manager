/* 查看真实页面里某个片段的原始 HTML 结构（含节点边界）
   用法：node tools/show-node.js <html文件> "<搜索片段>" [前后字符数] */
const fs = require('fs');

const file = process.argv[2];
const needle = process.argv[3];
const span = Number(process.argv[4] || 400);
if (!file || !needle) {
  console.error('用法：node tools/show-node.js <html> "<片段>" [span]');
  process.exit(2);
}
const html = fs.readFileSync(file, 'utf8');
let from = 0;
let count = 0;
while (count < 3) {
  const i = html.indexOf(needle, from);
  if (i === -1) break;
  count += 1;
  console.log('===== 命中 #' + count + '（偏移 ' + i + '）=====');
  console.log(html.slice(Math.max(0, i - span), i + needle.length + span));
  console.log('');
  from = i + needle.length;
}
if (!count) console.log('未找到：' + needle);
