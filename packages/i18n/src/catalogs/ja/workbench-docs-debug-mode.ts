/**
 * Workbench Docs panel — the Debug Mode section body — Japanese.
 * Mirrors `catalogs/en/workbench-docs-debug-mode.ts` key for key. UI
 * labels the prose references copy the shipped `ja/shared-chrome.ts`
 * strings verbatim（アタッチ先、DevTools が開いている場所、フォーカス中の
 * タブ、両方、このブラウザータブを含める、アタッチ済みのタブ、タブは
 * スコープ外、システムステータス、デバッグモード）; Overrides = 上書き
 * (panel mint); the browser banner quote rides verbatim raw en inside
 * “”. スコープ = debug reach; ヒューリスティック = heuristic. MINT: ピル
 * = the footer pill (prose reference); デバッグモードオフ = the
 * rules-list badge (future editors-rule ja must reuse). Raw by design:
 * the `● Debug mode` pill chip and `fetch` / `XHR` code chips composed
 * by the section body, `CSP`, worker/cross-origin vocabulary per the
 * panel parity laws. Sandwich fragments restructure SOV.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDebugMode = {
  // ── Concepts: Debug mode ────────────────────────────────────────────
  'workbench.docs.body.debugMode.term': 'デバッグモード',
  'workbench.docs.body.debugMode.intro1':
    'は Open Headers をブラウザーのデバッグプロトコルにアタッチし、通常の拡張機能 API では届かないトラフィックを検査・変更できるようにします。ブラウザー自身の開発者ツールが使うのと同じ仕組みです。そのため、オンの間ブラウザーは',
  'workbench.docs.body.debugMode.introBanner': '“OH started debugging this browser”',
  'workbench.docs.body.debugMode.intro1Suffix': 'というバナーを表示します。',
  'workbench.docs.body.debugMode.intro2':
    '標準モード（デバッグモードオフ）でもほとんどのルールはカバーされます。ヘッダー、ブロック、リダイレクト、クエリパラメーター、そしてページコンテキストのボディ / レスポンス / 注入ルールです。デバッグモードは、それらが届かない範囲のためのオプトインの強化です。ナビゲーション、ワーカー、クロスオリジンのフレーム、タブ全体の環境の変更。',
  'workbench.docs.body.debugMode.controlHeading': '操作する場所',
  'workbench.docs.body.debugMode.control1Prefix': 'この',
  'workbench.docs.body.debugMode.control1Middle': 'ピルはすべての面のフッターの、',
  'workbench.docs.body.debugMode.systemStatusLink': 'システムステータス',
  'workbench.docs.body.debugMode.control1Suffix':
    'のすぐ左にあります。インラインのスイッチでオン / オフを切り替え、色付きのドットが健全性を追い、ドットとラベルをクリックすると残りのすべて（スコープ、タブごとのピン、現在アタッチされているタブの一覧）を載せたポップオーバーが開きます。',
  'workbench.docs.body.debugMode.surfaceCaption':
    'インラインのスイッチでオンにし、ドットとラベルで残りのすべてを載せたポップオーバーを開きます。',
  'workbench.docs.body.debugMode.scopeHeading': '検査する対象を選ぶ',
  'workbench.docs.body.debugMode.scope1Prefix': 'この',
  'workbench.docs.body.debugMode.attachTo': 'アタッチ先',
  'workbench.docs.body.debugMode.scope1Middle':
    'のドロップダウンが、デバッグモードがどのタブにアタッチするかを決めます。',
  'workbench.docs.body.debugMode.scopeDevtools': 'DevTools が開いている場所',
  'workbench.docs.body.debugMode.scope1DevtoolsParen':
    '（Open Headers パネルが開いているタブのみ。最も狭いデフォルト）、',
  'workbench.docs.body.debugMode.scopeFocused': 'フォーカス中のタブ',
  'workbench.docs.body.debugMode.scope1FocusedParen': '（切り替えに合わせてアクティブなタブに追従）、または',
  'workbench.docs.body.debugMode.scopeBoth': '両方',
  'workbench.docs.body.debugMode.scope1BothParen': '（2 つの和集合）。',
  'workbench.docs.body.debugMode.consent1Prefix': 'スコープを選ぶことが、ブラウザーのバナーへの同意',
  'workbench.docs.body.debugMode.consentIs': 'そのもの',
  'workbench.docs.body.debugMode.consent1Middle':
    'です。別のプロンプトはありません。現在のタブがまだスコープに含まれていないときは',
  'workbench.docs.body.debugMode.includeTabPin': 'このブラウザータブを含める',
  'workbench.docs.body.debugMode.consent1Suffix':
    'のピンが現れ、他のすべてのスコープを広げることなく、そのタブだけをアタッチできます。',
  'workbench.docs.body.debugMode.attached1Prefix': 'この',
  'workbench.docs.body.debugMode.attachedTabs': 'アタッチ済みのタブ',
  'workbench.docs.body.debugMode.attached1Suffix':
    'の一覧には、デバッグモードが現在動かしているすべてのタブが、それぞれタブへ移動する操作付きで表示されます。アタッチされる集合は、スコープ、ピン、どのパネルが開いているかから常に再計算されるため、古いスナップショットではなく現在の状態を反映します。',
  'workbench.docs.body.debugMode.scopeCaption':
    'アタッチされる集合は毎回導出されます。再アタッチはそれを再生するだけで、何も保存されません。',
  'workbench.docs.body.debugMode.bannerCalloutTitle': 'バナーはブラウザー全体に出ます',
  'workbench.docs.body.debugMode.banner1Prefix':
    'デバッグモードがオンの間、ブラウザーの “OH started debugging this browser” バナーは',
  'workbench.docs.body.debugMode.bannerEvery': 'すべての',
  'workbench.docs.body.debugMode.banner1Suffix':
    'タブに表示されます。アタッチされたタブだけではありません。これはブラウザー自身の動作で、デバッグモードをオフにすると直ちに消えます。',
  'workbench.docs.body.debugMode.unlocksHeading': '可能になること',
  'workbench.docs.body.debugMode.unlocksIntro':
    'アタッチされたタブでは、ルールとコントロールがページコンテキストの先まで届きます：',
  'workbench.docs.body.debugMode.anyRequestLead': 'あらゆるリクエスト、あらゆるコンテキスト。',
  'workbench.docs.body.debugMode.anyRequest1':
    'トップレベルのナビゲーション、ワーカーのリクエスト、クロスオリジンの iframe をモックまたは書き換えます。ページの',
  'workbench.docs.body.debugMode.anyRequest2':
    'だけではありません。それらと同じコンテキストでリクエストとレスポンスのボディを読み取って変換でき、開発用プロキシやステージングの HTTP 認証チャレンジには自動的に応答します。',
  'workbench.docs.body.debugMode.injectionLead': 'より強力な注入。',
  'workbench.docs.body.debugMode.injection1':
    'スクリプトの注入は競合状態なし・CSP 耐性ありになり、標準のページコンテキスト経路では触れられないワーカーやクロスオリジンのフレームの内側にも届きます。',
  'workbench.docs.body.debugMode.tabEnvLead': 'タブの環境。',
  'workbench.docs.body.debugMode.tabEnv1':
    '正確なキャッシュ無効化、ネットワークのスロットリング / オフライン、User-Agent / ロケール / タイムゾーン / メディアの上書きを、パネルのツールバーと',
  'workbench.docs.body.debugMode.overrides': '上書き',
  'workbench.docs.body.debugMode.tabEnv2': '面からタブごとに設定できます。',
  'workbench.docs.body.debugMode.reachCaption':
    '標準モードはページの fetch / XHR をカバーし、アタッチされたタブは同じルールをそれ以外のすべてに広げます。',
  'workbench.docs.body.debugMode.silentHeading': 'ルールがサイレントに失敗することはありません',
  'workbench.docs.body.debugMode.silent1Prefix': '完全な効果にデバッグモードが必要なルールは、オフの間はルール一覧に',
  'workbench.docs.body.debugMode.badgeOff': 'デバッグモードオフ',
  'workbench.docs.body.debugMode.silent1Middle': 'のバッジを表示し、オンでもタブがスコープ外のときはパネルに',
  'workbench.docs.body.debugMode.badgeOutOfScope': 'タブはスコープ外',
  'workbench.docs.body.debugMode.silent1Middle2': 'の注記を表示します。ルールは標準のページコンテキスト経路を通じて、',
  'workbench.docs.body.debugMode.silentCan': 'できること',
  'workbench.docs.body.debugMode.silent1Suffix':
    'をすべて引き続き実行します。デバッグモードをオンにすると、同じルールがページ注入では届かないコンテキストにまで広がるだけです。',
  'workbench.docs.body.debugMode.colorsHeading': 'ステータスの色',
  'workbench.docs.body.debugMode.colors1Prefix': 'ドットは',
  'workbench.docs.body.debugMode.colors1Suffix': 'の行を反映します：',
  'workbench.docs.body.debugMode.statesCaption': 'オフのときは灰色、オンになると緑 / 黄 / 赤。',
  'workbench.docs.body.debugMode.stateGreenLabel': '緑',
  'workbench.docs.body.debugMode.stateOn': 'オン',
  'workbench.docs.body.debugMode.stateOnRest': 'で、問題なくアタッチされています。（オフのときドットは単に灰色です。）',
  'workbench.docs.body.debugMode.stateYellowLabel': '黄',
  'workbench.docs.body.debugMode.stateYellowPrefix': 'いずれかのタブが',
  'workbench.docs.body.debugMode.stateYellowTerm': 'ヒューリスティックにフォールバック',
  'workbench.docs.body.debugMode.stateYellowSuffix':
    'しました。通常はブラウザーのデバッグバナーが閉じられたためで、そのタブは標準の観測に戻ります。',
  'workbench.docs.body.debugMode.stateRedLabel': '赤',
  'workbench.docs.body.debugMode.stateRedPrefix': 'いずれかのタブが',
  'workbench.docs.body.debugMode.stateRedTerm': 'アタッチに失敗',
  'workbench.docs.body.debugMode.stateRedSuffix': 'しました。そのタブではデバッグプロトコルを使えませんでした。',
  'workbench.docs.body.debugMode.chromiumTitle': 'Chromium のみ',
  'workbench.docs.body.debugMode.chromium1':
    'デバッグモードは、Chromium ベースのブラウザーだけが拡張機能に公開するデバッグプロトコルに依存します。Firefox と Safari ではピルは隠れたままです。上の標準モードのルールはどこでも動作します。',
} as const satisfies Catalog;
