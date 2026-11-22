/* 域名归一化与 match pattern（src/lib/env-core.js）单元测试，不需要浏览器。
   用法：node test/env-hosts.js
   背景：镜像站经常在裸域与 www 之间 301（例如 sbxz.org → www.sbxz.org）。
   如果注册的 match pattern 只覆盖其中一种，内容脚本就不会注入，
   表现就是"这个镜像站扩展认不出来"。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'env-core.js'), 'utf8');

const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok && detail !== undefined) console.log('   ' + JSON.stringify(detail));
}

function makeEnv(options) {
  const opts = options || {};
  const storage = {};
  if (opts.customHosts) storage.ao3tm_hosts = JSON.stringify(opts.customHosts);
  const sandbox = {
    console: console,
    location: { hostname: opts.hostname || 'example.com', protocol: 'https:' },
    localStorage: {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null),
      setItem: (key, value) => { storage[key] = String(value); }
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.AO3TM.envGlobal;
}

const env = makeEnv();

/* --- normalizeHost --- */
check('normalizeHost 去 www：www.sbxz.org → sbxz.org', env.normalizeHost('www.sbxz.org') === 'sbxz.org');
check(
  'normalizeHost 去协议/路径/端口/大小写',
  env.normalizeHost('  HTTPS://WWW.Sbxz.ORG:8443/works?q=1  ') === 'sbxz.org',
  env.normalizeHost('  HTTPS://WWW.Sbxz.ORG:8443/works?q=1  ')
);
check('normalizeHost 保留 localhost', env.normalizeHost('localhost') === 'localhost');
check('normalizeHost 拒绝非法输入', env.normalizeHost('not a host') === '' && env.normalizeHost('*://x') === '');

/* --- hostVariants --- */
check('hostVariants：裸域给出裸域 + www', JSON.stringify(env.hostVariants('sbxz.org')) === JSON.stringify(['sbxz.org', 'www.sbxz.org']), env.hostVariants('sbxz.org'));
check('hostVariants：传 www 也归一到同一组', JSON.stringify(env.hostVariants('www.sbxz.org')) === JSON.stringify(['sbxz.org', 'www.sbxz.org']));
check('hostVariants：IP 不加 www', JSON.stringify(env.hostVariants('127.0.0.1')) === JSON.stringify(['127.0.0.1']), env.hostVariants('127.0.0.1'));
check('hostVariants：localhost 不加 www', JSON.stringify(env.hostVariants('localhost')) === JSON.stringify(['localhost']));
check('hostVariants：空输入返回空数组', env.hostVariants('').length === 0);

/* --- hostToMatchPatterns --- */
const patterns = env.hostToMatchPatterns('sbxz.org');
check(
  'match pattern 同时覆盖 www 与非 www、http 与 https',
  ['https://sbxz.org/*', 'http://sbxz.org/*', 'https://www.sbxz.org/*', 'http://www.sbxz.org/*'].every(
    (item) => patterns.indexOf(item) !== -1
  ) && patterns.length === 4,
  patterns
);
check('match pattern 传 www 得到同一组', JSON.stringify(env.hostToMatchPatterns('www.sbxz.org')) === JSON.stringify(patterns));
check(
  'match pattern 对 IP 不加 www',
  env.hostToMatchPatterns('127.0.0.1').indexOf('https://127.0.0.1/*') !== -1 &&
    env.hostToMatchPatterns('127.0.0.1').every((item) => item.indexOf('www.') === -1),
  env.hostToMatchPatterns('127.0.0.1')
);

/* --- isAo3Host --- */
check('isAo3Host：官方站裸域', env.isAo3Host('archiveofourown.org') === true);
check('isAo3Host：官方站 www 也算', env.isAo3Host('www.archiveofourown.org') === true);
check('isAo3Host：预置镜像 www 也算', env.isAo3Host('www.sbxz.org') === true);
check('isAo3Host：完全无关的站不认', env.isAo3Host('www.example.com') === false);

/* --- 预置镜像清单：四个新站都认，旧站已移除 --- */
const PRESET_EXPECTED = ['sbxz.org', 'notfun.one', 'z.aoyu.moe', 'mera.moe'];
check(
  '预置镜像：四个新站裸域与 www 都认',
  PRESET_EXPECTED.every((host) => env.isAo3Host(host) === true && env.isAo3Host('www.' + host) === true),
  PRESET_EXPECTED.map((host) => [host, env.isAo3Host(host), env.isAo3Host('www.' + host)])
);
check(
  '预置镜像：旧镜像已从清单移除',
  ['ao3.cubeart.club', 'ao3.win', 'ao3.top', 'ao3l.online', 'archive.transformativeworks.org'].every(
    (host) => env.isAo3Host(host) === false
  ),
  ['ao3.win', env.isAo3Host('ao3.win')]
);
check(
  '预置镜像：每个站的注册/授权 patterns 都是 4 条（裸域+www × http/https）',
  PRESET_EXPECTED.every((host) => {
    const pats = env.hostToMatchPatterns(host);
    return (
      pats.length === 4 &&
      pats.indexOf('https://' + host + '/*') !== -1 &&
      pats.indexOf('https://www.' + host + '/*') !== -1
    );
  }),
  env.hostToMatchPatterns('notfun.one')
);

/* --- 自定义域名：存裸域，www 也认 --- */
const custom = makeEnv({ customHosts: ['sbxz.org'], hostname: 'www.sbxz.org' });
check('自定义镜像：存 sbxz.org 后 www.sbxz.org 也认', custom.isAo3Host('www.sbxz.org') === true);
check('自定义镜像：裸域当然也认', custom.isAo3Host('sbxz.org') === true);
check('自定义镜像：别的站不沾边', custom.isAo3Host('sbxz.org.evil.com') === false);

/* --- 自定义域名存的是 www 形式：读出来要归一化 --- */
const customWww = makeEnv({ customHosts: ['www.sbxz.org'] });
check('历史数据里存 www 形式也能读成裸域', customWww.readCustomHosts().indexOf('sbxz.org') !== -1, customWww.readCustomHosts());
check('历史数据 www 形式：裸域访问也认', customWww.isAo3Host('sbxz.org') === true);

console.log('\n===== 结果 =====');
console.log(results.length - failed + '/' + results.length + ' 通过');
if (failed) {
  results.filter((r) => !r.ok).forEach((r) => console.log('  - ' + r.name + ' :: ' + JSON.stringify(r.detail)));
}
process.exit(failed ? 1 : 0);
