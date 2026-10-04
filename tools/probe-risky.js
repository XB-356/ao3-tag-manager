const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const s = { console, document: null, window: null, setTimeout, clearTimeout };
s.globalThis = s;
s.self = s;
vm.createContext(s);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), s, { filename: r })
);
const keys = Object.keys(s.AO3TM.i18n.phrases);

/** 这些键如果参与"片段替换"就会切碎标题/笔名 */
const RISKY = [
  'or', 'and', 'publish', 'Preferences', 'Default', 'Share', 'From', 'To', 'Site',
  'Rules', 'Prompts:', 'Contents', 'Block', 'Unblock', 'Mute', 'Unmute', 'Either',
  'Closed', 'Moderated', 'Canonical', 'Synonymous', 'Unwrangleable', 'Note',
  'Donate', 'Volunteer', 'User', 'Tags', 'Warnings', 'Language', 'Words', 'Chapters'
];
console.log('词典里仍在的"危险短键"（应仅剩允许整段匹配的）：');
keys.filter((k) => RISKY.indexOf(k) !== -1).forEach((k) => console.log('  ' + JSON.stringify(k)));

console.log('\n=== 真实页面片段复现 ===');
const cases = [
  'By Choice, by Fate, or Neither',
  'Donate or Volunteer',
  'Set your preferences now',
  'Default',
  'Reversi',
  'Share Bookmark',
  'Terms of Service'
];
cases.forEach((text) => {
  console.log('  ' + JSON.stringify(text) + '  =>  ' + JSON.stringify(s.AO3TM.i18n.translate(text)));
});
