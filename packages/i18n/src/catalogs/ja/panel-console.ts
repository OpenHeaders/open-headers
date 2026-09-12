/**
 * DevTools panel — console tool window — Japanese. Mirrors
 * `catalogs/en/panel-console.ts` key for key. Raw by design: level wire
 * names (debug/log/…), the › ‹ chevrons and ⚙ prefix, context labels
 * (top / frame names / script URLs), source locations, "(anonymous)",
 * the browser's synthesized network phrasing quoted verbatim
 * (「finished loading」, 「Access to fetch at …」), key names (Tab /
 * Enter / arrows ride raw), and the example-transcript rows in the (i)
 * corpora. Network パネル keeps the raw panel name (zh-CN precedent).
 * Mints: プロンプト = prompt (REPL); 先行評価 = eager evaluation; 評価
 * = evaluate; トランスクリプト = transcript; キャプチャ = capture
 * (carried); スタックトレース = stack trace; ピン留め = pin (carried);
 * scope rides the debug-reach スコープ (S19 law). OH's own setting
 * labels quoted in prose copy this file's mints in 「」.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelConsole = {
  // ── Console tool window (station: console family) ───────────────────
  'panel.console.clear': 'コンソールをクリア',
  'panel.console.collapseAll': 'すべて折りたたむ',
  'panel.console.expandAll': 'すべて展開',
  'panel.console.filterAria': 'コンソールメッセージを絞り込む',
  'panel.console.levelTitle': 'ログレベル：{label}',
  'panel.console.settings': 'コンソール設定',
  'panel.console.settingsPaneAria': 'コンソール設定',
  'panel.console.contextTitle': 'JavaScript コンテキスト：コンソールコマンドが評価される場所',

  // Level-filter menu (the browser's "Default levels ▾" ladder)
  'panel.console.levels.verbose': '詳細',
  'panel.console.levels.info': '情報',
  'panel.console.levels.warnings': '警告',
  'panel.console.levels.errors': 'エラー',
  'panel.console.levels.all': 'すべてのレベル',
  'panel.console.levels.defaultLevels': 'デフォルトレベル',
  'panel.console.levels.hideAll': 'すべて隠す',
  'panel.console.levels.only': '{level} のみ',
  'panel.console.levels.custom': 'カスタムレベル',
  'panel.console.levels.default': 'デフォルト',

  // Settings pane (labels + hover titles, browser pane order)
  'panel.console.setting.hideNetwork': 'ネットワークを隠す',
  'panel.console.setting.hideNetworkTitle':
    'ブラウザーのネットワークログエントリ（失敗およびブロックされたリクエスト）を隠します',
  'panel.console.setting.logXhr': 'XMLHttpRequest を記録',
  'panel.console.setting.logXhrTitle':
    'XHR、fetch、EventSource のリクエストが完了または失敗したときにメッセージを記録します',
  'panel.console.setting.preserveLog': 'ログを保持',
  'panel.console.setting.preserveLogTitle': '遷移時にログをクリアしません',
  'panel.console.setting.eagerEval': '先行評価',
  'panel.console.setting.eagerEvalTitle': 'プロンプト内のテキストを先行して評価します（副作用のないプレビュー）',
  'panel.console.setting.selectedContextOnly': '選択したコンテキストのみ',
  'panel.console.setting.selectedContextOnlyTitle': '選択したコンテキストからのメッセージのみを表示します',
  'panel.console.setting.autocompleteHistory': '履歴からオートコンプリート',
  'panel.console.setting.autocompleteHistoryTitle': 'プロンプトに入力中、以前に実行したコマンドを提案します',
  'panel.console.setting.groupSimilar': 'コンソールで類似メッセージをグループ化',
  'panel.console.setting.groupSimilarTitle': '繰り返される同一メッセージを件数付きの 1 行にまとめます',
  'panel.console.setting.evalUserGesture': 'コードの評価をユーザー操作として扱う',
  'panel.console.setting.evalUserGestureTitle':
    'ユーザージェスチャー付きで評価し、ユーザーアクティベーションを要する API がプロンプトから動作するようにします',
  'panel.console.setting.showCorsErrors': 'コンソールに CORS エラーを表示',
  'panel.console.setting.showCorsErrorsTitle': 'ページ自身の出力と並べて CORS ポリシーエラーを表示します',

  // Per-setting (i) info corpora (titles reuse the setting label keys;
  // groupSimilar's popover title differs from its checkbox label)
  'panel.console.info.exampleCaption': 'コンソールの例',
  'panel.console.info.hideNetwork.summary':
    'ブラウザー自身のネットワークログエントリ（失敗およびブロックされたリクエスト）を隠します。ページのコンソール出力は常に残ります。',
  'panel.console.info.hideNetwork.description':
    '「XMLHttpRequest を記録」が合成する「finished loading」の行も隠します。これらもネットワーク由来のメッセージです。',
  'panel.console.info.logXhr.summary':
    'XHR、fetch、EventSource のリクエストが完了または失敗するたびに 1 行を記録します。',
  'panel.console.info.logXhr.description':
    '行は情報レベルで記録され（失敗も同様）、URL は Network パネル内のそのリクエストの行にリンクします。「ネットワークを隠す」はこれらの行も隠します。',
  'panel.console.info.preserveLog.summary': 'ページ遷移をまたいでログをクリアせずに保持します。',
  'panel.console.info.preserveLog.description':
    'オフの場合、遷移（ページの top コンテキストの再作成）により、表示はその後に到着したエントリだけに切り詰められます。',
  'panel.console.info.eagerEval.summary': '入力中の式の結果をプロンプト下のグレーの行にプレビューします。',
  'panel.console.info.eagerEval.description':
    'プレビューは副作用なしで評価されます。ページの状態を変える式は実行されずに何も表示せず、Enter を押すまでログには何も書き込まれません。',
  'panel.console.info.selectedContextOnly.summary':
    'ツールバーのコンテキストセレクターで選んだ JavaScript コンテキストからのメッセージのみを表示します。',
  'panel.console.info.selectedContextOnly.description':
    'コンテキストを持たないエントリ（ブラウザー自身のログエントリ）は常に表示されたままです。',
  'panel.console.info.autocompleteHistory.summary':
    '入力内容に続く最新のコマンドを、プロンプト内の薄い補完として提案します。',
  'panel.console.info.autocompleteHistory.description':
    'Tab（または入力末尾で →）で受け入れます。↑/↓ は引き続き履歴をたどります。履歴は現在のパネルセッションの間だけ保持されます。',
  'panel.console.info.groupSimilar.title': '類似メッセージをグループ化',
  'panel.console.info.groupSimilar.summary': '連続する同一メッセージを件数バッジ付きの 1 行にまとめます。',
  'panel.console.info.groupSimilar.description':
    '入力したコマンドとその結果は決してグループ化されません。トランスクリプトはそのまま残ります。',
  'panel.console.info.evalUserGesture.summary':
    'プロンプトのコマンドを、ユーザージェスチャーが引き起こしたかのように実行します。',
  'panel.console.info.evalUserGesture.description':
    'ユーザーアクティベーションを要する API（ウィンドウを開く、クリップボードへの書き込み、全画面表示）が、これをオンにするとプロンプトから成功します。',
  'panel.console.info.showCorsErrors.summary':
    'ブラウザーの CORS の説明（「Access to fetch at … has been blocked by CORS policy: …」）をページの出力と並べて表示します。',
  'panel.console.info.showCorsErrors.description':
    'オフにするとその説明メッセージだけが隠れます。ブロックされたリクエスト自体は引き続き Network パネルに表示されます。',

  // Capture-stopped banner + never-silent empty surfaces
  'panel.console.banner.leftScope':
    'キャプチャを停止しました。このタブはデバッグモードのスコープから外れました。最後にキャプチャした出力を表示しています。',
  'panel.console.banner.debugOff':
    'キャプチャを停止しました。デバッグモードがオフです。最後にキャプチャした出力を表示しています。',
  'panel.console.enableDebug': 'デバッグモードを有効にする',
  'panel.console.empty.noCdp.title': 'コンソールのキャプチャにはデバッグモードが必要です',
  'panel.console.empty.noCdp.sub': 'このブラウザーではデバッグモードの検査は利用できません。',
  'panel.console.empty.capturing.title': 'コンソール出力はまだありません',
  'panel.console.empty.capturing.sub': 'このタブのログメッセージと未捕捉の例外が、発生したときにここに表示されます。',
  'panel.console.empty.debugOff.title': 'コンソールログを表示するにはデバッグモードを有効にしてください',
  'panel.console.empty.debugOff.sub':
    'デバッグモードがオンの間、Open Headers はこのタブのコンソール出力と未捕捉の例外をキャプチャします。',
  'panel.console.empty.outOfScope.title': 'このタブはデバッグモードのスコープ外です',
  'panel.console.empty.outOfScope.sub':
    'コンソール出力をキャプチャするには、デバッグモードからスコープに入れてください（スコープを変更するか、このタブをピン留めします）。',
  'panel.console.noMatch': 'フィルターに一致するコンソールエントリはありません。',
  'panel.console.revealedHidden': '表示しようとしたメッセージは現在のフィルターにより隠れています',

  // Log rows
  'panel.console.repeatTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の同一メッセージ' }),
  'panel.console.expandStack': 'スタックトレースを展開',
  'panel.console.collapseStack': 'スタックトレースを折りたたむ',

  // REPL prompt
  'panel.console.prompt.waiting': 'JavaScript コンテキストを待っています…',
  'panel.console.prompt.placeholder': '選択したコンテキストで JavaScript を実行',
  'panel.console.prompt.aria': 'コンソールプロンプト',
  'panel.console.prompt.previewAria': '先行評価のプレビュー',
} as const satisfies Catalog;
