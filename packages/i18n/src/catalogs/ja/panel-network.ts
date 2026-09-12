/**
 * DevTools panel — traffic table plane — Japanese. Mirrors
 * `catalogs/en/panel-network.ts` key for key. Parity vocabulary stays
 * raw (S34 lock): column names, waterfall metric names + ST/RT/ET/TD/L
 * tags, the eight timing rung names, terminal outcome labels,
 * 'Connection Start', wire vocabulary (GET, 2xx, h2, net::ERR_…, csp),
 * cURL / fetch / HAR, `n/a`, and every µs/ms/s figure. Mints:
 * ウォーターフォール = waterfall (prose — the column name stays raw);
 * キュー = queue; キュー投入 = queued; 未追跡ギャップ = untracked gaps;
 * ウォームソケット = warm socket; 主要な瞬間 = key moments; band
 * names スケジューリング / 接続 / 転送; 合成行 = synthesized row;
 * キャプチャ忠実度ギャップ = capture-fidelity gap; レベル = sort
 * level; 最終タイブレーク = tiebreak; サニタイズ済み = sanitized;
 * 注釈 = row annotation (rail); 矛盾 = contradicted (carried);
 * 未到達 = the rung state with この時点に未到達 = the instant-tick
 * referent (separate referents); デバッグモードの保留 = debug-mode
 * hold; システムプロキシ = System Proxy.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelNetwork = {
  // ── Network tool window — header chrome + menus (station: traffic
  // menus) ─────────────────────────────────────────────────────────────
  // Raw by design (network-table parity vocabulary): the column names
  // (Name / Status / Type / … / Waterfall) everywhere they appear —
  // header cells, the column-visibility menu rows, the nested-sort
  // builder options, the closed-state sort subtitles — and the Waterfall
  // metric names (Start time / Response time / End time / Total duration
  // / Latency) plus their header tags (ST / RT / ET / TD / L). The menu
  // chrome AROUND them localizes; the vocabulary itself does not.
  'panel.network.filterSyntaxHelp': 'フィルター構文のヘルプ',
  'panel.network.aboutTypeFilters': 'リクエスト種別フィルターについて',
  'panel.network.aboutSorting': '並べ替えについて',

  // ── Remote capture — consent refusal ────────────────────────────────
  'panel.capture.watchRefused.title': 'このブラウザーではライブ表示がオフになっています',
  'panel.capture.watchRefused.body':
    'このブラウザーの Open Headers 拡張機能は、デスクトップアプリによるトラフィック、ストレージ、コンソールの閲覧を許可していません。ここで観察するには、拡張機能の設定で「デスクトップアプリにこのブラウザーの閲覧を許可」をオンにしてください。',

  // Traffic table cells — resolved once per locale into the CellMessages
  // bundle (the row render loop is hot and never calls t() itself).
  'panel.network.cell.workerGearTitle': 'オリジンの Service Worker が発行したリクエスト',
  'panel.network.cell.jumpToPreflight': 'プリフライトリクエストへ移動',
  'panel.network.cell.selectPreflightInitiator': 'このプリフライトを開始したリクエストを選択',
  'panel.network.cell.pendingTitle': 'リクエストはまだ完了していません',
  'panel.network.cell.pending': '保留中',
  'panel.network.gridAria': 'ネットワークリクエスト',
  'panel.network.noMatches': '一致するリクエストはありません。',
  'panel.network.reloadPage': 'ページを再読み込み',
  'panel.network.startRecording': '記録を開始',

  // View ▾ menu
  'panel.network.view.label': '表示',
  'panel.network.view.layout': 'レイアウト',
  'panel.network.view.layoutCompact': 'コンパクト',
  'panel.network.view.layoutWide': 'ワイド',
  'panel.network.view.valueNumber': '数値',
  'panel.network.view.showValue': '数値を表示',
  'panel.network.view.valuesAlways': '常に',
  'panel.network.view.valuesHover': 'ホバー時',
  'panel.network.view.valuesOff': 'オフ',
  'panel.network.view.valueFormat': '数値の形式',
  'panel.network.view.formatRelative': '相対',
  'panel.network.view.formatTimestamp': 'タイムスタンプ',
  'panel.network.view.timezone': 'タイムゾーン',
  'panel.network.view.tzLocal': 'ローカル',
  'panel.network.view.tzUtc': 'UTC',
  'panel.network.view.explainValue': '数値を説明',
  'panel.network.view.explainValueTitle': 'ホバーのポップオーバーで、合計を構成する行を強調し、その和を表示します。',
  'panel.network.view.popover': 'ポップオーバー',
  'panel.network.view.popoverTitle':
    'ホバー時のタイミング内訳の向き。「自動」はパネル幅で選びます。広ければ横、狭ければ縦です。',
  'panel.network.view.popoverAuto': '自動',
  'panel.network.view.popoverCompact': 'コンパクト',
  'panel.network.view.popoverWide': 'ワイド',
  'panel.network.view.showFireDots': 'ルール発火ドットを表示',

  // Sort ▾ menu
  'panel.network.sort.label': '並べ替え',
  'panel.network.sort.heading': '並べ替え順',
  'panel.network.sort.byTime': '時間で並べ替えます。',
  'panel.network.sort.groupPriority': '優先度',
  'panel.network.sort.groupPriorityHint': '先に注意が必要なもの。',
  'panel.network.sort.groupGrouping': 'グループ化',
  'panel.network.sort.groupGroupingHint': 'カテゴリごとにリクエストをまとめます。',
  'panel.network.sort.ascending': '昇順',
  'panel.network.sort.descending': '降順',
  'panel.network.sort.customNested': 'カスタム（ネスト）',
  'panel.network.sort.customNestedIdle': '複数キーの並べ替え。列ごとに設定します。',
  'panel.network.sort.customNestedLevels': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} レベル。開いて編集します。' }),
  'panel.network.sort.noLevelsYet': 'レベルはまだありません。ビルダーを開いてください。',
  'panel.network.sort.builderTitle': '並べ替えのキー（順に）',
  'panel.network.sort.builderEmpty': 'レベルはまだありません。下で追加してください。',
  'panel.network.sort.asc': '昇順',
  'panel.network.sort.desc': '降順',
  'panel.network.sort.removeLevel': 'レベル {n} を削除',
  'panel.network.sort.addLevel': '+ レベルを追加',
  'panel.network.sort.finalTiebreak': '最終タイブレーク：開始時刻',
  'panel.network.sort.active': '有効',
  'panel.network.sort.apply': '適用',
  'panel.network.sort.columnClick': 'カスタム（列クリック）',
  'panel.network.sort.columnClickIdle': '列ヘッダーをクリックすると、その列で並べ替えます。',
  'panel.network.sort.columnClickUse': 'これを使うには列ヘッダーをクリックしてください',

  // Named sort modes (OH product vocabulary, not browser parity)
  'panel.network.sortMode.failures': '失敗を先頭に',
  'panel.network.sortMode.failuresSubtitle': '失敗 → 保留中 → リダイレクト → 成功 · 各グループ内は開始時刻順。',
  'panel.network.sortMode.slowest': '最も遅いものを先頭に',
  'panel.network.sortMode.slowestSubtitle': '所要時間が長い順 · 同点時は開始時刻でウォーターフォールの順序を保ちます。',
  'panel.network.sortMode.largest': '最も大きいものを先頭に',
  'panel.network.sortMode.largestSubtitle': 'ワイヤー上のバイト数が大きい順 · 同点内は開始時刻順。',
  'panel.network.sortMode.browserPriority': 'ブラウザーの優先度',
  'panel.network.sortMode.browserPrioritySubtitle':
    'ブラウザーが報告する優先度で Highest → Lowest · 各グループ内は開始時刻順。',
  'panel.network.sortMode.byType': 'リソース種別順',
  'panel.network.sortMode.byTypeSubtitle':
    'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · 各グループ内は開始時刻順。',
  'panel.network.sortMode.byDomain': 'ドメイン順',
  'panel.network.sortMode.byDomainSubtitle': 'ホスト名でグループ化（A → Z）· 各ドメイン内は開始時刻順。',
  'panel.network.sortMode.ruleModified': 'ルールで変更されたものを先頭に',
  'panel.network.sortMode.ruleModifiedSubtitle': 'ルール適用済み → 推定 → 発火なし · 各グループ内は開始時刻順。',

  // Waterfall sort submenu subtitles (the metric names above them stay raw)
  'panel.network.sortMetric.startTime': 'リクエストが開始した時刻。',
  'panel.network.sortMetric.responseTime': '最初のレスポンスバイトが到着した時刻。',
  'panel.network.sortMetric.endTime': 'リクエストが完了した時刻。',
  'panel.network.sortMetric.duration': 'かかった時間。バーはゼロ揃えです。',
  'panel.network.sortMetric.latency': '最初のバイトまでの時間。バーはゼロ揃えです。',

  // The two OH-native rails (also the rail-header popover titles)
  'panel.network.railFires': 'ルール発火',
  'panel.network.railAnnotations': '注釈',

  // Row context menu (menu-local keys; cURL / fetch / HAR ride raw)
  'panel.requestMenu.openInNewTab': '新しいタブで開く',
  'panel.requestMenu.createApiRequest': 'API リクエストを作成',
  'panel.requestMenu.copy': 'コピー',
  'panel.requestMenu.copyUrl': 'URL をコピー',
  'panel.requestMenu.copyAsCurl': 'cURL としてコピー',
  'panel.requestMenu.copyAsFetch': 'fetch としてコピー',
  'panel.requestMenu.copyRequestHeaders': 'リクエストヘッダーをコピー',
  'panel.requestMenu.copyResponseHeaders': 'レスポンスヘッダーをコピー',
  'panel.requestMenu.copyResponse': 'レスポンスをコピー',
  'panel.requestMenu.copyAsHar': 'HAR としてコピー',
  'panel.requestMenu.copyAsHarSanitized': 'HAR としてコピー（サニタイズ済み）',
  'panel.requestMenu.copyAllUrls': 'すべての URL をコピー',
  'panel.requestMenu.copyAllAsCurl': 'すべてを cURL としてコピー',
  'panel.requestMenu.copyAllAsHar': 'すべてを HAR としてコピー',
  'panel.requestMenu.copyAllAsHarSanitized': 'すべてを HAR としてコピー（サニタイズ済み）',
  'panel.requestMenu.blockRequests': 'リクエストをブロック',
  'panel.requestMenu.blockUrl': 'このリクエスト URL をブロック',
  'panel.requestMenu.blockDomain': 'このリクエストドメインをブロック',
  'panel.requestMenu.saveAs': '名前を付けて保存…',
  'panel.requestMenu.saveThisAsHar': 'これを HAR として保存',
  'panel.requestMenu.saveThisAsHarSanitized': 'これを HAR として保存（サニタイズ済み）',
  'panel.requestMenu.saveAllAsHar': 'すべてを HAR として保存',
  'panel.requestMenu.saveAllAsHarSanitized': 'すべてを HAR として保存（サニタイズ済み）',

  // Filter-strip `(i)` corpora (pill vocabulary rides raw in the labels)
  'panel.network.typeInfo.title': 'リクエストの種類',
  'panel.network.typeInfo.summary':
    'リストを 1 つ以上のリクエスト種別に絞り込みます。「All」はすべてを表示します。種別を選んで絞り込むか、複数を組み合わせます。',
  'panel.network.typeInfo.inlineHeading': 'インライン',
  'panel.network.typeInfo.fetchXhrDesc': 'API 呼び出し。fetch() と XMLHttpRequest です。',
  'panel.network.typeInfo.socketDesc': 'WebSocket 接続。',
  'panel.network.typeInfo.underMoreHeading': 'More の下',
  'panel.network.typeInfo.docCssJsDesc': 'ドキュメント、スタイルシート、スクリプト。',
  'panel.network.typeInfo.fontImgMediaDesc': 'フォント、画像、音声 / 動画。',
  'panel.network.typeInfo.manifestWasmOtherDesc': 'Web アプリマニフェスト、WebAssembly、その他すべて。',
  'panel.network.sortInfo.summary':
    'リクエスト一覧の並び順を選びます。グループにホバーして具体的なモードを選択します。',
  'panel.network.sortInfo.modesHeading': 'モード',
  'panel.network.sortInfo.waterfallDesc': '時間で。開始、レスポンス、終了、所要時間、またはレイテンシ。',
  'panel.network.sortInfo.priorityDesc': '先に注意が必要なもの。失敗、最も遅い、最も大きい。',
  'panel.network.sortInfo.groupingDesc': '種別、ドメイン、またはルール変更でまとめます。',
  'panel.network.sortInfo.custom': 'カスタム',
  'panel.network.sortInfo.customDesc': '列ヘッダーをクリックするか、複数キーのネストした並べ替えを組み立てます。',

  // Network column `(i)` corpora. Titles are the raw column names
  // (they name the raw header cells); item labels are wire vocabulary
  // (GET, 2xx, h2, (pending), net::ERR_…, csp, ST/RT/…) and ride raw;
  // the kicker reuses the tool-window label key.
  'panel.network.colInfo.exampleCaption': 'リクエストの例',
  'panel.network.colInfo.name.summary':
    'リソースのファイル名または最後のパスセグメント。行を見分ける最も速い手がかりです。',
  'panel.network.colInfo.name.description':
    '先頭のアイコンはリソース種別を表します。行のツールチップと詳細ビューには、完全な URL、ヘッダー、ペイロード、タイミングがあります。',
  'panel.network.colInfo.path.summary': 'ホストより後のすべて。URL のパスとそのクエリ文字列です。',
  'panel.network.colInfo.url.summary': '完全なリクエスト URL。スキーム、ホスト、パス、クエリの端から端まで。',
  'panel.network.colInfo.requestNumber.summary':
    '記録中にリクエストが見つかった順に割り当てられる安定した番号。1 から始まります。',
  'panel.network.colInfo.requestNumber.description':
    '並べ替えても決して変わらないため、元のキャプチャ順への参照としても使えます。',
  'panel.network.colInfo.method.summary': 'リクエストが使った HTTP 動詞。',
  'panel.network.colInfo.method.commonVerbsHeading': 'よく使う動詞',
  'panel.network.colInfo.method.getDesc': 'リソースの読み取り。ボディなしで、安全に繰り返せます。',
  'panel.network.colInfo.method.postDesc': '作成または送信。リクエストボディを持ちます。',
  'panel.network.colInfo.method.putPatchDesc': 'リソースの置換または部分更新。',
  'panel.network.colInfo.method.deleteDesc': 'リソースの削除。',
  'panel.network.colInfo.status.summary':
    'HTTP レスポンスコード（例：200、404）、またはコードがないときの短い状態ラベル。',
  'panel.network.colInfo.status.description':
    'ステータスの範囲は色分けされません。本当の失敗（ワイヤーエラー、4xx/5xx、CORS の拒否）は行全体を赤くします。キャッシュヒットやステータスのない行はセルをグレーに落とします。理由句（例：「Not Found」）はセルのツールチップにあります。',
  'panel.network.colInfo.status.codeRangesHeading': 'コードの範囲',
  'panel.network.colInfo.status.s2xxDesc': '成功。リクエストは受信され処理されました（例：200 OK）。',
  'panel.network.colInfo.status.s3xxDesc': 'リダイレクト。Location ヘッダーに従って次の URL へ。',
  'panel.network.colInfo.status.s4xxDesc': 'クライアントエラー。リクエストが不正、未認可、または見つかりません。',
  'panel.network.colInfo.status.s5xxDesc': 'サーバーエラー。有効なリクエストをサーバーが処理できませんでした。',
  'panel.network.colInfo.status.insteadHeading': 'コードの代わりに',
  'panel.network.colInfo.status.pendingDesc': '送信済みですが、まだレスポンスが届いていません。処理中はグレーです。',
  'panel.network.colInfo.status.failedDesc':
    'ワイヤーレベルの失敗（DNS、TLS、タイムアウト、接続断）。ネットスタックのコードがインラインで表示されます。',
  'panel.network.colInfo.status.canceledDesc': 'リクエストは完了前に中止されました。',
  'panel.network.colInfo.status.blockedDesc':
    'ブラウザーがポリシー上の理由で拒否しました。例：csp、または拡張機能 / 広告ブロックによる other。',
  'panel.network.colInfo.status.corsDesc': 'クロスオリジンの検査がレスポンスを拒否しました。',
  'panel.network.colInfo.status.dataDesc': 'data: URL。インラインで提供され、ネットワークには一切出ません。',
  'panel.network.colInfo.status.finishedDesc': 'ステータスコードを持たないレスポンス。',
  'panel.network.colInfo.protocol.summary': '接続がネゴシエートした HTTP バージョン。ハンドシェイク時に決まります。',
  'panel.network.colInfo.protocol.valuesHeading': '値',
  'panel.network.colInfo.protocol.http11Desc': 'テキストベースで、接続ごとに同時 1 リクエスト。',
  'panel.network.colInfo.protocol.h2Desc': 'HTTP/2。バイナリで、単一接続上で多重化されます。',
  'panel.network.colInfo.protocol.h3Desc': 'HTTP/3。UDP 上の QUIC で動作し、ハンドシェイクが速くなります。',
  'panel.network.colInfo.scheme.summary': 'URL のスキーム。`https`、`http`、`ws`、または `wss`。',
  'panel.network.colInfo.domain.summary': 'リクエストの宛先のホスト名。',
  'panel.network.colInfo.remoteAddress.summary': '接続が実際に到達した IP アドレスとポート。',
  'panel.network.colInfo.remoteAddress.description':
    'DNS が複数の IP を返す、CDN が anycast でルーティングする、ローカルプロキシが接続を傍受する、といった場合にドメインと異なります。',
  'panel.network.colInfo.type.summary':
    'ブラウザーが割り当てたリソース種別。行のアイコンとテーブル上部のフィルターチップを決めます。',
  'panel.network.colInfo.type.examplesHeading': '例',
  'panel.network.colInfo.type.documentDesc': 'トップレベルまたはフレーム内の HTML ナビゲーション。',
  'panel.network.colInfo.type.fetchXhrDesc': 'JavaScript から行われたデータリクエスト。',
  'panel.network.colInfo.type.scriptCssDesc': 'パーサーが読み込むページリソース。',
  'panel.network.colInfo.type.imgFontMediaDesc': '静的アセット。',
  'panel.network.colInfo.initiator.summary': 'リクエストが送られる原因となったもの。',
  'panel.network.colInfo.initiator.kindsHeading': '種類',
  'panel.network.colInfo.initiator.scriptDesc': 'JavaScript から発火。セルは呼び出し元にリンクします。',
  'panel.network.colInfo.initiator.parserDesc':
    'HTML パーサーがリソースを見つけました（`<script>`、`<img>`、`<link>` など）。',
  'panel.network.colInfo.initiator.redirectDesc': '`3xx` レスポンスがブラウザーをここへ送りました。',
  'panel.network.colInfo.initiator.otherDesc': 'ナビゲーション、プリロード、または帰属できないソース。',
  'panel.network.colInfo.cookies.summary':
    'ブラウザーが `Cookie` ヘッダーでリクエストに付けた Cookie の数。ない場合は空です。',
  'panel.network.colInfo.setCookies.summary': 'レスポンスが返した `Set-Cookie` ヘッダーの数。ない場合は空です。',
  'panel.network.colInfo.setCookies.description':
    'リクエストの Cookies タブを開くと、ブラウザーがそれぞれを受け入れたか破棄したかがわかります。',
  'panel.network.colInfo.size.summary':
    'ワイヤーを通ったバイト数。レスポンスヘッダーと圧縮のオーバーヘッドを含みます。',
  'panel.network.colInfo.size.insteadHeading': '数値の代わりに',
  'panel.network.colInfo.size.diskCacheDesc': 'ディスクキャッシュから提供。ネットワークには何も出ていません。',
  'panel.network.colInfo.size.memoryCacheDesc': '現在のページのメモリ内キャッシュから提供。',
  'panel.network.colInfo.size.pendingDesc': 'リクエストはまだ完了していません。',
  'panel.network.colInfo.time.summary':
    'リクエスト送信から最後のレスポンスバイトまでの実働時間。キュー待ちの時間は除きます。',
  'panel.network.colInfo.time.description':
    '即時レスポンスは `0 ms` と表示されます。リクエストが処理中の間は空のままです。',
  'panel.network.colInfo.priority.summary': 'ブラウザーが割り当てた取得優先度。`Highest` から `Lowest` まで。',
  'panel.network.colInfo.priority.description':
    '優先度の高いリソースは先に要求され、接続をより多く割り当てられます。ページは `fetchpriority` 属性で調整できます。',
  'panel.network.colInfo.waterfall.summary':
    'リクエストごとのタイムラインバー。ヘッダーメニューで指標を選び、`Waterfall (ST)` のような短いタグで示します。',
  'panel.network.colInfo.waterfall.metricTagsHeading': '指標タグ',
  'panel.network.colInfo.waterfall.stDesc': 'Start time。各リクエストの開始時刻で共有タイムライン上に並びます。',
  'panel.network.colInfo.waterfall.rtDesc': 'Response time。最初のレスポンスバイトが届いた時刻で配置します。',
  'panel.network.colInfo.waterfall.etDesc': 'End time。各リクエストの完了時刻で配置します。',
  'panel.network.colInfo.waterfall.tdDesc':
    'Total duration。ゼロ揃えのバーを、リクエスト全体の所要時間で長さ決めします。',
  'panel.network.colInfo.waterfall.lDesc': 'Latency。ゼロ揃えのバーを、レスポンス開始点で分割します。',

  // OH-native rail header popovers (the ● / ⚠ / ℹ glyphs ride raw)
  'panel.network.fireRail.summary': 'ドットは、ルールが作用した各リクエストを示します。',
  'panel.network.fireRail.dotColorsHeading': 'ドットの色',
  'panel.network.fireRail.appliedDesc':
    '適用済み。ルールエンジンがルールの実行を確認した、ページ内レポーターがアクションの実行を確認した、またはキャプチャしたヘッダーで変更が確認できます。',
  'panel.network.fireRail.inferredDesc': '推定。ルールは一致しましたが、このリクエストでは適用を検証できません。',
  'panel.network.fireRail.contradictedDesc':
    '矛盾。ルールが主張したヘッダー変更を、キャプチャしたヘッダーが否定しています。',
  'panel.network.annotationRail.summary':
    '列が示す以上に OpenHeaders が知っていることを示します。グリフにホバーすると説明が、クリックすると詳細が開きます。',
  'panel.network.annotationRail.glyphsHeading': 'グリフ',
  'panel.network.annotationRail.warnDesc': 'この行は見かけどおりではありません。例：ダウンロード途中で中断された転送。',
  'panel.network.annotationRail.infoDesc': '出所や忠実度の文脈。未完了、キャプチャギャップ、合成行。',

  // ── Timing plane (waterfall popovers + ladder legend + Timing tab) ──
  // Raw by design: the eight rung names (Queueing / Stalled / DNS Lookup
  // / TCP / TLS / Request sent / Waiting for server / Content Download —
  // browser Timing-tab parity), the terminal outcome labels mirroring
  // the Status cell ((canceled), (blocked:…), CORS error, (failed)
  // net::ERR_…), the Connection Start section name, and every µs/ms/s
  // figure. The OH-invented band names, absent-step reasons, key-moment
  // narrative, and footnote sentences key.
  'panel.network.timing.band.beforeWire': 'スケジューリング',
  'panel.network.timing.band.connecting': '接続',
  'panel.network.timing.band.exchange': '転送',
  'panel.network.timing.where.beforeWire': '（ブラウザー）',
  'panel.network.timing.where.connecting': '（ブラウザー ↔ ネットワーク）',
  'panel.network.timing.where.exchange': '（ネットワーク）',
  'panel.network.timing.absent.reused': '接続を再利用',
  'panel.network.timing.absent.notReached': '未到達',
  'panel.network.timing.absent.na': 'n/a',
  'panel.network.timing.absent.unknown': 'データなし',
  'panel.network.timing.warmSocketTitle':
    'このリクエストの時計上に TCP ハンドシェイクはありません。ソケットはすでに確立済みでした（おそらく事前接続）。ここでは TLS だけが実行されました。',
  'panel.network.timing.warmSocketHint': 'ウォームソケット',
  'panel.network.timing.moment.queued': 'キュー投入',
  'panel.network.timing.moment.started': '開始',
  'panel.network.timing.moment.response': 'レスポンス',
  'panel.network.timing.moment.ended': '終了',
  'panel.network.timing.momentWhy.queued': 'リクエスト作成',
  'panel.network.timing.momentWhy.started': 'キューを離脱',
  'panel.network.timing.momentWhy.response': '最初のバイト（TTFB）',
  'panel.network.timing.momentWhy.ended': '最後のバイト、完了',
  'panel.network.timing.untrackedGaps': '未追跡ギャップ：{parts}',
  'panel.network.timing.chromeEquivalent':
    'Chrome 相当：Initial connection = TCP {tcp} + TLS {tls} = {total}（SSL はその内側に描画）',
  'panel.network.timing.terminalDetail.noResponse': 'レスポンスを受信せず',
  'panel.network.timing.terminalDetail.neverReached': 'ネットワークに到達せず',
  'panel.network.timing.keyMoments': '主要な瞬間',
  'panel.network.timing.sinceFirstRequest': '（最初のリクエストから）',
  'panel.network.timing.timingNotes': 'タイミングの注記',
  'panel.network.timing.totalTime': '合計時間',
  'panel.network.timing.queuedToEnded': '（キュー投入 → 終了）',
  'panel.network.timing.connectionOpenedBy': '↳ 接続を開いたのは {name}',
  'panel.network.timing.notFinishedCaution': '注意：リクエストはまだ完了していません！',
  'panel.network.timing.queuedAt': 'キュー投入 {time}',
  'panel.network.timing.startedAt': '開始 {time}',
  // Separate referent from the rung-state 'not reached': this one marks an
  // instant tick a terminal request never got to.
  'panel.network.timing.tickNotReached': 'この時点に未到達',
  'panel.network.timing.onTheWire': '🌐 ワイヤー上',
  'panel.network.timing.cdpExplainer':
    '実行中の完全な接続内訳を得るには、CDP を有効にして、ナビゲーションの前に再読み込みしてください。',

  // Timing `(i)` corpora. Rung / terminal titles stay raw (they name the
  // raw rung rows and Status-cell labels); band, moment, key-moments, and
  // notes titles reuse the keys of the labels they name.
  'panel.network.rungInfo.kicker': 'タイミング',
  'panel.network.rungInfo.kickerBrowser': 'タイミング · ブラウザー',
  'panel.network.rungInfo.kickerBrowserNetwork': 'タイミング · ブラウザー ↔ ネットワーク',
  'panel.network.rungInfo.kickerNetwork': 'タイミング · ネットワーク',
  'panel.network.rungInfo.kickerInstant': 'タイミング · 瞬間',
  'panel.network.rungInfo.kickerOutcome': 'タイミング · 結果',
  'panel.network.rungInfo.stripCaption': 'リクエストの例。端から端まで {ms} ms',
  'panel.network.rungInfo.stripStop': 'マーク：リクエストが止まった場所。それ以降のフェーズは実行されていません',
  'panel.network.rungInfo.stripMarked': 'マーク：{ms} ms 時点の {label}',
  'panel.network.rungInfo.stripGaps': '強調：未追跡ギャップ（3 + 4 ms）',
  'panel.network.rungInfo.stripHighlighted': '強調：{segs}（{ms} ms）',
  'panel.network.rungInfo.queueing.summary': '開始を許可される前に、リクエストがブラウザー内で待った時間。',
  'panel.network.rungInfo.queueing.description':
    'ブラウザーは、優先度の低いリソースのリクエストを後回しにし、優先度の高いものを先に読み込み、ディスクキャッシュを確認する間も待たせます。HTTP/1.x では、そのホストへのソケットがすべて使用中のときもここで待ちます。',
  'panel.network.rungInfo.stalled.summary':
    '開始は許可されましたが、ネットワーク作業を始める前に使える接続を待っています。',
  'panel.network.rungInfo.stalled.description':
    '通常はソケットが空くのを待つか、プロキシの判断を待っています。最初のネットワークステップ（DNS、TCP、または送信）が始まった瞬間に終わります。',
  'panel.network.rungInfo.dns.summary': '接続先のホスト名を IP アドレスに解決します。',
  'panel.network.rungInfo.dns.description':
    'リクエストが既存の接続に乗った場合は「接続を再利用」と表示されます。このリクエストの時計上では名前解決は不要でした。',
  'panel.network.rungInfo.connect.summary': 'TCP ハンドシェイクのみ。サーバーへのソケットを開く往復です。',
  'panel.network.rungInfo.connect.description':
    'Chrome の Timing タブは、これと TLS ハンドシェイクの両方にまたがる 1 本の「Initial connection」バーを描きます（SSL バーはその内側）。当方はそれらを重ならない別々のフェーズに分け、すべてのミリ秒がちょうど 1 回だけ数えられるようにしています。ここでの TCP + TLS は Chrome の Initial connection バーに等しくなります。',
  'panel.network.rungInfo.ssl.summary': 'TLS ハンドシェイク。鍵をネゴシエートし証明書を検証して、接続を暗号化します。',
  'panel.network.rungInfo.ssl.description':
    'https:// リクエストのみ（素の http:// では n/a）。「接続を再利用」は、以前のリクエストが同じソケットでこのコストをすでに払ったことを意味します。',
  'panel.network.rungInfo.send.summary': 'リクエストのバイト（ヘッダーとボディ）をワイヤーに送り出します。',
  'panel.network.rungInfo.send.description':
    'ヘッダーだけのリクエストでは通常 1 ミリ秒をはるかに下回ります。大きなアップロードでは増えます。',
  'panel.network.rungInfo.wait.summary':
    '最後のリクエストバイト送信から最初のレスポンスバイト受信まで（最初のバイトまでの時間）。',
  'panel.network.rungInfo.wait.description':
    'サーバーの処理時間とネットワーク往復 1 回分。バックエンドの作業が現れるフェーズです。',
  'panel.network.rungInfo.receive.summary': 'レスポンスボディのダウンロード。最初のバイトから最後のバイトまで。',
  'panel.network.rungInfo.receive.description':
    'レスポンスがまだストリーミング中なら、ライブで増えます。チャート下の注意行は、完了しなかったダウンロードを示します。',
  'panel.network.rungInfo.notes.summary':
    'フェーズ間のわずかな時間の帳簿。端から端までは記録されていますが、どのフェーズにも属しません。',
  'panel.network.rungInfo.notes.description':
    '各フェーズは自身の開始と終了の瞬間の間で測られ、合計は端から端まで測られます。そのため、2 つのフェーズの間に小さな「未追跡ギャップ」が入ることがあります（例：DNS の応答到着と TCP ハンドシェイク開始の間）。フェーズの和が常に合計と一致しないのはこのためです。Chrome の Timing タブにも同じギャップがあり、単に描かれていないだけです。当方はすべてのミリ秒の出所が分かるように、それらを列挙します。',
  'panel.network.rungInfo.notes.linesHeading': '各行',
  'panel.network.rungInfo.notes.gapsLabel': '未追跡ギャップ',
  'panel.network.rungInfo.notes.gapsDesc': '各ギャップを前後のフェーズで名付け、その所要時間を添えます。',
  'panel.network.rungInfo.notes.chromeLabel': 'Chrome 相当',
  'panel.network.rungInfo.notes.chromeDesc':
    '当方が分割した TCP + TLS のフェーズが、Chrome の単一の「Initial connection」バーにどう対応するか（SSL バーはそのバーの後ではなく内側に描かれます）。',
  'panel.network.rungInfo.band.beforeWire.summary':
    'ネットワーク作業の前に、完全にブラウザー内で費やされた時間。まだ何もマシンから出ていません。',
  'panel.network.rungInfo.band.beforeWire.description':
    'Queueing（開始許可の待機）と Stalled（使える接続の待機）。ここが重いリクエストは、優先度、接続数の上限、プロキシの判断といったローカル要因に足止めされています。サーバーのせいではありません。',
  'panel.network.rungInfo.band.connecting.summary':
    'サーバーへの経路を用意します。名前を解決し、ソケットを開き、暗号化します。',
  'panel.network.rungInfo.band.connecting.description':
    'DNS Lookup + TCP + TLS。ハンドシェイクの往復です。接続ごとに 1 回だけ払います。既存のソケットに乗るリクエストはこのバンド全体を飛ばします（「接続を再利用」）。',
  'panel.network.rungInfo.band.exchange.summary':
    'ワイヤー上の実際のやり取り。リクエストを送り、サーバーを待ち、レスポンスをダウンロードします。',
  'panel.network.rungInfo.band.exchange.description':
    'Request sent + Waiting for server（TTFB）+ Content Download。サーバー側の遅さは Waiting に、大きなレスポンスや遅い回線は Content Download に現れます。',
  'panel.network.rungInfo.moment.queued.summary':
    'ブラウザーがリクエストを作成した瞬間。この内訳のすべてのフェーズが測り始めるゼロ点です。',
  'panel.network.rungInfo.moment.queued.description':
    '時刻の値は表示中の最初のリクエストからのオフセットなので、各行を 1 つの共有時計で比べられます。',
  'panel.network.rungInfo.moment.started.summary': 'リクエストがキューを離れ、実際に作業が始まった瞬間。',
  'panel.network.rungInfo.moment.started.description':
    'キュー投入 + Queueing。このマークより前はすべてブラウザーのスケジューリング、後はリクエストが実際に進んでいる時間です。',
  'panel.network.rungInfo.moment.response.summary': '最初のレスポンスバイトが届いた瞬間（最初のバイトまでの時間）。',
  'panel.network.rungInfo.moment.response.description':
    'サーバーが応答しました。ここからボディのダウンロードです。レスポンスがまったく届かなかった場合（先にブロックまたは失敗）はありません。',
  'panel.network.rungInfo.moment.ended.summary': '最後のレスポンスバイトが届いた瞬間。リクエストは完了です。',
  'panel.network.rungInfo.moment.ended.description':
    '終了 − キュー投入が内訳の下に示す合計時間、終了 − 開始が Time 列に示す実働時間です。',
  'panel.network.rungInfo.keyMoments.summary': 'リクエストの一生の境界となる瞬間。ある段階が次へ引き継ぐ場所です。',
  'panel.network.rungInfo.keyMoments.description':
    'キュー投入と開始は常に存在します。レスポンスと終了は、実際にレスポンスが届いた場合にのみ存在します（先にブロックまたは失敗したリクエストは、代わりに結果のマーカーを示します）。下のフェーズはこれらの瞬間の間の区間です。',
  'panel.network.rungInfo.terminal.whereHeading': '止まった場所',
  'panel.network.rungInfo.terminal.noResponseDesc': 'ネットワークには到達しましたが、応答は戻ってきませんでした。',
  'panel.network.rungInfo.terminal.neverReachedDesc':
    'ブラウザー側のスケジューリング中に終わりました。何も送信されていません。',
  'panel.network.rungInfo.terminal.canceled.summary':
    'リクエストは完了前に中止されました。✗ が止まった場所を示し、それ以降のフェーズは実行されていません。',
  'panel.network.rungInfo.terminal.canceled.description':
    '典型的な原因：読み込み途中でページが別の場所へ遷移した、スクリプトが fetch を中止した、ユーザーが読み込みを止めた。ネットワークに問題はなく、ブラウザーが応答を待つのをやめただけです。',
  'panel.network.rungInfo.terminal.blocked.summary':
    'ブラウザーがポリシー上の理由でリクエストを拒否しました。コロンの後の語がどのポリシーかを示します。',
  'panel.network.rungInfo.terminal.stoppedHere': '✗ が止まった場所を示します。それ以降のフェーズは実行されていません。',
  'panel.network.rungInfo.terminal.blocked.reasonsHeading': 'よくある理由',
  'panel.network.rungInfo.terminal.blocked.cspDesc': 'ページの Content-Security-Policy がこの宛先を禁止しています。',
  'panel.network.rungInfo.terminal.blocked.mixedContentDesc': 'https:// ページ上の安全でない http:// リソース。',
  'panel.network.rungInfo.terminal.blocked.otherDesc':
    '拡張機能、広告ブロッカー、またはブラウザー内部のルールが拒否しました。',
  'panel.network.rungInfo.terminal.cors.summary':
    'クロスオリジンの検査がレスポンスを拒否しました。サーバーは応答しましたが、ページには読み取りが許可されませんでした。',
  'panel.network.rungInfo.terminal.cors.description':
    'クロスオリジンのページがレスポンスを読むには、サーバーが Access-Control-Allow-Origin（と関連ヘッダー）で許可する必要があります。✗ が拒否の起きた場所を示します。',
  'panel.network.rungInfo.terminal.failed.summary':
    'ワイヤーレベルの失敗。接続そのものが切れ、net:: コードが正確な原因を示します。',
  'panel.network.rungInfo.terminal.failed.codesHeading': 'よくあるコード',
  'panel.network.rungInfo.terminal.failed.nameNotResolvedDesc': 'DNS がホストを見つけられませんでした。',
  'panel.network.rungInfo.terminal.failed.connectionRefusedDesc': 'サーバーがソケットを拒否または切断しました。',
  'panel.network.rungInfo.terminal.failed.timedOutDesc': 'ネットワークスタックの制限時間内に応答がありませんでした。',
  'panel.network.rungInfo.terminal.failed.certDesc': 'TLS 証明書の検証に失敗しました。',

  // ── OH row annotations — one classifier, one copy family (traffic
  // rail glyph popover + Headers-tab insight cards). The rail is a hot
  // row loop: copy resolves once per locale via
  // `buildRowAnnotationMessages(t)` threaded through the stable cell
  // context — never `t()` in the row body. The popover kicker is the
  // raw brand mark. ───────────────────────────────────────────────────
  'panel.rowAnnotations.alsoOnThisRow': 'この行にはほかにも',
  'panel.rowAnnotations.openDetails': '詳細を開く',
  'panel.rowAnnotations.interrupted.label': '転送が中断',
  'panel.rowAnnotations.interrupted.detail':
    'ダウンロードは完了前にキャンセルされました。ステータスは中断前に届いたヘッダーを反映し、受信データは不完全です。それ以外の点で、この行は完了した行と区別がつきません。',
  'panel.rowAnnotations.neverFinished.label': '未完了',
  'panel.rowAnnotations.neverFinished.detail':
    'このリクエストを発行したページが処理中にアンロードされたため、結果は一切記録されませんでした。Status と Time が「(unknown)」と表示されるのはそのためです。',
  'panel.rowAnnotations.fidelityGap.label': 'キャプチャ忠実度ギャップ',
  'panel.rowAnnotations.fidelityGap.detail':
    '完了しなかったリクエストについては、転送バイト数とレスポンスボディはデフォルトのキャプチャ経路からは見えません。CDP 拡張の検査ならそれらを記録します。',
  'panel.rowAnnotations.syntheticHar.label': '合成行',
  'panel.rowAnnotations.syntheticHar.detail':
    'この行は、ライブのリクエストと結び付かなかったキャプチャレコードから再構成されたため、一部の列を埋められません。',
  'panel.rowAnnotations.syntheticMemory.label': '合成行',
  'panel.rowAnnotations.syntheticMemory.detail':
    'この行はページの Resource Timing から再構成されました（メモリキャッシュのヒットはネットワークスタックに到達しません）。そのため、ヘッダーと Cookie は利用できません。',
  'panel.rowAnnotations.debugPaused.label': 'デバッグモードの保留',
  'panel.rowAnnotations.debugPaused.detail':
    'この行の時間のうち {ms} ms は、サーバーやネットワークを待っていたのではなく、デバッグモードの傍受で一時停止していた時間です。デバッグモードは検査の間リクエストを保留したため、この行の合計時間はリクエスト自体にかかった時間より長くなっています。',
  'panel.rowAnnotations.queryParamRewrite.label': 'クエリパラメーターの書き換え',
  'panel.rowAnnotations.queryParamRewrite.detail':
    'このリダイレクトはサーバーではなく、Open Headers がクエリパラメータールールを適用したものです。URL のクエリ文字列の書き換えは内部リダイレクトとして行われるため、独立したホップとして表示されます。その後リクエストは、メソッド、ボディ、Cookie、ヘッダーをそのまま引き継いで書き換え後の URL へ進みます。',
  'panel.rowAnnotations.redirectRule.label': 'リダイレクトルール',
  'panel.rowAnnotations.redirectRule.detail':
    'このリダイレクトはサーバーではなく、Open Headers がリダイレクトルールを適用したものです。内部リダイレクトとして行われるため、リクエストが書き換え後の URL へ進む前に、元のリクエストが独立したホップとして表示されます。',
  'panel.rowAnnotations.systemProxyJoined.label': 'システムプロキシと結合',
  'panel.rowAnnotations.systemProxyJoined.detail':
    'このやり取りはシステムプロキシ（ローカルプロキシ）でもキャプチャされました。そのキャプチャによるワイヤー上の正確なヘッダー、実測サイズ、ソケットのタイミングが、ブラウザーキャプチャに記録のない部分を補います。',
  'panel.rowAnnotations.systemProxySeen.label': 'ブラウザータブでも観測',
  'panel.rowAnnotations.systemProxySeen.detail':
    'この傍受したやり取りは、ブラウザータブ {tab} でも観測されました。2 つの行は同じリクエストを両側から見たものです。',
  'panel.rowAnnotations.systemProxySeen.unknownTab': '監視中のタブ',
  'panel.rowAnnotations.systemProxySeen.jump': 'タブのソースで表示',
} as const satisfies Catalog;
