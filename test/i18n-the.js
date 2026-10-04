/* "The" 相关回归：孤立定冠词 vs 含 The 的标题
   用法：node test/i18n-the.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const s = { console, document: null, window: null, setTimeout, clearTimeout };
s.globalThis = s;
s.self = s;
vm.createContext(s);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), s, { filename: r })
);
const i18n = s.AO3TM.i18n;

const results = [];
let failed = 0;
const check = (name, ok, detail) => {
  results.push({ name, ok });
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) console.log('   实际: ' + JSON.stringify(detail));
};

/* 含 The 的标题/句子一个字都不能动 */
const mustKeep = [
  'The Big Bang, Baby Challenge is Moving to AO3',
  'The OTW is Recruiting for Communications, Accessibility, Design, & Technology',
  'The Hobbit',
  'The Screeny Drop It',
  'The entity that set up the proxy site can see what you submit'
];
mustKeep.forEach((text) => {
  const out = i18n.translate(text);
  check('含 The 的文本不得被动：' + JSON.stringify(text.slice(0, 44)), out === text, out);
});

/* 关于我们页首段的关键组成必须翻出来 */
const mustTranslate = [
  ['Archive of Our Own', 'AO3（Archive of Our Own）'],
  ['Open Doors', 'Open Doors（开放之门）'],
  ['imports at-risk archives and fanzines to AO3.', '把濒危的存档与同人志导入 AO3。']
];
mustTranslate.forEach(([text, want]) => {
  const out = i18n.translate(text);
  check('必须翻译：' + JSON.stringify(text.slice(0, 40)), out === want, out);
});

/* 首段后半句（真正漏过的那条）必须整段命中 */
const para =
  '(AO3) is a non-profit, non-commercial fanwork archive for transformative fanworks; created by and for fans of books, music, art, games, shows, movies, real-person fiction (RPF), and other fandoms.';
const paraOut = i18n.translate(para);
check(
  '首段后半句整段翻译',
  paraOut !== para && /非营利、非商业的同人作品存档站/.test(paraOut) && !/non-profit/.test(paraOut),
  paraOut
);

console.log('\n===== 结果 =====');
console.log(results.length - failed + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);
