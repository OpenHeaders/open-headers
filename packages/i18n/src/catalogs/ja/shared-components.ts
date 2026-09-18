/**
 * Shared component families — Japanese. Mirrors
 * `catalogs/en/shared-components.ts` key for key; see that file for
 * the family map and the raw technical plane (`{{ns.*}}` references,
 * claim/algorithm names, key caps and glyphs, format examples). Mints:
 * 変数 = variable; 環境 = environment; コレクション = collection;
 * シークレット = secret; 生成器 = generator; スコープ = scope; 参照 =
 * reference; 古い = stale; キャプチャ = capture; ドック = dock;
 * ツールウィンドウ = tool window; 目次 = table of contents. JWT part
 * names (Header / Payload / Signature) and header field names ride
 * raw — RFC vocabulary.
 */

import type { Catalog } from '../../types';

export const sharedComponents = {
  // ── TemplateInput field chrome ─────────────────────────────────────
  'shared.templateInput.editValue': '値を編集',
  'shared.templateInput.showValue': '値を表示',
  'shared.templateInput.hideValue': '値を隠す',
  'shared.templateInput.clearValue': '値をクリア',
  'shared.templateInput.unresolvedDot': '未解決の変数が含まれています',

  // ── Suggestion popover ─────────────────────────────────────────────
  'shared.templateInput.createNamed': '変数「{name}」を作成',
  'shared.templateInput.createNamedInScope': '{scope} に変数「{name}」を作成',
  'shared.templateInput.noMatches': '一致なし',
  'shared.templateInput.footerNavigate': '↑↓ 移動',
  'shared.templateInput.footerSelect': '↵ 選択',
  'shared.templateInput.footerClose': 'esc 閉じる',

  // ── Suggestion rows (previews + badges) ────────────────────────────
  'shared.templateInput.capturedAtRuntime': '実行時にキャプチャ',
  'shared.templateInput.totpPreview': 'TOTP {digits} 桁 · {period}s',
  'shared.templateInput.totpPreviewIssuer': 'TOTP {digits} 桁 · {period}s · {issuer}',
  'shared.templateInput.emptyValue': '（空）',
  'shared.templateInput.staleBadge': '古い',
  'shared.templateInput.needsRerunBadge': '再実行が必要',
  'shared.templateInput.disabledBadge': '無効',
  'shared.templateInput.scaffold.vault': 'シークレットを追加',
  'shared.templateInput.scaffold.env': '環境変数を追加',
  'shared.templateInput.scaffold.collection': 'コレクション変数を追加',
  'shared.templateInput.scaffold.workspace': 'ワークスペース変数を追加',
  'shared.templateInput.scaffold.dynamic': '組み込み生成器：uuid、timestamp、…',
  'shared.templateInput.reservedFile': 'ファイル参照は近日対応予定です',

  // ── Variable hover / create popover ────────────────────────────────
  'shared.templateInput.enterValue': '値を入力',
  'shared.templateInput.foundIn': '見つかった場所：',
  'shared.templateInput.scopeFixedTooltip':
    'スコープは {prefix} プレフィックスで固定されています。変更するには参照を編集してください。',
  'shared.templateInput.addToScope': '追加先：{scope}',
  'shared.templateInput.addToPickScope': '追加先：スコープを選択',
  'shared.templateInput.resolvedDefault': '解決結果：デフォルト',
  'shared.templateInput.resolvedDefaultNoEnv': '解決結果：デフォルト（アクティブな環境なし）',
  'shared.templateInput.noActiveEnvHint':
    '環境が選択されていません。環境変数を追加するには、環境スイッチャーで環境を選択してください。',
  'shared.templateInput.noCollectionHint':
    'アクティブなコレクションがありません。コレクション変数を追加するには、コレクションを開いてください。',

  // Resolved-scope labels (badge line in the hover popover).
  'shared.templateInput.scope.vault': 'Vault',
  'shared.templateInput.scope.vaultTotp': 'Vault · TOTP',
  'shared.templateInput.scope.environmentNamed': '環境 · {name}',
  'shared.templateInput.scope.collectionNamed': 'コレクション · {name}',
  'shared.templateInput.scope.workspace': 'ワークスペース',
  'shared.templateInput.scope.live': 'ライブ',
  'shared.templateInput.scope.liveOverride': 'ライブ · オーバーライド',
  'shared.templateInput.scope.stepNamed': 'ステップ · {capture}',
  'shared.templateInput.scope.fileNamed': 'ファイル · {name}',
  'shared.templateInput.scope.dynamic': '動的',
  'shared.templateInput.scope.unresolved': '未解決',

  // Create-flow destination scopes ("Add to" picker).
  'shared.templateInput.createScope.environment': '環境',
  'shared.templateInput.createScope.collection': 'コレクション',
  'shared.templateInput.createScope.workspace': 'ワークスペース',
  'shared.templateInput.createScope.vault': 'Vault',
  'shared.templateInput.createScope.noActiveEnvHint': 'アクティブな環境なし',

  // Why a reference is unresolved.
  'shared.templateInput.unresolved.emptyReference': '空の参照',
  'shared.templateInput.unresolved.unknownNamespace': '不明な名前空間',
  'shared.templateInput.unresolved.dynamic':
    'その名前の組み込み生成器はありません。{{dynamic.…}} の候補リストから選択してください。',
  'shared.templateInput.unresolved.step': 'ライブワークフローのチェーンの実行中にのみ解決されます。',
  'shared.templateInput.unresolved.envNotSet': '環境「{name}」に設定されていません。',
  'shared.templateInput.unresolved.noActiveEnv': 'アクティブな環境が選択されていません。',
  'shared.templateInput.unresolved.live':
    'その名前のライブ変数はありません（またはキャッシュされた値がまだありません）。',
  'shared.templateInput.unresolved.notDefined': 'どのスコープにも定義されていません。',

  // Save dispatch results (update + create + toast surface).
  'shared.templateInput.save.pickScope': '「追加先」からスコープを選択してください',
  'shared.templateInput.save.totpInVaultEditor': 'TOTP シークレットは Vault エディターで編集する必要があります',
  'shared.templateInput.save.vaultKindChanged': 'Vault エントリーの種類が編集中に変更されました',
  'shared.templateInput.save.notEditable': '編集できません',
  'shared.templateInput.save.noActiveEnv': 'アクティブな環境がありません',
  'shared.templateInput.save.noCollection': 'コンテキストにコレクションがありません',
  'shared.templateInput.save.saved': '保存しました',
  'shared.templateInput.save.duplicateName': 'その名前の変数はこのスコープに既に存在します。',
  'shared.templateInput.save.notFound': '変数が見つかりません。削除された可能性があります。',
  'shared.templateInput.save.failed': '保存に失敗しました',

  // ── Set-as-variable popover + selection context menu ───────────────
  'shared.templateInput.setAsVariable': '変数として設定',
  'shared.templateInput.setAsNewVariable': '新しい変数として設定',
  'shared.templateInput.variableName': '変数名',
  'shared.templateInput.variableValue': '変数の値',
  'shared.templateInput.valuePlaceholder': '値',
  'shared.templateInput.menu.cut': '切り取り',
  'shared.templateInput.menu.paste': '貼り付け',

  // ── Monaco variable completions (detail + hover documentation) ─────
  'shared.templateInput.completion.scope.vault': 'Vault シークレット',
  'shared.templateInput.completion.scope.env': '環境',
  'shared.templateInput.completion.scope.collection': 'コレクション',
  'shared.templateInput.completion.scope.workspace': 'ワークスペース',
  'shared.templateInput.completion.scope.live': 'ソース',
  'shared.templateInput.completion.scope.step': 'ソースフローのステップキャプチャ',
  'shared.templateInput.completion.scope.file': 'ファイル参照',
  'shared.templateInput.completion.scope.dynamic': '動的生成器',
  'shared.templateInput.completion.staleSuffix': '（古い）',
  'shared.templateInput.completion.comingSoon': '近日対応予定',
  'shared.templateInput.completion.capturedAtRuntime': '実行時にキャプチャ',
  'shared.templateInput.completion.totpDetail': 'TOTP コード（{digits} 桁、{period}s）',
  'shared.templateInput.completion.valueHiddenSensitive': '値は非表示です（機密スコープ）。',
  'shared.templateInput.completion.valueHiddenStale': '値は非表示です（古いライブ変数）。',
  'shared.templateInput.completion.valueDoc': '**値：**`{value}`',
  'shared.templateInput.completion.staleValueDoc': '**古い値：**`{value}`',
  'shared.templateInput.completion.capturedWhenRuns': 'ワークフローの実行時にキャプチャされます。',
  'shared.templateInput.completion.totpDoc': '**TOTP コード**：{algorithm}、{digits} 桁、{period}s ごとに更新。',
  'shared.templateInput.completion.totpDocIssuer':
    '**{issuer}** の **TOTP コード**：{algorithm}、{digits} 桁、{period}s ごとに更新。',
  'shared.templateInput.completion.secretManagerDoc':
    '**シークレットマネージャー参照**：`{reference}`。送信時にマネージャーから解決され、値は保存されません。',

  // ── Value editors: shared chrome ───────────────────────────────────
  'shared.valueEditors.decoded': 'デコード済み',
  'shared.valueEditors.encodedPreview': 'エンコードのプレビュー',
  'shared.valueEditors.cannotEncode': 'エンコードできません。編集した値はこの種類として無効です',
  'shared.valueEditors.encodedCopied': 'エンコードした値をクリップボードにコピーしました',
  'shared.valueEditors.copyFailed': 'クリップボードへのコピーに失敗しました',
  'shared.valueEditors.openAsDocument': 'ドキュメントとして開く',
  'shared.valueEditors.decode': 'デコード',
  'shared.valueEditors.decodeChipView': 'デコード結果を表示：{title}',
  'shared.valueEditors.decodeChipEdit': 'デコードして編集：{title}',
  'shared.valueEditors.editJwt': 'JWT を編集',
  'shared.valueEditors.viewJwt': 'JWT を表示',

  // ── Value editors: glance popover ──────────────────────────────────
  'shared.valueEditors.glance.title': 'デコードした値',
  'shared.valueEditors.glance.openTab': '新しいタブで開く',
  'shared.valueEditors.glance.openModal': 'モーダルで開く',
  'shared.valueEditors.glance.moreClaims': '他 {count} 件',
  'shared.valueEditors.glance.signatureElided':
    'Signature は表示されていません。完全な token はドキュメントまたはモーダルで開いてください。',

  // ── Value editors: pair grid ───────────────────────────────────────
  'shared.valueEditors.grid.name': '名前',
  'shared.valueEditors.grid.key': 'キー',
  'shared.valueEditors.grid.value': '値',
  'shared.valueEditors.grid.flag': 'フラグ',
  'shared.valueEditors.grid.ariaNamePairs': '名前と値のペア',
  'shared.valueEditors.grid.ariaKeyPairs': 'キーと値のペア',
  'shared.valueEditors.grid.ariaRowName': '行 {row} の名前',
  'shared.valueEditors.grid.ariaRowKey': '行 {row} のキー',
  'shared.valueEditors.grid.ariaRowValue': '行 {row} の値',
  'shared.valueEditors.grid.moveRowUp': '行 {row} を上へ移動',
  'shared.valueEditors.grid.moveRowDown': '行 {row} を下へ移動',
  'shared.valueEditors.grid.deleteRow': '行 {row} を削除',
  'shared.valueEditors.grid.addRow': '行を追加',

  // ── Value editors: JWT modal ───────────────────────────────────────
  'shared.valueEditors.jwt.title': 'JWT エディター',
  'shared.valueEditors.jwt.titleViewer': 'JWT',
  'shared.valueEditors.jwt.modified': '変更あり',
  'shared.valueEditors.jwt.decodeErrorTitle': 'token をデコードできませんでした',
  'shared.valueEditors.jwt.decoded': 'デコード済み',
  'shared.valueEditors.jwt.encoded': 'エンコード済み',
  'shared.valueEditors.jwt.header': 'Header',
  'shared.valueEditors.jwt.payload': 'Payload',
  'shared.valueEditors.jwt.claims': 'クレーム：',
  'shared.valueEditors.jwt.rawToken': '生の token',
  'shared.valueEditors.jwt.pasteOrEdit': '生の token を貼り付けるか編集してください',
  'shared.valueEditors.jwt.notDecodable': 'デコード可能な JWT ではありません',
  'shared.valueEditors.jwt.structure': '構造：',
  'shared.valueEditors.jwt.resignWithSecret': 'シークレットで再署名',
  'shared.valueEditors.jwt.algFromHeader': 'header の {algorithm}',
  'shared.valueEditors.jwt.signingSecret': '署名シークレット',
  'shared.valueEditors.jwt.secretMemoryNote': 'メモリ内にのみ保持され、エディターを閉じると破棄されます。',
  'shared.valueEditors.jwt.tokenExpired': 'token は期限切れです',
  'shared.valueEditors.jwt.tokenNotExpired': 'token は有効期限内です',
  'shared.valueEditors.jwt.expiredOn': '{date} に期限切れ',
  'shared.valueEditors.jwt.expiresOn': '{date} に期限切れになります',
  'shared.valueEditors.jwt.resigned': 'token を {algorithm} で再署名しました',
  'shared.valueEditors.jwt.resignedDescription':
    '保存すると、あなたのシークレットで署名した token が書き込まれます。上のプレビューがそのまま保存されます。',
  'shared.valueEditors.jwt.cannotResign': 'このアルゴリズムでは再署名できません',
  'shared.valueEditors.jwt.cannotResignDescription':
    'ここで再署名できるのは HMAC アルゴリズム（HS256、HS384、HS512）のみです。代わりに元の署名がそのまま引き継がれます。',
  'shared.valueEditors.jwt.signError': 'token に署名できませんでした',
  'shared.valueEditors.jwt.signatureInvalid': '署名が無効になりました',
  'shared.valueEditors.jwt.signatureInvalidDescription':
    '元の署名がそのまま保持されるため、署名を検証するサーバーは編集後の token を拒否します。再署名するには署名シークレットを入力してください。',
  'shared.valueEditors.jwt.copied': 'JWT をクリップボードにコピーしました',

  // ── Value editors: detected-value titles ───────────────────────────
  'shared.valueEditors.valueTitle.jwt': 'JWT ペイロード',
  'shared.valueEditors.valueTitle.urlEncoded': 'URL エンコードされた値',
  'shared.valueEditors.valueTitle.base64': 'Base64 の値',
  'shared.valueEditors.valueTitle.hex': '16 進エンコードされた値',
  'shared.valueEditors.valueTitle.timestamp': 'Unix タイムスタンプ',
  'shared.valueEditors.valueTitle.json': 'JSON の値',
  'shared.valueEditors.valueTitle.jsonString': '引用符付き文字列',
  'shared.valueEditors.valueTitle.dataUri': 'Data URI',
  'shared.valueEditors.valueTitle.cookie': 'Cookie の値',
  'shared.valueEditors.valueTitle.csp': 'Content Security Policy',
  'shared.valueEditors.valueTitle.httpDate': 'HTTP 日付',
  'shared.valueEditors.valueTitle.queryString': 'クエリ文字列',
  'shared.valueEditors.valueTitle.cacheControl': 'Cache-Control',
  'shared.valueEditors.valueTitle.hsts': 'Strict-Transport-Security',
  'shared.valueEditors.valueTitle.contentDisposition': 'Content-Disposition',
  'shared.valueEditors.valueTitle.link': 'Link ヘッダー',
  'shared.valueEditors.valueTitle.authParams': 'Authorization パラメーター',
  'shared.valueEditors.valueTitle.acceptList': 'Accept リスト',

  // ── Scope-colors registry (canonical scope labels — badges, rows) ──
  'shared.scopeColors.vault': 'Vault シークレット',
  'shared.scopeColors.environment': '環境変数',
  'shared.scopeColors.collection': 'コレクション変数',
  'shared.scopeColors.workspace': 'ワークスペース変数',
  'shared.scopeColors.live': 'ライブ変数（ワークフロー由来）',
  'shared.scopeColors.step': 'ワークフローのステップキャプチャ',
  'shared.scopeColors.file': 'ファイル参照',
  'shared.scopeColors.dynamic': '動的生成器',

  // ── Value editors: in-field edit tooltips ──────────────────────────
  'shared.valueEditors.editTooltip.jwt': 'JWT として編集',
  'shared.valueEditors.editTooltip.urlEncoded': 'URL エンコードされた値を編集',
  'shared.valueEditors.editTooltip.base64': 'Base64 の値を編集',
  'shared.valueEditors.editTooltip.hex': '16 進エンコードされた値を編集',
  'shared.valueEditors.editTooltip.timestamp': 'タイムスタンプを編集',
  'shared.valueEditors.editTooltip.json': 'JSON として編集',
  'shared.valueEditors.editTooltip.jsonString': '引用符付き文字列を編集',
  'shared.valueEditors.editTooltip.dataUri': 'Data URI の内容を編集',
  'shared.valueEditors.editTooltip.cookie': 'Cookie のペアを編集',
  'shared.valueEditors.editTooltip.csp': 'CSP ディレクティブを編集',
  'shared.valueEditors.editTooltip.httpDate': 'HTTP 日付を編集',
  'shared.valueEditors.editTooltip.queryString': 'クエリのペアを編集',
  'shared.valueEditors.editTooltip.cacheControl': 'キャッシュディレクティブを編集',
  'shared.valueEditors.editTooltip.hsts': 'HSTS ディレクティブを編集',
  'shared.valueEditors.editTooltip.contentDisposition': 'Disposition パラメーターを編集',
  'shared.valueEditors.editTooltip.link': 'リンクを編集',
  'shared.valueEditors.editTooltip.authParams': '認証パラメーターを編集',
  'shared.valueEditors.editTooltip.acceptList': 'Accept リストを編集',

  // ── Default entity names ───────────────────────────────────────────
  'shared.defaults.newRulesCollection': '新しいルールコレクション',
  'shared.defaults.newRequestsCollection': '新しいリクエストコレクション',
  'shared.defaults.newEnvironment': '新しい環境',
  'shared.defaults.newSpec': '新しい仕様',

  // ── Rule-type registry ─────────────────────────────────────────────
  'shared.ruleTypes.header.label': 'ヘッダーを変更',
  'shared.ruleTypes.header.description': 'HTTP ヘッダーを追加、上書き、または削除します',
  'shared.ruleTypes.requestBody.label': 'API リクエストボディを変更',
  'shared.ruleTypes.requestBody.description': 'API リクエストボディを上書きまたは変換します（fetch/XHR のみ）',
  'shared.ruleTypes.response.label': 'API レスポンスを変更',
  'shared.ruleTypes.response.description':
    'API レスポンスのステータス、ボディ、ヘッダーをモックまたは変更します（fetch/XHR のみ）',
  'shared.ruleTypes.queryParam.label': 'クエリパラメーターを変更',
  'shared.ruleTypes.queryParam.description': 'URL パラメーターを追加、上書き、または削除します',
  'shared.ruleTypes.inject.label': 'スクリプト/スタイルシートを注入',
  'shared.ruleTypes.inject.description': 'JavaScript または CSS をページに注入します',
  'shared.ruleTypes.ws.label': 'WebSocket メッセージを変更',
  'shared.ruleTypes.ws.description': 'WebSocket フレームを置換、注入、または破棄します（ページのソケットのみ）',
  'shared.ruleTypes.sse.label': 'Server-Sent Events を変更',
  'shared.ruleTypes.sse.description': 'SSE イベントを置換、注入、または破棄します（ページのストリームのみ）',
  'shared.ruleTypes.block.label': 'リクエストをブロック',
  'shared.ruleTypes.block.description': 'リクエストの完了を阻止します',
  'shared.ruleTypes.redirect.label': 'リクエストをリダイレクト',
  'shared.ruleTypes.redirect.description': '別の URL にリダイレクトします',
  'shared.ruleTypes.delay.label': 'リクエストを遅延',
  'shared.ruleTypes.delay.description': 'ネットワークリクエストに遅延を追加します（fetch/XHR のみ）',
  'shared.ruleTypes.auth.label': '認証チャレンジに応答',
  'shared.ruleTypes.auth.description': 'HTTP/プロキシ認証チャレンジに資格情報を提供します（デバッグモードが必要）',

  // ── Request-kind registry ──────────────────────────────────────────
  'shared.requestKinds.http.label': 'HTTP',
  'shared.requestKinds.grpc.label': 'gRPC',
  'shared.requestKinds.websocket.label': 'WebSocket',
  'shared.requestKinds.socketio.label': 'Socket.IO',
  'shared.requestKinds.mqtt.label': 'MQTT',
  'shared.requestKinds.graphql.label': 'GraphQL',

  // ── System rule-template registry ──────────────────────────────────
  'shared.ruleTemplates.blankRule': '空のルール',

  'shared.ruleTemplates.folder.corsSecurity': 'CORS とセキュリティ',
  'shared.ruleTemplates.folder.authentication': '認証',
  'shared.ruleTemplates.folder.privacy': 'プライバシー',
  'shared.ruleTemplates.folder.testing': 'テスト',
  'shared.ruleTemplates.folder.urlHandling': 'URL の処理',
  'shared.ruleTemplates.folder.tracking': 'トラッキング',
  'shared.ruleTemplates.folder.debugging': 'デバッグ',
  'shared.ruleTemplates.folder.appearance': '外観',
  'shared.ruleTemplates.folder.rest': 'REST',
  'shared.ruleTemplates.folder.graphql': 'GraphQL',
  'shared.ruleTemplates.folder.statusCodes': 'ステータスコード',
  'shared.ruleTemplates.folder.dynamic': '動的',

  'shared.ruleTemplates.corsBypass.name': 'CORS バイパス',
  'shared.ruleTemplates.corsBypass.description':
    '開発中にクロスオリジンリクエストを許可するため、制限的な CORS ヘッダーを削除します',
  'shared.ruleTemplates.removeCsp.name': 'CSP を削除',
  'shared.ruleTemplates.removeCsp.description': '開発用に Content-Security-Policy ヘッダーを取り除きます',
  'shared.ruleTemplates.allowEmbedding.name': '埋め込みを許可',
  'shared.ruleTemplates.allowEmbedding.description': 'iframe での埋め込みを許可するため X-Frame-Options を削除します',
  'shared.ruleTemplates.apiAuth.name': 'API 認証の注入',
  'shared.ruleTemplates.apiAuth.description': 'API 呼び出しに Authorization ヘッダーを自動的に注入します',
  'shared.ruleTemplates.customUa.name': 'カスタム User-Agent',
  'shared.ruleTemplates.customUa.description': '特定のドメインで User-Agent ヘッダーを上書きします',
  'shared.ruleTemplates.blockCookies.name': 'Cookie をブロック',
  'shared.ruleTemplates.blockCookies.description': '送信リクエストから Cookie ヘッダーを削除します',
  'shared.ruleTemplates.testMerge.name': 'マージのテスト（httpbin）',
  'shared.ruleTemplates.testMerge.description':
    'レスポンスヘッダーに追記してマージ操作をテストします。\n1. このルールを有効にする\n2. 新しいタブで httpbin.org を開く\n' +
    '3. コンソールで実行：fetch("https://httpbin.org/get").then(r=>{console.log("Content-Type:",' +
    'r.headers.get("Content-Type"))})\n4. Content-Type が "application/json, x-openheaders-merged" と表示されるはずです',
  'shared.ruleTemplates.blockTrackers.name': 'トラッカーをブロック',
  'shared.ruleTemplates.blockTrackers.description': '解析およびトラッキングスクリプトをブロックします',
  'shared.ruleTemplates.blockAds.name': '広告をブロック',
  'shared.ruleTemplates.blockAds.description': '一般的な広告ネットワークのドメインをブロックします',
  'shared.ruleTemplates.redirectDomain.name': 'ドメインをリダイレクト',
  'shared.ruleTemplates.redirectDomain.description': 'あるドメインの全トラフィックを別のドメインにリダイレクトします',
  'shared.ruleTemplates.forceHttps.name': 'HTTPS を強制',
  'shared.ruleTemplates.forceHttps.description':
    'HTTP を HTTPS にアップグレードします。正規表現のキャプチャグループでパス全体を保持します',
  'shared.ruleTemplates.removeUtm.name': 'UTM パラメーターを削除',
  'shared.ruleTemplates.removeUtm.description': 'URL から UTM トラッキングパラメーターを取り除きます',
  'shared.ruleTemplates.addDebug.name': 'デバッグフラグを追加',
  'shared.ruleTemplates.addDebug.description': 'API 呼び出しに debug=true クエリパラメーターを追加します',
  'shared.ruleTemplates.darkMode.name': 'ダークモード CSS',
  'shared.ruleTemplates.darkMode.description': '基本的なダークモードのスタイルシートを注入します',
  'shared.ruleTemplates.consoleLogger.name': 'コンソールロガー',
  'shared.ruleTemplates.consoleLogger.description': 'すべての fetch リクエストをコンソールに記録します',
  'shared.ruleTemplates.slowApi.name': '低速 API（2s）',
  'shared.ruleTemplates.slowApi.description': 'API 呼び出しに 2 秒の遅延を追加します。読み込み状態のテスト用',
  'shared.ruleTemplates.timeoutTest.name': 'タイムアウトテスト（5s）',
  'shared.ruleTemplates.timeoutTest.description': '5 秒の遅延を追加します。タイムアウト処理のテスト用',
  'shared.ruleTemplates.restBodyOverride.name': 'REST ボディの上書き',
  'shared.ruleTemplates.restBodyOverride.description': 'リクエストボディを静的な JSON ペイロードに置き換えます',
  'shared.ruleTemplates.graphqlOverride.name': 'GraphQL の上書き',
  'shared.ruleTemplates.graphqlOverride.description': 'GraphQL リクエストボディをカスタムのクエリと変数で上書きします',
  'shared.ruleTemplates.mock200.name': 'モック 200 JSON',
  'shared.ruleTemplates.mock200.description': 'REST API エンドポイントに成功の JSON レスポンスを返します',
  'shared.ruleTemplates.mock404.name': 'モック 404',
  'shared.ruleTemplates.mock404.description': '404 Not Found レスポンスを返します',
  'shared.ruleTemplates.mock500.name': 'モックサーバーエラー',
  'shared.ruleTemplates.mock500.description': '500 Internal Server Error を返します。エラー処理のテスト用',
  'shared.ruleTemplates.mockGraphql.name': 'モック GraphQL レスポンス',
  'shared.ruleTemplates.mockGraphql.description': '特定の GraphQL 操作にカスタムレスポンスを返します',
  'shared.ruleTemplates.mockDynamic.name': '動的 REST レスポンス',
  'shared.ruleTemplates.mockDynamic.description':
    '実際の REST API レスポンスを傍受して JavaScript で変更します。テストデータの注入、フィールドの削除、レスポンス構造の変換に',
  'shared.ruleTemplates.mockDynamicGraphql.name': '動的 GraphQL レスポンス',
  'shared.ruleTemplates.mockDynamicGraphql.description':
    '特定の GraphQL 操作のレスポンスを傍受して JavaScript で変更します。データの再構成、モックフィールドの注入、エラーのシミュレーションに',

  // ── Dock-layout chrome ─────────────────────────────────────────────
  'shared.dock.slot.leftTop': '左上',
  'shared.dock.slot.leftBottom': '左下',
  'shared.dock.slot.rightTop': '右上',
  'shared.dock.slot.rightBottom': '右下',
  'shared.dock.slot.bottomLeft': '下部左',
  'shared.dock.slot.bottomRight': '下部右',
  'shared.dock.slot.bottomTop': '下部上段',
  'shared.dock.slot.bottomBottom': '下部下段',
  'shared.dock.hide': '隠す',
  'shared.dock.moveTo': '移動先',
  'shared.dock.currentSlot': '現在のスロット',
  'shared.dock.showToolWindowNames': 'ツールウィンドウ名を表示',
  'shared.dock.hideThisDock': 'このドックを隠す',
  'shared.dock.closeDock': 'ドックを閉じる',
  'shared.dock.panelOptions': 'パネルのオプション',
  'shared.dock.hidePanel': 'パネルを隠す',

  // ── Docs panel chrome ──────────────────────────────────────────────
  'shared.docs.title': 'ドキュメント',
  'shared.docs.contents': '目次',
  'shared.docs.ariaOpenToc': '目次を開く',
  'shared.docs.ariaCloseToc': '目次を閉じる',
  'shared.docs.filterPlaceholder': 'セクションを絞り込む',
  'shared.docs.noMatches': '一致なし',
  'shared.docs.hint.navigate': '移動',
  'shared.docs.hint.open': '開く',
  'shared.docs.hint.back': '戻る',
  'shared.docs.hint.contents': '目次',
  'shared.docs.previous': '前へ',
  'shared.docs.next': '次へ',
  'shared.docs.previousTooltip': '前：{title}',
  'shared.docs.nextTooltip': '次：{title}',

  // ── Docs section primitives ────────────────────────────────────────
  'shared.docs.callout.note': 'メモ',
  'shared.docs.callout.warning': '警告',
  'shared.docs.callout.tip': 'ヒント',
  'shared.docs.callout.limitation': '制限',
  'shared.docs.example.rule': 'ルール：',
  'shared.docs.example.before': '前：',
  'shared.docs.example.after': '後：',
  'shared.docs.example.appliesTo': '適用対象：',
  'shared.docs.example.wontApply': '適用されない：',
  'shared.docs.example.suggestion': '提案：',
  'shared.docs.onThisPage': 'このページの内容',
  'shared.docs.copyCode': 'コードをコピー',
  'shared.docs.surfaces.header': '表示される場所',
  'shared.docs.surfaces.popup': 'ポップアップ',
  'shared.docs.surfaces.sidePanel': 'サイドパネル',
  'shared.docs.surfaces.workbench': 'ワークベンチ',
  'shared.docs.surfaces.devtools': 'DevTools',
  'shared.docs.engineScript': 'スクリプトベース',

  // ── Split-layout orientation ───────────────────────────────────────
  'shared.splitLayout.horizontal': '水平レイアウト：左右に並べる',
  'shared.splitLayout.vertical': '垂直レイアウト：上下に重ねる',

  // ── Desktop teaser + shared editor chrome ──────────────────────────
  'shared.timelineGroup.showOlder': '古い {count} 件を表示',
  'shared.codeEditor.wrap': '折り返し',
  'shared.codeEditor.find': '検索',
  'shared.codeEditor.replace': '置換',
  'shared.codeEditor.format': '整形',
  'shared.codeEditor.formatError': '整形できません：パースエラー',
  'shared.editorMenu.label': 'エディター',
  'shared.editorMenu.thisEditor': 'このエディター',
  'shared.editorMenu.allEditors': 'すべてのエディター',
  'shared.editorMenu.lineNumbers': '行番号',
  'shared.editorMenu.whitespace': '空白文字',
  'shared.editorMenu.lineEnds': '改行コード',
  'shared.timelineGroup.showNewestOnly': '最新の {count} 件のみ表示',
  'shared.peerExecute.localDisabled':
    'このデバイスのブラウザーからの送信は、デスクトップアプリでオフになっています。バックアップと同期 › お使いのデバイス で「このデバイスのブラウザーにリクエストの送信を許可」を有効にしてください。',
  'shared.peerExecute.remoteDisabled':
    '他のデバイスからの送信は、接続先のホストでオフになっています。そのマシンの バックアップと同期 › お使いのデバイス で「接続中の他のデバイスにリクエストの送信を許可」を有効にしてください。',
  'shared.peerExecute.enableCta': 'デスクトップアプリで有効にする',
  // ── Execution place (the chip beside Send / Connect / Invoke) ───────
  'shared.executionPlace.info': 'このリクエストの実行場所',
  'shared.executionPlace.chip.here': 'ここで実行',
  'shared.executionPlace.chip.desktopApp': 'デスクトップアプリで実行',
  'shared.executionPlace.chip.server': '{place}で実行',
  'shared.executionPlace.chip.needsDesktopApp': 'デスクトップアプリが必要',
  'shared.executionPlace.chip.notForwarded': '{place}ではまだ利用できません',
  'shared.executionPlace.chip.unavailable': 'ここでは利用できません',
  'shared.executionPlace.chip.cannotRunOn': '{place}ではまだ実行できません',
  'shared.executionPlace.role.here': 'このデバイス',
  'shared.executionPlace.role.desktopApp': 'デスクトップアプリ',
  'shared.executionPlace.role.server': 'サーバー',
  'shared.executionPlace.reason.runsHere': 'このコンピューター上の、このアプリで実行されます。',
  'shared.executionPlace.reason.runsHereBrowser': 'このコンピューター上の拡張機能で実行されます。',
  'shared.executionPlace.reason.runsHerePageRealm':
    'このコンピューター上の拡張機能で、ブラウザーのソケットを通じて実行されます。',
  'shared.executionPlace.reason.contextSend':
    '接続中のバックエンドである{place}から送信され、そこで解決されます。送信先にはそのマシンのアドレスとネットワーク上の位置が見えます。',
  'shared.executionPlace.reason.companionInvoke':
    'gRPC 呼び出しはこのコンピューター上のデスクトップアプリに転送されます。ブラウザーにはトレーラーを扱える HTTP/2 スタックがありません。',
  'shared.executionPlace.reason.serverInvoke':
    'gRPC 呼び出しはワークスペースのサーバー {place} に転送され、そこで解決されます。ブラウザーにはトレーラーを扱える HTTP/2 スタックがありません。',
  'shared.executionPlace.reason.companionRequired':
    '呼び出すにはデスクトップアプリを接続してください。作成と保存はここでできます。',
  'shared.executionPlace.reason.tcpScheme':
    'mqtt:// と mqtts:// はブラウザーでは開けない生の TCP ソケットを開きます。このリクエストをデスクトップアプリで開くか、ws:// または wss:// に切り替えてここで接続してください。',
  'shared.executionPlace.reason.sessionNotForwarded': 'セッションはまだ{place}に転送されません。',
  'shared.executionPlace.reason.noRuntime': 'この種類のリクエストはデスクトップアプリまたはサーバーで実行されます。',
  'shared.executionPlace.reason.delegatedDesktopApp':
    'ここで解決し、デスクトップアプリがこのリクエストに代わって接続を開きます。',
  'shared.executionPlace.reason.delegatedServer':
    'ここで解決し、{place} がこのリクエストに代わって接続を開きます。解決済みの値（シークレットを含む）はそこへ送られます。',
  'shared.executionPlace.picker.title': '実行場所',
  'shared.executionPlace.option.here': 'このデバイス',
  'shared.executionPlace.option.desktopApp': 'デスクトップアプリ',
  'shared.executionPlace.option.server': 'サーバー',
  'shared.executionPlace.knob.cookieJar': 'Cookie ジャー',
  'shared.executionPlace.knobsNotApplied': '{place}では適用されません：{knobs}。',
  'shared.executionPlace.reason.preferenceUnavailable':
    'このリクエストは{place}で実行するように設定されていますが、ここからはまだ実行できません。',
  'shared.desktopTeaser.cta': 'デスクトップアプリをダウンロード',
  'shared.desktopTeaser.openApp': 'デスクトップアプリで開く',
  'shared.desktopTeaser.launchApp': 'デスクトップアプリを開く',
  'shared.desktopTeaser.otherPlatforms': '他のプラットフォームとチャネル',
  'shared.desktopTeaser.terminal.title': '統合ターミナル',
  'shared.desktopTeaser.terminal.body':
    'ワークスペースの中で本物のターミナルを開けます。お使いのシェルが、ルールやリクエストのすぐ隣でローカルに動作します。',
  'shared.desktopTeaser.git.title': 'Git 履歴',
  'shared.desktopTeaser.git.body':
    'ワークスペースのコミット履歴を、コミットごとの詳細とファイル差分つきで閲覧できます。',
  'shared.desktopTeaser.commit.title': 'コミット',
  'shared.desktopTeaser.commit.body':
    'ワークスペースの変更を確認してコミットできます。チェック可能なファイルツリー、ファイルごとの差分、コミットメッセージ欄つきです。',
  'shared.desktopTeaser.proxy.title': 'キャプチャプロキシ',
  'shared.desktopTeaser.proxy.body':
    '内蔵プロキシでライブの HTTP(S) トラフィックをキャプチャし、すべてのリクエストをその場で検査できます。',
  'shared.desktopTeaser.mcp.title': 'AI · MCP サーバー',
  'shared.desktopTeaser.mcp.body': '内蔵の MCP サーバーを通じて、AI アシスタントをワークスペースに接続できます。',
  'shared.desktopTeaser.liveNetwork.title': 'ライブネットワーク',
  'shared.desktopTeaser.liveNetwork.body':
    '拡張機能からストリーミングされるブラウザータブのトラフィックを、デスクトップアプリでライブに観察できます。DevTools は不要です。',

  // ── Settings rows ──────────────────────────────────────────────────
  'shared.settingsRows.enabled': '有効',
  'shared.settingsRows.disabled': '無効',
  'shared.settingsRows.reset': '{label} をデフォルトに戻す',
} as const satisfies Catalog;
