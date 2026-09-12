/**
 * Workbench Docs panel — the Variables section body — Japanese.
 * Mirrors `catalogs/en/workbench-docs-variables.ts` key for key.
 * `{{ns.NAME}}` reference tokens ride raw as code chips composed by
 * the section body; `Vault` / `Live` / `Live Workflow` stay raw as
 * product and scope names (case follows the en key — lowercase
 * `vault` in prose stays lowercase); the `string` / `TOTP` vault kinds
 * ride raw. スコープ = variable scope (S19 split law); マスク = masked
 * (shipped mint); シークレット = secret. Sidebar entry names quoted in
 * prose copy the shipped `ja/workbench-chrome-sidebar.ts` strings
 * verbatim（Vault、ワークスペース変数、ライブ変数、環境、変数）. MINTS:
 * 裸の参照 = bare reference; 走査 = the resolution walk; ラダー = the
 * ladder; シャドウイング = shadowing (variable scopes — distinct from
 * the S79 evidence chip 遮蔽 referent); ステップ = workflow step.
 * Sandwich fragments restructure SOV.
 */

import type { Catalog } from '../../types';

export const workbenchDocsVariables = {
  // ── Concepts: Variables ─────────────────────────────────────────────
  'workbench.docs.body.variables.intro1Prefix':
    'テンプレート化できるあらゆるフィールド（ヘッダー値、リダイレクト URL、リクエストボディ、ワークフローのステップ）は、',
  'workbench.docs.body.variables.intro1Suffix':
    'で変数を参照できます。値は使用時に代入されるため、1 つの定義がそれに言及するすべてのルール、リクエスト、ワークフローを動かします。変数は 5 つのスコープにあり、それぞれアプリ内に独自の置き場所を持ち、同じ名前が複数に存在するときの独自の順位を持ちます。',
  'workbench.docs.body.variables.ladderCaptionPrefix': '裸の',
  'workbench.docs.body.variables.ladderCaptionSuffix':
    'は 4 つのスコープを上から下へ歩き、最初のヒットで止まります。Live と他の名前空間付きスコープはこの走査の外にあります。',
  'workbench.docs.body.variables.scopesHeading': '5 つのスコープ',
  'workbench.docs.body.variables.vaultHeading': 'Vault：シークレット、このデバイスのみ',
  'workbench.docs.body.variables.vault1Prefix':
    'vault はデバイスごとのシークレット（API キー、パスワード、TOTP の seed）を保持します。vault のエントリは決して同期されず、デバイスから出ません。ワークスペースのエクスポートや git の履歴にも含まれません。2 種類があります：',
  'workbench.docs.body.variables.vaultKindString': 'string',
  'workbench.docs.body.variables.vault1Middle': 'のエントリはそのままの値に解決され、',
  'workbench.docs.body.variables.vaultKindTotp': 'TOTP',
  'workbench.docs.body.variables.vault1Suffix':
    'のエントリは保存された seed から計算した現在の 6–8 桁のコードに解決されます。seed そのものがテンプレートを通じて露出することはありません。Vault は最上位のため、vault のシークレットは裸の参照で常に勝ちます。',
  'workbench.docs.body.variables.vaultCaptionPrefix': '同期されるエンティティからは',
  'workbench.docs.body.variables.vaultCaptionSuffix':
    'でシークレットを参照してください。生の値を決して貼り付けないでください。',
  'workbench.docs.body.variables.environmentHeading': '環境：切り替え可能な値のセット',
  'workbench.docs.body.variables.environment1Prefix': '環境は、ひとまとまりで入れ替える名前付きの変数のセットです。',
  'workbench.docs.body.variables.environment1Suffix':
    '、チームメイトのローカル構成など。アクティブな環境はヘッダーのセレクターで選びます。アクティブな環境が定義していない名前は、走査が下へ続く前にデフォルト環境にフォールバックします。環境を選ばずに実行するのも有効な状態で、解決はそのスコープを単にスキップします。行はシークレットとしてマークでき、エディターで値がマスクして描画されます。',
  'workbench.docs.body.variables.environmentCaption':
    '1 つの名前に、ステージごとの値。ルールを複製する代わりに環境を切り替えます。',
  'workbench.docs.body.variables.collectionHeading': 'コレクション：1 つのコレクションに限定',
  'workbench.docs.body.variables.collection1':
    'コレクション変数はコレクションに定義され、それに属するルールとリクエストに対してのみ解決されます。ワークスペース全体ではなく 1 つの API にだけ当てはまる値（ベース URL、テナント id、バージョンプレフィックス）の適切な置き場所です。',
  'workbench.docs.body.variables.collectionCaption':
    'コレクション変数は自身のコレクション内でのみ解決されます。他の場所では走査が素通りします。',
  'workbench.docs.body.variables.workspaceHeading': 'ワークスペース：全員と共有',
  'workbench.docs.body.variables.workspace1':
    'ワークスペース変数はワークスペース全体のグローバルで、すべてのルール、リクエスト、ワークフローから見え、ワークスペースと同期されます。最下位のため、自然な基本層になります。共通の値をここに置き、必要な場所で環境やコレクションに上書きさせてください。',
  'workbench.docs.body.variables.workspaceCaption':
    '基本層。どこでも真である値のためのもので、シークレットやステージごとの値のためではありません。',
  'workbench.docs.body.variables.liveHeading': 'Live：ワークフローの実行が公開',
  'workbench.docs.body.variables.live1Prefix':
    'ライブ変数はライブワークフロー（サインインし、token を取得し、キャプチャした値を公開するリクエストの連鎖）に支えられます。ワークフローを保存すると有効になり、成功した実行（手動またはスケジュール）が公開値を発行し、自動更新がワークフローを再実行して新鮮に保ちます。ライブ値には',
  'workbench.docs.body.variables.live1Suffix':
    'としてのみ到達でき、裸の参照では決して到達できません。そのため、ワークスペース変数や環境変数が同じ名前を持っていても、ルールのテンプレートが更新中の値をサイレントに拾うことはありません。ワークフローのレシピを編集すると、次の実行まで公開値は古いとマークされます。',
  'workbench.docs.body.variables.liveRefCaptionPrefix': '常にプレフィックス付き（',
  'workbench.docs.body.variables.liveRefCaptionSuffix':
    '）で、常にワークフローに支えられ、貼り付けた token ではありません。',
  'workbench.docs.body.variables.liveLifecycleCaptionPrefix': '実行が成功 → 公開されたキャプチャが',
  'workbench.docs.body.variables.liveLifecycleCaptionSuffix':
    'として発行 → ルールとリクエストがそれを消費。スケジュールがワークフローを再実行します。',
  'workbench.docs.body.variables.priorityHeading': '優先順位とシャドウイング',
  'workbench.docs.body.variables.priority1Prefix': '裸の',
  'workbench.docs.body.variables.priority1Suffix':
    'は 4 つの実スコープを厳密な順序で解決します。vault、次にアクティブな環境（デフォルト環境へのフォールバック付き）、次にコレクション、次にワークスペース。そして名前を定義する最初のスコープで止まります。下位の定義は存在し続け、ただシャドウされているだけです。',
  'workbench.docs.body.variables.shadowingCaptionPrefix': '裸の参照では環境がワークスペースに勝ちます。',
  'workbench.docs.body.variables.shadowingCaptionSuffix': 'はシャドウされた値を引き続き読みます。',
  'workbench.docs.body.variables.namespacePin1Prefix':
    'すべてのスコープには、解決をそこに固定してラダーを完全にスキップする名前空間もあります：',
  'workbench.docs.body.variables.namespacePin1Suffix':
    '。通常の場合は裸の形を使い、上に何が定義されていようと特定のスコープを指したいときは名前空間付きの形を使ってください。',
  'workbench.docs.body.variables.tipTitle': 'シークレットは vault に',
  'workbench.docs.body.variables.tip1Prefix':
    'ルール、リクエスト、ワークフローはワークスペースと同期されますが、vault は同期されません。同期されるエンティティから',
  'workbench.docs.body.variables.tip1Suffix':
    'を参照すれば、各チームメイトがローカルで自分の値を供給します。機微なものが共有データに置かれることは決してありません。',
  'workbench.docs.body.variables.rulesHeading': 'ルール内の変数',
  'workbench.docs.body.variables.rules1':
    'ルールが持つほぼすべての文字列はテンプレート化できます。条件の値（ドメイン、URL パターン、ヘッダー名）、ヘッダー値、リダイレクト URL、クエリパラメーターの名前と値、静的なリクエストボディとレスポンスボディ、注入コード、WS / SSE のペイロード、Basic 認証の資格情報。ルールエディターは各参照を強調し、ホバーで解決値を表示し、解決できない参照にはバナーを出します。未解決のルールは、すべての参照に値が揃うまで効果を持ちません。',
  'workbench.docs.body.variables.consumersCaption':
    '1 つのテンプレート化された値が 3 つの利用面すべてに供給され、それぞれの適用場所で代入されます。',
  'workbench.docs.body.variables.dynamicNoteTitle': '動的（JS）ボディはテンプレート化されません',
  'workbench.docs.body.variables.dynamicNote1Prefix': 'リクエストボディルールとレスポンスルールのうち、',
  'workbench.docs.body.variables.dynamicWord': '動的',
  'workbench.docs.body.variables.dynamicNote1Middle':
    'モードのものは、テンプレートを代入する代わりにあなたの JavaScript を実行します。コードが自ら値を計算します。',
  'workbench.docs.body.variables.staticWord': '静的',
  'workbench.docs.body.variables.dynamicNote1Middle2': 'なボディだけが',
  'workbench.docs.body.variables.dynamicNote1Suffix': 'の代入に参加します。',
  'workbench.docs.body.variables.requestsHeading': 'リクエスト内の変数',
  'workbench.docs.body.variables.requests1Prefix':
    'API クライアントでは、URL、クエリパラメーター、ヘッダー、認証フィールド、ボディがすべて送信時に解決されます。リクエストが属するコレクションのコレクション変数も含みます。解決できない参照は、リテラルの',
  'workbench.docs.body.variables.requests1Suffix':
    'をワイヤーに載せる代わりに、欠けている変数を名指しするエラーで送信をブロックします。',
  'workbench.docs.body.variables.workflowsHeading': 'ワークフロー内の変数',
  'workbench.docs.body.variables.workflows1Prefix':
    'ライブワークフローの各ステップはリクエストと同じように解決され、さらに 1 つのスコープが加わります：',
  'workbench.docs.body.variables.workflows1Suffix':
    'は同じ実行の中で先のステップがキャプチャした値を参照します。ステップ 1 でサインインし、ステップ 2 でセッション token を使う、という具合です。ステップ参照は連鎖の実行中にのみ存在し、公開とマークされたキャプチャが、実行の成功時にライブ変数として発行されるものです。',
  'workbench.docs.body.variables.namespacesHeading': '名前空間のみのヘルパー',
  'workbench.docs.body.variables.helpers1': 'さらに 3 つの名前空間が、保存された変数ではまったくない値を解決します。',
  'workbench.docs.body.variables.helpersDynamicMiddle': 'は組み込みのジェネレーターを実行します。',
  'workbench.docs.body.variables.helpersFriends':
    'などで、解決のたびに新しい値を生み出します。API クライアントでは送信ごと、静的なルールではコンパイルごとです（次の再コンパイルまで値が焼き込まれます）。',
  'workbench.docs.body.variables.helpersFileMiddle': 'は保存されたファイルを名前で参照します。そして',
  'workbench.docs.body.variables.helpersStepSuffix':
    'は、上で述べたとおり、実行中のワークフローの連鎖の中でのみ意味を持ちます。いずれも裸の走査には加わらず、そのプレフィックスを通じてのみ到達できます。',
  'workbench.docs.body.variables.inspectingHeading': '作成と検査',
  'workbench.docs.body.variables.create1Prefix': 'すべてのスコープはサイドバーから作成します：',
  'workbench.docs.body.variables.sidebarVault': 'Vault',
  'workbench.docs.body.variables.sidebarWorkspaceVars': 'ワークスペース変数',
  'workbench.docs.body.variables.createAnd': '、',
  'workbench.docs.body.variables.sidebarLiveVars': 'ライブ変数',
  'workbench.docs.body.variables.create1Middle': 'はトップレベルのエントリで、環境は',
  'workbench.docs.body.variables.sidebarEnvironments': '環境',
  'workbench.docs.body.variables.create1Middle2': 'の下に追加し、各コレクションは独自の',
  'workbench.docs.body.variables.sidebarVariables': '変数',
  'workbench.docs.body.variables.create1Suffix': 'ページを持ちます。',
  'workbench.docs.body.variables.creationMapCaption':
    'サイドバー内の各変数の置き場所に、それが供給する名前空間を注記したもの。',
  'workbench.docs.body.variables.inspect1Prefix': '検査の面は',
  'workbench.docs.body.variables.inspect1Middle': 'ツールウィンドウです。',
  'workbench.docs.body.variables.inScopeLabel': 'スコープ内',
  'workbench.docs.body.variables.inspect1Middle2':
    'は、フォーカスされたルール、リクエスト、テンプレートが実際に参照する変数を一覧します。それぞれ完全なラダーで解決されるため、実際に適用される正確な値が見えます。',
  'workbench.docs.body.variables.allScopesLabel': 'すべてのスコープ',
  'workbench.docs.body.variables.inspect1Middle3':
    'は、どこかに定義されているすべてを優先順位ごとにまとめて一覧します。テンプレート化できるフィールドで',
  'workbench.docs.body.variables.inspect1Suffix':
    'と入力すると、解決可能なすべての名前を載せたサジェスターが開き、参照にホバーすると解決値と勝ったスコープが表示されます。',
} as const satisfies Catalog;
