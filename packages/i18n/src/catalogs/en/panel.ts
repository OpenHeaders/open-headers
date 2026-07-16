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
  'panel.quickEditor.toast.folderCreateFailed':
    'Couldn’t create the “{name}” folder — saving at the collection root.',
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
} as const satisfies Catalog;
