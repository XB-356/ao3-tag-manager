const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const s={console,document:null,window:null,setTimeout,clearTimeout};s.globalThis=s;s.self=s;vm.createContext(s);
['src/lib/env-core.js','src/lib/env.js','src/lib/storage.js','src/lib/i18n.js'].forEach(r=>vm.runInContext(fs.readFileSync(path.join(ROOT,r),'utf8'),s,{filename:r}));
const t=s.AO3TM.i18n.translate;
['Home','Challenges','Works','Inbox','Language:','Words:','Chapters:','Comments:','Kudos:','Hits:','Language','Chapters','Comments','Hits','Bookmarks','Series','Collections','Statistics','Subscriptions','History','Skins','My Profile','My Preferences','Gifts','Sign-ups','Assignments','Claims','Drafts'].forEach(k=>{
  const out=t(k); console.log((out===k?'[缺] ':'[有] ')+JSON.stringify(k)+(out===k?'':' => '+JSON.stringify(out)));
});