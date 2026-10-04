/* 从 AO3 官方 locale（config/locales/views/en.yml）提取可翻译的界面文案，
   生成候选词条清单，便于按官方文案系统化补词典。
   用法：node tools/from-locale.js [--limit N] [--section 前缀] */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = process.env.LOCALE_FILE || path.join(ROOT, '.cache', 'en.yml');

if (!fs.existsSync(SRC)) {
  console.error('找不到官方 locale 文件：' + SRC);
  console.error('请先下载：curl -o .cache/en.yml https://raw.githubusercontent.com/otwcode/otwarchive/master/config/locales/views/en.yml');
  process.exit(2);
}

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : 0;
const secArg = process.argv.indexOf('--section');
const SECTION = secArg !== -1 ? String(process.argv[secArg + 1]) : '';

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

// 读取我们已有的词典键，避免重复
const i18nSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'i18n.js'), 'utf8');
const dictBlock = i18nSrc.match(/const PHRASES = \{([\s\S]*?)\n  \};/);
const have = new Set(
  [...dictBlock[1].matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)].map((m) => m[1].replace(/\\'/g, "'").toLowerCase())
);

/** 解析 "  key: value"，记录缩进与所属段落 */
function parse() {
  const out = [];
  let path_ = [];
  lines.forEach(function (raw) {
    const line = raw.replace(/\t/g, '  ');
    if (!line.trim() || line.trim().charAt(0) === '#') return;
    const indent = line.match(/^ */)[0].length;
    const m = line.match(/^(\s*)([^\s:][^:]*):\s*(.*)$/);
    if (!m) return;
    const key = m[2].trim();
    let value = m[3].trim();
    path_ = path_.slice(0, Math.floor(indent / 2));
    if (value === '') {
      path_[Math.floor(indent / 2)] = key;
      return;
    }
    // 去掉引号
    if ((value.charAt(0) === '"' && value.slice(-1) === '"') || (value.charAt(0) === "'" && value.slice(-1) === "'")) {
      value = value.slice(1, -1);
    }
    out.push({ path: path_.slice(0, Math.floor(indent / 2)).concat(key).join('.'), value: value });
  });
  return out;
}

const entries = parse();

/** 只保留"能直接整段替换、且是给人看的界面文案" */
function usable(entry) {
  const v = entry.value;
  if (!v || v.length < 2) return false;
  if (/%\{/.test(v)) return false; // 含插值
  if (/<[a-z/][^>]*>/i.test(v)) return false; // 含 HTML
  if (/^[\d\s.,:%$#-]+$/.test(v)) return false; // 纯数字/符号
  if (!/[A-Za-z]{2}/.test(v)) return false;
  if (have.has(v.toLowerCase())) return false;
  // 邮件/日期格式之类的 key 不要
  if (/\.(date|time|formats|order|distance|precision|separator)\./.test(entry.path)) return false;
  if (/(^|\.)(activerecord|errors|attributes)\./.test(entry.path)) return false;
  return true;
}

const list = entries.filter(usable).filter((e) => !SECTION || e.path.indexOf(SECTION) === 0);
const uniq = new Map();
list.forEach((e) => {
  if (!uniq.has(e.value)) uniq.set(e.value, e.path);
});

console.log('官方 locale 条目 ' + entries.length + ' 条；可整段替换且词典里还没有的 ' + uniq.size + ' 条');
console.log('（本条命令只做盘点，不直接改词典）');

if (process.argv.includes('--sections')) {
  const counts = new Map();
  uniq.forEach((key) => {
    const parts = key.split('.');
    const section = parts.slice(1, 3).join('.');
    counts.set(section, (counts.get(section) || 0) + 1);
  });
  console.log('\n按章节统计（未收录条数）：');
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .forEach(([name, n]) => console.log('  ' + String(n).padStart(4) + '  ' + name));
  process.exit(0);
}

const shown = LIMIT ? [...uniq.entries()].slice(0, LIMIT) : [...uniq.entries()];
shown.forEach(([value, key]) => console.log('  ' + value + '    [' + key + ']'));
