/* AO3 标签管家 —— 宿主观测与域名判定（共享核心，普通脚本）
   同一份代码要跑在两处：
     · 内容脚本 / 油猴脚本：由 src/lib/env.js 当普通脚本加载
     · MV3 service worker：由 src/lib/env.mjs 当 ES 模块导入
   所以这里不写 IIFE、不写 export，只负责把结果挂到 globalThis.AO3TM.envGlobal 上，
   两种加载方式都能用。（MV3 的内容脚本不允许 ESM 语法，故必须这样拆。） */
(function (root) {
  'use strict';

  if (root.AO3TM && root.AO3TM.envGlobal) return; // 已初始化

  const DEFAULT_HOSTS = ['archiveofourown.org', 'www.archiveofourown.org'];
  const TEST_HOSTS = ['127.0.0.1', 'localhost'];

  /** 预置的 AO3 镜像站（可在设置里增删；不预置可疑站点） */
  const PRESET_MIRRORS = [
    'archive.transformativeworks.org',
    'ao3.cubeart.club',
    'ao3.win',
    'ao3.top',
    'ao3l.online'
  ];

  const api = root.chrome && root.chrome.runtime && root.chrome.runtime.id ? root.chrome : null;

  /** 'extension' | 'userscript' */
  const mode = api ? 'extension' : 'userscript';

  const lang = (function () {
    const raw = (root.navigator && (root.navigator.language || root.navigator.userLanguage)) || 'zh-CN';
    return String(raw).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
  })();

  function readCustomHosts() {
    try {
      const raw = root.localStorage && root.localStorage.getItem('ao3tm_hosts');
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map(normalizeHost).filter(Boolean) : [];
    } catch (err) {
      return [];
    }
  }

  function saveCustomHosts(list) {
    try {
      root.localStorage.setItem('ao3tm_hosts', JSON.stringify(list || []));
    } catch (err) {
      /* 隐私模式等场景忽略 */
    }
  }

  /** 把用户输入整理成纯 hostname，例如 https://ao3.foo/works → ao3.foo */
  function normalizeHost(input) {
    let value = String(input == null ? '' : input).trim().toLowerCase();
    if (!value) return '';
    value = value.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
    if (value.indexOf('*') !== -1 || value.indexOf(' ') !== -1) return '';
    // 单标签主机名（localhost）也允许，方便本地测试；公网域名必须带点
    if (TEST_HOSTS.indexOf(value) !== -1) return value;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) return '';
    return value;
  }

  /** 当前页面是否属于 AO3（含镜像、本地测试域、本地 HTML 文件） */
  function isAo3Host(host) {
    const name = String(host || (root.location && root.location.hostname) || '').toLowerCase();
    if (!name) {
      // file:// 打开的本地页面没有 hostname；用户手动开启"允许访问文件网址"后
      // 通常是想在本地快照上试用，所以这里放行，页面结构不对时注入的工具条不会出现。
      return /^file:/.test(String((root.location && root.location.protocol) || ''));
    }
    if (DEFAULT_HOSTS.indexOf(name) !== -1) return true;
    if (TEST_HOSTS.indexOf(name) !== -1) return true;
    if (PRESET_MIRRORS.indexOf(name) !== -1) return true;
    return readCustomHosts().indexOf(name) !== -1;
  }

  /** match pattern，供 chrome.scripting 注册 / manifest 声明使用。
      同时给出 http 与 https：镜像站两种协议都可能出现（自建镜像常常只有 http），
      只声明 https 会导致通过 http 访问时内容脚本不注入。 */
  function hostToMatchPatterns(host) {
    return ['https://' + host + '/*', 'http://' + host + '/*'];
  }

  /** 兼容旧调用：返回 https 模式 */
  function hostToMatchPattern(host) {
    return 'https://' + host + '/*';
  }

  root.AO3TM = root.AO3TM || {};
  // 构建标记：排查"浏览器里跑的到底是不是最新代码"（与 manifest.version 保持一致）
  root.AO3TM.BUILD = '1.2.3.21';

  root.AO3TM.envGlobal = {
    mode: mode,
    isExtension: mode === 'extension',
    isUserscript: mode === 'userscript',
    lang: lang,
    chrome: api,
    protocol: (root.location && root.location.protocol) || '',
    DEFAULT_HOSTS: DEFAULT_HOSTS,
    TEST_HOSTS: TEST_HOSTS,
    PRESET_MIRRORS: PRESET_MIRRORS,
    isAo3Host: isAo3Host,
    readCustomHosts: readCustomHosts,
    saveCustomHosts: saveCustomHosts,
    normalizeHost: normalizeHost,
    hostToMatchPattern: hostToMatchPattern,
    hostToMatchPatterns: hostToMatchPatterns
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
