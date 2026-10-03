/* 构建油猴脚本版（手机/平板浏览器用）
   用法：node tools/build-userscript.js  →  dist/ao3-tag-manager.user.js

   与扩展版的差异：
     · 不含 mirrors.js（没有 chrome.permissions，镜像域名写死在 @match）
     · 不含 popup / background（没有扩展 UI 与 service worker）
     · 样式内联进脚本（油猴没有 content_scripts 的 css 声明） */
const fs = require('fs');
const path = require('path');
const { ROOT, bundleSources } = require('./bundle');

const DIST = path.join(ROOT, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const OUT = path.join(DIST, 'ao3-tag-manager.user.js');

/** 复用扩展的注入顺序，但排除只给 service worker 用的 ESM 包装与 mirrors（油猴无 chrome API） */
const FILES = manifest.content_scripts[0].js.filter(function (rel) {
  return rel.indexOf('mirrors.js') === -1;
});
const CSS_FILES = manifest.content_scripts[0].css || [];

/** 油猴脚本文案与版本 */
const NAME = 'AO3 标签管家';
const VERSION = manifest.version;
const DESCRIPTION = '在 AO3（含镜像站）上记忆并管理标签与作者的屏蔽 / 只看规则：列表内快捷屏蔽、右键标签屏蔽、只看模式、深色适配与界面汉化。';

/* 官方站 + 预置镜像；用户可自行增删 @match 行。
   注意不要写通配全部站点的 match（如 https 加星号加斜杠星号），
   油猴会拒绝这种写法，而且也没必要。 */
const PRESET_MIRRORS = [
  'archive.transformativeworks.org',
  'ao3.cubeart.club',
  'ao3.win',
  'ao3.top',
  'ao3l.online',
  'ao3mirror.com',
  'www.ao3mirror.com'
];
const MATCHES = ['https://archiveofourown.org/*']
  .concat(
    PRESET_MIRRORS.map(function (host) {
      return 'https://' + host + '/*';
    })
  )
  .concat(
    PRESET_MIRRORS.map(function (host) {
      return 'http://' + host + '/*';
    })
  );

const header = [
  '// ==UserScript==',
  '// @name         ' + NAME,
  '// @namespace    https://github.com/XB-356/ao3-tag-manager',
  '// @version      ' + VERSION,
  '// @description  ' + DESCRIPTION,
  '// @author       DeepSeek V4.1 Flash',
  '// @license      GPL-3.0',
  '// @homepageURL  https://github.com/XB-356/ao3-tag-manager',
  '// @supportURL   https://github.com/XB-356/ao3-tag-manager/issues',
  '// @downloadURL  https://github.com/XB-356/ao3-tag-manager/releases/latest/download/ao3-tag-manager.user.js',
  '// @updateURL    https://github.com/XB-356/ao3-tag-manager/releases/latest/download/ao3-tag-manager.user.js',
  '// @run-at       document-idle',
  '// @grant        none',
  '// @noframes',
  MATCHES.map(function (pattern) {
    return '// @match        ' + pattern;
  }).join('\n'),
  '// ==/UserScript==',
  ''
].join('\n');

const banner = [
  '',
  '/* ==== ' + NAME + ' v' + VERSION + '（油猴脚本版） ====',
  ' * 由 DeepSeek V4.1 Flash 代工。源码与扩展版同源：',
  ' * https://github.com/XB-356/ao3-tag-manager',
  ' *',
  ' * 想支持新的镜像站？在脚本头部加一行即可：',
  ' *   // @match        https://你的域名/*',
  ' */',
  ''
].join('\n');

const parts = [header, banner];

// 样式内联：包一层 <style>，由脚本自己插到页面里
const css = CSS_FILES.map(function (rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}).join('\n');

parts.push(
  '(function () {',
  "  'use strict';",
  '  var AO3TM_CSS = ' + JSON.stringify(css) + ';',
  '  function injectStyle() {',
  "    if (document.getElementById('ao3tm-style')) return;",
  "    var style = document.createElement('style');",
  "    style.id = 'ao3tm-style';",
  '    style.textContent = AO3TM_CSS;',
  '    (document.head || document.documentElement).appendChild(style);',
  '  }',
  "  if (document.readyState === 'loading') {",
  "    document.addEventListener('DOMContentLoaded', injectStyle, { once: true });",
  '  } else {',
  '    injectStyle();',
  '  }',
  '})();',
  ''
);

parts.push(bundleSources(FILES));
const banner2 = [
  '/* 启动：内容脚本在扩展里由 manifest 调度，油猴下自己触发 */',
  '(function () {',
  "  function ready(fn) {",
  "    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });",
  '    else fn();',
  '  }',
  '  ready(function () {',
  '    // main.js 已经自己监听了 DOMContentLoaded / 立即执行，这里只做兜底',
  "    if (window.AO3TM && window.AO3TM.ui && !window.AO3TM.ui.__booted) {",
  '      window.AO3TM.ui.__booted = true;',
  '    }',
  '  });',
  '})();',
  ''
].join('\n');
parts.push(banner2);

const bundle = parts.join('\n');

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT, bundle, 'utf8');

console.log('文件: ' + path.relative(ROOT, OUT));
console.log('大小: ' + Math.round(fs.statSync(OUT).size / 1024) + ' KB');
console.log('包含 ' + FILES.length + ' 个模块，@match ' + MATCHES.length + ' 条');
console.log('语法自检中…');
require('vm').compileFunction(bundle, [], { filename: 'ao3-tag-manager.user.js' });
console.log('语法自检通过');
