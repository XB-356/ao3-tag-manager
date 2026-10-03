/* AO3 标签管家 —— 宿主环境适配（MV3 service worker 用）
   service worker 是 ES 模块，需要静态导入（MV3 禁止动态 import()），
   这里把共享核心 env-core.js 以模块身份加载后重新导出。 */
import './env-core.js';

export const AO3TM = globalThis.AO3TM;
export const env = globalThis.AO3TM.envGlobal;
