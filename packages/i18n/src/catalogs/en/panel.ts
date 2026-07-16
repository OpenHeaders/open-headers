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
} as const satisfies Catalog;
