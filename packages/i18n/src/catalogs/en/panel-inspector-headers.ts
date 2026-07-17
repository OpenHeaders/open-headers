/**
 * DevTools panel — the inspector Headers tab: General rows, header
 * insight corpora, and header chip copy. Header names, category
 * names, and directive tokens stay raw (shared-info-headers corpus
 * lock).
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
    'Filter — text, name:cookie, value:no-cache, is:rule, is:security, is:overridable, …',
  'panel.inspector.headers.filterAria': 'Filter headers',
  'panel.inspector.headers.footprintTitle': '{rules} — click to open Matched Rules',

  // General section + the rule-creation CTAs on its summary. The
  // query-params CTA label reuses `panel.inspector.overrideCta.
  // overrideQueryParams` (same control, same popover); its hover title
  // is this surface's own sentence.
  'panel.inspector.headers.generalSection': 'General',
  'panel.inspector.headers.createApiRequest': 'Create API request',
  'panel.inspector.headers.createApiRequestTitle':
    "Open this request in the workbench's API client as a pre-filled draft — nothing is saved until you save it",
  'panel.inspector.headers.redirect.label': 'Redirect',
  'panel.inspector.headers.redirect.title': 'Send matching requests somewhere else — pick how the target is pre-filled',
  'panel.inspector.headers.redirect.url': 'Redirect URL…',
  'panel.inspector.headers.redirect.urlTitle':
    'Send matching requests to a different URL — the target seeds as a per-domain variable',
  'panel.inspector.headers.redirect.replaceHost': 'Replace host…',
  'panel.inspector.headers.redirect.replaceHostTitle':
    'Keep path and query, swap the host — seeds a per-domain host variable',
  'panel.inspector.headers.redirect.localhost': 'Point to localhost…',
  'panel.inspector.headers.redirect.localhostTitle':
    'Keep path and query, send to your local dev server over http — seeds a per-domain port variable',
  'panel.inspector.headers.overrideQueryParamsTitle': "Add, replace or remove this request's query parameters",
  'panel.inspector.headers.more.label': 'More',
  'panel.inspector.headers.more.title': 'More request actions',
  'panel.inspector.headers.more.delay': 'Delay request',
  'panel.inspector.headers.more.delayTitle': 'Delay this request',
  'panel.inspector.headers.more.block': 'Block request',
  'panel.inspector.headers.more.blockTitle': 'Block / cancel this request',

  // General rows. The (i) corpus titles reuse these row-label keys and
  // the kicker reuses `generalSection` (names-its-control).
  'panel.inspector.headers.general.requestUrl': 'Request URL',
  'panel.inspector.headers.general.requestMethod': 'Request Method',
  'panel.inspector.headers.general.statusCode': 'Status Code',
  'panel.inspector.headers.general.remoteAddress': 'Remote Address',
  'panel.inspector.headers.general.httpVersion': 'HTTP Version',
  'panel.inspector.headers.general.compression': 'Compression',
  'panel.inspector.headers.general.transferred': 'Transferred',
  'panel.inspector.headers.general.referrerPolicy': 'Referrer Policy',
  'panel.inspector.headers.general.decodedSuffix': '(decoded {size})',

  // General (i) corpus. Range/protocol/encoding item LABELS (1xx…,
  // HTTP/2, gzip…) are wire vocabulary and stay raw in the builder;
  // the Common values heading reuses the shared header-corpus key.
  'panel.inspector.headers.generalInfo.requestUrl.summary':
    'The full URL the browser issued the request against — scheme, host, path, and query string.',
  'panel.inspector.headers.generalInfo.requestMethod.summary':
    'The HTTP method used (`GET`, `POST`, `PUT`, `DELETE`, …).',
  'panel.inspector.headers.generalInfo.statusCode.summary': 'The numeric response code returned by the server.',
  'panel.inspector.headers.generalInfo.statusCode.ranges': 'Ranges',
  'panel.inspector.headers.generalInfo.statusCode.r1xx': 'Informational (rare — `100 Continue`, `103 Early Hints`).',
  'panel.inspector.headers.generalInfo.statusCode.r2xx': 'Success.',
  'panel.inspector.headers.generalInfo.statusCode.r3xx': 'Redirection (look at the `Location` header).',
  'panel.inspector.headers.generalInfo.statusCode.r4xx': 'Client error — request was malformed or unauthorized.',
  'panel.inspector.headers.generalInfo.statusCode.r5xx': 'Server error — the server failed to fulfill a valid request.',
  'panel.inspector.headers.generalInfo.remoteAddress.summary':
    'The IP address and port the request was actually sent to.',
  'panel.inspector.headers.generalInfo.remoteAddress.description':
    'Different from the URL host when DNS resolves to multiple IPs, a CDN routes via anycast, or a local proxy intercepts the connection.',
  'panel.inspector.headers.generalInfo.httpVersion.summary': 'The HTTP protocol version the connection negotiated.',
  'panel.inspector.headers.generalInfo.httpVersion.description':
    'Picked at TLS time via ALPN. The actual on-the-wire value (e.g. `h2`, `h3`) is shown in the tooltip when it differs from the friendly label.',
  'panel.inspector.headers.generalInfo.httpVersion.http11': 'Text-based, one request per connection by default.',
  'panel.inspector.headers.generalInfo.httpVersion.http2': 'Binary, multiplexed over a single TCP connection.',
  'panel.inspector.headers.generalInfo.httpVersion.http3':
    'Built on QUIC over UDP — faster handshakes, better loss recovery.',
  'panel.inspector.headers.generalInfo.compression.summary':
    'The encoding the server applied to the response body — the browser decodes before exposing it to JavaScript.',
  'panel.inspector.headers.generalInfo.compression.gzip': 'Universally supported, modest compression ratio.',
  'panel.inspector.headers.generalInfo.compression.br':
    'Brotli — better ratio than gzip, supported by all modern browsers.',
  'panel.inspector.headers.generalInfo.compression.zstd': 'Newer high-ratio compression; growing browser support.',
  'panel.inspector.headers.generalInfo.compression.deflate': 'Legacy, rarely used today.',
  'panel.inspector.headers.generalInfo.transferred.summary':
    'Bytes that actually crossed the wire, including compression overhead.',
  'panel.inspector.headers.generalInfo.transferred.description':
    'The decoded size shown in parentheses is what JavaScript sees after the browser decompresses the body. A big gap between the two is the compression win.',
  'panel.inspector.headers.generalInfo.referrerPolicy.summary':
    'How much of the URL the browser sends in `Referer` on outgoing navigations and requests from this page.',
  'panel.inspector.headers.generalInfo.referrerPolicy.description':
    'Set via the `Referrer-Policy` response header, the `<meta name="referrer">` tag, or per-request via the `referrerpolicy` attribute.',

  // Provisional request headers — banner variants are whole sentences.
  'panel.inspector.headers.provisional.bannerCached':
    'Provisional headers are shown — served from cache, so the original sent headers aren’t stored.',
  'panel.inspector.headers.provisional.bannerPending':
    'Provisional headers are shown — the on-the-wire set hasn’t been confirmed yet.',
  'panel.inspector.headers.provisional.title': 'Provisional headers',
  'panel.inspector.headers.provisional.kicker': 'Request',
  'panel.inspector.headers.provisional.summary':
    'These are the headers the browser assembled and intended to send — not a confirmed capture of what crossed the wire. The on-the-wire set can differ (the network stack adds cookies, credentials, and connection headers later).',
  'panel.inspector.headers.provisional.whyHeading': 'Why a request shows only provisional headers',
  'panel.inspector.headers.provisional.cacheLabel': 'Served from cache',
  'panel.inspector.headers.provisional.cacheDesc':
    'Answered locally (memory/disk cache or a service worker) — nothing was sent on the wire this time, so the original sent headers were never stored.',
  'panel.inspector.headers.provisional.blockedLabel': 'Never reached the network',
  'panel.inspector.headers.provisional.blockedDesc':
    'Blocked or failed before a header exchange completed (an invalid URL, a CORS/CSP block, a connection error).',
  'panel.inspector.headers.provisional.inFlightLabel': 'Still in flight',
  'panel.inspector.headers.provisional.inFlightDesc':
    'The on-the-wire set has not been reported yet; it resolves once the request completes.',

  // Header sections. The `SectionLabel` identifiers stay raw (the
  // search plane compares against them — S36 doc-identifier law);
  // these are their display forms, mapped at the render site.
  'panel.inspector.headers.section.responseHeaders': 'Response Headers',
  'panel.inspector.headers.section.requestHeaders': 'Request Headers',
  'panel.inspector.headers.section.countAria': 'visible header count',
  'panel.inspector.headers.section.addHeader': 'Add Header',
  'panel.inspector.headers.section.raw': 'Raw',
  'panel.inspector.headers.section.rawTitle': 'Show as plain text (Name: Value)',
  'panel.inspector.headers.section.copy': 'Copy',
  'panel.inspector.headers.section.copyAll': 'Copy all',
  'panel.inspector.headers.section.copyFiltered': 'Copy filtered',
  'panel.inspector.headers.section.copyCurl': 'Copy as cURL',
  'panel.inspector.headers.section.copyFetch': 'Copy as fetch',
  'panel.inspector.headers.section.noneCaptured': 'None captured.',
  'panel.inspector.headers.section.noFilterMatch': 'No headers match the filter.',
  'panel.inspector.headers.section.noiseHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} noise header hidden — hover for names',
      other: '{count} noise headers hidden — hover for names',
    }),

  // More filters ▾ / View ▾ menus — this tab's own menus, separate
  // referents from the network toolbar's (`panel.moreFilters.*` /
  // `panel.network.view.*`). Reset reuses `panel.menu.resetToDefault`.
  'panel.inspector.headers.moreFilters.label': 'More filters',
  'panel.inspector.headers.moreFilters.ruleOnly': 'Rule-modified only',
  'panel.inspector.headers.moreFilters.securityOnly': 'Security headers only',
  'panel.inspector.headers.moreFilters.overridableOnly': 'Overridable only',
  'panel.inspector.headers.moreFilters.hideNoise': 'Hide noise (Accept-*, Sec-Fetch-*, User-Agent, …)',
  'panel.inspector.headers.view.label': 'View',
  'panel.inspector.headers.view.layout': 'Layout',
  'panel.inspector.headers.view.layoutGrouped': 'Grouped',
  'panel.inspector.headers.view.layoutFlat': 'Flat',
  'panel.inspector.headers.view.sort': 'Sort',
  'panel.inspector.headers.view.sortOriginal': 'Original',
  'panel.inspector.headers.view.sortAz': 'A → Z',
  'panel.inspector.headers.view.sortRuleFirst': 'Rule-modified first',
  'panel.inspector.headers.view.nameCase': 'Name case',
  'panel.inspector.headers.view.nameCaseTrain': 'Train-Case',
  'panel.inspector.headers.view.nameCaseOriginal': 'Original (raw)',
  'panel.inspector.headers.view.showTags': 'Show tags',
  'panel.inspector.headers.view.showSuggestions': 'Show suggestions',

  // Header rows. Since-fire chips render `· ` raw before the keyed
  // label. Header names ride the override titles as {name} holes.
  'panel.inspector.headers.row.expandValue': 'Expand value',
  'panel.inspector.headers.row.collapseValue': 'Collapse value',
  'panel.inspector.headers.row.copyValue': 'Copy value',
  'panel.inspector.headers.row.copied': 'Copied',
  'panel.inspector.headers.row.edit': 'Edit',
  'panel.inspector.headers.row.editTitle': 'Edit the rule that set this header',
  'panel.inspector.headers.row.override': 'Override',
  'panel.inspector.headers.row.overrideTitle': 'Create a rule to override this header',
  'panel.inspector.headers.row.overrideProtectedTitle':
    "{name} is a protected header — the browser's Declarative Net Request engine refuses to let extensions override it. Common protected names include host, content-length, connection, sec-fetch-*, sec-ch-ua-*.",
  'panel.inspector.headers.row.overrideSystemTitle':
    '{name} is injected by {feature}, an Open Headers system feature — not overridable with a rule.',
  'panel.inspector.headers.row.overrideManagedTitle':
    '{name} is already managed by one of your rules — edit the rule from its popover instead of overriding.',
  'panel.inspector.headers.row.systemTitle': 'Injected by {feature} (Open Headers system feature)',
  'panel.inspector.headers.row.sinceFire.deleted': 'rule deleted since',
  'panel.inspector.headers.row.sinceFire.deletedTitle':
    'Rule has been deleted since this request — it will not apply to future requests',
  'panel.inspector.headers.row.sinceFire.disabled': 'rule disabled since',
  'panel.inspector.headers.row.sinceFire.disabledTitle':
    'Rule has been disabled since this request — it will not apply to future requests',
  'panel.inspector.headers.row.sinceFire.edited': 'rule edited since',
  'panel.inspector.headers.row.sinceFire.editedTitle':
    'Rule has been edited since this request — current rule applies only to future requests',
  'panel.inspector.headers.row.sinceFire.value': 'variable changed since',
  'panel.inspector.headers.row.sinceFire.valueTitle':
    'A variable referenced by this rule resolves to a different value now — applies only to future requests',

  // Value chips. Flag/attribute chip TEXTS (HttpOnly, SameSite=Lax,
  // JWT, alg, `exp {duration}`, cache-directive summaries, boundary)
  // are wire vocabulary and stay raw; only the UI-worded chips key.
  'panel.inspector.headers.chips.expires': 'expires {duration}',
  'panel.inspector.headers.chips.session': 'session',
  'panel.inspector.headers.chips.missingFlag': 'no {flag}',
  'panel.inspector.headers.chips.expired': 'expired',

  // Chip (i) corpora. Titles that are wire vocabulary (HttpOnly,
  // SameSite=X, Cache-Control: …, Strict-Transport-Security, JWT,
  // scheme names) stay raw. Cache/HSTS directive descriptions reuse
  // the shared header corpus where the referent matches; the
  // parameterized ones (durations in the hole) live here.
  'panel.inspector.headers.chipInfo.setCookieFlagKicker': 'Set-Cookie flag',
  'panel.inspector.headers.chipInfo.httpOnly.summary':
    'Cookie is hidden from JavaScript (cannot be read via `document.cookie`).',
  'panel.inspector.headers.chipInfo.httpOnly.description':
    'Mitigates XSS — an injected script can no longer exfiltrate the cookie. Doesn’t help with CSRF.',
  'panel.inspector.headers.chipInfo.secure.summary': 'Cookie only sent over HTTPS. Never leaks over plain HTTP.',
  'panel.inspector.headers.chipInfo.partitioned.summary': 'CHIPS — cookie is partitioned per top-level site.',
  'panel.inspector.headers.chipInfo.partitioned.description':
    'Each top-level site gets its own copy of the cookie, so embedded contexts cannot use cookies to track the user across sites.',
  'panel.inspector.headers.chipInfo.sameSiteStrict':
    'Cookie only sent on same-site requests. Strongest CSRF protection — even links from another site arrive cookieless.',
  'panel.inspector.headers.chipInfo.sameSiteLax':
    'Cookie sent on same-site requests and top-level cross-site navigations (link clicks). Default in modern browsers.',
  'panel.inspector.headers.chipInfo.sameSiteNone':
    'Cookie sent on all cross-site requests. Requires `Secure`. Use intentionally — recipients can correlate the cookie across sites.',
  'panel.inspector.headers.chipInfo.cookieExpiry.title': 'Cookie expiry',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiredSummary':
    'Cookie has already expired. The browser will not send it.',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiresSummary': 'Cookie expires in {duration} (at {date}).',
  'panel.inspector.headers.chipInfo.cookieExpiry.description':
    'Cookies without `Max-Age` or `Expires` are session cookies and disappear when the browser quits. Set one to make the cookie persistent.',
  'panel.inspector.headers.chipInfo.sessionCookie.title': 'Session cookie',
  'panel.inspector.headers.chipInfo.sessionCookie.summary':
    'No `Max-Age` or `Expires` — the browser discards this cookie when it quits.',
  'panel.inspector.headers.chipInfo.sessionCookie.description':
    'Add `Max-Age=<seconds>` or `Expires=<date>` to make it persistent across browser sessions.',
  'panel.inspector.headers.chipInfo.missingFlag.title': 'Missing {flag}',
  'panel.inspector.headers.chipInfo.missingFlag.kicker': 'Best practice',
  'panel.inspector.headers.chipInfo.missingFlag.secure':
    'Without `Secure`, this cookie can leak over plain HTTP. Always set on HTTPS cookies.',
  'panel.inspector.headers.chipInfo.missingFlag.httpOnly':
    'Without `HttpOnly`, JavaScript can read this cookie via `document.cookie` — an XSS bug exfiltrates it.',
  'panel.inspector.headers.chipInfo.missingFlag.sameSite':
    'Without an explicit `SameSite`, browsers fall back to `Lax`. Be explicit so the policy is obvious in code review.',
  'panel.inspector.headers.chipInfo.missingFlag.description':
    'Most production cookies should carry `Secure`, `HttpOnly`, and an explicit `SameSite`.',
  'panel.inspector.headers.chipInfo.cacheKicker': 'Cache directive',
  'panel.inspector.headers.chipInfo.rawValue': 'Raw value: `{value}`.',
  'panel.inspector.headers.chipInfo.activeDirectives': 'Active directives',
  'panel.inspector.headers.chipInfo.maxAge': 'Fresh for {duration}.',
  'panel.inspector.headers.chipInfo.sMaxage': 'Shared-cache freshness: {duration}.',
  'panel.inspector.headers.chipInfo.staleWhileRevalidate':
    'Allow stale reuse for {duration} while a background revalidation runs.',
  'panel.inspector.headers.chipInfo.contentTypeParamKicker': 'Content-Type parameter',
  'panel.inspector.headers.chipInfo.charset.summary': 'Character encoding the body uses.',
  'panel.inspector.headers.chipInfo.charset.description':
    'For `text/*` types, modern stacks default to `utf-8`. Wrong values cause mojibake.',
  'panel.inspector.headers.chipInfo.boundary.title': 'Multipart boundary',
  'panel.inspector.headers.chipInfo.boundary.summary':
    'Token that separates parts of a multipart body (file uploads, multipart/form-data).',
  'panel.inspector.headers.chipInfo.boundary.description':
    'Generated by the client; must not appear inside any part’s body.',
  'panel.inspector.headers.chipInfo.hsts.kicker': 'Security policy',
  'panel.inspector.headers.chipInfo.hsts.summary': 'Browser will use HTTPS for this host for {duration}.',
  'panel.inspector.headers.chipInfo.authSchemeKicker': 'Authorization scheme',
  'panel.inspector.headers.chipInfo.jwt.summary':
    'JSON Web Token — a base64-encoded `<header>.<payload>.<signature>` triple.',
  'panel.inspector.headers.chipInfo.jwt.description':
    'The signature proves the token was issued by someone holding the signing key. The header (alg, typ) and payload (claims) are NOT encrypted — they are simply base64-encoded and readable by anyone.',
  'panel.inspector.headers.chipInfo.jwtHeaderKicker': 'JWT header',
  'panel.inspector.headers.chipInfo.jwtClaimKicker': 'JWT claim',
  'panel.inspector.headers.chipInfo.jwtAlg.summary': 'Signing algorithm declared in the JWT header.',
  'panel.inspector.headers.chipInfo.jwtAlg.description':
    'Common values: `HS256` (HMAC-SHA256, symmetric), `RS256` (RSA, asymmetric), `ES256` (ECDSA). `none` (no signature) should always be rejected by validators.',
  'panel.inspector.headers.chipInfo.jwtExpired.title': 'JWT expired',
  'panel.inspector.headers.chipInfo.jwtExpired.summary': 'Token expired {duration} ago. The server should reject it.',
  'panel.inspector.headers.chipInfo.jwtExpires.title': 'JWT expires in {duration}',
  'panel.inspector.headers.chipInfo.jwtExpires.soonSummary':
    'Token is close to expiry — refresh it or expect a 401 soon.',
  'panel.inspector.headers.chipInfo.jwtExpires.summary': 'Time until the JWT `exp` claim is reached.',
  'panel.inspector.headers.chipInfo.scheme.bearer':
    'Opaque bearer credential (OAuth 2.0 / API token). Treat it like a password — anyone who has it can authenticate as the user.',
  'panel.inspector.headers.chipInfo.scheme.basic':
    'HTTP Basic auth — `base64(username:password)`. Only safe over HTTPS.',
  'panel.inspector.headers.chipInfo.scheme.other':
    'Authentication scheme name. The credential format depends on the scheme.',

  // Header insights (t-fed `computeHeaderInsights`). Origins, cookie
  // names, HSTS summaries, and durations ride as raw holes.
  'panel.inspector.headers.insights.corsWildcard.title': 'CORS misconfigured',
  'panel.inspector.headers.insights.corsWildcard.detail':
    '`Access-Control-Allow-Origin: *` cannot be combined with credentials — the browser will reject this response.',
  'panel.inspector.headers.insights.corsWildcard.action': 'Override with {origin}',
  'panel.inspector.headers.insights.corsMissingAcao.title': 'CORS request without Access-Control-Allow-Origin',
  'panel.inspector.headers.insights.corsMissingAcao.detail':
    'Request carried `Origin: {origin}` but the response has no `Access-Control-Allow-Origin`. The browser will block the response.',
  'panel.inspector.headers.insights.corsMissingAcao.action': 'Add Access-Control-Allow-Origin: {origin}',
  'panel.inspector.headers.insights.cookieMissingSecure.titleOne': 'Cookie `{name}` missing `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.titleMany': '{count} cookies missing `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.detail':
    'Cookies set over HTTPS should carry `Secure` so they cannot be sent over plain HTTP.',
  'panel.inspector.headers.insights.missingCsp.title': 'No Content-Security-Policy on HTML response',
  'panel.inspector.headers.insights.missingCsp.action': 'Add a baseline CSP',
  'panel.inspector.headers.insights.hstsShort.title': 'HSTS max-age is very short ({summary})',
  'panel.inspector.headers.insights.hstsShort.detail':
    'Most policies recommend at least 6 months; preload requires 1 year.',
  'panel.inspector.headers.insights.jwtExpired.title': 'JWT in Authorization header is expired',
  'panel.inspector.headers.insights.jwtExpired.detail': 'Expired {duration} ago.',
  'panel.inspector.headers.insights.jwtExpiring.title': 'JWT expires in {duration}',
  'panel.inspector.headers.insights.missingContentType.title': 'Response has no Content-Type',
  'panel.inspector.headers.insights.missingContentType.action': 'Add Content-Type',
} as const satisfies Catalog;
