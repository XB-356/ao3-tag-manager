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
const I = s.AO3TM.i18n;
const P = I.phrases;
const zh = '捐赠或参与志愿';
console.log('=== 是"捐赠或参与志愿"子串的 key ===');
Object.keys(P).filter((k) => zh.indexOf(k) !== -1).forEach((k) => console.log('  ' + JSON.stringify(k) + ' => ' + JSON.stringify(P[k])));
console.log('=== 含中文的 key（可能是它们） ===');
Object.keys(P).filter((k) => /[\u4e00-\u9fa5]/.test(k)).forEach((k) => console.log('  ' + JSON.stringify(k) + ' => ' + JSON.stringify(P[k])));
console.log('=== 逐段验证 ===');
['捐赠或参与志愿', '捐赠或参与志愿或 Volunteer', 'Donate or Volunteer', '参与志愿'].forEach((t) => {
  console.log('  ' + JSON.stringify(t));
  console.log('     translate = ' + JSON.stringify(I.translate(t)));
  console.log('     inline    = ' + JSON.stringify(I.translateInline(t)));
});
