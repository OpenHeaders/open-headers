/**
 * DevTools panel — request inspector shell + detail tabs — Japanese.
 * Mirrors `catalogs/en/panel-inspector.ts` key for key. Raw by design:
 * async stack labels (JS vocabulary), wire-shaped hover titles,
 * encoding names (Base64 / UTF-8), the detail section tab nouns
 * (Headers / Payload / … — host-panel parity vocabulary, the
 * panel-docs raw-quote precedent), Diff, and wire tokens (HEAD /
 * CONNECT / 204 No Content / Server-Timing). Mints: イニシエーター =
 * initiator (prose referent — the tab noun rides raw); カスケード =
 * cascade; コールスタック = call stack (スタックトレース stays the
 * fixed stack-trace compound); フレーム here = stack frame
 * (context-partitioned with the WebSocket referent in
 * panel-inspector-streams); 秘匿 = redact; 整形 = pretty print;
 * タイミング = timing prose; ヘッドオブラインブロッキング =
 * head-of-line blocking; 分割 = split carried from streams; Hex
 * ビューアー rides the ビューアー family; Mock rides raw (tag
 * precedent).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspector = {
  // ── Inspector detail empty states ────────────────────────────────────
  // The select prompt flanks an inline Network-panel glyph, so it keys
  // as prefix + suffix fragments.
  'panel.inspector.detailEmpty.requestGone':
    'リクエストはもう利用できません（クリアされたか、別のページへ移動しました）',
  'panel.inspector.detailEmpty.selectPrefix': '検査するには',
  'panel.inspector.detailEmpty.selectSuffix': 'Network パネルからリクエストを選択してください',
  'panel.inspector.detailEmpty.noSelection': '検査するキャプチャ済みリクエストを選択してください',

  // ── Inspector shell (editor tab bar + detail section tabs) ──────────
  // Raw by design: method badges, status codes, tab labels (URLs, storage
  // keys, cookie/cache identities), the IDB/SS/LS/CS chips, the wire-shaped
  // pill hover title, and the ▾ / ▼ / ▶ / × glyphs beside keyed values.
  'panel.inspector.tabBar.closeTab': 'タブを閉じる',
  'panel.inspector.tabBar.unsavedChanges': '未保存の変更',
  'panel.inspector.tabBar.searchTabs': 'タブを検索',
  'panel.inspector.tabBar.searchPlaceholder': 'タブを検索…',
  'panel.inspector.tabBar.noOpenTabs': '開いているタブはありません',
  'panel.inspector.tabBar.noOpenTabsMatch': '検索に一致する開いているタブはありません',
  'panel.inspector.tabBar.noClosedTabsMatch': '検索に一致する閉じたタブはありません',
  'panel.inspector.tabBar.recentlyClosed': '最近閉じたタブ（{count}）',
  'panel.inspector.tabBar.recentlyClosedFiltered': '最近閉じたタブ（{total} 件中 {matched} 件）',

  // Dirty-close confirm (useTabCloseGuard) — the body follows a bolded
  // tab label in the JSX, so it keys as the sentence remainder.
  'panel.inspector.tabBar.closeGuard.unsavedTitle': '変更を保存しますか？',
  'panel.inspector.tabBar.closeGuard.unsavedBody':
    'には未保存の変更があります。作業を失わないよう、これらの変更を保存してください。',
  'panel.inspector.tabBar.closeGuard.dontSave': '保存しない',
  'panel.inspector.tabBar.closeGuard.cancel': 'キャンセル',
  'panel.inspector.tabBar.closeGuard.save': '変更を保存',

  // Tab context menu. Direction words are split directions, not the
  // layout menu's alignment nouns — separate referents, separate keys.
  'panel.inspector.tabMenu.close': '閉じる',
  'panel.inspector.tabMenu.closeOther': '他のタブを閉じる',
  'panel.inspector.tabMenu.closeAll': 'すべてのタブを閉じる',
  'panel.inspector.tabMenu.closeToLeft': '左側のタブを閉じる',
  'panel.inspector.tabMenu.closeToRight': '右側のタブを閉じる',
  'panel.inspector.tabMenu.splitAndMove': '分割して移動',
  'panel.inspector.tabMenu.right': '右',
  'panel.inspector.tabMenu.left': '左',
  'panel.inspector.tabMenu.down': '下',
  'panel.inspector.tabMenu.up': '上',
  'panel.inspector.tabMenu.moveToOppositeGroup': '反対側のグループへ移動',
  'panel.inspector.tabMenu.changeSplitterOrientation': '分割の向きを変更',
  'panel.inspector.tabMenu.unsplit': '分割を解除',
  'panel.inspector.tabMenu.unsplitAll': 'すべての分割を解除',

  // Detail section tabs — keyed but glossary-protected on translator
  // handoff (host-panel tab nouns; ride raw in ja per the panel-docs
  // raw-quote precedent and the zh-CN sibling).
  'panel.inspector.sections.headers': 'Headers',
  'panel.inspector.sections.messages': 'Messages',
  'panel.inspector.sections.eventStream': 'EventStream',
  'panel.inspector.sections.payload': 'Payload',
  'panel.inspector.sections.preview': 'Preview',
  'panel.inspector.sections.response': 'Response',
  'panel.inspector.sections.initiator': 'Initiator',
  'panel.inspector.sections.timing': 'Timing',
  'panel.inspector.sections.cookies': 'Cookies',
  'panel.inspector.sections.rawData': 'Raw Data',

  // Override-body CTA — shared by the Response tab and the Preview tab
  // (same control, same rule target on both surfaces).
  'panel.inspector.overrideCta.editOverride': '上書きを編集',
  'panel.inspector.overrideCta.editOverrideTitle':
    'このレスポンスを生成したルールを編集します。変更は今後のリクエストに適用されます',
  'panel.inspector.overrideCta.overrideResponse': 'レスポンスを上書き',
  'panel.inspector.overrideCta.overrideResponseTitle':
    'このレスポンスを編集可能な Mock として提供するルールを作成します',
  'panel.inspector.overrideCta.editQueryParams': 'クエリパラメーターの上書きを編集',
  'panel.inspector.overrideCta.editQueryParamsTitle':
    'これらのクエリパラメーターを書き換えたルールを編集します。変更は今後のリクエストに適用されます',
  'panel.inspector.overrideCta.overrideQueryParams': 'クエリパラメーターを上書き',
  'panel.inspector.overrideCta.overrideQueryParamsTitle': 'これらのクエリパラメーターを書き換えるルールを作成します',
  'panel.inspector.overrideCta.editRequestBody': 'リクエストボディの上書きを編集',
  'panel.inspector.overrideCta.editRequestBodyTitle':
    'このリクエストボディを置き換えたルールを編集します。変更は今後のリクエストに適用されます',
  'panel.inspector.overrideCta.overrideRequestBody': 'リクエストボディを上書き',
  'panel.inspector.overrideCta.overrideRequestBodyTitle':
    'このリクエストボディを編集可能な静的ボディで置き換えるルールを作成します',

  // Dual-view controls (Response / Preview / Payload two-sided views).
  'panel.inspector.dualView.diff': 'Diff',
  'panel.inspector.dualView.fullResponse': 'レスポンス全体',
  'panel.inspector.dualView.fullRequest': 'リクエスト全体',
  'panel.inspector.dualView.swapSides': '左右を入れ替え',
  'panel.inspector.dualView.hideUnchanged': '変更なしを隠す',

  // Delivery-path pane captions for the two-sided views — phrased as
  // the delivery path; the server/page arrows ride raw inside the value.
  'panel.inspector.paneCaption.responseOriginal': '元 · サーバー → ページ',
  'panel.inspector.paneCaption.responseModified': '変更後 · サーバー → Open Headers → ページ',
  'panel.inspector.paneCaption.requestOriginal': '元 · ページ → サーバー',
  'panel.inspector.paneCaption.requestModified': '変更後 · ページ → Open Headers → サーバー',
  'panel.inspector.paneCaption.wsRecvDropped': '破棄 · ページには届いていません',
  'panel.inspector.paneCaption.wsSendDropped': '破棄 · サーバーには届いていません',

  // Body-state notices (Response tab + Preview tab twins). Wire vocab
  // (HEAD / CONNECT / status codes / WebSocket) rides raw inside values.
  'panel.inspector.bodyState.noResponseBodyTitle': 'レスポンスボディなし',
  'panel.inspector.bodyState.noPreviewTitle': 'プレビューはありません',
  'panel.inspector.bodyState.nothingToPreviewTitle': 'プレビューするものがありません',
  'panel.inspector.bodyState.noResponseDetail': 'このリクエストには利用できるレスポンスデータがありません',
  'panel.inspector.bodyState.failedTitle': 'レスポンスデータの読み込みに失敗しました',
  'panel.inspector.bodyState.emptyTitle': '（空のレスポンスボディ）',
  'panel.inspector.bodyState.emptyDetail': 'サーバーは空のボディを返しました。',
  'panel.inspector.bodyState.binaryPayloadBytes': 'バイナリペイロード（{count} バイト）。',
  'panel.inspector.bodyState.notApplicable.preflight': 'プリフライトリクエストには利用できるコンテンツがありません',
  'panel.inspector.bodyState.notApplicable.head': 'HEAD リクエストにレスポンスボディはありません',
  'panel.inspector.bodyState.notApplicable.connect': 'CONNECT リクエストにレスポンスボディはありません',
  'panel.inspector.bodyState.notApplicable.status204': 'コンテンツなし（204 No Content）',
  'panel.inspector.bodyState.notApplicable.status205': 'コンテンツなし（205 Reset Content）',
  'panel.inspector.bodyState.notApplicable.status304': '未変更。ボディはブラウザーのキャッシュから提供されました',
  'panel.inspector.bodyState.notApplicable.informational': 'コンテンツなし（情報レスポンス）',
  'panel.inspector.bodyState.notApplicable.websocket':
    'WebSocket 接続にアップグレードされました。Messages タブを参照してください',
  'panel.inspector.bodyState.unavailable.opaque':
    'レスポンスボディは利用できません。不透明なクロスオリジンレスポンスです',
  'panel.inspector.bodyState.unavailable.cache':
    'ボディは利用できません。DevTools を開く前にレスポンスがキャッシュから提供されました',
  'panel.inspector.bodyState.unavailable.redirect':
    'このリクエストはリダイレクトされたため、利用できるコンテンツがありません',
  'panel.inspector.bodyState.unavailable.unknown':
    'ボディはキャプチャされていません。ホストはコンテンツを返しませんでした。レスポンスはバッファリングなしでストリーミングされたか、キャッシュから提供されました。',

  // Preview tab's own chrome.
  'panel.inspector.preview.notAvailableForType': 'このコンテンツタイプのプレビューはありません。',
  'panel.inspector.preview.imageAlt': 'レスポンスのプレビュー',

  // Shared body-viewer toolbars. Raw by design: Base64 / UTF-8 encoding
  // names, keyboard chords, the { } pretty-print glyph, and the sniffer
  // format nouns (JSON / XML / …) riding through as {format}.
  'panel.inspector.viewer.prettyPrintTitle': '整形',
  'panel.inspector.viewer.revertTitle': '宣言された Content-Type に戻す',
  'panel.inspector.viewer.parsedAsRevert': '{format} として解析 · 戻す',
  'panel.inspector.viewer.looksLikeParse': '{format} のようです · 解析',
  'panel.inspector.viewer.looksLikeTitle':
    'Content-Type が正しくないようです。ボディは {format} として解析できます。クリックして再解釈します。',
  'panel.inspector.viewer.cursorInfo': '{line} 行、{col} 列',
  'panel.inspector.viewer.lineCount': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 行' }),
  'panel.inspector.viewer.hexViewer': 'Hex ビューアー',
  'panel.inspector.viewer.find': '検索',
  'panel.inspector.viewer.findTitle': '検索（{chord}）',

  // Payload tab chrome. The section titles carry the captured MIME raw.
  'panel.inspector.payload.queryStringParameters': 'クエリ文字列パラメーター',
  'panel.inspector.payload.requestBody': 'リクエストボディ（{mime}）',
  'panel.inspector.payload.viewSource': 'ソースを表示',
  'panel.inspector.payload.viewParsed': '解析結果を表示',
  'panel.inspector.payload.viewUrlEncoded': 'URL エンコード形式を表示',

  // ── Raw Data tab (inspector detail) — export-snippet band + raw HAR
  // band. Raw by design: the generated snippet text itself (paste-into-
  // terminal material), HAR / JSON / .har / HAR 1.2 format nouns riding
  // inside keyed values, and the technical tokens inside the format
  // option labels (cURL, bash, fetch, Node, Python requests,
  // Invoke-WebRequest). ────────────────────────────────────────────────
  'panel.inspector.rawData.exportSnippet': 'スニペットをエクスポート',
  'panel.inspector.rawData.formatLabel': '形式',
  'panel.inspector.rawData.copy': 'コピー',
  'panel.inspector.rawData.copied': 'コピーしました',
  'panel.inspector.rawData.rawHar': 'Raw HAR（JSON）',
  'panel.inspector.rawData.downloadHar': '.har をダウンロード',
  'panel.inspector.rawData.noRequestData': '（リクエストデータはまだありません）',
  'panel.inspector.rawData.view.label': '表示',
  'panel.inspector.rawData.view.includeHeaders': 'リクエストヘッダーを含める',
  'panel.inspector.rawData.view.includeBody': 'リクエストボディを含める',
  'panel.inspector.rawData.view.redactSecrets': 'シークレットを秘匿',
  'panel.inspector.rawData.view.ruleModifiedHeading': 'ルールが変更したヘッダー',
  'panel.inspector.rawData.view.postRule': 'ルール適用後（ワイヤー上）',
  'panel.inspector.rawData.view.original': '元（ルール適用前）',
  'panel.inspector.rawData.format.curlUnix': 'cURL (bash)',
  'panel.inspector.rawData.format.curlWindows': 'cURL (Windows)',
  'panel.inspector.rawData.format.fetchBrowser': 'JavaScript：fetch（ブラウザー）',
  'panel.inspector.rawData.format.fetchNode': 'JavaScript：fetch（Node）',
  'panel.inspector.rawData.format.pythonRequests': 'Python：requests',
  'panel.inspector.rawData.format.powershell': 'PowerShell：Invoke-WebRequest',
  'panel.inspector.rawData.format.httpRaw': 'HTTP：raw メッセージ',
  'panel.inspector.rawData.format.har': 'HAR：単一エントリ',
  // HAR (i) corpus — the title stays the raw format name (HAR 1.2).
  'panel.inspector.rawData.harInfo.kicker': '形式',
  'panel.inspector.rawData.harInfo.summary': '可搬な HTTP アーカイブ。1 つのリクエストの JSON スナップショットです。',
  'panel.inspector.rawData.harInfo.description':
    '保存してバグレポートに添付したり、チームメイトと共有したり、HAR ファイルを読める別のツールにインポートしたりできます。',

  // ── Initiator tab (inspector detail) — call stack, upstream chain,
  // downstream tree, cascade stats + insights. Raw by design: the
  // async-boundary section labels (`await in fn`, `Promise resolved
  // (async)` — JS vocabulary that also feeds the copied stack text),
  // `(anonymous)`, the `@` locator glyph, wire initiator-type values
  // (parser / script / other), filter grammar tokens riding inside the
  // keyed placeholder, the ▼ / ▶ toggles, and byte / ms figures. ──────
  'panel.inspector.initiator.noData': 'イニシエーターのデータはありません。',
  'panel.inspector.initiator.typeLabel': '種類：',
  'panel.inspector.initiator.stack.heading': 'リクエストのコールスタック',
  'panel.inspector.initiator.stack.frameCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} フレーム' }),
  'panel.inspector.initiator.stack.resolvedCount': '{count} 件解決済み',
  'panel.inspector.initiator.stack.resolvedTitle': '関数名はソースマップ経由で解決されました',
  'panel.inspector.initiator.stack.showHidden': ({ count }, locale) =>
    plural(locale, Number(count), { other: '非表示の {count} 件を表示' }),
  'panel.inspector.initiator.stack.hideNoisy': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'ノイズの {count} 件を隠す' }),
  'panel.inspector.initiator.stack.noiseTitle': 'ミニファイされたバンドル内の匿名フレームを隠す',
  'panel.inspector.initiator.stack.copyTitle': 'スタックをテキストとしてコピー',
  'panel.inspector.initiator.stack.copy': 'コピー',
  'panel.inspector.initiator.stack.copied': 'コピーしました',
  'panel.inspector.initiator.stack.filterPlaceholder': 'フレームを絞り込む（関数名または URL）…',
  'panel.inspector.initiator.stack.filterAria': 'コールスタックのフレームを絞り込む',
  'panel.inspector.initiator.stack.noMatch': '一致するフレームはありません。',
  'panel.inspector.initiator.stack.showing': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { other: '{count} フレーム' });
    return `${total}中 ${String(shown)} 件を表示中`;
  },
  'panel.inspector.initiator.stack.hiddenSuffix': '（{count} 件非表示）',
  'panel.inspector.initiator.stack.sourceMapNameTitle': 'ソースマップ名：{name}',
  'panel.inspector.initiator.stack.originalTitle': '{url}（元：{source}）',
  'panel.inspector.initiator.moreFilters.label': 'その他のフィルター',
  'panel.inspector.initiator.moreFilters.failuresOnly': '失敗のみ',
  'panel.inspector.initiator.moreFilters.thirdPartyOnly': 'サードパーティのみ',
  'panel.inspector.initiator.view.label': '表示',
  'panel.inspector.initiator.view.sort': '並べ替え',
  'panel.inspector.initiator.view.sortInitiator': 'イニシエーター順',
  'panel.inspector.initiator.view.sortChronological': '時系列',
  'panel.inspector.initiator.view.sortLargest': '最大のサブツリー',
  'panel.inspector.initiator.view.showSuggestions': '提案を表示',
  'panel.inspector.initiator.filterPlaceholder':
    'フィルター：テキスト、is:failed、is:third-party、type:js、status:404、size:>50kb',
  'panel.inspector.initiator.filterAria': 'イニシエーターチェーンを絞り込む',
  'panel.inspector.initiator.matchCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の一致' }),
  // Two sections share the English 'Request initiator chain' but are
  // separate referents: the upstream (ancestor) chain and the
  // downstream tree.
  'panel.inspector.initiator.upstreamChain': 'リクエストのイニシエーターチェーン',
  'panel.inspector.initiator.chainTree': 'リクエストのイニシエーターチェーン',
  'panel.inspector.initiator.collapse': '折りたたむ',
  'panel.inspector.initiator.expand': '展開',
  // Cascade stat strip — the bolded figures ride outside; the noun
  // declines with the count (markup-split plural, count not printed).
  'panel.inspector.initiator.cascade.requestsWord': ({ count }, locale) =>
    plural(locale, Number(count), { other: '件のリクエスト' }),
  'panel.inspector.initiator.cascade.transferred': '転送',
  'panel.inspector.initiator.cascade.cumulative': '累計',
  'panel.inspector.initiator.cascade.failed': '失敗',
  // Row chips (product classifier vocabulary, cookie-role precedent).
  'panel.inspector.initiator.chip.initiatorTypeTitle': 'イニシエーターの種類',
  'panel.inspector.initiator.chip.httpStatusTitle': 'HTTP ステータス',
  'panel.inspector.initiator.chip.requestFailedTitle': 'リクエスト失敗',
  'panel.inspector.initiator.chip.failed': '失敗',
  'panel.inspector.initiator.chip.transferredTitle': '転送量',
  'panel.inspector.initiator.chip.durationTitle': '所要時間',
  'panel.inspector.initiator.chip.thirdPartyTitle': 'サードパーティのオリジン',
  'panel.inspector.initiator.chip.thirdParty': 'サードパーティ',
  'panel.inspector.initiator.chip.subtreeTitle': 'サブツリーの重み（子孫 · バイト）',
  'panel.inspector.initiator.chip.subtree': '+{count} 件 · {bytes}',
  // Cascade insights (t-fed `computeCascadeInsights`). Hosts, byte
  // figures and percentages ride as raw holes.
  'panel.inspector.initiator.insights.failedHeadline': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'このカスケードで {count} 件のリクエストが失敗しています。' }),
  'panel.inspector.initiator.insights.failedHint': '広告ブロッカー、CSP ルール、CORS 設定を確認してください。',
  'panel.inspector.initiator.insights.hostHeadline': ({ host, count, bytes, percent }, locale) => {
    const loaded = plural(locale, Number(count), { other: '{count} 件のリクエストを読み込みました' });
    return `${String(host)} は ${loaded}（${String(bytes)}）。カスケードの重みの ${String(percent)}% です。`;
  },
  'panel.inspector.initiator.insights.hostHint':
    'このカスケードで最大の単一ホストです。可能ならセルフホストするか遅延させてください。',
  'panel.inspector.initiator.insights.thirdPartyHeadline': 'カスケードのバイトの {percent}% がサードパーティです。',
  'panel.inspector.initiator.insights.thirdPartyHint':
    '必須でないサードパーティは削減、遅延、またはセルフホストしてください。',

  // ── Timing tab (inspector detail) — the tab's OWN copy. Raw by
  // design (S34 parity-vocab lock): the eight rung names everywhere
  // (insight subjects, the open `Stalled:` step), the Server Timing
  // section name (header vocabulary), cache-source words (memory cache
  // / disk cache / service worker / miss — Size-column parity, and the
  // repeat section's cache-breakdown line with them), ms / s / B/s
  // figures on the Chrome scale, and protocol / priority / IP values. ─
  'panel.inspector.timing.noData': 'タイミングデータはありません。',
  'panel.inspector.timing.view.label': '表示',
  'panel.inspector.timing.view.showSuggestions': '提案を表示',
  'panel.inspector.timing.view.showContextStrip': 'コンテキストストリップを表示',
  'panel.inspector.timing.view.showPhaseBreakdown': 'フェーズの内訳を表示',
  'panel.inspector.timing.view.showTimingBar': 'タイミングバーを表示',
  'panel.inspector.timing.view.showServerTiming': 'Server-Timing を表示',
  'panel.inspector.timing.view.showRepeats': 'セッション内の繰り返しを表示',
  'panel.inspector.timing.view.showTransferRate': '転送速度を表示',
  // Insight headlines — the raw rung name is the bolded subject; the
  // keyed predicate joins it at the markup boundary (raw-label +
  // keyed-clause join, S34 idiom). Figures ride as raw holes.
  'panel.inspector.timing.insight.dominatesTail': 'がこのリクエストを支配しています。{ms}（合計の {percent}%）。',
  'panel.inspector.timing.insight.unusuallyHighTail': 'が異常に高くなっています。{ms}。',
  // Per-phase diagnosis (t-fed `findBottleneck` / `findWarnings`).
  'panel.inspector.timing.phase.queueing.what': 'リクエストスケジューラーがこのリクエストを保留しました',
  'panel.inspector.timing.phase.queueing.hint': '同時リクエストが多すぎてスロットを奪い合っているか、優先度が低い。',
  'panel.inspector.timing.phase.stalled.what': '利用可能な接続を待っています',
  'panel.inspector.timing.phase.stalled.hint':
    '接続プールの上限、プロキシのネゴシエーション、または HTTP/1.1 のヘッドオブラインブロッキング。',
  'panel.inspector.timing.phase.dns.what': 'DNS 解決',
  'panel.inspector.timing.phase.dns.hint':
    'このドメインへの最初のリクエストにのみ影響します。DNS プリフェッチを検討してください。',
  'panel.inspector.timing.phase.connect.what': 'サーバーとの TCP ハンドシェイク',
  'panel.inspector.timing.phase.connect.hint':
    '新しい接続。keep-alive または HTTP/2/3 の多重化なら、複数のリクエストで 1 つを再利用します。',
  'panel.inspector.timing.phase.ssl.what': 'TLS ハンドシェイク',
  'panel.inspector.timing.phase.ssl.hint': 'セッション再開 / 0-RTT（HTTP/3）で短縮されます。',
  'panel.inspector.timing.phase.send.what': 'リクエストボディをアップロード中',
  'panel.inspector.timing.phase.send.hint':
    'リクエストボディが大きいか、上りが遅い。通常は POST/PUT でのみ目立ちます。',
  'panel.inspector.timing.phase.wait.what': 'サーバーの最初のバイトまでの時間',
  'panel.inspector.timing.phase.wait.hint':
    'バックエンドの処理。Server-Timing や DB クエリログでバックエンドのタイミングを探してください。',
  'panel.inspector.timing.phase.receive.what': 'レスポンスペイロードをダウンロード中',
  'panel.inspector.timing.phase.receive.hint':
    'ペイロードのサイズか CDN のスループット。実効転送速度を確認してください。',
  // Context strip chips — labels keyed; cache / protocol / priority
  // values stay raw.
  'panel.inspector.timing.chip.protocol': 'プロトコル',
  'panel.inspector.timing.chip.connection': '接続',
  'panel.inspector.timing.chip.cache': 'キャッシュ',
  'panel.inspector.timing.chip.priority': '優先度',
  'panel.inspector.timing.chip.started': '開始',
  'panel.inspector.timing.chip.serverIp': 'サーバー IP',
  'panel.inspector.timing.chip.connectionReused': '再利用',
  'panel.inspector.timing.chip.connectionNew': '新規',
  'panel.inspector.timing.chip.openedBy': '{url} が開いた接続',
  'panel.inspector.timing.totalTime': '合計時間',
  'panel.inspector.timing.totalWhere': '（キュー投入 → 終了）',
  'panel.inspector.timing.caution': '注意：リクエストはまだ完了していません！',
  'panel.inspector.timing.queuedAt': 'キュー投入 {offset}',
  'panel.inspector.timing.startedAt': '開始 {offset}',
  'panel.inspector.timing.inProgress': '進行中…',
  'panel.inspector.timing.noDuration': '所要時間なし',
  'panel.inspector.timing.transferRate.heading': '転送速度',
  'panel.inspector.timing.transferRate.contentDownloaded': 'ダウンロード済みコンテンツ：',
  'panel.inspector.timing.transferRate.effectiveRate': '実効速度：',
  'panel.inspector.timing.transferRate.amount': '{size} を {duration} で',
  'panel.inspector.timing.repeats.heading': 'このセッション内の繰り返し',
  'panel.inspector.timing.repeats.hitCount': 'URL のヒット回数：',
  'panel.inspector.timing.repeats.fastestMedianSlowest': '最速 / 中央値 / 最遅：',
  'panel.inspector.timing.repeats.thisRequest': 'このリクエスト：',
  'panel.inspector.timing.repeats.slowestTag': '（最遅）',
  'panel.inspector.timing.repeats.fastestTag': '（最速）',
  'panel.inspector.timing.repeats.cacheBreakdown': 'キャッシュの内訳：',
  'panel.inspector.timing.repeats.url': 'URL：',
} as const satisfies Catalog;
