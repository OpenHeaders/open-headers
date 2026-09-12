/**
 * Workbench editors — the API request editor — Japanese. Mirrors
 * `catalogs/en/workbench-editors-request.ts` key for key; extends the
 * ja register contract (`ja/shared.ts`). Raw by design: HTTP methods,
 * header names, MIME types, auth scheme names (Basic Auth / Bearer
 * Token / API Key / OAuth 2.0 / AWS Signature v4 / Digest Auth /
 * OAuth 1.0 / Hawk Authentication / JWT Bearer / HTTP Message
 * Signature), OAuth/PKCE spec params (Client ID, Client Secret, Code
 * Verifier, State, refresh_token, oauth_*), body-mode enums, `Docs` /
 * `Params` tab names (設定 = Settings tab), wire tokens
 * (Timing-Allow-Origin, resource-timing, Referer, Host, User-Agent,
 * Set-Cookie, SSE `ID`/`Retry`, Trailers), the phase ladder's
 * DNS/TCP/TLS/TTFB tokens, generated `<calculated…>` placeholder
 * values verbatim, and lowercase vault / oh (token case follows en).
 * Assertion verdicts translate caps-for-caps as plain nouns（合格 /
 * 不合格）. Reuses shipped mints: 継承（editors, the Inherit label）,
 * 送信 / ボディ / 認可 / ヘッダー / 整形 / キー / 値 / 説明（editors
 * grid）, スクリプト / プリリクエストスクリプト /
 * ポストレスポンススクリプト, バックエンド = back-end, アサーション =
 * assertion（workbench-live）, ランタイム = runtime, and the
 * shared-conflicts scalar twins quoted verbatim for the Settings knob
 * labels（TLS 最小バージョン / TLS 最大バージョン / TLS 暗号スイート /
 * SNI サーバー名 / HTTP バージョン / 解決先アドレス /
 * クライアント証明書 / プロキシ資格情報 / Unix ソケット /
 * リクエストタイムアウト / レスポンスサイズ上限 / 最大リダイレクト数 /
 * 元の HTTP メソッドを維持 / Authorization ヘッダーを維持）.
 * `Cookie jar` rides raw where en capitalizes; ja prose says Cookie
 * ジャー（S67 law）. MINTS: セーフモード / 開発者モード = script
 * execution modes; 下限 = TLS floor; サンドボックス = sandbox
 * （サンドボックス化 adjectival）; 署名 = signature / signing;
 * 資格情報 = credentials; 対象コンポーネント = covered components;
 * アサーション（JWT）= assertion in the OAuth client-assertion sense.
 * Browser cert-interstitial paths quote the browsers' own ja UI:
 * Chrome 詳細設定 → …に進む（安全ではありません）, Firefox
 * 詳細情報… → 危険性を承知で続行.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRequest = {
  // ── Request editor shell ───────────────────────────────────────────
  'workbench.editors.request.notFound': 'リクエストが見つかりません。',
  'workbench.editors.request.loading': 'リクエストを読み込んでいます…',
  'workbench.editors.request.toast.deletedOtherTab': 'リクエストは別のタブから削除されました',
  'workbench.editors.request.toast.updateFailed': 'リクエストを更新できませんでした',
  'workbench.editors.request.toast.updateFailedDetail': 'リクエストを更新できませんでした：{message}',
  'workbench.editors.request.toast.invalidSetting': '{label} が無効です。保存する前に設定で修正してください。',
  'workbench.editors.request.toast.savedExample': '例「{name}」を保存しました',
  'workbench.editors.request.toast.saveExampleFailed': '例を保存できませんでした',
  'workbench.editors.request.toast.saveExampleFailedDetail': '例を保存できませんでした：{message}',
  'workbench.editors.request.send.label': '送信',
  'workbench.editors.request.send.sending': '送信しています…',
  'workbench.editors.request.send.unresolvedTooltip':
    'リクエストに未解決の変数があります。送信する前に vault、環境、コレクション、ワークスペース、またはライブワークフローで定義してください。',
  'workbench.editors.request.send.remoteDispatchHint': '{host}（接続中のバックエンド）で実行されます',
  'workbench.editors.request.send.stop': '停止',
  'workbench.editors.request.send.stopTooltip': 'リクエストを停止し、届いた分を保持します',
  'workbench.editors.request.menu.copyAsCurl': 'cURL としてコピー',
  'workbench.editors.request.menu.copyAsFetch': 'fetch としてコピー',
  'workbench.editors.request.convert.menu': 'GraphQL リクエストに変換',
  'workbench.editors.request.convert.title': 'GRAPHQL リクエストに変換',
  'workbench.editors.request.convert.body':
    '「{name}」は同じ場所で GraphQL リクエストになります。ヘッダー、認可、スクリプト、設定、ドキュメントは引き継がれ、HTTP リクエストは削除されます。',
  'workbench.editors.request.convert.noteParamsFolded': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 件のクエリパラメーターが URL に畳み込まれます。',
    }),
  'workbench.editors.request.convert.noteDisabledParamsDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 件の無効化されたクエリパラメーターは破棄されます。GraphQL リクエストは何も保持しません。',
    }),
  'workbench.editors.request.convert.noteMethodChanged':
    '{method} メソッドは POST になります。GraphQL の操作はすべて POST します。',
  'workbench.editors.request.convert.noteExamples': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 件の保存済みレスポンスが新しいリクエストの下に移動します。',
    }),
  'workbench.editors.request.convert.ok': '変換',
  'workbench.editors.request.convert.notConvertible': 'ボディが GraphQL のリクエストだけを変換できます。',
  'workbench.editors.request.convert.saveFirst': '変換する前にリクエストを保存してください。',
  'workbench.editors.request.convert.failed': 'リクエストを変換できませんでした。',
  'workbench.editors.request.convert.failedDetail': 'リクエストを変換できませんでした：{message}',
  'workbench.editors.request.convert.done': '「{name}」を GraphQL リクエストに変換しました。',
  'workbench.editors.request.schemeHint':
    'URL にスキームがありません。https:// として送信されます。URL バーをクリックして Tab または Enter を押すと確定します。',

  // ── Request editor tab registry ────────────────────────────────────
  'workbench.editors.request.tab.docs': 'Docs',
  'workbench.editors.request.tab.params': 'Params',
  'workbench.editors.request.tab.authorization': '認可',
  'workbench.editors.request.tab.headers': 'ヘッダー',
  'workbench.editors.request.tab.body': 'ボディ',
  'workbench.editors.request.tab.scripts': 'スクリプト',
  'workbench.editors.request.tab.settings': '設定',
  'workbench.editors.request.spec.selectLabel': 'OpenAPI 仕様',
  'workbench.editors.request.spec.none': 'このリクエストにリンクされた OpenAPI 仕様はありません。',
  'workbench.editors.request.spec.selectPlaceholder': 'OpenAPI 仕様をリンク…',
  'workbench.editors.request.spec.inheritedPlaceholder': 'コレクションから継承：{name}',
  'workbench.editors.request.spec.fromCollection': 'コレクション {name} から',
  'workbench.editors.request.spec.missing': 'リンクされた仕様はもうこのワークスペースにありません。',
  'workbench.editors.request.spec.parseFailure': '仕様を解析できませんでした：{message}',
  'workbench.editors.request.spec.drifted': 'このコレクションが生成された後に仕様が変更されました。',
  'workbench.editors.request.spec.operation': '操作',
  'workbench.editors.request.spec.noOperation': '仕様内に {method} {url} に一致する操作はありません。',
  'workbench.editors.request.spec.inSync': '仕様と同期しています。',
  'workbench.editors.request.spec.fieldDiffers': '{field} が仕様と異なります。',
  'workbench.editors.request.spec.apply': '適用',
  'workbench.editors.request.spec.applyAll': 'すべて適用',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'URL を入力するかテキストを貼り付け',
  'workbench.editors.request.url.socketCta':
    'ソケット形式の URL です。Unix ソケットの設定を通じて {path} にダイヤルして送信します。',
  'workbench.editors.request.url.socketCtaApply': '適用',
  'workbench.editors.request.method.customGroup': 'カスタム',
  'workbench.editors.request.method.usePrefix': '使用：',
  'workbench.editors.request.method.forbiddenSuffix': 'はブラウザーから送信できません。',
  'workbench.editors.request.method.invalidHint': 'メソッドに使えるのは英字、数字、ハイフンです（最大 32 文字）。',
  'workbench.editors.request.method.removeCustomAria': 'カスタムメソッド {method} を削除',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': '認可へ移動',
  'workbench.editors.request.goToBody': 'ボディへ移動',
  'workbench.editors.request.headers.keyPlaceholder': 'ヘッダー',
  'workbench.editors.request.headers.hideAuto': '自動生成されたヘッダーを隠す',
  'workbench.editors.request.headers.hiddenCount': '{count} 件非表示',
  'workbench.editors.request.headers.autoInfo':
    'これらのヘッダーは自動的に追加され、リクエストとともに送信されます。行の情報アイコンをクリックするとヘッダーごとの詳細が表示されます。',
  'workbench.editors.request.headers.duplicateAuthOverride':
    'これは重複したヘッダーで、認可の設定が生成する {header} ヘッダーによって上書きされます。',
  'workbench.editors.request.headers.calculated': '<calculated when request is sent>',
  'workbench.editors.request.headers.browserUserAgent': '<browser user agent>',
  'workbench.editors.request.headers.hint.cacheControl':
    '「Cache-Control: no-cache」はブラウザーホストからのすべての送信に付きます。リクエストを繰り返してもサーバーが古いキャッシュから応答しないようにするためです。別の値を送るには独自の Cache-Control 行を追加してください。',
  'workbench.editors.request.headers.hint.contentType':
    'ランタイムはボディのエンコーディングから Content-Type を計算します（form-data → boundary 付きの multipart/form-data、x-www-form-urlencoded → application/x-www-form-urlencoded、raw JSON → application/json など）。上書きするには独自のヘッダーを設定してください。',
  'workbench.editors.request.headers.hint.contentLength':
    'Content-Length はリクエストの送信前にシリアライズされたボディのバイトサイズから計算されます。ブラウザーは、実際のボディ長と一致しないユーザー設定の Content-Length を受け付けません。',
  'workbench.editors.request.headers.hint.host':
    'ブラウザーは対象 URL から Host を導出し、ユーザーランドのコードによる上書きを許可しません。',
  'workbench.editors.request.headers.hint.userAgent':
    'User-Agent はクライアントを識別します。リクエストはブラウザー自身の User-Agent で送信されます。上書きするには下に独自の User-Agent 行を追加してください。',
  'workbench.editors.request.headers.hint.accept':
    'Accept はクライアントが解析できるメディアタイプをサーバーに伝えます。`*/*` はサーバーに選ばせます。レスポンスを絞るには、より狭い集合（例：`application/json`）で上書きしてください。',
  'workbench.editors.request.headers.hint.acceptEncoding':
    'ブラウザーが対応する圧縮アルゴリズムです。ブラウザーが設定し、接続ごとにネゴシエートされます。ユーザーランドからは上書きできません。',
  'workbench.editors.request.headers.hint.connection':
    'HTTP/1.1 の接続再利用です。ブラウザーが接続プールを管理し、ユーザーランドのコードによるこのヘッダーの上書きを許可しません。',
  'workbench.editors.request.headers.hint.node.host':
    'リクエストの送信時に対象 URL から導出されます。独自の Host 行があればワイヤー上でそれに置き換わります。',
  'workbench.editors.request.headers.hint.node.connection':
    'node ランタイムは接続を維持し、オリジンごとにプールします。独自の Connection 行があればそれに置き換わります。',
  'workbench.editors.request.headers.hint.node.acceptLanguage':
    'node ランタイムの fetch クライアントはワイルドカードを送信します。独自の行があればそれに置き換わります。',
  'workbench.editors.request.headers.hint.node.secFetchMode':
    'node ランタイムの fetch クライアントが送信のたびに刻印します。独自の行があればそれに置き換わります。',
  'workbench.editors.request.headers.hint.node.userAgent':
    'node ランタイムは送信のたびにこのアプリを名乗ります。別のものを送るには独自の User-Agent 行を追加してください。',
  'workbench.editors.request.headers.hint.node.acceptEncoding':
    'node ランタイムが受け入れて代わりにデコードする圧縮です。独自の行があればそれに置き換わり、レスポンスボディは送られたままの形で届きます。',

  // ── Auth preview rows (Headers/Params generated rows) ──────────────
  'workbench.editors.request.authPreview.basicValue': 'Basic <credentials>',
  'workbench.editors.request.authPreview.bearerValue': 'Bearer <token>',
  'workbench.editors.request.authPreview.apiKeyValue': '<value>',
  'workbench.editors.request.authPreview.accessTokenValue': '<access token>',
  'workbench.editors.request.authPreview.bearerAccessTokenValue': 'Bearer <access token>',
  'workbench.editors.request.authPreview.basicHint':
    '認可タブ（Basic Auth）から生成されます。リクエストの送信時にユーザー名とパスワードが base64 エンコードされてこのヘッダーに入ります。',
  'workbench.editors.request.authPreview.bearerHint':
    '認可タブ（Bearer Token）から生成されます。リクエストの送信時にトークンがこのヘッダーに追加されます。',
  'workbench.editors.request.authPreview.apiKeyHeaderHint':
    '認可タブ（API Key）から生成されます。リクエストの送信時に値がこのヘッダーに追加されます。',
  'workbench.editors.request.authPreview.apiKeyQueryHint':
    '認可タブ（API Key）から生成されます。リクエストの送信時に値がこのクエリパラメーターに追加されます。',
  'workbench.editors.request.authPreview.oauth2HeaderHint':
    '認可タブ（OAuth 2.0）から生成されます。リクエストの送信時にアクセストークンがこのヘッダーに追加されます。',
  'workbench.editors.request.authPreview.oauth2QueryHint':
    '認可タブ（OAuth 2.0）から生成されます。リクエストの送信時にアクセストークンがリクエスト URL に付加されます。',
  'workbench.editors.request.authPreview.awsSigV4Value': 'AWS4-HMAC-SHA256 <signature>',
  'workbench.editors.request.authPreview.awsSigV4DateValue': '<request timestamp>',
  'workbench.editors.request.authPreview.awsSigV4Hint':
    '認可タブ（AWS Signature v4）から生成されます。送信時にリクエストがあなたの資格情報で署名されます。',
  'workbench.editors.request.authPreview.awsSigV4DateHint':
    '認可タブ（AWS Signature v4）から生成されます。リクエストの送信時に署名タイムスタンプがこのヘッダーに追加されます。',
  'workbench.editors.request.authPreview.awsSigV4QueryValue': '<signed parameters>',
  'workbench.editors.request.authPreview.awsSigV4QueryHint':
    '認可タブ（AWS Signature v4）から生成されます。リクエストの送信時に X-Amz-* パラメーターが URL クエリに追加されます。',
  'workbench.editors.request.authPreview.edgeGridValue': 'EG1-HMAC-SHA256 <signed parameters>',
  'workbench.editors.request.authPreview.edgeGridHint':
    '認可タブ（Akamai EdgeGrid）から生成されます。送信時にリクエストがあなたの資格情報で署名されます。',
  'workbench.editors.request.authPreview.asapValue': 'Bearer <signed JWT>',
  'workbench.editors.request.authPreview.asapHint':
    '認可タブ（ASAP）から生成されます。リクエストの送信時に新しいトークンが秘密鍵で署名され、このヘッダーに追加されます。',
  'workbench.editors.request.authPreview.httpSignatureInputValue': 'sig1=(<covered components>);created=…',
  'workbench.editors.request.authPreview.httpSignatureValue': 'sig1=:<signature>:',
  'workbench.editors.request.authPreview.httpSignatureHint':
    '認可タブ（HTTP Message Signature）から生成されます。送信時にリクエストがあなたの鍵で署名されます。',
  'workbench.editors.request.authPreview.httpSignatureDigestValue': 'sha-256=:<digest of the body>:',
  'workbench.editors.request.authPreview.httpSignatureDigestHint':
    '認可タブ（HTTP Message Signature）から生成されます。リクエストの送信時にボディのダイジェストが計算されます。',
  'workbench.editors.request.authPreview.digestValue': 'Digest <challenge response>',
  'workbench.editors.request.authPreview.digestHint':
    '認可タブ（Digest Auth）から生成されます。リクエストの送信時にサーバーのチャレンジから値が計算され、それを付けてリクエストが再送されます。',
  'workbench.editors.request.authPreview.oauth1Value': 'OAuth <signed parameters>',
  'workbench.editors.request.authPreview.oauth1Hint':
    '認可タブ（OAuth 1.0）から生成されます。送信時にリクエストがあなたの資格情報で署名されます。',
  'workbench.editors.request.authPreview.oauth1QueryValue': '<signed parameters>',
  'workbench.editors.request.authPreview.oauth1QueryHint':
    '認可タブ（OAuth 1.0）から生成されます。リクエストの送信時に oauth_* パラメーターが URL クエリに追加されます。',
  'workbench.editors.request.authPreview.hawkValue': 'Hawk <signed parameters>',
  'workbench.editors.request.authPreview.hawkHint':
    '認可タブ（Hawk Authentication）から生成されます。送信時にリクエストがあなたの資格情報で署名されます。',
  'workbench.editors.request.authPreview.jwtValue': '<signed JWT>',
  'workbench.editors.request.authPreview.jwtHint':
    '認可タブ（JWT Bearer）から生成されます。リクエストの送信時にトークンが署名され、このヘッダーに追加されます。',
  'workbench.editors.request.authPreview.jwtQueryHint':
    '認可タブ（JWT Bearer）から生成されます。リクエストの送信時にトークンが署名され、このクエリパラメーターに追加されます。',
  'workbench.editors.request.authPreview.inheritedFrom': '{source} から継承。親で編集してください。',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': '認可の種類',
  'workbench.editors.request.auth.group.credentials': '資格情報',
  'workbench.editors.request.auth.group.token': 'トークン',
  'workbench.editors.request.auth.group.signing': '署名',
  'workbench.editors.request.auth.group.consumer': 'コンシューマー',
  'workbench.editors.request.auth.group.attributes': '属性',
  'workbench.editors.request.auth.group.delivery': '配送',
  'workbench.editors.request.auth.group.challenge': 'チャレンジ',
  'workbench.editors.request.auth.group.grant': 'グラント',
  'workbench.editors.request.auth.group.advanced': '詳細',
  'workbench.editors.request.auth.group.coverage': '対象範囲',
  'workbench.editors.request.auth.group.parameters': 'パラメーター',
  'workbench.editors.request.auth.typeInfo.none':
    '何も追加されません。リクエストはヘッダータブと Params タブに表示されているとおりに送信されます。',
  'workbench.editors.request.auth.typeInfo.basic':
    'ユーザー名とパスワードをコロンで結合して base64 エンコードし、送信のたびに Authorization: Basic ヘッダーとして送ります。エンコードされるだけで暗号化はされないため、HTTPS 上でのみ使ってください。',
  'workbench.editors.request.auth.typeInfo.bearer':
    '送信のたびに、Authorization ヘッダーの Bearer スキームの後にトークンがそのまま送られます。',
  'workbench.editors.request.auth.typeInfo.apiKey':
    'キーがヘッダーまたはクエリパラメーターの名前を指定し、値がその中に乗ります。多くの公開 API が使う平文資格情報のスキームです。',
  'workbench.editors.request.auth.typeInfo.digest':
    '最初の送信でサーバーの 401 チャレンジ（realm、nonce、qop）を引き出し、資格情報をそれとハッシュして response= に入れ、リクエストを再試行します。パスワード自体は決して送られません。',
  'workbench.editors.request.auth.typeInfo.oauth1':
    'コンシューマーとトークンの資格情報が、メソッド、URL、パラメーターからなるベース文字列に署名します。署名された oauth_* パラメーターは Authorization ヘッダーまたは URL に乗り、nonce、タイムスタンプ、バージョンは送信ごとに生成されます。',
  'workbench.editors.request.auth.typeInfo.hawk':
    'メソッド、URL、タイムスタンプ、nonce、省略可能な属性に対する MAC が Authorization: Hawk ヘッダーに乗ります。タイムスタンプと nonce は送信ごとに生成されます。',
  'workbench.editors.request.auth.typeInfo.jwt':
    'ここにある鍵素材（下のヘッダー、ペイロード、署名）から送信ごとに新しい JWT が生成・署名され、ベアラートークンまたはクエリパラメーターとして配送されます。',
  'workbench.editors.request.auth.groupInfo.basic.credentials':
    'base64 資格情報になる組です。両方とも送信され、エンコードはされますが暗号化はされません。',
  'workbench.editors.request.auth.groupInfo.bearer.token':
    'サーバーが発行したままのトークンです。ワイヤー上では Bearer スキームが前に付きます。',
  'workbench.editors.request.auth.groupInfo.apiKey.credentials':
    '名前とシークレットです。名前がヘッダーまたはパラメーターで、値がその中に乗るものです。',
  'workbench.editors.request.auth.groupInfo.apiKey.delivery':
    'キーの行き先です。リクエストヘッダー、または URL に付加されるクエリパラメーター。',
  'workbench.editors.request.auth.groupInfo.digest.credentials':
    'チャレンジレスポンスの計算元になる組です。ユーザー名は送られ、パスワードはレスポンスハッシュの一部としてのみ使われます。',
  'workbench.editors.request.auth.groupInfo.digest.challenge':
    'デスクトップと CLI の送信で 401 の往復をどう扱うかです。無効にしない限り、自動的に応答して再試行します。',
  'workbench.editors.request.auth.groupInfo.oauth1.signing':
    'ベース文字列に署名する方式（シークレットによる HMAC、秘密鍵による RSA、または PLAINTEXT）と、ボディをハッシュして含めるかどうかです。',
  'workbench.editors.request.auth.groupInfo.oauth1.consumer':
    'アプリケーションの資格情報です。キーは oauth_consumer_key として送られ、シークレット（または秘密鍵）は oauth_signature を通じてのみ使われます。',
  'workbench.editors.request.auth.groupInfo.oauth1.token':
    'three-legged フローで得たユーザーのアクセストークンの組です。one-legged の呼び出しでは両方とも空にしてください。',
  'workbench.editors.request.auth.groupInfo.oauth1.delivery':
    'oauth_* パラメーターの行き先です。Authorization ヘッダー（省略可能な realm 付き）または URL のクエリ文字列。',
  'workbench.editors.request.auth.groupInfo.hawk.credentials':
    'id はヘッダーに乗ります。キーはそれが計算する MAC を通じてのみ使われます。',
  'workbench.editors.request.auth.groupInfo.hawk.signing':
    'MAC のダイジェストと、リクエストボディをハッシュして hash= として含めるかどうかです。',
  'workbench.editors.request.auth.groupInfo.hawk.attributes':
    'スキームの省略可能な属性です。アプリケーションデータ（ext）、アプリケーション id（app）、委譲元（dlg）。存在すれば署名されます。',
  'workbench.editors.request.auth.groupInfo.jwt.signing':
    'JWT ヘッダーで名指しされるアルゴリズムと、署名する鍵素材です。HS では共有シークレット、RS / PS / ES では秘密鍵。',
  'workbench.editors.request.auth.groupInfo.jwt.token':
    'JWT が運ぶものです。ペイロードのクレーム、追加の保護ヘッダー、そして iat / exp として刻印される省略可能な有効期間。',
  'workbench.editors.request.auth.groupInfo.jwt.delivery':
    '署名済み JWT の行き先です。プレフィックスの後ろの Authorization ヘッダー、または token クエリパラメーター。',
  'workbench.editors.request.auth.rowInfo.basicUsername': 'base64 資格情報のコロンの前に乗ります。',
  'workbench.editors.request.auth.rowInfo.basicPassword':
    'コロンの後に乗ります。エンコードされるだけで暗号化はされないため、HTTPS 上でのみ使ってください。',
  'workbench.editors.request.auth.rowInfo.bearerToken':
    'Bearer の後にそのまま送られます。貼り付けた「Bearer …」はここでプレフィックスが取り除かれます。',
  'workbench.editors.request.auth.rowInfo.apiKeyKey': '値が乗るヘッダー名またはクエリパラメーター名です。',
  'workbench.editors.request.auth.rowInfo.apiKeyValue':
    'ヘッダーの値またはパラメーターの値として送られるシークレットです。',
  'workbench.editors.request.auth.rowInfo.apiKeyAddTo':
    '「ヘッダー」はキーをリクエストに載せます。「クエリパラメーター」は URL に付加するため、ログに残ります。',
  'workbench.editors.request.auth.rowInfo.digestUsername': 'チャレンジへの応答に username= として乗ります。',
  'workbench.editors.request.auth.rowInfo.digestPassword':
    '決して送られません。realm、nonce、メソッドとともにハッシュされて response= になります。',
  'workbench.editors.request.auth.rowInfo.digestDisableRetry':
    '自動の 2 回目の往復を止めます。401 に応答する代わりに、それがレスポンスとして返されます。',
  'workbench.editors.request.auth.rowInfo.oauth1SignatureMethod':
    'oauth_signature_method で署名アルゴリズムを名指しし、下の資格情報セットを選びます。',
  'workbench.editors.request.auth.rowInfo.oauth1BodyHash':
    'フォーム以外のボディをその方式のハッシュで要約して oauth_body_hash に入れ、残りとともに署名します。',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerKey':
    'アプリケーションを識別します。oauth_consumer_key として送られます。',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerSecret':
    'トークンシークレットとともにリクエストに署名します。決して送られず、oauth_signature だけが送られます。',
  'workbench.editors.request.auth.rowInfo.oauth1PrivateKey':
    'RSA 方式でベース文字列に署名する PEM 鍵です。署名だけが送られます。',
  'workbench.editors.request.auth.rowInfo.oauth1Token':
    'ユーザーのアクセストークンです。oauth_token として送られます。one-legged の呼び出しでは空にします。',
  'workbench.editors.request.auth.rowInfo.oauth1TokenSecret':
    '署名鍵の後半です。決して送られず、oauth_signature だけが送られます。',
  'workbench.editors.request.auth.rowInfo.oauth1AddTo':
    '「ヘッダー」は oauth_* パラメーターを Authorization ヘッダーで運びます。「クエリパラメーター」は URL に付加します。',
  'workbench.editors.request.auth.rowInfo.oauth1Realm':
    'ヘッダーの先頭に realm= として反映され、保護空間を名指しします。',
  'workbench.editors.request.auth.rowInfo.hawkAuthId': '資格情報を識別します。ヘッダーに id= として乗ります。',
  'workbench.editors.request.auth.rowInfo.hawkAuthKey': 'mac= を計算する共有シークレットです。決して送られません。',
  'workbench.editors.request.auth.rowInfo.hawkAlgorithm': 'MAC とペイロードハッシュが使う HMAC ダイジェストです。',
  'workbench.editors.request.auth.rowInfo.hawkPayloadHash':
    'ボディとそのコンテンツタイプをハッシュして hash= に入れ、ペイロードを署名に結び付けます。',
  'workbench.editors.request.auth.rowInfo.hawkExt': 'アプリケーション固有のデータです。ext= として乗り、署名されます。',
  'workbench.editors.request.auth.rowInfo.hawkApp': 'アプリケーション id です。app= として乗り、署名されます。',
  'workbench.editors.request.auth.rowInfo.hawkDlg':
    '委譲元のアプリケーション id です。app= の後に dlg= として乗り、署名されます。',
  'workbench.editors.request.auth.rowInfo.jwtAlgorithm':
    '保護ヘッダーに alg として書き込まれ、下の鍵フィールドを選びます。',
  'workbench.editors.request.auth.rowInfo.jwtSecret': '署名を生成する共有 HMAC シークレットです。決して送られません。',
  'workbench.editors.request.auth.rowInfo.jwtSecretBase64':
    'その形式で発行されたシークレットのために、署名前にシークレットを base64 からデコードします。',
  'workbench.editors.request.auth.rowInfo.jwtPrivateKey':
    'RS / PS / ES の署名を生成する PEM 秘密鍵です。署名だけが送られます。',
  'workbench.editors.request.auth.rowInfo.jwtPayload':
    'JSON としてのクレームです。テンプレートは送信ごとに解決されます。ここで設定した iat や exp は有効期間より優先されます。',
  'workbench.editors.request.auth.rowInfo.jwtHeaders':
    'JSON としての追加の保護ヘッダーです（よくあるのは kid）。alg と typ は自動的に追加されます。',
  'workbench.editors.request.auth.rowInfo.jwtExpiresIn':
    '署名時に iat と exp をペイロードに刻印し、送信のたびに新しい有効期間を運びます。',
  'workbench.editors.request.auth.rowInfo.jwtAddTo':
    '「ヘッダー」は JWT を Authorization ヘッダーで送ります。「クエリパラメーター」は URL に token= として付加します。',
  'workbench.editors.request.auth.rowInfo.jwtHeaderPrefix':
    'Authorization ヘッダーで JWT の前に付くスキームです。デフォルトは Bearer。空にするとトークンだけを送ります。',
  'workbench.editors.request.auth.typeInfo.awsSigV4':
    'シークレットキーがメソッド、パス、クエリ、ヘッダー、ペイロードハッシュに署名します。署名は X-Amz-Date とともに Authorization: AWS4-HMAC-SHA256 ヘッダーに乗るか、X-Amz-* クエリパラメーターとして乗ります。秘密のものは何も送られません。',
  'workbench.editors.request.auth.groupInfo.awsSigV4.credentials':
    'アクセスキーは Credential= に乗り、シークレットキーはそれが計算する署名を通じてのみ使われます。セッショントークンは一時的な資格情報のために X-Amz-Security-Token として乗ります。',
  'workbench.editors.request.auth.groupInfo.awsSigV4.signing':
    '署名鍵の導出に使う資格情報スコープ（サービスとリージョン）です。どちらかを空にすると AWS ホスト名から導出されます（リージョンは us-east-1 にフォールバック）。',
  'workbench.editors.request.auth.groupInfo.awsSigV4.delivery':
    '署名の行き先です。X-Amz-Date 付きの Authorization ヘッダー、またはヘッダーを受け付けないエンドポイント向けの X-Amz-* クエリパラメーター。',
  'workbench.editors.request.auth.rowInfo.awsAccessKey':
    'キーペアを識別します。スコープの前の Credential= に乗ります。',
  'workbench.editors.request.auth.rowInfo.awsSecretKey': '署名鍵の導出元になる鍵素材です。決して送られません。',
  'workbench.editors.request.auth.rowInfo.awsSessionToken':
    'STS セッショントークンです。一時的な資格情報の場合にのみ、署名されて X-Amz-Security-Token として乗ります。',
  'workbench.editors.request.auth.rowInfo.awsService':
    '資格情報スコープのサービス（s3、execute-api、…）です。空にすると AWS ホスト名から導出されます。s3 はさらにペイロードハッシュをヘッダーとして署名します。',
  'workbench.editors.request.auth.rowInfo.awsRegion':
    '資格情報スコープのリージョンです。空にすると AWS ホスト名から導出され、なければ us-east-1 になります。',
  'workbench.editors.request.auth.rowInfo.awsAddTo':
    'ヘッダー（デフォルト）、または URL クエリです。後者はヘッダーを受け付けないエンドポイント向けの presigned 形式です。',
  'workbench.editors.request.auth.typeInfo.edgeGrid':
    'クライアントシークレットがメソッド、スキーム、ホスト、パス、列挙したヘッダー、POST ボディのハッシュに署名します。トークン、送信ごとのタイムスタンプと nonce、署名が Authorization: EG1-HMAC-SHA256 ヘッダーに乗ります。シークレットは決して送られません。',
  'workbench.editors.request.auth.groupInfo.edgeGrid.credentials':
    '2 つのトークンは client_token= と access_token= としてヘッダーに乗ります。クライアントシークレットはそれが導出する署名を通じてのみ使われます。',
  'workbench.editors.request.auth.groupInfo.edgeGrid.signing':
    'リクエスト行を超えて署名が対象にするものです。API が名指しするヘッダーをその順番で、そしてバイトウィンドウ（API が別途定めない限りスキームの 128 KiB）で区切られた POST ボディのハッシュ。',
  'workbench.editors.request.auth.rowInfo.edgeGridClientToken':
    'API クライアントを識別します。client_token= として乗ります。',
  'workbench.editors.request.auth.rowInfo.edgeGridAccessToken': '資格情報を識別します。access_token= として乗ります。',
  'workbench.editors.request.auth.rowInfo.edgeGridClientSecret':
    '送信ごとの署名鍵の導出元になる鍵素材です。決して送られません。',
  'workbench.editors.request.auth.rowInfo.edgeGridHeadersToSign':
    '署名に畳み込むヘッダー名です。カンマ区切りで署名順に並べます。列挙したがリクエストにないヘッダーは飛ばされ、列挙していないヘッダーは決して署名されません。',
  'workbench.editors.request.auth.rowInfo.edgeGridMaxBodySize':
    'コンテンツハッシュが対象にする POST ボディのバイトウィンドウです。空 = スキームの 131072。',
  'workbench.editors.request.auth.typeInfo.asap':
    '送信ごとに新しい JWT が生成されます。発行者、対象者、サブジェクトをクレームとして、iat / exp を時計から、一意の jti nonce を持ち、kid ヘッダーの下で秘密鍵により署名され、ベアラートークンとして配送されます。鍵は決して送られません。',
  'workbench.editors.request.auth.groupInfo.asap.signing':
    'JWT ヘッダーで名指しされる非対称のファミリー、受信側が公開鍵を探すための鍵 id、そして署名する秘密鍵です。',
  'workbench.editors.request.auth.groupInfo.asap.token':
    'トークンが主張するものです。誰が発行し、誰宛てで、誰の代理で、追加のクレームは何か、どれだけ生きるか（デフォルトはスキームの上限である 1 時間）。',
  'workbench.editors.request.auth.rowInfo.asapAlgorithm':
    'ヘッダーで署名ファミリーを名指しします。HS はスキームで許可されていません。',
  'workbench.editors.request.auth.rowInfo.asapKeyId':
    'kid として乗ります。スキームのレイアウトでは issuer/key-name です。受信側はこれで公開鍵を取得します。',
  'workbench.editors.request.auth.rowInfo.asapPrivateKey':
    '署名する PEM（または Atlassian の data:application/pkcs8 形式）です。決して送られません。',
  'workbench.editors.request.auth.rowInfo.asapIssuer': '登録済みのサービス識別子です。iss として乗ります。',
  'workbench.editors.request.auth.rowInfo.asapAudience':
    'トークンの宛先です。aud として乗ります。配列にするには「追加のクレーム」を使います。',
  'workbench.editors.request.auth.rowInfo.asapSubject':
    '誰の代理かです。sub として乗ります。空にすると発行者を送ります。',
  'workbench.editors.request.auth.rowInfo.asapClaims':
    '最後にマージされる追加のクレームです。jti / iat / exp を含め、合成されたすべてのクレームより優先されます。',
  'workbench.editors.request.auth.rowInfo.asapExpiresIn':
    'exp − iat として刻印される有効期間です。空 = 3600、スキームの上限。',
  'workbench.editors.request.auth.typeInfo.httpSignature':
    'リクエストは送信時に署名されます（RFC 9421）。対象コンポーネント（メソッド、ターゲット、名指ししたヘッダー、ボディの Content-Digest）と署名パラメーターから署名ベースを組み立て、鍵で署名し、Signature-Input と Signature として配送します。鍵は決して送られません。',
  'workbench.editors.request.auth.groupInfo.httpSignature.signing':
    '登録済みのアルゴリズム、検証側が鍵を探すための鍵 id、そして署名する鍵（PEM 秘密鍵、または hmac-sha256 での共有シークレット）です。',
  'workbench.editors.request.auth.groupInfo.httpSignature.coverage':
    '署名が対象にするものです。署名順のコンポーネント（@method や @target-uri のような派生のもの、名前によるヘッダーフィールド）と、対象に含めるためにボディの Content-Digest を生成するかどうか。',
  'workbench.editors.request.auth.groupInfo.httpSignature.parameters':
    '@signature-params のメタデータです。両ヘッダーが運ぶラベル、created / expires の時刻、送信ごとの nonce、alg パラメーター、アプリケーションタグ。',
  'workbench.editors.request.auth.rowInfo.httpSigAlgorithm':
    '登録済みの 6 つのアルゴリズムのいずれかです。検証側は対応する鍵を持っている必要があります。RFC 自身の例は rsa-pss-sha512 が先頭です。',
  'workbench.editors.request.auth.rowInfo.httpSigKeyId':
    'keyid として乗ります。検証側はこれで公開鍵（またはシークレット）を取得します。空にするとパラメーターを省略します。',
  'workbench.editors.request.auth.rowInfo.httpSigPrivateKey':
    '署名する PEM です。PKCS#8、PKCS#1、または SEC1。決して送られません。',
  'workbench.editors.request.auth.rowInfo.httpSigSecret':
    '検証側と共有するシークレットです。HMAC の鍵になります。決して送られません。',
  'workbench.editors.request.auth.rowInfo.httpSigSecretBase64':
    'シークレットが base64 テキストなら、署名前に生の鍵バイトにデコードします。',
  'workbench.editors.request.auth.rowInfo.httpSigComponents':
    '空白区切りで署名順に並べます：@method、@target-uri、@authority、@scheme、@request-target、@path、@query、およびヘッダー名。対象に含めたヘッダーがリクエストにないと送信は失敗します。',
  'workbench.editors.request.auth.rowInfo.httpSigContentDigest':
    'content-digest を対象に含められるよう、ボディのバイトに対して Content-Digest を生成します（RFC 9530）。ボディのない送信は空のコンテンツを要約します。multipart ボディは要約できません。',
  'workbench.editors.request.auth.rowInfo.httpSigLabel':
    'Signature-Input と Signature がこの署名を運ぶ辞書キーです。空 = sig1。',
  'workbench.editors.request.auth.rowInfo.httpSigCreated':
    'created = 署名時刻を書き込みます。検証側はこれで古い署名を拒否します。オフにするとパラメーターを省きます（expires も一緒に）。',
  'workbench.editors.request.auth.rowInfo.httpSigExpiresIn':
    'expires = created + この秒数を書き込みます。空にすると有効期限を書きません。',
  'workbench.editors.request.auth.rowInfo.httpSigNonce':
    '送信ごとに新しいランダムな nonce を書き込みます。nonce を追跡する検証側向けのリプレイ防止です。',
  'workbench.editors.request.auth.rowInfo.httpSigIncludeAlg':
    'アルゴリズムを名指しする alg を書き込みます。オフにすると検証側が解決する鍵に委ねます（RFC のデフォルト）。',
  'workbench.editors.request.auth.rowInfo.httpSigTag':
    '検証側が署名を区別できるようにするアプリケーション固有の tag パラメーターです。空にすると省略します。',
  'workbench.editors.request.auth.typeInfo.oauth2':
    'クライアントはプロバイダーからアクセストークンを取得し（ブラウザーでの認可の後にトークン交換、またはマシン向け・パスワードのグラントでは直接の交換）、送信のたびにそれをベアラートークンとして運びます。リフレッシュトークンが発行されていれば期限切れ時に更新されます。',
  'workbench.editors.request.auth.groupInfo.oauth2.token':
    'この構成が今持っているトークンです。送信が Bearer の後に運ぶもの、そして自動で更新するかどうか。',
  'workbench.editors.request.auth.groupInfo.oauth2.grant':
    '新しいトークンの取得方法です。グラント、プロバイダーのエンドポイント、クライアントの ID、そして何を要求するか。',
  'workbench.editors.request.auth.groupInfo.oauth2.advanced':
    'リフレッシュの往復と、プロバイダーへの 3 種類のリクエストそれぞれが運ぶ追加パラメーターです。',
  'workbench.editors.request.auth.groupInfo.oauth2.signing':
    'この構成が生成する JWT です。すべてのトークンリクエストでのクライアントアサーションとして、または JWT ベアラーグラントそのものとして。',
  'workbench.editors.request.auth.rowInfo.oauth2Token':
    '最後のフローが保存したアクセストークンです。送信のたびに Bearer の後に送られます。フローが実行されるまでは空です。',
  'workbench.editors.request.auth.rowInfo.oauth2TokenBinding':
    'DPoP（RFC 9449）は、交換時に生成されたキーペアにトークンを結び付けます。すべてのトークンリクエストとすべての送信は、そのリクエストのメソッドと URL に対して署名された証明を運び、プロバイダーはトークンを DPoP として発行し、そのスキームで送信されます。ヘッダープレフィックスと URL モードは脇に退きます。鍵は保存されたトークンの隣に置かれ、構成には決して入りません。',
  'workbench.editors.request.auth.rowInfo.oauth2DpopAlgorithm':
    '証明の署名ファミリーです。キーペアはそれに合わせて生成されます。ES256 はすべての DPoP 実装が受け入れます。',
  'workbench.editors.request.auth.rowInfo.oauth2HeaderPrefix':
    'Authorization ヘッダーでトークンの前に付くスキームです。空にするとプロバイダーが発行した token_type（デフォルトは Bearer）を送ります。設定するとワイヤー上でそれが優先されます。',
  'workbench.editors.request.auth.rowInfo.oauth2AutoRefresh':
    '期限切れのアクセストークンを送信前に更新します。プロバイダーがリフレッシュトークンを発行していればそれで、そうでなければブラウザーを必要としないグラントを再実行して。',
  'workbench.editors.request.auth.rowInfo.oauth2Status':
    '保存されたトークンがどれだけ有効かです。「今すぐ更新」は今交換し、「切断」は忘れます。',
  'workbench.editors.request.auth.rowInfo.oauth2TokenName':
    'アプリ内でのこのトークンのラベルです。ワイヤーには何も乗りません。',
  'workbench.editors.request.auth.rowInfo.oauth2GrantType':
    'トークン交換の grant_type と、その前にどの往復が実行されるかです。コードグラントではブラウザーでの認可、client、password、JWT ベアラーの資格情報では何もなし。',
  'workbench.editors.request.auth.rowInfo.oauth2CallbackUrl':
    'プロバイダーがコードを付けてブラウザーを送り返す redirect_uri です。プロバイダーに登録してください。',
  'workbench.editors.request.auth.rowInfo.oauth2AuthUrl':
    'ブラウザーが最初に送られるプロバイダーの認可エンドポイントです。',
  'workbench.editors.request.auth.rowInfo.oauth2DeviceAuthUrl':
    'プロバイダーのデバイス認可エンドポイント（RFC 8628）です。ユーザーコードと検証 URL を返し、このホストがトークンエンドポイントをポーリングする間に任意のデバイスで承認します。',
  'workbench.editors.request.auth.rowInfo.oauth2Issuer':
    'プロバイダーの発行者識別子、またはその /.well-known/ メタデータ URL です。「検出」はメタデータ文書（RFC 8414 / OpenID Connect Discovery）を読み、下のエンドポイント行を埋め、あなたの選択について文書が述べていることを列挙します。それ以外は何も変わらず、行はその後もあなたのものです。',
  'workbench.editors.request.auth.rowInfo.oauth2AccessTokenUrl':
    'コード（または資格情報）を交換するプロバイダーのトークンエンドポイントです。',
  'workbench.editors.request.auth.rowInfo.oauth2Username':
    'トークンリクエストのボディで送られるリソースオーナーのユーザー名です。パスワードグラントのみ。',
  'workbench.editors.request.auth.rowInfo.oauth2Password':
    'トークンリクエストのボディで送られるリソースオーナーのパスワードです。パスワードグラントのみ。',
  'workbench.editors.request.auth.rowInfo.oauth2ClientId':
    'アプリケーションを識別します。認可 URL とトークンリクエストに乗ります。',
  'workbench.editors.request.auth.rowInfo.oauth2ClientSecret':
    'トークンエンドポイントでアプリケーションを認証します。「クライアント認証」に従い、ボディまたは Basic ヘッダーで。',
  'workbench.editors.request.auth.rowInfo.oauth2CodeChallengeMethod':
    'PKCE：認可 URL の code_challenge は、フローごとに生成される verifier の S256 ダイジェストです。',
  'workbench.editors.request.auth.rowInfo.oauth2CodeVerifier':
    'フローごとに生成され、同じクライアントが開始したことを証明するためにトークン交換で code_verifier として送られます。',
  'workbench.editors.request.auth.rowInfo.oauth2Scope':
    '要求するスコープです。認可 URL またはトークンリクエストで scope として空白区切りで送られます。',
  'workbench.editors.request.auth.rowInfo.oauth2State':
    'フローごとに生成され、コールバックをこの認可に対応付けるためにプロバイダーから返されます。',
  'workbench.editors.request.auth.rowInfo.oauth2ClientAuthentication':
    'トークンリクエストでクライアントが自身を証明する方法です。フォームボディまたは Authorization: Basic ヘッダーでの資格情報、あるいはシークレットの代わりに署名済みの client_assertion。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionIssuer':
    'グラントアサーションの iss クレームです。プロバイダーが登録したサービスアカウントまたはコンシューマーキー。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionSubject':
    '省略可能な sub クレームです。トークンが代理するユーザー（ドメイン全体の委任、なりすまし）。空にすると送りません。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionClaims':
    'グラントアサーションにマージされ、合成されたものより優先される追加のクレームです。ベンダー固有のクレームや独自のスコープなど。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAlgorithm':
    'アサーションに署名する JWS ファミリーです。秘密鍵には非対称のもの、クライアントシークレットには HS256/384/512。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionKeyId':
    '登録済みの鍵を名指しする kid ヘッダーです。プロバイダーが正しい公開鍵側を選べるようにします。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionPrivateKey':
    '署名鍵です。PEM、生の DER、または data:application/pkcs8 形式。決してエクスポートされません。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAudience':
    'aud クレームです。空にすると Access Token URL を送ります。FAPI と Keycloak は代わりに発行者識別子を求めます。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionLifetime':
    '署名時に刻印される exp − iat です。デフォルトは 300 秒。プロバイダーが上限を設けることがあります（Google：1 時間）。',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionHeaders':
    'アサーションにマージされる追加の保護ヘッダー JSON です。Azure の x5t#S256 証明書サムプリントなど。',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshTokenUrl':
    'リフレッシュ交換の POST 先エンドポイントです。空にすると Access Token URL を意味します。',
  'workbench.editors.request.auth.rowInfo.oauth2AuthRequest':
    '認可 URL に付加される追加パラメーターです（audience、prompt、…）。',
  'workbench.editors.request.auth.rowInfo.oauth2TokenRequest':
    'トークンリクエストの追加パラメーターです。それぞれ「送信先」に従ってフォームボディ、ヘッダー、または URL に乗ります。',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshRequest':
    'リフレッシュリクエストの追加パラメーターです。それぞれ「送信先」に従ってフォームボディ、ヘッダー、または URL に乗ります。',
  'workbench.editors.request.auth.rowInfo.oauth2SendAs':
    '「リクエストヘッダー」は Authorization ヘッダーの Bearer の後にトークンを送ります。「リクエスト URL」は access_token として付加します。これは非推奨で、レガシーなプロバイダー専用です。',
  'workbench.editors.request.auth.type.inherit': '親から認可を継承',
  'workbench.editors.request.auth.type.none': '認可なし',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API Key',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.edgeGrid': 'Akamai EdgeGrid',
  'workbench.editors.request.auth.type.asap': 'ASAP (Atlassian)',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.type.hawk': 'Hawk Authentication',
  'workbench.editors.request.auth.type.jwtBearer': 'JWT Bearer',
  'workbench.editors.request.auth.type.httpSignature': 'HTTP Message Signature',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'consumer key',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'consumer secret',
  'workbench.editors.request.auth.oauth1Token': 'Access Token',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': '省略可。one-legged の呼び出しでは空',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Token Secret',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': '省略可。one-legged の呼び出しでは空',
  'workbench.editors.request.auth.oauth1SignatureMethod': '署名方式',
  'workbench.editors.request.auth.oauth1PrivateKey': '秘密鍵',
  'workbench.editors.request.auth.oauth1PrivateKeyPlaceholder': '{{vault.private_key}} または PEM',
  'workbench.editors.request.auth.oauth1IncludeBodyHash': 'ボディハッシュを含める',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': '省略可',
  'workbench.editors.request.auth.hawkAuthId': 'Hawk Auth ID',
  'workbench.editors.request.auth.hawkAuthIdPlaceholder': 'hawk auth id',
  'workbench.editors.request.auth.hawkAuthKey': 'Hawk Auth Key',
  'workbench.editors.request.auth.hawkAuthKeyPlaceholder': 'hawk auth key',
  'workbench.editors.request.auth.hawkAlgorithm': 'アルゴリズム',
  'workbench.editors.request.auth.hawkExt': 'ext',
  'workbench.editors.request.auth.hawkExtPlaceholder': '省略可。アプリ固有のデータ',
  'workbench.editors.request.auth.hawkApp': 'app',
  'workbench.editors.request.auth.hawkAppPlaceholder': '省略可。アプリケーション ID',
  'workbench.editors.request.auth.hawkDlg': 'dlg',
  'workbench.editors.request.auth.hawkDlgPlaceholder': '省略可。委譲元のアプリケーション ID',
  'workbench.editors.request.auth.hawkIncludePayloadHash': 'ペイロードハッシュを含める',
  'workbench.editors.request.auth.jwtAddTo': 'JWT トークンの追加先',
  'workbench.editors.request.auth.jwtAlgorithm': 'アルゴリズム',
  'workbench.editors.request.auth.jwtSecret': 'シークレット',
  'workbench.editors.request.auth.jwtSecretPlaceholder': 'secret',
  'workbench.editors.request.auth.jwtSecretBase64': 'シークレットは Base64 エンコード済み',
  'workbench.editors.request.auth.jwtPrivateKey': '秘密鍵',
  'workbench.editors.request.auth.jwtPrivateKeyPlaceholder': '{{vault.private_key}} または PEM',
  'workbench.editors.request.auth.jwtPayload': 'Payload',
  'workbench.editors.request.auth.jwtPayloadPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeaders': 'JWT ヘッダー',
  'workbench.editors.request.auth.jwtHeadersPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeadersNote': 'アルゴリズム固有のヘッダーは自動的に追加されます。',
  'workbench.editors.request.auth.jwtHeaderPrefix': 'リクエストヘッダーのプレフィックス',
  'workbench.editors.request.auth.jwtExpiresIn': '有効期間（秒）',
  'workbench.editors.request.auth.jwtExpiresInPlaceholder': '省略可',
  'workbench.editors.request.auth.jwtExpiresInNote':
    '設定すると、送信時に iat と exp がペイロードに刻印されます。ペイロードで設定したクレームが優先されます。',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth はサーバーのチャレンジに 2 回目のリクエストで応答します。これはデスクトップアプリと CLI で実行されます。この面からの送信はそれなしで送られ、サーバーは 401 を返します。',
  'workbench.editors.request.auth.digestRetryNote':
    'デフォルトでは、401 チャレンジに応答してリクエストを自動的に再試行します。これを無効にしますか？',
  'workbench.editors.request.auth.digestDisableRetry': 'はい、リクエストの再試行を無効にする',
  'workbench.editors.request.auth.authAutoGeneratedNote': 'リクエストの送信時に認可ヘッダーが自動的に生成されます。',
  'workbench.editors.request.auth.inheritNote': 'リクエストの送信時に認可ヘッダーが自動的に生成されます。',
  'workbench.editors.request.auth.noneNote': 'このリクエストは認可を使いません。',
  'workbench.editors.request.auth.inheritDetail':
    'このリクエストは親コレクションの認可ヘルパーを使っています。変更するにはコレクションの認可タブを編集してください。',
  'workbench.editors.request.auth.inheritedNone': '認可なし。フォルダーにもコレクションにも何も設定されていません。',
  'workbench.editors.request.auth.sourceCollection': 'コレクション「{name}」',
  'workbench.editors.request.auth.sourceFolder': 'フォルダー「{name}」',
  'workbench.editors.request.auth.groupInherited': '継承',
  'workbench.editors.request.auth.refusalQualifier.inQuery': 'クエリ内',
  'workbench.editors.request.auth.refusalQualifier.inHeader': 'ヘッダー内',
  'workbench.editors.request.auth.refusalQualifier.dpopBound': 'DPoP 鍵に結び付け',
  'workbench.editors.request.auth.groupOwn': 'このリクエスト',
  'workbench.editors.request.auth.groupOwnFolder': 'このフォルダー',
  'workbench.editors.request.auth.optionMissingEntry': 'エントリがありません',
  'workbench.editors.request.auth.danglingPick':
    'このリクエストが選んだエントリはもう存在しません。代わりに最も近いデフォルトが適用されます。',
  'workbench.editors.request.auth.editInParent': '親で編集',
  // The settings rows' inherited line — {source} is the level label
  // above (Collection ‘X’ / Folder ‘X’).
  'workbench.editors.request.settings.inheritedFrom': '{source} から継承',
  'workbench.editors.request.settings.overridesSource': '{source} を上書き（{value}）',
  'workbench.editors.request.settings.settingChainTitle': 'この設定の設定元',
  'workbench.editors.request.settings.settingChainSummary':
    'この項目を設定しているすべてのレベルを、最も外側から順に。最も内側の値が有効になります。',
  'workbench.editors.request.settings.settingChainHeading': 'レベル',
  'workbench.editors.request.settings.thisRequest': 'このリクエスト',
  'workbench.editors.request.settings.thisFolder': 'このフォルダー',
  'workbench.editors.request.auth.resetToInheritedAuth': '継承した認可にリセット',
  'workbench.editors.request.auth.resizeRailAria': '認可種類レールのサイズを変更',
  'workbench.editors.request.auth.username': 'ユーザー名',
  'workbench.editors.request.auth.password': 'パスワード',
  'workbench.editors.request.auth.token': 'Token',
  'workbench.editors.request.auth.key': 'キー',
  'workbench.editors.request.auth.keyPlaceholder': '例：X-API-Key',
  'workbench.editors.request.auth.value': '値',
  'workbench.editors.request.auth.addTo': '追加先',
  'workbench.editors.request.auth.addToHeader': 'ヘッダー',
  'workbench.editors.request.auth.addToQuery': 'クエリパラメーター',
  'workbench.editors.request.auth.usernamePlaceholder': 'username',
  'workbench.editors.request.auth.passwordPlaceholder': 'password',
  'workbench.editors.request.auth.tokenPlaceholder': 'bearer token',
  'workbench.editors.request.auth.valuePlaceholder': 'api key value',
  'workbench.editors.request.auth.awsAccessKey': 'Access Key',
  'workbench.editors.request.auth.awsSecretKey': 'Secret Key',
  'workbench.editors.request.auth.awsSessionToken': 'Session Token',
  'workbench.editors.request.auth.awsService': 'サービス名',
  'workbench.editors.request.auth.awsRegion': 'リージョン',
  'workbench.editors.request.auth.awsAccessKeyPlaceholder': '例：AKIAIOSFODNN7EXAMPLE',
  'workbench.editors.request.auth.awsSecretKeyPlaceholder': 'secret access key',
  'workbench.editors.request.auth.awsSessionTokenPlaceholder': '省略可。一時的な（STS）資格情報のみ',
  'workbench.editors.request.auth.awsServicePlaceholder': 'AWS ホストから自動。例：s3、execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'AWS ホストから自動、なければ us-east-1',
  'workbench.editors.request.auth.edgeGridClientToken': 'Client Token',
  'workbench.editors.request.auth.edgeGridAccessToken': 'Access Token',
  'workbench.editors.request.auth.edgeGridClientSecret': 'Client Secret',
  'workbench.editors.request.auth.edgeGridHeadersToSign': '署名するヘッダー',
  'workbench.editors.request.auth.edgeGridMaxBodySize': 'ボディの最大サイズ',
  'workbench.editors.request.auth.edgeGridClientTokenPlaceholder': '例：akab-client-token-xxx',
  'workbench.editors.request.auth.edgeGridAccessTokenPlaceholder': '例：akab-access-token-xxx',
  'workbench.editors.request.auth.edgeGridClientSecretPlaceholder': 'client secret',
  'workbench.editors.request.auth.edgeGridHeadersToSignPlaceholder': '省略可。カンマ区切り。例：X-Test1, X-Test2',
  'workbench.editors.request.auth.edgeGridMaxBodySizePlaceholder': '131072',
  'workbench.editors.request.auth.asapAlgorithm': 'アルゴリズム',
  'workbench.editors.request.auth.asapKeyId': 'Key ID',
  'workbench.editors.request.auth.asapPrivateKey': '秘密鍵',
  'workbench.editors.request.auth.asapIssuer': '発行者',
  'workbench.editors.request.auth.asapAudience': '対象者',
  'workbench.editors.request.auth.asapSubject': 'サブジェクト',
  'workbench.editors.request.auth.asapClaims': '追加のクレーム',
  'workbench.editors.request.auth.asapExpiresIn': '有効期限（秒）',
  'workbench.editors.request.auth.asapKeyIdPlaceholder': '例：my-service/key-1',
  'workbench.editors.request.auth.asapPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- … または data:application/pkcs8 形式',
  'workbench.editors.request.auth.asapIssuerPlaceholder': '例：my-service',
  'workbench.editors.request.auth.asapAudiencePlaceholder': '例：api.openheaders.io',
  'workbench.editors.request.auth.asapSubjectPlaceholder': '省略可。空にすると発行者を送ります',
  'workbench.editors.request.auth.asapClaimsPlaceholder': '省略可。JSON。例：{"scope":"read"}',
  'workbench.editors.request.auth.asapExpiresInPlaceholder': '3600',
  'workbench.editors.request.auth.httpSigAlgorithm': 'アルゴリズム',
  'workbench.editors.request.auth.httpSigKeyId': 'Key ID',
  'workbench.editors.request.auth.httpSigPrivateKey': '秘密鍵',
  'workbench.editors.request.auth.httpSigSecret': '共有シークレット',
  'workbench.editors.request.auth.httpSigSecretBase64': 'シークレットは base64 エンコード済み',
  'workbench.editors.request.auth.httpSigComponents': '対象コンポーネント',
  'workbench.editors.request.auth.httpSigContentDigest': 'Content Digest',
  'workbench.editors.request.auth.httpSigDigestNone': 'なし',
  'workbench.editors.request.auth.httpSigLabel': 'ラベル',
  'workbench.editors.request.auth.httpSigCreated': 'Created タイムスタンプ',
  'workbench.editors.request.auth.httpSigExpiresIn': '有効期限までの秒数',
  'workbench.editors.request.auth.httpSigNonce': 'Nonce',
  'workbench.editors.request.auth.httpSigIncludeAlg': 'アルゴリズムパラメーター（alg）',
  'workbench.editors.request.auth.httpSigTag': 'Tag',
  'workbench.editors.request.auth.httpSigKeyIdPlaceholder': '例：my-service-key-1',
  'workbench.editors.request.auth.httpSigPrivateKeyPlaceholder': '-----BEGIN PRIVATE KEY----- (PEM)',
  'workbench.editors.request.auth.httpSigSecretPlaceholder': '検証側と共有するシークレット',
  'workbench.editors.request.auth.httpSigLabelPlaceholder': 'sig1',
  'workbench.editors.request.auth.httpSigExpiresInPlaceholder': '省略可。例：300',
  'workbench.editors.request.auth.httpSigTagPlaceholder': '省略可。アプリケーションタグ',
  'workbench.editors.request.auth.sendAsLabel': '認可データの追加先',
  'workbench.editors.request.auth.sendAsHeaders': 'リクエストヘッダー',
  'workbench.editors.request.auth.sendAsUrl': 'リクエスト URL',
  'workbench.editors.request.auth.presetLabel': 'プロバイダープリセット',
  'workbench.editors.request.auth.presetInfo':
    'プロバイダーを選ぶと、その認可/トークンエンドポイント、デフォルトのスコープ、推奨フローが事前入力されます。すべて手動で構成するには「カスタム」を選んでください。',
  'workbench.editors.request.auth.presetCustom': 'カスタム（プリセットなし）',

  // ── OAuth 2.0 editor (grant-type names stay raw spec vocabulary) ───
  'workbench.editors.request.oauth.queryWarningTitle': 'URL でのアクセストークンの送信は非推奨です',
  'workbench.editors.request.oauth.queryWarningBefore':
    'RFC 6750 §2.3 は URI クエリパラメーター方式を残しつつも警告しています。トークンはサーバーのログ、HTTP の `Referer` ヘッダー、ブラウザー履歴、中間キャッシュに漏れます。プロバイダーがクエリ形式を要求しない限り、デフォルトの',
  'workbench.editors.request.oauth.queryWarningAfter': 'ヘッダーを使ってください。',
  'workbench.editors.request.oauth.tokenLabel': 'Token',
  'workbench.editors.request.oauth.noTokenPlaceholder':
    'トークンはまだありません。下の「新しいアクセストークンを取得」を使ってください',
  'workbench.editors.request.oauth.headerPrefix': 'ヘッダープレフィックス',
  'workbench.editors.request.oauth.tokenBinding': 'トークンバインディング',
  'workbench.editors.request.oauth.tokenBindingNone': 'なし（bearer）',
  'workbench.editors.request.oauth.tokenBindingDpop': 'DPoP',
  'workbench.editors.request.oauth.dpopAlgorithm': '証明アルゴリズム',
  'workbench.editors.request.oauth.autoRefresh': 'トークンを自動更新',
  'workbench.editors.request.oauth.autoRefreshDesc': '期限切れのトークンはリクエストの送信前に自動更新されます。',
  'workbench.editors.request.oauth.status': 'ステータス',
  'workbench.editors.request.oauth.statusExpired':
    '期限切れ。refresh_token が保存されていれば次の送信で自動更新されます。',
  'workbench.editors.request.oauth.statusValid': '有効 · {duration}',
  'workbench.editors.request.oauth.refreshNow': '今すぐ更新',
  'workbench.editors.request.oauth.disconnect': '切断',
  'workbench.editors.request.oauth.tokenName': 'トークン名',
  'workbench.editors.request.oauth.tokenNameDesc':
    '自由形式のラベルです。ワークスペースが同じプロバイダーに対して複数のトークンを持つとき、資格情報の一覧に表示されます。',
  'workbench.editors.request.oauth.tokenNamePlaceholder': 'トークン名を入力…',
  'workbench.editors.request.oauth.grantType': 'グラントタイプ',
  'workbench.editors.request.oauth.callbackUrl': 'コールバック URL',
  'workbench.editors.request.oauth.detecting': '検出しています…',
  'workbench.editors.request.oauth.callbackTipBeforeExtUrl':
    'この URL を OAuth プロバイダーに登録してください。アドレスバーの',
  'workbench.editors.request.oauth.callbackTipBeforeHost':
    'URL と見た目が異なるのは、Chrome が専用のリダイレクトホスト',
  'workbench.editors.request.oauth.callbackTipBeforeApi': 'を次の API 向けに公開しているためです：',
  'workbench.editors.request.oauth.callbackTipAfterApi': '。拡張機能 ID は同じで、ホストとスキームだけが異なります。',
  'workbench.editors.request.oauth.authorizeUsingBrowser': 'ブラウザーで認可',
  'workbench.editors.request.oauth.noTokenNote':
    'トークンはまだありません。下のフローを実行して取得してください。帯域外で発行されたトークンには、代わりに Bearer Token 認可を使ってください。',
  'workbench.editors.request.oauth.authorizeBrowserInfoSummary':
    'サインインはデフォルトのブラウザーで開きます。そこにプロバイダーのセッション、パスワードマネージャー、パスキーがあり、ID プロバイダーはアプリ内に埋め込まれたログインをブロックするためです（RFC 8252）。',
  'workbench.editors.request.oauth.authorizeBrowserInfoDetail':
    'プロバイダーはアプリのバックエンドポート上のコールバック URL にブラウザーを送り返します。設定でポートを変えると、登録すべき URL も変わります。',
  'workbench.editors.request.oauth.authUrl': 'Auth URL',
  'workbench.editors.request.oauth.accessTokenUrl': 'Access Token URL',
  'workbench.editors.request.oauth.clientId': 'Client ID',
  'workbench.editors.request.oauth.clientSecret': 'Client Secret',
  'workbench.editors.request.oauth.codeChallengeMethod': 'Code Challenge Method',
  'workbench.editors.request.oauth.codeVerifier': 'Code Verifier',
  'workbench.editors.request.oauth.codeVerifierPlaceholder': '空のままにすると自動生成されます',
  'workbench.editors.request.oauth.scope': 'Scope',
  'workbench.editors.request.oauth.scopePlaceholder': '例：read:org',
  'workbench.editors.request.oauth.state': 'State',
  'workbench.editors.request.oauth.stateAuto': '認可リクエストごとに自動生成されます',
  'workbench.editors.request.oauth.clientAuthentication': 'クライアント認証',
  'workbench.editors.request.oauth.clientAuthenticationDesc':
    'トークンの POST でクライアントが自身を証明する方法です。ボディまたは Basic ヘッダーでの id とシークレット、あるいは秘密鍵（private_key_jwt）またはシークレット（client_secret_jwt）で署名した JWT。',
  'workbench.editors.request.oauth.clientAuthBody': 'クライアント資格情報をボディで送信',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Basic Auth ヘッダーとして送信',
  'workbench.editors.request.oauth.clientAuthPrivateKeyJwt': '署名済み JWT を送信（private_key_jwt）',
  'workbench.editors.request.oauth.clientAuthClientSecretJwt': 'HMAC JWT を送信（client_secret_jwt）',
  'workbench.editors.request.oauth.assertionIssuer': '発行者',
  'workbench.editors.request.oauth.assertionIssuerPlaceholder': '例：service-account@openheaders.com',
  'workbench.editors.request.oauth.assertionSubject': 'サブジェクト',
  'workbench.editors.request.oauth.assertionSubjectPlaceholder': '省略可。トークンが代理するユーザー',
  'workbench.editors.request.oauth.assertionClaims': '追加のクレーム',
  'workbench.editors.request.oauth.assertionClaimsPlaceholder': '省略可。JSON。例：{"box_sub_type":"enterprise"}',
  'workbench.editors.request.oauth.assertionAlgorithm': 'アルゴリズム',
  'workbench.editors.request.oauth.assertionKeyId': 'Key ID',
  'workbench.editors.request.oauth.assertionKeyIdPlaceholder': '省略可。kid ヘッダー。例：key-1',
  'workbench.editors.request.oauth.assertionPrivateKey': '秘密鍵',
  'workbench.editors.request.oauth.assertionPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- …（PEM、または data:application/pkcs8 形式）',
  'workbench.editors.request.oauth.assertionAudience': '対象者',
  'workbench.editors.request.oauth.assertionAudiencePlaceholder': '空 = Access Token URL',
  'workbench.editors.request.oauth.assertionLifetime': '有効期間（秒）',
  'workbench.editors.request.oauth.assertionHeaders': '追加のヘッダー',
  'workbench.editors.request.oauth.assertionHeadersPlaceholder': '省略可。JSON。例：{"x5t#S256":"…"}',
  'workbench.editors.request.oauth.advancedIntro':
    'OAuth2 リクエストに対するより細かいカスタマイズをここで追加できます。',
  'workbench.editors.request.oauth.advancedLearnMore': '構成について詳しく',
  'workbench.editors.request.oauth.refreshTokenUrl': 'Refresh Token URL',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    'ほとんどのプロバイダーはリフレッシュにも Access Token URL を再利用します。プロバイダーが別のパスを公開している場合にのみ上書きを指定してください。',
  'workbench.editors.request.oauth.sendInColumn': '送信先',
  'workbench.editors.request.oauth.sendInBody': 'ボディ',
  'workbench.editors.request.oauth.sendInHeader': 'ヘッダー',
  'workbench.editors.request.oauth.sendInUrl': 'URL',
  'workbench.editors.request.oauth.authRequest': '認可リクエスト',
  'workbench.editors.request.oauth.tokenRequest': 'トークンリクエスト',
  'workbench.editors.request.oauth.refreshRequest': 'リフレッシュリクエスト',
  'workbench.editors.request.oauth.getNewToken': '新しいアクセストークンを取得',
  'workbench.editors.request.oauth.clearCookies': 'Cookie を消去',
  'workbench.editors.request.oauth.storedFootnoteBefore': 'トークンはワークスペースごとに次の場所に保存されます：',
  'workbench.editors.request.oauth.storedFootnoteAfter': '。消去するにはワークスペースを削除してください。',
  'workbench.editors.request.oauth.toast.tokenReceived': 'OAuth：トークンを受信しました',
  'workbench.editors.request.oauth.toast.authorizationComplete': 'OAuth：認可が完了しました',
  'workbench.editors.request.oauth.toast.failed': 'OAuth に失敗しました：{error}',
  'workbench.editors.request.oauth.toast.refreshed': 'OAuth：アクセストークンを更新しました',
  'workbench.editors.request.oauth.toast.refreshFailed': '更新に失敗しました：{error}',
  'workbench.editors.request.oauth.toast.disconnected': 'OAuth：切断しました',
  'workbench.editors.request.oauth.toast.callbackCopied': 'コールバック URL をコピーしました',
  'workbench.editors.request.oauth.toast.copyUnsupported': 'コピーに対応していません。URL を手動で選択してください',
  'workbench.editors.request.oauth.deviceAuthUrl': 'Device Authorization URL',
  'workbench.editors.request.oauth.deviceWaitingTitle': '{host} での承認を待っています',
  'workbench.editors.request.oauth.deviceWaitingDesc':
    '任意のデバイスでリンクを開き、コードを入力して承認してください。このページは自動的に更新されます。',
  'workbench.editors.request.oauth.deviceCode': 'コード',
  'workbench.editors.request.oauth.deviceOpen': '開く',
  'workbench.editors.request.oauth.deviceCancel': 'キャンセル',
  'workbench.editors.request.oauth.deviceExpiresIn': '有効期限まで {duration}',
  'workbench.editors.request.oauth.deviceCheckEvery': '{seconds} 秒ごとに確認',
  'workbench.editors.request.oauth.toast.deviceStarted': 'OAuth：{host} でコード {code} を使って承認してください',
  'workbench.editors.request.oauth.toast.deviceGranted': 'OAuth：デバイス認可が承認されました',
  'workbench.editors.request.oauth.toast.deviceDenied': 'OAuth：認可が拒否されました：{error}',
  'workbench.editors.request.oauth.toast.deviceExpired': 'OAuth：デバイスコードの期限が切れました：{error}',
  'workbench.editors.request.oauth.toast.deviceFailed': 'OAuth デバイス認可に失敗しました：{error}',
  'workbench.editors.request.oauth.toast.deviceCancelled': 'OAuth：デバイス認可をキャンセルしました',
  'workbench.editors.request.oauth.toast.codeCopied': 'コードをコピーしました',
  'workbench.editors.request.oauth.issuerUrl': 'Issuer URL',
  'workbench.editors.request.oauth.issuerUrlPlaceholder':
    'https://accounts.example.com、または /.well-known/… メタデータ URL',
  'workbench.editors.request.oauth.discover': '検出',
  'workbench.editors.request.oauth.toast.discovered': 'OAuth：エンドポイントを検出しました',
  'workbench.editors.request.oauth.toast.discoveryFailed': '検出に失敗しました：{error}',
  'workbench.editors.request.oauth.discoveryTitle': '{url} から検出',
  'workbench.editors.request.oauth.discoveryFilled': '{rows} を入力しました',
  'workbench.editors.request.oauth.discoveryFilledNone':
    '文書はエンドポイントを名指ししていません。何も入力されませんでした',
  'workbench.editors.request.oauth.discoveryListed': '{pick} はプロバイダーに列挙されています',
  'workbench.editors.request.oauth.discoveryUnlisted':
    '{pick} は列挙されていません。プロバイダーが列挙しているのは {supported}',
  'workbench.editors.request.oauth.discoveryPickClientAuth': 'クライアント認証 {value}',
  'workbench.editors.request.oauth.discoveryPickGrant': 'グラント {value}',
  'workbench.editors.request.oauth.discoveryPickPkce': 'PKCE {value}',
  'workbench.editors.request.oauth.discoveryPickDpop': 'DPoP アルゴリズム {value}',
  'workbench.editors.request.oauth.discoveryPickAssertionAlg': 'アサーションアルゴリズム {value}',
  'workbench.editors.request.oauth.discoveryAudience':
    '発行者識別子は {issuer} です。一部のプロバイダーは Access Token URL の代わりにこれをアサーションの対象者として求めます',
  'workbench.editors.request.oauth.discoveryScopes': '提供されるスコープ：{supported}。Scope 行で提案されます',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': 'このリクエストにボディはありません',
  'workbench.editors.request.body.modeNoneInfo':
    'リクエストはペイロードなしで送信されます。ボディのバイトも Content-Type ヘッダーもありません。',
  'workbench.editors.request.body.modeFormDataInfo':
    'パートを 1 つの multipart/form-data ペイロードとして送信します。各行はテキストフィールドまたはファイルパートです。',
  'workbench.editors.request.body.modeFormDataDescription':
    'boundary 付きの Content-Type は送信時に生成されます。手動で設定した multipart の Content-Type は、boundary が常にペイロードと一致するよう置き換えられます。',
  'workbench.editors.request.body.modeFormUrlencodedInfo':
    'フィールドをパーセントエンコードされた key=value の組として、application/x-www-form-urlencoded の Content-Type で送信します。無効化した行はエディターに残りますが、ワイヤーには決して届きません。',
  'workbench.editors.request.body.modeRawInfo':
    'エディターの内容をそのまま送信します。ワイヤー上のバイトは入力したものと完全に同じです。',
  'workbench.editors.request.body.modeRawDescription':
    '形式の選択は構文ハイライトとデフォルトの Content-Type（application/json、application/xml、text/plain、text/javascript、text/html）を決めます。ヘッダータブで設定した Content-Type が優先されます。',
  'workbench.editors.request.body.modeGraphqlInfo':
    'GraphQL HTTP トランスポートに従い、クエリと変数を 1 つの application/json ペイロード（{ query, variables }）として送信します。',
  'workbench.editors.request.body.modeGraphqlDescription':
    '変数は有効な JSON でなければなりません。解析できない変数ペインはワイヤーボディから省かれ、クエリだけが送信されます。',
  'workbench.editors.request.body.format': '形式',
  'workbench.editors.request.body.formatAria': 'ボディを整形',
  'workbench.editors.request.body.queryTitle': 'Query',
  'workbench.editors.request.body.queryInfoTitle': 'GraphQL クエリ',
  'workbench.editors.request.body.queryInfoSummary':
    '{ query, variables } の JSON ボディを持つ通常の POST として送信されます。スキーマのイントロスペクションとクエリの自動補完はまだ利用できません。',
  'workbench.editors.request.body.variablesTitle': 'GraphQL Variables',
  'workbench.editors.request.body.variablesInfoTitle': 'GraphQL 変数',
  'workbench.editors.request.body.variablesInfoSummary': 'クエリから参照する変数を JSON 形式で定義します（例：$id）。',
  'workbench.editors.request.body.kindText': 'テキスト',
  'workbench.editors.request.body.kindFile': 'ファイル',
  'workbench.editors.request.body.newFile': 'ローカルマシンから新しいファイル',
  'workbench.editors.request.body.uploadedFiles': 'アップロード済みのファイル',
  'workbench.editors.request.body.allAttached': 'アップロード済みのファイルはすべて添付済みです',
  'workbench.editors.request.body.selectFiles': 'ファイルを選択',
  'workbench.editors.request.body.loadingFiles': 'ファイルを読み込んでいます…',
  'workbench.editors.request.body.addFile': '+ ファイルを追加',
  'workbench.editors.request.body.uploadRequired': 'アップロードが必要',
  'workbench.editors.request.body.deleteFileAria': '{filename} をワークスペースから削除',

  // ── Docs tab ───────────────────────────────────────────────────────
  'workbench.editors.request.docs.write': '書く',
  'workbench.editors.request.docs.preview': 'プレビュー',
  'workbench.editors.request.docs.infoTitle': 'Docs',
  'workbench.editors.request.docs.infoSummary':
    'このリクエストを文書化します。なぜ存在するのか、いつ実行するのか、期待する認可スコープ。Markdown に対応：見出し、リスト、表、コードブロック、リンク。{{variable}} 参照はプレビューでチップとして表示されます。',
  'workbench.editors.request.docs.placeholder':
    'このリクエストは何をしますか？\nなぜ存在するのか、いつ実行するのか、期待する認可スコープ。',
  'workbench.editors.request.docs.empty': 'まだ何も文書化されていません。「書く」に切り替えてメモを追加してください。',

  // ── Scripts tab (oh.* API labels + Monaco menu plane stay raw) ─────
  'workbench.editors.request.scripts.preRequest': 'リクエスト前',
  'workbench.editors.request.scripts.postResponse': 'レスポンス後',
  'workbench.editors.request.scripts.preInfoTitle': 'リクエスト前スクリプト',
  'workbench.editors.request.scripts.preInfoSummary':
    'リクエストが送り出される前に 1 回実行されます。oh API で URL、ヘッダー、パラメーター、ボディを書き換えます。',
  'workbench.editors.request.scripts.postInfoTitle': 'レスポンス後スクリプト',
  'workbench.editors.request.scripts.postInfoSummary':
    'レスポンスが届いた後に 1 回実行されます。ステータス、ヘッダー、ボディを読み取ります。アサーションの結果はレスポンスパネルに表示されます。',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': 'ヘッダーを追加または置換',
  'workbench.editors.request.scripts.apiSetQueryParam': 'クエリパラメーターを追加または置換',
  'workbench.editors.request.scripts.apiSetUrl': '対象 URL を書き換え',
  'workbench.editors.request.scripts.apiSetBody': 'リクエストボディを置換',
  'workbench.editors.request.scripts.apiRequire': 'パッケージライブラリからスクリプトパッケージを読み込み',
  'workbench.editors.request.scripts.apiTest': 'アサーションを登録',
  'workbench.editors.request.scripts.runsAfter': '{count} 個のスクリプトの後に実行：',
  'workbench.editors.request.scripts.runsAfterOne': '1 個のスクリプトの後に実行：',
  'workbench.editors.request.scripts.prePlaceholderContainer':
    '各 HTTP リクエストの送信前に実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.postPlaceholderContainer':
    '各 HTTP レスポンスの終わりに実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.prePlaceholder': 'JavaScript を使って、送信前にこのリクエストを変更します。',
  'workbench.editors.request.scripts.postPlaceholder':
    'JavaScript を使って、到着後にこのレスポンスをテストし読み取ります。',
  // ── Session script slots (gRPC · WebSocket · MQTT) ─────────────────
  'workbench.editors.request.scripts.grpcBeforeInvoke': '呼び出し前',
  'workbench.editors.request.scripts.grpcOnMessage': 'メッセージ受信時',
  'workbench.editors.request.scripts.grpcAfterResponse': 'レスポンス後',
  'workbench.editors.request.scripts.wsBeforeConnect': '接続前',
  'workbench.editors.request.scripts.wsBeforeSend': '送信前',
  'workbench.editors.request.scripts.wsOnMessage': 'メッセージ受信時',
  'workbench.editors.request.scripts.wsAfterClose': 'クローズ後',
  'workbench.editors.request.scripts.mqttBeforeConnect': '接続前',
  'workbench.editors.request.scripts.mqttBeforePublish': 'パブリッシュ前',
  'workbench.editors.request.scripts.mqttOnMessage': 'メッセージ受信時',
  'workbench.editors.request.scripts.mqttAfterClose': 'クローズ後',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholder':
    'JavaScript を使って、この呼び出しの前にメタデータとメッセージを変更します。',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholder':
    'JavaScript を使って、各メッセージフレームを到着時に読み取ります。',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholder':
    'JavaScript を使って、この呼び出しが確定した後に応答をテストし読み取ります。',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholder':
    'JavaScript を使って、このセッションが接続する前にハンドシェイクを変更します。',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholder':
    'JavaScript を使って、各メッセージを送信前に変更または破棄します。',
  'workbench.editors.request.scripts.wsOnMessagePlaceholder': 'JavaScript を使って、各メッセージに到着時に反応します。',
  'workbench.editors.request.scripts.wsAfterClosePlaceholder':
    'JavaScript を使って、このセッションが閉じた後にテストし読み取ります。',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholder':
    'JavaScript を使って、このセッションが接続する前に CONNECT を変更します。',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholder':
    'JavaScript を使って、各メッセージをパブリッシュ前に変更または破棄します。',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholder':
    'JavaScript を使って、各メッセージに到着時に反応します。',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholder':
    'JavaScript を使って、このセッションが切断した後にテストし読み取ります。',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholderContainer':
    '各 gRPC 呼び出しの前に実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholderContainer':
    '各 gRPC メッセージフレームで実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholderContainer':
    '各 gRPC 呼び出しの終わりに実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholderContainer':
    '各 WebSocket セッションが接続する前に実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholderContainer':
    '各 WebSocket メッセージの送信前に実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.wsOnMessagePlaceholderContainer':
    '受信した各 WebSocket メッセージで実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.wsAfterClosePlaceholderContainer':
    '各 WebSocket セッションが閉じた後に実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholderContainer':
    '各 MQTT セッションが接続する前に実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholderContainer':
    '各 MQTT メッセージのパブリッシュ前に実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholderContainer':
    '受信した各 MQTT メッセージで実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholderContainer':
    '各 MQTT セッションが切断した後に実行するスクリプトを書きます。',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoTitle': '呼び出し前スクリプト',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoSummary':
    '呼び出しの前に 1 回実行されます。oh API でメタデータとリクエストメッセージを書き換えます。oh.session は呼び出しの後続フックへ状態を運びます。',
  'workbench.editors.request.scripts.grpcOnMessageInfoTitle': 'メッセージ受信時スクリプト',
  'workbench.editors.request.scripts.grpcOnMessageInfoSummary':
    '呼び出しがキャプチャする双方向のすべてのメッセージフレームで、キャプチャの後に実行されます。デコードされたメッセージを読み取ります。キャプチャが遅れることはありません。',
  'workbench.editors.request.scripts.grpcAfterResponseInfoTitle': 'レスポンス後スクリプト',
  'workbench.editors.request.scripts.grpcAfterResponseInfoSummary':
    '呼び出しが確定したら 1 回実行されます。ステータス、ヘッダー、トレーラー、メッセージを読み取ります。アサーションの結果はレスポンスペインに表示されます。',
  'workbench.editors.request.scripts.wsBeforeConnectInfoTitle': '接続前スクリプト',
  'workbench.editors.request.scripts.wsBeforeConnectInfoSummary':
    '再接続を含む毎回のダイヤルで実行されます。oh API で URL、ヘッダー、パラメーター、サブプロトコルを書き換えます。失敗は記録され、ダイヤルは変更なしで進みます。',
  'workbench.editors.request.scripts.wsBeforeSendInfoTitle': '送信前スクリプト',
  'workbench.editors.request.scripts.wsBeforeSendInfoSummary':
    '送信する各メッセージの前に実行されます。送信メッセージを書き換えるか破棄します。ハートビートとプロトコルフレームはここを決して通りません。',
  'workbench.editors.request.scripts.wsOnMessageInfoTitle': 'メッセージ受信時スクリプト',
  'workbench.editors.request.scripts.wsOnMessageInfoSummary':
    '受信したすべてのメッセージで、キャプチャの後に実行されます。反応します：oh.send で返信し、oh.session に状態を保ち、アサーションを登録します。',
  'workbench.editors.request.scripts.wsAfterCloseInfoTitle': 'クローズ後スクリプト',
  'workbench.editors.request.scripts.wsAfterCloseInfoSummary':
    '開いた後にセッションが確定したら 1 回実行されます。クローズの記録とセッションの件数を読み取ります。アサーションの結果はセッションペインに表示されます。',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoTitle': '接続前スクリプト',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoSummary':
    '再接続を含む毎回のダイヤルで実行されます。oh API でクライアント id、資格情報、遺言、サブスクリプションを書き換えます。失敗は記録され、ダイヤルは変更なしで進みます。',
  'workbench.editors.request.scripts.mqttBeforePublishInfoTitle': 'パブリッシュ前スクリプト',
  'workbench.editors.request.scripts.mqttBeforePublishInfoSummary':
    'パブリッシュする各メッセージの前に実行されます。トピック、ペイロード、QoS、retain フラグ、プロパティを書き換えるか、パブリッシュを破棄します。',
  'workbench.editors.request.scripts.mqttOnMessageInfoTitle': 'メッセージ受信時スクリプト',
  'workbench.editors.request.scripts.mqttOnMessageInfoSummary':
    '受信したすべてのメッセージで、キャプチャの後に実行されます。反応します：oh.publish で返信し、oh.session に状態を保ち、アサーションを登録します。',
  'workbench.editors.request.scripts.mqttAfterCloseInfoTitle': 'クローズ後スクリプト',
  'workbench.editors.request.scripts.mqttAfterCloseInfoSummary':
    '開いた後にセッションが確定したら 1 回実行されます。終了の記録、CONNACK、セッションの件数を読み取ります。アサーションの結果はセッションペインに表示されます。',
  'workbench.editors.request.scripts.apiConnect':
    '構成されたダイヤル：URL、ヘッダー、パラメーター、サブプロトコル、試行',
  'workbench.editors.request.scripts.apiSetSubprotocols': 'サブプロトコルの提示を置換',
  'workbench.editors.request.scripts.apiMessage': 'メッセージ：テキスト、フレーム種別、キャプチャインデックス',
  'workbench.editors.request.scripts.apiSetMessage': '送信テキストを置換',
  'workbench.editors.request.scripts.apiSetEvent': 'Socket.IO イベント名を変更',
  'workbench.editors.request.scripts.apiDrop': 'メッセージを破棄。ワイヤーには何も届きません',
  'workbench.editors.request.scripts.apiSend': 'セッションにテキストフレームを送信',
  'workbench.editors.request.scripts.apiSendBinary': 'バイナリフレームを送信（base64）',
  'workbench.editors.request.scripts.apiEmit': 'Socket.IO イベントを emit',
  'workbench.editors.request.scripts.apiClose': '終了の記録：クローズコード、理由、件数、所要時間',
  'workbench.editors.request.scripts.apiSession': 'このセッションのすべてのフックで共有される状態',
  'workbench.editors.request.scripts.apiMqttConnect':
    '構成された CONNECT：クライアント id、資格情報、遺言、サブスクリプション、ユーザープロパティ、試行',
  'workbench.editors.request.scripts.apiSetClientId': 'クライアント id を置換',
  'workbench.editors.request.scripts.apiSetUsername': 'ユーザー名を置換',
  'workbench.editors.request.scripts.apiSetPassword': 'パスワードを置換',
  'workbench.editors.request.scripts.apiSetWill': '遺言を置換（null は登録なし）',
  'workbench.editors.request.scripts.apiAddSubscription': 'オープン時にトピックフィルターをサブスクライブ',
  'workbench.editors.request.scripts.apiSetUserProperty': '5.0 のユーザープロパティを設定',
  'workbench.editors.request.scripts.apiMqttMessage':
    'メッセージ：トピック、ペイロード、QoS、retain、キャプチャインデックス',
  'workbench.editors.request.scripts.apiSetTopic': 'パブリッシュ先を変更',
  'workbench.editors.request.scripts.apiSetPayload': 'ペイロードを置換（テキスト、または base64 バイト）',
  'workbench.editors.request.scripts.apiSetQos': 'QoS を設定',
  'workbench.editors.request.scripts.apiSetRetain': 'RETAIN フラグを設定',
  'workbench.editors.request.scripts.apiPublish': 'セッションにメッセージをパブリッシュ',
  'workbench.editors.request.scripts.apiMqttClose': '終了の記録：終わり方、CONNACK、件数、所要時間',
  'workbench.editors.request.scripts.apiInvoke':
    '構成された呼び出し：ターゲット、メソッド、呼び出しの形、メタデータ、メッセージテキスト',
  'workbench.editors.request.scripts.apiSetMetadata': 'メタデータの組を設定',
  'workbench.editors.request.scripts.apiRemoveMetadata': 'メタデータの組を削除',
  'workbench.editors.request.scripts.apiGrpcSetMessage': 'メッセージテキストを置換（JSON）',
  'workbench.editors.request.scripts.apiGrpcMessage':
    'キャプチャされたフレーム：方向、種別、デコードされたメッセージ、キャプチャインデックス',
  'workbench.editors.request.scripts.apiGrpcResponse':
    '終了の記録：ステータス、メタデータ、トレーラー、双方向の件数、所要時間',

  // ── Settings tab — wired knobs ─────────────────────────────────────
  'workbench.editors.request.settings.followRedirects': 'リダイレクトを自動的に追跡',
  'workbench.editors.request.settings.followRedirectsInfo':
    'HTTP 3xx レスポンスをその行き先まで追跡します。オフにするとリダイレクト自体で止まり、レスポンスはヘッダーもボディもない不透明なリダイレクトとして表示されます。そもそもリダイレクトが起きているかを確認するのに便利です。',
  'workbench.editors.request.settings.maxRedirects': '最大リダイレクト数',
  'workbench.editors.request.settings.maxRedirectsInfo':
    '送信が追跡できるリダイレクトの数です。超えると上限を示すエラーで失敗します。空にするとデフォルトの 20 になります。0 にするとどのリダイレクトでも失敗します。',
  'workbench.editors.request.settings.followOriginalMethod': '元の HTTP メソッドを維持',
  'workbench.editors.request.settings.followOriginalMethodInfo':
    '301、302、303 のリダイレクトが通常ならリクエストを GET に切り替えるところで、元のメソッドとボディを維持します。307 と 308 のリダイレクトはいずれにせよ常にメソッドを維持します。',
  'workbench.editors.request.settings.followAuthHeader': 'Authorization ヘッダーを維持',
  'workbench.editors.request.settings.followAuthHeaderInfo':
    'リダイレクトが別のオリジンに渡るときも Authorization ヘッダーを維持します。通常はクロスオリジンのホップで落とされ、リクエストが宛てていないホストに資格情報が決して渡らないようになっています。',
  'workbench.editors.request.settings.followAuthHeaderWarning':
    'リダイレクトチェーンが行き着くどのホストにも資格情報が渡ります。チェーンが実際にオリジンをまたいだレスポンスにはマークが付きます。',
  'workbench.editors.request.settings.sendBrowserCookies': 'ブラウザーの Cookie を送信',
  'workbench.editors.request.settings.sendBrowserCookiesInfo':
    '対象サイトに対するブラウザーの既存の Cookie をこのリクエストに添付します。オフが安全なデフォルトです。リクエストは Cookie なしで送信されるため、結果がブラウザーのログイン状態に依存しません。',
  'workbench.editors.request.settings.sslVerification': 'SSL 証明書の検証',
  'workbench.editors.request.settings.sslVerificationSummary':
    'サーバーの TLS 証明書をランタイムの信頼された CA ストアで検証します。デフォルトはオンです。',
  'workbench.editors.request.settings.sslVerificationDescription':
    '自己署名、期限切れ、その他の信頼されない証明書を持つホストは TLS 証明書エラーで失敗します。それでも到達するには検証をオフにしてください。例：自己署名証明書の開発サーバー。',
  'workbench.editors.request.settings.sslVerificationWarning':
    '送信はサーバーの身元確認を飛ばします。自己署名や期限切れを含め、どの証明書も受け入れられます。',
  'workbench.editors.request.settings.tlsMin': 'TLS 最小バージョン',
  'workbench.editors.request.settings.tlsMinSummary':
    '送信がネゴシエートできる最も低い TLS プロトコルバージョンです。空にするとランタイムのデフォルトの TLS 1.2 のままです。',
  'workbench.editors.request.settings.tlsMinDescription':
    '1.0 または 1.1 を選ぶと、レガシーなサーバーに到達するために下限をデフォルトより下げます。下限を下げて送信されたレスポンスにはマークが付きます。',
  'workbench.editors.request.settings.tlsMinPlaceholder': '1.2（デフォルト）',
  'workbench.editors.request.settings.tlsMinWarning':
    '送信は 1.2 未満の TLS をネゴシエートすることがあります。既知の弱点を持つプロトコルバージョンです。レスポンスにはマークが付きます。',
  'workbench.editors.request.settings.tlsMax': 'TLS 最大バージョン',
  'workbench.editors.request.settings.tlsMaxSummary':
    '送信がネゴシエートできる最も高い TLS プロトコルバージョンです。空にするとランタイムのデフォルトの TLS 1.3 のままです。',
  'workbench.editors.request.settings.tlsMaxDescription':
    '古いプロトコルでのサーバーの振る舞いを確認するには下げてください。最小も下げる必要があるかもしれません。そうしないと 2 つが重なりません。',
  'workbench.editors.request.settings.tlsVersionsHeading': 'バージョン',
  'workbench.editors.request.settings.tlsVersionLegacyDesc':
    'レガシーで既知の弱点があります。送信にはマークが付きます。',
  'workbench.editors.request.settings.tlsVersion12Desc': 'デフォルトの下限です。',
  'workbench.editors.request.settings.tlsVersion13Desc': 'デフォルトの上限です。現在のベストプラクティス。',
  'workbench.editors.request.settings.tlsMaxPlaceholder': '1.3（デフォルト）',
  'workbench.editors.request.settings.tlsCipherSuites': 'TLS 暗号スイート',
  'workbench.editors.request.settings.tlsCipherSuitesSummary':
    'TLS ハンドシェイクで提示する暗号スイートを、コロン区切りの 1 つのリストで指定します。空にするとランタイムのデフォルトのスイートを提示します。',
  'workbench.editors.request.settings.tlsCipherSuitesDescription':
    'サーバーは提示されたものの中から、自身の優先順でスイートを選びます。',
  'workbench.editors.request.settings.tlsCipherSuitesFormatHeading': '形式',
  'workbench.editors.request.settings.tlsCipherSuitesIanaDesc': 'IANA 名による TLS 1.3 のスイート。',
  'workbench.editors.request.settings.tlsCipherSuitesOpensslDesc':
    'OpenSSL 名による古いスイート。両方の種類を 1 つのリストに入れます。',
  'workbench.editors.request.settings.tlsCipherSuitesJoinDesc': 'エントリを結合します。空白は入れません。',
  'workbench.editors.request.settings.tlsCipherSuitesPlaceholder': 'ランタイムのデフォルトのスイート',
  'workbench.editors.request.settings.tlsCipherSuitesError':
    'コロン区切りの OpenSSL スイート名のみです。空白は入れられません。',
  'workbench.editors.request.settings.tlsCipherSuitesExample': '例：TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES128-GCM-SHA256',
  'workbench.editors.request.settings.maxRedirectsPlaceholder': '20 ホップ（デフォルト）',
  'workbench.editors.request.settings.maxRedirectsHops': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} ホップ' }),
  'workbench.editors.request.settings.responseSizeLimitPlaceholder': '2 MB（デフォルト）',
  'workbench.editors.request.settings.resetToDefault': 'デフォルトにリセット',
  'workbench.editors.request.settings.group.redirects': 'リダイレクト',
  'workbench.editors.request.settings.group.tls': 'TLS と信頼',
  'workbench.editors.request.settings.group.connection': '接続',
  'workbench.editors.request.settings.group.cookies': 'Cookie',
  'workbench.editors.request.settings.group.execution': '実行と制限',
  'workbench.editors.request.settings.groupInfo.connection':
    '送信がサーバーに到達する方法です。話す HTTP プロトコルと、ダイヤルする経路：直接、プロキシ経由、固定アドレスへ、またはローカルソケットへ。',
  'workbench.editors.request.settings.groupInfo.tls':
    'TLS ハンドシェイクで送信が信頼し提示するものです。証明書の検証、プロトコルの範囲、暗号スイート、そしてクライアント証明書。',
  'workbench.editors.request.settings.groupInfo.redirects':
    'サーバーがリダイレクトで応答したときに起きることです。チェーンを追跡するか、どこまで追跡するか、後続のリクエストが何を運ぶか。',
  'workbench.editors.request.settings.groupInfo.cookies':
    'Cookie を送信に乗せるかどうかです。デフォルトはオフで、結果が周囲のログイン状態に決して依存しません。',
  'workbench.editors.request.settings.groupInfo.execution':
    '実行そのものをどう区切るかです。スクリプトモード、時間の予算、そしてレスポンスサイズの上限。',
  'workbench.editors.request.settings.httpVersion': 'HTTP バージョン',
  'workbench.editors.request.settings.httpVersionSummary':
    '送信が HTTP を話す方法です。自動（デフォルト）は HTTP/1.1 と並べて HTTP/2 を提示し、サーバーが選びます。',
  'workbench.editors.request.settings.httpVersionDescription':
    'サーバーが話せないバージョンに固定すると、暗黙のフォールバックではなく明確なエラーで失敗します。レスポンスのネットワークポップオーバーは常にワイヤー上で実際にネゴシエートされたプロトコルを表示します。',
  'workbench.editors.request.settings.httpVersionValuesHeading': '値',
  'workbench.editors.request.settings.httpVersionAutoDesc':
    'TLS ハンドシェイク中に HTTP/2 + HTTP/1.1 を提示し、サーバーが選びます。平文の http:// は HTTP/1.1 のままです。',
  'workbench.editors.request.settings.httpVersion11Desc': '従来の HTTP/1.1 のセマンティクスに固定します。',
  'workbench.editors.request.settings.httpVersion2Desc': 'ハンドシェイクの提示で HTTP/2 に固定します。',
  'workbench.editors.request.settings.httpVersionPkDesc':
    'ネゴシエートせずに即座に HTTP/2 を話します。平文の HTTP/2 サーバーへの経路です。',
  'workbench.editors.request.settings.httpVersion3Desc':
    'QUIC でサーバーに直接ダイヤルします。TCP へのフォールバックはありません。',
  'workbench.editors.request.settings.exampleCaption': '送信の例',
  'workbench.editors.request.settings.httpVersionPlaceholder': '自動。サーバーが選択',
  'workbench.editors.request.settings.httpVersionPriorKnowledge': 'HTTP/2（prior knowledge）',
  'workbench.editors.request.settings.resolveToAddress': '解決先アドレス',
  'workbench.editors.request.settings.resolveToAddressInfo':
    'DNS の応答にかかわらず、このリクエストを特定のサーバーアドレスに送ります。URL のホスト名は引き続き TLS と Host ヘッダーに使われるため、検証がオンなら証明書はそれと一致している必要があります。ロードバランサーの背後にある特定のバックエンド 1 台をテストするのに便利です。URL は自身のポートを保ち、別のホストへのリダイレクトもこのアドレスに着地します。通常どおり DNS で解決するには空のままにしてください。',
  'workbench.editors.request.settings.resolveToAddressPlaceholder': 'システムの DNS',
  'workbench.editors.request.settings.resolveToAddressError':
    'IPv4 または IPv6 アドレスのみです。ホスト名やポートは入れられません。',
  'workbench.editors.request.settings.resolveToAddressExample': '例：10.0.0.12 または 2001:db8::1',
  'workbench.editors.request.settings.sni': 'SNI サーバー名',
  'workbench.editors.request.settings.sniInfo':
    'URL のホストの代わりに TLS ハンドシェイクで提示するサーバー名です。1 つのアドレスで多数のホスト名を前段で受けるゲートウェイや、DNS が応答しない名前に発行された証明書に使います。空にすると URL のホストを送ります。',
  'workbench.editors.request.settings.sniPlaceholder': '自動。URL のホスト',
  'workbench.editors.request.settings.sniExample': '例：api.openheaders.com',
  'workbench.editors.request.settings.clientCertificate': 'クライアント証明書（mTLS）',
  'workbench.editors.request.settings.clientCertificateInfo':
    'TLS ハンドシェイク中にクライアント証明書を提示します。相互 TLS（mTLS）で、証明書によって呼び出し元を認証する相互 TLS ゲートウェイの背後にある API 向けです。vault から証明書エントリを選んでください。リクエストはエントリの名前だけを保存し、各デバイスはその名前の自身の vault エントリを提示します。証明書と鍵は決して vault を離れません。クライアント証明書なしで接続するには空のままにしてください。',
  'workbench.editors.request.settings.clientCertificatePlaceholder': 'クライアント証明書なし',
  'workbench.editors.request.settings.clientCertificateEmpty':
    'このデバイスの vault にはクライアント証明書のエントリがまだありません。',
  'workbench.editors.request.settings.vaultManageCertificates': 'vault で証明書を管理',
  'workbench.editors.request.settings.clientCertificateDangling':
    'このデバイスには「{name}」という名前の vault 証明書エントリがありません。エントリが存在するか、この設定が消去されるまで、送信は失敗します。',
  'workbench.editors.request.settings.proxy': 'プロキシ',
  'workbench.editors.request.settings.proxySummary':
    'この送信がネットワークに到達する方法です。デフォルトでは実行デバイスのシステム構成（システムのプロキシ設定、PAC、またはプロキシの環境変数）を継承するため、企業のマシンに配布されたプロキシはそのまま機能します。「直接」はこのリクエストだけを周囲のプロキシから外し、「カスタム URL」は独自のプロキシを経由させます。',
  'workbench.editors.request.settings.proxyDescription':
    'レスポンスのメタは送信が実際に取った経路を常に記録します。どのプロキシか、そしてリクエストとシステムのどちらが決めたか。HTTP(S) と SOCKS5 のプロキシに対応しています。socks5:// URL はカスタムプロキシとしてもシステムの応答としても機能します。SOCKS4 系だけはそれを名指しする明確なエラーになります。',
  'workbench.editors.request.settings.proxyModesHeading': 'モード',
  'workbench.editors.request.settings.proxyModePlaceholder': '継承。システムが決定',
  'workbench.editors.request.settings.proxyModeDirect': '直接。プロキシなし',
  'workbench.editors.request.settings.proxyModeCustom': 'カスタム URL',
  'workbench.editors.request.settings.proxyModeInheritDesc':
    '実行デバイスのシステムが URL ごとに決めます。マシンにプロキシが構成されていればプロキシ、そうでなければ直接。継承されたプロキシは、HTTP/3 に固定した送信、ローカルソケットにダイヤルする送信、固定アドレスに解決する送信では退きます。',
  'workbench.editors.request.settings.proxyModeDirectDesc':
    'マシンのシステム設定が何と言おうと、このリクエストでは決してプロキシを使いません。',
  'workbench.editors.request.settings.proxyModeCustomDesc':
    'このリクエスト独自のプロキシ URL をトンネルします。リクエストとともに同期され、すべてのデバイスで同じ経路になります。',
  'workbench.editors.request.settings.proxyUrl': 'プロキシ URL',
  'workbench.editors.request.settings.proxyUrlInfo':
    'このリクエストをこの HTTP(S) プロキシ経由にします。対象への接続はプロキシをトンネルするため、https の交換はエンドツーエンドで暗号化されたままで、証明書の検証も引き続き対象に対して行われます。資格情報は下の「プロキシ資格情報」設定に入れ、この URL には決して入れないでください。',
  'workbench.editors.request.settings.proxyUrlPlaceholder': 'http://proxy.example:8080',
  'workbench.editors.request.settings.proxyUrlMissing':
    'カスタム URL モードにはプロキシ URL が必要です。入力するか、モードを戻してください。',
  'workbench.editors.request.settings.proxyError':
    'ホストとポートだけの http://、https://、または socks5:// URL です。URL に資格情報は入れられません。',
  'workbench.editors.request.settings.proxyUrlExample': '例：http://127.0.0.1:8080 または socks5://127.0.0.1:1080',
  'workbench.editors.request.settings.proxyResolveConflict':
    '解決先アドレスも設定されていますが、プロキシはホスト名を自ら解決します。どちらかが消去されるまで送信は失敗します。',
  'workbench.editors.request.settings.proxyCredentials': 'プロキシ資格情報',
  'workbench.editors.request.settings.proxyCredentialsInfo':
    'vault の資格情報（string エントリの user:password）でプロキシに対して認証します。リクエストはエントリの名前だけを保存し、各デバイスは自身のローカル vault でそれを解決します。資格情報は決して vault を離れず、プロキシにだけ送られ、対象には決して送られません。認証の不要なプロキシでは空のままにしてください。',
  'workbench.editors.request.settings.proxyCredentialsPlaceholder': '認証なし',
  'workbench.editors.request.settings.proxyCredentialsEmpty':
    'このデバイスの vault には string エントリがまだありません。',
  'workbench.editors.request.settings.vaultManageCredentials': 'vault で資格情報を管理',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    'このデバイスには「{name}」という名前の vault string エントリがありません。エントリが存在するか、この設定が消去されるまで、送信は失敗します。',
  // ── Session resilience block (WebSocket / Socket.IO / MQTT) ─────────
  'workbench.editors.request.settings.autoReconnect': '自動的に再接続',
  'workbench.editors.request.settings.autoReconnectInfo':
    '開いている接続が落ちたとき（切断されたソケット、サーバーによるクローズ、アイドルタイムアウト）にセッションを開き直します。再び開くか切断するまで、再接続間隔で再ダイヤルします。最初の接続の失敗は決して再試行しません。デフォルトはオフです。',
  'workbench.editors.request.settings.reconnectPeriod': '再接続間隔',
  'workbench.editors.request.settings.reconnectPeriodInfo':
    '再接続試行の間に待つ時間です。空にするとデフォルトの 5 秒になります。',
  'workbench.editors.request.settings.reconnectPeriodPlaceholder': '5 秒（デフォルト）',
  'workbench.editors.request.settings.reconnectMaxAttempts': '再接続の試行回数',
  'workbench.editors.request.settings.reconnectMaxAttemptsInfo':
    '1 回の切断後に連続して行う再接続試行の上限です。開くことに成功した再接続は回数をリセットし、上限を使い切るとセッションは「再接続を断念」として終わります。空にするとサーバーが戻るか切断するまで試し続けます。',
  'workbench.editors.request.settings.reconnectMaxAttemptsPlaceholder': '無制限（デフォルト）',
  'workbench.editors.request.settings.reconnectBackoff': '指数バックオフ',
  'workbench.editors.request.settings.reconnectBackoffInfo':
    '失敗した試行のたびに待ち時間を 2 倍にします。間隔、次に 2 倍、4 倍…と 60 秒まで。クライアントが一斉に再ダイヤルしないよう、小さなランダムなジッターを加えます。デフォルトはオンで、オフにすると毎回ちょうど間隔だけ待ちます。',
  'workbench.editors.request.settings.idleTimeout': 'アイドルタイムアウト',
  'workbench.editors.request.settings.idleTimeoutInfo':
    'この時間何も届かなければ、接続を失われたものとして閉じます。クライアントが ping フレームでは行えない生存確認です。「自動的に再接続」がオンなら、セッションは再ダイヤルします。空にするとアイドルのデッドラインはありません。',
  'workbench.editors.request.settings.idleTimeoutSocketioInfo':
    'この時間何も届かなければ、接続を失われたものとして閉じます。「自動的に再接続」がオンなら、セッションは再ダイヤルします。空にするとサーバーのハンドシェイクに従います。公式クライアントの規則では、ping は pingInterval ごとに届き、pingTimeout まで遅れることがあります。',
  'workbench.editors.request.settings.idleTimeoutPlaceholder': 'オフ（デフォルト）',
  'workbench.editors.request.settings.idleTimeoutSocketioPlaceholder': 'サーバーの ping 周期（デフォルト）',
  'workbench.editors.request.settings.heartbeatMessage': 'ハートビートメッセージ',
  'workbench.editors.request.settings.heartbeatMessageInfo':
    'ロードバランサーやプロキシを越えてアイドルなセッションを生かしておくため、ハートビート間隔で送るテキストフレームです。サーバーが期待するものを入れてください。どちらの WebSocket クライアントもプロトコルの ping フレームを送れないため、キープアライブはアプリケーションメッセージで、送信した他のフレームと同様にキャプチャされます。テンプレートも使えます。空にするとハートビートを送りません。',
  'workbench.editors.request.settings.heartbeatMessagePlaceholder': 'ハートビートなし',
  'workbench.editors.request.settings.heartbeatMessageExample': '例：ping または {"type":"ping"}',
  'workbench.editors.request.settings.heartbeatInterval': 'ハートビート間隔',
  'workbench.editors.request.settings.heartbeatIntervalInfo':
    'ハートビートメッセージの間に待つ時間です。空にするとデフォルトの 30 秒になります。ほとんどのロードバランサーが適用する 60 秒のアイドル切断より短い値です。',
  'workbench.editors.request.settings.heartbeatIntervalPlaceholder': '30 秒（デフォルト）',
  'workbench.editors.request.settings.unixSocket': 'Unix ソケット',
  'workbench.editors.request.settings.unixSocketInfo':
    'TCP 接続を開く代わりに、このローカルソケット（絶対パスの Unix ソケット、または \\\\.\\pipe\\name のような Windows の名前付きパイプ）にダイヤルします。例：Docker デーモンや、ソケットで待ち受けるローカルの開発サービス。URL のホストはもう接続の行き先を決めませんが、Host ヘッダー、TLS サーバー名、証明書の検証は引き続きそれを使い、別のホストへのリダイレクトもこの同じソケットにダイヤルします。通常の TCP 接続にするには空のままにしてください。',
  'workbench.editors.request.settings.unixSocketPlaceholder': 'ソケットなし。TCP 接続',
  'workbench.editors.request.settings.unixSocketError':
    '絶対パスの Unix ソケット（/…）または Windows の名前付きパイプ（\\\\.\\pipe\\…）のみです。',
  'workbench.editors.request.settings.unixSocketProxyConflict':
    'プロキシも設定されていますが、プロキシトンネルはローカルソケットにダイヤルできません。どちらかが消去されるまで送信は失敗します。',
  'workbench.editors.request.settings.unixSocketResolveConflict':
    '解決先アドレスも設定されていますが、ソケットへのダイヤルはホスト名を解決しません。どちらかが消去されるまで送信は失敗します。',
  'workbench.editors.request.settings.unixSocketExample': '例：/var/run/docker.sock',
  'workbench.editors.request.settings.cookieJar': 'Cookie ジャーを使用',
  'workbench.editors.request.settings.cookieJarInfo':
    'このリクエストの Set-Cookie レスポンスをアプリ独自の Cookie ジャーに保存し、一致する Cookie を自動的に添付します。ログインリクエストに続く認証済みの呼び出しが、Cookie の値を手で写さずに機能します。ジャーはワークスペースごとにメモリ上にあり、この設定がオンのリクエストだけが使い、決して同期されず、アプリの終了時に消去されます。自分で設定した Cookie ヘッダーが常に優先されます。デフォルトはオフで、Cookie は添付されず、Set-Cookie レスポンスは破棄されます。',
  'workbench.editors.request.settings.timeout': 'リクエストタイムアウト',
  'workbench.editors.request.settings.timeoutInfo':
    'リクエスト全体（接続、レスポンスの待機、ボディの読み取り）にかけられる最大時間です。上限に達すると送信は中止され、それを示すタイムアウトエラーで失敗します。リクエストごとの上限をなくすには空のままにしてください。ネットワークスタック自身のタイムアウトだけが適用されます。',
  'workbench.editors.request.settings.timeoutPlaceholder': '制限なし',
  'workbench.editors.request.settings.responseSizeLimit': 'レスポンスサイズ上限',
  'workbench.editors.request.settings.responseSizeLimitInfo':
    'ワイヤーから読み取るレスポンスボディの最大サイズです。それを超える部分は切り捨てられ、レスポンスには切り詰めのマークが付きます。空にするとデフォルトの上限 2,048 KB（2 MB）になります。大きなペイロードには 10,240 KB（10 MB）まで上げられ、切り詰められたレスポンスの見え方をテストするには下げられます。',

  // ── Settings tab — runtime-managed fact sheets ─────────────────────
  'workbench.editors.request.settings.maxMessageSize': 'メッセージの最大サイズ',
  'workbench.editors.request.settings.maxMessageSizeInfo':
    'セッションが受け入れる最大の受信メッセージです。上限を超えるメッセージは決してキャプチャされません。セッションは両方のサイズを示すコード 1009（Message Too Big）で閉じ、クライアント側の要求であるため自動再接続は開き直しません。リクエストごとの上限をなくすには空のままにしてください。デスクトップのランタイムは 128 MB までメッセージを組み立て、ブラウザーは上限を設けません。',
  'workbench.editors.request.settings.maxMessageSizePlaceholder': '制限なし（デフォルト）',
  'workbench.editors.request.settings.followRedirectsWsInfo':
    'ハンドシェイクへの 3xx 応答を追跡し、その Location にダイヤルします。認証ゲートウェイがアップグレードを跳ね返す形です。デフォルトはオフで、WebSocket 標準自身の規則どおり、リダイレクトされたハンドシェイクはリダイレクトを示して失敗します。セッションがデスクトップアプリまたはサーバーで実行されるときに適用されます。ブラウザーは決して追跡しません。',
  'workbench.editors.request.settings.maxRedirectsWsInfo':
    '接続が追跡できるハンドシェイクのリダイレクトの数です。超えると上限を示すエラーで失敗します。空にするとデフォルトの 20 になります。',
  'workbench.editors.request.settings.managed.browserKicker': 'ブラウザー管理',
  'workbench.editors.request.settings.managed.nodeKicker': 'ランタイム管理',
  'workbench.editors.request.settings.managed.browserIntro':
    '拡張機能から送信されるすべてのリクエストについてブラウザーが固定しているものです。交渉の余地がないことを知っておけるよう表示しています。',
  'workbench.editors.request.settings.managed.nodeIntro':
    'すべてのリクエストについてアプリのネットワークランタイムが固定しているものです。交渉の余地がないことを知っておけるよう表示しています。',
  'workbench.editors.request.settings.managed.hideBrowser': 'ブラウザー管理の設定を隠す',
  'workbench.editors.request.settings.managed.hideNode': 'ランタイム管理の設定を隠す',
  'workbench.editors.request.settings.managed.countBrowser': 'ブラウザー管理 {count} 件',
  'workbench.editors.request.settings.managed.countNode': 'ランタイム管理 {count} 件',
  'workbench.editors.request.settings.managed.on': 'オン',
  'workbench.editors.request.settings.managed.off': 'オフ',
  'workbench.editors.request.settings.managed.auto': '自動',
  'workbench.editors.request.settings.managed.policy': 'ポリシー',
  'workbench.editors.request.settings.managed.browser': 'ブラウザー',
  'workbench.editors.request.settings.managed.browserStore': 'ブラウザーのストア',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': '送信なし',
  'workbench.editors.request.settings.managed.offered': '提示',
  'workbench.editors.request.settings.managed.none': 'なし',
  'workbench.editors.request.settings.managed.never': '常になし',
  'workbench.editors.request.settings.managed.websocketOnly': 'WebSocket のみ',
  'workbench.editors.request.settings.managed.http2': 'HTTP/2',
  'workbench.editors.request.settings.managed.compression': '圧縮',
  'workbench.editors.request.settings.managed.compressionWsDesc':
    'permessage-deflate はすべてのハンドシェイクで提示され、フレームを圧縮するかはサーバーが決めます。「接続済み」行にネゴシエートされた内容が表示されます。提示をリクエストごとに控えることはできません。',
  'workbench.editors.request.settings.managed.compressionGrpcDesc':
    'メッセージは非圧縮で送られ、grpc-encoding はネゴシエートされません。サーバーからの圧縮されたフレームはデコードされず、圧縮済みとして表示されます。',
  'workbench.editors.request.settings.managed.transport': 'トランスポート',
  'workbench.editors.request.settings.managed.transportSocketioDesc':
    'セッションは WebSocket トランスポートを直接ダイヤルし、公式クライアントが最初に行ってからアップグレードする HTTP long-polling のハンドシェイクを飛ばします。',
  'workbench.editors.request.settings.managed.httpVersionGrpcDesc':
    'gRPC は HTTP/2 のみに乗ります。TLS チャネルは ALPN で h2 をネゴシエートし、平文チャネルは prior knowledge で h2 を話します。',
  'workbench.editors.request.settings.managed.connectionReuse': '接続の再利用',
  'workbench.editors.request.settings.managed.onePerCall': '呼び出しごとに 1 つ',
  'workbench.editors.request.settings.managed.connectionReuseGrpcDesc':
    'すべての呼び出しは自身の HTTP/2 接続を開き、呼び出しの終了時に閉じます。呼び出しの間で何もプールされず維持されないため、キープアライブは呼び出しが開いている間だけ動きます。',
  'workbench.editors.request.settings.managed.followRedirectsBrowserDesc':
    'ブラウザーはリダイレクトされたハンドシェイクを決して追跡しません。3xx 応答は接続を失敗させます。リダイレクトを追跡するには、セッションをデスクトップアプリまたはサーバーで実行してください。',
  'workbench.editors.request.settings.managed.httpVersion': 'HTTP バージョン',
  'workbench.editors.request.settings.managed.httpVersionDesc':
    'ブラウザーは接続ごとに HTTP/1.1、HTTP/2、または HTTP/3 をネゴシエートします。fetch API はバージョンの選択を公開していません。',
  'workbench.editors.request.settings.managed.sslVerificationDesc':
    '証明書はブラウザーのポリシーで検証されます。無効な証明書を持つホストへのリクエストは失敗し、検証をリクエストごとに無効にすることはできません。',
  'workbench.editors.request.settings.managed.followOriginalMethodDesc':
    '301/302/303 のリダイレクトでは、fetch 仕様に従いブラウザーが GET 以外のメソッドを GET に切り替えます。307/308 は常にメソッドを維持します。',
  'workbench.editors.request.settings.managed.followAuthHeaderDesc':
    'リダイレクトが別のオリジンに渡るとき、ブラウザーは Authorization ヘッダーを取り除きます。この安全のための振る舞いは上書きできません。',
  'workbench.editors.request.settings.managed.refererRedirect': 'リダイレクト時に Referer ヘッダーを削除',
  'workbench.editors.request.settings.managed.refererRedirectDesc':
    'リダイレクトをまたぐ Referer の扱いは、拡張機能コンテキストのブラウザーのリファラーポリシーに従います。',
  'workbench.editors.request.settings.managed.strictParser': '厳格な HTTP パーサー',
  'workbench.editors.request.settings.managed.strictParserBrowserDesc':
    'ブラウザーのネットワークスタックは不正なレスポンスヘッダーを常に拒否します。寛容なモードはありません。',
  'workbench.editors.request.settings.managed.strictParserNodeDesc':
    'ランタイムの HTTP パーサーは不正なレスポンスヘッダーを拒否します。寛容なモードはありません。',
  'workbench.editors.request.settings.managed.encodeUrl': 'URL を自動的にエンコード',
  'workbench.editors.request.settings.managed.encodeUrlDesc':
    'URL のパスとクエリは、リクエストがワイヤーに乗る前に URL パーサーがパーセントエンコードします。エンコード済みの並びはそのまま入力すれば保たれます。',
  'workbench.editors.request.settings.managed.cipherOrder': 'サーバーの暗号スイート順',
  'workbench.editors.request.settings.managed.cipherOrderDesc':
    'TLS の暗号ネゴシエーションはブラウザーが所有します。スイートのリストも順序も構成できません。',
  'workbench.editors.request.settings.managed.maxRedirectsDesc':
    'fetch API はリダイレクトチェーンを約 20 ホップで打ち切ります。リクエストごとの上限は実装できません。manual リダイレクトモードは追跡するヘッダーのない不透明なレスポンスを返します。',
  'workbench.editors.request.settings.managed.tlsVersions': 'TLS/SSL プロトコルバージョン',
  'workbench.editors.request.settings.managed.tlsVersionsDesc':
    '有効な TLS プロトコルバージョンはブラウザーが固定しています。リクエストごとの選択は公開されていません。',
  'workbench.editors.request.settings.managed.referer': 'Referer ヘッダー',
  'workbench.editors.request.settings.managed.refererDesc':
    'ランタイムにはページのコンテキストがないため、自分でヘッダーとして追加しない限り Referer はワイヤーに乗りません。',
  'workbench.editors.request.settings.managed.scripts': 'プリリクエスト / ポストレスポンススクリプト',
  'workbench.editors.request.settings.managed.scriptsNotRun': 'ここでは実行なし',
  'workbench.editors.request.settings.managed.scriptsNotRunDesc':
    'この面の送信に応答するホストにはスクリプトランタイムがないため、プリリクエストとポストレスポンスのスクリプトは飛ばされ、レスポンスにスクリプトの結果は含まれません。',
  'workbench.editors.request.settings.managed.scriptsSafeForwarded': 'セーフモード',
  'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc':
    'この面の送信は接続中のバックエンドで実行され、プリリクエストとポストレスポンスのスクリプトはそのサンドボックス化されたセーフランタイムで動きます。oh.* スクリプト API のみで、ファイルシステム、プロセスへのアクセス、モジュールローダーはありません。転送された送信は決して開発者モードでは実行されず、各実行は実行時のモードをレスポンスに記録します。',

  // ── Settings tab — script execution chooser (per-workspace,
  //    host-local — never syncs) ───────────────────────────────────────
  'workbench.editors.request.settings.scriptMode': 'スクリプトの実行',
  'workbench.editors.request.settings.scriptModeSummary':
    'このワークスペースのプリリクエストとポストレスポンスのスクリプトをこのデバイスでどう実行するかです。',
  'workbench.editors.request.settings.scriptModeDescription':
    'この選択はワークスペース内のすべてのリクエストに適用され、このデバイスに留まり、決して同期されません。各実行は実行時のモードをレスポンスに記録します。',
  'workbench.editors.request.settings.scriptModeModesHeading': 'モード',
  'workbench.editors.request.settings.scriptModeSafe': 'セーフモード',
  'workbench.editors.request.settings.scriptModeDeveloper': '開発者モード',
  'workbench.editors.request.settings.scriptModeWarning':
    '開発者モードはこのワークスペースのスクリプトを完全なシステムアクセス（ファイルシステム、プロセス、ネットワーク）で実行します。このワークスペースのスクリプトを編集できる全員を信頼できる場合にのみ有効にしてください。ワークフローのステップと他のデバイスから転送されたリクエストは引き続きセーフモードで実行されます。',

  // ── Request editor — script-mode tag (tab-bar chip + chooser popover;
  //    same per-workspace host-local slot as the Settings row) ─────────
  'workbench.editors.request.settings.scriptModeTagAria': 'スクリプトの実行：{mode}',
  'workbench.editors.request.settings.scriptModeRecommended': '推奨',
  'workbench.editors.request.settings.scriptModeSafeCard':
    'スクリプトはアプリのサンドボックス化されたスクリプトランタイムで実行されます。oh.* スクリプト API のみで、ファイルシステムやプロセスへのアクセス、モジュールローダーはありません。',
  'workbench.editors.request.settings.scriptModeDeveloperCard':
    'スクリプトは完全な Node.js ランタイムで実行されます。require、ファイルシステム、プロセス、ネットワークアクセス。',
  'workbench.editors.request.settings.scriptModeDeveloperTrust':
    'このワークスペースのスクリプトを編集できる全員を信頼できる場合にのみ使用してください',
  'workbench.editors.request.settings.scriptModeScopeNote':
    'このワークスペースのすべてのリクエストに、このデバイスでのみ適用されます。選択は決して同期されません。',

  // ── Settings tab — cookie jar row ──────────────────────────────────
  'workbench.editors.request.settings.jar.count': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: 'このワークスペースのジャーに {count} 件の Cookie',
    }),
  'workbench.editors.request.settings.jar.infoTitle': 'Cookie ジャーの内容',
  'workbench.editors.request.settings.jar.infoSummary':
    'このワークスペースのメモリ上のジャーが現在保持している Cookie です。ジャー有効の送信が保存し、一致するジャー有効の送信に添付され、アプリの終了時に消えます。値はセッションの資格情報であり、アプリのネットワークランタイムの中に留まります。名前、スコープ、有効期限だけが表示されます。',
  'workbench.editors.request.settings.jar.storedHeading': '保存された Cookie',
  'workbench.editors.request.settings.jar.clear': '消去',
  'workbench.editors.request.settings.jar.delete': '{name} を削除',
  'workbench.editors.request.settings.jar.expires': '有効期限 {date}',
  'workbench.editors.request.settings.jar.session': 'セッション',
  'workbench.editors.request.settings.jar.httpsOnly': 'https のみ',

  // ── Response panel shell (status/duration/size VALUES stay raw —
  //    parity vocabulary and diagnostic measurement, plan §3) ─────────
  'workbench.editors.request.response.title': 'レスポンス',
  'workbench.editors.request.response.clear': '消去',
  'workbench.editors.request.response.saveResponse': 'レスポンスを保存',
  'workbench.editors.request.response.createWorkflow': 'ワークフローを作成',
  'workbench.editors.request.response.createWorkflowNew': '新しいワークフローを作成',
  'workbench.editors.request.response.createWorkflowAttach': '既存のワークフローにアタッチ',
  'workbench.editors.request.response.createWorkflowNeedsSave':
    'このリクエストは未保存です。ワークフローで使うには先に保存してください',
  'workbench.editors.request.response.copyBody': 'ボディをコピー',
  'workbench.editors.request.response.saveBodyToFile': 'ボディをファイルに保存',
  'workbench.editors.request.response.saveBodyToFileTruncated':
    'ボディをファイルに保存（切り詰め済み。保持された分を保存）',
  'workbench.editors.request.response.clearResponse': 'レスポンスを消去',
  'workbench.editors.request.response.moreActionsAria': 'その他のレスポンス操作',
  'workbench.editors.request.response.copied': 'コピーしました',
  // View-tab nouns are DevTools parity vocabulary — keyed for uniform
  // lookup, glossary-protected on translator handoff (S4 precedent).
  'workbench.editors.request.response.tab.body': 'ボディ',
  'workbench.editors.request.response.tab.headers': 'ヘッダー（{count}）',
  'workbench.editors.request.response.tab.cookies': 'Cookie（{count}）',
  'workbench.editors.request.response.tab.assertions': 'アサーション',
  'workbench.editors.request.response.tab.assertionsFailed': 'アサーション（{count} 件不合格）',
  'workbench.editors.request.response.tab.assertionsPassed': 'アサーション（{count} 件合格）',
  'workbench.editors.request.response.tab.console': 'コンソール（{count}）',

  // ── Response meta strip (values raw; chip labels + popovers keyed) ──
  'workbench.editors.request.response.meta.kicker': 'レスポンスのメタ',
  'workbench.editors.request.response.meta.timingTitle': 'タイミング',
  'workbench.editors.request.response.meta.timingSummary': 'fetch 呼び出しの前後で計測：{duration}。',
  'workbench.editors.request.response.meta.timingNoEntry':
    'プラットフォームはこのリクエストの resource-timing エントリを記録しなかったため、フェーズの内訳はありません。',
  'workbench.editors.request.response.meta.timingTotalOnly':
    'ネットワーク合計 {duration}。サーバーはこのクロスオリジンリクエストにタイミングの詳細を公開しなかったため（Timing-Allow-Origin ヘッダーなし）、DNS / 接続 / TTFB / ダウンロードのフェーズは非表示です。',
  // Phase-ladder labels — devtools waterfall parity vocabulary,
  // glossary-protected on translator handoff.
  'workbench.editors.request.response.meta.phase.redirect': 'リダイレクト',
  'workbench.editors.request.response.meta.phase.stalled': '停滞',
  'workbench.editors.request.response.meta.phase.dns': 'DNS ルックアップ',
  'workbench.editors.request.response.meta.phase.connect': 'TCP 接続',
  'workbench.editors.request.response.meta.phase.tls': 'TLS ハンドシェイク',
  'workbench.editors.request.response.meta.phase.waiting': '待機（TTFB）',
  'workbench.editors.request.response.meta.phase.download': 'コンテンツのダウンロード',
  'workbench.editors.request.response.meta.totalNetwork': '合計（ネットワーク）',
  'workbench.editors.request.response.meta.noteNodePhaseLegs':
    'DNS、接続、TLS はアプリのネットワークランタイムから送信ごとに観測できないため、待機に含まれています。',
  'workbench.editors.request.response.meta.sizeTitle': 'サイズ',
  'workbench.editors.request.response.meta.sizeSummary': 'この交換の各方向のバイト数です。',
  'workbench.editors.request.response.meta.responseSize': 'レスポンスサイズ',
  'workbench.editors.request.response.meta.requestSize': 'リクエストサイズ',
  'workbench.editors.request.response.meta.rowHeaders': 'ヘッダー',
  'workbench.editors.request.response.meta.rowBody': 'ボディ',
  'workbench.editors.request.response.meta.rowCompressed': '圧縮後',
  'workbench.editors.request.response.meta.rowTransferred': '転送量',
  'workbench.editors.request.response.meta.noteHeaderBytes':
    'ヘッダーのバイト数は表示上のものです。HTTP/2 以降はワイヤー上で圧縮します。',
  'workbench.editors.request.response.meta.noteRequestHeaders':
    'リクエストヘッダーはこの送信が設定したものだけを数えます。ブラウザーは独自のもの（Host、User-Agent、…）を追加します。',
  'workbench.editors.request.response.meta.noteRequestHeadersNode':
    'リクエストヘッダーはこの送信が設定したものだけを数えます。ランタイムは独自のもの（Host、Accept-Encoding、…）を追加します。',
  'workbench.editors.request.response.meta.noteTruncatedAtCap':
    'ボディはレスポンスサイズ上限 {cap} で切り詰められました。完全なサイズが数えられています。',
  'workbench.editors.request.response.meta.noteTruncated':
    'ボディの表示は切り詰められています。完全なサイズが数えられています。',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    'リクエストボディのサイズは概算です。multipart の boundary はブラウザーが生成します。',
  'workbench.editors.request.response.meta.noteWireHidden':
    'ワイヤーサイズ（圧縮後、転送量）は非表示です。サーバーが Timing-Allow-Origin を送りませんでした。',
  'workbench.editors.request.response.meta.networkTitle': 'ネットワーク',
  'workbench.editors.request.response.meta.networkSummary': 'この交換の接続レベルの事実です。',
  'workbench.editors.request.response.meta.httpVersion': 'HTTP バージョン',
  'workbench.editors.request.response.meta.localAddress': 'ローカルアドレス',
  'workbench.editors.request.response.meta.remoteAddress': 'リモートアドレス',
  'workbench.editors.request.response.meta.noteVersionHiddenNode':
    'HTTP バージョンは非表示です。この送信ではネゴシエートされたプロトコルを観測できませんでした（プロキシ経由の送信はトンネルの中でネゴシエートします）。',
  'workbench.editors.request.response.meta.noteVersionHiddenBrowser':
    'HTTP バージョンは非表示です。プラットフォームはこのリクエストのタイミングエントリを記録しませんでした。',
  'workbench.editors.request.response.meta.noteNoIp':
    'リモートアドレスは利用できません。ワイヤーキャプチャはこの fetch について何も捉えませんでした。',
  'workbench.editors.request.response.meta.tlsProtocol': 'TLS プロトコル',
  'workbench.editors.request.response.meta.tlsCipher': '暗号名',
  'workbench.editors.request.response.meta.tlsCertificate': '証明書の CN',
  'workbench.editors.request.response.meta.tlsIssuer': '発行者の CN',
  'workbench.editors.request.response.meta.tlsValidUntil': '有効期限',
  'workbench.editors.request.response.meta.tlsUnverifiedVerdict': '証明書は未検証（{code}）',
  'workbench.editors.request.response.meta.trustPinned':
    'このデバイスで証明書をピン留めしました。もう一度送信して検証してください。',
  'workbench.editors.request.response.meta.noteNoTls':
    'ローカルアドレス、TLS、証明書の詳細は Chromium 上の拡張機能コードには公開されていません。',
  'workbench.editors.request.response.meta.tlsSelfSigned': '自己署名証明書',
  'workbench.editors.request.response.meta.tlsUnverified': '証明書は未検証',
  'workbench.editors.request.response.meta.tlsFloorLowered': 'TLS の下限を引き下げ',
  'workbench.editors.request.response.meta.tlsFloorLoweredSummary':
    'このリクエストは設定で TLS 最小バージョンを 1.2 未満にして送信されたため、接続は TLS 1.0 または 1.1 のネゴシエートを許可されました。既知の弱点を持ち、ランタイムがデフォルトで無効にしているプロトコルバージョンです。',
  'workbench.editors.request.response.meta.authForwarded': 'Authorization を転送',
  'workbench.editors.request.response.meta.authForwardedSummary':
    'リダイレクトがこのリクエストを別のオリジンに連れて行き、設定がオリジンをまたいで Authorization ヘッダーを維持するため、資格情報は新しいホストに再送されました。通常、このヘッダーはリダイレクトが元のオリジンを離れるときに落とされます。',
  'workbench.editors.request.response.meta.authTitle': '認可',
  'workbench.editors.request.response.meta.authSummaryRequest': 'リクエスト自身の {type} 構成で送信されました。',
  'workbench.editors.request.response.meta.authSummaryInherited': '{type}。{source} から継承。',
  'workbench.editors.request.response.meta.authSummaryNone':
    '認可なしで送信されました。リクエストの上位には何も設定されていません。',
  'workbench.editors.request.response.meta.authDangling':
    'リクエストが選んだエントリはもう存在しません。代わりにデフォルトが適用されました。',
  // The Inherited settings tag — the knobs the run took from the
  // levels above the request, each listed against its source.
  'workbench.editors.request.response.meta.inheritedSettingsTag': '継承した設定 · {count}',
  'workbench.editors.request.response.meta.inheritedSettingsTitle': '継承した設定',
  'workbench.editors.request.response.meta.inheritedSettingsSummary':
    '実行がリクエストの上位のコレクションまたはフォルダーから取った設定です。設定タブに表示されるのと同じ方法で解決され、リクエスト自身の値がチェーンより優先されます。',
  'workbench.editors.request.response.meta.inheritedSettingsHeading': '設定 · 設定元',
  'workbench.editors.request.response.meta.scriptsTag': 'スクリプト · {count}',
  'workbench.editors.request.response.meta.scriptsTitle': 'スクリプトチェーン',
  'workbench.editors.request.response.meta.scriptsSummary':
    'チェーンのすべてのレベルが実行され成功しました。プリリクエストもポストレスポンスも、コレクションとフォルダーのスクリプトがリクエスト自身のものより先に。実行が実際に行ったことから記録されています。',
  'workbench.editors.request.response.meta.scriptsSummaryFailed':
    'チェーンのあるレベルが失敗しました。下の行がどれと理由を示します。',
  'workbench.editors.request.response.meta.scriptsLevelRequest': 'リクエスト',
  'workbench.editors.request.response.meta.scriptsDuration': '{ms} ms',
  'workbench.editors.request.response.meta.executedOnTag': '{name} から送信',
  'workbench.editors.request.response.meta.executedOnTitle': '接続中のバックエンドで実行',
  'workbench.editors.request.response.meta.executedOnSummary':
    'このリクエストはこのデバイスからではなく、「{name}」（この面が接続しているバックエンド）から送信されました。対象サーバーはそのマシンの IP アドレスとネットワーク上の位置を見ているため、地域や IP に基づく振る舞いはバックエンドの実行場所を反映します。実行したホストがこの実行に記録しました。',
  'workbench.editors.request.response.meta.cookieJar': 'Cookie jar',
  'workbench.editors.request.response.meta.cookieJarSummary':
    'このリクエストはワークスペースのメモリ上の Cookie ジャーを使いました。一致する保存済み Cookie が自動的に添付され、Set-Cookie レスポンスは後のジャー有効の送信のために保持されました。',
  'workbench.editors.request.response.meta.jarAttachedLabel': '最初のリクエストに添付',
  'workbench.editors.request.response.meta.jarAttachedNone':
    'なし。一致する保存済み Cookie がなかったか、リクエストに設定した Cookie ヘッダーが優先されました。',
  'workbench.editors.request.response.meta.jarStoredLabel': 'Set-Cookie レスポンスから保存',
  'workbench.editors.request.response.meta.jarStoredNone': 'なし。Cookie を設定したレスポンスはありませんでした。',
  'workbench.editors.request.response.meta.proxyTag': 'プロキシ経由',
  'workbench.editors.request.response.meta.proxyTitle': 'プロキシ経路',
  'workbench.editors.request.response.meta.proxySummaryRequest':
    'この実行は自身のリクエスト設定で設定されたプロキシをトンネルしました。送信が実際に行ったことから記録されています。',
  'workbench.editors.request.response.meta.proxySummarySystem':
    'この実行は実行デバイスのシステムが指定するプロキシをトンネルしました。実行が実際に行ったことから記録されており、設定のライブ読み取りではありません。',
  'workbench.editors.request.response.meta.proxyRowUrl': 'プロキシ',
  'workbench.editors.request.response.meta.proxyRowSource': '決定元',
  'workbench.editors.request.response.meta.proxySourceRequest': 'リクエスト設定',
  'workbench.editors.request.response.meta.proxySourceDevice': 'デバイスのプロキシ設定',
  'workbench.editors.request.response.meta.proxySourceEnv': '環境変数',
  'workbench.editors.request.response.meta.proxySourceSystem': 'システムのプロキシ設定',
  'workbench.editors.request.response.meta.proxySourceManual': '手動のプロキシ構成',
  'workbench.editors.request.response.meta.proxySourcePac': 'PAC スクリプト',
  'workbench.editors.request.response.meta.proxyStandDownTag': 'プロキシをバイパス',
  'workbench.editors.request.response.meta.proxyStandDownTitle': 'システムプロキシが退きました',
  'workbench.editors.request.response.meta.proxyStandDownUnixSocket':
    'システムはプロキシを指定していますが、この実行はプロキシトンネルがダイヤルできないローカルソケットを対象にしているため、直接進みました。',
  'workbench.editors.request.response.meta.proxyStandDownResolveToAddress':
    'システムはプロキシを指定していますが、この実行は独自のアドレス解決を固定しており、プロキシはそれを上書きしてしまうため、直接進みました。',
  'workbench.editors.request.response.meta.proxyStandDownHttpVersion3':
    'システムはプロキシを指定していますが、この実行は独自の QUIC 経路をダイヤルする HTTP/3 に固定されているため、直接進みました。',
  'workbench.editors.request.response.meta.redirects': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のリダイレクト' }),
  'workbench.editors.request.response.meta.redirectsTitle': 'リダイレクトチェーン',
  'workbench.editors.request.response.meta.redirectsSummary':
    '最終レスポンスの前にこのリクエストが追跡したホップです。それぞれ送信されたリクエストと、それに応答したリダイレクトを表示し、送信の実行時に記録されました。',
  'workbench.editors.request.response.meta.redirectMethodChanged': '次のリクエストでメソッドが {method} に変更',
  'workbench.editors.request.response.meta.redirectAuthStripped':
    'Authorization ヘッダーを削除。次のリクエストは別のオリジンに渡りました',
  'workbench.editors.request.response.meta.redirectAuthForwarded':
    'Authorization ヘッダーをオリジンをまたいで再送。このリクエストの設定で維持',
  'workbench.editors.request.response.meta.redirectFinal': '最終レスポンス',
  'workbench.editors.request.response.meta.streamedEnd': 'ストリーム終了',
  'workbench.editors.request.response.meta.streamedStop': '停止',
  'workbench.editors.request.response.meta.streamedCap': 'ストリーム上限',
  'workbench.editors.request.response.meta.streamedTimeout': 'ストリーム中にタイムアウト',
  'workbench.editors.request.response.meta.streamedError': 'ストリーム失敗',
  'workbench.editors.request.response.meta.streamedEndSummary':
    'このレスポンスはサーバーがストリームを閉じるまでライブでストリーミングされました。下のボディは完全なキャプチャです。',
  'workbench.editors.request.response.meta.streamedPartialSummary':
    '交換の終了時にレスポンスはまだストリーミング中だったため、下のボディはその時点までの部分的なキャプチャです。届いたものはすべて保持されています。',
  'workbench.editors.request.response.streamReceiving': 'ストリームを受信中：{size}',

  // ── SSE event list (event names like `message`/`comment` are wire
  //    grammar terms and stay untranslated) ────────────────────────────
  'workbench.editors.request.response.sse.connected': '{url} に接続',
  'workbench.editors.request.response.sse.closed': '接続が閉じられました',
  'workbench.editors.request.response.sse.stopped': '接続を停止しました',
  'workbench.editors.request.response.sse.capped': 'キャプチャ上限。ボディの上限に達しました',
  'workbench.editors.request.response.sse.timedOut': '接続がタイムアウトしました',
  'workbench.editors.request.response.sse.failed': '接続に失敗しました',
  'workbench.editors.request.response.sse.searchEvents': 'イベントを検索',
  'workbench.editors.request.response.sse.noMatches': '一致するイベントはありません。',
  'workbench.editors.request.response.sse.waiting': 'イベントを待っています…',
  'workbench.editors.request.response.sse.eventCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のイベント' }),
  'workbench.editors.request.response.sse.clearEvents': 'イベントを消去（表示のみ）',
  'workbench.editors.request.response.sse.newEvents': '新しいイベント',
  'workbench.editors.request.response.sse.sortOrder': '並び順',
  'workbench.editors.request.response.sse.newestFirst': '新しい順',
  'workbench.editors.request.response.sse.oldestFirst': '古い順',
  'workbench.editors.request.response.sse.groupByName': 'イベント名でグループ化',
  'workbench.editors.request.response.sse.rowsPerGroup': 'グループごとの行数',
  'workbench.editors.request.response.sse.noLimit': '制限なし',
  'workbench.editors.request.response.sse.infoId': 'ID',
  'workbench.editors.request.response.sse.infoSize': 'サイズ',
  'workbench.editors.request.response.sse.infoRetry': 'Retry',
  'workbench.editors.request.response.sse.eventInfoAria': 'イベントの詳細',

  // ── Response body view (filter syntax + format examples stay raw) ──
  'workbench.editors.request.response.body.truncatedNotice': 'レスポンスは {cap} で切り詰められました（元は {size}）。',
  'workbench.editors.request.response.body.increaseLimit': '上限を引き上げ',
  'workbench.editors.request.response.body.limitHint': '上限は API リクエストの設定で調整できます。',
  'workbench.editors.request.response.body.viewPickerAria': 'ボディの表示',
  'workbench.editors.request.response.body.preview': 'プレビュー',
  'workbench.editors.request.response.body.wrapLines': '行を折り返す',
  'workbench.editors.request.response.body.unwrapLines': '折り返しを解除',
  'workbench.editors.request.response.body.renderAnsi': 'ANSI カラーを描画',
  'workbench.editors.request.response.body.plainAnsi': 'プレーンテキストを表示',
  'workbench.editors.request.response.body.filterJsonPathTooltip': 'ボディをフィルター（JSONPath）',
  'workbench.editors.request.response.body.filterXPathTooltip': 'ボディをフィルター（XPath）',
  'workbench.editors.request.response.body.filterMetricsTooltip': 'ボディをフィルター（メトリクスファミリー）',
  'workbench.editors.request.response.body.filterAria': 'ボディをフィルター',
  'workbench.editors.request.response.body.invalidJsonPath': '無効な JSONPath 式です。',
  'workbench.editors.request.response.body.invalidXPath': '無効な XPath 式か、文書を解析できません。',
  'workbench.editors.request.response.body.invalidMetricsFilter': '無効なメトリクスセレクターです。',
  'workbench.editors.request.response.body.noMatches': 'このパスに一致するものはありません。',
  'workbench.editors.request.response.body.showingLastMatch': '最後の一致を表示しています。',
  'workbench.editors.request.response.body.hexCapNotice': 'Hex 表示は {total} のうち最初の {shown} を表示しています。',
  'workbench.editors.spec.tab': '仕様',
  'workbench.editors.spec.noSpecs': 'このワークスペースに {format} 仕様はまだありません。',
  'workbench.editors.spec.goToSpecs': '仕様へ移動',
  'workbench.editors.timelineViewer.format': 'メッセージ形式',
  'workbench.editors.timelineViewer.showMessage': 'メッセージを表示',
  'workbench.editors.timelineViewer.showHexdump': 'Hexdump を表示',
  'workbench.editors.request.response.body.previewIframeTitle': 'レスポンスのプレビュー',
  'workbench.editors.request.response.body.pdfPreviewIframeTitle': 'PDF プレビュー',
  'workbench.editors.request.response.body.imagePreviewAlt': 'レスポンスの画像',
  'workbench.editors.request.response.body.imagePreviewFailed':
    '画像データをデコードできません。生のバイトは Hex 表示で確認してください。',
  'workbench.editors.request.response.body.mediaPreviewAria': 'メディアのプレビュー',
  'workbench.editors.request.response.body.mediaPreviewFailed':
    'メディアデータをデコードできません。生のバイトは Hex 表示で確認してください。',
  'workbench.editors.request.response.body.requestBodyOmittedNotice':
    'リクエストボディは送信されていません。ブラウザーは GET や HEAD リクエストにボディを添付できません。',
  'workbench.editors.request.response.body.duplicateJsonKeysNotice':
    'JSON キーが重複しています。最後の値を表示しています：{keys}',
  'workbench.editors.request.response.body.partialJsonNotice':
    '切り詰められたボディです。プレビューとフィルターは完全にキャプチャされた値だけを表示します。',
  'workbench.editors.request.response.body.schemalessDecodeNotice':
    'スキーマなしのデコード（ベストエフォート）です。フィールド番号を表示し、ネストとテキストはワイヤーのバイトから推測しています。',

  // ── Response headers view ──────────────────────────────────────────
  'workbench.editors.request.response.headers.name': '名前',
  'workbench.editors.request.response.headers.value': '値',
  'workbench.editors.request.response.headers.filterPlaceholder': 'ヘッダーをフィルター',
  'workbench.editors.request.response.headers.copyAll': 'すべてのヘッダーをコピー',
  'workbench.editors.request.response.headers.copyAria': '{name} をコピー',
  'workbench.editors.request.response.headers.copyTitle': 'ヘッダーをコピー',
  'workbench.editors.request.response.headers.empty': 'ヘッダーなし',
  'workbench.editors.request.response.headers.noMatch': '「{query}」に一致するヘッダーはありません',
  'workbench.editors.request.response.headers.trailers': 'Trailers',

  // ── Response cookies view (Set-Cookie attribute column names stay
  //    raw wire vocabulary: Domain / Path / Expires / HttpOnly /
  //    Secure / SameSite) ─────────────────────────────────────────────
  'workbench.editors.request.response.cookies.name': '名前',
  'workbench.editors.request.response.cookies.value': '値',
  'workbench.editors.request.response.cookies.copyAria': '{name} の Set-Cookie をコピー',
  'workbench.editors.request.response.cookies.copyTitle': 'Set-Cookie 行をコピー',
  'workbench.editors.request.response.cookies.noteCredentialsInclude':
    'このリクエストは資格情報を含めて実行されたため、ブラウザーはこれらの Cookie を（各 Cookie 自身の属性に従って）保存した可能性があり、今後の資格情報付きリクエストで送信します。',
  'workbench.editors.request.response.cookies.noteCredentialsOmit':
    'サーバーはこれらの Cookie を送りましたが、このリクエストは資格情報を省いて（デフォルト）実行されたため、ブラウザーは破棄しました。何も保存されていません。',
  'workbench.editors.request.response.cookies.noteJarOff':
    'これらの Cookie は保存されませんでした。このリクエストは Cookie ジャーなしで（デフォルト）実行されたか、ジャーがどれも受け入れませんでした。',
  'workbench.editors.request.response.cookies.noteJarStored':
    'このリクエストは Cookie ジャーをオンにして実行され、今後のジャー有効のリクエストのために {names} をワークスペースのメモリ上のジャーに保存しました。',
  'workbench.editors.request.response.cookies.noteJarStoredMidChain':
    'このリクエストは Cookie ジャーをオンにして実行され、今後のジャー有効のリクエストのために {names} をワークスペースのメモリ上のジャーに保存しました。一部は途中のリダイレクトホップで設定されたため、その Set-Cookie 行はここには載っていません。載っているのは最終レスポンスのヘッダーだけです。',

  // ── Response assertions / console views (log levels + script output
  //    stay raw; assertion durations are diagnostic timing — exempt) ──
  'workbench.editors.request.response.assertions.pass': '合格',
  'workbench.editors.request.response.assertions.fail': '不合格',
  'workbench.editors.request.response.console.preRequest': 'リクエスト前',
  'workbench.editors.request.response.console.postResponse': 'レスポンス後',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': 'リクエストを送信しています…',
  'workbench.editors.request.response.empty.prompt': 'リクエストを送信すると、ここにレスポンスが表示されます。',
  'workbench.editors.request.response.error.title': 'リクエストを送信できませんでした',
  'workbench.editors.request.response.error.openInTab': '新しいタブで開く',
  'workbench.editors.request.response.error.trust.title': '{origin} が提示した証明書を信頼',
  'workbench.editors.request.response.error.trust.probing': 'サーバーが提示する証明書を読み取っています…',
  'workbench.editors.request.response.error.trust.probeFailed': 'サーバーの証明書を読み取れませんでした：{message}',
  'workbench.editors.request.response.error.trust.retryProbe': 'もう一度試す',
  'workbench.editors.request.response.error.trust.failure': '失敗',
  'workbench.editors.request.response.error.trust.noAnchor':
    'サーバーはルート証明書を提示しないため、ここでピン留めできるものはありません。発行元の CA を設定 › API リクエスト › TLS で追加してください。',
  'workbench.editors.request.response.error.trust.trustOnDevice': 'このデバイスで信頼',
  'workbench.editors.request.response.error.trust.addToWorkspace': 'ワークスペースに追加',
  'workbench.editors.request.response.error.certSteps.summary':
    'ローカルの開発サーバーは通常、自己署名証明書で動作しており、受け入れる必要があります。',
  'workbench.editors.request.response.error.certSteps.step1': 'URL を新しいタブで開く',
  'workbench.editors.request.response.error.certSteps.step2': '証明書の警告を受け入れる',
  'workbench.editors.request.response.error.certSteps.step2DetailChromium': '詳細設定 → …に進む（安全ではありません）',
  'workbench.editors.request.response.error.certSteps.step2DetailFirefox': '詳細情報… → 危険性を承知で続行',
  'workbench.editors.request.response.error.certSteps.step3': 'リクエストをもう一度送信する',
  'workbench.editors.request.response.error.certSteps.glyphNewTab': '新しいタブ',
  'workbench.editors.request.response.error.certSteps.glyphAdvanced': '詳細設定',
  'workbench.editors.request.response.error.certSteps.glyphSend': '▶ 送信',
  'workbench.editors.request.response.error.certSteps.glyphProceedChromium': '…に進む（安全ではありません）',
  'workbench.editors.request.response.error.certSteps.glyphProceedFirefox': '危険性を承知で続行',
} as const satisfies Catalog;
