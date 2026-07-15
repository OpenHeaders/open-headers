/**
 * Workbench docs body corpus (Phase C, docs station) — the long-form
 * prose inside `workbench/components/docs/sections/`. One namespace
 * per section under `workbench.docs.body.*`; fragments split only at
 * raw islands (`<code>` chips, key caps) and inline-markup boundaries
 * (the S16 tool-window-info prefix/suffix idiom), so English stays
 * byte-identical when the JSX recomposes them.
 *
 * Technical plane stays raw: code chips (`declarativeNetRequest`,
 * `chrome.storage.local`, `fetch()` / `XMLHttpRequest`, `#1 Open
 * Headers` ordinals, `● Debug mode` pill depictions), ResourceType
 * codes (`main_frame`, …) and their monospace example lines, and
 * everything inside a diagram (captions/arias key; SVG internals are
 * English permanently — the S18 USER-LOCKED boundary). Resource-type
 * display tags (Page, Frame, Fetch/XHR, …) stay raw parity vocabulary;
 * their description sentences localize.
 */

import type { Catalog } from '../../types';

export const workbenchDocs = {
  // ── Concepts: Debug mode ────────────────────────────────────────────
  'workbench.docs.body.debugMode.term': 'Debug mode',
  'workbench.docs.body.debugMode.intro1':
    "attaches Open Headers to the browser's debugging protocol so it can inspect and change traffic that " +
    "ordinary extension APIs can't reach. It's the same machinery the browser's own developer tools use — " +
    "which is why, while it's on, the browser shows an",
  'workbench.docs.body.debugMode.introBanner': '"OH started debugging this browser"',
  'workbench.docs.body.debugMode.intro1Suffix': 'banner.',
  'workbench.docs.body.debugMode.intro2':
    'Standard mode (debug mode off) already covers most rules — header, block, redirect, query-param, and ' +
    "the page-context body / response / inject rules. Debug mode is the opt-in upgrade for what those can't " +
    'reach: navigations, workers, cross-origin frames, and tab-wide environment changes.',
  'workbench.docs.body.debugMode.controlHeading': 'Where you control it',
  'workbench.docs.body.debugMode.control1Prefix': 'The',
  'workbench.docs.body.debugMode.control1Middle': 'pill sits in the footer of every surface, just left of',
  'workbench.docs.body.debugMode.systemStatusLink': 'System status',
  'workbench.docs.body.debugMode.control1Suffix':
    '. The inline switch turns it on and off, the colored dot tracks its health, and the dot + label open a ' +
    'popover with everything else — scope, per-tab pins, and the list of currently attached tabs.',
  'workbench.docs.body.debugMode.surfaceCaption':
    'The inline switch turns it on; the dot + label open the popover for everything else.',
  'workbench.docs.body.debugMode.scopeHeading': 'Choosing what to inspect',
  'workbench.docs.body.debugMode.scope1Prefix': 'The',
  'workbench.docs.body.debugMode.attachTo': 'Attach to',
  'workbench.docs.body.debugMode.scope1Middle': 'dropdown decides which tabs debug mode attaches to —',
  'workbench.docs.body.debugMode.scopeDevtools': 'Where DevTools is open',
  'workbench.docs.body.debugMode.scope1DevtoolsParen':
    '(only tabs with the Open Headers panel open; the narrowest default),',
  'workbench.docs.body.debugMode.scopeFocused': 'The focused tab',
  'workbench.docs.body.debugMode.scope1FocusedParen': '(follows the active tab as you switch), or',
  'workbench.docs.body.debugMode.scopeBoth': 'Both',
  'workbench.docs.body.debugMode.scope1BothParen': '(the union of the two).',
  'workbench.docs.body.debugMode.consent1Prefix': 'Picking a scope',
  'workbench.docs.body.debugMode.consentIs': 'is',
  'workbench.docs.body.debugMode.consent1Middle':
    "the consent for the browser banner — there's no separate prompt. When the current tab isn't already " +
    'covered by the scope, an',
  'workbench.docs.body.debugMode.includeTabPin': 'Include this browser tab',
  'workbench.docs.body.debugMode.consent1Suffix':
    'pin appears, so you can attach that one tab without widening the scope for everything else.',
  'workbench.docs.body.debugMode.attached1Prefix': 'The',
  'workbench.docs.body.debugMode.attachedTabs': 'Attached tabs',
  'workbench.docs.body.debugMode.attached1Suffix':
    'list shows every tab debug mode is currently driving, each with a jump-to-tab action. The attached set ' +
    'is always recomputed from your scope, your pins, and which panels are open — so it reflects the ' +
    'present, never a stale snapshot.',
  'workbench.docs.body.debugMode.scopeCaption':
    'The attached set is derived every time — re-attach replays it, nothing is stored.',
  'workbench.docs.body.debugMode.bannerCalloutTitle': 'The banner is browser-wide',
  'workbench.docs.body.debugMode.banner1Prefix':
    'While debug mode is on, the browser\'s "OH started debugging this browser" banner shows on',
  'workbench.docs.body.debugMode.bannerEvery': 'every',
  'workbench.docs.body.debugMode.banner1Suffix':
    "tab — not just the ones it's attached to. That's the browser's own behavior; turning debug mode off " +
    'removes it immediately.',
  'workbench.docs.body.debugMode.unlocksHeading': 'What it unlocks',
  'workbench.docs.body.debugMode.unlocksIntro': 'On an attached tab, rules and controls reach past the page context:',
  'workbench.docs.body.debugMode.anyRequestLead': 'Any request, any context.',
  'workbench.docs.body.debugMode.anyRequest1':
    'Mock or rewrite top-level navigations, worker requests, and cross-origin iframes — not just page',
  'workbench.docs.body.debugMode.anyRequest2':
    '. Request and response bodies can be read and transformed on those same contexts, and HTTP ' +
    'authentication challenges answered automatically for dev proxies and staging.',
  'workbench.docs.body.debugMode.injectionLead': 'Stronger injection.',
  'workbench.docs.body.debugMode.injection1':
    'Script injection becomes race-free and CSP-proof, and reaches inside workers and cross-origin frames ' +
    "the standard page-context path can't touch.",
  'workbench.docs.body.debugMode.tabEnvLead': 'Tab environment.',
  'workbench.docs.body.debugMode.tabEnv1':
    'Exact cache disable, network throttle / offline, and user-agent / locale / timezone / media overrides ' +
    '— set per tab from the panel toolbar and the',
  'workbench.docs.body.debugMode.overrides': 'Overrides',
  'workbench.docs.body.debugMode.tabEnv2': 'surface.',
  'workbench.docs.body.debugMode.reachCaption':
    'Standard mode covers page fetch / XHR; an attached tab extends the same rules to everything else.',
  'workbench.docs.body.debugMode.silentHeading': 'Rules never fail silently',
  'workbench.docs.body.debugMode.silent1Prefix': 'A rule that needs debug mode to take full effect shows a',
  'workbench.docs.body.debugMode.badgeOff': 'Debug mode off',
  'workbench.docs.body.debugMode.silent1Middle': "badge in the rules list while it's off, and a",
  'workbench.docs.body.debugMode.badgeOutOfScope': 'Tab out of scope',
  'workbench.docs.body.debugMode.silent1Middle2':
    "note in the panel when it's on but the tab isn't in scope. The rule still runs everything it",
  'workbench.docs.body.debugMode.silentCan': 'can',
  'workbench.docs.body.debugMode.silent1Suffix':
    'through the standard page-context path — arming debug mode only extends the same rule to the contexts ' +
    "page injection can't reach.",
  'workbench.docs.body.debugMode.colorsHeading': 'Status colors',
  'workbench.docs.body.debugMode.colors1Prefix': 'The dot mirrors the',
  'workbench.docs.body.debugMode.colors1Suffix': 'row:',
  'workbench.docs.body.debugMode.statesCaption': "Grey when off; green / yellow / red once it's on.",
  'workbench.docs.body.debugMode.stateGreenLabel': 'green',
  'workbench.docs.body.debugMode.stateOn': 'On',
  'workbench.docs.body.debugMode.stateOnRest': "and attached cleanly. (When it's off the dot is simply grey.)",
  'workbench.docs.body.debugMode.stateYellowLabel': 'yellow',
  'workbench.docs.body.debugMode.stateYellowPrefix': 'A tab',
  'workbench.docs.body.debugMode.stateYellowTerm': 'fell back to heuristic',
  'workbench.docs.body.debugMode.stateYellowSuffix':
    "— usually because the browser's debug banner was dismissed, so that tab reverts to standard observation.",
  'workbench.docs.body.debugMode.stateRedLabel': 'red',
  'workbench.docs.body.debugMode.stateRedPrefix': 'A tab',
  'workbench.docs.body.debugMode.stateRedTerm': 'failed to attach',
  'workbench.docs.body.debugMode.stateRedSuffix': "— the debugging protocol couldn't be engaged for it.",
  'workbench.docs.body.debugMode.chromiumTitle': 'Chromium only',
  'workbench.docs.body.debugMode.chromium1':
    'Debug mode relies on a debugging protocol only Chromium-based browsers expose to extensions. On ' +
    'Firefox and Safari the pill stays hidden; the standard-mode rules above work everywhere.',

  // ── Concepts: Execution (DNR vs Script) ─────────────────────────────
  'workbench.docs.body.execution.intro':
    'Rules execute through one of two engines depending on what they do. Knowing which path a rule travels ' +
    'explains where it applies — and where it cannot.',
  'workbench.docs.body.execution.stackCaption':
    'JS-initiated requests pass through Script then DNR. Static and navigation traffic bypass Script entirely.',
  'workbench.docs.body.execution.dnrHeading': 'Native, fast, broad reach',
  'workbench.docs.body.execution.dnr1Prefix':
    'Header Override / Append / Remove, Block, Redirect, and Query Param rules compile to',
  'workbench.docs.body.execution.dnr1Suffix':
    'entries. Chrome applies them at the network layer, before any request leaves the browser.',
  'workbench.docs.body.execution.dnr2':
    'Reach is broad: pages, sub-frames, scripts, images, fonts, fetch, XHR — every request the browser makes ' +
    'on behalf of the page.',
  'workbench.docs.body.execution.dnrCaption': "A single bordered list — DNR's reach is essentially universal.",
  'workbench.docs.body.execution.scriptHeading': 'JS-context, narrow reach',
  'workbench.docs.body.execution.script1Prefix':
    'Inject, Delay, Request Body, API Response, and Header Merge rules work by monkey-patching',
  'workbench.docs.body.execution.script1And': 'and',
  'workbench.docs.body.execution.script1Suffix':
    'from inside the page. They can transform JavaScript-initiated traffic in ways DNR ' +
    "can't express — including reading and rewriting response bodies, which DNR has no access to.",
  'workbench.docs.body.execution.scriptCaption':
    'Two columns — what the script engine actually intercepts, and what slips through unchanged.',
  'workbench.docs.body.execution.limitPrefix': 'Static resources (',
  'workbench.docs.body.execution.limitSuffix':
    '), page navigations, and browser-internal requests bypass this engine entirely. Use a DNR-based rule ' +
    'for those.',

  // ── Concepts: Limitations ───────────────────────────────────────────
  'workbench.docs.body.limitations.intro':
    'Quick reference for behaviors that surprise people. Each item is also called out inline in the section ' +
    'it affects.',
  'workbench.docs.body.limitations.overviewCaption':
    'Four common gotchas at a glance — each callout below has the details.',
  'workbench.docs.body.limitations.devtoolsTitle': "Modified headers don't show in DevTools",
  'workbench.docs.body.limitations.devtoolsBody':
    "Header actions are applied correctly but Chrome's Network tab still displays the original server headers.",
  'workbench.docs.body.limitations.scriptTitle': 'Script-based rules — narrow reach',
  'workbench.docs.body.limitations.scriptPrefix': 'Inject, Delay, Body, Mock, and Header Merge only intercept',
  'workbench.docs.body.limitations.scriptAnd': 'and',
  'workbench.docs.body.limitations.scriptMiddle': '. Static resources and page navigations bypass them. See',
  'workbench.docs.body.limitations.executionRef': 'How rules execute',
  'workbench.docs.body.limitations.scriptSuffix': '.',
  'workbench.docs.body.limitations.mergeTitle': "Merge can't read browser-default headers",
  'workbench.docs.body.limitations.mergeBody':
    'The Merge operation only sees headers explicitly set by page code — Accept, User-Agent, and other ' +
    'browser-defaults are invisible to it.',
  'workbench.docs.body.limitations.chromeTitle': 'Header matching needs Chrome 128+',
  'workbench.docs.body.limitations.chromeBody':
    'Conditions that match on request / response header values require Chrome 128 or newer. Older browsers ' +
    'ignore the condition silently.',

  // ── Concepts: Multi-tab Behavior ────────────────────────────────────
  'workbench.docs.body.multiTab.intro1Prefix':
    'Multiple workspace tabs open at once is a first-class state. Persisted data syncs through',
  'workbench.docs.body.multiTab.intro1Suffix':
    ', layout state stays per-tab, and navigation intents reuse existing tabs in the same window before ' +
    'opening new ones.',
  'workbench.docs.body.multiTab.syncCaption':
    'Tab A saves, the SW broadcasts, Tab B re-hydrates. Layout state stays in each tab.',
  'workbench.docs.body.multiTab.navHeading': 'Navigation reuses existing tabs',
  'workbench.docs.body.multiTab.nav1':
    "Same-window first: if a workspace tab is already open in the window you're clicking from, it activates " +
    'and receives the intent (docs section to scroll to, rule to edit). Different window: a fresh tab opens ' +
    "in your current window rather than pulling focus across Chrome windows — mirroring how Chrome's own " +
    'DevTools works, with one panel per window.',
  'workbench.docs.body.multiTab.navCaption':
    "Warm path activates the same-window tab; cold path opens a new tab in the caller's window.",
  'workbench.docs.body.multiTab.numberingHeading': 'Tab numbering',
  'workbench.docs.body.multiTab.numbering1Prefix':
    "With two or more workspace tabs, each tab's title is prefixed with its ordinal —",
  'workbench.docs.body.multiTab.numbering1Suffix': '. When the count drops back to one, the survivor sheds its prefix.',
  'workbench.docs.body.multiTab.numbering2Prefix': "Ordinals are stable within a tab's lifetime: closing",
  'workbench.docs.body.multiTab.numbering2While': 'while',
  'workbench.docs.body.multiTab.numbering2And': 'and',
  'workbench.docs.body.multiTab.numbering2Middle': 'remain does not renumber survivors. The next tab opened gets',
  'workbench.docs.body.multiTab.numbering2Middle2': '; numbering resets to',
  'workbench.docs.body.multiTab.numbering2Suffix': 'only after every workspace tab has closed.',
  'workbench.docs.body.multiTab.numberingCaption':
    'Survivors keep their numbers across closes; the next tab is always max + 1.',
  'workbench.docs.body.multiTab.syncsHeading': "What syncs, what doesn't",
  'workbench.docs.body.multiTab.syncs1Prefix':
    'Every persisted entity — rules, collections, folders, environments, workspace variables, vault, ' +
    'requests, templates — lives in',
  'workbench.docs.body.multiTab.syncs1Suffix':
    'as the single source of truth. Saves in tab A broadcast through the background and tab B re-hydrates. ' +
    'Workspace and environment switches propagate the same way.',
  'workbench.docs.body.multiTab.syncedCaption':
    'One shared chrome.storage; both tabs read and write the same persisted data.',
  'workbench.docs.body.multiTab.localCaption':
    'Layout drags and unsaved typing live in each tab — the other tab never sees them.',
  'workbench.docs.body.multiTab.layoutTitle': 'Layout does not live-sync',
  'workbench.docs.body.multiTab.layout1Prefix':
    "Pane ratios and tool-window dock state are per-workspace, but changes don't propagate to already-open " +
    'tabs. Dragging a splitter in tab A leaves tab B untouched until reload — live layout sync would feel ' +
    'jarring while typing. A tab opened',
  'workbench.docs.body.multiTab.layoutAfter': 'after',
  'workbench.docs.body.multiTab.layout1Suffix': 'the drag inherits the new layout.',
  'workbench.docs.body.multiTab.draftsTitle': 'Unsaved drafts are tab-local',
  'workbench.docs.body.multiTab.drafts1':
    "Editor drafts live in their own tab's memory. If tab A saves the same rule tab B is editing, tab A " +
    'wins the storage write — there\'s no cross-tab "modified, reload?" prompt today. Only matters when two ' +
    'tabs edit the same entity simultaneously.',

  // ── Concepts: Request Tracking ──────────────────────────────────────
  'workbench.docs.body.requestTracking.intro1Prefix': 'The',
  'workbench.docs.body.requestTracking.thisPage': 'This Page',
  'workbench.docs.body.requestTracking.intro1Suffix':
    'tab in the popup shows which rules are active for the current page and which requests they matched. ' +
    'Tracking spans both request and response phases of every connection the page makes.',
  'workbench.docs.body.requestTracking.phasesCaption':
    'A single connection has two phases — both contribute to the badge count.',
  'workbench.docs.body.requestTracking.howHeading': 'How it works',
  'workbench.docs.body.requestTracking.how1Prefix': 'The extension observes HTTP requests via the',
  'workbench.docs.body.requestTracking.how1Middle':
    "API. When a request URL matches a rule's conditions (domains, URL pattern, or URL regex), it's " +
    'recorded with its resource type. Recording happens live inside the service worker; the popup just ' +
    'reads that record back when you open the',
  'workbench.docs.body.requestTracking.how1Suffix': 'tab.',
  'workbench.docs.body.requestTracking.howCaption':
    'Browser fires webRequest events; the extension matches and records; the popup reads later.',
  'workbench.docs.body.requestTracking.badge1':
    'Each matched rule shows a numbered badge equal to how many requests it matched. Click the badge to ' +
    'expand into a list of timestamps, URLs, resource types, and the pattern that matched.',
  'workbench.docs.body.requestTracking.badgeCaption':
    'The badge collapses the count; clicking it reveals the full match list.',
  'workbench.docs.body.requestTracking.directHeading': 'Direct vs indirect matches',
  'workbench.docs.body.requestTracking.direct1Prefix': 'A',
  'workbench.docs.body.requestTracking.directTerm': 'direct',
  'workbench.docs.body.requestTracking.direct1Middle': 'match means the page URL itself matched. An',
  'workbench.docs.body.requestTracking.indirectTerm': 'indirect',
  'workbench.docs.body.requestTracking.direct1Suffix':
    'match means only a sub-resource — script, stylesheet, XHR, image, font — matched while the page URL ' +
    "didn't. The same rule can produce either kind depending on which page you're on.",
  'workbench.docs.body.requestTracking.directCaption':
    'One rule, two page contexts. Green = matched. Dashed = excluded.',
  'workbench.docs.body.requestTracking.typesHeading': 'Resource types',
  'workbench.docs.body.requestTracking.types1Prefix': 'Each matched request carries its Chrome',
  'workbench.docs.body.requestTracking.types1Middle':
    '— Page, Frame, Fetch/XHR, Script, CSS, Image, Font, Media, WebSocket, Ping, or Other. See the',
  'workbench.docs.body.requestTracking.resourceTypesLink': 'Resource types',
  'workbench.docs.body.requestTracking.types1Suffix': 'reference page for the full mapping with examples.',

  // ── Reference: Resource Types (section shell + table descriptions;
  //    tags/codes/example lines stay raw parity vocabulary) ────────────
  'workbench.docs.body.resourceTypes.introPrefix': "Reference for Chrome's",
  'workbench.docs.body.resourceTypes.introSuffix':
    'values surfaced by request tracking and the Resource Types condition. Each label maps to a single ' +
    "underlying type — there's no overlap between rows.",
  'workbench.docs.body.resourceTypes.anatomyCaption': 'What kind of request lands in which ResourceType — at a glance.',
  'workbench.docs.body.resourceTypes.descPage': 'Top-level document navigation — the URL shown in the address bar.',
  'workbench.docs.body.resourceTypes.descFrame': 'An iframe or nested frame embedded within the page.',
  'workbench.docs.body.resourceTypes.descXhr':
    'API calls via fetch() or XMLHttpRequest. Chrome reports both as the same type — there is no way to ' +
    'distinguish them.',
  'workbench.docs.body.resourceTypes.descScript': 'JavaScript files loaded by the page.',
  'workbench.docs.body.resourceTypes.descStylesheet': 'Stylesheets loaded by the page.',
  'workbench.docs.body.resourceTypes.descImage': 'Images loaded by the page or its styles.',
  'workbench.docs.body.resourceTypes.descFont': 'Web fonts loaded via @font-face rules.',
  'workbench.docs.body.resourceTypes.descMedia': 'Audio or video resources.',
  'workbench.docs.body.resourceTypes.descWebsocket':
    'WebSocket handshake — the initial HTTP upgrade request. Only the handshake is tracked, not individual ' +
    'messages.',
  'workbench.docs.body.resourceTypes.descPing': 'Beacon and ping requests typically used for analytics/tracking.',
  'workbench.docs.body.resourceTypes.descOther': "Anything that doesn't fit the above categories.",

  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': 'System status',
  'workbench.docs.body.systemStatus.intro1':
    "is a live snapshot of the extension's health. The workbench footer shows it as a six-pill row — one " +
    'pill per subsystem, each with its own colored dot. The popup and side-panel collapse it down to a single',
  'workbench.docs.body.systemStatus.intro1Suffix':
    "entry in their bottom footer, with the dot's color tracking the worst-state subsystem.",
  'workbench.docs.body.systemStatus.workbenchCaption':
    'In the workbench, the row sits in the footer with one pill per subsystem.',
  'workbench.docs.body.systemStatus.popupCaption':
    "Click the toolbar icon, and the same status surfaces as a single labeled pill in the popup's footer.",
  'workbench.docs.body.systemStatus.worstLevel1':
    'Each subsystem reports a single state and the worst level wins: red > yellow > green. One red anywhere ' +
    'flips the composite dot red.',
  'workbench.docs.body.systemStatus.worstLevelCaption':
    'Six subsystem states fold into one composite via max — red beats yellow beats green.',
  'workbench.docs.body.systemStatus.popover1':
    'Clicking any pill opens the same details popover. Rows come in two groups: grey first (no events yet ' +
    'this service-worker lifetime) and colored after (have reported at least once). Within each group the ' +
    'canonical subsystem order is preserved. Full history lives in the Observability log — export from',
  'workbench.docs.body.systemStatus.settingsExportPath': 'Settings → Data → Export Diagnostic Log',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    'Greys above the divider, coloreds below; on first report a row migrates once.',
  'workbench.docs.body.systemStatus.stateGreenLabel': 'green',
  'workbench.docs.body.systemStatus.stateYellowLabel': 'yellow',
  'workbench.docs.body.systemStatus.stateRedLabel': 'red',
  'workbench.docs.body.systemStatus.syncName': 'Sync',
  'workbench.docs.body.systemStatus.syncSubtitle': 'Desktop-app connection',
  'workbench.docs.body.systemStatus.sync1Prefix':
    "Mirrors the WebSocket connection between the extension's service worker and the OpenHeaders desktop " +
    'app running on your machine. The link is loopback-only (',
  'workbench.docs.body.systemStatus.sync1Suffix':
    ') and carries dynamic variables, team workspace data, and presence — nothing leaves your device.',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    'Single WebSocket between the extension and the desktop app on localhost.',
  'workbench.docs.body.systemStatus.sync2':
    'The pill reflects the live connection state. A drop triggers exponential-backoff reconnects; periodic ' +
    'pings detect silent disconnects behind strict corporate proxies.',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Disabled and Connected are green; Connecting, Reconnecting, and URL rejected are yellow.',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Connected to desktop',
  'workbench.docs.body.systemStatus.syncGreenMiddle': '(handshake succeeded) or',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Desktop sync disabled',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(auto-connect off).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Connecting…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconnecting (attempt N)',
  'workbench.docs.body.systemStatus.syncYellowOr': ', or',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'Desktop URL rejected by settings',
  'workbench.docs.body.systemStatus.syncYellowSuffix': '.',
  'workbench.docs.body.systemStatus.syncRed':
    'Reserved for fatal desktop-sync failures; no code path emits this today.',
  'workbench.docs.body.systemStatus.rulesName': 'Rules',
  'workbench.docs.body.systemStatus.rulesSubtitle': 'declarativeNetRequest engine',
  'workbench.docs.body.systemStatus.rules1Prefix':
    'Reports on every DNR rebuild. Every save runs your rule through four stages before it goes live: ' +
    'compile to DNR JSON, resolve',
  'workbench.docs.body.systemStatus.rules1Middle':
    "references, enforce the active-rule cap, then apply through Chrome's",
  'workbench.docs.body.systemStatus.rules1Suffix': 'API. Each stage can flip the pill.',
  'workbench.docs.body.systemStatus.rulesPipelineCaption':
    'Four stages — each can emit a Status level if it goes sideways.',
  'workbench.docs.body.systemStatus.rules2':
    'The active-rule count maps to a state on a three-zone capacity bar. Rules over the cap are dropped in ' +
    'match-order (top wins), and the yellow message carries the dropped count.',
  'workbench.docs.body.systemStatus.rulesCapacityCaption':
    'Green up to the warn threshold, yellow up to the cap, red beyond — but truncation keeps you out of the ' +
    'red zone at runtime.',
  'workbench.docs.body.systemStatus.rulesGreenActive': 'N active DNR rule(s)',
  'workbench.docs.body.systemStatus.rulesGreenOr': 'or',
  'workbench.docs.body.systemStatus.rulesGreenPaused': 'Rule execution paused',
  'workbench.docs.body.systemStatus.rulesGreenSuffix': '.',
  'workbench.docs.body.systemStatus.rulesYellowPrefix': 'Unresolved',
  'workbench.docs.body.systemStatus.rulesYellowRefs': 'references (',
  'workbench.docs.body.systemStatus.rulesYellowMsgUnresolved': 'N unresolved variables in M rules',
  'workbench.docs.body.systemStatus.rulesYellowMiddle': '), the rule cap was exceeded (',
  'workbench.docs.body.systemStatus.rulesYellowMsgDropped': 'Dropped N rules over cap',
  'workbench.docs.body.systemStatus.rulesYellowMiddle2': "), or you're approaching DNR capacity (",
  'workbench.docs.body.systemStatus.rulesYellowMsgCapacity': 'Approaching DNR capacity (N ≥ threshold)',
  'workbench.docs.body.systemStatus.rulesYellowSuffix': ').',
  'workbench.docs.body.systemStatus.rulesRedPrefix':
    'Transport failure — Chrome rejected the dynamic or session rule update (',
  'workbench.docs.body.systemStatus.rulesRedMsg': 'Failed to apply [dynamic|session] DNR rules',
  'workbench.docs.body.systemStatus.rulesRedSuffix': ').',
  'workbench.docs.body.systemStatus.requestsName': 'Requests',
  'workbench.docs.body.systemStatus.requestsSubtitle': 'API request executor',
  'workbench.docs.body.systemStatus.requests1Prefix':
    "Reflects the last ad-hoc API request fired from the Request editor's",
  'workbench.docs.body.systemStatus.requestsSend': 'Send',
  'workbench.docs.body.systemStatus.requests1Middle': 'button. The pill flips green for',
  'workbench.docs.body.systemStatus.requestsAny': 'any',
  'workbench.docs.body.systemStatus.requests1Suffix':
    'HTTP response — including 4xx and 5xx — because "the request completed" is a separate question from ' +
    '"the server liked it." Only network-level failures with no response turn it yellow.',
  'workbench.docs.body.systemStatus.requestsOutcomesCaption':
    'Any status code = green. Yellow is reserved for failures with no response back.',
  'workbench.docs.body.systemStatus.requests2Prefix':
    "Background traffic doesn't update this pill: Live workflow refreshes pass",
  'workbench.docs.body.systemStatus.requests2Suffix':
    ', and webpage requests flow through the Rules engine, not the executor.',
  'workbench.docs.body.systemStatus.requestsScopeCaption':
    'Only ad-hoc Send-button traffic shapes this pill — everything else stays quiet.',
  'workbench.docs.body.systemStatus.requestsGreenLabel': 'Last request:',
  'workbench.docs.body.systemStatus.requestsGreenMiddle': '— any HTTP response (e.g.',
  'workbench.docs.body.systemStatus.requestsGreenSuffix': ').',
  'workbench.docs.body.systemStatus.requestsYellowLabel': 'Last request failed:',
  'workbench.docs.body.systemStatus.requestsYellowMiddle': '— network-level failure before a response (e.g.',
  'workbench.docs.body.systemStatus.requestsYellowSuffix': ', offline/DNS).',
  'workbench.docs.body.systemStatus.permissionsName': 'Permissions',
  'workbench.docs.body.systemStatus.permissionsSubtitle': 'Host permissions audit',
  'workbench.docs.body.systemStatus.permissions1Prefix':
    "DNR rules and content scripts targeting a host that's been revoked from",
  'workbench.docs.body.systemStatus.permissions1Middle':
    "don't error — they silently no-op. This audit's whole job is to surface that hidden state, since " +
    "otherwise you'd spend 30 minutes debugging a rule that",
  'workbench.docs.body.systemStatus.permissionsLooks': 'looks',
  'workbench.docs.body.systemStatus.permissions1Suffix': 'fine.',
  'workbench.docs.body.systemStatus.permissionsImpactCaption':
    'Granted: the rule fires. Narrowed: the rule silently no-ops and the header never arrives.',
  'workbench.docs.body.systemStatus.permissions2Prefix': 'The audit polls',
  'workbench.docs.body.systemStatus.permissions2Suffix':
    'on every service-worker wake. MV3 has no permission-change observer in Chromium, so poll-on-wake is ' +
    'the cheapest signal we can get.',
  'workbench.docs.body.systemStatus.permissionsAuditCaption':
    'One call, three branches — green for granted, red for narrowed, yellow if the API call itself fails.',
  'workbench.docs.body.systemStatus.permissionsGreenLabel': 'All host permissions granted',
  'workbench.docs.body.systemStatus.permissionsGreenSuffix': 'is still in scope.',
  'workbench.docs.body.systemStatus.permissionsYellowLabel': 'Could not audit host permissions',
  'workbench.docs.body.systemStatus.permissionsYellowMiddle': "— unusual; the browser didn't expose",
  'workbench.docs.body.systemStatus.permissionsYellowSuffix': '.',
  'workbench.docs.body.systemStatus.permissionsRedLabel': 'Host permissions narrowed',
  'workbench.docs.body.systemStatus.permissionsRedMiddle':
    '— some rules will silently no-op on revoked hosts until access is restored from',
  'workbench.docs.body.systemStatus.permissionsRedSuffix': '.',
  'workbench.docs.body.systemStatus.secretsName': 'Secrets',
  'workbench.docs.body.systemStatus.secretsSubtitle': 'Vault integrity',
  'workbench.docs.body.systemStatus.secrets1Prefix': 'Tracks the per-workspace encrypted vault blob in',
  'workbench.docs.body.systemStatus.secrets1Suffix':
    '. On every service-worker wake, each stored secret is validated against the current schema; entries ' +
    "that fail validation are dropped from the in-memory vault and the pill flips yellow until they're " +
    're-saved.',
  'workbench.docs.body.systemStatus.vaultHydrationCaption':
    'Hydrate loads the blob; the schema validator keeps matches, drops drifts, and reports yellow.',
  'workbench.docs.body.systemStatus.secrets2':
    '"Drift" usually means a stored entry was written by an older build (missing a field that\'s now ' +
    "required, or a field with the wrong type). The validator's job is to fail loud — silently inheriting " +
    'unknown shapes is what causes the bug six versions later.',
  'workbench.docs.body.systemStatus.vaultDriftCaption':
    'Same two fields side by side: a valid entry vs a drift entry with a missing cipher and a wrongly-typed ' +
    'createdAt.',
  'workbench.docs.body.systemStatus.secretsGreen': 'Default — no schema-drift events this service-worker lifetime.',
  'workbench.docs.body.systemStatus.secretsYellowLabel': 'Schema drift: dropped entry from',
  'workbench.docs.body.systemStatus.secretsYellowMiddle':
    "— at least one stored vault entry didn't match the current shape and was dropped on hydrate. Re-saving " +
    'from the Vault editor restores it.',
  'workbench.docs.body.systemStatus.secretsRed': 'Reserved for cipher decrypt failures; no code path emits this today.',
  'workbench.docs.body.systemStatus.liveName': 'Live',
  'workbench.docs.body.systemStatus.liveSubtitle': 'Live Variable workflow refresh',
  'workbench.docs.body.systemStatus.live1Prefix':
    'Each Live workflow refreshes on its own cadence. Per-workflow state turns on three checks: whether the ' +
    'last extractor succeeded, whether the run is within',
  'workbench.docs.body.systemStatus.live1Suffix':
    "its cadence, and how many failures it's had in a row. The three states fold into the pill via " + '"worst wins".',
  'workbench.docs.body.systemStatus.liveFreshnessCaption':
    'Fresh = clean run · stale = past 2× cadence or 1–4 failures · failing = ≥ 5 consecutive failures.',
  'workbench.docs.body.systemStatus.live2Prefix': 'Only the',
  'workbench.docs.body.systemStatus.liveActiveWorkspace': "active workspace's",
  'workbench.docs.body.systemStatus.live2Suffix':
    "workflows contribute. Inactive workspaces are excluded — you can't see or act on those rules right " +
    "now, so pilling on them would surface noise you can't reach. Switching workspaces recomputes the pill " +
    'against the new active set.',
  'workbench.docs.body.systemStatus.liveAggregationCaption':
    'Active-workspace workflows fold into one pill via max(); other workspaces are skipped.',
  'workbench.docs.body.systemStatus.liveGreenLabel': 'N workflows fresh',
  'workbench.docs.body.systemStatus.liveGreenMiddle':
    "— every active-workspace workflow's last run was OK and within 2× its cadence. Also shown as",
  'workbench.docs.body.systemStatus.liveGreenNone': 'No workflows configured',
  'workbench.docs.body.systemStatus.liveGreenSuffix': 'when there are none.',
  'workbench.docs.body.systemStatus.liveYellowLabel': 'N workflows stale or failing',
  'workbench.docs.body.systemStatus.liveYellowMiddle':
    '— at least one run is past 2× cadence, the last extractor failed, or there are 1–4 consecutive failures.',
  'workbench.docs.body.systemStatus.liveRedLabel': 'N workflows failing (5+ consecutive)',
  'workbench.docs.body.systemStatus.liveRedMiddle':
    '— any single workflow crossed five consecutive failures and is now considered failing.',
  'workbench.docs.body.systemStatus.desktopNoteTitle': 'Desktop App — product note',
  'workbench.docs.body.systemStatus.desktopNote1':
    'The desktop app is in development and ships after the extension stabilizes. Workspaces, variables, and ' +
    'team sync that integrate with the desktop app unlock then. The',
  'workbench.docs.body.systemStatus.desktopNote2':
    'subsystem flips from disabled to connecting automatically on first launch — no reinstall required.',

  // ── Concepts: Variables ─────────────────────────────────────────────
  'workbench.docs.body.variables.intro1Prefix':
    'Any templatable field — a header value, a redirect URL, a request body, a workflow step — can ' +
    'reference a variable with',
  'workbench.docs.body.variables.intro1Suffix':
    '. The value is substituted at use time, so one definition drives every rule, request, and workflow ' +
    'that mentions it. Variables live in five scopes, each with its own home in the app and its own rank ' +
    'when the same name exists in more than one.',
  'workbench.docs.body.variables.ladderCaptionPrefix': 'A bare',
  'workbench.docs.body.variables.ladderCaptionSuffix':
    'walks four scopes top-down and stops at the first hit. Live and the other namespaced scopes sit ' +
    'outside the walk.',
  'workbench.docs.body.variables.scopesHeading': 'The five scopes',
  'workbench.docs.body.variables.vaultHeading': 'Vault — secrets, this device only',
  'workbench.docs.body.variables.vault1Prefix':
    'The vault holds per-device secrets: API keys, passwords, TOTP seeds. Vault entries never sync and ' +
    'never leave the device — they stay out of workspace exports and git history. Two kinds exist:',
  'workbench.docs.body.variables.vaultKindString': 'string',
  'workbench.docs.body.variables.vault1Middle': 'entries resolve verbatim, and',
  'workbench.docs.body.variables.vaultKindTotp': 'TOTP',
  'workbench.docs.body.variables.vault1Suffix':
    'entries resolve to the current 6–8 digit code computed from the stored seed — the seed itself is never ' +
    'exposed through a template. Vault ranks highest, so a vault secret always wins a bare reference.',
  'workbench.docs.body.variables.vaultCaptionPrefix': 'Reference the secret with',
  'workbench.docs.body.variables.vaultCaptionSuffix': 'from synced entities — never paste the raw value.',
  'workbench.docs.body.variables.environmentHeading': 'Environment — switchable value sets',
  'workbench.docs.body.variables.environment1Prefix': 'Environments are named sets of variables you swap as a unit —',
  'workbench.docs.body.variables.environment1Suffix':
    ", a teammate's local setup. The active environment is picked in the header selector; a name the active " +
    "environment doesn't define falls back to the default environment before the walk continues downward. " +
    'Running with no environment selected is a valid state — resolution simply skips the scope. Rows can be ' +
    'marked secret so their values render masked in the editor.',
  'workbench.docs.body.variables.environmentCaption':
    'One name, a value per stage — switch the environment instead of duplicating rules.',
  'workbench.docs.body.variables.collectionHeading': 'Collection — scoped to one collection',
  'workbench.docs.body.variables.collection1':
    'Collection variables are defined on a collection and resolve only for the rules and requests that ' +
    "belong to it. They're the right home for values that are true of one API but not the whole workspace " +
    '— a base URL, a tenant id, a version prefix.',
  'workbench.docs.body.variables.collectionCaption':
    'Collection variables resolve only inside their own collection — elsewhere the walk passes them by.',
  'workbench.docs.body.variables.workspaceHeading': 'Workspace — shared with everyone',
  'workbench.docs.body.variables.workspace1':
    'Workspace variables are the workspace-wide globals — visible to every rule, request, and workflow, ' +
    'and synced with the workspace. They rank lowest, which makes them the natural base layer: put the ' +
    'common value here and let an environment or collection override it where needed.',
  'workbench.docs.body.variables.workspaceCaption':
    'The base layer — for values true everywhere. Not for secrets, not for per-stage values.',
  'workbench.docs.body.variables.liveHeading': 'Live — published by a workflow run',
  'workbench.docs.body.variables.live1Prefix':
    'A live variable is backed by a Live Workflow — a chain of requests that signs in, fetches a token, and ' +
    'exposes a captured value. Saving the workflow activates it; a successful run (manual or scheduled) ' +
    'publishes the exposed value, and auto-refresh re-runs the workflow to keep it fresh. Live values are ' +
    'reachable only as',
  'workbench.docs.body.variables.live1Suffix':
    "— never through a bare reference — so a rule template can't silently pick up an in-flight refresh " +
    "value when a workspace or environment variable shares the name. Editing the workflow's recipe marks " +
    'the published value stale until the next run.',
  'workbench.docs.body.variables.liveRefCaptionPrefix': 'Always the prefix —',
  'workbench.docs.body.variables.liveRefCaptionSuffix': '— and always workflow-backed, never a pasted token.',
  'workbench.docs.body.variables.liveLifecycleCaptionPrefix': 'Run succeeds → exposed capture publishes as',
  'workbench.docs.body.variables.liveLifecycleCaptionSuffix':
    '→ rules and requests consume it. The schedule re-runs the workflow.',
  'workbench.docs.body.variables.priorityHeading': 'Priority and shadowing',
  'workbench.docs.body.variables.priority1Prefix': 'A bare',
  'workbench.docs.body.variables.priority1Suffix':
    'resolves through the four real scopes in strict order — vault, then the active environment (with ' +
    'default-environment fallback), then the collection, then the workspace — and stops at the first scope ' +
    "that defines the name. Lower definitions still exist; they're just shadowed.",
  'workbench.docs.body.variables.shadowingCaptionPrefix': 'Environment beats workspace for the bare reference;',
  'workbench.docs.body.variables.shadowingCaptionSuffix': 'still reads the shadowed value.',
  'workbench.docs.body.variables.namespacePin1Prefix':
    'Every scope also has a namespace that pins resolution to it, skipping the ladder entirely:',
  'workbench.docs.body.variables.namespacePin1Suffix':
    '. Use the bare form for the normal case and the namespaced form when you mean a specific scope ' +
    "regardless of what's defined above it.",
  'workbench.docs.body.variables.tipTitle': 'Keep secrets in the vault',
  'workbench.docs.body.variables.tip1Prefix':
    "Rules, requests, and workflows sync with the workspace — the vault doesn't. Reference",
  'workbench.docs.body.variables.tip1Suffix':
    'from a synced entity and each teammate supplies their own value locally; nothing sensitive ever lands ' +
    'in the shared data.',
  'workbench.docs.body.variables.rulesHeading': 'Variables in rules',
  'workbench.docs.body.variables.rules1':
    'Almost every string a rule carries is templatable: condition values (domains, URL patterns, header ' +
    'names), header values, redirect URLs, query-param names and values, static request and response ' +
    'bodies, injected code, WS / SSE payloads, and Basic-auth credentials. The rule editor highlights each ' +
    "reference, shows the resolved value on hover, and banners any reference that doesn't resolve — an " +
    "unresolved rule can't take effect until every reference has a value.",
  'workbench.docs.body.variables.consumersCaption':
    'One templated value feeding all three consumer surfaces — substituted where each one applies.',
  'workbench.docs.body.variables.dynamicNoteTitle': 'Dynamic (JS) bodies are not templated',
  'workbench.docs.body.variables.dynamicNote1Prefix': 'Request-body and response rules in',
  'workbench.docs.body.variables.dynamicWord': 'dynamic',
  'workbench.docs.body.variables.dynamicNote1Middle':
    'mode run your JavaScript instead of substituting templates — the code computes its values itself. Only',
  'workbench.docs.body.variables.staticWord': 'static',
  'workbench.docs.body.variables.dynamicNote1Middle2': 'bodies participate in',
  'workbench.docs.body.variables.dynamicNote1Suffix': 'substitution.',
  'workbench.docs.body.variables.requestsHeading': 'Variables in requests',
  'workbench.docs.body.variables.requests1Prefix':
    'In the API client, the URL, query params, headers, auth fields, and body all resolve on Send — ' +
    "including collection variables of the collection the request lives in. A reference that can't be " +
    'resolved blocks the send with an error naming the missing variable, rather than putting a literal',
  'workbench.docs.body.variables.requests1Suffix': 'on the wire.',
  'workbench.docs.body.variables.workflowsHeading': 'Variables in workflows',
  'workbench.docs.body.variables.workflows1Prefix':
    'Each Live Workflow step resolves like a request, plus one extra scope:',
  'workbench.docs.body.variables.workflows1Suffix':
    'references a value captured by an earlier step in the same run — sign in with step 1, spend the ' +
    'session token in step 2. Step references only exist while the chain is executing; captures marked as ' +
    'exposed are what publish as live variables when the run succeeds.',
  'workbench.docs.body.variables.namespacesHeading': 'Namespace-only helpers',
  'workbench.docs.body.variables.helpers1': "Three more namespaces resolve values that aren't stored variables at all.",
  'workbench.docs.body.variables.helpersDynamicMiddle': 'runs a built-in generator —',
  'workbench.docs.body.variables.helpersFriends':
    ', and friends — producing a fresh value on every resolution: per send in the API client, per compile ' +
    'for static rules (the value is baked in until the next recompile).',
  'workbench.docs.body.variables.helpersFileMiddle': 'references a stored file by name. And',
  'workbench.docs.body.variables.helpersStepSuffix':
    ', above, only has meaning inside a running workflow chain. None of them join the bare walk — ' +
    "they're reachable only through their prefix.",
  'workbench.docs.body.variables.inspectingHeading': 'Creating and inspecting',
  'workbench.docs.body.variables.create1Prefix': 'Every scope is created from the sidebar:',
  'workbench.docs.body.variables.sidebarVault': 'Vault',
  'workbench.docs.body.variables.sidebarWorkspaceVars': 'Workspace Variables',
  'workbench.docs.body.variables.createAnd': ', and',
  'workbench.docs.body.variables.sidebarLiveVars': 'Live Variables',
  'workbench.docs.body.variables.create1Middle': 'are top-level entries; environments are added under',
  'workbench.docs.body.variables.sidebarEnvironments': 'Environments',
  'workbench.docs.body.variables.create1Middle2': '; and each collection carries its own',
  'workbench.docs.body.variables.sidebarVariables': 'Variables',
  'workbench.docs.body.variables.create1Suffix': 'page.',
  'workbench.docs.body.variables.creationMapCaption':
    'Each variable home in the sidebar, annotated with the namespace it feeds.',
  'workbench.docs.body.variables.inspect1Prefix': 'The',
  'workbench.docs.body.variables.inspect1Middle': 'tool window is the inspection surface.',
  'workbench.docs.body.variables.inScopeLabel': 'In scope',
  'workbench.docs.body.variables.inspect1Middle2':
    'lists the variables the focused rule, request, or template actually references — each resolved ' +
    'through the full ladder so you see the exact value that will apply.',
  'workbench.docs.body.variables.allScopesLabel': 'All scopes',
  'workbench.docs.body.variables.inspect1Middle3':
    'lists everything defined anywhere, grouped by priority. In any templatable field, typing',
  'workbench.docs.body.variables.inspect1Suffix':
    'opens the suggester with every resolvable name, and hovering a reference shows its resolved value and ' +
    'winning scope.',
} as const satisfies Catalog;
