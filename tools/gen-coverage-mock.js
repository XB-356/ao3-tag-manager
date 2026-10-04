/* 由 test/coverage-strings.js 生成 test/mock/coverage.html：
   1) 界面文案塞进 AO3 真实界面结构（验证"该翻的要翻"）
   2) 用户数据塞进 ul.fandom / ul.tag / blockquote 等用户内容区（验证"不该动的别动"）
   用法：node tools/gen-coverage-mock.js */
const fs = require('fs');
const path = require('path');
const items = require(path.join(__dirname, '..', 'test', 'coverage-strings.js'));
const userData = items.MUST_NOT_CHANGE || [];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const uiRows = items.map(([en], i) => {
  const body = '<span data-idx="' + i + '">' + esc(en) + '</span>';
  const wrap = i % 5;
  if (wrap === 0) return '        <dt>' + body + '</dt>';
  if (wrap === 1) return '        <label for="f' + i + '">' + body + '</label>';
  if (wrap === 2) return '        <legend>' + body + '</legend>';
  if (wrap === 3) return '        <li><button type="button">' + body + '</button></li>';
  return '        <p class="notes">' + body + '</p>';
});

const dataRows = userData.map((s, i) =>
  '          <li><a href="#"><span data-uidx="' + i + '">' + esc(s) + '</span></a></li>'
).join('\n');

const html = [
  '<!doctype html>',
  '<html lang="en">',
  '  <head><meta charset="utf-8" /><meta name="generator" content="OTW Archive" /><title>coverage mock</title></head>',
  '  <body>',
  '    <div id="header"><strong>Archive of Our Own</strong>',
  '      <ul class="navigation actions" role="navigation"><li><a href="#">Fandoms</a></li></ul>',
  '    </div>',
  '    <div id="main" role="main">',
  '      <form class="filters" action="#">',
  '      <fieldset>',
  uiRows.join('\n'),
  '      </fieldset>',
  '      </form>',
  '      <!-- 用户数据：同人圈列表 -->',
  '      <ul class="fandom index group">',
  dataRows,
  '      </ul>',
  '      <!-- 用户数据：标签列表 -->',
  '      <ul class="tag index group">',
  '        <li><a href="#"><span data-uidx="' + (userData.indexOf('Top Park Jongseong | Jay')) + '">' + esc('Top Park Jongseong | Jay') + '</span></a></li>',
  '      </ul>',
  '      <!-- 用户数据：标签云 / 系列列表 -->',
  '      <ul class="work index group">',
  '        <li><a href="#"><span data-uidx="' + (userData.indexOf('By Choice, by Fate, or Neither')) + '">' + esc('By Choice, by Fate, or Neither') + '</span></a></li>',
  '      </ul>',
  '      <!-- 用户数据：自己的简介 -->',
  '      <blockquote class="userstuff"><p><span data-uidx="' + (userData.indexOf('I write fluffy things and I like tea. Works: 12 is my favourite number.')) + '">' + esc('I write fluffy things and I like tea. Works: 12 is my favourite number.') + '</span></p></blockquote>',
  '      <!-- 用户数据：搜索框语法提示 -->',
  '      <p class="notes"><span data-uidx="' + (userData.indexOf('tip: arthur merlin words>1000 sort:hits')) + '">' + esc('tip: arthur merlin words>1000 sort:hits') + '</span></p>',
  '    </div>',
  '    <div id="footer"><ul><li><a href="#">Known Issues</a></li></ul></div>',
  '  </body>',
  '</html>',
  ''
].join('\n');

const out = path.join(__dirname, '..', 'test', 'mock', 'coverage.html');
fs.writeFileSync(out, html, 'utf8');
console.log('生成 ' + out + '（界面 ' + items.length + ' 条 + 用户数据 ' + userData.length + ' 条）');