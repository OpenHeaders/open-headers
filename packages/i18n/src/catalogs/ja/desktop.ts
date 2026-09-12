/**
 * Desktop namespace — Japanese. Mirrors `catalogs/en/desktop.ts` key
 * for key; the 'Open Headers' brand rides raw. Menu rows are bare
 * nouns; trailing … copies en's ellipsis glyph.
 */

import type { Catalog } from '../../types';

export const desktop = {
  'desktop.tray.open': 'Open Headers を開く',
  'desktop.tray.quit': '終了',
  'desktop.menu.settings': '設定…',
  'desktop.menu.about': '{name} について',
  'desktop.menu.enableHardwareAcceleration': 'ハードウェアアクセラレーションを有効にする',
  'desktop.menu.disableHardwareAcceleration': 'ハードウェアアクセラレーションを無効にする',
  'desktop.menu.file': 'ファイル',
  'desktop.menu.edit': '編集',
  'desktop.menu.view': '表示',
  'desktop.menu.window': 'ウィンドウ',
  'desktop.menu.help': 'ヘルプ',
  'desktop.menu.newItem': '新規…',
  'desktop.menu.newTab': '新しいタブ',
  'desktop.menu.newWindow': '新しいウィンドウ',
  'desktop.menu.import': 'インポート…',
  'desktop.menu.closeTab': 'タブを閉じる',
  'desktop.menu.nextTab': '次のタブ',
  'desktop.menu.previousTab': '前のタブ',
  'desktop.menu.actualSize': '実際のサイズ',
  'desktop.menu.documentation': 'ドキュメント',
  'desktop.menu.reportIssue': '問題を報告',
  'desktop.menu.licenseAgreement': 'ライセンス契約',
  'desktop.update.check': 'アップデートを確認…',
  'desktop.update.checking': 'アップデートを確認中…',
  'desktop.update.updateAndRestart': '{version} に更新して再起動',
  'desktop.update.availableExternal': 'バージョン {version} が利用可能…',
  'desktop.update.downloading': 'アップデートをダウンロード中… {percent}%',
  'desktop.update.downloadingNoProgress': 'アップデートをダウンロード中…',
  'desktop.update.restartToInstall': '再起動して {version} をインストール',
  'desktop.dialog.hardwareAcceleration.title': 'ハードウェアアクセラレーション',
  'desktop.dialog.hardwareAcceleration.willBeDisabled':
    'ハードウェアアクセラレーションは、次回 {name} を起動したときに無効になります。',
  'desktop.dialog.hardwareAcceleration.willBeEnabled':
    'ハードウェアアクセラレーションは、次回 {name} を起動したときに有効になります。',
  'desktop.dialog.hardwareAcceleration.detail': '変更をすぐに適用するには今すぐ再起動してください。',
  'desktop.dialog.hardwareAcceleration.restartNow': '今すぐ再起動',
  'desktop.dialog.hardwareAcceleration.later': '後で',
  'desktop.firstRunLegal.message':
    'Open Headers の使用を続けることで、ライセンス条項とプライバシーポリシーに同意したものとみなされます。',
  'desktop.firstRunLegal.license': 'ライセンス条項',
  'desktop.firstRunLegal.privacy': 'プライバシーポリシー',
  'desktop.firstRunLegal.acknowledge': '了解',
} as const satisfies Catalog;
