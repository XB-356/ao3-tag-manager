/* 汉化的"不该替换"回归测试：用户内容 / 标题 / 筛选语法一个字都不能动
   用法：node test/i18n-guard.js */
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

/** 这些是"用户内容 / 标题 / 站点数据"，必须原样返回 */
const mustNotChange = [
  'Characters Haunting the Narrative',
  'The Big Bang, Baby Challenge is Moving to AO3',
  'Updates to "No Fandom" Additional Tags, September 2026',
  'The OTW is Recruiting for Communications, Accessibility, Design, & Technology, User Research',
  'tip: arthur merlin words>1000 sort:hits',
  'tip: austen words:10000-50000 sort:标题',
  'Fri, 02 Oct 2026 07:14PM UTC',
  'The Big Bang, Baby Challenge was created in 2005 to incentivize the creation of more canon-based novels.',
  'I write fluffy things and I like tea. Works: 12 is my favourite number.',
  'Harry Potter',
  'No Fandom',
  'September 2026'
];

mustNotChange.forEach((text) => {
  const out = i18n.translate(text);
  check('不该替换：' + JSON.stringify(text.slice(0, 46)), out === text, out);
});

/** 这些是真正的界面文案，必须翻译（防止上面的保护把正常翻译也挡掉） */
const mustChange = [
  ['Terms of Service', '服务条款'],
  ['Content Policy', '内容政策'],
  ['Privacy Policy', '隐私政策'],
  ['Previous Post', '上一篇'],
  ['Next Post', '下一篇'],
  ['About Us', '关于我们'],
  ['All Fandoms', '全部同人圈'],
  ['Dismiss permanently', '不再提示'],
  ['Publish New', '发布新作品']
];
mustChange.forEach(([text, want]) => {
  const out = i18n.translate(text);
  check('必须翻译：' + JSON.stringify(text), out === want, out);
});

/** 长句但确实是界面文案的，仍要翻（不被"长文本保护"挡住） */
const longUi = [
  ['If you need technical support, contact our Support team.', '如果你需要技术支持，请联系我们的支持团队。'],
  ['This work could have adult content. If you continue, you have agreed that you are willing to see such content.', '这篇作品可能包含成人内容。继续访问即表示你同意查看此类内容。']
];
longUi.forEach(([text, want]) => {
  const out = i18n.translate(text);
  check('长句界面文案仍要翻：' + JSON.stringify(text.slice(0, 40)), out === want, out);
});

console.log('\n===== 结果 =====');
console.log(results.length - failed + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);
