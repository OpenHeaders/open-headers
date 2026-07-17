/**
 * DevTools panel — request inspector shell + detail tabs without
 * their own file: tab bar + section tabs, body/payload views, timing,
 * initiator, and raw-data tabs. The headers, cookies, and stream
 * families live in the sibling `panel-inspector-*.ts` files; all
 * merge under `panel.inspector.*` in `index.ts`.
 *
 * Raw by design: async stack labels (JS vocabulary), wire-shaped
 * hover titles, encoding names (Base64 / UTF-8), and the
 * `HeaderSection`/`CookieSection` label props — search-plane
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
