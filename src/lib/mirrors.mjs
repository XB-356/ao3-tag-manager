/* AO3 标签管家 —— 镜像站支持（MV3 service worker 用的模块包装）
   service worker 是 ES 模块，必须静态导入（MV3 禁止动态 import()）；
   实现本体 mirrors.js 是普通脚本（内容脚本/油猴要用），这里把它当模块加载后重新导出。 */
import './mirrors.js';

export const mirrors = globalThis.AO3TM.mirrors;
