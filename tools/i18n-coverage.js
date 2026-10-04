/* 盘点：真实页面里的英文界面文本，哪些还没进词典
   用法：node tools/i18n-coverage.js "文件1.html" "文件2.html" */
const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('用法：node tools/i18n-coverage.js <html...>');
  process.exit(2);
}

// 读取词典键
const src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'lib', 'i18n.js'), 'utf8');
const dictBlock = src.match(/const PHRASES = \{([\s\S]*?)\n  \};/);
const keys = [...dictBlock[1].matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)].map((m) => m[1].replace(/\\'/g, "'"));
const keySet = new Set(keys.map((k) => k.toLowerCase()));

// 明显不该翻的（站点数据 / 专有名词 / 公告正文）
const SKIP = [
  /^otwarchive/i, /^GPL-/, /^@/, /^ao3org on/i, /^tip:/i, /^全部/, /^Hi, XB356/,
  /^Releases 1\.0/, /^The Big Bang/, /^Updates to/, /^Known Issues$/,
  /^Reveni/, /^Snow Blue$/, /^Reversi$/, /^Low Vision/, /^Default$/
];

function extract(html) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, '\n');
  return text
    .split('\n')
    .map((s) =>
      s
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((s) => s && /[A-Za-z]{3}/.test(s) && s.length >= 3 && s.length <= 200);
}

const missing = new Map();
files.forEach((file) => {
  extract(fs.readFileSync(file, 'utf8')).forEach((line) => {
    if (keySet.has(line.toLowerCase())) return;
    if (SKIP.some((re) => re.test(line))) return;
    // 只关心"看起来像界面文案"的：首字母大写、或含常见界面动词
    if (!/^[A-Z0-9]/.test(line)) return;
    missing.set(line, (missing.get(line) || 0) + 1);
  });
});

console.log('词典 ' + keys.length + ' 条');
console.log('页面里"未收录且像界面文案"的 ' + missing.size + ' 条：');
[...missing.keys()].sort().forEach((line) => console.log('  ' + line));
