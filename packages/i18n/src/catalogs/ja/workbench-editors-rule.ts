/**
 * Workbench editors — the rule editor — Japanese. Mirrors
 * `catalogs/en/workbench-editors-rule.ts` key for key. The quick
 * editor reuses the `workbench.editors.rule.fields.*` keys directly
 * (S35 field-key reuse law) — field labels here stay consistent with
 * `ja/panel-quick-editor.ts` (op nouns 注入 / 上書き / 追記 / マージ /
 * 削除, すべて削除, the Mock raw tag + 変更 = Modify). Rule-type
 * kickers reuse the -ルール family from workbench-chrome (ヘッダールール
 * / ブロックルール / リダイレクトルール / クエリパラメータールール /
 * 注入ルール / 遅延ルール / リクエストボディルール / レスポンスルール /
 * WebSocket ルール / SSE ルール / 認証ルール). MINTS: テンプレート =
 * template (ユーザーテンプレート = user template); ヘッダー部 here also
 * = the editor header bar (S19 separate referent — the JWT segment
 * ヘッダー部 and HTTP ヘッダー unchanged); 上書きのみ = Replace Only;
 * ファーストパーティ / サードパーティ = first-/third-party; トゥーム
 * ストーン = tombstone; スロット = DNR slot; 切り詰め = clamped.
 * チャレンジ / 下書き / 面 / 上限 / デバッグモード / スコープ carried.
 * Raw by design: gates AND/OR/NOT, DNR schema vocabulary
 * (`requestDomains`, `url-filter`, `firstParty`, slot ids),
 * `{{ns.NAME}}` reference syntax in placeholders, quoted browser UI
 * phrasing (raw en in “”, S80 law), scheme prefixes, HTTP method
 * lists, regex fragments, the Mock tag; `⋮ → ユーザーテンプレートとして
 * 保存` menu-path splits quote the OH mint.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRule = {
  // ── Shared editor shell chrome (EditorHeader, SectionInfo) ─────────
  'workbench.editors.header.saved': '保存済み',
  'workbench.editors.header.onTop': 'ヘッダー部を上に',
  'workbench.editors.header.atBottom': 'ヘッダー部を下に',
  'workbench.editors.header.moreActions': 'その他の操作',

  // ── Rule editor shell ──────────────────────────────────────────────
  'workbench.editors.rule.kicker': 'ルールエディター',
  'workbench.editors.rule.templates.title': 'テンプレート',
  'workbench.editors.rule.templates.infoSummary': '空のフォームではなく、プリセットから始めます。',
  'workbench.editors.rule.templates.infoDescription':
    'システムテンプレートはアプリに同梱されています。ユーザーテンプレートは ⋮ → ユーザーテンプレートとして保存 で自分で保存したものです。テンプレートを適用してもフィールドが事前入力されるだけなので、保存する前に自由に調整してください。',
  'workbench.editors.rule.templates.blank': '空白',
  'workbench.editors.rule.templates.system': 'システム',
  'workbench.editors.rule.templates.user': 'ユーザー',
  'workbench.editors.rule.templates.emptyTitle': 'ユーザーテンプレートはまだありません',
  'workbench.editors.rule.templates.emptyBeforeMenu':
    'ユーザーテンプレートは、このルールの種類向けにあなた自身が用意する再利用可能なプリセットです。ルールを好みの形に設定してから、ヘッダー部で',
  'workbench.editors.rule.templates.emptyMenuPath': '⋮ → ユーザーテンプレートとして保存',
  'workbench.editors.rule.templates.emptyAfterMenu':
    'を選んでください。この種類の新しいルールすべてで、ここに表示されます。',
  'workbench.editors.rule.saveAsTemplate': 'ユーザーテンプレートとして保存',
  'workbench.editors.rule.enabled': '有効',
  'workbench.editors.rule.disabled': '無効',
  'workbench.editors.rule.toast.unknownType': '不明なルールの種類です',
  'workbench.editors.rule.toast.deletedOtherTab': 'ルールが別のタブから削除されました',
  'workbench.editors.rule.toast.updateFailed': 'ルールの更新に失敗しました',
  'workbench.editors.rule.toast.updateFailedDetail': 'ルールの更新に失敗しました：{message}',
  'workbench.editors.rule.toast.publishFailed': 'ルールは保存されましたが公開に失敗しました',
  'workbench.editors.rule.toast.updated': 'ルールを更新しました',
  'workbench.editors.rule.toast.published': 'ルールを公開しました',
  'workbench.editors.rule.toast.formatSkipped': '保存時の整形をスキップしました：{reason}',
  'workbench.editors.rule.toast.noCollection': 'コレクションが見つかりません',
  'workbench.editors.rule.toast.restoreFailed': 'ルールの復元に失敗しました',
  'workbench.editors.rule.toast.restored': 'ルールを復元しました',
  'workbench.editors.rule.deleted.message': 'このルールは別の面から削除されました。',
  'workbench.editors.rule.deleted.description':
    '復元すると新しい id を持つ新しいコピーが作られます（元のトゥームストーンは恒久的です。同期エンジン仕様 §7.2 を参照）。',
  'workbench.editors.rule.deleted.restore': '復元',
  'workbench.editors.rule.conditionsPane.title': '条件',
  'workbench.editors.rule.conditionsPane.infoSummary': '条件は、このルールがどのリクエストに適用されるかを決めます。',
  'workbench.editors.rule.conditionsPane.infoAndBefore': '行同士は',
  'workbench.editors.rule.conditionsPane.infoAndAfter': 'で結合されます。すべての行が一致する必要があります。',
  'workbench.editors.rule.conditionsPane.infoOrBefore': '1 つの行の中の値は',
  'workbench.editors.rule.conditionsPane.infoOrAfter':
    'で結合されます（OR バッジは複数の値を受け付ける行を示します）。',
  'workbench.editors.rule.conditionsPane.infoAddOne': '条件を少なくとも 1 つ追加してください。',

  // ── Condition-type registry (workbench picker vocabulary) ──────────
  // Deliberately per-surface: the popup's popup.conditions.* short/full
  // chip vocabulary is a different rendering context; only the concepts
  // overlap. Duplicated English across per-context keys is fine (S5).
  'workbench.editors.rule.condition.group.urlMatching': 'URL の一致',
  'workbench.editors.rule.condition.group.domainFiltering': 'ドメインのフィルター',
  'workbench.editors.rule.condition.group.requestFiltering': 'リクエストのフィルター',
  'workbench.editors.rule.condition.group.headerMatching': 'ヘッダーの一致',
  'workbench.editors.rule.condition.type.urlFilter': 'URL パターン',
  'workbench.editors.rule.condition.type.urlRegex': 'URL 正規表現',
  'workbench.editors.rule.condition.type.requestDomains': 'リクエストドメイン',
  'workbench.editors.rule.condition.type.excludeRequestDomains': '除外ドメイン',
  'workbench.editors.rule.condition.type.initiatorDomains': 'イニシエータードメイン',
  'workbench.editors.rule.condition.type.excludeInitiatorDomains': '除外イニシエーター',
  'workbench.editors.rule.condition.type.requestMethods': 'メソッド',
  'workbench.editors.rule.condition.type.excludeRequestMethods': '除外メソッド',
  'workbench.editors.rule.condition.type.resourceTypes': 'リソースの種類',
  'workbench.editors.rule.condition.type.excludeResourceTypes': '除外リソース',
  'workbench.editors.rule.condition.type.domainType': 'ドメインの種別',
  'workbench.editors.rule.condition.type.responseHeader': 'レスポンスヘッダー',
  'workbench.editors.rule.condition.type.excludeResponseHeader': '除外レスポンスヘッダー',
  'workbench.editors.rule.condition.suffix.notSupported': '：Chrome DNR 非対応',
  'workbench.editors.rule.condition.suffix.alreadyUsed': '：使用済み',
  'workbench.editors.rule.condition.firstParty': 'ファーストパーティ',
  'workbench.editors.rule.condition.thirdParty': 'サードパーティ',

  // ── ConditionEditor ────────────────────────────────────────────────
  'workbench.editors.rule.condition.empty': '条件がありません。ルールはどのリクエストにも一致しません',
  'workbench.editors.rule.condition.andTag': 'AND',
  'workbench.editors.rule.condition.andTooltip':
    '行同士は AND で結合されます。ルールが発火するにはすべての行が一致する必要があります。各行は別々の DNR フィールドを対象にするため、行をまたぐ AND は厳密です。1 つのフィールド内で複数の値を OR にするには、1 つの行の中に列挙してください（行の OR バッジを参照）。',
  'workbench.editors.rule.condition.notTag': 'NOT',
  'workbench.editors.rule.condition.notTooltip':
    'これは除外条件です。列挙した値のどれにも一致しない場合にのみルールが発火します。',
  'workbench.editors.rule.condition.orTag': 'OR',
  'workbench.editors.rule.condition.orTooltip':
    'この行の複数の値は、いずれかが一致すれば一致します（OR）。下の行とは AND で結合されます。',
  'workbench.editors.rule.condition.oneValueTag': '値 1 つ',
  'workbench.editors.rule.condition.oneValueTooltip':
    'この条件は単一の値を取ります。カンマ区切りは効果がありません。下の行とは AND で結合されます。',
  'workbench.editors.rule.condition.headerNamePlaceholder': 'ヘッダー名が次と等しい...',
  'workbench.editors.rule.condition.headerValuePlaceholder': 'ヘッダー値が次と等しい...',
  'workbench.editors.rule.condition.selectMethods': 'メソッドを選択',
  'workbench.editors.rule.condition.selectTypes': '種類を選択',
  'workbench.editors.rule.condition.selectType': '種類を選択',
  'workbench.editors.rule.condition.valuePlaceholder': '値',
  'workbench.editors.rule.condition.add': '条件を追加',

  // ── Condition issue banners (kind → key; core message stays for logs) ─
  'workbench.editors.rule.issue.duplicateSlot':
    '最後の {type} 行だけが適用されます。この行の値は Chrome に届きません。この行を削除するか、その値を優先される行へ移してください。',
  'workbench.editors.rule.issue.mutexConflict':
    '{type} と {winningType} は同じ DNR スロットを共有するため、最後のものだけが適用されます。どちらか 1 つを選んでください。',
  'workbench.editors.rule.issue.unsupportedByDnr':
    'この条件の種類はまだ Chrome DNR で対応していません。ルールは保存されますが、この行はワイヤーに何も送りません。',
  'workbench.editors.rule.issue.emptyUrlFilter': 'URL パターンを空にはできません。',
  'workbench.editors.rule.issue.emptyUrlRegex': 'URL 正規表現を空にはできません。',
  'workbench.editors.rule.issue.urlFilterWhitespace':
    'URL パターンに空白は使えません。Chrome は url-filter に空白を含むルールを拒否します。',
  'workbench.editors.rule.issue.urlFilterNonAscii':
    'URL パターンに非 ASCII 文字が含まれています。Chrome はこれを拒否します。IDN ホスト名には punycode（xn--…）を使ってください。',
  'workbench.editors.rule.issue.urlFilterRegexSyntax':
    '正規表現のように見えます。URL パターンでは `(`、`[`、`+`、`?`、`\\d` などの文字はそのまま一致します。正規表現の構文が必要なら URL 正規表現に切り替えてください。',
  'workbench.editors.rule.issue.regexLookbehind':
    'Chrome の正規表現エンジン（RE2）は後読み（(?<=…)、(?<!…)）に対応していません。ルールの読み込みに失敗する可能性があります。',
  'workbench.editors.rule.issue.regexNamedGroup':
    'Chrome の正規表現エンジン（RE2）は Python 形式の名前付きグループ（(?P<name>…)）に対応していません。ルールの読み込みに失敗する可能性があります。',
  'workbench.editors.rule.issue.invalidUrlRegex': '正規表現が無効です：{reason}',
  'workbench.editors.rule.issue.invalidMethod':
    '"{value}" は有効な HTTP メソッドではありません。使用可能：GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS、CONNECT、TRACE。',
  'workbench.editors.rule.issue.invalidResourceType':
    '"{value}" は有効なリソースの種類ではありません。ドロップダウンから選んでください。',
  'workbench.editors.rule.issue.invalidDomainType':
    '"{value}" は有効なドメインの種別ではありません。"firstParty" または "thirdParty" を使ってください。',
  'workbench.editors.rule.issue.headerNameRequired': 'ヘッダー名は必須です。',
  // Domain-list issues — one key per DomainIssueKind.
  'workbench.editors.rule.issue.domain.whitespace':
    '値の中に空白があります。ホスト名はカンマで区切ってください。requestDomains はエントリごとに裸のホスト名 1 つを取ります。',
  'workbench.editors.rule.issue.domain.scheme':
    'スキームを外してください。Chrome の requestDomains は URL ではなくホスト名だけを受け付けます。',
  'workbench.editors.rule.issue.domain.wildcard':
    "ワイルドカードを外してください。requestDomains は自動的にすべてのサブドメインに一致するため、'*.foo.com' は 'foo.com' と同じです。",
  'workbench.editors.rule.issue.domain.port':
    'ポートを外してください。requestDomains はホスト名だけで一致し、ルールは自動的にすべてのポートを対象にします。',
  'workbench.editors.rule.issue.domain.uppercase':
    'ホスト名を小文字にしてください。Chrome は requestDomains で小文字の ASCII だけを受け付けます。',
  'workbench.editors.rule.issue.domain.nonAscii':
    'ホスト名に Chrome が requestDomains で拒否する文字が含まれています（非 ASCII / IDN エントリの可能性）。punycode（xn--…）形式を使ってください。',
  'workbench.editors.rule.issue.domain.empty': 'ホスト名が空です。この行を削除してください。',
  'workbench.editors.rule.issue.domain.affected': ({ count }, locale) =>
    plural(locale, Number(count), { other: '影響を受けるエントリ {count} 件' }),
  'workbench.editors.rule.issue.domain.cleanUp': 'クリーンアップ',

  // ── Action issue banner (kind → key; header-plane kinds stay raw) ───
  'workbench.editors.rule.actionIssue.redirectWhitespace': 'リダイレクト先に空白は使えません。',
  'workbench.editors.rule.actionIssue.invalidRedirectUrl':
    'リダイレクト先は完全な URL（http://、https://、chrome-extension://）または / で始まるパスである必要があります。',
  'workbench.editors.rule.actionIssue.injectUrlScheme':
    'ソース URL は http://、https://、または chrome-extension:// を使う必要があります。',
  'workbench.editors.rule.actionIssue.injectUrlInvalid': 'ソース URL が有効な URL ではありません。',
  'workbench.editors.rule.actionIssue.invalidStatusCode': 'ステータスコードは 100-599 の整数である必要があります。',
  'workbench.editors.rule.actionIssue.invalidParamName': 'パラメーター名に `&`、`=`、`#`、`?`、空白は使えません。',
  'workbench.editors.rule.actionIssue.delayAboveNavigationCap':
    'メインフレームの遅延の上限は 30000ms です。それを超える値はワイヤー上で切り詰められます。',
  'workbench.editors.rule.actionIssue.delayAboveFetchCap':
    'XHR/fetch のモンキーパッチは HTTP 接続プールの枯渇を避けるため、遅延を 5000ms に制限します。メインフレームのリダイレクトは最大 30000ms まで尊重します。',
  'workbench.editors.rule.actionIssue.invalidContentType':
    'コンテンツタイプは "type/subtype" の形式である必要があります（例：application/json）。',
  'workbench.editors.rule.actionIssue.graphqlKeyRequired': 'GraphQL フィルターのキーは必須です。',
  'workbench.editors.rule.actionIssue.messageFilterValueRequired':
    'フィルターを設定する場合、メッセージフィルターの値は必須です。',
  'workbench.editors.rule.actionIssue.messageFilterInvalidRegex':
    'メッセージフィルターが有効な正規表現ではありません。',
  'workbench.editors.rule.actionIssue.injectTriggerRequiresFilter':
    '一致するメッセージの後に注入するには、メッセージフィルターが必要です。',

  // ── Resolution banner ──────────────────────────────────────────────
  'workbench.editors.rule.resolution.header': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'このルールに未解決の変数が {count} 件あります' }),
  'workbench.editors.rule.resolution.reason.unresolved': '未解決',
  'workbench.editors.rule.resolution.reason.unsetInScope': 'スコープ外',
  'workbench.editors.rule.resolution.reason.unknownNamespace': '不明な名前空間',
  'workbench.editors.rule.resolution.reason.stepOutOfContext': 'ステップ参照がスコープ外',
  'workbench.editors.rule.resolution.reason.empty': '空',
  'workbench.editors.rule.resolution.reason.invalidResolvedValue': '無効な値',
  'workbench.editors.rule.resolution.reason.secretAuthorizationRequired': '認可が必要',
  'workbench.editors.rule.resolution.reason.secretNotFound': 'シークレットが見つかりません',
  'workbench.editors.rule.resolution.reason.secretUnavailable': 'マネージャーが利用不可',
  'workbench.editors.rule.resolution.hint.noCacheForEnv':
    '環境「{envName}」のキャッシュされた実行がありません。ワークフローを開き、この環境で「更新」をクリックして値を用意してください',
  'workbench.editors.rule.resolution.hint.disabledLv': 'ライブ変数が無効です。ライブ変数エディターで有効にしてください',
  'workbench.editors.rule.resolution.hint.draftLv':
    'ライブ変数は下書きです。開いて「保存」をクリックして公開してください',
  'workbench.editors.rule.resolution.noEnvironment': '環境なし',
  'workbench.editors.rule.resolution.activeEnvFallback': 'アクティブな環境',

  // ── Rule fields — cross-type vocabulary ────────────────────────────
  'workbench.editors.rule.fields.actionsTitle': 'アクション',
  'workbench.editors.rule.fields.addAction': 'アクションを追加',
  'workbench.editors.rule.fields.reset': 'リセット',
  'workbench.editors.rule.fields.optionalTag': '（省略可）',
  'workbench.editors.rule.fields.opAddReplace': '追加 / 上書き',
  'workbench.editors.rule.fields.opAppend': '追記',
  'workbench.editors.rule.fields.opRemove': '削除',
  'workbench.editors.rule.fields.opMerge': 'マージ',
  'workbench.editors.rule.fields.opReplaceOnly': '上書きのみ',
  'workbench.editors.rule.fields.opRemoveAll': 'すべて削除',
  'workbench.editors.rule.fields.operatorEquals': '等しい',
  'workbench.editors.rule.fields.operatorContains': '含む',
  'workbench.editors.rule.fields.restApi': 'REST API',
  'workbench.editors.rule.fields.graphqlApi': 'GraphQL API',
  'workbench.editors.rule.fields.staticData': '静的データ',
  'workbench.editors.rule.fields.dynamicJs': '動的（JavaScript）',
  'workbench.editors.rule.fields.formatAwareBody.formatted': '整形済み',
  'workbench.editors.rule.fields.formatAwareBody.raw': 'Raw',
  'workbench.editors.rule.fields.formatAwareBody.unavailableTooltip':
    '整形済みビューは JSON 形式のボディでのみ利用できます。',
  'workbench.editors.rule.fields.formatAwareBody.infoTitle': '整形済みビュー',
  'workbench.editors.rule.fields.formatAwareBody.infoKicker': 'ボディ',
  'workbench.editors.rule.fields.formatAwareBody.infoSummary':
    '整形済みと Raw は同じボディテキストの 2 つのビューです。ルールが提供するのはワイヤーテキストです。',
  'workbench.editors.rule.fields.formatAwareBody.infoExampleCaption': '例：1 つの値、2 つのビュー',
  'workbench.editors.rule.fields.formatAwareBody.infoModesHeading': 'モード',
  'workbench.editors.rule.fields.formatAwareBody.infoFormattedDesc':
    '読みやすさのためのビューで、違いは空白だけです。編集は元のワイヤー形式に再エンコードされ、保存はそのワイヤーテキストを書き込みます。編集なしの保存は元のバイト列をそのまま書き込みます。',
  'workbench.editors.rule.fields.formatAwareBody.infoRawDesc':
    'ワイヤーテキストそのものです。ルールが提供する内容そのままです。',
  'workbench.editors.rule.fields.graphqlFilterLabel': 'GraphQL 操作（リクエストペイロードのフィルター）',
  'workbench.editors.rule.fields.graphqlKeyPlaceholder': 'キー（例：operationName）',
  'workbench.editors.rule.fields.graphqlValuePlaceholder': '値（例：getUsers）',

  // ── Header rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.header.kicker': 'ヘッダールール',
  'workbench.editors.rule.fields.header.infoSummary':
    '一致するトラフィックのリクエストヘッダーとレスポンスヘッダーを書き換えます。',
  'workbench.editors.rule.fields.header.infoDescription':
    '無効な組み合わせ（例：カスタムヘッダーへの追記）はルールを下書きにします。下書きは保存されますが実行されません。',
  'workbench.editors.rule.fields.header.requestTab': 'リクエストヘッダー',
  'workbench.editors.rule.fields.header.requestTabSummary':
    'ブラウザーを出る前の送信リクエストに適用されるヘッダーアクションです。',
  'workbench.editors.rule.fields.header.responseTab': 'レスポンスヘッダー',
  'workbench.editors.rule.fields.header.responseTabSummary':
    'ページが見る前のレスポンスに適用されるヘッダーアクションです。',
  'workbench.editors.rule.fields.header.responseTabDescription':
    'ブラウザー自身の DevTools の Network タブは常にサーバーの元のヘッダーを表示するため、これらの変更は適用されていてもそこには見えません。Open Headers の DevTools ウィンドウにはその制限がなく、ページに提供されたとおりのヘッダーを表示します。',
  'workbench.editors.rule.fields.header.emptyRequest':
    'アクションがありません。このルールはリクエストヘッダーを変更しません',
  'workbench.editors.rule.fields.header.emptyResponse':
    'アクションがありません。このルールはレスポンスヘッダーを変更しません',
  'workbench.editors.rule.fields.header.namePlaceholder': 'ヘッダー名',
  'workbench.editors.rule.fields.header.valuePlaceholder': 'ヘッダー値',
  'workbench.editors.rule.fields.header.appendValuePlaceholder': '追記する値',
  'workbench.editors.rule.fields.header.existingValue': '既存の値',
  'workbench.editors.rule.fields.header.switchTo': '{operation} に切り替え',
  'workbench.editors.rule.fields.header.dragToReorder': 'ドラッグして並べ替え',

  // ── Block rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.block.kicker': 'ブロックルール',
  'workbench.editors.rule.fields.block.infoSummary':
    'ブロックは、一致するリクエストをブラウザーを出る前にキャンセルします。',
  'workbench.editors.rule.fields.block.infoDescription':
    'アクションの設定は不要です。ブロックそのものがアクションで、条件が何をブロックするかを決めます。',
  'workbench.editors.rule.fields.block.title': 'リクエストをブロック',
  'workbench.editors.rule.fields.block.body':
    '下の条件に一致するリクエストはブロックされます。ブラウザーはページにネットワークエラーを表示します。',

  // ── Redirect rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.redirect.kicker': 'リダイレクトルール',
  'workbench.editors.rule.fields.redirect.infoSummary':
    '一致するリクエストを、ネットワークに到達する前に別の URL へ送ります。',
  'workbench.editors.rule.fields.redirect.infoDescription':
    'URL 正規表現の条件と組み合わせると、\\1、\\2 … がキャプチャグループをリダイレクト先 URL に代入します。',
  'workbench.editors.rule.fields.redirect.redirectsTo': 'リダイレクト先',
  'workbench.editors.rule.fields.redirect.anotherUrl': '別の URL',
  'workbench.editors.rule.fields.redirect.localFile': 'ローカルファイル',
  'workbench.editors.rule.fields.redirect.desktopOnly': 'デスクトップアプリで利用可能',
  'workbench.editors.rule.fields.redirect.targetPlaceholder':
    '例：https://openheaders.com/redirected。URL 正規表現の条件では \\1、\\2 を使えます',

  // ── Query-param rule fields ────────────────────────────────────────
  'workbench.editors.rule.fields.queryParam.kicker': 'クエリパラメータールール',
  'workbench.editors.rule.fields.queryParam.infoSummary':
    '一致するリクエスト URL のクエリパラメーターを追加、上書き、または削除します。',
  'workbench.editors.rule.fields.queryParam.infoDescription':
    '「すべて削除」はクエリ文字列全体を取り除きます。同じルール内の「追加 / 上書き」のエントリが新しいクエリになります。「上書きのみ」と「削除」のエントリは対象が残らないため、「すべて削除」と併用すると無視されます。',
  'workbench.editors.rule.fields.queryParam.removeAllWarning':
    '「すべて削除」はクエリ文字列全体を取り除くため、「上書きのみ」と「削除」のエントリは対象がなくなり無視されます。「追加 / 上書き」のエントリは引き続き適用され、新しいクエリになります。',
  'workbench.editors.rule.fields.queryParam.removesAllNote': 'URL からすべてのクエリパラメーターを削除します',
  'workbench.editors.rule.fields.queryParam.namePlaceholder': 'パラメーター名',
  'workbench.editors.rule.fields.queryParam.valuePlaceholder': 'パラメーター値',

  // ── Inject rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.inject.kicker': '注入ルール',
  'workbench.editors.rule.fields.inject.infoSummary':
    '一致するページの読み込み時に、スクリプトまたはスタイルシートを注入します。',
  'workbench.editors.rule.fields.inject.language': '言語：',
  'workbench.editors.rule.fields.inject.codeSource': 'コードのソース：',
  'workbench.editors.rule.fields.inject.insert': '挿入：',
  'workbench.editors.rule.fields.inject.sourceCode': 'コード',
  'workbench.editors.rule.fields.inject.sourceUrl': 'URL',
  'workbench.editors.rule.fields.inject.afterPageLoad': 'ページ読み込み後',
  'workbench.editors.rule.fields.inject.asSoonAsPossible': 'できるだけ早く',
  'workbench.editors.rule.fields.inject.source': 'ソース',
  'workbench.editors.rule.fields.inject.code': 'コード',
  'workbench.editors.rule.fields.inject.sourceUrlPlaceholder': 'ソース URL を入力（相対または絶対）',
  'workbench.editors.rule.fields.inject.bypassCsp':
    'Content-Security-Policy をバイパスして、注入したスクリプトを常に実行する',
  'workbench.editors.rule.fields.inject.cspBypassHint':
    '現時点ではヘッダーの CSP のみが対象です。<meta> の CSP はこのスクリプトをブロックする可能性があります。両方をバイパスするには、ブラウザーの拡張機能設定でこの拡張機能の “Allow user scripts” を有効にしてください。',

  // ── Delay rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.delay.kicker': '遅延ルール',
  'workbench.editors.rule.fields.delay.infoSummary': '一致するリクエストを設定した時間だけ保留してから先へ進めます。',
  'workbench.editors.rule.fields.delay.capsAlert':
    'ドキュメントと iframe のナビゲーションは、ローカルの待機ページを介して最大 30,000ms まで遅延します。JS 起点の XHR/Fetch は HTTP 接続プールの枯渇を避けるため 5,000ms が上限です。サブリソース（CSS、JS、画像）は遅延しません。',
  'workbench.editors.rule.fields.delay.label': '遅延',
  'workbench.editors.rule.fields.delay.maxNote': '最大 30,000 ms',

  // ── Request-body rule fields ───────────────────────────────────────
  'workbench.editors.rule.fields.requestBody.kicker': 'リクエストボディルール',
  'workbench.editors.rule.fields.requestBody.infoSummary': '一致するリクエストのボディを送信前に置き換えます。',
  'workbench.editors.rule.fields.requestBody.infoDescription':
    '静的データは固定のペイロードに差し替えます。動的は元のボディに対して JavaScript を実行します。',
  'workbench.editors.rule.fields.requestBody.interceptsAlert':
    'REST または GraphQL API リクエストの fetch() と XMLHttpRequest の呼び出しを傍受します。',
  'workbench.editors.rule.fields.requestBody.selectResourceType': 'リソースの種類を選択',
  'workbench.editors.rule.fields.requestBody.bodyLabel': 'リクエストボディ',
  'workbench.editors.rule.fields.requestBody.dynamicHintBefore': '関数は',
  'workbench.editors.rule.fields.requestBody.dynamicHintAfter':
    'を受け取り、変更後のボディを返します。文字列またはオブジェクト（自動的に JSON にシリアライズ）を返してください。',

  // ── Response rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.response.kicker': 'レスポンスルール',
  'workbench.editors.rule.fields.response.infoSummary':
    '一致するリクエストに対して、サーバーが返した内容の代わりに代替のレスポンスを提供します。',
  'workbench.editors.rule.fields.response.infoDescription':
    '静的データは固定のペイロードを提供します。動的は元のレスポンスに対して JavaScript を実行します。',
  'workbench.editors.rule.fields.response.sourceLabel': 'レスポンスのソース',
  'workbench.editors.rule.fields.response.sourceInfoSummary':
    'REST または GraphQL API リクエストの fetch() と XMLHttpRequest のレスポンスに作用します。',
  'workbench.editors.rule.fields.response.sourceInfoDescription':
    'Mock はサーバーを呼ばずにあなたのボディを提供します。変更は実際のリクエストを送り、ページが見る前に応答を編集します。',
  'workbench.editors.rule.fields.response.sourceMock': '⚡ Mock：リクエストを送信しない',
  'workbench.editors.rule.fields.response.sourceNetwork': '🌐 変更：サーバーの応答を編集',
  'workbench.editors.rule.fields.response.sourceNoteNetwork':
    '実際のリクエストが送信され、ページが見る前に応答へあなたの変更が適用されます。',
  'workbench.editors.rule.fields.response.sourceNoteMock':
    'リクエストはブラウザーから出ません。ページはあなたのレスポンスを直接受け取ります。',
  'workbench.editors.rule.fields.response.resourceType': 'リソースの種類',
  'workbench.editors.rule.fields.response.resourceTypeInfoSummary':
    'ルールが対象にする API ペイロードの形です。REST または GraphQL。',
  'workbench.editors.rule.fields.response.resourceTypeInfoDescription':
    'GraphQL を選ぶと下に操作フィルターが現れ、共有エンドポイント内の単一の操作にルールを一致させられます。',
  'workbench.editors.rule.fields.response.statusCode': 'ステータスコード',
  'workbench.editors.rule.fields.response.statusCodeInfoSummary': 'レスポンスとともに提供される HTTP ステータスです。',
  'workbench.editors.rule.fields.response.statusCodeInfoDescription':
    '提供するコードを選ぶか、サーバーを呼ぶ場合はサーバーの応答の元のコードを保持します。',
  'workbench.editors.rule.fields.response.keepOriginalStatus': '元のステータスコードを保持',
  'workbench.editors.rule.fields.response.contentType': 'Content-Type',
  'workbench.editors.rule.fields.response.contentTypeInfoSummary':
    'ボディとともに提供される Content-Type ヘッダーです。ブラウザーの解析方法を制御します。',
  'workbench.editors.rule.fields.response.contentTypeInfoDescription':
    '任意の値を入力できます。候補は便宜上のものです。サーバーを呼ぶ場合、設定したときにのみ実際の応答の Content-Type を上書きします。',
  'workbench.editors.rule.fields.response.headersLabel': 'レスポンスヘッダー',
  'workbench.editors.rule.fields.response.headersInfoSummary': 'Content-Type に加えて提供される追加のヘッダーです。',
  'workbench.editors.rule.fields.response.headersInfoDescription':
    'サーバーを呼ぶ場合は実際の応答のヘッダーの上にマージされ、Mock の場合は応答のヘッダーそのものになります。空の行は保存時に取り除かれます。',
  'workbench.editors.rule.fields.response.headerNamePlaceholder': 'ヘッダー名（例：X-Custom）',
  'workbench.editors.rule.fields.response.headerValuePlaceholder': 'ヘッダー値',
  'workbench.editors.rule.fields.response.addHeader': 'ヘッダーを追加',
  'workbench.editors.rule.fields.response.bodyLabel': 'レスポンスボディ',
  'workbench.editors.rule.fields.response.bodyInfoSummary':
    '一致するリクエストに対してページへ提供されるペイロードです。',
  'workbench.editors.rule.fields.response.bodyInfoDescription':
    '静的データは固定のボディを提供します。動的（JavaScript）はリクエスト時に組み立てまたは変換します。',
  'workbench.editors.rule.fields.response.dynNetworkBefore': '実際のリクエストが先に送られます。',
  'workbench.editors.rule.fields.response.dynNetworkAfter':
    '関数はレスポンスとリクエストのコンテキストを受け取り、変更後のレスポンスを返します。文字列またはオブジェクト（自動的に JSON にシリアライズ）を返してください。',
  'workbench.editors.rule.fields.response.dynMockBefore': 'リクエストは送信されません。',
  'workbench.editors.rule.fields.response.dynMockMid': '関数は',
  'workbench.editors.rule.fields.response.dynMockAfter':
    'を受け取り、レスポンスボディを返します。文字列またはオブジェクト（自動的に JSON にシリアライズ）を返してください。',

  // ── WS / SSE rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.message.wsKicker': 'WebSocket ルール',
  'workbench.editors.rule.fields.message.sseKicker': 'SSE ルール',
  'workbench.editors.rule.fields.message.wsInfoSummary':
    '一致する接続の WebSocket フレームを、ページやワイヤーが見る前に変更、注入、または破棄します。',
  'workbench.editors.rule.fields.message.sseInfoSummary':
    '一致するストリームの server-sent events を、リスナーが見る前に変更、注入、または破棄します。',
  'workbench.editors.rule.fields.message.wsIntro':
    'ソケット URL が条件に一致する、ページが作成した WebSocket 接続を傍受します。フレームは、ページのコード（受信）またはワイヤー（送信）に届く前にページ内で変更、注入、または破棄されます。',
  'workbench.editors.rule.fields.message.sseIntro':
    'URL が条件に一致する、ページが作成した EventSource ストリームを傍受します。イベントは、リスナーが見る前にページ内で変更、注入、または破棄されます。',
  'workbench.editors.rule.fields.message.operation': '操作',
  'workbench.editors.rule.fields.message.opReplace': '置き換え',
  'workbench.editors.rule.fields.message.opInject': '注入',
  'workbench.editors.rule.fields.message.opDrop': '破棄',
  'workbench.editors.rule.fields.message.direction': '方向',
  'workbench.editors.rule.fields.message.incoming': '受信（サーバー → ページ）',
  'workbench.editors.rule.fields.message.outgoing': '送信（ページ → サーバー）',
  'workbench.editors.rule.fields.message.eventName': 'イベント名',
  'workbench.editors.rule.fields.message.eventNamePlaceholder': '空 = デフォルトの message イベント',
  'workbench.editors.rule.fields.message.eventFieldNoteBefore': 'ストリームの',
  'workbench.editors.rule.fields.message.eventFieldNoteAfter': 'フィールドに一致します',
  'workbench.editors.rule.fields.message.frameFilter': 'フレームフィルター',
  'workbench.editors.rule.fields.message.dataFilter': 'データフィルター',
  'workbench.editors.rule.fields.message.everyFrame': 'すべてのフレーム',
  'workbench.editors.rule.fields.message.everyEvent': 'すべてのイベント',
  'workbench.editors.rule.fields.message.filterRegex': 'Regex',
  'workbench.editors.rule.fields.message.filterNoteWs':
    'フィルターはテキストフレームにのみ一致します。フィルターが設定されている場合、バイナリフレームは通過します。',
  'workbench.editors.rule.fields.message.filterNoteSse': 'フィルターはテキストイベントにのみ一致します。',
  'workbench.editors.rule.fields.message.injectWhen': '注入のタイミング',
  'workbench.editors.rule.fields.message.connectionOpens': '接続が開いたとき',
  'workbench.editors.rule.fields.message.streamOpens': 'ストリームが開いたとき',
  'workbench.editors.rule.fields.message.matchingFrameArrives': '一致するフレームが届いたとき',
  'workbench.editors.rule.fields.message.matchingEventArrives': '一致するイベントが届いたとき',
  'workbench.editors.rule.fields.message.injectedFrame': '注入するフレーム',
  'workbench.editors.rule.fields.message.injectedEvent': '注入するイベント',
  'workbench.editors.rule.fields.message.replacementFrame': '置き換えるフレーム',
  'workbench.editors.rule.fields.message.replacementEvent': '置き換えるイベント',

  // ── Auth rule fields ───────────────────────────────────────────────
  'workbench.editors.rule.fields.auth.kicker': '認証ルール',
  'workbench.editors.rule.fields.auth.infoSummary':
    '一致するリクエストでの HTTP またはプロキシの認証チャレンジに、これらの資格情報で応答します。',
  'workbench.editors.rule.fields.auth.infoDescription':
    '両方のフィールドは {{templates}} を解決するため、本物のシークレットをルール上の平文ではなく vault（{{vault.*}}）に置けます。デバッグモードのスコープ内のタブでのみ有効です。',
  'workbench.editors.rule.fields.auth.introBefore':
    '一致するリクエストでのサーバー（401）またはプロキシ（407）の認証チャレンジに応答します。資格情報をルールに保存しないよう、vault のシークレットを参照してください。例：',
  'workbench.editors.rule.fields.auth.introAfter': '。',
  'workbench.editors.rule.fields.auth.username': 'ユーザー名',
  // Placeholder examples carry the `{{ns.NAME}}` reference syntax raw
  // inside the keyed value (args-less t() skips interpolation).
  'workbench.editors.rule.fields.auth.usernamePlaceholder': '例：dev-user または {{env.PROXY_USER}}',
  'workbench.editors.rule.fields.auth.password': 'パスワード',
  'workbench.editors.rule.fields.auth.passwordPlaceholder': '例：{{vault.STAGING_PW}}',
} as const satisfies Catalog;
