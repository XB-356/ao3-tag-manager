/* 汉化引擎单元测试（不用浏览器）：词典、分段翻译、长句内嵌短语替换
   用法：node test/i18n.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

const sandbox = {
  console,
  document: null,
  window: null,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: (fn) => setTimeout(fn, 0)
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach(function (rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
});

const i18n = sandbox.AO3TM.i18n;
const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok });
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) console.log('   实际: ' + JSON.stringify(detail));
}

check('i18n 模块与测试出口可用', typeof i18n.translate === 'function' && typeof i18n.translateInline === 'function', Object.keys(i18n));

/* --- 词典精确匹配 --- */
const cases = [
  ['Profile', '个人资料'],
  ['Skins', '皮肤'],
  ['Inbox', '收件箱'],
  ['Statistics', '统计'],
  ['Drafts', '草稿'],
  ['Sign-ups', '报名'],
  ['Assignments', '任务'],
  ['Claims', '领取'],
  ['Related Works', '相关作品'],
  ['Gifts', '礼物'],
  ['Pseuds', '笔名'],
  ['Bio', '简介'],
  ['Joined:', '加入时间：'],
  ['Kudos Given:', '送出的 Kudos：'],
  ['Kudos Received:', '收到的 Kudos：'],
  ['Subscriptions', '订阅'],
  ['History', '浏览历史'],
  ['Manage My Pseuds', '管理我的笔名'],
  ['Edit Preferences', '编辑偏好设置'],
  ['Publish New', '发布新作品'],
  ['Edit Works', '编辑作品'],
  ['Invitations', '邀请'],
  ['Dismiss permanently', '不再提示']
];
const missing = cases.filter(function (pair) {
  return i18n.translate(pair[0]) !== pair[1];
}).map(function (pair) {
  return pair[0] + ' -> ' + i18n.translate(pair[0]);
});
check('词典精确匹配：' + cases.length + ' 条界面文案都能翻', missing.length === 0, missing);

/* --- 分段翻译 --- */
check('分段：Default Rating: Not Rated', /默认分级/.test(String(i18n.translateCompoundText('Default Rating: Not Rated'))), i18n.translateCompoundText('Default Rating: Not Rated'));
check('分段：Joined: 12 March 2019 保留日期', String(i18n.translateCompoundText('Joined: 12 March 2019')).indexOf('12 March 2019') !== -1, i18n.translateCompoundText('Joined: 12 March 2019'));
check('分段：纯用户内容不翻（返回 null）', i18n.translateCompoundText('I write fluffy things and I like tea') === null, i18n.translateCompoundText('I write fluffy things and I like tea'));

/* --- 长句里嵌链接 --- */
check(
  '回归：新闻标题里的标签类别名不会被误翻',
  i18n.translateInline('Updates to "No Fandom" Additional Tags, September 2026') === null,
  i18n.translateInline('Updates to "No Fandom" Additional Tags, September 2026')
);
check(
  '回归：标签类别名作为独立文案仍然要翻（Additional Tags -> 附加标签）',
  i18n.translate('Additional Tags') === '附加标签',
  i18n.translate('Additional Tags')
);
check(
  '回归：欢迎语第二句能整句翻（跨行/多空格也不影响）',
  (() => {
    const out = i18n.translateInline(
      'For help getting started on AO3, check out some useful tips for new users or browse through our FAQs.'
    );
    return out && /想上手 AO3/.test(out) && /常见问题/.test(out) && !/[A-Za-z]{4,}/.test(out.replace(/AO3/g, ''));
  })(),
  i18n.translateInline('For help getting started on AO3, check out some useful tips for new users or browse through our FAQs.')
);
check(
  '回归：多空格/换行折叠的文本也能匹配（\\s+ 放宽）',
  (() => {
    const out = i18n.translateInline('For  help getting started on AO3, check out some useful tips for new users');
    return out && /想上手 AO3/.test(out);
  })(),
  i18n.translateInline('For  help getting started on AO3, check out some useful tips for new users')
);
check(
  '回归：标点清理（不出现"中文。."或"中文."这类混用）',
  (() => {
    const out = i18n.translateInline('or browse through our FAQs.');
    return out === '也可以翻翻常见问题。';
  })(),
  i18n.translateInline('or browse through our FAQs.')
);
const welcome =
  "Hi! It looks like you've just logged in to AO3 for the first time. For help getting started on AO3, check out some useful tips for new users or browse through our FAQs.";
const welcomeOut = i18n.translateInline(welcome);
check(
  '长句：欢迎语里的固定短语被替换，链接文字也翻到',
  welcomeOut && /你好！/.test(welcomeOut) && /给新用户的实用提示/.test(welcomeOut) && /常见问题/.test(welcomeOut),
  welcomeOut
);
const support =
  'If you need technical support, contact our Support team. If you experience harassment or have questions about our Terms of Service (including the Content Policy and Privacy Policy), contact our Policy & Abuse team.';
const supportOut = i18n.translateInline(support);
check(
  '长句：支持/条款提示里的固定短语被替换',
  supportOut && /技术支持/.test(supportOut) && /服务条款/.test(supportOut) && /内容政策与隐私政策/.test(supportOut),
  supportOut
);

/* --- 截图里实际没翻到的那些（回归用例） --- */
check(
  '回归：欢迎语能翻（截图里只翻出半句）',
  (() => {
    const out = i18n.translateInline('Hi! It looks like you\'ve just logged in to AO3 for the first time.');
    return out && /你好！看起来这是你第一次登录 AO3。/.test(out);
  })(),
  i18n.translateInline('Hi! It looks like you\'ve just logged in to AO3 for the first time.')
);
check(
  '回归：(including the Content Policy and Privacy Policy) 括号整段能翻',
  (() => {
    const out = i18n.translateInline('(including the Content Policy and Privacy Policy)');
    return out && /（包括内容政策与隐私政策）/.test(out);
  })(),
  i18n.translateInline('(including the Content Policy and Privacy Policy)')
);
check(
  '回归：dismiss 按钮文案能翻',
  i18n.translate('Dismiss permanently') === '不再提示' && i18n.translate('Dismiss') === '忽略',
  [i18n.translate('Dismiss permanently'), i18n.translate('Dismiss')]
);
check(
  '回归：首页文案能翻（阅读全文 / 关注我们 / 浏览同人圈提示）',
  i18n.translate('Read more...') === '阅读全文…' &&
    i18n.translate('Follow us') === '关注我们' &&
    /按媒体类型浏览同人圈/.test(String(i18n.translate('browse fandoms by media or favorite up to 20 tags to have them listed here!'))),
  [i18n.translate('Read more...'), i18n.translate('Follow us')]
);
check(
  '回归：资料页空作品提示能翻',
  /你还没有以这个笔名发布过任何作品/.test(String(i18n.translateInline("You don't have anything posted under this name yet."))) &&
    /要发布新作品/.test(String(i18n.translateInline('Would you like to publish a new work or maybe a new bookmark?'))),
  [i18n.translateInline("You don't have anything posted under this name yet."), i18n.translateInline('Would you like to publish a new work or maybe a new bookmark?')]
);
check(
  '长句：纯用户散文不会被替换（没有可命中的站点短语）',
  i18n.translateInline('I really love this pairing and the author writes them so well.') === null,
  i18n.translateInline('I really love this pairing and the author writes them so well.')
);
check(
  '长句：短词不会误伤（避免把普通单词当界面文案）',
  i18n.translateInline('The edit was saved by the author.') === null,
  i18n.translateInline('The edit was saved by the author.')
);

/* --- 真实页面 HTML 里取出的节点（回归） --- */
check(
  '回归：带换行缩进的公告散文（Follow AO3 on Bluesky…）整段能翻',
  (() => {
    const raw =
      "Follow AO3 on Bluesky or Tumblr for status updates, and don't forget to\n          check out the\n          Organization for Transformative Works' news outlets\n          for\n          updates on our other projects!";
    const out = i18n.translate(raw);
    return out && /关注 AO3/.test(out) && /新闻渠道/.test(out);
  })(),
  'raw'
);
check(
  '回归：不再出现"关于 the Archive"这种中英夹杂',
  i18n.translate('About the Archive') === '关于本站' && i18n.translate('Site Map') === '站点地图',
  [i18n.translate('About the Archive'), i18n.translate('Site Map')]
);
check(
  '回归："If you need technical support," 片段（链接前）能翻',
  i18n.translate('If you need technical support,') === '如果你需要技术支持，',
  i18n.translate('If you need technical support,')
);
check(
  '回归：短月份缩写只在独立出现时翻，不误伤长单词',
  i18n.translate('Sep') === '9月' && i18n.translate('Fri') === '周五' && i18n.translateInline('The separator works fine.') === null,
  [i18n.translate('Sep'), i18n.translate('Fri'), i18n.translateInline('The separator works fine.')]
);
check(
  '回归：媒体分类名能翻',
  i18n.translate('Anime & Manga') === '动画与漫画' && i18n.translate('Video Games') === '电子游戏',
  [i18n.translate('Anime & Manga'), i18n.translate('Video Games')]
);

/* --- 空值安全 --- */
check('传非字符串不抛异常', i18n.translateInline(null) === null && i18n.translateInline(undefined) === null);

console.log('\n===== 结果 =====');
console.log(results.length - failed + '/' + results.length + ' 通过');
if (failed) results.filter((r) => !r.ok).forEach((r) => console.log('  - ' + r.name));
process.exit(failed ? 1 : 0);
