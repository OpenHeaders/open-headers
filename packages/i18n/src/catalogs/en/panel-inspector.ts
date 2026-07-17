/**
 * DevTools panel — request inspector detail plane: tab bar + section
 * tabs, body/payload views, headers + cookies tabs with their insight
 * corpora, stream grids (WS/SSE messages), raw-data, initiator, and
 * timing tabs.
 *
 * Raw by design: header/cookie TABLE column headers and Set-Cookie
 * attribute names (parity grids), async stack labels (JS vocabulary),
 * wire-shaped hover titles, encoding names (Base64 / UTF-8), and the
 * `HeaderSection`/`CookieSection` label props — those are search-plane
 * identifiers, localized at the render site only (S48 identifier law).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspector = {
  // ── Inspector detail empty states ────────────────────────────────────
  // The select prompt flanks an inline Network-panel glyph, so it keys
  // as prefix + suffix fragments.
  'panel.inspector.detailEmpty.requestGone': 'Request no longer available (cleared or navigated away)',
  'panel.inspector.detailEmpty.selectPrefix': 'Select a request from the',
  'panel.inspector.detailEmpty.selectSuffix': 'Network panel to inspect',

  // ── Inspector shell (editor tab bar + detail section tabs) ──────────
  // Raw by design: method badges, status codes, tab labels (URLs, storage
  // keys, cookie/cache identities), the IDB/SS/LS/CS chips, the wire-shaped
  // pill hover title, and the ▾ / ▼ / ▶ / × glyphs beside keyed values.
  'panel.inspector.tabBar.closeTab': 'Close tab',
  'panel.inspector.tabBar.unsavedChanges': 'Unsaved changes',
  'panel.inspector.tabBar.searchTabs': 'Search tabs',
  'panel.inspector.tabBar.searchPlaceholder': 'Search tabs…',
  'panel.inspector.tabBar.noOpenTabs': 'No open tabs',
  'panel.inspector.tabBar.noOpenTabsMatch': 'No open tabs match your search',
  'panel.inspector.tabBar.noClosedTabsMatch': 'No closed tabs match your search',
  'panel.inspector.tabBar.recentlyClosed': 'Recently Closed ({count})',
  'panel.inspector.tabBar.recentlyClosedFiltered': 'Recently Closed ({matched} of {total})',

  // Dirty-close confirm (useTabCloseGuard) — the body follows a bolded
  // tab label in the JSX, so it keys as the sentence remainder.
  'panel.inspector.tabBar.closeGuard.unsavedTitle': 'Save changes?',
  'panel.inspector.tabBar.closeGuard.unsavedBody': 'has unsaved changes. Save these changes to avoid losing your work.',
  'panel.inspector.tabBar.closeGuard.dontSave': 'Don’t save',
  'panel.inspector.tabBar.closeGuard.cancel': 'Cancel',
  'panel.inspector.tabBar.closeGuard.save': 'Save changes',

  // Tab context menu. Direction words are split directions, not the
  // layout menu's alignment nouns — separate referents, separate keys.
  'panel.inspector.tabMenu.close': 'Close',
  'panel.inspector.tabMenu.closeOther': 'Close Other Tabs',
  'panel.inspector.tabMenu.closeAll': 'Close All Tabs',
  'panel.inspector.tabMenu.closeToLeft': 'Close Tabs to the Left',
  'panel.inspector.tabMenu.closeToRight': 'Close Tabs to the Right',
  'panel.inspector.tabMenu.splitAndMove': 'Split and Move',
  'panel.inspector.tabMenu.right': 'Right',
  'panel.inspector.tabMenu.left': 'Left',
  'panel.inspector.tabMenu.down': 'Down',
  'panel.inspector.tabMenu.up': 'Up',
  'panel.inspector.tabMenu.moveToOppositeGroup': 'Move To Opposite Group',
  'panel.inspector.tabMenu.changeSplitterOrientation': 'Change Splitter Orientation',
  'panel.inspector.tabMenu.unsplit': 'Unsplit',
  'panel.inspector.tabMenu.unsplitAll': 'Unsplit All',

  // Detail section tabs — keyed but glossary-protected on translator
  // handoff (host-panel tab nouns, same as the workbench tab nouns).
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
  'panel.inspector.overrideCta.editOverride': 'Edit override',
  'panel.inspector.overrideCta.editOverrideTitle':
    'Edit the rule that produced this response — changes apply to future requests',
  'panel.inspector.overrideCta.overrideResponse': 'Override Response',
  'panel.inspector.overrideCta.overrideResponseTitle': 'Create a rule that serves this response as an editable mock',
  'panel.inspector.overrideCta.editQueryParams': 'Edit query params override',
  'panel.inspector.overrideCta.editQueryParamsTitle':
    'Edit the rule that rewrote these query parameters — changes apply to future requests',
  'panel.inspector.overrideCta.overrideQueryParams': 'Override query params',
  'panel.inspector.overrideCta.overrideQueryParamsTitle': 'Create a rule that rewrites these query parameters',
  'panel.inspector.overrideCta.editRequestBody': 'Edit request body override',
  'panel.inspector.overrideCta.editRequestBodyTitle':
    'Edit the rule that replaced this request body — changes apply to future requests',
  'panel.inspector.overrideCta.overrideRequestBody': 'Override request body',
  'panel.inspector.overrideCta.overrideRequestBodyTitle':
    'Create a rule that replaces this request body with an editable static body',

  // Dual-view controls (Response / Preview / Payload two-sided views).
  'panel.inspector.dualView.diff': 'Diff',
  'panel.inspector.dualView.fullResponse': 'Full response',
  'panel.inspector.dualView.fullRequest': 'Full request',
  'panel.inspector.dualView.swapSides': 'Swap sides',
  'panel.inspector.dualView.hideUnchanged': 'Hide unchanged',

  // Delivery-path pane captions for the two-sided views — phrased as
  // the delivery path; the server/page arrows ride raw inside the value.
  'panel.inspector.paneCaption.responseOriginal': 'Original · server → page',
  'panel.inspector.paneCaption.responseModified': 'Modified · server → Open Headers → page',
  'panel.inspector.paneCaption.requestOriginal': 'Original · page → server',
  'panel.inspector.paneCaption.requestModified': 'Modified · page → Open Headers → server',
  'panel.inspector.paneCaption.wsRecvDropped': 'Dropped · never reached the page',
  'panel.inspector.paneCaption.wsSendDropped': 'Dropped · never reached the server',

  // Body-state notices (Response tab + Preview tab twins). Wire vocab
  // (HEAD / CONNECT / status codes / WebSocket) rides raw inside values.
  'panel.inspector.bodyState.noResponseBodyTitle': 'No response body',
  'panel.inspector.bodyState.noPreviewTitle': 'No preview available',
  'panel.inspector.bodyState.nothingToPreviewTitle': 'Nothing to preview',
  'panel.inspector.bodyState.noResponseDetail': 'This request has no response data available',
  'panel.inspector.bodyState.failedTitle': 'Failed to load response data',
  'panel.inspector.bodyState.emptyTitle': '(empty response body)',
  'panel.inspector.bodyState.emptyDetail': 'The server returned an empty body.',
  'panel.inspector.bodyState.binaryPayloadBytes': 'Binary payload ({count} bytes).',
  'panel.inspector.bodyState.notApplicable.preflight': 'No content available for preflight request',
  'panel.inspector.bodyState.notApplicable.head': 'No response body for HEAD request',
  'panel.inspector.bodyState.notApplicable.connect': 'No response body for CONNECT request',
  'panel.inspector.bodyState.notApplicable.status204': 'No content (204 No Content)',
  'panel.inspector.bodyState.notApplicable.status205': 'No content (205 Reset Content)',
  'panel.inspector.bodyState.notApplicable.status304': 'Not modified — body served from browser cache',
  'panel.inspector.bodyState.notApplicable.informational': 'No content (informational response)',
  'panel.inspector.bodyState.notApplicable.websocket': 'WebSocket connection upgraded — see the Messages tab',
  'panel.inspector.bodyState.unavailable.opaque': 'Response body not available — opaque cross-origin response',
  'panel.inspector.bodyState.unavailable.cache':
    'Body not available — response was served from cache before DevTools opened',
  'panel.inspector.bodyState.unavailable.redirect': 'No content available because this request was redirected',
  'panel.inspector.bodyState.unavailable.unknown':
    'Body not captured. The host returned no content — the response was streamed without buffering or served from cache.',

  // Preview tab's own chrome.
  'panel.inspector.preview.notAvailableForType': 'Preview not available for this content type.',
  'panel.inspector.preview.imageAlt': 'response preview',

  // Shared body-viewer toolbars. Raw by design: Base64 / UTF-8 encoding
  // names, keyboard chords, the { } pretty-print glyph, and the sniffer
  // format nouns (JSON / XML / …) riding through as {format}.
  'panel.inspector.viewer.prettyPrintTitle': 'Pretty print',
  'panel.inspector.viewer.revertTitle': 'Revert to declared Content-Type',
  'panel.inspector.viewer.parsedAsRevert': 'Parsed as {format} · revert',
  'panel.inspector.viewer.looksLikeParse': 'Looks like {format} · parse',
  'panel.inspector.viewer.looksLikeTitle':
    'Content-Type looks off — the body parses as {format}. Click to reinterpret.',
  'panel.inspector.viewer.cursorInfo': 'Line {line}, Column {col}',
  'panel.inspector.viewer.lineCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} line', other: '{count} lines' }),
  'panel.inspector.viewer.hexViewer': 'Hex Viewer',
  'panel.inspector.viewer.find': 'Find',
  'panel.inspector.viewer.findTitle': 'Find ({chord})',

  // Payload tab chrome. The section titles carry the captured MIME raw.
  'panel.inspector.payload.queryStringParameters': 'Query String Parameters',
  'panel.inspector.payload.requestBody': 'Request Body ({mime})',
  'panel.inspector.payload.viewSource': 'View source',
  'panel.inspector.payload.viewParsed': 'View parsed',
  'panel.inspector.payload.viewUrlEncoded': 'View URL-encoded',

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

  // ── Cookies tab (inspector detail). Raw by design: cookie names and
  // values, Set-Cookie attribute names as titles and field labels
  // (Name / Value / Domain / Path / Expires / SameSite / HttpOnly /
  // Secure / Host-only — S10 response-panel precedent), the table
  // column headers (parity-shaped grid headers), SameSite values and
  // the `COOKIE_SAME_SITE_LABELS` display vocabulary (conflict-merge
  // round-trip parses it back), `S H L` glyph letters, `__Host-` /
  // `__Secure-` prefixes, JWT / JSON / b64 / %-encoded format nouns,
  // 'Session' + relative expiry phrases in `cookie-format.ts` (rides
  // with the Phase I format-ago plane), filter grammar tokens, byte
  // figures, and the ⚠ / ! / ▾ / → glyphs beside keyed values. ───────
  'panel.inspector.cookies.filterPlaceholder':
    'Filter — text, name:sess, is:secure, is:samesite-none, is:problem, is:third-party, …',
  'panel.inspector.cookies.filterAria': 'Filter cookies',
  'panel.inspector.cookies.empty': 'No cookies sent or received.',

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
  'panel.inspector.cookies.footprint.sent': '{count} sent · {bytes} B',
  'panel.inspector.cookies.footprint.set': '{count} set · {bytes} B',
  'panel.inspector.cookies.footprint.dropped': '{count} will be dropped',
  'panel.inspector.cookies.footprint.filteredOut': '{count} filtered out',
  'panel.inspector.cookies.footprint.flagged': '{count} flagged',

  // Toolbar CTAs — the rule world (Override Cookies ▾) and the jar
  // world (Add cookie), each with its own (i) corpus.
  'panel.inspector.cookies.cta.overrideCookies': 'Override Cookies',
  'panel.inspector.cookies.cta.overrideCookiesTitle': 'Create a rule that changes the cookies on matching requests',
  'panel.inspector.cookies.cta.requestCookies': 'Request cookies…',
  'panel.inspector.cookies.cta.requestCookiesTitle': 'Replace the Cookie header sent on this request',
  'panel.inspector.cookies.cta.responseCookies': 'Response cookies…',
  'panel.inspector.cookies.cta.responseCookiesTitle': 'Replace a Set-Cookie header coming back from the server',
  'panel.inspector.cookies.cta.noCookies': 'Don’t send any cookies…',
  'panel.inspector.cookies.cta.noCookiesTitle': 'Drop the Cookie header entirely, so the server sees no cookies',
  'panel.inspector.cookies.cta.addCookie': 'Add cookie',
  'panel.inspector.cookies.cta.addCookieTitle': 'Add a cookie to the browser jar (including HttpOnly)',
  'panel.inspector.cookies.ctaInfo.overrideTitle': 'Override Cookies',
  'panel.inspector.cookies.ctaInfo.ruleKicker': 'Rule',
  'panel.inspector.cookies.ctaInfo.overrideSummary':
    'Creates a rule that rewrites the Cookie / Set-Cookie headers on matching requests while it fires. The browser cookie jar is untouched.',
  'panel.inspector.cookies.ctaInfo.choicesHeading': 'Choices',
  'panel.inspector.cookies.ctaInfo.requestLabel': 'Request cookies',
  'panel.inspector.cookies.ctaInfo.requestDesc': 'Replace the Cookie header the browser sends.',
  'panel.inspector.cookies.ctaInfo.responseLabel': 'Response cookies',
  'panel.inspector.cookies.ctaInfo.responseDesc': 'Replace a Set-Cookie header coming back from the server.',
  'panel.inspector.cookies.ctaInfo.noneLabel': 'Don’t send any cookies',
  'panel.inspector.cookies.ctaInfo.noneDesc':
    'Drop the Cookie header entirely — the server sees a cookie-less request.',
  'panel.inspector.cookies.ctaInfo.addTitle': 'Add Cookie',
  'panel.inspector.cookies.ctaInfo.jarKicker': 'Browser jar',
  'panel.inspector.cookies.ctaInfo.addSummary':
    'Writes a real cookie into the browser jar — the same store the browser shows under Application → Cookies.',
  'panel.inspector.cookies.ctaInfo.addDescription':
    'It persists beyond this request and the browser attaches it wherever its domain, path and flags match — no rule involved. This is also the way to create HttpOnly cookies, which page scripts can’t set. The value accepts {{variable}} references, resolved once when you save — the jar keeps that snapshot even if the variable changes later; use Override Cookies when the value should track the variable.',

  // Jar-write toasts + the delete confirm.
  'panel.inspector.cookies.toast.saved': 'Cookie “{name}” saved',
  'panel.inspector.cookies.toast.saveFailed': 'Couldn’t save cookie “{name}”',
  'panel.inspector.cookies.toast.saveFailedWithError': 'Couldn’t save cookie “{name}” — {error}',
  'panel.inspector.cookies.toast.deleted': 'Cookie “{name}” deleted',
  'panel.inspector.cookies.toast.deleteFailed': 'Couldn’t delete cookie “{name}”',
  'panel.inspector.cookies.toast.mergeApplied': 'Merge applied to the form — Save writes it to the browser',
  'panel.inspector.cookies.confirmDelete.title': 'Delete cookie “{name}”?',
  'panel.inspector.cookies.confirmDelete.content':
    'This removes it from the browser cookie jar. The page will stop sending it.',
  'panel.inspector.cookies.confirmDelete.ok': 'Delete',

  // More filters ▾ / View ▾ — this tab's own menus (separate referents
  // from the headers tab's). Reset reuses `panel.menu.resetToDefault`.
  'panel.inspector.cookies.moreFilters.label': 'More filters',
  'panel.inspector.cookies.moreFilters.problemsOnly': 'Problems only',
  'panel.inspector.cookies.moreFilters.thirdPartyOnly': '3rd-party only',
  'panel.inspector.cookies.moreFilters.ruleOnly': 'Rule-modified only',
  'panel.inspector.cookies.moreFilters.showFilteredOut': 'Show filtered-out request cookies',
  'panel.inspector.cookies.view.label': 'View',
  'panel.inspector.cookies.view.sort': 'Sort',
  'panel.inspector.cookies.view.sortOriginal': 'Original',
  'panel.inspector.cookies.view.sortAz': 'A → Z',
  'panel.inspector.cookies.view.sortSize': 'Size',
  'panel.inspector.cookies.view.sortExpires': 'Expires',
  'panel.inspector.cookies.view.expiresFormat': 'Expires',
  'panel.inspector.cookies.view.expiresRelative': 'Relative',
  'panel.inspector.cookies.view.expiresAbsolute': 'Absolute',
  'panel.inspector.cookies.view.decodeValues': 'Decode URL-encoded values',
  'panel.inspector.cookies.view.groupByRole': 'Group by role (auth / pref / tracking)',
  'panel.inspector.cookies.view.showTags': 'Show tags',
  'panel.inspector.cookies.view.showSuggestions': 'Show suggestions',

  // Section chrome. Column headers stay raw in the table; the visible
  // count sentence keys.
  'panel.inspector.cookies.section.responseCookies': 'Response Cookies',
  'panel.inspector.cookies.section.requestCookies': 'Request Cookies',
  'panel.inspector.cookies.section.countOf': '{visible} of {total}',

  // Role vocabulary — product classifier copy (fire-evidence badge
  // precedent: product vocabulary keys, it is not browser parity).
  'panel.inspector.cookies.role.chipAuth': 'auth?',
  'panel.inspector.cookies.role.chipTracking': 'tracking?',
  'panel.inspector.cookies.role.chipPref': 'pref',
  'panel.inspector.cookies.role.sectionAuth': 'Auth & session',
  'panel.inspector.cookies.role.sectionFunctional': 'Functional',
  'panel.inspector.cookies.role.sectionPref': 'Preferences',
  'panel.inspector.cookies.role.sectionTracking': 'Analytics & tracking',
  'panel.inspector.cookies.role.nounAuth': 'auth / session',
  'panel.inspector.cookies.role.nounTracking': 'analytics / tracking',
  'panel.inspector.cookies.role.nounPref': 'preference / consent',
  'panel.inspector.cookies.role.nounOther': 'cookie',
  'panel.inspector.cookies.role.vendorTooltip': '{vendor} — {noun} cookie.',
  'panel.inspector.cookies.role.tooltipAuth': 'Looks like an auth / session cookie (heuristic).',
  'panel.inspector.cookies.role.tooltipTracking': 'Looks like an analytics / tracking cookie (heuristic).',
  'panel.inspector.cookies.role.tooltipPref': 'A user-preference cookie.',

  // Lifecycle / context chips — facts not in any column.
  'panel.inspector.cookies.chips.partitioned': 'partitioned',
  'panel.inspector.cookies.chips.partitionedTitle': 'Isolated to top-level site: {key}',
  'panel.inspector.cookies.chips.thirdParty': '3rd-party',
  'panel.inspector.cookies.chips.justSet': 'just set',
  'panel.inspector.cookies.chips.justSetTitle': 'Set by this response.',
  'panel.inspector.cookies.chips.dropped': 'dropped',
  'panel.inspector.cookies.chips.droppedTitle': 'The browser will reject this Set-Cookie.',
  'panel.inspector.cookies.chips.filteredOut': 'filtered out',
  'panel.inspector.cookies.chips.filteredOutFallbackTitle': 'Not sent on this request.',
  'panel.inspector.cookies.chips.problemTitle': 'See suggestion above.',

  // S / H / L security-glyph tooltips — the letters stay raw.
  'panel.inspector.cookies.glyphs.secureOn': 'Secure — sent only over HTTPS.',
  'panel.inspector.cookies.glyphs.secureMissingSameSiteNone':
    'Missing Secure — SameSite=None requires Secure; browser will reject this cookie.',
  'panel.inspector.cookies.glyphs.secureMissingPrefix': 'Missing Secure — __Host- / __Secure- prefix requires Secure.',
  'panel.inspector.cookies.glyphs.secureOff': 'No Secure attribute.',
  'panel.inspector.cookies.glyphs.httpOnlyOn': 'HttpOnly — not readable from JavaScript.',
  'panel.inspector.cookies.glyphs.httpOnlyOff': 'Readable from JavaScript (no HttpOnly).',
  'panel.inspector.cookies.glyphs.sameSiteStrict': 'SameSite=Strict — only sent on same-site navigations.',
  'panel.inspector.cookies.glyphs.sameSiteLax': 'SameSite=Lax — sent on cross-site top-level GETs.',
  'panel.inspector.cookies.glyphs.sameSiteNoneNoSecure': 'SameSite=None without Secure — browser will reject.',
  'panel.inspector.cookies.glyphs.sameSiteNone': 'SameSite=None — sent on every cross-site request.',
  'panel.inspector.cookies.glyphs.sameSiteUnspecified': 'SameSite unspecified.',

  // Row actions + status dots + name/value tooltips. Prefix hints
  // append after the raw cookie name + blank line; the modified header
  // name (Cookie / Set-Cookie) rides the rule-dot title as a raw hole.
  'panel.inspector.cookies.row.copyValue': 'Copy value',
  'panel.inspector.cookies.row.copied': 'Copied',
  'panel.inspector.cookies.row.override': 'Override',
  'panel.inspector.cookies.row.overrideSetCookieTitle': 'Create a rule to override this Set-Cookie',
  'panel.inspector.cookies.row.overrideCookieTitle': 'Create a rule to override this Cookie value',
  'panel.inspector.cookies.row.editCookieTitle': 'Edit this cookie in the browser jar',
  'panel.inspector.cookies.row.editCookieAria': 'Edit cookie',
  'panel.inspector.cookies.row.deleteCookieTitle': 'Delete this cookie from the browser jar',
  'panel.inspector.cookies.row.deleteCookieAria': 'Delete cookie',
  'panel.inspector.cookies.row.ruleDotTitle': 'A rule modifies the {header} header on this request',
  'panel.inspector.cookies.row.ruleDotAria': 'Rule applies',
  'panel.inspector.cookies.row.editedDotTitle': 'Edited from this panel',
  'panel.inspector.cookies.row.editedDotAria': 'Edited',
  'panel.inspector.cookies.row.hostPrefixHint':
    'The __Host- prefix locks this cookie to one host: the browser enforces Secure, Path=/, and no Domain attribute. Set-Cookie lines that violate any of those are rejected.',
  'panel.inspector.cookies.row.securePrefixHint':
    'The __Secure- prefix forces this cookie to be Secure (HTTPS-only). Set-Cookie lines missing Secure are rejected.',
  'panel.inspector.cookies.row.editedValueTitle': 'Edited — request carried: {value}',
  'panel.inspector.cookies.row.valueNoteResponse': 'This response set: {value} — the jar value has changed since.',
  'panel.inspector.cookies.row.valueNoteRequest': 'This request sent: {value} — the jar value has changed since.',

  // Status-rail (i) — OH-native rail copy; kicker is the raw brand.
  'panel.inspector.cookies.statusRail.title': 'Status',
  'panel.inspector.cookies.statusRail.summary': 'A square marks cookies that are not in their raw browser state.',
  'panel.inspector.cookies.statusRail.colorsHeading': 'Square colors',
  'panel.inspector.cookies.statusRail.blue': 'blue',
  'panel.inspector.cookies.statusRail.blueDesc':
    'A rule that fired on this request modifies this direction’s Cookie / Set-Cookie header.',
  'panel.inspector.cookies.statusRail.grey': 'grey',
  'panel.inspector.cookies.statusRail.greyDesc': 'Added or edited from this panel during this session.',

  // Add / edit popover. Title reuses the toolbar CTA (names-its-
  // control). The SameSite labels, On/Off flag words and the Session
  // expires word are ROUND-TRIP vocabulary: the conflict projection
  // renders them and the merge dialog parses them back, so display and
  // parse read the same keys (cookie-edit.ts is t-first on both sides).
  'panel.inspector.cookies.edit.editTitle': 'Edit cookie',
  'panel.inspector.cookies.edit.valueChanged': 'value changed',
  'panel.inspector.cookies.edit.goneNote':
    'This cookie was deleted in the browser while the form was open — Save writes it back.',
  'panel.inspector.cookies.edit.openInTab': 'Open in new tab',
  'panel.inspector.cookies.edit.openDirtyTitle':
    'Save or cancel your edits first — the document opens from the browser jar',
  'panel.inspector.cookies.edit.openTitle': 'Open this cookie as a document tab',
  'panel.inspector.cookies.edit.save': 'Save',
  'panel.inspector.cookies.edit.unresolved': 'Doesn’t resolve — create the variable or fix the reference.',
  'panel.inspector.cookies.edit.writes': 'Writes: {value}',
  'panel.inspector.cookies.edit.field.name': 'Name',
  'panel.inspector.cookies.edit.field.value': 'Value',
  'panel.inspector.cookies.edit.field.hostOnly': 'Host-only',
  'panel.inspector.cookies.edit.namePlaceholder': 'cookie name',
  'panel.inspector.cookies.edit.valuePlaceholder': 'value or {{variable}}',
  'panel.inspector.cookies.edit.session': 'Session',
  'panel.inspector.cookies.edit.onDate': 'On date',
  'panel.inspector.cookies.edit.sameSite.unspecified': 'Unspecified',
  'panel.inspector.cookies.edit.sameSite.noRestriction': 'None (cross-site)',
  'panel.inspector.cookies.edit.sameSite.lax': 'Lax',
  'panel.inspector.cookies.edit.sameSite.strict': 'Strict',
  'panel.inspector.cookies.edit.flagOn': 'On',
  'panel.inspector.cookies.edit.flagOff': 'Off',
  // Pre-write constraint sentences — the __Host- / __Secure- prefixes
  // and path “/” ride raw inside; the SameSite label feeds through a
  // hole so the sentence can never drift from the select option.
  'panel.inspector.cookies.edit.constraint.hostSecure': '__Host- cookies must have the Secure flag on.',
  'panel.inspector.cookies.edit.constraint.hostDomain':
    '__Host- cookies can’t carry a Domain attribute — turn “Host only” on.',
  'panel.inspector.cookies.edit.constraint.hostPath': '__Host- cookies must use path “/”.',
  'panel.inspector.cookies.edit.constraint.securePrefix': '__Secure- cookies must have the Secure flag on.',
  'panel.inspector.cookies.edit.constraint.sameSiteNone': 'SameSite “{label}” requires the Secure flag.',
  // Merge parse-back errors — rendered inline in the merge modal. The
  // quoted field names are the JSON projection's raw keys; the quoted
  // vocabulary words feed through holes from the keys above.
  'panel.inspector.cookies.edit.merge.invalidJson':
    'The merged result isn’t valid JSON — fix the syntax and complete the merge again.',
  'panel.inspector.cookies.edit.merge.notObject': 'The merged result must be a JSON object with the cookie’s fields.',
  'panel.inspector.cookies.edit.merge.fieldMissing': '"{field}" must be present as a string.',
  'panel.inspector.cookies.edit.merge.flagOnOff': '"{field}" must be "{on}" or "{off}".',
  'panel.inspector.cookies.edit.merge.sameSiteOneOf': '"sameSite" must be one of {labels}.',
  'panel.inspector.cookies.edit.merge.expiresInvalid': '"expires" must be "{session}" or a date like 2026-07-09T14:30.',

  // Edit-form field (i) corpus — titles are the raw attribute names;
  // the shared template note keys once and composes with ' '.
  'panel.inspector.cookies.fieldInfo.exampleCaption': 'Example Set-Cookie',
  'panel.inspector.cookies.fieldInfo.fieldKicker': 'Cookie field',
  'panel.inspector.cookies.fieldInfo.flagKicker': 'Cookie flag',
  'panel.inspector.cookies.fieldInfo.templateNote':
    'Accepts {{variable}} references, resolved once when you save — the jar stores the resolved text.',
  'panel.inspector.cookies.fieldInfo.name.summary':
    'The cookie identifier. Browsers key on (name, domain, path) — same name with a different scope is a separate cookie.',
  'panel.inspector.cookies.fieldInfo.name.description':
    'Prefixes are enforced by the browser: __Host- requires Secure, Path=/ and no Domain; __Secure- requires Secure.',
  'panel.inspector.cookies.fieldInfo.value.summary':
    'The cookie payload — what the browser sends back in the Cookie header.',
  'panel.inspector.cookies.fieldInfo.value.description':
    'The value is a snapshot: if the variable changes later the jar keeps this text — use an Override Cookies rule when the value should track the variable.',
  'panel.inspector.cookies.fieldInfo.domain.summary': 'Which hosts receive the cookie.',
  'panel.inspector.cookies.fieldInfo.domain.description':
    'A plain domain like openheaders.io includes its subdomains (the browser stores it with a leading dot) unless Host-only is on, which pins the cookie to exactly this host.',
  'panel.inspector.cookies.fieldInfo.path.summary':
    'URL path prefix the cookie rides on — /api means only requests under /api carry it.',
  'panel.inspector.cookies.fieldInfo.path.description': 'Defaults to /.',
  'panel.inspector.cookies.fieldInfo.expires.summary': 'When the browser deletes the cookie.',
  'panel.inspector.cookies.fieldInfo.expires.description':
    'Session cookies live until the browser session ends; On date sets an absolute expiry (stored as the Expires attribute).',
  'panel.inspector.cookies.fieldInfo.samesite.summary': 'When cross-site requests may carry the cookie.',
  'panel.inspector.cookies.fieldInfo.samesite.valuesHeading': 'Values',
  'panel.inspector.cookies.fieldInfo.samesite.strict': 'Same-site requests only.',
  'panel.inspector.cookies.fieldInfo.samesite.lax': 'Same-site plus top-level cross-site navigations (GET).',
  'panel.inspector.cookies.fieldInfo.samesite.none': 'Sent cross-site too — the browser requires Secure with it.',
  'panel.inspector.cookies.fieldInfo.samesite.unspecified': 'Browser default (treated as Lax in Chrome).',
  'panel.inspector.cookies.fieldInfo.httponly.summary':
    'Hides the cookie from page JavaScript — document.cookie can’t read or overwrite it.',
  'panel.inspector.cookies.fieldInfo.httponly.description':
    'Only servers (Set-Cookie) and this editor can create HttpOnly cookies; page scripts can’t. The standard hardening for session tokens.',
  'panel.inspector.cookies.fieldInfo.secure.summary':
    'The cookie travels only over HTTPS — plain http requests never carry it.',
  'panel.inspector.cookies.fieldInfo.secure.description':
    'Required for SameSite=None and for the __Host- / __Secure- name prefixes.',
  'panel.inspector.cookies.fieldInfo.hostonly.summary':
    'Pins the cookie to exactly the Domain host — subdomains don’t receive it.',
  'panel.inspector.cookies.fieldInfo.hostonly.description':
    'Off, the cookie is stored domain-wide (leading-dot form) and flows to subdomains. The browser’s own cookies are host-only when the server omitted the Domain attribute.',

  // Column (i) corpus — column-name titles stay raw; the Sec cell's
  // long title keys whole (glyph letters ride inside).
  'panel.inspector.cookies.columnInfo.name.summary':
    'The cookie identifier. Browsers key on (name, domain, path) — two cookies with the same name but different scope are distinct.',
  'panel.inspector.cookies.columnInfo.name.description':
    'Chips on the right surface things that are not in any column. They appear next to the name; hover a row to reveal the Override action over the value.',
  'panel.inspector.cookies.columnInfo.name.roleHeading': 'Role (heuristic)',
  'panel.inspector.cookies.columnInfo.name.authDesc':
    'Looks like an auth / session cookie — name matches sess / session / auth / sid / token / csrf / xsrf, or the cookie is HttpOnly with a long random value.',
  'panel.inspector.cookies.columnInfo.name.trackingDesc':
    'Looks like an analytics / tracking cookie — name matches a known tracker (_ga, _gid, _fbp, NID, IDE, MUID, _hjid, …), or the cookie is third-party with no other classification.',
  'panel.inspector.cookies.columnInfo.name.prefDesc':
    'A user-preference cookie — tz, lang, locale, theme, color-mode, currency, cpu-bucket, font-size, …',
  'panel.inspector.cookies.columnInfo.name.lifecycleHeading': 'Lifecycle',
  'panel.inspector.cookies.columnInfo.name.justSetDesc':
    'Set-Cookie landed on this response and the browser accepted it.',
  'panel.inspector.cookies.columnInfo.name.droppedDesc':
    'Set-Cookie landed but the browser will reject it — failed a rule like SameSite=None without Secure, __Host- prefix violation, __Secure- prefix without Secure, or Partitioned without Secure.',
  'panel.inspector.cookies.columnInfo.name.filteredOutDesc':
    'The jar holds this cookie but it was not sent on this request (path mismatch, Secure on http, expired, SameSite restriction, …). Only appears when "Show filtered-out request cookies" is on.',
  'panel.inspector.cookies.columnInfo.name.contextHeading': 'Context',
  'panel.inspector.cookies.columnInfo.name.thirdPartyDesc':
    "The cookie's domain is cross-site to the page's top-frame origin.",
  'panel.inspector.cookies.columnInfo.name.partitionedDesc':
    'CHIPS-style isolation — the cookie is keyed to the top-level site as well as its own scope. Hover for the partition key.',
  'panel.inspector.cookies.columnInfo.name.problemDesc':
    'This cookie triggered an insight (the warning cards at the top of the tab). See the callout to know why.',
  'panel.inspector.cookies.columnInfo.name.prefixesHeading': 'Prefixes (visible in the name)',
  'panel.inspector.cookies.columnInfo.name.hostPrefixDesc':
    'Host-locked — browser enforces Secure, Path=/, no Domain. Violations are rejected.',
  'panel.inspector.cookies.columnInfo.name.securePrefixDesc':
    'HTTPS-only — browser enforces Secure. Violations are rejected.',
  'panel.inspector.cookies.columnInfo.value.summary':
    'The cookie payload. Click a row to expand a panel with parsed views when the value carries structure.',
  'panel.inspector.cookies.columnInfo.value.formatsHeading': 'Auto-detected formats',
  'panel.inspector.cookies.columnInfo.value.jwtDesc':
    'Three base64url segments — header and payload are decoded; exp / iat / nbf claims show as relative times.',
  'panel.inspector.cookies.columnInfo.value.jsonDesc': 'Pretty-printed in the expander (works after URL-decoding too).',
  'panel.inspector.cookies.columnInfo.value.b64Desc': 'Plain base64 — decoded body shown when printable.',
  'panel.inspector.cookies.columnInfo.value.urlEncodedDesc':
    'Percent-encoded text — toggle "Decode URL-encoded values" in View to show decoded inline.',
  'panel.inspector.cookies.columnInfo.scope.summary':
    'Where the browser will attach this cookie — the combined Domain + Path.',
  'panel.inspector.cookies.columnInfo.scope.description':
    'A leading dot on the domain (e.g. `.openheaders.io`) means subdomains are included. A trailing path like `/api` means the cookie is only sent on requests under that path.',
  'panel.inspector.cookies.columnInfo.expires.summary':
    'When the browser will stop sending this cookie. Color tracks urgency.',
  'panel.inspector.cookies.columnInfo.expires.colorHeading': 'Reading the color',
  'panel.inspector.cookies.columnInfo.expires.red': 'red',
  'panel.inspector.cookies.columnInfo.expires.redDesc': 'Already expired, or expires in under an hour.',
  'panel.inspector.cookies.columnInfo.expires.yellow': 'yellow',
  'panel.inspector.cookies.columnInfo.expires.yellowDesc': 'Expires within 24 hours.',
  'panel.inspector.cookies.columnInfo.expires.plain': 'plain',
  'panel.inspector.cookies.columnInfo.expires.plainDesc': 'Future — more than a day away.',
  'panel.inspector.cookies.columnInfo.expires.sessionDesc':
    'No Expires / Max-Age — the browser drops it when the session ends.',
  'panel.inspector.cookies.columnInfo.expires.formatHeading': 'Format',
  'panel.inspector.cookies.columnInfo.expires.relativeLabel': 'Relative (default)',
  'panel.inspector.cookies.columnInfo.expires.relativeDesc':
    '"in 7mo", "30s ago" — relative to now. Hover for the absolute date.',
  'panel.inspector.cookies.columnInfo.expires.absoluteLabel': 'Absolute',
  'panel.inspector.cookies.columnInfo.expires.absoluteDesc': 'UTC date. Toggle in View → Expires.',
  'panel.inspector.cookies.columnInfo.size.summary':
    'Serialized cookie size in bytes — `name=value` length, used for the per-request payload total.',
  'panel.inspector.cookies.columnInfo.size.description':
    'Most servers and intermediaries cap the combined Cookie header at 4 KB. Oversized payloads can cause 4xx / 5xx responses without a clear error.',
  'panel.inspector.cookies.columnInfo.sec.title': 'Security (S H L)',
  'panel.inspector.cookies.columnInfo.sec.summary':
    'Three glyphs collapse the Secure / HttpOnly / SameSite attributes into one cell. Color carries the meaning.',
  'panel.inspector.cookies.columnInfo.sec.glyphsHeading': 'Glyphs',
  'panel.inspector.cookies.columnInfo.sec.sDesc': 'Secure — sent only over HTTPS.',
  'panel.inspector.cookies.columnInfo.sec.hDesc': 'HttpOnly — not readable from JavaScript.',
  'panel.inspector.cookies.columnInfo.sec.lDesc': 'SameSite restriction (Lax / Strict / None).',
  'panel.inspector.cookies.columnInfo.sec.colorHeading': 'Color',
  'panel.inspector.cookies.columnInfo.sec.green': 'green',
  'panel.inspector.cookies.columnInfo.sec.greenDesc': 'On / strict — locked down.',
  'panel.inspector.cookies.columnInfo.sec.yellow': 'yellow',
  'panel.inspector.cookies.columnInfo.sec.yellowDesc': 'Lax — sent on top-level cross-site GETs.',
  'panel.inspector.cookies.columnInfo.sec.red': 'red',
  'panel.inspector.cookies.columnInfo.sec.redDesc':
    'Missing where required (SameSite=None without Secure, __Host- without Secure, …) — browser will reject.',
  'panel.inspector.cookies.columnInfo.sec.gray': 'gray',
  'panel.inspector.cookies.columnInfo.sec.grayDesc': 'Off / unspecified.',

  // Cookie insights (t-fed `computeCookieInsights`). Names, origins,
  // byte figures and attribute vocabulary ride as raw holes / inline.
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie set with SameSite=None but missing Secure',
      other: '{count} cookies set with SameSite=None but missing Secure',
    }),
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.detail':
    'Modern browsers reject SameSite=None cookies that are not also Secure — they will not be stored.',
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.action': 'Add Secure attribute',
  'panel.inspector.cookies.insights.hostPrefix.title': '__Host- prefix violated on {names}',
  'panel.inspector.cookies.insights.hostPrefix.detail':
    '__Host- cookies must be Secure, Path=/, and have no Domain attribute. Browsers reject them otherwise.',
  'panel.inspector.cookies.insights.securePrefix.title': '__Secure- prefix violated on {names}',
  'panel.inspector.cookies.insights.securePrefix.detail':
    '__Secure- cookies must carry the Secure attribute. Browsers reject them otherwise.',
  'panel.inspector.cookies.insights.partitionedNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Partitioned cookie missing Secure',
      other: '{count} Partitioned cookies missing Secure',
    }),
  'panel.inspector.cookies.insights.partitionedNoSecure.detail': 'Partitioned cookies must be Secure.',
  'panel.inspector.cookies.insights.setOnHttp.title': 'Cookies set over plain HTTP',
  'panel.inspector.cookies.insights.setOnHttp.detail':
    'These cookies can be observed and replayed by anyone on the path. Use HTTPS + the Secure attribute.',
  'panel.inspector.cookies.insights.expiredSent.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} expired cookie still being sent',
      other: '{count} expired cookies still being sent',
    }),
  'panel.inspector.cookies.insights.expiredSent.detail':
    'These cookies have an expiry in the past but the request carried them — the jar will drop them shortly.',
  'panel.inspector.cookies.insights.oversized.title': 'Cookie header is {bytes}B (over the 4KB common limit)',
  'panel.inspector.cookies.insights.oversized.detail':
    'Servers and intermediaries cap header size; oversized Cookie payloads can cause 4xx / 5xx without a clear error.',
  'panel.inspector.cookies.insights.thirdPartySet.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} third-party cookie set',
      other: '{count} third-party cookies set',
    }),
  'panel.inspector.cookies.insights.thirdPartySet.titleBy': ({ count, origin }, locale) => {
    const lead = plural(locale, Number(count), {
      one: '{count} third-party cookie set by',
      other: '{count} third-party cookies set by',
    });
    return `${lead} ${String(origin)}`;
  },
  'panel.inspector.cookies.insights.thirdPartySet.detail':
    'Modern browsers may block these in cross-site contexts unless they opt into CHIPS via the Partitioned attribute.',

  // ── Messages / EventStream tabs (inspector detail) — the streams'
  // OWN copy; pane captions were keyed with the body-tabs family. Raw
  // by design: grid column headers and their info-popover titles
  // (Data / Length / Time / Id / Type — parity columns), opcode labels
  // and the whole `ws-frames.ts` cell vocabulary ('Binary Message',
  // 'N/A', byte figures — parity cells), the ⬆ / ⬇ / ⚠ / ● / ▲ / ▼
  // glyphs, example-card sample payloads and times, the `id:` /
  // `event:` / `Last-Event-ID` wire fields, the JSON toggle (format
  // vocabulary, Base64/UTF-8 precedent) and Base64 / Hex / UTF-8 modes,
  // and `stream-time.ts` figures. Row loops resolve their copy from a
  // labels object memoized on `t` — never `t()` in the row body. ─────
  'panel.inspector.streams.clearAll': 'Clear all',
  'panel.inspector.streams.directionFilterTitle': 'Filter by direction',
  'panel.inspector.streams.directionAll': 'All',
  'panel.inspector.streams.directionSend': 'Send',
  'panel.inspector.streams.directionReceive': 'Receive',
  'panel.inspector.streams.filterAria': 'Filter stream messages',
  'panel.inspector.streams.sortByTitle': 'Sort by {column}',
  'panel.inspector.streams.resizeColumnAria': 'Resize {column} column',

  // View ▾ menu shared by both grids.
  'panel.inspector.streams.view.label': 'View',
  'panel.inspector.streams.view.layout': 'Layout',
  'panel.inspector.streams.view.layoutCompact': 'Compact',
  'panel.inspector.streams.view.layoutWide': 'Wide',
  'panel.inspector.streams.view.split': 'Split',
  'panel.inspector.streams.view.splitSideBySide': 'Side by side',
  'panel.inspector.streams.view.splitStacked': 'Stacked',
  'panel.inspector.streams.view.splitDisabledTitle': 'Enable the payload preview to split the pane',
  'panel.inspector.streams.view.showPreview': 'Show payload preview',

  // Fire-rail dot titles + row actions — resolved once per locale into
  // the row labels object.
  'panel.inspector.streams.fire.appliedFrame': "Rule applied — the frame's payload matches the rule's payload",
  'panel.inspector.streams.fire.inferredFrame': 'Rule matched — application not verifiable for this frame',
  'panel.inspector.streams.fire.injectedFrame': 'Rule applied — this frame was injected by the rule',
  'panel.inspector.streams.fire.replacedFrame': 'Rule applied — the rule replaced this frame',
  'panel.inspector.streams.fire.droppedSendFrame': 'Rule dropped this frame — it was never sent to the server',
  'panel.inspector.streams.fire.droppedRecvFrame': 'Rule dropped this frame — the page never received it',
  'panel.inspector.streams.fire.appliedEvent': "Rule applied — the event's payload matches the rule's payload",
  'panel.inspector.streams.fire.inferredEvent': 'Rule matched — application not verifiable for this event',
  'panel.inspector.streams.fire.injectedEvent': 'Rule applied — this event was injected by the rule',
  'panel.inspector.streams.fire.replacedEvent': 'Rule applied — the rule replaced this event',
  'panel.inspector.streams.fire.droppedEvent': 'Rule dropped this event — the page never received it',
  'panel.inspector.streams.row.copied': 'Copied',
  'panel.inspector.streams.row.copyPayload': 'Copy payload',
  'panel.inspector.streams.row.editRule': 'Edit rule',
  'panel.inspector.streams.row.override': 'Override',
  'panel.inspector.streams.row.droppedSendCell': 'Dropped — never sent to the server',
  'panel.inspector.streams.row.droppedRecvCell': 'Dropped — never delivered to the page',
  'panel.inspector.streams.row.notCaptured': 'Not captured',

  // Messages (WebSocket) surface.
  'panel.inspector.messages.filterPlaceholder': 'Filter messages',
  'panel.inspector.messages.listAria': 'WebSocket messages',
  'panel.inspector.messages.overrideMessage': 'Override message',
  'panel.inspector.messages.overrideMessageTitle': 'Create a message rule for this connection',
  'panel.inspector.messages.editRuleTitle': 'Edit the message rule that acted on this frame',
  'panel.inspector.messages.createRuleTitle': 'Create a message rule seeded from this frame',
  'panel.inspector.messages.syntheticDroppedTitle':
    'Synthetic row — the page produced this frame; the rule dropped it before send',
  'panel.inspector.messages.syntheticInjectedTitle':
    'Synthetic frame — injected by a rule inside the page; never crossed the wire',
  'panel.inspector.messages.emptyNoDebug': 'WebSocket frames are only visible with debug mode enabled for this tab.',
  'panel.inspector.messages.emptySynthetic':
    'No frames crossed the wire — an inject rule fired here, and injected frames are delivered synthetically inside the page, invisible to the network capture.',
  'panel.inspector.messages.emptyNone': 'No WebSocket frames exchanged yet.',
  'panel.inspector.messages.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} older frame dropped.',
      other: '{count} older frames dropped.',
    });
    return `Showing the latest ${String(shown)} frames — ${dropped}`;
  },

  // EventStream (SSE) surface.
  'panel.inspector.sse.filterPlaceholder': 'Filter events',
  'panel.inspector.sse.listAria': 'Server-sent events',
  'panel.inspector.sse.overrideEvent': 'Override event',
  'panel.inspector.sse.overrideEventTitle': 'Create a message rule for this stream',
  'panel.inspector.sse.editRuleTitle': 'Edit the message rule that acted on this event',
  'panel.inspector.sse.createRuleTitle': 'Create a message rule seeded from this event',
  'panel.inspector.sse.syntheticTitle': 'Synthetic event — injected by a rule inside the page; never crossed the wire',
  'panel.inspector.sse.emptySynthetic':
    'No events crossed the wire — an inject rule fired here, and injected events are delivered synthetically inside the page, invisible to the network capture.',
  'panel.inspector.sse.emptyUnparseable': 'No parseable SSE events in the response body.',
  'panel.inspector.sse.emptyNoDebug':
    'No events captured. Without debug mode, server-sent streams are only materialized once the request finishes; long-running streams may not populate here until the connection closes.',
  'panel.inspector.sse.emptyNone': 'No events received yet.',
  'panel.inspector.sse.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} older event dropped.',
      other: '{count} older events dropped.',
    });
    return `Showing the latest ${String(shown)} events — ${dropped}`;
  },

  // Preview panes (MessagePreview / SseEventPreview / shared TextPayload
  // + BinaryPreview). The JSON toggle stays raw beside the keyed Raw.
  'panel.inspector.streams.preview.noMessageTitle': 'No message selected',
  'panel.inspector.streams.preview.noMessageHint': 'Select message to browse its content.',
  'panel.inspector.streams.preview.noEventTitle': 'No event selected',
  'panel.inspector.streams.preview.noEventHint': 'Select an event to browse its content.',
  'panel.inspector.streams.preview.raw': 'Raw',
  'panel.inspector.streams.preview.copy': 'Copy',
  'panel.inspector.streams.preview.copied': 'Copied',
  'panel.inspector.streams.preview.copyTitle': 'Copy to clipboard',
  'panel.inspector.streams.preview.decodeFailed': 'Binary payload could not be decoded.',
  'panel.inspector.messages.preview.droppedSendPane':
    'The rule dropped this frame — the page produced it, but it was never sent to the server.',
  'panel.inspector.messages.preview.droppedRecvPane':
    'The rule dropped this frame — it reached the browser but was never delivered to the page.',
  'panel.inspector.messages.preview.originalNotCaptured':
    'The frame the page produced was not captured — only the modified frame crossed the wire.',
  'panel.inspector.messages.preview.syntheticNote':
    'Synthetic frame — injected by a rule inside the page; it never crossed the wire.',
  'panel.inspector.sse.preview.droppedPane':
    'The rule dropped this event — it reached the browser but was never delivered to the page.',
  'panel.inspector.sse.preview.syntheticNote':
    'Synthetic event — injected by a rule inside the page; it never crossed the wire.',

  // Inferred-tier (i) corpora on the split captions — frame and event
  // wordings are separate referents.
  'panel.inspector.messages.inferredModified.title': 'Derived, not captured',
  'panel.inspector.messages.inferredModified.summary':
    "This side shows the rule's replacement payload — the capture plane only ever saw the wire frame.",
  'panel.inspector.messages.inferredModified.description':
    "The wire recorded the original frame; the modification happened inside the page after capture. That this exact frame took the replacement is inferred from the rule's frame selector, matching the amber fire dot.",
  'panel.inspector.messages.inferredDropped.title': 'Dropped, inferred',
  'panel.inspector.messages.inferredDropped.summary':
    'The wire recorded this frame, but the rule stopped its delivery inside the page.',
  'panel.inspector.messages.inferredDropped.description':
    "The drop happens after capture, so nothing can record the non-delivery itself. That this exact frame was dropped is inferred from the rule's frame selector, matching the amber fire dot.",
  'panel.inspector.sse.inferredModified.title': 'Derived, not captured',
  'panel.inspector.sse.inferredModified.summary':
    "This side shows the rule's replacement payload — the capture plane only ever saw the wire event.",
  'panel.inspector.sse.inferredModified.description':
    "The wire recorded the original event; the modification happened inside the page after capture. That this exact event took the replacement is inferred from the rule's event selector, matching the amber fire dot.",
  'panel.inspector.sse.inferredDropped.title': 'Dropped, inferred',
  'panel.inspector.sse.inferredDropped.summary':
    'The wire recorded this event, but the rule stopped its delivery inside the page.',
  'panel.inspector.sse.inferredDropped.description':
    "The drop happens after capture, so nothing can record the non-delivery itself. That this exact event was dropped is inferred from the rule's event selector, matching the amber fire dot.",

  // Column / rail (i) corpora — titles are raw column nouns; kickers
  // reuse the section-tab keys; the fire-rail kicker is the raw brand.
  'panel.inspector.messages.columnInfo.exampleCaption': 'Example frame',
  // Fragment between the length and time tokens in the example card's
  // meta line ('42 chars · 18:00:01').
  'panel.inspector.messages.columnInfo.exampleChars': 'chars ·',
  'panel.inspector.messages.columnInfo.data.summary': 'The frame payload — text frames show their content verbatim.',
  'panel.inspector.messages.columnInfo.data.description':
    'Select a row to open the payload viewer: a JSON tree when the text parses, a Base64 / Hex / UTF-8 viewer for binary frames.',
  'panel.inspector.messages.columnInfo.data.insteadHeading': 'Instead of the payload',
  'panel.inspector.messages.columnInfo.data.binaryDesc':
    'A binary frame — the bytes live in the payload viewer, not the cell.',
  'panel.inspector.messages.columnInfo.data.pingPongDesc': 'Keepalive control frames exchanged by the endpoints.',
  'panel.inspector.messages.columnInfo.data.closeDesc': 'The closing handshake that ends the socket.',
  'panel.inspector.messages.columnInfo.length.summary':
    'The payload size — a bare character count for text frames, formatted bytes (e.g. `4 B`) for binary frames.',
  'panel.inspector.messages.columnInfo.time.summary': 'The wall-clock moment the frame crossed the wire.',
  'panel.inspector.messages.columnInfo.time.description':
    'The one sortable column. Ascending is wire order; frames on the same millisecond keep their arrival order either way.',
  'panel.inspector.messages.directionInfo.title': 'Direction',
  'panel.inspector.messages.directionInfo.summary': 'Which way the frame traveled.',
  'panel.inspector.messages.directionInfo.arrowsHeading': 'Arrows',
  'panel.inspector.messages.directionInfo.sentDesc': 'Sent — the page pushed this frame to the server.',
  'panel.inspector.messages.directionInfo.receivedDesc': 'Received — the server pushed this frame to the page.',
  'panel.inspector.messages.directionInfo.errorDesc':
    'Error — a transport failure ended the stream; the row reads red.',
  'panel.inspector.streams.fireRail.title': 'Rule fires',
  'panel.inspector.streams.fireRail.dotColorsHeading': 'Dot colors',
  'panel.inspector.messages.fireRail.summary':
    "A dot marks each frame a WebSocket message rule acted on. Frames carry no rule attribution, so the dot is derived: this request's fired message rules, each rule's frame selector re-run against the frame.",
  'panel.inspector.messages.fireRail.appliedDesc':
    "Applied — the frame's payload equals the rule's replacement or injected payload.",
  'panel.inspector.messages.fireRail.inferredDesc':
    "Inferred — the rule's direction and message filter select this frame, but application is not verifiable (a modified frame no longer holds the payload the filter matched).",
  'panel.inspector.messages.fireRail.description':
    'A dropped outgoing frame never crosses the wire, so it has no row at all. A dropped incoming frame was captured on the wire first — its row stays, marked "Dropped — never delivered to the page".',
  'panel.inspector.sse.columnInfo.exampleCaption': 'Example event',
  'panel.inspector.sse.columnInfo.id.summary':
    "The event's `id:` field — the reconnection cursor the server hands out.",
  'panel.inspector.sse.columnInfo.id.description':
    'Empty when the server sends no id. On reconnect the browser echoes the last id back as `Last-Event-ID`, so the server can resume the stream where it left off.',
  'panel.inspector.sse.columnInfo.type.summary': "The event's `event:` field — `message` for default events.",
  'panel.inspector.sse.columnInfo.type.description':
    'Page code subscribes per type: `onmessage` only sees default events; named events need an `addEventListener` for that exact type.',
  'panel.inspector.sse.columnInfo.data.summary':
    'The event payload — always text; multi-line `data:` fields arrive joined.',
  'panel.inspector.sse.columnInfo.data.description':
    'Select a row to open the payload viewer: a JSON tree when the text parses, verbatim otherwise.',
  'panel.inspector.sse.columnInfo.time.summary': 'The wall-clock moment the event arrived.',
  'panel.inspector.sse.columnInfo.time.description':
    'Sortable, ascending by default. Events parsed out of a finished response body carry no time — the SSE wire format has none — so their cells stay empty.',
  'panel.inspector.sse.fireRail.summary':
    "A dot marks each event an SSE message rule acted on. A wrapper-recorded capture is proof; without one the dot is derived: this request's fired SSE rules, each rule's event selector re-run against the event.",
  'panel.inspector.sse.fireRail.appliedDesc':
    'Applied — the wrapper recorded acting on this exact event, or an injected payload matches.',
  'panel.inspector.sse.fireRail.inferredDesc':
    "Inferred — the rule's event name and data filter select this event, but application is not verifiable from the wire alone.",
  'panel.inspector.sse.fireRail.description':
    'Server-sent events only travel server → page, and the wire records them before the rule acts: a dropped event keeps its row, marked "Dropped — never delivered to the page"; an injected event never crosses the wire and shows as a synthetic row.',

  // ── Raw Data tab (inspector detail) — export-snippet band + raw HAR
  // band. Raw by design: the generated snippet text itself (paste-into-
  // terminal material), HAR / JSON / .har / HAR 1.2 format nouns riding
  // inside keyed values, and the technical tokens inside the format
  // option labels (cURL, bash, fetch, Node, Python requests,
  // Invoke-WebRequest). ────────────────────────────────────────────────
  'panel.inspector.rawData.exportSnippet': 'Export snippet',
  'panel.inspector.rawData.formatLabel': 'Format',
  'panel.inspector.rawData.copy': 'Copy',
  'panel.inspector.rawData.copied': 'Copied',
  'panel.inspector.rawData.rawHar': 'Raw HAR (JSON)',
  'panel.inspector.rawData.downloadHar': 'Download .har',
  'panel.inspector.rawData.noRequestData': '(no request data yet)',
  'panel.inspector.rawData.view.label': 'View',
  'panel.inspector.rawData.view.includeHeaders': 'Include request headers',
  'panel.inspector.rawData.view.includeBody': 'Include request body',
  'panel.inspector.rawData.view.redactSecrets': 'Redact secrets',
  'panel.inspector.rawData.view.ruleModifiedHeading': 'Rule-modified headers',
  'panel.inspector.rawData.view.postRule': 'Post-rule (on the wire)',
  'panel.inspector.rawData.view.original': 'Original (before rules)',
  'panel.inspector.rawData.format.curlUnix': 'cURL (bash)',
  'panel.inspector.rawData.format.curlWindows': 'cURL (Windows)',
  'panel.inspector.rawData.format.fetchBrowser': 'JavaScript — fetch (browser)',
  'panel.inspector.rawData.format.fetchNode': 'JavaScript — fetch (Node)',
  'panel.inspector.rawData.format.pythonRequests': 'Python — requests',
  'panel.inspector.rawData.format.powershell': 'PowerShell — Invoke-WebRequest',
  'panel.inspector.rawData.format.httpRaw': 'HTTP — raw message',
  'panel.inspector.rawData.format.har': 'HAR — single entry',
  // HAR (i) corpus — the title stays the raw format name (HAR 1.2).
  'panel.inspector.rawData.harInfo.kicker': 'Format',
  'panel.inspector.rawData.harInfo.summary': 'Portable HTTP Archive — a JSON snapshot of one request.',
  'panel.inspector.rawData.harInfo.description':
    'Save it to attach to a bug report, share with a teammate, or import into another tool that reads HAR files.',

  // ── Initiator tab (inspector detail) — call stack, upstream chain,
  // downstream tree, cascade stats + insights. Raw by design: the
  // async-boundary section labels (`await in fn`, `Promise resolved
  // (async)` — JS vocabulary that also feeds the copied stack text),
  // `(anonymous)`, the `@` locator glyph, wire initiator-type values
  // (parser / script / other), filter grammar tokens riding inside the
  // keyed placeholder, the ▼ / ▶ toggles, and byte / ms figures. ──────
  'panel.inspector.initiator.noData': 'No initiator data available.',
  'panel.inspector.initiator.typeLabel': 'Type:',
  'panel.inspector.initiator.stack.heading': 'Request call stack',
  'panel.inspector.initiator.stack.frameCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} frame', other: '{count} frames' }),
  'panel.inspector.initiator.stack.resolvedCount': '{count} resolved',
  'panel.inspector.initiator.stack.resolvedTitle': 'Function names resolved via source maps',
  'panel.inspector.initiator.stack.showHidden': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'Show {count} hidden', other: 'Show {count} hidden' }),
  'panel.inspector.initiator.stack.hideNoisy': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'Hide {count} noisy', other: 'Hide {count} noisy' }),
  'panel.inspector.initiator.stack.noiseTitle': 'Hide anonymous frames inside minified bundles',
  'panel.inspector.initiator.stack.copyTitle': 'Copy stack as text',
  'panel.inspector.initiator.stack.copy': 'Copy',
  'panel.inspector.initiator.stack.copied': 'Copied',
  'panel.inspector.initiator.stack.filterPlaceholder': 'Filter frames (function name or URL)…',
  'panel.inspector.initiator.stack.filterAria': 'Filter call-stack frames',
  'panel.inspector.initiator.stack.noMatch': 'No frames match.',
  'panel.inspector.initiator.stack.showing': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { one: '{count} frame', other: '{count} frames' });
    return `Showing ${String(shown)} of ${total}`;
  },
  'panel.inspector.initiator.stack.hiddenSuffix': '({count} hidden)',
  'panel.inspector.initiator.stack.sourceMapNameTitle': 'Source-map name: {name}',
  'panel.inspector.initiator.stack.originalTitle': '{url} (original: {source})',
  'panel.inspector.initiator.moreFilters.label': 'More filters',
  'panel.inspector.initiator.moreFilters.failuresOnly': 'Failures only',
  'panel.inspector.initiator.moreFilters.thirdPartyOnly': '3rd-party only',
  'panel.inspector.initiator.view.label': 'View',
  'panel.inspector.initiator.view.sort': 'Sort',
  'panel.inspector.initiator.view.sortInitiator': 'Initiator order',
  'panel.inspector.initiator.view.sortChronological': 'Chronological',
  'panel.inspector.initiator.view.sortLargest': 'Largest subtree',
  'panel.inspector.initiator.view.showSuggestions': 'Show suggestions',
  'panel.inspector.initiator.filterPlaceholder':
    'Filter — text, is:failed, is:third-party, type:js, status:404, size:>50kb',
  'panel.inspector.initiator.filterAria': 'Filter initiator chain',
  'panel.inspector.initiator.matchCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} match', other: '{count} matches' }),
  // Two sections share the English 'Request initiator chain' but are
  // separate referents: the upstream (ancestor) chain and the
  // downstream tree.
  'panel.inspector.initiator.upstreamChain': 'Request initiator chain',
  'panel.inspector.initiator.chainTree': 'Request initiator chain',
  'panel.inspector.initiator.collapse': 'Collapse',
  'panel.inspector.initiator.expand': 'Expand',
  // Cascade stat strip — the bolded figures ride outside; the noun
  // declines with the count (markup-split plural, count not printed).
  'panel.inspector.initiator.cascade.requestsWord': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'request', other: 'requests' }),
  'panel.inspector.initiator.cascade.transferred': 'transferred',
  'panel.inspector.initiator.cascade.cumulative': 'cumulative',
  'panel.inspector.initiator.cascade.failed': 'failed',
  // Row chips (product classifier vocabulary, cookie-role precedent).
  'panel.inspector.initiator.chip.initiatorTypeTitle': 'Initiator type',
  'panel.inspector.initiator.chip.httpStatusTitle': 'HTTP status',
  'panel.inspector.initiator.chip.requestFailedTitle': 'Request failed',
  'panel.inspector.initiator.chip.failed': 'failed',
  'panel.inspector.initiator.chip.transferredTitle': 'Transferred',
  'panel.inspector.initiator.chip.durationTitle': 'Duration',
  'panel.inspector.initiator.chip.thirdPartyTitle': 'Third-party origin',
  'panel.inspector.initiator.chip.thirdParty': '3rd-party',
  'panel.inspector.initiator.chip.subtreeTitle': 'Subtree weight (descendants · bytes)',
  'panel.inspector.initiator.chip.subtree': '+{count} req · {bytes}',
  // Cascade insights (t-fed `computeCascadeInsights`). Hosts, byte
  // figures and percentages ride as raw holes.
  'panel.inspector.initiator.insights.failedHeadline': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} failed request in this cascade.',
      other: '{count} failed requests in this cascade.',
    }),
  'panel.inspector.initiator.insights.failedHint': 'Check ad-blockers, CSP rules, and CORS configuration.',
  'panel.inspector.initiator.insights.hostHeadline': ({ host, count, bytes, percent }, locale) => {
    const loaded = plural(locale, Number(count), {
      one: 'loaded {count} request',
      other: 'loaded {count} requests',
    });
    return `${String(host)} ${loaded} (${String(bytes)}) — ${String(percent)}% of cascade weight.`;
  },
  'panel.inspector.initiator.insights.hostHint': 'Largest single host in this cascade. Self-host or defer if you can.',
  'panel.inspector.initiator.insights.thirdPartyHeadline': '{percent}% of cascade bytes are third-party.',
  'panel.inspector.initiator.insights.thirdPartyHint': 'Trim, defer, or self-host non-essential third parties.',

  // ── Timing tab (inspector detail) — the tab's OWN copy. Raw by
  // design (S34 parity-vocab lock): the eight rung names everywhere
  // (insight subjects, the open `Stalled:` step), the Server Timing
  // section name (header vocabulary), cache-source words (memory cache
  // / disk cache / service worker / miss — Size-column parity, and the
  // repeat section's cache-breakdown line with them), ms / s / B/s
  // figures on the Chrome scale, and protocol / priority / IP values. ─
  'panel.inspector.timing.noData': 'No timing data available.',
  'panel.inspector.timing.view.label': 'View',
  'panel.inspector.timing.view.showSuggestions': 'Show suggestions',
  'panel.inspector.timing.view.showContextStrip': 'Show context strip',
  'panel.inspector.timing.view.showPhaseBreakdown': 'Show phase breakdown',
  'panel.inspector.timing.view.showTimingBar': 'Show timing bar',
  'panel.inspector.timing.view.showServerTiming': 'Show Server-Timing',
  'panel.inspector.timing.view.showRepeats': 'Show repeats in session',
  'panel.inspector.timing.view.showTransferRate': 'Show transfer rate',
  // Insight headlines — the raw rung name is the bolded subject; the
  // keyed predicate joins it at the markup boundary (raw-label +
  // keyed-clause join, S34 idiom). Figures ride as raw holes.
  'panel.inspector.timing.insight.dominatesTail': 'dominates this request — {ms} ({percent}% of total).',
  'panel.inspector.timing.insight.unusuallyHighTail': 'is unusually high — {ms}.',
  // Per-phase diagnosis (t-fed `findBottleneck` / `findWarnings`).
  'panel.inspector.timing.phase.queueing.what': 'Request scheduler held this request',
  'panel.inspector.timing.phase.queueing.hint': 'Too many concurrent requests competing for slots, or low priority.',
  'panel.inspector.timing.phase.stalled.what': 'Waiting for an available connection',
  'panel.inspector.timing.phase.stalled.hint':
    'Connection-pool limit, proxy negotiation, or HTTP/1.1 head-of-line blocking.',
  'panel.inspector.timing.phase.dns.what': 'DNS lookup',
  'panel.inspector.timing.phase.dns.hint': 'Affects only the first request to this domain. Consider DNS prefetch.',
  'panel.inspector.timing.phase.connect.what': 'TCP handshake to the server',
  'panel.inspector.timing.phase.connect.hint':
    'New connection — keep-alive or HTTP/2/3 multiplexing reuses one across requests.',
  'panel.inspector.timing.phase.ssl.what': 'TLS handshake',
  'panel.inspector.timing.phase.ssl.hint': 'Reduced by session resumption / 0-RTT (HTTP/3).',
  'panel.inspector.timing.phase.send.what': 'Uploading the request body',
  'panel.inspector.timing.phase.send.hint': 'Large request body or slow upstream — usually only visible on POST/PUT.',
  'panel.inspector.timing.phase.wait.what': 'Server time to first byte',
  'panel.inspector.timing.phase.wait.hint':
    'Backend processing. Look for backend timing in Server-Timing or DB query logs.',
  'panel.inspector.timing.phase.receive.what': 'Downloading the response payload',
  'panel.inspector.timing.phase.receive.hint': 'Payload size or CDN throughput — check effective transfer rate.',
  // Context strip chips — labels keyed; cache / protocol / priority
  // values stay raw.
  'panel.inspector.timing.chip.protocol': 'Protocol',
  'panel.inspector.timing.chip.connection': 'Connection',
  'panel.inspector.timing.chip.cache': 'Cache',
  'panel.inspector.timing.chip.priority': 'Priority',
  'panel.inspector.timing.chip.started': 'Started',
  'panel.inspector.timing.chip.serverIp': 'Server IP',
  'panel.inspector.timing.chip.connectionReused': 'reused',
  'panel.inspector.timing.chip.connectionNew': 'new',
  'panel.inspector.timing.chip.openedBy': 'opened by {url}',
  'panel.inspector.timing.totalTime': 'Total time',
  'panel.inspector.timing.totalWhere': '(queued → ended)',
  'panel.inspector.timing.caution': 'CAUTION: request is not finished yet!',
  'panel.inspector.timing.queuedAt': 'Queued at {offset}',
  'panel.inspector.timing.startedAt': 'Started at {offset}',
  'panel.inspector.timing.inProgress': 'in progress…',
  'panel.inspector.timing.noDuration': 'no duration',
  'panel.inspector.timing.transferRate.heading': 'Transfer rate',
  'panel.inspector.timing.transferRate.contentDownloaded': 'Content downloaded:',
  'panel.inspector.timing.transferRate.effectiveRate': 'Effective rate:',
  'panel.inspector.timing.transferRate.amount': '{size} in {duration}',
  'panel.inspector.timing.repeats.heading': 'Repeats in this session',
  'panel.inspector.timing.repeats.hitCount': 'URL hit count:',
  'panel.inspector.timing.repeats.fastestMedianSlowest': 'Fastest / median / slowest:',
  'panel.inspector.timing.repeats.thisRequest': 'This request:',
  'panel.inspector.timing.repeats.slowestTag': '(slowest)',
  'panel.inspector.timing.repeats.fastestTag': '(fastest)',
  'panel.inspector.timing.repeats.cacheBreakdown': 'Cache breakdown:',
  'panel.inspector.timing.repeats.url': 'URL:',
} as const satisfies Catalog;
