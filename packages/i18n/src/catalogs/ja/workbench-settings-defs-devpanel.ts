/**
 * Workbench settings — the setting-definition corpus for the DevTools
 * panel categories — Japanese. Mirrors
 * `catalogs/en/workbench-settings-defs-devpanel.ts` key for key.
 * Parity vocabulary rides raw per the S34 lock: column names
 * (Waterfall, Name, Time, …), waterfall metric names (Start time,
 * Total duration, …), tool-window and detail-tab names (Network,
 * Storage, Console, Headers, Cookies, Messages, EventStream),
 * milestone names (Finish / DCL / DOMContentLoaded / Load),
 * Train-Case, `A → Z`, header names, and every wire token. Option
 * labels quote the shipped ja panel menus verbatim（失敗を先頭に /
 * 最も遅いものを先頭に / 最も大きいものを先頭に / ブラウザーの優先度 /
 * リソース種別順 / ドメイン順 / ルールで変更されたものを先頭に / 昇順 /
 * 降順 / コンパクト / ワイド / グループ化 / フラット / 元の順序 /
 * 元のまま / 相対 / 絶対 / 常に / ホバー時 / タイムスタンプ / ローカル /
 * タグを表示 / 提案を表示 / ルール発火ドットを表示 / カスタム（ネスト）+
 * the timing view rows）. MINTS: ステータスバー = the panel status bar
 * (footer); トップバー = top bar; 範囲 carries the footer scope sense
 * (スコープ stays variable/cookie scope, S19 law); フォーカス中のツール
 * = Focused tool.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsDevpanel = {
  // ── DevTools Panel · Layout category defs ──────────────────────────
  'workbench.settings.def.devpanelLayout.footerShowVersion.label': 'バージョンを表示',
  'workbench.settings.def.devpanelLayout.footerShowVersion.description':
    'DevTools パネルのステータスバーに拡張機能のバージョン番号を表示します。',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label': 'テーマ切り替えを表示',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description':
    'DevTools パネルのステータスバーにライト / ダーク / 自動のテーマドロップダウンを表示します。',
  'workbench.settings.def.devpanelLayout.footerShowModified.label': '変更数を表示',
  'workbench.settings.def.devpanelLayout.footerShowModified.description':
    'ルールが実際に変更したリクエストの数を DevTools パネルのステータスバーに表示します。',
  'workbench.settings.def.devpanelLayout.footerShowFailed.label': '失敗数を表示',
  'workbench.settings.def.devpanelLayout.footerShowFailed.description':
    '失敗した、またはエラーステータスを返したリクエストの数を DevTools パネルのステータスバーに表示します。',
  'workbench.settings.def.devpanelLayout.footerShowCached.label': 'キャッシュ数を表示',
  'workbench.settings.def.devpanelLayout.footerShowCached.description':
    'キャッシュから提供されたリクエストの数を DevTools パネルのステータスバーに表示します。',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.label': '現在のページを表示',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.description':
    'DevTools パネルのステータスバーで、タイミングの主要な瞬間にそれが表すページのラベルを付けます。複数のナビゲーションにまたがる「ログを保持」と併用すると便利です。',
  'workbench.settings.def.devpanelLayout.footerTimingMode.label': 'タイミングの範囲',
  'workbench.settings.def.devpanelLayout.footerTimingMode.description':
    'DevTools パネルのステータスバーの Finish / DOMContentLoaded / Load の主要な瞬間がどのナビゲーションを表すかです。「集約」は最初のナビゲーションからのログ保持タイムライン全体にまたがります（ブラウザーと一致）。「現在のページのみ」は最新のナビゲーションだけを報告します。',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label': '集約（すべてのナビゲーション）',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description':
    'Finish / DCL / Load は最初のナビゲーションからのタイムライン全体にまたがります。ブラウザーのデフォルトです。',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label': '現在のページのみ',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description':
    'Finish / DCL / Load は最新のナビゲーションだけを、その開始時点を基準に報告します。',
  'workbench.settings.def.devpanelLayout.footerScope.label': '概要の範囲',
  'workbench.settings.def.devpanelLayout.footerScope.description':
    'DevTools パネルのステータスバーが何を要約するかです。「フォーカス中のツール」は作業中のツールウィンドウに追従します（Storage、Console、検索は独自の要約行を持ちます）。「Network ツールのみ」は常に Network の数値を表示します。',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.label': 'フォーカス中のツール',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.description':
    'フッターはフォーカス中のツールウィンドウに追従します。Storage、Console、検索は独自の要約を表示し、他のツールは Network の行にフォールバックします。',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.label': 'Network ツールのみ',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.description':
    'どのツールウィンドウにフォーカスがあっても、フッターは常に Network の数値を表示します。',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label': 'パネルの切り替えを表示',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description':
    'DevTools パネルのトップバーに左 / 下 / 右パネルの切り替えアイコンを表示します。',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label': 'レイアウトメニューを表示',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description':
    'DevTools パネルのトップバーにレイアウトのドロップダウン（下部の全幅、ツールウィンドウのラベル、サイドバーのレイアウト）を表示します。',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label': '下部パネルの配置',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description':
    'DevTools パネル内で下部パネルが置かれる位置です。左 / 右は片方のサイドバーとエディターの下に揃え、中央は中央の列の中に入れ子にし、両端は全幅にまたがります。',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label': '中央',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description':
    '下部パネルを中央の列の中に入れ子にします',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label': '左',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description':
    '下部は左サイドバーとエディターにまたがります',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label': '右',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description':
    '下部はエディターと右サイドバーにまたがります',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label': '両端',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description':
    '下部は DevTools パネルの全幅にまたがります',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.label': '下部パネルの分割',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.description':
    '開いている 2 つの下部ドックが下部パネルをどう分け合うかです。横に並べるか、上下に重ねるか。',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.label': '左右に並べる',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.description': '下部ドックを横に並べます',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.label': '上下に重ねる',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.description': '下部ドックを上下に重ねます',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.label': 'ツールウィンドウのラベルを表示',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.description':
    'DevTools パネルでアクティビティバーとドックタブのアイコンの横にテキストラベルを描画します。パネルはワークスペースより狭いため、デフォルトでは無効です。',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label': '左アクティビティバーの幅',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description':
    'ツールウィンドウのラベルが表示されているときの、DevTools パネルの左アクティビティバーの幅です。アイコンのみのモードでは 36px に固定されます。',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.label': '右アクティビティバーの幅',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.description':
    'ツールウィンドウのラベルが表示されているときの、DevTools パネルの右アクティビティバーの幅です。アイコンのみのモードでは 36px に固定されます。',
  'workbench.settings.def.devpanelLayout.sidebarLayout.label': 'アクティビティバーのレイアウト',
  'workbench.settings.def.devpanelLayout.sidebarLayout.description':
    'DevTools パネルでアクティビティバーが上下のツールウィンドウグループをどう分けるかです。',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label': '比例',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description':
    '上下のグループがアクティビティバーを 50/50 で分けます',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label': 'コンパクト',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description':
    '上のグループは内容に合わせ、下は下部に固定します',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label': '積み重ね',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description':
    'すべてのグループを区切り線付きで上部にまとめます',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label': '動的',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description':
    'チップのグループは隣接するパネルの高さに追従します。閉じたドックは内容まで縮み、開いている隣が空間を吸収します。',

  // ── DevTools Panel · Network category defs ─────────────────────────
  'workbench.settings.def.devpanelNetwork.layout.label': 'レイアウト',
  'workbench.settings.def.devpanelNetwork.layout.description':
    'Network テーブルが横方向の空間をどう吸収するかです。「コンパクト」は伸縮する列（Name、Waterfall）をパネル幅に合わせて伸ばし、テーブルが横にスクロールしないようにします。「ワイド」はそれらの列に上限を設け、残りは横にスクロールします。',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.label': 'コンパクト',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.description': '伸縮する列がパネル幅を吸収します。',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.label': 'ワイド',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.description':
    '幅に上限を設け、必要に応じて横にスクロールします。',
  'workbench.settings.def.devpanelNetwork.messagesLayout.label': 'Messages のレイアウト',
  'workbench.settings.def.devpanelNetwork.messagesLayout.description':
    'Messages のフレームグリッドが横方向の空間をどう吸収するかです。「コンパクト」は Data 列をペイン幅に合わせて伸ばし、グリッドが横にスクロールしないようにします。「ワイド」は上限を設け、必要に応じて横にスクロールします。',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label': 'コンパクト',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description': 'Data 列がペイン幅を吸収します。',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label': 'ワイド',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description':
    '幅に上限を設け、必要に応じて横にスクロールします。',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.label': 'ペイロードプレビューを表示',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.description':
    'Messages / EventStream グリッドの下にペイロードプレビューのペインを表示します。選択したフレームやイベントが JSON ツリー、生テキスト、またはバイナリビューアーとして描画される、サイズ変更可能な分割です。オフにするとグリッドがペイン全体を使います。',
  'workbench.settings.def.devpanelNetwork.sortKind.label': '並べ替えのソース',
  'workbench.settings.def.devpanelNetwork.sortKind.description':
    '並べ替え状態のどちら側が有効かです。`mode` は名前付きの複合並べ替えモード（失敗を先頭に / 最も遅いものを先頭に / …）のいずれかを実行します。`column` はユーザーが列ヘッダーをクリックして選んだ単一列の並べ替えを実行します。パネルは自動的に切り替えます。列ヘッダーをクリックするとこれは `column` に、表示メニューでモードを選ぶと `mode` になります。',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label': 'モード',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description': '名前付きの複合並べ替えモードを使います。',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.label': '列',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.description':
    'ユーザーがクリックした単一列の並べ替えを使います。',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label': 'カスタム（ネスト）',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description':
    'ユーザーが組み立てた複数キーの並べ替えチェーンを使います。',
  'workbench.settings.def.devpanelNetwork.sortMode.label': '並べ替えモード',
  'workbench.settings.def.devpanelNetwork.sortMode.description':
    '名前付きの複合並べ替え順です。主軸で並べ、同点は到着順で決めます。並べ替えのソースが `mode` のときに有効です。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label': '失敗を先頭に',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description':
    '失敗 → 保留中 → リダイレクト → 成功。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label': '最も遅いものを先頭に',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description': '所要時間が長い順。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label': '最も大きいものを先頭に',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description': 'ワイヤー上のバイト数が大きい順。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label': 'ブラウザーの優先度',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description':
    '報告された優先度の高い順 → 低い順。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label': 'リソース種別順',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description':
    'リソースの種類でグループ化し、グループ内は到着順。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label': 'ドメイン順',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description':
    'ホスト名でグループ化し、グループ内は到着順。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label': 'ルールで変更されたものを先頭に',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description':
    'ルールが適用されたものを先に、グループ内は到着順。',
  'workbench.settings.def.devpanelNetwork.sortBy.label': '並べ替えの列',
  'workbench.settings.def.devpanelNetwork.sortBy.description':
    '列クリックの並べ替えを駆動する列です。並べ替えのソースが `column` のときに有効です。列ヘッダーをクリックするとこの値が更新されます。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label': 'Waterfall',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description':
    '有効な Waterfall 指標（デフォルトは開始時刻）によるタイムライン。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label': 'Request #',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description':
    'リクエスト番号。リクエストが検出された順です。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.label': 'Method',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.description': 'HTTP メソッド。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.label': 'Name',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.description': 'URL の最後のセグメント。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.label': 'Path',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.description': 'パス名とクエリ。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.label': 'URL',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.description': '完全な URL。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.label': 'Status',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.description': 'レスポンスのステータスコード。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label': 'Protocol',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description': 'HTTP バージョン。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label': 'Scheme',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description': 'http / https。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label': 'Domain',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description': 'URL のホスト部分。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label': 'Remote address',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description': 'サーバーの IP。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.label': 'Type',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.description': 'リソースの種類。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label': 'Initiator',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description': 'リクエストを引き起こしたもの。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label': 'Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description': 'リクエスト Cookie の数。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label': 'Set Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description': 'レスポンスの Set-Cookie の数。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.label': 'Size',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.description': 'ワイヤー上のバイト数。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.label': 'Time',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.description': 'リクエストの合計所要時間。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label': 'Priority',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description': 'ブラウザーが割り当てた優先度。',
  'workbench.settings.def.devpanelNetwork.sortDir.label': '並べ替えの方向',
  'workbench.settings.def.devpanelNetwork.sortDir.description': '現在の Network の並べ替え列の昇順または降順です。',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label': '昇順',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description': '小さい順。',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label': '降順',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description': '大きい順。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.label': '指標',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.description':
    'Waterfall 列がどの時刻で並べ替え、描画するかです。Start / Response / End time はバーを絶対タイムラインに置きます。Total duration と Latency はバーをゼロ揃えにし、長さを直接比較できるようにします。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label': 'Start time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description': 'リクエストが開始した時刻。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label': 'Response time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description':
    'レスポンスの最初のバイトが届いた時刻。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label': 'End time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description': 'リクエストが完了した時刻。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label': 'Total duration',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description':
    'リクエストが最初から最後までにかかった時間。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label': 'Latency',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description':
    'レスポンスの最初のバイトまでの時間。',
  'workbench.settings.def.devpanelNetwork.showFireDots.label': 'ルール発火ドットを表示',
  'workbench.settings.def.devpanelNetwork.showFireDots.description':
    'ルールの一致を示す色付きドットを持つ先頭の 14px の列を表示します（塗りつぶし = ルールが実際に適用された、中抜き = 推定）。オフにすると密なペインで横方向のピクセルを取り戻せます。',
  'workbench.settings.def.devpanelNetwork.waterfallValues.label': '値',
  'workbench.settings.def.devpanelNetwork.waterfallValues.description':
    '有効な Waterfall 指標の値をバー上にいつ表示するかです。タイムライン指標では Start / Response / End time のチップ、Total duration と Latency では待機 / ダウンロードのラベルです。',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label': '常に',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description': '値のチップを常に表示します。',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label': 'ホバー時',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description':
    '行にホバーしたときに値のチップを表示します。',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label': 'オフ',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description': '値のチップを隠します。',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label': '値の形式',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description':
    'タイムライン指標の値の読み方です。「相対」は表示中の最初のリクエストからのオフセット、「タイムスタンプ」は絶対的な実時刻です。Total duration と Latency はどちらでも常に所要時間です。',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label': '相対',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description':
    '表示中の最初のリクエストからのオフセット。',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label': 'タイムスタンプ',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description': '絶対的な実時刻。',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label': 'タイムスタンプのタイムゾーン',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description':
    'タイムスタンプの値の形式に使うタイムゾーンです。ローカル時刻または UTC。',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label': 'ローカル',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description':
    'あなたのローカルタイムゾーン。',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label': 'UTC',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description': '協定世界時。',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label': '値を説明',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description':
    'Waterfall のホバーポップオーバーで、合計を構成するフェーズ行にバッジを付けて強調し、その和を式として表示します。純粋に視覚的な補助で、値は変わりません。',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label': 'ポップオーバーのレイアウト',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description':
    'Waterfall のホバーによるタイミング内訳の向きです。「コンパクト」はステップをポップオーバー内に縦に積み、「ワイド」は同じ段階を時間軸上に並べ、「自動」はパネル幅で選びます。下部ドックのパネルではワイド、狭い（サイドドックの）パネルではコンパクトです。',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label': 'コンパクト',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description':
    'ステップをポップオーバー内に縦に積みます。',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label': 'ワイド',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description':
    'ステップを横の時間軸上に並べます。',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label': '自動',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description':
    'パネルが広いときはワイド、それ以外はコンパクト。',

  // ── DevTools Panel · Headers category defs ─────────────────────────
  'workbench.settings.def.devpanelHeaders.layout.label': 'レイアウト',
  'workbench.settings.def.devpanelHeaders.layout.description':
    'Request / Response セクション内でヘッダー行をどう整理するかです。「グループ化」は行をカテゴリ（Auth、CORS、Caching、…）ごとにまとめ、「フラット」は選んだ並び順で 1 つのリストを描画します。',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.label': 'グループ化',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.description': '行をカテゴリごとにまとめます。',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.label': 'フラット',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.description':
    'カテゴリ見出しのない単一のリスト（Chrome 風）。',
  'workbench.settings.def.devpanelHeaders.sortMode.label': '並べ替え',
  'workbench.settings.def.devpanelHeaders.sortMode.description':
    '各リスト内（グループ化時は各グループ内）の行の順序です。「元の順序」はサーバーがヘッダーを送った順（HAR の順）を保ち、A → Z は名前で並べ替え、「ルールで変更されたものを先頭に」はルールで変更された行を上に浮かせます。',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.label': '元の順序',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.description': 'HAR の順。',
  'workbench.settings.def.devpanelHeaders.sortMode.option.az.description': 'アルファベット順。',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label': 'ルールで変更されたものを先頭に',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description': 'ルールで変更された行を上に。',
  'workbench.settings.def.devpanelHeaders.nameCase.label': 'ヘッダー名の大文字小文字',
  'workbench.settings.def.devpanelHeaders.nameCase.description':
    'ヘッダー名の表示方法です。Train-Case はすべての名前を正規化（`Content-Type`、`Set-Cookie`、`ETag`）して Chrome / Firefox の DevTools に合わせ、読みやすくします。「元のまま」はサーバーが送った生の大文字小文字を保ちます（HTTP/2 以降はワイヤー上ですべて小文字になります）。',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.label': '元のまま',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.description':
    'サーバーが送ったそのまま（HTTP/2 以降では多くが小文字）。',
  'workbench.settings.def.devpanelHeaders.showChips.label': '値のタグを表示',
  'workbench.settings.def.devpanelHeaders.showChips.description':
    'ヘッダー行に値ごとのタグ（Cache-Control / Set-Cookie / HSTS / JWT デコード、…）を表示します。オフにすると値だけの引き締まった表示になります。',
  'workbench.settings.def.devpanelHeaders.showInsights.label': '提案を表示',
  'workbench.settings.def.devpanelHeaders.showInsights.description':
    'Headers タブの上部に実行可能な警告カード（CORS の設定ミス、CSP / HSTS の欠落、安全でない Cookie、期限切れの JWT、…）を表示します。',
  'workbench.settings.def.devpanelHeaders.hideNoise.label': 'ノイズヘッダーを隠す',
  'workbench.settings.def.devpanelHeaders.hideNoise.description':
    '情報量の少ないヘッダー（Accept-*、Sec-Fetch-*、Sec-CH-UA-*、User-Agent、Connection、…）を折りたたみます。各セクションの下のヒントにホバーすると隠された名前が一覧されます。',
  'workbench.settings.def.devpanelHeaders.ruleOnly.label': 'ルールで変更されたもののみ',
  'workbench.settings.def.devpanelHeaders.ruleOnly.description':
    'Open Headers のルールによって追加、変更、または削除されたヘッダーだけを表示します。',
  'workbench.settings.def.devpanelHeaders.securityOnly.label': 'セキュリティヘッダーのみ',
  'workbench.settings.def.devpanelHeaders.securityOnly.description':
    'セキュリティ関連のヘッダー（CSP、HSTS、X-Frame-Options、Permissions-Policy、…）だけを表示します。',
  'workbench.settings.def.devpanelHeaders.overridableOnly.label': '上書き可能なヘッダーのみ',
  'workbench.settings.def.devpanelHeaders.overridableOnly.description':
    'ブラウザーがルールによる上書きを許可しない保護されたヘッダー（host、content-length、sec-ch-ua、…）を隠します。',

  // ── DevTools Panel · Initiator category defs ───────────────────────
  'workbench.settings.def.devpanelInitiator.sortMode.label': '子の並べ替え',
  'workbench.settings.def.devpanelInitiator.sortMode.description':
    'イニシエーターチェーン内で子リクエストをどう並べるかです。「イニシエーター順」は元のイニシエーターグラフの走査順を保ち、「時系列」はリクエスト時刻順、「最大のサブツリー」は最も重いサブツリーを先頭にします。',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label': 'イニシエーター順',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description': '検出された順。',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label': '時系列',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description': 'リクエスト時刻順。',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label': '最大のサブツリー',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description': '最も重いサブツリーを先頭に。',
  'workbench.settings.def.devpanelInitiator.showInsights.label': '提案を表示',
  'workbench.settings.def.devpanelInitiator.showInsights.description':
    'Initiator タブの上部に実行可能な注意書き（失敗したサブリクエスト、支配的なホスト、サードパーティの割合、…）を表示します。',
  'workbench.settings.def.devpanelInitiator.failuresOnly.label': '失敗のみ',
  'workbench.settings.def.devpanelInitiator.failuresOnly.description':
    'イニシエーターチェーン内の失敗またはブロックされた行だけを表示します。',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label': 'サードパーティのみ',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description':
    'ページのオリジンと異なるオリジンからの行だけを表示します。',

  // ── DevTools Panel · Cookies category defs ─────────────────────────
  'workbench.settings.def.devpanelCookies.sortMode.label': '並べ替え',
  'workbench.settings.def.devpanelCookies.sortMode.description':
    '各 Cookie セクション内の行の順序です。「元の順序」はサーバー / リクエストが使った順を保ち、A → Z は名前で並べ替え、「サイズ」はシリアライズ後の Cookie サイズで、「有効期限」は失効が近い順（Session は最後）で並べ替えます。',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.label': '元の順序',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.description': '送信 / 設定された順。',
  'workbench.settings.def.devpanelCookies.sortMode.option.az.description': '名前のアルファベット順。',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.label': 'サイズ',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.description': '大きい Cookie を先頭に。',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.label': '有効期限',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.description': '失効が近い順。',
  'workbench.settings.def.devpanelCookies.expiresFormat.label': '有効期限の形式',
  'workbench.settings.def.devpanelCookies.expiresFormat.description':
    'Cookie の有効期限の表示方法です。「相対」は "in 2d"、"30s ago"、"Session" のように、「絶対」は解析した UTC の日付を表示します。',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label': '相対',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label': '絶対',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description': 'UTC の日付。',
  'workbench.settings.def.devpanelCookies.showChips.label': 'タグを表示',
  'workbench.settings.def.devpanelCookies.showChips.description':
    '各 Cookie 名の横に役割 / ライフサイクル / コンテキストのタグ（auth? / tracking? / pref / 設定直後 / 破棄 / サードパーティ / パーティション化 / …）を表示します。オフにすると列だけの引き締まった表示になります。',
  'workbench.settings.def.devpanelCookies.showInsights.label': '提案を表示',
  'workbench.settings.def.devpanelCookies.showInsights.description':
    'Cookies タブの上部に実行可能な警告カード（Secure のない SameSite=None、__Host- / __Secure- プレフィックス違反、大きすぎる Cookie、期限切れなのに送信、…）を表示します。',
  'workbench.settings.def.devpanelCookies.decodeValues.label': 'URL エンコードされた値をデコード',
  'workbench.settings.def.devpanelCookies.decodeValues.description':
    'Cookie の値をパーセントエンコーディングをデコードして表示します（"Europe%2FMadrid" → "Europe/Madrid"）。値にホバーすると生の形が見えます。',
  'workbench.settings.def.devpanelCookies.groupByRole.label': '役割でグループ化',
  'workbench.settings.def.devpanelCookies.groupByRole.description':
    '各セクション内で Cookie を推定された役割でグループ化します。認証とセッションを先頭に、次に機能、設定、アナリティクスと追跡。ヒューリスティックに基づくため、役割のチップ（auth? / tracking? / pref）は注意喚起として疑問符を伴います。',
  'workbench.settings.def.devpanelCookies.showFilteredOut.label': '除外されたリクエスト Cookie を表示',
  'workbench.settings.def.devpanelCookies.showFilteredOut.description':
    'Chrome の “show filtered out request cookies” の切り替えに倣い、パス / Secure / SameSite / 有効期限の不一致のためにこのリクエストで送られなかったジャーの Cookie も一覧します。',
  'workbench.settings.def.devpanelCookies.problemsOnly.label': '問題のあるもののみ',
  'workbench.settings.def.devpanelCookies.problemsOnly.description':
    '警告を引き起こした Cookie（Secure の欠落、プレフィックス違反、期限切れなのに送信、…）だけを表示します。',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.label': 'サードパーティのみ',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.description':
    'ドメインがトップフレームのオリジンに対してクロスサイトである Cookie だけを表示します。',
  'workbench.settings.def.devpanelCookies.ruleOnly.label': 'ルールで変更されたもののみ',
  'workbench.settings.def.devpanelCookies.ruleOnly.description':
    'Cookie / Set-Cookie 行がルールによって追加、変更、または削除された Cookie だけを表示します。',

  // ── DevTools Panel · Timing category defs ──────────────────────────
  'workbench.settings.def.devpanelTiming.showInsights.label': '提案を表示',
  'workbench.settings.def.devpanelTiming.showInsights.description':
    'Timing タブの上部にボトルネックとフェーズごとの警告カードを表示します。オフにすると数値だけの表示になります。',
  'workbench.settings.def.devpanelTiming.showContextStrip.label': 'コンテキストストリップを表示',
  'workbench.settings.def.devpanelTiming.showContextStrip.description':
    'フェーズ内訳の上に、プロトコル / 接続 / キャッシュ / 優先度 / 開始 / サーバー IP のチップ行を表示します。',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.label': 'フェーズの内訳を表示',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.description':
    'Resource Scheduling / Connection Start / Request-Response のセクションを、フェーズごとのミリ秒の行とともに表示します。',
  'workbench.settings.def.devpanelTiming.showTimingBar.label': 'タイミングバーを表示',
  'workbench.settings.def.devpanelTiming.showTimingBar.description':
    'フェーズごとの凡例付きの比例分割バー（とその下の Total 行）を表示します。',
  'workbench.settings.def.devpanelTiming.showServerTiming.label': 'Server-Timing を表示',
  'workbench.settings.def.devpanelTiming.showServerTiming.description':
    'サーバーが送った場合に、解析した `Server-Timing` レスポンスヘッダーの指標を表示します。',
  'workbench.settings.def.devpanelTiming.showRepeats.label': 'セッション内の繰り返しを表示',
  'workbench.settings.def.devpanelTiming.showRepeats.description':
    '現在のパネルセッション内での同じ URL の最速 / 中央値 / 最遅のヒットとの比較を表示します。',
  'workbench.settings.def.devpanelTiming.showTransferRate.label': '転送速度を表示',
  'workbench.settings.def.devpanelTiming.showTransferRate.description':
    'サイズと受信区間の両方が分かる場合に、実効的な Content-Download のスループット（ボディのバイト数 ÷ ダウンロード時間）を表示します。',
} as const satisfies Catalog;
