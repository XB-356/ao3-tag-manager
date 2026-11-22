/* AO3 标签管家 —— 「所有网站」轻量扫描入口
   只有开启了自动检测（拿到 <all_urls> 权限）时，这个脚本才会被注入到陌生站点上。
   它只做一件事：跑一次自动检测，像 AO3 就把横幅挂出来。
   绝不能改成 main.js —— 那会连带注入面板、汉化、过滤整套模块，
   等于在别人网站上跑我们的全部逻辑，又慢又没必要。 */
(function (root) {
  'use strict';

  function run() {
    const auto = root.AO3TM && root.AO3TM.autoDetect;
    if (!auto) return;
    // 记一笔，方便在控制台里确认"扫描脚本真的跑到了这个页面"
    root.AO3TM.scan = { ran: true, at: Date.now() };
    auto.autoRun();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
