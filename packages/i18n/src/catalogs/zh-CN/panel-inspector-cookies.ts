/**
 * DevTools panel — inspector Cookies tab — Simplified Chinese.
 * Mirrors `catalogs/en/panel-inspector-cookies.ts` key for key. Raw
 * by design: cookie names/values, Set-Cookie attribute names as
 * titles and field labels (Name / Value / Domain / Path / Expires /
 * SameSite / HttpOnly / Secure / Host-only), the parity-shaped
 * column headers, the `COOKIE_SAME_SITE_LABELS` round-trip
 * vocabulary (Unspecified / None (cross-site) / Lax / Strict —
 * rendered AND parsed, never convert one side alone), the literal
 * `Session`, `__Host-` / `__Secure-` prefixes, role chips (auth? /
 * tracking? / pref), format nouns, and byte figures. Mints: On/Off
 * projection = 开/关 (round-trip, both sides); 丢弃/拒绝 split —
 * the browser 拒绝 (rejects) a Set-Cookie, the dropped chip reads
 * 已丢弃; 第三方 = third-party; 分区 = partitioned carried; 罐 =
 * jar shorthand carried; 角色 = role (classifier); 前缀 = prefix.
 * Prefix prose leads with a word（带 __Host- 前缀的 Cookie）— never
 * a compound onto the raw token. DevTools path quotes Chrome's own
 * zh UI（应用 → Cookie）.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorCookies = {
  // ── Cookies tab (inspector detail) ──────────────────────────────────
  'panel.inspector.cookies.filterPlaceholder':
    '筛选——文本、name:sess、is:secure、is:samesite-none、is:problem、is:third-party、…',
  'panel.inspector.cookies.filterAria': '筛选 Cookie',
  'panel.inspector.cookies.empty': '没有发送或接收任何 Cookie。',

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
  'panel.inspector.cookies.footprint.sent': '已发送 {count} 个 · {bytes} B',
  'panel.inspector.cookies.footprint.set': '已设置 {count} 个 · {bytes} B',
  'panel.inspector.cookies.footprint.dropped': '{count} 个将被丢弃',
  'panel.inspector.cookies.footprint.filteredOut': '{count} 个被筛除',
  'panel.inspector.cookies.footprint.flagged': '{count} 个被标记',

  // Toolbar CTAs — the rule world (Override Cookies ▾) and the jar
  // world (Add cookie), each with its own (i) corpus.
  'panel.inspector.cookies.cta.overrideCookies': '覆盖 Cookie',
  'panel.inspector.cookies.cta.overrideCookiesTitle': '创建一条规则，更改匹配请求上的 Cookie',
  'panel.inspector.cookies.cta.requestCookies': '请求 Cookie…',
  'panel.inspector.cookies.cta.requestCookiesTitle': '替换此请求上发送的 Cookie 标头',
  'panel.inspector.cookies.cta.responseCookies': '响应 Cookie…',
  'panel.inspector.cookies.cta.responseCookiesTitle': '替换服务器返回的某个 Set-Cookie 标头',
  'panel.inspector.cookies.cta.noCookies': '不发送任何 Cookie…',
  'panel.inspector.cookies.cta.noCookiesTitle': '完全去掉 Cookie 标头，让服务器看不到任何 Cookie',
  'panel.inspector.cookies.cta.addCookie': '添加 Cookie',
  'panel.inspector.cookies.cta.addCookieTitle': '向浏览器 Cookie 罐中添加一个 Cookie（包括 HttpOnly）',
  'panel.inspector.cookies.ctaInfo.overrideTitle': '覆盖 Cookie',
  'panel.inspector.cookies.ctaInfo.ruleKicker': '规则',
  'panel.inspector.cookies.ctaInfo.overrideSummary':
    '创建一条规则，在触发期间改写匹配请求上的 Cookie / Set-Cookie 标头。浏览器 Cookie 罐不受影响。',
  'panel.inspector.cookies.ctaInfo.choicesHeading': '选项',
  'panel.inspector.cookies.ctaInfo.requestLabel': '请求 Cookie',
  'panel.inspector.cookies.ctaInfo.requestDesc': '替换浏览器发送的 Cookie 标头。',
  'panel.inspector.cookies.ctaInfo.responseLabel': '响应 Cookie',
  'panel.inspector.cookies.ctaInfo.responseDesc': '替换服务器返回的某个 Set-Cookie 标头。',
  'panel.inspector.cookies.ctaInfo.noneLabel': '不发送任何 Cookie',
  'panel.inspector.cookies.ctaInfo.noneDesc': '完全去掉 Cookie 标头——服务器看到的是不带 Cookie 的请求。',
  'panel.inspector.cookies.ctaInfo.addTitle': '添加 Cookie',
  'panel.inspector.cookies.ctaInfo.jarKicker': '浏览器 Cookie 罐',
  'panel.inspector.cookies.ctaInfo.addSummary':
    '把一个真实的 Cookie 写入浏览器 Cookie 罐——与浏览器在“应用 → Cookie”下显示的是同一个存储。',
  'panel.inspector.cookies.ctaInfo.addDescription':
    '它在此请求之后继续存在，只要域、路径和标志匹配，浏览器就会附加它——不涉及任何规则。这也是创建 HttpOnly Cookie 的方式，页面脚本无法设置它们。值接受 {{variable}} 引用，在你保存时解析一次——即使变量之后发生变化，罐中保留的仍是那个快照；如果值应当跟随变量变化，请使用“覆盖 Cookie”。',

  // Jar-write toasts + the delete confirm.
  'panel.inspector.cookies.toast.saved': 'Cookie “{name}” 已保存',
  'panel.inspector.cookies.toast.saveFailed': '无法保存 Cookie “{name}”',
  'panel.inspector.cookies.toast.saveFailedWithError': '无法保存 Cookie “{name}”——{error}',
  'panel.inspector.cookies.toast.deleted': 'Cookie “{name}” 已删除',
  'panel.inspector.cookies.toast.deleteFailed': '无法删除 Cookie “{name}”',
  'panel.inspector.cookies.toast.mergeApplied': '合并已应用到表单——保存会把它写入浏览器',
  'panel.inspector.cookies.confirmDelete.title': '删除 Cookie “{name}”？',
  'panel.inspector.cookies.confirmDelete.content': '这会把它从浏览器 Cookie 罐中移除。页面将不再发送它。',
  'panel.inspector.cookies.confirmDelete.ok': '删除',

  // More filters ▾ / View ▾ — this tab's own menus (separate referents
  // from the headers tab's). Reset reuses `panel.menu.resetToDefault`.
  'panel.inspector.cookies.moreFilters.label': '更多筛选',
  'panel.inspector.cookies.moreFilters.problemsOnly': '仅有问题的',
  'panel.inspector.cookies.moreFilters.thirdPartyOnly': '仅第三方',
  'panel.inspector.cookies.moreFilters.ruleOnly': '仅规则修改过的',
  'panel.inspector.cookies.moreFilters.showFilteredOut': '显示被筛除的请求 Cookie',
  'panel.inspector.cookies.view.label': '视图',
  'panel.inspector.cookies.view.sort': '排序',
  'panel.inspector.cookies.view.sortOriginal': '原始顺序',
  'panel.inspector.cookies.view.sortAz': 'A → Z',
  'panel.inspector.cookies.view.sortSize': '大小',
  'panel.inspector.cookies.view.sortExpires': '过期时间',
  'panel.inspector.cookies.view.expiresFormat': '过期时间',
  'panel.inspector.cookies.view.expiresRelative': '相对',
  'panel.inspector.cookies.view.expiresAbsolute': '绝对',
  'panel.inspector.cookies.view.decodeValues': '解码 URL 编码的值',
  'panel.inspector.cookies.view.groupByRole': '按角色分组（auth / pref / tracking）',
  'panel.inspector.cookies.view.showTags': '显示标签',
  'panel.inspector.cookies.view.showSuggestions': '显示建议',

  // Section chrome. Column headers stay raw in the table; the visible
  // count sentence keys.
  'panel.inspector.cookies.section.responseCookies': '响应 Cookie',
  'panel.inspector.cookies.section.requestCookies': '请求 Cookie',
  'panel.inspector.cookies.section.countOf': '{visible} / {total}',

  // Role vocabulary — product classifier copy (fire-evidence badge
  // precedent: product vocabulary keys, it is not browser parity).
  'panel.inspector.cookies.role.chipAuth': 'auth?',
  'panel.inspector.cookies.role.chipTracking': 'tracking?',
  'panel.inspector.cookies.role.chipPref': 'pref',
  'panel.inspector.cookies.role.sectionAuth': '身份验证与会话',
  'panel.inspector.cookies.role.sectionFunctional': '功能性',
  'panel.inspector.cookies.role.sectionPref': '偏好设置',
  'panel.inspector.cookies.role.sectionTracking': '分析与跟踪',
  'panel.inspector.cookies.role.nounAuth': '身份验证 / 会话',
  'panel.inspector.cookies.role.nounTracking': '分析 / 跟踪',
  'panel.inspector.cookies.role.nounPref': '偏好 / 同意',
  'panel.inspector.cookies.role.nounOther': 'Cookie',
  'panel.inspector.cookies.role.vendorTooltip': '{vendor}——{noun}类 Cookie。',
  'panel.inspector.cookies.role.tooltipAuth': '疑似身份验证 / 会话 Cookie（启发式判断）。',
  'panel.inspector.cookies.role.tooltipTracking': '疑似分析 / 跟踪 Cookie（启发式判断）。',
  'panel.inspector.cookies.role.tooltipPref': '用户偏好 Cookie。',

  // Lifecycle / context chips — facts not in any column.
  'panel.inspector.cookies.chips.partitioned': '已分区',
  'panel.inspector.cookies.chips.partitionedTitle': '隔离到顶级站点：{key}',
  'panel.inspector.cookies.chips.thirdParty': '第三方',
  'panel.inspector.cookies.chips.justSet': '刚设置',
  'panel.inspector.cookies.chips.justSetTitle': '由此响应设置。',
  'panel.inspector.cookies.chips.dropped': '已丢弃',
  'panel.inspector.cookies.chips.droppedTitle': '浏览器将拒绝此 Set-Cookie。',
  'panel.inspector.cookies.chips.filteredOut': '已筛除',
  'panel.inspector.cookies.chips.filteredOutFallbackTitle': '未在此请求上发送。',
  'panel.inspector.cookies.chips.problemTitle': '见上方建议。',

  // S / H / L security-glyph tooltips — the letters stay raw.
  'panel.inspector.cookies.glyphs.secureOn': 'Secure——只通过 HTTPS 发送。',
  'panel.inspector.cookies.glyphs.secureMissingSameSiteNone':
    '缺少 Secure——SameSite=None 要求 Secure；浏览器将拒绝此 Cookie。',
  'panel.inspector.cookies.glyphs.secureMissingPrefix': '缺少 Secure——__Host- / __Secure- 前缀要求 Secure。',
  'panel.inspector.cookies.glyphs.secureOff': '没有 Secure 属性。',
  'panel.inspector.cookies.glyphs.httpOnlyOn': 'HttpOnly——JavaScript 无法读取。',
  'panel.inspector.cookies.glyphs.httpOnlyOff': 'JavaScript 可读取（没有 HttpOnly）。',
  'panel.inspector.cookies.glyphs.sameSiteStrict': 'SameSite=Strict——只在同站导航中发送。',
  'panel.inspector.cookies.glyphs.sameSiteLax': 'SameSite=Lax——在跨站顶级 GET 上发送。',
  'panel.inspector.cookies.glyphs.sameSiteNoneNoSecure': 'SameSite=None 且没有 Secure——浏览器将拒绝。',
  'panel.inspector.cookies.glyphs.sameSiteNone': 'SameSite=None——在所有跨站请求上发送。',
  'panel.inspector.cookies.glyphs.sameSiteUnspecified': '未指定 SameSite。',

  // Row actions + status dots + name/value tooltips. Prefix hints
  // append after the raw cookie name + blank line; the modified header
  // name (Cookie / Set-Cookie) rides the rule-dot title as a raw hole.
  'panel.inspector.cookies.row.copyValue': '复制值',
  'panel.inspector.cookies.row.copied': '已复制',
  'panel.inspector.cookies.row.override': '覆盖',
  'panel.inspector.cookies.row.overrideSetCookieTitle': '创建一条规则来覆盖此 Set-Cookie',
  'panel.inspector.cookies.row.overrideCookieTitle': '创建一条规则来覆盖此 Cookie 值',
  'panel.inspector.cookies.row.editCookieTitle': '在浏览器 Cookie 罐中编辑此 Cookie',
  'panel.inspector.cookies.row.editCookieAria': '编辑 Cookie',
  'panel.inspector.cookies.row.deleteCookieTitle': '从浏览器 Cookie 罐中删除此 Cookie',
  'panel.inspector.cookies.row.deleteCookieAria': '删除 Cookie',
  'panel.inspector.cookies.row.ruleDotTitle': '一条规则修改了此请求上的 {header} 标头',
  'panel.inspector.cookies.row.ruleDotAria': '规则已应用',
  'panel.inspector.cookies.row.editedDotTitle': '已在此面板中编辑',
  'panel.inspector.cookies.row.editedDotAria': '已编辑',
  'panel.inspector.cookies.row.hostPrefixHint':
    '__Host- 前缀把此 Cookie 锁定到单一主机：浏览器强制要求 Secure、Path=/，且不允许 Domain 属性。违反其中任意一条的 Set-Cookie 行都会被拒绝。',
  'panel.inspector.cookies.row.securePrefixHint':
    '__Secure- 前缀强制此 Cookie 为 Secure（仅限 HTTPS）。缺少 Secure 的 Set-Cookie 行会被拒绝。',
  'panel.inspector.cookies.row.editedValueTitle': '已编辑——请求携带的是：{value}',
  'panel.inspector.cookies.row.valueNoteResponse': '此响应设置的是：{value}——罐中的值此后已发生变化。',
  'panel.inspector.cookies.row.valueNoteRequest': '此请求发送的是：{value}——罐中的值此后已发生变化。',

  // Status-rail (i) — OH-native rail copy; kicker is the raw brand.
  'panel.inspector.cookies.statusRail.title': '状态',
  'panel.inspector.cookies.statusRail.summary': '方块标记的是不处于浏览器原始状态的 Cookie。',
  'panel.inspector.cookies.statusRail.colorsHeading': '方块颜色',
  'panel.inspector.cookies.statusRail.blue': '蓝色',
  'panel.inspector.cookies.statusRail.blueDesc': '在此请求上触发的某条规则修改了该方向的 Cookie / Set-Cookie 标头。',
  'panel.inspector.cookies.statusRail.grey': '灰色',
  'panel.inspector.cookies.statusRail.greyDesc': '本会话期间在此面板中添加或编辑过。',

  // Add / edit popover. Title reuses the toolbar CTA (names-its-
  // control). The SameSite labels, On/Off flag words and the Session
  // expires word are ROUND-TRIP vocabulary: the conflict projection
  // renders them and the merge dialog parses them back, so display and
  // parse read the same keys (cookie-edit.ts is t-first on both sides).
  'panel.inspector.cookies.edit.editTitle': '编辑 Cookie',
  'panel.inspector.cookies.edit.valueChanged': '值已变化',
  'panel.inspector.cookies.edit.goneNote': '此 Cookie 在表单打开期间已在浏览器中被删除——保存会把它写回。',
  'panel.inspector.cookies.edit.openInTab': '在新标签页中打开',
  'panel.inspector.cookies.edit.openDirtyTitle': '请先保存或取消你的编辑——文档将从浏览器 Cookie 罐打开',
  'panel.inspector.cookies.edit.openTitle': '把此 Cookie 作为文档标签页打开',
  'panel.inspector.cookies.edit.save': '保存',
  'panel.inspector.cookies.edit.unresolved': '无法解析——请创建该变量或修正引用。',
  'panel.inspector.cookies.edit.writes': '写入：{value}',
  'panel.inspector.cookies.edit.field.name': 'Name',
  'panel.inspector.cookies.edit.field.value': 'Value',
  'panel.inspector.cookies.edit.field.hostOnly': 'Host-only',
  'panel.inspector.cookies.edit.namePlaceholder': 'Cookie 名称',
  'panel.inspector.cookies.edit.valuePlaceholder': '值或 {{variable}}',
  'panel.inspector.cookies.edit.session': 'Session',
  'panel.inspector.cookies.edit.onDate': '指定日期',
  'panel.inspector.cookies.edit.sameSite.unspecified': 'Unspecified',
  'panel.inspector.cookies.edit.sameSite.noRestriction': 'None (cross-site)',
  'panel.inspector.cookies.edit.sameSite.lax': 'Lax',
  'panel.inspector.cookies.edit.sameSite.strict': 'Strict',
  'panel.inspector.cookies.edit.flagOn': '开',
  'panel.inspector.cookies.edit.flagOff': '关',
  // Pre-write constraint sentences — the __Host- / __Secure- prefixes
  // and path “/” ride raw inside; the SameSite label feeds through a
  // hole so the sentence can never drift from the select option.
  'panel.inspector.cookies.edit.constraint.hostSecure': '带 __Host- 前缀的 Cookie 必须开启 Secure 标志。',
  'panel.inspector.cookies.edit.constraint.hostDomain':
    '带 __Host- 前缀的 Cookie 不能携带 Domain 属性——请开启 “Host only”。',
  'panel.inspector.cookies.edit.constraint.hostPath': '带 __Host- 前缀的 Cookie 必须使用路径 “/”。',
  'panel.inspector.cookies.edit.constraint.securePrefix': '带 __Secure- 前缀的 Cookie 必须开启 Secure 标志。',
  'panel.inspector.cookies.edit.constraint.sameSiteNone': 'SameSite 为 “{label}” 时要求开启 Secure 标志。',
  // Merge parse-back errors — rendered inline in the merge modal. The
  // quoted field names are the JSON projection's raw keys; the quoted
  // vocabulary words feed through holes from the keys above.
  'panel.inspector.cookies.edit.merge.invalidJson': '合并结果不是有效的 JSON——修正语法后重新完成合并。',
  'panel.inspector.cookies.edit.merge.notObject': '合并结果必须是包含该 Cookie 各字段的 JSON 对象。',
  'panel.inspector.cookies.edit.merge.fieldMissing': '"{field}" 必须以字符串形式存在。',
  'panel.inspector.cookies.edit.merge.flagOnOff': '"{field}" 必须是 "{on}" 或 "{off}"。',
  'panel.inspector.cookies.edit.merge.sameSiteOneOf': '"sameSite" 必须是 {labels} 之一。',
  'panel.inspector.cookies.edit.merge.expiresInvalid': '"expires" 必须是 "{session}"，或形如 2026-07-09T14:30 的日期。',

  // Edit-form field (i) corpus — titles are the raw attribute names;
  // the shared template note keys once and composes with ' '.
  'panel.inspector.cookies.fieldInfo.exampleCaption': '示例 Set-Cookie',
  'panel.inspector.cookies.fieldInfo.fieldKicker': 'Cookie 字段',
  'panel.inspector.cookies.fieldInfo.flagKicker': 'Cookie 标志',
  'panel.inspector.cookies.fieldInfo.templateNote':
    '接受 {{variable}} 引用，在你保存时解析一次——罐中存储的是解析后的文本。',
  'panel.inspector.cookies.fieldInfo.name.summary':
    'Cookie 的标识符。浏览器以（name、domain、path）为键——名称相同但作用范围不同的是另一个 Cookie。',
  'panel.inspector.cookies.fieldInfo.name.description':
    '前缀由浏览器强制执行：__Host- 要求 Secure、Path=/ 且没有 Domain；__Secure- 要求 Secure。',
  'panel.inspector.cookies.fieldInfo.value.summary': 'Cookie 的负载——浏览器在 Cookie 标头中送回的内容。',
  'panel.inspector.cookies.fieldInfo.value.description':
    '该值是一个快照：即使变量之后发生变化，罐中保留的仍是这段文本——如果值应当跟随变量变化，请使用“覆盖 Cookie”规则。',
  'panel.inspector.cookies.fieldInfo.domain.summary': '哪些主机会收到该 Cookie。',
  'panel.inspector.cookies.fieldInfo.domain.description':
    '像 openheaders.com 这样的普通域名包含其子域（浏览器存储时带前导点），除非开启 Host-only——它会把 Cookie 严格固定在此主机上。',
  'panel.inspector.cookies.fieldInfo.path.summary':
    'Cookie 所附着的 URL 路径前缀——/api 表示只有 /api 下的请求才携带它。',
  'panel.inspector.cookies.fieldInfo.path.description': '默认为 /。',
  'panel.inspector.cookies.fieldInfo.expires.summary': '浏览器删除该 Cookie 的时间。',
  'panel.inspector.cookies.fieldInfo.expires.description':
    'Session Cookie 存活到浏览器会话结束；“指定日期”设置绝对过期时间（存储为 Expires 属性）。',
  'panel.inspector.cookies.fieldInfo.samesite.summary': '跨站请求何时可以携带该 Cookie。',
  'panel.inspector.cookies.fieldInfo.samesite.valuesHeading': '取值',
  'panel.inspector.cookies.fieldInfo.samesite.strict': '仅同站请求。',
  'panel.inspector.cookies.fieldInfo.samesite.lax': '同站请求，外加顶级跨站导航（GET）。',
  'panel.inspector.cookies.fieldInfo.samesite.none': '跨站也发送——浏览器要求同时开启 Secure。',
  'panel.inspector.cookies.fieldInfo.samesite.unspecified': '浏览器默认值（Chrome 中按 Lax 处理）。',
  'panel.inspector.cookies.fieldInfo.httponly.summary':
    '对页面 JavaScript 隐藏该 Cookie——document.cookie 无法读取或改写它。',
  'panel.inspector.cookies.fieldInfo.httponly.description':
    '只有服务器（Set-Cookie）和此编辑器能创建 HttpOnly Cookie；页面脚本不能。这是会话 token 的标准加固手段。',
  'panel.inspector.cookies.fieldInfo.secure.summary': '该 Cookie 只通过 HTTPS 传输——明文 http 请求绝不会携带它。',
  'panel.inspector.cookies.fieldInfo.secure.description': 'SameSite=None 以及 __Host- / __Secure- 名称前缀都要求它。',
  'panel.inspector.cookies.fieldInfo.hostonly.summary': '把该 Cookie 严格固定在 Domain 主机上——子域收不到它。',
  'panel.inspector.cookies.fieldInfo.hostonly.description':
    '关闭时，Cookie 以域级形式存储（前导点形式）并流向子域。服务器省略 Domain 属性时，浏览器自身的 Cookie 就是 host-only 的。',

  // Column (i) corpus — column-name titles stay raw; the Sec cell's
  // long title keys whole (glyph letters ride inside).
  'panel.inspector.cookies.columnInfo.name.summary':
    'Cookie 的标识符。浏览器以（name、domain、path）为键——名称相同但作用范围不同的是两个不同的 Cookie。',
  'panel.inspector.cookies.columnInfo.name.description':
    '右侧的标记片展示不在任何列中的信息。它们出现在名称旁；悬停一行可在值上显示“覆盖”操作。',
  'panel.inspector.cookies.columnInfo.name.roleHeading': '角色（启发式判断）',
  'panel.inspector.cookies.columnInfo.name.authDesc':
    '疑似身份验证 / 会话 Cookie——名称匹配 sess / session / auth / sid / token / csrf / xsrf，或该 Cookie 为 HttpOnly 且带有较长的随机值。',
  'panel.inspector.cookies.columnInfo.name.trackingDesc':
    '疑似分析 / 跟踪 Cookie——名称匹配已知跟踪器（_ga、_gid、_fbp、NID、IDE、MUID、_hjid 等），或该 Cookie 为第三方且没有其他归类。',
  'panel.inspector.cookies.columnInfo.name.prefDesc':
    '用户偏好 Cookie——tz、lang、locale、theme、color-mode、currency、cpu-bucket、font-size 等。',
  'panel.inspector.cookies.columnInfo.name.lifecycleHeading': '生命周期',
  'panel.inspector.cookies.columnInfo.name.justSetDesc': 'Set-Cookie 随此响应到达，浏览器已接受它。',
  'panel.inspector.cookies.columnInfo.name.droppedDesc':
    'Set-Cookie 已到达，但浏览器将拒绝它——违反了某条规则，如 SameSite=None 且没有 Secure、违反 __Host- 前缀要求、__Secure- 前缀没有 Secure，或 Partitioned 没有 Secure。',
  'panel.inspector.cookies.columnInfo.name.filteredOutDesc':
    '罐中存有此 Cookie，但它未在此请求上发送（路径不匹配、Secure 遇到 http、已过期、SameSite 限制等）。仅在开启“显示被筛除的请求 Cookie”时出现。',
  'panel.inspector.cookies.columnInfo.name.contextHeading': '上下文',
  'panel.inspector.cookies.columnInfo.name.thirdPartyDesc': '该 Cookie 的域相对于页面顶层框架的源是跨站的。',
  'panel.inspector.cookies.columnInfo.name.partitionedDesc':
    'CHIPS 式隔离——该 Cookie 除自身作用范围外，还以顶级站点为键。悬停查看分区键。',
  'panel.inspector.cookies.columnInfo.name.problemDesc':
    '此 Cookie 触发了一条洞察（标签页顶部的警告卡片）。查看提示卡了解原因。',
  'panel.inspector.cookies.columnInfo.name.prefixesHeading': '前缀（在名称中可见）',
  'panel.inspector.cookies.columnInfo.name.hostPrefixDesc':
    '锁定主机——浏览器强制 Secure、Path=/、无 Domain。违反者被拒绝。',
  'panel.inspector.cookies.columnInfo.name.securePrefixDesc': '仅限 HTTPS——浏览器强制 Secure。违反者被拒绝。',
  'panel.inspector.cookies.columnInfo.value.summary': 'Cookie 的负载。当值携带结构时，点击一行可展开带解析视图的面板。',
  'panel.inspector.cookies.columnInfo.value.formatsHeading': '自动检测的格式',
  'panel.inspector.cookies.columnInfo.value.jwtDesc':
    '三段 base64url——头部和负载会被解码；exp / iat / nbf 声明以相对时间显示。',
  'panel.inspector.cookies.columnInfo.value.jsonDesc': '在展开面板中美化打印（URL 解码之后同样适用）。',
  'panel.inspector.cookies.columnInfo.value.b64Desc': '普通 base64——内容可打印时显示解码结果。',
  'panel.inspector.cookies.columnInfo.value.urlEncodedDesc':
    '百分号编码的文本——在“视图”中开启“解码 URL 编码的值”即可就地显示解码结果。',
  'panel.inspector.cookies.columnInfo.scope.summary': '浏览器附加此 Cookie 的位置——Domain 与 Path 的组合。',
  'panel.inspector.cookies.columnInfo.scope.description':
    '域名带前导点（例如 `.openheaders.com`）表示包含子域。带路径后缀（如 `/api`）表示该 Cookie 只在该路径下的请求上发送。',
  'panel.inspector.cookies.columnInfo.expires.summary': '浏览器停止发送此 Cookie 的时间。颜色反映紧迫程度。',
  'panel.inspector.cookies.columnInfo.expires.colorHeading': '颜色含义',
  'panel.inspector.cookies.columnInfo.expires.red': '红色',
  'panel.inspector.cookies.columnInfo.expires.redDesc': '已经过期，或在一小时内过期。',
  'panel.inspector.cookies.columnInfo.expires.yellow': '黄色',
  'panel.inspector.cookies.columnInfo.expires.yellowDesc': '将在 24 小时内过期。',
  'panel.inspector.cookies.columnInfo.expires.plain': '无色',
  'panel.inspector.cookies.columnInfo.expires.plainDesc': '未来——距离过期超过一天。',
  'panel.inspector.cookies.columnInfo.expires.sessionDesc': '没有 Expires / Max-Age——会话结束时浏览器会丢弃它。',
  'panel.inspector.cookies.columnInfo.expires.formatHeading': '格式',
  'panel.inspector.cookies.columnInfo.expires.relativeLabel': '相对（默认）',
  'panel.inspector.cookies.columnInfo.expires.relativeDesc': '如 “in 7mo”、“30s ago”——相对于现在。悬停查看绝对日期。',
  'panel.inspector.cookies.columnInfo.expires.absoluteLabel': '绝对',
  'panel.inspector.cookies.columnInfo.expires.absoluteDesc': 'UTC 日期。在“视图 → 过期时间”中切换。',
  'panel.inspector.cookies.columnInfo.size.summary':
    '序列化后的 Cookie 大小（字节）——即 `name=value` 的长度，用于计算每个请求的负载总量。',
  'panel.inspector.cookies.columnInfo.size.description':
    '多数服务器和中间设备把合并后的 Cookie 标头上限设为 4 KB。超大负载可能导致 4xx / 5xx 响应，且没有明确的错误提示。',
  'panel.inspector.cookies.columnInfo.sec.title': '安全（S H L）',
  'panel.inspector.cookies.columnInfo.sec.summary':
    '三个字形把 Secure / HttpOnly / SameSite 属性压缩进一个单元格。颜色承载含义。',
  'panel.inspector.cookies.columnInfo.sec.glyphsHeading': '字形',
  'panel.inspector.cookies.columnInfo.sec.sDesc': 'Secure——只通过 HTTPS 发送。',
  'panel.inspector.cookies.columnInfo.sec.hDesc': 'HttpOnly——JavaScript 无法读取。',
  'panel.inspector.cookies.columnInfo.sec.lDesc': 'SameSite 限制（Lax / Strict / None）。',
  'panel.inspector.cookies.columnInfo.sec.colorHeading': '颜色',
  'panel.inspector.cookies.columnInfo.sec.green': '绿色',
  'panel.inspector.cookies.columnInfo.sec.greenDesc': '开启 / 严格——已锁定。',
  'panel.inspector.cookies.columnInfo.sec.yellow': '黄色',
  'panel.inspector.cookies.columnInfo.sec.yellowDesc': 'Lax——在顶级跨站 GET 上发送。',
  'panel.inspector.cookies.columnInfo.sec.red': '红色',
  'panel.inspector.cookies.columnInfo.sec.redDesc':
    '在必需处缺失（SameSite=None 没有 Secure、__Host- 没有 Secure 等）——浏览器将拒绝。',
  'panel.inspector.cookies.columnInfo.sec.gray': '灰色',
  'panel.inspector.cookies.columnInfo.sec.grayDesc': '关闭 / 未指定。',

  // Cookie insights (t-fed `computeCookieInsights`). Names, origins,
  // byte figures and attribute vocabulary ride as raw holes / inline.
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 个 Cookie 设置了 SameSite=None 但缺少 Secure',
    }),
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.detail':
    '现代浏览器会拒绝 SameSite=None 但没有同时设置 Secure 的 Cookie——它们不会被存储。',
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.action': '添加 Secure 属性',
  'panel.inspector.cookies.insights.hostPrefix.title': '{names} 违反了 __Host- 前缀要求',
  'panel.inspector.cookies.insights.hostPrefix.detail':
    '带 __Host- 前缀的 Cookie 必须为 Secure、Path=/，且没有 Domain 属性。否则浏览器会拒绝它们。',
  'panel.inspector.cookies.insights.securePrefix.title': '{names} 违反了 __Secure- 前缀要求',
  'panel.inspector.cookies.insights.securePrefix.detail':
    '带 __Secure- 前缀的 Cookie 必须携带 Secure 属性。否则浏览器会拒绝它们。',
  'panel.inspector.cookies.insights.partitionedNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 个 Partitioned Cookie 缺少 Secure',
    }),
  'panel.inspector.cookies.insights.partitionedNoSecure.detail': 'Partitioned Cookie 必须为 Secure。',
  'panel.inspector.cookies.insights.setOnHttp.title': '通过明文 HTTP 设置的 Cookie',
  'panel.inspector.cookies.insights.setOnHttp.detail':
    '路径上的任何人都能观测并重放这些 Cookie。请使用 HTTPS 加上 Secure 属性。',
  'panel.inspector.cookies.insights.expiredSent.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 个已过期的 Cookie 仍在发送',
    }),
  'panel.inspector.cookies.insights.expiredSent.detail':
    '这些 Cookie 的过期时间已过，但请求仍携带了它们——罐很快会丢弃它们。',
  'panel.inspector.cookies.insights.oversized.title': 'Cookie 标头为 {bytes}B（超过 4KB 的常见上限）',
  'panel.inspector.cookies.insights.oversized.detail':
    '服务器和中间设备会限制标头大小；超大的 Cookie 负载可能导致 4xx / 5xx，且没有明确的错误提示。',
  'panel.inspector.cookies.insights.thirdPartySet.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '设置了 {count} 个第三方 Cookie',
    }),
  'panel.inspector.cookies.insights.thirdPartySet.titleBy': ({ count, origin }, locale) => {
    const lead = plural(locale, Number(count), {
      other: '设置了 {count} 个第三方 Cookie',
    });
    return `${String(origin)} ${lead}`;
  },
  'panel.inspector.cookies.insights.thirdPartySet.detail':
    '除非通过 Partitioned 属性选择加入 CHIPS，现代浏览器可能会在跨站上下文中拦截这些 Cookie。',
} as const satisfies Catalog;
