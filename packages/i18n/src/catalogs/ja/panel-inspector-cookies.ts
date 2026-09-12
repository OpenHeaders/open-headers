/**
 * DevTools panel — inspector Cookies tab — Japanese. Mirrors
 * `catalogs/en/panel-inspector-cookies.ts` key for key. Raw by
 * design: cookie names/values, Set-Cookie attribute names as titles
 * and field labels (Name / Value / Domain / Path / Expires / SameSite
 * / HttpOnly / Secure / Host-only), the parity-shaped column headers,
 * the `COOKIE_SAME_SITE_LABELS` round-trip vocabulary (Unspecified /
 * None (cross-site) / Lax / Strict — rendered AND parsed, never
 * convert one side alone), the literal `Session`, `__Host-` /
 * `__Secure-` prefixes, role chips (auth? / tracking? / pref), format
 * nouns, and byte figures. Mints: On/Off projection = オン/オフ
 * (round-trip, both sides); 破棄/拒否 split — the browser 拒否
 * (rejects) a Set-Cookie, the dropped chip reads 破棄; サードパーティ
 * = third-party; パーティション化 = partitioned carried; ジャー = jar
 * carried; 役割 = role (classifier); プレフィックス = prefix. Prefix
 * prose leads with a word（__Host- プレフィックス付きの Cookie）—
 * never a compound onto the raw token. DevTools path quotes Chrome's
 * own ja UI（アプリケーション → Cookie）.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorCookies = {
  // ── Cookies tab (inspector detail) ──────────────────────────────────
  'panel.inspector.cookies.filterPlaceholder':
    'フィルター：テキスト、name:sess、is:secure、is:samesite-none、is:problem、is:third-party、…',
  'panel.inspector.cookies.filterAria': 'Cookie を絞り込む',
  'panel.inspector.cookies.empty': '送受信された Cookie はありません。',

  // Table column headers. Set-Cookie attribute tokens (Domain / Path /
  // Expires / SameSite / HttpOnly / Secure) are glossary vocabulary and
  // stay raw where they label a column alone. Section headers localize
  // via the existing section.responseCookies/requestCookies keys — the
  // `label` prop stays the raw identifier.
  'panel.inspector.cookies.col.name': 'Name',
  'panel.inspector.cookies.col.value': 'Value',
  'panel.inspector.cookies.col.scope': 'Scope',
  'panel.inspector.cookies.col.size': 'Size',
  'panel.inspector.cookies.col.sec': 'Sec',

  // Footprint strip — independent clauses joined with raw ' · '.
  'panel.inspector.cookies.footprint.sent': '送信 {count} 件 · {bytes} B',
  'panel.inspector.cookies.footprint.set': '設定 {count} 件 · {bytes} B',
  'panel.inspector.cookies.footprint.dropped': '{count} 件は破棄されます',
  'panel.inspector.cookies.footprint.filteredOut': '{count} 件は除外',
  'panel.inspector.cookies.footprint.flagged': '{count} 件にフラグ',

  // Toolbar CTAs — the rule world (Override Cookies ▾) and the jar
  // world (Add cookie), each with its own (i) corpus.
  'panel.inspector.cookies.cta.overrideCookies': 'Cookie を上書き',
  'panel.inspector.cookies.cta.overrideCookiesTitle': '一致するリクエストの Cookie を変更するルールを作成します',
  'panel.inspector.cookies.cta.requestCookies': 'リクエスト Cookie…',
  'panel.inspector.cookies.cta.requestCookiesTitle': 'このリクエストで送信される Cookie ヘッダーを置き換えます',
  'panel.inspector.cookies.cta.responseCookies': 'レスポンス Cookie…',
  'panel.inspector.cookies.cta.responseCookiesTitle': 'サーバーから返ってくる Set-Cookie ヘッダーを置き換えます',
  'panel.inspector.cookies.cta.noCookies': 'Cookie を送信しない…',
  'panel.inspector.cookies.cta.noCookiesTitle':
    'Cookie ヘッダーを完全に取り除き、サーバーには Cookie が見えないようにします',
  'panel.inspector.cookies.cta.addCookie': 'Cookie を追加',
  'panel.inspector.cookies.cta.addCookieTitle': 'ブラウザーの Cookie ジャーに Cookie を追加（HttpOnly を含む）',
  'panel.inspector.cookies.ctaInfo.overrideTitle': 'Cookie を上書き',
  'panel.inspector.cookies.ctaInfo.ruleKicker': 'ルール',
  'panel.inspector.cookies.ctaInfo.overrideSummary':
    '発火中に一致するリクエストの Cookie / Set-Cookie ヘッダーを書き換えるルールを作成します。ブラウザーの Cookie ジャーには触れません。',
  'panel.inspector.cookies.ctaInfo.choicesHeading': '選択肢',
  'panel.inspector.cookies.ctaInfo.requestLabel': 'リクエスト Cookie',
  'panel.inspector.cookies.ctaInfo.requestDesc': 'ブラウザーが送信する Cookie ヘッダーを置き換えます。',
  'panel.inspector.cookies.ctaInfo.responseLabel': 'レスポンス Cookie',
  'panel.inspector.cookies.ctaInfo.responseDesc': 'サーバーから返ってくる Set-Cookie ヘッダーを置き換えます。',
  'panel.inspector.cookies.ctaInfo.noneLabel': 'Cookie を送信しない',
  'panel.inspector.cookies.ctaInfo.noneDesc':
    'Cookie ヘッダーを完全に取り除きます。サーバーには Cookie のないリクエストとして見えます。',
  'panel.inspector.cookies.ctaInfo.addTitle': 'Cookie を追加',
  'panel.inspector.cookies.ctaInfo.jarKicker': 'ブラウザーのジャー',
  'panel.inspector.cookies.ctaInfo.addSummary':
    '実際の Cookie をブラウザーの Cookie ジャーに書き込みます。ブラウザーが「アプリケーション → Cookie」に表示するのと同じストアです。',
  'panel.inspector.cookies.ctaInfo.addDescription':
    'このリクエストの後も残り、ドメイン、パス、フラグが一致する場所ならどこでもブラウザーが付与します。ルールは関与しません。ページスクリプトでは設定できない HttpOnly Cookie を作る方法でもあります。値は {{variable}} 参照を受け付け、保存時に 1 回だけ解決されます。変数が後で変わってもジャーはそのスナップショットを保持します。値を変数に追従させたい場合は「Cookie を上書き」を使ってください。',

  // Jar-write toasts + the delete confirm.
  'panel.inspector.cookies.toast.saved': 'Cookie「{name}」を保存しました',
  'panel.inspector.cookies.toast.saveFailed': 'Cookie「{name}」を保存できませんでした',
  'panel.inspector.cookies.toast.saveFailedWithError': 'Cookie「{name}」を保存できませんでした：{error}',
  'panel.inspector.cookies.toast.deleted': 'Cookie「{name}」を削除しました',
  'panel.inspector.cookies.toast.deleteFailed': 'Cookie「{name}」を削除できませんでした',
  'panel.inspector.cookies.toast.mergeApplied': 'マージをフォームに適用しました。保存するとブラウザーに書き込みます',
  'panel.inspector.cookies.confirmDelete.title': 'Cookie「{name}」を削除しますか？',
  'panel.inspector.cookies.confirmDelete.content':
    'ブラウザーの Cookie ジャーから削除されます。ページはこの Cookie を送信しなくなります。',
  'panel.inspector.cookies.confirmDelete.ok': '削除',

  // More filters ▾ / View ▾ — this tab's own menus (separate referents
  // from the headers tab's). Reset reuses `panel.menu.resetToDefault`.
  'panel.inspector.cookies.moreFilters.label': 'その他のフィルター',
  'panel.inspector.cookies.moreFilters.problemsOnly': '問題のあるもののみ',
  'panel.inspector.cookies.moreFilters.thirdPartyOnly': 'サードパーティのみ',
  'panel.inspector.cookies.moreFilters.ruleOnly': 'ルールで変更されたもののみ',
  'panel.inspector.cookies.moreFilters.showFilteredOut': '除外されたリクエスト Cookie を表示',
  'panel.inspector.cookies.view.label': '表示',
  'panel.inspector.cookies.view.sort': '並べ替え',
  'panel.inspector.cookies.view.sortOriginal': '元の順序',
  'panel.inspector.cookies.view.sortAz': 'A → Z',
  'panel.inspector.cookies.view.sortSize': 'サイズ',
  'panel.inspector.cookies.view.sortExpires': '有効期限',
  'panel.inspector.cookies.view.expiresFormat': '有効期限',
  'panel.inspector.cookies.view.expiresRelative': '相対',
  'panel.inspector.cookies.view.expiresAbsolute': '絶対',
  'panel.inspector.cookies.view.decodeValues': 'URL エンコードされた値をデコード',
  'panel.inspector.cookies.view.groupByRole': '役割でグループ化（auth / pref / tracking）',
  'panel.inspector.cookies.view.showTags': 'タグを表示',
  'panel.inspector.cookies.view.showSuggestions': '提案を表示',

  // Section chrome. Column headers stay raw in the table; the visible
  // count sentence keys.
  'panel.inspector.cookies.section.responseCookies': 'レスポンス Cookie',
  'panel.inspector.cookies.section.requestCookies': 'リクエスト Cookie',
  'panel.inspector.cookies.section.countOf': '{total} 件中 {visible} 件',

  // Role vocabulary — product classifier copy (fire-evidence badge
  // precedent: product vocabulary keys, it is not browser parity).
  'panel.inspector.cookies.role.chipAuth': 'auth?',
  'panel.inspector.cookies.role.chipTracking': 'tracking?',
  'panel.inspector.cookies.role.chipPref': 'pref',
  'panel.inspector.cookies.role.sectionAuth': '認証とセッション',
  'panel.inspector.cookies.role.sectionFunctional': '機能',
  'panel.inspector.cookies.role.sectionPref': '設定',
  'panel.inspector.cookies.role.sectionTracking': '分析とトラッキング',
  'panel.inspector.cookies.role.nounAuth': '認証 / セッション',
  'panel.inspector.cookies.role.nounTracking': '分析 / トラッキング',
  'panel.inspector.cookies.role.nounPref': '設定 / 同意',
  'panel.inspector.cookies.role.nounOther': 'Cookie',
  'panel.inspector.cookies.role.vendorTooltip': '{vendor}：{noun}の Cookie。',
  'panel.inspector.cookies.role.tooltipAuth': '認証 / セッション Cookie のようです（ヒューリスティック）。',
  'panel.inspector.cookies.role.tooltipTracking': '分析 / トラッキング Cookie のようです（ヒューリスティック）。',
  'panel.inspector.cookies.role.tooltipPref': 'ユーザー設定の Cookie。',

  // Lifecycle / context chips — facts not in any column.
  'panel.inspector.cookies.chips.partitioned': 'パーティション化',
  'panel.inspector.cookies.chips.partitionedTitle': 'トップレベルサイトに分離：{key}',
  'panel.inspector.cookies.chips.thirdParty': 'サードパーティ',
  'panel.inspector.cookies.chips.justSet': '設定直後',
  'panel.inspector.cookies.chips.justSetTitle': 'このレスポンスで設定されました。',
  'panel.inspector.cookies.chips.dropped': '破棄',
  'panel.inspector.cookies.chips.droppedTitle': 'ブラウザーはこの Set-Cookie を拒否します。',
  'panel.inspector.cookies.chips.filteredOut': '除外',
  'panel.inspector.cookies.chips.filteredOutFallbackTitle': 'このリクエストでは送信されていません。',
  'panel.inspector.cookies.chips.problemTitle': '上の提案を参照してください。',

  // S / H / L security-glyph tooltips — the letters stay raw.
  'panel.inspector.cookies.glyphs.secureOn': 'Secure：HTTPS 経由でのみ送信されます。',
  'panel.inspector.cookies.glyphs.secureMissingSameSiteNone':
    'Secure がありません。SameSite=None には Secure が必要です。ブラウザーはこの Cookie を拒否します。',
  'panel.inspector.cookies.glyphs.secureMissingPrefix':
    'Secure がありません。__Host- / __Secure- プレフィックスには Secure が必要です。',
  'panel.inspector.cookies.glyphs.secureOff': 'Secure 属性はありません。',
  'panel.inspector.cookies.glyphs.httpOnlyOn': 'HttpOnly：JavaScript からは読み取れません。',
  'panel.inspector.cookies.glyphs.httpOnlyOff': 'JavaScript から読み取り可能（HttpOnly なし）。',
  'panel.inspector.cookies.glyphs.sameSiteStrict': 'SameSite=Strict：同一サイトのナビゲーションでのみ送信されます。',
  'panel.inspector.cookies.glyphs.sameSiteLax': 'SameSite=Lax：クロスサイトのトップレベル GET で送信されます。',
  'panel.inspector.cookies.glyphs.sameSiteNoneNoSecure': 'SameSite=None で Secure なし。ブラウザーは拒否します。',
  'panel.inspector.cookies.glyphs.sameSiteNone': 'SameSite=None：すべてのクロスサイトリクエストで送信されます。',
  'panel.inspector.cookies.glyphs.sameSiteUnspecified': 'SameSite は未指定です。',

  // Row actions + status dots + name/value tooltips. Prefix hints
  // append after the raw cookie name + blank line; the modified header
  // name (Cookie / Set-Cookie) rides the rule-dot title as a raw hole.
  'panel.inspector.cookies.row.copyValue': '値をコピー',
  'panel.inspector.cookies.row.copied': 'コピーしました',
  'panel.inspector.cookies.row.override': '上書き',
  'panel.inspector.cookies.row.overrideSetCookieTitle': 'この Set-Cookie を上書きするルールを作成',
  'panel.inspector.cookies.row.overrideCookieTitle': 'この Cookie の値を上書きするルールを作成',
  'panel.inspector.cookies.row.editCookieTitle': 'ブラウザーの Cookie ジャーでこの Cookie を編集',
  'panel.inspector.cookies.row.editCookieAria': 'Cookie を編集',
  'panel.inspector.cookies.row.deleteCookieTitle': 'ブラウザーの Cookie ジャーからこの Cookie を削除',
  'panel.inspector.cookies.row.deleteCookieAria': 'Cookie を削除',
  'panel.inspector.cookies.row.ruleDotTitle': 'ルールがこのリクエストの {header} ヘッダーを変更しています',
  'panel.inspector.cookies.row.ruleDotAria': 'ルール適用中',
  'panel.inspector.cookies.row.editedDotTitle': 'このパネルから編集済み',
  'panel.inspector.cookies.row.editedDotAria': '編集済み',
  'panel.inspector.cookies.row.hostPrefixHint':
    '__Host- プレフィックスはこの Cookie を 1 つのホストに固定します。ブラウザーは Secure、Path=/、Domain 属性なしを強制します。いずれかに違反する Set-Cookie 行は拒否されます。',
  'panel.inspector.cookies.row.securePrefixHint':
    '__Secure- プレフィックスはこの Cookie を Secure（HTTPS 限定）に強制します。Secure のない Set-Cookie 行は拒否されます。',
  'panel.inspector.cookies.row.editedValueTitle': '編集済み。リクエストが運んだ値：{value}',
  'panel.inspector.cookies.row.valueNoteResponse':
    'このレスポンスが設定した値：{value}。ジャーの値はその後変わっています。',
  'panel.inspector.cookies.row.valueNoteRequest':
    'このリクエストが送信した値：{value}。ジャーの値はその後変わっています。',

  // Status-rail (i) — OH-native rail copy; kicker is the raw brand.
  'panel.inspector.cookies.statusRail.title': 'ステータス',
  'panel.inspector.cookies.statusRail.summary': '四角は、ブラウザーの素の状態ではない Cookie を示します。',
  'panel.inspector.cookies.statusRail.colorsHeading': '四角の色',
  'panel.inspector.cookies.statusRail.blue': '青',
  'panel.inspector.cookies.statusRail.blueDesc':
    'このリクエストで発火したルールが、この方向の Cookie / Set-Cookie ヘッダーを変更しています。',
  'panel.inspector.cookies.statusRail.grey': 'グレー',
  'panel.inspector.cookies.statusRail.greyDesc': 'このセッション中にこのパネルから追加または編集されました。',

  // Add / edit popover. Title reuses the toolbar CTA (names-its-
  // control). The SameSite labels, On/Off flag words and the Session
  // expires word are ROUND-TRIP vocabulary: the conflict projection
  // renders them and the merge dialog parses them back, so display and
  // parse read the same keys (cookie-edit.ts is t-first on both sides).
  'panel.inspector.cookies.edit.editTitle': 'Cookie を編集',
  'panel.inspector.cookies.edit.valueChanged': '値が変更',
  'panel.inspector.cookies.edit.goneNote':
    'この Cookie はフォームを開いている間にブラウザーで削除されました。保存すると書き戻します。',
  'panel.inspector.cookies.edit.openInTab': '新しいタブで開く',
  'panel.inspector.cookies.edit.openDirtyTitle':
    '先に編集を保存またはキャンセルしてください。ドキュメントはブラウザーの Cookie ジャーから開きます',
  'panel.inspector.cookies.edit.openTitle': 'この Cookie をドキュメントタブとして開く',
  'panel.inspector.cookies.edit.save': '保存',
  'panel.inspector.cookies.edit.unresolved': '解決できません。変数を作成するか、参照を修正してください。',
  'panel.inspector.cookies.edit.writes': '書き込む値：{value}',
  'panel.inspector.cookies.edit.field.name': 'Name',
  'panel.inspector.cookies.edit.field.value': 'Value',
  'panel.inspector.cookies.edit.field.hostOnly': 'Host-only',
  'panel.inspector.cookies.edit.namePlaceholder': 'Cookie 名',
  'panel.inspector.cookies.edit.valuePlaceholder': '値または {{variable}}',
  'panel.inspector.cookies.edit.session': 'Session',
  'panel.inspector.cookies.edit.onDate': '日付指定',
  'panel.inspector.cookies.edit.sameSite.unspecified': 'Unspecified',
  'panel.inspector.cookies.edit.sameSite.noRestriction': 'None (cross-site)',
  'panel.inspector.cookies.edit.sameSite.lax': 'Lax',
  'panel.inspector.cookies.edit.sameSite.strict': 'Strict',
  'panel.inspector.cookies.edit.flagOn': 'オン',
  'panel.inspector.cookies.edit.flagOff': 'オフ',
  // Pre-write constraint sentences — the __Host- / __Secure- prefixes
  // and path “/” ride raw inside; the SameSite label feeds through a
  // hole so the sentence can never drift from the select option.
  'panel.inspector.cookies.edit.constraint.hostSecure':
    '__Host- プレフィックス付きの Cookie は Secure フラグをオンにする必要があります。',
  'panel.inspector.cookies.edit.constraint.hostDomain':
    '__Host- プレフィックス付きの Cookie は Domain 属性を持てません。「Host only」をオンにしてください。',
  'panel.inspector.cookies.edit.constraint.hostPath':
    '__Host- プレフィックス付きの Cookie はパス「/」を使う必要があります。',
  'panel.inspector.cookies.edit.constraint.securePrefix':
    '__Secure- プレフィックス付きの Cookie は Secure フラグをオンにする必要があります。',
  'panel.inspector.cookies.edit.constraint.sameSiteNone': 'SameSite「{label}」には Secure フラグが必要です。',
  // Merge parse-back errors — rendered inline in the merge modal. The
  // quoted field names are the JSON projection's raw keys; the quoted
  // vocabulary words feed through holes from the keys above.
  'panel.inspector.cookies.edit.merge.invalidJson':
    'マージ結果は有効な JSON ではありません。構文を修正してマージをやり直してください。',
  'panel.inspector.cookies.edit.merge.notObject':
    'マージ結果は Cookie のフィールドを持つ JSON オブジェクトである必要があります。',
  'panel.inspector.cookies.edit.merge.fieldMissing': '"{field}" は文字列として存在する必要があります。',
  'panel.inspector.cookies.edit.merge.flagOnOff': '"{field}" は "{on}" または "{off}" である必要があります。',
  'panel.inspector.cookies.edit.merge.sameSiteOneOf': '"sameSite" は {labels} のいずれかである必要があります。',
  'panel.inspector.cookies.edit.merge.expiresInvalid':
    '"expires" は "{session}" か、2026-07-09T14:30 のような日付である必要があります。',

  // Edit-form field (i) corpus — titles are the raw attribute names;
  // the shared template note keys once and composes with ' '.
  'panel.inspector.cookies.fieldInfo.exampleCaption': 'Set-Cookie の例',
  'panel.inspector.cookies.fieldInfo.fieldKicker': 'Cookie フィールド',
  'panel.inspector.cookies.fieldInfo.flagKicker': 'Cookie フラグ',
  'panel.inspector.cookies.fieldInfo.templateNote':
    '{{variable}} 参照を受け付け、保存時に 1 回だけ解決されます。ジャーには解決後のテキストが保存されます。',
  'panel.inspector.cookies.fieldInfo.name.summary':
    'Cookie の識別子。ブラウザーは（name、domain、path）をキーにします。同じ名前でもスコープが異なれば別の Cookie です。',
  'panel.inspector.cookies.fieldInfo.name.description':
    'プレフィックスはブラウザーが強制します。__Host- は Secure、Path=/、Domain なしを、__Secure- は Secure を要求します。',
  'panel.inspector.cookies.fieldInfo.value.summary':
    'Cookie のペイロード。ブラウザーが Cookie ヘッダーで送り返す内容です。',
  'panel.inspector.cookies.fieldInfo.value.description':
    '値はスナップショットです。変数が後で変わってもジャーはこのテキストを保持します。値を変数に追従させたい場合は「Cookie を上書き」ルールを使ってください。',
  'panel.inspector.cookies.fieldInfo.domain.summary': 'どのホストが Cookie を受け取るか。',
  'panel.inspector.cookies.fieldInfo.domain.description':
    'openheaders.com のような素のドメインはサブドメインも含みます（ブラウザーは先頭にドットを付けて保存します）。Host-only をオンにすると、Cookie はちょうどこのホストに固定されます。',
  'panel.inspector.cookies.fieldInfo.path.summary':
    'Cookie が乗る URL パスの接頭辞。/api なら /api 配下のリクエストだけがそれを運びます。',
  'panel.inspector.cookies.fieldInfo.path.description': 'デフォルトは / です。',
  'panel.inspector.cookies.fieldInfo.expires.summary': 'ブラウザーが Cookie を削除する時期。',
  'panel.inspector.cookies.fieldInfo.expires.description':
    'Session Cookie はブラウザーのセッションが終わるまで生きます。「日付指定」は絶対的な有効期限を設定します（Expires 属性として保存）。',
  'panel.inspector.cookies.fieldInfo.samesite.summary': 'クロスサイトのリクエストが Cookie を運べるのはいつか。',
  'panel.inspector.cookies.fieldInfo.samesite.valuesHeading': '値',
  'panel.inspector.cookies.fieldInfo.samesite.strict': '同一サイトのリクエストのみ。',
  'panel.inspector.cookies.fieldInfo.samesite.lax':
    '同一サイトに加え、トップレベルのクロスサイトナビゲーション（GET）。',
  'panel.inspector.cookies.fieldInfo.samesite.none':
    'クロスサイトでも送信されます。ブラウザーは Secure を併用するよう要求します。',
  'panel.inspector.cookies.fieldInfo.samesite.unspecified':
    'ブラウザーのデフォルト（Chrome では Lax として扱われます）。',
  'panel.inspector.cookies.fieldInfo.httponly.summary':
    'ページの JavaScript から Cookie を隠します。document.cookie では読み取りも上書きもできません。',
  'panel.inspector.cookies.fieldInfo.httponly.description':
    'HttpOnly Cookie を作れるのはサーバー（Set-Cookie）とこのエディターだけで、ページスクリプトには作れません。セッション token の標準的な強化策です。',
  'panel.inspector.cookies.fieldInfo.secure.summary':
    'Cookie は HTTPS 経由でのみ送られます。平文の http リクエストが運ぶことはありません。',
  'panel.inspector.cookies.fieldInfo.secure.description':
    'SameSite=None と、__Host- / __Secure- の名前プレフィックスに必要です。',
  'panel.inspector.cookies.fieldInfo.hostonly.summary':
    'Cookie をちょうど Domain のホストに固定します。サブドメインは受け取りません。',
  'panel.inspector.cookies.fieldInfo.hostonly.description':
    'オフの場合、Cookie はドメイン全体（先頭ドット形式）で保存され、サブドメインにも流れます。サーバーが Domain 属性を省略した場合、ブラウザー自身の Cookie は host-only になります。',

  // Column (i) corpus — column-name titles stay raw; the Sec cell's
  // long title keys whole (glyph letters ride inside).
  'panel.inspector.cookies.columnInfo.name.summary':
    'Cookie の識別子。ブラウザーは（name、domain、path）をキーにします。同じ名前でもスコープが異なる 2 つの Cookie は別物です。',
  'panel.inspector.cookies.columnInfo.name.description':
    '右側のチップは、どの列にもないことを表します。名前の隣に表示され、行にホバーすると値の上に「上書き」アクションが現れます。',
  'panel.inspector.cookies.columnInfo.name.roleHeading': '役割（ヒューリスティック）',
  'panel.inspector.cookies.columnInfo.name.authDesc':
    '認証 / セッション Cookie のようです。名前が sess / session / auth / sid / token / csrf / xsrf に一致するか、HttpOnly で長いランダム値を持つ Cookie です。',
  'panel.inspector.cookies.columnInfo.name.trackingDesc':
    '分析 / トラッキング Cookie のようです。名前が既知のトラッカー（_ga、_gid、_fbp、NID、IDE、MUID、_hjid など）に一致するか、他に分類のないサードパーティ Cookie です。',
  'panel.inspector.cookies.columnInfo.name.prefDesc':
    'ユーザー設定の Cookie。tz、lang、locale、theme、color-mode、currency、cpu-bucket、font-size など。',
  'panel.inspector.cookies.columnInfo.name.lifecycleHeading': 'ライフサイクル',
  'panel.inspector.cookies.columnInfo.name.justSetDesc':
    'このレスポンスで Set-Cookie が届き、ブラウザーが受け入れました。',
  'panel.inspector.cookies.columnInfo.name.droppedDesc':
    'Set-Cookie は届きましたが、ブラウザーは拒否します。Secure のない SameSite=None、__Host- プレフィックス違反、Secure のない __Secure- プレフィックス、Secure のない Partitioned といった規則に違反しています。',
  'panel.inspector.cookies.columnInfo.name.filteredOutDesc':
    'ジャーにはこの Cookie がありますが、このリクエストでは送信されませんでした（パス不一致、http での Secure、期限切れ、SameSite 制限など）。「除外されたリクエスト Cookie を表示」がオンのときにだけ表示されます。',
  'panel.inspector.cookies.columnInfo.name.contextHeading': 'コンテキスト',
  'panel.inspector.cookies.columnInfo.name.thirdPartyDesc':
    'Cookie のドメインが、ページのトップフレームのオリジンに対してクロスサイトです。',
  'panel.inspector.cookies.columnInfo.name.partitionedDesc':
    'CHIPS 方式の分離。Cookie は自身のスコープに加えてトップレベルサイトもキーにしています。ホバーするとパーティションキーが表示されます。',
  'panel.inspector.cookies.columnInfo.name.problemDesc':
    'この Cookie はインサイト（タブ上部の警告カード）を発生させました。理由はそのコールアウトを参照してください。',
  'panel.inspector.cookies.columnInfo.name.prefixesHeading': 'プレフィックス（名前に表示）',
  'panel.inspector.cookies.columnInfo.name.hostPrefixDesc':
    'ホスト固定。ブラウザーは Secure、Path=/、Domain なしを強制します。違反は拒否されます。',
  'panel.inspector.cookies.columnInfo.name.securePrefixDesc':
    'HTTPS 限定。ブラウザーは Secure を強制します。違反は拒否されます。',
  'panel.inspector.cookies.columnInfo.value.summary':
    'Cookie のペイロード。値に構造がある場合、行をクリックすると解析済みビューのパネルが展開します。',
  'panel.inspector.cookies.columnInfo.value.formatsHeading': '自動検出される形式',
  'panel.inspector.cookies.columnInfo.value.jwtDesc':
    'base64url の 3 セグメント。header と payload はデコードされ、exp / iat / nbf クレームは相対時刻で表示されます。',
  'panel.inspector.cookies.columnInfo.value.jsonDesc': 'エキスパンダー内で整形表示（URL デコード後にも機能します）。',
  'panel.inspector.cookies.columnInfo.value.b64Desc': '素の base64。印字可能な場合はデコード済みのボディを表示します。',
  'panel.inspector.cookies.columnInfo.value.urlEncodedDesc':
    'パーセントエンコードされたテキスト。「表示」の「URL エンコードされた値をデコード」をオンにすると、デコード結果をインラインで表示します。',
  'panel.inspector.cookies.columnInfo.scope.summary':
    'ブラウザーがこの Cookie を付与する場所。Domain と Path の組み合わせです。',
  'panel.inspector.cookies.columnInfo.scope.description':
    'ドメインの先頭ドット（例：`.openheaders.com`）はサブドメインを含むことを意味します。`/api` のような末尾のパスは、そのパス配下のリクエストでのみ送信されることを意味します。',
  'panel.inspector.cookies.columnInfo.expires.summary':
    'ブラウザーがこの Cookie の送信を止める時期。色は緊急度を表します。',
  'panel.inspector.cookies.columnInfo.expires.colorHeading': '色の読み方',
  'panel.inspector.cookies.columnInfo.expires.red': '赤',
  'panel.inspector.cookies.columnInfo.expires.redDesc': 'すでに期限切れか、1 時間以内に期限切れ。',
  'panel.inspector.cookies.columnInfo.expires.yellow': '黄',
  'panel.inspector.cookies.columnInfo.expires.yellowDesc': '24 時間以内に期限切れ。',
  'panel.inspector.cookies.columnInfo.expires.plain': '無色',
  'panel.inspector.cookies.columnInfo.expires.plainDesc': '将来。1 日以上先です。',
  'panel.inspector.cookies.columnInfo.expires.sessionDesc':
    'Expires / Max-Age なし。セッション終了時にブラウザーが破棄します。',
  'panel.inspector.cookies.columnInfo.expires.formatHeading': '形式',
  'panel.inspector.cookies.columnInfo.expires.relativeLabel': '相対（デフォルト）',
  'panel.inspector.cookies.columnInfo.expires.relativeDesc':
    '「in 7mo」「30s ago」のように現在からの相対です。ホバーすると絶対日時が表示されます。',
  'panel.inspector.cookies.columnInfo.expires.absoluteLabel': '絶対',
  'panel.inspector.cookies.columnInfo.expires.absoluteDesc': 'UTC の日時。「表示 → 有効期限」で切り替えます。',
  'panel.inspector.cookies.columnInfo.size.summary':
    'シリアライズした Cookie のサイズ（バイト）。`name=value` の長さで、リクエストごとのペイロード合計に使われます。',
  'panel.inspector.cookies.columnInfo.size.description':
    '多くのサーバーや中継機器は Cookie ヘッダー全体を 4 KB に制限しています。大きすぎるペイロードは、明確なエラーなしに 4xx / 5xx レスポンスを引き起こすことがあります。',
  'panel.inspector.cookies.columnInfo.sec.title': 'セキュリティ（S H L）',
  'panel.inspector.cookies.columnInfo.sec.summary':
    '3 つのグリフが Secure / HttpOnly / SameSite 属性を 1 つのセルにまとめます。色が意味を運びます。',
  'panel.inspector.cookies.columnInfo.sec.glyphsHeading': 'グリフ',
  'panel.inspector.cookies.columnInfo.sec.sDesc': 'Secure：HTTPS 経由でのみ送信されます。',
  'panel.inspector.cookies.columnInfo.sec.hDesc': 'HttpOnly：JavaScript からは読み取れません。',
  'panel.inspector.cookies.columnInfo.sec.lDesc': 'SameSite 制限（Lax / Strict / None）。',
  'panel.inspector.cookies.columnInfo.sec.colorHeading': '色',
  'panel.inspector.cookies.columnInfo.sec.green': '緑',
  'panel.inspector.cookies.columnInfo.sec.greenDesc': 'オン / strict。固く守られています。',
  'panel.inspector.cookies.columnInfo.sec.yellow': '黄',
  'panel.inspector.cookies.columnInfo.sec.yellowDesc': 'Lax：トップレベルのクロスサイト GET で送信されます。',
  'panel.inspector.cookies.columnInfo.sec.red': '赤',
  'panel.inspector.cookies.columnInfo.sec.redDesc':
    '必要な場所で欠けています（Secure のない SameSite=None、Secure のない __Host- など）。ブラウザーは拒否します。',
  'panel.inspector.cookies.columnInfo.sec.gray': 'グレー',
  'panel.inspector.cookies.columnInfo.sec.grayDesc': 'オフ / 未指定。',

  // Cookie insights (t-fed `computeCookieInsights`). Names, origins,
  // byte figures and attribute vocabulary ride as raw holes / inline.
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 件の Cookie が SameSite=None で設定されていますが Secure がありません',
    }),
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.detail':
    '最近のブラウザーは、Secure でない SameSite=None の Cookie を拒否します。保存されません。',
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.action': 'Secure 属性を追加',
  'panel.inspector.cookies.insights.hostPrefix.title': '{names} が __Host- プレフィックスに違反しています',
  'panel.inspector.cookies.insights.hostPrefix.detail':
    '__Host- プレフィックス付きの Cookie は Secure、Path=/ で、Domain 属性を持たない必要があります。そうでなければブラウザーは拒否します。',
  'panel.inspector.cookies.insights.securePrefix.title': '{names} が __Secure- プレフィックスに違反しています',
  'panel.inspector.cookies.insights.securePrefix.detail':
    '__Secure- プレフィックス付きの Cookie は Secure 属性を持つ必要があります。そうでなければブラウザーは拒否します。',
  'panel.inspector.cookies.insights.partitionedNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 件の Partitioned Cookie に Secure がありません',
    }),
  'panel.inspector.cookies.insights.partitionedNoSecure.detail': 'Partitioned Cookie は Secure である必要があります。',
  'panel.inspector.cookies.insights.setOnHttp.title': '平文 HTTP で設定された Cookie',
  'panel.inspector.cookies.insights.setOnHttp.detail':
    'これらの Cookie は経路上の誰にでも観測・再送できます。HTTPS と Secure 属性を使ってください。',
  'panel.inspector.cookies.insights.expiredSent.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 件の期限切れ Cookie がまだ送信されています',
    }),
  'panel.inspector.cookies.insights.expiredSent.detail':
    'これらの Cookie の有効期限は過去ですが、リクエストはそれらを運びました。ジャーはまもなく破棄します。',
  'panel.inspector.cookies.insights.oversized.title': 'Cookie ヘッダーが {bytes}B です（一般的な上限 4KB 超）',
  'panel.inspector.cookies.insights.oversized.detail':
    'サーバーや中継機器はヘッダーサイズを制限します。大きすぎる Cookie ペイロードは、明確なエラーなしに 4xx / 5xx を引き起こすことがあります。',
  'panel.inspector.cookies.insights.thirdPartySet.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 件のサードパーティ Cookie が設定されました',
    }),
  'panel.inspector.cookies.insights.thirdPartySet.titleBy': ({ count, origin }, locale) => {
    const lead = plural(locale, Number(count), {
      other: '{count} 件のサードパーティ Cookie が設定されました',
    });
    return `${String(origin)} により ${lead}`;
  },
  'panel.inspector.cookies.insights.thirdPartySet.detail':
    'Partitioned 属性で CHIPS にオプトインしない限り、最近のブラウザーはクロスサイトのコンテキストでこれらをブロックすることがあります。',
} as const satisfies Catalog;
