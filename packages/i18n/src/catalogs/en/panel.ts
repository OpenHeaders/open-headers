/**
 * DevTools panel — toolbar / status-bar chrome (Phase D station 1):
 * the top toolbar's buttons and menus, the debug-controls cluster
 * (Disable cache / throttle / overrides) with their `(i)` corpora,
 * the filter strip chrome, and the footer summary line. Station 2
 * adds the tool-window registry labels and the docs navigation.
 *
 * English boundary (I18N_PLAN.md §3) — raw by design inside or beside
 * keyed values: resource-type pills (All / Fetch/XHR / Doc / …),
 * throttle tier names (Fast 4G, Fiber, DSL, …), CDP method names
 * (`Network.setCacheDisabled`), header names (User-Agent), event names
 * (DOMContentLoaded / Load figures), keyboard chords (Alt+C), size and
 * timing units (kB / kbit/s / ms), and the Aa / ab / .* / ▾ / ✓ glyphs.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panel = {
  // ── Toolbar buttons ─────────────────────────────────────────────────
  'panel.toolbar.record': 'Record network log',
  'panel.toolbar.stopRecording': 'Stop recording',
  'panel.toolbar.clear': 'Clear network log',
  'panel.toolbar.filter': 'Filter',
  'panel.toolbar.search': 'Search',
  'panel.toolbar.preserveLog': 'Preserve log',
  'panel.toolbar.preserveLogTitle':
    "Keep requests across page navigations. Off clears the list on each navigation or reload, like the browser's own Network panel.",
  'panel.toolbar.aboutPreserveLog': 'About Preserve log',
  'panel.toolbar.aboutMoreFilters': 'About More filters',
  'panel.toolbar.aboutFooterView': 'About Footer View',
  'panel.toolbar.activeWorkspaceAria': 'Active workspace: {name}',

  // ── Toolbar layout cluster ──────────────────────────────────────────
  'panel.toolbar.leftSidebar': 'Left sidebar',
  'panel.toolbar.bottomPanel': 'Bottom panel',
  'panel.toolbar.rightSidebar': 'Right sidebar',
  'panel.toolbar.chooseBottomAlignment': 'Choose bottom panel alignment',
  'panel.toolbar.layoutOptions': 'Layout options',
  'panel.toolbar.bottomAlignTooltip.center': 'Bottom panel: center (nested)',
  'panel.toolbar.bottomAlignTooltip.left': 'Bottom panel: left-aligned',
  'panel.toolbar.bottomAlignTooltip.right': 'Bottom panel: right-aligned',
  'panel.toolbar.bottomAlignTooltip.justify': 'Bottom panel: full width',

  // ── Layout menu ─────────────────────────────────────────────────────
  'panel.layout.bottomAlignment': 'Bottom Panel Alignment',
  'panel.layout.alignCenter': 'Center (nested)',
  'panel.layout.alignLeft': 'Left',
  'panel.layout.alignRight': 'Right',
  'panel.layout.alignJustify': 'Justify (full width)',
  'panel.layout.showToolWindowNames': 'Show Tool Window Names',
  'panel.layout.activityBarLayout': 'Activity Bar Layout',
  'panel.layout.sidebarProportional': 'Proportional (even halves)',
  'panel.layout.sidebarCompact': 'Compact (bottom pinned)',
  'panel.layout.sidebarStacked': 'Stacked (all at top)',
  'panel.layout.sidebarDynamic': 'Dynamic (follows panel heights)',
  'panel.layout.defaultLayoutDonor': 'Default layout {unit}',
  'panel.layout.inheritsDefault': 'Inherits default layout',
  'panel.layout.donorTooltip': 'This {unit} is the default — new {units} inherit this layout.',
  'panel.layout.nonDonorTooltip': 'Another {unit} is the default — new {units} inherit from there.',
  'panel.layout.resetToDefaults': 'Reset layout to defaults',
  'panel.layout.restoreHidden': 'Restore Hidden Activity Bar Tools',

  // ── Filter strip chrome (syntax tokens stay raw) ────────────────────
  'panel.filter.placeholder': 'Filter',
  'panel.filter.clear': 'Clear',
  'panel.filter.clearAria': 'Clear filter',
  'panel.filter.matchCase': 'Match Case (Alt+C)',
  'panel.filter.wholeWord': 'Match Whole Word (Alt+W)',
  'panel.filter.regex': 'Use Regular Expression (Alt+R)',
  'panel.filter.more': 'More',
  'panel.filter.hiddenClearFilter': 'Clear filter',
  'panel.filter.hiddenDismiss': 'Dismiss',

  // Shared reset row across the panel's checkbox menus (More filters /
  // Footer View / resource pills) — one action family, one key.
  'panel.menu.resetToDefault': 'Reset to default',

  // ── More-filters menu ───────────────────────────────────────────────
  'panel.moreFilters.label': 'More filters',
  'panel.moreFilters.hideDataUrls': 'Hide data URLs',
  'panel.moreFilters.hideExtensionUrls': 'Hide extension URLs',
  'panel.moreFilters.blockedRequests': 'Blocked requests',
  'panel.moreFilters.thirdParty': '3rd-party requests',
  'panel.moreFilters.swRequests': 'Service worker requests',
  'panel.moreFilters.ruleApplied': 'Rule-applied requests',
  'panel.moreFilters.pageOriginPending': 'Page origin not yet available',

  // ── Footer-View menu ────────────────────────────────────────────────
  'panel.view.label': 'Footer View',
  'panel.view.title': 'Choose which footer stats to show',
  'panel.view.focusedTool': 'Focused tool',
  'panel.view.focusedToolTitle':
    'The footer follows the focused tool window — Storage, Console, and Search show their own summaries; other tools fall back to the Network line.',
  'panel.view.networkOnly': 'Network tool only',
  'panel.view.networkOnlyTitle': 'The footer always shows the Network figures, whichever tool window has focus.',
  'panel.view.modifiedCount': 'Modified count',
  'panel.view.failedCount': 'Failed count',
  'panel.view.cachedCount': 'Cached count',
  'panel.view.pageLabel': 'Current page label',
  'panel.view.pageLabelTitle':
    'When the log spans more than one navigation, name the page the timing milestones describe.',
  'panel.view.timingAllNavs': 'Timing across all navigations',
  'panel.view.timingAllNavsTitle':
    'Finish / DOMContentLoaded / Load span the whole preserve-log timeline from the first navigation (the browser default). Uncheck to report only the latest navigation.',

  // ── Export menu ─────────────────────────────────────────────────────
  'panel.export.title': 'Export traffic',
  'panel.export.exportAll': 'Export all as HAR',
  'panel.export.exportAllSanitized': 'Export all as HAR (sanitized)',
  'panel.export.copyAll': 'Copy all as HAR',
  'panel.export.copyAllSanitized': 'Copy all as HAR (sanitized)',

  // ── Disable cache ───────────────────────────────────────────────────
  'panel.cache.label': 'Disable cache',
  'panel.cache.tooltipDebug':
    'Disabling the cache at the network-stack level (Debug mode) — matches the browser’s native Disable cache.',
  'panel.cache.tooltipStandard':
    'Bypasses the HTTP cache by forcing revalidation. Enable Debug mode for a full network-stack disable (the in-memory cache too).',
  'panel.cache.aboutAria': 'About Disable cache',

  // ── Network throttling ──────────────────────────────────────────────
  'panel.throttle.none': 'No throttling',
  'panel.throttle.custom': 'Custom',
  'panel.throttle.customEllipsis': 'Custom…',
  'panel.throttle.customHint': 'Set download, upload, and latency.',
  'panel.throttle.customTitle': 'Custom throttling',
  'panel.throttle.download': 'Download',
  'panel.throttle.upload': 'Upload',
  'panel.throttle.latency': 'Latency',
  'panel.throttle.appliesToTab': 'Applies to this tab',
  'panel.throttle.morePresets': 'More presets',
  'panel.throttle.morePresetsSubtitle': 'Fiber, cable, DSL, 5G, 2G.',
  'panel.throttle.wired': 'Wired',
  'panel.throttle.mobile': 'Mobile',
  'panel.throttle.disabledTooltip':
    'Network throttling is available only in Debug mode. Enable Debug mode to throttle this tab.',
  'panel.throttle.aboutAria': 'About network throttling',
  // One-line speed/latency hints under the preset rows (tier names raw).
  'panel.throttle.subtitle.fiber': '≈500 Mbit/s · 2 ms latency',
  'panel.throttle.subtitle.cable': '≈200 Mbit/s · 8 ms latency',
  'panel.throttle.subtitle.dsl': '≈20 Mbit/s · 25 ms latency',
  'panel.throttle.subtitle.fast5g': '≈100 Mbit/s · 8 ms latency',
  'panel.throttle.subtitle.slow5g': '≈30 Mbit/s · 18 ms latency',
  'panel.throttle.subtitle.fast4g': '≈8.1 Mbit/s · 165 ms latency',
  'panel.throttle.subtitle.slow4g': '≈1.44 Mbit/s · 562.5 ms latency',
  'panel.throttle.subtitle.3g': '≈400 kbit/s · 2000 ms latency',
  'panel.throttle.subtitle.fast2g': '≈280 kbit/s · 2000 ms latency',
  'panel.throttle.subtitle.slow2g': '≈100 kbit/s · 3000 ms latency',
  'panel.throttle.subtitle.offline': 'Blocks all network traffic for the tab.',

  // Shared Apply across the debug cluster's builder footers.
  'panel.debug.apply': 'Apply',
  'panel.debug.enableDebugMode': 'Enable Debug mode',

  // ── System overrides ────────────────────────────────────────────────
  'panel.overrides.trigger': 'Overrides',
  'panel.overrides.disabledTooltip':
    'System overrides are available only in Debug mode. Enable Debug mode to override this tab.',
  'panel.overrides.aboutAria': 'About system overrides',
  'panel.overrides.wireHint': 'Sent on requests and reported to page scripts while this tab stays in Debug mode.',
  'panel.overrides.pageOnlyHint': 'Page only — these change what the page’s own scripts and CSS observe, not requests.',
  'panel.overrides.platform': 'Platform',
  'panel.overrides.locale': 'Locale',
  'panel.overrides.timezone': 'Timezone',
  'panel.overrides.colorScheme': 'Color scheme',
  'panel.overrides.reducedMotion': 'Reduced motion',
  'panel.overrides.printMedia': 'Print media',
  'panel.overrides.uaPlaceholder': 'Custom User-Agent string',
  'panel.overrides.alPlaceholder': 'e.g. fr-FR,fr;q=0.9',
  'panel.overrides.platformPlaceholder': 'navigator.platform, e.g. Linux',
  'panel.overrides.localePlaceholder': 'Real locale',
  'panel.overrides.timezonePlaceholder': 'Real timezone',
  'panel.overrides.auto': 'Auto',
  'panel.overrides.light': 'Light',
  'panel.overrides.dark': 'Dark',
  'panel.overrides.reduce': 'Reduce',
  'panel.overrides.noPref': 'No pref',
  'panel.overrides.screen': 'Screen',
  'panel.overrides.print': 'Print',
  'panel.overrides.resetAll': 'Reset all',

  // ── (i) corpora — Preserve log ──────────────────────────────────────
  'panel.info.preserveLog.summary':
    'Keeps recorded requests across page navigations and reloads instead of clearing the list each time the page changes.',
  'panel.info.preserveLog.description':
    'On — the log carries over every navigation, so requests that fired just before a redirect, form submit, or reload stay visible. Off — the list clears on each navigation or reload, like the browser’s own Network panel, showing only the current page’s traffic.',
  'panel.info.preserveLog.whenHeading': 'Reach for it when',
  'panel.info.preserveLog.redirects': 'Redirects',
  'panel.info.preserveLog.redirectsDesc':
    'Inspect the request that triggered a navigation before the new page wipes it.',
  'panel.info.preserveLog.forms': 'Form submits / logins',
  'panel.info.preserveLog.formsDesc': 'Keep a POST and its response visible after the page reloads.',
  'panel.info.preserveLog.reloadLoops': 'Reload loops',
  'panel.info.preserveLog.reloadLoopsDesc': 'See what fired just before the page reloaded itself.',

  // ── (i) corpora — More filters ──────────────────────────────────────
  'panel.info.moreFilters.summary':
    'Secondary request filters tucked behind a menu — each narrows the list without taking up first-class toolbar space.',
  'panel.info.moreFilters.hideHeading': 'Hide',
  'panel.info.moreFilters.dataUrls': 'Data URLs',
  'panel.info.moreFilters.dataUrlsDesc': 'Exclude inline data: resources — base64 images, fonts, and the like.',
  'panel.info.moreFilters.extensionUrls': 'Extension URLs',
  'panel.info.moreFilters.extensionUrlsDesc': 'Exclude requests to browser-extension origins.',
  'panel.info.moreFilters.onlyHeading': 'Only show',
  'panel.info.moreFilters.blocked': 'Blocked requests',
  'panel.info.moreFilters.blockedDesc': 'Restrict the list to requests a rule blocked.',
  'panel.info.moreFilters.thirdParty': '3rd-party requests',
  'panel.info.moreFilters.thirdPartyDesc': 'Restrict to requests whose origin differs from the page’s.',
  'panel.info.moreFilters.swRequests': 'Service worker requests',
  'panel.info.moreFilters.swRequestsDesc':
    'Restrict to service-worker exchanges — requests the worker issued itself (⚙ rows) and page requests its fetch handler answered.',
  'panel.info.moreFilters.ruleApplied': 'Rule-applied requests',
  'panel.info.moreFilters.ruleAppliedDesc': 'Restrict to requests an Open Headers rule verifiably modified.',

  // ── (i) corpora — Footer View ───────────────────────────────────────
  'panel.info.view.summary':
    'Chooses which optional stats the footer shows, beside the always-on request and transfer counts.',
  'panel.info.view.scopeHeading': 'Summary scope',
  'panel.info.view.focusedTool': 'Focused tool',
  'panel.info.view.focusedToolDesc':
    'The footer follows the focused tool window — Storage, Console, and Search show their own summary lines; other tools fall back to the Network line.',
  'panel.info.view.networkOnly': 'Network tool only',
  'panel.info.view.networkOnlyDesc': 'The footer always shows the Network figures, whichever tool window has focus.',
  'panel.info.view.countsHeading': 'Footer counts',
  'panel.info.view.modified': 'Modified',
  'panel.info.view.modifiedDesc': 'How many requests a rule changed.',
  'panel.info.view.failed': 'Failed',
  'panel.info.view.failedDesc': 'How many requests errored or were blocked.',
  'panel.info.view.cached': 'Cached',
  'panel.info.view.cachedDesc': 'How many responses were served from the cache.',
  'panel.info.view.timingHeading': 'Timing',
  'panel.info.view.pageLabel': 'Current page label',
  'panel.info.view.pageLabelDesc':
    'Names the page the timing milestones describe when the log spans more than one navigation.',
  'panel.info.view.allNavs': 'Across all navigations',
  'panel.info.view.allNavsDesc':
    'Finish / DOMContentLoaded / Load span the whole preserve-log timeline, not just the latest navigation.',

  // ── (i) corpora — Disable cache ─────────────────────────────────────
  'panel.info.cache.summary': 'Stops this tab from serving responses out of the cache.',
  'panel.info.cache.debugDesc':
    'This tab is in Debug mode: the cache is disabled at the network-stack level — the in-memory cache too — matching the browser’s native Disable cache.',
  'panel.info.cache.standardDesc':
    'This tab is in standard mode: only the HTTP cache is bypassed, by asking the server to revalidate. Enable Debug mode for a full network-stack disable that also clears the in-memory cache.',
  'panel.info.cache.standardHeading': 'Standard mode',
  'panel.info.cache.revalidateDesc':
    'Added to every request so the server re-checks freshness. Bypasses the HTTP cache only.',
  'panel.info.cache.debugHeading': 'Debug mode',
  'panel.info.cache.cdpDesc':
    'Disables the cache for the whole tab at the network-stack level, including the in-memory cache.',

  // ── (i) corpora — System overrides ──────────────────────────────────
  'panel.info.overrides.title': 'System overrides',
  'panel.info.overrides.summary':
    'Pins this tab’s system identity — User-Agent, locale, timezone, and emulated media — to see how a site responds to a different client.',
  'panel.info.overrides.debugDesc':
    'Active on this tab through Debug mode. The User-Agent facets apply to requests and to page scripts; locale, timezone, and media change only what the page’s own scripts and CSS observe. Reset all restores the real values.',
  'panel.info.overrides.standardDesc':
    'System overrides need Debug mode — there is no standard-mode fallback. Enable Debug mode and keep this tab in scope to override it.',
  'panel.info.overrides.wireHeading': 'On the wire + page scripts',
  'panel.info.overrides.uaDesc':
    'Sets the User-Agent / Accept-Language headers, the platform, and the matching navigator.* values.',
  'panel.info.overrides.pageHeading': 'Page only',
  'panel.info.overrides.localeDesc': 'Changes the locale page scripts read.',
  'panel.info.overrides.timezoneDesc': 'Changes the timezone Date and Intl resolve to.',
  'panel.info.overrides.mediaDesc': 'Forces color-scheme / reduced-motion / print media queries.',

  // ── (i) corpora — Network throttling ────────────────────────────────
  'panel.info.throttle.title': 'Network throttling',
  'panel.info.throttle.summary': 'Simulates slower connections by capping this tab’s bandwidth and adding latency.',
  'panel.info.throttle.debugDesc':
    'Active on this tab through Debug mode. Pick a preset — the defaults plus fiber / cable / DSL and 5G / 2G under More presets — go Offline, or set a custom download / upload / latency.',
  'panel.info.throttle.standardDesc':
    'Throttling needs Debug mode — there is no standard-mode fallback. Enable Debug mode and keep this tab in scope to throttle it.',
  'panel.info.throttle.presetsHeading': 'Presets',
  'panel.info.throttle.fast4gDesc': '≈8.1 Mbit/s down, 165 ms latency.',
  'panel.info.throttle.slow4gDesc': '≈1.44 Mbit/s down, 562.5 ms latency.',
  'panel.info.throttle.3gDesc': '≈400 kbit/s, 2000 ms latency.',
  'panel.info.throttle.offlineDesc': 'Blocks all network traffic for the tab.',
  'panel.info.throttle.wiredHeading': 'More presets · Wired',
  'panel.info.throttle.fiberDesc': '≈500 Mbit/s, 2 ms latency.',
  'panel.info.throttle.cableDesc': '≈200 Mbit/s down, 8 ms latency.',
  'panel.info.throttle.dslDesc': '≈20 Mbit/s down, 25 ms latency.',
  'panel.info.throttle.mobileHeading': 'More presets · Mobile',
  'panel.info.throttle.fast5gDesc': '≈100 Mbit/s down, 8 ms latency.',
  'panel.info.throttle.slow5gDesc': '≈30 Mbit/s down, 18 ms latency.',
  'panel.info.throttle.fast2gDesc': '≈280 kbit/s, 2000 ms latency.',
  'panel.info.throttle.slow2gDesc': '≈100 kbit/s, 3000 ms latency.',

  // ── Status bar (footer summary line) ───────────────────────────────
  'panel.status.requests': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} request', other: '{count} requests' }),
  'panel.status.requestsSubset': '{subset} / {total} requests',
  'panel.status.modified': '{count} modified',
  'panel.status.modifiedTitle': 'Requests your rules modified',
  'panel.status.failed': '{count} failed',
  'panel.status.failedTitle': 'Failed or error-status requests',
  'panel.status.cached': '{count} cached',
  'panel.status.cachedTitle': 'Requests served from cache',
  'panel.status.transferredOnly': '{size} transferred',
  'panel.status.transferredAndResources': '{transferred} transferred / {resources} resources',
  'panel.status.transferredSubset': '{subset} / {total} transferred',
  'panel.status.resourcesSubset': '{subset} / {total} resources',
  'panel.status.finish': 'Finish: {time}',
  'panel.status.loadEventTitle': 'Load event',
  'panel.status.tabs': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} tab', other: '{count} tabs' }),
  'panel.status.messagesOf': '{visible} of {total} messages',
  'panel.status.messages': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} message', other: '{count} messages' }),
  'panel.status.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} error', other: '{count} errors' }),
  'panel.status.errorsTitle': 'Console messages at the error level',
  'panel.status.warnings': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} warning', other: '{count} warnings' }),
  'panel.status.warningsTitle': 'Console messages at the warning level',
  'panel.status.systemStatus': 'System status',
  'panel.status.theme.light': 'Light',
  'panel.status.theme.dark': 'Dark',
  'panel.status.theme.auto': 'Auto',

  // ── Tool-window registry labels (activity bar / dock tabs / restore) ─
  'panel.toolWindows.network': 'Network',
  'panel.toolWindows.storage': 'Storage',
  'panel.toolWindows.console': 'Console',
  'panel.toolWindows.search': 'Search',
  'panel.toolWindows.notifications': 'Notifications',
  'panel.toolWindows.docs': 'Docs',
  'panel.toolWindows.ruleActivity': 'Rule Activity',
  'panel.toolWindows.matchedRules': 'Matched Rules',

  // ── Docs tool-window navigation ─────────────────────────────────────
  'panel.docs.nav.group.panel': 'Panel',
  'panel.docs.nav.filterSyntax.title': 'Filter Syntax',
  'panel.docs.nav.filterSyntax.summary':
    'Text tokens, property filters, and the match toggles — every card filters one shared example capture.',

  // ── Docs tool window: Filter Syntax section body ─────────────────────
  // Filter grammar (`api users`, `-term`, `domain:`, `is:from-cache`,
  // `larger-than:100k`, …), the toggle glyphs (Aa / ab / .*), the Alt+C /
  // Alt+W / Alt+R chords, the × clear glyph, and everything inside the
  // FilterExample device (mock input text, the example-capture rows, its
  // kicker, ✓/✗ glyphs, per-row failure reasons) ride raw — S18 diagram
  // boundary. DiagramFrame captions, card prose, titles and headings key.
  'panel.docs.filterSyntax.intro1Prefix': 'The traffic filter combines free text,',
  'panel.docs.filterSyntax.intro1Suffix':
    'property filters, and three match toggles. Terms separated by spaces must ALL match (AND), and every card below runs its filter over the same five-request example capture — each diagram is one slice of that picture.',
  'panel.docs.filterSyntax.intro2Prefix':
    'Every filter input in the panel — Network, Console, Storage, Headers, Cookies, Initiator, Messages — carries the same three toggles',
  'panel.docs.filterSyntax.intro2MatchCase': 'match case',
  'panel.docs.filterSyntax.intro2WholeWord': 'whole word',
  'panel.docs.filterSyntax.intro2Regex': 'regex',
  'panel.docs.filterSyntax.intro2Middle': 'and a',
  'panel.docs.filterSyntax.intro2Suffix': 'button that clears the text.',
  'panel.docs.filterSyntax.intro2Kbd': 'Keyboard:',
  'panel.docs.filterSyntax.intro2KbdSuffix': 'flip the toggles while the input has focus.',

  'panel.docs.filterSyntax.headingText': 'Text filters',
  'panel.docs.filterSyntax.headingProperty': 'Property filters',
  'panel.docs.filterSyntax.headingToggles': 'Match toggles',
  'panel.docs.filterSyntax.headingElsewhere': 'Everywhere else',

  'panel.docs.filterSyntax.textTitle': 'Text',
  'panel.docs.filterSyntax.text1':
    'A bare term keeps every request whose URL contains it. Several terms AND together — a request must contain all of them, in any position.',
  'panel.docs.filterSyntax.textCaption':
    'Two terms — only the request whose URL contains both “api” and “users” survives.',

  'panel.docs.filterSyntax.negationTitle': 'Negation',
  'panel.docs.filterSyntax.negation1Prefix': 'A leading',
  'panel.docs.filterSyntax.negation1Middle': 'flips any token:',
  'panel.docs.filterSyntax.negation1Middle2':
    'hides matching requests instead of keeping them. Works on property filters too —',
  'panel.docs.filterSyntax.negationCaption': 'Everything stays EXCEPT requests matching the negated term.',

  'panel.docs.filterSyntax.phraseTitle': 'Exact Phrase',
  'panel.docs.filterSyntax.phrase1Prefix':
    'Quotes make one token out of text that contains spaces, and keep characters like',
  'panel.docs.filterSyntax.phrase1Or': 'or',
  'panel.docs.filterSyntax.phrase1Suffix': 'literal — useful for query strings.',
  'panel.docs.filterSyntax.phraseCaption': 'The quoted phrase matches as one contiguous piece of the URL.',

  'panel.docs.filterSyntax.propertyIntroPrefix': 'A',
  'panel.docs.filterSyntax.propertyIntroSuffix':
    'token checks one attribute of the request instead of the whole URL. Property filters compose with text tokens and with each other — all of them must match.',

  'panel.docs.filterSyntax.domainTitle': 'Domain',
  'panel.docs.filterSyntax.domain1Prefix':
    'Matches the hostname by substring, so an apex domain catches every subdomain —',
  'panel.docs.filterSyntax.domain1Suffix': '— without wildcards.',
  'panel.docs.filterSyntax.domainCaption':
    'One value covers every openheaders.io subdomain; the third-party host misses.',

  'panel.docs.filterSyntax.statusCodeTitle': 'Status Code',
  'panel.docs.filterSyntax.statusCode1':
    'Keeps requests whose response carried exactly this code. Pending and failed requests have no code, so they never match.',
  'panel.docs.filterSyntax.statusCodeCaption': 'Only the 404 survives — the exact code, not a range.',

  'panel.docs.filterSyntax.methodTitle': 'Method',
  'panel.docs.filterSyntax.method1Prefix': 'Keeps requests using this HTTP verb, compared case-insensitively —',
  'panel.docs.filterSyntax.method1And': 'and',
  'panel.docs.filterSyntax.method1Suffix': 'are the same filter.',
  'panel.docs.filterSyntax.methodCaption': 'Only the POST survives.',

  'panel.docs.filterSyntax.mimeTypeTitle': 'MIME Type',
  'panel.docs.filterSyntax.mime1Prefix': "Matches the response's content type by substring —",
  'panel.docs.filterSyntax.mime1Catches': 'catches',
  'panel.docs.filterSyntax.mime1Suffix': 'catches every image format.',
  'panel.docs.filterSyntax.mimeCaption': 'Both JSON responses survive; scripts, fonts and images miss.',

  'panel.docs.filterSyntax.responseHeaderTitle': 'Response Header',
  'panel.docs.filterSyntax.respHeader1Prefix':
    "Keeps requests whose response carries a header with this exact name — the value doesn't matter. Handy for spotting CDN cache behavior",
  'panel.docs.filterSyntax.respHeader1Suffix': 'or missing security headers (negate it).',
  'panel.docs.filterSyntax.respHeaderCaption': 'Only the CDN response carries an x-cache header.',

  'panel.docs.filterSyntax.largerThanTitle': 'Larger Than',
  'panel.docs.filterSyntax.largerThan1':
    'Keeps requests that transferred more than N bytes. Suffixes scale the number:',
  'panel.docs.filterSyntax.largerThanCaption': 'Only the 128 kB bundle clears the 100k threshold.',

  'panel.docs.filterSyntax.fromCacheTitle': 'From Cache',
  'panel.docs.filterSyntax.fromCache1Prefix': 'Keeps responses the browser served from cache — a',
  'panel.docs.filterSyntax.fromCache1Middle': ', or a disk/memory cache hit that never touched the network. Negate it',
  'panel.docs.filterSyntax.fromCache1Suffix': 'to see only what actually crossed the wire.',
  'panel.docs.filterSyntax.fromCacheCaption': 'Only the cached tracking pixel survives.',

  'panel.docs.filterSyntax.togglesIntroPrefix':
    'The three buttons inside the input change how text tokens compare. They apply to free text (and',
  'panel.docs.filterSyntax.togglesIntroMiddle': 'style tokens on the detail tabs);',
  'panel.docs.filterSyntax.togglesIntroSuffix': 'and the other property filters keep their own semantics.',

  'panel.docs.filterSyntax.matchCaseTitle': 'Match Case',
  'panel.docs.filterSyntax.matchCase1Prefix': 'Off (the default),',
  'panel.docs.filterSyntax.matchCase1And': 'and',
  'panel.docs.filterSyntax.matchCase1Suffix': "are the same filter. On, the term must match the URL's exact casing.",
  'panel.docs.filterSyntax.matchCaseCaption':
    'With Aa on, “Users” matches nothing — every URL in the capture is lowercase.',

  'panel.docs.filterSyntax.wholeWordTitle': 'Whole Word',
  'panel.docs.filterSyntax.wholeWord1Prefix': 'The term only matches at word boundaries —',
  'panel.docs.filterSyntax.wholeWord1Suffix':
    'and friends count as boundaries. Use it when a short term is buried inside longer words.',
  'panel.docs.filterSyntax.wholeWordCaption':
    '“user” no longer matches inside “users” — with ab off, request #7 would match.',

  'panel.docs.filterSyntax.regexTitle': 'Regex',
  'panel.docs.filterSyntax.regex1':
    "The whole input becomes one regular expression tested against the URL — property tokens are not parsed in this mode. A pattern that doesn't compile turns the input red and hides nothing.",
  'panel.docs.filterSyntax.regexCaption': 'One pattern, two file types: URLs ending in .js or .woff2.',

  'panel.docs.filterSyntax.otherInputsTitle': 'Other Filter Inputs',
  'panel.docs.filterSyntax.otherIntroPrefix':
    'The detail tabs carry the same input with their own property keys; the toggles and',
  'panel.docs.filterSyntax.otherIntroSuffix': 'negation work identically in each:',
  'panel.docs.filterSyntax.otherPlainGroup': 'Console, Storage, Messages, Call Stack',
  'panel.docs.filterSyntax.otherPlainBody':
    'plain text with the three toggles; Storage also counts matches per section on its navigation rail while you type.',
  'panel.docs.filterSyntax.otherSearchPrefix': 'plain text (or a regex under',
  'panel.docs.filterSyntax.otherSearchMiddle': ') with the three toggles, submitted with Enter. The',
  'panel.docs.filterSyntax.otherSearchSuffix':
    'chips pick which data it scans — at least one stays selected — and each result opens its source: the request tab, the storage section, or the Console.',

  // ── Console tool window (station: console family) ───────────────────
  // Raw by design: level wire names (debug/log/…), the › ‹ chevrons and
  // ⚙ prefix, context labels (top / frame names / script URLs), source
  // locations (file:line, "(generated: …)"), "(anonymous)", the browser's
  // synthesized network phrasing ("Fetch finished loading:", "Failed to
  // load resource:"), and the example-transcript rows in the (i) corpora.
  'panel.console.clear': 'Clear console',
  'panel.console.collapseAll': 'Collapse all',
  'panel.console.expandAll': 'Expand all',
  'panel.console.filterAria': 'Filter console messages',
  'panel.console.levelTitle': 'Log level: {label}',
  'panel.console.settings': 'Console settings',
  'panel.console.settingsPaneAria': 'Console settings',
  'panel.console.contextTitle': 'JavaScript context — where console commands evaluate',

  // Level-filter menu (the browser's "Default levels ▾" ladder)
  'panel.console.levels.verbose': 'Verbose',
  'panel.console.levels.info': 'Info',
  'panel.console.levels.warnings': 'Warnings',
  'panel.console.levels.errors': 'Errors',
  'panel.console.levels.all': 'All levels',
  'panel.console.levels.defaultLevels': 'Default levels',
  'panel.console.levels.hideAll': 'Hide all',
  'panel.console.levels.only': '{level} only',
  'panel.console.levels.custom': 'Custom levels',
  'panel.console.levels.default': 'Default',

  // Settings pane (labels + hover titles, browser pane order)
  'panel.console.setting.hideNetwork': 'Hide network',
  'panel.console.setting.hideNetworkTitle': "Hide the browser's network log entries (failed and blocked requests)",
  'panel.console.setting.logXhr': 'Log XMLHttpRequests',
  'panel.console.setting.logXhrTitle': 'Log a message when an XHR, fetch, or EventSource request finishes or fails',
  'panel.console.setting.preserveLog': 'Preserve log',
  'panel.console.setting.preserveLogTitle': 'Do not clear the log on navigation',
  'panel.console.setting.eagerEval': 'Eager evaluation',
  'panel.console.setting.eagerEvalTitle': 'Eagerly evaluate text in the prompt (side-effect-free preview)',
  'panel.console.setting.selectedContextOnly': 'Selected context only',
  'panel.console.setting.selectedContextOnlyTitle': 'Only show messages from the selected context',
  'panel.console.setting.autocompleteHistory': 'Autocomplete from history',
  'panel.console.setting.autocompleteHistoryTitle': 'Suggest commands you ran before as you type in the prompt',
  'panel.console.setting.groupSimilar': 'Group similar messages in console',
  'panel.console.setting.groupSimilarTitle': 'Collapse repeated identical messages into one row with a count',
  'panel.console.setting.evalUserGesture': 'Treat code evaluation as user action',
  'panel.console.setting.evalUserGestureTitle':
    'Evaluate with a user gesture, so APIs gated on user activation work from the prompt',
  'panel.console.setting.showCorsErrors': 'Show CORS errors in console',
  'panel.console.setting.showCorsErrorsTitle': "Show CORS policy errors alongside the page's own output",

  // Per-setting (i) info corpora (titles reuse the setting label keys;
  // groupSimilar's popover title differs from its checkbox label)
  'panel.console.info.exampleCaption': 'Example console',
  'panel.console.info.hideNetwork.summary':
    'Hides the browser’s own network log entries — failed and blocked requests — while the page’s console output always stays.',
  'panel.console.info.hideNetwork.description':
    'Also hides the "finished loading" rows synthesized by Log XMLHttpRequests — they are network-source messages too.',
  'panel.console.info.logXhr.summary': 'Logs a row whenever an XHR, fetch, or EventSource request finishes or fails.',
  'panel.console.info.logXhr.description':
    'Rows log at the Info level — failures too — and the URL links to the request’s row in the Network panel. Hide network hides these rows as well.',
  'panel.console.info.preserveLog.summary': 'Keeps the log across page navigations instead of clearing it.',
  'panel.console.info.preserveLog.description':
    'Off, a navigation — the page’s top context being recreated — cuts the view to the entries that arrive after it.',
  'panel.console.info.eagerEval.summary':
    'Previews the result of the expression you are typing on the grey line under the prompt.',
  'panel.console.info.eagerEval.description':
    'The preview evaluates side-effect-free: an expression that would change page state shows nothing instead of running, and nothing is written to the log until you press Enter.',
  'panel.console.info.selectedContextOnly.summary':
    'Only shows messages from the JavaScript context picked in the toolbar’s context selector.',
  'panel.console.info.selectedContextOnly.description':
    'Entries that carry no context — the browser’s own log entries — always stay visible.',
  'panel.console.info.autocompleteHistory.summary':
    'Suggests the most recent command that extends what you typed, as a dimmed completion in the prompt.',
  'panel.console.info.autocompleteHistory.description':
    'Tab — or → at the end of the input — accepts it; ↑/↓ still walk the history. The history lives for the current panel session.',
  'panel.console.info.groupSimilar.title': 'Group similar messages',
  'panel.console.info.groupSimilar.summary':
    'Collapses consecutive identical messages into one row with a count badge.',
  'panel.console.info.groupSimilar.description':
    'Typed commands and their results never group — the transcript stays literal.',
  'panel.console.info.evalUserGesture.summary': 'Runs prompt commands as if a user gesture triggered them.',
  'panel.console.info.evalUserGesture.description':
    'APIs gated on user activation — opening a window, writing to the clipboard, fullscreen — succeed from the prompt with this on.',
  'panel.console.info.showCorsErrors.summary':
    'Shows the browser’s CORS explanations — "Access to fetch at … has been blocked by CORS policy: …" — alongside the page’s output.',
  'panel.console.info.showCorsErrors.description':
    'Off hides only those explanation messages; the blocked request itself still shows in the Network panel.',

  // Capture-stopped banner + never-silent empty surfaces
  'panel.console.banner.leftScope':
    'Capture stopped — this tab left Debug mode’s scope. Showing the last captured output.',
  'panel.console.banner.debugOff': 'Capture stopped — Debug mode is off. Showing the last captured output.',
  'panel.console.enableDebug': 'Enable Debug mode',
  'panel.console.empty.noCdp.title': 'Console capture needs Debug mode',
  'panel.console.empty.noCdp.sub': 'Debug-mode inspection isn’t available in this browser.',
  'panel.console.empty.capturing.title': 'No console output yet',
  'panel.console.empty.capturing.sub':
    'This tab’s log messages and uncaught exceptions will appear here as they happen.',
  'panel.console.empty.debugOff.title': 'Enable Debug mode to view console logs',
  'panel.console.empty.debugOff.sub':
    'Open Headers captures this tab’s console output and uncaught exceptions while Debug mode is on.',
  'panel.console.empty.outOfScope.title': 'This tab is outside Debug mode’s scope',
  'panel.console.empty.outOfScope.sub':
    'Bring it into scope from Debug mode — change the scope or pin this tab — to capture its console output.',
  'panel.console.noMatch': 'No console entries match your filter.',
  'panel.console.revealedHidden': 'Revealed message is hidden by the active filter',

  // Log rows
  'panel.console.repeatTitle': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} identical message', other: '{count} identical messages' }),
  'panel.console.expandStack': 'Expand stack trace',
  'panel.console.collapseStack': 'Collapse stack trace',

  // REPL prompt
  'panel.console.prompt.waiting': 'Waiting for a JavaScript context…',
  'panel.console.prompt.placeholder': 'Run JavaScript in the selected context',
  'panel.console.prompt.aria': 'Console prompt',
  'panel.console.prompt.previewAria': 'Eager evaluation preview',

  // ── Search tool window (station: search family) ─────────────────────
  // Raw by design: match-text lines, section labels (doc-plane vocabulary
  // shared with the filter grammar), #ordinal / line:col figures, doc
  // names/origins, timing figures (ms / s), and the · separators. The
  // source chips and group badges reuse the tool-window label keys.
  'panel.search.placeholder': 'Search (press Enter)',
  'panel.search.inputAria': 'Search captured data',
  'panel.search.syntaxHelp': 'Search syntax help',
  'panel.search.run': 'Search',
  'panel.search.runTitle': 'Run search (Enter)',
  'panel.search.cancel': 'Cancel',
  'panel.search.cancelTitle': 'Cancel search',
  'panel.search.idleHintMin': 'Enter a query (min 2 characters) and press Enter to search.',
  'panel.search.idleHintShort': 'Press Enter to search.',
  'panel.search.noMatches': 'No matches found.',

  // Session status lines (panel status strip + published footer line)
  'panel.search.status.searching': 'Searching… {done} / {total}',
  'panel.search.status.noResults': 'No results · {elapsed}',
  'panel.search.status.found': ({ matches, files, elapsed }, locale) => {
    const found = plural(locale, Number(matches), { one: 'Found {count} match', other: 'Found {count} matches' });
    const where = plural(locale, Number(files), { one: '{count} file', other: '{count} files' });
    return `${found} in ${where} · ${elapsed}`;
  },
  'panel.search.status.capped': 'showing the first {shown} — refine the query to see the rest',

  // Result groups + rows
  'panel.search.group.countTitle': '{count} matches in this file',
  'panel.search.group.countTitleCapped': '{count} matches in this file — showing the first {shown}',
  'panel.search.row.lineCol': 'Line {line}, Col {col}',
  'panel.search.row.line': 'Line {line}',
  'panel.search.row.matchesOnLine': '{count} matches on this line',

  // ── Matched Rules tool window (station: rule tool windows) ──────────
  // Raw by design: rule action descriptor lines (`req set X = v` — rule
  // syntax plane), match patterns, rule names/uids, and the brand mark
  // riding between the select-prompt halves.
  'panel.matchedRules.selectPrompt.lead': 'Select a request to see',
  'panel.matchedRules.selectPrompt.tail': 'rules that apply to it',
  'panel.matchedRules.matchedCount': 'Matched · {count}',
  'panel.matchedRules.futureCount': 'Future matches · {count}',
  'panel.matchedRules.noMatched': 'No rules matched this request.',
  'panel.matchedRules.noFuture': 'No other rules would match this request.',
  'panel.matchedRules.pattern': 'Pattern: {pattern}',
  'panel.matchedRules.wouldMatch': 'would match',

  // Fire-evidence badges + their receipts
  'panel.matchedRules.evidence.contradicted': 'contradicted',
  'panel.matchedRules.evidence.authoritative': 'authoritative',
  'panel.matchedRules.evidence.confirmed': 'confirmed',
  'panel.matchedRules.evidence.fallback': 'fallback',
  'panel.matchedRules.evidence.silent': 'silent',
  'panel.matchedRules.evidence.corroborated': 'corroborated',
  'panel.matchedRules.evidence.inferred': 'inferred',
  'panel.matchedRules.evidenceTitle.contradicted':
    'Contradicted — the captured headers disprove a modification this rule claimed.',
  'panel.matchedRules.evidenceTitle.authoritative':
    'Authoritative — the rule engine confirmed this DNR rule executed on the request.',
  'panel.matchedRules.evidenceTitle.capturedOverride':
    'Confirmed — the rule modified the body in page context and both sides (served vs. original) were captured for this request.',
  'panel.matchedRules.evidenceTitle.confirmed':
    'Confirmed by the in-page reporter — the scriptable action ran inside the page.',
  'panel.matchedRules.evidenceTitle.fallback':
    'Inferred from URL matching — a scriptable confirmation was expected but did not arrive.',
  'panel.matchedRules.evidenceTitle.silent':
    'Pattern matched but the request was served from cache / a service worker — no DNR or scriptable action ran.',
  'panel.matchedRules.evidenceTitle.corroborated':
    'Corroborated — the claimed modification is visible in the captured headers.',
  'panel.matchedRules.evidenceTitle.inferred':
    'Inferred from URL matching — the rule would match this request based on its conditions.',
  'panel.matchedRules.contradiction.stillPresent': '{header} is still present ({observed}).',
  'panel.matchedRules.contradiction.missing': '{header} is missing from the captured headers.',
  'panel.matchedRules.contradiction.otherValue': '{header} carries "{observed}" instead of the claimed value.',

  // Rule-state badges (the snapshot fired; the live rule moved on)
  'panel.matchedRules.ruleState.deleted': 'rule deleted',
  'panel.matchedRules.ruleState.disabled': 'rule disabled',
  'panel.matchedRules.ruleState.modified': 'rule modified',
  'panel.matchedRules.ruleStateTitle.deleted':
    'This rule has been deleted since it fired. The row shows what it did at fire time.',
  'panel.matchedRules.ruleStateTitle.disabled':
    'This rule has been disabled since it fired — it will not apply to the next request.',
  'panel.matchedRules.ruleStateTitle.modified':
    'This rule has been edited since it fired. The row shows what it did at fire time; hover to see the current rule.',

  // ── Rule Activity tool window ────────────────────────────────────────
  'panel.ruleActivity.empty': 'No rule activity on this tab yet.',
  'panel.ruleActivity.toolbarHint': 'Rule activity grouped by rule.',
  // Legend: bold term key + remainder key per sentence (the popup tour's
  // term/hint split idiom).
  'panel.ruleActivity.hint.applied': 'Applied',
  'panel.ruleActivity.hint.appliedDesc':
    'fires are confirmed to have run — the rule engine reported the rule executed, the in-page reporter confirmed the action ran, or the modification is visible in the captured headers.',
  'panel.ruleActivity.hint.contradicted': 'Contradicted',
  'panel.ruleActivity.hint.contradictedDesc': 'fires claimed a header change the captured headers disprove.',
  'panel.ruleActivity.hint.inferred': 'Inferred',
  'panel.ruleActivity.hint.inferredDesc':
    "fires match your rule patterns against observed requests but couldn't be confirmed.",
  'panel.ruleActivity.hint.offHar': 'Off-HAR',
  'panel.ruleActivity.hint.offHarDesc': "fires are rule matches on requests the panel didn't capture.",
  'panel.ruleActivity.hits': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} hit', other: '{count} hits' }),
  'panel.ruleActivity.applied': '{count} applied',
  'panel.ruleActivity.contradicted': '{count} contradicted',
  'panel.ruleActivity.offHar': '{count} off-HAR',
  'panel.ruleActivity.offHarTitle': "Off-HAR — the panel didn't capture a HAR shell for this fire",

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

  // ── Quick-editor popovers (station: quick-editor popover family) ────
  // Raw by design: rule/collection/folder/header/param names, URLs,
  // `{{template}}` chips, status codes + MIME values, code/JSON example
  // placeholders (workbench keeps its message-filter examples raw too),
  // the CSS / JS / GraphQL / cURL-style proper nouns, and core
  // validator sentences (`validateHeaderName` / capability reasons —
  // the core headers.ts plane is a later station). Field labels,
  // operation options and placeholders that mirror a workbench control
  // reuse that control's `workbench.editors.rule.fields.*` key
  // (names-its-referent — the popover is the compact form of the same
  // control).
  'panel.quickEditor.clearRuleNameAria': 'Clear rule name',
  'panel.quickEditor.renameTitle': '{name} — click to rename',
  'panel.quickEditor.enabledOn': 'Enabled',
  'panel.quickEditor.enabledOff': 'Disabled',
  'panel.quickEditor.ruleEnabledAria': 'Rule enabled',
  'panel.quickEditor.openInWorkspace': 'Open in workspace →',
  'panel.quickEditor.saveButton': 'Save',
  'panel.quickEditor.openToInspect': 'Open in workspace to inspect or change this rule.',
  'panel.quickEditor.variableMissing': 'Variable missing — hover the red reference to create it and enable Save.',
  'panel.quickEditor.retargetHint': 'Adjust the conditions below to retarget the rule.',

  // Save/toggle toasts (create + edit chains share the not-found case).
  'panel.quickEditor.toast.ruleUpdated': 'Rule updated',
  'panel.quickEditor.toast.ruleNotFound': 'Rule not found — it may have been deleted.',
  'panel.quickEditor.toast.saveFailed': 'Save failed',
  'panel.quickEditor.toast.toggleFailed': 'Could not toggle the rule',
  'panel.quickEditor.toast.changedElsewhere': 'Rule changed elsewhere — close and reopen the popover.',
  'panel.quickEditor.toast.noWorkspace': 'No active workspace',
  'panel.quickEditor.toast.collectionCreateFailed': 'Failed to create a collection for the rule',
  'panel.quickEditor.toast.folderCreateFailed': 'Couldn’t create the “{name}” folder — saving at the collection root.',
  'panel.quickEditor.toast.createFailed': 'Failed to create rule',
  'panel.quickEditor.toast.createdDraft': 'Rule created as a draft — publish it from the workspace.',
  'panel.quickEditor.toast.created': 'Rule created',

  // Destination row ("Saving to" label + raw collection/folder names).
  'panel.quickEditor.destination.title': 'Choose where the rule is saved',
  'panel.quickEditor.destination.savingTo': 'Saving to',
  'panel.quickEditor.destination.newTag': 'new',
  'panel.quickEditor.destination.autoNamed': 'Auto — {folder}',
  'panel.quickEditor.destination.autoRoot': 'Auto — collection root',
  'panel.quickEditor.destination.root': 'Collection root',

  // Conditions row ("Conditions" label + raw digest of the list).
  'panel.quickEditor.conditions.title': 'Show and edit when this rule fires',
  'panel.quickEditor.conditions.label': 'Conditions',
  'panel.quickEditor.conditions.none': 'none — matches no requests',

  // Header quick editors (single-mod hover + whole-list + create).
  // Operation options reuse the workbench op keys; validator sentences
  // from core ride raw — only the UI fallbacks are keyed here.
  'panel.quickEditor.header.addHeader': 'Add header',
  'panel.quickEditor.header.mergeSeparatorTitle': 'Merge separator',
  'panel.quickEditor.header.directionRequest': 'Request',
  'panel.quickEditor.header.directionResponse': 'Response',
  'panel.quickEditor.validation.nameRequired': 'Header name is required.',
  'panel.quickEditor.validation.invalidName': 'Invalid header name.',
  'panel.quickEditor.validation.invalidValue': 'Invalid header value.',
  // {operation} interpolates the raw schema operation the one-click fix
  // would switch to (e.g. add).
  'panel.quickEditor.validation.switchTo': 'Switch to {operation}',

  // Typed bodies — popover-only copy. Field labels / option words that
  // mirror a workbench control reuse its key (see the station comment
  // above); the ws direction words differ from the workbench's
  // parenthesized pair, so they are popover-local (glyphs ride raw).
  'panel.quickEditor.redirect.targetPlaceholder': 'e.g. https://openheaders.io/redirected',
  'panel.quickEditor.redirect.hint': 'Matching requests are sent to this URL before they reach the network.',
  'panel.quickEditor.delay.hint':
    'Navigations are delayed up to 30,000 ms; XHR/fetch is capped at 5,000 ms. Sub-resources are not delayed.',
  'panel.quickEditor.block.editHint': 'Matching requests are blocked before they reach the network.',
  'panel.quickEditor.block.blockRequestsTo': 'Block requests to',
  'panel.quickEditor.block.createHint':
    'Matching requests are canceled before they leave the browser — the page sees a network error.',
  'panel.quickEditor.response.tagModify': 'Modify',
  'panel.quickEditor.response.tagMock': 'Mock',
  'panel.quickEditor.response.dynamicBody':
    'This rule builds its response with JavaScript. Open in workspace to edit the script.',
  'panel.quickEditor.requestBody.hint': "Matching requests are sent with this body instead of the page's.",
  'panel.quickEditor.requestBody.dynamicBody':
    'This rule builds its body with JavaScript. Open in workspace to edit the script.',
  'panel.quickEditor.inject.sourceUrlLabel': 'Source URL',
  'panel.quickEditor.inject.loadsStylesheetHint': 'Matching pages load this stylesheet as they load.',
  'panel.quickEditor.inject.loadsScriptHint': 'Matching pages load this script as they load.',
  'panel.quickEditor.inject.injectedHint': 'Injected into matching pages as they load.',
  'panel.quickEditor.message.incoming': 'Incoming ⬇',
  'panel.quickEditor.message.outgoing': 'Outgoing ⬆',
  'panel.quickEditor.message.injectedConnectionsHint': 'Injected on matching connections before listeners see it.',
  'panel.quickEditor.message.injectedStreamsHint': 'Injected on matching streams before listeners see it.',
  'panel.quickEditor.message.replacedFramesHint':
    'Matching frames are replaced with this payload before they are seen.',
  'panel.quickEditor.message.replacedEventsHint':
    'Matching events are replaced with this payload before they are seen.',
  'panel.quickEditor.message.droppedFramesHint': 'Matching frames are dropped before they are seen.',
  'panel.quickEditor.message.droppedEventsHint': 'Matching events are dropped before they are seen.',
  'panel.quickEditor.queryParam.addAction': 'Add action',
  'panel.quickEditor.queryParam.removeAllWarning':
    'Remove All strips the entire query string — the other operations in this rule will be ignored.',
  'panel.quickEditor.auth.challengesHint':
    'Answers server (401) and proxy (407) authentication challenges on matching requests.',

  // ── Rule hover popover (fire-snapshot plane) ─────────────────────────
  // Raw by design: header names/values, `{{template}}` text, the
  // sibling-mod rows (req / res wire chips, op glyphs, the wire-shaped
  // hover title) and the snapshot byline's direction word
  // (request/response — wire vocabulary beside the raw header name).
  'panel.ruleHover.tagRuleEdited': 'Rule edited',
  'panel.ruleHover.tagVariableChanged': 'Variable changed',
  'panel.ruleHover.tagDeleted': 'Deleted',
  'panel.ruleHover.tagDisabled': 'Disabled',
  'panel.ruleHover.tagModRemoved': 'Mod removed',
  'panel.ruleHover.tagConditionsMismatch': "Conditions don't match",
  'panel.ruleHover.tagWontFire': "Won't fire",
  'panel.ruleHover.tagTitle.ruleDisabled': "Rule's enabled flag is off — it will not fire on any future request.",
  'panel.ruleHover.tagTitle.modGone': 'The matching modification was removed from the rule.',
  'panel.ruleHover.tagTitle.conditionsMismatch': "Rule's conditions no longer cover this URL.",
  'panel.ruleHover.tagTitle.nameUnresolved':
    "Header-name template can't be fully resolved (e.g. references a TOTP). DNR rejects literal template chars in header names.",
  'panel.ruleHover.tagTitle.valueUnresolved': "Header-value template can't be fully resolved.",
  'panel.ruleHover.tagTitle.separatorUnresolved': "Merge-separator template can't be fully resolved.",
  'panel.ruleHover.deletedBody': 'This rule has been deleted. The capture above shows what it did when it fired.',
  'panel.ruleHover.modRemovedBody':
    'The matching modification has been removed from the rule. Open in workspace to recreate or adjust it.',

  // Snapshot block (Original / Now / Future rows + byline).
  'panel.ruleHover.snapshot.opInject': 'inject',
  'panel.ruleHover.snapshot.opOverride': 'override',
  'panel.ruleHover.snapshot.opAppend': 'append',
  'panel.ruleHover.snapshot.opMerge': 'merge',
  'panel.ruleHover.snapshot.opRemove': 'remove',
  'panel.ruleHover.snapshot.templateTitle': 'Template before variable resolution at fire time',
  'panel.ruleHover.snapshot.nameDriftTitle':
    'Same template — a referenced variable now resolves to a different header name',
  'panel.ruleHover.snapshot.cancels': 'cancels "{rule}"',
  'panel.ruleHover.snapshot.original': 'Original',
  'panel.ruleHover.snapshot.now': 'Now',
  'panel.ruleHover.snapshot.future': 'Future',
  'panel.ruleHover.snapshot.futureTitle': 'What the next matching request would get',
  'panel.ruleHover.snapshot.removed': 'removed',
  'panel.ruleHover.snapshot.empty': '(empty)',
  'panel.ruleHover.snapshot.totpNote': 'TOTP / deferred refs are resolved at request time and not captured here.',
  'panel.ruleHover.snapshot.alsoByRule': 'Also by this rule on this request',

  // Future-row variants (one key per FutureKind wording).
  'panel.ruleHover.future.ruleDeleted': "rule was deleted — won't fire",
  'panel.ruleHover.future.ruleDisabled': "rule is disabled — won't fire",
  'panel.ruleHover.future.modGone': 'this modification was removed from the rule',
  'panel.ruleHover.future.conditionsMismatch': "rule's conditions no longer match this URL",
  'panel.ruleHover.future.nameUnresolved': "header name template can't be resolved — rule won't fire",
  'panel.ruleHover.future.valueUnresolved': "value template can't be resolved — rule won't fire",
  'panel.ruleHover.future.separatorUnresolved': "mergeSeparator template can't be resolved — rule won't fire",
  'panel.ruleHover.future.templateTitle': 'Template: {template}',

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

  // Section headers + table column headers. Set-Cookie attribute tokens
  // (Domain / Path / Expires / SameSite / HttpOnly / Secure) are
  // glossary vocabulary and stay raw where they label a column alone.
  'panel.inspector.cookies.section.response': 'Response Cookies',
  'panel.inspector.cookies.section.request': 'Request Cookies',
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

  // ── Storage tool window — shell, grids, sections, quota card, footer
  // lines. Raw by design: grid COLUMN HEADERS and their (i) titles
  // (Key / Value / Name / Domain · Path / Expires / Sec / Request /
  // Method / Size / Time — the S37 grid-header lock), the
  // localStorage / sessionStorage API globals, example-card payloads,
  // char / byte / MB figures, the '(iframe)' token, '—' em dashes,
  // the Key / Value input placeholders (they name their raw columns),
  // and data-plane not-sent reasons riding as holes. ─────────────────
  'panel.storage.nav.aria': 'Storage type',
  'panel.storage.nav.local': 'Local storage',
  'panel.storage.nav.session': 'Session storage',
  'panel.storage.nav.cookies': 'Cookies',
  'panel.storage.nav.indexeddb': 'IndexedDB',
  'panel.storage.nav.cachestorage': 'Cache Storage',
  'panel.storage.nav.quota': 'Usage',
  'panel.storage.nav.badgeTitle': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} match', other: '{count} matches' }),
  'panel.storage.filterAria': 'Filter storage entries',
  'panel.storage.revealedHidden': 'Revealed row is hidden by the active filter',
  'panel.storage.addCookieTitle': 'Add a cookie to the browser jar (including HttpOnly)',
  'panel.storage.addCookieAria': 'Add cookie',
  'panel.storage.addEntryTitle': 'Add entry',
  'panel.storage.addEntryAria': 'Add storage entry',
  'panel.storage.addReadOnly.indexeddb': 'IndexedDB is read-only here',
  'panel.storage.addReadOnly.cachestorage': 'Cache Storage is read-only here',
  'panel.storage.addReadOnly.quota': 'Usage is read-only',
  'panel.storage.refreshTitle': 'Refresh',
  'panel.storage.refreshAria': 'Refresh storage',
  'panel.storage.originAria': 'Storage origin',
  'panel.storage.partitionedChip': 'partitioned',
  'panel.storage.partitionedTitle':
    "Partitioned storage — this origin's data here is keyed under {site}.\nStorage key: {raw}",
  'panel.storage.partitionFallback': 'a partition',
  // Count lines — shared by the scope note and the footer status line.
  'panel.storage.count.items': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} item', other: '{count} items' }),
  'panel.storage.count.itemsOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { one: '{count} item', other: '{count} items' });
    return `${String(shown)} of ${total}`;
  },
  'panel.storage.count.cookies': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} cookie', other: '{count} cookies' }),
  'panel.storage.count.cookiesOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { one: '{count} cookie', other: '{count} cookies' });
    return `${String(shown)} of ${total}`;
  },
  'panel.storage.count.databases': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} database', other: '{count} databases' }),
  'panel.storage.count.caches': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} cache', other: '{count} caches' }),
  'panel.storage.count.quotaUsed': '{used} of {total} used',
  'panel.storage.count.sectionsMatch': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} section matches', other: '{count} sections match' }),
  'panel.storage.note.writeFailed': 'write failed',
  'panel.storage.note.deleteFailed': 'delete failed',
  'panel.storage.note.readFailed': 'read failed — showing last data',
  'panel.storage.note.truncated': 'list truncated',
  // Clear gestures — whole-sentence per-section titles (no noun stitching).
  'panel.storage.clear.label.local': 'Clear local storage',
  'panel.storage.clear.label.session': 'Clear session storage',
  'panel.storage.clear.label.cookies': 'Clear cookies',
  'panel.storage.clear.label.indexeddb': 'Clear IndexedDB',
  'panel.storage.clear.label.cachestorage': 'Clear Cache Storage',
  'panel.storage.clear.title.local': 'Clear every localStorage entry',
  'panel.storage.clear.title.session': 'Clear every sessionStorage entry',
  'panel.storage.clear.title.cookies': 'Clear every cookie in this site’s jar',
  'panel.storage.clear.title.indexeddb': 'Clear every IndexedDB database',
  'panel.storage.clear.title.cachestorage': 'Clear every cache',
  'panel.storage.clear.armedTitle.local': 'Deletes every localStorage entry for this origin',
  'panel.storage.clear.armedTitle.session': 'Deletes every sessionStorage entry for this origin',
  'panel.storage.clear.armedTitle.cookies': 'Deletes every cookie in this site’s jar for this origin',
  'panel.storage.clear.armedTitle.indexeddb': 'Deletes every IndexedDB database for this origin',
  'panel.storage.clear.armedTitle.cachestorage': 'Deletes every cache for this origin',
  'panel.storage.confirmClear': 'Confirm clear?',
  'panel.storage.confirmDelete': 'Confirm delete?',
  'panel.storage.confirmSuffixAria': '{action} — click again to confirm',
  'panel.storage.cleared': '✓ cleared',
  'panel.storage.clearFailed': 'clear failed',
  // Empty / error states.
  'panel.storage.empty.loading': 'Loading…',
  'panel.storage.empty.notAvailableTitle': 'Storage inspection isn’t available here',
  'panel.storage.empty.notAvailableSub': 'This host doesn’t expose the inspected tab’s application storage.',
  'panel.storage.empty.noOriginsTitle': 'No inspectable origins',
  'panel.storage.empty.noOriginsDomSub':
    'This tab has no http(s) frames with DOM storage — browser-internal pages can’t be inspected.',
  'panel.storage.empty.noOriginsSub': 'This tab has no http(s) frames — browser-internal pages can’t be inspected.',
  'panel.storage.empty.noOriginsCookiesSub':
    'This tab has no http(s) frames — browser-internal pages carry no site cookies.',
  'panel.storage.empty.unavailableTitle': 'Storage unavailable',
  'panel.storage.empty.unavailableSub': 'The frame for {origin} can’t be read right now — it may have navigated away.',
  'panel.storage.thisOrigin': 'this origin',
  'panel.storage.empty.noItems': 'No items in {area} for {origin}.',
  'panel.storage.empty.noItemsMatch': 'No items match your filter.',
  'panel.storage.empty.cookiesUnavailableTitle': 'Cookies aren’t available here',
  'panel.storage.empty.cookiesUnavailableSub': 'This host doesn’t expose the browser cookie jar.',
  'panel.storage.empty.noCookies': 'No cookies for {origin}.',
  'panel.storage.empty.noCookiesMatch': 'No cookies match your filter.',
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
  'panel.storage.grid.aria': 'Storage entries',
  'panel.storage.grid.clipped': 'clipped ({length})',
  'panel.storage.grid.editTitle': 'Edit this entry',
  'panel.storage.grid.editAria': 'Edit {key}',
  'panel.storage.grid.deleteTitle': 'Delete this entry',
  'panel.storage.grid.deleteAria': 'Delete {key}',
  'panel.storage.grid.newKeyAria': 'New entry key',
  'panel.storage.grid.newValueAria': 'New entry value',
  'panel.storage.grid.keyAria': 'Entry key',
  'panel.storage.grid.valueAria': 'Entry value',
  'panel.storage.grid.addSaveHint': 'Write the new entry to storage',
  'panel.storage.grid.editSaveHint': 'Write the edited entry back to storage',
  'panel.storage.grid.emptyKeyHint': "The key can't be empty",
  'panel.storage.grid.cancelTitle': 'Cancel',
  'panel.storage.grid.cancelAddAria': 'Cancel add',
  'panel.storage.grid.cancelEditAria': 'Cancel edit',
  'panel.storage.grid.tooLarge': 'Too large to edit here — the full value exceeds the edit ceiling.',
  'panel.storage.grid.fetchFailed': 'The full value can’t be read right now.',
  'panel.storage.grid.loadingFullValue': 'Loading full value…',
  'panel.storage.save.label': 'Save',
  'panel.storage.save.noChanges': 'No changes to save',
  // Cookies section (jar grid rows).
  'panel.storage.cookieRow.notSentTitle': 'Not sent to this page — {reason}',
  'panel.storage.cookieRow.notSentAria': 'Cookie {name} is not sent to this page: {reason}',
  'panel.storage.cookieRow.partitionedUnder': 'Partitioned under {key}',
  'panel.storage.cookieRow.editTitle': 'Edit this cookie in the browser jar',
  'panel.storage.cookieRow.editAria': 'Edit cookie {name}',
  'panel.storage.cookieRow.deleteTitle': 'Delete this cookie from the browser jar',
  'panel.storage.cookieRow.deleteAria': 'Delete cookie {name}',
  // IndexedDB section.
  'panel.storage.idb.cantReadTitle': 'IndexedDB can’t be read',
  'panel.storage.idb.cantReadSub': 'This frame doesn’t expose its databases right now — it may have navigated away.',
  'panel.storage.idb.noDatabases': 'No IndexedDB databases for this origin.',
  'panel.storage.idb.versionTitle': 'Database version {version}',
  'panel.storage.idb.storeCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} store', other: '{count} stores' }),
  'panel.storage.idb.metaKeyPath': 'key: {path}',
  'panel.storage.idb.metaAutoIncrement': 'auto-increment keys',
  'panel.storage.idb.metaOutOfLine': 'out-of-line keys',
  'panel.storage.idb.indexCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} index', other: '{count} indexes' }),
  'panel.storage.idb.deleteDbTitle': 'Delete the {name} database',
  'panel.storage.idb.deleteDbConfirmTitle':
    'Deletes {name} and every store in it — a page holding it open blocks the delete',
  'panel.storage.idb.deleteDbAria': 'Delete database {name}',
  'panel.storage.idb.openStoreTitle': 'Open {database} › {store}',
  'panel.storage.idb.clearStoreTitle': 'Clear all records in {store}',
  'panel.storage.idb.clearStoreConfirmTitle': 'Deletes every record in {database} › {store}',
  'panel.storage.idb.clearStoreAria': 'Clear store {store}',
  'panel.storage.idb.noStores': 'no object stores',
  'panel.storage.idb.backTitle': 'Back to databases',
  'panel.storage.idb.cursorAria': 'Record cursor',
  'panel.storage.idb.cursorTitle': 'Read the store through one of its indexes — the key column becomes the index key',
  'panel.storage.idb.primaryKeyOption': 'primary key',
  'panel.storage.idb.indexOption': 'index: {name}',
  'panel.storage.idb.noRecords': 'No records in {store}.',
  'panel.storage.idb.noRecordsPage': 'No records in {store} on this page.',
  'panel.storage.idb.noRecordsMatch': 'No records match your filter.',
  'panel.storage.idb.gridAria': 'IndexedDB records',
  'panel.storage.idb.col.key': 'Key',
  'panel.storage.idb.col.value': 'Value',
  'panel.storage.idb.openRecordTitle': 'Open this record in the editor',
  'panel.storage.idb.keyCellTitle': 'Key: {key}\nPrimary key: {primaryKey}',
  'panel.storage.idb.deleteRecordTitle': 'Delete this record',
  'panel.storage.idb.deleteRecordAria': 'Delete record {key}',
  'panel.storage.pager.prevTitle': 'Previous page',
  'panel.storage.pager.nextTitle': 'Next page',
  'panel.storage.pager.page': 'page {page}',
  // Cache Storage section.
  'panel.storage.cache.cantReadTitle': 'Cache Storage can’t be read',
  'panel.storage.cache.cantReadSub':
    'The API only exists in secure contexts (https) — or this frame can’t be read right now.',
  'panel.storage.cache.noCaches': 'No caches for this origin.',
  'panel.storage.cache.noCachesMatch': 'No caches match your filter.',
  'panel.storage.cache.openTitle': 'Open the {name} cache',
  'panel.storage.cache.deleteTitle': 'Delete the {name} cache',
  'panel.storage.cache.deleteConfirmTitle': 'Deletes {name} and every entry in it',
  'panel.storage.cache.deleteAria': 'Delete cache {name}',
  'panel.storage.cache.backTitle': 'Back to caches',
  'panel.storage.cache.noEntries': 'No entries in {name}.',
  'panel.storage.cache.noEntriesPage': 'No entries in {name} on this page.',
  'panel.storage.cache.noEntriesMatch': 'No entries match your filter.',
  'panel.storage.cache.gridAria': 'Cache entries',
  'panel.storage.cache.col.request': 'Request',
  'panel.storage.cache.col.method': 'Method',
  'panel.storage.cache.col.size': 'Size',
  'panel.storage.cache.col.time': 'Time',
  'panel.storage.cache.deleteEntryTitle': 'Delete this entry',
  'panel.storage.cache.deleteEntryConfirmTitle': 'Deletes the stored response — click again to confirm',
  'panel.storage.cache.deleteEntryAria': 'Delete entry {url}',
  // Usage (quota) section.
  'panel.storage.quota.cantReadTitle': 'Usage can’t be read',
  'panel.storage.quota.cantReadSub':
    'The API only exists in secure contexts (https) — or this frame can’t be read right now.',
  'panel.storage.quota.used': '{size} used',
  'panel.storage.quota.ofTotal': 'of {size} ({percent}%)',
  'panel.storage.quota.type.serviceWorkers': 'Service workers',
  'panel.storage.quota.type.fileSystems': 'File systems',
  'panel.storage.quota.type.other': 'Other',
  'panel.storage.quota.noBreakdown': 'No per-type usage reported for this origin.',
  'panel.storage.quota.debugHint': 'Enable Debug mode to see the per-type breakdown.',
  'panel.storage.quota.sessionNote': 'Session storage is per-tab — this clears the inspected tab’s frame',
  'panel.storage.quota.targetsCaption': 'Clear everything targets',
  'panel.storage.quota.targetsTitle':
    'Clear everything (top right) deletes exactly the checked data types for this origin',
  'panel.storage.quota.simulateLabel': 'Simulate custom quota',
  'panel.storage.quota.simulateTitle':
    'Make the browser report and enforce a smaller quota for this origin — for testing how the page behaves when storage runs out',
  'panel.storage.quota.simulateSave': 'Save',
  'panel.storage.quota.simulateCancel': 'Cancel',
  'panel.storage.quota.simulateReset': 'Reset',
  'panel.storage.quota.simulateResetTitle': 'Remove the simulated quota',
  'panel.storage.quota.simulateRange': 'enter 0–{max} MB',
  'panel.storage.quota.simulateFailed': 'simulation failed',
  'panel.storage.quota.clearEverything': 'Clear everything',
  'panel.storage.quota.clearArmedTitle': 'Deletes the checked data types for this origin',
  'panel.storage.quota.clearTitle': 'Clear the checked data types for this origin',
  // Column (i) corpora — titles stay raw column nouns; kickers reuse
  // the nav keys; example payloads ride raw.
  'panel.storage.domCol.exampleCaption': 'Example write',
  'panel.storage.domCol.key.summary':
    "The entry's name — a case-sensitive string, unique within this origin's {area}. Writing an existing key overwrites its value.",
  'panel.storage.domCol.key.description':
    'Renaming an entry here writes the new key first, then removes the old one — a failed write never loses the original.',
  'panel.storage.domCol.value.summary':
    'The stored payload — always a string; pages keep structured data serialized, usually as JSON.',
  'panel.storage.domCol.value.description':
    'The grid shows a one-line preview and clips very long values — opening or editing an entry fetches the full text. Click a row to open it as an editor tab; double-click (or the pencil) edits inline.',
  'panel.storage.cookieCol.name.summary':
    'The cookie identifier. Browsers key on (name, domain, path) — the same name with a different scope is a separate cookie.',
  'panel.storage.cookieCol.name.description':
    'A warning triangle marks a site-jar cookie the browser would NOT attach to a request to the inspected page — hover it for the reason (path scoped elsewhere, Secure-only on http, subdomain scoped, …).',
  'panel.storage.cookieCol.value.summary': 'The cookie payload — what the browser sends back in the Cookie header.',
  'panel.storage.cookieCol.value.description':
    'Click a row to open the cookie as an editor tab with the full value and parsed views; the pencil edits inline.',
  'panel.storage.cookieCol.scope.summary':
    'Where the browser attaches this cookie — its Domain plus, when narrower than /, its Path.',
  'panel.storage.cookieCol.scope.description':
    'A domain-wide cookie (stored with a leading dot) flows to subdomains too; a host-only cookie is pinned to exactly its host. The path is a prefix — /api means only requests under /api carry it.',
  'panel.storage.cookieCol.expires.summary':
    'When the browser deletes the cookie, shown relative to now — hover for the absolute date.',
  'panel.storage.cookieCol.expires.description':
    'Session means no Expires / Max-Age — the browser drops the cookie when the session ends.',
  'panel.storage.cacheCol.exampleCaption': 'Example entry',
  // Fragment between the size and time tokens in the example card's
  // meta line ('1.2 kB · stored Jan 4 …').
  'panel.storage.cacheCol.exampleStored': '· stored',
  'panel.storage.cacheCol.request.summary': "The stored request's URL — the key the cache matches fetches against.",
  'panel.storage.cacheCol.request.description':
    'Hovering a row adds a bounded preview of the stored request headers. Click a row to open the stored response as an editor tab; the grid keeps metadata only.',
  'panel.storage.cacheCol.method.summary':
    "The stored request's HTTP method — part of the cache key alongside the URL.",
  'panel.storage.cacheCol.method.description': 'Almost always GET: the Cache API rejects put / add for other methods.',
  'panel.storage.cacheCol.size.summary': "The stored response's size, read from its content-length header.",
  'panel.storage.cacheCol.size.description':
    "An em dash means the stored response carries no content-length — the body is still there, in the entry's editor tab.",
  'panel.storage.cacheCol.time.summary': 'When the response was stored in the cache.',
  'panel.storage.cacheCol.time.description':
    "Only derivable on attached tabs — an em dash means the host couldn't read it for this scope.",
  'panel.storage.idbCol.exampleCaption': 'Example record',
  'panel.storage.idbCol.key.summary':
    "The record's key under the current cursor — the store's primary key by default; picking an index in the breadcrumb reads through it, and this column becomes the index key.",
  'panel.storage.idbCol.key.description':
    'Hovering a row shows both keys (cursor key and primary key). Keys can be numbers, strings, dates, or arrays of those.',
  'panel.storage.idbCol.value.summary':
    "A one-line preview of the record's structured-clone value, serialized in the page.",
  'panel.storage.idbCol.value.description':
    'Click a row to open the full record as an editor tab with the expandable tree; the grid keeps only the preview.',
  // Storage editor-tab documents. Shared doc chrome first (same control
  // across the four tabs); per-document copy keys separately even where
  // the English coincides (separate referents). Crumbs, status lines,
  // and localStorage/sessionStorage names stay raw.
  'panel.storage.doc.reveal': 'Reveal in Storage',
  'panel.storage.doc.refreshConfirm': 'Discards your edits — click again to refresh',
  'panel.storage.doc.discardEdits': 'Discard my edits',
  'panel.storage.doc.openMergeView': 'Open merge view',
  'panel.storage.doc.preview': 'Preview',
  'panel.storage.doc.source': 'Source',
  'panel.storage.doc.unavailableSub':
    'It may have been deleted, or the frame can’t be read right now — Refresh retries.',
  'panel.storage.doc.clippedSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { one: '… ({count} more character)', other: '… ({count} more characters)' }),
  // Cookie document.
  'panel.storage.doc.cookie.saveFailed.collision':
    'A cookie with that name, domain and path already exists — saving would overwrite it. Pick a different identity.',
  'panel.storage.doc.cookie.saveFailed.write': 'Save failed — the browser jar rejected the write.',
  'panel.storage.doc.cookie.saveFailed.remove':
    'The new cookie was written but the original couldn’t be removed — both exist. Refresh re-reads the jar.',
  'panel.storage.doc.cookie.saveHint': 'Write the edited cookie back to the browser jar',
  'panel.storage.doc.cookie.blockedHint': 'The form is incomplete or a reference doesn’t resolve',
  'panel.storage.doc.cookie.refreshTitle': 'Re-read the cookie',
  'panel.storage.doc.cookie.refreshAria': 'Refresh cookie',
  'panel.storage.doc.cookie.revealTitle': 'Open Cookies in the Storage tool window',
  'panel.storage.doc.cookie.readOnlyNote':
    'This host’s cookie jar is read-only — the document reflects the jar but can’t write back.',
  'panel.storage.doc.cookie.goneNote':
    'This cookie was deleted in the browser — your unsaved edits are kept. Save writes it back.',
  'panel.storage.doc.cookie.unavailableTitle': 'Cookie no longer in the jar',
  'panel.storage.doc.cookie.unavailableSub':
    'It may have been deleted or expired, or the jar can’t be read on this host — Refresh retries.',
  // DOM storage entry document.
  'panel.storage.doc.dom.saveFailed.collision':
    'An entry with that key already exists — saving would overwrite it. Pick a different key.',
  'panel.storage.doc.dom.saveFailed.gone': 'The entry can’t be reached — it may have been deleted. Refresh re-checks.',
  'panel.storage.doc.dom.saveFailed.quota':
    'Save failed — the storage quota was exceeded. The original entry is unchanged.',
  'panel.storage.doc.dom.saveFailed.write': 'Save failed — the write was rejected.',
  'panel.storage.doc.dom.modeAria': 'Entry view mode',
  'panel.storage.doc.dom.previewTitle': 'Collapsible tree over the parsed value',
  'panel.storage.doc.dom.previewNeedsJson': 'Preview needs a JSON value',
  'panel.storage.doc.dom.sourceTitle': 'Raw value view',
  'panel.storage.doc.dom.saveHint': 'Write the edited entry back to storage',
  'panel.storage.doc.dom.blockedHint': 'The key can’t be empty',
  'panel.storage.doc.dom.refreshTitle': 'Re-read the entry',
  'panel.storage.doc.dom.refreshAria': 'Refresh entry',
  'panel.storage.doc.dom.revealTitle': 'Open {area} in the Storage tool window',
  'panel.storage.doc.dom.keyLabel': 'Key',
  'panel.storage.doc.dom.keyAria': 'Entry key',
  'panel.storage.doc.dom.conflictNote': 'The value changed in the browser while you were editing.',
  'panel.storage.doc.dom.mergeToast': 'Merge applied to the draft — Save writes it to the browser',
  'panel.storage.doc.dom.goneNote':
    'This entry was deleted in the browser — your unsaved edits are kept. Save writes it back.',
  'panel.storage.doc.dom.unavailableTitle': 'Entry no longer available',
  'panel.storage.doc.dom.tooLargeTitle': 'Too large to open',
  'panel.storage.doc.dom.tooLargeSub': 'The value is past the editor’s ceiling and stays read-only.',
  'panel.storage.doc.dom.previewAria': 'Entry value tree',
  // IndexedDB record document.
  'panel.storage.doc.idb.saveFailed.parse': 'Not valid JSON — fix the syntax and save again.',
  'panel.storage.doc.idb.saveFailed.keyChanged':
    'The key changed — saving would create a new record. Restore the original key.',
  'panel.storage.doc.idb.saveFailed.gone': 'The record can’t be reached — it may have been deleted. Refresh re-checks.',
  'panel.storage.doc.idb.saveFailed.write': 'Save failed — the write was rejected.',
  'panel.storage.doc.idb.modeAria': 'Record view mode',
  'panel.storage.doc.idb.previewTitle': 'Collapsible tree over the record value',
  'panel.storage.doc.idb.previewNeedsDoc': 'Preview needs a well-formed document',
  'panel.storage.doc.idb.sourceTitle': 'Full-document source view',
  'panel.storage.doc.idb.saveHint': 'Write the edited value back to the record',
  'panel.storage.doc.idb.refreshTitle': 'Re-read the record',
  'panel.storage.doc.idb.refreshAria': 'Refresh record',
  'panel.storage.doc.idb.revealTitle': 'Open {database} › {store} in the Storage tool window',
  'panel.storage.doc.idb.truncatedNote': 'Truncated at the size cap — read-only.',
  'panel.storage.doc.idb.nonJsonNote':
    'Contains non-JSON types (Date, Map, binary, …) — shown as a read-only rendering.',
  'panel.storage.doc.idb.conflictNote': 'The record changed in the browser while you were editing.',
  'panel.storage.doc.idb.mergeToast': 'Merge applied to the draft — Save writes it to the record',
  'panel.storage.doc.idb.goneNote':
    'This record was deleted or changed shape in the browser — your unsaved edits are kept. Save writes them back.',
  'panel.storage.doc.idb.unavailableTitle': 'Record no longer available',
  'panel.storage.doc.idb.previewAria': 'Record value tree',
  // Cache Storage entry document (read-only; delete is the only mutation).
  'panel.storage.doc.cache.deleteTitle': 'Delete this entry from the cache',
  'panel.storage.doc.cache.deleteConfirmTitle': 'Deletes the stored response — click again to confirm',
  'panel.storage.doc.cache.deleteAria': 'Delete cache entry',
  'panel.storage.doc.cache.refreshTitle': 'Re-read the stored response',
  'panel.storage.doc.cache.refreshAria': 'Refresh cache entry',
  'panel.storage.doc.cache.revealTitle': 'Open the {cache} cache in the Storage tool window',
  'panel.storage.doc.cache.deleteFailed': 'Delete failed — the entry may already be gone.',
  'panel.storage.doc.cache.unavailableTitle': 'Cache entry no longer available',
  'panel.storage.doc.cache.truncatedNote': 'Body truncated at the size cap — {size} stored.',
  'panel.storage.doc.cache.headersSummary': 'Response headers ({count})',
  'panel.storage.doc.cache.filterPlaceholder': 'Filter headers',
  'panel.storage.doc.cache.filterAria': 'Filter response headers',
  'panel.storage.doc.cache.noHeaders': 'No headers stored.',
  'panel.storage.doc.cache.noHeadersMatch': 'No headers match your filter.',
  'panel.storage.doc.cache.bodySummary': 'Response body',
  'panel.storage.doc.cache.imageAria': 'Stored image body',
  'panel.storage.doc.cache.imageAlt': 'Stored response body for {url}',
  'panel.storage.doc.cache.binaryBody': 'Binary body — {size} stored.',
  'panel.storage.doc.cache.emptyBody': 'Empty body.',

  // ── Rule-value editor-tab document (ValueDocumentTab) ──────────────
  // The crumb's rule/header names ride raw as data; 'Rules' is its
  // fallback when the rule is gone.
  'panel.valueDoc.crumbFallback': 'Rules',
  'panel.valueDoc.saveHint': 'Re-encode the edited value and write it back to the rule',
  'panel.valueDoc.blockedHintInvalid': 'The edited text can’t encode for this value type',
  'panel.valueDoc.blockedHintDetached': 'The rule field this value belonged to is gone',
  'panel.valueDoc.rereadTitle': 'Re-read the value from the rule',
  'panel.valueDoc.rereadConfirm': 'Discards your edits — click again to re-read',
  'panel.valueDoc.rereadAria': 'Discard edits and re-read value',
  'panel.valueDoc.openRuleTitle': 'Open this rule in the workspace editor',
  'panel.valueDoc.openRule': 'Open rule in workspace',
  'panel.valueDoc.driftNote':
    'The value changed in the rule while you were editing — your unsaved edits are kept. Save overwrites it.',
  'panel.valueDoc.undetectedNote':
    'The field no longer holds a value this editor can encode — your unsaved edits are kept for copy-out.',
  'panel.valueDoc.detachedNote':
    'The rule field this value belonged to is gone — your unsaved edits are kept for copy-out.',
  'panel.valueDoc.discardEdits': 'Discard my edits',
  'panel.valueDoc.saveFailed.detached':
    'The modification this value belonged to is gone from the rule — there is nothing to write to.',
  'panel.valueDoc.saveFailed.notFound': 'Rule not found — it may have been deleted.',
  'panel.valueDoc.saveFailed.write': 'Save failed — the rule rejected the write.',
  'panel.valueDoc.encodedPreview': 'Encoded preview',
  'panel.valueDoc.cannotEncode': 'Cannot encode — the edited value is not valid for this type',
  'panel.valueDoc.undetectedTitle': 'No longer an encoded value',
  'panel.valueDoc.undetectedSub':
    'The field’s current value doesn’t match a decoder — edit it in the rule editor instead.',
  'panel.valueDoc.detachedTitle': 'Value no longer in the rule',
  'panel.valueDoc.detachedSub':
    'The rule or the modification holding this value was deleted, or the operation no longer carries a value.',

  // ── Value expander (headers / cookies detail readout) ──────────────
  // JWT part and claim names (Header / Payload / Signature / iat / nbf
  // / exp) are spec vocabulary and stay raw via the glossary.
  'panel.valueExpander.decoded': 'Decoded',
  'panel.valueExpander.raw': 'Raw',
} as const satisfies Catalog;
