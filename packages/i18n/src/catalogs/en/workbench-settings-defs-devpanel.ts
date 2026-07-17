/**
 * Workbench settings — the setting-definition corpus for the DevTools
 * panel categories (network / layout / headers / cookies / timing /
 * initiator / …). Parity vocabulary named inside values (column
 * names, rung names) rides raw per the S34 lock.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsDevpanel = {
  // ── DevTools Panel · Layout category defs ──────────────────────────
  'workbench.settings.def.devpanelLayout.footerShowVersion.label': 'Show Version in Footer',
  'workbench.settings.def.devpanelLayout.footerShowVersion.description':
    'Display the extension version number in the DevTools panel status bar.',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label': 'Show Theme Switcher in Footer',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description':
    'Display the light/dark/auto theme dropdown in the DevTools panel status bar.',
  'workbench.settings.def.devpanelLayout.footerShowModified.label': 'Show Modified Count in Footer',
  'workbench.settings.def.devpanelLayout.footerShowModified.description':
    'Display how many requests your rules actually modified in the DevTools panel status bar.',
  'workbench.settings.def.devpanelLayout.footerShowFailed.label': 'Show Failed Count in Footer',
  'workbench.settings.def.devpanelLayout.footerShowFailed.description':
    'Display how many requests failed or returned an error status in the DevTools panel status bar.',
  'workbench.settings.def.devpanelLayout.footerShowCached.label': 'Show Cached Count in Footer',
  'workbench.settings.def.devpanelLayout.footerShowCached.description':
    'Display how many requests were served from cache in the DevTools panel status bar.',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.label': 'Show Current Page in Footer',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.description':
    'Label the timing milestones with the page they describe in the DevTools panel status bar — useful with Preserve log across multiple navigations.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.label': 'Footer Timing Scope',
  'workbench.settings.def.devpanelLayout.footerTimingMode.description':
    'Which navigation the Finish / DOMContentLoaded / Load milestones in the DevTools panel status bar describe. Aggregate spans the whole preserve-log timeline from the first navigation (matches the browser); Current page reports only the latest navigation.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label': 'Aggregate (all navigations)',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description':
    'Finish / DCL / Load span the whole timeline from the first navigation — the browser default.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label': 'Current page only',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description':
    'Finish / DCL / Load report only the latest navigation, anchored to when it started.',
  'workbench.settings.def.devpanelLayout.footerScope.label': 'Footer Summary Scope',
  'workbench.settings.def.devpanelLayout.footerScope.description':
    'What the DevTools panel status bar summarizes. Focused tool follows the tool window you are working in (Storage, Console, and Search get their own summary lines); Network tool only always shows the Network figures.',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.label': 'Focused tool',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.description':
    'The footer follows the focused tool window — Storage, Console, and Search show their own summaries; other tools fall back to the Network line.',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.label': 'Network tool only',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.description':
    'The footer always shows the Network figures, whichever tool window has focus.',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label': 'Show Panel Toggles in Top Bar',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description':
    'Display the left / bottom / right panel toggle icons in the DevTools panel top bar.',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label': 'Show Layout Menu in Top Bar',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description':
    'Display the layout dropdown (bottom full-width, tool-window labels, sidebar layout) in the DevTools panel top bar.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label': 'Bottom Panel Alignment',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description':
    'Where the bottom panel sits in the DevTools panel. Left/right aligns it under one sidebar + the editor; center nests it inside the middle column; justify spans the full width.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label': 'Center',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description':
    'Bottom panel nested inside the middle column',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label': 'Left',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description':
    'Bottom spans left sidebar + editor',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label': 'Right',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description':
    'Bottom spans editor + right sidebar',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label': 'Justify',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description':
    'Bottom spans the full DevTools panel width',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.label': 'Show Tool Window Labels',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.description':
    'Render text labels next to activity-bar and dock-tab icons in the DevTools panel. Disabled by default because the panel is narrower than the workspace.',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label': 'Left Activity Bar Width',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description':
    'Width of the left activity bar in the DevTools panel when tool-window labels are visible. Locked to 36px in icon-only mode.',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.label': 'Right Activity Bar Width',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.description':
    'Width of the right activity bar in the DevTools panel when tool-window labels are visible. Locked to 36px in icon-only mode.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.label': 'Activity Bar Layout',
  'workbench.settings.def.devpanelLayout.sidebarLayout.description':
    'How the activity-bar splits the top and bottom tool-window groups in the DevTools panel.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label': 'Proportional',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description':
    'Top and bottom groups split the activity bar 50/50',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label': 'Compact',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description':
    'Top group sizes to content; bottom pinned to bottom',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label': 'Stacked',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description':
    'All groups clustered at the top with dividers between',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label': 'Dynamic',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description':
    'Chip groups mirror their adjacent panel heights. Closed docks collapse to content and live neighbors absorb the space.',

  // ── DevTools Panel · Network category defs ─────────────────────────
  'workbench.settings.def.devpanelNetwork.layout.label': 'Network Layout',
  'workbench.settings.def.devpanelNetwork.layout.description':
    'How the Network table absorbs horizontal space. Compact lets stretchy columns (Name, Waterfall) flex to fit the panel width so the table never scrolls horizontally; Wide caps those columns and scrolls horizontally for the rest.',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.label': 'Compact',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.description': 'Stretchy columns absorb panel width.',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.label': 'Wide',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.description':
    'Capped widths, scrolls horizontally when needed.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.label': 'Messages Layout',
  'workbench.settings.def.devpanelNetwork.messagesLayout.description':
    'How the Messages frame grid absorbs horizontal space. Compact lets the Data column flex to fit the pane width so the grid never scrolls horizontally; Wide caps it and scrolls horizontally when needed.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label': 'Compact',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description':
    'The Data column absorbs the pane width.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label': 'Wide',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description':
    'Capped widths, scrolls horizontally when needed.',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.label': 'Show Payload Preview',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.description':
    'Show the payload preview pane under the Messages / EventStream grids — the resizable split where the selected frame or event renders as a JSON tree, raw text, or binary viewer. Turn off to give the grid the whole pane.',
  'workbench.settings.def.devpanelNetwork.sortKind.label': 'Network Sort Source',
  'workbench.settings.def.devpanelNetwork.sortKind.description':
    'Which side of the sort state is active. `mode` runs one of the named compound sort modes (Failures first / Slowest first / …). `column` runs the single-column sort the user picked by clicking a column header. The panel switches automatically — clicking a column header sets this to `column`; picking a mode in the View menu sets it to `mode`.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label': 'Mode',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description': 'Use a named compound sort mode.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.label': 'Column',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.description':
    'Use the single-column sort the user clicked.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label': 'Custom (nested)',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description':
    'Use the user-built multi-key sort chain.',
  'workbench.settings.def.devpanelNetwork.sortMode.label': 'Network Sort Mode',
  'workbench.settings.def.devpanelNetwork.sortMode.description':
    'Named compound sort order — primary axis then arrival as tiebreak. Active when sort source = `mode`.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label': 'Failures first',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description':
    'Failed → pending → redirected → success.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label': 'Slowest first',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description': 'Longest duration first.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label': 'Largest first',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description': 'Biggest wire bytes first.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label': 'Browser priority',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description':
    'Highest → Lowest reported priority.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label': 'By resource type',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description':
    'Grouped by resource type, arrival within.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label': 'By domain',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description': 'Grouped by hostname, arrival within.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label': 'Rule-modified first',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description':
    'Applied rules first, arrival within.',
  'workbench.settings.def.devpanelNetwork.sortBy.label': 'Network Sort By',
  'workbench.settings.def.devpanelNetwork.sortBy.description':
    'Which column drives the column-click sort. Active when sort source = `column`. Clicking a column header updates this value.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label': 'Waterfall',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description':
    'Timeline by the active Waterfall metric (start time by default).',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label': 'Request #',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description':
    'Request number — the order requests were discovered.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.label': 'Method',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.description': 'HTTP method.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.label': 'Name',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.description': 'Final segment of the URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.label': 'Path',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.description': 'Pathname + query.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.label': 'URL',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.description': 'Full URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.label': 'Status',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.description': 'Response status code.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label': 'Protocol',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description': 'HTTP version.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label': 'Scheme',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description': 'http / https.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label': 'Domain',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description': 'Host portion of the URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label': 'Remote address',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description': 'Server IP.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.label': 'Type',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.description': 'Resource type.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label': 'Initiator',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description': 'What triggered the request.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label': 'Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description': 'Request-cookie count.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label': 'Set Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description': 'Response Set-Cookie count.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.label': 'Size',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.description': 'Wire bytes.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.label': 'Time',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.description': 'Total request duration.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label': 'Priority',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description': 'Browser-assigned priority.',
  'workbench.settings.def.devpanelNetwork.sortDir.label': 'Network Sort Direction',
  'workbench.settings.def.devpanelNetwork.sortDir.description':
    'Ascending or descending order for the current Network sort column.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label': 'Ascending',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description': 'Lowest first.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label': 'Descending',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description': 'Highest first.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.label': 'Waterfall Metric',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.description':
    'Which time the Waterfall column sorts and draws by. Start / Response / End time place bars on an absolute timeline; Total duration and Latency zero-align the bars so lengths compare directly.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label': 'Start time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description': 'When the request started.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label': 'Response time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description':
    'When the first response byte arrived.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label': 'End time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description': 'When the request finished.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label': 'Total duration',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description':
    'How long the request took end to end.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label': 'Latency',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description':
    'Time to the first response byte.',
  'workbench.settings.def.devpanelNetwork.showFireDots.label': 'Show Rule-fire Dots',
  'workbench.settings.def.devpanelNetwork.showFireDots.description':
    'Show the leading 14px column carrying the colored dot that marks rule matches (filled = a rule actually applied, hollow = inferred). Turn off to reclaim the horizontal pixels on dense panes.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.label': 'Waterfall Values',
  'workbench.settings.def.devpanelNetwork.waterfallValues.description':
    'When to print the active Waterfall metric’s value(s) on the bar — the Start / Response / End time chip for the timeline metrics, or the waiting / download labels for Total duration and Latency.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label': 'Always',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description': 'Keep the value chip visible.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label': 'On hover',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description':
    'Reveal the value chip on row hover.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label': 'Off',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description': 'Hide the value chip.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label': 'Waterfall Value Format',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description':
    'How a timeline metric’s value reads: Relative is the offset from the first request in view; Timestamp is the absolute wall-clock instant. Total duration and Latency are always durations regardless.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label': 'Relative',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description':
    'Offset from the first request in view.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label': 'Timestamp',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description':
    'Absolute wall-clock instant.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label': 'Waterfall Timestamp Timezone',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description':
    'Timezone for the Timestamp value format — local time or UTC.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label': 'Local',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description': 'Your local timezone.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label': 'UTC',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description': 'Coordinated Universal Time.',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label': 'Explain Waterfall Value',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description':
    'In the Waterfall hover popover, badge and highlight the phase rows that make up the total and show their sum as a formula. Purely a visual aid — it changes no values.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label': 'Waterfall Popover Layout',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description':
    'Orientation of the Waterfall hover timing breakdown. Compact stacks the steps down the popover; Wide lays the same ladder on a time axis; Auto picks by panel width — wide on a bottom-docked panel, compact on a narrow (side-docked) one.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label': 'Compact',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description':
    'Steps stacked down the popover.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label': 'Wide',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description':
    'Steps laid on a horizontal time axis.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label': 'Auto',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description':
    'Wide when the panel is wide, else compact.',

  // ── DevTools Panel · Headers category defs ─────────────────────────
  'workbench.settings.def.devpanelHeaders.layout.label': 'Headers Layout',
  'workbench.settings.def.devpanelHeaders.layout.description':
    'How header rows are organised inside Request/Response sections. Grouped buckets rows by category (Auth, CORS, Caching, …); Flat renders one list in the chosen sort order.',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.label': 'Grouped',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.description': 'Rows bucketed by category.',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.label': 'Flat',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.description':
    'Single list, no category headings (Chrome-style).',
  'workbench.settings.def.devpanelHeaders.sortMode.label': 'Headers Sort',
  'workbench.settings.def.devpanelHeaders.sortMode.description':
    'Row ordering within each list (and within each group, when grouped). Original preserves the order the server sent the headers (HAR order); A → Z sorts by name; Rule-modified first floats rule-modified rows to the top.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.description': 'HAR order.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.az.description': 'Alphabetical.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label': 'Rule-modified first',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description': 'Rule-modified rows on top.',
  'workbench.settings.def.devpanelHeaders.nameCase.label': 'Header Name Case',
  'workbench.settings.def.devpanelHeaders.nameCase.description':
    'How header names are displayed. Train-Case canonicalises every name (`Content-Type`, `Set-Cookie`, `ETag`) to match Chrome/Firefox DevTools — easier to scan. Original keeps the raw casing the server sent (HTTP/2+ lowercases everything on the wire).',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.description':
    'Exactly what the server sent (often lowercase on HTTP/2+).',
  'workbench.settings.def.devpanelHeaders.showChips.label': 'Show Value Tags',
  'workbench.settings.def.devpanelHeaders.showChips.description':
    'Show the per-value tags on header rows (Cache-Control / Set-Cookie / HSTS / JWT decode, …). Turn off for a tight, value-only view.',
  'workbench.settings.def.devpanelHeaders.showInsights.label': 'Show Suggestions',
  'workbench.settings.def.devpanelHeaders.showInsights.description':
    'Display the actionable warning cards at the top of the Headers tab (CORS misconfigs, missing CSP/HSTS, insecure cookies, expired JWT, …).',
  'workbench.settings.def.devpanelHeaders.hideNoise.label': 'Hide Noise Headers',
  'workbench.settings.def.devpanelHeaders.hideNoise.description':
    'Fold low-signal headers (Accept-*, Sec-Fetch-*, Sec-CH-UA-*, User-Agent, Connection, …). The hint below each section lists the hidden names on hover.',
  'workbench.settings.def.devpanelHeaders.ruleOnly.label': 'Rule-modified Only',
  'workbench.settings.def.devpanelHeaders.ruleOnly.description':
    'Show only headers added, modified, or removed by an Open Headers rule.',
  'workbench.settings.def.devpanelHeaders.securityOnly.label': 'Security Headers Only',
  'workbench.settings.def.devpanelHeaders.securityOnly.description':
    'Show only security-related headers (CSP, HSTS, X-Frame-Options, Permissions-Policy, …).',
  'workbench.settings.def.devpanelHeaders.overridableOnly.label': 'Overridable Headers Only',
  'workbench.settings.def.devpanelHeaders.overridableOnly.description':
    'Hide protected headers the browser will not let rules override (host, content-length, sec-ch-ua, …).',

  // ── DevTools Panel · Initiator category defs ───────────────────────
  'workbench.settings.def.devpanelInitiator.sortMode.label': 'Initiator Children Sort',
  'workbench.settings.def.devpanelInitiator.sortMode.description':
    'How child requests are ordered inside the initiator chain. Initiator order preserves the original initiator-graph traversal; Chronological orders by request time; Largest subtree puts the heaviest subtree first.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label': 'Initiator order',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description': 'As discovered.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label': 'Chronological',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description': 'By request time.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label': 'Largest subtree',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description': 'Heaviest subtrees first.',
  'workbench.settings.def.devpanelInitiator.showInsights.label': 'Show Suggestions',
  'workbench.settings.def.devpanelInitiator.showInsights.description':
    'Display the actionable callouts at the top of the Initiator tab (failed subrequests, dominant host, third-party share, …).',
  'workbench.settings.def.devpanelInitiator.failuresOnly.label': 'Failures Only',
  'workbench.settings.def.devpanelInitiator.failuresOnly.description':
    'Show only failed or blocked rows in the initiator chain.',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label': '3rd-party Only',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description':
    'Show only rows from origins different than the page origin.',

  // ── DevTools Panel · Cookies category defs ─────────────────────────
  'workbench.settings.def.devpanelCookies.sortMode.label': 'Cookies Sort',
  'workbench.settings.def.devpanelCookies.sortMode.description':
    'Row ordering inside each cookies section. Original preserves the order the server / request used; A → Z sorts by name; Size sorts by serialized cookie size; Expires sorts soonest-expiring first (Session last).',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.description': 'As sent / set.',
  'workbench.settings.def.devpanelCookies.sortMode.option.az.description': 'Alphabetical by name.',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.label': 'Size',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.description': 'Largest cookie first.',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.label': 'Expires',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.description': 'Soonest expiry first.',
  'workbench.settings.def.devpanelCookies.expiresFormat.label': 'Expires Format',
  'workbench.settings.def.devpanelCookies.expiresFormat.description':
    'How cookie expiry is rendered. Relative shows "in 2d", "30s ago", "Session"; Absolute shows the parsed UTC date.',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label': 'Relative',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label': 'Absolute',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description': 'UTC date.',
  'workbench.settings.def.devpanelCookies.showChips.label': 'Show Tags',
  'workbench.settings.def.devpanelCookies.showChips.description':
    'Show the role / lifecycle / context tags next to each cookie name (auth? / tracking? / pref / just set / dropped / 3rd-party / partitioned / …). Turn off for a tight, columns-only view.',
  'workbench.settings.def.devpanelCookies.showInsights.label': 'Show Suggestions',
  'workbench.settings.def.devpanelCookies.showInsights.description':
    'Display the actionable warning cards at the top of the Cookies tab (SameSite=None without Secure, __Host- / __Secure- prefix violations, oversized cookies, expired-but-sent, …).',
  'workbench.settings.def.devpanelCookies.decodeValues.label': 'Decode URL-encoded Values',
  'workbench.settings.def.devpanelCookies.decodeValues.description':
    'Show cookie values with percent-encoding decoded ("Europe%2FMadrid" → "Europe/Madrid"). Hover the value to see the raw form.',
  'workbench.settings.def.devpanelCookies.groupByRole.label': 'Group by Role',
  'workbench.settings.def.devpanelCookies.groupByRole.description':
    'Group cookies by their inferred role inside each section — Auth & session first, then Functional, Preferences, Analytics & tracking. Heuristic-driven; the role chips (auth? / tracking? / pref) carry the question mark as a reminder.',
  'workbench.settings.def.devpanelCookies.showFilteredOut.label': 'Show Filtered-out Request Cookies',
  'workbench.settings.def.devpanelCookies.showFilteredOut.description':
    'Mirror Chrome\'s "show filtered out request cookies" toggle — also list jar cookies that were not sent on this request because of path / Secure / SameSite / expiry mismatch.',
  'workbench.settings.def.devpanelCookies.problemsOnly.label': 'Problems Only',
  'workbench.settings.def.devpanelCookies.problemsOnly.description':
    'Show only cookies that triggered a warning — missing Secure, prefix violation, expired-but-sent, …',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.label': '3rd-party Only',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.description':
    'Show only cookies whose domain is cross-site to the top-frame origin.',
  'workbench.settings.def.devpanelCookies.ruleOnly.label': 'Rule-modified Only',
  'workbench.settings.def.devpanelCookies.ruleOnly.description':
    'Show only cookies whose Cookie / Set-Cookie line was added, modified, or removed by a rule.',

  // ── DevTools Panel · Timing category defs ──────────────────────────
  'workbench.settings.def.devpanelTiming.showInsights.label': 'Show Suggestions',
  'workbench.settings.def.devpanelTiming.showInsights.description':
    'Display the bottleneck + per-phase warning cards at the top of the Timing tab. Turn off for a numbers-only view.',
  'workbench.settings.def.devpanelTiming.showContextStrip.label': 'Show Context Strip',
  'workbench.settings.def.devpanelTiming.showContextStrip.description':
    'Show the protocol / connection / cache / priority / started / server-IP chip row above the phase breakdown.',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.label': 'Show Phase Breakdown',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.description':
    'Show the Resource Scheduling / Connection Start / Request-Response sections with per-phase millisecond rows.',
  'workbench.settings.def.devpanelTiming.showTimingBar.label': 'Show Timing Bar',
  'workbench.settings.def.devpanelTiming.showTimingBar.description':
    'Show the proportional segmented bar with the per-phase legend (and the Total row beneath it).',
  'workbench.settings.def.devpanelTiming.showServerTiming.label': 'Show Server-Timing',
  'workbench.settings.def.devpanelTiming.showServerTiming.description':
    'Show the parsed `Server-Timing` response-header metrics when the server sent any.',
  'workbench.settings.def.devpanelTiming.showRepeats.label': 'Show Repeats in Session',
  'workbench.settings.def.devpanelTiming.showRepeats.description':
    'Show the comparison against the fastest / median / slowest hit of this same URL within the current panel session.',
  'workbench.settings.def.devpanelTiming.showTransferRate.label': 'Show Transfer Rate',
  'workbench.settings.def.devpanelTiming.showTransferRate.description':
    'Show the effective Content-Download throughput (body bytes ÷ download time) when both the size and the receive leg are known.',
} as const satisfies Catalog;
