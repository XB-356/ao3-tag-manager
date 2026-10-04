const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const s = { console, document: null, window: null, setTimeout, clearTimeout };
s.globalThis = s; s.self = s;
vm.createContext(s);
['src/lib/env-core.js', 'src/lib/env.js', 'src/lib/storage.js', 'src/lib/i18n.js'].forEach((r) =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, r), 'utf8'), s, { filename: r })
);
const t = s.AO3TM.i18n.translate;
[
  'Post Comment',
  "This work's creator has chosen to moderate comments on the work. Your comment will not appear until it has been approved by the creator.",
  'Comment as',
  'Plain text with limited HTML',
  'Brevity is the soul of wit, but we need your comment to have text in it.'
].forEach((k) => console.log('  ' + JSON.stringify(k.slice(0, 50)) + ' => ' + JSON.stringify(t(k))));
