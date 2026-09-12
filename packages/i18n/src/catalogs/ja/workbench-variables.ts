/**
 * Workbench variables station — Japanese. Mirrors
 * `catalogs/en/workbench-variables.ts` key for key. Technical plane
 * raw inside keyed sentences: `{{live.NAME}}` reference syntax, TOTP
 * algorithm names, PEM / Base32 / TOTP spec vocabulary, {name} /
 * {message} holes. Page titles reuse the sidebar names quoted by the
 * variables doc body（ワークスペース変数、ライブ変数、環境、`Vault` raw）;
 * the Scope panel section titles ship the exact strings the doc body
 * quotes（スコープ内 / すべてのスコープ）; スコープ throughout (S19 law);
 * 裸の参照 = bare reference (docs-variables mint); 名前空間 =
 * namespace. Lowercase en `vault` in prose stays `vault` (per-case
 * token law); capitalized `Vault` stays Vault. seed rides raw
 * (docs-variables precedent); capture = キャプチャ. MINTS: リゾルバー =
 * the resolver; バインディング = binding; the live markers 下書き / オフ
 * / 上書き mirror the en draft / off / override chips; 証明書 =
 * certificate kind; パスフレーズ = passphrase; 発行者 = TOTP issuer;
 * シークレットマネージャー = Secret Manager (resolution-hints mint).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchVariables = {
  // ── Shared table chrome (VariableTable + VariableTableRow) ─────────
  'workbench.variables.table.headerVariable': '変数',
  'workbench.variables.table.headerSecret': 'シークレット',
  'workbench.variables.table.headerValue': '値',
  'workbench.variables.table.namePlaceholder': '名前',
  'workbench.variables.table.valuePlaceholder': '値',
  'workbench.variables.table.addVariable': '変数を追加…',
  'workbench.variables.table.addSecret': 'シークレットを追加…',
  'workbench.variables.table.enableRow': '変数を有効化',
  'workbench.variables.table.disableRow': '変数を無効化',
  'workbench.variables.table.markSensitive': '機微としてマーク',
  'workbench.variables.table.unmarkSensitive': '機微のマークを解除',
  'workbench.variables.table.showValue': '値を表示',
  'workbench.variables.table.hideValue': '値を隠す',
  'workbench.variables.table.kindText': 'テキスト',
  'workbench.variables.table.kindTotp': 'TOTP',
  'workbench.variables.table.kindCertificate': '証明書',
  'workbench.variables.table.kindSecretManager': 'シークレットマネージャー',
  'workbench.variables.table.smProvider.onepassword': '1Password',
  'workbench.variables.table.smProvider.bitwarden': 'Bitwarden',
  'workbench.variables.table.smProvider.oskeychain': 'OS の資格情報ストア',
  'workbench.variables.table.smProvider.awssm': 'AWS Secrets Manager',
  'workbench.variables.table.smProvider.azurekv': 'Azure Key Vault',
  'workbench.variables.table.smProvider.hashivault': 'HashiCorp Vault',
  'workbench.variables.table.smField.provider': 'プロバイダー',
  'workbench.variables.table.smField.vault': 'Vault',
  'workbench.variables.table.smField.item': 'アイテム',
  'workbench.variables.table.smField.field': 'フィールド',
  'workbench.variables.table.smField.account': 'アカウント',
  'workbench.variables.table.smField.secretId': 'シークレット ID',
  'workbench.variables.table.smField.service': 'サービス',
  'workbench.variables.table.smField.name': '名前',
  'workbench.variables.table.smField.stage': 'ステージ',
  'workbench.variables.table.smField.region': 'リージョン',
  'workbench.variables.table.smField.profile': 'プロファイル',
  'workbench.variables.table.smField.vaultUrl': 'Vault URL',
  'workbench.variables.table.smField.version': 'バージョン',
  'workbench.variables.table.smField.mount': 'マウント',
  'workbench.variables.table.smField.path': 'パス',
  'workbench.variables.table.smField.key': 'キー',
  'workbench.variables.table.smField.serverUrl': 'サーバー URL',
  'workbench.variables.table.smFieldOptional': '{label}（省略可）',
  'workbench.variables.table.smStatus.available': '利用可能',
  'workbench.variables.table.smStatus.notInstalled': 'このデバイスでは利用できません',
  'workbench.variables.table.smStatus.integrationDisabled': '統合が無効',
  'workbench.variables.table.smStatus.noCredentials': '資格情報が設定されていません',
  'workbench.variables.table.smStatus.locked': 'ロック中',
  'workbench.variables.table.smStatus.unreachable': '到達できません',
  'workbench.variables.table.certPlaceholder': '証明書（PEM）',
  'workbench.variables.table.certKeyPlaceholder': '秘密鍵（PEM）',
  'workbench.variables.table.passphrasePlaceholder': '鍵のパスフレーズ（省略可）',
  'workbench.variables.table.showCertificate': '証明書を表示',
  'workbench.variables.table.hideCertificate': '証明書を隠す',
  'workbench.variables.table.seedPlaceholder': 'Base32 の seed',
  'workbench.variables.table.showSeed': 'seed を表示',
  'workbench.variables.table.hideSeed': 'seed を隠す',
  'workbench.variables.table.totpSummary': '{algorithm} · {digits} 桁 · {period} 秒',
  'workbench.variables.table.totpSummaryIssuer': '{algorithm} · {digits} 桁 · {period} 秒 · {issuer}',
  'workbench.variables.table.issuerPlaceholder': '発行者',

  // ── Shared page chrome ──────────────────────────────────────────────
  'workbench.variables.variablesCount': '変数（{count}）',

  // ── Workspace variables page ────────────────────────────────────────
  'workbench.variables.workspace.title': 'ワークスペース変数',
  'workbench.variables.workspace.description':
    'このワークスペースのすべての環境で共有されます。最も低い優先度で、コレクション、環境、vault のスコープに上書きされます。',
  'workbench.variables.workspace.saveFailed': 'ワークスペース変数の保存に失敗しました',
  'workbench.variables.workspace.saveFailedDetail': 'ワークスペース変数の保存に失敗しました：{message}',

  // ── Environment page ────────────────────────────────────────────────
  'workbench.variables.environment.notFound': '環境が見つかりません。',
  'workbench.variables.environment.activeTag': 'アクティブ',
  'workbench.variables.environment.defaultTag': 'デフォルト',
  'workbench.variables.environment.defaultTooltip':
    'アクティブな環境に変数がないとき、リゾルバーはここにフォールバックします。',
  'workbench.variables.environment.setActive': 'アクティブに設定',
  'workbench.variables.environment.setDefault': 'デフォルトに設定',
  'workbench.variables.environment.unsetDefault': 'デフォルトを解除',
  'workbench.variables.environment.setDefaultTooltip':
    'デフォルトに設定します。アクティブな環境に変数がないとき、リゾルバーはここにフォールバックします。',
  'workbench.variables.environment.unsetDefaultTooltip':
    'デフォルトを解除します。リゾルバーはこの環境へのフォールバックをやめます。',
  'workbench.variables.environment.deletedElsewhere': '環境が別のタブから削除されました',
  'workbench.variables.environment.updateFailed': '環境の更新に失敗しました',
  'workbench.variables.environment.updateFailedDetail': '環境の更新に失敗しました：{message}',

  // ── Collection variables page ───────────────────────────────────────
  'workbench.variables.collection.notFound': 'コレクションが見つかりません。',
  'workbench.variables.collection.title': '{name} · 変数',
  'workbench.variables.collection.descriptionRule':
    'このコレクション内のすべてのルールで使える変数です。環境と vault のスコープに上書きされ、ワークスペースのスコープを上書きします。平文で保存されるため、シークレットには Vault を使ってください。',
  'workbench.variables.collection.descriptionRequest':
    'このコレクション内のすべてのリクエストで使える変数です。環境と vault のスコープに上書きされ、ワークスペースのスコープを上書きします。平文で保存されるため、シークレットには Vault を使ってください。',
  'workbench.variables.collection.descriptionTemplate':
    'このコレクション内のすべてのテンプレートで使える変数です。環境と vault のスコープに上書きされ、ワークスペースのスコープを上書きします。平文で保存されるため、シークレットには Vault を使ってください。',
  'workbench.variables.collection.deletedElsewhere': 'コレクションが別のタブから削除されました',
  'workbench.variables.collection.saveFailed': 'コレクション変数の保存に失敗しました',
  'workbench.variables.collection.saveFailedDetail': 'コレクション変数の保存に失敗しました：{message}',

  // ── Vault page ──────────────────────────────────────────────────────
  'workbench.variables.vault.title': 'Vault',
  'workbench.variables.vault.infoBanner':
    'Vault のシークレットは保存時に暗号化され、このデバイスから決して出ず、他のすべてのスコープより優先されます。',
  'workbench.variables.vault.trustedRootsNote':
    'CA 証明書をお探しですか？信頼された証明書はシークレットではなくワークスペースのデータで、専用のタブにあります。',
  'workbench.variables.vault.trustedRootsLink': '信頼された証明書を開く',
  'workbench.variables.vault.cipherLocked':
    'シークレットのストレージがロックされています。システムがキーチェーンへのアクセスを拒否したため、このセッションでは vault のシークレットを読み書きできません。',
  'workbench.variables.vault.cipherLockedRelaunch': 'アプリを再起動',
  'workbench.variables.vault.lockedTitle': 'Vault がロックされています。保存時の鍵が失われました',
  'workbench.variables.vault.lockedDescription':
    'この vault のシークレットはまだこのデバイスに保存されていますが、もう復号できません。それらを封印した保存時の鍵がなくなりました（ブラウザーデータの消去、新しいプロファイル、または拡張機能の鍵のリセット）。新しいエントリが封印されたデータを上書きしないよう、編集は無効になっています。vault のロックを解除するにはシークレットを再入力してください。既存のエントリは置き換えられます。',
  'workbench.variables.vault.secretsCount':
    'シークレット（{strings} 件の string · {totps} 件の TOTP · {certs} 件の証明書 · {refs} 件のシークレットマネージャー）',
  'workbench.variables.vault.saveFailed': 'vault の保存に失敗しました',
  'workbench.variables.vault.saveFailedDetail': 'vault の保存に失敗しました：{message}',

  // ── Live variables list page ────────────────────────────────────────
  'workbench.variables.live.title': 'ライブ変数',
  'workbench.variables.live.newVariable': '新しいライブ変数',
  'workbench.variables.live.descriptionPrefix':
    '各バインディングは、名前をワークフロー（スケジュール実行されるリクエストチェーン）のキャプチャに対応付けます。ルールとリクエストでの参照は次のとおりです：',
  'workbench.variables.live.descriptionSuffix': '.',
  'workbench.variables.live.headerName': '名前',
  'workbench.variables.live.headerValue': '値',
  'workbench.variables.live.headerWorkflow': 'ワークフロー',
  'workbench.variables.live.empty':
    'ライブ変数はまだありません。作成して、名前をワークフローのキャプチャ値にバインドしてください。',
  'workbench.variables.live.draftMarker': '下書き',
  'workbench.variables.live.offMarker': 'オフ',
  'workbench.variables.live.overrideMarker': '上書き',
  'workbench.variables.live.clickEyeToReveal': '目のアイコンをクリックすると表示',
  'workbench.variables.live.showValue': '値を表示',
  'workbench.variables.live.hideValue': '値を隠す',
  'workbench.variables.live.notCapturedYet': 'まだキャプチャされていません',
  'workbench.variables.live.missingWorkflow': 'ワークフローがありません',
  'workbench.variables.live.refreshNow': '今すぐワークフローを更新',
  'workbench.variables.live.refreshAria': '{name} を更新',
  'workbench.variables.live.editBinding': 'バインディングを編集（名前 / 有効 / 上書き）',
  'workbench.variables.live.editAria': '{name} を編集',
  'workbench.variables.live.delete': '削除',
  'workbench.variables.live.deleteAria': '{name} を削除',
  'workbench.variables.live.deleteFailed': '「{name}」の削除に失敗しました',

  // ── Variable Scope tool window (Scope panel) ────────────────────────
  'workbench.variables.panel.scope.vault': 'Vault',
  'workbench.variables.panel.scope.environment': '環境',
  'workbench.variables.panel.scope.collection': 'コレクション',
  'workbench.variables.panel.scope.workspace': 'ワークスペース',
  'workbench.variables.panel.scope.live': 'Live',
  'workbench.variables.panel.inContextTitle': 'スコープ内',
  'workbench.variables.panel.inContextTitleNamed': 'スコープ内：{name}',
  'workbench.variables.panel.inContextSummary':
    'アクティブなルール、リクエスト、テンプレートが参照する変数です。それぞれすべてのスコープを通して解決されるため、実際に適用される正確な値が見えます。いずれかを開くまでは空です。',
  'workbench.variables.panel.allScopesTitle': 'すべてのスコープ',
  'workbench.variables.panel.allScopesSummary':
    'すべてのスコープにわたって定義されたすべての変数を、解決の優先順位ごとにまとめたものです。参照方法と順位はスコープの (i) を開いてください。',
  'workbench.variables.panel.sectionAboutAria': '{title} について',
  'workbench.variables.panel.scopeAboutAria': '{scope} の変数について',
  'workbench.variables.panel.scopeSummary.vault':
    'ユーザーごとのシークレットです。vault に保存され、決して同期されません。',
  'workbench.variables.panel.scopeSummary.environment':
    'アクティブな環境の変数です。デフォルト環境へのフォールバック付き。',
  'workbench.variables.panel.scopeSummary.collection': 'アクティブなコレクションをスコープとする変数です。',
  'workbench.variables.panel.scopeSummary.workspace': 'ワークスペース全体で共有される変数です。',
  'workbench.variables.panel.scopeSummary.live': 'ワークフローに支えられた値で、最新の実行から解決されます。',
  'workbench.variables.panel.scopeInfo.title': '{label}{qualifier}',
  'workbench.variables.panel.scopeInfo.qualifierSecret': 'シークレット',
  'workbench.variables.panel.scopeInfo.qualifierVariable': '変数',
  'workbench.variables.panel.scopeInfo.writePrefix': '書き方：',
  'workbench.variables.panel.scopeInfo.liveOnlyMiddle': 'のみ。裸の',
  'workbench.variables.panel.scopeInfo.orJustMiddle': 'または単に',
  'workbench.variables.panel.scopeInfo.sentenceEnd': '.',
  'workbench.variables.panel.scopeInfo.barePrefix': '裸の',
  'workbench.variables.panel.scopeInfo.bareSuffix': 'は優先順位で解決されます：',
  'workbench.variables.panel.scopeInfo.liveOutside': 'Live はこの順序の外にあります。',
  'workbench.variables.panel.env.subtitleActiveDefault': '{active} · デフォルト：{default}',
  'workbench.variables.panel.env.subtitleNoneDefault': '環境なし · デフォルト：{default}',
  'workbench.variables.panel.env.subtitleNone': '環境なし',
  'workbench.variables.panel.env.editTooltip': '環境変数のエディターを開く',
  'workbench.variables.panel.env.createTooltip': '最初の環境を作成',
  'workbench.variables.panel.env.selectTooltip': 'アクティブな環境を選択',
  'workbench.variables.panel.collection.noneActive': 'アクティブなコレクションがありません',
  'workbench.variables.panel.live.resolvedCount': '{resolved}/{total} 件解決済み',
  'workbench.variables.panel.live.noneDefined': 'ライブ変数は定義されていません',
  'workbench.variables.panel.action.edit': '編集',
  'workbench.variables.panel.action.editTooltip': '{scope} の変数エディターを開く',
  'workbench.variables.panel.action.create': '作成',
  'workbench.variables.panel.action.select': '選択',
  'workbench.variables.panel.emptyScopeSecrets': 'シークレットは定義されていません。',
  'workbench.variables.panel.emptyScopeVariables': '変数は定義されていません。',
  'workbench.variables.panel.openHint': 'リクエストまたはルールを開くと、それが参照する変数が表示されます。',
  'workbench.variables.panel.noneReferenced': 'この{noun}で参照されている変数はありません。',
  'workbench.variables.panel.noun.rule': 'ルール',
  'workbench.variables.panel.noun.request': 'リクエスト',
  'workbench.variables.panel.noun.template': 'テンプレート',
  'workbench.variables.panel.allResolved': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の変数すべてが解決済み' }),
  'workbench.variables.panel.unresolvedCount': '{count} 件未解決',
  'workbench.variables.panel.valueUnresolved': '未解決',
  'workbench.variables.panel.valueEmpty': '（空）',
  'workbench.variables.panel.showValue': '値を表示',
  'workbench.variables.panel.hideValue': '値を隠す',
  'workbench.variables.panel.copyValue': '値をコピー',
  'workbench.variables.panel.copied': 'コピーしました',
  'workbench.variables.panel.errors.title': '解決の問題（{count}）',
  'workbench.variables.panel.errors.referenceTooltip': '{{…}} 内の生の参照',
  'workbench.variables.panel.errors.reason.unresolved': '未解決',
  'workbench.variables.panel.errors.reason.unsetInScope': 'スコープ外',
  'workbench.variables.panel.errors.reason.unknownNamespace': '不明な名前空間',
  'workbench.variables.panel.errors.reason.stepOutOfContext': 'ステップ参照がスコープ外',
  'workbench.variables.panel.errors.reason.empty': '空',
  'workbench.variables.panel.errors.reason.invalidResolvedValue': '無効な値',
  'workbench.variables.panel.errors.reason.secretAuthorizationRequired': '認可が必要',
  'workbench.variables.panel.errors.reason.secretNotFound': 'シークレットが見つかりません',
  'workbench.variables.panel.errors.reason.secretUnavailable': 'マネージャーが利用不可',

  // ── TOTP preview (workbench-pane-shared component) ─────────────────
  'workbench.totpPreview.copyCode': 'コードをコピー',
  'workbench.totpPreview.copied': 'コピーしました',
  'workbench.totpPreview.refreshesTooltip': '{seconds} 秒後に更新',
  'workbench.totpPreview.refreshesAria': 'TOTP コードは {seconds} 秒後に更新されます',
} as const satisfies Catalog;
