/**
 * DevTools panel — storage tool window — Japanese. Mirrors
 * `catalogs/en/panel-storage.ts` key for key. Raw by design: grid
 * column headers and their (i) titles (Key / Value / Name /
 * Domain · Path / Expires / Sec / Request / Method / Size / Time —
 * the S37 grid-header lock), the localStorage / sessionStorage API
 * globals, IndexedDB / Cache Storage platform names, the Storage
 * tool-window label in prose, example-card payloads, char / byte /
 * MB figures, the Key / Value input placeholders (they name their
 * raw columns), and data-plane not-sent reasons riding as holes.
 * Mints: エントリ = entry; オブジェクトストア = object store; レコード
 * = IndexedDB record; クォータ = quota (simulated limit) vs 使用量 =
 * usage (the nav section); フレーム = frame (page/iframe referent);
 * カーソル = cursor; インライン編集 = inline edit; 上限 = cap /
 * ceiling; 自動増分キー = auto-increment keys with out-of-line キー
 * riding the raw IDB term; Cookie ジャー and 下書き carried from the
 * shared register.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelStorage = {
  // ── Storage tool window — shell, grids, sections, quota card, footer
  // lines. ─────────────────────────────────────────────────────────────
  'panel.storage.nav.aria': 'ストレージの種類',
  'panel.storage.nav.local': 'ローカルストレージ',
  'panel.storage.nav.session': 'セッションストレージ',
  'panel.storage.nav.cookies': 'Cookies',
  'panel.storage.nav.indexeddb': 'IndexedDB',
  'panel.storage.nav.cachestorage': 'Cache Storage',
  'panel.storage.nav.quota': '使用量',
  'panel.storage.nav.badgeTitle': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 件の一致' }),
  'panel.storage.filterAria': 'ストレージエントリを絞り込む',
  'panel.storage.revealedHidden': '表示しようとした行は現在のフィルターにより隠れています',
  'panel.storage.addCookieTitle': 'ブラウザーの Cookie ジャーに Cookie を追加（HttpOnly を含む）',
  'panel.storage.addCookieAria': 'Cookie を追加',
  'panel.storage.addEntryTitle': 'エントリを追加',
  'panel.storage.addEntryAria': 'ストレージエントリを追加',
  'panel.storage.addReadOnly.indexeddb': 'IndexedDB はここでは読み取り専用です',
  'panel.storage.addReadOnly.cachestorage': 'Cache Storage はここでは読み取り専用です',
  'panel.storage.addReadOnly.quota': '使用量は読み取り専用です',
  'panel.storage.refreshTitle': '更新',
  'panel.storage.refreshAria': 'ストレージを更新',
  'panel.storage.originAria': 'ストレージのオリジン',
  'panel.storage.partitionedChip': 'パーティション化',
  'panel.storage.partitionedTitle':
    'パーティション化されたストレージ。ここにあるこのオリジンのデータは {site} をキーとして保存されています。\nストレージキー：{raw}',
  'panel.storage.partitionFallback': 'あるパーティション',
  // Count lines — shared by the scope note and the footer status line.
  'panel.storage.count.items': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 件のアイテム' }),
  'panel.storage.count.itemsOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { other: '{count} 件のアイテム' });
    return `${total}中 ${String(shown)} 件`;
  },
  'panel.storage.count.cookies': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 件の Cookie' }),
  'panel.storage.count.cookiesOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { other: '{count} 件の Cookie' });
    return `${total}中 ${String(shown)} 件`;
  },
  'panel.storage.count.databases': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のデータベース' }),
  'panel.storage.count.caches': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のキャッシュ' }),
  'panel.storage.count.quotaUsed': '{total} 中 {used} を使用',
  'panel.storage.count.sectionsMatch': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のセクションが一致' }),
  'panel.storage.note.writeFailed': '書き込み失敗',
  'panel.storage.note.deleteFailed': '削除失敗',
  'panel.storage.note.readFailed': '読み取り失敗。前回のデータを表示中',
  'panel.storage.note.truncated': 'リストは切り詰められています',
  // Clear gestures — whole-sentence per-section titles (no noun stitching).
  'panel.storage.clear.label.local': 'ローカルストレージをクリア',
  'panel.storage.clear.label.session': 'セッションストレージをクリア',
  'panel.storage.clear.label.cookies': 'Cookie をクリア',
  'panel.storage.clear.label.indexeddb': 'IndexedDB をクリア',
  'panel.storage.clear.label.cachestorage': 'Cache Storage をクリア',
  'panel.storage.clear.title.local': 'すべての localStorage エントリをクリア',
  'panel.storage.clear.title.session': 'すべての sessionStorage エントリをクリア',
  'panel.storage.clear.title.cookies': 'このサイトの Cookie ジャーにあるすべての Cookie をクリア',
  'panel.storage.clear.title.indexeddb': 'すべての IndexedDB データベースをクリア',
  'panel.storage.clear.title.cachestorage': 'すべてのキャッシュをクリア',
  'panel.storage.clear.armedTitle.local': 'このオリジンのすべての localStorage エントリを削除します',
  'panel.storage.clear.armedTitle.session': 'このオリジンのすべての sessionStorage エントリを削除します',
  'panel.storage.clear.armedTitle.cookies':
    'このサイトの Cookie ジャーにある、このオリジンのすべての Cookie を削除します',
  'panel.storage.clear.armedTitle.indexeddb': 'このオリジンのすべての IndexedDB データベースを削除します',
  'panel.storage.clear.armedTitle.cachestorage': 'このオリジンのすべてのキャッシュを削除します',
  'panel.storage.confirmClear': 'クリアしますか？',
  'panel.storage.confirmDelete': '削除しますか？',
  'panel.storage.confirmSuffixAria': '{action}。確定するにはもう一度クリックしてください',
  'panel.storage.cleared': '✓ クリアしました',
  'panel.storage.clearFailed': 'クリア失敗',
  // Empty / error states.
  'panel.storage.empty.loading': '読み込み中…',
  'panel.storage.empty.notAvailableTitle': 'ここではストレージの検査は利用できません',
  'panel.storage.empty.notAvailableSub': 'このホストは検査中のタブのアプリケーションストレージを公開していません。',
  'panel.storage.empty.noOriginsTitle': '検査できるオリジンがありません',
  'panel.storage.empty.noOriginsDomSub':
    'このタブには DOM ストレージを持つ http(s) フレームがありません。ブラウザー内部のページは検査できません。',
  'panel.storage.empty.noOriginsSub':
    'このタブには http(s) フレームがありません。ブラウザー内部のページは検査できません。',
  'panel.storage.empty.noOriginsCookiesSub':
    'このタブには http(s) フレームがありません。ブラウザー内部のページはサイト Cookie を持ちません。',
  'panel.storage.empty.unavailableTitle': 'ストレージを利用できません',
  'panel.storage.empty.unavailableSub':
    '{origin} のフレームは今は読み取れません。別のページへ移動した可能性があります。',
  'panel.storage.thisOrigin': 'このオリジン',
  'panel.storage.empty.noItems': '{origin} の {area} にアイテムはありません。',
  'panel.storage.empty.noItemsMatch': 'フィルターに一致するアイテムはありません。',
  'panel.storage.empty.cookiesUnavailableTitle': 'ここでは Cookie を利用できません',
  'panel.storage.empty.cookiesUnavailableSub': 'このホストはブラウザーの Cookie ジャーを公開していません。',
  'panel.storage.empty.noCookies': '{origin} の Cookie はありません。',
  'panel.storage.empty.noCookiesMatch': 'フィルターに一致する Cookie はありません。',
  // Jar cookie grid column headers — 'Domain · Path' carries the raw
  // attribute vocabulary inside the keyed value.
  'panel.storage.cookies.col.name': 'Name',
  'panel.storage.cookies.col.value': 'Value',
  'panel.storage.cookies.col.scope': 'Domain · Path',
  'panel.storage.cookies.col.sec': 'Sec',
  // DOM storage grid.
  'panel.storage.grid.col.key': 'Key',
  'panel.storage.grid.col.value': 'Value',
  'panel.storage.grid.keyPlaceholder': 'Key',
  'panel.storage.grid.valuePlaceholder': 'Value',
  'panel.storage.grid.aria': 'ストレージエントリ',
  'panel.storage.grid.clipped': '切り詰め（{length}）',
  'panel.storage.grid.editTitle': 'このエントリを編集',
  'panel.storage.grid.editAria': '{key} を編集',
  'panel.storage.grid.deleteTitle': 'このエントリを削除',
  'panel.storage.grid.deleteAria': '{key} を削除',
  'panel.storage.grid.newKeyAria': '新しいエントリのキー',
  'panel.storage.grid.newValueAria': '新しいエントリの値',
  'panel.storage.grid.keyAria': 'エントリのキー',
  'panel.storage.grid.valueAria': 'エントリの値',
  'panel.storage.grid.addSaveHint': '新しいエントリをストレージに書き込む',
  'panel.storage.grid.editSaveHint': '編集したエントリをストレージに書き戻す',
  'panel.storage.grid.emptyKeyHint': 'キーは空にできません',
  'panel.storage.grid.cancelTitle': 'キャンセル',
  'panel.storage.grid.cancelAddAria': '追加をキャンセル',
  'panel.storage.grid.cancelEditAria': '編集をキャンセル',
  'panel.storage.grid.tooLarge': '大きすぎてここでは編集できません。完全な値は編集の上限を超えています。',
  'panel.storage.grid.fetchFailed': '完全な値は今は読み取れません。',
  'panel.storage.grid.loadingFullValue': '完全な値を読み込み中…',
  'panel.storage.save.label': '保存',
  'panel.storage.save.noChanges': '保存する変更はありません',
  // Cookies section (jar grid rows).
  'panel.storage.cookieRow.notSentTitle': 'このページには送信されません。{reason}',
  'panel.storage.cookieRow.notSentAria': 'Cookie {name} はこのページに送信されません：{reason}',
  'panel.storage.cookieRow.partitionedUnder': '{key} の下にパーティション化',
  'panel.storage.cookieRow.editTitle': 'ブラウザーの Cookie ジャーでこの Cookie を編集',
  'panel.storage.cookieRow.editAria': 'Cookie {name} を編集',
  'panel.storage.cookieRow.deleteTitle': 'ブラウザーの Cookie ジャーからこの Cookie を削除',
  'panel.storage.cookieRow.deleteAria': 'Cookie {name} を削除',
  // IndexedDB section.
  'panel.storage.idb.cantReadTitle': 'IndexedDB を読み取れません',
  'panel.storage.idb.cantReadSub':
    'このフレームは今、データベースを公開していません。別のページへ移動した可能性があります。',
  'panel.storage.idb.noDatabases': 'このオリジンの IndexedDB データベースはありません。',
  'panel.storage.idb.versionTitle': 'データベースのバージョン {version}',
  'panel.storage.idb.storeCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のオブジェクトストア' }),
  'panel.storage.idb.metaKeyPath': 'キー：{path}',
  'panel.storage.idb.metaAutoIncrement': '自動増分キー',
  'panel.storage.idb.metaOutOfLine': 'out-of-line キー',
  'panel.storage.idb.indexCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のインデックス' }),
  'panel.storage.idb.deleteDbTitle': 'データベース {name} を削除',
  'panel.storage.idb.deleteDbConfirmTitle':
    '{name} とその中のすべてのオブジェクトストアを削除します。開いたままのページがあると削除はブロックされます',
  'panel.storage.idb.deleteDbAria': 'データベース {name} を削除',
  'panel.storage.idb.openStoreTitle': '{database} › {store} を開く',
  'panel.storage.idb.clearStoreTitle': '{store} のすべてのレコードをクリア',
  'panel.storage.idb.clearStoreConfirmTitle': '{database} › {store} のすべてのレコードを削除します',
  'panel.storage.idb.clearStoreAria': 'オブジェクトストア {store} をクリア',
  'panel.storage.idb.noStores': 'オブジェクトストアなし',
  'panel.storage.idb.backTitle': 'データベース一覧に戻る',
  'panel.storage.idb.cursorAria': 'レコードカーソル',
  'panel.storage.idb.cursorTitle':
    'いずれかのインデックス経由でオブジェクトストアを読み取ります。キー列はインデックスキーになります',
  'panel.storage.idb.primaryKeyOption': '主キー',
  'panel.storage.idb.indexOption': 'インデックス：{name}',
  'panel.storage.idb.noRecords': '{store} にレコードはありません。',
  'panel.storage.idb.noRecordsPage': 'このページの {store} にレコードはありません。',
  'panel.storage.idb.noRecordsMatch': 'フィルターに一致するレコードはありません。',
  'panel.storage.idb.gridAria': 'IndexedDB レコード',
  'panel.storage.idb.col.key': 'Key',
  'panel.storage.idb.col.value': 'Value',
  'panel.storage.idb.openRecordTitle': 'このレコードをエディターで開く',
  'panel.storage.idb.keyCellTitle': 'キー：{key}\n主キー：{primaryKey}',
  'panel.storage.idb.deleteRecordTitle': 'このレコードを削除',
  'panel.storage.idb.deleteRecordAria': 'レコード {key} を削除',
  'panel.storage.pager.prevTitle': '前のページ',
  'panel.storage.pager.nextTitle': '次のページ',
  'panel.storage.pager.page': '{page} ページ',
  // Cache Storage section.
  'panel.storage.cache.cantReadTitle': 'Cache Storage を読み取れません',
  'panel.storage.cache.cantReadSub':
    'この API はセキュアコンテキスト（https）にしか存在しません。または、このフレームは今は読み取れません。',
  'panel.storage.cache.noCaches': 'このオリジンのキャッシュはありません。',
  'panel.storage.cache.noCachesMatch': 'フィルターに一致するキャッシュはありません。',
  'panel.storage.cache.openTitle': 'キャッシュ {name} を開く',
  'panel.storage.cache.deleteTitle': 'キャッシュ {name} を削除',
  'panel.storage.cache.deleteConfirmTitle': '{name} とその中のすべてのエントリを削除します',
  'panel.storage.cache.deleteAria': 'キャッシュ {name} を削除',
  'panel.storage.cache.backTitle': 'キャッシュ一覧に戻る',
  'panel.storage.cache.noEntries': '{name} にエントリはありません。',
  'panel.storage.cache.noEntriesPage': 'このページの {name} にエントリはありません。',
  'panel.storage.cache.noEntriesMatch': 'フィルターに一致するエントリはありません。',
  'panel.storage.cache.gridAria': 'キャッシュエントリ',
  'panel.storage.cache.col.request': 'Request',
  'panel.storage.cache.col.method': 'Method',
  'panel.storage.cache.col.size': 'Size',
  'panel.storage.cache.col.time': 'Time',
  'panel.storage.cache.deleteEntryTitle': 'このエントリを削除',
  'panel.storage.cache.deleteEntryConfirmTitle':
    '保存されたレスポンスを削除します。確定するにはもう一度クリックしてください',
  'panel.storage.cache.deleteEntryAria': 'エントリ {url} を削除',
  // Usage (quota) section.
  'panel.storage.quota.cantReadTitle': '使用量を読み取れません',
  'panel.storage.quota.cantReadSub':
    'この API はセキュアコンテキスト（https）にしか存在しません。または、このフレームは今は読み取れません。',
  'panel.storage.quota.used': '{size} を使用',
  'panel.storage.quota.ofTotal': '{size} 中（{percent}%）',
  'panel.storage.quota.type.serviceWorkers': 'Service Worker',
  'panel.storage.quota.type.fileSystems': 'ファイルシステム',
  'panel.storage.quota.type.other': 'その他',
  'panel.storage.quota.noBreakdown': 'このオリジンの種類別の使用量は報告されていません。',
  'panel.storage.quota.debugHint': '種類別の内訳を見るにはデバッグモードを有効にしてください。',
  'panel.storage.quota.sessionNote': 'セッションストレージはタブごとです。これは検査中のタブのフレームをクリアします',
  'panel.storage.quota.targetsCaption': '「すべてクリア」の対象',
  'panel.storage.quota.targetsTitle':
    '「すべてクリア」（右上）は、このオリジンのチェックしたデータ種別だけを削除します',
  'panel.storage.quota.simulateLabel': 'カスタムクォータをシミュレート',
  'panel.storage.quota.simulateTitle':
    'このオリジンについて、ブラウザーにより小さいクォータを報告・適用させます。ストレージが尽きたときのページの挙動をテストするためのものです',
  'panel.storage.quota.simulateSave': '保存',
  'panel.storage.quota.simulateCancel': 'キャンセル',
  'panel.storage.quota.simulateReset': 'リセット',
  'panel.storage.quota.simulateResetTitle': 'シミュレートしたクォータを解除',
  'panel.storage.quota.simulateRange': '0–{max} MB を入力',
  'panel.storage.quota.simulateFailed': 'シミュレーション失敗',
  'panel.storage.quota.clearEverything': 'すべてクリア',
  'panel.storage.quota.clearArmedTitle': 'このオリジンのチェックしたデータ種別を削除します',
  'panel.storage.quota.clearTitle': 'このオリジンのチェックしたデータ種別をクリア',
  // Column (i) corpora — titles stay raw column nouns; kickers reuse
  // the nav keys; example payloads ride raw.
  'panel.storage.domCol.exampleCaption': '書き込みの例',
  'panel.storage.domCol.key.summary':
    'エントリの名前。大文字と小文字を区別する文字列で、このオリジンの {area} 内で一意です。既存のキーに書き込むと値が上書きされます。',
  'panel.storage.domCol.key.description':
    'ここでエントリの名前を変更すると、先に新しいキーを書き込み、その後で古いキーを削除します。書き込みに失敗しても元のエントリは失われません。',
  'panel.storage.domCol.value.summary':
    '保存されたペイロード。常に文字列で、ページは構造化データをシリアライズして（通常は JSON として）保持します。',
  'panel.storage.domCol.value.description':
    'グリッドは 1 行のプレビューを表示し、非常に長い値は切り詰めます。エントリを開くか編集すると全文を取得します。行をクリックするとエディタータブとして開き、ダブルクリック（または鉛筆）でインライン編集します。',
  'panel.storage.cookieCol.name.summary':
    'Cookie の識別子。ブラウザーは（name、domain、path）をキーにします。同じ名前でもスコープが異なれば別の Cookie です。',
  'panel.storage.cookieCol.name.description':
    '警告の三角は、検査中のページへのリクエストにブラウザーが付与しないサイトジャーの Cookie を示します。ホバーすると理由が表示されます（path が別の場所に限定、http では Secure 専用、サブドメインに限定など）。',
  'panel.storage.cookieCol.value.summary': 'Cookie のペイロード。ブラウザーが Cookie ヘッダーで送り返す内容です。',
  'panel.storage.cookieCol.value.description':
    '行をクリックすると、完全な値と解析済みビューを持つエディタータブとして Cookie が開きます。鉛筆でインライン編集します。',
  'panel.storage.cookieCol.scope.summary':
    'ブラウザーがこの Cookie を付与する場所。その Domain と、/ より狭い場合はその Path です。',
  'panel.storage.cookieCol.scope.description':
    'ドメイン全体の Cookie（先頭にドットを付けて保存）はサブドメインにも流れます。ホスト限定の Cookie はそのホストにだけ固定されます。path は接頭辞で、/api なら /api 配下のリクエストだけがそれを運びます。',
  'panel.storage.cookieCol.expires.summary':
    'ブラウザーがその Cookie を削除する時期。現在からの相対で表示されます。ホバーすると絶対日時が表示されます。',
  'panel.storage.cookieCol.expires.description':
    'Session は Expires / Max-Age がないことを意味します。セッション終了時にブラウザーが Cookie を破棄します。',
  'panel.storage.cacheCol.exampleCaption': 'エントリの例',
  // Fragment between the size and time tokens in the example card's
  // meta line ('1.2 kB · stored Jan 4 …').
  'panel.storage.cacheCol.exampleStored': '· 保存日時',
  'panel.storage.cacheCol.request.summary': '保存されたリクエストの URL。キャッシュが fetch を照合するキーです。',
  'panel.storage.cacheCol.request.description':
    '行にホバーすると、保存されたリクエストヘッダーの限定的なプレビューが追加されます。行をクリックすると保存されたレスポンスがエディタータブとして開きます。グリッドはメタデータだけを保持します。',
  'panel.storage.cacheCol.method.summary':
    '保存されたリクエストの HTTP メソッド。URL とともにキャッシュキーの一部です。',
  'panel.storage.cacheCol.method.description':
    'ほぼ常に GET です。Cache API は他のメソッドに対する put / add を拒否します。',
  'panel.storage.cacheCol.size.summary': '保存されたレスポンスのサイズ。その content-length ヘッダーから読み取ります。',
  'panel.storage.cacheCol.size.description':
    '「—」は保存されたレスポンスに content-length がないことを意味します。ボディ自体はエントリのエディタータブにあります。',
  'panel.storage.cacheCol.time.summary': 'レスポンスがキャッシュに保存された時刻。',
  'panel.storage.cacheCol.time.description':
    '接続されたタブでのみ導出できます。「—」はこのスコープではホストが読み取れなかったことを意味します。',
  'panel.storage.idbCol.exampleCaption': 'レコードの例',
  'panel.storage.idbCol.key.summary':
    '現在のカーソルにおけるレコードのキー。デフォルトはオブジェクトストアの主キーです。パンくずでインデックスを選ぶとそれ経由で読み取り、この列はインデックスキーになります。',
  'panel.storage.idbCol.key.description':
    '行にホバーすると両方のキー（カーソルキーと主キー）が表示されます。キーは数値、文字列、日付、またはそれらの配列です。',
  'panel.storage.idbCol.value.summary': 'レコードの構造化クローン値の 1 行プレビュー。ページ内でシリアライズされます。',
  'panel.storage.idbCol.value.description':
    '行をクリックすると、展開可能なツリーを持つエディタータブとして完全なレコードが開きます。グリッドはプレビューだけを保持します。',
  // Storage editor-tab documents. Shared doc chrome first (same control
  // across the four tabs); per-document copy keys separately even where
  // the English coincides (separate referents). Crumbs, status lines,
  // and localStorage/sessionStorage names stay raw.
  'panel.storage.doc.reveal': 'Storage で表示',
  'panel.storage.doc.refreshConfirm': '編集内容を破棄します。更新するにはもう一度クリックしてください',
  'panel.storage.doc.discardEdits': '編集を破棄',
  'panel.storage.doc.openMergeView': 'マージビューを開く',
  'panel.storage.doc.preview': 'プレビュー',
  'panel.storage.doc.source': 'ソース',
  'panel.storage.doc.formatAria': 'ソーステキストの形式',
  'panel.storage.doc.formatted': '整形',
  'panel.storage.doc.raw': 'Raw',
  'panel.storage.doc.formattedTitle': '読みやすく整形しています。保存は保存時の形式を保ちます',
  'panel.storage.doc.rawTitle': '保存されているそのままのテキスト',
  'panel.storage.doc.formatUnavailable': '整形ビューは JSON 形の値でのみ利用できます',
  'panel.storage.doc.formatInfoTitle': '整形ビュー',
  'panel.storage.doc.formatInfoSummary': '「整形」と「Raw」は、同じ保存テキストの 2 つのビューです。',
  'panel.storage.doc.formatInfoExampleCaption': '例：1 つの値、2 つのビュー',
  'panel.storage.doc.formatInfoModesHeading': 'モード',
  'panel.storage.doc.formatInfoFormattedDesc':
    '読むためのビューで、違いは空白だけです。編集は元の保存形式に再エンコードされ、保存はそのテキストを書き込みます。編集なしの保存は元のバイトをそのまま書き込みます。',
  'panel.storage.doc.formatInfoFormattedViewOnlyDesc':
    '読むためのビューで、違いは空白だけです。このドキュメントは読み取り専用で、「整形」が保存されたバイトを変えることはありません。',
  'panel.storage.doc.formatInfoRawDesc': '保存されているそのままのバイトです。',
  'panel.storage.doc.unavailableSub': '削除されたか、フレームが今は読み取れない可能性があります。更新で再試行します。',
  'panel.storage.doc.clippedSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '…（あと {count} 文字）' }),
  // Cookie document.
  'panel.storage.doc.cookie.saveFailed.collision':
    '同じ名前、ドメイン、パスの Cookie がすでに存在します。保存するとそれを上書きします。別の識別子を選んでください。',
  'panel.storage.doc.cookie.saveFailed.write':
    '保存に失敗しました。ブラウザーの Cookie ジャーが書き込みを拒否しました。',
  'panel.storage.doc.cookie.saveFailed.remove':
    '新しい Cookie は書き込まれましたが、元の Cookie を削除できませんでした。両方が存在しています。更新するとジャーを再読み込みします。',
  'panel.storage.doc.cookie.saveHint': '編集した Cookie をブラウザーの Cookie ジャーに書き戻す',
  'panel.storage.doc.cookie.blockedHint': 'フォームが不完全か、参照が解決できません',
  'panel.storage.doc.cookie.refreshTitle': 'Cookie を再読み込み',
  'panel.storage.doc.cookie.refreshAria': 'Cookie を更新',
  'panel.storage.doc.cookie.revealTitle': 'Storage ツールウィンドウで Cookies を開く',
  'panel.storage.doc.cookie.readOnlyNote':
    'このホストの Cookie ジャーは読み取り専用です。ドキュメントはジャーの内容を反映しますが、書き戻せません。',
  'panel.storage.doc.cookie.goneNote':
    'この Cookie はブラウザーで削除されました。未保存の編集は保持されています。保存すると書き戻します。',
  'panel.storage.doc.cookie.unavailableTitle': 'Cookie はもうジャーにありません',
  'panel.storage.doc.cookie.unavailableSub':
    '削除または期限切れになったか、このホストではジャーを読み取れない可能性があります。更新で再試行します。',
  // DOM storage entry document.
  'panel.storage.doc.dom.saveFailed.collision':
    'そのキーのエントリはすでに存在します。保存するとそれを上書きします。別のキーを選んでください。',
  'panel.storage.doc.dom.saveFailed.gone':
    'エントリに到達できません。削除された可能性があります。更新すると再確認します。',
  'panel.storage.doc.dom.saveFailed.quota':
    '保存に失敗しました。ストレージのクォータを超えました。元のエントリは変更されていません。',
  'panel.storage.doc.dom.saveFailed.write': '保存に失敗しました。書き込みが拒否されました。',
  'panel.storage.doc.dom.modeAria': 'エントリの表示モード',
  'panel.storage.doc.dom.previewTitle': '解析した値の折りたたみ可能なツリー',
  'panel.storage.doc.dom.previewNeedsJson': 'プレビューには JSON 値が必要です',
  'panel.storage.doc.dom.sourceTitle': 'Raw 値ビュー',
  'panel.storage.doc.dom.saveHint': '編集したエントリをストレージに書き戻す',
  'panel.storage.doc.dom.blockedHint': 'キーは空にできません',
  'panel.storage.doc.dom.refreshTitle': 'エントリを再読み込み',
  'panel.storage.doc.dom.refreshAria': 'エントリを更新',
  'panel.storage.doc.dom.revealTitle': 'Storage ツールウィンドウで {area} を開く',
  'panel.storage.doc.dom.keyLabel': 'Key',
  'panel.storage.doc.dom.keyAria': 'エントリのキー',
  'panel.storage.doc.dom.conflictNote': '編集中に、ブラウザー側で値が変わりました。',
  'panel.storage.doc.dom.mergeToast': 'マージを下書きに適用しました。保存するとブラウザーに書き込みます',
  'panel.storage.doc.dom.goneNote':
    'このエントリはブラウザーで削除されました。未保存の編集は保持されています。保存すると書き戻します。',
  'panel.storage.doc.dom.unavailableTitle': 'エントリはもう利用できません',
  'panel.storage.doc.dom.tooLargeTitle': '大きすぎて開けません',
  'panel.storage.doc.dom.tooLargeSub': '値はエディターの上限を超えており、読み取り専用のままです。',
  'panel.storage.doc.dom.previewAria': 'エントリ値のツリー',
  // IndexedDB record document.
  'panel.storage.doc.idb.saveFailed.parse': '有効な JSON ではありません。構文を修正してもう一度保存してください。',
  'panel.storage.doc.idb.saveFailed.keyChanged':
    'キーが変わりました。保存すると新しいレコードが作られます。元のキーに戻してください。',
  'panel.storage.doc.idb.saveFailed.gone':
    'レコードに到達できません。削除された可能性があります。更新すると再確認します。',
  'panel.storage.doc.idb.saveFailed.write': '保存に失敗しました。書き込みが拒否されました。',
  'panel.storage.doc.idb.modeAria': 'レコードの表示モード',
  'panel.storage.doc.idb.previewTitle': 'レコード値の折りたたみ可能なツリー',
  'panel.storage.doc.idb.previewNeedsDoc': 'プレビューには整形式のドキュメントが必要です',
  'panel.storage.doc.idb.sourceTitle': 'ドキュメント全体のソースビュー',
  'panel.storage.doc.idb.saveHint': '編集した値をレコードに書き戻す',
  'panel.storage.doc.idb.refreshTitle': 'レコードを再読み込み',
  'panel.storage.doc.idb.refreshAria': 'レコードを更新',
  'panel.storage.doc.idb.revealTitle': 'Storage ツールウィンドウで {database} › {store} を開く',
  'panel.storage.doc.idb.truncatedNote': 'サイズ上限で切り詰められています。読み取り専用です。',
  'panel.storage.doc.idb.nonJsonNote':
    'JSON 以外の型（Date、Map、バイナリなど）を含みます。読み取り専用の表示として示しています。',
  'panel.storage.doc.idb.conflictNote': '編集中に、ブラウザー側でレコードが変わりました。',
  'panel.storage.doc.idb.mergeToast': 'マージを下書きに適用しました。保存するとレコードに書き込みます',
  'panel.storage.doc.idb.goneNote':
    'このレコードはブラウザーで削除されたか、形が変わりました。未保存の編集は保持されています。保存すると書き戻します。',
  'panel.storage.doc.idb.unavailableTitle': 'レコードはもう利用できません',
  'panel.storage.doc.idb.previewAria': 'レコード値のツリー',
  // Cache Storage entry document (read-only; delete is the only mutation).
  'panel.storage.doc.cache.deleteTitle': 'このエントリをキャッシュから削除',
  'panel.storage.doc.cache.deleteConfirmTitle':
    '保存されたレスポンスを削除します。確定するにはもう一度クリックしてください',
  'panel.storage.doc.cache.deleteAria': 'キャッシュエントリを削除',
  'panel.storage.doc.cache.refreshTitle': '保存されたレスポンスを再読み込み',
  'panel.storage.doc.cache.refreshAria': 'キャッシュエントリを更新',
  'panel.storage.doc.cache.revealTitle': 'Storage ツールウィンドウでキャッシュ {cache} を開く',
  'panel.storage.doc.cache.deleteFailed': '削除に失敗しました。エントリはすでに存在しない可能性があります。',
  'panel.storage.doc.cache.unavailableTitle': 'キャッシュエントリはもう利用できません',
  'panel.storage.doc.cache.truncatedNote': 'ボディはサイズ上限で切り詰められています。保存サイズは {size} です。',
  'panel.storage.doc.cache.headersSummary': 'レスポンスヘッダー（{count}）',
  'panel.storage.doc.cache.filterPlaceholder': 'ヘッダーを絞り込む',
  'panel.storage.doc.cache.filterAria': 'レスポンスヘッダーを絞り込む',
  'panel.storage.doc.cache.noHeaders': 'ヘッダーは保存されていません。',
  'panel.storage.doc.cache.noHeadersMatch': 'フィルターに一致するヘッダーはありません。',
  'panel.storage.doc.cache.bodySummary': 'レスポンスボディ',
  'panel.storage.doc.cache.imageAria': '保存された画像ボディ',
  'panel.storage.doc.cache.imageAlt': '{url} の保存されたレスポンスボディ',
  'panel.storage.doc.cache.binaryBody': 'バイナリボディ。保存サイズは {size} です。',
  'panel.storage.doc.cache.emptyBody': '空のボディです。',
} as const satisfies Catalog;
