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

  /** 剥掉 www 前缀：www.sbxz.org 与 sbxz.org 是同一个站，不该被当成两个域名 */
  function bareHost(value) {
    return String(value == null ? '' : value).trim().toLowerCase().replace(/^www\./, '');
  }

  /** 把用户输入整理成纯 hostname，例如 https://www.ao3.foo/works → ao3.foo
      统一剥 www 是为了"存一个域名、两种写法都能用"：
      不少镜像站会把 sbxz.org 301 到 www.sbxz.org，若不归一化，
      启用时记住的域名和实际访问的域名会对不上，内容脚本就不注入。 */
  function normalizeHost(input) {
    let value = String(input == null ? '' : input).trim().toLowerCase();
    if (!value) return '';
    value = value.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
    if (value.indexOf('*') !== -1 || value.indexOf(' ') !== -1) return '';
    // 单标签主机名（localhost）也允许，方便本地测试；公网域名必须带点
    if (TEST_HOSTS.indexOf(value) !== -1) return value;
    value = bareHost(value);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) return '';
    return value;
  }

  /** 一个域名可能出现的所有主机名（裸域 + www）。
      IP 与单标签主机不加 www。返回顺序固定，便于测试与去重。 */
  function hostVariants(host) {
    const name = normalizeHost(host);
    if (!name) return [];
    const out = [name];
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(name);
    if (!isIp && name.indexOf('.') !== -1) out.push('www.' + name);
    return out;
  }

  /** 当前页面是否属于 AO3（含镜像、本地测试域、本地 HTML 文件）。
      www 与非 www 视为同一站：镜像站经常在两者之间 301，只认一种就会漏掉。 */
  function isAo3Host(host) {
    const raw = String(host || (root.location && root.location.hostname) || '').toLowerCase();
    if (!raw) {
      // file:// 打开的本地页面没有 hostname；用户手动开启"允许访问文件网址"后
      // 通常是想在本地快照上试用，所以这里放行，页面结构不对时注入的工具条不会出现。
      return /^file:/.test(String((root.location && root.location.protocol) || ''));
    }
    const names = [raw];
    const bare = bareHost(raw);
    if (bare !== raw) names.push(bare);
    const custom = readCustomHosts();
    const known = function (name) {
      if (DEFAULT_HOSTS.indexOf(name) !== -1) return true;
      if (TEST_HOSTS.indexOf(name) !== -1) return true;
      if (PRESET_MIRRORS.indexOf(name) !== -1) return true;
      return custom.indexOf(bareHost(name)) !== -1;
    };
    return names.some(known);
  }

  /** match pattern，供 chrome.scripting 注册 / manifest 声明使用。
      同时给出 http 与 https：镜像站两种协议都可能出现（自建镜像常常只有 http），
      只声明 https 会导致通过 http 访问时内容脚本不注入。
      同时给出 www 与非 www：站点从裸域跳到 www（或反过来）时两边都要能注入。 */
  function hostToMatchPatterns(host) {
    const patterns = [];
    hostVariants(host).forEach(function (name) {
      ['https', 'http'].forEach(function (scheme) {
        const pattern = scheme + '://' + name + '/*';
        if (patterns.indexOf(pattern) === -1) patterns.push(pattern);
      });
    });
    if (!patterns.length) {
      const fallback = String(host == null ? '' : host).trim().toLowerCase();
      if (fallback) patterns.push('https://' + fallback + '/*');
    }
    return patterns;
  }

  /** 兼容旧调用：返回 https 模式 */
  function hostToMatchPattern(host) {
    return 'https://' + host + '/*';
  }

  root.AO3TM = root.AO3TM || {};
  // 构建标记：排查"浏览器里跑的到底是不是最新代码"（与 manifest.version 保持一致）
  root.AO3TM.BUILD = '1.2.4.2';

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
    bareHost: bareHost,
    hostVariants: hostVariants,
    hostToMatchPattern: hostToMatchPattern,
    hostToMatchPatterns: hostToMatchPatterns
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
