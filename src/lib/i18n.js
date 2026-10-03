/* AO3 标签管家 —— 界面汉化（普通脚本，挂在 globalThis.AO3TM.i18n）
   只翻译 AO3 自己的固定界面文案，绝不碰用户内容（正文、摘要、标签、用户名、评论）。 */
(function (root) {
  'use strict';

  const ATTR = 'data-ao3tm-i18n';

  /** 整段替换（按内容精确匹配，忽略大小写与首尾空白） */
  const PHRASES = {
    // —— 站点导航 ——
    'Fandoms': '同人圈',
    'Browse': '浏览',
    'Search': '搜索',
    'About': '关于',
    'FAQ': '常见问题',
    'News': '站内新闻',
    'Log In': '登录',
    'Log Out': '退出登录',
    'Sign Up': '注册',
    'Hi,': '你好，',
    'My Dashboard': '我的主页',
    'My Works': '我的作品',
    'My Bookmarks': '我的书签',
    'My Subscriptions': '我的订阅',
    'My History': '浏览历史',
    'My Preferences': '我的偏好',
    'Preferences': '偏好设置',
    'Post': '发布',
    'New Work': '新作品',
    'Import Work': '导入作品',
    'Import URL': '导入链接',
    'Collections': '合集',
    // —— 首页搜索区 ——
    'Work Search': '作品搜索',
    'People Search': '用户搜索',
    'Bookmark Search': '书签搜索',
    'Tag Search': '标签搜索',
    'Site Search': '站内搜索',
    'Find your favorites': '找到你的心头好',
    'Search Works': '搜索作品',
    'Search Tags': '搜索标签',
    'Search Bookmarks': '搜索书签',
    'Search People': '搜索用户',
    'Advanced Search': '高级搜索',
    'Search within results': '在结果中搜索',
    'Search in bookmarks': '在书签中搜索',
    'Search works': '搜索作品',
    // —— 作品列表 / 作品页 ——
    'Works': '作品',
    'Bookmarks': '书签',
    'Series': '系列',
    'Creator': '作者',
    'Creators': '作者',
    'Author': '作者',
    'Authors': '作者',
    'Chapters': '章节',
    'Chapter': '章节',
    'Words': '字数',
    'Hits': '点击',
    'Kudos': 'Kudos',
    'Comments': '评论',
    'Comment': '评论',
    'Language': '语言',
    'Rating': '分级',
    'Warnings': '警告',
    'Relationships': '配对',
    'Characters': '角色',
    'Additional Tags': '附加标签',
    'Stats': '统计',
    'Summary': '摘要',
    'Notes': '注释',
    'Collections:': '合集：',
    'Series:': '系列：',
    'Language:': '语言：',
    'Words:': '字数：',
    'Chapters:': '章节：',
    'Published:': '发表于：',
    'Updated:': '更新于：',
    'Completed:': '完结于：',
    'Completed': '已完结',
    'Updated': '已更新',
    'Published': '已发表',
    'Complete': '完结',
    'Completed: Yes': '完结：是',
    'Completed: No': '完结：否',
    'Anonymous': '匿名',
    'Orphan Account': '孤儿账号',
    'Subscribe': '订阅',
    'Unsubscribe': '取消订阅',
    'Mark for Later': '稍后阅读',
    'Marked for Later': '已标记稍后阅读',
    'Download': '下载',
    'Hide Creator\u2019s Style': '隐藏作者样式',
    'Show Creator\u2019s Style': '显示作者样式',
    'Entire Work': '全文',
    'Chapter Text': '正文',
    'Next Chapter': '下一章',
    'Previous Chapter': '上一章',
    'Table of Contents': '目录',
    'Top of Form': '表单顶部',
    'Bottom of Form': '表单底部',
    'Actions': '操作',
    'Edit': '编辑',
    'Delete': '删除',
    'Delete Work': '删除作品',
    'Add Chapter': '添加章节',
    'Edit Chapter': '编辑章节',
    'Edit Work': '编辑作品',
    'Edit Tags': '编辑标签',
    'Bookmark': '收藏',
    'Edit Bookmark': '编辑书签',
    'Delete Bookmark': '删除书签',
    'Comments (': '评论（',
    'Leave a comment': '留下评论',
    'Post Comment': '发表评论',
    'Cancel': '取消',
    'Save': '保存',
    'Save Changes': '保存修改',
    'Close': '关闭',
    'Back': '返回',
    'Next': '下一页',
    'Previous': '上一页',
    'Next \u203a': '下一页 \u203a',
    '\u2039 Previous': '\u2039 上一页',
    'First': '首页',
    'Last': '末页',
    'No results found.': '没有找到结果。',
    'Sorry, we couldn\u2019t find any results for that search.': '抱歉，没有找到符合该搜索的内容。',
    // —— 筛选 / 排序 ——
    'Filters': '筛选',
    'Sort and Filter': '排序与筛选',
    'Sort by': '排序方式',
    'Sort By': '排序方式',
    'Filter': '筛选',
    'Filters:': '筛选：',
    'Clear Filters': '清除筛选',
    'Apply': '应用',
    'Reset': '重置',
    'Show': '显示',
    'Show All': '全部显示',
    'Any': '不限',
    'All': '全部',
    'None': '无',
    'Yes': '是',
    'No': '否',
    'Best Match': '最佳匹配',
    'Date Updated': '更新日期',
    'Date Posted': '发布日期',
    'Word Count': '字数',
    'Hits (descending)': '点击数（降序）',
    'Kudos (descending)': 'Kudos（降序）',
    'Comments (descending)': '评论数（降序）',
    'Bookmarks (descending)': '书签数（降序）',
    'Ascending': '升序',
    'Descending': '降序',
    'Title': '标题',
    'Other tags': '其它标签',
    'Include': '包含',
    'Exclude': '排除',
    'Only': '仅',
    'Any field': '任意字段',
    'Complete Only': '仅完结',
    'Crossovers': '跨界联动',
    'Single Chapter': '单章',
    'Multi Chapter': '多章',
    'Categories': '类别',
    'F/M': 'F/M',
    'Gen': 'Gen',
    'Teen And Up Audiences': '青少年及以上',
    'General Audiences': '全年龄',
    'Mature': '成人',
    'Explicit': '露骨',
    'Not Rated': '未分级',
    'No Archive Warnings Apply': '无站内警告',
    'Creator Chose Not To Use Archive Warnings': '作者选择不使用站内警告',
    'Major Character Death': '主要角色死亡',
    'Graphic Depictions Of Violence': '暴力描写',
    'Underage': '未成年性行为',
    'Rape/Non-Con': '强奸/非自愿',
    // —— 书签 / 合集 ——
    'Bookmark Tags': '书签标签',
    'Bookmark Notes': '书签注释',
    'Bookmark Type': '书签类型',
    'Rec': '推荐',
    'Private': '私密',
    'Public': '公开',
    'Notes:': '注释：',
    'External Work': '外部作品',
    'Collection': '合集',
    'Works:': '作品：',
    'Bookmarks:': '书签：',
    'Bookmarked:': '收藏于：',
    'Bookmarker': '收藏者',
    // —— 评论 / 互动 ——
    'Comment Thread': '评论串',
    'Reply': '回复',
    'Thread': '楼层',
    'Guest': '游客',
    'Comment on this work': '评论这篇作品',
    // —— 表单通用 ——
    'Email': '邮箱',
    'Email address': '邮箱地址',
    'Username': '用户名',
    'Username or email': '用户名或邮箱',
    'Password': '密码',
    'Remember me': '记住我',
    'Forgot password?': '忘记密码？',
    'Or': '或',
    'First Name': '名字',
    'Last Name': '姓氏',
    'Select': '请选择',
    'Choose': '请选择',
    'Required': '必填',
    'Optional': '可选',
    // —— 分页 / 提示 ——
    'Next Page': '下一页',
    'Previous Page': '上一页',
    'Loading': '加载中',
    'Loading\u2026': '加载中…',
    'Error': '出错了',
    'Success': '成功'
  };

  /** 长句片段替换（正则全局替换，只匹配界面套话，不匹配用户内容） */
  const PATTERNS = [
    [/\bPublished:\s*/g, '发表于：'],
    [/\bUpdated:\s*/g, '更新于：'],
    [/\bCompleted:\s*/g, '完结于：'],
    [/\bWords:\s*/g, '字数：'],
    [/\bChapters:\s*/g, '章节：'],
    [/\bLanguage:\s*/g, '语言：'],
    [/\bKudos:\s*/g, 'Kudos：'],
    [/\bHits:\s*/g, '点击：'],
    [/\bComments:\s*/g, '评论：'],
    [/\bBookmarks:\s*/g, '书签：'],
    [/\bCollections:\s*/g, '合集：'],
    [/\bSeries:\s*/g, '系列：'],
    [/\bStats:\s*/g, '统计：'],
    [/\bNotes:\s*/g, '注释：'],
    [/\bSummary:\s*/g, '摘要：'],
    [/\b(\d[\d,]*)\s+words?\b/gi, '$1 字'],
    [/\b(\d[\d,]*)\s+hits?\b/gi, '$1 次点击'],
    [/\b(\d[\d,]*)\s+kudos\b/gi, '$1 个 Kudos'],
    [/\b(\d[\d,]*)\s+comments?\b/gi, '$1 条评论'],
    [/\b(\d[\d,]*)\s+bookmarks?\b/gi, '$1 个书签'],
    [/\b(\d[\d,]*)\s+chapters?\b/gi, '$1 章'],
    [/\b(\d[\d,]*)\s+works?\b/gi, '$1 篇作品'],
    [/\b(\d[\d,]*)\s+Collections?\b/g, '$1 个合集'],
    [/\b(\d[\d,]*)\s+Series\b/g, '$1 个系列'],
    [/\bWorks?\s+in\s+/g, '作品 / '],
    [/\bResults?\s+(\d[\d,]*)/gi, '结果 $1'],
    [/of\s+(\d[\d,]*)\s+Works?\b/g, '共 $1 篇'],
    [/\bChapter\s+(\d+)\s+of\s+(\d+)/gi, '第 $1 章 / 共 $2 章'],
    [/\bComments?\s*\((\d[\d,]*)\)/g, '评论（$1）'],
    [/\bHits?\s*\((\d[\d,]*)\)/gi, '点击（$1）'],
    [/\bKudos\s*\((\d[\d,]*)\)/gi, 'Kudos（$1）'],
    // 中文语境下不需要空格，顺手收一下
    [/\s+([，。、：（）])/g, '$1'],
    [/([（])\s+/g, '$1']
  ];

  /** 属性翻译（placeholder / title / value） */
  const ATTRS = ['placeholder', 'title', 'aria-label'];

  /** 绝对不翻译的区域：
   *  - 用户内容：正文、摘要、注释、标签、评论
   *  - 编辑器：可编辑区
   * 注意：input / textarea 属于表单控件，其文字值不会被翻，但 placeholder 属于界面文案，仍要翻。 */
  const KEEP_USER_CONTENT = [
    '#workskin',
    '.userstuff',
    '.summary',
    '.notes',
    '#main .tags',
    'blockquote',
    '.comment',
    '.comment-form',
    '.kudos',
    '[contenteditable="true"]',
    '.ao3tm-panel-root',
    '.ao3tm-menu',
    '.ao3tm-toast',
    '.ao3tm-bar',
    '.ao3tm-tools',
    '.ao3tm-workbar',
    '.ao3tm-fab',
    '.ao3tm-focus'
  ].join(', ');

  /** 文本节点：用户内容 + 这些标签的文字都跳过 */
  const SKIP_SELECTOR = [KEEP_USER_CONTENT, 'textarea', 'script', 'style', 'code', 'pre'].join(', ');

  /** 这些标签本身没有可翻译的文字节点，跳过以免误伤 */
  const SKIP_TEXT_TAGS = { INPUT: 1, TEXTAREA: 1, SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1 };

  let observer = null;
  let timer = null;
  let running = false;

  function currentSettings() {
    const store = root.AO3TM && root.AO3TM.store;
    return (store && store.get().settings) || {};
  }

  function lookup(text) {
    if (typeof text !== 'string') return null;
    const key = text.replace(/\s+/g, ' ').trim();
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(PHRASES, key)) return PHRASES[key];
    const lower = key.toLowerCase();
    const found = Object.keys(PHRASES).filter(function (k) {
      return k.toLowerCase() === lower;
    })[0];
    return found ? PHRASES[found] : null;
  }

  function applyPatterns(text) {
    let out = text;
    for (let i = 0; i < PATTERNS.length; i++) {
      out = out.replace(PATTERNS[i][0], PATTERNS[i][1]);
    }
    return out;
  }

  function shouldSkip(node, bilingual) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return true;
    if (el.closest(SKIP_SELECTOR)) return true;
    if (SKIP_TEXT_TAGS[el.tagName]) return true;
    if (el.getAttribute && el.getAttribute(ATTR)) {
      // 已翻过的元素不用再翻，但"悬停显示原文"是后开的开关，需要补标记
      if (bilingual) {
        const orig = el.getAttribute('data-ao3tm-orig');
        if (orig && !el.getAttribute('title')) el.setAttribute('title', orig);
        if (orig) el.setAttribute('data-ao3tm-bilingual', '1');
      }
      return true;
    }
    return false;
  }

  /** 属性翻译只针对界面属性：input 的 placeholder、aria-label 等，不碰 value/title */
  const ATTR_SKIP = {
    SCRIPT: 1,
    STYLE: 1,
    TEXTAREA: 1,
    CODE: 1,
    PRE: 1,
    SELECT: 1,
    OPTION: 1
  };

  function shouldSkipAttr(el) {
    if (!el || !el.getAttribute) return true;
    if (ATTR_SKIP[el.tagName]) return true;
    if (el.closest(KEEP_USER_CONTENT)) return true;
    return false;
  }

  function translateTextNode(node, bilingual) {
    if (!node.nodeValue || !/\S/.test(node.nodeValue)) return false;
    const original = node.nodeValue;
    const trimmed = original.trim();
    if (!trimmed) return false;

    const exact = lookup(trimmed);
    let next = exact;
    if (!next) {
      const patterned = applyPatterns(trimmed);
      if (patterned !== trimmed) next = patterned;
    }
    if (!next || next === trimmed) return false;

    const leading = original.match(/^\s*/)[0];
    const trailing = original.match(/\s*$/)[0];
    node.nodeValue = leading + next + trailing;

    const el = node.parentElement;
    if (el) {
      el.setAttribute(ATTR, '1');
      // 原文始终记下：这样"悬停显示原文"可以随时开关，不需要刷新页面重跑
      if (!el.getAttribute('data-ao3tm-orig')) el.setAttribute('data-ao3tm-orig', trimmed);
      if (bilingual) {
        if (!el.getAttribute('title')) el.setAttribute('title', trimmed);
        el.setAttribute('data-ao3tm-bilingual', '1');
      }
    }
    return true;
  }

  function translateAttributes(el, bilingual) {
    if (!el.attributes) return false;
    let changed = false;
    ATTRS.forEach(function (name) {
      const value = el.getAttribute(name);
      if (!value) return;
      const trimmed = value.trim();
      const exact = lookup(trimmed);
      const next = exact;
      if (!next || next === trimmed) return;
      el.setAttribute(name, next);
      if (bilingual) el.setAttribute('data-ao3tm-bilingual', '1');
      changed = true;
    });
    return changed;
  }

  /** 跑一轮翻译；返回改动的节点数 */
  function pass() {
    const settings = currentSettings();
    if (!settings.i18n) return 0;
    const bilingual = settings.i18nBilingual === true;

    let changed = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (shouldSkip(node, bilingual)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (translateTextNode(node, bilingual)) changed += 1;
    });

    // 界面属性（搜索框 placeholder、aria-label 等），不碰站点自己的 title tooltip
    const attrTargets = document.querySelectorAll('[placeholder], [aria-label]');
    Array.prototype.forEach.call(attrTargets, function (el) {
      if (shouldSkipAttr(el)) return;
      if (translateAttributes(el, bilingual)) changed += 1;
    });

    return changed;
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      if (running) return;
      running = true;
      try {
        pass();
      } catch (err) {
        console.error('[AO3 标签管家] 汉化出错', err);
      } finally {
        running = false;
      }
    }, 120);
  }

  function start() {
    schedule();
    if (observer) return;
    try {
      observer = new MutationObserver(function (mutations) {
        const relevant = mutations.some(function (m) {
          return m.addedNodes && m.addedNodes.length;
        });
        if (relevant) schedule();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (err) {
      /* ignore */
    }
  }

  function stop() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.i18n = {
    start: start,
    stop: stop,
    pass: pass,
    schedule: schedule,
    phrases: PHRASES,
    translate: function (text) {
      const exact = lookup(text);
      return exact || applyPatterns(text);
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
