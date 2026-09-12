/**
 * Resolution-hint family — Japanese. Mirrors
 * `catalogs/en/shared-resolution-hints.ts` key for key; see that file
 * for the core mirror contract and the raw technical plane (`{{…}}`
 * reference syntax, namespace ids, requestDomains / sha256 / punycode,
 * Chrome). Mints: ライブ変数 = Live Variable; ライブワークフロー = Live
 * Workflow; シークレットマネージャー = secret manager.
 */

import type { Catalog } from '../../types';

export const sharedResolutionHints = {
  'shared.resolutionHint.empty': '参照が空です。{{name}} または {{namespace.name}} を使ってください。',
  'shared.resolutionHint.unknownNamespace':
    '不明な名前空間です。有効な名前空間：env、vault、collection、workspace、file、live、step、dynamic。',
  'shared.resolutionHint.unset.envActive':
    'この変数を環境 → アクティブな環境で設定してください（またはフォールバックとしてデフォルト環境で）。',
  'shared.resolutionHint.unset.envNoActive':
    'アクティブな環境が選択されていません。環境で選択するか、デフォルト環境を設定してください。',
  'shared.resolutionHint.unset.vault': 'このシークレットを Vault で設定してください。',
  'shared.resolutionHint.unset.collection': 'この変数を現在のコレクションで設定してください。',
  'shared.resolutionHint.unset.workspace': 'この変数をワークスペース変数で設定してください。',
  'shared.resolutionHint.unset.file': 'このファイルは sha256 ハッシュで参照してください。',
  'shared.resolutionHint.unset.live':
    'その名前のライブ変数はありません。ライブ変数で作成するか、最初の更新で値が入るのを待ってください。',
  'shared.resolutionHint.unset.step':
    'このワークフロー実行にステップ ID またはキャプチャ名が見つかりません。ワークフローのステップ設定を確認してください。',
  'shared.resolutionHint.unset.dynamic':
    'その名前の組み込み生成器はありません。候補リストから選択してください（{{dynamic.uuid}}、{{dynamic.timestamp}}、…）。',
  'shared.resolutionHint.unset.generic': 'このスコープには設定されていません。',
  'shared.resolutionHint.stepOutOfContext':
    'ステップ参照（{{step.<stepId>.<captureName>}}）はライブワークフローのステップ内でのみ有効です。',
  'shared.resolutionHint.unresolved':
    'vault、環境、コレクション、ワークスペースのいずれにも見つかりません。いずれかのスコープで定義してください。',
  'shared.resolutionHint.secretAuthorizationRequired':
    'このエントリーを保持するシークレットマネージャーには認可が必要です。マネージャーでロック解除またはアクセスを承認してから再試行してください。',
  'shared.resolutionHint.secretNotFound':
    'シークレットマネージャーはこの参照先にシークレットを見つけられませんでした。Vault エントリーの参照フィールドを確認してください。',
  'shared.resolutionHint.secretUnavailable':
    'このエントリーのシークレットマネージャーはこのデバイスで利用できません。インストールまたは設定してから再試行してください。',
  'shared.resolutionHint.invalidDomain.whitespace':
    '変数の解決結果はこのスロットで Chrome に拒否される値です。空白が含まれています（ホスト名はコンマで区切ってください）。コンマ区切りの素のホスト名を使ってください。',
  'shared.resolutionHint.invalidDomain.scheme':
    '変数の解決結果はこのスロットで Chrome に拒否される値です。スキームが含まれています。プロトコルのプレフィックスを外してください。コンマ区切りの素のホスト名を使ってください。',
  'shared.resolutionHint.invalidDomain.wildcard':
    '変数の解決結果はこのスロットで Chrome に拒否される値です。ワイルドカードが含まれています。requestDomains はサブドメインに自動的に一致します。コンマ区切りの素のホスト名を使ってください。',
  'shared.resolutionHint.invalidDomain.port':
    '変数の解決結果はこのスロットで Chrome に拒否される値です。ポートが含まれています。requestDomains はホスト名のみで一致します。コンマ区切りの素のホスト名を使ってください。',
  'shared.resolutionHint.invalidDomain.uppercase':
    '変数の解決結果はこのスロットで Chrome に拒否される値です。大文字が含まれています。requestDomains は小文字の ASCII です。コンマ区切りの素のホスト名を使ってください。',
  'shared.resolutionHint.invalidDomain.nonAscii':
    '変数の解決結果はこのスロットで Chrome に拒否される値です。Chrome が拒否する文字が含まれています（IDN 名には punycode を使ってください）。コンマ区切りの素のホスト名を使ってください。',
  'shared.resolutionHint.invalidDomain.empty':
    '変数の解決結果はこのスロットで Chrome に拒否される値です。サニタイズ後に空になります。コンマ区切りの素のホスト名を使ってください。',
} as const satisfies Catalog;
