/**
 * DevTools panel — inspector Headers tab — Simplified Chinese. Mirrors
 * `catalogs/en/panel-inspector-headers.ts` key for key. Header names,
 * category names, directive tokens, filter grammar tokens (name: /
 * value: / is:), Set-Cookie / SameSite / JWT / alg / scheme
 * vocabulary, `A → Z` / `Train-Case`, and wire values stay raw.
 * Mints: 临时标头 = provisional headers (Chrome zh-CN vocabulary);
 * 噪声标头 = noise headers; 常规 = the General section; 区间 = status
 * ranges (numeric referent — distinct from the 作用域/范围/覆盖范围
 * splits); 按域变量 = per-domain variable; 头部 = the JWT header
 * segment (distinct from HTTP 标头); 声明 = JWT claim; 匹配的规则 =
 * Matched Rules; 乱码 = mojibake; multipart rides raw (multipart 边界).
 * Expiry rides the 过期/已过期 family (shared-info-cookies mint);
 * 拦截 = block carried from the shared register.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorHeaders = {
  // ── Headers tab (inspector detail). Raw by design: header names and
  // values, filter grammar tokens inside the placeholder (name: /
  // value: / is: must survive translation verbatim), header category
  // labels (shared registry lock — category names never localize),
  // Set-Cookie / SameSite / JWT / alg / scheme / cache-directive chip
  // vocabulary, the `exp {duration}` and `boundary` chips, the ALPN
  // hover title, General row wire values, and the ▾ / → / ⚠ / · / +
  // glyphs beside keyed values. General row labels are keyed —
  // info-table labels (section-tab shading), not the network-table
  // parity lock, whose scope is hot-path column headers. ─────────────
  'panel.inspector.headers.filterPlaceholder':
    '筛选——文本、name:cookie、value:no-cache、is:rule、is:security、is:overridable、…',
  'panel.inspector.headers.filterAria': '筛选标头',
  'panel.inspector.headers.footprintTitle': '{rules}——点击打开“匹配的规则”',

  // General section + the rule-creation CTAs on its summary. The
  // query-params CTA label reuses `panel.inspector.overrideCta.
  // overrideQueryParams` (same control, same popover); its hover title
  // is this surface's own sentence.
  'panel.inspector.headers.generalSection': '常规',
  'panel.inspector.headers.createApiRequest': '创建 API 请求',
  'panel.inspector.headers.createApiRequestTitle':
    '在工作区编辑器的 API 客户端中把此请求作为预填充的草稿打开——在你保存之前不会保存任何内容',
  'panel.inspector.headers.redirect.label': '重定向',
  'panel.inspector.headers.redirect.title': '把匹配的请求发送到别处——选择目标的预填充方式',
  'panel.inspector.headers.redirect.url': '重定向 URL…',
  'panel.inspector.headers.redirect.urlTitle': '把匹配的请求发送到不同的 URL——目标会作为按域变量预填充',
  'panel.inspector.headers.redirect.replaceHost': '替换主机…',
  'panel.inspector.headers.redirect.replaceHostTitle': '保留路径和查询，换掉主机——预填充一个按域主机变量',
  'panel.inspector.headers.redirect.localhost': '指向 localhost…',
  'panel.inspector.headers.redirect.localhostTitle':
    '保留路径和查询，通过 http 发送到你本地的开发服务器——预填充一个按域端口变量',
  'panel.inspector.headers.overrideQueryParamsTitle': '添加、替换或移除此请求的查询参数',
  'panel.inspector.headers.more.label': '更多',
  'panel.inspector.headers.more.title': '更多请求操作',
  'panel.inspector.headers.more.delay': '延迟请求',
  'panel.inspector.headers.more.delayTitle': '延迟此请求',
  'panel.inspector.headers.more.block': '拦截请求',
  'panel.inspector.headers.more.blockTitle': '拦截 / 取消此请求',

  // General rows. The (i) corpus titles reuse these row-label keys and
  // the kicker reuses `generalSection` (names-its-control).
  'panel.inspector.headers.general.requestUrl': '请求 URL',
  'panel.inspector.headers.general.requestMethod': '请求方法',
  'panel.inspector.headers.general.statusCode': '状态码',
  'panel.inspector.headers.general.remoteAddress': '远程地址',
  'panel.inspector.headers.general.httpVersion': 'HTTP 版本',
  'panel.inspector.headers.general.compression': '压缩',
  'panel.inspector.headers.general.transferred': '已传输',
  'panel.inspector.headers.general.referrerPolicy': 'Referrer 策略',
  'panel.inspector.headers.general.decodedSuffix': '（解码后 {size}）',

  // General (i) corpus. Range/protocol/encoding item LABELS (1xx…,
  // HTTP/2, gzip…) are wire vocabulary and stay raw in the builder;
  // the Common values heading reuses the shared header-corpus key.
  'panel.inspector.headers.generalInfo.requestUrl.summary':
    '浏览器发出请求所针对的完整 URL——协议、主机、路径和查询字符串。',
  'panel.inspector.headers.generalInfo.requestMethod.summary':
    '所使用的 HTTP 方法（`GET`、`POST`、`PUT`、`DELETE`、…）。',
  'panel.inspector.headers.generalInfo.statusCode.summary': '服务器返回的数字响应代码。',
  'panel.inspector.headers.generalInfo.statusCode.ranges': '区间',
  'panel.inspector.headers.generalInfo.statusCode.r1xx': '信息性（少见——`100 Continue`、`103 Early Hints`）。',
  'panel.inspector.headers.generalInfo.statusCode.r2xx': '成功。',
  'panel.inspector.headers.generalInfo.statusCode.r3xx': '重定向（查看 `Location` 标头）。',
  'panel.inspector.headers.generalInfo.statusCode.r4xx': '客户端错误——请求格式有误或未获授权。',
  'panel.inspector.headers.generalInfo.statusCode.r5xx': '服务器错误——服务器未能完成一个有效的请求。',
  'panel.inspector.headers.generalInfo.remoteAddress.summary': '请求实际发送到的 IP 地址和端口。',
  'panel.inspector.headers.generalInfo.remoteAddress.description':
    '当 DNS 解析出多个 IP、CDN 通过 anycast 路由、或本地代理拦截连接时，会与 URL 中的主机不同。',
  'panel.inspector.headers.generalInfo.httpVersion.summary': '此连接协商出的 HTTP 协议版本。',
  'panel.inspector.headers.generalInfo.httpVersion.description':
    '在 TLS 阶段通过 ALPN 选定。当实际的线路值（例如 `h2`、`h3`）与友好标签不同时，会显示在悬停提示中。',
  'panel.inspector.headers.generalInfo.httpVersion.http11': '基于文本，默认每个连接一次只处理一个请求。',
  'panel.inspector.headers.generalInfo.httpVersion.http2': '二进制，在单个 TCP 连接上多路复用。',
  'panel.inspector.headers.generalInfo.httpVersion.http3': '构建在基于 UDP 的 QUIC 之上——握手更快，丢包恢复更好。',
  'panel.inspector.headers.generalInfo.compression.summary':
    '服务器对响应体应用的编码——浏览器在暴露给 JavaScript 之前会先解码。',
  'panel.inspector.headers.generalInfo.compression.gzip': '得到普遍支持，压缩率一般。',
  'panel.inspector.headers.generalInfo.compression.br': 'Brotli——压缩率优于 gzip，所有现代浏览器都支持。',
  'panel.inspector.headers.generalInfo.compression.zstd': '较新的高压缩率算法；浏览器支持度在增长。',
  'panel.inspector.headers.generalInfo.compression.deflate': '遗留格式，如今很少使用。',
  'panel.inspector.headers.generalInfo.transferred.summary': '实际经过线路的字节数，包含压缩开销。',
  'panel.inspector.headers.generalInfo.transferred.description':
    '括号中显示的解码后大小，是浏览器解压响应体之后 JavaScript 所看到的大小。两者差距越大，压缩收益越大。',
  'panel.inspector.headers.generalInfo.referrerPolicy.summary':
    '浏览器在从此页面发出的导航和请求中，在 `Referer` 里发送多少 URL 信息。',
  'panel.inspector.headers.generalInfo.referrerPolicy.description':
    '通过 `Referrer-Policy` 响应标头、`<meta name="referrer">` 标签或按请求的 `referrerpolicy` 属性设置。',

  // Provisional request headers — banner variants are whole sentences.
  'panel.inspector.headers.provisional.bannerCached':
    '当前显示的是临时标头——由缓存提供服务，因此原始发送的标头未被存储。',
  'panel.inspector.headers.provisional.bannerPending': '当前显示的是临时标头——线路上的实际标头集尚未确认。',
  'panel.inspector.headers.provisional.title': '临时标头',
  'panel.inspector.headers.provisional.kicker': '请求',
  'panel.inspector.headers.provisional.summary':
    '这些是浏览器组装并打算发送的标头——不是对实际经过线路内容的确认捕获。线路上的实际集合可能不同（网络栈稍后会补充 Cookie、凭据和连接标头）。',
  'panel.inspector.headers.provisional.whyHeading': '为什么请求只显示临时标头',
  'panel.inspector.headers.provisional.cacheLabel': '由缓存提供服务',
  'panel.inspector.headers.provisional.cacheDesc':
    '在本地应答（内存/磁盘缓存或 Service Worker）——这次没有任何内容经过线路，因此原始发送的标头从未被存储。',
  'panel.inspector.headers.provisional.blockedLabel': '从未到达网络',
  'panel.inspector.headers.provisional.blockedDesc':
    '在标头交换完成之前就被拦截或失败（URL 无效、CORS/CSP 拦截、连接错误）。',
  'panel.inspector.headers.provisional.inFlightLabel': '仍在进行中',
  'panel.inspector.headers.provisional.inFlightDesc': '线路上的实际集合尚未上报；请求完成后即会确定。',

  // Header sections. The `SectionLabel` identifiers stay raw (the
  // search plane compares against them — S36 doc-identifier law);
  // these are their display forms, mapped at the render site.
  'panel.inspector.headers.section.responseHeaders': '响应标头',
  'panel.inspector.headers.section.requestHeaders': '请求标头',
  'panel.inspector.headers.section.countAria': '可见标头数量',
  'panel.inspector.headers.section.addHeader': '添加标头',
  'panel.inspector.headers.section.raw': '原始',
  'panel.inspector.headers.section.rawTitle': '以纯文本显示（Name: Value）',
  'panel.inspector.headers.section.copy': '复制',
  'panel.inspector.headers.section.copyAll': '全部复制',
  'panel.inspector.headers.section.copyFiltered': '复制筛选结果',
  'panel.inspector.headers.section.copyCurl': '复制为 cURL',
  'panel.inspector.headers.section.copyFetch': '复制为 fetch',
  'panel.inspector.headers.section.noneCaptured': '未捕获任何标头。',
  'panel.inspector.headers.section.noFilterMatch': '没有标头匹配该筛选条件。',
  'panel.inspector.headers.section.noiseHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '已隐藏 {count} 个噪声标头——悬停查看名称',
    }),

  // More filters ▾ / View ▾ menus — this tab's own menus, separate
  // referents from the network toolbar's (`panel.moreFilters.*` /
  // `panel.network.view.*`). Reset reuses `panel.menu.resetToDefault`.
  'panel.inspector.headers.moreFilters.label': '更多筛选',
  'panel.inspector.headers.moreFilters.ruleOnly': '仅规则修改过的',
  'panel.inspector.headers.moreFilters.securityOnly': '仅安全标头',
  'panel.inspector.headers.moreFilters.overridableOnly': '仅可覆盖的',
  'panel.inspector.headers.moreFilters.hideNoise': '隐藏噪声（Accept-*、Sec-Fetch-*、User-Agent、…）',
  'panel.inspector.headers.view.label': '视图',
  'panel.inspector.headers.view.layout': '布局',
  'panel.inspector.headers.view.layoutGrouped': '分组',
  'panel.inspector.headers.view.layoutFlat': '平铺',
  'panel.inspector.headers.view.sort': '排序',
  'panel.inspector.headers.view.sortOriginal': '原始顺序',
  'panel.inspector.headers.view.sortAz': 'A → Z',
  'panel.inspector.headers.view.sortRuleFirst': '规则修改过的优先',
  'panel.inspector.headers.view.nameCase': '名称大小写',
  'panel.inspector.headers.view.nameCaseTrain': 'Train-Case',
  'panel.inspector.headers.view.nameCaseOriginal': '原始（原样）',
  'panel.inspector.headers.view.showTags': '显示标签',
  'panel.inspector.headers.view.showSuggestions': '显示建议',

  // Header rows. Since-fire chips render `· ` raw before the keyed
  // label. Header names ride the override titles as {name} holes.
  'panel.inspector.headers.row.expandValue': '展开值',
  'panel.inspector.headers.row.collapseValue': '收起值',
  'panel.inspector.headers.row.copyValue': '复制值',
  'panel.inspector.headers.row.copied': '已复制',
  'panel.inspector.headers.row.edit': '编辑',
  'panel.inspector.headers.row.editTitle': '编辑设置此标头的规则',
  'panel.inspector.headers.row.override': '覆盖',
  'panel.inspector.headers.row.overrideTitle': '创建一条规则来覆盖此标头',
  'panel.inspector.headers.row.overrideProtectedTitle':
    '{name} 是受保护的标头——浏览器的 Declarative Net Request 引擎不允许扩展覆盖它。常见的受保护名称包括 host、content-length、connection、sec-fetch-*、sec-ch-ua-*。',
  'panel.inspector.headers.row.overrideSystemTitle':
    '{name} 由 {feature} 注入，这是 Open Headers 的系统功能——无法用规则覆盖。',
  'panel.inspector.headers.row.overrideManagedTitle':
    '{name} 已由你的一条规则管理——请从该规则的弹出框中编辑，而不是覆盖。',
  'panel.inspector.headers.row.systemTitle': '由 {feature} 注入（Open Headers 系统功能）',
  'panel.inspector.headers.row.sinceFire.deleted': '此后规则已删除',
  'panel.inspector.headers.row.sinceFire.deletedTitle': '此请求之后规则已被删除——它不会再应用于未来的请求',
  'panel.inspector.headers.row.sinceFire.disabled': '此后规则已禁用',
  'panel.inspector.headers.row.sinceFire.disabledTitle': '此请求之后规则已被禁用——它不会再应用于未来的请求',
  'panel.inspector.headers.row.sinceFire.edited': '此后规则已编辑',
  'panel.inspector.headers.row.sinceFire.editedTitle': '此请求之后规则已被编辑——当前规则只应用于未来的请求',
  'panel.inspector.headers.row.sinceFire.value': '此后变量已变化',
  'panel.inspector.headers.row.sinceFire.valueTitle': '此规则引用的某个变量现在解析为不同的值——只应用于未来的请求',

  // Value chips. Flag/attribute chip TEXTS (HttpOnly, SameSite=Lax,
  // JWT, alg, `exp {duration}`, cache-directive summaries, boundary)
  // are wire vocabulary and stay raw; only the UI-worded chips key.
  'panel.inspector.headers.chips.expires': '{duration} 后过期',
  'panel.inspector.headers.chips.session': '会话',
  'panel.inspector.headers.chips.missingFlag': '无 {flag}',
  'panel.inspector.headers.chips.expired': '已过期',

  // Chip (i) corpora. Titles that are wire vocabulary (HttpOnly,
  // SameSite=X, Cache-Control: …, Strict-Transport-Security, JWT,
  // scheme names) stay raw. Cache/HSTS directive descriptions reuse
  // the shared header corpus where the referent matches; the
  // parameterized ones (durations in the hole) live here.
  'panel.inspector.headers.chipInfo.setCookieFlagKicker': 'Set-Cookie 标志',
  'panel.inspector.headers.chipInfo.httpOnly.summary': 'Cookie 对 JavaScript 隐藏（无法通过 `document.cookie` 读取）。',
  'panel.inspector.headers.chipInfo.httpOnly.description':
    '可缓解 XSS——注入的脚本无法再窃取该 Cookie。对 CSRF 没有帮助。',
  'panel.inspector.headers.chipInfo.secure.summary': 'Cookie 只通过 HTTPS 发送。绝不会在明文 HTTP 上泄露。',
  'panel.inspector.headers.chipInfo.partitioned.summary': 'CHIPS——Cookie 按顶级站点分区存储。',
  'panel.inspector.headers.chipInfo.partitioned.description':
    '每个顶级站点都有该 Cookie 的独立副本，因此嵌入式上下文无法利用 Cookie 跨站跟踪用户。',
  'panel.inspector.headers.chipInfo.sameSiteStrict':
    'Cookie 只随同站请求发送。最强的 CSRF 防护——即使来自其他站点的链接也不携带 Cookie。',
  'panel.inspector.headers.chipInfo.sameSiteLax':
    'Cookie 随同站请求和顶级跨站导航（点击链接）发送。现代浏览器的默认值。',
  'panel.inspector.headers.chipInfo.sameSiteNone':
    'Cookie 随所有跨站请求发送。要求 `Secure`。请谨慎使用——接收方可以跨站关联该 Cookie。',
  'panel.inspector.headers.chipInfo.cookieExpiry.title': 'Cookie 过期时间',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiredSummary': '该 Cookie 已经过期。浏览器不会再发送它。',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiresSummary': '该 Cookie 将在 {duration} 后过期（于 {date}）。',
  'panel.inspector.headers.chipInfo.cookieExpiry.description':
    '不带 `Max-Age` 或 `Expires` 的 Cookie 是会话 Cookie，会在浏览器退出时消失。设置其中之一可让 Cookie 持久保存。',
  'panel.inspector.headers.chipInfo.sessionCookie.title': '会话 Cookie',
  'panel.inspector.headers.chipInfo.sessionCookie.summary':
    '没有 `Max-Age` 或 `Expires`——浏览器退出时会丢弃此 Cookie。',
  'panel.inspector.headers.chipInfo.sessionCookie.description':
    '添加 `Max-Age=<seconds>` 或 `Expires=<date>` 可让它跨浏览器会话持久保存。',
  'panel.inspector.headers.chipInfo.missingFlag.title': '缺少 {flag}',
  'panel.inspector.headers.chipInfo.missingFlag.kicker': '最佳实践',
  'panel.inspector.headers.chipInfo.missingFlag.secure':
    '不带 `Secure` 时，此 Cookie 可能在明文 HTTP 上泄露。HTTPS Cookie 应始终设置它。',
  'panel.inspector.headers.chipInfo.missingFlag.httpOnly':
    '不带 `HttpOnly` 时，JavaScript 可以通过 `document.cookie` 读取此 Cookie——一个 XSS 漏洞就能窃取它。',
  'panel.inspector.headers.chipInfo.missingFlag.sameSite':
    '不显式设置 `SameSite` 时，浏览器会回退到 `Lax`。显式声明能让策略在代码评审中一目了然。',
  'panel.inspector.headers.chipInfo.missingFlag.description':
    '大多数生产环境的 Cookie 都应带上 `Secure`、`HttpOnly` 和显式的 `SameSite`。',
  'panel.inspector.headers.chipInfo.cacheKicker': '缓存指令',
  'panel.inspector.headers.chipInfo.rawValue': '原始值：`{value}`。',
  'panel.inspector.headers.chipInfo.activeDirectives': '生效的指令',
  'panel.inspector.headers.chipInfo.maxAge': '在 {duration} 内保持新鲜。',
  'panel.inspector.headers.chipInfo.sMaxage': '共享缓存新鲜期：{duration}。',
  'panel.inspector.headers.chipInfo.staleWhileRevalidate': '允许在后台重新验证运行期间，把陈旧内容再使用 {duration}。',
  'panel.inspector.headers.chipInfo.contentTypeParamKicker': 'Content-Type 参数',
  'panel.inspector.headers.chipInfo.charset.summary': '响应体使用的字符编码。',
  'panel.inspector.headers.chipInfo.charset.description':
    '对 `text/*` 类型，现代技术栈默认 `utf-8`。错误的值会导致乱码。',
  'panel.inspector.headers.chipInfo.boundary.title': 'multipart 边界',
  'panel.inspector.headers.chipInfo.boundary.summary':
    '分隔 multipart 主体各部分的 token（文件上传、multipart/form-data）。',
  'panel.inspector.headers.chipInfo.boundary.description': '由客户端生成；不得出现在任何部分的主体内容中。',
  'panel.inspector.headers.chipInfo.hsts.kicker': '安全策略',
  'panel.inspector.headers.chipInfo.hsts.summary': '浏览器将在 {duration} 内对此主机强制使用 HTTPS。',
  'panel.inspector.headers.chipInfo.authSchemeKicker': '授权方案',
  'panel.inspector.headers.chipInfo.jwt.summary':
    'JSON Web Token——经 base64 编码的 `<header>.<payload>.<signature>` 三元组。',
  'panel.inspector.headers.chipInfo.jwt.description':
    '签名证明该 token 由持有签名密钥的一方签发。头部（alg、typ）和负载（claims）并未加密——它们只是 base64 编码，任何人都能读取。',
  'panel.inspector.headers.chipInfo.jwtHeaderKicker': 'JWT 头部',
  'panel.inspector.headers.chipInfo.jwtClaimKicker': 'JWT 声明',
  'panel.inspector.headers.chipInfo.jwtAlg.summary': 'JWT 头部中声明的签名算法。',
  'panel.inspector.headers.chipInfo.jwtAlg.description':
    '常见值：`HS256`（HMAC-SHA256，对称）、`RS256`（RSA，非对称）、`ES256`（ECDSA）。`none`（无签名）应始终被验证方拒绝。',
  'panel.inspector.headers.chipInfo.jwtExpired.title': 'JWT 已过期',
  'panel.inspector.headers.chipInfo.jwtExpired.summary': '该 token 已在 {duration} 前过期。服务器应当拒绝它。',
  'panel.inspector.headers.chipInfo.jwtExpires.title': 'JWT 将在 {duration} 后过期',
  'panel.inspector.headers.chipInfo.jwtExpires.soonSummary': 'token 即将过期——请刷新它，或准备好很快收到 401。',
  'panel.inspector.headers.chipInfo.jwtExpires.summary': '距 JWT `exp` 声明到期的时间。',
  'panel.inspector.headers.chipInfo.scheme.bearer':
    '不透明的持有者凭据（OAuth 2.0 / API token）。请像密码一样对待它——任何持有它的人都能以该用户身份进行验证。',
  'panel.inspector.headers.chipInfo.scheme.basic':
    'HTTP Basic 身份验证——`base64(username:password)`。只有在 HTTPS 上才安全。',
  'panel.inspector.headers.chipInfo.scheme.other': '身份验证方案名称。凭据格式取决于具体方案。',

  // Header insights (t-fed `computeHeaderInsights`). Origins, cookie
  // names, HSTS summaries, and durations ride as raw holes.
  'panel.inspector.headers.insights.corsWildcard.title': 'CORS 配置有误',
  'panel.inspector.headers.insights.corsWildcard.detail':
    '`Access-Control-Allow-Origin: *` 不能与凭据同时使用——浏览器会拒绝此响应。',
  'panel.inspector.headers.insights.corsWildcard.action': '用 {origin} 覆盖',
  'panel.inspector.headers.insights.corsMissingAcao.title': 'CORS 请求缺少 Access-Control-Allow-Origin',
  'panel.inspector.headers.insights.corsMissingAcao.detail':
    '请求携带了 `Origin: {origin}`，但响应中没有 `Access-Control-Allow-Origin`。浏览器会拦截此响应。',
  'panel.inspector.headers.insights.corsMissingAcao.action': '添加 Access-Control-Allow-Origin: {origin}',
  'panel.inspector.headers.insights.cookieMissingSecure.titleOne': 'Cookie `{name}` 缺少 `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.titleMany': '{count} 个 Cookie 缺少 `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.detail':
    '通过 HTTPS 设置的 Cookie 应带上 `Secure`，这样它们就不会在明文 HTTP 上被发送。',
  'panel.inspector.headers.insights.missingCsp.title': 'HTML 响应没有 Content-Security-Policy',
  'panel.inspector.headers.insights.missingCsp.action': '添加基线 CSP',
  'panel.inspector.headers.insights.hstsShort.title': 'HSTS max-age 非常短（{summary}）',
  'panel.inspector.headers.insights.hstsShort.detail': '多数策略建议至少 6 个月；preload 要求 1 年。',
  'panel.inspector.headers.insights.jwtExpired.title': 'Authorization 标头中的 JWT 已过期',
  'panel.inspector.headers.insights.jwtExpired.detail': '已在 {duration} 前过期。',
  'panel.inspector.headers.insights.jwtExpiring.title': 'JWT 将在 {duration} 后过期',
  'panel.inspector.headers.insights.missingContentType.title': '响应没有 Content-Type',
  'panel.inspector.headers.insights.missingContentType.action': '添加 Content-Type',
} as const satisfies Catalog;
