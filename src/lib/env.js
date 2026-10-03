/* AO3 标签管家 —— 宿主环境适配（内容脚本 / 油猴版）
   真正的判定逻辑在 env-core.js（普通脚本，扩展与 service worker 共用）；
   这里把它取出来挂到 AO3TM.env，供页面侧模块使用。 */
var _ao3tmExport = (function (root) {
  'use strict';

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.env = root.AO3TM.envGlobal;
  return root.AO3TM;
})(typeof globalThis !== 'undefined' ? globalThis : self);
