/**
 * Workbench Docs panel — the Debug Mode section body.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDebugMode = {
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
} as const satisfies Catalog;
