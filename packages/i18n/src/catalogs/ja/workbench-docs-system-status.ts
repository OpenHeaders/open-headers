/**
 * Workbench Docs panel — the System Status section body — Japanese.
 * Mirrors `catalogs/en/workbench-docs-system-status.ts` key for key.
 * Subsystem wire literals, state tokens, and the popover status
 * messages the doc quotes (Connected to desktop, N workflows fresh, …)
 * ride RAW — untranslated wire output, same class as the quoted
 * browser phrasing law (de/es parity). Subsystem display names copy
 * the shipped `ja/shared-chrome.ts` labels（同期、ルール、リクエスト、
 * 権限、シークレット、Live、システムステータス）. ピル = pill
 * (debug-mode docs mint); ワークベンチ = Workbench in prose; ウェイク =
 * service-worker wake; クォータ = quota. MINTS: 送信 = the Send button
 * (editors-request ja must reuse); settings path アプリケーション ›
 * データ › 診断ログをエクスポート (the ja settings files reuse); ドリフト
 * = schema drift. Sandwich fragments restructure SOV.
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': 'システムステータス',
  'workbench.docs.body.systemStatus.intro1':
    'は拡張機能の健全性のライブスナップショットです。ワークベンチのフッターはこれを 6 個のピルの行として表示します。サブシステムごとに 1 個、それぞれに色付きのドットが付きます。ポップアップとサイドパネルは、下部のフッターの単一の',
  'workbench.docs.body.systemStatus.intro1Suffix':
    'エントリにまとめ、ドットの色は最も悪い状態のサブシステムを追います。',
  'workbench.docs.body.systemStatus.workbenchCaption':
    'ワークベンチでは、この行はフッターにあり、サブシステムごとに 1 個のピルがあります。',
  'workbench.docs.body.systemStatus.popupCaption':
    'ツールバーのアイコンをクリックすると、同じステータスがポップアップのフッターにラベル付きの単一のピルとして現れます。',
  'workbench.docs.body.systemStatus.worstLevel1':
    '各サブシステムは 1 つの状態を報告し、最も悪いレベルが勝ちます：赤 > 黄 > 緑。どこかに赤が 1 つあれば、複合ドットは赤になります。',
  'workbench.docs.body.systemStatus.worstLevelCaption':
    '6 つのサブシステムの状態は max で 1 つの複合状態に畳まれます。赤は黄に、黄は緑に勝ちます。',
  'workbench.docs.body.systemStatus.popover1':
    'どのピルをクリックしても同じ詳細ポップオーバーが開きます。行は 2 つのグループに分かれます。先に灰色（このサービスワーカーの生存期間中まだイベントなし）、後に色付き（少なくとも一度は報告済み）。各グループ内では標準のサブシステム順が保たれます。完全な履歴は可観測性ログにあります。エクスポート元：',
  'workbench.docs.body.systemStatus.settingsExportPath': 'アプリケーション › データ › 診断ログをエクスポート',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    '区切り線の上に灰色、下に色付き。最初の報告で行は一度だけ移動します。',
  'workbench.docs.body.systemStatus.stateGreenLabel': '緑',
  'workbench.docs.body.systemStatus.stateYellowLabel': '黄',
  'workbench.docs.body.systemStatus.stateRedLabel': '赤',
  'workbench.docs.body.systemStatus.syncName': '同期',
  'workbench.docs.body.systemStatus.syncSubtitle': 'デスクトップアプリの接続',
  'workbench.docs.body.systemStatus.sync1Prefix':
    '拡張機能のサービスワーカーと、あなたのマシンで動作する OpenHeaders デスクトップアプリの間の WebSocket 接続を反映します。リンクはループバックのみ（',
  'workbench.docs.body.systemStatus.sync1Suffix':
    '）で、動的変数、チームワークスペースのデータ、プレゼンスを運びます。何もデバイスから出ません。',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    'localhost 上の拡張機能とデスクトップアプリの間の単一の WebSocket。',
  'workbench.docs.body.systemStatus.sync2':
    'ピルはライブの接続状態を反映します。切断は指数バックオフの再接続を引き起こし、定期的な ping が厳格な企業プロキシの背後でのサイレントな切断を検出します。',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Disabled と Connected は緑、Connecting、Reconnecting、URL rejected は黄。',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Connected to desktop',
  'workbench.docs.body.systemStatus.syncGreenMiddle': '（ハンドシェイク成功）または',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Desktop sync disabled',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '（自動接続オフ）。',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Connecting…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconnecting (attempt N)',
  'workbench.docs.body.systemStatus.syncYellowOr': '、または',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'Desktop URL rejected by settings',
  'workbench.docs.body.systemStatus.syncYellowSuffix': '.',
  'workbench.docs.body.systemStatus.syncRed':
    'デスクトップ同期の致命的な失敗のために予約されています。現在これを発するコードパスはありません。',
  'workbench.docs.body.systemStatus.rulesName': 'ルール',
  'workbench.docs.body.systemStatus.rulesSubtitle': 'declarativeNetRequest エンジン',
  'workbench.docs.body.systemStatus.rules1Prefix':
    'DNR の再構築のたびに報告します。すべての保存は、ルールが有効になる前に 4 つの段階を通ります。DNR JSON へのコンパイル、',
  'workbench.docs.body.systemStatus.rules1Middle': '参照の解決、アクティブルール上限の適用、そして Chrome の',
  'workbench.docs.body.systemStatus.rules1Suffix': 'API による適用。各段階がピルを変えることがあります。',
  'workbench.docs.body.systemStatus.rulesPipelineCaption':
    '4 つの段階。それぞれが横道に逸れるとステータスのレベルを発します。',
  'workbench.docs.body.systemStatus.rules2':
    'アクティブなルール数は 3 つのゾーンを持つ容量バー上の状態に対応します。上限を超えたルールは一致順（上が勝ち）で破棄され、黄色のメッセージが破棄数を伝えます。',
  'workbench.docs.body.systemStatus.rulesCapacityCaption':
    '警告しきい値までは緑、上限までは黄、それ以上は赤。ただし切り詰めにより、実行時には赤のゾーンに入りません。',
  'workbench.docs.body.systemStatus.rulesGreenActive': 'N active DNR rule(s)',
  'workbench.docs.body.systemStatus.rulesGreenOr': 'または',
  'workbench.docs.body.systemStatus.rulesGreenPaused': 'Rule execution paused',
  'workbench.docs.body.systemStatus.rulesGreenSuffix': '.',
  'workbench.docs.body.systemStatus.rulesYellowPrefix': '未解決の',
  'workbench.docs.body.systemStatus.rulesYellowRefs': '参照（',
  'workbench.docs.body.systemStatus.rulesYellowMsgUnresolved': 'N unresolved variables in M rules',
  'workbench.docs.body.systemStatus.rulesYellowMiddle': '）、ルール上限の超過（',
  'workbench.docs.body.systemStatus.rulesYellowMsgDropped': 'Dropped N rules over cap',
  'workbench.docs.body.systemStatus.rulesYellowMiddle2': '）、または DNR 容量への接近（',
  'workbench.docs.body.systemStatus.rulesYellowMsgCapacity': 'Approaching DNR capacity (N ≥ threshold)',
  'workbench.docs.body.systemStatus.rulesYellowSuffix': ').',
  'workbench.docs.body.systemStatus.rulesRedPrefix':
    'トランスポートの失敗。Chrome が動的またはセッションのルール更新を拒否しました（',
  'workbench.docs.body.systemStatus.rulesRedMsg': 'Failed to apply [dynamic|session] DNR rules',
  'workbench.docs.body.systemStatus.rulesRedSuffix': ').',
  'workbench.docs.body.systemStatus.requestsName': 'リクエスト',
  'workbench.docs.body.systemStatus.requestsSubtitle': 'API リクエストのエグゼキューター',
  'workbench.docs.body.systemStatus.requests1Prefix':
    '最後に発したアドホックな API リクエストを反映します。発火元はリクエストエディターの',
  'workbench.docs.body.systemStatus.requestsSend': '送信',
  'workbench.docs.body.systemStatus.requests1Middle': 'ボタンです。ピルは',
  'workbench.docs.body.systemStatus.requestsAny': 'あらゆる',
  'workbench.docs.body.systemStatus.requests1Suffix':
    'HTTP レスポンス（4xx や 5xx を含む）で緑になります。「リクエストが完了した」ことと「サーバーが気に入った」ことは別の問いだからです。レスポンスのないネットワークレベルの失敗だけが黄にします。',
  'workbench.docs.body.systemStatus.requestsOutcomesCaption':
    'どのステータスコードでも緑。黄はレスポンスが返らない失敗のために予約されています。',
  'workbench.docs.body.systemStatus.requests2Prefix':
    'バックグラウンドのトラフィックはこのピルを更新しません。ライブワークフローの更新は',
  'workbench.docs.body.systemStatus.requests2Suffix':
    'を通り、Web ページのリクエストはエグゼキューターではなくルールエンジンを流れます。',
  'workbench.docs.body.systemStatus.requestsScopeCaption':
    'アドホックな送信ボタンのトラフィックだけがこのピルを形作り、それ以外は静かなままです。',
  'workbench.docs.body.systemStatus.requestsGreenLabel': 'Last request:',
  'workbench.docs.body.systemStatus.requestsGreenMiddle': '：あらゆる HTTP レスポンス（例：',
  'workbench.docs.body.systemStatus.requestsGreenSuffix': ').',
  'workbench.docs.body.systemStatus.requestsYellowLabel': 'Last request failed:',
  'workbench.docs.body.systemStatus.requestsYellowMiddle': '：レスポンス前のネットワークレベルの失敗（例：',
  'workbench.docs.body.systemStatus.requestsYellowSuffix': '、オフライン / DNS）。',
  'workbench.docs.body.systemStatus.permissionsName': '権限',
  'workbench.docs.body.systemStatus.permissionsSubtitle': 'ホスト権限の監査',
  'workbench.docs.body.systemStatus.permissions1Prefix': 'ホスト権限が',
  'workbench.docs.body.systemStatus.permissions1Middle':
    'から取り消されたホストを対象とする DNR ルールとコンテンツスクリプトはエラーにならず、サイレントに何もしません。この監査の役割はその隠れた状態を表に出すことです。さもないと、',
  'workbench.docs.body.systemStatus.permissionsLooks': '見た目には',
  'workbench.docs.body.systemStatus.permissions1Suffix': '正しいルールのデバッグに 30 分を費やすことになります。',
  'workbench.docs.body.systemStatus.permissionsImpactCaption':
    '付与済み：ルールが発火します。縮小済み：ルールはサイレントに何もせず、ヘッダーは決して届きません。',
  'workbench.docs.body.systemStatus.permissions2Prefix': '監査はサービスワーカーのウェイクごとに',
  'workbench.docs.body.systemStatus.permissions2Suffix':
    'をポーリングします。Chromium の MV3 には権限変更のオブザーバーがないため、ウェイク時のポーリングが得られる最も安価なシグナルです。',
  'workbench.docs.body.systemStatus.permissionsAuditCaption':
    '1 回の呼び出しに 3 つの分岐。付与済みなら緑、縮小済みなら赤、API 呼び出しそのものが失敗すれば黄。',
  'workbench.docs.body.systemStatus.permissionsGreenLabel': 'All host permissions granted',
  'workbench.docs.body.systemStatus.permissionsGreenSuffix': 'は引き続きスコープ内です。',
  'workbench.docs.body.systemStatus.permissionsYellowLabel': 'Could not audit host permissions',
  'workbench.docs.body.systemStatus.permissionsYellowMiddle': '：異常です。ブラウザーが次を公開しませんでした：',
  'workbench.docs.body.systemStatus.permissionsYellowSuffix': '.',
  'workbench.docs.body.systemStatus.permissionsRedLabel': 'Host permissions narrowed',
  'workbench.docs.body.systemStatus.permissionsRedMiddle':
    '：取り消されたホストでは、アクセスが復元されるまで一部のルールがサイレントに何もしません。復元元：',
  'workbench.docs.body.systemStatus.permissionsRedSuffix': '.',
  'workbench.docs.body.systemStatus.secretsName': 'シークレット',
  'workbench.docs.body.systemStatus.secretsSubtitle': 'Vault の整合性',
  'workbench.docs.body.systemStatus.secrets1Prefix':
    'ワークスペースごとの暗号化された vault の blob を追跡します。保存先は',
  'workbench.docs.body.systemStatus.secrets1Suffix':
    'です。サービスワーカーのウェイクごとに、保存された各シークレットが現在のスキーマに対して検証されます。検証に失敗したエントリはメモリ上の vault から破棄され、再保存されるまでピルは黄になります。',
  'workbench.docs.body.systemStatus.vaultHydrationCaption':
    'ハイドレートが blob を読み込み、スキーマバリデーターが一致するものを保持し、ドリフトを破棄し、黄を報告します。',
  'workbench.docs.body.systemStatus.secrets2':
    '「ドリフト」は通常、保存されたエントリが古いビルドで書かれたことを意味します（現在は必須のフィールドが欠けている、またはフィールドの型が誤っている）。バリデーターの役割は大きな音で失敗することです。未知の形をサイレントに引き継ぐことが、6 バージョン後のバグの原因になります。',
  'workbench.docs.body.systemStatus.vaultDriftCaption':
    '同じ 2 つのフィールドを並べて：有効なエントリと、cipher が欠け createdAt の型が誤ったドリフトエントリ。',
  'workbench.docs.body.systemStatus.secretsGreen':
    'デフォルト。このサービスワーカーの生存期間中、スキーマドリフトのイベントはありません。',
  'workbench.docs.body.systemStatus.secretsYellowLabel': 'Schema drift: dropped entry from',
  'workbench.docs.body.systemStatus.secretsYellowMiddle':
    '：保存された vault エントリの少なくとも 1 つが現在の形と一致せず、ハイドレート時に破棄されました。Vault エディターから再保存すると復元されます。',
  'workbench.docs.body.systemStatus.secretsRed':
    '暗号の復号失敗のために予約されています。現在これを発するコードパスはありません。',
  'workbench.docs.body.systemStatus.liveName': 'Live',
  'workbench.docs.body.systemStatus.liveSubtitle': 'ライブ変数ワークフローの更新',
  'workbench.docs.body.systemStatus.live1Prefix':
    '各ライブワークフローは独自の周期で更新されます。ワークフローごとの状態は 3 つの検査で決まります。最後の抽出器が成功したか、実行が',
  'workbench.docs.body.systemStatus.live1Suffix':
    'その周期の範囲内か、そして連続で何回失敗したか。3 つの状態は「最も悪いものが勝つ」でピルに畳まれます。',
  'workbench.docs.body.systemStatus.liveFreshnessCaption':
    '新鮮 = クリーンな実行 · 古い = 周期の 2 倍超過または 1–4 回の失敗 · 失敗中 = 5 回以上の連続失敗。',
  'workbench.docs.body.systemStatus.live2Prefix': '寄与するのは',
  'workbench.docs.body.systemStatus.liveActiveWorkspace': 'アクティブなワークスペース',
  'workbench.docs.body.systemStatus.live2Suffix':
    'のワークフローだけです。非アクティブなワークスペースは除外されます。今はそれらのルールを見ることも操作することもできないため、ピルに載せても手の届かないノイズになるだけです。ワークスペースを切り替えると、新しいアクティブな集合に対してピルが再計算されます。',
  'workbench.docs.body.systemStatus.liveAggregationCaption':
    'アクティブなワークスペースのワークフローは max() で 1 つのピルに畳まれ、他のワークスペースはスキップされます。',
  'workbench.docs.body.systemStatus.liveGreenLabel': 'N workflows fresh',
  'workbench.docs.body.systemStatus.liveGreenMiddle':
    '：アクティブなワークスペースのすべてのワークフローの最後の実行が OK で、周期の 2 倍以内でした。何もないときは',
  'workbench.docs.body.systemStatus.liveGreenNone': 'No workflows configured',
  'workbench.docs.body.systemStatus.liveGreenSuffix': 'と表示されます。',
  'workbench.docs.body.systemStatus.liveYellowLabel': 'N workflows stale or failing',
  'workbench.docs.body.systemStatus.liveYellowMiddle':
    '：少なくとも 1 つの実行が周期の 2 倍を超えたか、最後の抽出器が失敗したか、1–4 回の連続失敗があります。',
  'workbench.docs.body.systemStatus.liveRedLabel': 'N workflows failing (5+ consecutive)',
  'workbench.docs.body.systemStatus.liveRedMiddle':
    '：いずれかのワークフローが 5 回の連続失敗を越え、失敗中とみなされています。',
  'workbench.docs.body.systemStatus.desktopNoteTitle': 'デスクトップアプリ：製品ノート',
  'workbench.docs.body.systemStatus.desktopNote1':
    'デスクトップアプリは開発中で、拡張機能が安定した後に出荷されます。デスクトップアプリと統合するワークスペース、変数、チーム同期はそのときに解放されます。',
  'workbench.docs.body.systemStatus.desktopNote2':
    'サブシステムは初回起動時に自動的に無効から接続中へ切り替わります。再インストールは不要です。',
} as const satisfies Catalog;
