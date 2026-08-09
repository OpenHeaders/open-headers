/**
 * DevTools panel — traffic table plane: column info corpora, request
 * context menu, sort menus, waterfall/timing popover copy, terminal
 * detail sentences, and the row-annotation rail messages (consumed
 * via `buildRowAnnotationMessages(t)` so the hot row loop stays
 * `t()`-free).
 *
 * Parity vocabulary stays raw (S34 lock): column names, waterfall
 * metric names + ST/RT/ET/TD/L tags, the eight timing rung names,
 * terminal outcome labels, and 'Connection Start'.
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
  'panel.network.filterSyntaxHelp': 'Filter syntax help',
  'panel.network.aboutTypeFilters': 'About request type filters',
  'panel.network.aboutSorting': 'About sorting',

  // ── Remote capture — consent refusal (Traffic Monitor over the
  // browser relay; never shown on the in-browser panel) ────────────────
  'panel.capture.watchRefused.title': 'Live view is turned off in this browser',
  'panel.capture.watchRefused.body':
    'The Open Headers extension in this browser doesn’t allow the desktop app to view its traffic, storage, or console. Turn on “Let the desktop app view this browser” in the extension’s settings to watch it here.',

  // Traffic table cells — resolved once per locale into the CellMessages
  // bundle (the row render loop is hot and never calls t() itself).
  'panel.network.cell.workerGearTitle': "Request issued by the origin's service worker",
  'panel.network.cell.jumpToPreflight': 'Jump to preflight request',
  'panel.network.cell.selectPreflightInitiator': 'Select the request that initiated this preflight',
  'panel.network.cell.pendingTitle': 'Request not finished yet',
  'panel.network.cell.pending': 'Pending',
  'panel.network.gridAria': 'Network requests',
  'panel.network.noMatches': 'No matching requests.',
  'panel.network.reloadPage': 'Reload page',
  'panel.network.startRecording': 'Start recording',

  // View ▾ menu
  'panel.network.view.label': 'View',
  'panel.network.view.layout': 'Layout',
  'panel.network.view.layoutCompact': 'Compact',
  'panel.network.view.layoutWide': 'Wide',
  'panel.network.view.valueNumber': 'Value number',
  'panel.network.view.showValue': 'Show value',
  'panel.network.view.valuesAlways': 'Always',
  'panel.network.view.valuesHover': 'On hover',
  'panel.network.view.valuesOff': 'Off',
  'panel.network.view.valueFormat': 'Value format',
  'panel.network.view.formatRelative': 'Relative',
  'panel.network.view.formatTimestamp': 'Timestamp',
  'panel.network.view.timezone': 'Timezone',
  'panel.network.view.tzLocal': 'Local',
  'panel.network.view.tzUtc': 'UTC',
  'panel.network.view.explainValue': 'Explain value',
  'panel.network.view.explainValueTitle':
    'In the hover popover, highlight the rows that make up the total and show their sum.',
  'panel.network.view.popover': 'Popover',
  'panel.network.view.popoverTitle':
    'Orientation of the hover timing breakdown. Auto picks by panel width — horizontal when wide, vertical when narrow.',
  'panel.network.view.popoverAuto': 'Auto',
  'panel.network.view.popoverCompact': 'Compact',
  'panel.network.view.popoverWide': 'Wide',
  'panel.network.view.showFireDots': 'Show rule-fire dots',

  // Sort ▾ menu
  'panel.network.sort.label': 'Sort',
  'panel.network.sort.heading': 'Sort order',
  'panel.network.sort.byTime': 'Sort by time.',
  'panel.network.sort.groupPriority': 'Priority',
  'panel.network.sort.groupPriorityHint': 'What needs your attention first.',
  'panel.network.sort.groupGrouping': 'Grouping',
  'panel.network.sort.groupGroupingHint': 'Cluster requests by category.',
  'panel.network.sort.ascending': 'Ascending',
  'panel.network.sort.descending': 'Descending',
  'panel.network.sort.customNested': 'Custom (nested)',
  'panel.network.sort.customNestedIdle': 'Multi-key sort — column by column.',
  'panel.network.sort.customNestedLevels': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} level — open to edit.',
      other: '{count} levels — open to edit.',
    }),
  'panel.network.sort.noLevelsYet': 'No levels yet — open the builder.',
  'panel.network.sort.builderTitle': 'Sort by, in order',
  'panel.network.sort.builderEmpty': 'No levels yet. Add one below.',
  'panel.network.sort.asc': 'Asc',
  'panel.network.sort.desc': 'Desc',
  'panel.network.sort.removeLevel': 'Remove level {n}',
  'panel.network.sort.addLevel': '+ Add level',
  'panel.network.sort.finalTiebreak': 'Final tiebreak: start time',
  'panel.network.sort.active': 'Active',
  'panel.network.sort.apply': 'Apply',
  'panel.network.sort.columnClick': 'Custom (column-click)',
  'panel.network.sort.columnClickIdle': 'Click a column header to sort by it.',
  'panel.network.sort.columnClickUse': 'click a column header to use this',

  // Named sort modes (OH product vocabulary, not browser parity)
  'panel.network.sortMode.failures': 'Failures first',
  'panel.network.sortMode.failuresSubtitle': 'Failed → pending → redirected → success · start time within each.',
  'panel.network.sortMode.slowest': 'Slowest first',
  'panel.network.sortMode.slowestSubtitle': 'Longest duration first · start time keeps waterfall order on ties.',
  'panel.network.sortMode.largest': 'Largest first',
  'panel.network.sortMode.largestSubtitle': 'Biggest wire bytes first · start time within ties.',
  'panel.network.sortMode.browserPriority': 'Browser priority',
  'panel.network.sortMode.browserPrioritySubtitle':
    'Highest → Lowest by the browser’s reported priority · start time within each.',
  'panel.network.sortMode.byType': 'By resource type',
  'panel.network.sortMode.byTypeSubtitle':
    'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · start time within each.',
  'panel.network.sortMode.byDomain': 'By domain',
  'panel.network.sortMode.byDomainSubtitle': 'Group by hostname (A → Z) · start time within each domain.',
  'panel.network.sortMode.ruleModified': 'Rule-modified first',
  'panel.network.sortMode.ruleModifiedSubtitle': 'Applied rules → inferred → no fire · start time within each.',

  // Waterfall sort submenu subtitles (the metric names above them stay raw)
  'panel.network.sortMetric.startTime': 'When the request started.',
  'panel.network.sortMetric.responseTime': 'When the first response byte arrived.',
  'panel.network.sortMetric.endTime': 'When the request finished.',
  'panel.network.sortMetric.duration': 'How long it took — bars zero-aligned.',
  'panel.network.sortMetric.latency': 'Time to first byte — bars zero-aligned.',

  // The two OH-native rails (also the rail-header popover titles)
  'panel.network.railFires': 'Rule fires',
  'panel.network.railAnnotations': 'Annotations',

  // Row context menu (menu-local keys; cURL / fetch / HAR ride raw)
  'panel.requestMenu.openInNewTab': 'Open in new tab',
  'panel.requestMenu.createApiRequest': 'Create API request',
  'panel.requestMenu.copy': 'Copy',
  'panel.requestMenu.copyUrl': 'Copy URL',
  'panel.requestMenu.copyAsCurl': 'Copy as cURL',
  'panel.requestMenu.copyAsFetch': 'Copy as fetch',
  'panel.requestMenu.copyRequestHeaders': 'Copy request headers',
  'panel.requestMenu.copyResponseHeaders': 'Copy response headers',
  'panel.requestMenu.copyResponse': 'Copy response',
  'panel.requestMenu.copyAsHar': 'Copy as HAR',
  'panel.requestMenu.copyAsHarSanitized': 'Copy as HAR (sanitized)',
  'panel.requestMenu.copyAllUrls': 'Copy all URLs',
  'panel.requestMenu.copyAllAsCurl': 'Copy all as cURL',
  'panel.requestMenu.copyAllAsHar': 'Copy all as HAR',
  'panel.requestMenu.copyAllAsHarSanitized': 'Copy all as HAR (sanitized)',
  'panel.requestMenu.blockRequests': 'Block requests',
  'panel.requestMenu.blockUrl': 'Block request URL',
  'panel.requestMenu.blockDomain': 'Block request domain',
  'panel.requestMenu.saveAs': 'Save as...',
  'panel.requestMenu.saveThisAsHar': 'Save this as HAR',
  'panel.requestMenu.saveThisAsHarSanitized': 'Save this as HAR (sanitized)',
  'panel.requestMenu.saveAllAsHar': 'Save all as HAR',
  'panel.requestMenu.saveAllAsHarSanitized': 'Save all as HAR (sanitized)',

  // Filter-strip `(i)` corpora (pill vocabulary rides raw in the labels)
  'panel.network.typeInfo.title': 'Request types',
  'panel.network.typeInfo.summary':
    'Narrows the list to one or more request types. "All" shows everything; pick types to filter, or combine several.',
  'panel.network.typeInfo.inlineHeading': 'Inline',
  'panel.network.typeInfo.fetchXhrDesc': 'API calls — fetch() and XMLHttpRequest.',
  'panel.network.typeInfo.socketDesc': 'WebSocket connections.',
  'panel.network.typeInfo.underMoreHeading': 'Under More',
  'panel.network.typeInfo.docCssJsDesc': 'Documents, stylesheets, and scripts.',
  'panel.network.typeInfo.fontImgMediaDesc': 'Fonts, images, and audio / video.',
  'panel.network.typeInfo.manifestWasmOtherDesc': 'Web app manifests, WebAssembly, and everything else.',
  'panel.network.sortInfo.summary': 'Chooses how the request list is ordered. Hover a group to pick a specific mode.',
  'panel.network.sortInfo.modesHeading': 'Modes',
  'panel.network.sortInfo.waterfallDesc': 'By time — start, response, end, duration, or latency.',
  'panel.network.sortInfo.priorityDesc': 'What needs attention first — failures, slowest, largest.',
  'panel.network.sortInfo.groupingDesc': 'Cluster by type, domain, or rule-modified.',
  'panel.network.sortInfo.custom': 'Custom',
  'panel.network.sortInfo.customDesc': 'Click a column header, or build a multi-key nested sort.',

  // Network column `(i)` corpora. Titles are the raw column names
  // (they name the raw header cells); item labels are wire vocabulary
  // (GET, 2xx, h2, (pending), net::ERR_…, csp, ST/RT/…) and ride raw;
  // the kicker reuses the tool-window label key.
  'panel.network.colInfo.exampleCaption': 'Example request',
  'panel.network.colInfo.name.summary':
    "The resource's file name or last path segment — the quickest way to recognise a row.",
  'panel.network.colInfo.name.description':
    'The leading icon encodes the resource type; the row tooltip and the detail view carry the full URL, headers, payload, and timing.',
  'panel.network.colInfo.path.summary': 'Everything after the host — the URL path plus its query string.',
  'panel.network.colInfo.url.summary': 'The complete request URL: scheme, host, path, and query, end to end.',
  'panel.network.colInfo.requestNumber.summary':
    'A stable index assigned in the order requests were discovered while recording, starting at 1.',
  'panel.network.colInfo.requestNumber.description':
    'It never changes when you re-sort, so it doubles as a reference back to the original capture order.',
  'panel.network.colInfo.method.summary': 'The HTTP verb the request used.',
  'panel.network.colInfo.method.commonVerbsHeading': 'Common verbs',
  'panel.network.colInfo.method.getDesc': 'Read a resource — no body, safe to repeat.',
  'panel.network.colInfo.method.postDesc': 'Create or submit — carries a request body.',
  'panel.network.colInfo.method.putPatchDesc': 'Replace or partially update a resource.',
  'panel.network.colInfo.method.deleteDesc': 'Remove a resource.',
  'panel.network.colInfo.status.summary':
    'The HTTP response code (e.g. 200, 404), or a short state label when there is no code.',
  'panel.network.colInfo.status.description':
    'Status ranges are not colour-coded. A genuine failure — a wire error, any 4xx/5xx, or a CORS rejection — turns the whole row red; a cache hit or a no-status row dims the cell grey. The reason phrase (e.g. "Not Found") rides in the cell tooltip.',
  'panel.network.colInfo.status.codeRangesHeading': 'Code ranges',
  'panel.network.colInfo.status.s2xxDesc': 'Success — the request was received and handled (e.g. 200 OK).',
  'panel.network.colInfo.status.s3xxDesc': 'Redirection — follow the Location header to the next URL.',
  'panel.network.colInfo.status.s4xxDesc': 'Client error — the request was malformed, unauthorized, or not found.',
  'panel.network.colInfo.status.s5xxDesc': 'Server error — the server failed to fulfil a valid request.',
  'panel.network.colInfo.status.insteadHeading': 'Instead of a code',
  'panel.network.colInfo.status.pendingDesc': 'Sent, but no response has arrived yet — grey while in flight.',
  'panel.network.colInfo.status.failedDesc':
    'A wire-level failure (DNS, TLS, timeout, lost connection); the net-stack code shows inline.',
  'panel.network.colInfo.status.canceledDesc': 'The request was aborted before it completed.',
  'panel.network.colInfo.status.blockedDesc':
    'The browser refused it for a policy reason — e.g. csp, or other for an extension / ad-block.',
  'panel.network.colInfo.status.corsDesc': 'A cross-origin check rejected the response.',
  'panel.network.colInfo.status.dataDesc': 'A data: URL — served inline, never hit the network.',
  'panel.network.colInfo.status.finishedDesc': 'A response that carried no status code.',
  'panel.network.colInfo.protocol.summary': 'The HTTP version the connection negotiated, picked at handshake time.',
  'panel.network.colInfo.protocol.valuesHeading': 'Values',
  'panel.network.colInfo.protocol.http11Desc': 'Text-based, one request in flight per connection.',
  'panel.network.colInfo.protocol.h2Desc': 'HTTP/2 — binary and multiplexed over a single connection.',
  'panel.network.colInfo.protocol.h3Desc': 'HTTP/3 — runs on QUIC over UDP for faster handshakes.',
  'panel.network.colInfo.scheme.summary': 'The URL scheme — `https`, `http`, `ws`, or `wss`.',
  'panel.network.colInfo.domain.summary': 'The host name the request was addressed to.',
  'panel.network.colInfo.remoteAddress.summary': 'The IP address and port the connection actually reached.',
  'panel.network.colInfo.remoteAddress.description':
    'Differs from the domain when DNS returns several IPs, a CDN routes by anycast, or a local proxy intercepts the connection.',
  'panel.network.colInfo.type.summary':
    'The resource type the browser assigned — it drives the row icon and the filter chips above the table.',
  'panel.network.colInfo.type.examplesHeading': 'Examples',
  'panel.network.colInfo.type.documentDesc': 'A top-level or framed HTML navigation.',
  'panel.network.colInfo.type.fetchXhrDesc': 'A data request made from JavaScript.',
  'panel.network.colInfo.type.scriptCssDesc': 'Page resources loaded by the parser.',
  'panel.network.colInfo.type.imgFontMediaDesc': 'Static assets.',
  'panel.network.colInfo.initiator.summary': 'What caused the request to be sent.',
  'panel.network.colInfo.initiator.kindsHeading': 'Kinds',
  'panel.network.colInfo.initiator.scriptDesc': 'Fired from JavaScript — the cell links to the call site.',
  'panel.network.colInfo.initiator.parserDesc':
    'The HTML parser found the resource (a `<script>`, `<img>`, `<link>`…).',
  'panel.network.colInfo.initiator.redirectDesc': 'A `3xx` response sent the browser here.',
  'panel.network.colInfo.initiator.otherDesc': 'A navigation, a preload, or an unattributed source.',
  'panel.network.colInfo.cookies.summary':
    'How many cookies the browser attached to the request in its `Cookie` header. Blank when none.',
  'panel.network.colInfo.setCookies.summary': 'How many `Set-Cookie` headers the response returned. Blank when none.',
  'panel.network.colInfo.setCookies.description':
    "Open the request's Cookies tab to see whether the browser accepted or dropped each one.",
  'panel.network.colInfo.size.summary':
    'Bytes that crossed the wire, response headers and compression overhead included.',
  'panel.network.colInfo.size.insteadHeading': 'Instead of a number',
  'panel.network.colInfo.size.diskCacheDesc': 'Served from the on-disk cache — nothing hit the network.',
  'panel.network.colInfo.size.memoryCacheDesc': 'Served from the in-memory cache for the current page.',
  'panel.network.colInfo.size.pendingDesc': 'The request has not finished yet.',
  'panel.network.colInfo.time.summary':
    'Active duration from request sent to the last response byte — time spent queued is excluded.',
  'panel.network.colInfo.time.description':
    'Reads `0 ms` for an instant response; stays blank while a request is still in flight.',
  'panel.network.colInfo.priority.summary': 'The fetch priority the browser assigned, from `Highest` down to `Lowest`.',
  'panel.network.colInfo.priority.description':
    'Higher-priority resources are requested sooner and given more of the connection. A page can nudge it with the `fetchpriority` attribute.',
  'panel.network.colInfo.waterfall.summary':
    'A timeline bar per request. The header menu picks the metric, shown as a short tag like `Waterfall (ST)`.',
  'panel.network.colInfo.waterfall.metricTagsHeading': 'Metric tags',
  'panel.network.colInfo.waterfall.stDesc': 'Start time — bars sit on a shared timeline by when each request began.',
  'panel.network.colInfo.waterfall.rtDesc': 'Response time — placed by when the first response byte arrived.',
  'panel.network.colInfo.waterfall.etDesc': 'End time — placed by when each request finished.',
  'panel.network.colInfo.waterfall.tdDesc': 'Total duration — zero-aligned bars sized by full request duration.',
  'panel.network.colInfo.waterfall.lDesc': 'Latency — zero-aligned bars split where the response started.',

  // OH-native rail header popovers (the ● / ⚠ / ℹ glyphs ride raw)
  'panel.network.fireRail.summary': 'A dot marks each request that one of your rules acted on.',
  'panel.network.fireRail.dotColorsHeading': 'Dot colors',
  'panel.network.fireRail.appliedDesc':
    'Applied — the rule engine confirmed the rule executed, our in-page reporter confirmed the action ran, or the modification is visible in the captured headers.',
  'panel.network.fireRail.inferredDesc': 'Inferred — the rule matched, application not verifiable for this request.',
  'panel.network.fireRail.contradictedDesc':
    'Contradicted — the rule claimed a header change the captured headers disprove.',
  'panel.network.annotationRail.summary':
    'Flags what OpenHeaders knows beyond what the columns show. Hover a glyph for the explanation; click it to open the details.',
  'panel.network.annotationRail.glyphsHeading': 'Glyphs',
  'panel.network.annotationRail.warnDesc':
    'The row is not what it looks like — e.g. a transfer interrupted mid-download.',
  'panel.network.annotationRail.infoDesc':
    'Provenance or fidelity context — never finished, capture gap, synthesized row.',

  // ── Timing plane (waterfall popovers + ladder legend + Timing tab) ──
  // Raw by design: the eight rung names (Queueing / Stalled / DNS Lookup
  // / TCP / TLS / Request sent / Waiting for server / Content Download —
  // browser Timing-tab parity), the terminal outcome labels mirroring
  // the Status cell ((canceled), (blocked:…), CORS error, (failed)
  // net::ERR_…), the Connection Start section name, and every µs/ms/s
  // figure. The OH-invented band names, absent-step reasons, key-moment
  // narrative, and footnote sentences key.
  'panel.network.timing.band.beforeWire': 'Scheduling',
  'panel.network.timing.band.connecting': 'Connecting',
  'panel.network.timing.band.exchange': 'Transferring',
  'panel.network.timing.where.beforeWire': '(Browser)',
  'panel.network.timing.where.connecting': '(Browser ↔ Network)',
  'panel.network.timing.where.exchange': '(Network)',
  'panel.network.timing.absent.reused': 'connection reused',
  'panel.network.timing.absent.notReached': 'not reached',
  'panel.network.timing.absent.na': 'n/a',
  'panel.network.timing.absent.unknown': 'no data',
  'panel.network.timing.warmSocketTitle':
    "No TCP handshake on this request's clock — the socket was already established (likely preconnected). Only TLS ran here.",
  'panel.network.timing.warmSocketHint': 'warm socket',
  'panel.network.timing.moment.queued': 'Queued',
  'panel.network.timing.moment.started': 'Started',
  'panel.network.timing.moment.response': 'Response',
  'panel.network.timing.moment.ended': 'Ended',
  'panel.network.timing.momentWhy.queued': 'request created',
  'panel.network.timing.momentWhy.started': 'left the queue',
  'panel.network.timing.momentWhy.response': 'first byte (TTFB)',
  'panel.network.timing.momentWhy.ended': 'last byte, done',
  'panel.network.timing.untrackedGaps': 'Untracked gaps: {parts}',
  'panel.network.timing.chromeEquivalent':
    'Chrome-equivalent: Initial connection = TCP {tcp} + TLS {tls} = {total} (SSL drawn inside it)',
  'panel.network.timing.terminalDetail.noResponse': 'no response received',
  'panel.network.timing.terminalDetail.neverReached': 'never reached the network',
  'panel.network.timing.keyMoments': 'Key moments',
  'panel.network.timing.sinceFirstRequest': '(since the first request)',
  'panel.network.timing.timingNotes': 'Timing notes',
  'panel.network.timing.totalTime': 'Total time',
  'panel.network.timing.queuedToEnded': '(queued → ended)',
  'panel.network.timing.connectionOpenedBy': '↳ connection opened by {name}',
  'panel.network.timing.notFinishedCaution': 'CAUTION: request is not finished yet!',
  'panel.network.timing.queuedAt': 'Queued at {time}',
  'panel.network.timing.startedAt': 'Started at {time}',
  // Separate referent from the rung-state 'not reached': this one marks an
  // instant tick a terminal request never got to.
  'panel.network.timing.tickNotReached': 'not reached',
  'panel.network.timing.onTheWire': '🌐 on the wire',
  'panel.network.timing.cdpExplainer':
    'Enable CDP and reload before navigating for the full connection breakdown as it runs.',

  // Timing `(i)` corpora. Rung / terminal titles stay raw (they name the
  // raw rung rows and Status-cell labels); band, moment, key-moments, and
  // notes titles reuse the keys of the labels they name.
  'panel.network.rungInfo.kicker': 'Timing',
  'panel.network.rungInfo.kickerBrowser': 'Timing · Browser',
  'panel.network.rungInfo.kickerBrowserNetwork': 'Timing · Browser ↔ Network',
  'panel.network.rungInfo.kickerNetwork': 'Timing · Network',
  'panel.network.rungInfo.kickerInstant': 'Timing · Instant',
  'panel.network.rungInfo.kickerOutcome': 'Timing · Outcome',
  'panel.network.rungInfo.stripCaption': 'Example request — {ms} ms end to end',
  'panel.network.rungInfo.stripStop': 'marked: where the request stopped — the later phases never ran',
  'panel.network.rungInfo.stripMarked': 'marked: {label} at {ms} ms',
  'panel.network.rungInfo.stripGaps': 'highlighted: the untracked gaps (3 + 4 ms)',
  'panel.network.rungInfo.stripHighlighted': 'highlighted: {segs} ({ms} ms)',
  'panel.network.rungInfo.queueing.summary':
    'Time the request spent waiting in the browser before it was allowed to start.',
  'panel.network.rungInfo.queueing.description':
    'The browser defers requests for lower-priority resources, while higher-priority ones load first, and while it checks the disk cache. On HTTP/1.x it also waits here when all sockets to the host are busy.',
  'panel.network.rungInfo.stalled.summary':
    'Allowed to start, but waiting for a usable connection before any network work could begin.',
  'panel.network.rungInfo.stalled.description':
    'Typically waiting for a socket to become available or for a proxy decision. Ends the moment the first network step (DNS, TCP, or sending) starts.',
  'panel.network.rungInfo.dns.summary': 'Resolving the host name to an IP address to connect to.',
  'panel.network.rungInfo.dns.description':
    'Shows "connection reused" when the request rode an already-open connection — no lookup was needed on this request\'s clock.',
  'panel.network.rungInfo.connect.summary':
    'The TCP handshake only — the round trip that opens the socket to the server.',
  'panel.network.rungInfo.connect.description':
    'Chrome\'s Timing tab draws one "Initial connection" bar spanning this AND the TLS handshake (its SSL bar is drawn inside it). We split them into separate, non-overlapping phases so every millisecond is counted exactly once — TCP + TLS here equals Chrome\'s Initial connection bar.',
  'panel.network.rungInfo.ssl.summary':
    'The TLS handshake — negotiating keys and verifying certificates so the connection is encrypted.',
  'panel.network.rungInfo.ssl.description':
    'Only on https:// requests (n/a on plain http://). "Connection reused" means an earlier request already paid this cost on the same socket.',
  'panel.network.rungInfo.send.summary': 'Pushing the request bytes — headers and any body — onto the wire.',
  'panel.network.rungInfo.send.description':
    'Usually well under a millisecond for header-only requests; grows with large uploads.',
  'panel.network.rungInfo.wait.summary':
    'From the last request byte sent to the first response byte received (time to first byte).',
  'panel.network.rungInfo.wait.description':
    'Server think time plus one network round trip — the phase backend work shows up in.',
  'panel.network.rungInfo.receive.summary': 'Downloading the response body, first byte to last.',
  'panel.network.rungInfo.receive.description':
    'Grows live while a response is still streaming; the caution line below the chart flags a download that never finished.',
  'panel.network.rungInfo.notes.summary':
    'Bookkeeping for the slivers of time between phases — recorded end to end, but belonging to no phase.',
  'panel.network.rungInfo.notes.description':
    "Each phase is measured between its own start and stop instants, while the total is measured end to end — so tiny \"untracked gaps\" can sit between two phases (e.g. between the DNS answer arriving and the TCP handshake starting). They are why the phases don't always sum to the total. Chrome's Timing tab has the same gaps and simply doesn't draw them; we list them so every millisecond stays accounted for.",
  'panel.network.rungInfo.notes.linesHeading': 'The lines',
  'panel.network.rungInfo.notes.gapsLabel': 'Untracked gaps',
  'panel.network.rungInfo.notes.gapsDesc': 'Each gap, named by the phases around it, with its duration.',
  'panel.network.rungInfo.notes.chromeLabel': 'Chrome-equivalent',
  'panel.network.rungInfo.notes.chromeDesc':
    'How our split TCP + TLS phases map onto Chrome\'s single "Initial connection" bar (its SSL bar is drawn inside that bar, not after it).',
  'panel.network.rungInfo.band.beforeWire.summary':
    'Time spent entirely inside the browser before any network work — nothing has left the machine yet.',
  'panel.network.rungInfo.band.beforeWire.description':
    'Queueing (waiting for permission to start) plus Stalled (waiting for a usable connection). A request heavy here is being held back locally — by priorities, connection limits, or proxy decisions — not by the server.',
  'panel.network.rungInfo.band.connecting.summary':
    'Setting up the path to the server: resolve the name, open the socket, encrypt it.',
  'panel.network.rungInfo.band.connecting.description':
    'DNS Lookup + TCP + TLS — the handshake round trips. Paid once per connection: a request that rides an already-open socket skips this whole band ("connection reused").',
  'panel.network.rungInfo.band.exchange.summary':
    'The actual exchange over the wire: send the request, wait for the server, download the response.',
  'panel.network.rungInfo.band.exchange.description':
    'Request sent + Waiting for server (TTFB) + Content Download. Server-side slowness shows up in Waiting; large responses or slow links show up in Content Download.',
  'panel.network.rungInfo.moment.queued.summary':
    'The instant the browser created the request — the zero every phase in this breakdown measures from.',
  'panel.network.rungInfo.moment.queued.description':
    'The "at" value is the offset from the first request in view, so rows can be compared on one shared clock.',
  'panel.network.rungInfo.moment.started.summary':
    'The instant the request left the queue and work on it actually began.',
  'panel.network.rungInfo.moment.started.description':
    'Queued + Queueing. Everything before this mark is browser scheduling; everything after is the request making real progress.',
  'panel.network.rungInfo.moment.response.summary': 'The instant the first response byte arrived (time to first byte).',
  'panel.network.rungInfo.moment.response.description':
    'The server has answered; from here the body is downloading. Absent when no response ever arrived (blocked or failed first).',
  'panel.network.rungInfo.moment.ended.summary': 'The instant the last response byte arrived — the request is done.',
  'panel.network.rungInfo.moment.ended.description':
    'Ended − Queued is the total time shown below the breakdown; Ended − Started is the active duration the Time column shows.',
  'panel.network.rungInfo.keyMoments.summary':
    "The boundary instants of the request's life — where one stage hands over to the next.",
  'panel.network.rungInfo.keyMoments.description':
    'Queued and Started always exist; Response and Ended only once a response actually arrived (a request that was blocked or failed first shows its outcome marker instead). The phases below are the spans between these instants.',
  'panel.network.rungInfo.terminal.whereHeading': 'Where it stopped',
  'panel.network.rungInfo.terminal.noResponseDesc': 'It reached the network, but no answer ever made it back.',
  'panel.network.rungInfo.terminal.neverReachedDesc': 'It died in browser-side scheduling — nothing was sent.',
  'panel.network.rungInfo.terminal.canceled.summary':
    'The request was aborted before it completed — the ✗ marks where it stopped; later phases never ran.',
  'panel.network.rungInfo.terminal.canceled.description':
    'Typical causes: the page navigated away mid-load, script aborted the fetch, or the user stopped the load. Nothing was wrong with the network — the browser simply gave up on the answer.',
  'panel.network.rungInfo.terminal.blocked.summary':
    'The browser refused the request for a policy reason — the word after the colon names which policy.',
  'panel.network.rungInfo.terminal.stoppedHere': 'The ✗ marks where it stopped; later phases never ran.',
  'panel.network.rungInfo.terminal.blocked.reasonsHeading': 'Common reasons',
  'panel.network.rungInfo.terminal.blocked.cspDesc': "The page's Content-Security-Policy forbids this destination.",
  'panel.network.rungInfo.terminal.blocked.mixedContentDesc': 'An insecure http:// resource on an https:// page.',
  'panel.network.rungInfo.terminal.blocked.otherDesc':
    'An extension, ad-blocker, or an internal browser rule refused it.',
  'panel.network.rungInfo.terminal.cors.summary':
    'A cross-origin check rejected the response — the server answered, but the page was not allowed to read it.',
  'panel.network.rungInfo.terminal.cors.description':
    'The server must opt in with Access-Control-Allow-Origin (and friends) for a cross-origin page to read its response. The ✗ marks where the rejection landed.',
  'panel.network.rungInfo.terminal.failed.summary':
    'A wire-level failure — the connection itself broke, and the net:: code names the exact cause.',
  'panel.network.rungInfo.terminal.failed.codesHeading': 'Common codes',
  'panel.network.rungInfo.terminal.failed.nameNotResolvedDesc': 'DNS could not find the host.',
  'panel.network.rungInfo.terminal.failed.connectionRefusedDesc': 'The server rejected or dropped the socket.',
  'panel.network.rungInfo.terminal.failed.timedOutDesc': "No answer within the network stack's time limit.",
  'panel.network.rungInfo.terminal.failed.certDesc': 'The TLS certificate failed validation.',

  // ── OH row annotations — one classifier, one copy family (traffic
  // rail glyph popover + Headers-tab insight cards). The rail is a hot
  // row loop: copy resolves once per locale via
  // `buildRowAnnotationMessages(t)` threaded through the stable cell
  // context — never `t()` in the row body. The popover kicker is the
  // raw brand mark. ───────────────────────────────────────────────────
  'panel.rowAnnotations.alsoOnThisRow': 'Also on this row',
  'panel.rowAnnotations.openDetails': 'Open details',
  'panel.rowAnnotations.interrupted.label': 'Transfer interrupted',
  'panel.rowAnnotations.interrupted.detail':
    'The download was canceled before it finished. The status reflects the headers that arrived before the interruption, and the received data is incomplete — the row is otherwise indistinguishable from a completed one.',
  'panel.rowAnnotations.neverFinished.label': 'Never finished',
  'panel.rowAnnotations.neverFinished.detail':
    'The page that issued this request unloaded while it was still in flight, so no outcome was ever recorded — that is why Status and Time read "(unknown)".',
  'panel.rowAnnotations.fidelityGap.label': 'Capture-fidelity gap',
  'panel.rowAnnotations.fidelityGap.detail':
    'Transferred bytes and the response body are not visible to the default capture path for requests that never finished — CDP-enhanced inspection records them.',
  'panel.rowAnnotations.syntheticHar.label': 'Synthesized row',
  'panel.rowAnnotations.syntheticHar.detail':
    'This row was reconstructed from a capture record that never joined a live request, so some columns cannot be filled.',
  'panel.rowAnnotations.syntheticMemory.label': 'Synthesized row',
  'panel.rowAnnotations.syntheticMemory.detail':
    'This row was reconstructed from the page’s Resource Timing (a memory-cache hit never reaches the network stack), so headers and cookies are not available.',
  'panel.rowAnnotations.debugPaused.label': 'Debug-mode hold',
  'panel.rowAnnotations.debugPaused.detail':
    '{ms} ms of this row’s time was spent paused in debug-mode interception, not waiting on the server or network — debug mode held the request while it inspected it, so the row’s total time runs longer than the request itself took.',
  'panel.rowAnnotations.queryParamRewrite.label': 'Query-param rewrite',
  'panel.rowAnnotations.queryParamRewrite.detail':
    'This redirect is Open Headers applying a query-param rule, not the server. Rewriting a URL’s query string is performed as an internal redirect, so it shows as its own hop; the request then continues to the rewritten URL with its method, body, cookies, and headers carried across unchanged.',
  'panel.rowAnnotations.redirectRule.label': 'Redirect rule',
  'panel.rowAnnotations.redirectRule.detail':
    'This redirect is Open Headers applying a redirect rule, not the server. It is performed as an internal redirect, so the original request shows as its own hop before the request continues to the rewritten URL.',
  'panel.rowAnnotations.systemProxyJoined.label': 'System Proxy joined',
  'panel.rowAnnotations.systemProxyJoined.detail':
    'This exchange was also captured by the System Proxy — the local proxy. Exact on-the-wire headers, measured sizes, and socket timings from that capture fill in where the browser capture has no record of its own.',
  'panel.rowAnnotations.systemProxySeen.label': 'Seen on a browser tab',
  'panel.rowAnnotations.systemProxySeen.detail':
    'This intercepted exchange was also observed on browser tab {tab} — the two rows are the same request witnessed from both sides.',
  'panel.rowAnnotations.systemProxySeen.unknownTab': 'a watched tab',
  'panel.rowAnnotations.systemProxySeen.jump': 'Show in tab source',
} as const satisfies Catalog;
