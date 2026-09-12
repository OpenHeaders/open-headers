/**
 * DevTools panel — shell chrome — Japanese. Mirrors
 * `catalogs/en/panel.ts` key for key. English boundary raw by design:
 * resource-type pills (All / Fetch/XHR / Doc / …), throttle tier
 * names (Fast 4G, Fiber, DSL, …), CDP method names, header names
 * (User-Agent), event names (DOMContentLoaded / Load), keyboard
 * chords (Alt+C), size and timing units (kB / kbit/s / ms), and the
 * Aa / ab / .* / ▾ / ✓ glyphs; the Network / Storage / Console /
 * Docs tool-window nouns ride raw (zh-CN precedent). Mints: ルール
 * アクティビティ = Rule Activity; 一致したルール = Matched Rules;
 * evidence badges 権威 = authoritative / 裏付け = corroborated / 矛盾
 * = contradicted / 推定 = inferred, with 確認済み / 間接 / サイレント
 * carried from popup; HAR 外 = off-HAR; スロットリング = throttling;
 * ログを保持 = preserve log; システム上書き = system overrides;
 * アクティビティバー = activity bar; 下部パネル = bottom panel;
 * フッター = footer; マイルストーン = milestone; デバッグモード =
 * Debug mode (carried).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panel = {
  // ── Toolbar buttons ─────────────────────────────────────────────────
  'panel.toolbar.record': 'ネットワークログを記録',
  'panel.toolbar.stopRecording': '記録を停止',
  'panel.toolbar.clear': 'ネットワークログをクリア',
  'panel.toolbar.filter': 'フィルター',
  'panel.toolbar.search': '検索',
  'panel.toolbar.preserveLog': 'ログを保持',
  'panel.toolbar.preserveLogTitle':
    'ページ遷移をまたいでリクエストを保持します。オフにすると、ブラウザー自身の Network パネルと同様に、遷移や再読み込みのたびにリストがクリアされます。',
  'panel.toolbar.aboutPreserveLog': 'ログの保持について',
  'panel.toolbar.aboutMoreFilters': 'その他のフィルターについて',
  'panel.toolbar.aboutFooterView': 'フッター表示について',
  'panel.toolbar.moreTools': 'その他のツール',
  'panel.toolbar.activeWorkspaceAria': 'アクティブなワークスペース：{name}',

  // ── Toolbar layout cluster ──────────────────────────────────────────
  'panel.toolbar.leftSidebar': '左サイドバー',
  'panel.toolbar.bottomPanel': '下部パネル',
  'panel.toolbar.rightSidebar': '右サイドバー',
  'panel.toolbar.chooseBottomAlignment': '下部パネルの配置を選択',
  'panel.toolbar.layoutOptions': 'レイアウトオプション',
  'panel.toolbar.bottomAlignTooltip.center': '下部パネル：中央（入れ子）',
  'panel.toolbar.bottomAlignTooltip.left': '下部パネル：左寄せ',
  'panel.toolbar.bottomAlignTooltip.right': '下部パネル：右寄せ',
  'panel.toolbar.bottomAlignTooltip.justify': '下部パネル：全幅',

  // ── Layout menu ─────────────────────────────────────────────────────
  'panel.layout.bottomLayout': '下部パネルのレイアウト',
  'panel.layout.alignCenter': '中央（入れ子）',
  'panel.layout.alignLeft': '左',
  'panel.layout.alignRight': '右',
  'panel.layout.alignJustify': '両端（全幅）',
  'panel.layout.splitColumns': '左右に並べる',
  'panel.layout.splitRows': '上下に重ねる',
  'panel.layout.showToolWindowNames': 'ツールウィンドウ名を表示',
  'panel.layout.activityBarLayout': 'アクティビティバーのレイアウト',
  'panel.layout.sidebarProportional': '比例（均等に二分）',
  'panel.layout.sidebarCompact': 'コンパクト（下部固定）',
  'panel.layout.sidebarStacked': '積み重ね（すべて上部）',
  'panel.layout.sidebarDynamic': '動的（パネルの高さに追従）',
  'panel.layout.defaultLayoutDonor': 'デフォルトレイアウトの{unit}',
  'panel.layout.inheritsDefault': 'デフォルトレイアウトを継承',
  'panel.layout.donorTooltip': 'この{unit}がデフォルトです。新しい{units}はこのレイアウトを継承します。',
  'panel.layout.nonDonorTooltip': '別の{unit}がデフォルトです。新しい{units}はそちらから継承します。',
  'panel.layout.resetToDefaults': 'レイアウトをデフォルトに戻す',
  'panel.layout.restoreHidden': '非表示のアクティビティバーツールを復元',

  // ── Filter strip chrome (syntax tokens stay raw) ────────────────────
  'panel.filter.placeholder': 'フィルター',
  'panel.filter.clear': 'クリア',
  'panel.filter.clearAria': 'フィルターをクリア',
  'panel.filter.matchCase': '大文字と小文字を区別（Alt+C）',
  'panel.filter.wholeWord': '単語単位で一致（Alt+W）',
  'panel.filter.regex': '正規表現を使用（Alt+R）',
  'panel.filter.more': 'その他',
  'panel.filter.hiddenClearFilter': 'フィルターをクリア',
  'panel.filter.hiddenDismiss': '閉じる',

  // Shared reset row across the panel's checkbox menus (More filters /
  // Footer View / resource pills) — one action family, one key.
  'panel.menu.resetToDefault': 'デフォルトに戻す',

  // ── More-filters menu ───────────────────────────────────────────────
  'panel.moreFilters.label': 'その他のフィルター',
  'panel.moreFilters.hideDataUrls': 'data URL を隠す',
  'panel.moreFilters.hideExtensionUrls': '拡張機能の URL を隠す',
  'panel.moreFilters.blockedRequests': 'ブロックされたリクエスト',
  'panel.moreFilters.thirdParty': 'サードパーティのリクエスト',
  'panel.moreFilters.swRequests': 'Service Worker のリクエスト',
  'panel.moreFilters.ruleApplied': 'ルールが適用されたリクエスト',
  'panel.moreFilters.pageOriginPending': 'ページのオリジンはまだ利用できません',

  // ── Footer-View menu ────────────────────────────────────────────────
  'panel.view.label': 'フッター表示',
  'panel.view.title': 'フッターに表示する統計を選択',
  'panel.view.focusedTool': 'フォーカス中のツール',
  'panel.view.focusedToolTitle':
    'フッターはフォーカス中のツールウィンドウに追従します。Storage、Console、検索は独自の概要を表示し、その他のツールは Network の行にフォールバックします。',
  'panel.view.networkOnly': 'Network ツールのみ',
  'panel.view.networkOnlyTitle':
    'どのツールウィンドウにフォーカスがあっても、フッターは常に Network の数値を表示します。',
  'panel.view.modifiedCount': '変更数',
  'panel.view.failedCount': '失敗数',
  'panel.view.cachedCount': 'キャッシュ数',
  'panel.view.pageLabel': '現在のページラベル',
  'panel.view.pageLabelTitle':
    'ログが複数の遷移にまたがるとき、タイミングのマイルストーンがどのページのものかを示します。',
  'panel.view.timingAllNavs': '全遷移にわたるタイミング',
  'panel.view.timingAllNavsTitle':
    'Finish / DOMContentLoaded / Load は、最初の遷移からのログ保持タイムライン全体にわたります（ブラウザーのデフォルト）。チェックを外すと最新の遷移のみを報告します。',

  // ── Export menu ─────────────────────────────────────────────────────
  'panel.export.title': 'トラフィックをエクスポート',
  'panel.export.exportAll': 'すべてを HAR としてエクスポート',
  'panel.export.exportAllSanitized': 'すべてを HAR としてエクスポート（サニタイズ済み）',
  'panel.export.copyAll': 'すべてを HAR としてコピー',
  'panel.export.copyAllSanitized': 'すべてを HAR としてコピー（サニタイズ済み）',

  // ── Disable cache ───────────────────────────────────────────────────
  'panel.cache.label': 'キャッシュを無効化',
  'panel.cache.tooltipDebug':
    'ネットワークスタックのレベルでキャッシュを無効化しています（デバッグモード）。ブラウザーネイティブのキャッシュ無効化と一致します。',
  'panel.cache.tooltipStandard':
    '再検証を強制して HTTP キャッシュを迂回します。ネットワークスタック全体の無効化（メモリ内キャッシュも含む）にはデバッグモードを有効にしてください。',
  'panel.cache.aboutAria': 'キャッシュの無効化について',

  // ── Network throttling ──────────────────────────────────────────────
  'panel.throttle.none': 'スロットリングなし',
  'panel.throttle.custom': 'カスタム',
  'panel.throttle.customEllipsis': 'カスタム…',
  'panel.throttle.customHint': 'ダウンロード、アップロード、レイテンシを設定します。',
  'panel.throttle.customTitle': 'カスタムスロットリング',
  'panel.throttle.download': 'ダウンロード',
  'panel.throttle.upload': 'アップロード',
  'panel.throttle.latency': 'レイテンシ',
  'panel.throttle.appliesToTab': 'このタブに適用',
  'panel.throttle.morePresets': 'その他のプリセット',
  'panel.throttle.morePresetsSubtitle': '光回線、ケーブル、DSL、5G、2G。',
  'panel.throttle.wired': '有線',
  'panel.throttle.mobile': 'モバイル',
  'panel.throttle.disabledTooltip':
    'ネットワークスロットリングはデバッグモードでのみ利用できます。このタブをスロットリングするにはデバッグモードを有効にしてください。',
  'panel.throttle.aboutAria': 'ネットワークスロットリングについて',
  // One-line speed/latency hints under the preset rows (tier names raw).
  'panel.throttle.subtitle.fiber': '≈500 Mbit/s · レイテンシ 2 ms',
  'panel.throttle.subtitle.cable': '≈200 Mbit/s · レイテンシ 8 ms',
  'panel.throttle.subtitle.dsl': '≈20 Mbit/s · レイテンシ 25 ms',
  'panel.throttle.subtitle.fast5g': '≈100 Mbit/s · レイテンシ 8 ms',
  'panel.throttle.subtitle.slow5g': '≈30 Mbit/s · レイテンシ 18 ms',
  'panel.throttle.subtitle.fast4g': '≈8.1 Mbit/s · レイテンシ 165 ms',
  'panel.throttle.subtitle.slow4g': '≈1.44 Mbit/s · レイテンシ 562.5 ms',
  'panel.throttle.subtitle.3g': '≈400 kbit/s · レイテンシ 2000 ms',
  'panel.throttle.subtitle.fast2g': '≈280 kbit/s · レイテンシ 2000 ms',
  'panel.throttle.subtitle.slow2g': '≈100 kbit/s · レイテンシ 3000 ms',
  'panel.throttle.subtitle.offline': 'このタブのすべてのネットワークトラフィックをブロックします。',

  // Shared Apply across the debug cluster's builder footers.
  'panel.debug.apply': '適用',
  'panel.debug.enableDebugMode': 'デバッグモードを有効にする',

  // ── System overrides ────────────────────────────────────────────────
  'panel.overrides.trigger': '上書き',
  'panel.overrides.disabledTooltip':
    'システム上書きはデバッグモードでのみ利用できます。このタブを上書きするにはデバッグモードを有効にしてください。',
  'panel.overrides.aboutAria': 'システム上書きについて',
  'panel.overrides.wireHint':
    'このタブがデバッグモードにある間、リクエストで送信され、ページスクリプトにも報告されます。',
  'panel.overrides.pageOnlyHint':
    'ページのみ。これらはページ自身のスクリプトと CSS が観測する内容を変えるだけで、リクエストには影響しません。',
  'panel.overrides.platform': 'プラットフォーム',
  'panel.overrides.locale': 'ロケール',
  'panel.overrides.timezone': 'タイムゾーン',
  'panel.overrides.colorScheme': 'カラースキーム',
  'panel.overrides.reducedMotion': '視差効果を減らす',
  'panel.overrides.printMedia': '印刷メディア',
  'panel.overrides.uaPlaceholder': 'カスタム User-Agent 文字列',
  'panel.overrides.alPlaceholder': '例：fr-FR,fr;q=0.9',
  'panel.overrides.platformPlaceholder': 'navigator.platform、例：Linux',
  'panel.overrides.localePlaceholder': '実際のロケール',
  'panel.overrides.timezonePlaceholder': '実際のタイムゾーン',
  'panel.overrides.auto': '自動',
  'panel.overrides.light': 'ライト',
  'panel.overrides.dark': 'ダーク',
  'panel.overrides.reduce': '減らす',
  'panel.overrides.noPref': '指定なし',
  'panel.overrides.screen': '画面',
  'panel.overrides.print': '印刷',
  'panel.overrides.resetAll': 'すべてリセット',

  // ── (i) corpora — Preserve log ──────────────────────────────────────
  'panel.info.preserveLog.summary':
    'ページが変わるたびにリストをクリアする代わりに、記録したリクエストをページ遷移や再読み込みをまたいで保持します。',
  'panel.info.preserveLog.description':
    'オン：ログはすべての遷移を越えて引き継がれ、リダイレクト、フォーム送信、再読み込みの直前に発火したリクエストも表示されたままになります。オフ：ブラウザー自身の Network パネルと同様に、遷移や再読み込みのたびにリストがクリアされ、現在のページのトラフィックだけが表示されます。',
  'panel.info.preserveLog.whenHeading': 'こんなときに',
  'panel.info.preserveLog.redirects': 'リダイレクト',
  'panel.info.preserveLog.redirectsDesc': '新しいページに消される前に、遷移を引き起こしたリクエストを調べます。',
  'panel.info.preserveLog.forms': 'フォーム送信 / ログイン',
  'panel.info.preserveLog.formsDesc': 'ページの再読み込み後も POST とそのレスポンスを表示したままにします。',
  'panel.info.preserveLog.reloadLoops': '再読み込みループ',
  'panel.info.preserveLog.reloadLoopsDesc': 'ページが自ら再読み込みする直前に何が発火したかを確認します。',

  // ── (i) corpora — More filters ──────────────────────────────────────
  'panel.info.moreFilters.summary':
    'メニューに収めた二次的なリクエストフィルターです。それぞれがツールバーの一等地を占めずにリストを絞り込みます。',
  'panel.info.moreFilters.hideHeading': '隠す',
  'panel.info.moreFilters.dataUrls': 'data URL',
  'panel.info.moreFilters.dataUrlsDesc': 'インラインの data: リソース（base64 画像、フォントなど）を除外します。',
  'panel.info.moreFilters.extensionUrls': '拡張機能の URL',
  'panel.info.moreFilters.extensionUrlsDesc': 'ブラウザー拡張機能のオリジンへのリクエストを除外します。',
  'panel.info.moreFilters.onlyHeading': 'のみ表示',
  'panel.info.moreFilters.blocked': 'ブロックされたリクエスト',
  'panel.info.moreFilters.blockedDesc': 'ルールがブロックしたリクエストにリストを限定します。',
  'panel.info.moreFilters.thirdParty': 'サードパーティのリクエスト',
  'panel.info.moreFilters.thirdPartyDesc': 'オリジンがページと異なるリクエストに限定します。',
  'panel.info.moreFilters.swRequests': 'Service Worker のリクエスト',
  'panel.info.moreFilters.swRequestsDesc':
    'Service Worker のやり取りに限定します。worker 自身が発行したリクエスト（⚙ の行）と、その fetch ハンドラーが応答したページリクエストです。',
  'panel.info.moreFilters.ruleApplied': 'ルールが適用されたリクエスト',
  'panel.info.moreFilters.ruleAppliedDesc': 'Open Headers のルールが変更したと検証できるリクエストに限定します。',

  // ── (i) corpora — Footer View ───────────────────────────────────────
  'panel.info.view.summary': '常時表示のリクエスト数と転送量のほかに、フッターにどの任意の統計を表示するかを選びます。',
  'panel.info.view.scopeHeading': '概要の範囲',
  'panel.info.view.focusedTool': 'フォーカス中のツール',
  'panel.info.view.focusedToolDesc':
    'フッターはフォーカス中のツールウィンドウに追従します。Storage、Console、検索は独自の概要行を表示し、その他のツールは Network の行にフォールバックします。',
  'panel.info.view.networkOnly': 'Network ツールのみ',
  'panel.info.view.networkOnlyDesc':
    'どのツールウィンドウにフォーカスがあっても、フッターは常に Network の数値を表示します。',
  'panel.info.view.countsHeading': 'フッターの件数',
  'panel.info.view.modified': '変更',
  'panel.info.view.modifiedDesc': 'ルールが変更したリクエストの数。',
  'panel.info.view.failed': '失敗',
  'panel.info.view.failedDesc': 'エラーになったか、ブロックされたリクエストの数。',
  'panel.info.view.cached': 'キャッシュ',
  'panel.info.view.cachedDesc': 'キャッシュから提供されたレスポンスの数。',
  'panel.info.view.timingHeading': 'タイミング',
  'panel.info.view.pageLabel': '現在のページラベル',
  'panel.info.view.pageLabelDesc':
    'ログが複数の遷移にまたがるとき、タイミングのマイルストーンがどのページのものかを示します。',
  'panel.info.view.allNavs': '全遷移にわたる',
  'panel.info.view.allNavsDesc':
    'Finish / DOMContentLoaded / Load は、最新の遷移だけでなくログ保持タイムライン全体にわたります。',

  // ── (i) corpora — Disable cache ─────────────────────────────────────
  'panel.info.cache.summary': 'このタブがキャッシュからレスポンスを提供するのを止めます。',
  'panel.info.cache.debugDesc':
    'このタブはデバッグモードです：キャッシュはネットワークスタックのレベルで無効化されており（メモリ内キャッシュも含む）、ブラウザーネイティブのキャッシュ無効化と一致します。',
  'panel.info.cache.standardDesc':
    'このタブは標準モードです：サーバーに再検証を求めることで HTTP キャッシュのみを迂回します。メモリ内キャッシュもクリアするネットワークスタック全体の無効化にはデバッグモードを有効にしてください。',
  'panel.info.cache.standardHeading': '標準モード',
  'panel.info.cache.revalidateDesc':
    'すべてのリクエストに追加され、サーバーが鮮度を再確認します。HTTP キャッシュのみを迂回します。',
  'panel.info.cache.debugHeading': 'デバッグモード',
  'panel.info.cache.cdpDesc':
    'タブ全体のキャッシュをネットワークスタックのレベルで無効化します。メモリ内キャッシュも含みます。',

  // ── (i) corpora — System overrides ──────────────────────────────────
  'panel.info.overrides.title': 'システム上書き',
  'panel.info.overrides.summary':
    'このタブのシステム識別情報（User-Agent、ロケール、タイムゾーン、エミュレートするメディア）を固定し、別のクライアントにサイトがどう応答するかを確認します。',
  'panel.info.overrides.debugDesc':
    'デバッグモードを通じてこのタブで有効です。User-Agent 系の項目はリクエストとページスクリプトに適用されます。ロケール、タイムゾーン、メディアはページ自身のスクリプトと CSS が観測する内容だけを変えます。「すべてリセット」で実際の値に戻ります。',
  'panel.info.overrides.standardDesc':
    'システム上書きにはデバッグモードが必要です。標準モードのフォールバックはありません。上書きするにはデバッグモードを有効にし、このタブをスコープ内に保ってください。',
  'panel.info.overrides.wireHeading': 'ワイヤー上 + ページスクリプト',
  'panel.info.overrides.uaDesc':
    'User-Agent / Accept-Language ヘッダー、プラットフォーム、それに対応する navigator.* の値を設定します。',
  'panel.info.overrides.pageHeading': 'ページのみ',
  'panel.info.overrides.localeDesc': 'ページスクリプトが読み取るロケールを変えます。',
  'panel.info.overrides.timezoneDesc': 'Date と Intl が解決するタイムゾーンを変えます。',
  'panel.info.overrides.mediaDesc': 'color-scheme / reduced-motion / print のメディアクエリを強制します。',

  // ── (i) corpora — Network throttling ────────────────────────────────
  'panel.info.throttle.title': 'ネットワークスロットリング',
  'panel.info.throttle.summary': 'このタブの帯域を制限しレイテンシを加えることで、低速な接続をシミュレートします。',
  'panel.info.throttle.debugDesc':
    'デバッグモードを通じてこのタブで有効です。プリセット（デフォルトに加えて「その他のプリセット」の光回線 / ケーブル / DSL と 5G / 2G）を選ぶか、Offline にするか、ダウンロード / アップロード / レイテンシをカスタム設定します。',
  'panel.info.throttle.standardDesc':
    'スロットリングにはデバッグモードが必要です。標準モードのフォールバックはありません。スロットリングするにはデバッグモードを有効にし、このタブをスコープ内に保ってください。',
  'panel.info.throttle.presetsHeading': 'プリセット',
  'panel.info.throttle.fast4gDesc': '下り ≈8.1 Mbit/s、レイテンシ 165 ms。',
  'panel.info.throttle.slow4gDesc': '下り ≈1.44 Mbit/s、レイテンシ 562.5 ms。',
  'panel.info.throttle.3gDesc': '≈400 kbit/s、レイテンシ 2000 ms。',
  'panel.info.throttle.offlineDesc': 'このタブのすべてのネットワークトラフィックをブロックします。',
  'panel.info.throttle.wiredHeading': 'その他のプリセット · 有線',
  'panel.info.throttle.fiberDesc': '≈500 Mbit/s、レイテンシ 2 ms。',
  'panel.info.throttle.cableDesc': '下り ≈200 Mbit/s、レイテンシ 8 ms。',
  'panel.info.throttle.dslDesc': '下り ≈20 Mbit/s、レイテンシ 25 ms。',
  'panel.info.throttle.mobileHeading': 'その他のプリセット · モバイル',
  'panel.info.throttle.fast5gDesc': '下り ≈100 Mbit/s、レイテンシ 8 ms。',
  'panel.info.throttle.slow5gDesc': '下り ≈30 Mbit/s、レイテンシ 18 ms。',
  'panel.info.throttle.fast2gDesc': '≈280 kbit/s、レイテンシ 2000 ms。',
  'panel.info.throttle.slow2gDesc': '≈100 kbit/s、レイテンシ 3000 ms。',

  // ── Status bar (footer summary line) ───────────────────────────────
  'panel.status.requests': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 件のリクエスト' }),
  'panel.status.requestsSubset': '{subset} / {total} 件のリクエスト',
  'panel.status.modified': '{count} 件変更',
  'panel.status.modifiedTitle': 'ルールが変更したリクエスト',
  'panel.status.failed': '{count} 件失敗',
  'panel.status.failedTitle': '失敗またはエラーステータスのリクエスト',
  'panel.status.cached': '{count} 件キャッシュ',
  'panel.status.cachedTitle': 'キャッシュから提供されたリクエスト',
  'panel.status.transferredOnly': '{size} 転送',
  'panel.status.transferredAndResources': '{transferred} 転送 / リソース {resources}',
  'panel.status.transferredSubset': '{subset} / {total} 転送',
  'panel.status.resourcesSubset': 'リソース {subset} / {total}',
  'panel.status.finish': 'Finish：{time}',
  'panel.status.loadEventTitle': 'Load イベント',
  'panel.status.tabs': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 個のタブ' }),
  'panel.status.messagesOf': '{total} 件中 {visible} 件のメッセージ',
  'panel.status.messages': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 件のメッセージ' }),
  'panel.status.errors': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 件のエラー' }),
  'panel.status.errorsTitle': 'エラーレベルのコンソールメッセージ',
  'panel.status.warnings': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 件の警告' }),
  'panel.status.warningsTitle': '警告レベルのコンソールメッセージ',
  'panel.status.systemStatus': 'システム',
  'panel.status.theme.light': 'ライト',
  'panel.status.theme.dark': 'ダーク',
  'panel.status.theme.auto': '自動',

  // ── Tool-window registry labels (activity bar / dock tabs / restore) ─
  'panel.toolWindows.network': 'Network',
  'panel.capture.collapsePlane': 'このセクションを折りたたむ',
  'panel.toolWindows.storage': 'Storage',
  'panel.toolWindows.console': 'Console',
  'panel.toolWindows.search': '検索',
  'panel.toolWindows.notifications': '通知',
  'panel.toolWindows.docs': 'Docs',
  'panel.toolWindows.ruleActivity': 'ルールアクティビティ',
  'panel.toolWindows.matchedRules': '一致したルール',

  // ── Search tool window (station: search family) ─────────────────────
  // Raw by design: match-text lines, section labels (doc-plane vocabulary
  // shared with the filter grammar), #ordinal / line:col figures, doc
  // names/origins, timing figures (ms / s), and the · separators. The
  // source chips and group badges reuse the tool-window label keys.
  'panel.search.placeholder': '検索（Enter を押す）',
  'panel.search.inputAria': 'キャプチャしたデータを検索',
  'panel.search.syntaxHelp': '検索構文のヘルプ',
  'panel.search.run': '検索',
  'panel.search.runTitle': '検索を実行（Enter）',
  'panel.search.cancel': 'キャンセル',
  'panel.search.cancelTitle': '検索をキャンセル',
  'panel.search.idleHintMin': 'クエリ（2 文字以上）を入力し、Enter を押して検索します。',
  'panel.search.idleHintShort': 'Enter を押して検索します。',
  'panel.search.noMatches': '一致するものが見つかりません。',

  // Session status lines (panel status strip + published footer line)
  'panel.search.status.searching': '検索中… {done} / {total}',
  'panel.search.status.noResults': '結果なし · {elapsed}',
  'panel.search.status.found': ({ matches, files, elapsed }, locale) => {
    const found = plural(locale, Number(matches), { other: '{count} 件の一致' });
    const where = plural(locale, Number(files), { other: '{count} 個のファイル' });
    return `${where}で${found}が見つかりました · ${String(elapsed)}`;
  },
  'panel.search.status.capped': '最初の {shown} 件を表示中。残りを見るにはクエリを絞り込んでください',

  // Result groups + rows
  'panel.search.group.countTitle': 'このファイルに {count} 件の一致',
  'panel.search.group.countTitleCapped': 'このファイルに {count} 件の一致。最初の {shown} 件を表示中',
  'panel.search.row.lineCol': '{line} 行、{col} 列',
  'panel.search.row.line': '{line} 行',
  'panel.search.row.matchesOnLine': 'この行に {count} 件の一致',

  // ── Matched Rules tool window (station: rule tool windows) ──────────
  // Raw by design: rule action descriptor lines (`req set X = v` — rule
  // syntax plane), match patterns, rule names/uids, and the brand mark
  // riding between the select-prompt halves.
  'panel.matchedRules.selectPrompt.lead': 'リクエストを選択すると、それに適用される',
  'panel.matchedRules.selectPrompt.tail': 'ルールが表示されます',
  'panel.matchedRules.matchedCount': '一致 · {count}',
  'panel.matchedRules.futureCount': '今後の一致 · {count}',
  'panel.matchedRules.noMatched': 'このリクエストに一致したルールはありません。',
  'panel.matchedRules.noFuture': 'このリクエストに一致する他のルールはありません。',
  'panel.matchedRules.pattern': 'パターン：{pattern}',
  'panel.matchedRules.wouldMatch': '一致する見込み',

  // Fire-evidence badges + their receipts
  'panel.matchedRules.evidence.contradicted': '矛盾',
  'panel.matchedRules.evidence.authoritative': '権威',
  'panel.matchedRules.evidence.confirmed': '確認済み',
  'panel.matchedRules.evidence.fallback': '間接',
  'panel.matchedRules.evidence.silent': 'サイレント',
  'panel.matchedRules.evidence.corroborated': '裏付け',
  'panel.matchedRules.evidence.inferred': '推定',
  'panel.matchedRules.evidenceTitle.contradicted':
    '矛盾：キャプチャしたヘッダーが、このルールが主張する変更を否定しています。',
  'panel.matchedRules.evidenceTitle.authoritative':
    '権威：ルールエンジンがこの DNR ルールのリクエストでの実行を確認しました。',
  'panel.matchedRules.evidenceTitle.capturedOverride':
    '確認済み：ルールがページコンテキストでボディを変更し、このリクエストの両側（提供版と元版）がキャプチャされています。',
  'panel.matchedRules.evidenceTitle.confirmed':
    'ページ内レポーターが確認：スクリプト可能なアクションがページ内で実行されました。',
  'panel.matchedRules.evidenceTitle.fallback':
    'URL の一致から推定：スクリプト可能な確認が期待されましたが、届きませんでした。',
  'panel.matchedRules.evidenceTitle.silent':
    'パターンは一致しましたが、リクエストはキャッシュ / Service Worker から提供されました。DNR もスクリプト可能なアクションも実行されていません。',
  'panel.matchedRules.evidenceTitle.corroborated': '裏付け：主張された変更がキャプチャしたヘッダーで確認できます。',
  'panel.matchedRules.evidenceTitle.inferred':
    'URL の一致から推定：条件に基づき、このルールはこのリクエストに一致する見込みです。',
  'panel.matchedRules.contradiction.stillPresent': '{header} はまだ存在しています（{observed}）。',
  'panel.matchedRules.contradiction.missing': '{header} はキャプチャしたヘッダーにありません。',
  'panel.matchedRules.contradiction.otherValue': '{header} は主張された値ではなく "{observed}" を持っています。',

  // Rule-state badges (the snapshot fired; the live rule moved on)
  'panel.matchedRules.ruleState.deleted': 'ルール削除済み',
  'panel.matchedRules.ruleState.disabled': 'ルール無効',
  'panel.matchedRules.ruleState.modified': 'ルール変更済み',
  'panel.matchedRules.ruleStateTitle.deleted':
    'このルールは発火後に削除されました。この行は発火時に行った内容を示しています。',
  'panel.matchedRules.ruleStateTitle.disabled':
    'このルールは発火後に無効にされました。次のリクエストには適用されません。',
  'panel.matchedRules.ruleStateTitle.modified':
    'このルールは発火後に編集されました。この行は発火時に行った内容を示しています。ホバーすると現在のルールが表示されます。',

  // ── Rule Activity tool window ────────────────────────────────────────
  'panel.ruleActivity.empty': 'このタブにはまだルールアクティビティがありません。',
  'panel.ruleActivity.toolbarHint': 'ルールごとにグループ化したルールアクティビティ。',
  // Legend: bold term key + remainder key per sentence (the popup tour's
  // term/hint split idiom).
  'panel.ruleActivity.hint.applied': '適用済み',
  'panel.ruleActivity.hint.appliedDesc':
    'の発火は実行が確認されたものです。ルールエンジンがルールの実行を報告した、ページ内レポーターがアクションの実行を確認した、またはキャプチャしたヘッダーで変更が確認できます。',
  'panel.ruleActivity.hint.contradicted': '矛盾',
  'panel.ruleActivity.hint.contradictedDesc':
    'の発火は、主張したヘッダー変更がキャプチャしたヘッダーによって否定されたものです。',
  'panel.ruleActivity.hint.inferred': '推定',
  'panel.ruleActivity.hint.inferredDesc':
    'の発火は、観測されたリクエストにルールのパターンが一致したものの、確認できなかったものです。',
  'panel.ruleActivity.hint.offHar': 'HAR 外',
  'panel.ruleActivity.hint.offHarDesc': 'の発火は、パネルがキャプチャしていないリクエストでのルール一致です。',
  'panel.ruleActivity.hits': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 件のヒット' }),
  'panel.ruleActivity.applied': '{count} 件適用',
  'panel.ruleActivity.contradicted': '{count} 件矛盾',
  'panel.ruleActivity.offHar': '{count} 件 HAR 外',
  'panel.ruleActivity.offHarTitle': 'HAR 外：パネルはこの発火の HAR シェルをキャプチャしていません',

  // ── Rule-value editor-tab document (ValueDocumentTab) ──────────────
  // The crumb's rule/header names ride raw as data; 'Rules' is its
  // fallback when the rule is gone.
  'panel.valueDoc.crumbFallback': 'ルール',
  'panel.valueDoc.saveHint': '編集した値を再エンコードしてルールに書き戻す',
  'panel.valueDoc.blockedHintInvalid': '編集したテキストはこの値の型でエンコードできません',
  'panel.valueDoc.blockedHintDetached': 'この値が属していたルールのフィールドは存在しません',
  'panel.valueDoc.rereadTitle': 'ルールから値を再読み込み',
  'panel.valueDoc.rereadConfirm': '編集内容を破棄します。再読み込みするにはもう一度クリックしてください',
  'panel.valueDoc.rereadAria': '編集を破棄して値を再読み込み',
  'panel.valueDoc.openRuleTitle': 'このルールをワークスペースエディターで開く',
  'panel.valueDoc.openRule': 'ルールをワークスペースで開く',
  'panel.valueDoc.driftNote':
    '編集中にルール内の値が変わりました。未保存の編集は保持されています。保存すると上書きします。',
  'panel.valueDoc.undetectedNote':
    'このフィールドはもう、このエディターがエンコードできる値を保持していません。未保存の編集はコピー用に保持されています。',
  'panel.valueDoc.detachedNote':
    'この値が属していたルールのフィールドは存在しません。未保存の編集はコピー用に保持されています。',
  'panel.valueDoc.discardEdits': '編集を破棄',
  'panel.valueDoc.saveFailed.detached': 'この値が属していた変更はルールから消えています。書き込む先がありません。',
  'panel.valueDoc.saveFailed.notFound': 'ルールが見つかりません。削除された可能性があります。',
  'panel.valueDoc.saveFailed.write': '保存に失敗しました。ルールが書き込みを拒否しました。',
  'panel.valueDoc.encodedPreview': 'エンコード後のプレビュー',
  'panel.valueDoc.cannotEncode': 'エンコードできません。編集した値はこの型に対して無効です',
  'panel.valueDoc.undetectedTitle': 'エンコードされた値ではなくなりました',
  'panel.valueDoc.undetectedSub':
    'フィールドの現在の値はどのデコーダーにも一致しません。代わりにルールエディターで編集してください。',
  'panel.valueDoc.detachedTitle': '値はもうルールにありません',
  'panel.valueDoc.detachedSub': 'この値を保持していたルールまたは変更が削除されたか、操作が値を持たなくなりました。',

  // ── Value-view snapshot document (ValueViewDocumentTab) ────────────
  // The crumb's source name rides raw as data; the type title comes
  // from the shared value-editor title keys.
  'panel.valueView.snapshotNote': 'スナップショット',
  'panel.valueView.snapshotTitle': 'このドキュメントを開いたときにキャプチャしたものです。以後の変更は追跡しません。',
  'panel.valueView.encodedValue': 'エンコードされた値',

  // ── Rule editor-tab document (RuleEditorTab) ───────────────────────
  // Rule names ride raw as data; status codes and MIME values stay raw.
  'panel.ruleDoc.crumbKind': 'レスポンス上書き',
  'panel.ruleDoc.nameLabel': 'ルール名',
  'panel.ruleDoc.saveHint': '上書きルールを保存します。同じ手順で公開状態が保たれます',
  'panel.ruleDoc.saveHintCreate': 'ルールを作成して公開',
  'panel.ruleDoc.blockedHintDetached': 'このドキュメントが属していたルールは存在しません',
  'panel.ruleDoc.rereadTitle': 'ルールを再読み込み',
  'panel.ruleDoc.rereadConfirm': '編集内容を破棄します。再読み込みするにはもう一度クリックしてください',
  'panel.ruleDoc.rereadAria': '編集を破棄してルールを再読み込み',
  'panel.ruleDoc.openRuleTitle': 'このルールをワークスペースエディターで開く',
  'panel.ruleDoc.openRule': 'ワークスペースで開く',
  'panel.ruleDoc.saveFailed.notFound': 'ルールが見つかりません。削除された可能性があります。',
  'panel.ruleDoc.saveFailed.write': '保存に失敗しました。ルールが書き込みを拒否しました。',
  'panel.ruleDoc.detachedTitle': 'ルールはもう存在しません',
  'panel.ruleDoc.detachedSub': 'このドキュメントが編集していた上書きルールは削除されました。',
  'panel.ruleDoc.dynamicTitle': '動的ボディルール',
  'panel.ruleDoc.dynamicSub': 'JavaScript のレスポンスボディはワークスペースエディターで編集します。',

  // ── Onboarding tour (PanelOnboardingTour) ──────────────────────────
  // Tool-window names (Network / Storage / Console / Docs), HAR, and
  // IndexedDB stay raw per the registry's English boundary.
  'panel.tour.stepIndicator': 'ステップ {current} / {total}',
  'panel.tour.previous': '前へ',
  'panel.tour.next': '次へ',
  'panel.tour.finish': '完了',
  'panel.tour.welcomeTitle': '統合された DevTools 体験',
  'panel.tour.welcomeSubtitle': 'ルールを組み込んだネットワークデバッガーです。',
  'panel.tour.welcomeCapture': 'キャプチャ',
  'panel.tour.welcomeCaptureHint': '：タイミング、ヘッダー、サイズ付きのライブリクエスト',
  'panel.tour.welcomeRules': '帰属',
  'panel.tour.welcomeRulesHint': '：各リクエストでどのルールがなぜ発火したかを確認',
  'panel.tour.welcomeState': '検査',
  'panel.tour.welcomeStateHint': '：Cookie、ストレージ、コンソールをトラフィックの隣で',
  'panel.tour.networkTitle': 'Network ウィンドウ',
  'panel.tour.networkSubtitle': '検査中のタブが行うすべてのリクエストを、ライブで。',
  'panel.tour.networkFilters': 'フィルター',
  'panel.tour.networkFiltersHint': '：テキスト、リソース種別、または「その他のフィルター」のプリセットで',
  'panel.tour.networkToolbar': '制御',
  'panel.tour.networkToolbarHint': '：ログの保持、スロットリング、キャッシュの無効化が上部に',
  'panel.tour.networkExport': 'エクスポート',
  'panel.tour.networkExportHint': '：ログ全体を HAR として保存またはコピー',
  'panel.tour.storageTitle': 'Storage ウィンドウ',
  'panel.tour.storageSubtitle': '検査中のタブのクライアント側の状態を、一か所に。',
  'panel.tour.storageAreas': '閲覧',
  'panel.tour.storageAreasHint': '：ローカルとセッションのストレージ、Cookie、IndexedDB、キャッシュ',
  'panel.tour.storageEdit': '編集',
  'panel.tour.storageEditHint': '：任意のエントリをドキュメントタブとして開き、その場で変更',
  'panel.tour.inspectorTitle': 'リクエストの詳細',
  'panel.tour.inspectorSubtitle': 'リクエストを選択すると、ここにタブとして開きます。',
  'panel.tour.inspectorTabs': 'セクション',
  'panel.tour.inspectorTabsHint': '：ヘッダー、ペイロード、レスポンス、タイミング、Cookie',
  'panel.tour.inspectorEdit': '上書き',
  'panel.tour.inspectorEditHint': '：パネルを離れずにリクエストからルールを作成',
  'panel.tour.layoutTitle': '自分好みに',
  'panel.tour.layoutSubtitle': 'サイドレールにはさらに多くのツールウィンドウがあります。',
  'panel.tour.layoutTools': 'その他のツール',
  'panel.tour.layoutToolsHint': '：Console、検索、Docs、通知はレール上に',
  'panel.tour.layoutDrag': '並べ替え',
  'panel.tour.layoutDragHint': '：ドック間でツールウィンドウをドラッグ。レイアウトメニューでリセット',
  'panel.tour.debugTitle': 'デバッグモード',
  'panel.tour.debugSubtitle': 'デフォルトはオフです。より深いキャプチャが必要なときにここで切り替えます。',
  'panel.tour.debugUnlocks': '解放',
  'panel.tour.debugUnlocksHint': '：レスポンスボディ、コンソール、正確なタイミング、スクリプト層のルール',
  'panel.tour.debugBanner': 'ご注意',
  'panel.tour.debugBannerHint': '：オンの間、ブラウザーは接続されたタブにデバッグ中のバナーを表示します',

  // ── Value expander (headers / cookies detail readout) ──────────────
  // JWT part and claim names (Header / Payload / Signature / iat / nbf
  // / exp) are spec vocabulary and stay raw via the glossary.
  'panel.valueExpander.decoded': 'デコード済み',
  'panel.valueExpander.raw': 'Raw',
} as const satisfies Catalog;
