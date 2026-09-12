/**
 * Shared info-popover corpus — HTTP headers — Japanese. Mirrors
 * `catalogs/en/shared-info-headers.ts` key for key; wire vocabulary
 * (header names, directive keys, common values, backticked code) stays
 * raw — only prose translates. Mints: オリジン = origin (the
 * web-platform referent) vs オリジンサーバー = origin server;
 * プリフライト = preflight; ディレクティブ = directive (section label);
 * 一般的な値 = common values; 再検証 = revalidate; スニッフィング =
 * sniffing; ホットリンク = hotlink; クローラー = crawler; エッジ = edge
 * (CDN tier) with shield riding raw; 分散トレース = distributed trace
 * (distinct from 追跡 = tracking); 疑似ヘッダー = pseudo-header;
 * ホップバイホップ = hop-by-hop; レジストリ carried from info-status;
 * Cookie ジャー carried from the shared register.
 */

import type { Catalog } from '../../types';

export const sharedInfoHeaders = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.header.kicker': '{direction} · {category}',
  'shared.info.header.direction.request': 'リクエストヘッダー',
  'shared.info.header.direction.response': 'レスポンスヘッダー',
  'shared.info.header.direction.both': 'リクエスト / レスポンスヘッダー',
  'shared.info.header.section.directives': 'ディレクティブ',
  'shared.info.header.section.commonValues': '一般的な値',
  'shared.info.header.fallback.customCategory': 'カスタムまたは非標準',
  'shared.info.header.fallback.customSummary':
    'このヘッダーはカスタムまたは非標準です。レジストリにドキュメントはありません。',
  'shared.info.header.fallback.unknownSummary':
    '{name} はまだレジストリに記載されていません。この行は {category} に分類されています。',

  // ── auth ──────────────────────────────────────────────────────────────
  'shared.info.header.authorization.summary': 'クライアントがサーバーに対して認証するための資格情報です。',
  'shared.info.header.authorization.body1':
    '形式：`<scheme> <credentials>`。一般的なスキーム：`Bearer <token>`（OAuth、JWT）、`Basic <base64(user:pass)>`、`Digest`。',
  'shared.info.header.proxyAuthorization.summary': '中間のプロキシ（オリジンサーバーではなく）に対する資格情報です。',
  'shared.info.header.proxyAuthorization.body1': '構文は `Authorization` と同じですが、適用範囲が異なります。',
  'shared.info.header.wwwAuthenticate.summary':
    'サーバーの 401 チャレンジです。クライアントにどの認証スキームを使うべきかを伝えます。',
  'shared.info.header.wwwAuthenticate.body1':
    '`401 Unauthorized` とともに送信されます。スキームが `Basic` の場合、ブラウザーの基本認証ダイアログを起動します。',
  'shared.info.header.proxyAuthenticate.summary':
    '`WWW-Authenticate` のプロキシ版で、`407 Proxy Authentication Required` とともに送信されます。',
  'shared.info.header.authenticationInfo.summary':
    '成功時に相互認証を完了します。Digest 認証はこれを使ってサーバー側も確認します。',

  // ── caching ───────────────────────────────────────────────────────────
  'shared.info.header.cacheControl.summary': 'レスポンスのキャッシュと再検証の方法を規定するディレクティブです。',
  'shared.info.header.cacheControl.body1':
    'リクエストとレスポンスの両方がディレクティブを持ちます。カンマ区切りの複数の token は AND で結合されます。動作はディレクティブごとに決まり、このヘッダーは単一のモードではありません。',
  'shared.info.header.cacheControl.directive.noStore': 'どこにも一切キャッシュしません。',
  'shared.info.header.cacheControl.directive.noCache': 'キャッシュは可能ですが、再利用の前に毎回再検証します。',
  'shared.info.header.cacheControl.directive.public': '共有キャッシュ / CDN を含め、どのキャッシュも保存できます。',
  'shared.info.header.cacheControl.directive.private': 'ユーザーのブラウザーだけが保存できます。',
  'shared.info.header.cacheControl.directive.maxAgeN': 'N 秒間は新鮮とみなし、オリジンに問い合わせずに再利用します。',
  'shared.info.header.cacheControl.directive.sMaxageN': 'max-age と同様ですが、共有キャッシュにのみ適用されます。',
  'shared.info.header.cacheControl.directive.mustRevalidate': '古くなったら、提供する前に再検証します。',
  'shared.info.header.cacheControl.directive.immutable': 'max-age の期間中はボディが変わらないことを約束します。',
  'shared.info.header.cacheControl.directive.staleWhileRevalidateN':
    'バックグラウンドで再検証している間、古い内容の再利用を許可します。',
  'shared.info.header.pragma.summary':
    '旧式の HTTP/1.0 キャッシュ制御です。事実上 Cache-Control に置き換えられています。',
  'shared.info.header.pragma.body1':
    '一部のクライアントは互換性のために今も `Pragma: no-cache` を設定します。現代のサーバーは `Cache-Control` を尊重し、`Pragma` を無視すべきです。',
  'shared.info.header.expires.summary': 'レスポンスが古くなったとみなされる絶対的な日時です。',
  'shared.info.header.expires.body1':
    '`Cache-Control: max-age` に置き換えられました。両方が設定されている場合は `max-age` が優先されます。過去の日付（または `0`）を使うと再取得を強制できます。',
  'shared.info.header.etag.summary': 'レスポンスボディの不透明な識別子です。キャッシュ済みコピーの再検証に使われます。',
  'shared.info.header.etag.body1':
    'クライアントは `If-None-Match` でこれを送り返します。値がまだ一致していれば、サーバーはボディなしの `304 Not Modified` を返します。',
  'shared.info.header.ifMatch.summary': '条件付きリクエスト：リソースの現在の ETag が一致する場合にのみ処理します。',
  'shared.info.header.ifMatch.body1': '書き込みで使い、他の誰かが行った変更の上書きを防ぎます（楽観的並行性制御）。',
  'shared.info.header.ifNoneMatch.summary': '条件付きリクエスト：リソースの ETag が変わった場合にのみ処理します。',
  'shared.info.header.ifNoneMatch.body1':
    '読み取りで使い、変更のないレスポンスのダウンロードを省きます。サーバーは `304 Not Modified` を返します。',
  'shared.info.header.ifModifiedSince.summary':
    '条件付きリクエスト：指定日時より後にリソースが変更された場合にのみ処理します。',
  'shared.info.header.ifModifiedSince.body1':
    '`If-None-Match`/ETag より精度が低いため、利用できる場合は ETag を優先してください。',
  'shared.info.header.ifUnmodifiedSince.summary':
    '条件付きリクエスト：指定日時以降にリソースが変更されていない場合にのみ処理します。',
  'shared.info.header.lastModified.summary': 'リソースが最後に変更された日時です。',
  'shared.info.header.lastModified.body1': '再検証のために `If-Modified-Since` と組み合わせます。',
  'shared.info.header.age.summary': 'レスポンスが共有キャッシュに置かれていた秒数です。',
  'shared.info.header.age.body1': 'CDN やプロキシが返します。クライアントがレスポンスの鮮度を把握するのに役立ちます。',
  'shared.info.header.xCache.summary':
    'CDN / リバースプロキシのキャッシュ結果です。形式はベンダー固有です（Varnish、Fastly、CloudFront）。',
  'shared.info.header.xCache.value.hit': 'キャッシュから提供されました。',
  'shared.info.header.xCache.value.miss': 'キャッシュされておらず、オリジンから取得しました。',
  'shared.info.header.xCache.value.hitHit': '複数のキャッシュ階層すべてでヒットしました（例：shield + エッジ）。',
  'shared.info.header.xCacheHits.summary':
    '階層ごとのキャッシュヒット数です。ベンダー固有で、Fastly でよく見られます。',
  'shared.info.header.xCacheHits.body1':
    '複数のキャッシュ階層が関与する場合はカンマ区切りです。数値が大きいほどホットなキャッシュラインを示します。',
  'shared.info.header.warning.summary':
    '追加のキャッシュ情報（古い、変換が適用された、など）です。RFC 7234 以降 HTTP/1.1 では非推奨ですが、今も送出されます。',
  'shared.info.header.surrogateControl.summary':
    'Edge Side Includes のキャッシュ制御です。ブラウザーのキャッシュは `Cache-Control` に任せ、CDN に指示します。',
  'shared.info.header.surrogateControl.body1': 'ESI 対応キャッシュ（Fastly、Akamai、一部構成の Varnish）に固有です。',
  'shared.info.header.surrogateCapability.summary': 'Edge からオリジンへのヒント：サロゲートが対応する ESI 機能です。',
  'shared.info.header.cfCacheStatus.summary': 'このリクエストに対する Cloudflare のキャッシュ結果です。',
  'shared.info.header.cfCacheStatus.value.hit': 'Cloudflare のキャッシュから提供されました。',
  'shared.info.header.cfCacheStatus.value.miss': 'キャッシュになく、オリジンから取得しました。',
  'shared.info.header.cfCacheStatus.value.expired':
    'キャッシュされていましたが期限切れのため、オリジンから更新しました。',
  'shared.info.header.cfCacheStatus.value.bypass': 'キャッシュをバイパスしました（ページルール / no-cache ヘッダー）。',
  'shared.info.header.cfCacheStatus.value.dynamic': 'デフォルトではキャッシュ不可です（Cookie、クエリ文字列など）。',
  'shared.info.header.cfCacheStatus.value.revalidated': 'キャッシュ済みで、オリジンと再検証しました（304）。',

  // ── client-hints ──────────────────────────────────────────────────────
  'shared.info.header.secChUa.summary': 'Client Hint：ブラウザーのブランド一覧です。',
  'shared.info.header.secChUa.body1':
    'サーバーが本当に依存すべき部分について、自由形式の `User-Agent` を置き換えます。',
  'shared.info.header.secChUaMobile.summary': 'Client Hint：モバイルでは `?1`、デスクトップでは `?0` です。',
  'shared.info.header.secChUaPlatform.summary':
    'Client Hint：ユーザーの OS です（`"Windows"`、`"macOS"`、`"Linux"` など）。',
  'shared.info.header.userAgent.summary': 'ブラウザー、OS、エンジンを識別する旧式の自由形式文字列です。',
  'shared.info.header.userAgent.body1':
    '今もすべてのリクエストで送信されます。構造化された後継は `Sec-CH-UA-*` ファミリーです。サーバーがブラウザーの識別を必要とする場合はそちらを優先してください。',
  'shared.info.header.acceptCh.summary': '以降のリクエストでサーバーが求める Client Hint ヘッダーを列挙します。',
  'shared.info.header.acceptCh.body1':
    'ブラウザーは、ここでサーバーがオプトインしたヒントだけを送信します（低エントロピーのデフォルトを除く）。',
  'shared.info.header.criticalCh.summary':
    'サーバーが重要とみなす `Accept-CH` のサブセットです。ブラウザーはこれらを含めるためにリクエストをやり直します。',
  'shared.info.header.criticalCh.body1':
    '控えめに使ってください。Critical-CH のミスは毎回ラウンドトリップを消費します。',
  'shared.info.header.saveData.summary':
    'ユーザーがブラウザー / OS でデータセーバーモードを有効にしている場合は `on` です。',
  'shared.info.header.saveData.body1':
    '低帯域向けのアセット提供に使います（画像品質を下げる、ファーストビュー外の処理を後回しにする、など）。',
  'shared.info.header.deviceMemory.summary':
    'おおよそのデバイス RAM（GiB）で、少数の値（`0.25`、`0.5`、`1`、`2`、`4`、`8`）に丸められます。',
  'shared.info.header.downlink.summary': '推定下り帯域幅（Mbps、丸め済み）です。',
  'shared.info.header.ect.summary':
    '実効接続種別（Effective Connection Type）：`slow-2g`、`2g`、`3g`、`4g` のいずれかです。',
  'shared.info.header.rtt.summary': '推定ラウンドトリップ時間（ミリ秒、丸め済み）です。',

  // ── connection ────────────────────────────────────────────────────────
  'shared.info.header.connection.summary': 'ホップバイホップの接続制御です（`keep-alive`、`close`、`upgrade`）。',
  'shared.info.header.connection.body1':
    'ホップ間のプロキシで取り除かれます。HTTP/2 以降ではこのヘッダーは禁止されており、接続管理はプロトコルに組み込まれています。',
  'shared.info.header.keepAlive.summary': '接続プールのヒントです。通常は `timeout=N, max=N` です。',
  'shared.info.header.keepAlive.body1':
    'HTTP/1.1 で `Connection: keep-alive` とともに使う場合にのみ意味を持ちます。HTTP/2 以降では無視されます。',
  'shared.info.header.upgrade.summary': '同じ接続上でプロトコルの切り替えを求めます（WebSocket、HTTP/2 平文）。',
  'shared.info.header.upgrade.body1':
    '`Connection: upgrade` と組み合わせて使います。WebSocket の場合：`Upgrade: websocket`。',
  'shared.info.header.te.summary': 'クライアントが受け入れる転送エンコーディングです（`trailers`、`gzip`、…）。',
  'shared.info.header.te.body1':
    '現代のクライアントの多くは、トレーラーヘッダーにオプトインするために `TE: trailers` だけを送信します。',
  'shared.info.header.expect.summary': 'クライアントが成立を期待するサーバー側の前提条件です（`100-continue`）。',
  'shared.info.header.expect.body1':
    '`Expect: 100-continue` を使うと、クライアントはサーバーが `100 Continue` を返した後にのみボディを送信できます。',
  'shared.info.header.altSvc.summary': '同じオリジンへ到達する別の手段を告知します（例：QUIC 上の HTTP/3）。',
  'shared.info.header.altSvc.body1':
    'ブラウザーはこの告知をキャッシュし、以降のリクエストで代替手段に切り替えることがあります。',
  'shared.info.header.secWebsocketKey.summary':
    'WebSocket ハンドシェイクで送信される、base64 エンコードされたランダムなノンスです。',
  'shared.info.header.secWebsocketKey.body1':
    'サーバーはこのキーと固定 GUID から導出した `Sec-WebSocket-Accept` で応答し、WebSocket を理解していることを証明します。',
  'shared.info.header.secWebsocketAccept.summary':
    'WebSocket ハンドシェイクにおけるサーバー側の証明です。`SHA-1(Sec-WebSocket-Key + GUID)` を base64 エンコードしたものです。',
  'shared.info.header.secWebsocketVersion.summary':
    'クライアントが要求する WebSocket プロトコルのバージョンです。ほぼ常に `13` です（RFC 6455）。',
  'shared.info.header.secWebsocketProtocol.summary':
    'WebSocket のサブプロトコル交渉です。リクエストではカンマ区切りの一覧、レスポンスでは選ばれた単一の値です。',
  'shared.info.header.secWebsocketExtensions.summary':
    '交渉された WebSocket 拡張（圧縮など）です。最も一般的なのは `permessage-deflate` です。',

  // ── content ───────────────────────────────────────────────────────────
  'shared.info.header.contentType.summary': 'リクエストまたはレスポンスボディのメディアタイプです。',
  'shared.info.header.contentType.body1':
    'ブラウザーがボディをどう解析するかを決めます。誤った値はサイレントな失敗を招きます（JSON が HTML として解析される、など）。',
  'shared.info.header.contentType.body2':
    '`text/*` タイプには、特別な理由がない限り `charset=utf-8` を含めてください。',
  'shared.info.header.contentType.value.applicationJson': 'JSON ボディです。',
  'shared.info.header.contentType.value.applicationXWwwFormUrlencoded': 'URL エンコードされたフォームフィールドです。',
  'shared.info.header.contentType.value.multipartFormData': 'マルチパートフォーム / ファイルアップロードです。',
  'shared.info.header.contentType.value.textHtmlCharsetUtf8': 'HTML ドキュメントです。',
  'shared.info.header.contentType.value.applicationOctetStream': '不透明なバイナリです。',
  'shared.info.header.contentLength.summary': 'ボディのサイズ（バイト、デコード後）です。',
  'shared.info.header.contentLength.body1':
    '`Transfer-Encoding: chunked` とは同時に使えません。誤った値は接続の同期ずれを招きます。',
  'shared.info.header.contentEncoding.summary':
    'ボディに適用された圧縮です。ブラウザーは JS に公開する前にデコードします。',
  'shared.info.header.contentEncoding.body1':
    '一般的なもの：`gzip`、`br`（Brotli）、`zstd`（新しめ）。`response.body` が見るのはデコード後のサイズです。',
  'shared.info.header.contentDisposition.summary':
    'レスポンスをインライン表示するかダウンロードするかをブラウザーに伝えます。',
  'shared.info.header.contentDisposition.body1':
    '`inline`（デフォルト）はブラウザー内で描画します。`attachment; filename="x"` は指定のデフォルトファイル名でダウンロードを起動します。',
  'shared.info.header.accept.summary': 'クライアントが受け取ってもよいメディアタイプです。',
  'shared.info.header.accept.body1':
    'q 値で優先度を表します（`text/html;q=0.9`）。今日ではほとんどのサーバーが最初のタイプ以外を無視します。',
  'shared.info.header.acceptEncoding.summary': 'クライアントがデコードできる圧縮方式です。',
  'shared.info.header.acceptEncoding.body1':
    '典型的なブラウザーの値：`gzip, deflate, br, zstd`。サーバーはひとつを選び、`Content-Encoding` で応答します。',
  'shared.info.header.acceptLanguage.summary': 'クライアントが希望する自然言語です。',
  'shared.info.header.acceptLanguage.body1':
    'サーバーはこの一覧から `Content-Language` を選びます。多くの場合、デフォルトにフォールバックします。',
  'shared.info.header.transferEncoding.summary':
    '転送のためだけに適用されるエンコーディングです。ボディがアプリケーションに届く前に取り除かれます。',
  'shared.info.header.transferEncoding.body1': 'ほぼ常に `chunked` です。`Content-Length` とは同時に使えません。',
  'shared.info.header.range.summary': 'ボディ全体ではなく、リソースのバイト範囲を要求します。',
  'shared.info.header.range.body1':
    '形式：`bytes=<start>-<end>`（両端を含む）。サーバーは `206 Partial Content` と `Content-Range` で応答します。',
  'shared.info.header.contentRange.summary': 'ボディに含まれるリソースのバイト範囲を示します。',
  'shared.info.header.contentRange.body1':
    '形式：`bytes <start>-<end>/<total>`。`206 Partial Content` とともに返されます。',
  'shared.info.header.acceptRanges.summary':
    '範囲リクエストに対応しているか（`bytes`）、していないか（`none`）をクライアントに伝えます。',
  'shared.info.header.contentMd5.summary':
    '整合性検査のための、ボディの Base64 エンコードされた MD5 ダイジェストです。HTTP/1.1 RFC 7231 では廃止されましたが、一部のサーバーは今も送出します。',
  'shared.info.header.contentMd5.body1':
    '現代の整合性検査は `Digest` / `Want-Digest`、または TLS そのもので行われます。',
  'shared.info.header.contentLanguage.summary': 'レスポンスボディの自然言語です。',
  'shared.info.header.contentLanguage.body1':
    'リクエストの `Accept-Language` と照らして交渉されます。値は BCP-47 タグです（`en-US`、`de-DE` など）。',
  'shared.info.header.contentLocation.summary': 'このレスポンスのエンティティを一意に識別する代替 URL です。',
  'shared.info.header.contentLocation.body1':
    '`Location` とは異なります。`Content-Location` は受け取ったリソースを表し、リダイレクト先ではありません。',
  'shared.info.header.acceptCharset.summary':
    'クライアントが受け入れる文字エンコーディングです。非推奨です。現代のブラウザーは常に UTF-8 を送り、このヘッダーを送出しません。',
  'shared.info.header.acceptCharset.body1': 'ほとんどのサーバーは安全に無視できます。',
  'shared.info.header.ifRange.summary':
    '条件付き範囲リクエスト：リソースが指定の ETag または日付とまだ一致する場合にのみ範囲を提供します。',
  'shared.info.header.ifRange.body1':
    'リソースが変更されていた場合、サーバーは `206 Partial Content` ではなく `200 OK` でボディ全体を返します。',
  'shared.info.header.trailer.summary':
    'チャンク化されたボディの後のトレーラーに現れるヘッダーフィールド名を宣言します。',
  'shared.info.header.trailer.body1':
    '`Transfer-Encoding: chunked` とともに使う場合にのみ意味を持ちます。クライアントは `TE: trailers` でオプトインする必要があります。',

  // ── cookies ───────────────────────────────────────────────────────────
  'shared.info.header.cookie.summary': 'このリクエストでブラウザーが送信している Cookie です。セミコロン区切りです。',
  'shared.info.header.cookie.body1':
    "ブラウザーが Cookie ジャーから設定します。`fetch` では JS から直接設定できません。`credentials: 'include'` を使ってください。",
  'shared.info.header.setCookie.summary': 'サーバーが発行する Cookie の定義です。',
  'shared.info.header.setCookie.body1':
    '`Set-Cookie` ヘッダー 1 行につき Cookie 1 件です。ブラウザーは（名前、ドメイン、パス）の組ごとに最新の値を保存します。',
  'shared.info.header.setCookie.body2':
    '本番の Cookie には常に `Secure`、`HttpOnly`、および明示的な `SameSite`（Lax または Strict）を付けてください。',
  'shared.info.header.setCookie.directive.secure': 'HTTPS でのみ送信します。',
  'shared.info.header.setCookie.directive.httpOnly': 'JavaScript（document.cookie）から隠します。',
  'shared.info.header.setCookie.directive.sameSiteStrictLaxNone':
    'クロスサイト送信ポリシーです。`None` には `Secure` が必要です。',
  'shared.info.header.setCookie.directive.domainHost': 'このホストとそのすべてのサブドメインに送信します。',
  'shared.info.header.setCookie.directive.pathPath': 'このパスで始まる URL にのみ送信します。',
  'shared.info.header.setCookie.directive.maxAgeN': '秒単位の TTL です（Expires より優先）。',
  'shared.info.header.setCookie.directive.expiresDate':
    '絶対的な有効期限です。省略するとセッション Cookie になります。',
  'shared.info.header.setCookie.directive.partitioned': 'CHIPS：トップレベルサイトごとにパーティション化します。',

  // ── cors ──────────────────────────────────────────────────────────────
  'shared.info.header.accessControlAllowOrigin.summary':
    'このレスポンスの読み取りを許可するオリジンをブラウザーに伝えます。',
  'shared.info.header.accessControlAllowOrigin.body1':
    'サーバーがレスポンスに設定します。ブラウザーはこれをリクエストの `Origin` ヘッダーと比較し、一致しなければ JavaScript によるボディの読み取りをブロックします。',
  'shared.info.header.accessControlAllowOrigin.body2':
    '`*` はあらゆるオリジンを受け入れますが、資格情報とは両立しません。リクエストが Cookie や認証情報を伴う場合、レスポンスは代わりに要求元のオリジンをそのまま返す必要があります。',
  'shared.info.header.accessControlAllowOrigin.value.wildcard': 'どのオリジンでも読み取れます（資格情報なし）。',
  'shared.info.header.accessControlAllowOrigin.value.httpsAppOpenheadersIo': '指定されたオリジンだけが読み取れます。',
  'shared.info.header.accessControlAllowCredentials.summary':
    'リクエストが資格情報を伴っていた場合に、ブラウザーがレスポンスを公開することを許可します。',
  'shared.info.header.accessControlAllowCredentials.body1':
    '`true`（小文字）でなければなりません。設定時は `Access-Control-Allow-Origin` を `*` にしてはならず、正確なオリジンを返す必要があります。',
  'shared.info.header.accessControlAllowMethods.summary':
    'クロスオリジンリクエストに対してサーバーが受け入れる HTTP メソッドを列挙します。',
  'shared.info.header.accessControlAllowMethods.body1':
    'プリフライト（`OPTIONS`）レスポンスで返されます。ブラウザーはこの回答を `Access-Control-Max-Age` 秒間キャッシュします。',
  'shared.info.header.accessControlAllowHeaders.summary':
    'クロスオリジンリクエストでサーバーが受け入れるリクエストヘッダーを列挙します。',
  'shared.info.header.accessControlAllowHeaders.body1':
    'ブラウザーが単純でないヘッダー（`Accept`、`Accept-Language`、`Content-Language`、単純な `Content-Type` 値以外のもの）をプリフライトする場合に必須です。',
  'shared.info.header.accessControlExposeHeaders.summary': 'JavaScript が読み取れるレスポンスヘッダーを列挙します。',
  'shared.info.header.accessControlExposeHeaders.body1':
    'デフォルトで JS が見られるのは CORS セーフリストのレスポンスヘッダー（`Cache-Control`、`Content-Language`、`Content-Type`、`Expires`、`Last-Modified`、`Pragma`）だけです。それ以外のヘッダーは、`response.headers.get(...)` が返せるようここで名前を挙げる必要があります。',
  'shared.info.header.accessControlMaxAge.summary':
    'ブラウザーがプリフライトレスポンスをキャッシュしてよい時間（秒）です。',
  'shared.info.header.accessControlMaxAge.body1':
    '大きな値はプリフライトの往復を減らします。86400（1 日）がよく使われます。Chrome は 7200 秒、Firefox は 86400 秒を上限とします。',
  'shared.info.header.accessControlRequestMethod.summary':
    'プリフライトで送信され、実際のリクエストが使うメソッドを宣言します。',
  'shared.info.header.accessControlRequestMethod.body1':
    'サーバーは `Access-Control-Allow-Methods` で応答して確認します。',
  'shared.info.header.accessControlRequestHeaders.summary':
    'プリフライトで送信され、実際のリクエストが伴うヘッダーを宣言します。',
  'shared.info.header.accessControlRequestHeaders.body1':
    '受け入れられた場合、`Access-Control-Allow-Headers` で返されます。',
  'shared.info.header.origin.summary': 'クロスオリジンまたは POST リクエストを開始したオリジンを識別します。',
  'shared.info.header.origin.body1':
    'ブラウザーが自動的に送信します。JS からは設定できません。サーバーが CORS レスポンスを決めるときや、CSRF 対策に使われます。',
  'shared.info.header.vary.summary':
    'どのリクエストヘッダーがレスポンスに影響するかをキャッシュに伝え、キャッシュキーを変えさせます。',
  'shared.info.header.vary.body1':
    'CORS では重要です。`Access-Control-Allow-Origin` をリクエストのオリジンから算出する場合は必ず `Vary: Origin` を含めてください。さもないとキャッシュがあるオリジンのレスポンスを別のオリジンに提供してしまいます。',
  'shared.info.header.timingAllowOrigin.summary':
    '外部オリジンがこのリソースの詳細なタイミング指標（`PerformanceResourceTiming`）を読めるようにします。',
  'shared.info.header.timingAllowOrigin.body1':
    'このヘッダーがない場合、クロスオリジンリソースは粗いタイミングしか公開しません。',

  // ── fetch-metadata ────────────────────────────────────────────────────
  'shared.info.header.secFetchSite.summary': 'ブラウザー設定：リクエストの発信元とターゲットの関係です。',
  'shared.info.header.secFetchSite.body1':
    '値：`same-origin`、`same-site`、`cross-site`、`none`（直接ナビゲーション）。',
  'shared.info.header.secFetchMode.summary': 'ブラウザー設定：リクエストの fetch モードです。',
  'shared.info.header.secFetchMode.body1': '値：`cors`、`no-cors`、`same-origin`、`navigate`、`websocket`。',
  'shared.info.header.secFetchDest.summary':
    'ブラウザー設定：レスポンスの使われる場所です（document、script、image など）。',
  'shared.info.header.secFetchDest.body1':
    'サーバーが予期しない取得を検出できます。例：HTML レスポンスが `Sec-Fetch-Dest: script` として要求されている場合。',
  'shared.info.header.secFetchUser.summary':
    'ブラウザー設定：ナビゲーションが直接のユーザー操作によるものなら `?1` です。',
  'shared.info.header.secFetchUser.body1':
    'それ以外では付きません。ユーザーのクリックとプログラムによるナビゲーションを区別するのに役立ちます。',
  'shared.info.header.secPurpose.summary':
    'リクエストが投機的な場合にブラウザーが設定します。例：`prefetch`、`prerender`。',
  'shared.info.header.secPurpose.body1':
    'ユーザーがまだ実際に要求していない取得について、サーバーが副作用（アナリティクス、書き込みログ）を省けるようにします。',

  // ── performance ───────────────────────────────────────────────────────
  'shared.info.header.priority.summary':
    'この転送がどれほど緊急か、どれほど逐次的かをサーバー（またはクライアント）に伝えます。',
  'shared.info.header.priority.body1':
    '形式：`u=<0-7>`（緊急度、小さいほど高優先）と、省略可能な `, i`（逐次的：到着しながら処理できる）。',
  'shared.info.header.upgradeInsecureRequests.summary':
    'ブラウザーが設定する `1` で、埋め込みリソースにはクライアントが HTTPS を望むことをサーバーに伝えます。',
  'shared.info.header.upgradeInsecureRequests.body1':
    'レスポンス側の CSP ディレクティブ `upgrade-insecure-requests` と対になります。',
  'shared.info.header.earlyData.summary': '`1`：TLS 1.3 の 0-RTT モードでデータを送信するクライアントが設定します。',
  'shared.info.header.earlyData.body1':
    'リプレイ攻撃を避けるため、サーバーは冪等でないメソッド（POST など）の early-data を拒否すべきです。',
  'shared.info.header.link.summary': 'リソースヒントです：preload / prefetch / preconnect / dns-prefetch。',
  'shared.info.header.link.body1':
    'HTML の `<link rel="...">` と同じ意味です。HTML でないレスポンス（API、リダイレクト）から使えて便利です。',
  'shared.info.header.link.value.styleCssRelPreloadAsStyle': 'スタイルシートをプリロードします。',
  'shared.info.header.link.value.httpsCdnExampleComRelPreconnect': '事前に接続を開きます。',
  'shared.info.header.xDnsPrefetchControl.summary':
    'ページ内リンクに対するブラウザーの DNS プリフェッチを切り替えます（`on` / `off`）。',

  // ── privacy ───────────────────────────────────────────────────────────
  'shared.info.header.dnt.summary':
    'Do Not Track：ユーザーが追跡をオプトアウトしている場合は `1` です。ほぼ非推奨です。',
  'shared.info.header.dnt.body1':
    '主要サイトの多くは無視しており、W3C は 2019 年に仕様を取り下げました。準拠は任意です。',
  'shared.info.header.secGpc.summary':
    'Global Privacy Control：`1` はユーザーが自分のデータの販売・共有を望まないことを示します。',
  'shared.info.header.secGpc.body1':
    'カリフォルニア州では CCPA のもとで法的拘束力があります。プライバシー重視のブラウザー（Brave、Firefox、DuckDuckGo）の一部が尊重します。',

  // ── proxy ─────────────────────────────────────────────────────────────
  'shared.info.header.via.summary': 'メッセージが通過したプロキシ / ゲートウェイを列挙します。',
  'shared.info.header.via.body1': '各プロキシが自身の識別子を追記するため、デバッグ時に経路を再構成できます。',
  'shared.info.header.xForwardedFor.summary':
    '非標準ながら広く使われる、プロキシを経由したクライアント IP のカンマ区切りの連鎖です。',
  'shared.info.header.xForwardedFor.body1':
    '最も左のエントリが元のクライアントです。RFC 7239 の `Forwarded` ヘッダーが標準化された代替です。',
  'shared.info.header.xForwardedProto.summary':
    'クライアントが最初のプロキシに到達するために使った元のスキーム（`http` または `https`）です。',
  'shared.info.header.xForwardedHost.summary': 'プロキシが書き換える前にクライアントが送った元の `Host` ヘッダーです。',
  'shared.info.header.xRealIp.summary': '最初のプロキシから見た元のクライアント IP です。連鎖ではなく単一の値です。',
  'shared.info.header.forwarded.summary':
    'RFC 7239 で標準化されたプロキシ連鎖です。`X-Forwarded-*` ファミリーを置き換えます。',
  'shared.info.header.forwarded.body1':
    '形式：`for=client; proto=https; by=proxy; host=original-host`。複数のプロキシはカンマで区切ります。',
  'shared.info.header.trueClientIp.summary':
    'Akamai / Cloudflare Enterprise が転送する元のクライアント IP です。連鎖ではなく単一の値です。',

  // ── routing ───────────────────────────────────────────────────────────
  'shared.info.header.authority.summary':
    'HTTP/2 以降の疑似ヘッダーで、HTTP/1.1 の `Host` に相当します。ターゲットのサーバーを識別します。',
  'shared.info.header.authority.body1':
    '疑似ヘッダーは `:` で始まり、通常のヘッダーより前に現れなければなりません。ブラウザーが設定し、JavaScript からは設定できません。',
  'shared.info.header.method.summary': 'HTTP/2 以降の疑似ヘッダー：リクエストメソッドです（`GET`、`POST`、…）。',
  'shared.info.header.path.summary': 'HTTP/2 以降の疑似ヘッダー：リクエストパスとクエリ文字列です。',
  'shared.info.header.scheme.summary': 'HTTP/2 以降の疑似ヘッダー：`https` または `http` です。',
  'shared.info.header.status.summary': 'HTTP/2 以降の疑似ヘッダー：数値のレスポンスステータスです（例：`200`）。',
  'shared.info.header.status.body1': 'HTTP/2 と HTTP/3 では、疑似ヘッダーが HTTP/1.1 のステータス行を置き換えます。',
  'shared.info.header.host.summary':
    'HTTP/1.1 のターゲットホスト（および省略可能なポート）です。HTTP/2 以降では `:authority` に置き換えられます。',
  'shared.info.header.host.body1':
    'すべての HTTP/1.1 リクエストで必須です。サーバーは同じ IP 上の仮想ホスト間のルーティングに使います。',
  'shared.info.header.location.summary':
    'リダイレクト先です。`3xx` レスポンスとともに、または作成されたリソースの結果として送信されます。',
  'shared.info.header.location.body1':
    '絶対 URL は例外なく尊重されます。相対 URL はリクエスト URL を基準に解決されます。',
  'shared.info.header.allow.summary': 'リソースが受け入れる HTTP メソッドを列挙します。',
  'shared.info.header.allow.body1':
    '`405 Method Not Allowed` レスポンスでは必須です。一般的な値：`GET, HEAD, POST, OPTIONS`。',
  'shared.info.header.referer.summary': 'このリクエストを開始したページの URL です。',
  'shared.info.header.referer.body1':
    '歴史的な綴り間違いに注意してください。仕様はそのまま維持しています。一部の宛先は、ページの `Referrer-Policy` に基づいて `Referer` を削除または縮小します。',
  'shared.info.header.retryAfter.summary':
    'いつ再試行すべきかをクライアントに伝えます。秒（差分）または絶対的な HTTP 日付です。',
  'shared.info.header.retryAfter.body1':
    '`503 Service Unavailable` と `429 Too Many Requests` でよく使われます。クローラーはこれを尊重します。',
  'shared.info.header.maxForwards.summary': '`TRACE` または `OPTIONS` リクエストを転送できるプロキシの数を制限します。',
  'shared.info.header.maxForwards.body1':
    '転送するプロキシごとに 1 ずつ減ります。0 に達すると、そのプロキシ自身が応答します。',
  'shared.info.header.serviceWorker.summary':
    'サービスワーカーのスクリプトファイルを取得するリクエストで、ブラウザーが `script` を設定します。',
  'shared.info.header.serviceWorker.body1':
    'サーバーが SW 登録の取得を検出し、適切な `Service-Worker-Allowed` ヘッダーで応答できるようにします。',
  'shared.info.header.serviceWorkerAllowed.summary':
    'サービスワーカーのスコープに対するデフォルトのパス制限を上書きします。',
  'shared.info.header.serviceWorkerAllowed.body1':
    'デフォルトでは、ワーカーは自身のディレクトリ以下しか制御できません。このヘッダーで範囲を広げられます。例：`/sw.js` のワーカーから `/` を制御する。',
  'shared.info.header.protocol.summary':
    '拡張 CONNECT 機構（RFC 8441）の疑似ヘッダーです。HTTP/2 / 3 上の WebSocket で使われます。',
  'shared.info.header.protocol.body1':
    'クライアントが HTTP/2 または HTTP/3 を通して WebSocket をトンネルする場合、`websocket` に設定されます。',

  // ── security ──────────────────────────────────────────────────────────
  'shared.info.header.contentSecurityPolicy.summary':
    'ページがリソースを読み込んだりコードを実行したりできるソースの許可リストです。',
  'shared.info.header.contentSecurityPolicy.body1':
    'ディレクティブ内はスペース区切り、ディレクティブ間はセミコロン区切りです。ほとんどのアプリには最低限 `default-src`、`script-src`、`style-src`、`connect-src` が必要です。',
  'shared.info.header.contentSecurityPolicy.body2':
    '強制する前に違反を観察するには `Content-Security-Policy-Report-Only` を使ってください。',
  'shared.info.header.contentSecurityPolicy.directive.defaultSrc':
    '明示的に設定されていないすべての -src のフォールバックです。',
  'shared.info.header.contentSecurityPolicy.directive.scriptSrc': '`<script>` とインライン JS に許可されるソースです。',
  'shared.info.header.contentSecurityPolicy.directive.styleSrc':
    'スタイルシートとインライン CSS に許可されるソースです。',
  'shared.info.header.contentSecurityPolicy.directive.imgSrc': '許可される画像ソースです。',
  'shared.info.header.contentSecurityPolicy.directive.connectSrc':
    '許可される fetch / XHR / WebSocket のターゲットです。',
  'shared.info.header.contentSecurityPolicy.directive.frameAncestors':
    'このページを iframe に埋め込める相手です（X-Frame-Options を置き換えます）。',
  'shared.info.header.contentSecurityPolicy.directive.reportUriReportTo': '違反レポートの POST 先です。',
  'shared.info.header.contentSecurityPolicyReportOnly.summary':
    'CSP と同じ構文ですが、違反はブロックされずに報告されます。',
  'shared.info.header.contentSecurityPolicyReportOnly.body1':
    '本番環境でポリシーを強制する前にテストするために使います。',
  'shared.info.header.strictTransportSecurity.summary':
    '指定期間、このホストに対してブラウザーに HTTPS の使用を強制します。',
  'shared.info.header.strictTransportSecurity.body1':
    '本番では `max-age` を少なくとも 6 か月に設定してください。ドメイン配下のすべてのホストを対象にするには `includeSubDomains` を追加します。',
  'shared.info.header.strictTransportSecurity.body2':
    '`preload` を付けると、ブラウザーに組み込まれる HSTS プリロードリストへドメインを申請できます（一方向の決定で、取り消しは困難です）。',
  'shared.info.header.strictTransportSecurity.directive.maxAgeN': 'ブラウザーが HTTPS 限定を記憶する期間です。',
  'shared.info.header.strictTransportSecurity.directive.includeSubDomains': 'すべてのサブドメインに適用します。',
  'shared.info.header.strictTransportSecurity.directive.preload': 'ブラウザーのプリロードリストへの適格性です。',
  'shared.info.header.xContentTypeOptions.summary': 'MIME スニッフィングを無効にします。',
  'shared.info.header.xContentTypeOptions.body1':
    '有効な値は `nosniff` のみです。すべてのレスポンスに推奨されます。`text/plain` の JS が実行されるのを防ぎます。',
  'shared.info.header.xFrameOptions.summary': 'ページを iframe に埋め込めるかどうかを制御します。',
  'shared.info.header.xFrameOptions.body1':
    'ほぼ `Content-Security-Policy: frame-ancestors` に置き換えられています。古いブラウザーにも対応するため、移行期間中は両方を保持してください。',
  'shared.info.header.xFrameOptions.value.deny': '埋め込みを一切許可しません。',
  'shared.info.header.xFrameOptions.value.sameorigin': '同一オリジンのページからのみ埋め込めます。',
  'shared.info.header.xXssProtection.summary':
    '旧式の XSS フィルターの切り替えです。現代のブラウザーでは廃止されています。',
  'shared.info.header.xXssProtection.body1':
    '推奨値はフィルターを無効にする `0` です（防ぐ以上に害をもたらしました）。代わりに CSP を使ってください。',
  'shared.info.header.referrerPolicy.summary':
    '外向きのナビゲーションとリクエストで `Referer` に URL のどこまでを送るかを制御します。',
  'shared.info.header.referrerPolicy.body1':
    '宛先がレスポンスヘッダーとして送るか、ページ単位では `<meta>`、リクエスト単位では `referrerpolicy` 属性で設定します。',
  'shared.info.header.referrerPolicy.value.noReferrer': 'リファラーを一切送信しません。',
  'shared.info.header.referrerPolicy.value.origin': 'スキームとホストだけを送信します。',
  'shared.info.header.referrerPolicy.value.strictOriginWhenCrossOrigin':
    'デフォルト：同一オリジンでは完全な URL、クロスオリジンではオリジンのみ、HTTPS→HTTP のダウングレードでは何も送りません。',
  'shared.info.header.referrerPolicy.value.unsafeUrl': '常に完全な URL を送信します。避けてください。',
  'shared.info.header.permissionsPolicy.summary': 'ブラウザー機能（位置情報、カメラ、USB、決済など）の許可リストです。',
  'shared.info.header.permissionsPolicy.body1':
    '各機能は `self`、オリジンの一覧、または `*` で制限されます。古い `Feature-Policy` ヘッダーを置き換えます。',
  'shared.info.header.crossOriginOpenerPolicy.summary':
    'クロスオリジンのオープナー関係（window.opener）からページを隔離します。',
  'shared.info.header.crossOriginOpenerPolicy.body1':
    '`same-origin` は crossOriginIsolated モードを有効にします。SharedArrayBuffer と高分解能タイマーに必要です。',
  'shared.info.header.crossOriginEmbedderPolicy.summary':
    '読み込まれるすべてのサブリソースにクロスオリジンの許可を求めます。',
  'shared.info.header.crossOriginEmbedderPolicy.body1':
    'crossOriginIsolated には `require-corp` を設定します。`Cross-Origin-Opener-Policy: same-origin` と対になります。',
  'shared.info.header.crossOriginResourcePolicy.summary': '外部オリジンによるリソースの読み込みを防ぎます。',
  'shared.info.header.crossOriginResourcePolicy.body1':
    '値：`same-site`、`same-origin`、`cross-origin`。ホットリンクされたくないアセットには重要です。',
  'shared.info.header.clearSiteData.summary':
    'このオリジンの Cookie / キャッシュ / ストレージの消去をブラウザーに求めます。',
  'shared.info.header.clearSiteData.body1': 'ログアウトフローに便利です。',
  'shared.info.header.clearSiteData.value.cookies': 'オリジンの Cookie を消去します。',
  'shared.info.header.clearSiteData.value.cache': 'HTTP キャッシュと画像キャッシュを消去します。',
  'shared.info.header.clearSiteData.value.storage': 'localStorage / IndexedDB / Service Worker の登録を消去します。',
  'shared.info.header.clearSiteData.value.wildcard': 'すべて消去します。',
  'shared.info.header.originAgentCluster.summary':
    '`?1` は、このオリジンに専用のエージェントクラスター（プロセス）を与えるようブラウザーに求めます。',
  'shared.info.header.originAgentCluster.body1':
    '`SharedArrayBuffer` や performance.measureUserAgentSpecificMemory などに対して、より良い隔離を提供します。',
  'shared.info.header.xRobotsTag.summary': 'クローラー向けの検索インデックス指示です（`noindex`、`nofollow`、…）。',
  'shared.info.header.xRobotsTag.body1':
    '`<meta name="robots">` タグと同じ意味ですが、HTML でないレスポンス（PDF、JSON、画像）に適用されます。',
  'shared.info.header.xUaCompatible.summary':
    '旧式の IE / Edge ディレクティブ（`IE=edge`）で、レンダリングエンジンを選びます。現代のブラウザーでは廃止されています。',

  // ── server-id ─────────────────────────────────────────────────────────
  'shared.info.header.server.summary': 'オリジンサーバーのソフトウェア識別です（例：`nginx/1.27`、`cloudflare`）。',
  'shared.info.header.server.body1':
    '本番では運用上のセキュリティのため、削除または固定値に設定されることがよくあります。',
  'shared.info.header.xPoweredBy.summary':
    'レスポンスの背後にあるフレームワーク / ランタイムを識別する非標準ヘッダーです。',
  'shared.info.header.xPoweredBy.body1':
    'Express、PHP、ASP.NET などがよく送出します。本番では抑止されることが多いです。',
  'shared.info.header.date.summary': 'メッセージが生成されたときのオリジンサーバーのタイムスタンプです。',
  'shared.info.header.date.body1':
    'キャッシュがレスポンスの経過時間を算出するのに使います。形式：IMF-fixdate（`Mon, 18 May 2026 15:05:25 GMT`）。',
  'shared.info.header.xServedBy.summary': 'レスポンスを提供した CDN エッジ / キャッシュノードを識別します。',
  'shared.info.header.xServedBy.body1':
    '複数の階層がリクエストを処理した場合はカンマ区切りです（shield → エッジ）。形式はベンダーによって異なります（Fastly の POP、AWS CloudFront のエッジなど）。',

  // ── tracing ───────────────────────────────────────────────────────────
  'shared.info.header.serverTiming.summary': 'サーバーがレスポンスに付加するパフォーマンス指標です。',
  'shared.info.header.serverTiming.body1':
    'DevTools と `PerformanceServerTiming` JS API に表示されます。形式：`<name>;dur=<ms>[;desc="..."]`、カンマ区切り。',
  'shared.info.header.traceparent.summary': 'W3C trace-context：分散トレース内のスパンを識別します。',
  'shared.info.header.traceparent.body1':
    '形式：`<version>-<trace-id>-<parent-id>-<flags>`。サービス間で引き継がれ、トレースを再構成できます。',
  'shared.info.header.tracestate.summary': '`traceparent` に付随するベンダー固有の trace-context です。',
  'shared.info.header.tracestate.body1':
    'カンマ区切りの `vendor=value` ペアです。各トレーシングベンダーが自身の状態をここに保存します。',
  'shared.info.header.xRequestId.summary':
    'サーバーが割り当てるこのリクエストの識別子です。ログやサービス間で引き継がれます。',
  'shared.info.header.xRequestId.body1':
    '非標準ですが広く使われています。デバッグ時にクライアントの挙動とサーバーログを突き合わせるのに役立ちます。',
  'shared.info.header.xFastlyRequestId.summary':
    'Fastly のリクエスト識別子です。Fastly のログ / デバッグと突き合わせます。',
  'shared.info.header.reportingEndpoints.summary':
    'ブラウザーが生成するレポート（CSP 違反、非推奨、NEL、…）の送信先に名前を付けます。',
  'shared.info.header.reportingEndpoints.body1':
    '形式：`name="https://reports.example.com", name2="https://..."`。古い `Report-To` ヘッダーを置き換えます。',
  'shared.info.header.reportTo.summary':
    '古い JSON ベースのレポートエンドポイント宣言です。`Reporting-Endpoints` に置き換えられました。',
  'shared.info.header.nel.summary':
    'Network Error Logging ポリシーです。接続失敗とプロトコルエラーを受け取るエンドポイントを指定する JSON 設定です。',
  'shared.info.header.nel.body1':
    'エンドポイントは `Reporting-Endpoints`（または古い `Report-To`）で事前に登録されている必要があります。',
  'shared.info.header.cfRay.summary':
    'Cloudflare のリクエスト識別子です。Cloudflare のログでリクエストを突き合わせるのに使います。',
  'shared.info.header.cfRay.body1':
    '形式：`<request-id>-<colo-id>`。colo-id はリクエストを処理した Cloudflare データセンターを識別します。',
} as const satisfies Catalog;
