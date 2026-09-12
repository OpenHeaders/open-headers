/**
 * Workbench editors — the WebSocket client editor — Japanese. Mirrors
 * `catalogs/en/workbench-editors-websocket.ts` key for key. Wire
 * vocabulary rides raw inside keyed values: ws/wss schemes,
 * subprotocol identifiers, AsyncAPI, Socket.IO / CONNECT / engine.io
 * tokens, the sio decoded rows (verbatim wire), `Arg`, Bearer / token,
 * long-polling, `Ack`. The Params tab and Docs tab ride raw
 * (tab.params / Docs law); Settings tab = 設定; spec-browser section
 * headers mirror AsyncAPI document keywords and ride raw (spec outline
 * law) while prose says チャネル / 操作 (editors-spec donor). フレーム =
 * frame; ハンドシェイク = handshake; セッション = session; タイムライン
 * = timeline; キャプチャ = capture; 認可 = the Authorization tab;
 * ヘッダー = Headers tab; ペイロード = payload. MINTS: サブプロトコル =
 * subprotocol; リッスン = the Listen column; 確認応答 = ack (prose; the
 * sio row `ack` stays verbatim wire); イベント = the Events tab noun;
 * 名前空間 = namespace — future editors-request ja reuses 認可 /
 * ヘッダー / Params for its twin tabs.
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': 'WebSocket リクエストが見つかりません。',
  'workbench.editors.websocket.connect.label': '接続',
  'workbench.editors.websocket.connect.disconnect': '切断',
  'workbench.editors.websocket.connect.cancel': 'キャンセル',
  'workbench.editors.websocket.connect.browserHost':
    'WebSocket セッションはデスクトップアプリまたはサーバーで実行されます。',
  'workbench.editors.websocket.connect.needsUrl': '接続するには ws:// または wss:// の URL を入力してください。',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'メッセージ',
  'workbench.editors.websocket.tab.events': 'イベント',
  'workbench.editors.websocket.tab.auth': '認可',
  'workbench.editors.websocket.tab.headers': 'ヘッダー',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.settings': '設定',
  'workbench.editors.websocket.tab.scripts': 'スクリプト',
  'workbench.editors.websocket.messagePlaceholder': '次に送信するメッセージを作成…',
  'workbench.editors.websocket.messagePlaceholderBase64': 'バイナリメッセージの Base64（例：aGVsbG8=）…',
  'workbench.editors.websocket.messagePlaceholderHex': 'バイナリメッセージの 16 進（例：68656c6c6f）…',
  'workbench.editors.websocket.message.formatText': 'Text',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.message.formatXml': 'XML',
  'workbench.editors.websocket.message.formatHtml': 'HTML',
  'workbench.editors.websocket.message.formatBinary': 'バイナリ',
  'workbench.editors.websocket.message.encodingBase64': 'Base64',
  'workbench.editors.websocket.message.encodingHex': 'Hexadecimal',
  'workbench.editors.websocket.message.invalidGate': 'まずメッセージのエンコーディングを修正してください。',
  'workbench.editors.websocket.message.invalidBase64':
    '有効な Base64 ではありません。デコード後のバイトが送信されます。',
  'workbench.editors.websocket.message.invalidHex':
    '有効な 16 進ではありません。0-9 a-f の 2 桁の組が送信されるバイトにデコードされます。',
  'workbench.editors.websocket.auth.helpRaw':
    'ハンドシェイクの Authorization: Bearer ヘッダーとして送られます。デスクトップアプリまたはサーバーで適用され、ブラウザーは WebSocket にこれを設定できません。明示的な Authorization ヘッダー行が優先されます。',
  'workbench.editors.websocket.auth.helpSocketio':
    'すべてのホストで CONNECT パケットの auth ペイロード（{"token": …}）として送られ、デスクトップアプリまたはサーバーではハンドシェイクの Authorization: Bearer ヘッダーとしても送られます。明示的な Authorization ヘッダー行がヘッダーより優先されます。',
  'workbench.editors.websocket.auth.inheritUnsupported':
    '{type}（{source} から）は WebSocket セッションには適用できません。',
  'workbench.editors.websocket.auth.helpOwn':
    '接続と再接続のたびに発行されます。ヘッダーはデスクトップアプリまたはサーバーでハンドシェイクに乗り（ブラウザーは設定できません）、クエリ配置または AWS 署名付き URL はすべてのホストでダイヤル URL に乗り、Socket.IO 版は bearer 形の token を CONNECT の auth ペイロードとしても送ります。同じ名前の明示的なヘッダー行が優先されます。',
  'workbench.editors.websocket.auth.ownUnsupported': '{type} は WebSocket セッションには適用できません。',
  'workbench.editors.websocket.events.hint':
    'セッションのタイムラインに表示する受信イベントです。行がなければすべてのイベントを表示します。キャプチャは常にすべてを記録します。',
  'workbench.editors.websocket.events.namePlaceholder': 'イベント名',
  'workbench.editors.websocket.events.listenLabel': 'リッスン',
  'workbench.editors.websocket.event.namePlaceholder': 'イベント名',
  'workbench.editors.websocket.event.ackLabel': 'Ack を期待',
  'workbench.editors.websocket.event.ackHelp':
    '送信ごとに確認応答 ID を発行し、サーバーの ack 返信がタイムラインで対応付くようにします。',
  'workbench.editors.websocket.event.argsPlaceholder': 'JSON の引数配列を作成（例：["hello", 42]）…',
  'workbench.editors.websocket.event.argTab': 'Arg {index}',
  'workbench.editors.websocket.event.addArg': 'Arg',
  'workbench.editors.websocket.event.removeArg': '引数 {index} を削除',
  'workbench.editors.websocket.event.argPlaceholder': 'この引数を JSON で作成（例："hello" または {"id": 42}）…',
  'workbench.editors.websocket.headers.keyPlaceholder': 'ヘッダー名',
  'workbench.editors.websocket.headers.valuePlaceholder': '値',
  'workbench.editors.websocket.headers.hint.host':
    '接続時に対象 URL から導出されます。アップグレードリクエストの宛先となるホストです。',
  'workbench.editors.websocket.headers.hint.connection':
    'サーバーにプロトコルの切り替えを求めます。WebSocket のオープニングハンドシェイクは常に Connection: Upgrade を運びます。',
  'workbench.editors.websocket.headers.hint.upgrade':
    '切り替え先のプロトコルを指定します。すべての WebSocket ハンドシェイクは HTTP 接続を websocket にアップグレードします。',
  'workbench.editors.websocket.headers.hint.key':
    '接続ごとに生成されるランダムなノンスです。サーバーはそのハッシュを Sec-WebSocket-Accept で返すことで、ハンドシェイクを読んだことを証明します。',
  'workbench.editors.websocket.headers.hint.version':
    'WebSocket プロトコルのバージョン（RFC 6455）です。使われているのは 13 だけです。',
  'workbench.editors.websocket.headers.hint.extensions':
    'メッセージ単位の圧縮を提案します。サーバーはハンドシェイク応答でこの提案を受け入れ、絞り込み、または無視できます。',
  'workbench.editors.websocket.headers.hint.origin':
    'ブラウザーがすべての WebSocket ハンドシェイクに刻むページのオリジンです。サーバーはクロスサイト接続の拒否に使います。',
  'workbench.editors.websocket.headers.hint.userAgent':
    'ブラウザーはハンドシェイクで自身を名乗ります。ページのコードからは変更できません。',
  'workbench.editors.websocket.headers.hint.cacheControl':
    'ブラウザーはアップグレードリクエストをキャッシュ不可としてマークします。',
  'workbench.editors.websocket.headers.hint.acceptEncoding':
    'ハンドシェイク応答でブラウザーが受け入れるコンテンツエンコーディングです。',
  'workbench.editors.websocket.headers.hint.acceptLanguage': 'ブラウザーの設定から取られた優先言語です。',
  'workbench.editors.websocket.headers.hint.node.accept':
    'node ランタイムのハンドシェイクは、どの応答メディアタイプも受け入れます。',
  'workbench.editors.websocket.headers.hint.node.acceptLanguage':
    'node ランタイムのハンドシェイクはワイルドカードを送ります。',
  'workbench.editors.websocket.headers.hint.node.secFetchMode':
    'node ランタイムがすべての WebSocket ハンドシェイクに刻みます。',
  'workbench.editors.websocket.headers.hint.node.userAgent':
    'node ランタイムはハンドシェイクでこのアプリを名乗ります。別のものを送るには独自の User-Agent 行を追加してください。',
  'workbench.editors.websocket.headers.hint.node.cacheControl':
    'node ランタイムはアップグレードリクエストをキャッシュ不可としてマークします。',
  'workbench.editors.websocket.headers.hint.node.acceptEncoding':
    'ハンドシェイク応答で node ランタイムが受け入れるコンテンツエンコーディングです。',
  'workbench.editors.websocket.headers.browserNotSent':
    '送信されません。ブラウザーはハンドシェイクのヘッダーを自身で設定します。カスタムヘッダーは、セッションがデスクトップアプリまたはサーバーで実行されるときに適用されます。',
  'workbench.editors.websocket.spec.selectLabel': 'AsyncAPI 仕様',
  'workbench.editors.websocket.spec.selectPlaceholder': 'AsyncAPI 仕様をリンク',
  'workbench.editors.websocket.spec.summary':
    '{servers} 個のサーバー · {channels} 個のチャネル · {operations} 個の操作',
  'workbench.editors.websocket.spec.parseFailure': '仕様を解析できませんでした：{message}',
  'workbench.editors.websocket.spec.issues': '{count} 件の仕様の問題',
  'workbench.editors.websocket.spec.useExample': '例のメッセージを使う…',
  'workbench.editors.websocket.spec.browser.hint': 'メッセージを選ぶとその例のペイロードを作成します。',
  'workbench.editors.websocket.spec.browser.servers': 'Servers',
  'workbench.editors.websocket.spec.browser.channels': 'Channels',
  'workbench.editors.websocket.spec.browser.operations': 'Operations',
  'workbench.editors.websocket.spec.browser.components': 'Components',
  'workbench.editors.websocket.settings.exampleCaption': 'セッションの例',
  'workbench.editors.websocket.settings.group.connection': '接続',
  'workbench.editors.websocket.settings.group.socketio': 'Socket.IO',
  'workbench.editors.websocket.settings.group.tls': 'TLS と信頼',
  'workbench.editors.websocket.settings.group.resilience': 'セッションの回復力',
  'workbench.editors.websocket.settings.groupInfo.resilience':
    '長いセッションを保つものです。落ちた接続を開き直すかどうかとどれほど辛抱強く行うか、接続が失われたとみなすまでに沈黙がどれだけ続いてよいか、そしてこのクライアントが送るハートビート。',
  'workbench.editors.websocket.settings.groupInfo.connection':
    'ハンドシェイクがセッションを開く方法です。提示するサブプロトコル、接続のダイヤル先、そしてオープンの上限。',
  'workbench.editors.websocket.settings.groupInfo.socketio':
    'Socket.IO セッションがサーバーを指し、話す方法です。マウントする engine.io ハンドシェイクのパス、参加する名前空間、プロトコルのリビジョン、そしてイベントが ack を待つ時間。',
  'workbench.editors.websocket.settings.groupInfo.tls':
    'wss: セッションが信頼を確立する方法です。サーバー証明書をシステムのルートで検証するか、このデバイスが提示するクライアント証明書、ハンドシェイクの TLS バージョン範囲と暗号リスト、そして提示する SNI 名。',
  'workbench.editors.websocket.settings.subprotocolsLabel': 'サブプロトコル',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    'Sec-WebSocket-Protocol の提示リストです。優先順に並べ、サーバーがハンドシェイク中に 1 つ選びます。',
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'なし（デフォルト）',
  'workbench.editors.websocket.settings.subprotocolsExample': '例：graphql-transport-ws',
  'workbench.editors.websocket.settings.unixSocketLabel': 'Unix ソケット',
  'workbench.editors.websocket.settings.unixSocketHelp':
    'TCP 接続を開く代わりに、このローカルソケット（絶対パスの Unix ソケット、または \\\\.\\pipe\\name のような Windows の名前付きパイプ）にダイヤルします。ハンドシェイクの Host、TLS サーバー名、証明書の検証は引き続き URL が決めます。変わるのは接続の行き先だけです。通常の TCP 接続にするには空のままにしてください。',
  'workbench.editors.websocket.settings.unixSocketPlaceholder': 'TCP 接続（デフォルト）',
  'workbench.editors.websocket.settings.timeoutLabel': '接続タイムアウト',
  'workbench.editors.websocket.settings.timeoutHelp':
    '接続ハンドシェイクだけに対する実時間の上限です。開いているセッションに上限はありません。空にするとデッドラインはありません。',
  'workbench.editors.websocket.settings.timeoutPlaceholder': '制限なし（デフォルト）',
  'workbench.editors.websocket.settings.handshakePathLabel': 'ハンドシェイクのパス',
  'workbench.editors.websocket.settings.handshakePathHelp':
    'engine.io ハンドシェイクがダイヤルするサーバーのパスです。Socket.IO のマウントであり、名前空間ではありません。空の場合は標準の /socket.io/ にダイヤルします。セッションは websocket トランスポートを直接ダイヤルし、long-polling へのフォールバックはありません。',
  'workbench.editors.websocket.settings.handshakePathPlaceholder': '/socket.io/（デフォルト）',
  'workbench.editors.websocket.settings.handshakePathExample': '例：/net/sio-probe',
  'workbench.editors.websocket.settings.namespaceLabel': '名前空間',
  'workbench.editors.websocket.settings.namespaceHelp':
    'セッションが参加する名前空間です。公式クライアントと同じく URL のパスとして読まれます（ws://host/admin は /admin に参加）。ここまたは URL で編集でき、両者は同期を保ちます。空の場合はルート / に参加します。',
  'workbench.editors.websocket.settings.namespacePlaceholder': '/（デフォルト）',
  'workbench.editors.websocket.settings.namespaceExample': '例：/admin',
  'workbench.editors.websocket.settings.socketioProtocolLabel': 'プロトコル',
  'workbench.editors.websocket.settings.socketioProtocolHelp':
    'セッションが話す Socket.IO プロトコルのリビジョンです。v5（engine.io 4）は Socket.IO 3.x と 4.x のサーバーが話すものです。1.x または 2.x のサーバーには v4（engine.io 3）を選んでください。そこではクライアントが ping を送り、サーバーが自らルート名前空間に参加させ、connect パケットは auth ペイロードを運ばないため、bearer の資格情報はハンドシェイクのヘッダーだけに乗ります。',
  'workbench.editors.websocket.settings.socketioProtocolPlaceholder': 'v5（デフォルト）',
  'workbench.editors.websocket.settings.socketioProtocolV5': 'v5 — Socket.IO 3.x / 4.x サーバー',
  'workbench.editors.websocket.settings.socketioProtocolV4': 'v4 — Socket.IO 1.x / 2.x サーバー',
  'workbench.editors.websocket.settings.ackTimeoutLabel': 'Ack のタイムアウト',
  'workbench.editors.websocket.settings.ackTimeoutHelp':
    'Ack 付きで送ったイベントがサーバーの確認応答を待つ時間です。時間切れになるとタイムラインは ack をタイムアウトとして記録し、待つのをやめます。遅れて届いた ack はそのまま表示されます。空の場合は無期限に待ちます。',
  'workbench.editors.websocket.settings.ackTimeoutPlaceholder': 'タイムアウトなし（デフォルト）',
  'workbench.editors.websocket.toast.deletedOtherTab': 'この WebSocket リクエストは別のタブで削除されました。',
  'workbench.editors.websocket.toast.updateFailed': 'WebSocket リクエストの保存に失敗しました',
  'workbench.editors.websocket.toast.updateFailedDetail': 'WebSocket リクエストの保存に失敗しました：{message}',
  'workbench.editors.websocket.toast.savedExample': '例 {name} を保存しました',
  'workbench.editors.websocket.toast.saveExampleFailed': '例の保存に失敗しました',
  'workbench.editors.websocket.toast.saveExampleFailedDetail': '例の保存に失敗しました：{message}',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.paneTitle': 'レスポンス',
  'workbench.editors.websocket.session.emptyHint': '接続するとメッセージを送受信できます。',
  'workbench.editors.websocket.session.connectFailed': 'セッションを開けませんでした',
  'workbench.editors.websocket.session.connectingBadge': '接続中',
  'workbench.editors.websocket.session.connectedBadge': '接続済み',
  'workbench.editors.websocket.session.closedTag': 'クローズ {code}',
  'workbench.editors.websocket.session.stoppedTag': '停止',
  'workbench.editors.websocket.session.disconnectedTag': '切断',
  'workbench.editors.websocket.session.connectFailedTag': '接続失敗',
  'workbench.editors.websocket.session.abortedTag': '中止',
  'workbench.editors.websocket.session.noCloseFrame': '接続は Close フレームなしで終了しました',
  'workbench.editors.websocket.session.duration': '{ms} ms',
  'workbench.editors.websocket.session.sendMessage': '送信',
  'workbench.editors.websocket.session.saveResponse': 'レスポンスを保存',
  'workbench.editors.websocket.session.sendIdle': '接続するとメッセージを送信できます。',
  'workbench.editors.websocket.session.sendFailed': 'メッセージを送信できませんでした',
  'workbench.editors.websocket.session.hostNotice':
    'ブラウザーのソケットで実行中です。{knobs}はこのホストでは適用されません。',
  'workbench.editors.websocket.session.knobHeaders': 'カスタムハンドシェイクヘッダー',
  'workbench.editors.websocket.session.knobSslVerify': '無効化した SSL 検証',
  'workbench.editors.websocket.session.knobAuth': '資格情報のハンドシェイクヘッダー',
  'workbench.editors.websocket.session.handshakeNone': '交渉されたものはありません',
  'workbench.editors.websocket.session.handshakeNote':
    'プラットフォームのソケットは交渉されたサブプロトコルと拡張だけを公開します。101 応答のヘッダーはクライアントからは利用できません。',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': '接続中',
  'workbench.editors.websocket.timeline.connected': '接続済み',
  'workbench.editors.websocket.timeline.disconnected': '切断',
  'workbench.editors.websocket.timeline.stopped': '停止',
  'workbench.editors.websocket.timeline.aborted': '接続を中止',
  'workbench.editors.websocket.connect.reconnectNow': '今すぐ再接続',
  'workbench.editors.websocket.connect.reconnectNowHint': '待機時間を待たずに次の再接続試行をダイヤルします',
  'workbench.editors.websocket.session.reconnectingBadge': '再接続中',
  'workbench.editors.websocket.session.reconnectExhaustedTag': '再接続を断念',
  'workbench.editors.websocket.session.reconnectExhausted': '{attempts}の後、再接続を断念しました',
  'workbench.editors.websocket.session.reconnectExhaustedReason': '{attempts}の後、再接続を断念しました：{reason}',
  'workbench.editors.websocket.session.reconnectAttemptsOne': '1 回の試行',
  'workbench.editors.websocket.session.reconnectAttemptsMany': '{count} 回の試行',
  'workbench.editors.websocket.timeline.lost': '接続が失われました',
  'workbench.editors.websocket.timeline.lostIdle': 'アイドルタイムアウトまでに何も届きませんでした',
  'workbench.editors.websocket.timeline.reconnectingAfter': '{delay} 後に再接続試行 {attempt}',
  'workbench.editors.websocket.timeline.reconnectingNow': '今すぐ再接続試行 {attempt}',
  'workbench.editors.websocket.timeline.reconnected': '再接続',
  'workbench.editors.websocket.timeline.reconnectedTo': '{url} に再接続',
  'workbench.editors.websocket.timeline.ackTimeout': 'Ack #{ackId} は {timeout} 後にタイムアウトしました',
  'workbench.editors.websocket.timeline.noMatches': 'フィルターに一致するメッセージはありません。',
  'workbench.editors.websocket.timeline.connectedTo': '{url} に接続',
  'workbench.editors.websocket.timeline.copyMessage': 'メッセージをコピー',
  'workbench.editors.websocket.saved.title': '保存済みメッセージ',
  'workbench.editors.websocket.saved.addTooltip': '現在の作成内容を再利用できるメッセージとして保存',
  'workbench.editors.websocket.saved.showRail': '保存済みメッセージを表示',
  'workbench.editors.websocket.saved.hideRail': '保存済みメッセージを非表示',
  'workbench.editors.websocket.saved.emptyHint': 'メッセージを保存すると、アクティブな接続中に再利用できます。',
  'workbench.editors.websocket.saved.defaultName': 'メッセージ',
  'workbench.editors.websocket.saved.rename': '名前を変更',
  'workbench.editors.websocket.saved.duplicate': '複製',
  'workbench.editors.websocket.saved.delete': '削除',
  'workbench.editors.websocket.timeline.saveMessage': 'メッセージを保存',
  'workbench.editors.websocket.timeline.info.label': 'メッセージの詳細',
  'workbench.editors.websocket.timeline.info.size': 'サイズ',
  'workbench.editors.websocket.timeline.info.time': '時刻',
  'workbench.editors.websocket.timeline.info.frame': 'フレーム',
  'workbench.editors.websocket.timeline.info.frameText': 'テキスト',
  'workbench.editors.websocket.timeline.info.frameBinary': 'バイナリ',
  'workbench.editors.websocket.timeline.couldNotConnect': '{url} に接続できませんでした',
  'workbench.editors.websocket.timeline.errorLabel': 'エラー',
  'workbench.editors.websocket.timeline.disconnectedFrom': '{url} から切断',
  'workbench.editors.websocket.timeline.handshakeDetails': 'ハンドシェイクの詳細',
  'workbench.editors.websocket.timeline.requestUrl': 'リクエスト URL',
  'workbench.editors.websocket.timeline.requestMethod': 'リクエストメソッド',
  'workbench.editors.websocket.timeline.statusCode': 'ステータスコード',
  'workbench.editors.websocket.timeline.requestHeaders': 'リクエストヘッダー',
  'workbench.editors.websocket.timeline.responseHeaders': 'レスポンスヘッダー',
  'workbench.editors.websocket.timeline.keyGenerated': '<ソケットが生成>',
  'workbench.editors.websocket.timeline.stoppedDetail': 'セッションはこのアプリから停止されました。',
  'workbench.editors.websocket.timeline.closeCode.unknown':
    '登録された意味はありません。アプリケーションまたはプライベートのコードです。',
  'workbench.editors.websocket.timeline.closeCode.1000': '接続は正常に閉じられました。',
  'workbench.editors.websocket.timeline.closeCode.1001':
    'エンドポイントが離れようとしています。サーバーのシャットダウンまたはページのナビゲーションです。',
  'workbench.editors.websocket.timeline.closeCode.1002': 'エンドポイントがプロトコルエラーのため接続を終了しました。',
  'workbench.editors.websocket.timeline.closeCode.1003': 'エンドポイントが受け入れられない種類のデータを受信しました。',
  'workbench.editors.websocket.timeline.closeCode.1005': 'Close フレームにステータスコードがありませんでした。',
  'workbench.editors.websocket.timeline.closeCode.1006': '接続が Close フレームなしで落ちました。',
  'workbench.editors.websocket.timeline.closeCode.1007':
    'メッセージがその種類と矛盾するデータを運んでいました。テキストフレーム内の無効な UTF-8 などです。',
  'workbench.editors.websocket.timeline.closeCode.1008': 'メッセージがエンドポイントのポリシーに違反しました。',
  'workbench.editors.websocket.timeline.closeCode.1009': 'メッセージが大きすぎてエンドポイントが処理できませんでした。',
  'workbench.editors.websocket.timeline.closeCode.1010': 'クライアントが必要とする拡張をサーバーが交渉しませんでした。',
  'workbench.editors.websocket.timeline.closeCode.1011':
    'サーバーが予期しない状態に遭遇し、リクエストを果たせませんでした。',
  'workbench.editors.websocket.timeline.closeCode.1012': 'サーバーが再起動しています。',
  'workbench.editors.websocket.timeline.closeCode.1013': 'サーバーが過負荷です。後でもう一度お試しください。',
  'workbench.editors.websocket.timeline.closeCode.1014':
    'ゲートウェイまたはプロキシが上流サーバーから無効な応答を受け取りました。',
  'workbench.editors.websocket.timeline.closeCode.1015': 'TLS ハンドシェイクに失敗しました。',
  'workbench.editors.websocket.timeline.searchMessages': 'メッセージを検索',
  'workbench.editors.websocket.timeline.messageCount': '{count} 件のメッセージ',
  'workbench.editors.websocket.timeline.dropped': '古いメッセージ {count} 件がキャプチャから押し出されました',
  'workbench.editors.websocket.timeline.script': '{hook} — {levels}',
  'workbench.editors.websocket.timeline.scriptFailed': '{hook} が失敗 — {error}',
  'workbench.editors.websocket.timeline.scriptDropped': '{hook} がメッセージを破棄 — {level}',
  'workbench.editors.websocket.timeline.scriptAttempt': '試行 {attempt}',
  'workbench.editors.websocket.session.view.timeline': 'タイムライン',
  'workbench.editors.websocket.session.view.scripts': 'スクリプト',
  'workbench.editors.websocket.session.scripts.empty': 'このセッションではスクリプトは実行されていません。',
  'workbench.editors.websocket.session.scripts.console': 'コンソール',
  'workbench.editors.websocket.session.scripts.tests': 'Tests',
  'workbench.editors.websocket.session.scripts.consoleEmpty': 'ログはありません。',
  'workbench.editors.websocket.session.scripts.testsEmpty': 'アサーションは登録されていません。',
  'workbench.editors.websocket.session.scripts.attempt': '試行 {attempt}',
  'workbench.editors.websocket.session.scripts.atMessage': 'メッセージ {index}',
  'workbench.editors.websocket.session.scripts.tag': 'スクリプト · {count}',
  'workbench.editors.websocket.session.scripts.tagTitle': 'セッションのスクリプト',
  'workbench.editors.websocket.session.scripts.tagSummary': 'このセッションで実行されたフックと、寄与したレベルです。',
  'workbench.editors.websocket.session.scripts.tagSummaryFailed':
    'フックが失敗しました。最後のエラーがその下に表示されます。',
  'workbench.editors.websocket.session.scripts.runs': '{count} 回実行',
  'workbench.editors.websocket.session.scripts.runsOne': '1 回実行',
  'workbench.editors.websocket.session.scripts.failed': '{count} 件失敗',
  'workbench.editors.websocket.session.scripts.dropped': '{count} 件破棄',
  'workbench.editors.websocket.session.scripts.marksCapped':
    'イベントごとの詳細は {count} 回の実行で停止しました。フックは動き続け、セッションが落ち着くと完全な件数が届きます。',
  'workbench.editors.websocket.timeline.filterAll': 'すべて',
  'workbench.editors.websocket.timeline.filterSent': '送信',
  'workbench.editors.websocket.timeline.filterReceived': '受信',
  'workbench.editors.websocket.timeline.newestFirst': '新しい順',
  'workbench.editors.websocket.timeline.oldestFirst': '古い順',
  'workbench.editors.websocket.timeline.sortOrder': '並べ替えとグループ化',
  'workbench.editors.websocket.timeline.groupByDirection': '方向でグループ化',
  'workbench.editors.websocket.timeline.groupByEvent': 'イベントでグループ化',
  'workbench.editors.websocket.timeline.hideHeartbeat': 'ハートビートを隠す（ping / pong）',
  'workbench.editors.websocket.timeline.hideHandshake': 'ハンドシェイクフレームを隠す（open / connect）',
  'workbench.editors.websocket.timeline.rowsPerGroup': 'グループごとの行数',
  'workbench.editors.websocket.timeline.noLimit': '制限なし',
  'workbench.editors.websocket.timeline.clearMessages': 'メッセージをクリア',
  'workbench.editors.websocket.timeline.trustCertificate': '証明書を信頼',
  'workbench.editors.websocket.timeline.newMessages': '新しいメッセージ',
  'workbench.editors.websocket.timeline.binaryMessage': 'バイナリメッセージ（{bytes} バイト）',
  'workbench.editors.websocket.timeline.sentAria': '送信',
  'workbench.editors.websocket.timeline.receivedAria': '受信',
  // Socket.IO decoded display rows (wire vocabulary rides raw).
  'workbench.editors.websocket.timeline.sio.engineOpen': 'engine.io open',
  'workbench.editors.websocket.timeline.sio.engineClose': 'engine.io close',
  'workbench.editors.websocket.timeline.sio.ping': 'ping',
  'workbench.editors.websocket.timeline.sio.pong': 'pong',
  'workbench.editors.websocket.timeline.sio.connect': 'connect {namespace}',
  'workbench.editors.websocket.timeline.sio.connected': 'connected {namespace}',
  'workbench.editors.websocket.timeline.sio.connectError': 'connect error',
  'workbench.editors.websocket.timeline.sio.disconnect': 'disconnect {namespace}',
  'workbench.editors.websocket.timeline.sio.binaryAttachments': 'バイナリ添付フレーム（{count} 個の添付）',
  'workbench.editors.websocket.timeline.sio.ack': 'ack',
  'workbench.editors.websocket.timeline.sio.eventNoName': 'event',
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.wsExample.loading': '例を読み込んでいます…',
  'workbench.editors.wsExample.notFound': 'この例はなくなりました。別のタブで削除された可能性があります。',
  'workbench.editors.wsExample.openInRequest': 'リクエストで開く',
  'workbench.editors.wsExample.openInRequestTooltip':
    'このキャプチャした形を未保存の編集として、親の WebSocket リクエストを開きます。',
  'workbench.editors.wsExample.capturedTooltip': '{date} にキャプチャ',
  'workbench.editors.wsExample.toast.deletedOtherTab': 'この例は別のタブで削除されました。',
  'workbench.editors.wsExample.toast.saveFailed': '例の保存に失敗しました',
  'workbench.editors.wsExample.toast.saveFailedDetail': '例の保存に失敗しました：{message}',
} as const satisfies Catalog;
