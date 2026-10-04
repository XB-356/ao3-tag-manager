/* 只扫"界面区域"的漏翻审计。
   关键：快照里可能已经含有译文（旧版本翻的），所以优先取元素的
   data-ao3tm-orig（扩展存的**原文**）去对照**当前**词典——否则会大量假阳性。
   没有 orig 标记的元素（当时没处理到）才用它的直接文本。

   判定"能翻"时三条路径都算数：整段 lookup / 分段 compound / 内嵌短语 inline。

   用法：node tools/audit-ui-areas.js <snapshot.html> [更多...] */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHtml } = require(path.join(__dirname, '..', 'test', 'html-stub'));

const ROOT = path.resolve(__dirname, '..');
const s = { console, document: null, window: null, setTimeout, clearTimeout };
s.globalThis = s;
s.self = s;
vm.createContext(s);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), s, { filename: r })
);
const i18n = s.AO3TM.i18n;
/** 三条路径任一能处理就算"不是缺口" */
const handled = (text) =>
  i18n.translate(text) !== text ||
  (i18n.translateCompoundText(text) || '') !== '' ||
  (i18n.translateInline(text) || '') !== '';

const decode = (v) =>
  String(v)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const UI_SEL = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'legend', 'button', 'dt', 'dd', 'th',
  'option', 'summary', '.navigation', '.actions', '.filters', '.submit', '.landmark', '.notes',
  '#footer', '#header', 'form', '.heading', '.caution', '.notice', '.flash'];
const SKIP_SEL = ['#workskin', 'blockquote', '.comment', '.blurb', 'ul.fandom', 'ul.tag',
  '.userstuff', '.bio', '.summary', '.fandom.index', '.tag.index', '.work.index'];

const attrsOf = (el) => el.attrs || {};
const matches = (el, list) => list.some((sel) => {
  const cls = ' ' + (attrsOf(el).class || '') + ' ';
  const id = attrsOf(el).id || '';
  if (sel.startsWith('#')) return id === sel.slice(1) || cls.includes(' ' + sel.slice(1) + ' ');
  if (sel.startsWith('.')) return cls.includes(' ' + sel.slice(1) + ' ');
  return el.tagName === sel.toUpperCase();
});

/* 语言名 / 站点皮肤名 / 品牌等：按既定原则不翻 */
const LANG = /(Soomaali|Sign Language|Anishinaabe|asturianu|Azərbaycan|Basa |Boarisch|Bosanski|Brezhoneg|Cebuano|Chinuk|Creolese|Eald|Esperanto|Chamorro|Nederlands|Friisk|Frysk|Furlan|Gàidhlig|Hausa|Hmoob|Hawai|Interlingua|Euskara|Gaeilge|Hrvatski|Íslenska|Latviešu|Afrikaans|Bahasa|Català|Čeština|Cymraeg|Dansk|Deutsch|eesti|Español|Filipino|Français|Galego|Italiano|Kiswahili|Lietuvių|Magyar|Norsk|Polski|Português|Română|Sloven|Suomi|Svenska|Tiếng|Türkçe|Ελληνικά|Беларуская|Български|Русский|Српски|Українська|עברית|العربية|فارسی|हिन्दी|ไทย|中文|日本語|한국어|Kreyòl|Kurdî|Lëtzebuerg|Malti|Māori|Mongol|Occitan|Oʻzbek|Papiamentu|Pashto|Piemontèis|Sardu|Shqip|Sicilianu|Tagalog|Tatar|Te Reo|Tetum|Toki|Türkmen|Vèneto|Wolof|Yorùbá|Zazaki|isiZulu|swang)/i;
const SKIN = /(Buttons?|Skin|Default|Reversi|Snow Blue|Low Vision|Twilling|Hustings|Screeny|Horizon|Dash|Imago|Fixie|Panda|Aqua|Dusted|Scribble|Stick It|Mark my words|Point No|Look and Read|Eyes To|Full width|Twill|Exposure|Oppression|Drop It|Shut It|Got Form|Care A Button|Archive 2\.0|ByLine|Massive|Wide )/i;

const report = new Map();
process.argv.slice(2).forEach((f) => {
  if (!fs.existsSync(f)) return;
  const root = parseHtml(fs.readFileSync(f, 'utf8'));
  const all = [root].concat(root.descendants || []);
  all.forEach((el) => {
    if (el.nodeType !== 1) return;
    if (matches(el, SKIP_SEL)) return;
    for (let p = el.parentElement; p; p = p.parentElement) if (matches(p, SKIP_SEL)) return;
    let inUi = matches(el, UI_SEL);
    for (let p = el.parentElement; !inUi && p; p = p.parentElement) inUi = matches(p, UI_SEL);
    if (!inUi) return;

    const candidates = [];
    const orig = attrsOf(el)['data-ao3tm-orig'];
    if (orig) {
      candidates.push(decode(orig));
    } else {
      (el.childNodes || []).forEach((n) => {
        if (n.nodeType === 3) candidates.push(decode(String(n.nodeValue || '').trim()));
      });
    }

    candidates.forEach((text) => {
      if (!text || text.length < 3 || text.length > 130) return;
      if (!/[A-Za-z]/.test(text)) return;
      if (/[\u4e00-\u9fa5]/.test(text)) return;
      if (/^https?:|^[\d.,\s]+$|^v?\d+\.\d+|^GPL|^otwarchive/.test(text)) return;
      if (LANG.test(text) || SKIN.test(text)) return;
      if (handled(text)) return;
      if (!report.has(text)) report.set(text, new Set());
      report.get(text).add(path.basename(f, '.html'));
    });
  });
});

console.log('当前词典仍无法处理的界面文本 ' + report.size + ' 条：');
[...report.entries()]
  .sort((a, b) => b[1].size - a[1].size)
  .forEach(([text, where]) => console.log('  [' + [...where].length + ' 页] ' + JSON.stringify(text)));
