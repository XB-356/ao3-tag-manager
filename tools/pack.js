/* 打包成可直接在 chrome://extensions 加载的 zip（扩展文件位于压缩包根目录）
   用法：node tools/pack.js [--dry-run]  →  dist/ao3-tag-manager-v<版本>.zip

   自己写 zip：避免依赖 PowerShell / zip 命令，中文文件名也不会出现编码问题。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const version = manifest.version;
const DIST = path.join(ROOT, 'dist');
const NAME = 'ao3-tag-manager-v' + version;
const ZIP = path.join(DIST, NAME + '.zip');

/** 需要打进包里的内容（相对仓库根目录） */
const INCLUDE = ['manifest.json', 'src', 'icons', '_locales', 'README.md', 'LICENSE'];
/** 排除目录与文件（测试、文档图、工具本身都不进包） */
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'test', 'tools', 'docs', '__pycache__']);
const EXCLUDE_FILES = new Set(['.gitignore', '.gitattributes', '.DS_Store', 'Thumbs.db', 'desktop.ini']);

const DRY_RUN = process.argv.includes('--dry-run');
const STAGE = path.join(os.tmpdir(), NAME + '-' + Date.now());

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    if (EXCLUDE_DIRS.has(path.basename(from))) return;
    fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach((name) => copyRecursive(path.join(from, name), path.join(to, name)));
    return;
  }
  if (EXCLUDE_FILES.has(path.basename(from))) return;
  fs.copyFileSync(from, to);
}

function writeInstallNote(target) {
  const note = [
    'AO3 标签管家 v' + version,
    '=================================',
    '',
    '这是【电脑浏览器】用的扩展安装包。',
    '手机 / 平板请改用同一 Release 里的 ao3-tag-manager.user.js（油猴脚本版）。',
    '',
    '安装（Chrome / Edge / Brave 等 Chromium 内核浏览器）',
    '  1. 解压本压缩包到任意目录（这个目录不要删，扩展会一直从这里读取）',
    '  2. 打开 chrome://extensions/（Edge 是 edge://extensions/）',
    '  3. 打开右上角「开发者模式」',
    '  4. 点「加载已解压的扩展程序」，选择解压出来的文件夹（能看到 manifest.json 那一层）',
    '  5. 打开 https://archiveofourown.org/ 即可看到效果',
    '',
    '镜像站',
    '  · 官方站之外，可在「规则设置 → 设置 → 镜像站」里填任意 AO3 镜像域名，点启用即可',
    '  · 启用时浏览器只会让你授权你填的那个域名，停用会收回授权',
    '',
    '说明',
    '  · 不要把 zip 直接拖进扩展页，Chrome 需要的是解压后的文件夹',
    '  · 所有规则只存在浏览器本地，不上传、不联网',
    '  · 详细用法见 README.md',
    '',
    '许可：GPL-3.0'
  ].join('\n');
  fs.writeFileSync(target, note, 'utf8');
}

/* ------------------------------ 最小 zip 写入器 ------------------------------ */

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date) {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() / 2)) & 0xffff;
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time, day };
}

/** 把一个目录打成 zip，条目名使用 UTF-8（设置 flag 0x0800） */
function zipDirectory(dir, outFile) {
  const entries = [];
  (function walk(current, prefix) {
    fs.readdirSync(current)
      .sort()
      .forEach((name) => {
        const full = path.join(current, name);
        const rel = prefix ? prefix + '/' + name : name;
        if (fs.statSync(full).isDirectory()) walk(full, rel);
        else entries.push({ rel, full });
      });
  })(dir, '');

  const chunks = [];
  const central = [];
  let offset = 0;
  const { time, day } = dosDateTime(new Date());

  entries.forEach((entry) => {
    const raw = fs.readFileSync(entry.full);
    const compressed = zlib.deflateRawSync(raw, { level: 9 });
    const nameBuf = Buffer.from(entry.rel, 'utf8');
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 文件名
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, compressed);

    central.push({ nameBuf, crc, compressed: compressed.length, raw: raw.length, offset });
    offset += local.length + nameBuf.length + compressed.length;
  });

  const centralStart = offset;
  central.forEach((item) => {
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(20, 4); // version made by
    head.writeUInt16LE(20, 6); // version needed
    head.writeUInt16LE(0x0800, 8);
    head.writeUInt16LE(8, 10);
    head.writeUInt16LE(time, 12);
    head.writeUInt16LE(day, 14);
    head.writeUInt32LE(item.crc, 16);
    head.writeUInt32LE(item.compressed, 20);
    head.writeUInt32LE(item.raw, 24);
    head.writeUInt16LE(item.nameBuf.length, 28);
    head.writeUInt16LE(0, 30);
    head.writeUInt16LE(0, 32);
    head.writeUInt16LE(0, 34);
    head.writeUInt16LE(0, 36);
    head.writeUInt32LE(0, 38);
    head.writeUInt32LE(item.offset, 42);
    chunks.push(head, item.nameBuf);
    offset += head.length + item.nameBuf.length;
  });

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(offset - centralStart, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  chunks.push(end);

  fs.writeFileSync(outFile, Buffer.concat(chunks));
  return entries.length;
}

/* --------------------------------- 组装 --------------------------------- */

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

INCLUDE.forEach((rel) => {
  const from = path.join(ROOT, rel);
  if (!fs.existsSync(from)) {
    console.warn('跳过不存在的条目: ' + rel);
    return;
  }
  copyRecursive(from, path.join(STAGE, path.basename(rel)));
});
writeInstallNote(path.join(STAGE, '安装说明.txt'));

// 自检：manifest 引用的文件必须都在包里
const missing = [];
const check = (rel) => {
  if (!fs.existsSync(path.join(STAGE, rel))) missing.push(rel);
};
Object.values(manifest.icons).forEach(check);
check(manifest.background.service_worker);
check(manifest.action.default_popup);
manifest.content_scripts.forEach((cs) => {
  (cs.js || []).forEach(check);
  (cs.css || []).forEach(check);
});
if (missing.length) {
  console.error('包内缺少 manifest 引用的文件: ' + missing.join(', '));
  fs.rmSync(STAGE, { recursive: true, force: true });
  process.exit(1);
}

const files = [];
(function walk(dir) {
  fs.readdirSync(dir).forEach((name) => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else files.push(path.relative(STAGE, full).split(path.sep).join('/'));
  });
})(STAGE);

console.log('版本: ' + version + '，共 ' + files.length + ' 个文件');
files.forEach((f) => console.log('  ' + f));

if (DRY_RUN) {
  fs.rmSync(STAGE, { recursive: true, force: true });
  console.log('\n--dry-run：未生成 zip');
  process.exit(0);
}

fs.mkdirSync(DIST, { recursive: true });
fs.rmSync(ZIP, { force: true });
const count = zipDirectory(STAGE, ZIP);
fs.rmSync(STAGE, { recursive: true, force: true });
console.log('\n生成: ' + path.relative(ROOT, ZIP) + '  (' + count + ' 条目, ' + Math.round(fs.statSync(ZIP).size / 1024) + ' KB)');
