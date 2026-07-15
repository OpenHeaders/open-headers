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
} as const satisfies Catalog;
