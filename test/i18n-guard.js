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
  'Fri, 02 Oct 2026 07:14PM UTC',
  'The Big Bang, Baby Challenge was created in 2005 to incentivize the creation of more canon-based novels.',
  'I write fluffy things and I like tea. Works: 12 is my favourite number.',
  'Harry Potter',
  'No Fandom',
  'September 2026',
  'All About Eve',
  'Lazy Town',
  'Angels',
  // 同人圈/系列列表条目（PATTERNS 曾把 "Series" 换成 "个系列"）
  'The 100 Series - Kass Morgan',
  'The 100 Series',
  '100 Cupboards Series - N. D. Wilson',
  '1-800-WHERE-R-U Series - Meg Cabot',
  '13 Treasures Series - Michelle Harrison'
];

mustNotChange.forEach((text) => {
  const out = i18n.translate(text);
  check('不该替换：' + JSON.stringify(text.slice(0, 46)), out === text, out);
});

/** 搜索框语法提示：只翻开头标签，示例查询必须原样保留 */
[
  ['tip: arthur merlin words>1000 sort:hits', '提示：arthur merlin words>1000 sort:hits'],
  ['tip: austen words:10000-50000 sort:标题', '提示：austen words:10000-50000 sort:标题']
].forEach(([text, want]) => {
  const out = i18n.translate(text);
  check('tip 只翻标签、查询保留：' + JSON.stringify(text.slice(0, 34)), out === want, out);
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

/** 通用短词（连接词/普通单词）绝不能作为片段去替换，否则会切碎标题/笔名/皮肤名 */
const fragmentGuard = [
  ['By Choice, by Fate, or Neither', 'By Choice, by Fate, or Neither'],
  ["fire_fireLuc, firefloof-pers (fire_fireLuc)", 'fire_fireLuc, firefloof-pers (fire_fireLuc)'],
  ['The Screeny Drop It', 'The Screeny Drop It'],
  ['Chained Melody', 'Chained Melody'],
  ['Reversi', 'Reversi'],
  ['Immortal Longings', 'Immortal Longings']
];
fragmentGuard.forEach(([text, want]) => {
  const out = i18n.translate(text);
  check('片段键不得切碎文本：' + JSON.stringify(text.slice(0, 40)), out === want, out);
});

/** 而这些是完整界面文案，必须照翻 */
const fullUi = [
  ['Donate or Volunteer', '捐赠或参与志愿'],
  ['Set your preferences now', '现在就去修改偏好'],
  ['Share Bookmark', '分享书签'],
  ['Terms of Service', '服务条款']
];
fullUi.forEach(([text, want]) => {
  const out = i18n.translate(text);
  check('完整界面文案要翻：' + JSON.stringify(text), out === want, out);
});

/** 站点皮肤名属于数据，一律不翻（用户明确要求：雪蓝那类不该被翻译） */
const skinNames = ['Snow Blue', 'Low Vision Default', 'Reversi', 'Default', 'Snow'];
skinNames.forEach((text) => {
  const out = i18n.translate(text);
  check('皮肤名不翻：' + JSON.stringify(text), out === text, out);
});
/** 但"自定义外观"这种界面文案照翻 */
check('界面文案照翻：Customize', i18n.translate('Customize') === '自定义外观', i18n.translate('Customize'));

/** 前缀命中的边界：译文长度 ≠ 原文长度，剩余部分必须按原文切
    （曾导致 "Donate or Volunteer" -> "捐赠或参与志愿或 Volunteer"） */
const prefixBoundary = [
  ['Donate or Volunteer', '捐赠或参与志愿'],
  ['Donate or Votunteer', 'Donate or Votunteer'],
  ['Work Search', '作品搜索'],
  ['By Choice, by Fate, or Neither', 'By Choice, by Fate, or Neither'],
  ['Now or Never', 'Now or Never'],
  ['Terms of Service', '服务条款']
];
prefixBoundary.forEach(([text, want]) => {
  const out = i18n.translate(text);
  check('前缀命中不得切错尾巴：' + JSON.stringify(text), out === want, out);
});

/** 评论表单里的界面文案必须翻（曾被 .comment-form 整块跳过，导致评论区永远英文） */
const commentUi = [
  ['Post Comment', '发表评论'],
  ['Comment as', '评论身份'],
  ['Plain text with limited HTML', '纯文本，支持有限的 HTML'],
  [
    'This work\'s creator has chosen to moderate comments on the work. Your comment will not appear until it has been approved by the creator.',
    '这篇作品的作者开启了评论审核。你的评论要等作者通过后才会显示。'
  ],
  ['Brevity is the soul of wit, but we need your comment to have text in it.', '简洁是智慧的灵魂，但评论总得有内容才行。']
];
commentUi.forEach(([text, want]) => {
  const out = i18n.translate(text);
  check('评论表单界面文案要翻：' + JSON.stringify(text.slice(0, 40)), out === want, out);
});

console.log('\n===== 结果 =====');
console.log(results.length - failed + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);
