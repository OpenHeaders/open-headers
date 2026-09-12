/**
 * Workbench Docs panel — anchor registry bodies — Japanese. Mirrors
 * `catalogs/en/workbench-docs.ts` key for key; the fr/es S59
 * raw/keyed split is followed exactly. Raw by design inside keyed
 * prose: wire/API tokens (declarativeNetRequest, webRequest,
 * ResourceType, queryTransform, block, main_frame, firstParty /
 * thirdParty, Equals / Contains, operationName / query / key / value,
 * chrome.storage(.local), fetch() / XMLHttpRequest, @font-face,
 * Set-Cookie, Accept, User-Agent, Content-Type, CORS,
 * ERR_BLOCKED_BY_CLIENT, RE2, stdio, HTTP/SSE, git log / git blame),
 * ResourceType enum labels (Page, Frame, Fetch/XHR, Script, …),
 * monkey-patch = モンキーパッチ (editors-rule precedent), the en figure
 * strings `30,000 ms` / `5,000 ms` verbatim (figure style follows en),
 * and DNR / AND / DOM / CA / PII / YAML / CDN / MCP loanwords. Quoted
 * UI labels copy their shipped ja mints: header/query-param ops
 * （追加 / 上書き、追記、削除、マージ、上書きのみ、すべて削除）, condition
 * names and the 除外 variants (workbench-editors-rule), inject timing
 * labels（できるだけ早く / ページ読み込み後）, popup tab「このページ」,
 * docs nav titles (workbench-chrome), 動的（JavaScript）／静的データ
 * mode labels, rule kickers (-ルール family), ファーストパーティ /
 * サードパーティ. Reuses 到達範囲 = reach, エンジン = engine, モック =
 * mock, バッジ = badge, ツールウィンドウ, スプリッター = splitter, 変換
 * = transform, 匿名化 = anonymize, lowercase `vault` per-case law.
 * MINTS: トレードオフ = trade-off; フィクスチャ = fixture; 待機ページ =
 * the local waiting page; レーン = delay lane. Sandwich fragments
 * restructure SOV.
 */

import type { Catalog } from '../../types';

export const workbenchDocs = {
  // ── Concepts: Execution (DNR vs Script) ─────────────────────────────
  'workbench.docs.body.execution.intro':
    'ルールは、その内容に応じて 2 つのエンジンのいずれかで実行されます。ルールがどの経路を通るかを知ると、どこに適用されるか、そしてどこに適用できないかが分かります。',
  'workbench.docs.body.execution.stackCaption':
    'JS 起点のリクエストは Script、次に DNR を通ります。静的なトラフィックとナビゲーションのトラフィックは Script を完全に迂回します。',
  'workbench.docs.body.execution.dnrHeading': 'ネイティブ、高速、広い到達範囲',
  'workbench.docs.body.execution.dnr1Prefix':
    'ヘッダーの上書き / 追記 / 削除、ブロック、リダイレクト、クエリパラメーターのルールは',
  'workbench.docs.body.execution.dnr1Suffix':
    'のエントリにコンパイルされます。Chrome はそれらを、リクエストがブラウザーを出る前にネットワーク層で適用します。',
  'workbench.docs.body.execution.dnr2':
    '到達範囲は広く、ページ、サブフレーム、スクリプト、画像、フォント、fetch、XHR など、ブラウザーがページのために行うすべてのリクエストに及びます。',
  'workbench.docs.body.execution.dnrCaption': '枠付きの単一のリスト。DNR の到達範囲は本質的に普遍的です。',
  'workbench.docs.body.execution.scriptHeading': 'JS コンテキスト、狭い到達範囲',
  'workbench.docs.body.execution.script1Prefix':
    '注入、遅延、リクエストボディ、API レスポンス、ヘッダーのマージのルールは、ページの内側から',
  'workbench.docs.body.execution.script1And': 'と',
  'workbench.docs.body.execution.script1Suffix':
    'をモンキーパッチすることで動作します。DNR では表現できない方法で JavaScript 起点のトラフィックを変換でき、DNR がアクセスできないレスポンスボディの読み取りと書き換えも含みます。',
  'workbench.docs.body.execution.scriptCaption':
    '2 つの列。スクリプトエンジンが実際に傍受するものと、変わらずに通り抜けるもの。',
  'workbench.docs.body.execution.limitPrefix': '静的リソース（',
  'workbench.docs.body.execution.limitSuffix':
    '）、ページのナビゲーション、ブラウザー内部のリクエストはこのエンジンを完全に迂回します。それらには DNR ベースのルールを使ってください。',

  // ── Concepts: Limitations ───────────────────────────────────────────
  'workbench.docs.body.limitations.intro':
    '人を驚かせる動作のクイックリファレンスです。各項目は、それが影響するセクションでもインラインで説明しています。',
  'workbench.docs.body.limitations.overviewCaption':
    'よくある 4 つの落とし穴を一目で。下の各注意書きに詳細があります。',
  'workbench.docs.body.limitations.devtoolsTitle': '変更したヘッダーは DevTools に表示されません',
  'workbench.docs.body.limitations.devtoolsBody':
    'ヘッダーアクションは正しく適用されますが、Chrome の Network タブは引き続きサーバーの元のヘッダーを表示します。',
  'workbench.docs.body.limitations.scriptTitle': 'スクリプトベースのルール：狭い到達範囲',
  'workbench.docs.body.limitations.scriptPrefix': '注入、遅延、ボディ、モック、ヘッダーのマージが傍受するのは',
  'workbench.docs.body.limitations.scriptAnd': 'と',
  'workbench.docs.body.limitations.scriptMiddle':
    'だけです。静的リソースとページのナビゲーションはそれらを迂回します。参照：',
  'workbench.docs.body.limitations.executionRef': 'ルールの実行方法',
  'workbench.docs.body.limitations.scriptSuffix': '.',
  'workbench.docs.body.limitations.mergeTitle': 'マージはブラウザーデフォルトのヘッダーを読めません',
  'workbench.docs.body.limitations.mergeBody':
    'マージ操作はページのコードが明示的に設定したヘッダーだけを見ます。Accept、User-Agent などのブラウザーデフォルトは見えません。',
  'workbench.docs.body.limitations.chromeTitle': 'ヘッダーの一致には Chrome 128 以降が必要です',
  'workbench.docs.body.limitations.chromeBody':
    'リクエスト / レスポンスのヘッダー値に一致する条件には Chrome 128 以降が必要です。古いブラウザーはその条件をサイレントに無視します。',

  // ── Concepts: Multi-tab Behavior ────────────────────────────────────
  'workbench.docs.body.multiTab.intro1Prefix':
    '複数のワークスペースタブを同時に開くのは第一級の状態です。永続化されたデータは',
  'workbench.docs.body.multiTab.intro1Suffix':
    'を通じて同期され、レイアウトの状態はタブごとに留まり、ナビゲーションの意図は新しいタブを開く前に同じウィンドウの既存のタブを再利用します。',
  'workbench.docs.body.multiTab.syncCaption':
    'タブ A が保存し、SW がブロードキャストし、タブ B が再ハイドレートします。レイアウトの状態は各タブに留まります。',
  'workbench.docs.body.multiTab.navHeading': 'ナビゲーションは既存のタブを再利用します',
  'workbench.docs.body.multiTab.nav1':
    '同じウィンドウが優先です。クリック元のウィンドウにワークスペースタブが既に開いていれば、それがアクティブになり意図（スクロール先のドキュメントセクション、編集するルール）を受け取ります。別のウィンドウの場合は、Chrome のウィンドウをまたいでフォーカスを引き寄せる代わりに、現在のウィンドウに新しいタブが開きます。Chrome 自身の DevTools がウィンドウごとに 1 つのパネルを持つのと同じです。',
  'workbench.docs.body.multiTab.navCaption':
    'ウォームパスは同じウィンドウのタブをアクティブにし、コールドパスは呼び出し元のウィンドウに新しいタブを開きます。',
  'workbench.docs.body.multiTab.numberingHeading': 'タブの番号付け',
  'workbench.docs.body.multiTab.numbering1Prefix':
    'ワークスペースタブが 2 つ以上あると、各タブのタイトルに序数が前置されます。',
  'workbench.docs.body.multiTab.numbering1Suffix': '。数が 1 つに戻ると、残ったタブはプレフィックスを外します。',
  'workbench.docs.body.multiTab.numbering2Prefix': '序数はタブの生存期間中は安定しています。',
  'workbench.docs.body.multiTab.numbering2While': 'と',
  'workbench.docs.body.multiTab.numbering2And': 'が残っている間に',
  'workbench.docs.body.multiTab.numbering2Middle': 'を閉じても、残りの番号は振り直されません。次に開くタブは',
  'workbench.docs.body.multiTab.numbering2Middle2': 'になり、番号が',
  'workbench.docs.body.multiTab.numbering2Suffix':
    'にリセットされるのは、すべてのワークスペースタブが閉じた後だけです。',
  'workbench.docs.body.multiTab.numberingCaption':
    '残ったタブは閉じられても番号を保ち、次のタブは常に最大値 + 1 です。',
  'workbench.docs.body.multiTab.syncsHeading': '同期されるもの、されないもの',
  'workbench.docs.body.multiTab.syncs1Prefix':
    '永続化されるすべてのエンティティ（ルール、コレクション、フォルダー、環境、ワークスペース変数、vault、リクエスト、テンプレート）は、唯一の信頼できる情報源として',
  'workbench.docs.body.multiTab.syncs1Suffix':
    'にあります。タブ A での保存はバックグラウンドを通じてブロードキャストされ、タブ B が再ハイドレートします。ワークスペースと環境の切り替えも同じように伝播します。',
  'workbench.docs.body.multiTab.syncedCaption':
    '1 つの共有 chrome.storage。両方のタブが同じ永続化データを読み書きします。',
  'workbench.docs.body.multiTab.localCaption':
    'レイアウトのドラッグと未保存の入力は各タブに留まり、もう一方のタブには決して見えません。',
  'workbench.docs.body.multiTab.layoutTitle': 'レイアウトはライブ同期されません',
  'workbench.docs.body.multiTab.layout1Prefix':
    'ペインの比率とツールウィンドウのドック状態はワークスペースごとですが、変更は既に開いているタブには伝播しません。タブ A でスプリッターをドラッグしても、タブ B は再読み込みまで変わりません。入力中にレイアウトがライブ同期されると不快だからです。ドラッグの',
  'workbench.docs.body.multiTab.layoutAfter': '後に',
  'workbench.docs.body.multiTab.layout1Suffix': '開いたタブは新しいレイアウトを継承します。',
  'workbench.docs.body.multiTab.draftsTitle': '未保存の下書きはタブローカルです',
  'workbench.docs.body.multiTab.drafts1':
    'エディターの下書きは自身のタブのメモリにあります。タブ B が編集中の同じルールをタブ A が保存すると、ストレージへの書き込みはタブ A が勝ちます。現在、タブをまたいだ「変更されました。再読み込みしますか？」のプロンプトはありません。2 つのタブが同じエンティティを同時に編集する場合にのみ関係します。',

  // ── Concepts: Request Tracking ──────────────────────────────────────
  'workbench.docs.body.requestTracking.intro1Prefix': 'ポップアップの',
  'workbench.docs.body.requestTracking.thisPage': 'このページ',
  'workbench.docs.body.requestTracking.intro1Suffix':
    'タブは、現在のページでどのルールが有効で、どのリクエストに一致したかを表示します。追跡は、ページが行うすべての接続のリクエストとレスポンスの両方のフェーズにまたがります。',
  'workbench.docs.body.requestTracking.phasesCaption':
    '1 つの接続には 2 つのフェーズがあり、どちらもバッジの数に寄与します。',
  'workbench.docs.body.requestTracking.howHeading': '仕組み',
  'workbench.docs.body.requestTracking.how1Prefix': '拡張機能は HTTP リクエストを',
  'workbench.docs.body.requestTracking.how1Middle':
    'API を通じて観測します。リクエスト URL がルールの条件（ドメイン、URL パターン、URL 正規表現）に一致すると、そのリソースの種類とともに記録されます。記録はサービスワーカーの中でライブに行われ、ポップアップは',
  'workbench.docs.body.requestTracking.how1Suffix': 'タブを開いたときにその記録を読み返すだけです。',
  'workbench.docs.body.requestTracking.howCaption':
    'ブラウザーが webRequest イベントを発火し、拡張機能が一致させて記録し、ポップアップが後で読みます。',
  'workbench.docs.body.requestTracking.badge1':
    '一致した各ルールには、一致したリクエストの数に等しい番号付きバッジが表示されます。バッジをクリックすると、タイムスタンプ、URL、リソースの種類、一致したパターンの一覧に展開します。',
  'workbench.docs.body.requestTracking.badgeCaption':
    'バッジは数を折りたたみ、クリックすると完全な一致の一覧が現れます。',
  'workbench.docs.body.requestTracking.directHeading': '直接一致と間接一致',
  'workbench.docs.body.requestTracking.direct1Prefix': 'A',
  'workbench.docs.body.requestTracking.directTerm': 'direct',
  'workbench.docs.body.requestTracking.direct1Middle':
    '（直接）一致は、ページ URL そのものが一致したことを意味します。An',
  'workbench.docs.body.requestTracking.indirectTerm': 'indirect',
  'workbench.docs.body.requestTracking.direct1Suffix':
    '（間接）一致は、ページ URL は一致しなかったが、サブリソース（スクリプト、スタイルシート、XHR、画像、フォント）だけが一致したことを意味します。同じルールでも、どのページにいるかによってどちらにもなります。',
  'workbench.docs.body.requestTracking.directCaption':
    '1 つのルール、2 つのページコンテキスト。緑 = 一致。破線 = 除外。',
  'workbench.docs.body.requestTracking.typesHeading': 'リソースの種類',
  'workbench.docs.body.requestTracking.types1Prefix': '一致した各リクエストは Chrome の',
  'workbench.docs.body.requestTracking.types1Middle':
    'を持ちます。Page、Frame、Fetch/XHR、Script、CSS、Image、Font、Media、WebSocket、Ping、または Other。例を含む完全な対応表は',
  'workbench.docs.body.requestTracking.resourceTypesLink': 'リソースの種類',
  'workbench.docs.body.requestTracking.types1Suffix': 'のリファレンスページを参照してください。',

  // ── Reference: Resource Types (section shell + table descriptions;
  //    tags/codes/example lines stay raw parity vocabulary) ────────────
  'workbench.docs.body.resourceTypes.introPrefix': 'リクエスト追跡と「リソースの種類」の条件が扱う Chrome の',
  'workbench.docs.body.resourceTypes.introSuffix':
    'の値のリファレンスです。各ラベルは単一の基礎となる型に対応し、行の間に重複はありません。',
  'workbench.docs.body.resourceTypes.anatomyCaption': 'どの種類のリクエストがどの ResourceType に入るかを一目で。',
  'workbench.docs.body.resourceTypes.descPage':
    'トップレベルのドキュメントのナビゲーション。アドレスバーに表示される URL です。',
  'workbench.docs.body.resourceTypes.descFrame': 'ページ内に埋め込まれた iframe または入れ子のフレーム。',
  'workbench.docs.body.resourceTypes.descXhr':
    'fetch() または XMLHttpRequest による API 呼び出し。Chrome は両方を同じ型として報告し、区別する方法はありません。',
  'workbench.docs.body.resourceTypes.descScript': 'ページが読み込む JavaScript ファイル。',
  'workbench.docs.body.resourceTypes.descStylesheet': 'ページが読み込むスタイルシート。',
  'workbench.docs.body.resourceTypes.descImage': 'ページまたはそのスタイルが読み込む画像。',
  'workbench.docs.body.resourceTypes.descFont': '@font-face ルールで読み込まれる Web フォント。',
  'workbench.docs.body.resourceTypes.descMedia': '音声または動画のリソース。',
  'workbench.docs.body.resourceTypes.descWebsocket':
    'WebSocket のハンドシェイク。最初の HTTP アップグレードリクエストです。追跡されるのはハンドシェイクだけで、個々のメッセージは追跡されません。',
  'workbench.docs.body.resourceTypes.descPing': '主にアナリティクス / 追跡に使われるビーコンと ping のリクエスト。',
  'workbench.docs.body.resourceTypes.descOther': '上のどのカテゴリにも当てはまらないもの。',

  // ── Concepts: Actions (overview) ────────────────────────────────────
  'workbench.docs.body.actions.intro1Prefix': 'アクションはルールの「',
  'workbench.docs.body.actions.introDo': '実行',
  'workbench.docs.body.actions.intro1Middle': '」の部分です。',
  'workbench.docs.body.actions.conditionLink': '条件',
  'workbench.docs.body.actions.intro1Middle2': 'がルールを発火させる',
  'workbench.docs.body.actions.introWhether': 'かどうか',
  'workbench.docs.body.actions.intro1Middle3': 'を決めるのに対し、アクションは',
  'workbench.docs.body.actions.introWhatChanges': '何を変えるか',
  'workbench.docs.body.actions.intro1Suffix':
    'を決めます。すべてのルールは、AND で一致する条件の積み重ねと、正確に 1 つのアクションを組み合わせます。',
  'workbench.docs.body.actions.categories1':
    'アクションは 3 つのカテゴリに分かれます。送信リクエストの変更、受信レスポンスの変更、ページ内でのコードの実行。各アクションは 2 つのエンジンのいずれかで実装されます：',
  'workbench.docs.body.actions.engineDnr': 'DNR',
  'workbench.docs.body.actions.categoriesDnrParen': '（Chrome の',
  'workbench.docs.body.actions.categoriesDnrSuffix': '。高速でネイティブ）または',
  'workbench.docs.body.actions.engineScript': 'Script',
  'workbench.docs.body.actions.categoriesScriptParen':
    '（Open Headers のページ内エンジン。DNR で表現できないもののため）。トレードオフは',
  'workbench.docs.body.actions.executionLink': 'ルールの実行方法',
  'workbench.docs.body.actions.categories1Suffix': 'を参照してください。',
  'workbench.docs.body.actions.ruleAnatomyCaption':
    'ルール = AND で一致する条件と、正確に 1 つのアクションの組み合わせ。',
  'workbench.docs.body.actions.taxonomyCaption': '3 つのカテゴリ。各アクションにエンジンのタグ付き。',
  'workbench.docs.body.actions.modifyRequestTitle': 'リクエストの変更',
  'workbench.docs.body.actions.tagRequest': 'ブラウザーを出る前に',
  'workbench.docs.body.actions.modifyRequest1':
    '送信リクエストの形を変えます。ヘッダー、URL パラメーター、ボディ、宛先、そしてそもそも送るかどうか。ほとんどのルールはここにあります。',
  'workbench.docs.body.actions.headerActionsLink': 'ヘッダーアクション',
  'workbench.docs.body.actions.liHeaderActionsRequest': '：リクエストヘッダーの追加 / 上書き / 追記 / 削除 / マージ。',
  'workbench.docs.body.actions.blockLink': 'ブロック',
  'workbench.docs.body.actions.liBlock': '：ネットワーク層でリクエストをキャンセル。',
  'workbench.docs.body.actions.redirectLink': 'リダイレクト',
  'workbench.docs.body.actions.liRedirect': '：リクエストを別の URL へ送る。静的または正規表現。',
  'workbench.docs.body.actions.queryParamsLink': 'クエリパラメーター',
  'workbench.docs.body.actions.liQueryParams': '：URL パラメーターの追加、上書き、削除。',
  'workbench.docs.body.actions.requestBodyLink': 'リクエストボディ',
  'workbench.docs.body.actions.liRequestBody':
    '：送信する fetch / XHR のボディを書き換える（静的、動的、または GraphQL フィルター）。',
  'workbench.docs.body.actions.modifyResponseTitle': 'レスポンスの変更',
  'workbench.docs.body.actions.tagResponse': 'ページが見る前に',
  'workbench.docs.body.actions.modifyResponse1':
    '戻ってくるレスポンスの形を変えます。ヘッダー、ボディ、または HTTP ステータス。未実装のエンドポイントのモックや、開発中に失敗モードを強制するのに便利です。',
  'workbench.docs.body.actions.liHeaderActionsResponse': '：同じ 5 つの操作がレスポンスヘッダーにも適用されます。',
  'workbench.docs.body.actions.responseLink': 'レスポンスの変更',
  'workbench.docs.body.actions.liResponse': '：応答をモックまたは変更する。合成したボディ、ステータス、ヘッダー。',
  'workbench.docs.body.actions.runCodeTitle': 'コードの実行',
  'workbench.docs.body.actions.tagRunCode': 'ページまたはそのスケジューラーの中で',
  'workbench.docs.body.actions.runCode1':
    '「リクエストまたはレスポンスを変更する」にきれいに収まらない効果。コードの注入と人工的な遅延です。どちらも DNR に相当物がないため Script エンジンで動作します。',
  'workbench.docs.body.actions.injectLink': 'JS / CSS の注入',
  'workbench.docs.body.actions.liInject':
    '：ページのコンテキストで JavaScript や CSS を実行する。ページスクリプトの前、または DOM 準備完了後。',
  'workbench.docs.body.actions.delayLink': '遅延',
  'workbench.docs.body.actions.liDelay': '：ナビゲーションと JS 起点の fetch / XHR に人工的な遅延を加える。',
  'workbench.docs.body.actions.oneActionTitle': 'ルールごとに 1 つのアクション',
  'workbench.docs.body.actions.oneAction1':
    '各ルールは正確に 1 つのアクションを持ちます。一度に 2 つのこと（たとえばヘッダーの追加とリダイレクト）を行うには、同じ条件を持つ 2 つのルールを書いてください。どちらも同じリクエストで発火し、DNR は文書化された順序でそれらを合成します。',

  // ── Actions: Header Actions ─────────────────────────────────────────
  'workbench.docs.body.headerActions.intro':
    'リクエストとレスポンスのヘッダーに対する 4 つの操作。ネイティブが 3 つ（追加 / 上書き、追記、削除）と、DNR では表現できない値の連結のためのスクリプトベースが 1 つ（マージ）です。',
  'workbench.docs.body.headerActions.opsCaption': '同じ初期ヘッダーから、4 つの異なる結果',
  'workbench.docs.body.headerActions.overrideTitle': '追加 / 上書き',
  'workbench.docs.body.headerActions.override1':
    'ヘッダーをこの値に設定します。あれば置き換え、なければ追加します。常にあなたの値を持つ 1 つのヘッダーになります。',
  'workbench.docs.body.headerActions.overrideCaption':
    '同じルールが両方のケースをカバーします。あれば置き換え、なければ追加。',
  'workbench.docs.body.headerActions.overrideWontApplyCaption':
    'ルールの条件がリクエストに一致しなければ何も起きません。エラーもなく、何もしません。',
  'workbench.docs.body.headerActions.appendTitle': '追記',
  'workbench.docs.body.headerActions.append1':
    '同じ名前の新しいヘッダーエントリを追加します。元のものは残るため、重複したヘッダーになります。Set-Cookie、Link、Via に使います。',
  'workbench.docs.body.headerActions.appendCaption':
    '元のヘッダーは残り、同じ名前の 2 行目が追加されます。両方が配信されます。',
  'workbench.docs.body.headerActions.appendWontApplyCaption':
    '重複できないヘッダーもあり、ブラウザーがまとめてしまいます。代わりに上書きかマージを使ってください。',
  'workbench.docs.body.headerActions.removeTitle': '削除',
  'workbench.docs.body.headerActions.remove1': 'このヘッダーのすべてのインスタンスを削除します。値は不要です。',
  'workbench.docs.body.headerActions.removeCaption': '対象の行が消え、それ以外はすべて変わらず通過します。',
  'workbench.docs.body.headerActions.removeWontApplyCaption':
    'ヘッダーがなければ何も起きません。エラーもなく、ただ何もしません。',
  'workbench.docs.body.headerActions.mergeTitle': 'マージ',
  'workbench.docs.body.headerActions.merge1Prefix':
    '実行時に既存の値を読み、区切り文字を挟んであなたの値を追記します。デフォルトは',
  'workbench.docs.body.headerActions.merge1Middle': 'が Cookie 用、',
  'workbench.docs.body.headerActions.merge1Suffix': 'がそれ以外用です。区切り文字を空にすると直接連結します。',
  'workbench.docs.body.headerActions.mergeCaption': '既存の値は残り、区切り文字の後にあなたの値が追記されます。',
  'workbench.docs.body.headerActions.mergeWontApplyCaption':
    'Script エンジンのみ。ページのナビゲーションと静的リソースは手つかずで流れます。',
  'workbench.docs.body.headerActions.mergeLimitation':
    'マージは DevTools には見えず、ブラウザーデフォルトのヘッダー（Accept、User-Agent）を読めません。ページのコードが明示的に設定したヘッダーだけです。',

  // ── Actions: Block ──────────────────────────────────────────────────
  'workbench.docs.body.block.intro':
    '一致するリクエストをネットワーク層でキャンセルします。ブラウザーはネットワークエラーを受け取り、ページにはサーバーに到達できないかのようにリクエストの失敗が見えます。',
  'workbench.docs.body.block.howTitle': '仕組み',
  'workbench.docs.body.block.how1Prefix': 'ボディのない DNR の',
  'workbench.docs.body.block.how1Suffix':
    'アクションにコンパイルされます。リソースの種類にかかわらず適用されます。ページ、サブフレーム、スクリプト、画像、フォント、fetch、XHR。そのため、「リソースの種類」の条件で絞らない限り、1 つのルールがすべてをカバーします。',
  'workbench.docs.body.block.blockCaption':
    'リクエストはブラウザーを出る前に殺され、ページにはネットワークエラーが見えます。',
  'workbench.docs.body.block.wontApplyCaption':
    '既に読み込まれたリソースは読み込まれたままです。ブロックは今後のリクエストだけを捕まえます。',
  'workbench.docs.body.block.whenTitle': '使いどころ',
  'workbench.docs.body.block.when1Prefix':
    '広告 / アナリティクス / 追跡のドメインのブロック、単一ホストの障害のシミュレーション、API の残りには到達できるようにしつつ 1 つのエンドポイントへのアクセスを拒否する場合。ページのドキュメントだけ（サブリソースは除く）をブロックするには、次の値の「リソースの種類」条件を追加してください：',
  'workbench.docs.body.block.when1Suffix': '.',
  'workbench.docs.body.block.useCasesCaption':
    '4 つの典型的なパターン。それぞれを条件（ドメイン、URL パターン、リソースの種類）で絞ります。',
  'workbench.docs.body.block.note1Prefix': 'ブロックしたのが',
  'workbench.docs.body.block.note1Suffix':
    'のリクエストなら、Chrome では「ERR_BLOCKED_BY_CLIENT」のページが描画されます。サブリソースのブロックはサイレントに起き、ユーザーに何が見えるかはページ自身のエラー処理次第です。',

  // ── Actions: Redirect ───────────────────────────────────────────────
  'workbench.docs.body.redirect.intro':
    '一致するリクエストを別の URL にリダイレクトします。静的な URL と正規表現のキャプチャグループに対応します。',
  'workbench.docs.body.redirect.staticTitle': '静的リダイレクト',
  'workbench.docs.body.redirect.static1':
    '完全な URL を入力すると、一致するすべてのリクエストを同じ宛先にリダイレクトします。',
  'workbench.docs.body.redirect.staticCaption': '一致するすべてのリクエストに同じ宛先。URL 全体の置換です。',
  'workbench.docs.body.redirect.regexTitle': '正規表現リダイレクト',
  'workbench.docs.body.redirect.regex1Prefix': 'URL 正規表現の条件と組み合わせます。',
  'workbench.docs.body.redirect.regex1Suffix': 'などで、宛先 URL のキャプチャグループを参照します。',
  'workbench.docs.body.redirect.regexCaption': 'キャプチャグループに一致したテキストが宛先 URL に代入されます。',
  'workbench.docs.body.redirect.wontApplyCaption':
    'リダイレクトは既に読み込まれたページには遡って適用されません。ループは Chrome がサイレントに打ち切ります。',
  'workbench.docs.body.redirect.whenTitle': '使いどころ',
  'workbench.docs.body.redirect.when1':
    'HTTP → HTTPS の強制、古いドメインからのユーザーの移行、API バージョンの書き換え、CDN のトラフィックをローカルの開発サーバーへ向けるのが 4 つの典型的なパターンです。事前に分かっている完全な URL には静的を、パスをリダイレクト先に引き継ぐ必要があるなら正規表現を使ってください。',
  'workbench.docs.body.redirect.useCasesCaption':
    '4 つの典型的なパターン。宛先のパスが一致内容に依存するなら正規表現を選びます。',

  // ── Actions: Query Params ───────────────────────────────────────────
  'workbench.docs.body.queryParam.introPrefix':
    'リクエストがブラウザーを出る前に URL のクエリパラメーターを変更します。DNR の',
  'workbench.docs.body.queryParam.introSuffix': 'アクションにコンパイルされます。',
  'workbench.docs.body.queryParam.addTitle': '追加 / 上書き',
  'workbench.docs.body.queryParam.add1': 'パラメーターがなければ追加し、既にあれば値を置き換えます。',
  'workbench.docs.body.queryParam.addCaption':
    'なければ追加、あれば置き換え。常にあなたの値を持つ 1 つの一致パラメーターになります。',
  'workbench.docs.body.queryParam.replaceOnlyTitle': '上書きのみ',
  'workbench.docs.body.queryParam.replaceOnly1Prefix': '値を置き換えるのは',
  'workbench.docs.body.queryParam.replaceOnlyStrong': 'パラメーターが既にある場合だけ',
  'workbench.docs.body.queryParam.replaceOnly1Middle':
    'です。パラメーターのない URL はそのままです。持っていない URL に注入することなく値を正規化するのに使います（例：何らかのリージョンを既に持つ URL に',
  'workbench.docs.body.queryParam.replaceOnly1Suffix': 'を強制する）。',
  'workbench.docs.body.queryParam.replaceOnlyCaption': '既存の値だけを置き換え、パラメーターのない URL はそのまま。',
  'workbench.docs.body.queryParam.removeTitle': '削除',
  'workbench.docs.body.queryParam.remove1': '特定のパラメーターを名前で削除します。値は無視されます。',
  'workbench.docs.body.queryParam.removeCaption':
    '指定したパラメーターが消え、他のすべてのクエリパラメーターは通過します。',
  'workbench.docs.body.queryParam.removeAllTitle': 'すべて削除',
  'workbench.docs.body.queryParam.removeAll1':
    'クエリ文字列全体を取り除きます。同じルール内で追加 / 上書きとは併用できません。',
  'workbench.docs.body.queryParam.removeAllCaption': 'クエリ全体を一手で取り除き、URL は裸になります。',
  'workbench.docs.body.queryParam.wontApplyCaption':
    '「すべて削除」は DNR 層で追加 / 上書きと衝突します。2 つのルールに分けてください。',
  'workbench.docs.body.queryParam.whenTitle': '使いどころ',
  'workbench.docs.body.queryParam.when1':
    'デバッグフラグの強制、リージョンやロケールの正規化、追跡パラメーターの除去、プライバシーのためのクエリ文字列の全除去。それぞれが上の 4 つの操作のいずれかにきれいに対応します。',
  'workbench.docs.body.queryParam.useCasesCaption': '4 つの典型的なパターン。意図に合う操作を選びます。',

  // ── Actions: Inject JS / CSS ────────────────────────────────────────
  'workbench.docs.body.inject.intro':
    '一致するページに JavaScript や CSS を注入します。コードはコンテンツスクリプトを通じてページのコンテキストで実行されます。',
  'workbench.docs.body.inject.timingCaption':
    '挿入のタイミング。ページスクリプト前（できるだけ早く）と DOM 安全（ページ読み込み後）。',
  'workbench.docs.body.inject.scriptTitle': 'スクリプトの注入',
  'workbench.docs.body.inject.script1': 'インラインのコードまたは外部 URL。挿入のタイミングを選びます：',
  'workbench.docs.body.inject.asapStrong': 'できるだけ早く',
  'workbench.docs.body.inject.asap1':
    '：ページ自身のスクリプトより前に実行します。競争に勝つ必要があるモンキーパッチ（例：アプリのコードが参照を掴む前に',
  'workbench.docs.body.inject.asap1Suffix': 'をラップする）に便利です。',
  'workbench.docs.body.inject.afterStrong': 'ページ読み込み後',
  'workbench.docs.body.inject.after1':
    '：ページの解析が終わってから実行します。要素の存在が保証されるため、DOM を読むコードにはより安全なデフォルトです。',
  'workbench.docs.body.inject.scriptCaption':
    'スクリプトはページ内の <script> タグとして置かれ、ページの JS と同じグローバルを見ます。',
  'workbench.docs.body.inject.cssTitle': 'CSS の注入',
  'workbench.docs.body.inject.css1Prefix': 'カスタム CSS を',
  'workbench.docs.body.inject.css1Suffix':
    'タグとして注入します。ダークモードの上書き、うるさい要素の非表示、環境ごとのテーマ付けに便利です。',
  'workbench.docs.body.inject.cssCaption': 'CSS は通常の CSS 詳細度を持つ <style> タグとして追記されます。',
  'workbench.docs.body.inject.wontApplyCaption':
    'サンドボックス化された iframe と厳格な CSP のページは、注入されたスクリプトをブロックします。',
  'workbench.docs.body.inject.whenTitle': '使いどころ',
  'workbench.docs.body.inject.when1':
    'アプリのコードが掴む前のブラウザー API のモンキーパッチ、ダークモードテーマの強制、うるさい UI 要素の非表示、ページの初期化前の window レベルの機能フラグの仕込み。',
  'workbench.docs.body.inject.useCasesCaption':
    '4 つの典型的なパターン。1 つ目と 4 つ目には「できるだけ早く」のタイミングが必要です。',

  // ── Actions: Delay ──────────────────────────────────────────────────
  'workbench.docs.body.delay.intro':
    '一致するリクエストに人工的な遅延を加えます。リクエストの種類に応じて 3 つのレーンが並行して動きます。',
  'workbench.docs.body.delay.routingCaption': '遅延のルーティング。3 種類のリクエストに 3 つのレーン。',
  'workbench.docs.body.delay.navHeading': 'ドキュメントと iframe のナビゲーション',
  'workbench.docs.body.delay.nav1Prefix': 'ローカルの待機ページを経由します。',
  'workbench.docs.body.delay.navMs': '30,000 ms',
  'workbench.docs.body.delay.nav1Suffix': 'までの遅延を尊重します。Chrome の DNR リダイレクトの上限です。',
  'workbench.docs.body.delay.navCaption':
    'ローカルの待機ページがナビゲーションを N ms 保留し、その後本来の宛先へ転送します。',
  'workbench.docs.body.delay.xhrHeading': 'JS 起点の XHR / fetch',
  'workbench.docs.body.delay.xhr1Prefix': 'ページレベルの',
  'workbench.docs.body.delay.xhr1Middle': 'のモンキーパッチが傍受します。上限は',
  'workbench.docs.body.delay.xhrMs': '5,000 ms',
  'workbench.docs.body.delay.xhr1Suffix':
    'で、Chrome の HTTP 接続プールを枯渇させないためです。それを超える値はワイヤー上で切り詰められます。',
  'workbench.docs.body.delay.xhrCaption':
    'ページレベルのパッチ内の setTimeout が呼び出しを保留してからネットワークへ転送します。',
  'workbench.docs.body.delay.wontApplyCaption':
    'サブリソースとサービスワーカーの fetch はページレベルのモンキーパッチを逃れます。',
  'workbench.docs.body.delay.whenTitle': '使いどころ',
  'workbench.docs.body.delay.when1':
    'ローディング状態のリグレッションの発見、デバウンス / スロットルのコードパスの検証、並行リクエスト間の競合状態の露出、ローカル開発中の低速ネットワークの近似。',
  'workbench.docs.body.delay.useCasesCaption': '4 つの典型的なパターン。URL パターンやドメインと組み合わせて絞ります。',
  'workbench.docs.body.delay.desktopNoteTitle': 'デスクトップアプリ：製品ノート',
  'workbench.docs.body.delay.desktopNote1':
    '静的リソース（画像、スクリプト、スタイルシート、フォント）のスロットリングには、接続を開いたまま保ちバイトをストリーミングできる本物のローカルネットワーク層が必要で、拡張機能の手には届きません。デスクトップアプリがまもなくそれを引き受けます。',

  // ── Actions: Request Body ───────────────────────────────────────────
  'workbench.docs.body.requestBody.introPrefix':
    'リクエストボディがブラウザーを出る前に上書きまたは変換します。スクリプトベースで、次を傍受します：',
  'workbench.docs.body.requestBody.introAnd': 'と',
  'workbench.docs.body.requestBody.introDot': '.',
  'workbench.docs.body.requestBody.interceptCaption':
    'ルールは page.js とネットワークの間で発火します。3 つの変換の形。',
  'workbench.docs.body.requestBody.staticTitle': '静的ボディ',
  'workbench.docs.body.requestBody.static1':
    'リクエストボディ全体を固定の文字列に置き換えます。REST と GraphQL の両方で動作します。ルールはボディを解析せず、丸ごと差し替えます。',
  'workbench.docs.body.requestBody.staticCaption': 'ボディ全体を置き換え、元のものは破棄されます。',
  'workbench.docs.body.requestBody.dynamicTitle': '動的ボディ',
  'workbench.docs.body.requestBody.dynamic1':
    '元のボディとリクエストのコンテキストを受け取り、変更後のボディを返す関数を書きます。関数が受け取るのは次のとおりです：',
  'workbench.docs.body.requestBody.dynamicDot': '.',
  'workbench.docs.body.requestBody.dynamicCaption': '関数は元のものを見て、送るべきものを返します。',
  'workbench.docs.body.requestBody.graphqlTitle': 'GraphQL フィルター',
  'workbench.docs.body.requestBody.graphql1Prefix':
    '「リソースの種類」が GraphQL のとき、ルールは JSON ペイロードの設定したフィールドが値に一致するリクエストでのみ発火します。ランタイムはリクエストボディを JSON として解析し、',
  'workbench.docs.body.requestBody.graphql1Middle': 'で指定されたフィールドを読み、選んだ演算子（完全一致は',
  'workbench.docs.body.requestBody.graphql1Middle2': '、部分文字列は',
  'workbench.docs.body.requestBody.graphql1Middle3': '）で',
  'workbench.docs.body.requestBody.graphql1Suffix': 'と照合します。',
  'workbench.docs.body.requestBody.graphql2Prefix': 'よく使うキー：名前付きの操作には',
  'workbench.docs.body.requestBody.graphql2Middle': '、クエリテキストの部分文字列には',
  'workbench.docs.body.requestBody.graphql2Suffix':
    '。JSON ボディのないリクエストや、フィールドが欠けているか一致しないリクエストは手つかずで通過します。',
  'workbench.docs.body.requestBody.graphqlCaption': 'フィールドレベルのゲート。一致しない操作は手つかずで流れます。',
  'workbench.docs.body.requestBody.wontApplyCaption':
    'GET/HEAD には置き換えるものがなく、静的リソースはスクリプトの傍受に入りません。',
  'workbench.docs.body.requestBody.whenTitle': '使いどころ',
  'workbench.docs.body.requestBody.when1':
    'テストフィクスチャの強制、すべてのペイロードへのメタデータ（デバッグフラグ、リクエスト ID）の刻印、特定の GraphQL 操作のモック、再生前の PII の匿名化が 4 つの典型的なパターンです。',
  'workbench.docs.body.requestBody.useCasesCaption':
    '4 つの典型的なパターン。URL パターンやドメインと組み合わせて絞ります。',

  // ── Actions: Modify Response ────────────────────────────────────────
  'workbench.docs.body.response.introPrefix':
    'API 呼び出しを傍受してカスタムのレスポンスを返します。ステータスコード、ボディ、レスポンスヘッダーを完全に制御できます。スクリプトベースで、次を傍受します：',
  'workbench.docs.body.response.introAnd': 'と',
  'workbench.docs.body.response.introDot': '.',
  'workbench.docs.body.response.flowCaption':
    '静的はネットワークを完全にスキップし、動的はまずネットワークに当たってから変換します。',
  'workbench.docs.body.response.staticTitle': '静的レスポンス',
  'workbench.docs.body.response.static1':
    '固定のボディを返し、合成レスポンスを完全に制御します。ステータスコード、Content-Type、追加のレスポンスヘッダー（Set-Cookie、CORS ヘッダー、カスタムフラグ）。実際のリクエストは決して行われません。既知のフィクスチャに対するオフライン開発に便利です。',
  'workbench.docs.body.response.staticCaption':
    'サーバーには決して接続せず、ページはワイヤーから来たかのようにフィクスチャを受け取ります。',
  'workbench.docs.body.response.dynamicTitle': '動的レスポンス',
  'workbench.docs.body.response.dynamic1':
    'まず実際のリクエストが行われます。あなたの関数はレスポンスとリクエストのコンテキストを受け取り、変更後のレスポンスを返します。関数が受け取るのは次のとおりです：',
  'workbench.docs.body.response.dynamicDot': '.',
  'workbench.docs.body.response.dynamic2':
    'ルールに設定したステータスコード、Content-Type、レスポンスヘッダーのフィールドは関数の戻り値の上に引き続き適用されるため、ボディを変えつつラッパーのヘッダーはルールに制御させられます。',
  'workbench.docs.body.response.dynamicCaption': 'まず実際の呼び出しが行われ、関数が戻ってきたものを書き換えます。',
  'workbench.docs.body.response.graphqlTitle': 'GraphQL フィルター',
  'workbench.docs.body.response.graphql1':
    '「リソースの種類」が GraphQL のとき、ルールは JSON ペイロードの設定したフィールドが設定した値に一致（等しい、または含む）するリクエストでのみ発火します。そのため、多くの操作を多重化する単一のエンドポイントを、一度に 1 つの操作ずつ傍受できます。ペイロードが一致しないリクエストは手つかずでネットワークへ通過します。',
  'workbench.docs.body.response.wontApplyCaption':
    '静的リソースとページのナビゲーションは決してスクリプトの傍受に入りません。',
  'workbench.docs.body.response.whenTitle': '使いどころ',
  'workbench.docs.body.response.when1':
    'フィクスチャに対するオフライン開発、特定のエラーレスポンスのシミュレーション、ページに届く前の PII の秘匿、実際のバックエンドでは再現しにくいエッジケースのペイロード形の検証。',
  'workbench.docs.body.response.useCasesCaption':
    '4 つの典型的なパターン。フィクスチャには静的を、実データの変換には動的を選びます。',

  // ── Reference: Conditions ───────────────────────────────────────────
  'workbench.docs.body.conditions.intro1Prefix':
    '条件は送信リクエストの 1 つの属性に対するフィルターです。複数の条件を積み重ねると AND 論理で結合され、ルールが発火するにはすべての条件が一致する必要があります。各条件は Chrome の',
  'workbench.docs.body.conditions.intro1Suffix': 'のフィールドに直接対応します。',
  'workbench.docs.body.conditions.intro2Prefix': 'ほとんどの条件には、ルールエディターに',
  'workbench.docs.body.conditions.exclStrong': '除外',
  'workbench.docs.body.conditions.intro2Suffix':
    'の変種（除外メソッド、除外リソース、除外イニシエーター、除外レスポンスヘッダー）もあり、一致を反転します（例：「これらのメソッド以外のすべて」）。否定の集合が肯定の集合より小さいときはいつでも使ってください。',
  'workbench.docs.body.conditions.anatomyCaption':
    'ルールは AND で一致する条件と 1 つのアクションを組み合わせます。条件がルールを発火させるかどうかを決めます。',
  'workbench.docs.body.conditions.matchingCaption':
    '各条件はリクエストの 1 つの属性を検査します。ルールが発火するにはすべてが一致する必要があります。',
  'workbench.docs.body.conditions.hostVsOriginCaption':
    'ページ URL と fetch の宛先 URL は別々に追跡されます。ドメインの条件が 2 つあるのはそのためです。',
  'workbench.docs.body.conditions.urlPatternTitle': 'URL パターン',
  'workbench.docs.body.conditions.urlPattern1Prefix':
    '完全な URL に対するワイルドカードのパターンです。任意の文字に一致させるには',
  'workbench.docs.body.conditions.urlPattern1Middle': 'を使います。プロトコルは指定が必要です：',
  'workbench.docs.body.conditions.urlPattern1Middle2': 'は任意、',
  'workbench.docs.body.conditions.urlPattern1Suffix': 'は HTTPS のみです。',
  'workbench.docs.body.conditions.urlPatternCaption':
    '金色 = ワイルドカード、緑 = リテラル。下の各テスト URL は、パターンが一致するかどうかを示します。',
  'workbench.docs.body.conditions.urlRegexTitle': 'URL 正規表現',
  'workbench.docs.body.conditions.urlRegex1':
    'プロトコルを含む完全な URL に対する RE2 の正規表現です。ワイルドカードでは表現できない一致のためのもの。同じルール内で URL パターンとは併用できません。',
  'workbench.docs.body.conditions.urlRegexCaption':
    '紫 = 本物の正規表現構文。緑 = リテラル文字。下の各テスト URL は、正規表現が一致するかどうかを示します。',
  'workbench.docs.body.conditions.requestDomainsTitle': 'リクエストドメイン',
  'workbench.docs.body.conditions.requestDomains1Prefix':
    'ドメインとそのすべてのサブドメインに自動的に一致します。頂点のドメインを一度入力すれば、ルールは',
  'workbench.docs.body.conditions.requestDomains1Suffix':
    '、そしてワイルドカードなしでさらに深い入れ子までカバーします。',
  'workbench.docs.body.conditions.requestDomainsCaption':
    '1 つの値ですべてのサブドメイン。下の境界ケースは、何が真のサブドメインとみなされるかを示します。',
  'workbench.docs.body.conditions.excludeDomainsTitle': '除外ドメイン',
  'workbench.docs.body.conditions.excludeDomains1':
    '別の条件の一致からホストを差し引きます。リクエストドメインと同じサブドメインの意味論のため、ホストを除外するとそのサブドメインも除外されます。単独では何にも一致しません。',
  'workbench.docs.body.conditions.excludeDomainsCaption':
    '緑の包含が候補の集合に絞り、赤の除外がその一部を取り除きます。サブドメインは追従します。',
  'workbench.docs.body.conditions.initiatorDomainsTitle': 'イニシエータードメイン',
  'workbench.docs.body.conditions.initiatorDomains1':
    'リクエスト時にどのページが開いているかで一致します。リクエストの発信元であって、宛先ではありません。同じ URL への同じ fetch 呼び出しでも、ユーザーが閲覧しているタブによって一致したりしなかったりします。',
  'workbench.docs.body.conditions.initiatorDomainsCaption':
    '同じ宛先、2 つの異なるページコンテキスト。どちらが一致するかはイニシエーターが決めます。',
  'workbench.docs.body.conditions.methodsTitle': 'メソッド',
  'workbench.docs.body.conditions.methods1':
    'HTTP の動詞でフィルターします。複数選択で、一致させるメソッドを選ぶと、それ以外はルールを起動しません。すべてのメソッドに一致させるには、この条件を完全にオフにしておいてください。',
  'workbench.docs.body.conditions.methodsCaption':
    'オレンジのピルは選択済み、灰色はスキップ。下のテストリクエストは各動詞の結果を辿ります。',
  'workbench.docs.body.conditions.resourceTypesTitle': 'リソースの種類',
  'workbench.docs.body.conditions.resourceTypes1Prefix':
    '読み込まれるリソースの種類でフィルターします。ページのナビゲーション、XHR/fetch、スクリプト、画像、フォントなど。メソッドと同様に複数選択です。コード名と具体例を含む完全な一覧は',
  'workbench.docs.body.conditions.resourceTypesLink': 'リソースの種類',
  'workbench.docs.body.conditions.resourceTypes1Suffix': 'のリファレンスを参照してください。',
  'workbench.docs.body.conditions.resourceTypesCaption':
    '紫の種類は一致、灰色の種類はスキップ。各テストリクエストはその種類をインラインで示します。',
  'workbench.docs.body.conditions.domainTypeTitle': 'ドメインの種別',
  'workbench.docs.body.conditions.domainType1Prefix':
    '各リクエストをページとの関係で分類します。宛先がページの登録可能ドメインを共有するなら',
  'workbench.docs.body.conditions.domainType1Middle': '、そうでなければ',
  'workbench.docs.body.conditions.domainType1Suffix':
    'です。よくある使い方：トラッカーのブロック（thirdParty のみに一致）や、自分のサービスへのルールの限定（firstParty のみに一致）。',
  'workbench.docs.body.conditions.domainTypeCaption':
    'ページのバナーがオリジンを設定し、セレクターがどの種別に一致させるかを選び、表が宛先ごとの判定を示します。',
  'workbench.docs.body.conditions.headersTitle': 'レスポンスヘッダー',
  'workbench.docs.body.conditions.headers1':
    '特定のヘッダーを特定の値で持つレスポンスに一致します。Chrome の DNR はリクエストヘッダーの一致を公開していないため、この条件はレスポンス側のみです。ヘッダー名と値はどちらも厳密な文字列として比較され（ワイルドカードなし、部分一致なし）、ヘッダーは実際にレスポンスに存在する必要があります。',
  'workbench.docs.body.conditions.headersCaption':
    '2 つのピル（名前 + 値）を = で結び、各失敗モードに当たるテストレスポンスヘッダーを続けます。',

  // ── Open Headers: Paradigm ──────────────────────────────────────────
  'workbench.docs.body.paradigm.oneExtensionHeading': 'すべてを 1 つの拡張機能に',
  'workbench.docs.body.paradigm.oneExtension1':
    '歴史的に、この領域は 3 つの製品カテゴリに分かれてきました。デスクトッププロキシは HTTP の傍受を担い、クラウドの API プラットフォームはリクエストとコレクションを保持し、軽量なヘッダー拡張機能は「ヘッダーを 1 つ書き換えるだけ」のケースをカバーします。どれも他の 2 つを備えていません。Open Headers は備えています。1 つのブラウザー拡張機能の中で、1 つのワークスペースストアがすべての面を動かします。',
  'workbench.docs.body.paradigm.convergenceCaption':
    '3 つのレガシーなカテゴリが 1 つのインストールに収束します。この組み合わせを拡張機能の中で提供しているものは他にありません。',
  'workbench.docs.body.paradigm.ruleEngineHeading': 'エンタープライズ級のルールエンジン',
  'workbench.docs.body.paradigm.ruleEngine1Prefix':
    'ルールエンジンは 9 つの UI に引き伸ばされた 1 つの小技ではなく、共通の言語を上に載せた 2 つの本物の実行経路です。',
  'workbench.docs.body.paradigm.dnrNativeStrong': 'DNR ネイティブ',
  'workbench.docs.body.paradigm.ruleEngine1Middle': 'のルールは Chrome の',
  'workbench.docs.body.paradigm.ruleEngine1Middle2':
    'API にコンパイルされ、ブラウザーが発行するすべてのリクエスト（ページ、サブフレーム、fetch、XHR、画像、フォント、スクリプト）を捕まえます。',
  'workbench.docs.body.paradigm.scriptEngineStrong': 'スクリプトエンジン',
  'workbench.docs.body.paradigm.ruleEngine1Suffix':
    'は DNR が届かないところを引き受けます。ヘッダーの値のマージ、ボディの変換、レスポンスのモック、コードの注入、呼び出しの遅延。両方のエンジンは同じ条件言語と同じ 5 つの変数スコープを読むため、DNR に対して書いたルールは、アクションの種類を 1 つ変えるだけでスクリプトエンジンに移ります。',
  'workbench.docs.body.paradigm.ruleEngineCaption':
    '2 つの実行経路、9 つのルールカテゴリ、1 つの共通の条件 + 変数の言語。',
  'workbench.docs.body.paradigm.apiCatalogHeading': '完全な API リクエストのカタログ',
  'workbench.docs.body.paradigm.apiCatalog1':
    'デスクトップの API クライアントが備えるすべての機能（リクエストの構築、環境、OAuth 2.0（PKCE、Client Credentials、リフレッシュを含む）、プリリクエストとポストレスポンスのスクリプト、内容アドレス方式のファイル blob を使う multipart、コレクションとフォルダー、スキーマのイントロスペクション付き GraphQL）が拡張機能の中にあります。ルールと同じワークスペースストア、同じ 5 つの変数スコープ、同じ面です。別のプラットフォームからコレクションを持ち込んでそのまま作業を続けられ、あなたが制御しないクラウドへ何もエクスポートされません。',
  'workbench.docs.body.paradigm.apiCatalogCaption':
    'プロトコル対応、すべての認証タイプ、スクリプト、ファイル、コレクションを備えたリクエストエディター。拡張機能の中に。',
  'workbench.docs.body.paradigm.localFirstHeading': '設計からローカルファースト',
  'workbench.docs.body.paradigm.localFirst1Prefix':
    '「ローカルファースト」は機能ではなく姿勢です。拡張機能にはアカウントシステムも、クラウドの中継も、トラッキングもありません。唯一の使用データは匿名の機能の集計で、バイト単位まで確認でき、スイッチ 1 つでオフにできます。そしてバックエンドを',
  'workbench.docs.body.paradigm.localFirstWhere': 'どこに',
  'workbench.docs.body.paradigm.localFirst1Suffix':
    '置くかを本当に選べます。4 つのホスティングの選択肢はすべてローカルのみで、すべてあなたの制御下にあります。ブラウザー内のサービスワーカー（今すぐ、セットアップ不要）、デスクトップアプリに埋め込まれたバックエンド、1 台のマシンで Open Headers のすべての面を提供するスタンドアロンのローカルサーバー、または自分の VM でセルフホストするバックエンド。どの選択肢も同じ保証を保ち、トレードオフは所有権ではなく到達範囲です。',
  'workbench.docs.body.paradigm.localFirst2':
    'チームのコラボレーションは、ベンダーのサーバーではなく、ユーザーが制御するストレージバックエンド（Git）を通じて提供されます。',
  'workbench.docs.body.paradigm.frontEnds1Prefix': '同じ原則は、そのデータに',
  'workbench.docs.body.paradigm.frontEndsHow': 'どうやって',
  'workbench.docs.body.paradigm.frontEnds1Suffix':
    '到達するかにも当てはまります。ブラウザー拡張機能がデフォルトのフロントエンドで、ブラウザー内に 4 つの面があります。ネイティブのデスクトップアプリ、CLI、リモートの Web アプリがそれと並んで提供されます。すべてのフロントエンドは選んだバックエンドと話します。どの組み合わせを選んでも、すべての面が同期を保ちます。',
  'workbench.docs.body.paradigm.autoSyncHeading': '作業を失わない自動同期',
  'workbench.docs.body.paradigm.autoSync1Prefix':
    'デバイス間の同期は、ローカルファーストの製品が折れてクラウドを信頼するよう求める場所になりがちです。Open Headers はこれを',
  'workbench.docs.body.paradigm.perFieldStrong': 'フィールド単位',
  'workbench.docs.body.paradigm.autoSync1Middle': 'で解決します。ポップアップがルールの',
  'workbench.docs.body.paradigm.autoSync1Suffix':
    'フラグを切り替え、ワークベンチが同じルールのヘッダー値を書き換えても、どちらの順序でも両方が反映され、古い下書きのバナーも上書きもありません。同じアプローチが、1 つの拡張機能の 4 つの面から、拡張機能 + デスクトップ + CLI を支えるローカルサーバー、そして Git のリモートを通じた複数ユーザーのチームワークスペースまで、間にベンダーのサーバーを一切必要とせずにスケールします。',
  'workbench.docs.body.paradigm.fieldSyncCaption':
    '2 つの面、1 つのルール、異なるフィールド。両方の編集が反映され、何も上書きされません。',
  'workbench.docs.body.paradigm.noteCalloutPrefix': '試したことのある他のツールとの比較を見たいですか？次は',
  'workbench.docs.body.paradigm.comparisonLink': '他との比較',
  'workbench.docs.body.paradigm.noteCalloutMiddle': 'です。プラットフォーム全体を一望したいなら、次へ進んでください：',
  'workbench.docs.body.paradigm.roadmapLink': 'すべての面を出荷済み',
  'workbench.docs.body.paradigm.noteCalloutSuffix': '.',

  // ── Open Headers: Comparison ────────────────────────────────────────
  'workbench.docs.body.comparison.intro1':
    '最も短く言えば、Open Headers は、デスクトッププロキシのリクエスト整形の力、クラウド API プラットフォームのルールライブラリ、ヘッダー専用拡張機能の常時オンの面を取り、それらに 1 つのストアを共有させたら出来上がるものです。',
  'workbench.docs.body.comparison.matrixCaption':
    '3 つの製品カテゴリ、それぞれのトレードオフ、そして Open Headers の位置。',
  'workbench.docs.body.comparison.vsCloudHeading': 'クラウド API プラットフォームとの比較',
  'workbench.docs.body.comparison.vsCloud1':
    'クラウドホストのツールは、トラフィック、資格情報、ルールの定義が自社のサーバーにあることを前提にします。そのモデルは、データがあなたのマシンから出ることと、自分の作業にアクセスするためにアカウントを維持することを受け入れる前提です。Open Headers はどちらも前提にしません。すべてはローカルに留まり、チームのコラボレーションはベンダーのデータベースではなく、ユーザーが制御するストレージ（Git）を通じて提供されます。',
  'workbench.docs.body.comparison.vsProxiesHeading': 'デスクトッププロキシとの比較',
  'workbench.docs.body.comparison.vsProxies1Prefix':
    'プロキシはすべてのトラフィックを別プロセスに通します。強力ですが重い。バイナリをインストールし、CA 証明書をインストールし、各アプリをプロキシのポートに向けるよう設定します。Open Headers は静的なトラフィックには Chrome の',
  'workbench.docs.body.comparison.vsProxies1Suffix':
    'API を、動的な変換にはページごとのスクリプトエンジンを使います。プロキシのポートも、CA 証明書も、アプリごとの設定も不要で、一致したルールは中間者ではなくページ自身の権限で適用されます。',
  'workbench.docs.body.comparison.vsHeaderOnlyHeading': 'ヘッダー専用拡張機能との比較',
  'workbench.docs.body.comparison.vsHeaderOnly1Prefix':
    'ヘッダー専用の拡張機能は正確に 1 種類のルールを扱い、そこで止まります。Open Headers は',
  'workbench.docs.body.comparison.nineLink': '9 種類',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle': 'を扱います。ヘッダーの追加 / 上書き / 追記 / 削除 / マージ、',
  'workbench.docs.body.comparison.blockLink': 'ブロック',
  'workbench.docs.body.comparison.redirectLink': 'リダイレクト',
  'workbench.docs.body.comparison.queryParamsLink': 'クエリパラメーター',
  'workbench.docs.body.comparison.injectLink': '注入',
  'workbench.docs.body.comparison.delayLink': '遅延',
  'workbench.docs.body.comparison.requestBodyLink': 'リクエストボディ',
  'workbench.docs.body.comparison.responseLink': 'レスポンス',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle2': '。すべて同じ',
  'workbench.docs.body.comparison.conditionLanguageLink': '条件言語',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle3': 'で駆動され、すべて同じ',
  'workbench.docs.body.comparison.requestTrackingLink': 'リクエスト追跡',
  'workbench.docs.body.comparison.vsHeaderOnly1Suffix': 'の面で観測できます。',
  'workbench.docs.body.comparison.whyMattersTitle': '実際になぜ重要か',
  'workbench.docs.body.comparison.whyMatters1':
    'ほとんどのワークフローは、これらのカテゴリの 2 つ以上に当たります。API レスポンスのモック、サードパーティのトラッカーのブロック、特定の 1 つの環境へのデバッグヘッダーの強制は 3 つの異なるルールの種類で、レガシーの世界では 3 つの異なるインストールです。ここでは、それらは 1 つのワークスペースを共有します。',

  // ── Open Headers: Roadmap ───────────────────────────────────────────
  'workbench.docs.body.roadmap.intro1Prefix':
    'Open Headers はローカルのみ、つまり 1 台のデバイスの 1 つの拡張機能から始まりました。下のすべてのマイルストーンはその形を壊さずに広げ、そのすべてが出荷済みです。ユーザー間の同期は',
  'workbench.docs.body.roadmap.userControlledStrong': 'ユーザーが制御する',
  'workbench.docs.body.roadmap.intro1Suffix':
    '手段（Git リポジトリとセルフホストのデプロイ）で提供され、ベンダーがホストするクラウドは決して使いません。',
  'workbench.docs.body.roadmap.gitHeading': 'Git によるワークスペースのコラボレーション（チーム対応）',
  'workbench.docs.body.roadmap.git1Prefix':
    'ワークスペースはあなたが制御する Git リポジトリの YAML にシリアライズされます。プルで同期し、プッシュで共有し、マージの競合は Git の既存のツールで解決します。中央サーバーも、アカウントも、ベンダーロックインもありません。リアルタイムのプレゼンスは',
  'workbench.docs.body.roadmap.gitAnd': 'と',
  'workbench.docs.body.roadmap.git1Suffix': 'です。耐久性があり、監査でき、既に理解されているもの。',
  'workbench.docs.body.roadmap.desktopHeading': 'デスクトップアプリ',
  'workbench.docs.body.roadmap.desktop1':
    '拡張機能と同じワークスペースストアを動かすネイティブのバイナリです。拡張機能では届かない面（システムレベルのトラフィック整形、マルチウィンドウの編集、より深いファイルシステム統合）に便利です。両者は同じディスク上の形式を共有するため、拡張機能が所有するワークスペースをデスクトップアプリで開くのは移行ではなく読み取りです。',
  'workbench.docs.body.roadmap.mcpHeading': 'MCP サーバー：AI エージェントによる制御',
  'workbench.docs.body.roadmap.mcp1Prefix': 'Open Headers は',
  'workbench.docs.body.roadmap.mcpStrong': 'Model Context Protocol',
  'workbench.docs.body.roadmap.mcp1Suffix':
    'で自身を公開するため、MCP 対応のあらゆる AI クライアント（Claude Desktop、Claude Code、Cursor、VS Code、Cline、そしてその背後の成長するエコシステム）がワークスペースを直接操作できます。ヘッダールールの追加、保存済みリクエストのステージングでの実行、環境の切り替え、2 つのワークスペースの差分、Postman コレクションのインポートを平易な言葉でエージェントに頼めば、エージェントがそれを MCP のツール呼び出しに翻訳し、ワークベンチが結果を反映します。',
  'workbench.docs.body.roadmap.mcp2Prefix': 'サーバーはデフォルトで',
  'workbench.docs.body.roadmap.mcpLocalOnlyStrong': 'ローカルのみ',
  'workbench.docs.body.roadmap.mcp2Middle':
    '（stdio トランスポート、同じマシン上のクライアントと 1 対 1 でペアリング）で動作し、セルフホストする場合は',
  'workbench.docs.body.roadmap.mcpRemoteStrong': 'リモート向けの HTTP/SSE',
  'workbench.docs.body.roadmap.mcp2Suffix':
    'で動作します。ベンダーの中継はなく、エージェントはあなたのインストールと直接話します。ツール呼び出しはあなたと同じワークスペース権限で実行され、シークレットは vault の背後に留まり、機微な操作はオプトインのままです。',
  'workbench.docs.body.roadmap.serverHeading': 'デバイス間同期のためのローカル / LAN サーバー',
  'workbench.docs.body.roadmap.server1':
    'あなたのマシン、LAN、またはトンネルしたホストで動かせるサーバーです。拡張機能、デスクトップアプリ、CLI はすべて同じサーバーのクライアントになり、使うすべてのデバイスで同じワークスペース、同じルール、同じ vault を共有します。サーバーはローカルネットワークに留まり、その上に重ねられたオプトインのクラウド経路はありません。',
  'workbench.docs.body.roadmap.cliHeading': 'CLI',
  'workbench.docs.body.roadmap.cli1':
    'ヘッドレスのスクリプティングと CI 統合です。ルールの一覧、環境の切り替え、シェルからの保存済みリクエストの単発実行、別のワークスペースとの差分。CLI は拡張機能やデスクトップアプリと同じサーバーと話すため、自動化は UI で見えるものと同期を保ちます。',
  'workbench.docs.body.roadmap.webAppHeading': 'セルフホストの VM デプロイ + Web アプリ',
  'workbench.docs.body.roadmap.webApp1':
    '同じ UI を、自分のオリジンから配信できる Web バンドルとして提供します。ロックダウンされた企業のブラウザー、キオスク端末、拡張機能のインストールが選択肢にないあらゆる環境のため、そして自分のドメインでブランド化した Open Headers のデプロイを望むユーザーのために。',
  'workbench.docs.body.roadmap.importersHeading': 'インポーター',
  'workbench.docs.body.roadmap.importers1':
    'cURL / HAR / Postman のインポーターに加えて、Insomnia のコレクション、OpenAPI 仕様、完全な HAR リクエストのインポート（ヘッダーだけでなく）が今日すべて利用できます。インポーターの同等性は、Open Headers が既に別のツールに投資した人々の採用を勝ち取る方法です。コレクションを一手で持ち込み、そのまま作業を続けてください。',
  'workbench.docs.body.roadmap.cloudCalloutTitle': 'ホストされたクラウドバックエンドは？',
  'workbench.docs.body.roadmap.cloudCallout1':
    '当面は予定にありません。クラウドホストのバックエンドが欲しいなら、自分の VM でセルフホストできます（上記参照）。',

  // ── Docs sub-anchor (i) popovers (DOC_ANCHOR_INFO) ──────────────────
  'workbench.docs.anchor.override.title': '追加 / 上書き',
  'workbench.docs.anchor.override.summary':
    'ヘッダーをこの値に設定します。なければ追加し、既存の値があれば置き換えます。',
  'workbench.docs.anchor.append.title': '追記',
  'workbench.docs.anchor.append.summary':
    'ヘッダーの既存の値にこの値を追記します。追記に対応するのは標準のリスト値ヘッダーだけで、それ以外ではルールは下書きとして保存されます。',
  'workbench.docs.anchor.remove.title': '削除',
  'workbench.docs.anchor.remove.summary':
    '一致するトラフィックからヘッダーを完全に取り除きます。値のフィールドは使いません。',
  'workbench.docs.anchor.merge.title': 'マージ',
  'workbench.docs.anchor.merge.summary': 'ヘッダーの既存のリストにこの値をマージし、既にある値はスキップします。',
  'workbench.docs.anchor.qpAdd.title': '追加 / 上書き',
  'workbench.docs.anchor.qpAdd.summary': 'URL にパラメーターを設定します。なければ追加し、既にあれば置き換えます。',
  'workbench.docs.anchor.qpOverride.title': '上書きのみ',
  'workbench.docs.anchor.qpOverride.summary':
    'URL が既にそのパラメーターを持つ場合にのみ値を置き換えます。持たない URL は変わらず通過します。',
  'workbench.docs.anchor.qpRemove.title': '削除',
  'workbench.docs.anchor.qpRemove.summary': '一致する URL からパラメーターを削除します。',
  'workbench.docs.anchor.qpRemoveAll.title': 'すべて削除',
  'workbench.docs.anchor.qpRemoveAll.summary':
    '一致する URL からクエリ文字列全体を取り除きます。これがある間、同じルール内の他の操作は無視されます。',
  'workbench.docs.anchor.urlPattern.title': 'URL パターン',
  'workbench.docs.anchor.urlPattern.summary':
    'リクエスト URL を urlFilter パターンと照合します。* のワイルドカード、|| のドメインアンカー、^ の区切り。',
  'workbench.docs.anchor.urlRegex.title': 'URL 正規表現',
  'workbench.docs.anchor.urlRegex.summary':
    'リクエスト URL を正規表現と照合します。キャプチャグループはリダイレクト先の \\1、\\2 の代入に使われます。',
  'workbench.docs.anchor.requestDomains.title': 'リクエストドメイン',
  'workbench.docs.anchor.requestDomains.summary':
    '対象ホストが列挙したドメインのいずれかであるリクエストに一致します。サブドメインを含みます。',
  'workbench.docs.anchor.excludeDomains.title': '除外ドメイン',
  'workbench.docs.anchor.excludeDomains.summary':
    '対象ホストが列挙されているものを除く、すべてのリクエストに一致します。',
  'workbench.docs.anchor.initiatorDomains.title': 'イニシエータードメイン',
  'workbench.docs.anchor.initiatorDomains.summary':
    'リクエスト URL そのものではなく、リクエストを発行したページで一致します。除外の変種は一覧を反転します。',
  'workbench.docs.anchor.methods.title': 'メソッド',
  'workbench.docs.anchor.methods.summary': 'HTTP メソッド（GET、POST、…）で一致します。除外の変種は一覧を反転します。',
  'workbench.docs.anchor.conditionResourceTypes.title': 'リソースの種類',
  'workbench.docs.anchor.conditionResourceTypes.summary':
    'ブラウザーが取得しているもの（ドキュメント、スクリプト、XHR/fetch、画像、…）で一致します。除外の変種は一覧を反転します。',
  'workbench.docs.anchor.domainType.title': 'ドメインの種別',
  'workbench.docs.anchor.domainType.summary':
    'ファーストパーティはページと同じサイトへのリクエストに、サードパーティはクロスサイトのリクエストに一致します。',
  'workbench.docs.anchor.headers.title': 'レスポンスヘッダー',
  'workbench.docs.anchor.headers.summary':
    '受信したレスポンスのヘッダーで一致します。存在で、または値が与えられていれば値で。',
  'workbench.docs.anchor.redirectRegex.title': '正規表現の代入',
  'workbench.docs.anchor.redirectRegex.summary':
    'URL 正規表現の条件と組み合わせると、\\1、\\2 … がキャプチャグループをリダイレクト先に挿入します。',
  'workbench.docs.anchor.requestBodyDynamic.title': '動的（JavaScript）',
  'workbench.docs.anchor.requestBodyDynamic.summary':
    '一致する各リクエストに対してあなたの JavaScript を実行し、元のボディから送信ボディを組み立てます。',
  'workbench.docs.anchor.responseDynamic.title': '動的（JavaScript）',
  'workbench.docs.anchor.responseDynamic.summary':
    '一致する各レスポンスに対してあなたの JavaScript を実行します。実際の応答を変換する（ネットワーク）か、ゼロから組み立てる（モック）か。',
  'workbench.docs.anchor.requestBodyGraphql.title': 'GraphQL 操作フィルター',
  'workbench.docs.anchor.requestBodyGraphql.summary':
    'リクエストのペイロードにある GraphQL の操作名で、ルールをさらに制限します。',
  'workbench.docs.anchor.responseGraphql.title': 'GraphQL 操作フィルター',
  'workbench.docs.anchor.responseGraphql.summary':
    'リクエストのペイロードにある GraphQL の操作名で、ルールをさらに制限します。',
} as const satisfies Catalog;
