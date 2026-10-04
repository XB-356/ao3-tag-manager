/* 全量测试运行器：把所有测试都跑一遍，避免"漏跑某个测试导致回归溜过去"。
   历史上 i18n-banner.js 长期没被跑，导致个人主页欢迎横幅的回归一直没被发现。
   用法：node test/all.js  （先确保 mock 服务在跑：node test/server.js） */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const NODE = process.execPath;

// 纯单元测试（快，不需要浏览器）
const UNIT = [
  'i18n.js', 'i18n-guard.js', 'i18n-the.js', 'i18n-homograph.js',
  'author-parse.js', 'detect.js', 'parse-tags.js'
];
// 真实浏览器测试（每个都要先清掉遗留的 headless Chrome，避免相互干扰）
const BROWSER = [
  'run.js', 'theme-i18n.js', 'i18n-comment.js', 'i18n-about.js',
  'i18n-banner.js', 'i18n-media.js', 'detect-browser.js', 'mirror-userscript.js'
];

const killHeadlessChrome = () => {
  if (process.platform !== 'win32') return;
  try {
    spawnSync('powershell', ['-NoProfile', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'headless' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    ], { stdio: 'ignore' });
  } catch (e) { /* 忽略 */ }
};

const run = (file) => {
  const started = Date.now();
  const r = spawnSync(NODE, [path.join(DIR, file)], { encoding: 'utf8', timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = out.match(/(\d+)\/(\d+) 通过/);
  return {
    file,
    ok: r.status === 0 && !!m && m[1] === m[2],
    score: m ? m[1] + '/' + m[2] : '?',
    ms: Date.now() - started,
    tail: out.split(/\r?\n/).filter((l) => /^FAIL|测试异常|^Error/.test(l)).slice(0, 4)
  };
};

(async () => {
  const rows = [];
  UNIT.forEach((f) => rows.push(run(f)));
  BROWSER.forEach((f) => {
    killHeadlessChrome();
    rows.push(run(f));
  });
  killHeadlessChrome();

  const width = Math.max(...rows.map((r) => r.file.length));
  console.log('\n===== 全量测试结果 =====');
  rows.forEach((r) => {
    console.log((r.ok ? ' 通过 ' : ' 失败 ') + r.file.padEnd(width) + '  ' + r.score.padStart(8) + '   ' + (r.ms / 1000).toFixed(1) + 's');
    r.tail.forEach((t) => console.log('        ' + t.trim()));
  });
  const bad = rows.filter((r) => !r.ok);
  console.log('\n' + (rows.length - bad.length) + '/' + rows.length + ' 个测试文件通过');
  process.exit(bad.length ? 1 : 0);
})();