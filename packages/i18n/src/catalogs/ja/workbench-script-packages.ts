/**
 * Script-packages family — Japanese. Mirrors
 * `catalogs/en/workbench-script-packages.ts` key for key; `oh.require`
 * and `module.exports` ride raw. Mints: パッケージ = package;
 * パッケージライブラリ = Package Library.
 */

import type { Catalog } from '../../types';

export const workbenchScriptPackages = {
  // ── List rail ──────────────────────────────────────────────────────
  'workbench.scriptPackages.title': 'パッケージライブラリ',
  'workbench.scriptPackages.new': '新規',
  'workbench.scriptPackages.searchPlaceholder': 'パッケージを検索...',
  'workbench.scriptPackages.emptyNone': 'パッケージはまだありません',
  'workbench.scriptPackages.emptyNoMatch': 'パッケージが見つかりません',

  // ── Primer ─────────────────────────────────────────────────────────
  'workbench.scriptPackages.primer.title': 'パッケージでスクリプトをリクエスト間で再利用する',
  'workbench.scriptPackages.primer.step1': '1. 再利用できるコードを含むパッケージを作成します。',
  'workbench.scriptPackages.primer.step2': '2. 再利用したい関数をエクスポートします。',
  'workbench.scriptPackages.primer.step3': '3. リクエストスクリプトで oh.require を使ってパッケージを読み込みます。',

  // ── Editor pane ────────────────────────────────────────────────────
  'workbench.scriptPackages.nameAria': 'パッケージ名',
  'workbench.scriptPackages.descriptionPlaceholder': '説明（任意）',
  'workbench.scriptPackages.descriptionAria': 'パッケージの説明',
  'workbench.scriptPackages.save': '保存',
  'workbench.scriptPackages.deleteTitle': 'このパッケージを削除しますか？',
  'workbench.scriptPackages.deleteDescription':
    'これを oh.require で呼び出しているスクリプトは失敗するようになります。',
  'workbench.scriptPackages.delete': '削除',
  'workbench.scriptPackages.loadFromScriptPrefix': 'スクリプトからはこのように読み込みます：',
  'workbench.scriptPackages.exportViaInfix': '— 公開する機能はこのようにエクスポートします：',
  'workbench.scriptPackages.sourcePlaceholder':
    '再利用できる JavaScript を書き、module.exports でエクスポートしてください。',

  // ── Discard-on-switch confirm ──────────────────────────────────────
  'workbench.scriptPackages.discardTitle': '未保存の変更を破棄しますか？',
  'workbench.scriptPackages.discardContent': '現在のパッケージには未保存の編集があります。切り替えると破棄されます。',
  'workbench.scriptPackages.discardOk': '破棄',

  // ── Write outcomes ─────────────────────────────────────────────────
  'workbench.scriptPackages.nameRequired': 'パッケージ名は必須です。oh.require のキーになります。',
  'workbench.scriptPackages.saved': 'パッケージを保存しました',
  'workbench.scriptPackages.duplicateName': '「{name}」という名前のパッケージはこのワークスペースに既に存在します。',
  'workbench.scriptPackages.notFound': 'パッケージが見つかりません。削除された可能性があります。',
  'workbench.scriptPackages.saveFailed': '保存に失敗しました',
  'workbench.scriptPackages.deleted': 'パッケージを削除しました',
  'workbench.scriptPackages.deleteFailed': '削除に失敗しました',
} as const satisfies Catalog;
