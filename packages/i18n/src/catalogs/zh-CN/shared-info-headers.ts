/**
 * Shared info-popover corpus — HTTP headers — Simplified Chinese.
 * Mirrors `catalogs/en/shared-info-headers.ts` key for key; wire
 * vocabulary (header names, directive keys, common values, backticked
 * code) stays raw — only prose translates. Mints: 源 = origin (the
 * web-platform referent) vs 源服务器 = origin server; 预检 = preflight
 * (Chrome zh-CN vocabulary); 指令 = directive (section label 指令);
 * 常见值 = common values; 重新验证 = revalidate; 嗅探 = sniffing;
 * 热链接 = hotlink; 爬虫 = crawler; 边缘 = edge (CDN tier) with
 * shield riding raw; 追踪 = tracing (distributed-trace referent,
 * distinct from 跟踪 = tracking); 注册表 carried from info-status;
 * Cookie 罐 carried from the shared register.
 */

import type { Catalog } from '../../types';

export const sharedInfoHeaders = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.header.kicker': '{direction} · {category}',
  'shared.info.header.direction.request': '请求标头',
  'shared.info.header.direction.response': '响应标头',
  'shared.info.header.direction.both': '请求/响应标头',
  'shared.info.header.section.directives': '指令',
  'shared.info.header.section.commonValues': '常见值',
  'shared.info.header.fallback.customCategory': '自定义或非标准',
  'shared.info.header.fallback.customSummary': '此标头是自定义的或非标准的——我们的注册表中没有相关文档。',
  'shared.info.header.fallback.unknownSummary': '{name} 尚未收录在我们的注册表中。该行将其归类为 {category}。',

  // ── auth ──────────────────────────────────────────────────────────────
  'shared.info.header.authorization.summary': '客户端向服务器进行身份验证的凭据。',
  'shared.info.header.authorization.body1':
    '格式：`<scheme> <credentials>`。常见方案：`Bearer <token>`（OAuth、JWT）、`Basic <base64(user:pass)>`、`Digest`。',
  'shared.info.header.proxyAuthorization.summary': '提供给中间代理（而非源服务器）的凭据。',
  'shared.info.header.proxyAuthorization.body1': '语法与 `Authorization` 相同，作用范围不同。',
  'shared.info.header.wwwAuthenticate.summary': '服务器的 401 质询——告诉客户端应使用哪种身份验证方案。',
  'shared.info.header.wwwAuthenticate.body1':
    '随 `401 Unauthorized` 发送。当方案为 `Basic` 时会触发浏览器的基本身份验证对话框。',
  'shared.info.header.proxyAuthenticate.summary':
    '`WWW-Authenticate` 的代理版本，随 `407 Proxy Authentication Required` 发送。',
  'shared.info.header.authenticationInfo.summary': '在成功时完成双向身份验证——Digest 身份验证用它来同时确认服务器。',

  // ── caching ───────────────────────────────────────────────────────────
  'shared.info.header.cacheControl.summary': '控制响应如何被缓存和重新验证的指令。',
  'shared.info.header.cacheControl.body1':
    '请求和响应都携带指令。多个以逗号分隔的 token 以“与”的方式组合。行为按指令逐一生效——此标头不是单一模式。',
  'shared.info.header.cacheControl.directive.noStore': '完全不缓存，任何地方都不缓存。',
  'shared.info.header.cacheControl.directive.noCache': '可以缓存，但每次重用前必须重新验证。',
  'shared.info.header.cacheControl.directive.public': '任何缓存都可以存储，包括共享缓存/CDN。',
  'shared.info.header.cacheControl.directive.private': '只有用户的浏览器可以存储。',
  'shared.info.header.cacheControl.directive.maxAgeN': '在 N 秒内保持新鲜；重用时无需联系源站。',
  'shared.info.header.cacheControl.directive.sMaxageN': '类似 max-age，但仅适用于共享缓存。',
  'shared.info.header.cacheControl.directive.mustRevalidate': '一旦过期，必须重新验证后才能提供。',
  'shared.info.header.cacheControl.directive.immutable': '承诺响应体在 max-age 期间不会改变。',
  'shared.info.header.cacheControl.directive.staleWhileRevalidateN': '允许在后台重新验证时重用过期内容。',
  'shared.info.header.pragma.summary': '旧式 HTTP/1.0 缓存控制——实际上已被 Cache-Control 取代。',
  'shared.info.header.pragma.body1':
    '一些客户端出于兼容性仍会设置 `Pragma: no-cache`。现代服务器应遵循 `Cache-Control` 并忽略 `Pragma`。',
  'shared.info.header.expires.summary': '响应被视为过期的绝对日期/时间。',
  'shared.info.header.expires.body1':
    '已被 `Cache-Control: max-age` 取代。两者都设置时，`max-age` 优先。用过去的日期（或 `0`）可强制重新获取。',
  'shared.info.header.etag.summary': '响应体的不透明标识符——用于重新验证缓存副本。',
  'shared.info.header.etag.body1':
    '客户端通过 `If-None-Match` 回传它。如果值仍然匹配，服务器回复不带响应体的 `304 Not Modified`。',
  'shared.info.header.ifMatch.summary': '条件请求：仅当资源的当前 ETag 匹配时才继续。',
  'shared.info.header.ifMatch.body1': '写操作用它来防止覆盖他人所做的更改（乐观并发）。',
  'shared.info.header.ifNoneMatch.summary': '条件请求：仅当资源的 ETag 发生变化时才继续。',
  'shared.info.header.ifNoneMatch.body1': '读操作用它来跳过下载未更改的响应——服务器回复 `304 Not Modified`。',
  'shared.info.header.ifModifiedSince.summary': '条件请求：仅当资源在给定日期之后发生更改时才继续。',
  'shared.info.header.ifModifiedSince.body1': '不如 `If-None-Match`/ETag 精确；可用时优先使用 ETag。',
  'shared.info.header.ifUnmodifiedSince.summary': '条件请求：仅当资源自给定日期以来未被修改时才继续。',
  'shared.info.header.lastModified.summary': '资源最后一次更改的日期/时间。',
  'shared.info.header.lastModified.body1': '与 `If-Modified-Since` 配合用于重新验证。',
  'shared.info.header.age.summary': '响应在共享缓存中已存在的秒数。',
  'shared.info.header.age.body1': '由 CDN 和代理返回；帮助客户端了解响应的新鲜度。',
  'shared.info.header.xCache.summary': 'CDN / 反向代理的缓存结果——格式因供应商而异（Varnish、Fastly、CloudFront）。',
  'shared.info.header.xCache.value.hit': '从缓存提供。',
  'shared.info.header.xCache.value.miss': '未缓存；从源站获取。',
  'shared.info.header.xCache.value.hitHit': '多个缓存层级全部命中（例如 shield + 边缘）。',
  'shared.info.header.xCacheHits.summary': '每个层级的缓存命中计数——供应商特定，常见于 Fastly。',
  'shared.info.header.xCacheHits.body1': '多个缓存层级参与时以逗号分隔。高计数说明是热门缓存行。',
  'shared.info.header.warning.summary':
    '附加的缓存上下文（过期、已应用转换等）。自 RFC 7234 起在 HTTP/1.1 中已废弃，但仍有服务器发出。',
  'shared.info.header.surrogateControl.summary':
    'Edge Side Includes 缓存控制——指挥 CDN，同时把浏览器缓存留给 `Cache-Control`。',
  'shared.info.header.surrogateControl.body1': '仅适用于支持 ESI 的缓存（Fastly、Akamai、部分配置下的 Varnish）。',
  'shared.info.header.surrogateCapability.summary': 'Edge 到源站的提示：代理缓存支持哪些 ESI 功能。',
  'shared.info.header.cfCacheStatus.summary': 'Cloudflare 对此请求的缓存结果。',
  'shared.info.header.cfCacheStatus.value.hit': '从 Cloudflare 缓存提供。',
  'shared.info.header.cfCacheStatus.value.miss': '不在缓存中；从源站获取。',
  'shared.info.header.cfCacheStatus.value.expired': '曾被缓存但已过期；已从源站刷新。',
  'shared.info.header.cfCacheStatus.value.bypass': '绕过了缓存（页面规则 / no-cache 标头）。',
  'shared.info.header.cfCacheStatus.value.dynamic': '默认不可缓存（Cookie、查询字符串等）。',
  'shared.info.header.cfCacheStatus.value.revalidated': '已缓存并已与源站重新验证（304）。',

  // ── client-hints ──────────────────────────────────────────────────────
  'shared.info.header.secChUa.summary': 'Client Hint：浏览器的品牌列表。',
  'shared.info.header.secChUa.body1': '对于服务器真正应该依赖的部分，它取代了自由格式的 `User-Agent`。',
  'shared.info.header.secChUaMobile.summary': 'Client Hint：移动设备为 `?1`，桌面为 `?0`。',
  'shared.info.header.secChUaPlatform.summary': 'Client Hint：用户的操作系统（`"Windows"`、`"macOS"`、`"Linux"` 等）。',
  'shared.info.header.userAgent.summary': '标识浏览器、操作系统和引擎的旧式自由格式字符串。',
  'shared.info.header.userAgent.body1':
    '每个请求仍会发送它。结构化的替代是 `Sec-CH-UA-*` 家族——当服务器关心浏览器身份时优先使用它们。',
  'shared.info.header.acceptCh.summary': '列出服务器希望在后续请求中收到的 Client Hint 标头。',
  'shared.info.header.acceptCh.body1': '浏览器只发送服务器在此选择接收的提示（低熵默认项除外）。',
  'shared.info.header.criticalCh.summary': '`Accept-CH` 中服务器视为关键的子集——浏览器会重新发起请求以包含它们。',
  'shared.info.header.criticalCh.body1': '请谨慎使用：每次 Critical-CH 未命中都要多一次往返。',
  'shared.info.header.saveData.summary': '用户在浏览器/操作系统中启用流量节省模式时为 `on`。',
  'shared.info.header.saveData.body1': '用它来提供低带宽资源（降低图片质量、推迟首屏以下的工作等）。',
  'shared.info.header.deviceMemory.summary':
    '设备内存的近似值（GiB），取整到一小组值（`0.25`、`0.5`、`1`、`2`、`4`、`8`）。',
  'shared.info.header.downlink.summary': '估算的下行带宽（Mbps），已取整。',
  'shared.info.header.ect.summary': '有效连接类型——`slow-2g`、`2g`、`3g` 或 `4g`。',
  'shared.info.header.rtt.summary': '估算的往返时间（毫秒），已取整。',

  // ── connection ────────────────────────────────────────────────────────
  'shared.info.header.connection.summary': '逐跳连接控制（`keep-alive`、`close`、`upgrade`）。',
  'shared.info.header.connection.body1':
    '代理在每一跳之间会剥离它。在 HTTP/2+ 中此标头被禁止——连接管理已内置于协议中。',
  'shared.info.header.keepAlive.summary': '连接池提示——通常为 `timeout=N, max=N`。',
  'shared.info.header.keepAlive.body1': '仅在 HTTP/1.1 上与 `Connection: keep-alive` 一起有意义。在 HTTP/2+ 中被忽略。',
  'shared.info.header.upgrade.summary': '请求在同一连接上切换协议（WebSocket、HTTP/2 明文）。',
  'shared.info.header.upgrade.body1': '与 `Connection: upgrade` 一起使用。WebSocket：`Upgrade: websocket`。',
  'shared.info.header.te.summary': '客户端可接受的传输编码（`trailers`、`gzip`、…）。',
  'shared.info.header.te.body1': '大多数现代客户端只发送 `TE: trailers` 以选择接收尾部标头。',
  'shared.info.header.expect.summary': '客户端期望服务器满足的前置条件（`100-continue`）。',
  'shared.info.header.expect.body1': '`Expect: 100-continue` 让客户端在服务器发出 `100 Continue` 信号后才发送请求体。',
  'shared.info.header.altSvc.summary': '通告到达同一源的其他方式（例如基于 QUIC 的 HTTP/3）。',
  'shared.info.header.altSvc.body1': '浏览器会缓存该通告，并可能在后续请求中切换到替代方式。',
  'shared.info.header.secWebsocketKey.summary': 'WebSocket 握手时发送的随机 base64 编码 nonce。',
  'shared.info.header.secWebsocketKey.body1':
    '服务器用此 key 加一个固定 GUID 派生出 `Sec-WebSocket-Accept` 作为回复，证明它理解 WebSocket。',
  'shared.info.header.secWebsocketAccept.summary':
    '服务器对 WebSocket 握手的证明——`SHA-1(Sec-WebSocket-Key + GUID)` 的 base64 编码。',
  'shared.info.header.secWebsocketVersion.summary': '客户端请求的 WebSocket 协议版本。几乎总是 `13`（RFC 6455）。',
  'shared.info.header.secWebsocketProtocol.summary':
    'WebSocket 的子协议协商——请求时为逗号分隔的列表，响应时为选定的单个值。',
  'shared.info.header.secWebsocketExtensions.summary':
    '协商后的 WebSocket 扩展（压缩等）——最常见的是 `permessage-deflate`。',

  // ── content ───────────────────────────────────────────────────────────
  'shared.info.header.contentType.summary': '请求体或响应体的媒体类型。',
  'shared.info.header.contentType.body1':
    '决定浏览器如何解析响应体——错误的值会导致静默失败（JSON 被当作 HTML 解析等）。',
  'shared.info.header.contentType.body2': '对于 `text/*` 类型，除非有理由不加，请包含 `charset=utf-8`。',
  'shared.info.header.contentType.value.applicationJson': 'JSON 体。',
  'shared.info.header.contentType.value.applicationXWwwFormUrlencoded': 'URL 编码的表单字段。',
  'shared.info.header.contentType.value.multipartFormData': '多部分表单 / 文件上传。',
  'shared.info.header.contentType.value.textHtmlCharsetUtf8': 'HTML 文档。',
  'shared.info.header.contentType.value.applicationOctetStream': '不透明的二进制。',
  'shared.info.header.contentLength.summary': '响应体大小（字节，解码后）。',
  'shared.info.header.contentLength.body1': '与 `Transfer-Encoding: chunked` 互斥。错误的值会导致连接失步。',
  'shared.info.header.contentEncoding.summary': '应用于响应体的压缩——浏览器在暴露给 JS 之前会先解码。',
  'shared.info.header.contentEncoding.body1':
    '常见：`gzip`、`br`（Brotli）、`zstd`（较新）。`response.body` 看到的是解码后的大小。',
  'shared.info.header.contentDisposition.summary': '告诉浏览器响应是内联显示还是下载。',
  'shared.info.header.contentDisposition.body1':
    '`inline`（默认）在浏览器中渲染。`attachment; filename="x"` 以给定的默认文件名触发下载。',
  'shared.info.header.accept.summary': '客户端愿意接收的媒体类型。',
  'shared.info.header.accept.body1': 'Q 值表达偏好（`text/html;q=0.9`）。如今大多数服务器只看第一个类型。',
  'shared.info.header.acceptEncoding.summary': '客户端能解码的压缩方式。',
  'shared.info.header.acceptEncoding.body1':
    '典型浏览器值：`gzip, deflate, br, zstd`。服务器选择一种并以 `Content-Encoding` 回答。',
  'shared.info.header.acceptLanguage.summary': '客户端偏好的自然语言。',
  'shared.info.header.acceptLanguage.body1': '服务器从此列表中选择一个 `Content-Language`，通常会回退到默认值。',
  'shared.info.header.transferEncoding.summary': '仅用于传输的编码——在响应体到达应用之前被剥离。',
  'shared.info.header.transferEncoding.body1': '几乎总是 `chunked`。与 `Content-Length` 互斥。',
  'shared.info.header.range.summary': '请求资源的某个字节范围，而不是整个响应体。',
  'shared.info.header.range.body1':
    '格式：`bytes=<start>-<end>`（含端点）。服务器以 `206 Partial Content` 和 `Content-Range` 响应。',
  'shared.info.header.contentRange.summary': '标识响应体中包含资源的哪个字节范围。',
  'shared.info.header.contentRange.body1': '格式：`bytes <start>-<end>/<total>`。随 `206 Partial Content` 返回。',
  'shared.info.header.acceptRanges.summary': '告诉客户端是否支持范围请求（`bytes`）或不支持（`none`）。',
  'shared.info.header.contentMd5.summary':
    '响应体的 Base64 编码 MD5 摘要，用于完整性检查。在 HTTP/1.1 RFC 7231 中已废弃，但仍有服务器发出。',
  'shared.info.header.contentMd5.body1': '现代的完整性检查通过 `Digest` / `Want-Digest` 或 TLS 本身完成。',
  'shared.info.header.contentLanguage.summary': '响应体的自然语言。',
  'shared.info.header.contentLanguage.body1':
    '与请求的 `Accept-Language` 协商得出。值是 BCP-47 标签（`en-US`、`de-DE` 等）。',
  'shared.info.header.contentLocation.summary': '唯一标识此响应中实体的备用 URL。',
  'shared.info.header.contentLocation.body1':
    '与 `Location` 不同：`Content-Location` 描述你得到的资源，而不是要重定向到哪里。',
  'shared.info.header.acceptCharset.summary':
    '客户端接受的字符编码。已废弃——现代浏览器总是发送 UTF-8，不再发出此标头。',
  'shared.info.header.acceptCharset.body1': '大多数服务器可以安全地忽略它。',
  'shared.info.header.ifRange.summary': '条件范围请求：仅当资源仍与给定的 ETag 或日期匹配时才提供该范围。',
  'shared.info.header.ifRange.body1':
    '如果资源已更改，服务器返回带 `200 OK` 的完整响应体，而不是 `206 Partial Content`。',
  'shared.info.header.trailer.summary': '声明哪些标头字段名会出现在分块响应体之后的尾部。',
  'shared.info.header.trailer.body1':
    '仅与 `Transfer-Encoding: chunked` 一起有意义。客户端必须通过 `TE: trailers` 选择接收。',

  // ── cookies ───────────────────────────────────────────────────────────
  'shared.info.header.cookie.summary': '浏览器随此请求发送的 Cookie，以分号分隔。',
  'shared.info.header.cookie.body1':
    "由浏览器从其 Cookie 罐中设置。JS 无法直接在 `fetch` 上设置——使用 `credentials: 'include'`。",
  'shared.info.header.setCookie.summary': '服务器下发的 Cookie 定义。',
  'shared.info.header.setCookie.body1': '每行 `Set-Cookie` 标头一个 Cookie。浏览器按（名称、域、路径）元组存储最新值。',
  'shared.info.header.setCookie.body2':
    '生产环境的 Cookie 应始终携带 `Secure`、`HttpOnly` 和显式的 `SameSite`（Lax 或 Strict）。',
  'shared.info.header.setCookie.directive.secure': '仅通过 HTTPS 发送。',
  'shared.info.header.setCookie.directive.httpOnly': '对 JavaScript 隐藏（document.cookie）。',
  'shared.info.header.setCookie.directive.sameSiteStrictLaxNone': '跨站发送策略。`None` 需要 `Secure`。',
  'shared.info.header.setCookie.directive.domainHost': '发送到此主机及其所有子域。',
  'shared.info.header.setCookie.directive.pathPath': '仅发送到以此路径开头的 URL。',
  'shared.info.header.setCookie.directive.maxAgeN': 'TTL（秒），优先于 Expires。',
  'shared.info.header.setCookie.directive.expiresDate': '绝对过期时间；省略 = 会话 Cookie。',
  'shared.info.header.setCookie.directive.partitioned': 'CHIPS——按顶级站点分区。',

  // ── cors ──────────────────────────────────────────────────────────────
  'shared.info.header.accessControlAllowOrigin.summary': '告诉浏览器哪些源被允许读取此响应。',
  'shared.info.header.accessControlAllowOrigin.body1':
    '由服务器在响应上设置。浏览器将它与请求的 `Origin` 标头比较，如果不匹配就阻止 JavaScript 读取响应体。',
  'shared.info.header.accessControlAllowOrigin.body2':
    '`*` 接受任何源，但与凭据不兼容——如果请求携带 Cookie 或身份验证信息，响应必须改为回显确切的请求源。',
  'shared.info.header.accessControlAllowOrigin.value.wildcard': '任何源都可以读取（无凭据）。',
  'shared.info.header.accessControlAllowOrigin.value.httpsAppOpenheadersIo': '只有指定的源可以读取。',
  'shared.info.header.accessControlAllowCredentials.summary': '允许浏览器在请求携带凭据时暴露响应。',
  'shared.info.header.accessControlAllowCredentials.body1':
    '必须是 `true`（小写）。设置后，`Access-Control-Allow-Origin` 不得为 `*`——必须回显确切的源。',
  'shared.info.header.accessControlAllowMethods.summary': '列出服务器为跨源请求接受的 HTTP 方法。',
  'shared.info.header.accessControlAllowMethods.body1':
    '在预检（`OPTIONS`）响应上返回。浏览器将答案缓存 `Access-Control-Max-Age` 秒。',
  'shared.info.header.accessControlAllowHeaders.summary': '列出服务器在跨源请求上接受的请求标头。',
  'shared.info.header.accessControlAllowHeaders.body1':
    '当浏览器对非简单标头进行预检时必需（超出 `Accept`、`Accept-Language`、`Content-Language` 和简单 `Content-Type` 值的任何标头）。',
  'shared.info.header.accessControlExposeHeaders.summary': '列出允许 JavaScript 读取的响应标头。',
  'shared.info.header.accessControlExposeHeaders.body1':
    '默认情况下 JS 只能看到 CORS 安全列表中的响应标头（`Cache-Control`、`Content-Language`、`Content-Type`、`Expires`、`Last-Modified`、`Pragma`）。其他任何标头都必须在此列出，`response.headers.get(...)` 才能返回它。',
  'shared.info.header.accessControlMaxAge.summary': '浏览器可以缓存预检响应的时长（秒）。',
  'shared.info.header.accessControlMaxAge.body1':
    '较大的值可减少预检开销——86400（1 天）很常见。Chrome 上限为 7200 秒；Firefox 为 86400。',
  'shared.info.header.accessControlRequestMethod.summary': '在预检时发送，声明实际请求将使用的方法。',
  'shared.info.header.accessControlRequestMethod.body1': '服务器以 `Access-Control-Allow-Methods` 回复以确认。',
  'shared.info.header.accessControlRequestHeaders.summary': '在预检时发送，声明实际请求将携带的标头。',
  'shared.info.header.accessControlRequestHeaders.body1': '如被接受，通过 `Access-Control-Allow-Headers` 镜像返回。',
  'shared.info.header.origin.summary': '标识发起跨源或 POST 请求的源。',
  'shared.info.header.origin.body1': '由浏览器自动发送。JS 无法设置。服务器用它决定 CORS 响应，CSRF 防御也依赖它。',
  'shared.info.header.vary.summary': '告诉缓存哪些请求标头会影响响应，以便按它们区分缓存键。',
  'shared.info.header.vary.body1':
    '对 CORS 至关重要：只要 `Access-Control-Allow-Origin` 是根据请求的源计算的，就要包含 `Vary: Origin`，否则缓存会把一个源的响应提供给另一个源。',
  'shared.info.header.timingAllowOrigin.summary': '允许其他源读取此资源的详细计时指标（`PerformanceResourceTiming`）。',
  'shared.info.header.timingAllowOrigin.body1': '没有此标头时，跨源资源只暴露粗粒度的计时。',

  // ── fetch-metadata ────────────────────────────────────────────────────
  'shared.info.header.secFetchSite.summary': '浏览器设置：请求发起者与目标之间的关系。',
  'shared.info.header.secFetchSite.body1': '值：`same-origin`、`same-site`、`cross-site`、`none`（直接导航）。',
  'shared.info.header.secFetchMode.summary': '浏览器设置：请求的 fetch 模式。',
  'shared.info.header.secFetchMode.body1': '值：`cors`、`no-cors`、`same-origin`、`navigate`、`websocket`。',
  'shared.info.header.secFetchDest.summary': '浏览器设置：响应将被用在哪里（文档、脚本、图像等）。',
  'shared.info.header.secFetchDest.body1':
    '让服务器发现异常的获取——例如一个 HTML 响应被以 `Sec-Fetch-Dest: script` 请求。',
  'shared.info.header.secFetchUser.summary': '浏览器设置：导航来自用户直接操作时为 `?1`。',
  'shared.info.header.secFetchUser.body1': '否则不发送。可用于区分用户点击与程序化导航。',
  'shared.info.header.secPurpose.summary': '当请求是投机性的时由浏览器设置——例如 `prefetch`、`prerender`。',
  'shared.info.header.secPurpose.body1': '让服务器为用户尚未真正发起的获取跳过副作用（分析统计、写日志）。',

  // ── performance ───────────────────────────────────────────────────────
  'shared.info.header.priority.summary': '告诉服务器（或客户端）此传输的紧急程度与增量程度。',
  'shared.info.header.priority.body1':
    '格式：`u=<0-7>`（紧急度，越低优先级越高），可选 `, i`（增量——可以边到达边处理）。',
  'shared.info.header.upgradeInsecureRequests.summary': '浏览器设置的 `1`——告诉服务器客户端希望嵌入资源使用 HTTPS。',
  'shared.info.header.upgradeInsecureRequests.body1': '与响应上的 CSP `upgrade-insecure-requests` 指令配对。',
  'shared.info.header.earlyData.summary': '`1`——由在 TLS 1.3 0-RTT 模式下发送数据的客户端设置。',
  'shared.info.header.earlyData.body1': '服务器应拒绝非幂等方法（POST 等）上的早期数据，以避免重放攻击。',
  'shared.info.header.link.summary': '资源提示——preload / prefetch / preconnect / dns-prefetch。',
  'shared.info.header.link.body1': '语义与 HTML 中的 `<link rel="...">` 相同；对非 HTML 响应（API、重定向）很有用。',
  'shared.info.header.link.value.styleCssRelPreloadAsStyle': '预加载样式表。',
  'shared.info.header.link.value.httpsCdnExampleComRelPreconnect': '提前打开连接。',
  'shared.info.header.xDnsPrefetchControl.summary': '开关页面上链接的浏览器 DNS 预取（`on` / `off`）。',

  // ── privacy ───────────────────────────────────────────────────────────
  'shared.info.header.dnt.summary': 'Do Not Track——用户选择退出跟踪时为 `1`。已基本废弃。',
  'shared.info.header.dnt.body1': '大多数主要网站忽略它；W3C 于 2019 年放弃了该规范。遵从与否完全自愿。',
  'shared.info.header.secGpc.summary': 'Global Privacy Control——`1` 表示用户希望其数据不被出售或共享。',
  'shared.info.header.secGpc.body1':
    '在加州依据 CCPA 具有法律约束力；部分注重隐私的浏览器（Brave、Firefox、DuckDuckGo）予以支持。',

  // ── proxy ─────────────────────────────────────────────────────────────
  'shared.info.header.via.summary': '列出消息经过的代理/网关。',
  'shared.info.header.via.body1': '每个代理追加自己的标识符，便于调试时重建整条链路。',
  'shared.info.header.xForwardedFor.summary': '非标准但无处不在：经过代理的客户端 IP 链，以逗号分隔。',
  'shared.info.header.xForwardedFor.body1': '最左侧条目是原始客户端。RFC 7239 的 `Forwarded` 标头是标准化的替代。',
  'shared.info.header.xForwardedProto.summary': '客户端到达第一个代理时使用的原始协议（`http` 或 `https`）。',
  'shared.info.header.xForwardedHost.summary': '代理改写之前客户端发送的原始 `Host` 标头。',
  'shared.info.header.xRealIp.summary': '第一个代理看到的原始客户端 IP。单个值，不是链。',
  'shared.info.header.forwarded.summary': 'RFC 7239 标准化的代理链——取代 `X-Forwarded-*` 家族。',
  'shared.info.header.forwarded.body1':
    '格式：`for=client; proto=https; by=proxy; host=original-host`。多个代理以逗号分隔。',
  'shared.info.header.trueClientIp.summary': 'Akamai / Cloudflare Enterprise 转发的原始客户端 IP——单个值，不是链。',

  // ── routing ───────────────────────────────────────────────────────────
  'shared.info.header.authority.summary': 'HTTP/2+ 伪标头——等同于 HTTP/1.1 中的 `Host`。标识目标服务器。',
  'shared.info.header.authority.body1':
    '伪标头以 `:` 开头，必须出现在常规标头之前。由浏览器设置；JavaScript 无法设置。',
  'shared.info.header.method.summary': 'HTTP/2+ 伪标头——请求方法（`GET`、`POST`、…）。',
  'shared.info.header.path.summary': 'HTTP/2+ 伪标头——请求路径 + 查询字符串。',
  'shared.info.header.scheme.summary': 'HTTP/2+ 伪标头——`https` 或 `http`。',
  'shared.info.header.status.summary': 'HTTP/2+ 伪标头——数字响应状态（例如 `200`）。',
  'shared.info.header.status.body1': '在 HTTP/2 和 HTTP/3 中，伪标头取代了 HTTP/1.1 的状态行。',
  'shared.info.header.host.summary': 'HTTP/1.1 目标主机（和可选端口）。在 HTTP/2+ 中被 `:authority` 取代。',
  'shared.info.header.host.body1': '每个 HTTP/1.1 请求都必需。服务器用它在同一 IP 上的虚拟主机之间路由。',
  'shared.info.header.location.summary': '重定向目标——随 `3xx` 响应发送，或作为已创建资源的结果。',
  'shared.info.header.location.body1': '绝对 URL 被普遍遵循；相对 URL 相对请求 URL 解析。',
  'shared.info.header.allow.summary': '列出资源接受的 HTTP 方法。',
  'shared.info.header.allow.body1': '在 `405 Method Not Allowed` 响应中必需。常见值：`GET, HEAD, POST, OPTIONS`。',
  'shared.info.header.referer.summary': '发起此请求的页面的 URL。',
  'shared.info.header.referer.body1':
    '注意这个历史拼写错误——规范保留了它。某些目标会根据页面的 `Referrer-Policy` 去除或降级 `Referer`。',
  'shared.info.header.retryAfter.summary': '告诉客户端何时重试——秒数（增量）或绝对 HTTP 日期。',
  'shared.info.header.retryAfter.body1': '常见于 `503 Service Unavailable` 和 `429 Too Many Requests`。爬虫会遵循它。',
  'shared.info.header.maxForwards.summary': '限制可以转发 `TRACE` 或 `OPTIONS` 请求的代理数量。',
  'shared.info.header.maxForwards.body1': '每个转发代理递减。到 0 → 该代理自己响应。',
  'shared.info.header.serviceWorker.summary': '当请求在获取 service worker 脚本文件时由浏览器设置为 `script`。',
  'shared.info.header.serviceWorker.body1': '让服务器识别 SW 注册获取，并以正确的 `Service-Worker-Allowed` 标头响应。',
  'shared.info.header.serviceWorkerAllowed.summary': '覆盖 service worker 作用域的默认路径限制。',
  'shared.info.header.serviceWorkerAllowed.body1':
    '默认情况下，worker 只能控制其所在目录及以下。此标头允许扩大范围——例如让位于 `/sw.js` 的 worker 控制 `/`。',
  'shared.info.header.protocol.summary': '扩展 CONNECT 机制（RFC 8441）的伪标头——用于 WebSocket over HTTP/2 / 3。',
  'shared.info.header.protocol.body1': '当客户端通过 HTTP/2 或 HTTP/3 隧道传输 WebSocket 时设置为 `websocket`。',

  // ── security ──────────────────────────────────────────────────────────
  'shared.info.header.contentSecurityPolicy.summary': '页面可以从哪些来源加载资源或执行代码的允许列表。',
  'shared.info.header.contentSecurityPolicy.body1':
    '指令内部以空格分隔，指令之间以分号分隔。大多数应用至少需要 `default-src`、`script-src`、`style-src` 和 `connect-src`。',
  'shared.info.header.contentSecurityPolicy.body2': '使用 `Content-Security-Policy-Report-Only` 先观察违规再强制执行。',
  'shared.info.header.contentSecurityPolicy.directive.defaultSrc': '未显式设置的任何 -src 的后备。',
  'shared.info.header.contentSecurityPolicy.directive.scriptSrc': '`<script>` 和内联 JS 的允许来源。',
  'shared.info.header.contentSecurityPolicy.directive.styleSrc': '样式表和内联 CSS 的允许来源。',
  'shared.info.header.contentSecurityPolicy.directive.imgSrc': '允许的图像来源。',
  'shared.info.header.contentSecurityPolicy.directive.connectSrc': '允许的 fetch/XHR/WebSocket 目标。',
  'shared.info.header.contentSecurityPolicy.directive.frameAncestors':
    '谁可以把此页面嵌入 iframe（取代 X-Frame-Options）。',
  'shared.info.header.contentSecurityPolicy.directive.reportUriReportTo': '向哪里 POST 违规报告。',
  'shared.info.header.contentSecurityPolicyReportOnly.summary': '语法与 CSP 相同，但违规只报告而不阻止。',
  'shared.info.header.contentSecurityPolicyReportOnly.body1': '用它在生产环境中先测试策略，再强制执行。',
  'shared.info.header.strictTransportSecurity.summary': '强制浏览器在给定时长内对此主机只用 HTTPS。',
  'shared.info.header.strictTransportSecurity.body1':
    '生产环境中 `max-age` 至少设为 6 个月。添加 `includeSubDomains` 以覆盖该域下的每个主机。',
  'shared.info.header.strictTransportSecurity.body2':
    '`preload` 允许把域名提交到浏览器内置的 HSTS 预加载列表（单向决定——很难回退）。',
  'shared.info.header.strictTransportSecurity.directive.maxAgeN': '浏览器记住仅 HTTPS 的时长。',
  'shared.info.header.strictTransportSecurity.directive.includeSubDomains': '应用于每个子域。',
  'shared.info.header.strictTransportSecurity.directive.preload': '浏览器预加载列表的资格。',
  'shared.info.header.xContentTypeOptions.summary': '禁用 MIME 嗅探。',
  'shared.info.header.xContentTypeOptions.body1':
    '唯一有效值：`nosniff`。建议在每个响应上设置——防止 `text/plain` 的 JS 被执行。',
  'shared.info.header.xFrameOptions.summary': '控制页面是否可以被嵌入 iframe。',
  'shared.info.header.xFrameOptions.body1':
    '已基本被 `Content-Security-Policy: frame-ancestors` 取代。过渡期间两者都保留，以覆盖较旧的浏览器。',
  'shared.info.header.xFrameOptions.value.deny': '永不可嵌入。',
  'shared.info.header.xFrameOptions.value.sameorigin': '仅可被同源页面嵌入。',
  'shared.info.header.xXssProtection.summary': '旧式 XSS 过滤器开关——在现代浏览器中已过时。',
  'shared.info.header.xXssProtection.body1': '推荐值为 `0` 以禁用过滤器（它造成的危害多于防护）。改用 CSP。',
  'shared.info.header.referrerPolicy.summary': '控制传出导航和请求的 `Referer` 中发送多少 URL 信息。',
  'shared.info.header.referrerPolicy.body1':
    '由目标作为响应标头发送，或按页面通过 `<meta>` / 按请求通过 `referrerpolicy` 属性设置。',
  'shared.info.header.referrerPolicy.value.noReferrer': '永不发送 referer。',
  'shared.info.header.referrerPolicy.value.origin': '只发送协议 + 主机。',
  'shared.info.header.referrerPolicy.value.strictOriginWhenCrossOrigin':
    '默认——同源发送完整 URL，跨源只发送源，HTTPS→HTTP 降级时不发送。',
  'shared.info.header.referrerPolicy.value.unsafeUrl': '总是发送完整 URL。避免使用。',
  'shared.info.header.permissionsPolicy.summary': '浏览器功能的允许列表（地理位置、摄像头、USB、支付等）。',
  'shared.info.header.permissionsPolicy.body1':
    '每个功能限定为 `self`、一组源或 `*`。取代较旧的 `Feature-Policy` 标头。',
  'shared.info.header.crossOriginOpenerPolicy.summary': '将页面与跨源 opener 关系（window.opener）隔离。',
  'shared.info.header.crossOriginOpenerPolicy.body1':
    '`same-origin` 启用 crossOriginIsolated 模式——SharedArrayBuffer 和高精度计时器需要它。',
  'shared.info.header.crossOriginEmbedderPolicy.summary': '要求加载的每个子资源都授予跨源许可。',
  'shared.info.header.crossOriginEmbedderPolicy.body1':
    '设为 `require-corp` 以启用 crossOriginIsolated。与 `Cross-Origin-Opener-Policy: same-origin` 配对。',
  'shared.info.header.crossOriginResourcePolicy.summary': '防止资源被其他源加载。',
  'shared.info.header.crossOriginResourcePolicy.body1':
    '值：`same-site`、`same-origin`、`cross-origin`。对不想被热链接的资源至关重要。',
  'shared.info.header.clearSiteData.summary': '请求浏览器清除此源的 Cookie / 缓存 / 存储。',
  'shared.info.header.clearSiteData.body1': '对退出登录流程很有用。',
  'shared.info.header.clearSiteData.value.cookies': '清除该源的 Cookie。',
  'shared.info.header.clearSiteData.value.cache': '清除 HTTP 和图像缓存。',
  'shared.info.header.clearSiteData.value.storage': '清除 localStorage / IndexedDB / Service Worker 注册。',
  'shared.info.header.clearSiteData.value.wildcard': '清除全部。',
  'shared.info.header.originAgentCluster.summary': '`?1` 请求浏览器为此源提供独立的 agent cluster（进程）。',
  'shared.info.header.originAgentCluster.body1':
    '为 `SharedArrayBuffer`、performance.measureUserAgentSpecificMemory 等提供更好的隔离。',
  'shared.info.header.xRobotsTag.summary': '给爬虫的搜索索引指令（`noindex`、`nofollow`、…）。',
  'shared.info.header.xRobotsTag.body1':
    '语义与 `<meta name="robots">` 标签相同，但适用于非 HTML 响应（PDF、JSON、图像）。',
  'shared.info.header.xUaCompatible.summary': '旧式 IE/Edge 指令（`IE=edge`）——选择渲染引擎。在现代浏览器中已过时。',

  // ── server-id ─────────────────────────────────────────────────────────
  'shared.info.header.server.summary': '源服务器的软件标识（例如 `nginx/1.27`、`cloudflare`）。',
  'shared.info.header.server.body1': '生产环境中出于运维安全常被去除或设为固定值。',
  'shared.info.header.xPoweredBy.summary': '标识响应背后框架/运行时的非标准标头。',
  'shared.info.header.xPoweredBy.body1': '常由 Express、PHP、ASP.NET 等发出。生产环境中通常会抑制。',
  'shared.info.header.date.summary': '源服务器生成消息时的时间戳。',
  'shared.info.header.date.body1': '缓存用它计算响应年龄。格式：IMF-fixdate（`Mon, 18 May 2026 15:05:25 GMT`）。',
  'shared.info.header.xServedBy.summary': '标识提供响应的 CDN 边缘/缓存节点。',
  'shared.info.header.xServedBy.body1':
    '多个层级处理请求时以逗号分隔（shield → 边缘）。格式因供应商而异（Fastly POP、AWS CloudFront 边缘等）。',

  // ── tracing ───────────────────────────────────────────────────────────
  'shared.info.header.serverTiming.summary': '服务器附加到响应上的性能指标。',
  'shared.info.header.serverTiming.body1':
    '显示在 DevTools 和 `PerformanceServerTiming` JS API 中。格式：`<name>;dur=<ms>[;desc="..."]`，以逗号分隔。',
  'shared.info.header.traceparent.summary': 'W3C trace-context：标识分布式追踪中的一个 span。',
  'shared.info.header.traceparent.body1':
    '格式：`<version>-<trace-id>-<parent-id>-<flags>`。在服务之间传递，以便重新组装追踪。',
  'shared.info.header.tracestate.summary': '`traceparent` 的供应商特定 trace-context 伴生标头。',
  'shared.info.header.tracestate.body1': '以逗号分隔的 `vendor=value` 对。每个追踪供应商在此存储自己的状态。',
  'shared.info.header.xRequestId.summary': '服务器为此请求分配的标识符——在日志和服务之间回显。',
  'shared.info.header.xRequestId.body1': '非标准但无处不在。调试时用于关联客户端行为与服务器日志。',
  'shared.info.header.xFastlyRequestId.summary': 'Fastly 请求标识符——用于关联 Fastly 日志/调试。',
  'shared.info.header.reportingEndpoints.summary': '命名浏览器生成的报告的目的地（CSP 违规、弃用、NEL、…）。',
  'shared.info.header.reportingEndpoints.body1':
    '格式：`name="https://reports.example.com", name2="https://..."`。取代较旧的 `Report-To` 标头。',
  'shared.info.header.reportTo.summary': '较旧的基于 JSON 的报告端点声明——已被 `Reporting-Endpoints` 取代。',
  'shared.info.header.nel.summary': 'Network Error Logging 策略——命名接收连接失败和协议错误的端点的 JSON 配置。',
  'shared.info.header.nel.body1': '端点必须已通过 `Reporting-Endpoints`（或较旧的 `Report-To`）注册。',
  'shared.info.header.cfRay.summary': 'Cloudflare 请求标识符——用于在 Cloudflare 日志中关联请求。',
  'shared.info.header.cfRay.body1': '格式：`<request-id>-<colo-id>`，其中 colo-id 标识提供服务的 Cloudflare 数据中心。',
} as const satisfies Catalog;
