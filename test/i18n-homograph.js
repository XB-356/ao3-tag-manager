/* 多义词回归：Top / Last / Or 不能作为片段被替换
   用法：node test/i18n-homograph.js */
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

/* 多义词出现在用户内容里时，一个字都不能动 */
const protected_ = [
  ['Top Park Jongseong | Jay', 'AO3 攻受标签（Top = 攻）'],
  ['Bottom Park Sunghoon (ENHYPEN)', 'AO3 攻受标签'],
  ['By Choice, by Fate, or Neither', '作品标题里的 or'],
  ['Top Gun', '作品标题里的 Top'],
  ['Last Night I Dreamt', '标题里的 Last'],
  ['Or Else', '标题里的 Or'],
  ['Top', '单独 Top（可能是标签）'],
  ['Last', '单独 Last'],
  ['Or', '单独 Or']
];
protected_.forEach(([text, note]) => {
  const out = i18n.translate(text);
  check('多义词不得被动：' + JSON.stringify(text.slice(0, 38)) + '（' + note + '）', out === text, out);
});

/* 但真正的界面文案必须照翻 */
const ui = [
  ['↑ Top', '↑ 回到顶部'],
  ['Last visited:', '最近浏览：'],
  ['Donate or Volunteer', '捐赠或参与志愿']
];
ui.forEach(([text, want]) => {
  const out = i18n.translate(text);
  check('界面文案要翻：' + JSON.stringify(text), out === want, out);
});

console.log('\n===== 结果 =====');
console.log(results.length - failed + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);
