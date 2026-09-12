/**
 * Popup namespace — Japanese. Mirrors `catalogs/en/popup.ts` key for
 * key; see that file for the namespace rules and English boundary.
 * Extends the ja register contract (`ja/shared.ts`). Mints: 一致した
 * リクエスト = matched request; 発火 = fire; evidence chips 遮蔽 =
 * shadowed (遮蔽検出 = shadow detection) / 確認済み = confirmed / 間接
 * = fallback / サイレント = silent / 一致 = matched; delivery chips:
 * live raw / キャッシュ / raw sw; 配信 = delivery (column); 証拠 =
 * evidence; ツアーガイド = tour guide; バッジ = badge; 調停 =
 * arbitration; 関連ドメイン = related domain; コレクション carried;
 * デスクトップ = Desktop tag; 空のルール = blank rule; オーバーフロー
 * メニュー = overflow menu; exclude chip prefix = 除外. Rule-type
 * option labels translate (product vocabulary); resource-type parity
 * labels stay literal in the components. Browser-menu mocks quote the
 * browsers' own ja UI（Chrome 開発者/デベロッパーツール、Safari 設定/
 * Web 開発者向けの機能を表示）; the status-popover subsystem names
 * (Sync, Rules, …) ride verbatim raw.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const popup = {
  // ── Header ─────────────────────────────────────────────────────────
  'popup.header.switchFailed': '表示を切り替えられませんでした',
  'popup.header.switchToSidePanel': 'サイドパネルに切り替え（閲覧中も開いたままになります）',
  'popup.header.switchToPopup': 'ポップアップモードに切り替え（ツールバーのクリック）',
  'popup.header.rulesResumed': 'ルールの実行を再開しました',
  'popup.header.rulesPaused': 'ルールの実行を一時停止しました',
  'popup.header.rulesLabel': 'ルール',
  'popup.header.resumeRules': 'ルールの実行を再開',
  'popup.header.pauseRules': 'すべてのルールを一時停止（各ルールの個別設定は保持されます）',
  'popup.header.openSettings': '設定を開く',
  'popup.header.notifications': '通知',
  'popup.header.openNotifications': '通知を開く',
  'popup.header.activeWorkspace': 'アクティブなワークスペース：{name}',

  // ── Shared status vocabulary ───────────────────────────────────────
  'popup.status.active': '有効',
  'popup.status.paused': '一時停止中',

  // ── Footer ─────────────────────────────────────────────────────────
  'popup.footer.debugTooltip': '強力なブラウザー開発者ツールの開き方。',
  'popup.footer.networkDebug': 'ネットワークデバッグ。',
  'popup.footer.tagline': 'あるべき姿で',
  'popup.footer.keyboardShortcuts': 'キーボードショートカット',
  'popup.footer.systemStatus': 'システム',

  // ── Desktop watch privacy indicator ────────────────────────────────
  'popup.desktopWatch.label': 'デスクトップが閲覧中',
  'popup.desktopWatch.tooltip':
    'Open Headers デスクトップアプリが現在、トラフィックパネルでこのブラウザーを閲覧しています。クリックすると設定が開きます。「デスクトップアプリにこのブラウザーの閲覧を許可」がオフスイッチです。',
  'popup.desktopWatch.aria': 'デスクトップアプリがこのブラウザーを閲覧中。設定を開く',

  // ── Tabs ───────────────────────────────────────────────────────────
  'popup.tabs.thisPage': 'このページ',
  'popup.tabs.allRules': 'すべてのルール',
  'popup.tabs.collections': 'コレクション',
  'popup.tabs.openWorkspaceEditor': 'フルワークスペースエディターを開く',
  'popup.tabs.workspace': 'ワークスペース',

  // ── Delete confirmation overlay ────────────────────────────────────
  'popup.deleteConfirm.title': '「{name}」を削除しますか？',
  'popup.deleteConfirm.confirm': '確認',
  'popup.deleteConfirm.cancel': 'キャンセル',

  // ── Table toolbars (shared across the three tabs) ──────────────────
  'popup.table.searchPlaceholder': '何でも検索…',
  'popup.table.sortOrder': '並べ替え順',
  'popup.table.sortOrderHeading': '並べ替え順',
  'popup.table.sortByStatus': 'ステータス順',
  'popup.table.sortByPriority': '優先度順',
  'popup.table.sortByColumn': '列順',
  'popup.table.sortWorkspaceOrder': 'ワークスペース順',
  'popup.table.sortWorkspaceOrderHint': 'ワークスペースのサイドバーツリーの順序に一致します',
  'popup.table.sortByColumnHint': '{column} で並べ替え中。リセットするには上のオプションをクリックしてください',
  'popup.table.sortByPriorityHint': 'ブロック → リダイレクト → クエリ → ヘッダー → 注入 · 各グループ内は A-Z',
  'popup.table.sortByStatusHintAll': '有効 → 一時停止中 → 無効 → 下書き · 各グループ内は優先度順',
  'popup.table.sortByStatusHintThisPage': '有効 → 一時停止中 → 無効 · 各グループ内は優先度順',
  'popup.table.sortByStatusHintCollections': '有効 → 一時停止中 · 各グループ内は A-Z',
  'popup.table.columnName': '名前',
  'popup.table.columnDetails': '詳細',
  'popup.table.columnConditions': '条件',

  // ── Rule mutations ─────────────────────────────────────────────────
  'popup.rule.toggleFailed': 'ルールの切り替えに失敗しました',
  'popup.rule.deleted': 'ルールを削除しました',
  'popup.rule.deleteFailed': 'ルールの削除に失敗しました',
  'popup.rule.edit': 'ルールを編集',
  'popup.rule.delete': 'ルールを削除',
  'popup.rule.deleteOk': '削除',
  'popup.rule.notConnected': 'アプリが接続されていません',
  'popup.rule.desktopTag': 'デスクトップ',
  'popup.rule.comingSoon': '近日公開',

  // ── All Rules tab ──────────────────────────────────────────────────
  'popup.rules.title': 'ルール',
  'popup.rules.activeSummary': '{total} 件中 {active} 件が有効',
  'popup.rules.draftSuffix': '、下書き {count} 件',
  'popup.rules.pausedByCollection': '{count} 件がコレクションにより一時停止中',
  'popup.rules.addRule': 'ルールを追加',
  'popup.rules.addRuleTooltip': 'ルールを追加。種類とテンプレートを横断して検索します',
  'popup.rules.matchedCount': ({ matched, total }, locale) =>
    `${plural(locale, Number(total), { other: '{count} 件のルール' })}中 ${String(matched)} 件が一致`,
  'popup.rules.emptyNoMatch': '一致するルールが見つかりません',
  'popup.rules.emptyNone': 'ルールはまだありません',
  'popup.rules.emptyHint': '「ルールを追加」をクリックして、ブラウザーのライブリクエストを変更しましょう',

  // ── Collections tab ────────────────────────────────────────────────
  'popup.collections.title': 'コレクション',
  'popup.collections.summary': ({ collections, rules }, locale) =>
    `${plural(locale, Number(collections), { other: '{count} 個のコレクション' })}、${plural(locale, Number(rules), {
      other: '{count} 件のルール',
    })}`,
  'popup.collections.matchedCount': ({ matched, total }, locale) =>
    `${plural(locale, Number(total), { other: '{count} 個のコレクション' })}中 ${String(matched)} 個が一致`,
  'popup.collections.emptyNoMatch': '一致するコレクションが見つかりません',
  'popup.collections.emptyNone': 'コレクションはありません',
  'popup.collections.emptyHint': 'ワークスペースエディターでルールを作成し、コレクションに整理しましょう',
  'popup.collections.enabledSummary': ({ enabled, total }, locale) =>
    `${plural(locale, Number(total), { other: '{count} 件のルール' })}中 ${String(enabled)} 件が有効`,
  'popup.collections.pausedEnabledSummary': '一時停止中 · {total} 件中 {enabled} 件が有効',
  'popup.collections.resumeTooltip': '再開。{count} 件のルールを有効にピン留めします（必要なら親を上書きします）',
  'popup.collections.pauseTooltip': '一時停止。個別設定を変えずに {count} 件のルールを保留します',

  // ── Condition vocabulary (rule condition field labels) ─────────────
  'popup.conditions.allDomains': 'すべてのドメイン',
  'popup.conditions.none': '条件なし',
  'popup.conditions.short.urlFilter': 'URL',
  'popup.conditions.short.urlRegex': '正規表現',
  'popup.conditions.short.requestDomains': 'ドメイン',
  'popup.conditions.short.excludeRequestDomains': '除外ドメイン',
  'popup.conditions.short.initiatorDomains': '発信元',
  'popup.conditions.short.excludeInitiatorDomains': '除外発信元',
  'popup.conditions.short.requestMethods': 'メソッド',
  'popup.conditions.short.excludeRequestMethods': '除外メソッド',
  'popup.conditions.short.resourceTypes': 'リソース',
  'popup.conditions.short.excludeResourceTypes': '除外リソース',
  'popup.conditions.short.domainType': 'ドメイン種別',
  'popup.conditions.short.responseHeader': 'レスポンスヘッダー',
  'popup.conditions.short.excludeResponseHeader': '除外レスポンスヘッダー',
  'popup.conditions.full.urlFilter': 'URL パターン',
  'popup.conditions.full.urlRegex': 'URL 正規表現',
  'popup.conditions.full.requestDomains': 'ドメイン',
  'popup.conditions.full.excludeRequestDomains': '除外ドメイン',
  'popup.conditions.full.initiatorDomains': '発信元',
  'popup.conditions.full.excludeInitiatorDomains': '除外発信元',
  'popup.conditions.full.requestMethods': 'メソッド',
  'popup.conditions.full.excludeRequestMethods': '除外メソッド',
  'popup.conditions.full.resourceTypes': 'リソース',
  'popup.conditions.full.excludeResourceTypes': '除外リソース',
  'popup.conditions.full.domainType': 'ドメイン種別',
  'popup.conditions.full.responseHeader': 'レスポンスヘッダー',
  'popup.conditions.full.excludeResponseHeader': '除外レスポンスヘッダー',

  // ── Action-detail vocabulary (tooltip grid row labels) ─────────────
  'popup.actionDetail.name': '名前',
  'popup.actionDetail.url': 'URL',
  'popup.actionDetail.count': '件数',
  'popup.actionDetail.type': '種類',
  'popup.actionDetail.duration': '時間',
  'popup.actionDetail.format': '形式',
  'popup.actionDetail.status': 'ステータス',
  'popup.actionDetail.value': '値',
  'popup.actionDetail.position': '位置',
  'popup.actionDetail.body': 'ボディ',
  'popup.actionDetail.contentType': 'Content-Type',
  'popup.actionDetail.label': 'ラベル',
  'popup.actionDetail.headers': 'ヘッダー',
  'popup.actionDetail.params': 'パラメーター',

  // ── This Page tab ──────────────────────────────────────────────────
  'popup.thisPage.loading': '現在のタブの情報を読み込んでいます…',
  'popup.thisPage.noTab': '現在のタブの情報を取得できません',
  'popup.thisPage.columnMatch': '一致',
  'popup.thisPage.expandHeaderBadgeHint': '各行のバッジをクリックすると一致したリクエストが表示されます',
  'popup.thisPage.expandHeaderDocsHint': '下のアイコンをクリックするとドキュメントが表示されます',
  'popup.thisPage.badgeSearchMatch': ({ matched, total, query }, locale) =>
    `${plural(locale, Number(total), { other: '{count} 件のリクエスト' })}中 ${String(matched)} 件が「${String(
      query,
    )}」に一致。クリックして展開`,
  'popup.thisPage.badgeNone': '一致したリクエストはまだありません。クリックして展開',
  'popup.thisPage.badgeAllSilent': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '一致したリクエスト {count} 件' })}、すべてキャッシュから提供（サイレント）。クリックして展開`,
  'popup.thisPage.badgeMixed': ({ fired, silent }, locale) =>
    `${plural(locale, Number(fired), { other: '一致したリクエスト {count} 件' })}が発火 + サイレント ${String(
      silent,
    )} 件（キャッシュ）。クリックして展開`,
  'popup.thisPage.badgeMatched': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '一致したリクエスト {count} 件' })}。クリックして展開`,
  'popup.thisPage.systemPage': 'システムページ',
  'popup.thisPage.systemPageHint': 'ヘッダールールはブラウザーのシステムページには適用されません',
  'popup.thisPage.emptyNoRules': 'このページに一致するルールはありません',
  'popup.thisPage.emptyNoRulesHint': 'このドメインにはルールが設定されていません',
  'popup.thisPage.ruleDisabled': 'ルールは無効です',
  'popup.thisPage.rulePausedByGroup': 'ルールはコレクションまたはフォルダーにより一時停止中です',
  'popup.thisPage.zeroRelated':
    'ルールは関連ドメインを対象にしています。そのドメインへのリクエストはまだ観測されていません。ページがリクエストを送ると発火します。',
  'popup.thisPage.zeroPage':
    'パターンはこのページに一致しますが、一致するリクエストはまだ観測されていません。ページを操作するか再読み込みして発生させてください。',
  'popup.thisPage.shadowAllPrefix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '一致したリクエスト {count} 件すべて' }),
  'popup.thisPage.shadowSomePrefix': '一致したリクエスト {total} 件中 {shadowed} 件',
  'popup.thisPage.shadowTooltip':
    '{prefix}は「{name}」（優先度の高いブロックルール）により終了されています。そのため、このルールはそれらに目に見える効果を持ちません。実験的機能：遮蔽検出は過大または過小に報告する場合があります。非表示にするには設定で無効にしてください。',
  'popup.thisPage.evidenceConfirmed': ({ count }, locale) =>
    `スクリプトがこのページで ${plural(locale, Number(count), { other: '{count} 回の発火' })}を確認しました（ページ内注入による確証です）。`,
  'popup.thisPage.evidenceFallback': ({ count }, locale) =>
    `URL 経由で ${plural(locale, Number(count), {
      other: '{count} 件のリクエスト',
    })}に一致しましたが、ページ内スクリプトのレポーターは確認できませんでした。よくある原因：厳格な Content-Security-Policy が注入をブロックしている、またはリソース種別（stylesheet、image、manifest link）が fetch/XHR の傍受を迂回している。`,
  'popup.thisPage.evidenceSilent': ({ count }, locale) =>
    `パターンは ${plural(locale, Number(count), {
      other: '{count} 件のキャッシュ済みサブリソース',
    })}に一致しました。レスポンスがネットワークを迂回したため、アクションは実行できませんでした。キャッシュを無視して再読み込みし、新しいリクエストを強制してください。`,
  'popup.thisPage.evidenceMatched': ({ count }, locale) =>
    `このページで ${plural(locale, Number(count), {
      other: '{count} 件のリクエスト',
    })}に一致しました。Chrome の declarativeNetRequest は複数のルールが一致したときにどれが勝つかを報告しません。観測しているのは URL の一致であり、調停の結果ではありません。`,
  'popup.thisPage.pausedTagTooltip': 'コレクションまたはフォルダーが一時停止中です。ルールは適用されません',
  'popup.thisPage.rulesPausedByCollection': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '{count} 件のルール' })}がコレクションにより一時停止中`,
  'popup.thisPage.firing': '{count} 件が発火中',
  'popup.thisPage.silentCached': 'サイレント {count} 件（キャッシュ）',
  'popup.thisPage.related': '関連 {count} 件',
  'popup.thisPage.liveMonitoring': 'Live。リクエストを監視中',
  'popup.thisPage.visibleResourceTypes': '表示中のリソース種別',
  'popup.thisPage.showAll': 'すべて表示',
  'popup.thisPage.filterResourceTypes': 'リソース種別で絞り込む',
  'popup.thisPage.filterResourceTypesCount': 'リソース種別で絞り込む（{total} 件中 {shown} 件を表示）',
  'popup.thisPage.requestCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のリクエスト' }),
  'popup.thisPage.requestCountAllSilent': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のサイレントリクエスト（キャッシュ）' }),
  'popup.thisPage.requestCountSomeSilent': ({ count, silent }, locale) =>
    `${plural(locale, Number(count), { other: '{count} 件のリクエスト' })}（サイレント ${String(silent)} 件）`,
  'popup.thisPage.rulesOfTotal': ({ matched, total }, locale) =>
    `${plural(locale, Number(total), { other: '{count} 件のルール' })}中 ${String(matched)} 件`,
  'popup.thisPage.requestsOfTotal': ({ matched, total }, locale) =>
    `${plural(locale, Number(total), { other: '{count} 件のリクエスト' })}中 ${String(matched)} 件`,
  'popup.thisPage.matchedJoin': '{parts}が一致',
  'popup.thisPage.copyTsv': 'リクエストを TSV としてコピー',

  // ── Matched-requests sub-table ─────────────────────────────────────
  'popup.matched.columnTime': '時刻',
  'popup.matched.columnUrl': 'リクエスト URL',
  'popup.matched.columnType': '種類',
  'popup.matched.columnDelivery': '配信',
  'popup.matched.columnEvidence': '証拠',
  'popup.matched.columnPattern': 'パターン',
  'popup.matched.matchedBy': '一致元',
  'popup.matched.deliveryLive': 'live',
  'popup.matched.deliveryCached': 'キャッシュ',
  'popup.matched.deliverySw': 'sw',
  'popup.matched.deliveryLiveTip':
    'リクエストはこのセッション中にネットワークへ送られました。レスポンスはキャッシュから提供されたものではありません。',
  'popup.matched.deliveryCachedTip':
    'レスポンスは Chrome の HTTP キャッシュから提供されました。ルールは、このレスポンスが最初に取得されたとき、または再検証の往復時に適用されています。',
  'popup.matched.deliverySwTip':
    'Service Worker がリクエストを傍受しました。ルールが適用されたかどうかは、その Service Worker が次に何をしたかによります。',
  'popup.matched.evidenceShadowed': '遮蔽',
  'popup.matched.evidenceShadowedTip':
    'このリクエストは「{name}」（優先度の高いブロックルール）により終了されました。このルールはこのリクエストでは一度も実行されていません。',
  'popup.matched.evidenceConfirmed': '確認済み',
  'popup.matched.evidenceConfirmedTip':
    'スクリプトがページ内注入からこの発火を確認しました。ルールが実行されたという確証です。',
  'popup.matched.evidenceFallback': '間接',
  'popup.matched.evidenceFallbackTip':
    'URL 経由で一致しましたが、ページ内スクリプトのレポーターは確認できませんでした。よくある原因：厳格な Content-Security-Policy が MAIN-world 注入をブロックしている、またはリソース種別（stylesheet、image、manifest link）が fetch/XHR の傍受を迂回している。',
  'popup.matched.evidenceSilent': 'サイレント',
  'popup.matched.evidenceSilentTip':
    'パターンはこのサブリソースに一致しましたが、レスポンスがキャッシュ / Service Worker / bfcache から提供されたため、ルールのアクションは実行できませんでした。キャッシュを無視して再読み込みし、新しいリクエストを強制してください。',
  'popup.matched.evidenceMatched': '一致',
  'popup.matched.evidenceMatchedTip':
    'URL がこのルールの条件に一致しました。Chrome の declarativeNetRequest は調停でどのルールが勝つかを報告しません。観測しているのは URL の一致であり、実行ではありません。',
  'popup.matched.searchSummary': ({ matched, total, query }, locale) =>
    `${plural(locale, Number(total), { other: '{count} 件のリクエスト' })}中 ${String(matched)} 件が「${String(
      query,
    )}」に一致`,
  'popup.matched.countSummary': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '{count} 件のリクエスト' })}が一致`,
  'popup.matched.emptySearch':
    '「{query}」を含む一致したリクエストはありません。すべての一致を表示するには、検索をクリアするか広げてください。',
  'popup.matched.emptyRelated':
    'ルールは関連ドメインを対象にしています。ページがそのドメインへリクエストを送ると一致が表示されます。',
  'popup.matched.emptyPage':
    'パターンはこのページに一致します。ページがパターンに合うリクエストを発行すると一致が表示されます。ページを操作するか再読み込みして発生させてください。',
  'popup.matched.emptyNone': '一致したリクエストはまだありません。ページを再読み込みしてキャプチャしてください。',

  // ── Rule-type vocabulary ───────────────────────────────────────────
  'popup.ruleType.header': 'ヘッダー',
  'popup.ruleType.block': 'ブロック',
  'popup.ruleType.redirect': 'リダイレクト',
  'popup.ruleType.queryParam': 'クエリパラメーター',
  'popup.ruleType.inject': '注入',
  'popup.ruleType.requestBody': 'API リクエスト',
  'popup.ruleType.delay': '遅延',
  'popup.ruleType.response': 'API レスポンス',
  'popup.ruleType.headerDesc': 'HTTP ヘッダーを変更',
  'popup.ruleType.blockDesc': 'リクエストをブロック',
  'popup.ruleType.redirectDesc': 'リクエストをリダイレクト',
  'popup.ruleType.queryParamDesc': 'クエリパラメーターを変更',
  'popup.ruleType.injectDesc': 'スクリプトまたは CSS を注入',
  'popup.ruleType.requestBodyDesc': 'API リクエストボディを変更（fetch/XHR）',
  'popup.ruleType.delayDesc': 'レスポンスを遅延',
  'popup.ruleType.responseDesc': 'API レスポンスをモックまたは変更（fetch/XHR）',

  // ── Resource-type explanations (labels stay English — parity vocab) ─
  'popup.resourceType.mainFrameTip': 'ページ URL に直接一致します',
  'popup.resourceType.subFrameTip': 'このページが読み込む iframe に適用されます',
  'popup.resourceType.xhrTip': 'fetch() と XMLHttpRequest の呼び出しに適用されます',
  'popup.resourceType.scriptTip': 'スクリプトリソースに適用されます',
  'popup.resourceType.stylesheetTip': 'スタイルシートに適用されます',
  'popup.resourceType.imageTip': '画像に適用されます',
  'popup.resourceType.fontTip': 'フォントファイルに適用されます',
  'popup.resourceType.mediaTip': '音声/動画リソースに適用されます',
  'popup.resourceType.websocketTip': 'WebSocket 接続に適用されます',
  'popup.resourceType.pingTip': 'ping/beacon リクエストに適用されます',
  'popup.resourceType.otherTip': 'その他のリソースに適用されます',

  // ── Add Rule palette ───────────────────────────────────────────────
  'popup.palette.blankRule': '空のルール',
  'popup.palette.searchPlaceholder': 'ルールの種類とテンプレートを検索…',
  'popup.palette.noMatches': '「{query}」に一致するものはありません',

  // ── Keyboard shortcuts overlay + registry descriptions ─────────────
  'popup.shortcuts.title': 'キーボードショートカット',
  'popup.shortcuts.press': '閉じるには',
  'popup.shortcuts.or': 'または',
  'popup.shortcuts.toClose': 'を押します',
  'popup.shortcuts.groupNavigation': 'ナビゲーション',
  'popup.shortcuts.groupActions': 'アクション',
  'popup.shortcuts.groupRow': 'テーブル行',
  'popup.shortcuts.groupBrowser': 'ブラウザー',
  'popup.shortcuts.groupTour': 'ツアーガイド',
  'popup.shortcuts.openExtension': '拡張機能を開く',
  'popup.shortcuts.customize': '拡張機能のショートカットをカスタマイズ ↗',
  'popup.shortcuts.toggleDebugMode': 'デバッグモードを切り替え',
  'popup.shortcuts.tabThisPage': '「このページ」タブ',
  'popup.shortcuts.tabAllRules': '「すべてのルール」タブ',
  'popup.shortcuts.tabCollections': '「コレクション」タブ',
  'popup.shortcuts.focusSearch': '検索にフォーカス',
  'popup.shortcuts.prevPage': '前のページ',
  'popup.shortcuts.nextPage': '次のページ',
  'popup.shortcuts.addRule': '新しいルールを追加',
  'popup.shortcuts.openWorkspace': 'ワークスペースを開く',
  'popup.shortcuts.openSettings': '設定を開く',
  'popup.shortcuts.toggleSurface': 'ポップアップ / サイドパネルを切り替え',
  'popup.shortcuts.toggleRulesPause': 'すべてのルールを一時停止 / 再開',
  'popup.shortcuts.togglePauseFocused': 'コレクションまたはフォルダーを一時停止 / 再開',
  'popup.shortcuts.toggleOptionsMenu': 'オプションメニュー',
  'popup.shortcuts.cycleTheme': 'テーマを順に切り替え',
  'popup.shortcuts.toggleCompactMode': 'コンパクトモード',
  'popup.shortcuts.toggleShortcutsHelp': 'このパネル',
  'popup.shortcuts.moveDown': '下へ移動',
  'popup.shortcuts.moveUp': '上へ移動',
  'popup.shortcuts.expandRow': '展開 / サブ行に入る',
  'popup.shortcuts.collapseRow': '折りたたみ / サブ行から出る',
  'popup.shortcuts.toggleRow': 'オン / オフを切り替え',
  'popup.shortcuts.editRow': 'ルールを編集',
  'popup.shortcuts.copyValue': '値をコピー',
  'popup.shortcuts.deleteRow': '削除（2 回押す）',
  'popup.shortcuts.openTourGuide': 'ツアーガイドを開く',

  // ── Onboarding tour ────────────────────────────────────────────────
  'popup.tour.stepIndicator': 'ステップ {current} / {total}',
  'popup.tour.previous': '前へ',
  'popup.tour.next': '次へ',
  'popup.tour.finish': '完了',
  'popup.tour.welcomeTitle': 'Open Headers へようこそ',
  'popup.tour.welcomeSubtitle': 'HTTP トラフィックをリアルタイムで傍受・変更します。',
  'popup.tour.modify': '変更',
  'popup.tour.modifyDesc': 'ヘッダー、Cookie、認証 token、CORS、ペイロード',
  'popup.tour.route': 'ルーティング',
  'popup.tour.routeDesc': 'リクエストのリダイレクト、トラッカーのブロック、URL の書き換え',
  'popup.tour.debug': 'デバッグ',
  'popup.tour.debugDesc': 'ライブリクエストの検査、スクリプトの注入、レスポンスの上書き',
  'popup.tour.migrateSwitching': '次のツールから乗り換え：',
  'popup.tour.migrateOr': 'または',
  'popup.tour.migrateButton': '別のツールから移行',
  'popup.tour.tabsTitle': 'タブを切り替える',
  'popup.tour.tabsSubtitle': '数字キーを押すとすぐに切り替わります。',
  'popup.tour.thisPageHint': '：現在のタブに一致するルール',
  'popup.tour.allRulesHint': '：作成したすべてのルール',
  'popup.tour.tagsLabel': 'タグ',
  'popup.tour.tagsHint': '：グループを整理して一時停止',
  'popup.tour.workspaceTitle': 'あなたのワークスペース',
  'popup.tour.workspaceSubtitle': 'フルエディターです。専用のタブで開きます。',
  'popup.tour.workspaceRequests': 'API クライアント',
  'popup.tour.workspaceRequestsHint': '：API リクエストの作成、送信、保存',
  'popup.tour.workspaceWorkflows': 'ワークフロー',
  'popup.tour.workspaceWorkflowsHint': '：リクエストを連鎖させて自動実行',
  'popup.tour.workspaceEnvs': '環境と変数',
  'popup.tour.workspaceEnvsHint': '：さらにインポート、ルール、チーム同期',
  'popup.tour.navTitle': 'ルールを閲覧・移動する',
  'popup.tour.navSubtitle': 'キーボードショートカットで行の間を移動します',
  'popup.tour.keyMove': '移動',
  'popup.tour.keyExpand': '展開',
  'popup.tour.keyToggle': '切り替え',
  'popup.tour.keyEdit': '編集',
  'popup.tour.keyCopy': 'コピー',
  'popup.tour.keyDelete': '削除',
  'popup.tour.devtoolsTitle': 'DevTools でネットワークをデバッグ',
  'popup.tour.findThePrefix': 'DevTools で',
  'popup.tour.findTheSuffix': 'タブを見つけます：',
  'popup.tour.devtoolsHint': 'セットアップ手順はいつでもこのボタンをクリックしてください。',
  'popup.tour.shortcutsTitle': 'すべてのキーボードショートカット',
  'popup.tour.shortcutsSubtitle': 'ポップアップはすべてキーボードで操作できます。',
  'popup.tour.pressLabel': 'いつでも',
  'popup.tour.shortcutsHint': 'を押すとすべてのショートカットが表示されます',
  'popup.tour.debugModeTitle': 'デバッグモード',
  'popup.tour.debugModeSubtitle': 'ブラウザーのライブトラフィックを完全に制御します。',
  'popup.tour.debugModeReqRes': 'リクエストとレスポンス',
  'popup.tour.debugModeReqResHint': '：ヘッダー、ボディ、ステータスコードをライブで書き換え',
  'popup.tour.debugModeStreams': 'WebSocket と SSE',
  'popup.tour.debugModeStreamsHint': '：ストリーミングメッセージの検査と編集',
  'popup.tour.debugModeScripts': 'スクリプトとストレージ',
  'popup.tour.debugModeScriptsHint': '：スクリプトの注入、Cookie とストレージの検査',
  'popup.tour.statusTitle': 'システムステータス',
  'popup.tour.statusSubtitle':
    'ドットをクリックすると、Sync、Rules、Requests、Permissions、Secrets、Live の各サブシステムの健全性の内訳が表示されます。',
  'popup.tour.statusGreen': '緑',
  'popup.tour.statusGreenDesc': '：すべて正常',
  'popup.tour.statusYellow': '黄',
  'popup.tour.statusYellowDesc': '：サブシステムが警告を報告中',
  'popup.tour.statusRed': '赤',
  'popup.tour.statusRedDesc': '：サブシステムが失敗',
  'popup.tour.growTitle': '成長にご協力ください',
  'popup.tour.growSubtitle': 'より多くの開発者に届くよう、成長にご協力ください。',
  'popup.tour.starGithub': 'GitHub でスターを付ける',
  'popup.tour.recommend': '友人や同僚に薦める',
  'popup.tour.growHint': 'これらはいつでもベルの下にあります。',

  // ── DevTools feature bullets (tour step 4 + Debug Network panel) ───
  'popup.devtools.featureModify': 'ヘッダー、リクエスト、レスポンスを変更',
  'popup.devtools.featureTabs': 'マルチタブのリクエストメタデータパネル',
  'popup.devtools.featureSearch': '高度な検索と絞り込み',
  'popup.devtools.featureDock': 'サイドバーパネルのドラッグ＆ドロップ',
  'popup.devtools.addOverride': '+ 追加/上書き',

  // ── Debug Network panel ────────────────────────────────────────────
  'popup.debug.title': 'ネットワークをデバッグ',
  'popup.debug.step1': 'ブラウザーの DevTools を開く',
  'popup.debug.step1a': '通常のページで。例：',
  'popup.debug.notPrefix': '不可：',
  'popup.debug.notSuffix': 'や新しいタブ（拡張機能はそこではブロックされます）。',
  'popup.debug.onPlatform': '{platform} では',
  'popup.debug.menuHintSafari':
    'まず「開発」メニューを有効にします。Safari → 設定 → 詳細 → 「Web 開発者向けの機能を表示」。',
  'popup.debug.clickThePrefix': 'クリック：',
  'popup.debug.clickTheSuffix': 'タブ',
  'popup.debug.overflowPrefix': '最後のタブです。',
  'popup.debug.overflowSuffix': 'オーバーフローメニューに隠れている場合があります。',
  'popup.debug.step3': 'デバッグを強力にする',
  'popup.debug.menuGlyphAria': '「表示」メニューを開く → 開発者 → デベロッパーツール',
  'popup.debug.tabGlyphAria':
    'Open Headers タブが選択された状態でドッキングされた DevTools。サイドバー、ネットワークリスト、マルチタブの分割ペイン',
  // Menu-glyph mock labels — the browser's own menu rows, which the
  // browser localizes, so the mock localizes with them.
  'popup.debug.menuGlyphDeveloper': '開発者',
  'popup.debug.menuGlyphDeveloperTools': 'デベロッパーツール',
} as const satisfies Catalog;
