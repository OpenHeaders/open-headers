/**
 * Extension namespace — Simplified Chinese. Mirrors
 * `catalogs/en/extension.ts` key for key; the 'Open Headers' brand
 * prefix and its ` - ` state separator ride raw inside the values.
 * State words: 活动 = Active (shared mint); 已暂停 = Paused; 已断开
 * 连接 = Disconnected.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const extension = {
  'extension.badge.default': 'Open Headers',
  'extension.badge.paused': 'Open Headers - 已暂停\n规则执行已暂停',
  'extension.badge.disconnected': 'Open Headers - 已断开连接\n无法连接桌面应用',
  'extension.badge.active': ({ matched, configured }, locale) =>
    `Open Headers - 活动\n你的 ${plural(locale, Number(configured), {
      other: '{count} 条规则',
    })} 中有 ${matched} 条在此页面上匹配了请求`,
} as const satisfies Catalog;
