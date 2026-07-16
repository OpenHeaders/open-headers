/**
 * Popup namespace — extension popup / side panel surface (Phase B).
 * Technical-plane vocabulary (header names, methods, resource-type
 * parity labels, TSV export headers, key caps) stays literal in the
 * components per the plan's English boundary.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const popup = {
  // ── Header ─────────────────────────────────────────────────────────
  'popup.header.switchFailed': 'Could not switch view',
  'popup.header.switchToSidePanel': 'Switch to side panel (stays open as you browse)',
  'popup.header.switchToPopup': 'Switch to popup mode (toolbar click)',
  'popup.header.rulesResumed': 'Rules execution resumed',
  'popup.header.rulesPaused': 'Rules execution paused',
  'popup.header.rulesLabel': 'Rules',
  'popup.header.resumeRules': 'Resume rules execution',
  'popup.header.pauseRules': 'Pause all rules (preserves individual rule settings)',
  'popup.header.openSettings': 'Open settings',
  'popup.header.notifications': 'Notifications',
  'popup.header.openNotifications': 'Open notifications',
  'popup.header.activeWorkspace': 'Active workspace: {name}',

  // ── Shared status vocabulary ───────────────────────────────────────
  'popup.status.active': 'Active',
  'popup.status.paused': 'Paused',

  // ── Footer ─────────────────────────────────────────────────────────
  'popup.footer.debugTooltip': 'How to reach our super-charged browser dev-tools.',
  'popup.footer.networkDebug': 'Network Debug.',
  'popup.footer.tagline': 'Like it should be',
  'popup.footer.keyboardShortcuts': 'Keyboard shortcuts',
  'popup.footer.systemStatus': 'System status',

  // ── Tabs ───────────────────────────────────────────────────────────
  'popup.tabs.thisPage': 'This Page',
  'popup.tabs.allRules': 'All Rules',
  'popup.tabs.collections': 'Collections',
  'popup.tabs.openWorkspaceEditor': 'Open full workspace editor',
  'popup.tabs.workspace': 'Workspace',

  // ── Delete confirmation overlay ────────────────────────────────────
  'popup.deleteConfirm.title': 'Delete "{name}"?',
  'popup.deleteConfirm.confirm': 'confirm',
  'popup.deleteConfirm.cancel': 'cancel',

  // ── Table toolbars (shared across the three tabs) ──────────────────
  'popup.table.searchPlaceholder': 'Search anything...',
  'popup.table.sortOrder': 'Sort order',
  'popup.table.sortOrderHeading': 'SORT ORDER',
  'popup.table.sortByStatus': 'By status',
  'popup.table.sortByPriority': 'By priority',
  'popup.table.sortByColumn': 'By column',
  'popup.table.sortWorkspaceOrder': 'Workspace order',
  'popup.table.sortWorkspaceOrderHint': 'Matches the workspace sidebar tree order',
  'popup.table.sortByColumnHint': 'Sorted by {column} — click an option above to reset',
  'popup.table.sortByPriorityHint': 'Block → Redirect → Query → Header → Inject · A-Z within each',
  'popup.table.sortByStatusHintAll': 'Active → Paused → Disabled → Draft · priority within each',
  'popup.table.sortByStatusHintThisPage': 'Active → Paused → Disabled · priority within each',
  'popup.table.sortByStatusHintCollections': 'Active → Paused · A-Z within each',
  'popup.table.columnName': 'Name',
  'popup.table.columnDetails': 'Details',
  'popup.table.columnConditions': 'Conditions',

  // ── Rule mutations ─────────────────────────────────────────────────
  'popup.rule.toggleFailed': 'Failed to toggle rule',
  'popup.rule.deleted': 'Rule deleted',
  'popup.rule.deleteFailed': 'Failed to delete rule',
  'popup.rule.edit': 'Edit rule',
  'popup.rule.delete': 'Delete rule',
  'popup.rule.deleteOk': 'Delete',
  'popup.rule.notConnected': 'App not connected',
  'popup.rule.desktopTag': 'Desktop',
  'popup.rule.comingSoon': 'coming soon',

  // ── All Rules tab ──────────────────────────────────────────────────
  'popup.rules.title': 'Rules',
  'popup.rules.activeSummary': '{active} of {total} active',
  'popup.rules.draftSuffix': ', {count} draft',
  'popup.rules.pausedByCollection': '{count} paused by collection',
  'popup.rules.addRule': 'Add Rule',
  'popup.rules.addRuleTooltip': 'Add a rule — search across types and templates',
  'popup.rules.matchedCount': ({ matched, total }, locale) =>
    `${matched} of ${plural(locale, Number(total), { one: '{count} rule', other: '{count} rules' })} matched`,
  'popup.rules.emptyNoMatch': 'No matching rules found',
  'popup.rules.emptyNone': 'No rules yet',
  'popup.rules.emptyHint': 'Click "Add Rule" to modify live browser requests',

  // ── Collections tab ────────────────────────────────────────────────
  'popup.collections.title': 'Collections',
  'popup.collections.summary': ({ collections, rules }, locale) =>
    `${plural(locale, Number(collections), { one: '{count} collection', other: '{count} collections' })}, ${plural(
      locale,
      Number(rules),
      { one: '{count} rule', other: '{count} rules' },
    )}`,
  'popup.collections.matchedCount': ({ matched, total }, locale) =>
    `${matched} of ${plural(locale, Number(total), { one: '{count} collection', other: '{count} collections' })} matched`,
  'popup.collections.emptyNoMatch': 'No matching collections found',
  'popup.collections.emptyNone': 'No collections',
  'popup.collections.emptyHint': 'Create rules in the workspace editor to organize them into collections',
  'popup.collections.enabledSummary': ({ enabled, total }, locale) =>
    `${enabled} of ${plural(locale, Number(total), { one: '{count} rule', other: '{count} rules' })} enabled`,
  'popup.collections.pausedEnabledSummary': 'Paused · {enabled} of {total} enabled',
  'popup.collections.resumeTooltip': 'Resume — pin {count} rules active (overrides parent if needed)',
  'popup.collections.pauseTooltip': 'Pause — suspend {count} rules without changing individual settings',

  // ── Condition vocabulary (rule condition field labels) ─────────────
  'popup.conditions.allDomains': 'All domains',
  'popup.conditions.none': 'No conditions',
  'popup.conditions.short.urlFilter': 'URL',
  'popup.conditions.short.urlRegex': 'Regex',
  'popup.conditions.short.requestDomains': 'Domain',
  'popup.conditions.short.excludeRequestDomains': 'Excl Domain',
  'popup.conditions.short.initiatorDomains': 'From',
  'popup.conditions.short.excludeInitiatorDomains': 'Excl From',
  'popup.conditions.short.requestMethods': 'Method',
  'popup.conditions.short.excludeRequestMethods': 'Excl Method',
  'popup.conditions.short.resourceTypes': 'Resource',
  'popup.conditions.short.excludeResourceTypes': 'Excl Resource',
  'popup.conditions.short.domainType': 'Domain Type',
  'popup.conditions.short.responseHeader': 'Resp Hdr',
  'popup.conditions.short.excludeResponseHeader': 'Excl Resp Hdr',
  'popup.conditions.full.urlFilter': 'URL Pattern',
  'popup.conditions.full.urlRegex': 'URL Regex',
  'popup.conditions.full.requestDomains': 'Domains',
  'popup.conditions.full.excludeRequestDomains': 'Excl Domains',
  'popup.conditions.full.initiatorDomains': 'Initiator',
  'popup.conditions.full.excludeInitiatorDomains': 'Excl Initiator',
  'popup.conditions.full.requestMethods': 'Methods',
  'popup.conditions.full.excludeRequestMethods': 'Excl Methods',
  'popup.conditions.full.resourceTypes': 'Resources',
  'popup.conditions.full.excludeResourceTypes': 'Excl Resources',
  'popup.conditions.full.domainType': 'Domain Type',
  'popup.conditions.full.responseHeader': 'Resp Header',
  'popup.conditions.full.excludeResponseHeader': 'Excl Resp Header',

  // ── Action-detail vocabulary (tooltip grid row labels) ─────────────
  'popup.actionDetail.name': 'Name',
  'popup.actionDetail.url': 'URL',
  'popup.actionDetail.count': 'Count',
  'popup.actionDetail.type': 'Type',
  'popup.actionDetail.duration': 'Duration',
  'popup.actionDetail.format': 'Format',
  'popup.actionDetail.status': 'Status',
  'popup.actionDetail.value': 'Value',
  'popup.actionDetail.position': 'Position',
  'popup.actionDetail.body': 'Body',
  'popup.actionDetail.contentType': 'Content-Type',
  'popup.actionDetail.label': 'Label',
  'popup.actionDetail.headers': 'Headers',
  'popup.actionDetail.params': 'Params',

  // ── This Page tab ──────────────────────────────────────────────────
  'popup.thisPage.loading': 'Loading current tab information...',
  'popup.thisPage.noTab': 'Unable to get current tab information',
  'popup.thisPage.columnMatch': 'Match',
  'popup.thisPage.expandHeaderBadgeHint': 'Click badge on each row to see matched requests',
  'popup.thisPage.expandHeaderDocsHint': 'Click icon below to see documentation',
  'popup.thisPage.badgeSearchMatch': ({ matched, total, query }, locale) =>
    `${matched} of ${plural(locale, Number(total), { one: '{count} request', other: '{count} requests' })} match "${query}" — click to expand`,
  'popup.thisPage.badgeNone': 'No matched requests yet — click to expand',
  'popup.thisPage.badgeAllSilent': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} matched request', other: '{count} matched requests' })}, all cache-served (silent) — click to expand`,
  'popup.thisPage.badgeMixed': ({ fired, silent }, locale) =>
    `${plural(locale, Number(fired), { one: '{count} matched request', other: '{count} matched requests' })} fired + ${silent} silent (cached) — click to expand`,
  'popup.thisPage.badgeMatched': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} matched request', other: '{count} matched requests' })} — click to expand`,
  'popup.thisPage.systemPage': 'System Page',
  'popup.thisPage.systemPageHint': 'Header rules do not apply to browser system pages',
  'popup.thisPage.emptyNoRules': 'No rules match this page',
  'popup.thisPage.emptyNoRulesHint': 'No rules are configured for this domain',
  'popup.thisPage.ruleDisabled': 'Rule is disabled',
  'popup.thisPage.rulePausedByGroup': 'Rule is paused by its collection or folder',
  'popup.thisPage.zeroRelated':
    'Rule targets a related domain — no requests to that domain have been observed yet. It will fire if the page makes one.',
  'popup.thisPage.zeroPage':
    'Pattern matches this page but no matching requests have been observed yet. Interact with the page or reload to trigger them.',
  'popup.thisPage.shadowAllPrefix': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'All {count} matched request', other: 'All {count} matched requests' }),
  'popup.thisPage.shadowSomePrefix': '{shadowed} of {total} matched requests',
  'popup.thisPage.shadowTooltip':
    '{prefix} are terminated by "{name}" (higher-priority block rule) — so this rule has no visible effect on them. Experimental: shadow detection may over- or under-report. Disable in settings to hide.',
  'popup.thisPage.evidenceConfirmed': ({ count }, locale) =>
    `Script confirmed ${plural(locale, Number(count), { one: '{count} fire', other: '{count} fires' })} on this page (ground truth from in-page injection).`,
  'popup.thisPage.evidenceFallback': ({ count }, locale) =>
    `Matched ${plural(locale, Number(count), { one: '{count} request', other: '{count} requests' })} via URL, but the in-page script reporter didn't confirm. Common causes: a strict Content-Security-Policy blocking the injection, or the resource type (stylesheet, image, manifest link) bypassing fetch/XHR interception.`,
  'popup.thisPage.evidenceSilent': ({ count }, locale) =>
    `Pattern matched ${plural(locale, Number(count), { one: '{count} cached subresource', other: '{count} cached subresources' })} — the action couldn't run because the response bypassed the network. Reload bypassing cache to force a fresh request.`,
  'popup.thisPage.evidenceMatched': ({ count }, locale) =>
    `Matched ${plural(locale, Number(count), { one: '{count} request', other: '{count} requests' })} on this page. Chrome's declarativeNetRequest doesn't report which rule wins when several match — we observe URL matches, not arbitration outcomes.`,
  'popup.thisPage.pausedTagTooltip': 'Collection or folder is paused — rule not applied',
  'popup.thisPage.rulesPausedByCollection': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} rule', other: '{count} rules' })} paused by collection`,
  'popup.thisPage.firing': '{count} firing',
  'popup.thisPage.silentCached': '{count} silent (cached)',
  'popup.thisPage.related': '{count} related',
  'popup.thisPage.liveMonitoring': 'Live — monitoring requests',
  'popup.thisPage.visibleResourceTypes': 'VISIBLE RESOURCE TYPES',
  'popup.thisPage.showAll': 'Show all',
  'popup.thisPage.filterResourceTypes': 'Filter resource types',
  'popup.thisPage.filterResourceTypesCount': 'Filter resource types ({shown} of {total} shown)',
  'popup.thisPage.requestCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} request', other: '{count} requests' }),
  'popup.thisPage.requestCountAllSilent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} silent request (cached)',
      other: '{count} silent requests (cached)',
    }),
  'popup.thisPage.requestCountSomeSilent': ({ count, silent }, locale) =>
    `${plural(locale, Number(count), { one: '{count} request', other: '{count} requests' })} (${silent} silent)`,
  'popup.thisPage.rulesOfTotal': ({ matched, total }, locale) =>
    `${matched} of ${plural(locale, Number(total), { one: '{count} rule', other: '{count} rules' })}`,
  'popup.thisPage.requestsOfTotal': ({ matched, total }, locale) =>
    `${matched} of ${plural(locale, Number(total), { one: '{count} request', other: '{count} requests' })}`,
  'popup.thisPage.matchedJoin': '{parts} matched',
  'popup.thisPage.copyTsv': 'Copy requests as TSV',

  // ── Matched-requests sub-table ─────────────────────────────────────
  'popup.matched.columnTime': 'Time',
  'popup.matched.columnUrl': 'Request URL',
  'popup.matched.columnType': 'Type',
  'popup.matched.columnDelivery': 'Delivery',
  'popup.matched.columnEvidence': 'Evidence',
  'popup.matched.columnPattern': 'Pattern',
  'popup.matched.matchedBy': 'matched by',
  'popup.matched.deliveryLive': 'live',
  'popup.matched.deliveryCached': 'cached',
  'popup.matched.deliverySw': 'sw',
  'popup.matched.deliveryLiveTip': 'Request went to the network this session; response was not served from cache.',
  'popup.matched.deliveryCachedTip':
    "Response was served from Chrome's HTTP cache. Your rule applied when this response was originally fetched or on the revalidation round-trip.",
  'popup.matched.deliverySwTip':
    'A service worker intercepted the request. Whether your rule applied depends on what the service worker did next.',
  'popup.matched.evidenceShadowed': 'shadowed',
  'popup.matched.evidenceShadowedTip':
    'This request was terminated by "{name}" (block rule, higher priority). This rule never ran on it.',
  'popup.matched.evidenceConfirmed': 'confirmed',
  'popup.matched.evidenceConfirmedTip':
    'Script confirmed this fire from the in-page injection — ground truth that the rule ran.',
  'popup.matched.evidenceFallback': 'fallback',
  'popup.matched.evidenceFallbackTip':
    "Matched via URL, but the in-page script reporter didn't confirm. Common causes: a strict Content-Security-Policy blocking the MAIN-world injection, or a resource type (stylesheet, image, manifest link) that bypasses fetch/XHR interception.",
  'popup.matched.evidenceSilent': 'silent',
  'popup.matched.evidenceSilentTip':
    "Pattern matched this subresource but the response was served from cache / a service worker / bfcache, so the rule's action could not run. Reload bypassing cache to force a fresh request.",
  'popup.matched.evidenceMatched': 'matched',
  'popup.matched.evidenceMatchedTip':
    "URL matched this rule's conditions. Chrome's declarativeNetRequest doesn't report which rule wins arbitration — we observe URL matches, not execution.",
  'popup.matched.searchSummary': ({ matched, total, query }, locale) =>
    `${matched} of ${plural(locale, Number(total), { one: '{count} request', other: '{count} requests' })} matching "${query}"`,
  'popup.matched.countSummary': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} request', other: '{count} requests' })} matched`,
  'popup.matched.emptySearch': 'No matched requests contain "{query}". Clear or widen the search to see all matches.',
  'popup.matched.emptyRelated':
    'Rule targets a related domain — matches will appear if the page makes requests to that domain.',
  'popup.matched.emptyPage':
    'Pattern matches this page. Matches will appear as the page issues requests that fit the pattern — interact with the page or reload to trigger them.',
  'popup.matched.emptyNone': 'No matched requests yet — reload the page to capture.',

  // ── Rule-type vocabulary ───────────────────────────────────────────
  'popup.ruleType.header': 'Header',
  'popup.ruleType.block': 'Block',
  'popup.ruleType.redirect': 'Redirect',
  'popup.ruleType.queryParam': 'Query Param',
  'popup.ruleType.inject': 'Inject',
  'popup.ruleType.requestBody': 'API Request',
  'popup.ruleType.delay': 'Delay',
  'popup.ruleType.response': 'API Response',
  'popup.ruleType.headerDesc': 'Modify HTTP headers',
  'popup.ruleType.blockDesc': 'Block requests',
  'popup.ruleType.redirectDesc': 'Redirect requests',
  'popup.ruleType.queryParamDesc': 'Modify query parameters',
  'popup.ruleType.injectDesc': 'Inject scripts or CSS',
  'popup.ruleType.requestBodyDesc': 'Modify API request body (fetch/XHR)',
  'popup.ruleType.delayDesc': 'Delay response',
  'popup.ruleType.responseDesc': 'Mock or modify API response (fetch/XHR)',

  // ── Resource-type explanations (labels stay English — parity vocab) ─
  'popup.resourceType.mainFrameTip': 'Matches the page URL directly',
  'popup.resourceType.subFrameTip': 'Applied to an iframe loaded by this page',
  'popup.resourceType.xhrTip': 'Applied to fetch() and XMLHttpRequest calls',
  'popup.resourceType.scriptTip': 'Applied to script resources',
  'popup.resourceType.stylesheetTip': 'Applied to stylesheets',
  'popup.resourceType.imageTip': 'Applied to images',
  'popup.resourceType.fontTip': 'Applied to font files',
  'popup.resourceType.mediaTip': 'Applied to audio/video resources',
  'popup.resourceType.websocketTip': 'Applied to WebSocket connections',
  'popup.resourceType.pingTip': 'Applied to ping/beacon requests',
  'popup.resourceType.otherTip': 'Applied to other resources',

  // ── Add Rule palette ───────────────────────────────────────────────
  'popup.palette.blankRule': 'Blank rule',
  'popup.palette.searchPlaceholder': 'Search rule types and templates…',
  'popup.palette.noMatches': 'No matches for "{query}"',

  // ── Keyboard shortcuts overlay + registry descriptions ─────────────
  'popup.shortcuts.title': 'Keyboard Shortcuts',
  'popup.shortcuts.press': 'press',
  'popup.shortcuts.or': 'or',
  'popup.shortcuts.toClose': 'to close',
  'popup.shortcuts.groupNavigation': 'Navigation',
  'popup.shortcuts.groupActions': 'Actions',
  'popup.shortcuts.groupRow': 'Table rows',
  'popup.shortcuts.groupBrowser': 'Browser',
  'popup.shortcuts.groupTour': 'Tour Guide',
  'popup.shortcuts.openExtension': 'Open extension',
  'popup.shortcuts.customize': 'Customize extension shortcut ↗',
  'popup.shortcuts.toggleDebugMode': 'Toggle debug mode',
  'popup.shortcuts.tabThisPage': 'This Page tab',
  'popup.shortcuts.tabAllRules': 'All Rules tab',
  'popup.shortcuts.tabCollections': 'Collections tab',
  'popup.shortcuts.focusSearch': 'Focus search',
  'popup.shortcuts.prevPage': 'Previous page',
  'popup.shortcuts.nextPage': 'Next page',
  'popup.shortcuts.addRule': 'Add new rule',
  'popup.shortcuts.openWorkspace': 'Open workspace',
  'popup.shortcuts.openSettings': 'Open settings',
  'popup.shortcuts.toggleSurface': 'Toggle popup / side panel',
  'popup.shortcuts.toggleRulesPause': 'Pause / resume all rules',
  'popup.shortcuts.togglePauseFocused': 'Pause / resume collection or folder',
  'popup.shortcuts.toggleOptionsMenu': 'Options menu',
  'popup.shortcuts.cycleTheme': 'Cycle theme',
  'popup.shortcuts.toggleCompactMode': 'Compact mode',
  'popup.shortcuts.toggleShortcutsHelp': 'This panel',
  'popup.shortcuts.moveDown': 'Move down',
  'popup.shortcuts.moveUp': 'Move up',
  'popup.shortcuts.expandRow': 'Expand / enter sub-rows',
  'popup.shortcuts.collapseRow': 'Collapse / exit sub-rows',
  'popup.shortcuts.toggleRow': 'Toggle on / off',
  'popup.shortcuts.editRow': 'Edit rule',
  'popup.shortcuts.copyValue': 'Copy value',
  'popup.shortcuts.deleteRow': 'Delete (press twice)',
  'popup.shortcuts.openTourGuide': 'Open tour guide',

  // ── Onboarding tour ────────────────────────────────────────────────
  'popup.tour.stepIndicator': 'Step {current} of {total}',
  'popup.tour.previous': 'Previous',
  'popup.tour.next': 'Next',
  'popup.tour.finish': 'Finish',
  'popup.tour.welcomeTitle': 'Welcome to Open Headers',
  'popup.tour.welcomeSubtitle': 'Intercept and modify HTTP traffic in real time.',
  'popup.tour.modify': 'Modify',
  'popup.tour.modifyDesc': 'Headers, cookies, auth tokens, CORS, payloads',
  'popup.tour.route': 'Route',
  'popup.tour.routeDesc': 'Redirect requests, block trackers, rewrite URLs',
  'popup.tour.debug': 'Debug',
  'popup.tour.debugDesc': 'Inspect live requests, inject scripts, override responses',
  'popup.tour.migrateSwitching': 'Switching from',
  'popup.tour.migrateOr': 'or',
  'popup.tour.migrateButton': 'Migrate from another tool',
  'popup.tour.tabsTitle': 'Switch Between Tabs',
  'popup.tour.tabsSubtitle': 'Press a number key to switch instantly.',
  'popup.tour.thisPageHint': '— rules matching the current tab',
  'popup.tour.allRulesHint': "— every rule you've created",
  'popup.tour.tagsLabel': 'Tags',
  'popup.tour.tagsHint': '— organize and pause groups',
  'popup.tour.workspaceTitle': 'Your Workspace',
  'popup.tour.workspaceSubtitle': 'The full editor — opens in its own tab.',
  'popup.tour.workspaceRequests': 'API Client',
  'popup.tour.workspaceRequestsHint': '— create, send, and save API requests',
  'popup.tour.workspaceWorkflows': 'Workflows',
  'popup.tour.workspaceWorkflowsHint': '— chain requests into automated runs',
  'popup.tour.workspaceEnvs': 'Environments & variables',
  'popup.tour.workspaceEnvsHint': '— plus imports, rules, and team sync',
  'popup.tour.navTitle': 'Browse & Navigate Rules',
  'popup.tour.navSubtitle': 'Navigate rows with keyboard shortcuts',
  'popup.tour.keyMove': 'Move',
  'popup.tour.keyExpand': 'Expand',
  'popup.tour.keyToggle': 'Toggle',
  'popup.tour.keyEdit': 'Edit',
  'popup.tour.keyCopy': 'Copy',
  'popup.tour.keyDelete': 'Delete',
  'popup.tour.devtoolsTitle': 'Debug Network in DevTools',
  'popup.tour.findThePrefix': 'Find the',
  'popup.tour.findTheSuffix': 'tab in DevTools:',
  'popup.tour.devtoolsHint': 'Click this button anytime for setup.',
  'popup.tour.shortcutsTitle': 'All Keyboard Shortcuts',
  'popup.tour.shortcutsSubtitle': 'The popup is fully keyboard-navigable.',
  'popup.tour.pressLabel': 'Press',
  'popup.tour.shortcutsHint': 'at any time to see every shortcut',
  'popup.tour.debugModeTitle': 'Debug Mode',
  'popup.tour.debugModeSubtitle': 'Full control over live browser traffic.',
  'popup.tour.debugModeReqRes': 'Requests & responses',
  'popup.tour.debugModeReqResHint': '— rewrite headers, bodies, and status codes live',
  'popup.tour.debugModeStreams': 'WebSockets & SSE',
  'popup.tour.debugModeStreamsHint': '— inspect and edit streamed messages',
  'popup.tour.debugModeScripts': 'Scripts & storage',
  'popup.tour.debugModeScriptsHint': '— inject scripts, inspect cookies & storage',
  'popup.tour.statusTitle': 'System Status',
  'popup.tour.statusSubtitle':
    'Click the dot for a health breakdown across Sync, Rules, Requests, Permissions, Secrets, and Live.',
  'popup.tour.statusGreen': 'Green',
  'popup.tour.statusGreenDesc': '— everything is healthy',
  'popup.tour.statusYellow': 'Yellow',
  'popup.tour.statusYellowDesc': '— a subsystem is reporting a warning',
  'popup.tour.statusRed': 'Red',
  'popup.tour.statusRedDesc': '— a subsystem has failed',
  'popup.tour.growTitle': 'Help Us Grow',
  'popup.tour.growSubtitle': 'Help us grow and reach more developers.',
  'popup.tour.starGithub': 'Give us a star on GitHub',
  'popup.tour.recommend': 'Recommend us to your friends & colleagues',
  'popup.tour.growHint': 'Find these anytime under the bell.',

  // ── DevTools feature bullets (tour step 4 + Debug Network panel) ───
  'popup.devtools.featureModify': 'Modify headers, requests & responses',
  'popup.devtools.featureTabs': 'Multi-tab request metadata panels',
  'popup.devtools.featureSearch': 'Advanced search & filter',
  'popup.devtools.featureDock': 'Drag & drop sidebar panels',
  'popup.devtools.addOverride': '+ Add/Override',

  // ── Debug Network panel ────────────────────────────────────────────
  'popup.debug.title': 'Debug Network',
  'popup.debug.step1': 'Open browser DevTools',
  'popup.debug.step1a': 'On a regular page e.g.',
  'popup.debug.notPrefix': 'Not',
  'popup.debug.notSuffix': 'or new tab (extensions: blocked there).',
  'popup.debug.onPlatform': 'on {platform}',
  'popup.debug.menuHintSafari':
    'Enable Develop first — Safari → Settings → Advanced → "Show features for web developers".',
  'popup.debug.clickThePrefix': 'Click the',
  'popup.debug.clickTheSuffix': 'tab',
  'popup.debug.overflowPrefix': 'Last tab — may hide in the',
  'popup.debug.overflowSuffix': 'overflow menu.',
  'popup.debug.step3': 'Super-charge your debugging',
  'popup.debug.menuGlyphAria': 'Open View menu → Developer → Developer Tools',
  'popup.debug.tabGlyphAria':
    'DevTools docked with Open Headers tab selected — sidebars, network list and multi-tab split panes',
} as const satisfies Catalog;
