/**
 * Workbench settings — shell chrome — Japanese. Mirrors
 * `catalogs/en/workbench-settings.ts` key for key. Raw by design:
 * `MCP` / `Shell` as dev loanwords, the DevTools-panel tab names in
 * category labels (Network, Headers, Initiator, Cookies, Timing —
 * panel parity vocabulary), `MIME` / `Hash` / `LAN` / `Multipart`,
 * lowercase `vault` (per-case token law), and the {version} / {when}
 * / {message} / {filename} / {sessionId} / {installId} holes. データ
 * (Data category) matches the settings path quoted by the
 * system-status doc body（アプリケーション › データ › …）. バックエンド
 * = Backend (shared register mint); ワークベンチ = Workbench; シート =
 * seat and ティア = tier; 一般 = General (S79); ルールエンジン = Rules
 * Engine; ターミナル = Terminal. MINTS: 設定項目 = a countable setting
 * (the surface stays 設定); リセット = reset; DevTools パネル = the
 * DevTools panel; レイアウト = Layout nav label; バックアップと同期 =
 * Backup and Sync; ステータスバー = the status bar (footer); トップバー
 * = top bar; 差分ビューアー = Diff Viewer; プロファイル = terminal
 * profile; 使用状況の集計 = usage counting (telemetry).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettings = {
  // ── Shell chrome ───────────────────────────────────────────────────
  'workbench.settings.shell.title': '設定',
  'workbench.settings.shell.openInEditor': 'エディターで開く',
  'workbench.settings.shell.openInEditorSoon': 'エディターで開く（近日対応）',
  'workbench.settings.shell.maximize': '最大化',
  'workbench.settings.shell.restoreWindow': '元に戻す',
  'workbench.settings.shell.hint.search': '検索',
  'workbench.settings.shell.hint.navigate': '移動',
  'workbench.settings.shell.hint.select': '選択',
  'workbench.settings.shell.hint.clearClose': 'クリア / 閉じる',
  'workbench.settings.shell.noneRegistered': '設定が登録されていません。',
  'workbench.settings.shell.resetAll': 'すべてリセット',
  'workbench.settings.shell.resetAllCount': 'すべてリセット（{count}）',
  'workbench.settings.shell.resetAllTitle': 'すべての設定をリセットしますか？',
  'workbench.settings.shell.resetAllNone': 'リセットするものはありません。すべての設定がデフォルトです。',
  'workbench.settings.shell.resetAllDescription': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の設定項目をデフォルト値に戻します。' }),
  'workbench.settings.shell.resetConfirm': 'リセット',
  'workbench.settings.shell.searchResults': '検索結果',
  'workbench.settings.shell.matchesFor': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件が一致：' }),
  'workbench.settings.shell.noMatchesFor': '一致する設定はありません：',
  'workbench.settings.shell.jumpToCategory': 'カテゴリへ移動',
  'workbench.settings.shell.navAria': '設定のカテゴリ',
  'workbench.settings.shell.showCategoryNames': 'カテゴリ名を表示',
  'workbench.settings.shell.otherGroup': 'その他',

  // ── Shared field-row chrome ────────────────────────────────────────
  'workbench.settings.row.modified': 'デフォルトから変更済み',
  'workbench.settings.row.modifiedAria': '変更済み',
  'workbench.settings.row.resetToDefault': 'デフォルトに戻す',
  'workbench.settings.row.experimental': '実験的',
  'workbench.settings.row.desktopBadge': 'デスクトップ',
  'workbench.settings.row.desktopTip':
    'Open Headers デスクトップアプリへのライブ接続が必要です。権威ある値はデスクトップアプリが保持します。',
  'workbench.settings.row.capabilityUnavailable': 'このブラウザーはこの設定に対応していません。',
  'workbench.settings.row.connectionRequired': 'この設定を変更するにはデスクトップアプリを接続してください。',
  'workbench.settings.row.aboutAria': '{label} について',
  'workbench.settings.row.disabledCapabilityAria': '無効：このブラウザーでは利用できません',
  'workbench.settings.row.disabledConnectionAria': '無効：デスクトップ接続が必要です',
  'workbench.settings.row.managed': '組織によって管理されています',
  'workbench.settings.row.managedBadge': '管理対象',
  'workbench.settings.row.disabledManagedAria': '無効：組織によって管理されています',
  'workbench.settings.row.run': '実行',
  'workbench.settings.row.presetsHeading': 'プリセット',

  // ── Categories ─────────────────────────────────────────────────────
  'workbench.settings.category.backend.label': 'バックアップと同期',
  'workbench.settings.category.backend.description':
    'ワークスペースのバックアップと同期の場所。このコンピューターのデスクトップアプリ、またはあなたやチームが運用するサーバー。',
  'workbench.settings.category.backendConnections.label': '同期',
  'workbench.settings.category.backendConnections.description': 'ワークスペースの同期先と、そこへのサインイン方法。',
  'workbench.settings.category.backendServer.label': 'あなたのデバイス',
  'workbench.settings.category.backendServer.description':
    '他のデバイスにこのコンピューターとの同期を許可し、ペアリング済みのデバイスを確認します。',
  'workbench.settings.category.backendServer.sub.network': 'ネットワーク',
  'workbench.settings.category.backendServer.sub.peer-requests': 'ピアからのリクエスト',
  'workbench.settings.category.backendServer.sub.devices': 'デバイス',
  'workbench.settings.category.backendPairing.label': 'デスクトップアプリ',
  'workbench.settings.category.backendPairing.description':
    'このブラウザーがこのコンピューターのデスクトップアプリに接続する方法と、アプリが閲覧できるもの。',
  'workbench.settings.category.backendPairing.sub.automatic': '自動',
  'workbench.settings.category.backendPairing.sub.policy': 'ポリシー',
  'workbench.settings.category.backendPairing.sub.sharing': '共有',
  'workbench.settings.category.backendReliability.label': '詳細',
  'workbench.settings.category.backendReliability.description':
    'すべての同期接続の再接続、ステータス、オフラインフォールバック。',
  'workbench.settings.category.backendReliability.sub.reconnection': '再接続',
  'workbench.settings.category.backendReliability.sub.status': 'ステータス',
  'workbench.settings.category.backendReliability.sub.offline-fallback': 'オフラインフォールバック',
  'workbench.settings.category.mcp.label': 'AI · MCP サーバー',
  'workbench.settings.category.mcp.description':
    'AI エージェントや他の MCP クライアントにこのアプリの読み取りと制御を許可します。アクセスは段階的で、読み取り、書き込み、実行、シークレットの開示は別々のスイッチです。デフォルトではすべてオフです。',
  'workbench.settings.category.mcpAccess.label': 'アクセス',
  'workbench.settings.category.mcpAccess.description':
    'サーバーをオンにし、接続したエージェントに何を許可するかを選びます。すべての段階がデフォルトでオフです。',
  'workbench.settings.category.mcpAccess.sub.server': 'サーバー',
  'workbench.settings.category.mcpAccess.sub.permissions': '権限',
  'workbench.settings.category.mcpClients.label': 'クライアント',
  'workbench.settings.category.mcpClients.description': 'oh CLI と MCP クライアントをこのアプリに接続します。',
  'workbench.settings.category.mcpClients.sub.command-line': 'コマンドライン',
  'workbench.settings.category.mcpClients.sub.configuration': '構成',
  'workbench.settings.category.appearanceBehavior.label': '外観と動作',
  'workbench.settings.category.appearanceBehavior.description':
    'アプリの見た目と動作。ロケール、テーマ、ワークベンチのシェル。',
  'workbench.settings.category.general.label': '一般',
  'workbench.settings.category.general.description': 'アプリ全体の動作、起動、ロケール。',
  'workbench.settings.category.general.sub.locale': 'ロケール',
  'workbench.settings.category.general.sub.behavior': '動作',
  'workbench.settings.category.general.sub.settings': '設定',
  'workbench.settings.category.general.sub.privacy': 'プライバシー',
  'workbench.settings.category.appearance.label': '外観',
  'workbench.settings.category.appearance.description': 'テーマ、密度、視覚的な表示。',
  'workbench.settings.category.appearance.sub.theme': 'テーマ',
  'workbench.settings.category.appearance.sub.interface': 'インターフェース',
  'workbench.settings.category.workspaceLayout.label': 'ワークスペースのレイアウト',
  'workbench.settings.category.workspaceLayout.description': 'フッターの操作要素とツールウィンドウのシェルの動作。',
  'workbench.settings.category.workspaceLayout.sub.shell': 'Shell',
  'workbench.settings.category.workspaceLayout.sub.topbar': 'トップバー',
  'workbench.settings.category.workspaceLayout.sub.footer': 'フッター',
  'workbench.settings.category.tools.label': 'ツール',
  'workbench.settings.category.tools.description':
    '独自の設定を持つツールウィンドウ。ターミナル、トラフィックモニター、MCP サーバー。',
  'workbench.settings.category.terminal.label': 'ターミナル',
  'workbench.settings.category.terminal.description': '統合ターミナルツールウィンドウの動作。',
  'workbench.settings.category.terminal.sub.shell': 'Shell',
  'workbench.settings.category.terminal.sub.appearance': '外観',
  'workbench.settings.category.terminal.sub.behavior': '動作',
  'workbench.settings.category.terminal.sub.tabs': 'タブ',
  'workbench.settings.category.devpanel.label': 'DevTools パネル',
  'workbench.settings.category.devpanel.description':
    'ブラウザーの DevTools パネルのデフォルト。ツールウィンドウのシェルと、リクエスト面の各タブ。',
  'workbench.settings.category.devpanelLayout.label': 'レイアウト',
  'workbench.settings.category.devpanelLayout.description':
    'ブラウザーの DevTools パネルにおけるツールウィンドウのシェルの動作。',
  'workbench.settings.category.devpanelLayout.sub.shell': 'Shell',
  'workbench.settings.category.devpanelLayout.sub.topbar': 'トップバー',
  'workbench.settings.category.devpanelLayout.sub.footer': 'フッター',
  'workbench.settings.category.devpanelNetwork.label': 'Network',
  'workbench.settings.category.devpanelNetwork.description':
    'DevTools パネルの Network リクエストテーブルのデフォルト。レイアウト、並べ替え、ドット列。',
  'workbench.settings.category.devpanelNetwork.sub.table': 'テーブル',
  'workbench.settings.category.devpanelNetwork.sub.sorting': '並べ替え',
  'workbench.settings.category.devpanelNetwork.sub.waterfall': 'Waterfall',
  'workbench.settings.category.devpanelHeaders.label': 'Headers',
  'workbench.settings.category.devpanelHeaders.description':
    'DevTools パネルの Headers タブのデフォルト。レイアウト、並べ替え、フィルター、提案。',
  'workbench.settings.category.devpanelHeaders.sub.view': '表示',
  'workbench.settings.category.devpanelHeaders.sub.filters': 'フィルター',
  'workbench.settings.category.devpanelInitiator.label': 'Initiator',
  'workbench.settings.category.devpanelInitiator.description':
    'DevTools パネルの Initiator タブのデフォルト。並べ替え、フィルター、提案。',
  'workbench.settings.category.devpanelInitiator.sub.view': '表示',
  'workbench.settings.category.devpanelInitiator.sub.filters': 'フィルター',
  'workbench.settings.category.devpanelCookies.label': 'Cookies',
  'workbench.settings.category.devpanelCookies.description':
    'DevTools パネルの Cookies タブのデフォルト。列、並べ替え、フィルター、提案。',
  'workbench.settings.category.devpanelCookies.sub.view': '表示',
  'workbench.settings.category.devpanelCookies.sub.filters': 'フィルター',
  'workbench.settings.category.devpanelTiming.label': 'Timing',
  'workbench.settings.category.devpanelTiming.description':
    'DevTools パネルの Timing タブのデフォルト。どのバンドを表示するか。',
  'workbench.settings.category.devpanelTiming.sub.view': '表示',
  'workbench.settings.category.inspection.label': 'デバッグモード',
  'workbench.settings.category.inspection.description':
    'ブラウザーのデバッグプロトコルにアタッチするオプトインの経路。組み込みの開発者ツールと同じ深さでリクエストを検査し、変更します。',
  'workbench.settings.category.inspection.sub.protocol': 'デバッグプロトコル',
  'workbench.settings.category.trafficMonitor.label': 'トラフィック',
  'workbench.settings.category.trafficMonitor.description':
    'トラフィックパネルの観測開始操作のデフォルトと、セッションアーカイブのディスク予算。',
  'workbench.settings.category.trafficMonitor.sub.layout': 'レイアウト',
  'workbench.settings.category.trafficMonitor.sub.capture': 'キャプチャ',
  'workbench.settings.category.trafficMonitor.sub.sessions': 'セッション',
  'workbench.settings.category.editor.label': 'エディター',
  'workbench.settings.category.editor.description': 'すべてのエディタータブ内のコード面と差分面。',
  'workbench.settings.category.codeEditor.label': 'コードエディター',
  'workbench.settings.category.codeEditor.description': 'コード編集面のフォント、インデント、表示オプション。',
  'workbench.settings.category.codeEditor.sub.font': 'フォント',
  'workbench.settings.category.codeEditor.sub.indentation': 'インデント',
  'workbench.settings.category.codeEditor.sub.wrapping': '折り返し',
  'workbench.settings.category.codeEditor.sub.display': '表示',
  'workbench.settings.category.codeEditor.sub.editing': '編集',
  'workbench.settings.category.requests.label': 'API リクエスト',
  'workbench.settings.category.requests.description': 'プロトコルごとのリクエスト送信とレスポンス処理。',
  'workbench.settings.category.requests.sub.tls': 'TLS',
  'workbench.settings.category.requests.sub.http': 'HTTP',
  'workbench.settings.category.requests.sub.sse': 'SSE',
  'workbench.settings.category.requests.sub.grpc': 'gRPC',
  'workbench.settings.category.requests.sub.websocket': 'WebSocket',
  'workbench.settings.category.requests.sub.mqtt': 'MQTT',
  'workbench.settings.category.browserInterceptor.label': 'ブラウザーインターセプター',
  'workbench.settings.category.browserInterceptor.description':
    'ブラウザー側の面。トラフィックを書き換えるルールエンジン、デバッグプロトコルのアタッチ、DevTools パネル。',
  'workbench.settings.category.rulesEngine.label': 'ルールエンジン',
  'workbench.settings.category.rulesEngine.description': 'ルールの評価、コンパイル、調停の方法。',
  'workbench.settings.category.rulesEngine.sub.engine': 'エンジン',
  'workbench.settings.category.rulesEngine.sub.caching': 'キャッシュ',
  'workbench.settings.category.rulesEngine.sub.warnings': '警告',
  'workbench.settings.category.rulesEngine.sub.drafting': 'ルールの下書き',
  'workbench.settings.category.rulesEngine.sub.display': '表示',
  'workbench.settings.category.keyboard.label': 'キーボード',
  'workbench.settings.category.keyboard.description': 'キーボードショートカットをカスタマイズします。',
  'workbench.settings.category.keyboard.sub.global': 'すべての面',
  'workbench.settings.category.keyboard.sub.workbench-general': 'ワークベンチ',
  'workbench.settings.category.keyboard.sub.workbench-layout': 'ワークベンチ · レイアウト',
  'workbench.settings.category.keyboard.sub.workbench-tabs': 'ワークベンチ · タブ',
  'workbench.settings.category.keyboard.sub.workbench-focus': 'ワークベンチ · フォーカス',
  'workbench.settings.category.keyboard.sub.workbench-editor': 'ワークベンチ · エディター',
  'workbench.settings.category.keyboard.sub.popup-general': 'ポップアップとサイドパネル',
  'workbench.settings.category.keyboard.sub.popup-navigation': 'ポップアップとサイドパネル · ナビゲーション',
  'workbench.settings.category.keyboard.sub.popup-rows': 'ポップアップとサイドパネル · 行の操作',
  'workbench.settings.category.keyboard.sub.popup-tabs': 'ポップアップとサイドパネル · タブ',
  'workbench.settings.category.diffViewer.label': '差分ビューアー',
  'workbench.settings.category.diffViewer.description':
    'アプリが 2 つのバージョンを比較するあらゆる場所での差分の描画。レイアウト、空白、ガター。',
  'workbench.settings.category.diffViewer.sub.view': '表示',
  'workbench.settings.category.diffViewer.sub.importPreview': 'インポートプレビュー',
  'workbench.settings.category.versionControl.label': 'バージョン管理',
  'workbench.settings.category.versionControl.description':
    'Git に基づくワークスペース。その背後にある履歴と作業ツリー。',
  'workbench.settings.category.git.label': 'Git',
  'workbench.settings.category.git.description':
    'このワークスペースをディスク上のフォルダーにバインドします。git に適したライブの YAML ツリーです。',
  'workbench.settings.category.gitFolder.label': 'フォルダー',
  'workbench.settings.category.gitFolder.description': 'このワークスペースがバインドされているディスク上のフォルダー。',
  'workbench.settings.category.gitFolder.sub.binding': 'バインディング',
  'workbench.settings.category.gitFolder.sub.requirements': '要件',
  'workbench.settings.category.gitAutomation.label': '自動化',
  'workbench.settings.category.gitAutomation.description': 'エンジンが自動でコミットおよびプッシュするもの。',
  'workbench.settings.category.gitAutomation.sub.commits': 'コミット',
  'workbench.settings.category.gitAutomation.sub.remote': 'リモート',
  'workbench.settings.category.proxy.label': 'プロキシ',
  'workbench.settings.category.proxy.description':
    'このデバイスの送信プロキシ（リクエストがネットワークに到達する方法）と、キャプチャプロキシの信頼設定。',
  'workbench.settings.category.proxyOutbound.label': '送信リクエスト',
  'workbench.settings.category.proxyOutbound.description':
    'このデバイスの送信プロキシ。リクエスト、WebSocket セッション、gRPC 呼び出しがネットワークに到達する方法。',
  'workbench.settings.category.proxyTrust.label': 'HTTPS の信頼',
  'workbench.settings.category.proxyTrust.description':
    '検査のために HTTPS トラフィックを復号できるようにする認証局と信頼ストア。このマシンで作成され、ここで削除できます。',
  'workbench.settings.category.application.label': 'アプリケーション',
  'workbench.settings.category.application.description':
    'アプリそのもの。データ、アップデート、ライセンス、バージョン。',
  'workbench.settings.category.data.label': 'データ',
  'workbench.settings.category.data.description': '診断、インポート / エクスポート、破壊的なメンテナンス。',
  'workbench.settings.category.data.sub.settings': '設定',
  'workbench.settings.category.data.sub.diagnostics': '診断',
  'workbench.settings.category.data.sub.importReports': 'インポートレポート',
  'workbench.settings.category.data.sub.files': 'ファイル',
  'workbench.settings.category.license.label': 'ライセンス',
  'workbench.settings.category.license.description':
    '現在の Open Headers のすべての機能はどのティアにも含まれています。有料プランはチームのシートをカバーします。無料ティアはサーバーごとに最大 6 人のアクティブユーザーを受け入れます。',
  'workbench.settings.category.updates.label': 'アップデート',
  'workbench.settings.category.updates.description': 'アップデートの確認、チャネル、ダウンロードの動作。',
  'workbench.settings.category.updates.sub.status': 'ステータス',
  'workbench.settings.category.updates.sub.behavior': '動作',
  'workbench.settings.category.about.label': 'このアプリについて',
  'workbench.settings.category.about.description': 'バージョン、ライセンス、ビルド情報。',
  'workbench.settings.category.about.sub.application': 'アプリケーション',
  'workbench.settings.category.about.sub.environment': '環境',
  'workbench.settings.category.about.sub.openSource': 'オープンソースソフトウェア',
  'workbench.settings.thirdParty.software': 'ソフトウェア',
  'workbench.settings.thirdParty.license': 'ライセンス',

  // ── App-update row (updates.state custom editor) ───────────────────
  'workbench.settings.updatesRow.unsupported': 'このビルドでは、アップデートはインストール元のチャネルが担います。',
  'workbench.settings.updatesRow.checking': 'アップデートを確認中…',
  'workbench.settings.updatesRow.securityFix':
    'バージョン {version} は、このバージョンに影響するセキュリティの問題を修正します。',
  'workbench.settings.updatesRow.available': 'バージョン {version} が利用できます。',
  'workbench.settings.updatesRow.packageManager': 'Linux のパッケージマネージャーからインストールしてください。',
  'workbench.settings.updatesRow.updateAndRestart': '更新して再起動',
  'workbench.settings.updatesRow.downloading': '{version} をダウンロード中…',
  'workbench.settings.updatesRow.readyToInstall': 'バージョン {version} をインストールする準備ができました。',
  'workbench.settings.updatesRow.restartToInstall': '再起動してインストール',
  'workbench.settings.updatesRow.checkFailed': 'アップデートの確認に失敗しました：{message}',
  'workbench.settings.updatesRow.retry': '再試行',
  'workbench.settings.updatesRow.upToDate': '最新バージョン（{version}）を使用しています。',
  'workbench.settings.updatesRow.checkNow': '今すぐ確認',
  'workbench.settings.updatesRow.releaseNotes': 'リリースノート',
  'workbench.settings.updatesRow.lastChecked': '最終確認 {when}',

  // ── Terminal profiles row ──────────────────────────────────────────
  'workbench.settings.terminalProfiles.systemDefault': 'システムのデフォルトシェル',
  'workbench.settings.terminalProfiles.add': 'プロファイルを追加',
  'workbench.settings.terminalProfiles.edit': 'プロファイルを編集',
  'workbench.settings.terminalProfiles.remove': 'プロファイルを削除',
  'workbench.settings.terminalProfiles.addTitle': 'ターミナルプロファイルを追加',
  'workbench.settings.terminalProfiles.editTitle': 'ターミナルプロファイルを編集',
  'workbench.settings.terminalProfiles.name': '名前',
  'workbench.settings.terminalProfiles.shell': 'シェルのパス',
  'workbench.settings.terminalProfiles.args': '引数',
  'workbench.settings.terminalProfiles.cwd': '開始ディレクトリ',
  'workbench.settings.terminalProfiles.cwdPlaceholder': 'ホームディレクトリ',
  'workbench.settings.terminalProfiles.save': '保存',

  // ── Settings field widgets ─────────────────────────────────────────
  'workbench.settings.fields.files.renameTooltip': 'ファイル名を変更',
  'workbench.settings.fields.files.renameMissing': 'ファイルはこのワークスペースにもう存在しません',
  'workbench.settings.fields.files.renameFailed': 'ファイル名を変更できませんでした',
  'workbench.settings.fields.files.renameFailedReason': 'ファイル名を変更できませんでした：{message}',
  'workbench.settings.fields.files.colFilename': 'ファイル名',
  'workbench.settings.fields.files.colSize': 'サイズ',
  'workbench.settings.fields.files.colMime': 'MIME',
  'workbench.settings.fields.files.colHash': 'Hash',
  'workbench.settings.fields.files.colActions': '操作',
  'workbench.settings.fields.files.download': 'ダウンロード',
  'workbench.settings.fields.files.deleteTitle': '{filename} を削除しますか？',
  'workbench.settings.fields.files.deleteWarning':
    'このファイルを参照する Multipart パートは送信時にエラーになります。',
  'workbench.settings.fields.files.loading': 'ファイルを読み込んでいます…',
  'workbench.settings.fields.files.empty': 'ファイルはまだありません。上の「ファイルをアップロード」を使ってください。',
  'workbench.settings.fields.keyValue.keyPlaceholder': 'key',
  'workbench.settings.fields.keyValue.valuePlaceholder': 'value',
  'workbench.settings.fields.keyValue.addEntry': 'エントリを追加',
  'workbench.settings.fields.keybinding.pressCombo': 'キーの組み合わせを押してください…',
  'workbench.settings.fields.keybinding.record': '記録',
  'workbench.settings.fields.keybinding.cancel': 'キャンセル',

  // ── Product-telemetry toggle row ───────────────────────────────────
  'workbench.settings.telemetryRow.viewEvents': 'イベントを表示',
  'workbench.settings.telemetryRow.modalTitle': 'このセッションのテレメトリイベント',
  'workbench.settings.telemetryRow.sessionOn': 'セッション {sessionId}：集計はオンです',
  'workbench.settings.telemetryRow.sessionOff': 'セッション {sessionId}：集計はオフです',
  'workbench.settings.telemetryRow.install':
    'インストール {installId}（ランダム。あなたではなくこのインストールを識別します）',
  'workbench.settings.telemetryRow.noInstall': 'インストール識別子なし：集計はオフです',
  'workbench.settings.telemetryRow.empty': 'このセッションで記録されたテレメトリイベントはありません。',
  'workbench.settings.telemetryRow.confirmTitle': '匿名の使用状況の集計をオフにしますか？',
  'workbench.settings.telemetryRow.confirmHeading': 'あなたのプライバシーは既に守られています',
  'workbench.settings.telemetryRow.confirmIntro':
    'ランダムな識別子がこのインストールを数えます。あなたを数えることはありません。個人データは一切収集されません。集計が行うことは次のとおりです：',
  'workbench.settings.telemetryRow.confirmPointFeatures': 'どの機能に引き続き取り組む価値があるかを示します',
  'workbench.settings.telemetryRow.confirmPointScope':
    '機能の使用状況、プラットフォーム、アプリのバージョンだけを数えます',
  'workbench.settings.telemetryRow.confirmPointInspect':
    'すべてのイベントは「イベントを表示」でバイト単位まで確認できます',
  'workbench.settings.telemetryRow.confirmBadgePersonal': '個人データなし',
  'workbench.settings.telemetryRow.confirmBadgeUrls': 'URL やヘッダーなし',
  'workbench.settings.telemetryRow.confirmBadgeContent': 'リクエストの内容なし',
  'workbench.settings.telemetryRow.confirmKeep': '集計をオンのままにする',
  'workbench.settings.telemetryRow.confirmDisable': 'それでもオフにする',
} as const satisfies Catalog;
