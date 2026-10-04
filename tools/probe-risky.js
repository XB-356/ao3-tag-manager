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
const i18n = s.AO3TM.i18n;
const keys = Object.keys(i18n.phrases);
console.log('词典里的相关键：');
['Donate', 'Volunteer', 'Donate or Volunteer', 'Volunteer（或 Volunteer）'].forEach((k) => {
  console.log('  ' + JSON.stringify(k) + ' => ' + JSON.stringify(i18n.phrases[k]));
});
console.log('\n直接翻译：');
['Donate or Volunteer', '捐赠或参与志愿或 Volunteer', 'Volunteer'].forEach((t) => {
  console.log('  translate     ' + JSON.stringify(t) + ' => ' + JSON.stringify(i18n.translate(t)));
  console.log('  inline        ' + JSON.stringify(t) + ' => ' + JSON.stringify(i18n.translateInline(t)));
});
