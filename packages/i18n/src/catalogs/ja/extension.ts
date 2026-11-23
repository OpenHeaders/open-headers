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
  'extension.toolbarMenu.openWorkspace': 'ワークスペースを開く',
  'extension.toolbarMenu.settings': '設定',
  'extension.toolbarMenu.pauseRules': 'ルールを一時停止',
  'extension.toolbarMenu.resumeRules': 'ルールを再開',
  'extension.toolbarMenu.notifications': '通知',
  'extension.toolbarMenu.help': 'ヘルプ',
  'extension.toolbarMenu.documentation': 'ドキュメント',
  'extension.toolbarMenu.whatsNew': '新機能',
  'extension.toolbarMenu.reportProblem': '問題を報告',
  'extension.manifest.name': 'Open Headers',
  'extension.manifest.description':
    'ブラウザーの中のオープンソース Enterprise API クライアント。チームコラボレーション。ブラウザーインターセプター — ライブトラフィックを変更。',
  'extension.manifest.descriptionSafari':
    'ブラウザーの中のオープンソース Enterprise API クライアント。チームコラボレーション。ブラウザーインターセプター — トラフィックを変更。',
  'extension.manifest.actionDescription': 'Open Headers のポップアップを開く',
} as const satisfies Catalog;
