/* 校验 manifest 版本号是否符合 Chrome 规则：
   1~4 段以点分隔的整数，每段 0~65535（不接受 alpha / beta 这类后缀）
   用法：node tools/check-version.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const version = String(manifest.version || '');

const parts = version.split('.');
const problems = [];
if (!/^\d+(\.\d+){0,3}$/.test(version)) {
  problems.push('必须只由 1~4 段数字与点组成（不能有 -alpha、-beta 这类后缀）');
}
if (parts.length > 4) problems.push('最多 4 段，当前 ' + parts.length + ' 段');
parts.forEach((p, i) => {
  const n = Number(p);
  if (!Number.isInteger(n) || n < 0 || n > 65535) problems.push('第 ' + (i + 1) + ' 段必须是 0~65535 的整数，当前 ' + JSON.stringify(p));
  if (/^0\d/.test(p)) problems.push('第 ' + (i + 1) + ' 段不应有前导零：' + p);
});

console.log('manifest.version = ' + version);
if (problems.length) {
  console.log('❌ 不符合 Chrome 要求：');
  problems.forEach((p) => console.log('   - ' + p));
  process.exit(1);
}
console.log('✅ 符合 Chrome 版本号规则');
