/**
 * Shared info-popover corpus — HTTP status codes — Japanese. Mirrors
 * `catalogs/en/shared-info-status.ts` key for key; codes, canonical
 * reason phrases and header names (Location, Range, WWW-Authenticate,
 * …) stay raw — only prose translates. Mints: 理由句 = reason phrase;
 * リダイレクト = redirection; ゲートウェイ = gateway; 上流サーバー =
 * upstream server; レート制限 = rate limit; キャプティブポータル =
 * captive portal; 表現 = representation (content negotiation); 条件付き
 * リクエスト = conditional request; the Body / Authorization tab names
 * ride raw (zh-CN precedent).
 */

import type { Catalog } from '../../types';

export const sharedInfoStatus = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.status.kicker': 'HTTP ステータス · {range}',
  'shared.info.status.undocumented':
    'このコードそのものはレジストリに記載がありません。上の範囲がその標準的な意味です。',
  'shared.info.status.serverPhrase': 'サーバーは理由句「{statusText}」を送りました。',

  // ── Range kickers + fallback summaries ─────────────────────────────
  'shared.info.status.range1xx.kicker': '1xx 情報',
  'shared.info.status.range1xx.fallback': '暫定レスポンス。やり取りはまだ進行中で、最終ステータスが後に続きます。',
  'shared.info.status.range2xx.kicker': '2xx 成功',
  'shared.info.status.range2xx.fallback': 'リクエストは受信、理解、受理されました。',
  'shared.info.status.range3xx.kicker': '3xx リダイレクト',
  'shared.info.status.range3xx.fallback':
    'リクエストを完了するにはさらに操作が必要です。Location レスポンスヘッダーを参照してください。',
  'shared.info.status.range4xx.kicker': '4xx クライアントエラー',
  'shared.info.status.range4xx.fallback':
    'サーバーは送られたリクエストを拒否しました。リクエストの何かを変える必要があります。',
  'shared.info.status.range5xx.kicker': '5xx サーバーエラー',
  'shared.info.status.range5xx.fallback':
    'サーバーは一見有効なリクエストを処理できませんでした。問題はサーバー側にあります。',
  'shared.info.status.rangeOther.kicker': '非標準',
  'shared.info.status.rangeOther.fallback': 'このコードは標準の HTTP ステータス範囲の外です。',

  // ── Curated codes ──────────────────────────────────────────────────
  'shared.info.status.s100.summary':
    '暫定レスポンス。サーバーはリクエストヘッダーを受け取り、クライアントはボディの送信に進むべきです。',
  'shared.info.status.s101.summary':
    'サーバーは Upgrade ヘッダーで要求されたプロトコルの切り替え（例：WebSocket）に同意しました。',
  'shared.info.status.s102.summary':
    '暫定の WebDAV レスポンス。サーバーはリクエストを受理しましたが、まだ完了していません。',
  'shared.info.status.s103.summary':
    '最終レスポンスに先立ってヘッダー（通常は Link のプリロード）を運ぶ暫定レスポンス。',
  'shared.info.status.s200.summary': 'リクエストは成功し、レスポンスのボディに結果が含まれています。',
  'shared.info.status.s201.summary': 'リクエストは成功し、新しいリソースが作成されました。',
  'shared.info.status.s201.body': 'Location レスポンスヘッダーが通常、新しいリソースを指します。',
  'shared.info.status.s202.summary': 'リクエストは処理のために受理されましたが、処理はまだ完了していません。',
  'shared.info.status.s202.body':
    '非同期ジョブでよく使われます。結果は後で取得する必要があり、多くの場合ボディ内のステータス URL 経由です。',
  'shared.info.status.s203.summary':
    'レスポンスは成功しましたが、サーバーとクライアントの間の変換プロキシによって変更されています。',
  'shared.info.status.s204.summary': 'リクエストは成功し、レスポンスボディは意図的にありません。',
  'shared.info.status.s204.body': 'ここで Body タブが空なのは想定どおりで、エラーではありません。',
  'shared.info.status.s205.summary':
    'リクエストは成功し、クライアントは送信元のビューをリセットすべきです（例：フォームをクリア）。',
  'shared.info.status.s206.summary': 'サーバーは Range リクエストヘッダーで求められたバイト範囲だけを返しました。',
  'shared.info.status.s206.body': 'Content-Range は、このボディがリソース全体のどの部分かを示します。',
  'shared.info.status.s207.summary': 'WebDAV のバッチレスポンス。ボディは各サブ操作ごとに個別のステータスを運びます。',
  'shared.info.status.s208.summary': 'WebDAV。このメンバーは同じ multi-status レスポンス内で先に列挙済みです。',
  'shared.info.status.s226.summary':
    'レスポンスは以前のバージョンに対する差分（instance manipulation）で、リソース全体ではありません。',
  'shared.info.status.s300.summary': '複数の表現が利用可能で、サーバーはどれかを選んでいません。',
  'shared.info.status.s301.summary': 'リソースは Location ヘッダーの URL に恒久的に移動しました。',
  'shared.info.status.s301.body':
    'クライアントとキャッシュはこれを記憶します。リクエスト URL を新しいアドレスに更新してください。',
  'shared.info.status.s302.summary': 'リソースは一時的に Location ヘッダーの URL にあります。',
  'shared.info.status.s302.body':
    'ブラウザーは追従時にメソッドを GET に書き換えることが多いです。メソッドを保つには 307 を使ってください。',
  'shared.info.status.s303.summary': '結果は Location の URL にあり、GET で取得すべきです。',
  'shared.info.status.s303.body': 'POST の後によく使われ、作成された、または結果のページへリダイレクトします。',
  'shared.info.status.s304.summary': 'キャッシュされたコピーはまだ有効です。サーバーは意図的にボディを送っていません。',
  'shared.info.status.s304.body': '条件付きリクエスト（If-None-Match / If-Modified-Since）への返答として送られます。',
  'shared.info.status.s305.summary':
    '非推奨。リソースは Location のプロキシ経由でアクセスする必要があります。最近のクライアントは無視します。',
  'shared.info.status.s307.summary':
    '一時的に Location の URL にあります。追従時はメソッドとボディを保つ必要があります。',
  'shared.info.status.s308.summary':
    '恒久的に Location の URL にあります。追従時はメソッドとボディを保つ必要があります。',
  'shared.info.status.s400.summary': 'サーバーは送られたリクエストを解析または受理できませんでした。',
  'shared.info.status.s400.body':
    'ボディの構文、クエリパラメーター、必須ヘッダーを確認してください。レスポンスボディが問題のフィールドを示すことがよくあります。',
  'shared.info.status.s401.summary': 'リクエストに有効な認証資格情報がありません。',
  'shared.info.status.s401.body':
    'WWW-Authenticate レスポンスヘッダーが期待されるスキームを示します。Authorization タブ / token の鮮度を確認してください。',
  'shared.info.status.s402.summary': '予約されたコード。一部の API がクォータや課金の制限に使います。',
  'shared.info.status.s403.summary': 'サーバーはリクエストと資格情報を理解しましたが、許可を拒否しています。',
  'shared.info.status.s403.body':
    '401 と違い、再認証しても解決しません。この ID にはこのリソースへの権限がありません。',
  'shared.info.status.s404.summary': 'この URL にリソースは存在しません（またはサーバーが存在を隠しています）。',
  'shared.info.status.s404.body':
    'パスとその中の ID を確認してください。存在を漏らさないよう、403 の代わりに 404 を返す API もあります。',
  'shared.info.status.s405.summary': 'リソースは存在しますが、この HTTP メソッドには対応していません。',
  'shared.info.status.s405.body': 'Allow レスポンスヘッダーに、この URL が受け付けるメソッドが列挙されています。',
  'shared.info.status.s406.summary': 'サーバーはリクエストの Accept ヘッダーに合う表現を生成できません。',
  'shared.info.status.s407.summary':
    'あなたとサーバーの間のプロキシが資格情報を要求しています（Proxy-Authenticate がスキームを示します）。',
  'shared.info.status.s408.summary': 'サーバーはリクエストの残りを待つのをやめ、やり取りを閉じました。',
  'shared.info.status.s409.summary': 'リクエストはリソースの現在の状態と競合しています。',
  'shared.info.status.s409.body': '同時編集や重複作成で典型的です。リソースを読み直してから再試行してください。',
  'shared.info.status.s410.summary': 'リソースは存在していましたが、意図的かつ恒久的に削除されました。',
  'shared.info.status.s411.summary':
    'サーバーは Content-Length ヘッダーを要求し、チャンク化またはサイズ不明のボディを拒否します。',
  'shared.info.status.s412.summary':
    '条件ヘッダー（If-Match、If-Unmodified-Since など）が成立しなかったため、サーバーは実行を拒否しました。',
  'shared.info.status.s413.summary': 'リクエストボディがサーバーの受け付けるサイズを超えています。',
  'shared.info.status.s414.summary':
    'リクエスト URL がサーバーの制限を超えています。通常は、ボディに入れるべきクエリ文字列データです。',
  'shared.info.status.s415.summary': 'サーバーはボディの形式を拒否しています。',
  'shared.info.status.s415.body': 'Content-Type リクエストヘッダーを API の期待と照らし合わせてください。',
  'shared.info.status.s416.summary': 'Range リクエストヘッダーがリソースの範囲外のバイトを求めています。',
  'shared.info.status.s417.summary':
    'サーバーは Expect リクエストヘッダー（通常は Expect: 100-continue）を満たせません。',
  'shared.info.status.s418.summary': 'エイプリルフールの RFC のコード。一部の API が遊び心のある拒否に使います。',
  'shared.info.status.s421.summary':
    'リクエストが、このオーソリティに応答するよう構成されていないサーバーに届きました（再利用された HTTP/2 接続でよくあります）。',
  'shared.info.status.s422.summary': 'ボディは構文的には有効ですが意味的に誤っています。検証に失敗しました。',
  'shared.info.status.s422.body': 'レスポンスボディに通常、フィールドごとの検証エラーが列挙されています。',
  'shared.info.status.s423.summary': 'WebDAV。リソースは別の操作によってロックされています。',
  'shared.info.status.s424.summary': 'WebDAV。依存していた先行の操作が失敗したため、この操作も失敗しました。',
  'shared.info.status.s425.summary':
    'サーバーは再送される可能性のあるリクエスト（TLS の early data）の処理を拒否しています。',
  'shared.info.status.s426.summary':
    'サーバーは別のプロトコルを要求しています。Upgrade レスポンスヘッダーがそれを示します。',
  'shared.info.status.s428.summary':
    'サーバーは更新の消失を防ぐため、条件ヘッダー（通常は If-Match）を要求しています。',
  'shared.info.status.s429.summary': 'レート制限に達しました。ペースを落としてください。',
  'shared.info.status.s429.body':
    'Retry-After レスポンスヘッダー（あれば）が待つべき時間を示します。RateLimit-* ヘッダーを送る API も多くあります。',
  'shared.info.status.s431.summary':
    'リクエストヘッダーの 1 つ（または全体）がサーバーのサイズ制限を超えています。大きすぎる Cookie が原因のことが多いです。',
  'shared.info.status.s451.summary':
    'サーバーは法的理由（検閲、裁判所命令、GDPR による削除）でアクセスを拒否しています。',
  'shared.info.status.s500.summary': 'サーバーで予期しない状況が発生しました。障害はサーバー側にあります。',
  'shared.info.status.s500.body':
    '一時的な障害なら再試行で解決することがあります。そうでなければ、修正点はリクエストではなくサーバーログにあります。',
  'shared.info.status.s501.summary':
    'サーバーは必要な機能をサポートしていません。認識できないメソッドであることが多いです。',
  'shared.info.status.s502.summary': 'ゲートウェイまたはプロキシが上流サーバーから無効なレスポンスを受け取りました。',
  'shared.info.status.s502.body': 'プロキシの背後のオリジンが障害中か到達不能です。通常は一時的です。',
  'shared.info.status.s503.summary': 'サーバーは一時的にリクエストを処理できません（過負荷またはメンテナンス）。',
  'shared.info.status.s503.body': 'Retry-After（あれば）が再試行の時期を示します。',
  'shared.info.status.s504.summary': 'ゲートウェイまたはプロキシが上流サーバーの待機中にタイムアウトしました。',
  'shared.info.status.s505.summary': 'サーバーはリクエストで使われた HTTP プロトコルバージョンを拒否しています。',
  'shared.info.status.s506.summary':
    'コンテンツネゴシエーションにおけるサーバーの設定ミス。選ばれたバリアント自身がネゴシエーションの対象になっています。',
  'shared.info.status.s507.summary': 'WebDAV。サーバーはリクエストに必要な内容を保存できません。',
  'shared.info.status.s508.summary': 'WebDAV。サーバーはリクエストの処理中に無限ループを検出しました。',
  'shared.info.status.s510.summary': 'サーバーがリクエストを処理するには、さらなる拡張が必要です。',
  'shared.info.status.s511.summary':
    'ネットワーク（通常はキャプティブポータル）がアクセスを許可する前に認証を要求しています。',
} as const satisfies Catalog;
