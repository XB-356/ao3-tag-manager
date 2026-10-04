/* 从真实页面 HTML 里提取"可见界面文本"，用于核对汉化覆盖率（不依赖浏览器）
   用法：node tools/extract-text.js "D:\Download\Home _ Archive of Our Own.html" */
const fs = require('fs');

const SKIP_TAGS = /^(script|style|noscript|svg|head|title|meta|link)$/i;
const file = process.argv[2];
if (!file) {
  console.error('用法：node tools/extract-text.js <html 文件>');
  process.exit(2);
}
const html = fs.readFileSync(file, 'utf8');

// 粗粒度提取：标签之间的文本（够用来做覆盖率盘点）
const text = html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, '\n');

const lines = text
  .split('\n')
  .map((s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim())
  .filter((s) => s && !SKIP_TAGS.test(s));

// 只要含英文字母、且长度 >= 3 的片段
const english = [];
const seen = new Set();
lines.forEach((line) => {
  if (!/[A-Za-z]{3}/.test(line)) return;
  if (line.length < 3 || line.length > 200) return;
  if (seen.has(line)) return;
  seen.add(line);
  english.push(line);
});

console.log('候选英文界面文本 ' + english.length + ' 条：');
english.forEach((line) => console.log('  ' + line));
