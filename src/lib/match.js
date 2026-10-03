/* AO3 标签管家 —— 规则匹配引擎（普通脚本，挂在 globalThis.AO3TM.match） */
(function (root) {
  'use strict';

  const FUZZY_PREFIX = '~';
  const REGEX_PREFIX = 're:';

  function normalize(text, caseSensitive) {
    let value = String(text == null ? '' : text);
    if (!caseSensitive) value = value.toLowerCase();
    // 全角空格 / 不换行空格统一掉，避免标签复制粘贴时的隐形差异
    value = value.replace(/[\u3000\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();
    return value;
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const regexCache = new Map();

  function toRegExp(pattern) {
    if (regexCache.has(pattern)) return regexCache.get(pattern);
    let re = null;
    try {
      re = new RegExp(pattern, 'i');
    } catch (err) {
      re = null;
    }
    if (regexCache.size > 500) regexCache.clear();
    regexCache.set(pattern, re);
    return re;
  }

  /**
   * 判断一个规则是否命中一段文本。
   * 规则语法：
   *   Tag Name          子串匹配（忽略大小写，默认）
   *   =Tag Name         严格全等（标点、空格必须一致）
   *   ~Tag Name         模糊：忽略空格与常见标点差异
   *   re:^A.*B$         正则（忽略大小写，出错时该条规则失效）
   * 文本带（作者）后缀时表示作者规则。
   */
  function matches(rulePattern, text, caseSensitive) {
    const pattern = normalize(rulePattern, false);
    if (!pattern) return false;
    const target = normalize(text, caseSensitive);
    if (!target) return false;

    if (pattern.slice(0, REGEX_PREFIX.length) === REGEX_PREFIX) {
      const body = rulePattern.slice(REGEX_PREFIX.length).trim();
      const re = toRegExp(body);
      return re ? re.test(String(text)) : false;
    }

    if (rulePattern.charAt(0) === '=') {
      return normalize(rulePattern.slice(1), caseSensitive) === target;
    }

    if (rulePattern.charAt(0) === FUZZY_PREFIX) {
      const loose = looseForm(rulePattern.slice(1));
      const looseTarget = looseForm(text);
      return !!loose && looseTarget.indexOf(loose) !== -1;
    }

    const base = normalize(rulePattern, caseSensitive);
    if (!base) return false;
    if (base === target) return true;
    // 子串匹配：命中任意一段即可
    return target.indexOf(base) !== -1;
  }

  function looseForm(text) {
    return normalize(text, false).replace(/[\s\-_.,!?'"“”‘’·・:;()（）\[\]{}<>/\\|+&*#@$%^~`]/g, '');
  }

  /** 把一个作品（作者 + 标签集合）套用到规则上 */
  function evaluate(input) {
    const tags = Array.from(input.tags || []).map(function (t) {
      return String(t).trim();
    }).filter(Boolean);
    const authors = Array.from(input.authors || []).map(function (a) {
      return String(a).trim();
    }).filter(Boolean);
    const settings = input.settings || {};
    const rules = input.rules || { tag: { block: {}, allow: {} }, author: { block: {}, allow: {} } };
    const caseSensitive = settings.caseInsensitive === false;
    const fuzzy = settings.fuzzy !== false;

    const result = {
      blocked: false,
      only: false,
      reasons: [] // {kind:'tag'|'author', pattern, value, mode}
    };

    /** 规则按模式分桶存储，这里拍平成一个数组便于逐条匹配 */
    const flatten = function (kind) {
      const buckets = rules[kind] || {};
      const out = [];
      ['block', 'allow'].forEach(function (mode) {
        const bucket = buckets[mode] || {};
        Object.keys(bucket).forEach(function (key) {
          out.push(bucket[key]);
        });
      });
      return out;
    };

    const tagRules = flatten('tag');
    const authorRules = flatten('author');

    const blockedTags = testRules(tagRules, tags, 'block');
    const allowedTags = testRules(tagRules, tags, 'allow');
    const blockedAuthors = testRules(authorRules, authors, 'block');
    const allowedAuthors = testRules(authorRules, authors, 'allow');

    const blockHit =
      (settings.blockTags !== false && blockedTags.length > 0) ||
      (settings.blockAuthors !== false && blockedAuthors.length > 0);
    const onlyHit =
      (settings.onlyTags !== false && allowedTags.length > 0) ||
      (settings.onlyAuthors !== false && allowedAuthors.length > 0);

    if (blockHit) {
      result.blocked = true;
      result.reasons = result.reasons.concat(blockedTags.map(label('tag', 'block')), blockedAuthors.map(label('author', 'block')));
    }

    const hasOnlyRules =
      (settings.onlyTags !== false && tagRules.some(isAllow)) ||
      (settings.onlyAuthors !== false && authorRules.some(isAllow));

    if (hasOnlyRules && !onlyHit) {
      result.only = true;
      result.blocked = true;
      result.reasons.push({ kind: 'only', mode: 'allow', pattern: onlySummary(tagRules, authorRules, settings), value: '' });
    }

    if (settings.onlyIncludeBlocked && result.only && blockHit) {
      result.reasons.push({ kind: 'block-override', mode: 'block', pattern: '', value: '' });
    }

    return result;

    function isAllow(rule) {
      return rule.mode === 'allow';
    }

    function label(kind, mode) {
      return function (hit) {
        return { kind: kind, mode: mode, pattern: hit.rule.pattern, value: hit.value };
      };
    }

    function testRules(list, values, mode) {
      const out = [];
      list.forEach(function (rule) {
        if (rule.mode !== mode) return;
        values.forEach(function (value) {
          if (matches(rule.pattern, value, caseSensitive && rule.caseSensitive !== false)) {
            out.push({ rule: rule, value: value });
          }
        });
      });
      return out;
    }

    function onlySummary(tagList, authorList, cfg) {
      const parts = [];
      if (cfg.onlyTags !== false) {
        tagList.filter(isAllow).forEach(function (r) {
          parts.push(r.pattern);
        });
      }
      if (cfg.onlyAuthors !== false) {
        authorList.filter(isAllow).forEach(function (r) {
          parts.push(r.pattern + root.AO3TM.store.AUTHOR_LABEL_SUFFIX);
        });
      }
      return parts.slice(0, 6).join('、') + (parts.length > 6 ? ' 等 ' + parts.length + ' 条只看规则' : '');
    }
  }

  /** 返回某个具体标签命中过的规则，用于给标签打标记 */
  function matchTag(tag, rules) {
    const out = [];
    Object.keys(rules || {}).forEach(function (key) {
      const rule = rules[key];
      if (matches(rule.pattern, tag)) out.push(rule);
    });
    return out;
  }

  function textToRules(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(function (line) {
        return line && line.charAt(0) !== '#';
      });
  }

  root.AO3TM = root.AO3TM || {};
  root.AO3TM.match = {
    normalize: normalize,
    looseForm: looseForm,
    escapeRegExp: escapeRegExp,
    matches: matches,
    evaluate: evaluate,
    matchTag: matchTag,
    textToRules: textToRules
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
