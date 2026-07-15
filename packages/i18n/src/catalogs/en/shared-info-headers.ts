/**
 * Shared info-popover corpus — HTTP headers. Prose for the per-header
 * (i) popovers (panel Headers tab rows + workbench response headers;
 * shared-plane, keyed once for both surfaces). Wire vocabulary stays
 * raw in the data registry: header display names, directive keys,
 * common values, and category names never localize — only summaries,
 * body paragraphs, directive/value descriptions, and the popover
 * chrome live here.
 */

import type { Catalog } from '../../types';

export const sharedInfoHeaders = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.header.kicker': '{direction} · {category}',
  'shared.info.header.direction.request': 'Request header',
  'shared.info.header.direction.response': 'Response header',
  'shared.info.header.direction.both': 'Request / Response header',
  'shared.info.header.section.directives': 'Directives',
  'shared.info.header.section.commonValues': 'Common values',
  'shared.info.header.fallback.customCategory': 'Custom or non-standard',
  'shared.info.header.fallback.customSummary':
    'This header is custom or non-standard — no documentation in our registry.',
  'shared.info.header.fallback.unknownSummary':
    '{name} is not yet documented in our registry. The row classifies it as {category}.',

  // ── auth ──────────────────────────────────────────────────────────────
  'shared.info.header.authorization.summary': 'Credentials authenticating the client to the server.',
  'shared.info.header.authorization.body1':
    'Format: `<scheme> <credentials>`. Common schemes: `Bearer <token>` (OAuth, JWT), `Basic <base64(user:pass)>`, `Digest`.',
  'shared.info.header.proxyAuthorization.summary': 'Credentials for an intervening proxy (not the origin server).',
  'shared.info.header.proxyAuthorization.body1': 'Same syntax as `Authorization`, distinct in scope.',
  'shared.info.header.wwwAuthenticate.summary': 'Server’s 401 challenge — tells the client which auth scheme to use.',
  'shared.info.header.wwwAuthenticate.body1':
    'Sent with `401 Unauthorized`. Triggers the browser’s basic-auth dialog when the scheme is `Basic`.',
  'shared.info.header.proxyAuthenticate.summary':
    'Proxy-equivalent of `WWW-Authenticate`, sent with `407 Proxy Authentication Required`.',
  'shared.info.header.authenticationInfo.summary':
    'Completes mutual authentication on success — Digest auth uses it to confirm the server too.',

  // ── caching ───────────────────────────────────────────────────────────
  'shared.info.header.cacheControl.summary': 'Directives that govern how a response is cached and revalidated.',
  'shared.info.header.cacheControl.body1':
    'Both request and response carry directives. Multiple comma-separated tokens are AND-combined. Behavior is per-directive — the header is not a single mode.',
  'shared.info.header.cacheControl.directive.noStore': 'Do not cache at all, anywhere.',
  'shared.info.header.cacheControl.directive.noCache': 'May cache, but revalidate every time before reuse.',
  'shared.info.header.cacheControl.directive.public': 'Any cache may store, including shared/CDN.',
  'shared.info.header.cacheControl.directive.private': 'Only the user’s browser may store.',
  'shared.info.header.cacheControl.directive.maxAgeN': 'Fresh for N seconds; reuse without contacting origin.',
  'shared.info.header.cacheControl.directive.sMaxageN': 'Like max-age but only for shared caches.',
  'shared.info.header.cacheControl.directive.mustRevalidate': 'Once stale, revalidate before serving.',
  'shared.info.header.cacheControl.directive.immutable': 'Promise the body will not change for max-age.',
  'shared.info.header.cacheControl.directive.staleWhileRevalidateN':
    'Allow stale reuse while a background revalidation runs.',
  'shared.info.header.pragma.summary': 'Legacy HTTP/1.0 cache control — effectively superseded by Cache-Control.',
  'shared.info.header.pragma.body1':
    '`Pragma: no-cache` is still set by some clients for compatibility. Modern servers should honor `Cache-Control` and ignore `Pragma`.',
  'shared.info.header.expires.summary': 'Absolute date/time after which the response is considered stale.',
  'shared.info.header.expires.body1':
    'Superseded by `Cache-Control: max-age`. If both are set, `max-age` wins. Use a date in the past (or `0`) to force re-fetch.',
  'shared.info.header.etag.summary': 'Opaque identifier for the response body — used to revalidate cached copies.',
  'shared.info.header.etag.body1':
    'Clients echo it back in `If-None-Match`. If the value still matches, the server replies `304 Not Modified` with no body.',
  'shared.info.header.ifMatch.summary': 'Conditional request: proceed only if the resource’s current ETag matches.',
  'shared.info.header.ifMatch.body1':
    'Used by writes to prevent overwriting changes made by someone else (optimistic concurrency).',
  'shared.info.header.ifNoneMatch.summary': 'Conditional request: proceed only if the resource’s ETag has changed.',
  'shared.info.header.ifNoneMatch.body1':
    'Used by reads to skip downloading an unchanged response — the server replies `304 Not Modified`.',
  'shared.info.header.ifModifiedSince.summary':
    'Conditional request: proceed only if the resource changed after the given date.',
  'shared.info.header.ifModifiedSince.body1': 'Less precise than `If-None-Match`/ETag; prefer ETags when available.',
  'shared.info.header.ifUnmodifiedSince.summary':
    'Conditional request: proceed only if the resource has not been modified since the given date.',
  'shared.info.header.lastModified.summary': 'Date/time the resource was last changed.',
  'shared.info.header.lastModified.body1': 'Paired with `If-Modified-Since` for revalidation.',
  'shared.info.header.age.summary': 'Seconds the response has been in a shared cache.',
  'shared.info.header.age.body1': 'Returned by CDNs and proxies; helps clients understand response freshness.',
  'shared.info.header.xCache.summary':
    'CDN / reverse-proxy cache outcome — vendor-specific format (Varnish, Fastly, CloudFront).',
  'shared.info.header.xCache.value.hit': 'Served from cache.',
  'shared.info.header.xCache.value.miss': 'Not cached; fetched from origin.',
  'shared.info.header.xCache.value.hitHit': 'Multiple cache tiers all hit (e.g. shield + edge).',
  'shared.info.header.xCacheHits.summary': 'Cache hit counter per tier — vendor-specific, common on Fastly.',
  'shared.info.header.xCacheHits.body1':
    'Comma-separated when multiple cache tiers are in play. High counts indicate hot cache lines.',
  'shared.info.header.warning.summary':
    'Additional caching context (stale, transformation applied, etc.). Deprecated in HTTP/1.1 since RFC 7234 but still emitted.',
  'shared.info.header.surrogateControl.summary':
    'Edge Side Includes cache control — directs CDNs while leaving browser caching to `Cache-Control`.',
  'shared.info.header.surrogateControl.body1':
    'Specific to ESI-aware caches (Fastly, Akamai, Varnish in some configs).',
  'shared.info.header.surrogateCapability.summary': 'Edge-to-origin hint: which ESI features the surrogate supports.',
  'shared.info.header.cfCacheStatus.summary': 'Cloudflare cache outcome for this request.',
  'shared.info.header.cfCacheStatus.value.hit': 'Served from Cloudflare cache.',
  'shared.info.header.cfCacheStatus.value.miss': 'Not in cache; fetched from origin.',
  'shared.info.header.cfCacheStatus.value.expired': 'Was cached but expired; refreshed from origin.',
  'shared.info.header.cfCacheStatus.value.bypass': 'Cache bypassed (page rules / no-cache header).',
  'shared.info.header.cfCacheStatus.value.dynamic': 'Not cacheable by default (cookies, query string, etc.).',
  'shared.info.header.cfCacheStatus.value.revalidated': 'Cached and revalidated with origin (304).',

  // ── client-hints ──────────────────────────────────────────────────────
  'shared.info.header.secChUa.summary': 'Client Hint: the browser’s brand list.',
  'shared.info.header.secChUa.body1':
    'Replaces the freeform `User-Agent` for the parts servers should actually depend on.',
  'shared.info.header.secChUaMobile.summary': 'Client Hint: `?1` on mobile, `?0` on desktop.',
  'shared.info.header.secChUaPlatform.summary': 'Client Hint: the user’s OS (`"Windows"`, `"macOS"`, `"Linux"`, etc.).',
  'shared.info.header.userAgent.summary': 'Legacy freeform string identifying the browser, OS, and engine.',
  'shared.info.header.userAgent.body1':
    'Still sent by every request. The structured replacement is the `Sec-CH-UA-*` family — prefer those when servers care about browser identity.',
  'shared.info.header.acceptCh.summary': 'Lists which Client Hint headers the server wants on subsequent requests.',
  'shared.info.header.acceptCh.body1':
    'Browsers only send hints the server has opted into here (except for the low-entropy defaults).',
  'shared.info.header.criticalCh.summary':
    'Subset of `Accept-CH` the server considers critical — browsers will restart the request to include them.',
  'shared.info.header.criticalCh.body1': 'Use sparingly: every Critical-CH miss costs a round-trip.',
  'shared.info.header.saveData.summary': '`on` when the user enabled a data-saver mode in their browser/OS.',
  'shared.info.header.saveData.body1':
    'Use it to serve lower-bandwidth assets (lower image quality, defer below-the-fold work, etc.).',
  'shared.info.header.deviceMemory.summary':
    'Approximate device RAM in GiB, rounded to a small set of values (`0.25`, `0.5`, `1`, `2`, `4`, `8`).',
  'shared.info.header.downlink.summary': 'Estimated downstream bandwidth in Mbps, rounded.',
  'shared.info.header.ect.summary': 'Effective Connection Type — `slow-2g`, `2g`, `3g`, or `4g`.',
  'shared.info.header.rtt.summary': 'Estimated round-trip time in milliseconds, rounded.',

  // ── connection ────────────────────────────────────────────────────────
  'shared.info.header.connection.summary': 'Hop-by-hop connection controls (`keep-alive`, `close`, `upgrade`).',
  'shared.info.header.connection.body1':
    'Stripped by proxies between hops. In HTTP/2+ this header is forbidden — connection management is built into the protocol.',
  'shared.info.header.keepAlive.summary': 'Connection-pool hints — typically `timeout=N, max=N`.',
  'shared.info.header.keepAlive.body1':
    'Only meaningful with `Connection: keep-alive` on HTTP/1.1. Ignored in HTTP/2+.',
  'shared.info.header.upgrade.summary':
    'Asks to switch protocols on the same connection (WebSocket, HTTP/2 cleartext).',
  'shared.info.header.upgrade.body1': 'Used together with `Connection: upgrade`. WebSocket: `Upgrade: websocket`.',
  'shared.info.header.te.summary': 'Transfer encodings the client will accept (`trailers`, `gzip`, …).',
  'shared.info.header.te.body1': 'Most modern clients only send `TE: trailers` to opt into trailing headers.',
  'shared.info.header.expect.summary': 'Server-side preconditions the client expects to hold (`100-continue`).',
  'shared.info.header.expect.body1':
    '`Expect: 100-continue` lets the client send the body only after the server signals `100 Continue`.',
  'shared.info.header.altSvc.summary': 'Advertises alternative ways to reach the same origin (e.g. HTTP/3 over QUIC).',
  'shared.info.header.altSvc.body1':
    'Browsers cache the advertisement and may switch to the alternative for subsequent requests.',
  'shared.info.header.secWebsocketKey.summary': 'Random base64-encoded nonce sent on the WebSocket handshake.',
  'shared.info.header.secWebsocketKey.body1':
    'Server replies with `Sec-WebSocket-Accept` derived from this key + a fixed GUID, proving it understands WebSocket.',
  'shared.info.header.secWebsocketAccept.summary':
    'Server proof for the WebSocket handshake — `SHA-1(Sec-WebSocket-Key + GUID)` base64-encoded.',
  'shared.info.header.secWebsocketVersion.summary':
    'WebSocket protocol version the client requests. Almost always `13` (RFC 6455).',
  'shared.info.header.secWebsocketProtocol.summary':
    'Sub-protocol negotiation for WebSocket — comma-separated list on request, single picked value on response.',
  'shared.info.header.secWebsocketExtensions.summary':
    'Negotiated WebSocket extensions (compression, etc.) — most commonly `permessage-deflate`.',

  // ── content ───────────────────────────────────────────────────────────
  'shared.info.header.contentType.summary': 'Media type of the request or response body.',
  'shared.info.header.contentType.body1':
    'Drives how the browser parses the body — wrong values cause silent failures (JSON parsed as HTML, etc.).',
  'shared.info.header.contentType.body2':
    'For `text/*` types, include `charset=utf-8` unless you have a reason not to.',
  'shared.info.header.contentType.value.applicationJson': 'JSON body.',
  'shared.info.header.contentType.value.applicationXWwwFormUrlencoded': 'URL-encoded form fields.',
  'shared.info.header.contentType.value.multipartFormData': 'Multipart form / file uploads.',
  'shared.info.header.contentType.value.textHtmlCharsetUtf8': 'HTML document.',
  'shared.info.header.contentType.value.applicationOctetStream': 'Opaque binary.',
  'shared.info.header.contentLength.summary': 'Body size in bytes (decoded).',
  'shared.info.header.contentLength.body1':
    'Mutually exclusive with `Transfer-Encoding: chunked`. Wrong values cause connection desync.',
  'shared.info.header.contentEncoding.summary':
    'Compression applied to the body — the browser decodes before exposing it to JS.',
  'shared.info.header.contentEncoding.body1':
    'Common: `gzip`, `br` (Brotli), `zstd` (newer). The decoded size is what `response.body` sees.',
  'shared.info.header.contentDisposition.summary': 'Tells the browser whether the response is inline or a download.',
  'shared.info.header.contentDisposition.body1':
    '`inline` (default) renders in the browser. `attachment; filename="x"` triggers a download with the given default filename.',
  'shared.info.header.accept.summary': 'Media types the client is willing to receive.',
  'shared.info.header.accept.body1':
    'Q-values express preference (`text/html;q=0.9`). Most servers ignore everything but the first type today.',
  'shared.info.header.acceptEncoding.summary': 'Compressions the client can decode.',
  'shared.info.header.acceptEncoding.body1':
    'Typical browser value: `gzip, deflate, br, zstd`. Servers pick one and answer with `Content-Encoding`.',
  'shared.info.header.acceptLanguage.summary': 'Human languages the client prefers.',
  'shared.info.header.acceptLanguage.body1':
    'Server selects a `Content-Language` from this list, often falling back to a default.',
  'shared.info.header.transferEncoding.summary':
    'Encoding applied for transport only — stripped before the body reaches the application.',
  'shared.info.header.transferEncoding.body1': 'Almost always `chunked`. Mutually exclusive with `Content-Length`.',
  'shared.info.header.range.summary': 'Asks for a byte range of the resource instead of the whole body.',
  'shared.info.header.range.body1':
    'Format: `bytes=<start>-<end>` (inclusive). Server responds with `206 Partial Content` and `Content-Range`.',
  'shared.info.header.contentRange.summary': 'Identifies which byte range of the resource is in the body.',
  'shared.info.header.contentRange.body1':
    'Format: `bytes <start>-<end>/<total>`. Returned with `206 Partial Content`.',
  'shared.info.header.acceptRanges.summary':
    'Tells the client whether range requests are supported (`bytes`) or not (`none`).',
  'shared.info.header.contentMd5.summary':
    'Base64-encoded MD5 digest of the body, for integrity checking. Obsolete in HTTP/1.1 RFC 7231 but still emitted by some servers.',
  'shared.info.header.contentMd5.body1': 'Modern integrity is done via `Digest` / `Want-Digest` or via TLS itself.',
  'shared.info.header.contentLanguage.summary': 'Natural language(s) of the response body.',
  'shared.info.header.contentLanguage.body1':
    'Negotiated against the request’s `Accept-Language`. Values are BCP-47 tags (`en-US`, `de-DE`, etc.).',
  'shared.info.header.contentLocation.summary': 'Alternate URL that uniquely identifies the entity in this response.',
  'shared.info.header.contentLocation.body1':
    'Distinct from `Location`: `Content-Location` describes the resource you got, not where to redirect to.',
  'shared.info.header.acceptCharset.summary':
    'Character encodings the client accepts. Deprecated — modern browsers always send UTF-8 and don’t emit this.',
  'shared.info.header.acceptCharset.body1': 'Most servers can safely ignore it.',
  'shared.info.header.ifRange.summary':
    'Conditional range request: serve the range only if the resource still matches the given ETag or date.',
  'shared.info.header.ifRange.body1':
    'If the resource changed, server returns the full body with `200 OK` instead of `206 Partial Content`.',
  'shared.info.header.trailer.summary':
    'Declares which header field names will appear in the trailer after a chunked body.',
  'shared.info.header.trailer.body1':
    'Only meaningful with `Transfer-Encoding: chunked`. The client must opt in via `TE: trailers`.',

  // ── cookies ───────────────────────────────────────────────────────────
  'shared.info.header.cookie.summary': 'Cookies the browser is sending with this request, semicolon-separated.',
  'shared.info.header.cookie.body1':
    "Set by the browser from its cookie jar. Cannot be set by JS directly on `fetch` — use `credentials: 'include'`.",
  'shared.info.header.setCookie.summary': 'Server-issued cookie definition.',
  'shared.info.header.setCookie.body1':
    'One cookie per `Set-Cookie` header line. Browsers store the latest value per (name, domain, path) tuple.',
  'shared.info.header.setCookie.body2':
    'Production cookies should always carry `Secure`, `HttpOnly`, and an explicit `SameSite` (Lax or Strict).',
  'shared.info.header.setCookie.directive.secure': 'Only sent over HTTPS.',
  'shared.info.header.setCookie.directive.httpOnly': 'Hidden from JavaScript (document.cookie).',
  'shared.info.header.setCookie.directive.sameSiteStrictLaxNone': 'Cross-site send policy. `None` requires `Secure`.',
  'shared.info.header.setCookie.directive.domainHost': 'Send to this host and all its subdomains.',
  'shared.info.header.setCookie.directive.pathPath': 'Send only to URLs starting with this path.',
  'shared.info.header.setCookie.directive.maxAgeN': 'TTL in seconds (overrides Expires).',
  'shared.info.header.setCookie.directive.expiresDate': 'Absolute expiry; omitted = session cookie.',
  'shared.info.header.setCookie.directive.partitioned': 'CHIPS — partitioned per top-level site.',

  // ── cors ──────────────────────────────────────────────────────────────
  'shared.info.header.accessControlAllowOrigin.summary':
    'Tells the browser which origins are allowed to read this response.',
  'shared.info.header.accessControlAllowOrigin.body1':
    'Set on the response by the server. The browser compares it to the request’s `Origin` header and blocks JavaScript from reading the body if they don’t match.',
  'shared.info.header.accessControlAllowOrigin.body2':
    '`*` accepts any origin but is incompatible with credentials — if the request carries cookies or auth, the response must echo the exact requesting origin instead.',
  'shared.info.header.accessControlAllowOrigin.value.wildcard': 'Any origin can read (no credentials).',
  'shared.info.header.accessControlAllowOrigin.value.httpsAppOpenheadersIo': 'Only the named origin can read.',
  'shared.info.header.accessControlAllowCredentials.summary':
    'Permits the browser to expose the response when the request carried credentials.',
  'shared.info.header.accessControlAllowCredentials.body1':
    'Must be `true` (lowercase). When set, `Access-Control-Allow-Origin` must NOT be `*` — it has to echo the exact origin.',
  'shared.info.header.accessControlAllowMethods.summary':
    'Lists HTTP methods the server accepts for cross-origin requests.',
  'shared.info.header.accessControlAllowMethods.body1':
    'Returned on preflight (`OPTIONS`) responses. The browser caches the answer for `Access-Control-Max-Age` seconds.',
  'shared.info.header.accessControlAllowHeaders.summary':
    'Lists request headers the server accepts on cross-origin requests.',
  'shared.info.header.accessControlAllowHeaders.body1':
    'Required when the browser preflights non-simple headers (anything beyond `Accept`, `Accept-Language`, `Content-Language`, simple `Content-Type` values).',
  'shared.info.header.accessControlExposeHeaders.summary': 'Lists response headers JavaScript is allowed to read.',
  'shared.info.header.accessControlExposeHeaders.body1':
    'By default JS only sees CORS-safelisted response headers (`Cache-Control`, `Content-Language`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`). Any other header has to be named here for `response.headers.get(...)` to return it.',
  'shared.info.header.accessControlMaxAge.summary':
    'How long the browser may cache the preflight response, in seconds.',
  'shared.info.header.accessControlMaxAge.body1':
    'Big values cut preflight chatter — a value of 86400 (1 day) is common. Chrome caps at 7200 seconds; Firefox at 86400.',
  'shared.info.header.accessControlRequestMethod.summary':
    'Sent on preflight to declare the method the actual request will use.',
  'shared.info.header.accessControlRequestMethod.body1':
    'The server replies with `Access-Control-Allow-Methods` to confirm.',
  'shared.info.header.accessControlRequestHeaders.summary':
    'Sent on preflight to declare the headers the actual request will carry.',
  'shared.info.header.accessControlRequestHeaders.body1':
    'Mirrored back via `Access-Control-Allow-Headers` if accepted.',
  'shared.info.header.origin.summary': 'Identifies the origin that initiated a cross-origin or POST request.',
  'shared.info.header.origin.body1':
    'Sent automatically by the browser. Cannot be set by JS. Used by servers to decide CORS responses and by CSRF defenses.',
  'shared.info.header.vary.summary':
    'Tells caches which request headers affect the response, so they vary the cache key.',
  'shared.info.header.vary.body1':
    'Critical for CORS: include `Vary: Origin` whenever `Access-Control-Allow-Origin` is computed from the request’s origin, otherwise a cache will serve one origin’s response to another.',
  'shared.info.header.timingAllowOrigin.summary':
    'Lets foreign origins read detailed timing metrics (`PerformanceResourceTiming`) for this resource.',
  'shared.info.header.timingAllowOrigin.body1':
    'Without this header, cross-origin resources only expose coarse-grained timings.',

  // ── fetch-metadata ────────────────────────────────────────────────────
  'shared.info.header.secFetchSite.summary': 'Browser-set: relationship between the request initiator and the target.',
  'shared.info.header.secFetchSite.body1':
    'Values: `same-origin`, `same-site`, `cross-site`, `none` (direct navigation).',
  'shared.info.header.secFetchMode.summary': 'Browser-set: the request’s fetch mode.',
  'shared.info.header.secFetchMode.body1': 'Values: `cors`, `no-cors`, `same-origin`, `navigate`, `websocket`.',
  'shared.info.header.secFetchDest.summary':
    'Browser-set: where the response will be used (document, script, image, etc.).',
  'shared.info.header.secFetchDest.body1':
    'Lets the server detect surprising fetches — e.g. an HTML response being requested as `Sec-Fetch-Dest: script`.',
  'shared.info.header.secFetchUser.summary': 'Browser-set: `?1` when the navigation was a direct user activation.',
  'shared.info.header.secFetchUser.body1':
    'Absent otherwise. Useful for distinguishing user clicks from programmatic navigation.',
  'shared.info.header.secPurpose.summary':
    'Browser-set when the request is speculative — e.g. `prefetch`, `prerender`.',
  'shared.info.header.secPurpose.body1':
    'Lets the server skip side effects (analytics, write logs) for fetches the user hasn’t actually requested yet.',

  // ── performance ───────────────────────────────────────────────────────
  'shared.info.header.priority.summary':
    'Tells the server (or the client) how urgent + how incremental this transfer is.',
  'shared.info.header.priority.body1':
    'Format: `u=<0-7>` (urgency, lower = higher priority) and optional `, i` (incremental — can be processed as it arrives).',
  'shared.info.header.upgradeInsecureRequests.summary':
    'Browser-set `1` — tells the server the client prefers HTTPS for any embedded resources.',
  'shared.info.header.upgradeInsecureRequests.body1':
    'Paired with the CSP `upgrade-insecure-requests` directive on responses.',
  'shared.info.header.earlyData.summary': '`1` — set by clients sending data in TLS 1.3 0-RTT mode.',
  'shared.info.header.earlyData.body1':
    'Servers should reject early-data on non-idempotent methods (POST, etc.) to avoid replay attacks.',
  'shared.info.header.link.summary': 'Resource hints — preload / prefetch / preconnect / dns-prefetch.',
  'shared.info.header.link.body1':
    'Same semantics as `<link rel="...">` in HTML; useful from non-HTML responses (APIs, redirects).',
  'shared.info.header.link.value.styleCssRelPreloadAsStyle': 'Preload a stylesheet.',
  'shared.info.header.link.value.httpsCdnExampleComRelPreconnect': 'Open a connection in advance.',
  'shared.info.header.xDnsPrefetchControl.summary':
    'Toggles browser DNS prefetching for links on the page (`on` / `off`).',

  // ── privacy ───────────────────────────────────────────────────────────
  'shared.info.header.dnt.summary': 'Do Not Track — `1` if the user opted out of tracking. Largely deprecated.',
  'shared.info.header.dnt.body1':
    'Most major sites ignore it; the W3C dropped the spec in 2019. Compliance is voluntary.',
  'shared.info.header.secGpc.summary':
    'Global Privacy Control — `1` signals the user wants their data not sold or shared.',
  'shared.info.header.secGpc.body1':
    'Legally binding under CCPA in California; honored by some privacy-focused browsers (Brave, Firefox, DuckDuckGo).',

  // ── proxy ─────────────────────────────────────────────────────────────
  'shared.info.header.via.summary': 'Lists proxies / gateways the message passed through.',
  'shared.info.header.via.body1': 'Each proxy appends its identifier so the chain can be reconstructed for debugging.',
  'shared.info.header.xForwardedFor.summary':
    'Non-standard but ubiquitous: comma-separated chain of client IPs through proxies.',
  'shared.info.header.xForwardedFor.body1':
    'Leftmost entry is the original client. RFC 7239’s `Forwarded` header is the standardized alternative.',
  'shared.info.header.xForwardedProto.summary':
    'Original scheme (`http` or `https`) the client used to reach the first proxy.',
  'shared.info.header.xForwardedHost.summary': 'Original `Host` header the client sent before the proxy rewrote it.',
  'shared.info.header.xRealIp.summary': 'Original client IP as seen by the first proxy. Single value, not a chain.',
  'shared.info.header.forwarded.summary': 'RFC 7239 standardized proxy chain — replaces the `X-Forwarded-*` family.',
  'shared.info.header.forwarded.body1':
    'Format: `for=client; proto=https; by=proxy; host=original-host`. Multiple proxies separated by commas.',
  'shared.info.header.trueClientIp.summary':
    'Original client IP forwarded by Akamai / Cloudflare Enterprise — single value, not a chain.',

  // ── routing ───────────────────────────────────────────────────────────
  'shared.info.header.authority.summary':
    'HTTP/2+ pseudo-header — equivalent to `Host` in HTTP/1.1. Identifies the target server.',
  'shared.info.header.authority.body1':
    'Pseudo-headers start with `:` and must appear before regular headers. The browser sets them; JavaScript cannot.',
  'shared.info.header.method.summary': 'HTTP/2+ pseudo-header — the request method (`GET`, `POST`, …).',
  'shared.info.header.path.summary': 'HTTP/2+ pseudo-header — the request path + query string.',
  'shared.info.header.scheme.summary': 'HTTP/2+ pseudo-header — `https` or `http`.',
  'shared.info.header.status.summary': 'HTTP/2+ pseudo-header — the numeric response status (e.g. `200`).',
  'shared.info.header.status.body1': 'Pseudo-headers replace the HTTP/1.1 status line in HTTP/2 and HTTP/3.',
  'shared.info.header.host.summary': 'HTTP/1.1 target host (and optional port). Replaced by `:authority` in HTTP/2+.',
  'shared.info.header.host.body1':
    'Required on every HTTP/1.1 request. Servers use it to route between virtual hosts on the same IP.',
  'shared.info.header.location.summary':
    'Redirect target — sent with `3xx` responses or as the result of a created resource.',
  'shared.info.header.location.body1':
    'Absolute URLs are universally honored; relative URLs resolve against the request URL.',
  'shared.info.header.allow.summary': 'Lists HTTP methods the resource accepts.',
  'shared.info.header.allow.body1':
    'Required in a `405 Method Not Allowed` response. Common values: `GET, HEAD, POST, OPTIONS`.',
  'shared.info.header.referer.summary': 'URL of the page that initiated this request.',
  'shared.info.header.referer.body1':
    'Note the historical misspelling — the spec keeps it. Some destinations strip or downgrade `Referer` based on the page’s `Referrer-Policy`.',
  'shared.info.header.retryAfter.summary': 'Tells the client when to retry — seconds (delta) or absolute HTTP-date.',
  'shared.info.header.retryAfter.body1':
    'Common on `503 Service Unavailable` and `429 Too Many Requests`. Crawlers honor it.',
  'shared.info.header.maxForwards.summary':
    'Limits the number of proxies that may forward a `TRACE` or `OPTIONS` request.',
  'shared.info.header.maxForwards.body1':
    'Decremented by each forwarding proxy. Reaches 0 → the proxy responds itself.',
  'shared.info.header.serviceWorker.summary':
    'Browser-set `script` when the request is fetching a service worker script file.',
  'shared.info.header.serviceWorker.body1':
    'Lets servers detect SW registration fetches and respond with the right `Service-Worker-Allowed` header.',
  'shared.info.header.serviceWorkerAllowed.summary':
    'Overrides the path-restriction default for the service worker’s scope.',
  'shared.info.header.serviceWorkerAllowed.body1':
    'By default, a worker can only control its directory and below. This header lets you broaden that — e.g. control `/` from a worker at `/sw.js`.',
  'shared.info.header.protocol.summary':
    'Pseudo-header for the Extended CONNECT mechanism (RFC 8441) — used by WebSocket-over-HTTP/2 / 3.',
  'shared.info.header.protocol.body1':
    'Set to `websocket` when the client tunnels a WebSocket through HTTP/2 or HTTP/3.',

  // ── security ──────────────────────────────────────────────────────────
  'shared.info.header.contentSecurityPolicy.summary':
    'Whitelist of sources from which the page may load resources or execute code.',
  'shared.info.header.contentSecurityPolicy.body1':
    'Directives are space-separated, semi-colon between directives. Most apps need at minimum `default-src`, `script-src`, `style-src`, and `connect-src`.',
  'shared.info.header.contentSecurityPolicy.body2':
    'Use `Content-Security-Policy-Report-Only` to observe violations before enforcing.',
  'shared.info.header.contentSecurityPolicy.directive.defaultSrc': 'Fallback for any -src not explicitly set.',
  'shared.info.header.contentSecurityPolicy.directive.scriptSrc': 'Allowed sources for `<script>` and inline JS.',
  'shared.info.header.contentSecurityPolicy.directive.styleSrc': 'Allowed sources for stylesheets and inline CSS.',
  'shared.info.header.contentSecurityPolicy.directive.imgSrc': 'Allowed image sources.',
  'shared.info.header.contentSecurityPolicy.directive.connectSrc': 'Allowed fetch/XHR/WebSocket targets.',
  'shared.info.header.contentSecurityPolicy.directive.frameAncestors':
    'Who may embed this page in an iframe (replaces X-Frame-Options).',
  'shared.info.header.contentSecurityPolicy.directive.reportUriReportTo': 'Where to POST violation reports.',
  'shared.info.header.contentSecurityPolicyReportOnly.summary':
    'Same syntax as CSP, but violations are reported without being blocked.',
  'shared.info.header.contentSecurityPolicyReportOnly.body1':
    'Use this to test a policy in production before enforcing it.',
  'shared.info.header.strictTransportSecurity.summary':
    'Forces the browser to use HTTPS for this host for a given duration.',
  'shared.info.header.strictTransportSecurity.body1':
    'Set `max-age` to at least 6 months in production. Add `includeSubDomains` to cover every host under the domain.',
  'shared.info.header.strictTransportSecurity.body2':
    '`preload` lets you submit the domain to the browser-baked HSTS preload list (one-way decision — hard to roll back).',
  'shared.info.header.strictTransportSecurity.directive.maxAgeN': 'How long the browser remembers HTTPS-only.',
  'shared.info.header.strictTransportSecurity.directive.includeSubDomains': 'Apply to every subdomain.',
  'shared.info.header.strictTransportSecurity.directive.preload': 'Eligibility for the browser preload list.',
  'shared.info.header.xContentTypeOptions.summary': 'Disables MIME sniffing.',
  'shared.info.header.xContentTypeOptions.body1':
    'Only one valid value: `nosniff`. Recommended on every response — prevents `text/plain` JS from being executed.',
  'shared.info.header.xFrameOptions.summary': 'Controls whether the page may be embedded in an iframe.',
  'shared.info.header.xFrameOptions.body1':
    'Largely superseded by `Content-Security-Policy: frame-ancestors`. Keep both during the transition for older browser coverage.',
  'shared.info.header.xFrameOptions.value.deny': 'Never embeddable.',
  'shared.info.header.xFrameOptions.value.sameorigin': 'Embeddable only by same-origin pages.',
  'shared.info.header.xXssProtection.summary': 'Legacy XSS filter toggle — obsolete in modern browsers.',
  'shared.info.header.xXssProtection.body1':
    'Recommended value is `0` to disable the filter (it caused more harm than it prevented). Use CSP instead.',
  'shared.info.header.referrerPolicy.summary':
    'Controls how much of the URL is sent in `Referer` on outgoing navigations and requests.',
  'shared.info.header.referrerPolicy.body1':
    'Sent as response header by the destination, or set per page via `<meta>` / per request via `referrerpolicy` attribute.',
  'shared.info.header.referrerPolicy.value.noReferrer': 'Never send a referer.',
  'shared.info.header.referrerPolicy.value.origin': 'Send only scheme + host.',
  'shared.info.header.referrerPolicy.value.strictOriginWhenCrossOrigin':
    'Default — full URL same-origin, origin only cross-origin, nothing on HTTPS→HTTP downgrade.',
  'shared.info.header.referrerPolicy.value.unsafeUrl': 'Always send the full URL. Avoid.',
  'shared.info.header.permissionsPolicy.summary':
    'Allow-list for browser features (geolocation, camera, USB, payment, etc.).',
  'shared.info.header.permissionsPolicy.body1':
    'Each feature is gated to `self`, a list of origins, or `*`. Replaces the older `Feature-Policy` header.',
  'shared.info.header.crossOriginOpenerPolicy.summary':
    'Isolates the page from cross-origin opener relationships (window.opener).',
  'shared.info.header.crossOriginOpenerPolicy.body1':
    '`same-origin` enables crossOriginIsolated mode — required for SharedArrayBuffer and high-resolution timers.',
  'shared.info.header.crossOriginEmbedderPolicy.summary':
    'Requires every loaded subresource to grant cross-origin permission.',
  'shared.info.header.crossOriginEmbedderPolicy.body1':
    'Set to `require-corp` for crossOriginIsolated. Pairs with `Cross-Origin-Opener-Policy: same-origin`.',
  'shared.info.header.crossOriginResourcePolicy.summary': 'Prevents the resource from being loaded by foreign origins.',
  'shared.info.header.crossOriginResourcePolicy.body1':
    'Values: `same-site`, `same-origin`, `cross-origin`. Critical for assets you don’t want hot-linked.',
  'shared.info.header.clearSiteData.summary': 'Asks the browser to clear cookies / cache / storage for this origin.',
  'shared.info.header.clearSiteData.body1': 'Useful for logout flows.',
  'shared.info.header.clearSiteData.value.cookies': 'Clear cookies for the origin.',
  'shared.info.header.clearSiteData.value.cache': 'Clear HTTP and image caches.',
  'shared.info.header.clearSiteData.value.storage': 'Clear localStorage / IndexedDB / Service Worker registrations.',
  'shared.info.header.clearSiteData.value.wildcard': 'Clear everything.',
  'shared.info.header.originAgentCluster.summary':
    '`?1` asks the browser to give this origin its own agent cluster (process).',
  'shared.info.header.originAgentCluster.body1':
    'Provides better isolation for `SharedArrayBuffer`, performance.measureUserAgentSpecificMemory, etc.',
  'shared.info.header.xRobotsTag.summary': 'Search-indexing directives for crawlers (`noindex`, `nofollow`, …).',
  'shared.info.header.xRobotsTag.body1':
    'Same semantics as the `<meta name="robots">` tag, but applies to non-HTML responses (PDFs, JSON, images).',
  'shared.info.header.xUaCompatible.summary':
    'Legacy IE/Edge directive (`IE=edge`) — picks the rendering engine. Obsolete in modern browsers.',

  // ── server-id ─────────────────────────────────────────────────────────
  'shared.info.header.server.summary':
    'Software identification of the origin server (e.g. `nginx/1.27`, `cloudflare`).',
  'shared.info.header.server.body1': 'Often stripped or set to a fixed value in production for opsec.',
  'shared.info.header.xPoweredBy.summary':
    'Non-standard header identifying the framework / runtime behind the response.',
  'shared.info.header.xPoweredBy.body1':
    'Commonly emitted by Express, PHP, ASP.NET, etc. Often suppressed in production.',
  'shared.info.header.date.summary': 'Origin server timestamp when the message was generated.',
  'shared.info.header.date.body1':
    'Used by caches to compute response age. Format: IMF-fixdate (`Mon, 18 May 2026 15:05:25 GMT`).',
  'shared.info.header.xServedBy.summary': 'Identifies which CDN edge / cache node served the response.',
  'shared.info.header.xServedBy.body1':
    'Comma-separated when multiple tiers handled the request (shield → edge). Format varies by vendor (Fastly POPs, AWS CloudFront edges, etc.).',

  // ── tracing ───────────────────────────────────────────────────────────
  'shared.info.header.serverTiming.summary': 'Performance metrics the server attaches to the response.',
  'shared.info.header.serverTiming.body1':
    'Surfaces in DevTools and `PerformanceServerTiming` JS API. Format: `<name>;dur=<ms>[;desc="..."]`, comma-separated.',
  'shared.info.header.traceparent.summary': 'W3C trace-context: identifies a span in a distributed trace.',
  'shared.info.header.traceparent.body1':
    'Format: `<version>-<trace-id>-<parent-id>-<flags>`. Carried across services so traces can be reassembled.',
  'shared.info.header.tracestate.summary': 'Vendor-specific trace-context companion to `traceparent`.',
  'shared.info.header.tracestate.body1':
    'Comma-separated `vendor=value` pairs. Each tracing vendor stores its own state here.',
  'shared.info.header.xRequestId.summary':
    'Server-assigned identifier for this request — echoed in logs and across services.',
  'shared.info.header.xRequestId.body1':
    'Non-standard but ubiquitous. Useful for correlating client behavior with server logs during debugging.',
  'shared.info.header.xFastlyRequestId.summary': 'Fastly request identifier — correlate with Fastly logs / debugging.',
  'shared.info.header.reportingEndpoints.summary':
    'Names destinations for browser-generated reports (CSP violations, deprecations, NEL, …).',
  'shared.info.header.reportingEndpoints.body1':
    'Format: `name="https://reports.example.com", name2="https://..."`. Replaces the older `Report-To` header.',
  'shared.info.header.reportTo.summary':
    'Older JSON-based reporting endpoint declaration — superseded by `Reporting-Endpoints`.',
  'shared.info.header.nel.summary':
    'Network Error Logging policy — JSON config naming an endpoint to receive connection failures and protocol errors.',
  'shared.info.header.nel.body1':
    'The endpoint must already be registered via `Reporting-Endpoints` (or the older `Report-To`).',
  'shared.info.header.cfRay.summary':
    'Cloudflare request identifier — used to correlate the request in Cloudflare logs.',
  'shared.info.header.cfRay.body1':
    'Format: `<request-id>-<colo-id>` where colo-id identifies the Cloudflare data center that served the request.',
} as const satisfies Catalog;
