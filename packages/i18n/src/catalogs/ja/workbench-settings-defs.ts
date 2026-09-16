/**
 * Workbench settings — the setting-definition corpus for the app-side
 * categories — Japanese. Mirrors
 * `catalogs/en/workbench-settings-defs.ts` key for key. Brand and
 * platform vocabulary (Chrome / Firefox / Edge, font names, window
 * titles) rides raw per the S48 settings-station decisions;
 * `declarativeNetRequest`, `url-filter`, `Cache-Control: no-cache`,
 * `{{ns.X}}` references, INVALID_ARGUMENT and IP/port literals are
 * wire tokens. The workspaceLayout section quotes the ja devpanel-defs
 * twins verbatim（両端 / 積み重ね / 動的 / 比例 / ステータスバー /
 * トップバー）; merge strategies quote the import-export mints（「新規と
 * して追加」/「置き換え」）; 「このページ」 quotes the popup tab name;
 * デバッグモード / アタッチ / スコープ follow the debug vocabulary;
 * 「キャッシュを無効化」 quotes the panel toolbar mint; 更新して再起動 /
 * 診断ログをエクスポート carried. MINTS: エージェント = agent (MCP);
 * アクティビティフィード = Activity Feed; UI クローム = the UI chrome;
 * プロファイル = terminal profile (platform convention);
 * スクロールバック = scrollback; 並列 / 統合 = side-by-side / unified
 * diff; リガチャ = ligatures; アクセントカラー = accent color; デバウンス
 * = debounce; theme variant names (Warm / Rose / Sepia / Dim / Midnight
 * / Forest / Arctic) ride raw as palette proper names.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefs = {
  // ── Backend category defs ──────────────────────────────────────────
  'workbench.settings.def.backend.nmAutoJoin.label': '自動的にペアリング',
  'workbench.settings.def.backend.nmAutoJoin.description':
    'このコンピューターで Open Headers デスクトップアプリが動作しているとき、ペアリングコードなしで接続します。デスクトップはアクセスを許可する前に、オペレーティングシステムを通じてこのブラウザーを検証します。オフにすると、明示的な操作でのみペアリングします。',
  'workbench.settings.def.backend.nmAutoJoinProbe.label': 'バックグラウンドで確認',
  'workbench.settings.def.backend.nmAutoJoinProbe.description':
    'デスクトップアプリが接続されていないとき、数分おきにインストールされたかを確認し、新規インストールが自動で接続するようにします。オフにすると、拡張機能の起動時にのみ確認します。',
  'workbench.settings.def.backend.requireNmIdentity.label': '検証済みのペアリングを必須にする',
  'workbench.settings.def.backend.requireNmIdentity.description':
    'このコンピューターのデスクトップアプリに対するペアリングコードと貼り付けた token を拒否します。オペレーティングシステムで検証された引き渡しだけがアクセスを許可できます。リモートのバックエンドには影響しません。通常は組織のポリシーで設定されます。',
  'workbench.settings.def.backend.allowDesktopWatch.label': 'このブラウザーの閲覧を許可',
  'workbench.settings.def.backend.allowDesktopWatch.description':
    'このコンピューターのペアリング済みデスクトップアプリが、トラフィックパネルでこのブラウザーのネットワークトラフィック、ストレージ、コンソールを監視できるようにします。オフにすると、ルールと同期は動作し続けますが、デスクトップのライブビューは丁寧に拒否されます。',
  'workbench.settings.def.backend.bindAddress.label': 'ネットワーク上のデバイスと同期',
  'workbench.settings.def.backend.bindAddress.description':
    '同じネットワーク上の他のコンピューターやブラウザーがこのアプリに接続し、ワークスペースを共有できるようにします。デフォルトはオフで、このコンピューターだけが到達できます。',
  'workbench.settings.def.backend.bindAddress.option.loopback.label': 'ループバックのみ（127.0.0.1）',
  'workbench.settings.def.backend.bindAddress.option.loopback.description':
    'このマシンだけが接続できます。デフォルトです。',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.label': 'すべてのインターフェース（LAN）',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.description':
    'ローカルネットワーク上の他のデバイスが接続できます。U3.2 の認証 token が必要です。',
  'workbench.settings.def.backend.bindPort.label': 'ポート',
  'workbench.settings.def.backend.bindPort.description':
    'ブラウザーや他のデバイスが接続するためにこのアプリがバインドするポートです。デフォルトを他の何かが既に使っている場合にのみ変更してください。クライアントは同じポートを指す必要があります。',
  'workbench.settings.def.backend.serveWebApp.label': 'Web アプリを配信',
  'workbench.settings.def.backend.serveWebApp.description':
    'バックエンドのポートでワークベンチを Web ページとして配信し、拡張機能なしでブラウザータブからこのアプリを直接開けるようにします。ポートに到達できる人はログインゲートを見ます。データにアクセスするにはペアリング済みの token が引き続き必要です。',
  'workbench.settings.def.backend.allowLocalPeerExecute.label': 'このデバイスのブラウザーから',
  'workbench.settings.def.backend.allowLocalPeerExecute.description':
    'このマシンのペアリング済みブラウザーがこのアプリを通じて API リクエストを送れるようにします。拡張機能はこれをリクエストエンジンとして使うため、そのワークベンチの送信はここで実行されます。デフォルトはオンで、ペアリングが同意です。各送信にはワークスペースへの書き込みアクセスが引き続き必要です。',
  'workbench.settings.def.backend.allowRemotePeerExecute.label': '接続中の他のデバイスから',
  'workbench.settings.def.backend.allowRemotePeerExecute.description':
    '他のマシンのペアリング済みデバイスがこのアプリを通じて API リクエストを送れるようにします。そのワークベンチの送信は、このマシンのネットワークアクセスとアドレスで実行されます。デフォルトはオフで、ペアリングからは決して暗黙に許可されない運用者の判断です。各送信にはワークスペースへの書き込みアクセスが引き続き必要です。',
  'workbench.settings.def.backend.reconnectDelayMs.label': '初期遅延',
  'workbench.settings.def.backend.reconnectDelayMs.description': '切断後、最初の再接続試行までに待つ時間（ms）です。',
  'workbench.settings.def.backend.maxReconnectDelayMs.label': '最大遅延',
  'workbench.settings.def.backend.maxReconnectDelayMs.description': '再接続試行間の指数バックオフの上限（ms）です。',
  'workbench.settings.def.backend.pingIntervalMs.label': 'キープアライブ間隔',
  'workbench.settings.def.backend.pingIntervalMs.description':
    '厳格なプロキシの背後でも WebSocket を開いたままにするために ping を送る間隔（ms）です。',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.label': '切断時にバッジ',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.description':
    'バックエンドへのリンクが切れているとき、ツールバーアイコンに赤いバッジを表示します。',
  'workbench.settings.def.backend.offlineFallbackOrder.label': 'ホストの順序',
  'workbench.settings.def.backend.offlineFallbackOrder.description':
    'バックエンドがオフラインになった場合、この一覧で最初に到達できるホストが排他的なワークフローの資格情報を自ら更新します。ホストは自動的に登録されます。ドラッグして順位を変えてください。',

  // ── MCP category defs ──────────────────────────────────────────────
  'workbench.settings.def.mcp.enabled.label': '有効化',
  'workbench.settings.def.mcp.enabled.description':
    'このアプリのバックエンドのポートで MCP クライアントに応答します。オフの間、エンドポイントは存在しません。オンにすると、アクセス token を持つエージェントがワークスペースを読み取れます。',
  'workbench.settings.def.mcp.allowObserve.label': 'トラフィックの観測',
  'workbench.settings.def.mcp.allowObserve.description':
    'エージェントは、トラフィックパネルでキャプチャしたソースのライブトラフィックを読み取れます。キャプチャしていないソースは見えません。認証ヘッダー、Cookie、token 形の値は安定したマーカーに置き換えられます。',
  'workbench.settings.def.mcp.allowWrite.label': '書き込みツール',
  'workbench.settings.def.mcp.allowWrite.description':
    'エージェントはルール、リクエスト、環境、変数、ワークフローを作成、編集、削除できます。すべての変更はアクティビティフィードに記録され、元に戻せます。',
  'workbench.settings.def.mcp.allowExecute.label': '実行ツール',
  'workbench.settings.def.mcp.allowExecute.description':
    'エージェントは保存済みのリクエストを送信し、ワークフローを実行できます。エージェントの代わりに実際のネットワークトラフィックがこのマシンから出ていきます。',
  'workbench.settings.def.mcp.allowSecrets.label': 'シークレットの開示',
  'workbench.settings.def.mcp.allowSecrets.description':
    'エージェントは vault のシークレットの値を平文で読み取れます。オフの間、すべてのシークレットはマスクされたままです。',

  // ── General category defs ──────────────────────────────────────────
  'workbench.settings.def.general.language.label': '言語',
  'workbench.settings.def.general.language.description':
    'インターフェースの表示言語です。開いているすべての面に再読み込みなしで直ちに適用されます。技術的な語彙（ヘッダー名、HTTP メソッド、プロトコル用語）はどの言語でも英語のままです。',
  'workbench.settings.def.general.language.option.auto.label': 'システムに従う',
  'workbench.settings.def.general.language.option.auto.description':
    'ブラウザーまたはオペレーティングシステムの言語に合わせます',
  'workbench.settings.def.general.language.option.pseudo.description':
    '未翻訳や切り詰められたテキストを見つけるための、アクセント付きで引き伸ばした英語',
  'workbench.settings.def.general.confirmOnDelete.label': '削除前に確認',
  'workbench.settings.def.general.confirmOnDelete.description':
    'ルール、フォルダー、コレクションを削除する前に確認ダイアログを表示します。',
  'workbench.settings.def.general.showEmptyStateHints.label': '空の状態のヒントを表示',
  'workbench.settings.def.general.showEmptyStateHints.description':
    '空のパネルやオンボーディング領域にガイダンスとヒントを描画します。',
  'workbench.settings.def.terminal.profiles.label': 'プロファイル',
  'workbench.settings.def.terminal.profiles.description':
    'ターミナルがタブを開けるシェルです。通常の新しいタブはデフォルトを使い、タブ行の + の隣の矢印で特定のプロファイルを選べます。',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.label': '実行中のプロセスを閉じる前に確認',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.description':
    'シェルにまだ実行中のプロセスがあるターミナルタブを閉じる前に確認します。アイドル状態のシェルは常にサイレントに閉じます。',
  'workbench.settings.def.terminal.startDirectory.label': '開始ディレクトリ',
  'workbench.settings.def.terminal.startDirectory.description':
    '新しいターミナルタブが開始するディレクトリです。独自のディレクトリを持つプロファイルはこれを上書きします。空はホームディレクトリを意味します。次に開くタブから適用されます。',
  'workbench.settings.def.terminal.defaultTabName.label': 'デフォルトのタブ名',
  'workbench.settings.def.terminal.defaultTabName.description':
    'プロファイルで開かれたり名前を変更されたりしていないターミナルタブの名前です。空は「Local」を使います。同じ名前を共有する複数のタブには番号が付いたままになります。',
  'workbench.settings.def.terminal.fontFamilyPreset.label': 'フォント',
  'workbench.settings.def.terminal.fontFamilyPreset.description':
    'ターミナルテキストの書体です。プリセットはアプリに同梱されているか、すべてのオペレーティングシステムが提供するフォントに依存します。',
  'workbench.settings.def.terminal.fontSize.label': 'フォントサイズ',
  'workbench.settings.def.terminal.fontSize.description': 'ターミナルテキストのサイズ（ピクセル）です。',
  'workbench.settings.def.terminal.lineHeight.label': '行の高さ',
  'workbench.settings.def.terminal.lineHeight.description':
    'フォントサイズの倍数としての行間です。1 はフォント本来の間隔です。',
  'workbench.settings.def.terminal.cursorStyle.label': 'カーソルの形',
  'workbench.settings.def.terminal.cursorStyle.description': 'ターミナルのキャレットの描き方です。',
  'workbench.settings.def.terminal.cursorStyle.option.block.label': 'ブロック',
  'workbench.settings.def.terminal.cursorStyle.option.underline.label': '下線',
  'workbench.settings.def.terminal.cursorStyle.option.bar.label': '縦棒',
  'workbench.settings.def.terminal.cursorBlink.label': 'カーソルを点滅',
  'workbench.settings.def.terminal.cursorBlink.description': 'ターミナルのキャレットを点滅させます。',
  'workbench.settings.def.terminal.minimumContrastRatio.label': '最小コントラスト比',
  'workbench.settings.def.terminal.minimumContrastRatio.description':
    '背景に対してこのコントラストに達するまでテキストの色を調整します。1 は色をそのままにし、4.5 は WCAG AA を満たし、21 は最大のコントラストを強制します。',
  'workbench.settings.def.terminal.scrollback.label': 'スクロールバックバッファ',
  'workbench.settings.def.terminal.scrollback.description':
    '表示画面の上にターミナルが保持する行数です。値が大きいほどタブごとのメモリ使用量が増えます。',
  'workbench.settings.def.terminal.macOptionIsMeta.label': 'Option を Meta キーとして使う',
  'workbench.settings.def.terminal.macOptionIsMeta.description':
    'macOS で Option キーを Meta として扱い、Option+B のようなショートカットが特殊文字の入力ではなくシェルの行編集に届くようにします。',
  'workbench.settings.def.terminal.copyOnSelect.label': '選択時にコピー',
  'workbench.settings.def.terminal.copyOnSelect.description':
    '選択したターミナルテキストを、選択した時点でクリップボードにコピーします。',
  'workbench.settings.def.terminal.hyperlinks.label': 'リンクを強調',
  'workbench.settings.def.terminal.hyperlinks.description':
    'ターミナル出力内の URL を検出し、クリックでブラウザーで開きます。',
  'workbench.settings.def.terminal.audibleBell.label': '音のベル',
  'workbench.settings.def.terminal.audibleBell.description':
    'プログラムがターミナルのベルを鳴らしたとき、短いビープ音を再生します。',
  'workbench.settings.def.terminal.closeTabOnExit.label': 'シェル終了時にタブを閉じる',
  'workbench.settings.def.terminal.closeTabOnExit.description':
    'シェルが終了したらすぐにターミナルタブを閉じます。オフの場合、タブは「再起動」ボタン付きで開いたままになります。',
  'workbench.settings.def.general.restoreTabsOnStartup.label': '起動時にタブを復元',
  'workbench.settings.def.general.restoreTabsOnStartup.description':
    '前回のセッションの終了時に開いていたエディタータブを開き直します。',
  'workbench.settings.def.general.collectionEnvAutoSwitch.label': '環境の自動切り替え',
  'workbench.settings.def.general.collectionEnvAutoSwitch.description':
    'コレクションとその中のエンティティ（ルール、リクエスト、フォルダー）の間を移動するときに、アクティブな環境がどう変わるかです。ルールコレクションと API リクエストコレクションの両方に適用されます。コレクションはデフォルト環境を持ち、推奨環境の短い一覧をピン留めできます。この設定は、それらのデフォルトが自動的に引き継ぐかどうかを制御します。',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.label': '選択中の環境を維持',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.description':
    'コレクションとそのサブフォルダー、ルール、リクエストの間を移動しても、選択しているもの（環境なしを含む）が選択されたままです。コレクションのデフォルトは環境が選択されていないときにのみ適用されます。',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.label':
    'コレクションのデフォルトを適用',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.description':
    'コレクション（またはその中のサブフォルダー、ルール、リクエスト）の中にいる間はコレクションのデフォルトが引き継ぎます。最後に手動で選んだものが基本の環境で、コレクションを離れるかデフォルトのないコレクションに入るたびに復元されます。コレクションごとの記憶はありません。',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.label': '各コレクションに追従',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.description':
    'デフォルト環境を持つコレクション（またはその中のサブフォルダー、ルール、リクエスト）を開くと、そのデフォルトに切り替わります。コレクション内で選んだものはそのコレクションについて記憶されます。デフォルトのないコレクションは自動で切り替わりません。',
  'workbench.settings.def.general.settingsOpenMode.label': '開き方',
  'workbench.settings.def.general.settingsOpenMode.description':
    'ツールバー、ポップアップ、コマンドパレットから起動したときの設定ページの開き方です。',
  'workbench.settings.def.general.settingsOpenMode.option.modal.label': 'モーダル',
  'workbench.settings.def.general.settingsOpenMode.option.modal.description': '現在のページの中央に重ねるオーバーレイ',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.label': 'モーダル（最大化）',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.description':
    'ビューポートの大部分を占めるオーバーレイ',
  'workbench.settings.def.general.settingsOpenMode.option.tab.label': 'エディタータブ',
  'workbench.settings.def.general.settingsOpenMode.option.tab.description':
    'ワークスペース内のフルのエディタータブとして開く',
  'workbench.settings.def.general.settingsShowCategoryLabels.label': 'サイドバーにカテゴリ名を表示',
  'workbench.settings.def.general.settingsShowCategoryLabels.description':
    '設定サイドバーのカテゴリアイコンの横にテキストラベルを描画します。サイドバーを右クリックして切り替えられます。アイコンのみのコンパクトなレールにするには無効にしてください。',

  // ── Appearance category defs ───────────────────────────────────────
  'workbench.settings.def.appearance.theme.label': 'カラーテーマ',
  'workbench.settings.def.appearance.theme.description': 'アプリ全体のカラーテーマを制御します。',
  'workbench.settings.def.appearance.theme.option.light.label': 'ライト',
  'workbench.settings.def.appearance.theme.option.dark.label': 'ダーク',
  'workbench.settings.def.appearance.theme.option.auto.label': 'システムに従う',
  'workbench.settings.def.appearance.theme.option.auto.description': 'オペレーティングシステムに合わせます',
  'workbench.settings.def.appearance.lightVariant.label': 'ライトのバリアント',
  'workbench.settings.def.appearance.lightVariant.description':
    '解決されたカラーテーマがライトのときに使うパレットです。',
  'workbench.settings.def.appearance.lightVariant.option.default.label': 'デフォルト',
  'workbench.settings.def.appearance.lightVariant.option.default.description':
    '日常使いのためのバランスの取れた中立的なライトテーマ。',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.label': 'ハイコントラスト',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.description':
    '最大の可読性。純白の面、ほぼ黒のテキスト、AAA コントラスト。',
  'workbench.settings.def.appearance.lightVariant.option.warm.label': 'Warm',
  'workbench.settings.def.appearance.lightVariant.option.warm.description':
    '暖かな中間色と琥珀色のアクセントを持つ紙のような面。長時間のセッションでも目に優しい。',
  'workbench.settings.def.appearance.lightVariant.option.cool.label': 'Cool',
  'workbench.settings.def.appearance.lightVariant.option.cool.description':
    'スレートブルーを帯びたライトテーマ。鋼青のアクセントを持つくっきりした面。',
  'workbench.settings.def.appearance.lightVariant.option.rose.label': 'Rose',
  'workbench.settings.def.appearance.lightVariant.option.rose.description':
    'マゼンタのアクセントを持つ淡い頬紅色の面。Warm の琥珀色を伴わない穏やかな暖かさ。',
  'workbench.settings.def.appearance.lightVariant.option.sepia.label': 'Sepia',
  'workbench.settings.def.appearance.lightVariant.option.sepia.description':
    '深い茶色のテキストを持つ彩度の高い羊皮紙のパレット。最も濃く色付いたライトバリアントで、長時間の読書に最適。',
  'workbench.settings.def.appearance.darkVariant.label': 'ダークのバリアント',
  'workbench.settings.def.appearance.darkVariant.description':
    '解決されたカラーテーマがダークのときに使うパレットです。',
  'workbench.settings.def.appearance.darkVariant.option.default.label': 'デフォルト',
  'workbench.settings.def.appearance.darkVariant.option.default.description':
    '日常使いのためのバランスの取れた中立的なダークテーマ。',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.label': 'ハイコントラスト',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.description':
    '最大の可読性。真っ黒な面、明るいテキスト、AAA コントラスト。',
  'workbench.settings.def.appearance.darkVariant.option.dim.label': 'Dim',
  'workbench.settings.def.appearance.darkVariant.option.dim.description':
    'まぶしさを抑えた柔らかなスレートブルーの面。暗い環境で目に優しい。',
  'workbench.settings.def.appearance.darkVariant.option.midnight.label': 'Midnight',
  'workbench.settings.def.appearance.darkVariant.option.midnight.description':
    '鮮やかな青のアクセントを持つ深い紺の面。Dim より豊かで彩度が高い。',
  'workbench.settings.def.appearance.darkVariant.option.forest.label': 'Forest',
  'workbench.settings.def.appearance.darkVariant.option.forest.description':
    'エメラルドのアクセントを持つ緑がかったダークの面。落ち着いた植物的なパレット。',
  'workbench.settings.def.appearance.darkVariant.option.arctic.label': 'Arctic',
  'workbench.settings.def.appearance.darkVariant.option.arctic.description':
    '霜のようなシアンのアクセントを持つ冷たい青灰色のダークテーマ。Dim や Midnight より平坦で彩度が低い。',
  'workbench.settings.def.appearance.uiScale.label': '拡大率',
  'workbench.settings.def.appearance.uiScale.description':
    'エディターのフォントサイズを変えずに、UI クローム全体（ボタン、テキスト、余白、コントロール）を拡大縮小します。',
  'workbench.settings.def.appearance.uiScale.option.0.7.label': '極小（70%）',
  'workbench.settings.def.appearance.uiScale.option.0.7.description':
    '最も密なレイアウト。異常に縦長で幅広に描画される Press Start 2P UI フォントと組み合わせると便利です。',
  'workbench.settings.def.appearance.uiScale.option.0.8.label': 'コンパクト（80%）',
  'workbench.settings.def.appearance.uiScale.option.0.8.description':
    '快適なクリック領域を保ちつつ引き締めた UI クローム。',
  'workbench.settings.def.appearance.uiScale.option.0.9.label': '小（90%）',
  'workbench.settings.def.appearance.uiScale.option.0.9.description':
    'デフォルトよりやや引き締め、画面により多く収めます。',
  'workbench.settings.def.appearance.uiScale.option.1.label': '標準（100%）',
  'workbench.settings.def.appearance.uiScale.option.1.description': 'デフォルトの UI クロームのサイズ。',
  'workbench.settings.def.appearance.uiScale.option.1.1.label': '大（110%）',
  'workbench.settings.def.appearance.uiScale.option.1.1.description': '読みやすさのためにやや拡大。',
  'workbench.settings.def.appearance.uiScale.option.1.25.label': '特大（125%）',
  'workbench.settings.def.appearance.uiScale.option.1.25.description':
    '最大の UI クロームの拡大率。アクセシビリティに最適。',
  'workbench.settings.def.appearance.fontFamilyPreset.label': 'フォントファミリー',
  'workbench.settings.def.appearance.fontFamilyPreset.description':
    'アプリの UI クローム向けに厳選したサンセリフのスタックです。デフォルトは、クロスプラットフォームの一貫性のために Windows / Linux では Inter、SF Pro のネイティブな光学サイズを保つために macOS では System Sans です。すべての選択肢は拡張機能に同梱されています。エディター面には独自のフォント設定があります。',
  'workbench.settings.def.appearance.fontFamilyPreset.option.inter.description':
    '画面向けに設計された同梱の UI サンセリフ。すべてのオペレーティングシステムで同一に描画されるため、macOS、Windows、Linux でアプリが同じ見た目になります。',
  'workbench.settings.def.appearance.fontFamilyPreset.option.system.description':
    'オペレーティングシステムのデフォルトの UI サンセリフ。macOS では San Francisco、Windows では Segoe UI、Linux では Roboto。クロスプラットフォームの一貫性を犠牲にしてネイティブな見た目を好むならこれを使ってください。',
  'workbench.settings.def.appearance.fontFamilyPreset.option.atkinson-hyperlegible.description':
    '低視力の読みやすさのために設計されたサンセリフ。特徴的な字形が文字の混同を減らします。同梱で、常に利用できます。',
  'workbench.settings.def.appearance.fontFamilyPreset.option.jetbrains-mono.description':
    '組み込みのターミナルフォントに合わせた等幅 UI。UI クローム全体が開発者ツールの見た目になります。同梱で、常に利用できます。',
  'workbench.settings.def.appearance.fontFamilyPreset.option.press-start-2p.description':
    'アプリに同梱しているピクセル風のディスプレイフォント。同梱で、常に利用できます。遊び心のある選択で、読めますが縦長で幅広のため、UI クロームの余白が広く見えます。',
  'workbench.settings.def.appearance.density.label': '密度',
  'workbench.settings.def.appearance.density.description':
    'コンパクトモードはリスト、テーブル、フォームの余白を減らします。',
  'workbench.settings.def.appearance.density.option.comfortable.label': '快適',
  'workbench.settings.def.appearance.density.option.compact.label': 'コンパクト',
  'workbench.settings.def.appearance.editorHeaderPosition.label': 'エディターのヘッダー部の位置',
  'workbench.settings.def.appearance.editorHeaderPosition.description':
    '各エディターがタイトルと操作の行（名前、有効化の切り替え、保存）をどこにドックするかです。「下」はエディターの上部を軽く保ち、主要な操作を編集中の内容の近くに置きます。',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.label': '上',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.description':
    'エディターの内容の上に置く従来の配置。',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.label': '下',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.description':
    'エディターの内容の下、ステータスバーの上にドック。',
  'workbench.settings.def.appearance.clockFormat.label': '時刻の形式',
  'workbench.settings.def.appearance.clockFormat.description':
    'アプリ全体（通知、ログ）でのタイムスタンプの描画方法です。ブラウザーのロケールはシステムの地域の形式ではなくブラウザーの言語に従うため、明示的に設定します。',
  'workbench.settings.def.appearance.clockFormat.option.24h.label': '24 時間',
  'workbench.settings.def.appearance.clockFormat.option.12h.label': '12 時間',
  'workbench.settings.def.appearance.accentColor.label': 'アクセントカラー',
  'workbench.settings.def.appearance.accentColor.description':
    'ボタン、リンク、アクティブな強調に使う主要な色です。デフォルトのテーマバリアントにのみ適用されます。ハイコントラストと色付きのバリアントは独自のアクセントを固定します。',

  // ── Workspace Layout category defs ─────────────────────────────────
  'workbench.settings.def.workspaceLayout.footerShowVersion.label': 'バージョンを表示',
  'workbench.settings.def.workspaceLayout.footerShowVersion.description':
    'ワークスペースのステータスバーに拡張機能のバージョン番号を表示します。',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.label': 'テーマ切り替えを表示',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.description':
    'ワークスペースのステータスバーにライト / ダーク / 自動のテーマドロップダウンを表示します。',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.label': 'パネルの切り替えを表示',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.description':
    'ワークスペースのトップバーに左 / 下 / 右パネルの切り替えアイコンを表示します。',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.label': 'レイアウトメニューを表示',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.description':
    'ワークスペースのトップバーにレイアウトのドロップダウン（下部の全幅、ツールウィンドウのラベル、サイドバーのレイアウト）を表示します。',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.label': '下部パネルの配置',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.description':
    'シェル内で下部パネルが置かれる位置です。左 / 右は片方のサイドバーとエディターの下に揃え、中央は中央の列の中に入れ子にし、両端はビューポート全体にまたがります。',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.label': '中央',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.description':
    '下部パネルを中央の列の中に入れ子にします',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.label': '左',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.description':
    '下部は左サイドバーとエディターにまたがります',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.label': '右',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.description':
    '下部はエディターと右サイドバーにまたがります',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.label': '両端',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.description':
    '下部はビューポートの全幅にまたがります',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.label': '下部パネルの分割',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.description':
    '開いている 2 つの下部ドックが下部パネルをどう分け合うかです。横に並べるか、上下に重ねるか。',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.label': '左右に並べる',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.description': '下部ドックを横に並べます',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.label': '上下に重ねる',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.description': '下部ドックを上下に重ねます',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.label': 'ツールウィンドウのラベルを表示',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.description':
    'アクティビティバーとドックタブのアイコンの横にテキストラベルを描画します。アイコンのみのコンパクトなシェルにするには無効にしてください。',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.label': '左アクティビティバーの幅',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.description':
    'ツールウィンドウのラベルが表示されているときの左アクティビティバーの幅です。アイコンのみのモードでは 36px に固定されます。',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.label': '右アクティビティバーの幅',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.description':
    'ツールウィンドウのラベルが表示されているときの右アクティビティバーの幅です。アイコンのみのモードでは 36px に固定されます。',
  'workbench.settings.def.workspaceLayout.sidebarLayout.label': 'アクティビティバーのレイアウト',
  'workbench.settings.def.workspaceLayout.sidebarLayout.description':
    'アクティビティバーが上下のツールウィンドウグループをどう分けるかです。',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.label': '比例',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.description':
    '上下のグループがアクティビティバーを 50/50 で分けます',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.label': 'コンパクト',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.description':
    '上のグループは内容に合わせ、下は下部に固定します',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.label': '積み重ね',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.description':
    'すべてのグループを区切り線付きで上部にまとめます',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.label': '動的',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.description':
    'チップのグループは隣接するパネルの高さに追従します。閉じたドックは内容まで縮み、開いている隣が空間を吸収します。',

  // ── Debug mode (inspection) category defs ──────────────────────────
  'workbench.settings.def.inspection.cdpEnabled.label': 'デバッグモード',
  'workbench.settings.def.inspection.cdpEnabled.description':
    'ブラウザーの組み込みの開発者ツールと同じ深さでリクエストを検査し、変更します。ページレベルの fetch だけでなく、ページの読み込み、ワーカー、iframe も対象です。オンの間、ブラウザーはアタッチされた各タブにデバッグ中のバナーを表示します。デフォルトはオフで、いつでもオンにできます。',
  'workbench.settings.def.inspection.cdpEnabled.capabilityUnavailableHint':
    'デバッグモードは Chrome と Edge で利用できます。',
  'workbench.settings.def.inspection.cdpScope.label': 'アタッチするタブ',
  'workbench.settings.def.inspection.cdpScope.description':
    'オンの間、デバッグモードがどのタブにアタッチするかです。「DevTools が開いている場所」は開発者ツールが開いているブラウザータブにアタッチします。「フォーカス中のタブ」は開発者ツールを開かなくてもアクティブなブラウザータブに追従します。新しいタブや内部ページに切り替えても、揺れ動かずに前のタブがアタッチされたままです。「両方」は 2 つを組み合わせます。この選択にかかわらず、個々のブラウザータブをフッターからピン留めして含めることもできます。',
  'workbench.settings.def.inspection.cdpScope.capabilityUnavailableHint':
    'デバッグモードは Chrome と Edge で利用できます。',
  'workbench.settings.def.inspection.cdpScope.option.devtools.label': 'DevTools が開いている場所',
  'workbench.settings.def.inspection.cdpScope.option.devtools.description': '開発者ツールが開いているブラウザータブ。',
  'workbench.settings.def.inspection.cdpScope.option.active.label': 'フォーカス中のタブ',
  'workbench.settings.def.inspection.cdpScope.option.active.description':
    'フォーカスに追従するアクティブなブラウザータブ。開発者ツールは不要です。',
  'workbench.settings.def.inspection.cdpScope.option.both.label': '両方',
  'workbench.settings.def.inspection.cdpScope.option.both.description': 'DevTools のタブとフォーカス中のタブ。',

  // ── Traffic Monitor category defs ──────────────────────────────────
  'workbench.settings.def.trafficMonitor.captureDebugDefault.label': 'キャプチャをデバッグモードで開始',
  'workbench.settings.def.trafficMonitor.captureDebugDefault.description':
    '新しいキャプチャは完全な忠実度（レスポンスボディと正確なヘッダー）のためにブラウザーのデバッガーをアタッチします。ブラウザーはそのタブにデバッグ中のバナーを表示します。各開始操作は「詳細」でこれを上書きできます。',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.label': 'キャプチャをアーカイブに保存',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.description':
    '新しいキャプチャはこのコンピューター上の暗号化されたセッションアーカイブに記録されます。各開始操作は「詳細」でこれを上書きできます。',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.label':
    'エージェントがアーカイブ済みセッションを秘匿解除で読む',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.description':
    '接続中のエージェントは、秘匿マーカーの代わりに実際の値でアーカイブ済みセッションを読みます。認証ヘッダー、Cookie、token 形の値も含まれます。デフォルトはオフで、オンの間はすべての秘匿解除の読み取りがアクティビティフィードに記録されます。',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.label': 'アーカイブのサイズ予算（GiB）',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.description':
    'アーカイブ済みセッションに使うディスク容量の合計です。アーカイブが予算を超えると、最も古い確定済みセッションから削除されます。記録中のセッションは決して削除されません。',
  'workbench.settings.def.trafficMonitor.railSide.label': 'ソースの側',
  'workbench.settings.def.trafficMonitor.railSide.description':
    'トラフィックパネルのどちら側にソース一覧を置くかです。パネルヘッダーのレイアウトボタンでも切り替えられます。',
  'workbench.settings.def.trafficMonitor.railSide.option.left.label': '左',
  'workbench.settings.def.trafficMonitor.railSide.option.left.description':
    'ソース一覧を左に、トラフィックビューを右に。',
  'workbench.settings.def.trafficMonitor.railSide.option.right.label': '右',
  'workbench.settings.def.trafficMonitor.railSide.option.right.description':
    'ソース一覧を右に、トラフィックビューを左に。',

  // ── Code Editor category defs ──────────────────────────────────────
  'workbench.settings.def.editor.fontSize.label': 'フォントサイズ',
  'workbench.settings.def.editor.fontSize.description': 'エディター面のフォントサイズ（ピクセル）です。',
  'workbench.settings.def.editor.fontFamilyPreset.label': 'フォントファミリー',
  'workbench.settings.def.editor.fontFamilyPreset.description':
    'エディター向けに厳選した等幅のスタックです。すべての選択肢は拡張機能に同梱されており、システムへのインストールは不要です。デフォルトは、クロスプラットフォームの一貫性のために Windows / Linux では JetBrains Mono、SF Mono のネイティブな描画を保つために macOS では System Mono です。',
  'workbench.settings.def.editor.fontFamilyPreset.option.system.description':
    'オペレーティングシステムのデフォルトの等幅。macOS では SF Mono、Windows では Consolas、Linux では Liberation Mono。',
  'workbench.settings.def.editor.fontFamilyPreset.option.fira-code.description':
    'プログラミング用リガチャ付きの等幅。同梱で、常に利用できます。',
  'workbench.settings.def.editor.fontFamilyPreset.option.jetbrains-mono.description':
    'エディター向けに調整されたリガチャ付きの等幅。同梱で、常に利用できます。',
  'workbench.settings.def.editor.fontFamilyPreset.option.cascadia-code.description':
    'プログラミング用リガチャ付きの等幅。同梱で、常に利用できます。',
  'workbench.settings.def.editor.fontFamilyPreset.option.source-code-pro.description':
    'コード向けに調整された Adobe の等幅。同梱で、常に利用できます。',
  'workbench.settings.def.editor.fontFamilyPreset.option.press-start-2p.description':
    'アプリに同梱しているピクセル風のディスプレイフォント。同梱で、常に利用できます。遊び心のある選択で、読めますが縦長で幅広です。',
  'workbench.settings.def.editor.fontLigatures.label': 'フォントのリガチャ',
  'workbench.settings.def.editor.fontLigatures.description':
    'プログラミング用リガチャを有効にし、`=>` や `!=` のような文字列を 1 つのグリフに結合します。リガチャに対応したフォント（例：Fira Code、JetBrains Mono）が必要です。',
  'workbench.settings.def.editor.lineHeight.label': '行の高さ',
  'workbench.settings.def.editor.lineHeight.description':
    'エディターの行の高さ（ピクセル）です。0 はエディターがフォントサイズに比例した行の高さを選び、8 以上の値は明示的なピクセルとして解釈されます。',
  'workbench.settings.def.editor.tabSize.label': 'タブサイズ',
  'workbench.settings.def.editor.tabSize.description': 'タブ文字が占める列数です。',
  'workbench.settings.def.editor.insertSpaces.label': 'スペースを挿入',
  'workbench.settings.def.editor.insertSpaces.description':
    'Tab を押したときにタブ文字の代わりにスペースを挿入します。',
  'workbench.settings.def.editor.wordWrap.label': '折り返し',
  'workbench.settings.def.editor.wordWrap.description': 'エディターで長い行を次の行に折り返すかどうかです。',
  'workbench.settings.def.editor.wordWrap.option.off.label': 'オフ',
  'workbench.settings.def.editor.wordWrap.option.on.label': 'ビューポートの幅',
  'workbench.settings.def.editor.wordWrap.option.bounded.label': '指定した列',
  'workbench.settings.def.editor.wordWrapColumn.label': '折り返しの列',
  'workbench.settings.def.editor.wordWrapColumn.description': '折り返しが「指定した列」のときに行を折り返す列です。',
  'workbench.settings.def.editor.lineNumbers.label': '行番号',
  'workbench.settings.def.editor.lineNumbers.description': '左のガターに行番号を表示します。',
  'workbench.settings.def.editor.renderWhitespace.label': '空白を描画',
  'workbench.settings.def.editor.renderWhitespace.description': '空白文字を視覚的に描画します。',
  'workbench.settings.def.editor.renderWhitespace.option.none.label': 'なし',
  'workbench.settings.def.editor.renderWhitespace.option.boundary.label': '境界のみ',
  'workbench.settings.def.editor.renderWhitespace.option.all.label': 'すべて',
  'workbench.settings.def.editor.renderLineEnds.label': '行末を描画',
  'workbench.settings.def.editor.renderLineEnds.description':
    '実際の各行の最後の文字の後に薄い ¬ を描き、折り返された行（ガターの番号が空、ぶら下げインデント、記号なし）が改行と間違われないようにします。表示のみで、この記号は選択、コピー、送信されることはありません。',
  'workbench.settings.def.editor.formatOnSave.label': '保存時に整形',
  'workbench.settings.def.editor.formatOnSave.description':
    'ルールやテンプレートを保存するときにエディターの内容を自動的に整形します。',
  'workbench.settings.def.editor.bracketPairColorization.label': '括弧のペアの色分け',
  'workbench.settings.def.editor.bracketPairColorization.description': '対応する括弧を異なる色で強調します。',

  // ── API Requests category defs ─────────────────────────────────────
  'workbench.settings.def.requests.trustedRoots.label': 'ワークスペースの証明書',
  'workbench.settings.def.requests.trustedRoots.description':
    'このワークスペースが組み込みのルートに加えて信頼する認証局で、アプリのランタイムがダイヤルするすべての TLS 接続に適用されます。ワークスペースのすべてのピアと共有されます。公開情報であり、シークレットではありません。',
  'workbench.settings.def.requests.deviceTrust.label': 'デバイスの証明書',
  'workbench.settings.def.requests.deviceTrust.description':
    'ワークスペースの一覧の横にこのマシンがピン留めする証明書です。自己署名の localhost やステージング環境など。同期もエクスポートもされず、このデバイスからアプリのランタイムがダイヤルするすべての TLS 接続に適用されます。',
  'workbench.settings.def.requests.systemTrust.label': 'システムの信頼ストア',
  'workbench.settings.def.requests.systemTrust.description':
    'このマシンのオペレーティングシステムのストアが保持する証明書（企業プロキシ用に IT のプロファイルがインストールしたルートなど）も信頼します。組み込みのルート、ワークスペースの一覧、デバイスのピンの横に追加され、同期もエクスポートもされません。',
  'workbench.settings.def.requests.responseBodyCapMB.label': 'レスポンスボディの上限（MB）',
  'workbench.settings.def.requests.responseBodyCapMB.description':
    '表示のためにエグゼキューターが保持するレスポンスボディの量です。これより大きいボディはこの上限で切り詰められますが、完全なサイズは引き続き計測され報告されます。上限を上げると、開いているリクエストタブごとのメモリ使用量が増えます。',
  'workbench.settings.def.requests.executionPlace.label': '実行場所',
  'workbench.settings.def.requests.executionPlace.description': 'コレクション、フォルダー、リクエストが独自に設定しない限り、API リクエストが接続を開く場所: このデバイス、デスクトップアプリ、またはワークスペースのサーバー。',
  'workbench.settings.def.requests.executionPlace.option.auto.label': '自動',
  'workbench.settings.def.requests.executionPlace.option.auto.description': 'このデバイスで実行できるときはここで、できないときは実行できる唯一の場所で実行します。',
  'workbench.settings.def.requests.executionPlace.option.here.label': 'このデバイス',
  'workbench.settings.def.requests.executionPlace.option.here.description': '送信元の画面が接続を開きます。',
  'workbench.settings.def.requests.executionPlace.option.desktop-app.label': 'デスクトップアプリ',
  'workbench.settings.def.requests.executionPlace.option.desktop-app.description': 'このデバイスのデスクトップアプリが接続を開きます。',
  'workbench.settings.def.requests.executionPlace.option.workspace-server.label': 'ワークスペースのサーバー',
  'workbench.settings.def.requests.executionPlace.option.workspace-server.description': 'ワークスペースを提供するサーバーが接続を開きます。解決済みの値はそこへ送られます。',
  'workbench.settings.def.requests.sseEventsNewestFirst.label': '新しい順',
  'workbench.settings.def.requests.sseEventsNewestFirst.description':
    'Server-Sent Events の一覧の順序です。新しいイベントを上に置きます。古い順に読むにはオフにしてください。一覧のツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.sseEventsGroupByName.label': 'イベント名でグループ化',
  'workbench.settings.def.requests.sseEventsGroupByName.description':
    'Server-Sent Events の一覧を折りたためるイベント名の見出しの下にまとめ、各グループ内は到着順を保ちます。一覧のツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.label': 'グループごとの行数',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.description':
    'イベント名でグループ化するとき、各グループの最新のイベントをこの数だけ表示します。新しいイベントが届くと窓がスライドするため、複数のグループを同時に監視し続けられます。0 はすべてのイベントを表示します。一覧のツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.label': '新しい順',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.description':
    'gRPC メッセージのタイムラインの順序です。新しいメッセージを上に置きます。古い順に読むにはオフにしてください。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.grpcIncludeDefaultValues.label': 'デフォルト値を含める',
  'workbench.settings.def.requests.grpcIncludeDefaultValues.description':
    'gRPC の応答がワイヤーから省いたフィールドを、proto3 JSON がデフォルト値を出力するのと同じように、そのデフォルト（ゼロの数値、空文字列、false、最初の enum 値、空のリストとマップ）として描画します。デフォルトはオフで、レスポンスにはサーバーが実際に送ったフィールドが表示されます。存在情報を持つフィールド（メッセージ、optional、oneof のメンバー）はどちらでも欠けたままです。レスポンスペインの ⋯ メニューでも同じ設定を変更できます。',
  'workbench.settings.def.requests.grpcMessagesShowTypes.label': 'メッセージの型を表示',
  'workbench.settings.def.requests.grpcMessagesShowTypes.description':
    'すべてのタイムライン行に宣言された protobuf メッセージ型のタグを付けます。デフォルトはオフです。rpc の型は方向ごとに固定されるため、方向のバッジだけで行を区別できます。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.grpcMessagesGroupByType.label': 'メッセージの型でグループ化',
  'workbench.settings.def.requests.grpcMessagesGroupByType.description':
    'gRPC メッセージのタイムラインを折りたためるメッセージ型の見出しの下にまとめ、各グループ内は到着順を保ちます。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.label': '方向でグループ化',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.description':
    'gRPC メッセージのタイムラインを折りたためる送信 / 受信の見出しの下にまとめます。メッセージの型でのグループ化と組み合わせると、（型、方向）の組ごとに独自のグループになります。リクエストとレスポンスが 1 つのメッセージ型を共有する双方向の呼び出しで便利です。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.label': 'グループごとの行数',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.description':
    'メッセージの型でグループ化するとき、各グループの最新のメッセージをこの数だけ表示します。新しいメッセージが届くと窓がスライドするため、複数のグループを同時に監視し続けられます。0 はすべてのメッセージを表示します。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.mqttMessagesNewestFirst.label': '新しい順',
  'workbench.settings.def.requests.mqttMessagesNewestFirst.description':
    'MQTT メッセージのタイムラインの順序です。新しいメッセージを上に置きます。古い順に読むにはオフにしてください。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.wsMessagesNewestFirst.label': '新しい順',
  'workbench.settings.def.requests.wsMessagesNewestFirst.description':
    'WebSocket メッセージのタイムラインの順序です。新しいメッセージを上に置きます。古い順に読むにはオフにしてください。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.label': '方向でグループ化',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.description':
    'WebSocket メッセージのタイムラインを折りたためる送信 / 受信の見出しの下にまとめ、各グループ内は到着順を保ちます。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.label': 'イベントでグループ化',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.description':
    'Socket.IO セッションのタイムラインを、デコードしたイベント名の折りたためる見出しの下にまとめます（制御フレームはワイヤー上の種別でまとめます）。方向でのグループ化と組み合わせると、（イベント、方向）の組ごとに独自のグループになります。Socket.IO セッションにのみ適用され、生の WebSocket フレームにはイベント名がありません。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.wsMessagesHideHeartbeat.label': 'ハートビートを隠す',
  'workbench.settings.def.requests.wsMessagesHideHeartbeat.description':
    'Socket.IO セッションのタイムラインで engine.io の ping / pong キープアライブ行を隠します。フレームは引き続きキャプチャおよびエクスポートされ、表示だけがフィルターされます。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.wsMessagesHideHandshake.label': 'ハンドシェイクフレームを隠す',
  'workbench.settings.def.requests.wsMessagesHideHandshake.description':
    'セッションのタイムラインで Socket.IO のハンドシェイクのフレーム行（engine.io の open / close と、確認応答を伴う名前空間の connect）を隠します。切断と接続エラーは常に表示されます。フレームは引き続きキャプチャおよびエクスポートされます。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.label': 'グループごとの行数',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.description':
    '方向でグループ化するとき、各グループの最新のメッセージをこの数だけ表示します。新しいメッセージが届くと窓がスライドするため、両方のグループを同時に監視し続けられます。0 はすべてのメッセージを表示します。タイムラインのツールバーでも同じ設定を変更できます。',
  'workbench.settings.def.requests.grpcSendInvalidMessage.label': '無効なメッセージを送信',
  'workbench.settings.def.requests.grpcSendInvalidMessage.description':
    'gRPC メッセージが有効な JSON でない場合でも、空のメッセージで呼び出してサーバーに応答させます。通常は INVALID_ARGUMENT です。デフォルトはオフで、呼び出しはワイヤーに出る前に正確な解析エラーで失敗します。',

  // ── Rules Engine category defs ─────────────────────────────────────
  'workbench.settings.def.rulesEngine.paused.label': 'ルールの実行を一時停止',
  'workbench.settings.def.rulesEngine.paused.description':
    'ライブのネットワークリクエストへのルールの適用を止めます。ルールは引き続き編集できます。',
  'workbench.settings.def.rulesEngine.evaluationStrategy.label': '評価戦略',
  'workbench.settings.def.rulesEngine.evaluationStrategy.description':
    '複数のルールが同じリクエストに一致したときにエンジンがどう選ぶかです。',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.label': '最初の一致',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.description': '優先順で最初のルールを使う',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.label': '最も近い一致',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.description':
    '最も具体的に一致するルールを優先する',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.label': 'すべての一致',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.description':
    '一致するすべてのルールを順に適用する',
  'workbench.settings.def.rulesEngine.updateDebounceMs.label': '更新のデバウンス',
  'workbench.settings.def.rulesEngine.updateDebounceMs.description':
    'ルールの編集が declarativeNetRequest にプッシュされるまでの遅延（ms）です。',
  'workbench.settings.def.rulesEngine.maxActiveRules.label': '最大アクティブルール数',
  'workbench.settings.def.rulesEngine.maxActiveRules.description':
    '一度に動的ルールセットにコンパイルされるルールの最大数です。',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.label': '表示するリソースの種類',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.description':
    'ポップアップの「このページ」ビューに表示するリクエストのリソースの種類です。常にすべてが収集され、これは UI の表示だけを変えます。ポップアップのインラインのチップ行も同じ設定に書き込みます。',
  'workbench.settings.def.rulesEngine.showShadowWarnings.label': 'シャドウ警告を表示',
  'workbench.settings.def.rulesEngine.showShadowWarnings.description':
    'より高い優先度のルール（ブロック、リダイレクト、mock、遅延、またはヘッダーの積み重ねの競合）によって効果が覆い隠されているルールを強調します。',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.label': '大きなルールセットで警告',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.description':
    'アクティブなルール数がブラウザーの上限に近づいたときに警告を表示します。',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.label': '大きなルールセットのしきい値',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.description': '警告が発火するアクティブなルール数です。',
  'workbench.settings.def.rulesEngine.liveRulesMode.label': 'ライブルールモード',
  'workbench.settings.def.rulesEngine.liveRulesMode.description':
    'ルールのいずれかに一致するすべてのリクエストに Cache-Control: no-cache を注入し、サーバーとの再検証を強制してルールの効果が常に新鮮に適用されるようにします。古いキャッシュ済みレスポンスがルールを隠すのを防ぎます。ルールの値（認証 token など）が変わってもページがキャッシュから古いレスポンスを提供し続ける場合に便利です。',
  'workbench.settings.def.rulesEngine.bypassHttpCache.label': 'HTTP キャッシュをバイパス',
  'workbench.settings.def.rulesEngine.bypassHttpCache.description':
    '検査中のタブのすべてのリクエストに Cache-Control: no-cache を追加し、サーバーとの再検証を強制します。対象は HTTP キャッシュだけです。Chrome 自身の「キャッシュを無効化」（Network タブ）はレンダラーのメモリキャッシュもバイパスします。ルールに一致するリクエストはライブルールモードによって常に自動的に新鮮に保たれます。',
  'workbench.settings.def.rulesEngine.variableAutocomplete.label': '変数の自動補完',
  'workbench.settings.def.rulesEngine.variableAutocomplete.description':
    '入力中に `{{env.X}}` / `{{vault.X}}` / `{{live.X}}` / `{{workspace.X}}` / `{{collection.X}}` / `{{step.X.Y}}` の参照を提案します。任意のルールフィールドの値入力と JSON / GraphQL / XML / プレーンテキストのボディエディターで `{{` を入力すると開きます。プレーンテキストの編集を好むなら無効にしてください。',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.label': '下書き URL の戦略',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.description':
    'DevTools のインスペクターから事前入力されたルールが、キャプチャした URL を url-filter パターンにどう変えるかです。「完全一致」（デフォルト）は URL をそのまま保ち、ルールは検査したリクエストにだけ一致します。「パスのワイルドカード」は最後のパスセグメントを * に置き換え、兄弟のリソースにも一致させます。「ホストのみ」はドメイン全体に広げます。',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.label': '完全一致の URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.description':
    'この URL に正規化のうえそのまま一致（推奨）',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.label': 'パスのワイルドカード',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.description':
    '最後のパスセグメントをワイルドカードにする',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.label': 'ホストのみ',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.description':
    'そのホストのすべてのリクエストに一致',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.label': '生の URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.description': 'この URL に正規化なしでそのまま一致',

  // ── Diff Viewer category defs ──────────────────────────────────────
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.label': '行にマージ戦略を表示',
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.description':
    'オンにすると、インポートプレビューの左サイドバーの各エンティティ行に、選択したマージ戦略（「新規として追加」、「置き換え」、「スキップ」、…）を行数の横にインラインで表示します。狭いペインで行の幅を空けるにはオフにしてください。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.label': 'レイアウト',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.description':
    '対象と取り込み側を並列で描画するか、インラインで積み重ねて描画するかです。差分ペインが狭すぎるときは自動的に統合に切り替わります。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.side-by-side.label': '並列',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.unified.label': '統合',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.label': '空白の扱い',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.description':
    '差分が空白だけの変更を編集として扱うか、隠すかです。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.none.label': '無視しない',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.ignore.label': '空白を無視',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label': '変更のない領域を折りたたむ',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description':
    '変更のない行の連続を隠し、クリックで展開できるスタブに置き換えます。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label': '空白文字を表示',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description':
    '差分内でスペースとタブを見えるグリフ（·、→）として描画します。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label': '行番号を表示',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description':
    '差分の各側の横にガターの行番号列を表示します。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label': 'インデントガイドを表示',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description':
    'YAML の入れ子を追いやすくするために縦のインデントガイドを描画します。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label': '長い行を折り返す',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description':
    '横スクロールの代わりに、長い行を次の表示行に折り返します。',

  // ── Data category defs ─────────────────────────────────────────────
  'workbench.settings.def.data.logLevel.label': 'ログレベル',
  'workbench.settings.def.data.logLevel.description':
    '拡張機能のロガーの詳細度です。高いレベルはその上のすべてのレベルを含みます。',
  'workbench.settings.def.data.logLevel.option.error.label': 'Error',
  'workbench.settings.def.data.logLevel.option.error.description': '失敗のみ',
  'workbench.settings.def.data.logLevel.option.warn.label': 'Warn',
  'workbench.settings.def.data.logLevel.option.warn.description': '異常と再試行',
  'workbench.settings.def.data.logLevel.option.info.label': 'Info',
  'workbench.settings.def.data.logLevel.option.info.description': '運用上のイベント',
  'workbench.settings.def.data.logLevel.option.debug.label': 'Debug',
  'workbench.settings.def.data.logLevel.option.debug.description': '詳細な内部情報',
  'workbench.settings.def.data.exportSettings.label': '設定をエクスポート',
  'workbench.settings.def.data.exportSettings.description': 'すべての設定を JSON ファイルとしてダウンロードします。',
  'workbench.settings.def.data.exportSettings.action.label': 'エクスポート',
  'workbench.settings.def.data.importSettings.label': '設定をインポート',
  'workbench.settings.def.data.importSettings.description':
    '以前にエクスポートした JSON ファイルから設定を読み込みます。',
  'workbench.settings.def.data.importSettings.action.label': 'インポート…',
  'workbench.settings.def.data.exportObservabilityLog.label': '診断ログをエクスポート',
  'workbench.settings.def.data.exportObservabilityLog.description':
    '直近 500 件の構造化イベント（ルールの再構築、リクエストエラー、ワークスペースの切り替え）を JSON としてダウンロードします。ローカルのみで、自分でファイルをバグ報告に添付しない限り何もデバイスから出ません。',
  'workbench.settings.def.data.exportObservabilityLog.action.label': 'ログをエクスポート',
  'workbench.settings.def.data.clearObservabilityLog.label': '診断ログをクリア',
  'workbench.settings.def.data.clearObservabilityLog.description':
    'バッファされたすべてのイベントを破棄します。ルール、リクエスト、ワークスペースのデータには影響しません。',
  'workbench.settings.def.data.clearObservabilityLog.action.label': 'クリア',
  'workbench.settings.def.data.clearObservabilityLog.confirm':
    '診断ログをクリアしますか？バッファされたすべてのイベントが破棄されます。',
  'workbench.settings.def.data.exportImportReports.label': 'インポートレポートをエクスポート',
  'workbench.settings.def.data.exportImportReports.description':
    'すべてのインポート実行（現在は curl、次に HAR / Postman / Insomnia）の構造化された破棄 / 変換レポートを JSON としてダウンロードします。ワークスペースごとに保持され、ワークスペースあたり最新 50 件のインポートです。ファイルを添付しない限りデバイスから出ることはありません。',
  'workbench.settings.def.data.exportImportReports.action.label': 'レポートをエクスポート',
  'workbench.settings.def.data.clearImportReports.label': 'インポートレポートをクリア',
  'workbench.settings.def.data.clearImportReports.description':
    'アクティブなワークスペースのすべてのインポートレポートを破棄します。リクエスト自体には影響せず、インポート中に何が破棄 / 変換されたかの監査ログだけが対象です。',
  'workbench.settings.def.data.clearImportReports.action.label': 'クリア',
  'workbench.settings.def.data.clearImportReports.confirm':
    'このワークスペースのインポートレポートをクリアしますか？この操作は元に戻せません。',
  'workbench.settings.def.data.uploadFile.label': 'ファイルをアップロード',
  'workbench.settings.def.data.uploadFile.description':
    'multipart ボディや `{{file.X}}` 参照で使うファイルをアクティブなワークスペースに追加します。ファイルは内容アドレス方式（sha256）のため、同じバイト列を再アップロードしても 1 つの blob のままです。保存先はローカルの IndexedDB で、何もデバイスから出ません。',
  'workbench.settings.def.data.uploadFile.action.label': 'アップロード…',
  'workbench.settings.def.data.exportFilesManifest.label': 'ファイルマニフェストをエクスポート',
  'workbench.settings.def.data.exportFilesManifest.description':
    'アクティブなワークスペースのファイル一覧（ファイル名、ハッシュ、サイズ、MIME タイプ）を JSON としてダウンロードします。バイト列は含まれません。これは監査とチームメイトによる再アップロードのためのマニフェストで、内容のバックアップではありません。',
  'workbench.settings.def.data.exportFilesManifest.action.label': 'マニフェストをエクスポート',
  'workbench.settings.def.data.filesBrowser.label': 'ファイル',
  'workbench.settings.def.data.filesBrowser.description':
    'アクティブなワークスペースにアップロードされたすべての blob です。バイト列のダウンロード、短いハッシュのコピー、削除ができます。ファイルのメタデータ（ファイル名、サイズ、MIME タイプ、ハッシュ）は設定の索引全体で検索できます。',
  'workbench.settings.def.data.clearAllFiles.label': 'すべてのファイルをクリア',
  'workbench.settings.def.data.clearAllFiles.description':
    'アクティブなワークスペースのすべてのファイル blob を削除します。multipart パートでこれらのファイルを参照するリクエストは実行時にエラーになります。ファイルを再アップロードするか、それらのリクエストを編集する必要があります。',
  'workbench.settings.def.data.clearAllFiles.action.label': 'すべてクリア',
  'workbench.settings.def.data.clearAllFiles.confirm':
    'このワークスペースのすべてのファイルを削除しますか？それらを参照する multipart パートは送信時にエラーになります。',
  'workbench.settings.def.data.resetAllSettings.label': 'すべての設定をリセット',
  'workbench.settings.def.data.resetAllSettings.description':
    'すべてのカテゴリのすべての設定をデフォルト値に戻します。',
  'workbench.settings.def.data.resetAllSettings.action.label': 'デフォルトに戻す',
  'workbench.settings.def.data.resetAllSettings.confirm':
    'すべての設定をデフォルトにリセットしますか？この操作は元に戻せません。',

  // ── Updates defs (About category) ──────────────────────────────────
  'workbench.settings.def.updates.state.label': 'ソフトウェアアップデート',
  'workbench.settings.def.updates.state.description':
    '現在のアップデート状況です。ダウンロードとインストールは常にあなたの明示的なクリックが必要です。',
  'workbench.settings.def.updates.check.label': 'アップデートを確認',
  'workbench.settings.def.updates.check.description':
    '1 日 1 回新しいバージョンを探し、利用できるときに通知ドットを表示します。この確認は何もダウンロードせず、あなたやこのインストールについて何も送信しません。公開のバージョン一覧を読み、ローカルで比較します。「セキュリティ修正のみ」は、実行中のバージョンに影響するセキュリティの問題をリリースが修正しない限り沈黙します。アップデートがあなたの明示的な操作なしにインストールされることはありません。',
  'workbench.settings.def.updates.check.option.all.label': 'すべてのリリース',
  'workbench.settings.def.updates.check.option.security-only.label': 'セキュリティ修正のみ',
  'workbench.settings.def.updates.check.option.off.label': 'オフ',
  'workbench.settings.def.updates.channel.label': 'アップデートチャネル',
  'workbench.settings.def.updates.channel.description':
    'アップデートの確認がどのリリースラインに従うかです。Beta は新機能をより早く得られますが、洗練度が低い場合があります。Stable に戻してもダウングレードは決して行われず、次の安定版リリースが追い越すまでインストール済みのバージョンを保ちます。セキュリティの通知はどちらのチャネルでも常に安定版ラインに従います。',
  'workbench.settings.def.updates.channel.option.stable.label': 'Stable',
  'workbench.settings.def.updates.channel.option.beta.label': 'Beta',
  'workbench.settings.def.updates.showWhatsNew.label': '更新後に新機能を表示',
  'workbench.settings.def.updates.showWhatsNew.description':
    '機能リリースの後に初めてワークベンチを開いたとき、リリースのハイライトを載せたタブを開きます。パッチリリースでは開かず、通知のタイムラインに留まります。ノートはアプリに同梱されており、何も取得しません。',
  'workbench.settings.def.updates.autoDownload.label': 'アップデートを自動的にダウンロード',
  'workbench.settings.def.updates.autoDownload.description':
    'アップデートが見つかったらすぐにバックグラウンドで取得し、インストールが「更新して再起動」の 1 回で済むようにします。アプリを終了して開き直すだけでも新しいバージョンが起動します。オフの場合、自分で「更新して再起動」を選ぶまで何もダウンロードされません。どちらでも、アプリが自動で再起動することはありません。',

  // ── About category defs ────────────────────────────────────────────
  'workbench.settings.def.about.version.label': 'バージョン',
  'workbench.settings.def.about.version.description': '現在インストールされている拡張機能のバージョンです。',
  'workbench.settings.def.about.build.label': 'ビルド',
  'workbench.settings.def.about.build.description': 'ビルド番号と日付です。',
  'workbench.settings.def.about.commit.label': 'コミット',
  'workbench.settings.def.about.commit.description': 'このビルドの元になった Git コミットです。',
  'workbench.settings.def.about.protocol.label': 'プロトコル',
  'workbench.settings.def.about.protocol.description':
    'この拡張機能がデスクトップアプリと話すワイヤープロトコルのバージョンです。一致しないピアは、明確な更新の案内とともに拒否されます。',
  'workbench.settings.def.about.browser.label': 'ブラウザー',
  'workbench.settings.def.about.browser.description': '検出されたブラウザーとプラットフォームです。',
  'workbench.settings.def.about.openSource.label': '同梱パッケージ',
  'workbench.settings.def.about.openSource.description':
    'このビルドに同梱されているオープンソースソフトウェアと、各パッケージのライセンスです。',
} as const satisfies Catalog;
