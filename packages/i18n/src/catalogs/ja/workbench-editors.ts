/**
 * Workbench editors — shared editor chrome — Japanese. Mirrors
 * `catalogs/en/workbench-editors.ts` key for key. Raw by design:
 * snippet code bodies and `oh.*` API names (never keyed), the {column}
 * / {header} / {key} / {name} / {language} / {message} holes,
 * `Tests` group label raw per the de/es parity lock, lowercase en
 * `vault` raw lowercase (per-case token law), JSON / URL / HTTP raw.
 * スクリプト = script; スニペット = snippet; パッケージ /
 * パッケージライブラリ per script-packages; package-flow strings shared
 * with `workbench-script-packages.ts` (duplicate name, not-found,
 * save failed, empty states) reuse its ja sentences verbatim. 認可 =
 * Authorization; シークレット = secret (shipped mints). MINTS: 継承 =
 * the Inherit option label — `workbench-editors-request.ts` MUST
 * reuse it; 一括 = Bulk; キーと値 = Key-Value; 整形 = Format (panel
 * mint); リクエストの下書き = request draft (下書き carried from the
 * Draft mint); ボディ = the bare `Body` tab noun (prose keeps
 * リクエストボディ / レスポンスボディ per the shipped mints).
 */

import type { Catalog } from '../../types';

export const workbenchEditors = {
  'workbench.editors.sectionInfo.moreInformation': '詳細情報',

  // ── Session chrome (shared: WS/MQTT session panes) ─────────────────
  'workbench.editors.session.connectionDetails': '接続の詳細',
  'workbench.editors.session.subprotocol': 'サブプロトコル',
  'workbench.editors.session.extensions': '拡張',
  'workbench.editors.session.closeCode': 'クローズコード',

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': 'キー',
  'workbench.editors.grid.value': '値',
  'workbench.editors.grid.description': '説明',
  'workbench.editors.grid.showColumns': '列を表示',
  'workbench.editors.grid.tableOptions': 'テーブルのオプション',
  'workbench.editors.grid.bulk': '一括',
  'workbench.editors.grid.keyValue': 'キーと値',
  'workbench.editors.grid.selectAllAria': 'すべての行を有効化または無効化',
  'workbench.editors.grid.selectAllTitle': 'すべて有効化 / 無効化',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': '{column} 列のサイズを変更',
  'workbench.editors.grid.overriddenBy': '重複しています。追加した {header} 行によって上書きされます。',
  'workbench.editors.grid.suggestionValueAria': '{key} の値',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.notFoundCollection': 'リクエストコレクションが見つかりません。',
  'workbench.editors.ancestorScripts.notFoundFolder': 'フォルダーが見つかりません。',
  'workbench.editors.ancestorScripts.saveFailed': 'スクリプトを保存できませんでした。',
  'workbench.editors.ancestorScripts.saveFailedDetail': 'スクリプトを保存できませんでした：{message}',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.notFoundCollection': 'リクエストコレクションが見つかりません。',
  'workbench.editors.ancestorAuth.notFoundFolder': 'フォルダーが見つかりません。',
  'workbench.editors.ancestorAuth.saveFailed': '認可を保存できませんでした。',
  'workbench.editors.ancestorAuth.saveFailedDetail': '認可を保存できませんでした：{message}',

  // ── Ancestor settings (collection/folder inheritable settings) ─────
  'workbench.editors.ancestorSettings.saveFailed': '設定を保存できませんでした。',
  'workbench.editors.ancestorSettings.saveFailedDetail': '設定を保存できませんでした：{message}',

  // ── Request container editor (a collection / folder: one tab, sections) ──
  'workbench.editors.requestContainer.tab.overview': '概要',
  'workbench.editors.requestContainer.auth.emptyTitle': '認証が設定されていません',
  'workbench.editors.requestContainer.auth.emptySubtitleCollection':
    'このコレクション内のリクエストに使う認可の種類を選択してください',
  'workbench.editors.requestContainer.auth.emptySubtitleFolder':
    'このフォルダー内のリクエストに使う認可の種類を選択してください',
  'workbench.editors.requestContainer.auth.authTypes': '認証の種類',
  'workbench.editors.requestContainer.auth.authTypesInfo':
    'コンテナーのプールです。リクエストが必要とするスキームごとに 1 エントリ。「継承」に設定されたリクエストはデフォルトを使い、ホストパターンは一致するリクエストを別のエントリに振り分け、リクエストは名前で 1 つを選ぶこともできます。',
  'workbench.editors.requestContainer.auth.authTypesInfoHeading': '種類',
  'workbench.editors.requestContainer.auth.addEntryAria': '認証の種類を追加',
  'workbench.editors.requestContainer.auth.inheritedTag': '継承',
  'workbench.editors.requestContainer.auth.rename': '名前を変更',
  'workbench.editors.requestContainer.auth.noneEntryNote': 'このエントリを使うリクエストは認可なしで送信されます。',
  'workbench.editors.requestContainer.auth.defaultTag': 'デフォルト',
  'workbench.editors.requestContainer.auth.setDefault': 'デフォルトにする',
  'workbench.editors.requestContainer.auth.deleteEntry': '削除',
  'workbench.editors.requestContainer.auth.entryActionsAria': 'エントリの操作',
  'workbench.editors.requestContainer.auth.appliesTo': '適用するホスト',
  'workbench.editors.requestContainer.auth.appliesToPlaceholder': '*.openheaders.com',
  'workbench.editors.requestContainer.auth.appliesToHelp':
    '「継承」に設定されたリクエストのうち URL のホストが一致するものは、デフォルトより先にこのエントリを使います。',
  'workbench.editors.requestContainer.auth.appliesToOptionalTag': '（省略可）',
  'workbench.editors.requestContainer.auth.appliesToInfoSummary':
    'このエントリを、URL のホストがパターンに一致するリクエストに限定します。',
  'workbench.editors.requestContainer.auth.appliesToInfoRules':
    '大文字と小文字を区別しません。* は任意の文字列に一致し、* を含まないパターンはホストの完全一致です。ポートとパスは考慮されません。空のままにすると、このエントリはデフォルトとして、またはリクエストの指名によってのみ使われます。',
  'workbench.editors.requestContainer.auth.resetToInherited': '継承にリセット',
  'workbench.editors.requestContainer.auth.resetConfirm':
    'フォルダーのエントリを削除しますか？リクエストはコレクションの設定にフォールバックします。',
  'workbench.editors.requestContainer.deletedElsewhere': 'このアイテムは別のウィンドウで削除されました。',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': '例を読み込んでいます…',
  'workbench.editors.responseExample.notFound': '例が見つかりません。',
  'workbench.editors.responseExample.toast.deletedOtherTab': '例が別のタブから削除されました',
  'workbench.editors.responseExample.toast.saveFailed': '例の保存に失敗しました',
  'workbench.editors.responseExample.toast.saveFailedDetail': '例の保存に失敗しました：{message}',
  'workbench.editors.responseExample.openAsRequest': 'リクエストとして開く',
  'workbench.editors.responseExample.openAsRequestTooltip':
    'この例のリクエストを元にした新しいリクエストの下書きを作成します',
  'workbench.editors.responseExample.editStatus': 'ステータスコードを編集',
  'workbench.editors.responseExample.statusPlaceholder': 'レスポンスコードを入力',
  'workbench.editors.responseExample.capturedTooltip': '{date} にキャプチャ',
  'workbench.editors.responseExample.moreActionsAria': 'その他のレスポンス操作',
  'workbench.editors.responseExample.tab.body': 'ボディ',
  'workbench.editors.responseExample.tab.headers': 'ヘッダー（{count}）',
  'workbench.editors.responseExample.bodyLanguageAria': 'ボディの言語',
  'workbench.editors.responseExample.format': '整形',
  'workbench.editors.responseExample.formatBody': 'ボディを整形',
  'workbench.editors.responseExample.noFormatter': '{language} 用のフォーマッターがありません',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': 'スニペット',
  'workbench.editors.scriptEditor.packages': 'パッケージ',
  'workbench.editors.scriptEditor.searchSnippets': 'スニペットを検索',
  'workbench.editors.scriptEditor.searchPackages': 'パッケージを検索',
  'workbench.editors.scriptEditor.noSnippetFound': 'スニペットが見つかりません',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': 'このワークスペースにパッケージはまだありません',
  'workbench.editors.scriptEditor.noPackageFound': 'パッケージが見つかりません',
  'workbench.editors.scriptEditor.openPackageLibrary': 'パッケージライブラリを開く →',
  'workbench.editors.scriptEditor.saveToPackage': 'パッケージライブラリに保存',
  'workbench.editors.scriptEditor.newPackage': '新しいパッケージ',
  'workbench.editors.scriptEditor.newPackageName': '新しいパッケージ名',
  'workbench.editors.scriptEditor.back': '戻る',
  'workbench.editors.scriptEditor.create': '作成',
  'workbench.editors.scriptEditor.orAppend': 'または既存のパッケージに追記：',
  'workbench.editors.scriptEditor.noPackagesYet': 'パッケージはまだありません',
  'workbench.editors.scriptEditor.savedTo': '「{name}」に保存しました',
  'workbench.editors.scriptEditor.packageCreated': 'パッケージ「{name}」を作成しました',
  'workbench.editors.scriptEditor.duplicatePackage':
    '「{name}」という名前のパッケージはこのワークスペースに既に存在します。',
  'workbench.editors.scriptEditor.packageNotFound': 'パッケージが見つかりません。削除された可能性があります。',
  'workbench.editors.scriptEditor.saveFailed': '保存に失敗しました',
  'workbench.editors.scriptEditor.menuFind': '検索',
  'workbench.editors.scriptEditor.group.request': 'リクエスト',
  'workbench.editors.scriptEditor.group.variables': '変数',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.group.requests': 'リクエスト',
  'workbench.editors.scriptEditor.group.response': 'レスポンス',
  'workbench.editors.scriptEditor.group.close': 'クローズ',
  'workbench.editors.scriptEditor.snippet.sendRequest': 'HTTP リクエストを送信する',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': 'JSON ボディ付きの HTTP リクエストを送信する',
  'workbench.editors.scriptEditor.snippet.getVariable': '変数を取得する',
  'workbench.editors.scriptEditor.snippet.setVariable': '変数を設定する',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': 'vault のシークレットを取得する',
  'workbench.editors.scriptEditor.snippet.setHeader': 'ヘッダーを設定する',
  'workbench.editors.scriptEditor.snippet.removeHeader': 'ヘッダーを削除する',
  'workbench.editors.scriptEditor.snippet.setQueryParam': 'クエリパラメーターを設定する',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': 'クエリパラメーターを削除する',
  'workbench.editors.scriptEditor.snippet.setUrl': 'URL を設定する',
  'workbench.editors.scriptEditor.snippet.setMethod': 'メソッドを設定する',
  'workbench.editors.scriptEditor.snippet.setJsonBody': 'JSON ボディを設定する',
  'workbench.editors.scriptEditor.snippet.statusCode200': 'ステータスコードが 200 である',
  'workbench.editors.scriptEditor.snippet.bodyContains': 'レスポンスボディが文字列を含む',
  'workbench.editors.scriptEditor.snippet.bodyEquals': 'レスポンスボディが文字列と等しい',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': 'レスポンスボディの JSON 値が正しい',
  'workbench.editors.scriptEditor.snippet.headerCheck': 'Content-Type ヘッダーが存在する',
  'workbench.editors.scriptEditor.snippet.responseTime': 'レスポンス時間が 200 ms 未満である',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': 'レスポンスの値を変数に保存する',
  'workbench.editors.scriptEditor.group.connect': '接続',
  'workbench.editors.scriptEditor.group.send': '送信',
  'workbench.editors.scriptEditor.group.message': 'メッセージ',
  'workbench.editors.scriptEditor.snippet.wsSetSubprotocols': 'サブプロトコルの提案を設定する',
  'workbench.editors.scriptEditor.snippet.wsReconnectAttempt': '再接続試行時に再開する',
  'workbench.editors.scriptEditor.snippet.wsSetMessage': '送信メッセージを書き換える',
  'workbench.editors.scriptEditor.snippet.wsDropMessage': '送信メッセージを破棄する',
  'workbench.editors.scriptEditor.snippet.wsSetEvent': 'Socket.IO イベントの名前を変更する',
  'workbench.editors.scriptEditor.snippet.wsReply': 'メッセージに返信する',
  'workbench.editors.scriptEditor.snippet.wsCountMessages': 'セッション全体のメッセージを数える',
  'workbench.editors.scriptEditor.snippet.wsEmitEvent': 'Socket.IO イベントを発行する',
  'workbench.editors.scriptEditor.snippet.wsAssertJson': 'メッセージが JSON である',
  'workbench.editors.scriptEditor.snippet.wsSaveMessageValue': 'メッセージの値を変数に保存する',
  'workbench.editors.scriptEditor.snippet.wsClosedClean': 'セッションが正常に閉じた',
  'workbench.editors.scriptEditor.snippet.wsMessageCount': 'メッセージが届いた',
  'workbench.editors.scriptEditor.group.publish': 'パブリッシュ',
  'workbench.editors.scriptEditor.snippet.mqttSetClientId': 'クライアント ID を設定する',
  'workbench.editors.scriptEditor.snippet.mqttSetCredentials': 'CONNECT の資格情報を設定する',
  'workbench.editors.scriptEditor.snippet.mqttAddSubscription': '接続時にトピックをサブスクライブする',
  'workbench.editors.scriptEditor.snippet.mqttSetWill': 'Last Will を設定する',
  'workbench.editors.scriptEditor.snippet.mqttSetUserProperty': 'CONNECT のユーザープロパティを設定する',
  'workbench.editors.scriptEditor.snippet.mqttReconnectAttempt': '再接続試行を記録する',
  'workbench.editors.scriptEditor.snippet.mqttSetPayload': '送信ペイロードを書き換える',
  'workbench.editors.scriptEditor.snippet.mqttSetTopic': 'トピックを再ターゲットする',
  'workbench.editors.scriptEditor.snippet.mqttSetFlags': 'QoS と retain を設定する',
  'workbench.editors.scriptEditor.snippet.mqttDropMessage': '送信メッセージを破棄する',
  'workbench.editors.scriptEditor.snippet.mqttReply': '返信をパブリッシュする',
  'workbench.editors.scriptEditor.snippet.mqttCountMessages': 'セッション全体のメッセージを数える',
  'workbench.editors.scriptEditor.snippet.mqttAssertJson': 'ペイロードが JSON である',
  'workbench.editors.scriptEditor.snippet.mqttSaveMessageValue': 'ペイロードの値を変数に保存する',
  'workbench.editors.scriptEditor.snippet.mqttClosedClean': '正常に切断した',
  'workbench.editors.scriptEditor.snippet.mqttMessageCount': 'メッセージが届いた',
  'workbench.editors.scriptEditor.group.invoke': '呼び出し',
  'workbench.editors.scriptEditor.snippet.grpcSetMetadata': 'メタデータのペアを設定する',
  'workbench.editors.scriptEditor.snippet.grpcRemoveMetadata': 'メタデータのペアを削除する',
  'workbench.editors.scriptEditor.snippet.grpcSetMessage': 'リクエストメッセージを書き換える',
  'workbench.editors.scriptEditor.snippet.grpcLogCall': '呼び出しをログに出す',
  'workbench.editors.scriptEditor.snippet.grpcLogMessage': 'デコード済みメッセージをログに出す',
  'workbench.editors.scriptEditor.snippet.grpcCountMessages': '呼び出し全体のメッセージを数える',
  'workbench.editors.scriptEditor.snippet.grpcAssertDecoded': 'メッセージがデコードされた',
  'workbench.editors.scriptEditor.snippet.grpcAssertField': 'メッセージのフィールドが設定されている',
  'workbench.editors.scriptEditor.snippet.grpcSaveMessageValue': 'メッセージの値を変数に保存する',
  'workbench.editors.scriptEditor.snippet.grpcStatusOk': 'ステータスが OK である',
  'workbench.editors.scriptEditor.snippet.grpcMessageCount': 'メッセージが届いた',
  'workbench.editors.scriptEditor.snippet.grpcTrailerCheck': 'トレーラーが存在する',
  'workbench.editors.scriptEditor.snippet.logRequest': 'リクエストをログに出す',
  'workbench.editors.scriptEditor.snippet.parseJsonBody': 'JSON ボディを解析する',
  'workbench.editors.scriptEditor.snippet.findResponseHeader': 'レスポンスヘッダーを探す',
  'workbench.editors.scriptEditor.snippet.logResponse': 'レスポンスをログに出す',
  'workbench.editors.scriptEditor.snippet.logDial': 'ダイヤルをログに出す',
  'workbench.editors.scriptEditor.snippet.logOutgoingMessage': '送信メッセージをログに出す',
  'workbench.editors.scriptEditor.snippet.logMessage': 'メッセージをログに出す',
  'workbench.editors.scriptEditor.snippet.logClose': 'クローズをログに出す',
  'workbench.editors.scriptEditor.snippet.wsReplyBinary': 'バイナリフレームで返信する',
  'workbench.editors.scriptEditor.snippet.wsNothingDropped': '何も破棄されなかった',
  'workbench.editors.scriptEditor.snippet.mqttSetResponseTopic': 'レスポンストピックを設定する',
  'workbench.editors.scriptEditor.snippet.mqttSetPublishUserProperty': 'PUBLISH のユーザープロパティを設定する',
  'workbench.editors.scriptEditor.snippet.mqttConnackAccepted': 'ブローカーがセッションを受け入れた',
  'workbench.editors.scriptEditor.snippet.grpcLogStatus': 'ステータスをログに出す',
} as const satisfies Catalog;
