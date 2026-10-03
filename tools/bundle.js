/* 打包与测试共用的拼接工具。
   背景：src/lib/env.js 与 src/lib/mirrors.js 需要两种身份——
     · 扩展内容脚本 / 油猴脚本：以普通脚本运行（挂在 AO3TM 上）
     · MV3 service worker：以 ES 模块静态导入（MV3 禁止动态 import()）
   所以它们在源码里写成 `var _ao3tmExport = (function () { ... })();` 并带一个顶层 export。
   把多个文件拼成一个脚本时，顶层 export 会造成语法错误，这里用同样的包装还原。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/**
 * 去掉文件顶层的 export 声明：
 * 这些文件既要能被 service worker 当 ES 模块静态导入（那时 export 必须留着），
 * 也要能拼成一个普通脚本给油猴/测试用（那时顶层 export 是语法错误）。
 */
function stripExports(code) {
  return code.replace(/^export\s+(?=(const|let|var|function|class|async|\{|\*))/gm, '');
}

/** 把单个源文件包成"匿名函数 + 立即执行"，返回值挂到 _ao3tmExport */
function wrapSource(code) {
  return 'var _ao3tmExport = (function () {\n' + stripExports(code) + '\n})();';
}

/** 读取并拼接多个源文件；每个文件独立包裹，避免变量互相污染 */
function bundleSources(relativePaths, options) {
  const opts = options || {};
  return relativePaths
    .map(function (rel) {
      const code = fs.readFileSync(path.join(ROOT, rel), 'utf8').trim();
      const header = '/* ==================== ' + rel + ' ==================== */';
      const body = opts.raw ? stripExports(code) : wrapSource(code);
      return header + '\n' + body + '\n';
    })
    .join('\n');
}

module.exports = { ROOT, wrapSource, stripExports, bundleSources };
