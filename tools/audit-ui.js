/* 从快照里提取"仍是英文的可见文本"，排除语言名/日期等不该翻的内容
   用法：node tools/audit-ui.js <html...> */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const files = process.argv.slice(2);
const s = { console, document: null, window: null, setTimeout, clearTimeout };
s.globalThis = s;
s.self = s;
vm.createContext(s);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), s, { filename: r })
);
const i18n = s.AO3TM.i18n;
const decode = (t) => String(t).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/** 语言名 / 月份 / 日期 / 版本号等：不该翻，直接排除 */
const SKIP = [
  /^(tip:|https?:)/i,
  /^\(GMT[+-]/, /^\d/, /^[A-Za-z]{3},? \d/,
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/,
  /^(otwarchive|GPL)/i, /^@/, /Archive of Our Own$/i, /^AO3$/,
  /^(Català|Čeština|eesti|Interlingua|Kalaallisut|Lëtzebuergesch|Lingua latina|Nāhuatl|Nawat|Pennsilfaanisch|Plattdüütsch|Scots|te reo|Thermian|tlhIngan|Tok Pisin|toki pona|Trinidadian|Unangam|maaya|qırımtatar|Afrikaans|Asturianu|Boarisch|Bosanski|Brezhoneg|Cebuano|Chinuk|Creolese|Eald|Finu|Friisk|Frysk|Furlan|Gàidhlig|Hausa|Hmoob|Hawai|Íslenska|Kanien|Kernewek|Khuzdul|Kurd|Ladino|Langue|Mando|Mi.kmaq|Middel|Mikis|Moob|Na.vi|O.odham|Pulaar|qazaq|Quenya|Sindarin|Slov|Sprēkō|O.zbek|Volap|Walon|Soomaali|Anishinaabe|Azərbaycan|Bahasa|Basa|Cymraeg|Dansk|Deutsch|Espa|Esperanto|Esto|Euskara|Farsi|Filipino|Fran|Gaeilge|Galego|Hrvatski|IsiZulu|Italiano|Kiswahili|Krey|Latvie|Lietuvi|Magyar|Malagasy|Malti|Nederlands|Norsk|Occitan|Polski|Portugu|Rom|Shqip|Sloven|Srpski|Suomi|Svenska|Tagalog|Tiếng|Türk|Yor|Zhongwen|Brě|English$)/i
];

files.forEach((file) => {
  const html = fs.readFileSync(file, 'utf8');
  const out = [];
  const seen = new Set();
  // 有 orig 标记但文本无中文（说明扩展试过/该翻） + 未标记的英文
  const textRe = />([^<>{}]{4,160})</g;
  let m;
  while ((m = textRe.exec(html))) {
    const text = decode(m[1]).replace(/\s+/g, ' ').trim();
    if (!text || !/[A-Za-z]{4}/.test(text)) continue;
    if (/[\u4e00-\u9fa5]/.test(text)) continue;
    if (SKIP.some((re) => re.test(text))) continue;
    if (/[{};=]|@media|function|var |<\/|http/.test(text)) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    const can = i18n.translate(text) !== text || i18n.translateInline(text);
    out.push({ text, can });
  }
  console.log('===== ' + path.basename(file).slice(0, 55) + ' =====');
  console.log('仍需处理的界面文本 ' + out.length + ' 条：');
  out.forEach((r) => console.log('  ' + (r.can ? '[引擎能翻] ' : '[词典缺]   ') + r.text));
  console.log('');
});
