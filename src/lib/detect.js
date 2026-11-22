/* AO3 标签管家 —— AO3 站点识别
   目的：判断"当前这个网站是不是 AO3（或其镜像）"。

   为什么不能只看域名：镜像域名千奇百怪，不可能穷举。
   为什么不能只看页面结构：AO3 前端换版、镜像二次开发都会让标记漂移。
   所以用"域名线索 + 页面结构指纹"两项证据加权打分，并给出命中理由，
   让用户自己看到"凭什么这么判断"，而不是甩一句"检测到镜像"。

   本模块是纯函数（接收 document / location），便于单元测试。 */
(function (root) {
  'use strict';

  const MIRROR_NAME_RE = /(^|[-_.])(mirror|proxy|clone|backup|镜像)/;
  const AO3_TOKEN_RE = /(^|[-_.])ao3([-_.]|$)|archiveofourown|transformativeworks/;

  const LEVELS = { high: 6, medium: 3 };

  /* 访问验证 / 人机校验页的特征。镜像站（尤其国内镜像）常在前面挂一层
     "访问验证"，首包完全没有 AO3 结构，检测只能拿到一张挑战页；
     识别出来才能告诉用户"先过验证再看"，也才好安排过一会儿重新判定。 */
  const CHALLENGE_RE = /访问验证|正在验证您的浏览器|正在验证|checking your browser|verifying you are human|just a moment|cf-browser-verification|challenge-platform|__cf_chl|_shield|ddos-guard|sucuri_cloudproxy/i;

  /** 取真实 hostname（保留 www、去端口），归一化留给 hostOf 做 */
  function rawHostOf(value) {
    const host = String(value == null ? '' : value).trim().toLowerCase();
    return host.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  }

  /** 归一化域名：去掉协议、路径、端口、www 前缀 */
  function hostOf(value) {
    return rawHostOf(value).replace(/^www\./, '');
  }

  /**
   * 域名线索：域名像不像 AO3 镜像。
   * 只作为辅助证据（1 分），单独不足以判定——类似 ao3.org.cn 这种蹭名字的站点很多。
   */
  function domainSignals(host) {
    const name = hostOf(host);
    const signals = [];
    if (!name) return signals;
    if (AO3_TOKEN_RE.test(name)) signals.push({ key: 'domain-ao3', label: '域名里带 AO3 / archiveofourown 字样', weight: 1 });
    if (MIRROR_NAME_RE.test(name)) signals.push({ key: 'domain-mirror', label: '域名里带 mirror / proxy / 镜像 等字样', weight: 1 });
    return signals;
  }

  /** 安全取元素，取不到就返回 null */
  function pick(doc, selector) {
    try {
      return doc.querySelector(selector);
    } catch (err) {
      return null;
    }
  }

  function pickAll(doc, selector) {
    try {
      const list = doc.querySelectorAll(selector);
      return list ? Array.prototype.slice.call(list) : [];
    } catch (err) {
      return [];
    }
  }

  /** 读文本，取不到就返回空串（document / body / title 任一缺失都不能抛） */
  function textOf(value, limit) {
    try {
      const text = value == null ? '' : String(value);
      return limit ? text.slice(0, limit) : text;
    } catch (err) {
      return '';
    }
  }

  /**
   * 判断当前页是不是「访问验证 / 人机校验」挑战页。
   * 只做识别，不作为 AO3 证据——挑战页本身什么也证明不了。
   */
  function challengeInfo(doc) {
    if (!doc) return null;
    const parts = [];
    parts.push(textOf(doc.title, 200));
    let body = null;
    try {
      body = doc.body;
    } catch (err) {
      body = null;
    }
    if (body) {
      parts.push(textOf(body.innerText || body.textContent, 1200));
    }
    let html = '';
    try {
      html = textOf(doc.documentElement && doc.documentElement.outerHTML, 2500);
    } catch (err) {
      html = '';
    }
    parts.push(html);
    const hay = parts.join(' ');
    if (!hay) return null;
    const hit = hay.match(CHALLENGE_RE);
    return hit ? { marker: hit[0] } : null;
  }

  /**
   * 页面结构指纹：AO3 的 DOM 有若干很稳的特征。
   * 权重按"误判概率"给——越通用给得越低。
   */
  function pageSignals(doc, loc) {
    if (!doc || !doc.querySelector) return { signals: [], raw: {} };

    const signals = [];
    const raw = {};
    const add = function (key, label, weight) {
      signals.push({ key: key, label: label, weight: weight });
    };

    // AO3 独有：作品列表项
    const works = pickAll(doc, 'li.work.blurb, li.blurb.group');
    raw.workItems = works.length;
    if (works.length) add('blurb', '作品列表项 li.work.blurb（' + works.length + ' 个）', 3);

    // AO3 独有：meta generator
    const generator = pick(doc, 'meta[name="generator"]');
    const generatorText = generator ? String(generator.getAttribute('content') || '') : '';
    raw.generator = generatorText;
    if (/otw[-\s]?archive|archive of our own|archiveofourown|\bao3\b/i.test(generatorText)) {
      add('generator', '页面 meta generator 写着 OTW Archive', 3);
    }

    // AO3 特征路径：/tags/xxx/works、/works/数字
    const tagWorkLinks = pickAll(doc, 'a.tag[href*="/works"]');
    raw.tagWorkLinks = tagWorkLinks.length;
    if (tagWorkLinks.length >= 2) {
      add('tag-links', '标签链接指向 /tags/…/works（' + tagWorkLinks.length + ' 个）', 2);
    }

    const workLinks = pickAll(doc, 'a[href*="/works/"]');
    const numericWork = workLinks.filter(function (a) {
      return /\/works\/\d+/.test(a.getAttribute('href') || '');
    });
    raw.workLinks = workLinks.length;
    raw.numericWorkLinks = numericWork.length;
    if (numericWork.length) add('work-links', '作品链接形如 /works/数字（' + numericWork.length + ' 个）', 2);

    // AO3 特有的页脚与主页结构
    if (pick(doc, '#footer .module, #footer .rss, #footer .group')) add('footer', '页脚是 AO3 的 #footer 结构', 2);
    if (pick(doc, '#header .primary, #header .logo, #header h1 img')) add('header', '页头是 AO3 的 #header 结构', 2);
    if (pick(doc, 'a[href="/works/search"], a[href="/tags"], a[href="/collections"]')) {
      add('nav', '导航里有 /works/search、/tags、/collections 这类 AO3 路径', 1);
    }
    // 以下几条在镜像站二次改版后依然保留，补进来提高"等镜像站"的召回
    if (pick(doc, 'ul.primary.navigation, .primary.navigation, #header .navigation')) {
      add('header-nav', '页头是 AO3 的 ul.primary.navigation 导航', 2);
    }
    if (pick(doc, 'ol.work.index, ol.bookmark.index, ol.collection.index, ol.series.index')) {
      add('index-list', '列表页是 AO3 的 ol.work.index 结构', 2);
    }
    if (pick(doc, '#greeting')) add('greeting', '页头有 AO3 登录后的 #greeting 问候区', 1);
    if (pick(doc, '#dashboard')) add('dashboard', '侧栏是 AO3 的 #dashboard 结构', 1);
    const userLinks = pickAll(doc, 'a[href*="/users/"]');
    raw.userLinks = userLinks.length;
    if (userLinks.length >= 2) add('user-links', '作者/用户链接形如 /users/…（' + userLinks.length + ' 个）', 1);

    // 通用结构（泛用性高，权重最低）
    if (pick(doc, '#main')) add('main', '存在 #main 容器', 1);
    if (pickAll(doc, '.header.module').length) add('module', '存在 .header.module 区块', 1);

    // 反向证据：常见建站程序，命中就减分
    const cms = pick(doc, 'meta[name="generator"]');
    const cmsText = cms ? String(cms.getAttribute('content') || '') : '';
    if (/wordpress|typecho|hexo|ghost|drupal|joomla/i.test(cmsText)) {
      add('cms', '页面由通用建站程序生成（' + cmsText.split(' ')[0] + '）', -4);
    }
    if (doc.documentElement && doc.documentElement.className && /\bwp-|wordpress/i.test(String(doc.documentElement.className))) {
      add('cms-class', 'HTML 上有 WordPress 痕迹', -3);
    }

    return { signals: signals, raw: raw };
  }

  /**
   * 综合判定。
   * 返回 { isAo3, level, score, reasons, domainSignals, pageSignals, host, protocol, hasWorkContent }
   */
  function detect(doc, loc) {
    const document_ = doc || (typeof document !== 'undefined' ? document : null);
    const location_ = loc || (typeof location !== 'undefined' ? location : null);
    const pageHost = rawHostOf(location_ && location_.hostname);
    const host = hostOf(location_ && location_.hostname);
    const protocol = String((location_ && location_.protocol) || '');

    const dSignals = domainSignals(host);
    const page = pageSignals(document_, location_);
    const all = dSignals.concat(page.signals);
    const score = all.reduce(function (sum, item) {
      return sum + item.weight;
    }, 0);

    // 光有域名不算数：必须至少有一条页面结构证据，否则只是"名字像"
    const structural = page.signals.filter(function (item) {
      return item.weight > 0;
    });
    const hasWorkContent = page.raw.workItems > 0 || page.raw.numericWorkLinks > 0;
    const challenge = challengeInfo(document_);

    let level = 'none';
    if (structural.length && score >= LEVELS.high) level = 'high';
    else if (structural.length && score >= LEVELS.medium) level = 'medium';
    else if (structural.length && score > 0) level = 'low';

    return {
      isAo3: level === 'high' || level === 'medium',
      level: level,
      score: score,
      host: host,
      // 真实 hostname（保留 www）：启用镜像时申请权限要用它，否则 www 站点会漏
      pageHost: pageHost,
      protocol: protocol,
      hasWorkContent: hasWorkContent,
      challenge: !!challenge,
      challengeMarker: challenge ? challenge.marker : '',
      reasons: all,
      domainSignals: dSignals,
      pageSignals: page.signals,
      raw: page.raw
    };
  }

  /** 给界面用的一句话结论 */
  function summary(result) {
    if (!result) return '未检测';
    if (result.level === 'high') return '高度确认是 AO3 站点';
    if (result.level === 'medium') return '很可能是 AO3 站点';
    if (result.challenge) return '站点正在做访问验证，通过后会自动重新检测';
    if (result.level === 'low') return '有一些 AO3 特征，但证据不足';
    return '没有发现 AO3 特征';
  }

  function levelLabel(level) {
    return { high: '高度确认', medium: '很可能', low: '疑似', none: '不像' }[level] || '未知';
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.detect = {
    LEVELS: LEVELS,
    hostOf: hostOf,
    rawHostOf: rawHostOf,
    challengeInfo: challengeInfo,
    domainSignals: domainSignals,
    pageSignals: pageSignals,
    detect: detect,
    summary: summary,
    levelLabel: levelLabel,
    /** 便于测试：直接对给定 document / location 判定 */
    detectIn: function (doc, loc) {
      return detect(doc, loc);
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
