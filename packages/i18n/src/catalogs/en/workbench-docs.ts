/**
 * Workbench Docs panel — anchor registry (titles + summaries) and the
 * body prose for the rule-engine and product sections. The three
 * largest section corpora live in their own files
 * (`workbench-docs-system-status.ts`, `workbench-docs-variables.ts`,
 * `workbench-docs-debug-mode.ts`); all merge under
 * `workbench.docs.*` in `index.ts`.
 *
 * Diagram/illustration internals ride raw under the S18 boundary;
 * wire literals and syntax tokens ride raw inside keyed prose.
 */

import type { Catalog } from '../../types';

export const workbenchDocs = {
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

  // ── Concepts: Actions (overview) ────────────────────────────────────
  'workbench.docs.body.actions.intro1Prefix': 'An action is the',
  'workbench.docs.body.actions.introDo': 'do',
  'workbench.docs.body.actions.intro1Middle': 'part of a rule. Where a',
  'workbench.docs.body.actions.conditionLink': 'condition',
  'workbench.docs.body.actions.intro1Middle2': 'decides',
  'workbench.docs.body.actions.introWhether': 'whether',
  'workbench.docs.body.actions.intro1Middle3': 'the rule fires, the action decides',
  'workbench.docs.body.actions.introWhatChanges': 'what changes',
  'workbench.docs.body.actions.intro1Suffix':
    '. Every rule pairs a stack of AND-matched conditions with exactly one action.',
  'workbench.docs.body.actions.categories1':
    'Actions fall into three categories — modify the outgoing request, modify the incoming response, or run ' +
    'code in the page. Each action is implemented by one of two engines:',
  'workbench.docs.body.actions.engineDnr': 'DNR',
  'workbench.docs.body.actions.categoriesDnrParen': "(Chrome's",
  'workbench.docs.body.actions.categoriesDnrSuffix': ', fast and native) or',
  'workbench.docs.body.actions.engineScript': 'Script',
  'workbench.docs.body.actions.categoriesScriptParen':
    "(Open Headers' in-page engine, for things DNR can't express). See",
  'workbench.docs.body.actions.executionLink': 'How rules execute',
  'workbench.docs.body.actions.categories1Suffix': 'for the trade-offs.',
  'workbench.docs.body.actions.ruleAnatomyCaption': 'A rule = AND-matched conditions paired with exactly one action.',
  'workbench.docs.body.actions.taxonomyCaption': 'Three categories, every action with its engine tag.',
  'workbench.docs.body.actions.modifyRequestTitle': 'Modify Request',
  'workbench.docs.body.actions.tagRequest': 'before it leaves the browser',
  'workbench.docs.body.actions.modifyRequest1':
    'Reshape the outgoing request — its headers, URL parameters, body, destination, or whether it goes out ' +
    'at all. Most rules live here.',
  'workbench.docs.body.actions.headerActionsLink': 'Header Actions',
  'workbench.docs.body.actions.liHeaderActionsRequest': '— Add / Replace / Append / Remove / Merge on request headers.',
  'workbench.docs.body.actions.blockLink': 'Block',
  'workbench.docs.body.actions.liBlock': '— cancel the request at the network layer.',
  'workbench.docs.body.actions.redirectLink': 'Redirect',
  'workbench.docs.body.actions.liRedirect': '— send the request to a different URL, static or regex.',
  'workbench.docs.body.actions.queryParamsLink': 'Query Params',
  'workbench.docs.body.actions.liQueryParams': '— add, replace, or remove URL parameters.',
  'workbench.docs.body.actions.requestBodyLink': 'Request Body',
  'workbench.docs.body.actions.liRequestBody':
    '— rewrite the outgoing fetch / XHR body (static, dynamic, or GraphQL-filtered).',
  'workbench.docs.body.actions.modifyResponseTitle': 'Modify Response',
  'workbench.docs.body.actions.tagResponse': 'before the page sees it',
  'workbench.docs.body.actions.modifyResponse1':
    'Reshape the response on its way back — headers, body, or HTTP status. Useful for mocking unbuilt ' +
    'endpoints and forcing failure modes in development.',
  'workbench.docs.body.actions.liHeaderActionsResponse': '— same five operations apply to response headers.',
  'workbench.docs.body.actions.responseLink': 'Modify Response',
  'workbench.docs.body.actions.liResponse': '— mock or modify the reply: synthetic body, status, or headers.',
  'workbench.docs.body.actions.runCodeTitle': 'Run Code',
  'workbench.docs.body.actions.tagRunCode': 'inside the page or its scheduler',
  'workbench.docs.body.actions.runCode1':
    'Effects that don\'t fit "modify a request or response" cleanly — code injection and artificial latency. ' +
    'Both run through the Script engine because DNR has no equivalent.',
  'workbench.docs.body.actions.injectLink': 'Inject JS / CSS',
  'workbench.docs.body.actions.liInject':
    '— run JavaScript or CSS in the page context, before page scripts or after the DOM is ready.',
  'workbench.docs.body.actions.delayLink': 'Delay',
  'workbench.docs.body.actions.liDelay': '— add artificial latency to navigations and JS-initiated fetch / XHR.',
  'workbench.docs.body.actions.oneActionTitle': 'One action per rule',
  'workbench.docs.body.actions.oneAction1':
    'Each rule carries exactly one action. To do two things at once — add a header AND redirect, for example ' +
    '— write two rules with the same conditions. Both fire on the same request; DNR composes them in a ' +
    'documented order.',

  // ── Actions: Header Actions ─────────────────────────────────────────
  'workbench.docs.body.headerActions.intro':
    'Four operations on request and response headers — three native (Add/Replace, Append, Remove) plus one ' +
    "script-based (Merge) for value concatenation DNR can't express.",
  'workbench.docs.body.headerActions.opsCaption': 'Same starting headers, four different outcomes',
  'workbench.docs.body.headerActions.overrideTitle': 'Add / Replace',
  'workbench.docs.body.headerActions.override1':
    'Sets the header to this value. Replaces if present, adds if missing — always one header with your value.',
  'workbench.docs.body.headerActions.overrideCaption':
    'Same rule covers both cases — replaces when present, adds when absent.',
  'workbench.docs.body.headerActions.overrideWontApplyCaption':
    "If the rule's conditions don't match the request, nothing happens — no error, no-op.",
  'workbench.docs.body.headerActions.appendTitle': 'Append',
  'workbench.docs.body.headerActions.append1':
    'Adds a new header entry with the same name. The original stays — duplicate headers result. Use for ' +
    'Set-Cookie, Link, Via.',
  'workbench.docs.body.headerActions.appendCaption':
    'The original header stays; a second row with the same name is added. Both are delivered.',
  'workbench.docs.body.headerActions.appendWontApplyCaption':
    "Some headers can't be duplicated — the browser collapses them. Reach for Override or Merge instead.",
  'workbench.docs.body.headerActions.removeTitle': 'Remove',
  'workbench.docs.body.headerActions.remove1': 'Deletes all instances of this header. No value needed.',
  'workbench.docs.body.headerActions.removeCaption': 'Targeted row vanishes; everything else passes through unchanged.',
  'workbench.docs.body.headerActions.removeWontApplyCaption':
    "If the header isn't there, nothing happens — no error, just a no-op.",
  'workbench.docs.body.headerActions.mergeTitle': 'Merge',
  'workbench.docs.body.headerActions.merge1Prefix':
    'Reads the existing value at runtime and appends yours with a separator. Defaults to',
  'workbench.docs.body.headerActions.merge1Middle': 'for Cookie and',
  'workbench.docs.body.headerActions.merge1Suffix': 'for others. The separator can be empty for direct concatenation.',
  'workbench.docs.body.headerActions.mergeCaption': 'Existing value stays; your value is appended after the separator.',
  'workbench.docs.body.headerActions.mergeWontApplyCaption':
    'Script-engine only — page navigations and static resources flow through untouched.',
  'workbench.docs.body.headerActions.mergeLimitation':
    "Merge is invisible in DevTools and can't read browser-default headers (Accept, User-Agent) — only " +
    'headers explicitly set by page code.',

  // ── Actions: Block ──────────────────────────────────────────────────
  'workbench.docs.body.block.intro':
    'Cancels matching requests at the network layer. The browser receives a network error and the page sees ' +
    'the request fail as if the server were unreachable.',
  'workbench.docs.body.block.howTitle': 'How it works',
  'workbench.docs.body.block.how1Prefix': 'Compiles to a DNR',
  'workbench.docs.body.block.how1Suffix':
    'action with no body. Applies regardless of resource type — pages, sub-frames, scripts, images, fonts, ' +
    'fetch, XHR — so a single rule covers everything unless you scope it down with a Resource Type condition.',
  'workbench.docs.body.block.blockCaption':
    'Request is killed before it leaves the browser; the page sees a network error.',
  'workbench.docs.body.block.wontApplyCaption':
    'Already-loaded resources stay loaded — Block only catches future requests.',
  'workbench.docs.body.block.whenTitle': 'When to use this',
  'workbench.docs.body.block.when1Prefix':
    'Blocking ad / analytics / tracking domains, simulating outages for a single host, or denying access to ' +
    'one endpoint while leaving the rest of an API reachable. To block only the document of a page (not its ' +
    'sub-resources), add a Resource Type condition of',
  'workbench.docs.body.block.when1Suffix': '.',
  'workbench.docs.body.block.useCasesCaption':
    'Four typical patterns — scope each one with Conditions (Domains, URL Pattern, Resource Type).',
  'workbench.docs.body.block.note1Prefix': 'Blocking a',
  'workbench.docs.body.block.note1Suffix':
    'request renders an "ERR_BLOCKED_BY_CLIENT" page in Chrome. Sub-resource blocks happen silently — what ' +
    "the user sees depends on the page's own error handling.",

  // ── Actions: Redirect ───────────────────────────────────────────────
  'workbench.docs.body.redirect.intro':
    'Redirects matching requests to a different URL. Supports static URLs and regex capture groups.',
  'workbench.docs.body.redirect.staticTitle': 'Static redirect',
  'workbench.docs.body.redirect.static1':
    'Enter a full URL to redirect every matching request to the same destination.',
  'workbench.docs.body.redirect.staticCaption': 'Same destination for every matching request — full URL substitution.',
  'workbench.docs.body.redirect.regexTitle': 'Regex redirect',
  'workbench.docs.body.redirect.regex1Prefix': 'Pair with a URL Regex condition. Use',
  'workbench.docs.body.redirect.regex1Suffix': ', etc. to reference capture groups in the destination URL.',
  'workbench.docs.body.redirect.regexCaption':
    "The capture group's matched text gets substituted into the destination URL.",
  'workbench.docs.body.redirect.wontApplyCaption':
    "Redirect doesn't retro-apply to already-loaded pages. Loops are silently capped by Chrome.",
  'workbench.docs.body.redirect.whenTitle': 'When to use this',
  'workbench.docs.body.redirect.when1':
    'Forcing HTTP → HTTPS, migrating users from an old domain, rewriting API versions, and proxying CDN ' +
    'traffic to a local dev server are the four typical patterns. Pair Static with full URLs you know ' +
    'up-front; reach for Regex when the path needs to carry through the redirect.',
  'workbench.docs.body.redirect.useCasesCaption':
    'Four typical patterns — pick Regex when the destination path depends on the match.',

  // ── Actions: Query Params ───────────────────────────────────────────
  'workbench.docs.body.queryParam.introPrefix':
    'Modify URL query parameters before the request leaves the browser. Compiles to a DNR',
  'workbench.docs.body.queryParam.introSuffix': 'action.',
  'workbench.docs.body.queryParam.addTitle': 'Add / Replace',
  'workbench.docs.body.queryParam.add1': 'Adds the parameter if missing, or replaces its value if already present.',
  'workbench.docs.body.queryParam.addCaption':
    'Adds when missing, replaces when present — always one matching param with your value.',
  'workbench.docs.body.queryParam.replaceOnlyTitle': 'Replace only',
  'workbench.docs.body.queryParam.replaceOnly1Prefix': 'Replaces the value',
  'workbench.docs.body.queryParam.replaceOnlyStrong': 'only when the parameter is already present',
  'workbench.docs.body.queryParam.replaceOnly1Middle':
    '. URLs without the param are left untouched. Use this to canonicalize a value (e.g. force',
  'workbench.docs.body.queryParam.replaceOnly1Suffix':
    "on URLs already carrying any region) without injecting it into URLs that didn't have it.",
  'workbench.docs.body.queryParam.replaceOnlyCaption':
    'Replaces only existing values — URLs without the param are untouched.',
  'workbench.docs.body.queryParam.removeTitle': 'Remove',
  'workbench.docs.body.queryParam.remove1': 'Removes specific parameters by name. The value is ignored.',
  'workbench.docs.body.queryParam.removeCaption': 'Named param goes away; every other query param passes through.',
  'workbench.docs.body.queryParam.removeAllTitle': 'Remove all',
  'workbench.docs.body.queryParam.removeAll1':
    "Strips the entire query string. Can't be combined with Add / Replace in the same rule.",
  'workbench.docs.body.queryParam.removeAllCaption': 'Strips the whole query in one step — the URL ends up bare.',
  'workbench.docs.body.queryParam.wontApplyCaption':
    'Remove All conflicts with Add / Replace at the DNR layer — split into two rules.',
  'workbench.docs.body.queryParam.whenTitle': 'When to use this',
  'workbench.docs.body.queryParam.when1':
    'Forcing a debug flag, canonicalizing region or locale, scrubbing tracking params, or stripping all ' +
    'query strings for privacy. Each one maps cleanly to one of the four operations above.',
  'workbench.docs.body.queryParam.useCasesCaption':
    'Four typical patterns — pick the operation that matches your intent.',

  // ── Actions: Inject JS / CSS ────────────────────────────────────────
  'workbench.docs.body.inject.intro':
    "Inject JavaScript or CSS into matching pages. Code runs in the page's context via a content script.",
  'workbench.docs.body.inject.timingCaption': 'Insertion timing — pre-page-script (ASAP) vs DOM-safe (After Load).',
  'workbench.docs.body.inject.scriptTitle': 'Script injection',
  'workbench.docs.body.inject.script1': 'Inline code or an external URL. Choose insertion timing:',
  'workbench.docs.body.inject.asapStrong': 'As Soon As Possible',
  'workbench.docs.body.inject.asap1':
    "— runs before the page's own scripts. Useful for monkey-patches that need to win the race (e.g. wrapping",
  'workbench.docs.body.inject.asap1Suffix': 'before app code captures a reference).',
  'workbench.docs.body.inject.afterStrong': 'After Page Load',
  'workbench.docs.body.inject.after1':
    '— runs once the page has parsed. Safer default for code that reads the DOM, since elements are ' +
    'guaranteed to exist.',
  'workbench.docs.body.inject.scriptCaption':
    'Script lands as a <script> tag in the page — sees the same globals as page JS.',
  'workbench.docs.body.inject.cssTitle': 'CSS injection',
  'workbench.docs.body.inject.css1Prefix': 'Inject custom CSS as a',
  'workbench.docs.body.inject.css1Suffix':
    'tag. Useful for dark-mode overrides, hiding noisy elements, or per-environment theming.',
  'workbench.docs.body.inject.cssCaption': 'CSS is appended as a <style> tag with normal CSS specificity.',
  'workbench.docs.body.inject.wontApplyCaption': 'Sandboxed iframes and strict CSP pages block injected scripts.',
  'workbench.docs.body.inject.whenTitle': 'When to use this',
  'workbench.docs.body.inject.when1':
    'Monkey-patching browser APIs before app code grabs them, forcing a dark-mode theme, hiding noisy UI ' +
    'elements, and seeding window-level feature flags before the page initializes.',
  'workbench.docs.body.inject.useCasesCaption':
    'Four typical patterns — ASAP timing is required for the first and fourth.',

  // ── Actions: Delay ──────────────────────────────────────────────────
  'workbench.docs.body.delay.intro':
    'Adds artificial latency to matching requests. Three lanes run in parallel depending on the request kind.',
  'workbench.docs.body.delay.routingCaption': 'Delay routing — three lanes for three request kinds.',
  'workbench.docs.body.delay.navHeading': 'Document & iframe navigations',
  'workbench.docs.body.delay.nav1Prefix': 'Routed through a local waiting page. Honors delays up to',
  'workbench.docs.body.delay.navMs': '30,000 ms',
  'workbench.docs.body.delay.nav1Suffix': "— Chrome's DNR redirect ceiling.",
  'workbench.docs.body.delay.navCaption':
    'A local waiting page holds the navigation for N ms, then forwards to the real target.',
  'workbench.docs.body.delay.xhrHeading': 'JS-initiated XHR / fetch',
  'workbench.docs.body.delay.xhr1Prefix': 'Intercepted by a',
  'workbench.docs.body.delay.xhr1Middle': 'monkey-patch. Capped at',
  'workbench.docs.body.delay.xhrMs': '5,000 ms',
  'workbench.docs.body.delay.xhr1Suffix':
    "to avoid starving Chrome's HTTP connection pool — values above are clamped on the wire.",
  'workbench.docs.body.delay.xhrCaption':
    'setTimeout inside the page-level patch holds the call before forwarding to the network.',
  'workbench.docs.body.delay.wontApplyCaption':
    'Sub-resources and service-worker fetches escape the page-level monkey-patch.',
  'workbench.docs.body.delay.whenTitle': 'When to use this',
  'workbench.docs.body.delay.when1':
    'Surfacing loading-state regressions, exercising debounce/throttle code paths, exposing race conditions ' +
    'between concurrent requests, and approximating slow-network conditions during local development.',
  'workbench.docs.body.delay.useCasesCaption': 'Four typical patterns — pair with URL Pattern or Domains to scope.',
  'workbench.docs.body.delay.desktopNoteTitle': 'Desktop App — product note',
  'workbench.docs.body.delay.desktopNote1':
    'Throttling static resources (images, scripts, stylesheets, fonts) needs a real local network layer that ' +
    'can hold connections open and stream bytes — out of reach for an extension. The desktop app picks that ' +
    'up soon.',

  // ── Actions: Request Body ───────────────────────────────────────────
  'workbench.docs.body.requestBody.introPrefix':
    'Override or transform request bodies before they leave the browser. Script-based — intercepts',
  'workbench.docs.body.requestBody.introAnd': 'and',
  'workbench.docs.body.requestBody.introDot': '.',
  'workbench.docs.body.requestBody.interceptCaption':
    'The rule fires between page.js and the network — three transform shapes',
  'workbench.docs.body.requestBody.staticTitle': 'Static body',
  'workbench.docs.body.requestBody.static1':
    "Replaces the entire request body with a fixed string. Works for both REST and GraphQL — the rule doesn't " +
    'parse the body, it substitutes wholesale.',
  'workbench.docs.body.requestBody.staticCaption': 'Whole body replaced — original is discarded.',
  'workbench.docs.body.requestBody.dynamicTitle': 'Dynamic body',
  'workbench.docs.body.requestBody.dynamic1':
    'Write a function that receives the original body and request context, then returns the modified body. ' +
    'The function receives',
  'workbench.docs.body.requestBody.dynamicDot': '.',
  'workbench.docs.body.requestBody.dynamicCaption': 'Function sees the original; returns whatever should be sent.',
  'workbench.docs.body.requestBody.graphqlTitle': 'GraphQL filter',
  'workbench.docs.body.requestBody.graphql1Prefix':
    "When Resource Type is GraphQL, the rule fires only on requests whose JSON payload's configured field " +
    'matches the value. The runtime parses the request body as JSON, reads the field named by',
  'workbench.docs.body.requestBody.graphql1Middle': ', and tests it against',
  'workbench.docs.body.requestBody.graphql1Middle2': 'using the chosen operator (',
  'workbench.docs.body.requestBody.graphql1Middle3': 'for exact match,',
  'workbench.docs.body.requestBody.graphql1Suffix': 'for substring).',
  'workbench.docs.body.requestBody.graphql2Prefix': 'Common keys:',
  'workbench.docs.body.requestBody.graphql2Middle': 'for the named operation,',
  'workbench.docs.body.requestBody.graphql2Suffix':
    'for a substring of the query text. Requests without a JSON body, or with a missing or non-matching ' +
    'field, pass through untouched.',
  'workbench.docs.body.requestBody.graphqlCaption':
    "Field-level gate — operations that don't match flow through untouched.",
  'workbench.docs.body.requestBody.wontApplyCaption':
    "GET/HEAD have nothing to replace; static resources don't enter the script intercept.",
  'workbench.docs.body.requestBody.whenTitle': 'When to use this',
  'workbench.docs.body.requestBody.when1':
    'Forcing test fixtures, stamping every payload with metadata (debug flags, request IDs), mocking ' +
    'specific GraphQL operations, and anonymizing PII before replay are the four typical patterns.',
  'workbench.docs.body.requestBody.useCasesCaption':
    'Four typical patterns — pair with URL Pattern or Domains to scope.',

  // ── Actions: Modify Response ────────────────────────────────────────
  'workbench.docs.body.response.introPrefix':
    'Intercept API calls and return custom responses — full control over status code, body, and response ' +
    'headers. Script-based — intercepts',
  'workbench.docs.body.response.introAnd': 'and',
  'workbench.docs.body.response.introDot': '.',
  'workbench.docs.body.response.flowCaption':
    'Static skips the network entirely; Dynamic hits it first, then transforms.',
  'workbench.docs.body.response.staticTitle': 'Static response',
  'workbench.docs.body.response.static1':
    'Returns a fixed body with full control over the synthetic response — status code, Content-Type, and any ' +
    'additional response headers (Set-Cookie, CORS headers, custom flags). The real request is never made. ' +
    'Useful for offline development against a known fixture.',
  'workbench.docs.body.response.staticCaption':
    'Server is never contacted — page receives the fixture as if it came from the wire.',
  'workbench.docs.body.response.dynamicTitle': 'Dynamic response',
  'workbench.docs.body.response.dynamic1':
    'The real request is made first. Your function receives the response and request context, then returns ' +
    'the modified response. The function receives',
  'workbench.docs.body.response.dynamicDot': '.',
  'workbench.docs.body.response.dynamic2':
    'Status code, Content-Type, and response-header fields set on the rule still apply on top of the ' +
    "function's return value, so you can mutate the body while letting the rule control wrapper headers.",
  'workbench.docs.body.response.dynamicCaption': 'Real call happens first; the function rewrites whatever comes back.',
  'workbench.docs.body.response.graphqlTitle': 'GraphQL filter',
  'workbench.docs.body.response.graphql1':
    "When Resource Type is GraphQL, the rule fires only on requests whose JSON payload's configured field " +
    'matches the value you set (Equals or Contains) — so a single endpoint that multiplexes many operations ' +
    "can be intercepted one operation at a time. Requests whose payload doesn't match pass straight through " +
    'to the network untouched.',
  'workbench.docs.body.response.wontApplyCaption':
    'Static resources and page navigations never enter the script intercept.',
  'workbench.docs.body.response.whenTitle': 'When to use this',
  'workbench.docs.body.response.when1':
    'Offline development against a fixture, simulating specific error responses, redacting PII before it ' +
    'reaches the page, and exercising edge-case payload shapes that are hard to reproduce against a real ' +
    'backend.',
  'workbench.docs.body.response.useCasesCaption':
    'Four typical patterns — pick Static for fixtures, Dynamic for real-data transforms.',

  // ── Reference: Conditions ───────────────────────────────────────────
  'workbench.docs.body.conditions.intro1Prefix':
    'A condition is a filter on one attribute of an outgoing request. Stack multiple conditions and they ' +
    'combine with AND logic — every condition must match for the rule to fire. Each condition maps directly ' +
    'to a Chrome',
  'workbench.docs.body.conditions.intro1Suffix': 'field.',
  'workbench.docs.body.conditions.intro2Prefix': 'Most conditions also have an',
  'workbench.docs.body.conditions.exclStrong': 'Excl.',
  'workbench.docs.body.conditions.intro2Suffix':
    'variant in the rule editor — Excl. Methods, Excl. Resources, Excl. Initiator, Excl. Resp Header — that ' +
    'flips the match (e.g., "everything except these methods"). Use them whenever the negative set is ' +
    'smaller than the positive one.',
  'workbench.docs.body.conditions.anatomyCaption':
    'A rule pairs AND-matched conditions with one action — conditions decide whether the rule fires.',
  'workbench.docs.body.conditions.matchingCaption':
    'Each condition checks one request attribute. All must match for the rule to fire.',
  'workbench.docs.body.conditions.hostVsOriginCaption':
    "The page URL and the fetch's destination URL are tracked separately — that's why there are two domain " +
    'conditions.',
  'workbench.docs.body.conditions.urlPatternTitle': 'URL Pattern',
  'workbench.docs.body.conditions.urlPattern1Prefix': 'Wildcard pattern on the full URL. Use',
  'workbench.docs.body.conditions.urlPattern1Middle': 'to match any characters. The protocol must be specified:',
  'workbench.docs.body.conditions.urlPattern1Middle2': 'for any,',
  'workbench.docs.body.conditions.urlPattern1Suffix': 'for HTTPS only.',
  'workbench.docs.body.conditions.urlPatternCaption':
    'Gold = wildcard, green = literal. Each test URL below shows whether the pattern matches it.',
  'workbench.docs.body.conditions.urlRegexTitle': 'URL Regex',
  'workbench.docs.body.conditions.urlRegex1':
    "RE2 regular expression on the full URL including protocol. For matching that wildcards can't express. " +
    'Cannot be combined with URL Pattern in the same rule.',
  'workbench.docs.body.conditions.urlRegexCaption':
    'Purple = real regex syntax. Green = literal characters. Each test URL below shows whether the regex ' + 'matches.',
  'workbench.docs.body.conditions.requestDomainsTitle': 'Request Domains',
  'workbench.docs.body.conditions.requestDomains1Prefix':
    'Matches a domain plus every one of its subdomains, automatically. Enter the apex domain once; the rule ' +
    'covers',
  'workbench.docs.body.conditions.requestDomains1Suffix': ', and any deeper nesting without wildcards.',
  'workbench.docs.body.conditions.requestDomainsCaption':
    'One value, all subdomains. The boundary cases below show what counts as a true subdomain.',
  'workbench.docs.body.conditions.excludeDomainsTitle': 'Exclude Domains',
  'workbench.docs.body.conditions.excludeDomains1':
    "Subtracts hosts from another condition's matches — same subdomain semantics as Request Domains, so " +
    "excluding a host also excludes its subdomains. Doesn't match anything on its own.",
  'workbench.docs.body.conditions.excludeDomainsCaption':
    'Green include narrows to a candidate set; red exclude removes some of those. Subdomains follow.',
  'workbench.docs.body.conditions.initiatorDomainsTitle': 'Initiator Domains',
  'workbench.docs.body.conditions.initiatorDomains1':
    "Matches by which page is open when the request is made — the request's origin, not its destination. The " +
    'same fetch call to the same URL can match or miss depending on which tab the user is browsing.',
  'workbench.docs.body.conditions.initiatorDomainsCaption':
    'Same destination, two different page contexts. The initiator decides which one matches.',
  'workbench.docs.body.conditions.methodsTitle': 'Methods',
  'workbench.docs.body.conditions.methods1':
    "Filter by HTTP verb. Multi-select — pick the methods that should match; the rest don't trigger the " +
    'rule. Leave the condition off entirely to match every method.',
  'workbench.docs.body.conditions.methodsCaption':
    'Orange pills are selected; gray are skipped. Test requests below trace each verb to its outcome.',
  'workbench.docs.body.conditions.resourceTypesTitle': 'Resource Types',
  'workbench.docs.body.conditions.resourceTypes1Prefix':
    'Filter by what kind of resource is being loaded — page navigations, XHR/fetch, scripts, images, fonts, ' +
    'and more. Multi-select like Methods. See the',
  'workbench.docs.body.conditions.resourceTypesLink': 'Resource Types',
  'workbench.docs.body.conditions.resourceTypes1Suffix':
    'reference for the full list with code names and concrete examples.',
  'workbench.docs.body.conditions.resourceTypesCaption':
    'Purple kinds match; gray kinds are skipped. Each test request shows its kind inline.',
  'workbench.docs.body.conditions.domainTypeTitle': 'Domain Type',
  'workbench.docs.body.conditions.domainType1Prefix': 'Classifies each request by its relationship to the page —',
  'workbench.docs.body.conditions.domainType1Middle': "when the destination shares the page's registrable domain,",
  'workbench.docs.body.conditions.domainType1Suffix':
    "when it doesn't. Common use: blocking trackers (match only thirdParty) or scoping a rule to your own " +
    'services (match only firstParty).',
  'workbench.docs.body.conditions.domainTypeCaption':
    'Page banner sets the origin; the selector picks which type matches; the table shows the verdict per ' +
    'destination.',
  'workbench.docs.body.conditions.headersTitle': 'Response Headers',
  'workbench.docs.body.conditions.headers1':
    "Match responses carrying a specific header with a specific value. Chrome's DNR doesn't expose " +
    'request-header matching — this condition is response-side only. Both the header name and the value are ' +
    'compared as exact strings (no wildcards, no partial matching) and the header must actually be present ' +
    'on the response.',
  'workbench.docs.body.conditions.headersCaption':
    'Two pills (name + value) joined by =, then test response headers hitting each failure mode.',

  // ── Open Headers: Paradigm ──────────────────────────────────────────
  'workbench.docs.body.paradigm.oneExtensionHeading': 'Everything in one extension',
  'workbench.docs.body.paradigm.oneExtension1':
    'Three product categories have historically split this surface area between them: desktop proxies handle HTTP ' +
    'interception, cloud API platforms hold your requests and collections, and lightweight header extensions cover ' +
    'the "just rewrite one header" case. None of them ships the others. Open Headers does — inside a single browser ' +
    'extension, with one workspace store powering every surface.',
  'workbench.docs.body.paradigm.convergenceCaption':
    'Three legacy categories converge into one install. Nobody else ships this combination inside the extension.',
  'workbench.docs.body.paradigm.ruleEngineHeading': 'Enterprise-grade rule engine',
  'workbench.docs.body.paradigm.ruleEngine1Prefix':
    "The rule engine isn't a single trick stretched across nine UIs — it's two real execution paths with one shared " +
    'language on top.',
  'workbench.docs.body.paradigm.dnrNativeStrong': 'DNR-native',
  'workbench.docs.body.paradigm.ruleEngine1Middle': "rules compile down to Chrome's",
  'workbench.docs.body.paradigm.ruleEngine1Middle2':
    'API and catch every browser-issued request (pages, sub-frames, fetch, XHR, images, fonts, scripts). The',
  'workbench.docs.body.paradigm.scriptEngineStrong': 'script engine',
  'workbench.docs.body.paradigm.ruleEngine1Suffix':
    "picks up where DNR can't reach — value-merging headers, transforming bodies, mocking responses, injecting " +
    'code, delaying calls. Both engines read the same condition language and the same five variable scopes, so a ' +
    'rule you wrote against DNR moves to the script engine by changing one action type.',
  'workbench.docs.body.paradigm.ruleEngineCaption':
    'Two execution paths, nine rule categories, one shared condition + variable language.',
  'workbench.docs.body.paradigm.apiCatalogHeading': 'Full API request catalog',
  'workbench.docs.body.paradigm.apiCatalog1':
    'Every capability a desktop API client ships — request building, environments, OAuth 2.0 (including PKCE + ' +
    'Client Credentials + refresh), pre- and post-response scripts, multipart with content-addressed file blobs, ' +
    'collections + folders, GraphQL with schema introspection — lives inside the extension. Same workspace store as ' +
    'the rules, same five variable scopes, same surfaces. Bring your collections from another platform and keep ' +
    "working; nothing exports back out to a cloud you don't control.",
  'workbench.docs.body.paradigm.apiCatalogCaption':
    'The request editor, with protocol support, every auth type, scripts, files, and collections — inside the ' +
    'extension.',
  'workbench.docs.body.paradigm.localFirstHeading': 'Local-first by design',
  'workbench.docs.body.paradigm.localFirst1Prefix':
    '"Local-first" is a posture, not a feature. The extension has no account system, no cloud relay, no tracking — ' +
    'the only usage data is anonymous feature counting, inspectable byte-for-byte and off with one switch — and ' +
    'you have a real choice in',
  'workbench.docs.body.paradigm.localFirstWhere': 'where',
  'workbench.docs.body.paradigm.localFirst1Suffix':
    'the back-end lives. Four hosting options, all local-only, all under your control: the in-browser service ' +
    "worker (today, zero setup), the desktop app's embedded back-end, a standalone local server serving every Open " +
    'Headers surface on one machine, or a back-end you self-host on your own VM. Every option preserves the same ' +
    'guarantees; the trade-off is reach, not ownership.',
  'workbench.docs.body.paradigm.localFirst2':
    'Team collaboration ships through user-controlled storage backends (Git) — not through a vendor server.',
  'workbench.docs.body.paradigm.frontEnds1Prefix': 'The same principle applies to',
  'workbench.docs.body.paradigm.frontEndsHow': 'how',
  'workbench.docs.body.paradigm.frontEnds1Suffix':
    'you reach that data. The browser extension is the default front-end — four surfaces inside the browser. ' +
    'A native desktop app, a CLI, and a remote web app ship alongside it. Every front-end speaks to a back-end ' +
    'of your choice; pick any combination, and every surface stays in sync.',
  'workbench.docs.body.paradigm.autoSyncHeading': 'Auto-Sync without losing your work',
  'workbench.docs.body.paradigm.autoSync1Prefix':
    'Cross-device sync is usually where local-first products fold and ask you to trust their cloud. Open Headers ' +
    'solves it at the',
  'workbench.docs.body.paradigm.perFieldStrong': 'per-field',
  'workbench.docs.body.paradigm.autoSync1Middle': "level: the popup toggling a rule's",
  'workbench.docs.body.paradigm.autoSync1Suffix':
    'flag and the workbench rewriting a header value in the same rule both land, in any order, with no stale-draft ' +
    'banner and no overwrite. The same approach scales from the four surfaces of one extension to a local ' +
    'server backing extension + desktop + CLI, and to multi-user team workspaces through a Git remote — ' +
    'without ever needing a vendor server in the middle.',
  'workbench.docs.body.paradigm.fieldSyncCaption':
    'Two surfaces, one rule, different fields — both edits land, nothing overwritten.',
  'workbench.docs.body.paradigm.noteCalloutPrefix':
    'Want to see how this compares to other tools you might have tried?',
  'workbench.docs.body.paradigm.comparisonLink': 'How we compare',
  'workbench.docs.body.paradigm.noteCalloutMiddle': 'is next. Want the whole platform in one view? Skip to',
  'workbench.docs.body.paradigm.roadmapLink': 'Every surface, shipped',
  'workbench.docs.body.paradigm.noteCalloutSuffix': '.',

  // ── Open Headers: Comparison ────────────────────────────────────────
  'workbench.docs.body.comparison.intro1':
    "The shortest version: Open Headers is what you'd build if you took the request-shaping power of a desktop " +
    'proxy, the rule library of a cloud API platform, and the always-on surface of a header-only extension, and ' +
    'asked them to share a single store.',
  'workbench.docs.body.comparison.matrixCaption':
    'Three product categories, one set of trade-offs each — and where Open Headers lands.',
  'workbench.docs.body.comparison.vsCloudHeading': 'vs cloud API platforms',
  'workbench.docs.body.comparison.vsCloud1':
    'Cloud-hosted tools expect your traffic, credentials, and rule definitions to live on their servers. That model ' +
    "assumes you're fine with that data leaving your machine — and with maintaining an account to access your own " +
    "work. Open Headers doesn't make either assumption. Everything stays local; team collaboration ships through " +
    "user-controlled storage (Git), not through a vendor's database.",
  'workbench.docs.body.comparison.vsProxiesHeading': 'vs desktop proxies',
  'workbench.docs.body.comparison.vsProxies1Prefix':
    "Proxies route your full traffic through a separate process. They're powerful but heavy: install a binary, " +
    "install a CA certificate, configure each app to point at the proxy port. Open Headers uses Chrome's",
  'workbench.docs.body.comparison.vsProxies1Suffix':
    'API for static traffic and a per-page script engine for dynamic transforms. No proxy port, no CA cert, no ' +
    "per-app config — and matched rules apply with the page's own permissions, not a man-in-the-middle's.",
  'workbench.docs.body.comparison.vsHeaderOnlyHeading': 'vs header-only extensions',
  'workbench.docs.body.comparison.vsHeaderOnly1Prefix':
    'Header-only extensions handle exactly one rule type and stop there. Open Headers handles',
  'workbench.docs.body.comparison.nineLink': 'nine',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle': '— header Add / Replace / Append / Remove / Merge,',
  'workbench.docs.body.comparison.blockLink': 'Block',
  'workbench.docs.body.comparison.redirectLink': 'Redirect',
  'workbench.docs.body.comparison.queryParamsLink': 'Query Params',
  'workbench.docs.body.comparison.injectLink': 'Inject',
  'workbench.docs.body.comparison.delayLink': 'Delay',
  'workbench.docs.body.comparison.requestBodyLink': 'Request Body',
  'workbench.docs.body.comparison.responseLink': 'Response',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle2': '— all driven by the same',
  'workbench.docs.body.comparison.conditionLanguageLink': 'condition language',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle3': ', all observable through the same',
  'workbench.docs.body.comparison.requestTrackingLink': 'request-tracking',
  'workbench.docs.body.comparison.vsHeaderOnly1Suffix': 'surface.',
  'workbench.docs.body.comparison.whyMattersTitle': 'Why this matters in practice',
  'workbench.docs.body.comparison.whyMatters1':
    'Most workflows hit more than one of these categories. Mocking an API response, blocking a third-party tracker, ' +
    'and forcing a debug header onto one specific environment are three different rule types — three different ' +
    'installs in the legacy world. Here, they share one workspace.',

  // ── Open Headers: Roadmap ───────────────────────────────────────────
  'workbench.docs.body.roadmap.intro1Prefix':
    'Open Headers started local-only — one extension on one device. Every milestone below extends that shape ' +
    'without breaking it, and every one of them has shipped. Cross-user sync ships through',
  'workbench.docs.body.roadmap.userControlledStrong': 'user-controlled',
  'workbench.docs.body.roadmap.intro1Suffix':
    'means — Git repositories and self-hosted deployments — never a vendor-hosted cloud.',
  'workbench.docs.body.roadmap.gitHeading': 'Workspace collaboration via Git (Team-ready)',
  'workbench.docs.body.roadmap.git1Prefix':
    'Workspaces serialize to YAML in a Git repository you control. Pull syncs; push shares; merge conflicts resolve ' +
    "through Git's existing tooling. No central server, no account, no vendor lock-in. Real-time presence is",
  'workbench.docs.body.roadmap.gitAnd': 'and',
  'workbench.docs.body.roadmap.git1Suffix': '— durable, auditable, already understood.',
  'workbench.docs.body.roadmap.desktopHeading': 'Desktop app',
  'workbench.docs.body.roadmap.desktop1':
    'A native binary that runs the same workspace store as the extension. Useful for surfaces an extension ' +
    "can't reach — system-level traffic shaping, multi-window editing, deeper filesystem integration. The two share " +
    'the same on-disk format, so opening the desktop app on a workspace the extension owns is a read, not a ' +
    'migration.',
  'workbench.docs.body.roadmap.mcpHeading': 'MCP Server — AI agent control',
  'workbench.docs.body.roadmap.mcp1Prefix': 'Open Headers exposes itself over',
  'workbench.docs.body.roadmap.mcpStrong': 'Model Context Protocol',
  'workbench.docs.body.roadmap.mcp1Suffix':
    'so any MCP-capable AI client — Claude Desktop, Claude Code, Cursor, VS Code, Cline, and the growing ecosystem ' +
    'behind it — can drive your workspace directly. Ask the agent in plain English to add a header rule, run a ' +
    'saved request against staging, switch environments, diff two workspaces, or import a Postman collection; the ' +
    'agent translates that to MCP tool calls and your workbench reflects the result.',
  'workbench.docs.body.roadmap.mcp2Prefix': 'The server runs',
  'workbench.docs.body.roadmap.mcpLocalOnlyStrong': 'local-only by default',
  'workbench.docs.body.roadmap.mcp2Middle':
    '(stdio transport, paired one-to-one with a client on the same machine) and',
  'workbench.docs.body.roadmap.mcpRemoteStrong': 'HTTP/SSE for remote',
  'workbench.docs.body.roadmap.mcp2Suffix':
    'when you self-host. No vendor relay; your agent talks directly to your installation. Tool calls run with the ' +
    'same workspace permissions you have — secrets stay behind the vault, sensitive operations stay opt-in.',
  'workbench.docs.body.roadmap.daemonHeading': 'Local / LAN server for cross-device sync',
  'workbench.docs.body.roadmap.daemon1':
    'A server you can run on your machine, your LAN, or a tunneled host. Extension, desktop app, and CLI all ' +
    'become clients of the same server — same workspaces, same rules, same vault, across every device you use. The ' +
    'server stays on the local network; there is no opt-in cloud path layered on top.',
  'workbench.docs.body.roadmap.cliHeading': 'CLI',
  'workbench.docs.body.roadmap.cli1':
    'Headless scripting and CI integration. List rules, toggle environments, run a single saved request from the ' +
    'shell, diff a workspace against another. The CLI talks to the same server as the extension and desktop app, so ' +
    'automation stays in sync with what you see in the UI.',
  'workbench.docs.body.roadmap.webAppHeading': 'Self-hosted VM deployment + Web App',
  'workbench.docs.body.roadmap.webApp1':
    'The same UI shipped as a web bundle you can serve from your own origin. For locked-down corporate browsers, ' +
    "kiosk devices, or any environment where installing an extension isn't an option — and for users who want a " +
    'branded deployment of Open Headers under their own domain.',
  'workbench.docs.body.roadmap.importersHeading': 'Importers',
  'workbench.docs.body.roadmap.importers1':
    'Alongside the cURL / HAR / Postman importers: Insomnia collections, OpenAPI specs, and full HAR request ' +
    'imports (not just headers) — all live today. Importer parity is how Open Headers earns adoption from people ' +
    'already invested in another tool — bring your collection across in one step, keep working.',
  'workbench.docs.body.roadmap.cloudCalloutTitle': 'What about a hosted cloud back-end?',
  'workbench.docs.body.roadmap.cloudCallout1':
    'Not on the menu for now — if you want a cloud-hosted back-end, you can self-host it on your own VM (see ' +
    'above). The focus right now is the product, not running and maintaining free cloud infrastructure ' +
    "for end users. Happy to help if you're setting up a self-hosted deployment and run into trouble; just not in a " +
    'position to provide hosting itself.',

  // ── Docs sub-anchor (i) popovers (DOC_ANCHOR_INFO) ──────────────────
  'workbench.docs.anchor.override.title': 'Add / Replace',
  'workbench.docs.anchor.override.summary':
    'Sets the header to this value — added when missing, replacing any existing value.',
  'workbench.docs.anchor.append.title': 'Append',
  'workbench.docs.anchor.append.summary':
    'Appends this value to the header’s existing value. Only standard list-valued headers support appending — on ' +
    'others the rule is saved as a draft.',
  'workbench.docs.anchor.remove.title': 'Remove',
  'workbench.docs.anchor.remove.summary':
    'Strips the header from matching traffic entirely; the value field is unused.',
  'workbench.docs.anchor.merge.title': 'Merge',
  'workbench.docs.anchor.merge.summary':
    'Merges this value into the header’s existing list, skipping values already present.',
  'workbench.docs.anchor.qpAdd.title': 'Add / Replace',
  'workbench.docs.anchor.qpAdd.summary':
    'Sets the parameter on the URL — added when missing, replaced when already present.',
  'workbench.docs.anchor.qpOverride.title': 'Replace Only',
  'workbench.docs.anchor.qpOverride.summary':
    'Replaces the parameter’s value only when the URL already carries it; URLs without it pass unchanged.',
  'workbench.docs.anchor.qpRemove.title': 'Remove',
  'workbench.docs.anchor.qpRemove.summary': 'Removes the parameter from matching URLs.',
  'workbench.docs.anchor.qpRemoveAll.title': 'Remove All',
  'workbench.docs.anchor.qpRemoveAll.summary':
    'Strips the entire query string from matching URLs. Other operations in the same rule are ignored while it is ' +
    'present.',
  'workbench.docs.anchor.urlPattern.title': 'URL Pattern',
  'workbench.docs.anchor.urlPattern.summary':
    'Matches the request URL against a urlFilter pattern — * wildcards, || domain anchors, ^ separators.',
  'workbench.docs.anchor.urlRegex.title': 'URL Regex',
  'workbench.docs.anchor.urlRegex.summary':
    'Matches the request URL against a regular expression; capture groups feed \\1, \\2 substitutions in redirect ' +
    'targets.',
  'workbench.docs.anchor.requestDomains.title': 'Request Domains',
  'workbench.docs.anchor.requestDomains.summary':
    'Matches requests whose target host is one of the listed domains, subdomains included.',
  'workbench.docs.anchor.excludeDomains.title': 'Exclude Domains',
  'workbench.docs.anchor.excludeDomains.summary': 'Matches every request except those whose target host is listed.',
  'workbench.docs.anchor.initiatorDomains.title': 'Initiator Domains',
  'workbench.docs.anchor.initiatorDomains.summary':
    'Matches by the page that issued the request rather than the request URL itself. The Excl. variant inverts the ' +
    'list.',
  'workbench.docs.anchor.methods.title': 'Methods',
  'workbench.docs.anchor.methods.summary':
    'Matches on the HTTP method (GET, POST, …). The Excl. variant inverts the list.',
  'workbench.docs.anchor.conditionResourceTypes.title': 'Resource Types',
  'workbench.docs.anchor.conditionResourceTypes.summary':
    'Matches on what the browser is fetching — documents, scripts, XHR/fetch, images, … The Excl. variant inverts ' +
    'the list.',
  'workbench.docs.anchor.domainType.title': 'Domain Type',
  'workbench.docs.anchor.domainType.summary':
    'First-party matches requests to the same site as the page; third-party matches cross-site requests.',
  'workbench.docs.anchor.headers.title': 'Response Header',
  'workbench.docs.anchor.headers.summary':
    'Matches on a header of the received response — by presence, or by value when one is given.',
  'workbench.docs.anchor.redirectRegex.title': 'Regex Substitution',
  'workbench.docs.anchor.redirectRegex.summary':
    'With a URL Regex condition, \\1, \\2 … insert the captured groups into the redirect target.',
  'workbench.docs.anchor.requestBodyDynamic.title': 'Dynamic (JavaScript)',
  'workbench.docs.anchor.requestBodyDynamic.summary':
    'Runs your JavaScript against each matching request to build the outgoing body from the original.',
  'workbench.docs.anchor.responseDynamic.title': 'Dynamic (JavaScript)',
  'workbench.docs.anchor.responseDynamic.summary':
    'Runs your JavaScript for each matching response — transforming the real reply (network) or building one from ' +
    'scratch (mock).',
  'workbench.docs.anchor.requestBodyGraphql.title': 'GraphQL Operation Filter',
  'workbench.docs.anchor.requestBodyGraphql.summary':
    'Additionally gates the rule on the GraphQL operation name found in the request payload.',
  'workbench.docs.anchor.responseGraphql.title': 'GraphQL Operation Filter',
  'workbench.docs.anchor.responseGraphql.summary':
    'Additionally gates the rule on the GraphQL operation name found in the request payload.',
} as const satisfies Catalog;
