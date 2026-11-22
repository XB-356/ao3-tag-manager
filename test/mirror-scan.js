/* 「所有网站」自动扫描脚本（src/lib/mirrors.js 的 SCAN 部分）单元测试。
   用法：node test/mirror-scan.js
   背景：内容脚本能注入哪些站点由 manifest 的 matches 决定，光拿到 <all_urls>
   权限并不会让陌生站点自动注入——新镜像就永远发现不了。所以开启自动检测后
   要额外注册一个轻量扫描脚本，撤销权限时再注销。
   这里用假的 chrome API 验证注册/注销的真实形状，不需要启动浏览器。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok && detail !== undefined) console.log('   ' + JSON.stringify(detail));
}

function makeChrome(options) {
  const opts = options || {};
  const state = {
    registered: new Map(),
    registeredCalls: [],
    unregisteredCalls: [],
    allSites: !!opts.allSites,
    hostGranted: opts.hostGranted || {},
    store: {}
  };
  const api = {
    runtime: {
      id: 'test-extension',
      lastError: null,
      sendMessage: function (message, cb) {
        if (cb) cb({ ok: true });
      }
    },
    storage: {
      local: {
        get: function (key, cb) {
          const out = {};
          const keys = Array.isArray(key) ? key : [key];
          keys.forEach(function (name) {
            if (name && Object.prototype.hasOwnProperty.call(state.store, name)) out[name] = state.store[name];
          });
          cb(out);
        },
        set: function (payload, cb) {
          if (payload) Object.assign(state.store, payload);
          if (cb) cb();
        }
      }
    },
    permissions: {
      contains: function (detail, cb) {
        const origins = (detail && detail.origins) || [];
        if (origins.indexOf('https://*/*') !== -1) {
          cb(state.allSites);
          return;
        }
        cb(origins.some((pattern) => state.hostGranted[pattern]));
      },
      request: function (detail, cb) {
        cb(true);
      },
      remove: function (detail, cb) {
        cb(true);
      }
    },
    scripting: {
      getRegisteredContentScripts: function (detail, cb) {
        const ids = (detail && detail.ids) || [];
        cb(ids.map((id) => state.registered.get(id)).filter(Boolean));
      },
      registerContentScripts: function (list, cb) {
        (list || []).forEach((script) => state.registered.set(script.id, script));
        state.registeredCalls.push(list);
        if (cb) cb();
      },
      updateContentScripts: function (list, cb) {
        (list || []).forEach((script) => state.registered.set(script.id, script));
        state.registeredCalls.push(list);
        if (cb) cb();
      },
      unregisterContentScripts: function (detail, cb) {
        const ids = (detail && detail.ids) || [];
        ids.forEach((id) => state.registered.delete(id));
        state.unregisteredCalls.push(ids);
        if (cb) cb();
      }
    }
  };
  return { api: api, state: state };
}

function boot(options) {
  const made = makeChrome(options);
  const sandbox = {
    console: console,
    chrome: made.api,
    location: { hostname: 'example.com', protocol: 'https:' },
    localStorage: { getItem: () => null, setItem: () => {} }
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'lib', 'env-core.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'lib', 'mirrors.js'), 'utf8'), sandbox);
  return { mirrors: sandbox.AO3TM.mirrors, state: made.state, env: sandbox.AO3TM.envGlobal };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  /* --- 没授权"所有网站"：不该注册扫描脚本 --- */
  const off = boot({ allSites: false });
  check('扫描脚本 id / 匹配范围常量正确', off.mirrors.SCAN_ID === 'ao3tm-scan' && off.mirrors.SCAN_JS.length >= 3, {
    id: off.mirrors.SCAN_ID,
    js: off.mirrors.SCAN_JS
  });
  check('扫描脚本只带轻量模块（不含 i18n / ui / filter）', off.mirrors.SCAN_JS.every((file) => !/i18n|panel|ui\.js|filter\.js/.test(file)), off.mirrors.SCAN_JS);
  await off.mirrors.sync();
  check('未授权所有网站时不注册扫描脚本', off.state.registered.has('ao3tm-scan') === false);

  /* --- 授权"所有网站"后：注册，且 matches 覆盖 http/https --- */
  const on = boot({ allSites: true });
  await on.mirrors.sync();
  const scan = on.state.registered.get('ao3tm-scan');
  check('授权所有网站后注册扫描脚本', !!scan, on.state.registeredCalls);
  check(
    '扫描脚本 matches 覆盖 http 与 https 全部站点',
    scan && scan.matches.indexOf('https://*/*') !== -1 && scan.matches.indexOf('http://*/*') !== -1,
    scan && scan.matches
  );
  check(
    '扫描脚本包含检测与横幅所需模块（含 env-core 与 detect）',
    scan && scan.js.indexOf('src/lib/env-core.js') !== -1 && scan.js.indexOf('src/lib/detect.js') !== -1 && scan.js.indexOf('src/lib/auto-detect.js') !== -1,
    scan && scan.js
  );
  check('扫描脚本跨会话保留、document_idle 注入', scan && scan.persistAcrossSessions === true && scan.runAt === 'document_idle', scan);
  check(
    '扫描脚本带执行入口 scan.js（只放库文件会"加载但不执行"）',
    scan && scan.js.indexOf('src/core/scan.js') !== -1,
    scan && scan.js
  );
  check(
    '扫描脚本带横幅样式（否则横幅是无样式的裸 div）',
    scan && Array.isArray(scan.css) && scan.css.indexOf('src/lib/panel.css') !== -1,
    scan && scan.css
  );

  /* --- 撤销权限后再 sync：要注销 --- */
  on.state.allSites = false;
  await on.mirrors.sync();
  check('撤销所有网站权限后注销扫描脚本', on.state.registered.has('ao3tm-scan') === false);
  check('注销时确实调用了 unregisterContentScripts', on.state.unregisteredCalls.some((ids) => ids.indexOf('ao3tm-scan') !== -1), on.state.unregisteredCalls);

  /* --- 已启用镜像与扫描脚本互不干扰 --- */
  const both = boot({ allSites: true, hostGranted: { 'https://sbxz.org/*': true } });
  await both.mirrors.saveEnabled(['sbxz.org']);
  await both.mirrors.sync();
  const mirrorScript = both.state.registered.get('ao3tm-mirror');
  check(
    '镜像脚本与扫描脚本同时存在，且镜像 matches 含 www 变体',
    !!mirrorScript &&
      !!both.state.registered.get('ao3tm-scan') &&
      mirrorScript.matches.indexOf('https://www.sbxz.org/*') !== -1,
    mirrorScript && mirrorScript.matches
  );
  check('扫描脚本用轻量文件表，镜像脚本用完整文件表', mirrorScript.js.length > both.state.registered.get('ao3tm-scan').js.length, {
    mirror: mirrorScript.js.length,
    scan: both.state.registered.get('ao3tm-scan').js.length
  });

  await sleep(10);
  console.log('\n===== 结果 =====');
  console.log(results.length - failed + '/' + results.length + ' 通过');
  if (failed) {
    results.filter((r) => !r.ok).forEach((r) => console.log('  - ' + r.name + ' :: ' + JSON.stringify(r.detail)));
  }
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('测试异常：' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
