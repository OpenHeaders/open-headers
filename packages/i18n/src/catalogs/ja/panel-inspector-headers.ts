/**
 * DevTools panel — inspector Headers tab — Japanese. Mirrors
 * `catalogs/en/panel-inspector-headers.ts` key for key. Header names,
 * category names, directive tokens, filter grammar tokens (name: /
 * value: / is:), Set-Cookie / SameSite / JWT / alg / scheme
 * vocabulary, `A → Z` / `Train-Case`, and wire values stay raw.
 * Mints: 暫定ヘッダー = provisional headers (Chrome ja vocabulary);
 * ノイズヘッダー = noise headers; 一般 = the General section; 範囲 =
 * status ranges (numeric referent — distinct from the debug-reach
 * スコープ); ドメイン別変数 = per-domain variable; ヘッダー部 = the
 * JWT header segment (distinct from HTTP ヘッダー); クレーム = JWT
 * claim; 一致したルール = Matched Rules; 文字化け = mojibake;
 * multipart rides raw (multipart 境界). Expiry rides the 有効期限 /
 * 期限切れ family (shared-info-cookies mint); ブロック = block
 * carried from the shared register.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorHeaders = {
  // ── Headers tab (inspector detail). Raw by design: header names and
  // values, filter grammar tokens inside the placeholder (name: /
  // value: / is: must survive translation verbatim), header category
  // labels (shared registry lock — category names never localize),
  // Set-Cookie / SameSite / JWT / alg / scheme / cache-directive chip
  // vocabulary, the `exp {duration}` and `boundary` chips, the ALPN
  // hover title, General row wire values, and the ▾ / → / ⚠ / · / +
  // glyphs beside keyed values. General row labels are keyed —
  // info-table labels (section-tab shading), not the network-table
  // parity lock, whose scope is hot-path column headers. ─────────────
  'panel.inspector.headers.filterPlaceholder':
    'フィルター：テキスト、name:cookie、value:no-cache、is:rule、is:security、is:overridable、…',
  'panel.inspector.headers.filterAria': 'ヘッダーを絞り込む',
  'panel.inspector.headers.footprintTitle': '{rules}。クリックすると「一致したルール」が開きます',

  // General section + the rule-creation CTAs on its summary. The
  // query-params CTA label reuses `panel.inspector.overrideCta.
  // overrideQueryParams` (same control, same popover); its hover title
  // is this surface's own sentence.
  'panel.inspector.headers.generalSection': '一般',
  'panel.inspector.headers.createApiRequest': 'API リクエストを作成',
  'panel.inspector.headers.createApiRequestTitle':
    'このリクエストをワークベンチの API クライアントで、入力済みの下書きとして開きます。保存するまで何も保存されません',
  'panel.inspector.headers.redirect.label': 'リダイレクト',
  'panel.inspector.headers.redirect.title':
    '一致するリクエストを別の場所へ送ります。宛先の事前入力方法を選んでください',
  'panel.inspector.headers.redirect.url': 'リダイレクト URL…',
  'panel.inspector.headers.redirect.urlTitle':
    '一致するリクエストを別の URL へ送ります。宛先はドメイン別変数として事前入力されます',
  'panel.inspector.headers.redirect.replaceHost': 'ホストを置換…',
  'panel.inspector.headers.redirect.replaceHostTitle':
    'パスとクエリを保ったままホストを差し替えます。ドメイン別のホスト変数を事前入力します',
  'panel.inspector.headers.redirect.localhost': 'localhost に向ける…',
  'panel.inspector.headers.redirect.localhostTitle':
    'パスとクエリを保ったまま、http でローカルの開発サーバーへ送ります。ドメイン別のポート変数を事前入力します',
  'panel.inspector.headers.overrideQueryParamsTitle':
    'このリクエストのクエリパラメーターを追加、置換、または削除します',
  'panel.inspector.headers.more.label': 'その他',
  'panel.inspector.headers.more.title': 'その他のリクエスト操作',
  'panel.inspector.headers.more.delay': 'リクエストを遅延',
  'panel.inspector.headers.more.delayTitle': 'このリクエストを遅延させます',
  'panel.inspector.headers.more.block': 'リクエストをブロック',
  'panel.inspector.headers.more.blockTitle': 'このリクエストをブロック / キャンセルします',

  // General rows. The (i) corpus titles reuse these row-label keys and
  // the kicker reuses `generalSection` (names-its-control).
  'panel.inspector.headers.general.requestUrl': 'リクエスト URL',
  'panel.inspector.headers.general.requestMethod': 'リクエストメソッド',
  'panel.inspector.headers.general.statusCode': 'ステータスコード',
  'panel.inspector.headers.general.remoteAddress': 'リモートアドレス',
  'panel.inspector.headers.general.httpVersion': 'HTTP バージョン',
  'panel.inspector.headers.general.compression': '圧縮',
  'panel.inspector.headers.general.transferred': '転送量',
  'panel.inspector.headers.general.referrerPolicy': 'Referrer ポリシー',
  'panel.inspector.headers.general.decodedSuffix': '（デコード後 {size}）',

  // General (i) corpus. Range/protocol/encoding item LABELS (1xx…,
  // HTTP/2, gzip…) are wire vocabulary and stay raw in the builder;
  // the Common values heading reuses the shared header-corpus key.
  'panel.inspector.headers.generalInfo.requestUrl.summary':
    'ブラウザーがリクエストを発行した完全な URL。スキーム、ホスト、パス、クエリ文字列です。',
  'panel.inspector.headers.generalInfo.requestMethod.summary':
    '使用された HTTP メソッド（`GET`、`POST`、`PUT`、`DELETE`、…）。',
  'panel.inspector.headers.generalInfo.statusCode.summary': 'サーバーが返した数値のレスポンスコード。',
  'panel.inspector.headers.generalInfo.statusCode.ranges': '範囲',
  'panel.inspector.headers.generalInfo.statusCode.r1xx': '情報（まれ。`100 Continue`、`103 Early Hints`）。',
  'panel.inspector.headers.generalInfo.statusCode.r2xx': '成功。',
  'panel.inspector.headers.generalInfo.statusCode.r3xx': 'リダイレクト（`Location` ヘッダーを参照）。',
  'panel.inspector.headers.generalInfo.statusCode.r4xx': 'クライアントエラー。リクエストが不正か、未認可です。',
  'panel.inspector.headers.generalInfo.statusCode.r5xx':
    'サーバーエラー。有効なリクエストをサーバーが処理できませんでした。',
  'panel.inspector.headers.generalInfo.remoteAddress.summary': 'リクエストが実際に送られた IP アドレスとポート。',
  'panel.inspector.headers.generalInfo.remoteAddress.description':
    'DNS が複数の IP に解決する、CDN が anycast でルーティングする、ローカルプロキシが接続を傍受する、といった場合に URL のホストと異なります。',
  'panel.inspector.headers.generalInfo.httpVersion.summary': '接続がネゴシエートした HTTP プロトコルのバージョン。',
  'panel.inspector.headers.generalInfo.httpVersion.description':
    'TLS 時に ALPN で選ばれます。実際のワイヤー上の値（例：`h2`、`h3`）は、分かりやすいラベルと異なる場合にツールチップに表示されます。',
  'panel.inspector.headers.generalInfo.httpVersion.http11': 'テキストベースで、デフォルトでは接続ごとに 1 リクエスト。',
  'panel.inspector.headers.generalInfo.httpVersion.http2': 'バイナリで、単一の TCP 接続上で多重化されます。',
  'panel.inspector.headers.generalInfo.httpVersion.http3':
    'UDP 上の QUIC で構築。ハンドシェイクが速く、損失からの回復に優れます。',
  'panel.inspector.headers.generalInfo.compression.summary':
    'サーバーがレスポンスボディに適用したエンコーディング。ブラウザーは JavaScript に見せる前にデコードします。',
  'panel.inspector.headers.generalInfo.compression.gzip': '広くサポートされ、圧縮率は控えめです。',
  'panel.inspector.headers.generalInfo.compression.br':
    'Brotli。gzip より高い圧縮率で、最近のブラウザーはすべてサポートしています。',
  'panel.inspector.headers.generalInfo.compression.zstd':
    '新しい高圧縮率の方式。ブラウザーのサポートが広がっています。',
  'panel.inspector.headers.generalInfo.compression.deflate': 'レガシーで、今日ではほとんど使われません。',
  'panel.inspector.headers.generalInfo.transferred.summary':
    '圧縮のオーバーヘッドを含め、実際にワイヤーを通ったバイト数。',
  'panel.inspector.headers.generalInfo.transferred.description':
    '括弧内のデコード後サイズは、ブラウザーがボディを展開した後に JavaScript が見るサイズです。両者の差が大きいほど圧縮の効果が大きいことになります。',
  'panel.inspector.headers.generalInfo.referrerPolicy.summary':
    'このページからのナビゲーションやリクエストで、ブラウザーが `Referer` に URL のどこまでを送るか。',
  'panel.inspector.headers.generalInfo.referrerPolicy.description':
    '`Referrer-Policy` レスポンスヘッダー、`<meta name="referrer">` タグ、またはリクエストごとの `referrerpolicy` 属性で設定します。',

  // Provisional request headers — banner variants are whole sentences.
  'panel.inspector.headers.provisional.bannerCached':
    '暫定ヘッダーを表示しています。キャッシュから提供されたため、実際に送信されたヘッダーは保存されていません。',
  'panel.inspector.headers.provisional.bannerPending':
    '暫定ヘッダーを表示しています。ワイヤー上のヘッダーセットはまだ確認されていません。',
  'panel.inspector.headers.provisional.title': '暫定ヘッダー',
  'panel.inspector.headers.provisional.kicker': 'リクエスト',
  'panel.inspector.headers.provisional.summary':
    'これらはブラウザーが組み立てて送信しようとしたヘッダーであり、ワイヤーを通った内容の確定したキャプチャではありません。ワイヤー上のセットは異なることがあります（ネットワークスタックが後から Cookie、資格情報、接続ヘッダーを追加します）。',
  'panel.inspector.headers.provisional.whyHeading': 'リクエストに暫定ヘッダーしか表示されない理由',
  'panel.inspector.headers.provisional.cacheLabel': 'キャッシュから提供',
  'panel.inspector.headers.provisional.cacheDesc':
    'ローカルで応答されました（メモリ/ディスクキャッシュまたは Service Worker）。今回はワイヤーに何も送られていないため、実際に送信されたヘッダーは保存されていません。',
  'panel.inspector.headers.provisional.blockedLabel': 'ネットワークに到達せず',
  'panel.inspector.headers.provisional.blockedDesc':
    'ヘッダーの交換が完了する前にブロックされたか失敗しました（無効な URL、CORS/CSP によるブロック、接続エラー）。',
  'panel.inspector.headers.provisional.inFlightLabel': 'まだ処理中',
  'panel.inspector.headers.provisional.inFlightDesc':
    'ワイヤー上のセットはまだ報告されていません。リクエストが完了すると確定します。',

  // Header sections. The `SectionLabel` identifiers stay raw (the
  // search plane compares against them — S36 doc-identifier law);
  // these are their display forms, mapped at the render site.
  'panel.inspector.headers.section.responseHeaders': 'レスポンスヘッダー',
  'panel.inspector.headers.section.requestHeaders': 'リクエストヘッダー',
  'panel.inspector.headers.section.countAria': '表示中のヘッダー数',
  'panel.inspector.headers.section.addHeader': 'ヘッダーを追加',
  'panel.inspector.headers.section.raw': 'Raw',
  'panel.inspector.headers.section.rawTitle': 'プレーンテキストで表示（Name: Value）',
  'panel.inspector.headers.section.copy': 'コピー',
  'panel.inspector.headers.section.copyAll': 'すべてコピー',
  'panel.inspector.headers.section.copyFiltered': '絞り込み結果をコピー',
  'panel.inspector.headers.section.copyCurl': 'cURL としてコピー',
  'panel.inspector.headers.section.copyFetch': 'fetch としてコピー',
  'panel.inspector.headers.section.noneCaptured': 'キャプチャされていません。',
  'panel.inspector.headers.section.noFilterMatch': 'フィルターに一致するヘッダーはありません。',
  'panel.inspector.headers.section.noiseHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 件のノイズヘッダーを非表示。ホバーすると名前が表示されます',
    }),

  // More filters ▾ / View ▾ menus — this tab's own menus, separate
  // referents from the network toolbar's (`panel.moreFilters.*` /
  // `panel.network.view.*`). Reset reuses `panel.menu.resetToDefault`.
  'panel.inspector.headers.moreFilters.label': 'その他のフィルター',
  'panel.inspector.headers.moreFilters.ruleOnly': 'ルールで変更されたもののみ',
  'panel.inspector.headers.moreFilters.securityOnly': 'セキュリティヘッダーのみ',
  'panel.inspector.headers.moreFilters.overridableOnly': '上書き可能なもののみ',
  'panel.inspector.headers.moreFilters.hideNoise': 'ノイズを隠す（Accept-*、Sec-Fetch-*、User-Agent、…）',
  'panel.inspector.headers.view.label': '表示',
  'panel.inspector.headers.view.layout': 'レイアウト',
  'panel.inspector.headers.view.layoutGrouped': 'グループ化',
  'panel.inspector.headers.view.layoutFlat': 'フラット',
  'panel.inspector.headers.view.sort': '並べ替え',
  'panel.inspector.headers.view.sortOriginal': '元の順序',
  'panel.inspector.headers.view.sortAz': 'A → Z',
  'panel.inspector.headers.view.sortRuleFirst': 'ルールで変更されたものを先頭に',
  'panel.inspector.headers.view.nameCase': '名前の大文字小文字',
  'panel.inspector.headers.view.nameCaseTrain': 'Train-Case',
  'panel.inspector.headers.view.nameCaseOriginal': '元のまま（raw）',
  'panel.inspector.headers.view.showTags': 'タグを表示',
  'panel.inspector.headers.view.showSuggestions': '提案を表示',

  // Header rows. Since-fire chips render `· ` raw before the keyed
  // label. Header names ride the override titles as {name} holes.
  'panel.inspector.headers.row.expandValue': '値を展開',
  'panel.inspector.headers.row.collapseValue': '値を折りたたむ',
  'panel.inspector.headers.row.copyValue': '値をコピー',
  'panel.inspector.headers.row.copied': 'コピーしました',
  'panel.inspector.headers.row.edit': '編集',
  'panel.inspector.headers.row.editTitle': 'このヘッダーを設定したルールを編集',
  'panel.inspector.headers.row.override': '上書き',
  'panel.inspector.headers.row.overrideTitle': 'このヘッダーを上書きするルールを作成',
  'panel.inspector.headers.row.overrideProtectedTitle':
    '{name} は保護されたヘッダーです。ブラウザーの Declarative Net Request エンジンは拡張機能による上書きを許可しません。よくある保護名には host、content-length、connection、sec-fetch-*、sec-ch-ua-* があります。',
  'panel.inspector.headers.row.overrideSystemTitle':
    '{name} は Open Headers のシステム機能である {feature} により注入されています。ルールでは上書きできません。',
  'panel.inspector.headers.row.overrideManagedTitle':
    '{name} はすでにあなたのルールの 1 つが管理しています。上書きする代わりに、そのルールのポップオーバーから編集してください。',
  'panel.inspector.headers.row.systemTitle': '{feature} により注入（Open Headers のシステム機能）',
  'panel.inspector.headers.row.sinceFire.deleted': 'その後ルール削除',
  'panel.inspector.headers.row.sinceFire.deletedTitle':
    'このリクエストの後にルールが削除されました。今後のリクエストには適用されません',
  'panel.inspector.headers.row.sinceFire.disabled': 'その後ルール無効',
  'panel.inspector.headers.row.sinceFire.disabledTitle':
    'このリクエストの後にルールが無効になりました。今後のリクエストには適用されません',
  'panel.inspector.headers.row.sinceFire.edited': 'その後ルール編集',
  'panel.inspector.headers.row.sinceFire.editedTitle':
    'このリクエストの後にルールが編集されました。現在のルールは今後のリクエストにのみ適用されます',
  'panel.inspector.headers.row.sinceFire.value': 'その後変数が変更',
  'panel.inspector.headers.row.sinceFire.valueTitle':
    'このルールが参照する変数は今は別の値に解決されます。今後のリクエストにのみ適用されます',

  // Value chips. Flag/attribute chip TEXTS (HttpOnly, SameSite=Lax,
  // JWT, alg, `exp {duration}`, cache-directive summaries, boundary)
  // are wire vocabulary and stay raw; only the UI-worded chips key.
  'panel.inspector.headers.chips.expires': '{duration} 後に期限切れ',
  'panel.inspector.headers.chips.session': 'セッション',
  'panel.inspector.headers.chips.missingFlag': '{flag} なし',
  'panel.inspector.headers.chips.expired': '期限切れ',

  // Chip (i) corpora. Titles that are wire vocabulary (HttpOnly,
  // SameSite=X, Cache-Control: …, Strict-Transport-Security, JWT,
  // scheme names) stay raw. Cache/HSTS directive descriptions reuse
  // the shared header corpus where the referent matches; the
  // parameterized ones (durations in the hole) live here.
  'panel.inspector.headers.chipInfo.setCookieFlagKicker': 'Set-Cookie フラグ',
  'panel.inspector.headers.chipInfo.httpOnly.summary':
    'Cookie は JavaScript から隠されます（`document.cookie` では読み取れません）。',
  'panel.inspector.headers.chipInfo.httpOnly.description':
    'XSS を緩和します。注入されたスクリプトは Cookie を持ち出せなくなります。CSRF には効きません。',
  'panel.inspector.headers.chipInfo.secure.summary':
    'Cookie は HTTPS 経由でのみ送信されます。平文 HTTP で漏れることはありません。',
  'panel.inspector.headers.chipInfo.partitioned.summary':
    'CHIPS。Cookie はトップレベルサイトごとにパーティション化されます。',
  'panel.inspector.headers.chipInfo.partitioned.description':
    'トップレベルサイトごとに Cookie の独自のコピーを持つため、埋め込みコンテキストは Cookie でサイトをまたいだユーザー追跡ができません。',
  'panel.inspector.headers.chipInfo.sameSiteStrict':
    'Cookie は同一サイトのリクエストでのみ送信されます。最も強い CSRF 対策で、他サイトからのリンクでも Cookie なしで到着します。',
  'panel.inspector.headers.chipInfo.sameSiteLax':
    'Cookie は同一サイトのリクエストと、トップレベルのクロスサイトナビゲーション（リンクのクリック）で送信されます。最近のブラウザーのデフォルトです。',
  'panel.inspector.headers.chipInfo.sameSiteNone':
    'Cookie はすべてのクロスサイトリクエストで送信されます。`Secure` が必要です。意図的に使ってください。受信側はサイトをまたいで Cookie を関連付けられます。',
  'panel.inspector.headers.chipInfo.cookieExpiry.title': 'Cookie の有効期限',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiredSummary':
    'Cookie はすでに期限切れです。ブラウザーは送信しません。',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiresSummary':
    'Cookie は {duration} 後（{date}）に期限切れになります。',
  'panel.inspector.headers.chipInfo.cookieExpiry.description':
    '`Max-Age` も `Expires` もない Cookie はセッション Cookie で、ブラウザーの終了時に消えます。どちらかを設定すると永続化します。',
  'panel.inspector.headers.chipInfo.sessionCookie.title': 'セッション Cookie',
  'panel.inspector.headers.chipInfo.sessionCookie.summary':
    '`Max-Age` も `Expires` もありません。ブラウザーは終了時にこの Cookie を破棄します。',
  'panel.inspector.headers.chipInfo.sessionCookie.description':
    '`Max-Age=<seconds>` または `Expires=<date>` を追加すると、ブラウザーのセッションをまたいで永続化します。',
  'panel.inspector.headers.chipInfo.missingFlag.title': '{flag} がありません',
  'panel.inspector.headers.chipInfo.missingFlag.kicker': 'ベストプラクティス',
  'panel.inspector.headers.chipInfo.missingFlag.secure':
    '`Secure` がないと、この Cookie は平文 HTTP で漏れる可能性があります。HTTPS の Cookie には常に設定してください。',
  'panel.inspector.headers.chipInfo.missingFlag.httpOnly':
    '`HttpOnly` がないと、JavaScript は `document.cookie` でこの Cookie を読めます。XSS のバグ 1 つで持ち出されます。',
  'panel.inspector.headers.chipInfo.missingFlag.sameSite':
    '明示的な `SameSite` がないと、ブラウザーは `Lax` にフォールバックします。コードレビューでポリシーが明らかになるよう、明示してください。',
  'panel.inspector.headers.chipInfo.missingFlag.description':
    '本番環境のほとんどの Cookie は `Secure`、`HttpOnly`、明示的な `SameSite` を持つべきです。',
  'panel.inspector.headers.chipInfo.cacheKicker': 'キャッシュディレクティブ',
  'panel.inspector.headers.chipInfo.rawValue': 'Raw 値：`{value}`。',
  'panel.inspector.headers.chipInfo.activeDirectives': '有効なディレクティブ',
  'panel.inspector.headers.chipInfo.maxAge': '{duration} の間は新鮮です。',
  'panel.inspector.headers.chipInfo.sMaxage': '共有キャッシュでの新鮮さ：{duration}。',
  'panel.inspector.headers.chipInfo.staleWhileRevalidate':
    'バックグラウンドで再検証が走る間、{duration} は古い内容の再利用を許可します。',
  'panel.inspector.headers.chipInfo.contentTypeParamKicker': 'Content-Type パラメーター',
  'panel.inspector.headers.chipInfo.charset.summary': 'ボディが使う文字エンコーディング。',
  'panel.inspector.headers.chipInfo.charset.description':
    '`text/*` 型では、最近のスタックはデフォルトで `utf-8` です。誤った値は文字化けを引き起こします。',
  'panel.inspector.headers.chipInfo.boundary.title': 'multipart 境界',
  'panel.inspector.headers.chipInfo.boundary.summary':
    'multipart ボディの各パートを区切る token（ファイルアップロード、multipart/form-data）。',
  'panel.inspector.headers.chipInfo.boundary.description':
    'クライアントが生成します。どのパートのボディ内にも現れてはいけません。',
  'panel.inspector.headers.chipInfo.hsts.kicker': 'セキュリティポリシー',
  'panel.inspector.headers.chipInfo.hsts.summary': 'ブラウザーはこのホストに対して {duration} の間 HTTPS を使います。',
  'panel.inspector.headers.chipInfo.authSchemeKicker': '認可スキーム',
  'panel.inspector.headers.chipInfo.jwt.summary':
    'JSON Web Token。base64 エンコードされた `<header>.<payload>.<signature>` の 3 つ組です。',
  'panel.inspector.headers.chipInfo.jwt.description':
    '署名は、署名鍵を持つ者が token を発行したことを証明します。ヘッダー部（alg、typ）とペイロード（クレーム）は暗号化されて「いません」。単に base64 エンコードされているだけで、誰でも読めます。',
  'panel.inspector.headers.chipInfo.jwtHeaderKicker': 'JWT ヘッダー部',
  'panel.inspector.headers.chipInfo.jwtClaimKicker': 'JWT クレーム',
  'panel.inspector.headers.chipInfo.jwtAlg.summary': 'JWT ヘッダー部で宣言された署名アルゴリズム。',
  'panel.inspector.headers.chipInfo.jwtAlg.description':
    'よくある値：`HS256`（HMAC-SHA256、対称）、`RS256`（RSA、非対称）、`ES256`（ECDSA）。`none`（署名なし）は検証側が常に拒否すべきです。',
  'panel.inspector.headers.chipInfo.jwtExpired.title': 'JWT は期限切れ',
  'panel.inspector.headers.chipInfo.jwtExpired.summary':
    'token は {duration} 前に期限切れになりました。サーバーは拒否するはずです。',
  'panel.inspector.headers.chipInfo.jwtExpires.title': 'JWT は {duration} 後に期限切れ',
  'panel.inspector.headers.chipInfo.jwtExpires.soonSummary':
    'token は期限切れ間近です。更新するか、まもなく 401 が返ると考えてください。',
  'panel.inspector.headers.chipInfo.jwtExpires.summary': 'JWT の `exp` クレームに達するまでの時間。',
  'panel.inspector.headers.chipInfo.scheme.bearer':
    '不透明なベアラー資格情報（OAuth 2.0 / API token）。パスワードと同様に扱ってください。持っている人は誰でもそのユーザーとして認証できます。',
  'panel.inspector.headers.chipInfo.scheme.basic':
    'HTTP Basic 認証。`base64(username:password)` です。HTTPS 上でのみ安全です。',
  'panel.inspector.headers.chipInfo.scheme.other': '認証スキーム名。資格情報の形式はスキームによって異なります。',

  // Header insights (t-fed `computeHeaderInsights`). Origins, cookie
  // names, HSTS summaries, and durations ride as raw holes.
  'panel.inspector.headers.insights.corsWildcard.title': 'CORS の設定ミス',
  'panel.inspector.headers.insights.corsWildcard.detail':
    '`Access-Control-Allow-Origin: *` は資格情報と組み合わせられません。ブラウザーはこのレスポンスを拒否します。',
  'panel.inspector.headers.insights.corsWildcard.action': '{origin} で上書き',
  'panel.inspector.headers.insights.corsMissingAcao.title': 'Access-Control-Allow-Origin のない CORS リクエスト',
  'panel.inspector.headers.insights.corsMissingAcao.detail':
    'リクエストは `Origin: {origin}` を運びましたが、レスポンスに `Access-Control-Allow-Origin` がありません。ブラウザーはレスポンスをブロックします。',
  'panel.inspector.headers.insights.corsMissingAcao.action': 'Access-Control-Allow-Origin: {origin} を追加',
  'panel.inspector.headers.insights.cookieMissingSecure.titleOne': 'Cookie `{name}` に `Secure` がありません',
  'panel.inspector.headers.insights.cookieMissingSecure.titleMany': '{count} 件の Cookie に `Secure` がありません',
  'panel.inspector.headers.insights.cookieMissingSecure.detail':
    'HTTPS で設定される Cookie は、平文 HTTP で送られないよう `Secure` を持つべきです。',
  'panel.inspector.headers.insights.missingCsp.title': 'HTML レスポンスに Content-Security-Policy がありません',
  'panel.inspector.headers.insights.missingCsp.action': 'ベースラインの CSP を追加',
  'panel.inspector.headers.insights.hstsShort.title': 'HSTS の max-age が非常に短い（{summary}）',
  'panel.inspector.headers.insights.hstsShort.detail':
    'ほとんどのポリシーは最低 6 か月を推奨します。preload には 1 年が必要です。',
  'panel.inspector.headers.insights.jwtExpired.title': 'Authorization ヘッダーの JWT は期限切れです',
  'panel.inspector.headers.insights.jwtExpired.detail': '{duration} 前に期限切れになりました。',
  'panel.inspector.headers.insights.jwtExpiring.title': 'JWT は {duration} 後に期限切れ',
  'panel.inspector.headers.insights.missingContentType.title': 'レスポンスに Content-Type がありません',
  'panel.inspector.headers.insights.missingContentType.action': 'Content-Type を追加',
} as const satisfies Catalog;
