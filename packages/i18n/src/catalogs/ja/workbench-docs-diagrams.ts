/**
 * Workbench Docs panel — SVG diagram labels — Japanese. Mirrors
 * `catalogs/en/workbench-docs-diagrams.ts` key for key. Vocabulary is
 * quoted from the shipped ja catalogs: スコープ = scope, 裸の参照 =
 * bare reference, シャドウイング / シャドウ = shadowing / shadowed,
 * ラダー = the ladder, 走査 = the walk (all from
 * `ja/workbench-docs-variables.ts`); sidebar entry names copy
 * `ja/workbench-chrome-sidebar.ts` verbatim（Vault、ワークスペース変数、
 * ライブ変数、環境、変数）; 公開 = expose and 送信 = Send reuse the
 * shipped editor mints; ブラウザーインターセプター = Browser
 * Interceptor (ja/workbench-chrome); デバッグモード / 標準モード /
 * ヒューリスティック (ja/workbench-docs-debug-mode); 到達範囲 = reach,
 * 直接 / 間接 = direct / indirect, モック = mock, エンジン = engine
 * (ja/workbench-docs); ウェイク = SW wake, ドリフト = drift,
 * ハイドレート = hydrate (ja/workbench-docs-system-status); ピル =
 * pill. Monospace wire fragments and `{{ns.*}}` tokens are whole-raw
 * values copied verbatim. Sample identifiers (staging, production,
 * api_host), Chrome ResourceType names, condition names in rule
 * banners, and the diagram kickers' raw parity nouns (DNR, Script,
 * Params, Cookies, DevTools, Popup, Workbench) ride raw. MINTS:
 * 回り道 = detour (the proxy posture stamp), インライン = inline,
 * 収束 = convergence, 待機ページ reused = waiting page.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDiagrams = {
  // ── Variables: resolution ladder ────────────────────────────────────
  'workbench.docs.diagrams.variables.ladder.aria':
    '裸の変数参照は vault、環境、コレクション、ワークスペースの順に解決され、最初のヒットが勝ちます。Live、ステップ、ファイル、動的は名前空間プレフィックスでのみ到達できます。',
  'workbench.docs.diagrams.variables.ladder.title': '裸の参照：それを定義する最初のスコープが勝つ',
  'workbench.docs.diagrams.variables.ladder.vault': 'Vault',
  'workbench.docs.diagrams.variables.ladder.vaultSub': 'シークレット · このデバイスのみ',
  'workbench.docs.diagrams.variables.ladder.environment': '環境',
  'workbench.docs.diagrams.variables.ladder.environmentSub': 'アクティブ、次にデフォルト',
  'workbench.docs.diagrams.variables.ladder.collection': 'コレクション',
  'workbench.docs.diagrams.variables.ladder.collectionSub': 'アクティブなコレクションのみ',
  'workbench.docs.diagrams.variables.ladder.workspace': 'ワークスペース',
  'workbench.docs.diagrams.variables.ladder.workspaceSub': '全員と共有',
  'workbench.docs.diagrams.variables.ladder.miss': 'ミス',
  'workbench.docs.diagrams.variables.ladder.railHeading': '名前空間のみ',
  'workbench.docs.diagrams.variables.ladder.railFoot1': 'プレフィックスでのみ到達。',
  'workbench.docs.diagrams.variables.ladder.railFoot2': '裸の走査には決して加わらない',
  'workbench.docs.diagrams.variables.ladder.pinExamples': '{{vault.token}} · {{env.token}} · {{collection.token}}',
  'workbench.docs.diagrams.variables.ladder.pinNote':
    '{{workspace.token}}：プレフィックスが 1 つのスコープに固定します。',

  // ── Variables: creation map ─────────────────────────────────────────
  'workbench.docs.diagrams.variables.creation.aria':
    'サイドバーの地図：コレクション変数はコレクション上に、環境は「環境」の下に、Vault、ワークスペース変数、ライブ変数はサイドバーの最上位エントリです',
  'workbench.docs.diagrams.variables.creation.title': '各スコープが作られる場所',
  'workbench.docs.diagrams.variables.creation.workspaceName': 'PAYMENTS TEAM',
  'workbench.docs.diagrams.variables.creation.collections': '▾ コレクション',
  'workbench.docs.diagrams.variables.creation.collectionName': '▾ Payments API',
  'workbench.docs.diagrams.variables.creation.variables': '変数',
  'workbench.docs.diagrams.variables.creation.environments': '▾ 環境',
  'workbench.docs.diagrams.variables.creation.envStaging': 'staging  ●',
  'workbench.docs.diagrams.variables.creation.envProduction': 'production',
  'workbench.docs.diagrams.variables.creation.vault': 'Vault',
  'workbench.docs.diagrams.variables.creation.workspaceVariables': 'ワークスペース変数',
  'workbench.docs.diagrams.variables.creation.liveVariables': 'ライブ変数',
  'workbench.docs.diagrams.variables.creation.footer1': 'コレクションは独自の変数ページを持ち、',
  'workbench.docs.diagrams.variables.creation.footer2': 'それ以外はすべてサイドバーのエントリです。',

  // ── Variables: shadowing ────────────────────────────────────────────
  'workbench.docs.diagrams.variables.shadowing.aria':
    'api_host が環境とワークスペースの両方で定義されている場合、裸の参照は環境の値に解決されます。名前空間付きの形は引き続きワークスペースの値を読みます',
  'workbench.docs.diagrams.variables.shadowing.title': '2 つのスコープに同じ名前：上位が勝つ',
  'workbench.docs.diagrams.variables.shadowing.wins': '✓ 勝ち',
  'workbench.docs.diagrams.variables.shadowing.shadowed': 'シャドウ',
  'workbench.docs.diagrams.variables.shadowing.envLabel': '環境 · staging',
  'workbench.docs.diagrams.variables.shadowing.wsLabel': 'ワークスペース',
  'workbench.docs.diagrams.variables.shadowing.footer':
    'プレフィックスはラダーを飛ばして 1 つのスコープを直接読みます。',

  // ── Variables: live lifecycle ───────────────────────────────────────
  'workbench.docs.diagrams.variables.live.aria':
    'ライブワークフローがステップを実行し、公開されたキャプチャをライブ変数として発行し、ルールとリクエストがそれを使います。自動更新はワークフローを再実行します',
  'workbench.docs.diagrams.variables.live.title': '成功した実行が値を発行する',
  'workbench.docs.diagrams.variables.live.workflowTitle': 'Live Workflow',
  'workbench.docs.diagrams.variables.live.step1': 'ステップ 1 · サインイン',
  'workbench.docs.diagrams.variables.live.step2': 'ステップ 2 · token を取得',
  'workbench.docs.diagrams.variables.live.expose': '公開：token',
  'workbench.docs.diagrams.variables.live.runSucceeds': '実行が成功',
  'workbench.docs.diagrams.variables.live.publishes': '発行',
  'workbench.docs.diagrams.variables.live.rules': 'ルール',
  'workbench.docs.diagrams.variables.live.requests': 'リクエスト',
  'workbench.docs.diagrams.variables.live.autoRefresh': '自動更新が再実行',
  'workbench.docs.diagrams.variables.live.footer1': '保存するとワークフローが有効になります。値が現れるのは',
  'workbench.docs.diagrams.variables.live.footer2':
    '成功した実行の後だけで、ワークフローのスケジュールで更新されます。',

  // ── Variables: consumers ────────────────────────────────────────────
  'workbench.docs.diagrams.variables.consumers.aria':
    '1 つのテンプレート値（Authorization: Bearer token）を、ルール、リクエスト、ワークフローが使います',
  'workbench.docs.diagrams.variables.consumers.title': '一度定義して、どこからでも参照',
  'workbench.docs.diagrams.variables.consumers.template': 'Authorization: Bearer {{token}}',
  'workbench.docs.diagrams.variables.consumers.rules': 'ルール',
  'workbench.docs.diagrams.variables.consumers.rulesLine1': 'ヘッダー、リダイレクト、',
  'workbench.docs.diagrams.variables.consumers.rulesLine2': 'ボディ、注入',
  'workbench.docs.diagrams.variables.consumers.rulesWhen': 'ルールが適用されるとき',
  'workbench.docs.diagrams.variables.consumers.requests': 'リクエスト',
  'workbench.docs.diagrams.variables.consumers.requestsLine1': 'URL、パラメーター、',
  'workbench.docs.diagrams.variables.consumers.requestsLine2': 'ヘッダー、認可、ボディ',
  'workbench.docs.diagrams.variables.consumers.requestsWhen': '送信時',
  'workbench.docs.diagrams.variables.consumers.workflows': 'ワークフロー',
  'workbench.docs.diagrams.variables.consumers.workflowsLine1': 'すべてのステップ、',
  'workbench.docs.diagrams.variables.consumers.workflowsLine2': '連鎖するキャプチャ',
  'workbench.docs.diagrams.variables.consumers.workflowsWhen': '実行ごと',
  'workbench.docs.diagrams.variables.consumers.footer1': '値は使用時に置換されます。変数を一度変えれば、',
  'workbench.docs.diagrams.variables.consumers.footer2': 'すべてのルール、リクエスト、ワークフローがそれを拾います。',

  // ── Variables: per-scope references ─────────────────────────────────
  'workbench.docs.diagrams.variables.refs.shared.dont': 'してはいけないこと：',
  'workbench.docs.diagrams.variables.refs.vault.aria':
    'Vault：同期されるエンティティからは vault テンプレートでシークレットを参照します。生のキーをルールやワークスペース変数に貼り付けてはいけません',
  'workbench.docs.diagrams.variables.refs.vault.title': 'Vault：このデバイスを決して離れないシークレット',
  'workbench.docs.diagrams.variables.refs.vault.chipSub': 'Vault · kind: string',
  'workbench.docs.diagrams.variables.refs.vault.arrowCaption': 'ローカルで解決',
  'workbench.docs.diagrams.variables.refs.vault.good1Note': '同期されるルール。チームメイトそれぞれのキーが入ります',
  'workbench.docs.diagrams.variables.refs.vault.good2Note':
    'TOTP エントリ。現在のコードに解決され、seed は決して出ません',
  'workbench.docs.diagrams.variables.refs.vault.goodFootnote':
    'vault のエントリは同期、エクスポート、git の外に留まります',
  'workbench.docs.diagrams.variables.refs.vault.bad1Text': 'ルール内の Bearer sk-live-9f3d…',
  'workbench.docs.diagrams.variables.refs.vault.bad1Reason': '貼り付けた平文はワークスペース全体に同期されます',
  'workbench.docs.diagrams.variables.refs.vault.bad2Text': 'ワークスペース変数としての api_key',
  'workbench.docs.diagrams.variables.refs.vault.bad2Reason': 'これも同期されます。vault が唯一のローカルスコープです',
  'workbench.docs.diagrams.variables.refs.vault.footer1': 'Vault はすべてのスコープより上位です。裸の {{api_key}} は',
  'workbench.docs.diagrams.variables.refs.vault.footer2': 'vault の値があれば常にそれを選びます。',
  'workbench.docs.diagrams.variables.refs.environment.aria':
    '環境：1 つの変数名がステージごとに異なる値に解決されます。ルールを複製する代わりに環境を切り替え、シークレットは vault に置きます',
  'workbench.docs.diagrams.variables.refs.environment.title': '環境：1 つの名前、ステージごとの値',
  'workbench.docs.diagrams.variables.refs.environment.chipSub': '環境 · staging（アクティブ）',
  'workbench.docs.diagrams.variables.refs.environment.arrowCaption': 'アクティブな環境が勝つ',
  'workbench.docs.diagrams.variables.refs.environment.good1Note': 'staging がアクティブな間',
  'workbench.docs.diagrams.variables.refs.environment.good2Note': '環境を切り替え。同じルール、編集ゼロ',
  'workbench.docs.diagrams.variables.refs.environment.goodFootnote': 'ミスはまずデフォルト環境にフォールバックします',
  'workbench.docs.diagrams.variables.refs.environment.bad1Text': 'production に入力した sk-live キー',
  'workbench.docs.diagrams.variables.refs.environment.bad1Reason': '環境は同期されます。シークレットは Vault に',
  'workbench.docs.diagrams.variables.refs.environment.bad2Text': 'すべてのルールの staging 用コピー',
  'workbench.docs.diagrams.variables.refs.environment.bad2Reason':
    'ステージごとにルールを複製せず、環境を切り替えてください',
  'workbench.docs.diagrams.variables.refs.environment.footer1':
    'すべてのステージで同じ値？ワークスペースを使ってください。',
  'workbench.docs.diagrams.variables.refs.environment.footer2':
    'ユーザーごとのシークレット？Vault はすべての環境より上位です。',
  'workbench.docs.diagrams.variables.refs.collection.aria':
    'コレクション：変数はそのコレクション内のルールとリクエストでのみ解決されます。ワークスペース全体の値はワークスペーススコープに移してください',
  'workbench.docs.diagrams.variables.refs.collection.title': 'コレクション：1 つの API にスコープ',
  'workbench.docs.diagrams.variables.refs.collection.chipSub': 'Payments API · 変数',
  'workbench.docs.diagrams.variables.refs.collection.arrowCaption': 'Payments API の中で解決',
  'workbench.docs.diagrams.variables.refs.collection.good1Note': 'Payments API コレクション内のリクエスト',
  'workbench.docs.diagrams.variables.refs.collection.good2Note': 'Payments API コレクション内のルール',
  'workbench.docs.diagrams.variables.refs.collection.badsLabel': '解決されないもの：',
  'workbench.docs.diagrams.variables.refs.collection.bad1Text': 'Billing API 内の {{base_url}}',
  'workbench.docs.diagrams.variables.refs.collection.bad1Reason': '別のコレクション。代わりにそこで定義してください',
  'workbench.docs.diagrams.variables.refs.collection.bad2Text': 'コレクション外のルール内の {{base_url}}',
  'workbench.docs.diagrams.variables.refs.collection.bad2Reason': 'コレクションなし → 参照はこのスコープを素通りします',
  'workbench.docs.diagrams.variables.refs.collection.footer1':
    'すべてのコレクションで必要？ワークスペースに移してください。',
  'workbench.docs.diagrams.variables.refs.collection.footer2': '同名の環境変数はこれより上位です。',
  'workbench.docs.diagrams.variables.refs.workspace.aria':
    'ワークスペース：ワークスペース変数はどこでも解決され、順位は最下位です。シークレットは vault に、ステージごとの値は環境に置きます',
  'workbench.docs.diagrams.variables.refs.workspace.title': 'ワークスペース：共有されるベース層',
  'workbench.docs.diagrams.variables.refs.workspace.chipSub': 'ワークスペース変数',
  'workbench.docs.diagrams.variables.refs.workspace.arrowCaption': 'どこでも解決',
  'workbench.docs.diagrams.variables.refs.workspace.good1Note': 'ヘッダールール。どのコレクション、どの環境でも',
  'workbench.docs.diagrams.variables.refs.workspace.good2Note': 'リクエスト URL',
  'workbench.docs.diagrams.variables.refs.workspace.good3Note': '固定。上位スコープが名前をシャドウしていても',
  'workbench.docs.diagrams.variables.refs.workspace.bad1Reason': '全員に同期されます。シークレットは Vault に',
  'workbench.docs.diagrams.variables.refs.workspace.bad2Reason': 'ステージごとに変わります。各環境で定義してください',
  'workbench.docs.diagrams.variables.refs.workspace.footer1': 'シークレット？Vault を。ステージごとに異なる？環境を。',
  'workbench.docs.diagrams.variables.refs.workspace.footer2': 'ワークスペースはどこでも真である値のためのものです。',
  'workbench.docs.diagrams.variables.refs.live.aria':
    'Live：ワークフローが発行した値は live プレフィックスで参照します。裸の参照は決して live に解決されず、手で貼り付けた token は古くなります',
  'workbench.docs.diagrams.variables.refs.live.title': 'Live：ワークフローの実行が生み出す',
  'workbench.docs.diagrams.variables.refs.live.chipSub': 'ライブ変数 · OAuth ログインワークフロー',
  'workbench.docs.diagrams.variables.refs.live.arrowCaption': '最後の実行が発行',
  'workbench.docs.diagrams.variables.refs.live.good1Note': '決して古くならないヘッダールール',
  'workbench.docs.diagrams.variables.refs.live.good2Text': 'リクエストとワークフロー内の {{live.token}}',
  'workbench.docs.diagrams.variables.refs.live.good2Note': '常に最新の発行値',
  'workbench.docs.diagrams.variables.refs.live.bad1Text': '{{token}}：裸',
  'workbench.docs.diagrams.variables.refs.live.bad1Reason':
    'live は裸の走査に決して加わりません。{{live.token}} と書いてください',
  'workbench.docs.diagrams.variables.refs.live.bad2Text': '環境変数に貼り付けた token',
  'workbench.docs.diagrams.variables.refs.live.bad2Reason':
    'サイレントに期限切れになります。代わりにワークフローで裏付けてください',
  'workbench.docs.diagrams.variables.refs.live.footer1': 'ワークフローを編集した？値は古いと表示され、',
  'workbench.docs.diagrams.variables.refs.live.footer2': '次の成功した実行だけがそれを再発行します。',

  // ── Multi-tab: side-by-side sync overview ───────────────────────────
  'workbench.docs.diagrams.multiTab.sync.aria':
    '2 つのワークスペースタブを並べて開く：異なるワークスペースまたは異なるレイアウトで、並行して作業',
  'workbench.docs.diagrams.multiTab.sync.title': '2 つのタブ、2 つのコンテキスト：同時に',
  'workbench.docs.diagrams.multiTab.sync.tabTitle': '{ordinal} Open Headers',
  'workbench.docs.diagrams.multiTab.sync.workspaceProduction': 'Production',
  'workbench.docs.diagrams.multiTab.sync.workspaceStaging': 'Staging',
  'workbench.docs.diagrams.multiTab.sync.sidebarRules': 'ルール',
  'workbench.docs.diagrams.multiTab.sync.sidebarRequests': 'リクエスト',
  'workbench.docs.diagrams.multiTab.sync.sidebarEnv': '環境',
  'workbench.docs.diagrams.multiTab.sync.ruleRow1': '認証ヘッダー',
  'workbench.docs.diagrams.multiTab.sync.ruleRow2': 'CORS バイパス',
  'workbench.docs.diagrams.multiTab.sync.ruleRow3': '広告ブロック',
  'workbench.docs.diagrams.multiTab.sync.rulesEditor': 'ルールエディター',
  'workbench.docs.diagrams.multiTab.sync.envEditor': '環境エディター',
  'workbench.docs.diagrams.multiTab.sync.footer1': 'ルール + コレクションはストレージを通じて同期されます。',
  'workbench.docs.diagrams.multiTab.sync.footer2': '各タブは自身のワークスペース + レイアウトを保ちます。',

  // ── Multi-tab: ordinal numbering timeline ───────────────────────────
  'workbench.docs.diagrams.multiTab.numbering.aria':
    'タブ番号のタイムライン：序数はタブの生存期間中は安定しています。#1 を閉じても番号は振り直されず、次のタブは #4 になります',
  'workbench.docs.diagrams.multiTab.numbering.title': '序数はタブの生存期間中は安定',
  'workbench.docs.diagrams.multiTab.numbering.step1': 'タブが 1 つ開いている',
  'workbench.docs.diagrams.multiTab.numbering.note1': 'プレフィックスなし',
  'workbench.docs.diagrams.multiTab.numbering.step2': 'もう 1 つ開く',
  'workbench.docs.diagrams.multiTab.numbering.note2': 'プレフィックスが現れる',
  'workbench.docs.diagrams.multiTab.numbering.step3': '3 つ目を開く',
  'workbench.docs.diagrams.multiTab.numbering.step4': '#1 を閉じる',
  'workbench.docs.diagrams.multiTab.numbering.note4': '#2 #3 は変わらず',
  'workbench.docs.diagrams.multiTab.numbering.step5': 'さらに 1 つ開く',
  'workbench.docs.diagrams.multiTab.numbering.note5': '次は #4',
  'workbench.docs.diagrams.multiTab.numbering.footer':
    '番号が #1 にリセットされるのは、すべてのワークスペースタブが閉じた後だけです。',

  // ── Multi-tab: navigation reuse ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.navigation.aria':
    'ナビゲーションの再利用：同じウィンドウが優先。上：同じウィンドウにワークスペースタブがあれば、クリックでそれがアクティブになる。下：別のウィンドウにしかワークスペースタブがなければ、呼び出し元のウィンドウに新しいタブが開く。',
  'workbench.docs.diagrams.multiTab.navigation.title': 'ポップアップで「ルールを編集」をクリックすると、',
  'workbench.docs.diagrams.multiTab.navigation.subtitle':
    'ポップアップはまず自分のウィンドウでワークスペースタブを探します',
  'workbench.docs.diagrams.multiTab.navigation.sameWindow': '同じウィンドウ',
  'workbench.docs.diagrams.multiTab.navigation.sameWindowHint': '：既にワークスペースタブがある',
  'workbench.docs.diagrams.multiTab.navigation.window1': 'ウィンドウ 1',
  'workbench.docs.diagrams.multiTab.navigation.window1Caller': 'ウィンドウ 1（呼び出し元）',
  'workbench.docs.diagrams.multiTab.navigation.window2': 'ウィンドウ 2',
  'workbench.docs.diagrams.multiTab.navigation.workspaceTab': '#1 Open Headers',
  'workbench.docs.diagrams.multiTab.navigation.otherTab': 'gmail',
  'workbench.docs.diagrams.multiTab.navigation.popup': 'ポップアップ',
  'workbench.docs.diagrams.multiTab.navigation.editRule': 'ルールを編集 ▸',
  'workbench.docs.diagrams.multiTab.navigation.activates': '既存のタブがアクティブに · 新しいタブなし',
  'workbench.docs.diagrams.multiTab.navigation.otherWindow': '別のウィンドウ',
  'workbench.docs.diagrams.multiTab.navigation.otherWindowHint': '：自分のウィンドウにはない',
  'workbench.docs.diagrams.multiTab.navigation.newTab': '+ 新しいタブ',
  'workbench.docs.diagrams.multiTab.navigation.untouched': 'そのまま · フォーカスを奪わない',
  'workbench.docs.diagrams.multiTab.navigation.footer1':
    'Chrome 自身の DevTools がウィンドウごとにドッキングするのと同じで、',
  'workbench.docs.diagrams.multiTab.navigation.footer2': '既にいたウィンドウに留まります。',

  // ── Multi-tab: what syncs (shared pool) ─────────────────────────────
  'workbench.docs.diagrams.multiTab.synced.aria':
    'タブ間で同期されるもの：chrome.storage がルール、コレクション、フォルダー、環境、変数、vault、リクエスト、テンプレートを保持します。両方のタブがそれを通じて読み書きします。',
  'workbench.docs.diagrams.multiTab.synced.title': '✓ タブ間で同期',
  'workbench.docs.diagrams.multiTab.synced.subtitle': 'すべてのタブが同じ chrome.storage を読み書きします',
  'workbench.docs.diagrams.multiTab.synced.sourceOfTruth': '唯一の信頼できる情報源',
  'workbench.docs.diagrams.multiTab.synced.pillRules': 'ルール',
  'workbench.docs.diagrams.multiTab.synced.pillCollections': 'コレクション',
  'workbench.docs.diagrams.multiTab.synced.pillFolders': 'フォルダー',
  'workbench.docs.diagrams.multiTab.synced.pillEnvironments': '環境',
  'workbench.docs.diagrams.multiTab.synced.pillVariables': '変数',
  'workbench.docs.diagrams.multiTab.synced.pillVault': 'vault',
  'workbench.docs.diagrams.multiTab.synced.pillRequests': 'リクエスト',
  'workbench.docs.diagrams.multiTab.synced.pillTemplates': 'テンプレート',
  'workbench.docs.diagrams.multiTab.synced.tab1': 'タブ #1',
  'workbench.docs.diagrams.multiTab.synced.tab2': 'タブ #2',
  'workbench.docs.diagrams.multiTab.synced.liveData': 'ライブデータ',
  'workbench.docs.diagrams.multiTab.synced.footer': 'どちらのタブで保存しても、もう一方は即座に再ハイドレートします。',

  // ── Multi-tab: what stays local ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.local.aria':
    '各タブに留まるもの：レイアウトのスプリッター比率と未保存の下書き。2 つのタブは目に見えて異なります：25/75 と 65/35 の分割、一方は下書きあり、もう一方はなし。',
  'workbench.docs.diagrams.multiTab.local.title': '✗ 各タブに留まる',
  'workbench.docs.diagrams.multiTab.local.subtitle': 'スプリッター比率 + 未保存の入力：行った場所だけのもの',
  'workbench.docs.diagrams.multiTab.local.tabTitle': 'タブ {ordinal}',
  'workbench.docs.diagrams.multiTab.local.layoutLabel': 'レイアウト',
  'workbench.docs.diagrams.multiTab.local.draftLabel': '未保存の下書き',
  'workbench.docs.diagrams.multiTab.local.unsavedBadge': '● 未保存',
  'workbench.docs.diagrams.multiTab.local.noUnsaved': '未保存の変更なし',
  'workbench.docs.diagrams.multiTab.local.footer1': '各タブは自身のスプリッター + 下書きを保ちます。',
  'workbench.docs.diagrams.multiTab.local.footer2': 'ドラッグの後に開いたタブは新しいレイアウトを引き継ぎます。',

  // ── Header actions: shared kickers ──────────────────────────────────
  'workbench.docs.diagrams.headerActions.shared.ruleKicker': 'ルール',
  'workbench.docs.diagrams.headerActions.shared.beforeKicker': '適用前',
  'workbench.docs.diagrams.headerActions.shared.afterKicker': '適用後',
  'workbench.docs.diagrams.headerActions.shared.wontFireKicker': '発火しないとき',
  'workbench.docs.diagrams.headerActions.shared.suggestion': '提案',

  // ── Header actions: operations overview ─────────────────────────────
  'workbench.docs.diagrams.headerActions.overview.aria':
    '同じ開始ヘッダーに 4 つのヘッダー操作を適用：上書きは置き換え、追記は重複を追加、削除は消し、マージは連結します。',
  'workbench.docs.diagrams.headerActions.overview.title': '同じ開始ヘッダー → 4 つの結果',
  'workbench.docs.diagrams.headerActions.overview.before': 'Cookie: a=1',
  'workbench.docs.diagrams.headerActions.overview.opOverride': '上書き',
  'workbench.docs.diagrams.headerActions.overview.opAppend': '追記',
  'workbench.docs.diagrams.headerActions.overview.opRemove': '削除',
  'workbench.docs.diagrams.headerActions.overview.opMerge': 'マージ',
  'workbench.docs.diagrams.headerActions.overview.engineDnr': 'DNR',
  'workbench.docs.diagrams.headerActions.overview.engineScript': 'Script',
  'workbench.docs.diagrams.headerActions.overview.afterOverrideNew': 'Z',
  'workbench.docs.diagrams.headerActions.overview.afterAppendKept': 'a=1 ·',
  'workbench.docs.diagrams.headerActions.overview.afterAppendNew': '+Cookie: Z',
  'workbench.docs.diagrams.headerActions.overview.afterRemoveGone': '（ヘッダー消失）',
  'workbench.docs.diagrams.headerActions.overview.afterMergeNew': '; new=val',
  'workbench.docs.diagrams.headerActions.overview.legendDnr': 'DNR：ネイティブ、Chrome が適用',
  'workbench.docs.diagrams.headerActions.overview.legendScript': 'Script：パッチした fetch / XHR（マージのみ）',

  // ── Header actions: add / replace ───────────────────────────────────
  'workbench.docs.diagrams.headerActions.override.aria':
    '追加 / 置換：同じルールが両方のケースをカバーします。既存の X-Auth ヘッダー値を置き換えるか、なければヘッダーを追加します。どちらも同じ結果に至ります。',
  'workbench.docs.diagrams.headerActions.override.rule': 'Override X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.replaceLabel': '置換',
  'workbench.docs.diagrams.headerActions.override.addLabel': '追加',
  'workbench.docs.diagrams.headerActions.override.replaceSub': 'ヘッダーが既にある',
  'workbench.docs.diagrams.headerActions.override.addSub': 'X-Auth ヘッダーがまだない',
  'workbench.docs.diagrams.headerActions.override.beforeOld': 'X-Auth: old-value',
  'workbench.docs.diagrams.headerActions.override.lineContentType': 'Content-Type: html',
  'workbench.docs.diagrams.headerActions.override.afterNew': 'X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.noHeaderNote': '（X-Auth なし）',
  'workbench.docs.diagrams.headerActions.override.arrowReplaced': '値を置換',
  'workbench.docs.diagrams.headerActions.override.arrowAdded': 'ヘッダーを追加',
  'workbench.docs.diagrams.headerActions.override.stamp': 'どちらでも → あなたの値を持つ X-Auth ヘッダーが 1 つ',
  'workbench.docs.diagrams.headerActions.override.wontAria':
    '追加 / 置換は、ルールの条件がリクエストに一致しないと適用されません。何もせずに黙って終わります。提案：Request Domains または URL Pattern の条件を確認してください。',
  'workbench.docs.diagrams.headerActions.override.wontTitle': '一致しないドメインへのリクエスト',
  'workbench.docs.diagrams.headerActions.override.wontDetail': '条件が操作を制御します。一致なし、操作なし。',
  'workbench.docs.diagrams.headerActions.override.wontSuggestion':
    'ルールの Request Domains または URL Pattern を確認してください。',

  // ── Header actions: append ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.append.aria':
    '追記は同じ名前の 2 行目のヘッダーを追加し、両方が届きます。適用前は Set-Cookie 行が 1 つ、適用後は 2 つで、新しいものがハイライトされます。',
  'workbench.docs.diagrams.headerActions.append.rule': 'Append Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.lineSession': 'Set-Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.append.arrowLabel': '+1 重複行',
  'workbench.docs.diagrams.headerActions.append.afterNew': 'Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.stamp1': 'Set-Cookie 行が 2 つ。両方が届きます。',
  'workbench.docs.diagrams.headerActions.append.stamp2':
    'Set-Cookie、Link、Via など、重複を許すヘッダーに使ってください。',
  'workbench.docs.diagrams.headerActions.append.wontAria':
    '追記は重複に対応しないヘッダーにはきれいに適用されません。ブラウザーは 1 つだけを保持します。置き換えるには上書きを、連結するにはマージを使ってください。',
  'workbench.docs.diagrams.headerActions.append.wontTitle': '重複を許さないヘッダー',
  'workbench.docs.diagrams.headerActions.append.wontDetail':
    '例：Authorization、Host、Content-Type。ブラウザーは 1 つだけを保持します。',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion1': '値を置き換えるには上書きを使ってください。',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion2': '既存の値に付け足すにはマージを使ってください。',

  // ── Header actions: remove ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.remove.aria':
    '削除は対象のヘッダーを消します。適用前は X-Frame-Options に取り消し線、適用後は生き残った Content-Type ヘッダーだけが表示されます。',
  'workbench.docs.diagrams.headerActions.remove.rule': 'Remove X-Frame-Options',
  'workbench.docs.diagrams.headerActions.remove.beforeStruck': 'X-Frame-Options: DENY',
  'workbench.docs.diagrams.headerActions.remove.lineContentType': 'Content-Type: text/html',
  'workbench.docs.diagrams.headerActions.remove.arrowLabel': '対象を削除',
  'workbench.docs.diagrams.headerActions.remove.stamp1': 'X-Frame-Options のすべてのインスタンスが消えます。',
  'workbench.docs.diagrams.headerActions.remove.stamp2': '同じヘッダーの重複行はすべて一度に削除されます。',
  'workbench.docs.diagrams.headerActions.remove.wontAria':
    '削除は対象のヘッダーがなければ何もしません。エラーは出ません。代わりに別の値を設定したいなら上書きを使ってください。',
  'workbench.docs.diagrams.headerActions.remove.wontTitle': 'ヘッダーが既にない',
  'workbench.docs.diagrams.headerActions.remove.wontDetail':
    '何もしません。エラーはなく、リクエストは変更されずにそのまま通ります。',
  'workbench.docs.diagrams.headerActions.remove.wontSuggestion':
    '削除ではなく値を設定したかったなら、上書きを使ってください。',

  // ── Header actions: merge ───────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.merge.aria':
    'マージは実行時に既存のヘッダー値を読み、あなたの値を区切り文字で結合し、元の値を置き換えます。',
  'workbench.docs.diagrams.headerActions.merge.rule': "Merge Cookie + new=val  (sep: '; ')",
  'workbench.docs.diagrams.headerActions.merge.lineSession': 'Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.merge.arrowLabel': '区切り文字で結合',
  'workbench.docs.diagrams.headerActions.merge.afterNew': 'new=val',
  'workbench.docs.diagrams.headerActions.merge.stamp1': '既存の値 + あなたの値を、区切り文字で結合します。',
  'workbench.docs.diagrams.headerActions.merge.stamp2':
    "デフォルトの区切り文字：Cookie は '; '、その他のヘッダーは ', '。",
  'workbench.docs.diagrams.headerActions.merge.wontAria':
    'マージは JS が開始した fetch / XHR だけを傍受します。ページのナビゲーションと静的リソースは変更されずに通ります。それらには上書きまたは追記（DNR）を使ってください。',
  'workbench.docs.diagrams.headerActions.merge.wontTitle1': 'ページのナビゲーション',
  'workbench.docs.diagrams.headerActions.merge.wontDetail1':
    'JS が開始した fetch / XHR だけがスクリプトエンジンを通ります。',
  'workbench.docs.diagrams.headerActions.merge.wontTitle2': '静的リソース（img、script、link）',
  'workbench.docs.diagrams.headerActions.merge.wontDetail2':
    'ブラウザーが発行します。fetch / XHR には決して触れません。',
  'workbench.docs.diagrams.headerActions.merge.wontSuggestion':
    'ページレベルのヘッダーには上書きまたは追記（DNR）を使ってください。',

  // ── Conditions: shared ──────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.shared.ruleLabel': 'ルール：',
  'workbench.docs.diagrams.conditions.shared.testRequests': 'テストリクエスト：',
  'workbench.docs.diagrams.conditions.shared.testedAgainst': 'テストした URL：',
  'workbench.docs.diagrams.conditions.shared.beforeKicker': '適用前',
  'workbench.docs.diagrams.conditions.shared.afterKicker': '適用後',
  'workbench.docs.diagrams.conditions.shared.legendLiteral': 'リテラル：完全一致',
  'workbench.docs.diagrams.conditions.shared.usePrefix': '代わりに ',
  'workbench.docs.diagrams.conditions.shared.useSuffix': ' を使ってください。',
  'workbench.docs.diagrams.conditions.shared.requestDomainsName': 'Request Domains',
  'workbench.docs.diagrams.conditions.shared.urlPatternName': 'URL Pattern',
  'workbench.docs.diagrams.conditions.shared.initiatorDomainsName': 'Initiator Domains',

  // ── Conditions: host vs origin ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.hostVsOrigin.aria':
    '1 つの fetch に 2 つの URL：アドレスバーの URL がオリジン（Initiator Domains）、fetch の宛先 URL がホスト（Request Domains）',
  'workbench.docs.diagrams.conditions.hostVsOrigin.title': '2 つの URL、2 つの条件',
  'workbench.docs.diagrams.conditions.hostVsOrigin.pageDoes': 'このページの JS が行うこと：',
  'workbench.docs.diagrams.conditions.hostVsOrigin.fetchOpen': "fetch('",
  'workbench.docs.diagrams.conditions.hostVsOrigin.sameFetch': '同じ fetch、2 つの異なる URL。',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginTerm': 'origin',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginRest': '：ページの URL → 次が確認：',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostTerm': 'host',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostRest': '：fetch の宛先 → 次が確認：',

  // ── Conditions: matching attributes ─────────────────────────────────
  'workbench.docs.diagrams.conditions.matching.aria':
    '各条件はリクエストの 1 つの属性を確認します。右の色付きピルは各行の属性を確認する条件の種類を示します。すべての条件は AND で結合されます。',
  'workbench.docs.diagrams.conditions.matching.title': '各条件はリクエストの 1 つの属性を確認する',
  'workbench.docs.diagrams.conditions.matching.colAttribute': 'リクエストの属性',
  'workbench.docs.diagrams.conditions.matching.colCheckedBy': '確認する条件',
  'workbench.docs.diagrams.conditions.matching.attrMethod': 'メソッド：',
  'workbench.docs.diagrams.conditions.matching.attrUrl': 'URL：',
  'workbench.docs.diagrams.conditions.matching.attrHost': 'ホスト：',
  'workbench.docs.diagrams.conditions.matching.attrOrigin': 'オリジン：',
  'workbench.docs.diagrams.conditions.matching.attrType': '種類：',
  'workbench.docs.diagrams.conditions.matching.attrParty': 'パーティ：',
  'workbench.docs.diagrams.conditions.matching.attrHeader': 'ヘッダー：',
  'workbench.docs.diagrams.conditions.matching.condMethods': 'Methods',
  'workbench.docs.diagrams.conditions.matching.condUrlPattern': 'URL Pattern',
  'workbench.docs.diagrams.conditions.matching.condRequestDomains': 'Request Domains',
  'workbench.docs.diagrams.conditions.matching.condInitiatorDomains': 'Initiator Domains',
  'workbench.docs.diagrams.conditions.matching.condResourceTypes': 'Resource Types',
  'workbench.docs.diagrams.conditions.matching.condDomainType': 'Domain Type',
  'workbench.docs.diagrams.conditions.matching.condHeaders': 'Headers',
  'workbench.docs.diagrams.conditions.matching.allMustMatch': 'すべて一致が必要（AND）',
  'workbench.docs.diagrams.conditions.matching.ruleFires': '→ ルールが発火',

  // ── Conditions: rule fires ──────────────────────────────────────────
  'workbench.docs.diagrams.conditions.ruleFires.aria':
    'すべての条件が一致するとルールが発火し、リクエストがブラウザーを離れる前に Authorization ヘッダーが置き換えられます',
  'workbench.docs.diagrams.conditions.ruleFires.title': '条件が一致 → ルールが発火 → リクエストが変わる',
  'workbench.docs.diagrams.conditions.ruleFires.opOverride': '上書き',
  'workbench.docs.diagrams.conditions.ruleFires.ruleValue': 'Authorization: Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.beforeOld': 'Bearer OLD',
  'workbench.docs.diagrams.conditions.ruleFires.afterNew': 'Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.lineSession': 'session=abc',
  'workbench.docs.diagrams.conditions.ruleFires.arrowRule': 'ルール',
  'workbench.docs.diagrams.conditions.ruleFires.arrowFires': '発火',
  'workbench.docs.diagrams.conditions.ruleFires.footer': 'ルールは対象だけを変え、残りはそのまま通ります。',

  // ── Conditions: request domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.requestDomains.aria':
    'Request Domains：1 つのエントリが apex ドメインとすべてのサブドメインを自動的に含み、どのパスやクエリでも一致します',
  'workbench.docs.diagrams.conditions.requestDomains.title':
    'Request Domains：1 つのエントリ、すべてのサブドメイン、どのパスでも',
  'workbench.docs.diagrams.conditions.requestDomains.autoIncludes': '自動的に含む',
  'workbench.docs.diagrams.conditions.requestDomains.hostOnly':
    'ホストのみの一致。どのパスやクエリ文字列でも該当します',
  'workbench.docs.diagrams.conditions.requestDomains.doesntMatch': '一致しないもの：',
  'workbench.docs.diagrams.conditions.requestDomains.reasonTld': 'TLD が異なる（.com ≠ .io）',
  'workbench.docs.diagrams.conditions.requestDomains.reasonNotSub':
    '真のサブドメインではない。「openheaders.com」の前にドットがない',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathPrefix': 'パスで絞りたい？ルールに ',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathSuffix': ' を追加してください。',
  'workbench.docs.diagrams.conditions.requestDomains.footerCross':
    'クロスドメイン？各ドメインを別のエントリとして追加してください。',

  // ── Conditions: exclude domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.excludeDomains.aria':
    'Exclude Domains は別の条件の一致からホストを差し引きます。単独では何にも一致しません',
  'workbench.docs.diagrams.conditions.excludeDomains.title': 'Exclude Domains：別の条件から差し引く',
  'workbench.docs.diagrams.conditions.excludeDomains.subtitle': '別の条件の一致から差し引きます',
  'workbench.docs.diagrams.conditions.excludeDomains.includeKicker': '+ REQUEST DOMAINS',
  'workbench.docs.diagrams.conditions.excludeDomains.excludeKicker': '− EXCLUDE DOMAINS',
  'workbench.docs.diagrams.conditions.excludeDomains.finalHosts': '最終的に一致したホスト：',
  'workbench.docs.diagrams.conditions.excludeDomains.excluded': '除外',
  'workbench.docs.diagrams.conditions.excludeDomains.excludedSub':
    '除外。サブドメインの規則は Exclude にも適用されます',
  'workbench.docs.diagrams.conditions.excludeDomains.warnTitle': 'Exclude 単独では何にも一致しません。',
  'workbench.docs.diagrams.conditions.excludeDomains.warnBody': '別の条件の一致から差し引くだけです。',

  // ── Conditions: initiator domains ───────────────────────────────────
  'workbench.docs.diagrams.conditions.initiatorDomains.aria':
    'Initiator Domains：同じ宛先、異なるページオリジン、正反対の結果',
  'workbench.docs.diagrams.conditions.initiatorDomains.title': 'Initiator Domains：どのページが呼び出したかで一致',
  'workbench.docs.diagrams.conditions.initiatorDomains.subtitle': '同じ fetch、2 つのページコンテキスト → 異なる結果',
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Initiator Domains: portal.openheaders.com',
  'workbench.docs.diagrams.conditions.initiatorDomains.openPage': '開いているページ',
  'workbench.docs.diagrams.conditions.initiatorDomains.fetches': '↓ fetch',
  'workbench.docs.diagrams.conditions.initiatorDomains.matches': '✓ 一致',
  'workbench.docs.diagrams.conditions.initiatorDomains.noMatch': '✗ 不一致',
  'workbench.docs.diagrams.conditions.initiatorDomains.initiatorEq': 'initiator =',
  'workbench.docs.diagrams.conditions.initiatorDomains.footerQ': 'オリジンではなく宛先で一致させたい？',

  // ── Conditions: methods ─────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.methods.aria':
    'Methods：HTTP メソッドの複数選択。選択した（オレンジの）メソッドだけが一致します',
  'workbench.docs.diagrams.conditions.methods.title': 'Methods：一致させる HTTP メソッドを選ぶ',
  'workbench.docs.diagrams.conditions.methods.subtitle':
    '複数選択。オレンジのメソッドが一致し、残りはルールを発火させません',
  'workbench.docs.diagrams.conditions.methods.testGet': 'GET /api/users',
  'workbench.docs.diagrams.conditions.methods.testPost': 'POST /api/login',
  'workbench.docs.diagrams.conditions.methods.testPut': 'PUT /api/users/1',
  'workbench.docs.diagrams.conditions.methods.testDelete': 'DELETE /api/users/1',
  'workbench.docs.diagrams.conditions.methods.notSelected': 'メソッドが選択リストにない',
  'workbench.docs.diagrams.conditions.methods.footerQ': 'すべてのメソッドに一致させたい？',
  'workbench.docs.diagrams.conditions.methods.footerA':
    'この条件を削除してください。デフォルトはすべてのメソッドです。',

  // ── Conditions: resource types ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.resourceTypes.aria':
    'Resource Types：リクエスト種別の複数選択。選択した紫の種別が一致し、他は飛ばされます',
  'workbench.docs.diagrams.conditions.resourceTypes.title': 'Resource Types：リクエスト種別の複数選択',
  'workbench.docs.diagrams.conditions.resourceTypes.subtitle': '紫の種別が一致し、残りはルールを発火させません',
  'workbench.docs.diagrams.conditions.resourceTypes.testVisit': '/dashboard を訪問',
  'workbench.docs.diagrams.conditions.resourceTypes.testImage': 'GET /img/logo.png',
  'workbench.docs.diagrams.conditions.resourceTypes.testScript': 'GET /js/app.js',
  'workbench.docs.diagrams.conditions.resourceTypes.kindXhr': 'xhr',
  'workbench.docs.diagrams.conditions.resourceTypes.kindPage': 'page',
  'workbench.docs.diagrams.conditions.resourceTypes.kindImageSkipped': 'image：スキップ',
  'workbench.docs.diagrams.conditions.resourceTypes.kindScriptSkipped': 'script：スキップ',
  'workbench.docs.diagrams.conditions.resourceTypes.footerQ': 'すべてのリソース種別に一致させたい？',
  'workbench.docs.diagrams.conditions.resourceTypes.footerA':
    'この条件を削除してください。デフォルトはすべての種別です。',

  // ── Conditions: domain type ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.domainType.aria':
    'Domain Type：各リクエストはファーストパーティ（同じ登録可能ドメイン）またはサードパーティに分類され、ルールのセレクターがどちらの種類を一致させるかを決めます',
  'workbench.docs.diagrams.conditions.domainType.title': 'Domain Type：ファーストパーティとサードパーティ',
  'workbench.docs.diagrams.conditions.domainType.subtitle': 'ページとリクエスト URL の関係で分類',
  'workbench.docs.diagrams.conditions.domainType.pageLabel': 'ページ：',
  'workbench.docs.diagrams.conditions.domainType.ruleSelection': 'ルールの選択：',
  'workbench.docs.diagrams.conditions.domainType.pillFirstParty': 'firstParty',
  'workbench.docs.diagrams.conditions.domainType.pillThirdParty': 'thirdParty',
  'workbench.docs.diagrams.conditions.domainType.colDestination': '宛先',
  'workbench.docs.diagrams.conditions.domainType.colType': '種類',
  'workbench.docs.diagrams.conditions.domainType.colMatch': '一致',
  'workbench.docs.diagrams.conditions.domainType.partyFirst': 'ファーストパーティ',
  'workbench.docs.diagrams.conditions.domainType.partyThird': 'サードパーティ',
  'workbench.docs.diagrams.conditions.domainType.footerBoth':
    '両方欲しい？firstParty と thirdParty を両方選んでください。',
  'workbench.docs.diagrams.conditions.domainType.footerRemove': 'または条件を削除してください。デフォルトは両方です。',

  // ── Conditions: response headers ────────────────────────────────────
  'workbench.docs.diagrams.conditions.headers.aria':
    'Response Headers 条件：完全一致の名前と完全一致の値で、レスポンス側のみ（Chrome DNR はリクエストヘッダーでは一致しません）',
  'workbench.docs.diagrams.conditions.headers.title': 'Response Headers：完全一致の名前 + 完全一致の値',
  'workbench.docs.diagrams.conditions.headers.subtitle':
    'レスポンス側のみ。Chrome DNR はリクエストヘッダーでは一致しません',
  'workbench.docs.diagrams.conditions.headers.exactName': '完全一致の名前',
  'workbench.docs.diagrams.conditions.headers.exactValue': '完全一致の値',
  'workbench.docs.diagrams.conditions.headers.testHeaders': 'テストするレスポンスヘッダー：',
  'workbench.docs.diagrams.conditions.headers.testJson': 'Content-Type: application/json',
  'workbench.docs.diagrams.conditions.headers.testHtml': 'Content-Type: text/html',
  'workbench.docs.diagrams.conditions.headers.testServer': 'Server: nginx',
  'workbench.docs.diagrams.conditions.headers.reasonValue': '名前は一致するが値が異なる',
  'workbench.docs.diagrams.conditions.headers.reasonName': 'ヘッダー名が異なる',
  'workbench.docs.diagrams.conditions.headers.absentLine': '（Content-Type のないレスポンス）',
  'workbench.docs.diagrams.conditions.headers.reasonAbsent': 'ヘッダーがない。一致するには存在が必要',
  'workbench.docs.diagrams.conditions.headers.footer':
    'よくある用途：レスポンスの Content-Type やカスタムフラグでルールをフィルター',

  // ── Conditions: URL pattern ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlPattern.aria':
    'URL Pattern は完全な URL にワイルドカードを使います。パターンの構造と、一致 / 不一致の例',
  'workbench.docs.diagrams.conditions.urlPattern.title': 'URL Pattern：完全な URL に対するワイルドカード（*）',
  'workbench.docs.diagrams.conditions.urlPattern.labelAny': '任意の',
  'workbench.docs.diagrams.conditions.urlPattern.labelProtocol': 'プロトコル',
  'workbench.docs.diagrams.conditions.urlPattern.labelLiteralHost': 'リテラルのホスト',
  'workbench.docs.diagrams.conditions.urlPattern.labelNoWildcards': '（ワイルドカードなし）',
  'workbench.docs.diagrams.conditions.urlPattern.labelAnyPath': '任意のパス',
  'workbench.docs.diagrams.conditions.urlPattern.labelQueryString': '+ クエリ文字列',
  'workbench.docs.diagrams.conditions.urlPattern.legendWildcard': 'ワイルドカード：何にでも一致',
  'workbench.docs.diagrams.conditions.urlPattern.reasonSubdomain': '「cdn」≠「api」：サブドメインの不一致',
  'workbench.docs.diagrams.conditions.urlPattern.reasonHost': 'まったく別のホスト',
  'workbench.docs.diagrams.conditions.urlPattern.footerQ': 'すべてのサブドメインに一度に一致させたい？',
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Request Domains: openheaders.com',

  // ── Conditions: URL regex ───────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlRegex.aria':
    'URL Regex の構造と、一致 / 不一致の例。紫の部分が本物の正規表現で、それ以外はリテラルです',
  'workbench.docs.diagrams.conditions.urlRegex.title': 'URL Regex：完全な URL に対する RE2 正規表現',
  'workbench.docs.diagrams.conditions.urlRegex.labelStart': '先頭',
  'workbench.docs.diagrams.conditions.urlRegex.labelAnchor': 'アンカー',
  'workbench.docs.diagrams.conditions.urlRegex.labelLiteralChars': 'リテラル文字',
  'workbench.docs.diagrams.conditions.urlRegex.labelDotNote': '（\\. は . の文字に一致）',
  'workbench.docs.diagrams.conditions.urlRegex.labelOneOrMore': '1 個以上の',
  'workbench.docs.diagrams.conditions.urlRegex.labelDigits': '数字',
  'workbench.docs.diagrams.conditions.urlRegex.legendRegex': '正規表現の構文：特別な意味',
  'workbench.docs.diagrams.conditions.urlRegex.reasonHttp': '正規表現は https:// を指定。http は一致しない',
  'workbench.docs.diagrams.conditions.urlRegex.reasonLatest': '「latest」は /v[0-9]+ に一致しない',
  'workbench.docs.diagrams.conditions.urlRegex.footerQ': 'http と https の両方が欲しい？',
  'workbench.docs.diagrams.conditions.urlRegex.footerUsePrefix': '代わりに ',
  'workbench.docs.diagrams.conditions.urlRegex.footerMid': ' を使ってください。',
  'workbench.docs.diagrams.conditions.urlRegex.footerEnd': ' が s を省略可能にします。',

  // ── Actions: rule anatomy ───────────────────────────────────────────
  'workbench.docs.diagrams.actions.ruleAnatomy.aria':
    'ルールの構造：送信 HTTP リクエストはルールの AND 結合された条件と照合され、すべて一致すればブラウザーを離れる前に操作がリクエストを変更します。',
  'workbench.docs.diagrams.actions.ruleAnatomy.title': 'ルール = 条件 + 操作',
  'workbench.docs.diagrams.actions.ruleAnatomy.subtitle':
    '条件がルールを発火させるかを決め、操作が何を変えるかを決めます。',
  'workbench.docs.diagrams.actions.ruleAnatomy.outgoingRequest': '送信リクエスト',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideBefore': '適用前',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideAfter': '適用後',
  'workbench.docs.diagrams.actions.ruleAnatomy.addedTag': '追加',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowCheck': '確認',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowApply': '適用',
  'workbench.docs.diagrams.actions.ruleAnatomy.ruleLabel': 'ルール',
  'workbench.docs.diagrams.actions.ruleAnatomy.editorEntity': 'エディターのエンティティ',
  'workbench.docs.diagrams.actions.ruleAnatomy.conditionsKicker': '条件',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionKicker': '操作',
  'workbench.docs.diagrams.actions.ruleAnatomy.condMethods': 'Methods',
  'workbench.docs.diagrams.actions.ruleAnatomy.condRequestDomains': 'Request Domains',
  'workbench.docs.diagrams.actions.ruleAnatomy.condHeaders': 'Headers',
  'workbench.docs.diagrams.actions.ruleAnatomy.allMustMatch': 'すべて一致が必要（AND）',
  'workbench.docs.diagrams.actions.ruleAnatomy.onePerRule': 'ルールごとに 1 つ',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionCard': 'ヘッダー操作 · 追加',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionValue': 'Bearer abc123…',
  'workbench.docs.diagrams.actions.ruleAnatomy.categoryLine': 'カテゴリ：リクエストを変更',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictConditions': '条件がフィルターし',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictAction': '操作が変換し',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictResult': 'リクエストは変更されて出ていく',

  // ── Actions: taxonomy ───────────────────────────────────────────────
  'workbench.docs.diagrams.actions.taxonomy.aria':
    '操作の分類：3 つのカテゴリ（リクエストを変更、レスポンスを変更、コードを実行）に、すべての操作をその実行エンジン（DNR または Script）とともに列挙。',
  'workbench.docs.diagrams.actions.taxonomy.title': '操作：カテゴリ別',
  'workbench.docs.diagrams.actions.taxonomy.subtitle':
    'すべての操作は 3 つのカテゴリのいずれかに属します。エンジンのタグはどこで実行されるかを示します。',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequest': 'リクエストを変更',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequestSub': 'ブラウザーを離れる前に',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponse': 'レスポンスを変更',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponseSub': 'ページが見る前に',
  'workbench.docs.diagrams.actions.taxonomy.catRunCode': 'コードを実行',
  'workbench.docs.diagrams.actions.taxonomy.catRunCodeSub': 'ページの中またはそのスケジューラーで',
  'workbench.docs.diagrams.actions.taxonomy.nameHeaderActions': 'ヘッダー操作',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderOps': '追加 · 追記 · 削除 · マージ',
  'workbench.docs.diagrams.actions.taxonomy.nameBlock': 'ブロック',
  'workbench.docs.diagrams.actions.taxonomy.subBlock': 'ネットワーク層でキャンセル',
  'workbench.docs.diagrams.actions.taxonomy.nameRedirect': 'リダイレクト',
  'workbench.docs.diagrams.actions.taxonomy.subRedirect': '静的 URL または正規表現',
  'workbench.docs.diagrams.actions.taxonomy.nameQueryParams': 'クエリパラメーター',
  'workbench.docs.diagrams.actions.taxonomy.subQueryParams': '追加 · 置換 · 削除',
  'workbench.docs.diagrams.actions.taxonomy.nameRequestBody': 'リクエストボディ',
  'workbench.docs.diagrams.actions.taxonomy.subRequestBody': '静的 · 動的 · GraphQL',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderResponse': 'レスポンス側のヘッダー',
  'workbench.docs.diagrams.actions.taxonomy.nameResponseBody': 'レスポンスボディ',
  'workbench.docs.diagrams.actions.taxonomy.subResponseBody': 'モックボディ · ステータス · ヘッダー',
  'workbench.docs.diagrams.actions.taxonomy.nameInject': 'JS / CSS を注入',
  'workbench.docs.diagrams.actions.taxonomy.subInject': 'ページスクリプトの前、または DOM の後',
  'workbench.docs.diagrams.actions.taxonomy.nameDelay': '遅延',
  'workbench.docs.diagrams.actions.taxonomy.subDelay': 'ナビゲーション + fetch / XHR',
  'workbench.docs.diagrams.actions.taxonomy.verdict': 'カテゴリを選び · 操作を選び · 条件と組み合わせる',

  // ── System status: shared ───────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.shared.sync': '同期',
  'workbench.docs.diagrams.systemStatus.shared.rules': 'ルール',
  'workbench.docs.diagrams.systemStatus.shared.requests': 'リクエスト',
  'workbench.docs.diagrams.systemStatus.shared.permissions': '権限',
  'workbench.docs.diagrams.systemStatus.shared.secrets': 'シークレット',
  'workbench.docs.diagrams.systemStatus.shared.live': 'Live',
  'workbench.docs.diagrams.systemStatus.shared.systemStatus': 'システムステータス',
  'workbench.docs.diagrams.systemStatus.shared.noEventsYet': 'イベントはまだなし',
  'workbench.docs.diagrams.systemStatus.shared.green': '緑',
  'workbench.docs.diagrams.systemStatus.shared.yellow': '黄',
  'workbench.docs.diagrams.systemStatus.shared.red': '赤',
  'workbench.docs.diagrams.systemStatus.shared.desktopApp': 'デスクトップアプリ',
  'workbench.docs.diagrams.systemStatus.shared.swWakes': 'SW ウェイク',

  // ── System status: surfaces ─────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.aria':
    'ワークベンチの面：OpenHeaders のワークベンチタブ。ステータス行は下部フッターにあり、サブシステムごとに 1 つのピルがあります。',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.title': 'ワークベンチ：フッターのステータス行',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.callout':
    '↑ 6 つのピル。サブシステムごとに 1 つで、クリックするとポップオーバーが開きます。',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.aria':
    'ポップアップの面：拡張機能のポップアップはツールバーアイコンから開きます。ステータスピルはポップアップの下部フッターに、ドット + 「システムステータス」ラベルとしてあります。',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.title': 'ポップアップ：フッターのシステムステータスピル',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.wsChip': 'ws ▾',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.callout':
    '↑ ドット + 「システムステータス」ラベルがポップアップのフッター帯にあります。',

  // ── System status: worst-level aggregator ───────────────────────────
  'workbench.docs.diagrams.systemStatus.worstLevel.aria':
    '最悪状態の集約：6 つのサブシステムの状態が 1 つの合成ドットに流れ込みます。最悪の色が勝ちます：赤は黄に、黄は緑に勝ちます。',
  'workbench.docs.diagrams.systemStatus.worstLevel.title': '最悪の色が勝つ',
  'workbench.docs.diagrams.systemStatus.worstLevel.subtitle': '赤 > 黄 > 緑 · 灰 = イベントはまだなし（緑として扱う）',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgConnected': '接続済み',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgActive': '12 件アクティブ',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgNoEvents': 'イベントはまだなし',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgHostNarrowed': 'ホストが絞られた',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgCipher': 'cipher の復号',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgFresh': '3 件が新鮮',
  'workbench.docs.diagrams.systemStatus.worstLevel.maxFn': 'max()',
  'workbench.docs.diagrams.systemStatus.worstLevel.composite': '合成',
  'workbench.docs.diagrams.systemStatus.worstLevel.dot': 'ドット',
  'workbench.docs.diagrams.systemStatus.worstLevel.footer':
    'どこかに赤が 1 つ → 合成は赤。ポップアップ / サイドパネルのドットを駆動します。',

  // ── System status: popover ──────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.popover.aria':
    'ステータスポップオーバーのレイアウト：イベントのまだないサブシステムの灰色の行が、報告済みのサブシステムの色付きの行の上に表示されます。',
  'workbench.docs.diagrams.systemStatus.popover.title': 'ポップオーバーの順序：灰が先、次に色付き',
  'workbench.docs.diagrams.systemStatus.popover.subtitle': '各段の中では、サブシステムの正規の順序が保たれます',
  'workbench.docs.diagrams.systemStatus.popover.header': '● システムステータス',
  'workbench.docs.diagrams.systemStatus.popover.msgConnected': '接続済み',
  'workbench.docs.diagrams.systemStatus.popover.msgActiveRules': '12 件のアクティブなルール',
  'workbench.docs.diagrams.systemStatus.popover.msgHostsNarrowed': 'ホストが絞られました',
  'workbench.docs.diagrams.systemStatus.popover.msgCipherFailed': 'cipher の復号に失敗しました',
  'workbench.docs.diagrams.systemStatus.popover.dividerNote': '↑ イベントはまだなし · ↓ 報告済み',
  'workbench.docs.diagrams.systemStatus.popover.footer': '最初の報告で、行は灰 → 色付きへ一度だけ移ります。',

  // ── System status: sync topology ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncTopology.aria':
    '同期のトポロジー：拡張機能のサービスワーカーが 127.0.0.1:8137 のデスクトップアプリへ 1 本の WebSocket を持ち、ワークスペース、変数、チーム同期のデータをやり取りします。',
  'workbench.docs.diagrams.systemStatus.syncTopology.title': '同期サブシステムの接続のしかた',
  'workbench.docs.diagrams.systemStatus.syncTopology.extension': '拡張機能',
  'workbench.docs.diagrams.systemStatus.syncTopology.serviceWorker': 'service worker',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsClient': 'WS クライアント',
  'workbench.docs.diagrams.systemStatus.syncTopology.onYourMachine': 'あなたのマシン上',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsServer': 'WS サーバー',
  'workbench.docs.diagrams.systemStatus.syncTopology.webSocket': 'WebSocket',
  'workbench.docs.diagrams.systemStatus.syncTopology.carries': '運ぶもの：動的変数 · ワークスペース · チーム同期',
  'workbench.docs.diagrams.systemStatus.syncTopology.loopback': 'ループバックのみ。あなたのマシンを決して離れません。',

  // ── System status: sync lifecycle ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncLifecycle.aria':
    'シーケンス図としての同期接続のライフサイクル：拡張機能のサービスワーカーがデスクトップアプリに接続し、ステータスピルは時間とともに緑から黄、そして緑へ遷移します',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.title': '同期ピルが時間とともに変わるしかた',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.extensionSw': '拡張機能 SW',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.syncPill': '同期ピル',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.readsSettings': '設定を読む',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.autoConnectOff': '自動接続 = オフなら →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateDisabled': '無効',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnecting': '接続中',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnected': '接続済み',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry1': '再試行 #1',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry2': '再試行 #2',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.otherwise': 'それ以外 →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.wsConnect': 'WebSocket 接続',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.handshakeOk': 'ハンドシェイク OK',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.pingPong': 'ping ⇄ pong',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.connectionDrops': '✗ 接続が落ちる',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.backoff': 'バックオフ',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retryConnect': '接続を再試行',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.footer':
    '再試行の間は指数バックオフ · ping がプロキシの静かな切断を検出',

  // ── System status: rules pipeline ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesPipeline.aria':
    'ルールのパイプライン：ユーザーのルールがコンパイルされ、変数を解決し、上限チェックを通り、Chrome が適用します。各段階は問題があればステータスのレベルを出せます。',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.title': 'ルールがライブの DNR エントリになるまで',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageYourRule': 'あなたのルール',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCompile': 'コンパイル',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageResolve': '{{VAR}} を解決',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCapCheck': '上限チェック',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageChromeApply': 'Chrome が適用',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageLiveRule': 'ライブルール',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subToDnrJson': 'DNR JSON へ',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subResolveScopes': 'vault · 環境 · ワークスペース',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subMatches': 'リクエストに一致',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outUnresolved': '未解決 → 黄',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outOverCap': '上限超過 → 黄',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outRejected': '拒否 → 赤',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outActive': 'N 件アクティブ → 緑',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerRebuild': '再ビルドは保存のたびに走ります。',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerPaused':
    '一時停止は緑のまま（「ルールの実行を一時停止中」）。',

  // ── System status: rules capacity ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesCapacity.aria':
    'DNR の容量バー：警告しきい値までは緑、切り詰め上限までは黄、それを超えると赤。上限を超えるルールは破棄されるため、実行時に赤のゾーンに達することはありません。',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.title': 'ルールの容量：各ルール数の着地点',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneHealthy': '✓ 正常',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneApproach': '接近',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneTruncated': '切り詰め',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countHealthy': '1,200',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countApproaching': '4,500',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countOver': '5,600',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnLabel': '警告',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capLabel': '上限',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnValue': '4,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capValue': '5,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerDrop':
    '上限を超えるルールは一致順で破棄されます（上が勝ち）。',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerCeiling':
    'Chrome の固い天井は 30,000 と、はるかに先にあります。',

  // ── System status: request outcomes ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.aria':
    'リクエスト実行器の結果：4xx や 5xx を含め、どの HTTP レスポンスでもピルは緑になります。レスポンスのないネットワークレベルの失敗だけが黄にします。',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.title': '何がリクエストピルをどの色にする？',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.requestEditor': 'リクエストエディター',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.sendButton': '送信 ▸',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.executorFires': '実行器が動く',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.gotResponse': '✓ HTTP レスポンスあり',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.anyStatus': 'どのステータスコードでも数える',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOk': 'OK',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exNotFound': 'Not Found',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exServerError': 'Server Error',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exAborted': '中止',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOffline': 'オフライン / DNS',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillGreen': 'ピル → 緑',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillYellow': 'ピル → 黄',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.noResponse': '✗ レスポンスなし',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.networkFailure': 'ネットワークレベルの失敗',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.footer':
    '500 でも「緑」です。リクエストは完了し、ただ 500 が返っただけです。',

  // ── System status: request scope ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsScope.aria':
    'リクエスト実行器の範囲：送信ボタンのリクエストだけがピルを更新します。ライブワークフローの更新は静かで、Web ページのトラフィックは代わりにルールエンジンを使います。',
  'workbench.docs.diagrams.systemStatus.requestsScope.title': '何がリクエストピルを更新する？',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcSend': 'リクエストエディターの送信 ▸',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcLive': 'ライブワークフローの更新',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcWebpage': 'Web ページの fetch / XHR',
  'workbench.docs.diagrams.systemStatus.requestsScope.subUser': 'ユーザーが開始',
  'workbench.docs.diagrams.systemStatus.requestsScope.subBackground': 'バックグラウンドのティック',
  'workbench.docs.diagrams.systemStatus.requestsScope.subObserved': 'ルールエンジンが観測',
  'workbench.docs.diagrams.systemStatus.requestsScope.updatesPill': 'ピルを更新',
  'workbench.docs.diagrams.systemStatus.requestsScope.differentSystem': '別のシステム',
  'workbench.docs.diagrams.systemStatus.requestsScope.noUpdate': '更新なし',
  'workbench.docs.diagrams.systemStatus.requestsScope.footer':
    'アドホックな送信ボタンのトラフィックだけがこのピルを形作ります。',

  // ── System status: permissions impact ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsImpact.aria':
    '同じルール、2 つの権限状態。all_urls が付与されていれば DNR ルールは発火します。ホストが取り消されていればルールは黙って何もせず、ヘッダーは決して届きません。',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.title': '同じルール、2 つの権限状態',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.granted': '付与済み',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.narrowed': '絞られた',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.hostRevoked': 'ホストが取り消し',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.addHeader': 'ヘッダーを追加',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.page': 'ページ',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.fetchCall': 'fetch()',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.applies': '適用',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.noOp': '何もしない',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerArrives': '✓ ヘッダーが届く',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerMissing': '✗ ヘッダーがない',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.ruleFired': 'ルールが発火',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.silentNoOp': '黙って何もしない',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer1':
    '絞られたホストはエラーになりません。ルールはただ黙って何もしません。',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer2':
    'アクセスを復元するまで、ピルの赤が唯一の手がかりです。',

  // ── System status: permissions audit ────────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsAudit.aria':
    '監査がいつ実行され、各結果がどのステータスレベルを報告するか。',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.title': '監査はいつ実行され、各分岐は何を報告する？',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.firstHydration': '最初のハイドレート',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.happyPath': '正常系',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.userRevoked': 'ユーザーがホストを取り消した',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.apiUnavailable': 'API が利用不可',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.throws': '例外',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAllGranted': '「すべて付与済み」',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgHostsNarrowed': '「ホストが絞られました」',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAuditFailed': '「監査に失敗しました」',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer1': 'MV3 には権限変更のオブザーバーがないため、',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer2': '再確認は SW のウェイクごとに走ります。',

  // ── System status: vault hydration ──────────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultHydration.aria':
    'Vault のハイドレート：vault の blob がストレージから読み込まれ、すべてのエントリがスキーマを通ります。一致は保持され、ドリフトのエントリは破棄されて黄として報告されます。',
  'workbench.docs.diagrams.systemStatus.vaultHydration.title': 'SW ウェイク時の Vault ハイドレート',
  'workbench.docs.diagrams.systemStatus.vaultHydration.blobSuffix': '（暗号化された blob）',
  'workbench.docs.diagrams.systemStatus.vaultHydration.schemaValidator': 'スキーマバリデーター',
  'workbench.docs.diagrams.systemStatus.vaultHydration.matchesSchema': 'スキーマに一致',
  'workbench.docs.diagrams.systemStatus.vaultHydration.driftOldShape': 'ドリフト：古い形',
  'workbench.docs.diagrams.systemStatus.vaultHydration.kept': '✓ 保持',
  'workbench.docs.diagrams.systemStatus.vaultHydration.dropped': '✗ 破棄',
  'workbench.docs.diagrams.systemStatus.vaultHydration.secretsYellow': 'シークレット · 黄',
  'workbench.docs.diagrams.systemStatus.vaultHydration.keptEntries': '保持されたエントリ',
  'workbench.docs.diagrams.systemStatus.vaultHydration.hydrateCleanly': 'きれいにハイドレート',

  // ── System status: vault drift detail ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultDrift.aria':
    'スキーマドリフトの実際の見え方：有効なエントリは uid、label、cipher を持ち、ドリフトのエントリは cipher フィールドが欠けているかもしれません。バリデーターは不正な行を破棄し、黄のステータスを出します。',
  'workbench.docs.diagrams.systemStatus.vaultDrift.title': '「スキーマドリフト」の実際の見え方',
  'workbench.docs.diagrams.systemStatus.vaultDrift.validEntry': '有効なエントリ',
  'workbench.docs.diagrams.systemStatus.vaultDrift.driftEntry': 'ドリフトのエントリ',
  'workbench.docs.diagrams.systemStatus.vaultDrift.apiToken': 'API token',
  'workbench.docs.diagrams.systemStatus.vaultDrift.oldToken': '古い token',
  'workbench.docs.diagrams.systemStatus.vaultDrift.missing': '— 欠落 —',
  'workbench.docs.diagrams.systemStatus.vaultDrift.issue': 'スキーマの問題 2 件 → 破棄',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer1':
    'ドリフトのエントリはハイドレート時に破棄され、ピルは黄になります。',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer2':
    'Vault エディターから再保存するとエントリの現在の形が復元されます。',

  // ── System status: live freshness ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveFreshness.aria':
    'ライブワークフローの状態ごとの規則：新鮮、古い / 不安定、失敗中。実際のしきい値に固定。',
  'workbench.docs.diagrams.systemStatus.liveFreshness.title': 'ワークフローごとの状態の規則',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFresh': '新鮮',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateStale': '古い / 不安定',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFailing': '失敗中',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFresh': '前回の実行 OK · 周期の 2 倍以内 · 失敗 0',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleStale': '周期の 2 倍を超過  · または  1〜4 回の連続失敗',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFailing': '5 回以上の連続失敗',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFresh': '例：毎回の更新が 200 を得る',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egStale': '例：1 回のタイムアウト、再試行中',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFailing': '例：API が 1 時間ダウン',
  'workbench.docs.diagrams.systemStatus.liveFreshness.footer': '周期 = ワークフローに構成された更新間隔。',

  // ── System status: live aggregation ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveAggregation.aria':
    'Live ピルの集約：アクティブなワークスペースの 3 つのワークフローが max で 1 つの合成に畳まれます。非アクティブなワークスペースのワークフローは除外されます。',
  'workbench.docs.diagrams.systemStatus.liveAggregation.title':
    'アクティブなワークスペースのワークフローが 1 つのピルに畳まれる',
  'workbench.docs.diagrams.systemStatus.liveAggregation.activeWorkspace': 'アクティブなワークスペース',
  'workbench.docs.diagrams.systemStatus.liveAggregation.contributes': 'ピルに寄与',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgFresh': '新鮮',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgConsecFails': '2 回の連続失敗',
  'workbench.docs.diagrams.systemStatus.liveAggregation.otherWorkspaces': '他のワークスペース',
  'workbench.docs.diagrams.systemStatus.liveAggregation.excluded': '意図的に除外',
  'workbench.docs.diagrams.systemStatus.liveAggregation.skipped': '✗ ユーザーは対処できないためスキップ',
  'workbench.docs.diagrams.systemStatus.liveAggregation.livePill': 'Live ピル',
  'workbench.docs.diagrams.systemStatus.liveAggregation.maxYellow': 'max() = 黄',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer1':
    '最悪状態のワークフロー 1 つがピル全体を切り替えます。',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer2':
    'ワークスペースを切り替えると、ピルはそのワークスペースの実行に対して再計算されます。',

  // ── Open Headers: shared ────────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shared.openHeaders': 'Open Headers',
  'workbench.docs.diagrams.openHeaders.shared.stampBestInClass': '同クラス最高',
  'workbench.docs.diagrams.openHeaders.shared.badgeToday': '現在',
  'workbench.docs.diagrams.openHeaders.shared.badgeRoadmap': 'ロードマップ',
  'workbench.docs.diagrams.openHeaders.shared.supports': '対応',
  'workbench.docs.diagrams.openHeaders.shared.inBrowser': 'ブラウザー内',
  'workbench.docs.diagrams.openHeaders.shared.desktopApp': 'デスクトップアプリ',
  'workbench.docs.diagrams.openHeaders.shared.localServer': 'ローカルサーバー',
  'workbench.docs.diagrams.openHeaders.shared.yourVm': '自分の VM',
  'workbench.docs.diagrams.openHeaders.shared.workbench': 'Workbench',
  'workbench.docs.diagrams.openHeaders.shared.devtools': 'DevTools',
  'workbench.docs.diagrams.openHeaders.shared.soon': '近日',

  // ── Open Headers: paradigm shift ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shift.aria':
    'パラダイムシフト：Open Headers とこの分野の他のすべてのツールとの対比をグループ化。すべてが 1 つのブラウザー拡張機能に、アカウント不要、ローカルのみ、トラッキングなし、9 種類のルールに 1 つのエンジン、フィールドレベルの同期、機能制限のないフル機能の無料枠、シートベースの価格、失効してもロックアウトなし。対するは市場の残り。',
  'workbench.docs.diagrams.openHeaders.shift.title': 'パラダイムシフト',
  'workbench.docs.diagrams.openHeaders.shift.everyoneElse': '他のすべて',
  'workbench.docs.diagrams.openHeaders.shift.groupArchitecture': 'アーキテクチャと到達範囲',
  'workbench.docs.diagrams.openHeaders.shift.groupPrivacy': 'プライバシーと所有権',
  'workbench.docs.diagrams.openHeaders.shift.groupCapability': '機能',
  'workbench.docs.diagrams.openHeaders.shift.groupSync': '同期と回復力',
  'workbench.docs.diagrams.openHeaders.shift.groupPricing': '価格と信頼',
  'workbench.docs.diagrams.openHeaders.shift.stampUnique': '唯一',
  'workbench.docs.diagrams.openHeaders.shift.stampUserControlled': 'ユーザーが制御',
  'workbench.docs.diagrams.openHeaders.shift.stampNoGates': '機能制限なし',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserPrimary': 'すべてがブラウザーの中に',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserSub': 'バックエンド + フロントエンド',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserTag': '- 拡張機能の中に',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserPrimary': 'バックエンドはブラウザーの外',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserSub': 'デスクトップアプリ / クラウド、インターネット必須',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostPrimary': 'バックエンドをセルフホスト',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostSub': 'ブラウザー · デスクトップアプリ · サーバー · VM',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostPrimary': '彼らのクラウドのみ',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostSub': 'データの置き場所を選べない',
  'workbench.docs.diagrams.openHeaders.shift.usOfflinePrimary': 'フロントエンドはネイティブにオフライン動作',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineSub': '拡張機能 · デスクトップ · CLI · Web',
  'workbench.docs.diagrams.openHeaders.shift.themOfflinePrimary': 'クラウドのみのフロントエンド（オンライン）',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineSub': 'バックエンドへのアクセスにインターネットが必要',
  'workbench.docs.diagrams.openHeaders.shift.usAccountPrimary': 'アカウント不要',
  'workbench.docs.diagrams.openHeaders.shift.usAccountSub': 'サインインなし、ログインの壁なし',
  'workbench.docs.diagrams.openHeaders.shift.themAccountPrimary': 'サインインが必要',
  'workbench.docs.diagrams.openHeaders.shift.themAccountSub': '自分のデータを使うために',
  'workbench.docs.diagrams.openHeaders.shift.usLocalPrimary': 'ローカルのみ',
  'workbench.docs.diagrams.openHeaders.shift.usLocalSub': 'クラウドの中継なし',
  'workbench.docs.diagrams.openHeaders.shift.themLocalPrimary': 'クラウド中継',
  'workbench.docs.diagrams.openHeaders.shift.themLocalSub': 'あなたのトラフィックは彼らを経由',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingPrimary': 'トラッキングなし',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingSub': '匿名のカウンター · スイッチ 1 つでオフ',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingPrimary': 'デフォルトでトラッキング',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingSub': '使用データが送られる',
  'workbench.docs.diagrams.openHeaders.shift.usEnginePrimary': 'ルールエンジン',
  'workbench.docs.diagrams.openHeaders.shift.usEngineSub': 'リクエストを傍受して変更',
  'workbench.docs.diagrams.openHeaders.shift.themEnginePrimary': 'ブラウザー内エンジンなし',
  'workbench.docs.diagrams.openHeaders.shift.themEngineSub': '別のプロキシまたはアプリが必要',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogPrimary': 'API リクエストカタログ',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogSub': 'HTTP、WS、GraphQL。すべてブラウザー内',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogPrimary': 'プラットフォームにサインインし',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogSub': '彼らのアプリをインストール',
  'workbench.docs.diagrams.openHeaders.shift.usAutomatePrimary': 'ワークスペースを自動化',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateSub': 'あなたの AI エージェント、ローカルでもリモートでも',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateTag': '- あなたが決める',
  'workbench.docs.diagrams.openHeaders.shift.themAutomatePrimary': 'プライベートか彼らのクラウド AI のみ',
  'workbench.docs.diagrams.openHeaders.shift.themAutomateSub': 'オープンなアクセスもプログラムからのアクセスもなし',
  'workbench.docs.diagrams.openHeaders.shift.usSyncPrimary': 'リアルタイム同期エンジン',
  'workbench.docs.diagrams.openHeaders.shift.usSyncSub': 'マルチデバイス、ブラウザー、面',
  'workbench.docs.diagrams.openHeaders.shift.themSyncPrimary': '後勝ち',
  'workbench.docs.diagrams.openHeaders.shift.themSyncSub': 'または同期がまったくない',
  'workbench.docs.diagrams.openHeaders.shift.usSavePrimary': '競合のない同時保存',
  'workbench.docs.diagrams.openHeaders.shift.usSaveSub': 'フィールドレベル、すべての変更がコミットされる',
  'workbench.docs.diagrams.openHeaders.shift.themSavePrimary': 'エンティティレベルの上書き',
  'workbench.docs.diagrams.openHeaders.shift.themSaveSub': '保存が互いを消し合う',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditPrimary': 'オフラインで動作、完全に編集可能',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditSub': '復帰時に自動的に同期',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditPrimary': 'オンライン接続が必要',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditSub': 'またはまったくアクセスできない',
  'workbench.docs.diagrams.openHeaders.shift.usTierPrimary': '今日のすべてを、すべての枠で',
  'workbench.docs.diagrams.openHeaders.shift.usTierSub': '無料 ≤ 6 ユーザー · 有料 = チームシート',
  'workbench.docs.diagrams.openHeaders.shift.themTierPrimary': '機能制限のある枠',
  'workbench.docs.diagrams.openHeaders.shift.themTierSub': '中核機能はアップセルの向こう',
  'workbench.docs.diagrams.openHeaders.shift.usSsoPrimary': 'SSO とセキュリティは常に無料',
  'workbench.docs.diagrams.openHeaders.shift.usSsoSub': 'SSO/OIDC · RBAC · 監査 · SIEM',
  'workbench.docs.diagrams.openHeaders.shift.themSsoPrimary': 'SSO 税',
  'workbench.docs.diagrams.openHeaders.shift.themSsoSub': 'セキュリティはエンタープライズのアドオンとして販売',
  'workbench.docs.diagrams.openHeaders.shift.usLapsePrimary': '失効してもロックアウトされない',
  'workbench.docs.diagrams.openHeaders.shift.usLapseSub': '猶予、次に無料枠。データはあなたのもの',
  'workbench.docs.diagrams.openHeaders.shift.themLapsePrimary': '支払いを止めるとアクセスを失う',
  'workbench.docs.diagrams.openHeaders.shift.themLapseSub': '自分のデータの上のペイウォール',
  'workbench.docs.diagrams.openHeaders.shift.footer': 'ローカルファースト。設計として。後付けではなく。',

  // ── Open Headers: API catalog ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.apiCatalog.aria':
    'API リクエストカタログ：メソッドピッカー、URL バー、タブ帯、ボディのプレビューを示す様式化されたリクエストエディターのモックアップと、プロトコル、認証、スクリプト、変数、ファイル、コレクション、Cookie をカバーする機能の帯。',
  'workbench.docs.diagrams.openHeaders.apiCatalog.title': 'API リクエストカタログ',
  'workbench.docs.diagrams.openHeaders.apiCatalog.subtitle':
    'リクエストの構築、送信、コレクション管理のすべてを、拡張機能の中で。',
  'workbench.docs.diagrams.openHeaders.apiCatalog.send': '送信 ▸',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabParams': 'Params',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabAuth': '認可',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabHeaders': 'ヘッダー',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabBody': 'ボディ',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabScripts': 'スクリプト',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabSettings': '設定',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuth': '認証',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuthSub': 'OAuth 2.0 · Basic · Bearer · API Key',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScripts': 'スクリプト',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScriptsSub': 'プリリクエスト + ポストレスポンス',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariables': '変数',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariablesSub': '5 つのスコープ · 構造化された診断',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFiles': 'ファイル',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFilesSub': 'multipart · {{file.X}} の解決',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollections': 'コレクション',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollectionsSub': 'フォルダー · 環境 · リクエストごと',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookies': 'Cookies',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookiesSub': 'オプトインの credentialsMode',
  'workbench.docs.diagrams.openHeaders.apiCatalog.kicker':
    'デスクトップ API クライアントが備えるすべてを、拡張機能の中で',
  'workbench.docs.diagrams.openHeaders.apiCatalog.footer': 'フルの API プラットフォームを、プラットフォームなしで。',

  // ── Open Headers: rule engine ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.ruleEngine.aria':
    'Open Headers のルールエンジン：2 つの実行経路（DNR ネイティブとスクリプトベースの傍受）、エンジン別にグループ化された 9 つのルール種別カテゴリ、そしてすべてのルールが読む共通の条件言語と変数スコープチェーン。',
  'workbench.docs.diagrams.openHeaders.ruleEngine.title': 'ルールエンジン',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subtitle': 'MV3 ネイティブ · 2 つのエンジン · 9 つのルールカテゴリ',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerDnr': 'DNR · ネイティブ',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerScript': 'Script · 傍受',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeaders': 'ヘッダー',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeaders': '上書き · 追記 · 削除',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameBlock': 'ブロック',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subBlock': 'ネットワーク層でキャンセル',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRedirect': 'リダイレクト',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRedirect': '静的 URL または正規表現',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameQueryParams': 'クエリパラメーター',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subQueryParams': '追加 · 置換 · 削除 · すべて削除',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeadersMerge': 'ヘッダー（マージ）',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeadersMerge': '値の連結',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameInject': '注入',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subInject': 'JS または CSS、2 つのタイミング',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameDelay': '遅延',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subDelay': 'ナビゲーション + fetch/XHR',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRequestBody': 'リクエストボディ',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRequestBody': '静的 · 動的 · GraphQL フィルター',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameResponseBody': 'レスポンスボディ',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subResponseBody': 'ボディ + ステータス + ヘッダー',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionDnr': 'ブラウザーが発行するすべてのリクエストを捕捉',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionScript': 'JS が開始した fetch / XHR を捕捉',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsKicker': '1 つの条件言語',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsList':
    'Request Domains · URL Pattern · URL Regex · Methods · Resource · Initiator · Headers · Domain Type',
  'workbench.docs.diagrams.openHeaders.ruleEngine.scopesKicker': '5 つの変数スコープ',
  'workbench.docs.diagrams.openHeaders.ruleEngine.footer':
    '1 つのエンジン。2 つの実行経路。完全な条件 + 変数言語。拡張機能の中に。',

  // ── Open Headers: convergence ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.convergence.aria':
    '3 つの旧来の製品カテゴリ（デスクトッププロキシ、クラウド API プラットフォーム、ヘッダーのみの拡張機能）が 1 つの Open Headers ブラウザー拡張機能に収束します。様式化された Chromium ブラウザーが拡張機能のワークベンチページを開いており、3 つの旧来カテゴリが提供していたすべての機能がその 1 つのタブの中にあります。',
  'workbench.docs.diagrams.openHeaders.convergence.title': '3 つのツールカテゴリ。1 つの拡張機能。',
  'workbench.docs.diagrams.openHeaders.convergence.subtitle':
    'かつて 3 つの別々のインストールを要したものが、今は 1 つのブラウザータブの中にあります。',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxies': 'デスクトッププロキシ',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxiesSub': 'HTTP の傍受 · CA 証明書 · 別のバイナリ',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatforms': 'API プラットフォーム',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatformsSub':
    'リクエスト + コレクション · クラウドホスト · アカウント',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensions': 'ヘッダー拡張機能',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensionsSub': '1 種類のルール · スクリプトなし · 認証なし',
  'workbench.docs.diagrams.openHeaders.convergence.allInOneTab': '▼ すべて 1 つのタブで開く',
  'workbench.docs.diagrams.openHeaders.convergence.tabTitle': '#1 Open Headers',
  'workbench.docs.diagrams.openHeaders.convergence.workbenchSurface': 'ワークベンチの面',
  'workbench.docs.diagrams.openHeaders.convergence.mv3Chip': 'MV3 ネイティブ',
  'workbench.docs.diagrams.openHeaders.convergence.pillRuleEngine': 'ルールエンジン',
  'workbench.docs.diagrams.openHeaders.convergence.pillApiCatalog': 'API リクエストカタログ',
  'workbench.docs.diagrams.openHeaders.convergence.pillSync': 'リアルタイム同期エンジン',
  'workbench.docs.diagrams.openHeaders.convergence.pillSave': '競合のない保存',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoAccount': 'アカウント不要 · サインインなし',
  'workbench.docs.diagrams.openHeaders.convergence.pillLocalOnly': 'ローカルのみ · クラウドの中継なし',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoTracking': 'トラッキングなし · 個人データなし',
  'workbench.docs.diagrams.openHeaders.convergence.pillMultiSurface': 'マルチサーフェス UI',
  'workbench.docs.diagrams.openHeaders.convergence.footerStrip':
    'マルチサーフェス · デバイス間同期 · 設計としてローカルのみ',
  'workbench.docs.diagrams.openHeaders.convergence.caption': '青 = 機能 · 紫 = 姿勢 · 8 つすべてが 1 つのタブの中に',

  // ── Open Headers: field sync ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.fieldSync.aria':
    '2 つの面が同じルールを同時に編集します。DevTools はヘッダーを追加、変更、削除し、Workbench は同じルールの 3 つの別のフィールドを編集します。6 つの編集すべてがバナーも上書きもなくマージ済みのルールに着地します。',
  'workbench.docs.diagrams.openHeaders.fieldSync.title': '2 つの面、同じルール、両方の編集が着地',
  'workbench.docs.diagrams.openHeaders.fieldSync.subtitle':
    'フィールドごとの同期：バナーなし、上書きなし、失われる作業なし',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceA': '面 A',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceB': '面 B',
  'workbench.docs.diagrams.openHeaders.fieldSync.editingHeaders': 'ヘッダーを編集中',
  'workbench.docs.diagrams.openHeaders.fieldSync.ruleX': 'ルール X',
  'workbench.docs.diagrams.openHeaders.fieldSync.headersTag': 'ヘッダー',
  'workbench.docs.diagrams.openHeaders.fieldSync.syncBand': '同期エンジン · フィールドごとのマージ',
  'workbench.docs.diagrams.openHeaders.fieldSync.mergedTag': 'マージ済みスナップショット · ヘッダー',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupAdded': '追加',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupModified': '変更',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupRemoved': '削除',
  'workbench.docs.diagrams.openHeaders.fieldSync.fromPrefix': '← 元：',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict1': '✓ 両方の編集が適用。バナーなし、競合なし',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict2':
    '同じ経路が拡大：今日は拡張機能 → 明日は拡張機能 + デスクトップ + CLI',

  // ── Open Headers: front-ends ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.frontEnds.aria':
    'フロントエンドを選ぶ：データにアクセスし管理する方法。4 つのフロントエンドの形態を縦に積む：ブラウザー拡張機能、デスクトップアプリ、CLI アプリ、Web アプリ。各カードは公開する面、接続できるバックエンド（最初のチップがデフォルト）、動作するプラットフォームを列挙します。',
  'workbench.docs.diagrams.openHeaders.frontEnds.title': 'フロントエンドを選ぶ：データにアクセスし管理する方法',
  'workbench.docs.diagrams.openHeaders.frontEnds.subtitle':
    '同じデータ、どのフロントエンドでも。1 つ選んでも全部使っても、すべての面が同期を保ちます。',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleExtension': 'ブラウザー拡張機能',
  'workbench.docs.diagrams.openHeaders.frontEnds.subExtension': 'ブラウザーの中',
  'workbench.docs.diagrams.openHeaders.frontEnds.subDesktop': 'ネイティブウィンドウ',
  'workbench.docs.diagrams.openHeaders.frontEnds.subCli': 'コマンドライン',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleWeb': 'Web アプリ',
  'workbench.docs.diagrams.openHeaders.frontEnds.subWeb': 'ブラウザータブ',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfPopup': 'Popup',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfSidePanel': 'サイドパネル',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfCommandLine': 'コマンドライン',
  'workbench.docs.diagrams.openHeaders.frontEnds.chipEmbedded': '埋め込み',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectSurfaces': '面',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectBackEnds': '接続先のバックエンド',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip1': 'フロントエンドを 1 つ選んでも全部選んでも、同じデータ',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip2':
    '✓ 拡張機能 · ✓ デスクトップ · ✓ CLI · ✓ Web。すべて同じ正規のエンティティを読む',
  'workbench.docs.diagrams.openHeaders.frontEnds.footer':
    '同じデータに、どの方法で到達しても、すべての面が同期を保ちます。',

  // ── Open Headers: local-first ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.localFirst.aria':
    'バックエンドを選ぶ：データの置き場所。4 つのホスティングの選択肢を縦に積む。各段は前の段のすべての機能を引き継ぎ、緑の点線の四角でハイライトされた新しいものを加えます。右の「対応」列は各段が動作するブラウザー、OS、クラウドプロバイダーを列挙します。4 つの段すべてがローカルのみ。',
  'workbench.docs.diagrams.openHeaders.localFirst.title': 'バックエンドを選ぶ：データの置き場所',
  'workbench.docs.diagrams.openHeaders.localFirst.subtitle':
    '各段は前の段を引き継ぎます。緑の枠が新しいもの、右の列が動作場所を示します。',
  'workbench.docs.diagrams.openHeaders.localFirst.subBrowser': '拡張機能のサービスワーカー',
  'workbench.docs.diagrams.openHeaders.localFirst.subDesktop': '埋め込みバックエンド',
  'workbench.docs.diagrams.openHeaders.localFirst.subServer': 'スタンドアロンのプロセス',
  'workbench.docs.diagrams.openHeaders.localFirst.subVm': 'どこでもホスト',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletZeroSetup': 'セットアップ不要',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSingleDevice': '単一デバイス',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerBrowser': 'ブラウザーごとのインスタンス',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiSurface': 'マルチサーフェスの同時編集',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiWindow': 'マルチウィンドウの同時編集',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLocalhostOnly': 'localhost のみ',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiBrowser': '複数ブラウザーのインスタンス',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerApp': 'アプリごとのインスタンス',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFilesystem': 'ネイティブのファイルシステム',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletYaml': 'ディスク上の YAML',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletGit': 'git 統合（ローカル / リモート）',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMinimalSetup': '最小限のセットアップ',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLan': 'LAN から到達可能',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiApp': '複数アプリのインスタンス',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiDevice': '複数のデバイス',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFrontEnds': 'ブラウザー拡張 · デスクトップアプリ · CLI',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletStandardSetup': '標準的なセットアップ',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletWan': 'WAN / インターネットから到達可能',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletTeamReady': 'チーム対応',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSso': 'SSO 認証',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletRbac': 'RBAC ユーザー管理',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletAudit': '監査ログとレポート',
  'workbench.docs.diagrams.openHeaders.localFirst.platAllOs': 'すべての OS',
  'workbench.docs.diagrams.openHeaders.localFirst.platEmbedded': '埋め込み',
  'workbench.docs.diagrams.openHeaders.localFirst.platHyperscalers': 'ハイパースケーラー',
  'workbench.docs.diagrams.openHeaders.localFirst.platEuNative': 'EU ネイティブ',
  'workbench.docs.diagrams.openHeaders.localFirst.platOther': 'その他',
  'workbench.docs.diagrams.openHeaders.localFirst.platEnterprise': 'エンタープライズ',
  'workbench.docs.diagrams.openHeaders.localFirst.itemMiniPc': 'ミニ PC',
  'workbench.docs.diagrams.openHeaders.localFirst.itemHomeServer': 'ホームサーバー',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOldLaptop': '古いノート PC',
  'workbench.docs.diagrams.openHeaders.localFirst.itemYourCloud': '自分のクラウド',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOnPrem': 'オンプレミス',
  'workbench.docs.diagrams.openHeaders.localFirst.inheritsFrom': '{tier} から引き継ぐ',
  'workbench.docs.diagrams.openHeaders.localFirst.newInTier': '+ この段で新しいもの',
  'workbench.docs.diagrams.openHeaders.localFirst.strip1': 'どれを選んでも、端から端まであなたが所有',
  'workbench.docs.diagrams.openHeaders.localFirst.strip2':
    '✓ アカウント不要 · ✓ クラウドの中継なし · ✓ トラッキングなし · ✓ 個人データなし',
  'workbench.docs.diagrams.openHeaders.localFirst.footer':
    'あなたのデータ、あなたのバックエンド、あなたの選択。すべての段階で。',

  // ── Open Headers: comparison matrix ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.matrix.aria':
    'SaaS API プラットフォーム、デスクトッププロキシ、ヘッダーのみの拡張機能を Open Headers と比較する 4 枚のカテゴリカード。',
  'workbench.docs.diagrams.openHeaders.matrix.title': 'OPEN HEADERS の位置',
  'workbench.docs.diagrams.openHeaders.matrix.catSaas': 'SaaS API プラットフォーム',
  'workbench.docs.diagrams.openHeaders.matrix.catProxies': 'デスクトッププロキシ',
  'workbench.docs.diagrams.openHeaders.matrix.catHeaderOnly': 'ヘッダーのみの拡張機能',
  'workbench.docs.diagrams.openHeaders.matrix.tagCloud': 'クラウド',
  'workbench.docs.diagrams.openHeaders.matrix.tagNative': 'ネイティブ',
  'workbench.docs.diagrams.openHeaders.matrix.tagLite': 'ライト',
  'workbench.docs.diagrams.openHeaders.matrix.tagUs': '当方',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasData': 'データは彼らのサーバー上',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasAccount': 'アカウント + ログインが必要',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasFeatures': '幅広い機能',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyBinary': 'インストールして実行する別のバイナリ',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyCert': 'CA 証明書 + アプリごとのプロキシ設定',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyTraffic': 'あらゆる種類のトラフィックを見る',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoSetup': 'ブラウザー内、セットアップ不要',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteOneRule': '1 種類のルール：ヘッダーのみ',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoScripts': 'スクリプトなし、認証なし、ボディ編集なし',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsLocal': 'ブラウザー内 · ローカルのみ · アカウント不要',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsNine': '9 種類のルール · 1 つの条件言語',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsScripts': 'スクリプト + OAuth + ファイルを拡張機能の中で',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsSurfaces': '4 つの面が 1 つのストアを共有',

  // ── Open Headers: vs cloud ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsCloud.aria':
    'クラウド API プラットフォームとの比較。クラウドプラットフォームは資格情報、ルール定義、リクエストログをベンダーのサーバーに置きます。Open Headers は 3 つすべてをユーザーのデバイスに置きます。',
  'workbench.docs.diagrams.openHeaders.vsCloud.title': 'データの行き着く先',
  'workbench.docs.diagrams.openHeaders.vsCloud.subtitle':
    '資格情報、ルール定義、リクエストログ。ローカルか、リモートか？',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowCredentials': '資格情報',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowRules': 'ルール定義',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowLogs': 'リクエストログ',
  'workbench.docs.diagrams.openHeaders.vsCloud.onDevice': 'あなたのデバイス上',
  'workbench.docs.diagrams.openHeaders.vsCloud.onVendor': 'ベンダーのサーバー上',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloudPlatform': 'クラウド API プラットフォーム',
  'workbench.docs.diagrams.openHeaders.vsCloud.you': 'あなた',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourData': 'あなたのデータ',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloud': 'クラウド',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourDevice': 'あなたのデバイス',
  'workbench.docs.diagrams.openHeaders.vsCloud.deviceContents': '資格情報 · ルール · ログ',
  'workbench.docs.diagrams.openHeaders.vsCloud.allInOnePlace': 'すべて 1 か所に',
  'workbench.docs.diagrams.openHeaders.vsCloud.verdict': 'データはあなたのマシンを決して離れない',

  // ── Open Headers: vs header-only ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.aria':
    'ヘッダーのみの拡張機能との比較。ヘッダーのみの拡張機能は 1 種類のルールを扱います。Open Headers は 9 種類を扱います：ヘッダー、ブロック、リダイレクト、クエリパラメーター、ヘッダーのマージ、注入、遅延、リクエストボディ、レスポンスボディ。',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.title': 'ルールの種類はいくつ',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.subtitle':
    '1 つのことをする 1 つのツールか、9 つのことをする 1 つのツールか。',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.headerOnlyExtension': 'ヘッダーのみの拡張機能',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeaders': 'ヘッダー',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeadersSub': '上書き',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlock': 'ブロック',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlockSub': 'キャンセル',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirect': 'リダイレクト',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirectSub': '静的 / 正規表現',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuery': 'クエリ',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuerySub': '追加 · 削除',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMerge': 'マージ',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMergeSub': 'ヘッダー ⊕',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInject': '注入',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInjectSub': 'JS / CSS',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelay': '遅延',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelaySub': 'ナビ / fetch',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBody': 'リクエストボディ',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBodySub': '静的 · 動的',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBody': 'レスポンスボディ',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBodySub': 'ボディ / ステータス',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionLeft': '他の 8 つのどれかが必要？別の拡張機能をインストール',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionRight': '同じ条件、同じ面、1 つのワークスペース',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.verdict': '9 種類のルール、1 つの条件言語、1 つの観測できる面',

  // ── Open Headers: vs proxy ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsProxy.aria':
    'デスクトッププロキシとの比較。プロキシは CA 証明書の背後にある別のプロセスにトラフィックを経由させます。Open Headers はブラウザーのネイティブ API を通じてルールをインラインで適用します。プロキシポートも証明書もありません。',
  'workbench.docs.diagrams.openHeaders.vsProxy.title': 'リクエストの形作られ方',
  'workbench.docs.diagrams.openHeaders.vsProxy.subtitle':
    'ブラウザー内のインラインルール。プロキシポートなし、CA 証明書なし、アプリごとの設定なし。',
  'workbench.docs.diagrams.openHeaders.vsProxy.desktopProxy': 'デスクトッププロキシ',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampDetour': '回り道',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampInline': 'インライン',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeApp': 'アプリ',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeAppSub': '設定済み',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodePortSub': 'プロキシポート',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxy': 'プロキシ',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxySub': 'CA 証明書',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeInternet': 'インターネット',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeBrowser': 'ブラウザー',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallBinary': 'バイナリをインストール',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallCert': 'CA 証明書をインストール',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipPerApp': 'アプリごとの設定',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallExtension': '拡張機能をインストール',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipThatsIt': 'それだけ',
  'workbench.docs.diagrams.openHeaders.vsProxy.verdict':
    '1 回のインストール · 証明書ゼロ · ルールはページ自身の権限で動く',

  // ── Open Headers: roadmap CLI ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapCli.aria':
    'ロードマップのマイルストーン：CLI。ルールの一覧、環境の切り替え、保存済みリクエストの送信のコマンド例を示すターミナルウィンドウ。すべて UI と同じサーバーと話します。',
  'workbench.docs.diagrams.openHeaders.roadmapCli.title': 'CLI · ヘッドレスのスクリプティング',
  'workbench.docs.diagrams.openHeaders.roadmapCli.subtitle':
    'UI と同じサーバー。自動化は目に見えるものと同期を保ちます。',
  'workbench.docs.diagrams.openHeaders.roadmapCli.termTitle': 'oh · ターミナル',
  'workbench.docs.diagrams.openHeaders.roadmapCli.comment': '# UI と同じサーバー · 同じワークスペース',
  'workbench.docs.diagrams.openHeaders.roadmapCli.verdict': '一覧 · 切替 · 送信 · 差分。シェルから直接',

  // ── Open Headers: roadmap daemon ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapServer.aria':
    'ロードマップのマイルストーン：ローカル / LAN サーバー。中央にサーバー。拡張機能、デスクトップアプリ、CLI がすべて LAN 越しにクライアントとして接続します。',
  'workbench.docs.diagrams.openHeaders.roadmapServer.title': 'ローカル / LAN サーバー · 1 つの同期ハブ',
  'workbench.docs.diagrams.openHeaders.roadmapServer.subtitle':
    '拡張機能 · デスクトップ · CLI。すべて同じサーバーのクライアントで、すべてあなたのネットワーク上。',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackWorkspaces': 'ワークスペース',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackRules': 'ルール · vault',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackSync': '同期エンジン',
  'workbench.docs.diagrams.openHeaders.roadmapServer.lanReachable': 'LAN から到達可能',
  'workbench.docs.diagrams.openHeaders.roadmapServer.clientExtension': 'ブラウザー拡張',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideLaptop': 'ノート PC',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideWorkstation': 'ワークステーション',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfExtension': 'Popup · Workbench · DevTools',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfDesktop': 'Workbench · マルチウィンドウ',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfCli': 'どのマシンでも · $ oh rules · $ oh env',
  'workbench.docs.diagrams.openHeaders.roadmapServer.verdict':
    '1 つのサーバー · 多くのクライアント · あなたのネットワークに留まる',

  // ── Open Headers: roadmap desktop app ───────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.aria':
    'ロードマップのマイルストーン：デスクトップアプリ。ブラウザー拡張機能とネイティブのデスクトップアプリが同じディスク上のストアの上で Workbench の面を公開します。デスクトップアプリは、ブラウザー拡張機能がネイティブにホストできないプロトコル（AI、MCP、gRPC、MQTT）を加えます。',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.title': 'ネイティブウィンドウ · 同じストア · さらなる到達範囲',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.subtitle':
    '同じ Workbench、同じワークスペース。デスクトップはブラウザーがホストできないプロトコルを加えます。',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.cardExtension': 'ブラウザー拡張機能',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.tagToday': '現在',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerSurface': '面',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerFeatures': '機能',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerApiCatalog': 'API カタログ',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featHttpRules': 'ブラウザーインターセプター',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featVariables': '変数',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featWorkflows': 'ワークフロー',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featApiCatalog': 'API カタログ',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.noteLocalRemote': 'ローカル / リモート',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.desktopOnly': '+ デスクトップのみ',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.browserFeasible': '4 つすべてがブラウザーで実現可能です。',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.storePill': '同じディスク上のワークスペースストア',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.verdict':
    '1 つのワークスペース、2 つのフロントエンド、ブラウザーが行けない場所へのさらなる到達範囲',

  // ── Open Headers: roadmap git workspaces ────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapGit.aria':
    'ロードマップのマイルストーン：Git によるチームワークスペース。2 台のデバイスがそれぞれワークスペースを持ち、両方が共有 Git リポジトリに push し、そこから pull します。リポジトリが同期層で、間にベンダーのサーバーはありません。',
  'workbench.docs.diagrams.openHeaders.roadmapGit.title': 'Git リポジトリとしてのワークスペース',
  'workbench.docs.diagrams.openHeaders.roadmapGit.subtitle':
    'pull で同期 · push で共有 · Git でマージ。ベンダーのサーバーなし。',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceA': 'デバイス A',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceB': 'デバイス B',
  'workbench.docs.diagrams.openHeaders.roadmapGit.workspace': 'ワークスペース',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceContents': 'ルール · 環境 · vault',
  'workbench.docs.diagrams.openHeaders.roadmapGit.verdict':
    'あなたのデータ、あなたのリポジトリ、あなたの監査可能な履歴',

  // ── Open Headers: roadmap importers ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapImporters.aria':
    'インポーター。6 つのソース形式が 1 つの Open Headers ワークスペースに流れ込みます：cURL、HAR ヘッダー、Postman、HAR 完全リクエスト、Insomnia、OpenAPI。すべて今日利用できます。',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.title': 'インポーター · コレクションを持ち込む',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.subtitle':
    'cURL、HAR、Postman、Insomnia、OpenAPI、完全な HAR リクエスト。すべて今日利用できます。',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarNote': 'ヘッダー',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcPostman': 'Postman コレクション',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarFull': 'HAR（完全リクエスト）',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcInsomnia': 'Insomnia コレクション',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcOpenApi': 'OpenAPI 仕様',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagToday': '現在',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagNext': '次',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.sideWorkspace': 'ワークスペース',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.kickerImported': 'インポート先',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetRules': 'ブラウザーインターセプター',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetCollections': 'API リクエストコレクション',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetEnvironments': '環境',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetVault': 'Vault エントリ',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.verdict': '1 ステップで持ち込んで、作業を続ける',

  // ── Open Headers: roadmap MCP architecture ──────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpArch.aria':
    'ロードマップのマイルストーン：MCP サーバーのアーキテクチャ。AI クライアントは Model Context Protocol（ローカルは stdio、リモートは HTTP/SSE）で Open Headers に接続します。OH MCP サーバーはユーザーのワークスペースを変更し、結果は Workbench に現れます。',
  'workbench.docs.diagrams.openHeaders.mcpArch.title':
    'MCP サーバー · あなたのワークスペース、どの AI クライアントでも',
  'workbench.docs.diagrams.openHeaders.mcpArch.subtitle':
    'Open Headers は Model Context Protocol を話します。MCP 対応のどのエージェントでもワークスペースを操作できます。',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientTitle': 'AI クライアント',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientSideTag': 'あなたのエージェント',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerAnyClient': 'どの MCP クライアントでも',
  'workbench.docs.diagrams.openHeaders.mcpArch.serverTitle': 'OH MCP サーバー',
  'workbench.docs.diagrams.openHeaders.mcpArch.sideTagOpenHeaders': 'open headers',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerExposes': '公開するもの',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRules': 'ルール · CRUD',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRequests': 'API リクエスト',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeEnvironments': '環境',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeVariables': '変数 · Vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeWorkflows': 'ワークフロー',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportLocal': 'ローカル',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportRemote': 'リモート',
  'workbench.docs.diagrams.openHeaders.mcpArch.mutates': '変更',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbTitle': 'Workbench · あなたのワークスペース',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbLive': 'ライブ',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbContents': 'ルール · 環境 · 変数 · ワークフロー · vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.verdict':
    'どの AI エージェントでもワークスペースを操作 · ローカルでもリモートでも',

  // ── Open Headers: roadmap MCP tools ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpTools.aria':
    'ロードマップのマイルストーン：MCP サーバーのツールカタログ。7 つのドメインが合計 {n} 個のツールを公開：ルール、リクエスト、環境、変数、ワークフロー、ワークスペース、アクティビティ。',
  'workbench.docs.diagrams.openHeaders.mcpTools.title': 'AI エージェントにできること',
  'workbench.docs.diagrams.openHeaders.mcpTools.subtitle':
    '7 つのドメイン。意味のある場所では完全な CRUD、そうでない場所では範囲を絞った読み取り専用。',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRules': 'ルール',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRules': 'ヘッダー · ブロック · リダイレクト · レスポンス',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRequests': 'リクエスト',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRequests': 'API カタログ',
  'workbench.docs.diagrams.openHeaders.mcpTools.domEnvironments': '環境',
  'workbench.docs.diagrams.openHeaders.mcpTools.subEnvironments': 'ワークスペースごと',
  'workbench.docs.diagrams.openHeaders.mcpTools.domVariables': '変数',
  'workbench.docs.diagrams.openHeaders.mcpTools.subVariables': 'すべてのスコープ · vault',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkflows': 'ワークフロー',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkflows': '連鎖する API 呼び出し',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkspaces': 'ワークスペース',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkspaces': 'マルチワークスペース',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCount': '{n} 個のツール',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCountOne': '1 個のツール',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityTitle': 'アクティビティ',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityNote':
    '変更フィード。エージェントは行動する前に何が変わったかを見る',
  'workbench.docs.diagrams.openHeaders.mcpTools.verdict': '{n} 個のツール · 7 つのドメイン · Open Headers の面全体',

  // ── Open Headers: roadmap milestones ────────────────────────────────
  'workbench.docs.diagrams.openHeaders.milestones.aria':
    'マイルストーン：ブラウザーウィンドウの枠の中に順に並ぶカード。Git ワークスペース、デスクトップアプリ、MCP サーバー、ローカルサーバー、CLI、セルフホストの Web アプリ、インポーター。すべて提供中。',
  'workbench.docs.diagrams.openHeaders.milestones.chromeTitle': 'すべての面を出荷済み',
  'workbench.docs.diagrams.openHeaders.milestones.addrSubtitle':
    '順番に出荷。どのマイルストーンでもローカルのみが製品のままでした。',
  'workbench.docs.diagrams.openHeaders.milestones.tagLive': '提供中',
  'workbench.docs.diagrams.openHeaders.milestones.badgeUserControlled': 'ユーザーが制御',
  'workbench.docs.diagrams.openHeaders.milestones.msGit': 'Git によるワークスペースのコラボレーション（チーム対応）',
  'workbench.docs.diagrams.openHeaders.milestones.descGit':
    'あなたが管理する Git リポジトリの YAML。Git で pull、push、マージ。',
  'workbench.docs.diagrams.openHeaders.milestones.descDesktop':
    '同じストア上のネイティブバイナリ。拡張機能が届かない場所に届く。',
  'workbench.docs.diagrams.openHeaders.milestones.msMcp': 'MCP サーバー（AI エージェントによる制御）',
  'workbench.docs.diagrams.openHeaders.milestones.descMcp':
    'MCP 越しの Open Headers。AI エージェントにワークスペースを操作させる。',
  'workbench.docs.diagrams.openHeaders.milestones.msServer': 'ローカル / LAN サーバー',
  'workbench.docs.diagrams.openHeaders.milestones.descServer':
    'あなたのマシンまたは LAN 上のサーバー。拡張機能、デスクトップ、CLI がクライアント。',
  'workbench.docs.diagrams.openHeaders.milestones.descCli':
    'ヘッドレスのスクリプティングと CI。シェルから一覧、切替、送信。',
  'workbench.docs.diagrams.openHeaders.milestones.msVm': 'セルフホストの VM デプロイ + Web アプリ',
  'workbench.docs.diagrams.openHeaders.milestones.descVm':
    'あなたの VM 上の Web バンドル。制限されたブラウザーやブランド化したデプロイ向け。',
  'workbench.docs.diagrams.openHeaders.milestones.msImporters': 'さらなるインポーター',
  'workbench.docs.diagrams.openHeaders.milestones.descImporters':
    'Postman の先へ。Insomnia、OpenAPI 仕様、完全な HAR のインポート。',
  'workbench.docs.diagrams.openHeaders.milestones.footer':
    'ユーザー間の同期は Git とセルフホストのデプロイを通じて提供されます。ベンダーがホストするクラウドはありません。',

  // ── Open Headers: roadmap web app ───────────────────────────────────
  'workbench.docs.diagrams.openHeaders.webApp.aria':
    'ロードマップのマイルストーン：セルフホストの Web アプリ。あなたのオリジンが同じ UI バンドルを配信し、ユーザーはあなたが管理するドメインのブラウザータブとして開きます。同じ Workbench の面で、拡張機能は不要です。',
  'workbench.docs.diagrams.openHeaders.webApp.title': 'セルフホストの VM デプロイ + Web アプリ',
  'workbench.docs.diagrams.openHeaders.webApp.subtitle':
    'あなたの VM が Web バンドルを配信。あなたのオリジン、あなたのドメイン、あなたのユーザー。',
  'workbench.docs.diagrams.openHeaders.webApp.serves': '配信',
  'workbench.docs.diagrams.openHeaders.webApp.chromeTitle': 'Open Headers · web',
  'workbench.docs.diagrams.openHeaders.webApp.bodySub': '拡張機能 + デスクトップと同じ面',
  'workbench.docs.diagrams.openHeaders.webApp.verdict': '同じ UI · あなたのオリジン · 拡張機能不要',

  // ── Root shared — kickers recurring across root-level diagrams ──────
  'workbench.docs.diagrams.shared.ruleKicker': 'ルール',
  'workbench.docs.diagrams.shared.useCasesKicker': 'よくある用途',
  'workbench.docs.diagrams.shared.wontFireKicker': '発火しないとき',
  'workbench.docs.diagrams.shared.suggestion': '提案',
  'workbench.docs.diagrams.shared.beforeKicker': '適用前',
  'workbench.docs.diagrams.shared.afterKicker': '適用後',

  // ── Block ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.block.aria':
    'ブロックは一致するリクエストをネットワーク層でキャンセルし、ページにはネットワークエラーが見えます。main_frame のブロックは ERR_BLOCKED_BY_CLIENT を描画し、サブリソースのブロックは静かに失敗します。',
  'workbench.docs.diagrams.block.rule': 'ブロック · Request Domains: ads.openheaders.com',
  'workbench.docs.diagrams.block.pageTitle': 'ページ',
  'workbench.docs.diagrams.block.dnrBlock': 'DNR ブロック',
  'workbench.docs.diagrams.block.network': 'ネットワーク',
  'workbench.docs.diagrams.block.neverReached': '到達しない',
  'workbench.docs.diagrams.block.requestCancelled': 'リクエストをキャンセル',
  'workbench.docs.diagrams.block.pageSeesKicker': 'ページに見えるもの',
  'workbench.docs.diagrams.block.chromeBlockPage': 'Chrome のブロックページ',
  'workbench.docs.diagrams.block.silentFailure': '静かな失敗',
  'workbench.docs.diagrams.block.pageHandlesError': 'ページが自身のエラーを処理',
  'workbench.docs.diagrams.block.useCasesAria':
    'ブロックのよくある用途：広告とトラッカー、障害のシミュレーション、エンドポイントの拒否、ページのみのブロック。',
  'workbench.docs.diagrams.block.card1Title': '広告とトラッカー',
  'workbench.docs.diagrams.block.card1Example': 'ads.openheaders.com をブロック',
  'workbench.docs.diagrams.block.card2Title': '障害のシミュレーション',
  'workbench.docs.diagrams.block.card2Example': 'テストのためにホストをオフラインに',
  'workbench.docs.diagrams.block.card3Title': 'エンドポイントの拒否',
  'workbench.docs.diagrams.block.card3Example': '/api/admin だけをブロック',
  'workbench.docs.diagrams.block.card4Title': 'ページのみのブロック',
  'workbench.docs.diagrams.block.card4Example': 'main_frame 条件を追加',
  'workbench.docs.diagrams.block.useCasesFooter': 'ブロックを条件と組み合わせて範囲を絞ってください。',
  'workbench.docs.diagrams.block.wontApplyAria':
    'ブロックは読み込み済みのリソースを遡ってキャンセルしません。今後のリクエストを捕まえるには、ルールを有効にした後にページを再読み込みしてください。',
  'workbench.docs.diagrams.block.alreadyLoaded': '読み込み済みのリソース',
  'workbench.docs.diagrams.block.alreadyLoadedSub':
    '傍受されるのは今後のリクエストだけで、過去のものは読み込まれたままです。',
  'workbench.docs.diagrams.block.suggestionText': 'ルールを有効にした後にページを再読み込みしてください。',

  // ── Redirect ────────────────────────────────────────────────────────
  'workbench.docs.diagrams.redirect.staticAria':
    '静的リダイレクト：一致するすべてのリクエストが同じ宛先 URL に書き換えられます。',
  'workbench.docs.diagrams.redirect.ruleStatic': 'リダイレクト → https://openheaders.com/new-page',
  'workbench.docs.diagrams.redirect.originalRequestKicker': '元のリクエスト',
  'workbench.docs.diagrams.redirect.urlRewritten': 'URL を書き換え',
  'workbench.docs.diagrams.redirect.redirectedToKicker': 'リダイレクト先',
  'workbench.docs.diagrams.redirect.staticStamp': 'すべての一致 → 同じ宛先 URL。',
  'workbench.docs.diagrams.redirect.staticStampSub': 'サーバーがリダイレクトを返したかのようにブラウザーが移動します。',
  'workbench.docs.diagrams.redirect.regexAria':
    '正規表現リダイレクト：URL パターンのキャプチャグループを宛先 URL で \\1、\\2 として参照します。',
  'workbench.docs.diagrams.redirect.ruleRegexLine1': 'URL Regex: ^http://(openheaders\\.io/.*)$',
  'workbench.docs.diagrams.redirect.ruleRegexLine2': 'リダイレクト → https://\\1',
  'workbench.docs.diagrams.redirect.originalUrlKicker': '元の URL',
  'workbench.docs.diagrams.redirect.captureChip': '\\1 = openheaders.com/page',
  'workbench.docs.diagrams.redirect.substituted': '\\1 を置換',
  'workbench.docs.diagrams.redirect.regexStamp': '\\1 はキャプチャグループが一致したものをそのまま引き継ぎます。',
  'workbench.docs.diagrams.redirect.useCasesAria':
    'リダイレクトのよくある用途：HTTP→HTTPS への昇格、ドメイン移行、パスの書き換え、ローカル開発プロキシ。',
  'workbench.docs.diagrams.redirect.card1Example': 'すべての http を https に強制',
  'workbench.docs.diagrams.redirect.card2Title': 'ドメイン移行',
  'workbench.docs.diagrams.redirect.card3Title': 'パスの書き換え',
  'workbench.docs.diagrams.redirect.card4Title': 'ローカル開発プロキシ',
  'workbench.docs.diagrams.redirect.useCasesFooter':
    'パスを保つ書き換えには、後方参照付きの URL Regex を使ってください。',
  'workbench.docs.diagrams.redirect.wontApplyAria':
    'リダイレクトは読み込み済みのページに遡って適用されず、リダイレクトループは無限の循環を防ぐために Chrome が打ち切ります。',
  'workbench.docs.diagrams.redirect.pageLoaded': 'ページが読み込み済み',
  'workbench.docs.diagrams.redirect.pageLoadedSub': '傍受されるのは今後のナビゲーションと fetch だけです。',
  'workbench.docs.diagrams.redirect.loops': 'リダイレクトループ',
  'workbench.docs.diagrams.redirect.loopsSub': 'Chrome が打ち切ります：ERR_TOO_MANY_REDIRECTS。',
  'workbench.docs.diagrams.redirect.suggestionText':
    '再読み込みしてください。条件がループしないことを確認してください。',

  // ── Inject JS / CSS ─────────────────────────────────────────────────
  'workbench.docs.diagrams.inject.timingAria':
    '注入のタイミング：ASAP はページスクリプトの前に実行され、読み込み後は DOM の解析後に実行されます。',
  'workbench.docs.diagrams.inject.timeAxis': '時間 →',
  'workbench.docs.diagrams.inject.navigation': 'ナビゲーション',
  'workbench.docs.diagrams.inject.domParsed': 'DOM 解析済み',
  'workbench.docs.diagrams.inject.loadEvent': 'load イベント',
  'workbench.docs.diagrams.inject.asap': 'ASAP',
  'workbench.docs.diagrams.inject.prePageScript': 'ページスクリプトの前',
  'workbench.docs.diagrams.inject.afterLoad': '読み込み後',
  'workbench.docs.diagrams.inject.domSafe': 'DOM 安全',
  'workbench.docs.diagrams.inject.timingFooter': '競合には ASAP · DOM には読み込み後',
  'workbench.docs.diagrams.inject.scriptAria':
    'スクリプトの注入：JavaScript がページの中で、ASAP（ページスクリプトの前）または読み込み後（DOM 安全）に実行されます。',
  'workbench.docs.diagrams.inject.ruleScript': 'スクリプト（ASAP）：fetch をラップしてすべての呼び出しをログ',
  'workbench.docs.diagrams.inject.injectedComment': '<script> // 拡張機能が注入',
  'workbench.docs.diagrams.inject.runsInPage':
    'ページのコンテキストで実行され、ページの JS と同じグローバルが見えます。',
  'workbench.docs.diagrams.inject.scriptFooter':
    'ASAP はアプリのコードより先に競合に勝ち、読み込み後は解析済みの DOM を読みます。',
  'workbench.docs.diagrams.inject.cssAria':
    'CSS の注入：<style> タグがページの head に追加され、バナー要素を隠します。',
  'workbench.docs.diagrams.inject.ruleCss': 'CSS: header.banner { display: none }',
  'workbench.docs.diagrams.inject.ruleApplied1': 'ルール',
  'workbench.docs.diagrams.inject.ruleApplied2': '適用',
  'workbench.docs.diagrams.inject.hidden': '（非表示）',
  'workbench.docs.diagrams.inject.cssFooter': '<style> タグとして注入され、ページの CSS と同じ CSS 詳細度です。',
  'workbench.docs.diagrams.inject.wontApplyAria':
    '注入は、サンドボックス化された iframe や、インラインスクリプトをブロックする厳格な CSP のページには適用されません。',
  'workbench.docs.diagrams.inject.sandboxed': 'サンドボックス化された iframe',
  'workbench.docs.diagrams.inject.sandboxedSub': 'スクリプトを無効にする sandbox="" を持つページ。',
  'workbench.docs.diagrams.inject.strictCsp': "厳格な CSP（script-src 'self'）",
  'workbench.docs.diagrams.inject.strictCspSub': '注入されたインラインスクリプトはページのポリシーにブロックされます。',
  'workbench.docs.diagrams.inject.suggestionText': '親ページに注入し、iframe には postMessage で送ってください。',
  'workbench.docs.diagrams.inject.useCasesAria':
    'JS / CSS の注入のよくある用途：モンキーパッチ、ダークモード、要素の非表示、機能フラグ。',
  'workbench.docs.diagrams.inject.card1Title': 'モンキーパッチ',
  'workbench.docs.diagrams.inject.card1Example': 'fetch / XHR をラップ（ASAP）',
  'workbench.docs.diagrams.inject.card2Title': 'ダークモード',
  'workbench.docs.diagrams.inject.card2Example': 'CSS テーマを強制',
  'workbench.docs.diagrams.inject.card3Title': 'ノイズを隠す',
  'workbench.docs.diagrams.inject.card3Example': 'バナーに display: none',
  'workbench.docs.diagrams.inject.card4Title': '機能フラグ',
  'workbench.docs.diagrams.inject.card4Example': 'window のフラグを ASAP で設定',
  'workbench.docs.diagrams.inject.useCasesFooter':
    '最初に走るべきコードには ASAP を、DOM の読み取りには読み込み後を使ってください。',

  // ── Delay ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.delay.routingAria':
    'ナビゲーション、fetch、サブリソースのレーンにわたる遅延のルーティング：最初の 2 つだけが傍受され、サブリソースはそのまま通ります。',
  'workbench.docs.diagrams.delay.matchedRequest': '一致したリクエスト',
  'workbench.docs.diagrams.delay.document': 'ドキュメント',
  'workbench.docs.diagrams.delay.documentSub': 'iframe のナビ',
  'workbench.docs.diagrams.delay.navCap': '≤ 30,000 ms',
  'workbench.docs.diagrams.delay.viaWaitingPage': '待機ページ経由',
  'workbench.docs.diagrams.delay.fetchXhr': 'Fetch / XHR',
  'workbench.docs.diagrams.delay.jsInitiated': 'JS が開始',
  'workbench.docs.diagrams.delay.xhrCap': '≤ 5,000 ms',
  'workbench.docs.diagrams.delay.monkeyPatched': 'モンキーパッチ済み',
  'workbench.docs.diagrams.delay.subResource': 'サブリソース',
  'workbench.docs.diagrams.delay.subResourceSub': 'img / css / js',
  'workbench.docs.diagrams.delay.notDelayed': '遅延なし',
  'workbench.docs.diagrams.delay.passesThrough': 'そのまま通る',
  'workbench.docs.diagrams.delay.routingFooter': 'より高い上限には本物のローカルプロキシが必要です',
  'workbench.docs.diagrams.delay.navAria':
    'ナビゲーションの遅延：ブラウザーはローカルの待機ページにリダイレクトされ、N ms 保持された後に本来の対象 URL へ転送されます。',
  'workbench.docs.diagrams.delay.ruleNav': '遅延 8,000 ms · ページのナビゲーション',
  'workbench.docs.diagrams.delay.click': 'クリック',
  'workbench.docs.diagrams.delay.waitingPage': '待機ページ',
  'workbench.docs.diagrams.delay.holds8s': '⏱ 8 秒保持',
  'workbench.docs.diagrams.delay.loadsNow': '今読み込む',
  'workbench.docs.diagrams.delay.navStamp': '30,000 ms まで有効。Chrome のリダイレクトの天井です。',
  'workbench.docs.diagrams.delay.navStampSub': 'ローカルの待機ページへの DNR リダイレクトとして実装されています。',
  'workbench.docs.diagrams.delay.xhrAria':
    'JS が開始した fetch/XHR の遅延：モンキーパッチされた setTimeout が解決を保持します。上限は 5000ms。',
  'workbench.docs.diagrams.delay.ruleXhr': '遅延 3,000 ms · JS の fetch / XHR',
  'workbench.docs.diagrams.delay.intercept': '傍受',
  'workbench.docs.diagrams.delay.network': 'ネットワーク',
  'workbench.docs.diagrams.delay.hold3000': '3,000 ms 保持',
  'workbench.docs.diagrams.delay.realRequest': '実際のリクエスト',
  'workbench.docs.diagrams.delay.responseDelayed': 'レスポンス（3 秒遅延）',
  'workbench.docs.diagrams.delay.xhrStamp': '上限は 5,000 ms。それを超える値はワイヤー上で切り詰められます。',
  'workbench.docs.diagrams.delay.wontApplyAria':
    '遅延は、サブリソース（img/css/js）や、ページレベルのモンキーパッチを迂回するサービスワーカーの fetch には適用されません。',
  'workbench.docs.diagrams.delay.subResources': 'サブリソース（img、css、js、フォント）',
  'workbench.docs.diagrams.delay.subResourcesSub': 'ブラウザーが発行するため、モンキーパッチでは保持できません。',
  'workbench.docs.diagrams.delay.swFetches': 'サービスワーカーの fetch',
  'workbench.docs.diagrams.delay.swFetchesSub': '別のスコープで動くため、ページレベルのパッチは届きません。',
  'workbench.docs.diagrams.delay.suggestionText':
    'サブリソースのスロットリングは近日デスクトップアプリで提供されます。',
  'workbench.docs.diagrams.delay.useCasesAria':
    '遅延のよくある用途：読み込み状態の QA、デバウンスのテスト、競合状態の顕在化、低速ネットワークのシミュレーション。',
  'workbench.docs.diagrams.delay.card1Title': '読み込み状態',
  'workbench.docs.diagrams.delay.card1Example': 'スピナーを確実に表示',
  'workbench.docs.diagrams.delay.card2Title': 'デバウンスの確認',
  'workbench.docs.diagrams.delay.card2Example': '入力のスロットルをテスト',
  'workbench.docs.diagrams.delay.card3Title': '競合状態',
  'workbench.docs.diagrams.delay.card3Example': 'リクエストの順序を顕在化',
  'workbench.docs.diagrams.delay.card4Title': '低速ネットワークのシミュレーション',
  'workbench.docs.diagrams.delay.card4Example': 'おおよそ 3G 程度の遅延',
  'workbench.docs.diagrams.delay.useCasesFooter':
    '静的リソースには本物のプロキシが必要です。拡張機能では保持できません。',

  // ── Query Params ────────────────────────────────────────────────────
  'workbench.docs.diagrams.queryParams.ruleAdd': '追加 / 置換 · debug = true',
  'workbench.docs.diagrams.queryParams.addArrow': 'パラメーターを追加または置換',
  'workbench.docs.diagrams.queryParams.addStamp': 'なければ追加し、あれば置き換えます。',
  'workbench.docs.diagrams.queryParams.replaceOnlyAria':
    '置換のみ：既存のクエリパラメーターの値を置き換えますが、パラメーターのない URL には触れません。',
  'workbench.docs.diagrams.queryParams.ruleReplaceOnly': '置換のみ · region = eu',
  'workbench.docs.diagrams.queryParams.present': 'あり',
  'workbench.docs.diagrams.queryParams.presentSub': 'パラメーターが既にある',
  'workbench.docs.diagrams.queryParams.absent': 'なし',
  'workbench.docs.diagrams.queryParams.absentSub': 'region パラメーターがない',
  'workbench.docs.diagrams.queryParams.valueReplaced': '値を置換',
  'workbench.docs.diagrams.queryParams.unchanged': '変更なし',
  'workbench.docs.diagrams.queryParams.replaceOnlyStamp':
    '置き換えるだけで追加はしません。パラメーターのない URL はそのまま通ります。',
  'workbench.docs.diagrams.queryParams.ruleRemove': '削除 · utm_source',
  'workbench.docs.diagrams.queryParams.removeArrow': 'パラメーターを除去',
  'workbench.docs.diagrams.queryParams.removeStamp': '名指ししたパラメーターを削除し、それ以外はそのまま通ります。',
  'workbench.docs.diagrams.queryParams.ruleRemoveAll': 'Remove All',
  'workbench.docs.diagrams.queryParams.noQueryString': '（クエリ文字列なし）',
  'workbench.docs.diagrams.queryParams.removeAllArrow': 'クエリ全体を除去',
  'workbench.docs.diagrams.queryParams.removeAllStamp': 'クエリ文字列全体を 1 ステップで削除します。',
  'workbench.docs.diagrams.queryParams.wontApplyAria':
    'クエリパラメーターの落とし穴：「すべて削除」は同じルール内で追加 / 置換と組み合わせられません。',
  'workbench.docs.diagrams.queryParams.watchForKicker': '注意点',
  'workbench.docs.diagrams.queryParams.combining': '「すべて削除」と追加 / 置換の組み合わせ',
  'workbench.docs.diagrams.queryParams.combiningSub':
    'DNR はクエリ全体を除去しつつ新しいパラメーターを追加するルールを拒否します。',
  'workbench.docs.diagrams.queryParams.suggestionText':
    '2 つのルールを使ってください。まず「すべて削除」、次に追加 / 置換。',
  'workbench.docs.diagrams.queryParams.suggestionSub':
    'ルールの順序が重要で、両方が同じリクエストに一致する必要があります。',
  'workbench.docs.diagrams.queryParams.useCasesAria':
    'クエリパラメーターのよくある用途：フラグの強制、値の正規化、トラッカーの除去、プライバシーモードでのすべて除去。',
  'workbench.docs.diagrams.queryParams.card1Title': 'フラグを強制',
  'workbench.docs.diagrams.queryParams.card1Example': 'debug=true を追加',
  'workbench.docs.diagrams.queryParams.card2Title': '正規化',
  'workbench.docs.diagrams.queryParams.card2Example': 'region だけを置換',
  'workbench.docs.diagrams.queryParams.card3Title': 'トラッカーを除去',
  'workbench.docs.diagrams.queryParams.card3Example': 'utm_* パラメーターを削除',
  'workbench.docs.diagrams.queryParams.card4Title': 'プライバシーモード',
  'workbench.docs.diagrams.queryParams.card4Example': 'すべてのクエリを除去',
  'workbench.docs.diagrams.queryParams.useCasesFooter':
    'URL Pattern やドメインと組み合わせて特定のルートに絞ってください。',

  // ── Request Body ────────────────────────────────────────────────────
  'workbench.docs.diagrams.requestBody.interceptAria':
    'リクエストボディの傍受パイプライン：page.js の呼び出しがスクリプトエンジンの傍受に入り、静的 / 動的 / GraphQL の変換に分岐し、実際のネットワークへ出ていきます。',
  'workbench.docs.diagrams.requestBody.pageSub': 'fetch / XHR の呼び出し',
  'workbench.docs.diagrams.requestBody.intercept': '傍受',
  'workbench.docs.diagrams.requestBody.interceptSub': '拡張機能のモンキーパッチ',
  'workbench.docs.diagrams.requestBody.branchStatic': '静的',
  'workbench.docs.diagrams.requestBody.branchStaticSub1': 'ボディを',
  'workbench.docs.diagrams.requestBody.branchStaticSub2': '丸ごと置換',
  'workbench.docs.diagrams.requestBody.branchDynamic': '動的',
  'workbench.docs.diagrams.requestBody.branchDynamicSub1': 'fn(orig) →',
  'workbench.docs.diagrams.requestBody.branchDynamicSub2': '変更されたボディ',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub1': '操作が一致？ →',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub2': '適用 : スキップ',
  'workbench.docs.diagrams.requestBody.realNetwork': '実際のネットワーク',
  'workbench.docs.diagrams.requestBody.originalBodyKicker': '元のボディ',
  'workbench.docs.diagrams.requestBody.bodySentKicker': '送信されたボディ',
  'workbench.docs.diagrams.requestBody.ruleStatic': 'Static body: { "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.staticArrow': 'ボディを丸ごと置換',
  'workbench.docs.diagrams.requestBody.staticStamp': 'ボディ全体が置き換えられ、ルールは元のボディを決して見ません。',
  'workbench.docs.diagrams.requestBody.ruleDynamic': '動的ボディ：fn(orig) → 刻印',
  'workbench.docs.diagrams.requestBody.fnReads': '→ fn が読んで書き換え',
  'workbench.docs.diagrams.requestBody.dynamicArrow': '関数が変換',
  'workbench.docs.diagrams.requestBody.dynamicStamp': '関数は元のボディを受け取り、新しいボディを返します。',
  'workbench.docs.diagrams.requestBody.graphqlAria':
    'GraphQL フィルター：ルールは JSON ボディの名指ししたフィールドが一致するときだけ発火します。他の操作は触れられずに通ります。',
  'workbench.docs.diagrams.requestBody.ruleGraphql': 'GraphQL: operationName Equals "GetUser"',
  'workbench.docs.diagrams.requestBody.ruleGraphqlAction': '→ 静的ボディの置換',
  'workbench.docs.diagrams.requestBody.match': '一致',
  'workbench.docs.diagrams.requestBody.noMatch': '不一致',
  'workbench.docs.diagrams.requestBody.noMatchSub': 'その他の操作',
  'workbench.docs.diagrams.requestBody.ruleFires': 'ルールが発火',
  'workbench.docs.diagrams.requestBody.passesThrough': 'そのまま通る',
  'workbench.docs.diagrams.requestBody.graphqlStamp': 'フィールドレベルのフィルター。一致する操作にだけ適用されます。',
  'workbench.docs.diagrams.requestBody.graphqlStampSub':
    'フィールドが欠けているリクエストや JSON でないボディはルールをスキップします。',
  'workbench.docs.diagrams.requestBody.wontApplyAria':
    'ボディのルールは、ボディを持つ JS 開始の fetch/XHR でのみ発火します。GET と HEAD のリクエストには置き換えるものがなく、静的リソースはスクリプトの傍受に決して入りません。',
  'workbench.docs.diagrams.requestBody.getHead': 'GET / HEAD リクエスト',
  'workbench.docs.diagrams.requestBody.getHeadSub': '仕様上ボディがなく、置き換えるものがありません。',
  'workbench.docs.diagrams.requestBody.staticResources': '静的リソース（img、script、link）',
  'workbench.docs.diagrams.requestBody.staticResourcesSub':
    'ブラウザーが発行します。fetch / XHR には決して触れません。',
  'workbench.docs.diagrams.requestBody.suggestionText':
    'リクエストがページの JS からの POST/PUT/PATCH であることを確認してください。',
  'workbench.docs.diagrams.requestBody.useCasesAria':
    'リクエストボディのよくある用途：テストフィクスチャ、メタデータの刻印、GraphQL 操作のモック、PII の匿名化。',
  'workbench.docs.diagrams.requestBody.card1Title': 'テストフィクスチャ',
  'workbench.docs.diagrams.requestBody.card1Example': '既知のペイロードを強制',
  'workbench.docs.diagrams.requestBody.card2Title': 'メタデータを刻印',
  'workbench.docs.diagrams.requestBody.card2Example': 'debug: true を追加',
  'workbench.docs.diagrams.requestBody.card3Title': 'GraphQL 操作',
  'workbench.docs.diagrams.requestBody.card3Example': '1 つの operationName をモック',
  'workbench.docs.diagrams.requestBody.card4Title': 'リプレイの整形',
  'workbench.docs.diagrams.requestBody.card4Example': 'PII フィールドを匿名化',
  'workbench.docs.diagrams.requestBody.useCasesFooter':
    'スクリプトエンジンのみ。JS が開始した fetch / XHR に適用されます。',

  // ── Sequence primitives ─────────────────────────────────────────────
  'workbench.docs.diagrams.sequence.later': 'その後',

  // ── Debug mode ──────────────────────────────────────────────────────
  'workbench.docs.diagrams.debugMode.surfaceAria':
    'デバッグモードはフッターにあります。インラインのスイッチで切り替え、ドットとラベルはスコープ、タブごとのピン、アタッチ済みタブの一覧を持つポップオーバーを開きます。',
  'workbench.docs.diagrams.debugMode.surfaceTitle': 'デバッグモードはフッターにある',
  'workbench.docs.diagrams.debugMode.surfaceCaption': 'スイッチで切り替え · ドット + ラベルでポップオーバーを開く。',
  'workbench.docs.diagrams.debugMode.debugMode': 'デバッグモード',
  'workbench.docs.diagrams.debugMode.systemStatus': 'システムステータス',
  'workbench.docs.diagrams.debugMode.inspectLabel': '検査',
  'workbench.docs.diagrams.debugMode.scopeBoth': '両方 ▾',
  'workbench.docs.diagrams.debugMode.includeThisTab': 'このタブを含める',
  'workbench.docs.diagrams.debugMode.attachedTabs': 'アタッチ済みのタブ（1）',
  'workbench.docs.diagrams.debugMode.tabRow': 'タブ #11 · example.com',
  'workbench.docs.diagrams.debugMode.scopeAria':
    'アタッチされる集合は導出されます：選んだスコープとピン留めしたタブの和集合を、マスタースイッチと交差させたもの。デバッグモードがオフなら何もアタッチされません。',
  'workbench.docs.diagrams.debugMode.scopeTitle': '何がアタッチされるか',
  'workbench.docs.diagrams.debugMode.scopeFormula': '( スコープ ∪ ピン ) ∩ マスタースイッチ',
  'workbench.docs.diagrams.debugMode.inspectBoth': '検査：両方',
  'workbench.docs.diagrams.debugMode.devtoolsUnion': 'DevTools ∪ フォーカス中のタブ',
  'workbench.docs.diagrams.debugMode.pinnedTab': 'ピン留め：タブ #11',
  'workbench.docs.diagrams.debugMode.candidates': '候補',
  'workbench.docs.diagrams.debugMode.gateLabel': '∩ デバッグ ON',
  'workbench.docs.diagrams.debugMode.attached': 'アタッチ済み',
  'workbench.docs.diagrams.debugMode.attachedTab1': 'タブ #7',
  'workbench.docs.diagrams.debugMode.attachedTab2': 'タブ #11',
  'workbench.docs.diagrams.debugMode.scopeFooter1': 'デバッグ OFF → スコープが何であれ、何もアタッチされません。',
  'workbench.docs.diagrams.debugMode.scopeFooter2':
    '再アタッチはこれから再生され、保存されたスナップショットからではありません。',
  'workbench.docs.diagrams.debugMode.reachAria':
    '標準モードはページの fetch と XHR にしか届きません。アタッチされたデバッグモードのタブは、ナビゲーション、ワーカー、クロスオリジンの iframe、タブ環境にも届きます。',
  'workbench.docs.diagrams.debugMode.reachTitle': '各モードが触れられるもの',
  'workbench.docs.diagrams.debugMode.standardMode': '標準モード',
  'workbench.docs.diagrams.debugMode.rowFetch': 'ページの fetch / XHR',
  'workbench.docs.diagrams.debugMode.rowNavigations': 'ナビゲーション',
  'workbench.docs.diagrams.debugMode.rowWorkers': 'Worker',
  'workbench.docs.diagrams.debugMode.rowIframes': 'クロスオリジンの iframe',
  'workbench.docs.diagrams.debugMode.rowTabEnv': 'タブ環境',
  'workbench.docs.diagrams.debugMode.bannerFree': 'バナーなし',
  'workbench.docs.diagrams.debugMode.showsBanner': 'バナーを表示',
  'workbench.docs.diagrams.debugMode.statesAria':
    'ドットには 4 つの状態があります：灰はオフ、緑はオンでアタッチ済み、黄はバナーが閉じられてヒューリスティックにフォールバック、赤はタブのアタッチに失敗。',
  'workbench.docs.diagrams.debugMode.statesTitle': 'ドットの一目でわかる状態',
  'workbench.docs.diagrams.debugMode.stateOff': 'オフ',
  'workbench.docs.diagrams.debugMode.stateOffMsg': 'デバッグモードは無効',
  'workbench.docs.diagrams.debugMode.stateOn': 'オン · 2 個のタブ',
  'workbench.docs.diagrams.debugMode.stateOnMsg': 'アタッチ済みで正常',
  'workbench.docs.diagrams.debugMode.stateFellBack': 'フォールバック',
  'workbench.docs.diagrams.debugMode.stateFellBackMsg': 'バナーが閉じられた → ヒューリスティック',
  'workbench.docs.diagrams.debugMode.stateFailed': 'アタッチ失敗',
  'workbench.docs.diagrams.debugMode.stateFailedMsg': 'プロトコルを開始できませんでした',

  // ── Request Tracking ────────────────────────────────────────────────
  'workbench.docs.diagrams.requestTracking.phasesAria':
    'すべての接続の 2 つのフェーズ（リクエストとレスポンス）。それぞれにキャプチャされるフィールドがあります。',
  'workbench.docs.diagrams.requestTracking.phasesTitle': 'すべての接続には 2 つのフェーズがある',
  'workbench.docs.diagrams.requestTracking.phaseRequest': 'リクエスト',
  'workbench.docs.diagrams.requestTracking.phaseRequestDir': 'ページ → ネットワーク',
  'workbench.docs.diagrams.requestTracking.outbound': '送信',
  'workbench.docs.diagrams.requestTracking.capMethod': 'メソッド',
  'workbench.docs.diagrams.requestTracking.capHeaders': 'ヘッダー',
  'workbench.docs.diagrams.requestTracking.capBody': 'ボディ',
  'workbench.docs.diagrams.requestTracking.phaseResponse': 'レスポンス',
  'workbench.docs.diagrams.requestTracking.phaseResponseDir': 'ネットワーク → ページ',
  'workbench.docs.diagrams.requestTracking.inbound': '受信',
  'workbench.docs.diagrams.requestTracking.capStatus': 'ステータスコード',
  'workbench.docs.diagrams.requestTracking.capTimings': 'タイミング',
  'workbench.docs.diagrams.requestTracking.perRoundtrip': 'HTTP の往復ごと',
  'workbench.docs.diagrams.requestTracking.capturedKicker': 'キャプチャ',
  'workbench.docs.diagrams.requestTracking.sameConnection': '同じ接続',
  'workbench.docs.diagrams.requestTracking.phasesFooter':
    '両方のフェーズが「このページ」のバッジ数にデータを寄与します。',
  'workbench.docs.diagrams.requestTracking.seqAria':
    'シーケンス図：リクエストが観測され、一致し、記録され、ポップアップが読み取る',
  'workbench.docs.diagrams.requestTracking.pBrowser': 'ブラウザー',
  'workbench.docs.diagrams.requestTracking.pBrowserSub': 'ネットワークスタック',
  'workbench.docs.diagrams.requestTracking.pExtension': '拡張機能',
  'workbench.docs.diagrams.requestTracking.pExtensionSub': 'サービスワーカー',
  'workbench.docs.diagrams.requestTracking.pPopup': 'ポップアップ',
  'workbench.docs.diagrams.requestTracking.pPopupSub': '「このページ」タブ',
  'workbench.docs.diagrams.requestTracking.msgRequest': 'webRequest（リクエスト）',
  'workbench.docs.diagrams.requestTracking.noteMatch': 'ルールと照合',
  'workbench.docs.diagrams.requestTracking.noteRecord1': '記録（ルール + URL +',
  'workbench.docs.diagrams.requestTracking.noteRecord2': 'リソース種別）',
  'workbench.docs.diagrams.requestTracking.msgResponse': 'webRequest（レスポンス）',
  'workbench.docs.diagrams.requestTracking.noteResponse': 'レスポンスフェーズを記録',
  'workbench.docs.diagrams.requestTracking.msgOpenPopup': 'ユーザーがポップアップを開く',
  'workbench.docs.diagrams.requestTracking.msgReadBack': '一致したルール + バッジ',
  'workbench.docs.diagrams.requestTracking.seqFooter': '記録はライブで行われ、ポップアップはそれを読み返すだけです。',
  'workbench.docs.diagrams.requestTracking.uiAria':
    'UI の構造：折りたたまれたバッジが一致したリクエストの一覧に展開する',
  'workbench.docs.diagrams.requestTracking.uiTitle': 'ポップアップのルール行',
  'workbench.docs.diagrams.requestTracking.uiRule': 'Block ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.clickBadge': 'バッジをクリック',
  'workbench.docs.diagrams.requestTracking.matchedPattern': '一致：ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.legendFields': 'タイムスタンプ · URL · リソース種別 · 一致したパターン',
  'workbench.docs.diagrams.requestTracking.legendBadge': 'バッジ数 = 行の数',

  // ── Resource Types ──────────────────────────────────────────────────
  'workbench.docs.diagrams.resourceTypes.anatomyAria':
    'リソース種別の構造：様式化されたページのモックアップに、Chrome の各 ResourceType へのコールアウト：Page、Frame、Script、CSS、Image、Font、Media、Fetch/XHR、WebSocket、Ping、Other。',
  'workbench.docs.diagrams.resourceTypes.anatomyTitle': 'リクエストの各種類は 1 つの ResourceType に対応する',
  'workbench.docs.diagrams.resourceTypes.otherExamples': 'favicon、manifest、…',
  'workbench.docs.diagrams.resourceTypes.legendKicker': '凡例',
  'workbench.docs.diagrams.resourceTypes.footer': '各エントリは 1:1 に対応し、行の間に重なりはありません。',

  // ── Limitations ─────────────────────────────────────────────────────
  'workbench.docs.diagrams.limitations.overviewAria':
    'よくある制限：変更されたヘッダーに対する DevTools の盲点、スクリプトエンジンは fetch/XHR しか見ない、マージはページが設定したヘッダーしか見ない、ヘッダーの一致には Chrome 128+ が必要。',
  'workbench.docs.diagrams.limitations.gotchasKicker': 'よくある落とし穴',
  'workbench.docs.diagrams.limitations.devtoolsTitle': 'DevTools の盲点',
  'workbench.docs.diagrams.limitations.devtoolsLine1': 'Network タブは',
  'workbench.docs.diagrams.limitations.devtoolsLine2': '元のヘッダーを表示します。',
  'workbench.docs.diagrams.limitations.scriptTitle': 'スクリプトの到達範囲',
  'workbench.docs.diagrams.limitations.scriptLine1': 'fetch / XHR のみ。',
  'workbench.docs.diagrams.limitations.scriptLine2': 'ナビも静的もなし。',
  'workbench.docs.diagrams.limitations.mergeTitle': 'マージの範囲',
  'workbench.docs.diagrams.limitations.mergeLine1': 'ページのコードが設定した',
  'workbench.docs.diagrams.limitations.mergeLine2': 'ヘッダーだけを見ます。',
  'workbench.docs.diagrams.limitations.chromeTitle': 'Chrome 128+',
  'workbench.docs.diagrams.limitations.chromeLine1': '古いブラウザーは',
  'workbench.docs.diagrams.limitations.chromeLine2': 'ヘッダーの一致を飛ばします。',
  'workbench.docs.diagrams.limitations.seeCallout': '下のコールアウトを参照。',
  'workbench.docs.diagrams.limitations.footer': '各落とし穴は、影響するセクションの中でもインラインで示されています。',

  // ── How rules execute ───────────────────────────────────────────────
  'workbench.docs.diagrams.execution.stackAria':
    '各エンジンがリクエストの流れのどこで傍受するか：JS は Script、次に DNR を通り、静的とナビゲーションは Script を飛ばす',
  'workbench.docs.diagrams.execution.stackTitle': '各エンジンが傍受する場所',
  'workbench.docs.diagrams.execution.stackJsLane': 'JS が開始',
  'workbench.docs.diagrams.execution.stackStaticLane': '静的 / ナビゲーション',
  'workbench.docs.diagrams.execution.stackPageJs': 'ページの JS',
  'workbench.docs.diagrams.execution.stackPageJsSub': 'fetch / XHR',
  'workbench.docs.diagrams.execution.stackBrowser': 'ブラウザー',
  'workbench.docs.diagrams.execution.stackBrowserSub': '<img>、ナビなど',
  'workbench.docs.diagrams.execution.stackScriptEngine': 'スクリプトエンジン',
  'workbench.docs.diagrams.execution.stackScriptEngineSub': 'monkey-patch',
  'workbench.docs.diagrams.execution.stackBypasses1': 'スクリプトエンジンを',
  'workbench.docs.diagrams.execution.stackBypasses2': '迂回',
  'workbench.docs.diagrams.execution.stackDnrEngine': 'DNR エンジン',
  'workbench.docs.diagrams.execution.stackDnrEngineSub': 'Chrome のネットワーク。すべてを捕捉',
  'workbench.docs.diagrams.execution.stackNetwork': 'ネットワーク',
  'workbench.docs.diagrams.execution.stackFooter': 'DNR は広く、Script は狭いがレスポンスボディを読めます。',
  'workbench.docs.diagrams.execution.dnrAria':
    'DNR の広い到達範囲：ブラウザーが取得するすべてのリソース種別が傍受される',
  'workbench.docs.diagrams.execution.dnrTitle': 'DNR はあらゆる種類のリクエストを捕捉する',
  'workbench.docs.diagrams.execution.dnrItemNav': 'ページのナビゲーション',
  'workbench.docs.diagrams.execution.dnrItemSubFrame': 'サブフレーム',
  'workbench.docs.diagrams.execution.dnrItemFetch': 'fetch / XHR',
  'workbench.docs.diagrams.execution.dnrItemScripts': 'スクリプト',
  'workbench.docs.diagrams.execution.dnrItemStylesheets': 'スタイルシート',
  'workbench.docs.diagrams.execution.dnrItemImages': '画像',
  'workbench.docs.diagrams.execution.dnrItemFonts': 'フォント',
  'workbench.docs.diagrams.execution.dnrItemMedia': 'メディア',
  'workbench.docs.diagrams.execution.dnrItemWebsocket': 'websocket',
  'workbench.docs.diagrams.execution.dnrItemPing': 'ping / beacon',
  'workbench.docs.diagrams.execution.dnrFooter': 'ブラウザーが取得するすべてのリソース種別',
  'workbench.docs.diagrams.execution.reachAria': 'スクリプトエンジンの到達範囲：捕捉するものと迂回されるもの',
  'workbench.docs.diagrams.execution.reachTitle': 'スクリプトエンジンが実際に見るもの',
  'workbench.docs.diagrams.execution.reachCaught': '✓ 捕捉',
  'workbench.docs.diagrams.execution.reachCaughtSub': 'エンジンはこれらを見る',
  'workbench.docs.diagrams.execution.reachFetch': 'fetch()',
  'workbench.docs.diagrams.execution.reachXhr': 'XMLHttpRequest',
  'workbench.docs.diagrams.execution.reachSwFetch': 'SW fetch',
  'workbench.docs.diagrams.execution.reachInScope': '（スコープ内）',
  'workbench.docs.diagrams.execution.reachMissed': '✗ 見逃し',
  'workbench.docs.diagrams.execution.reachMissedSub': '完全に迂回',
  'workbench.docs.diagrams.execution.reachImgSrc': '<img src>',
  'workbench.docs.diagrams.execution.reachScriptSrc': '<script src>',
  'workbench.docs.diagrams.execution.reachPageNav': 'ページのナビゲーション',
  'workbench.docs.diagrams.execution.reachBrowserInternal': 'ブラウザー内部',
  'workbench.docs.diagrams.execution.reachFaviconEtc': '（favicon など）',

  // ── Direct vs Indirect ──────────────────────────────────────────────
  'workbench.docs.diagrams.directVsIndirect.aria': '直接一致と間接一致：同じルール、2 つのページコンテキスト',
  'workbench.docs.diagrams.directVsIndirect.ruleLabel': 'ルール',
  'workbench.docs.diagrams.directVsIndirect.ruleBanner': 'Request Domains: openheaders.com',
  'workbench.docs.diagrams.directVsIndirect.directTitle': '直接',
  'workbench.docs.diagrams.directVsIndirect.directSub': 'ページ URL そのものが一致',
  'workbench.docs.diagrams.directVsIndirect.pageLabel': 'ページ',
  'workbench.docs.diagrams.directVsIndirect.directCaption1': 'ページ + 同じホストの',
  'workbench.docs.diagrams.directVsIndirect.directCaption2': 'サブリソースを追跡',
  'workbench.docs.diagrams.directVsIndirect.badgePrefix': 'バッジ：',
  'workbench.docs.diagrams.directVsIndirect.badgeDirect': 'direct',
  'workbench.docs.diagrams.directVsIndirect.badgeIndirect': 'indirect',
  'workbench.docs.diagrams.directVsIndirect.indirectTitle': '間接',
  'workbench.docs.diagrams.directVsIndirect.indirectSub': 'サブリソースだけが一致',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption1': '一致した',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption2': 'サブリソースだけを追跡',
  'workbench.docs.diagrams.directVsIndirect.legendMatches': 'ルールに一致',
  'workbench.docs.diagrams.directVsIndirect.legendNoMatch': '一致しない',

  // ── Response Body + Status (Mock) ───────────────────────────────────
  'workbench.docs.diagrams.mock.flowAria':
    '静的はネットワークを完全に飛ばし、動的はまずネットワークに当たってから実際のレスポンスを変換します。',
  'workbench.docs.diagrams.mock.flowStatic': '静的',
  'workbench.docs.diagrams.mock.flowDynamic': '動的',
  'workbench.docs.diagrams.mock.flowIntercept': '傍受',
  'workbench.docs.diagrams.mock.flowNeverHit1': '（実際のネットワークには',
  'workbench.docs.diagrams.mock.flowNeverHit2': '当たらない）',
  'workbench.docs.diagrams.mock.flowRealNetwork': '実際のネットワーク',
  'workbench.docs.diagrams.mock.flowRealNetworkSub': '実際のレスポンス',
  'workbench.docs.diagrams.mock.flowSynthetic': '合成ボディ',
  'workbench.docs.diagrams.mock.flowFnResponse': 'fn(response)',
  'workbench.docs.diagrams.mock.flowPageReceives': 'ページが受け取る',
  'workbench.docs.diagrams.mock.staticRule': 'Static response: 200 { "users": [] }',
  'workbench.docs.diagrams.mock.staticBeforeKicker': '実際のネットワーク',
  'workbench.docs.diagrams.mock.staticNever1': '（到達しない）',
  'workbench.docs.diagrams.mock.staticNever2': '：リクエストは短絡',
  'workbench.docs.diagrams.mock.pageReceivesKicker': 'ページが受け取るもの',
  'workbench.docs.diagrams.mock.staticAfterLine1': '200 OK · Content-Type: application/json',
  'workbench.docs.diagrams.mock.staticAfterBody': '{ "users": [] }',
  'workbench.docs.diagrams.mock.staticArrow': '合成レスポンスを返却',
  'workbench.docs.diagrams.mock.staticStamp': '固定のボディ + ステータス + ヘッダー。サーバーには決して接続しません。',
  'workbench.docs.diagrams.mock.dynamicRule': '動的レスポンス：PII フィールドを秘匿',
  'workbench.docs.diagrams.mock.dynamicBeforeKicker': '実際のレスポンス',
  'workbench.docs.diagrams.mock.dynBodyOpen': '{ "user":',
  'workbench.docs.diagrams.mock.dynBodyEmail': '  { "email": "alice@openheaders.com" } }',
  'workbench.docs.diagrams.mock.dynAfterPrefix': '  { "email": ',
  'workbench.docs.diagrams.mock.dynRedacted': '"[redacted]"',
  'workbench.docs.diagrams.mock.dynamicArrow': 'fn(実際のレスポンス) →',
  'workbench.docs.diagrams.mock.dynamicStamp': '実際の呼び出しは行われ、あなたの関数がボディを書き換えます。',
  'workbench.docs.diagrams.mock.wontAria':
    'モックは JS が開始した fetch / XHR だけを傍受し、静的リソースは変更されずに通ります。サブリソースのフィクスチャには本物のローカルプロキシを使ってください。',
  'workbench.docs.diagrams.mock.wontStatic': '静的リソース（img、script、link）',
  'workbench.docs.diagrams.mock.wontStaticSub': 'ブラウザーが発行します。fetch / XHR には決して触れません。',
  'workbench.docs.diagrams.mock.wontNav': 'ページのナビゲーション',
  'workbench.docs.diagrams.mock.wontNavSub': 'トップレベルの HTML の読み込みはスクリプトエンジンを完全に迂回します。',
  'workbench.docs.diagrams.mock.suggestionText':
    'サブリソースのフィクスチャには本物のローカルプロキシを使ってください。',
  'workbench.docs.diagrams.mock.useCasesAria':
    'レスポンスボディ + ステータスのよくある用途：オフライン開発、エラーのシミュレーション、PII の秘匿、エッジケースのペイロード形。',
  'workbench.docs.diagrams.mock.caseOffline': 'オフライン開発',
  'workbench.docs.diagrams.mock.caseOfflineEx': 'API 全体をスタブ',
  'workbench.docs.diagrams.mock.caseError': 'エラーのシミュレーション',
  'workbench.docs.diagrams.mock.caseErrorEx': '1 つのルートで 500 を強制',
  'workbench.docs.diagrams.mock.casePii': 'PII の秘匿',
  'workbench.docs.diagrams.mock.casePiiEx': 'ワイヤー上でメールをマスク',
  'workbench.docs.diagrams.mock.caseEdge': 'コーナーケース',
  'workbench.docs.diagrams.mock.caseEdgeEx': '空の配列、巨大なペイロード',
  'workbench.docs.diagrams.mock.useCasesFooter': '静的 = フィクスチャモード · 動的 = 実際の呼び出しの通過 + 編集。',

  // ── Keyboard Shortcuts ──────────────────────────────────────────────
  'workbench.docs.diagrams.keyboardShortcuts.aria':
    'ワークベンチのフォーカス領域：左サイドバー、エディター、右サイドバー、下部パネル。それぞれにフォーカスのショートカットコードが付いています。',
  'workbench.docs.diagrams.keyboardShortcuts.title': 'フォーカスコードは 4 つの領域のいずれかに移動する',
  'workbench.docs.diagrams.keyboardShortcuts.windowTitle': 'Open Headers — Workbench',
  'workbench.docs.diagrams.keyboardShortcuts.leftSidebar': '左サイドバー',
  'workbench.docs.diagrams.keyboardShortcuts.editor': 'エディター',
  'workbench.docs.diagrams.keyboardShortcuts.rightSidebar': '右サイドバー',
  'workbench.docs.diagrams.keyboardShortcuts.bottomPanel': '下部パネル',
  'workbench.docs.diagrams.keyboardShortcuts.footer': 'どのコードもキーボード設定で割り当て直せます。',

  // ── Wire mirrors (whole-raw in every locale) ────────────────────────
  'workbench.docs.diagrams.block.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireSetTimeout': 'setTimeout',
  'workbench.docs.diagrams.inject.wireDoctype': '<!doctype html>',
  'workbench.docs.diagrams.inject.wireHookLine': 'const _f = window.fetch;',
  'workbench.docs.diagrams.inject.wireBodyOpen': '<body>',
  'workbench.docs.diagrams.inject.wireScriptSrc': '<script src="app.js"></script>',
  'workbench.docs.diagrams.limitations.wireFn': 'fn',
  'workbench.docs.diagrams.multiTab.sync.wireStagingEnv': 'staging',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePush': 'push',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePull': 'pull',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wireRepoName': '⎇ workspace.git',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireStdio': 'stdio',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireHttpSse': 'HTTP / SSE',
  'workbench.docs.diagrams.openHeaders.mcpTools.wireList': 'list',
  'workbench.docs.diagrams.queryParams.wirePage': '?page=1',
  'workbench.docs.diagrams.queryParams.wireDebugParam': '&debug=true',
  'workbench.docs.diagrams.queryParams.wireAmpPage': '&page=1',
  'workbench.docs.diagrams.requestBody.wirePostSave': 'POST /api/save  body:',
  'workbench.docs.diagrams.requestBody.wireBodyAbc': '{ "userId": "abc" }',
  'workbench.docs.diagrams.requestBody.wireBodyTest': '{ "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.wireBodyAbcOpen': '{ "userId": "abc", ',
  'workbench.docs.diagrams.requestBody.wireDebugTrue': '"debug": true',
  'workbench.docs.diagrams.requestBody.wireOpEquals': 'operationName = GetUser',
  'workbench.docs.diagrams.requestBody.wireGetUser': '  "GetUser", ...',
  'workbench.docs.diagrams.requestBody.wireListPosts': '  "ListPosts", ...',
  'workbench.docs.diagrams.requestTracking.wireTagXhr': 'xhr',
  'workbench.docs.diagrams.requestTracking.wireTagImage': 'image',
  'workbench.docs.diagrams.requestTracking.wireTagPing': 'ping',
  'workbench.docs.diagrams.resourceTypes.wireAa': 'Aa',
  'workbench.docs.diagrams.resourceTypes.wireScriptTag': '<script>',
  'workbench.docs.diagrams.resourceTypes.wireLinkCss': '<link css>',
  'workbench.docs.diagrams.resourceTypes.wireImgTag': '<img>',
  'workbench.docs.diagrams.resourceTypes.wireVideoTag': '<video>',
  'workbench.docs.diagrams.resourceTypes.wireIframeTag': '<iframe>',
  'workbench.docs.diagrams.resourceTypes.wireNewWebSocket': "new WebSocket('wss://…')",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.wireOrigins': "{ origins: ['<all_urls>'] }",
  'workbench.docs.diagrams.systemStatus.vaultHydration.wireId': '<id>',
} as const satisfies Catalog;
