/**
 * Workbench editors — gRPC client + gRPC response examples —
 * Japanese. Mirrors `catalogs/en/workbench-editors-grpc.ts` key for
 * key. Raw by design: gRPC status-code names (OK, CANCELLED, …) with
 * their lead-ins rendered as ステータスコード N NAME, rpc/service
 * identifiers ({rpc}), Protobuf / `.proto` / TLS / SSL / lowercase
 * `base64` vocabulary, `host:port` and `authorization: Bearer <token>`
 * wire syntax, `Metadata` / `Trailers` tab nouns kept as the gRPC
 * protocol terms, `Docs` / `Streaming` / `Authority` raw, and the
 * {count} / {ms} / {bytes} / {name} / {message} holes. Settings tab =
 * 設定; タイムライン = timeline; フレーム = frame; streaming modes reuse
 * the editors-spec mints（ユナリー / ストリーミング）; 認可 / ヘッダー
 * family tab nouns per editors-websocket. MINTS: 呼び出し = invoke /
 * the call; 上限 = capped at (byte cap); キープアライブ = keepalive;
 * デッドライン = deadline.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGrpc = {
  // ── gRPC request editor ─────────────────────────────────────────────
  'workbench.editors.grpc.notFound': 'gRPC リクエストが見つかりません。',
  'workbench.editors.grpc.urlPlaceholder': 'host:port（例：grpc.openheaders.com:443）',
  'workbench.editors.grpc.tls.on': 'TLS オン。クリックで平文に切り替え',
  'workbench.editors.grpc.tls.off': 'TLS オフ（平文）。クリックで TLS に切り替え',
  'workbench.editors.grpc.method.placeholder': 'メソッドを選択',
  'workbench.editors.grpc.method.noSpecPlaceholder': 'メソッドを選ぶには Protobuf 仕様をリンクしてください',
  'workbench.editors.grpc.method.unresolvedGroup': 'リンクされた仕様にありません',
  'workbench.editors.grpc.method.unresolvedOption': '{rpc}（未解決）',
  'workbench.editors.grpc.method.linkGroup': 'Protobuf 仕様をリンク',
  'workbench.editors.grpc.method.importProto': '.proto ファイルをインポート…',
  'workbench.editors.grpc.invoke.label': '呼び出し',
  'workbench.editors.grpc.invoke.stop': '停止',
  'workbench.editors.grpc.invoke.browserHost':
    '呼び出しはデスクトップアプリで実行されます。作成と保存はここでできます。',
  'workbench.editors.grpc.invoke.needsMethod':
    '呼び出すには、リンクされた仕様に対して解決できるメソッドを選んでください',
  'workbench.editors.grpc.invoke.needsUrl': '呼び出すには対象ホストを入力してください',
  'workbench.editors.grpc.invoke.failed': '呼び出しに失敗しました。ホストが呼び出しに応答しませんでした',
  'workbench.editors.grpc.response.title': 'レスポンス',
  'workbench.editors.grpc.response.empty.prompt': 'メソッドを呼び出すとレスポンスが得られます。',
  'workbench.editors.grpc.response.empty.invoking': '呼び出し中…',
  'workbench.editors.grpc.status.kicker': 'gRPC ステータス',
  // Canonical gRPC status vocabulary — the official per-code
  // descriptions, verbatim, so the pill popover reads exactly like the
  // protocol documentation.
  'workbench.editors.grpc.status.desc.unknownCode': 'gRPC の語彙にない非標準のステータスコードです。',
  'workbench.editors.grpc.status.desc.OK':
    'ステータスコード 0 OK は、gRPC メソッドの呼び出しに成功したときの標準的な応答です。',
  'workbench.editors.grpc.status.desc.CANCELLED':
    'ステータスコード 1 CANCELLED は、操作が呼び出し側によってキャンセルされた場合に返されます。',
  'workbench.editors.grpc.status.desc.UNKNOWN':
    'ステータスコード 2 UNKNOWN は、不明なエラーのために操作を完了できなかった場合に返されます。たとえば、別のアドレス空間から受け取った Status 値が、このアドレス空間では知られていないエラー空間に属する場合に返されることがあります。また、十分なエラー情報を返さない API が発生させたエラーも、このエラーに変換されることがあります。',
  'workbench.editors.grpc.status.desc.INVALID_ARGUMENT':
    'ステータスコード 3 INVALID_ARGUMENT は、クライアントが無効な引数を指定した場合に返されます。システムの状態にかかわらず問題のある引数を表します（例：不正な形式のファイル名）。',
  'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED':
    'ステータスコード 4 DEADLINE_EXCEEDED は、操作を完了する前にデッドラインが切れた場合に返されます。システムの状態を変える操作では、操作が正常に完了していてもこのエラーが返されることがあります。たとえば、サーバーからの成功応答が長く遅延した場合です。',
  'workbench.editors.grpc.status.desc.NOT_FOUND':
    'ステータスコード 5 NOT_FOUND は、要求されたエンティティ（ファイルやディレクトリなど）が見つからなかった場合に返されます。',
  'workbench.editors.grpc.status.desc.ALREADY_EXISTS':
    'ステータスコード 6 ALREADY_EXISTS は、作成しようとしたエンティティ（ファイルやディレクトリなど）が既に存在する場合に返されます。',
  'workbench.editors.grpc.status.desc.PERMISSION_DENIED':
    'ステータスコード 7 PERMISSION_DENIED は、呼び出し側に指定された操作を実行する権限がない場合に返されます。このエラーコードは、リクエストが有効であることや、要求されたエンティティが存在すること、その他の前提条件を満たすことを意味しません。',
  'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED':
    'ステータスコード 8 RESOURCE_EXHAUSTED は、ユーザーごとのクォータが尽きた場合や、ファイルシステム全体の空き容量がなくなった場合に返されます。',
  'workbench.editors.grpc.status.desc.FAILED_PRECONDITION':
    'ステータスコード 9 FAILED_PRECONDITION は、操作の実行に必要な状態にシステムがないために操作が拒否された場合に返されます。たとえば、削除しようとしたディレクトリが空でない、rmdir 操作がディレクトリでないものに適用された、などです。',
  'workbench.editors.grpc.status.desc.ABORTED':
    'ステータスコード 10 ABORTED は、操作が中断された場合に返されます。通常はシーケンサー検査の失敗やトランザクションの中断といった並行性の問題が原因です。',
  'workbench.editors.grpc.status.desc.OUT_OF_RANGE':
    'ステータスコード 11 OUT_OF_RANGE は、有効範囲を超えて操作が試みられた場合に返されます。たとえば、ファイル末尾を越えたシークや読み取りです。',
  'workbench.editors.grpc.status.desc.UNIMPLEMENTED':
    'ステータスコード 12 UNIMPLEMENTED は、操作が実装されていないか、このサービスで対応 / 有効化されていない場合に返されます。',
  'workbench.editors.grpc.status.desc.INTERNAL':
    'ステータスコード 13 INTERNAL は、内部エラーがある場合に返されます。基盤となるシステムが期待する不変条件が破られたことを意味します。',
  'workbench.editors.grpc.status.desc.UNAVAILABLE':
    'ステータスコード 14 UNAVAILABLE は、サービスが現在利用できない場合に返されます。',
  'workbench.editors.grpc.status.desc.DATA_LOSS':
    'ステータスコード 15 DATA_LOSS は、回復不能なデータの損失または破損がある場合に返されます。',
  'workbench.editors.grpc.status.desc.UNAUTHENTICATED':
    'ステータスコード 16 UNAUTHENTICATED は、リクエストがその操作に対する有効な認証資格情報を持たない場合に返されます。',
  'workbench.editors.grpc.response.error.title': '呼び出しに失敗しました',
  'workbench.editors.grpc.response.error.localGuidance':
    '呼び出しは応答に到達しませんでした。対象、TLS モード、サーバーに到達できるかを確認してください。',
  'workbench.editors.grpc.response.error.statusGuidance':
    'メッセージを確認して、メソッドをもう一度呼び出してください。',
  'workbench.editors.grpc.response.tab.response': 'レスポンス',
  'workbench.editors.grpc.response.tab.metadata': 'Metadata',
  'workbench.editors.grpc.response.tab.metadataCount': 'Metadata（{count}）',
  'workbench.editors.grpc.response.tab.trailers': 'Trailers',
  'workbench.editors.grpc.response.tab.trailersCount': 'Trailers（{count}）',
  'workbench.editors.grpc.response.filterMetadata': 'メタデータをフィルター',
  'workbench.editors.grpc.response.filterTrailers': 'トレーラーをフィルター',
  'workbench.editors.grpc.response.duration': '{ms} ms',
  'workbench.editors.grpc.response.noStatus': 'gRPC ステータスなし',
  'workbench.editors.grpc.response.connectionLost': '接続が失われました',
  'workbench.editors.grpc.response.includeDefaultValues': 'デフォルト値を含める',
  'workbench.editors.grpc.response.noMessage': '応答にレスポンスメッセージは含まれていませんでした。',
  'workbench.editors.grpc.response.noMetadata': 'メタデータなし',
  'workbench.editors.grpc.response.noTrailers': 'トレーラーなし',
  'workbench.editors.grpc.response.trailersOnly':
    'トレーラーのみの応答です。ステータスが初期メタデータとともに届き、メッセージは続きませんでした。',
  'workbench.editors.grpc.response.compressed':
    'レスポンスフレームが圧縮されています。圧縮は交渉されていないため、デコードできません。',
  'workbench.editors.grpc.response.structuralNotice':
    '構造的なデコード（フィールド番号）です。レスポンスの型がリンクされた仕様に対して解決できませんでした。',
  'workbench.editors.grpc.response.rawNotice':
    'メッセージをデコードできませんでした。生のバイトを base64 で表示しています。',
  'workbench.editors.grpc.response.extraFrames':
    '{count} 個のメッセージフレームが届きました。ユナリーの応答は 1 個だけ持つため、最初のものを表示しています。',
  'workbench.editors.grpc.response.incompleteTail':
    'レスポンスはフレームの途中で終わりました。完全なフレームを表示しています。',
  'workbench.editors.grpc.response.truncated': 'レスポンスは {bytes} バイトで上限に達しました。',
  'workbench.editors.grpc.tab.docs': 'Docs',
  'workbench.editors.grpc.tab.message': 'メッセージ',
  'workbench.editors.grpc.tab.metadata': 'Metadata',
  'workbench.editors.grpc.tab.scripts': 'スクリプト',
  'workbench.editors.grpc.tab.settings': '設定',
  'workbench.editors.grpc.messagePlaceholder': 'リクエストメッセージを JSON で',
  'workbench.editors.grpc.example.label': '例のメッセージを使う',
  'workbench.editors.grpc.example.needsMethod': 'まず、リンクされた仕様に対して解決できるメソッドを選んでください',
  'workbench.editors.grpc.metadata.keyPlaceholder': 'キー',
  'workbench.editors.grpc.metadata.valuePlaceholder': '値',
  'workbench.editors.grpc.spec.selectLabel': 'Protobuf 仕様',
  'workbench.editors.grpc.spec.selectPlaceholder': 'Protobuf 仕様をリンク…',
  'workbench.editors.grpc.spec.summary': '{services} 個のサービス · {methods} 個のメソッド',
  'workbench.editors.grpc.spec.parseFailure': '{path}：{message}',
  'workbench.editors.grpc.spec.issue': '{kind}：{reference}',
  'workbench.editors.grpc.spec.importReadFailed': 'ファイルの読み取りに失敗しました：{message}',
  'workbench.editors.grpc.spec.importFailed': '.proto ファイルのインポートに失敗しました',
  'workbench.editors.grpc.method.usingSpec': '{name} を使用中',
  'workbench.editors.grpc.method.refreshSpec': '仕様の現在のファイルから再構築',
  'workbench.editors.grpc.settings.exampleCaption': '呼び出しの例',
  'workbench.editors.grpc.settings.group.connection': '接続',
  'workbench.editors.grpc.settings.group.tls': 'TLS と信頼',
  'workbench.editors.grpc.settings.group.messages': 'メッセージ',
  'workbench.editors.grpc.settings.groupInfo.connection':
    '呼び出しがサーバーに到達する方法です。チャネルのダイヤル先、呼び出しの宛先となる名前、呼び出し全体の上限、そして呼び出し中に切れた接続を捉えるキープアライブ。',
  'workbench.editors.grpc.settings.groupInfo.tls':
    'TLS チャネルが信頼を確立する方法です。サーバー証明書をシステムのルートで検証するか、このデバイスが提示するクライアント証明書、ハンドシェイクの TLS バージョン範囲と暗号リスト、そして提示する SNI 名。',
  'workbench.editors.grpc.settings.groupInfo.messages':
    '解析できないメッセージをワークベンチがどう扱うかです。API リクエストの設定と共有するアプリ全体の姿勢であり、リクエストごとのフィールドではありません。',
  'workbench.editors.grpc.settings.unixSocketLabel': 'Unix ソケット',
  'workbench.editors.grpc.settings.unixSocketHelp':
    'TCP 接続を開く代わりに、このローカルソケット（絶対パスの Unix ソケット、または \\\\.\\pipe\\name のような Windows の名前付きパイプ）にダイヤルします。:authority ヘッダー、TLS サーバー名、証明書の検証は引き続き対象が決めます。変わるのは接続の行き先だけです。通常の TCP 接続にするには空のままにしてください。',
  'workbench.editors.grpc.settings.unixSocketPlaceholder': 'TCP 接続（デフォルト）',
  'workbench.editors.grpc.settings.timeoutLabel': '呼び出しのタイムアウト',
  'workbench.editors.grpc.settings.timeoutHelp':
    '呼び出し全体の実時間の上限です。gRPC のデッドラインとして送られ、サーバーが強制できるほか、ローカルでも強制されます。空にするとデッドラインはありません。',
  'workbench.editors.grpc.settings.timeoutPlaceholder': '制限なし（デフォルト）',
  'workbench.editors.grpc.settings.authorityLabel': 'Authority',
  'workbench.editors.grpc.settings.authorityHelp':
    'ワイヤー上で呼び出しの宛先となる :authority です。サーバーがルーティングに使う名前で、接続自体は引き続き対象に向かいます。authority でルーティングするゲートウェイや、IP で到達するが自身の名前を期待するサーバー向けです。TLS サーバー名と証明書の検証は対象のホストを保ちます。それを変えるのは SNI サーバー名の設定です。空にすると対象そのものを送ります。',
  'workbench.editors.grpc.settings.authorityPlaceholder': '対象（デフォルト）',
  'workbench.editors.grpc.settings.keepaliveIntervalLabel': 'キープアライブ ping',
  'workbench.editors.grpc.settings.keepaliveIntervalHelp':
    '呼び出しが開いている間、この間隔で HTTP/2 PING を送ります。静かなサーバーストリームや遅いユナリー呼び出しが、デッドラインを待たずに切れた接続を知るためです。各接続は 1 つの呼び出しを担うため、呼び出しの合間に生かしておくものはありません。サーバーは下限（デフォルトではデータが流れない状態で 5 分）より速く届く ping を拒否し、too_many_pings で接続を閉じます。その場合、呼び出しがそれを示します。ping を送らないには空のままにしてください。',
  'workbench.editors.grpc.settings.keepaliveIntervalPlaceholder': 'ping なし（デフォルト）',
  'workbench.editors.grpc.settings.keepaliveTimeoutLabel': 'キープアライブのタイムアウト',
  'workbench.editors.grpc.settings.keepaliveTimeoutHelp':
    'ping の応答を待つ時間です。これを過ぎると接続は切れたとみなされ、呼び出しはそれを示して終了します。デフォルトの 20 s にするには空のままにしてください。',
  'workbench.editors.grpc.settings.keepaliveTimeoutPlaceholder': '20 s（デフォルト）',
  'workbench.editors.grpc.settings.sendInvalidMessageLabel': '無効なメッセージを送信',
  'workbench.editors.grpc.settings.sendInvalidMessageHelp':
    'メッセージが有効な JSON でない場合でも、空のメッセージで呼び出してサーバーに応答させます。通常は INVALID_ARGUMENT です。デフォルトはオフで、呼び出しはワイヤーに出る前に正確な解析エラーで失敗します。すべての gRPC リクエストに適用されます。',
  'workbench.editors.grpc.tab.auth': '認可',
  'workbench.editors.grpc.auth.help':
    '呼び出しの authorization: Bearer <token> メタデータとして送られます。明示的な authorization メタデータ行が優先されます。',
  'workbench.editors.grpc.auth.inheritUnsupported': '{type}（{source} から）は gRPC の呼び出しには適用できません。',
  'workbench.editors.grpc.auth.helpOwn':
    '呼び出しごとに 1 回発行され、呼び出しの authorization（またはキー自身の名前）メタデータとして送られます。クエリ配置は gRPC の呼び出しには乗りません。同じ名前の明示的なメタデータ行が優先されます。',
  'workbench.editors.grpc.auth.ownUnsupported': '{type} は gRPC の呼び出しには適用できません。',
  'workbench.editors.grpc.invoke.connectCompanion':
    '呼び出すにはデスクトップアプリを接続してください。作成と保存はここでできます。',
  // ── gRPC streaming pane + message timeline ──────────────────────────
  'workbench.editors.grpc.stream.streamingBadge': 'Streaming',
  'workbench.editors.grpc.stream.stoppedBadge': '停止',
  'workbench.editors.grpc.stream.tab.timeline': 'タイムライン',
  'workbench.editors.grpc.stream.trailersPending': 'トレーラーは呼び出しの完了時に届きます。',
  'workbench.editors.grpc.stream.sendMessage': 'メッセージを送信',
  'workbench.editors.grpc.stream.endStreaming': 'ストリーミングを終了',
  'workbench.editors.grpc.stream.controlsIdle': 'まず呼び出しを実行してストリームを開いてください',
  'workbench.editors.grpc.stream.sendFailed': 'メッセージを送信できませんでした',
  'workbench.editors.grpc.timeline.requestSent': 'リクエストを送信',
  'workbench.editors.grpc.timeline.noMetadataSent': 'メタデータは送信されていません。',
  // {metadata} marks where the linked word (receivedMetadataLink)
  // renders — the display splits on it, so word order stays free.
  'workbench.editors.grpc.timeline.receivedMetadata': '{metadata}を受信しました。',
  'workbench.editors.grpc.timeline.receivedMetadataLink': 'メタデータ',
  'workbench.editors.grpc.timeline.noMetadataReceived': 'メタデータは受信していません。',
  'workbench.editors.grpc.timeline.responseReceived': 'レスポンスを受信',
  'workbench.editors.grpc.timeline.completed': '呼び出しが完了',
  'workbench.editors.grpc.timeline.stopped': '呼び出しを停止',
  'workbench.editors.grpc.timeline.failed': '呼び出しに失敗',
  'workbench.editors.grpc.timeline.lost': '接続が失われました',
  'workbench.editors.grpc.timeline.noMatches': '一致するメッセージはありません。',
  'workbench.editors.grpc.timeline.searchMessages': 'メッセージを検索',
  'workbench.editors.grpc.timeline.filterAll': 'すべて',
  'workbench.editors.grpc.timeline.filterSent': '送信',
  'workbench.editors.grpc.timeline.filterReceived': '受信',
  'workbench.editors.grpc.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のメッセージ' }),
  'workbench.editors.grpc.timeline.sortOrder': '並べ替えとグループ化',
  'workbench.editors.grpc.timeline.newestFirst': '新しい順',
  'workbench.editors.grpc.timeline.oldestFirst': '古い順',
  'workbench.editors.grpc.timeline.showTypes': 'メッセージの型を表示',
  'workbench.editors.grpc.timeline.groupByType': 'メッセージの型でグループ化',
  'workbench.editors.grpc.timeline.groupByDirection': '方向でグループ化',
  'workbench.editors.grpc.timeline.rowsPerGroup': 'グループごとの行数',
  'workbench.editors.grpc.timeline.noLimit': '制限なし',
  'workbench.editors.grpc.timeline.clearMessages': 'メッセージをクリア（表示のみ）',
  'workbench.editors.grpc.timeline.trustCertificate': '証明書を信頼',
  'workbench.editors.grpc.timeline.newMessages': '新しいメッセージ',
  'workbench.editors.grpc.timeline.sentAria': '送信メッセージ',
  'workbench.editors.grpc.timeline.receivedAria': '受信メッセージ',
  'workbench.editors.grpc.timeline.script': '{hook} — {levels}',
  'workbench.editors.grpc.timeline.scriptFailed': '{hook} が失敗 — {error}',
  // ── The call's scripts — the result panes' Scripts tab and tag ──────
  'workbench.editors.grpc.response.tab.scripts': 'スクリプト',
  'workbench.editors.grpc.scripts.empty': 'この呼び出しではスクリプトは実行されていません。',
  'workbench.editors.grpc.scripts.console': 'コンソール',
  'workbench.editors.grpc.scripts.tests': 'Tests',
  'workbench.editors.grpc.scripts.consoleEmpty': 'ログはありません。',
  'workbench.editors.grpc.scripts.testsEmpty': 'アサーションは登録されていません。',
  'workbench.editors.grpc.scripts.attempt': '試行 {attempt}',
  'workbench.editors.grpc.scripts.atMessage': 'メッセージ {index}',
  'workbench.editors.grpc.scripts.tag': 'スクリプト · {count}',
  'workbench.editors.grpc.scripts.tagTitle': '呼び出しのスクリプト',
  'workbench.editors.grpc.scripts.tagSummary': 'この呼び出しで実行されたフックと、寄与したレベルです。',
  'workbench.editors.grpc.scripts.tagSummaryFailed': 'フックが失敗しました。最後のエラーがその下に表示されます。',
  'workbench.editors.grpc.scripts.runs': '{count} 回実行',
  'workbench.editors.grpc.scripts.runsOne': '1 回実行',
  'workbench.editors.grpc.scripts.failed': '{count} 件失敗',
  'workbench.editors.grpc.scripts.dropped': '{count} 件破棄',
  'workbench.editors.grpc.scripts.marksCapped':
    'メッセージごとの詳細は {count} 回の実行で停止しました。フックは動き続け、呼び出しが落ち着くと完全な件数が届きます。',
  'workbench.editors.grpc.toast.deletedOtherTab': 'gRPC リクエストが別のタブから削除されました',
  'workbench.editors.grpc.toast.updateFailed': 'gRPC リクエストの更新に失敗しました',
  'workbench.editors.grpc.toast.updateFailedDetail': 'gRPC リクエストの更新に失敗しました：{message}',
  'workbench.editors.grpc.response.saveResponse': 'レスポンスを保存',
  'workbench.editors.grpc.toast.savedExample': '例「{name}」を保存しました',
  'workbench.editors.grpc.toast.saveExampleFailed': '例の保存に失敗しました',
  'workbench.editors.grpc.toast.saveExampleFailedDetail': '例の保存に失敗しました：{message}',
  'workbench.editors.grpcExample.loading': '例を読み込んでいます…',
  'workbench.editors.grpcExample.notFound': '例が見つかりません。',
  'workbench.editors.grpcExample.toast.deletedOtherTab': '例が別のタブから削除されました',
  'workbench.editors.grpcExample.toast.saveFailed': '例の保存に失敗しました',
  'workbench.editors.grpcExample.toast.saveFailedDetail': '例の保存に失敗しました：{message}',
  'workbench.editors.grpcExample.openInRequest': 'リクエストで開く',
  'workbench.editors.grpcExample.openInRequestTooltip':
    'この例でキャプチャした呼び出しを、親の gRPC リクエストのエディターに未保存の編集としてコピーします',
  'workbench.editors.grpcExample.noMethod': 'メソッドが記録されていません',
  'workbench.editors.grpcExample.capturedTooltip': '{date} にキャプチャ',
  'workbench.editors.grpcExample.result.title': 'キャプチャしたレスポンス',
} as const satisfies Catalog;
