/**
 * Extension namespace — Japanese. Mirrors `catalogs/en/extension.ts`
 * key for key; the 'Open Headers' brand prefix and its ` - ` state
 * separator ride raw inside the values. State words: 有効 = Active
 * (shared mint); 一時停止中 = Paused; 切断 = Disconnected.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const extension = {
  'extension.badge.default': 'Open Headers',
  'extension.badge.paused': 'Open Headers - 一時停止中\nルールの実行は一時停止しています',
  'extension.badge.disconnected': 'Open Headers - 切断\nデスクトップアプリに接続できません',
  'extension.badge.active': ({ matched, configured }, locale) =>
    `Open Headers - 有効\n${plural(locale, Number(configured), {
      other: '{count} 件のルール',
    })}のうち ${matched} 件がこのページのリクエストに一致しました`,
} as const satisfies Catalog;
