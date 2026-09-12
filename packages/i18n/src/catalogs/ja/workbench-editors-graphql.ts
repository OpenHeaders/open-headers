/**
 * Workbench editors — the GraphQL client editor, Japanese. Mirrors
 * `catalogs/en/workbench-editors-graphql.ts` key for key. Wire
 * vocabulary (GraphQL, the `{query, variables, operationName}`
 * envelope names, SDL, introspection, `Query` / `Subscription` tab
 * and pane nouns, `extensions`) rides raw inside keyed values.
 * スキーマ = schema; エクスプローラー = explorer; 変数 = variables;
 * イントロスペクション = introspection; サブスクリプション =
 * subscription; ドキュメント = the GraphQL document (S19 separate
 * referent beside Docs = the raw tab noun); ビルダー = builder;
 * フラグメント = fragment.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGraphql = {
  // ── GraphQL request editor ──────────────────────────────────────────
  'workbench.editors.graphql.notFound': 'GraphQL リクエストが見つかりません。',
  'workbench.editors.graphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.graphql.query.label': 'Query',
  'workbench.editors.graphql.query.stop': '停止',
  'workbench.editors.graphql.query.stopTooltip': 'クエリを停止し、届いた分を保持します',
  'workbench.editors.graphql.operation.placeholder': '操作',
  'workbench.editors.graphql.operation.tooltip':
    'この Query が実行する操作です。ドキュメントには複数の操作があり、選んだものが operationName としてワイヤーに乗ります。',
  'workbench.editors.graphql.response.errors': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のエラー' }),
  'workbench.editors.graphql.response.errorsTitle': 'GraphQL エラー',
  'workbench.editors.graphql.response.errorsSummary':
    'サーバーは HTTP {status} と errors[] の一覧で応答しました。フィールドが失敗したか、ドキュメントが拒否されたか、認証が欠けていました。隣の data を読んでください。部分的か、null です。',
  'workbench.editors.graphql.response.dataNull':
    'data が null です。すべてのルートフィールドでエラーが伝播したか、実行前にリクエストが拒否されました。',
  'workbench.editors.graphql.response.extensions': 'extensions',
  'workbench.editors.graphql.response.extensionsTitle': 'レスポンスの extensions',
  'workbench.editors.graphql.response.extensionsSummary':
    'サーバーの extensions オブジェクトは data の隣に乗ります。トレース、コスト、キャッシュのヒントなど、サーバーが付けることにしたものです。',
  'workbench.editors.graphql.query.placeholder': 'query { viewer { id } }',
  'workbench.editors.graphql.tab.docs': 'Docs',
  'workbench.editors.graphql.tab.query': 'Query',
  'workbench.editors.graphql.tab.authorization': '認可',
  'workbench.editors.graphql.tab.headers': 'ヘッダー',
  'workbench.editors.graphql.tab.schema': 'スキーマ',
  'workbench.editors.graphql.tab.scripts': 'スクリプト',
  'workbench.editors.graphql.tab.settings': '設定',
  'workbench.editors.graphql.explorer.emptyTitle': 'サーバーから利用できるデータを探索',
  'workbench.editors.graphql.explorer.emptyHint':
    'サーバー URL を入力すると、イントロスペクションでスキーマを読み込みます。',
  'workbench.editors.graphql.explorer.introspect': 'GraphQL イントロスペクションを使う',
  'workbench.editors.graphql.explorer.loadFailed': 'GraphQL スキーマを読み込めませんでした。',
  'workbench.editors.graphql.explorer.tryAgain': '再試行',
  'workbench.editors.graphql.explorer.useSpec': 'GraphQL 仕様を使う',
  'workbench.editors.graphql.explorer.importSchema': 'GraphQL スキーマをインポート',
  'workbench.editors.graphql.variables.title': '変数',
  'workbench.editors.graphql.variables.generate': '変数を生成',
  'workbench.editors.graphql.variables.generateHint': '選択した操作の変数定義から変数を埋めます。',
  'workbench.editors.graphql.variables.generateNeedsOperation': '選択した操作は変数を宣言していません。',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'すべての GraphQL 操作は {query, variables, operationName} のエンベロープを JSON として POST します。上書きするには独自の Content-Type 行を追加してください。',
  'workbench.editors.graphql.schema.sourceLabel': 'スキーマのソース',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'スキーマのソースを選択',
  'workbench.editors.graphql.schema.or': 'または',
  'workbench.editors.graphql.schema.hint':
    'スキーマはエクスプローラー、補完、検証を支えます。このリクエストの認証と設定を通してサーバーからイントロスペクションするか、GraphQL 仕様からリンクするか、SDL またはイントロスペクションのファイルからインポートします。',
  'workbench.editors.graphql.scripts.beforeQuery': 'クエリの前',
  'workbench.editors.graphql.scripts.afterResponse': 'レスポンスの後',
  'workbench.editors.graphql.toast.deletedOtherTab': 'この GraphQL リクエストは別のタブで削除されました。',
  'workbench.editors.graphql.toast.updateFailed': 'GraphQL リクエストの保存に失敗しました',
  'workbench.editors.graphql.toast.updateFailedDetail': 'GraphQL リクエストの保存に失敗しました：{message}',
  'workbench.editors.graphql.explorer.needsUrl': 'まずエンドポイントの URL を入力してください。',
  'workbench.editors.graphql.explorer.introspecting': 'イントロスペクション中…',
  'workbench.editors.graphql.explorer.search': '型とフィールドを検索',
  'workbench.editors.graphql.explorer.noResults': '「{term}」に一致するものはありません。',
  'workbench.editors.graphql.explorer.back': '戻る',
  'workbench.editors.graphql.explorer.fields': 'フィールド',
  'workbench.editors.graphql.explorer.arguments': '引数',
  'workbench.editors.graphql.explorer.values': '値',
  'workbench.editors.graphql.explorer.inputFields': '入力フィールド',
  'workbench.editors.graphql.explorer.implements': '実装',
  'workbench.editors.graphql.explorer.possibleTypes': '取りうる型',
  'workbench.editors.graphql.explorer.returns': '戻り値',
  'workbench.editors.graphql.explorer.specifiedBy': '仕様',
  'workbench.editors.graphql.explorer.deprecated': '非推奨：{reason}',
  'workbench.editors.graphql.explorer.insert': 'カーソル位置に挿入',
  'workbench.editors.graphql.explorer.insertHint':
    'フィールドをカーソル位置でドキュメントに追加します。必須の引数は変数として、オブジェクトを返す場合は空の選択セットとして追加します。一方向で、ドキュメントはあなたのものです。',
  'workbench.editors.graphql.schema.source.introspection': 'GraphQL イントロスペクション',
  'workbench.editors.graphql.schema.source.spec': 'リンクされた GraphQL 仕様',
  'workbench.editors.graphql.schema.refresh': '更新',
  'workbench.editors.graphql.schema.fetchedAt': '{when} にイントロスペクション',
  'workbench.editors.graphql.schema.notIntrospected':
    'まだイントロスペクションしていません。スキーマは、このリクエストの認証、ヘッダー、設定を通してエンドポイントから読み込まれます。',
  'workbench.editors.graphql.schema.introspectFailed': 'イントロスペクションに失敗しました：{message}',
  'workbench.editors.graphql.schema.noSpecLinked': 'GraphQL 仕様がリンクされていません。',
  'workbench.editors.graphql.schema.linkInSpecTab': '仕様タブでリンク',
  'workbench.editors.graphql.schema.changeInSpecTab': '仕様タブで変更',
  'workbench.editors.graphql.schema.specMissing': 'リンクされた仕様はこのワークスペースにもう存在しません。',
  'workbench.editors.graphql.schema.summaryTypes': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個の型' }),
  'workbench.editors.graphql.schema.problems': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のスキーマの問題' }),
  'workbench.editors.graphql.schema.importReadFailed': 'ファイルの読み取りに失敗しました：{message}',
  'workbench.editors.graphql.schema.importFailed': 'スキーマのインポートに失敗しました',
  'workbench.editors.graphql.schema.imported': '「{name}」を GraphQL 仕様としてインポートし、リンクしました。',
  'workbench.editors.graphql.spec.selectLabel': 'GraphQL 仕様',
  'workbench.editors.graphql.spec.selectPlaceholder': 'GraphQL 仕様をリンク…',
  'workbench.editors.graphql.spec.none': 'このリクエストに GraphQL 仕様はリンクされていません。',
  'workbench.editors.graphql.spec.hint':
    'リンクされた仕様はこのリクエストのスキーマのソースです。エクスプローラー、補完、検証がそれを読みます。仕様から生成されたコレクションの中では、リクエストが自身のリンクを持つまでコレクションのリンクを読みます。',
  'workbench.editors.graphql.explorer.title': 'スキーマエクスプローラー',
  'workbench.editors.graphql.explorer.hide': 'エクスプローラーを非表示',
  'workbench.editors.graphql.explorer.show': 'エクスプローラーを表示',
  'workbench.editors.graphql.explorer.showDescriptions': '説明を表示',
  'workbench.editors.graphql.explorer.hideDescriptions': '説明を非表示',
  'workbench.editors.graphql.builder.broken': 'ビルダーを使うにはドキュメントを修正してください。解析できません。',
  'workbench.editors.graphql.builder.expand': '展開',
  'workbench.editors.graphql.builder.collapse': '折りたたむ',
  'workbench.editors.graphql.builder.fragmentReadOnly':
    'ここではフラグメントは読み取り専用です。ドキュメントで編集してください。',
  'workbench.editors.graphql.builder.argumentPlaceholder': '値または $variable',
  'workbench.editors.graphql.builder.invalidValue': 'GraphQL の値ではありません。',
  'workbench.editors.graphql.variables.problems': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の問題' }),
  // ── Subscriptions (graphql-transport-ws over the WebSocket plane) ──
  'workbench.editors.graphql.subscription.tooltip':
    'サブスクライブ：WebSocket（graphql-transport-ws）でサブスクリプションを開き、そのイベントをストリーミングします',
  'workbench.editors.graphql.subscription.stopTooltip':
    'サブスクリプションを停止：complete を送ってセッションを閉じます',
  'workbench.editors.graphql.subscription.browserHost':
    'サブスクリプションはデスクトップアプリまたは拡張機能で実行されます。',
  'workbench.editors.graphql.subscription.openFailed': 'サブスクリプションを開けませんでした',
  'workbench.editors.graphql.subscription.paneTitle': 'Subscription',
  'workbench.editors.graphql.subscription.subscribing': 'サブスクライブ中…',
  'workbench.editors.graphql.subscription.subscribed': 'サブスクライブ済み',
  'workbench.editors.graphql.subscription.completed': '完了',
  'workbench.editors.graphql.subscription.stopped': '停止',
  'workbench.editors.graphql.subscription.errored': 'エラー',
  'workbench.editors.graphql.subscription.closed': 'クローズ {code}',
  'workbench.editors.graphql.subscription.events': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のイベント' }),
  'workbench.editors.graphql.subscription.errorsSummary':
    'サブスクリプションは errors[] の一覧で応答しました。イベント内でフィールドが失敗したか、開始前に操作が拒否されました。',
  'workbench.editors.graphql.subscription.close.badRequest': '不正なリクエスト',
  'workbench.editors.graphql.subscription.close.unauthorized': '認証されていません',
  'workbench.editors.graphql.subscription.close.forbidden': '禁止されています',
  'workbench.editors.graphql.subscription.close.subprotocolNotAcceptable': 'サブプロトコルを受け入れられません',
  'workbench.editors.graphql.subscription.close.connectionInitTimeout': '接続初期化のタイムアウト',
  'workbench.editors.graphql.subscription.close.subscriberAlreadyExists': 'サブスクライバーは既に存在します',
  'workbench.editors.graphql.subscription.close.tooManyInitRequests': '初期化リクエストが多すぎます',
} as const satisfies Catalog;
