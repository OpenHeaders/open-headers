/**
 * Workbench Docs panel — SVG diagram labels. Every diagram under
 * `workbench/components/docs/diagrams/` renders its prose (titles, box
 * labels, captions, aria descriptions) from this file; monospace wire
 * fragments and `{{ns.*}}` reference tokens either stay hardcoded in
 * the diagram source (single tokens the i18n scanner treats as
 * non-prose) or ride here as whole-raw values every locale copies
 * verbatim. Keys group as
 * `workbench.docs.diagrams.<group>.<diagram>.<part>`, one group per
 * diagram directory.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDiagrams = {
  // ── Variables: resolution ladder ────────────────────────────────────
  'workbench.docs.diagrams.variables.ladder.aria':
    'A bare variable reference resolves through vault, environment, collection, then workspace — first hit wins. ' +
    'Live, step, file, and dynamic are reachable only by namespace prefix.',
  'workbench.docs.diagrams.variables.ladder.title': 'Bare reference — the first scope that defines it wins',
  'workbench.docs.diagrams.variables.ladder.vault': 'Vault',
  'workbench.docs.diagrams.variables.ladder.vaultSub': 'secrets · this device only',
  'workbench.docs.diagrams.variables.ladder.environment': 'Environment',
  'workbench.docs.diagrams.variables.ladder.environmentSub': 'active, then default',
  'workbench.docs.diagrams.variables.ladder.collection': 'Collection',
  'workbench.docs.diagrams.variables.ladder.collectionSub': 'active collection only',
  'workbench.docs.diagrams.variables.ladder.workspace': 'Workspace',
  'workbench.docs.diagrams.variables.ladder.workspaceSub': 'shared with everyone',
  'workbench.docs.diagrams.variables.ladder.miss': 'miss',
  'workbench.docs.diagrams.variables.ladder.railHeading': 'NAMESPACE ONLY',
  'workbench.docs.diagrams.variables.ladder.railFoot1': 'reached only by prefix —',
  'workbench.docs.diagrams.variables.ladder.railFoot2': 'never part of the bare walk',
  'workbench.docs.diagrams.variables.ladder.pinExamples': '{{vault.token}} · {{env.token}} · {{collection.token}}',
  'workbench.docs.diagrams.variables.ladder.pinNote': '{{workspace.token}} — the prefix pins one scope.',

  // ── Variables: creation map ─────────────────────────────────────────
  'workbench.docs.diagrams.variables.creation.aria':
    'Sidebar map — collection variables live on the collection, environments under Environments, and Vault, ' +
    'Workspace Variables, and Live Variables are top-level sidebar entries',
  'workbench.docs.diagrams.variables.creation.title': 'Where each scope is created',
  'workbench.docs.diagrams.variables.creation.workspaceName': 'PAYMENTS TEAM',
  'workbench.docs.diagrams.variables.creation.collections': '▾ Collections',
  'workbench.docs.diagrams.variables.creation.collectionName': '▾ Payments API',
  'workbench.docs.diagrams.variables.creation.variables': 'Variables',
  'workbench.docs.diagrams.variables.creation.environments': '▾ Environments',
  'workbench.docs.diagrams.variables.creation.envStaging': 'staging  ●',
  'workbench.docs.diagrams.variables.creation.envProduction': 'production',
  'workbench.docs.diagrams.variables.creation.vault': 'Vault',
  'workbench.docs.diagrams.variables.creation.workspaceVariables': 'Workspace Variables',
  'workbench.docs.diagrams.variables.creation.liveVariables': 'Live Variables',
  'workbench.docs.diagrams.variables.creation.footer1': 'Collections carry their own Variables page;',
  'workbench.docs.diagrams.variables.creation.footer2': 'everything else is a sidebar entry.',

  // ── Variables: shadowing ────────────────────────────────────────────
  'workbench.docs.diagrams.variables.shadowing.aria':
    'api_host defined in both environment and workspace — the bare reference resolves to the environment value; ' +
    'the namespaced form still reads the workspace value',
  'workbench.docs.diagrams.variables.shadowing.title': 'Same name in two scopes — the higher one wins',
  'workbench.docs.diagrams.variables.shadowing.wins': '✓ wins',
  'workbench.docs.diagrams.variables.shadowing.shadowed': 'shadowed',
  'workbench.docs.diagrams.variables.shadowing.envLabel': 'Environment · staging',
  'workbench.docs.diagrams.variables.shadowing.wsLabel': 'Workspace',
  'workbench.docs.diagrams.variables.shadowing.footer': 'The prefix skips the ladder and reads one scope directly.',

  // ── Variables: live lifecycle ───────────────────────────────────────
  'workbench.docs.diagrams.variables.live.aria':
    'A live workflow runs its steps, publishes the exposed capture as a live variable, and rules and requests ' +
    'consume it; auto-refresh re-runs the workflow',
  'workbench.docs.diagrams.variables.live.title': 'A successful run publishes the value',
  'workbench.docs.diagrams.variables.live.workflowTitle': 'Live Workflow',
  'workbench.docs.diagrams.variables.live.step1': 'Step 1 · sign in',
  'workbench.docs.diagrams.variables.live.step2': 'Step 2 · fetch token',
  'workbench.docs.diagrams.variables.live.expose': 'expose: token',
  'workbench.docs.diagrams.variables.live.runSucceeds': 'run succeeds',
  'workbench.docs.diagrams.variables.live.publishes': 'publishes',
  'workbench.docs.diagrams.variables.live.rules': 'Rules',
  'workbench.docs.diagrams.variables.live.requests': 'Requests',
  'workbench.docs.diagrams.variables.live.autoRefresh': 'auto-refresh re-runs',
  'workbench.docs.diagrams.variables.live.footer1': 'Saving activates the workflow — the value appears only after',
  'workbench.docs.diagrams.variables.live.footer2': "a run that succeeds, and refreshes on the workflow's schedule.",

  // ── Variables: consumers ────────────────────────────────────────────
  'workbench.docs.diagrams.variables.consumers.aria':
    'One templated value — Authorization: Bearer token — consumed by rules, requests, and workflows',
  'workbench.docs.diagrams.variables.consumers.title': 'Define once, reference everywhere',
  'workbench.docs.diagrams.variables.consumers.template': 'Authorization: Bearer {{token}}',
  'workbench.docs.diagrams.variables.consumers.rules': 'Rules',
  'workbench.docs.diagrams.variables.consumers.rulesLine1': 'headers, redirect,',
  'workbench.docs.diagrams.variables.consumers.rulesLine2': 'bodies, inject',
  'workbench.docs.diagrams.variables.consumers.rulesWhen': 'when a rule applies',
  'workbench.docs.diagrams.variables.consumers.requests': 'Requests',
  'workbench.docs.diagrams.variables.consumers.requestsLine1': 'URL, params,',
  'workbench.docs.diagrams.variables.consumers.requestsLine2': 'headers, auth, body',
  'workbench.docs.diagrams.variables.consumers.requestsWhen': 'on Send',
  'workbench.docs.diagrams.variables.consumers.workflows': 'Workflows',
  'workbench.docs.diagrams.variables.consumers.workflowsLine1': 'every step,',
  'workbench.docs.diagrams.variables.consumers.workflowsLine2': 'chained captures',
  'workbench.docs.diagrams.variables.consumers.workflowsWhen': 'per run',
  'workbench.docs.diagrams.variables.consumers.footer1':
    'Values are substituted at use time — change the variable once,',
  'workbench.docs.diagrams.variables.consumers.footer2': 'and every rule, request, and workflow picks it up.',

  // ── Multi-tab: side-by-side sync overview ───────────────────────────
  'workbench.docs.diagrams.multiTab.sync.aria':
    'Two workspace tabs open side by side — different workspaces or different layouts, working in parallel',
  'workbench.docs.diagrams.multiTab.sync.title': 'Two tabs, two contexts — at the same time',
  'workbench.docs.diagrams.multiTab.sync.tabTitle': '{ordinal} Open Headers',
  'workbench.docs.diagrams.multiTab.sync.workspaceProduction': 'Production',
  'workbench.docs.diagrams.multiTab.sync.workspaceStaging': 'Staging',
  'workbench.docs.diagrams.multiTab.sync.sidebarRules': 'Rules',
  'workbench.docs.diagrams.multiTab.sync.sidebarRequests': 'Requests',
  'workbench.docs.diagrams.multiTab.sync.sidebarEnv': 'Env',
  'workbench.docs.diagrams.multiTab.sync.ruleRow1': 'Auth header',
  'workbench.docs.diagrams.multiTab.sync.ruleRow2': 'CORS bypass',
  'workbench.docs.diagrams.multiTab.sync.ruleRow3': 'Block ads',
  'workbench.docs.diagrams.multiTab.sync.rulesEditor': 'Rules editor',
  'workbench.docs.diagrams.multiTab.sync.envEditor': 'Env editor',
  'workbench.docs.diagrams.multiTab.sync.footer1': 'Rules + collections sync through storage.',
  'workbench.docs.diagrams.multiTab.sync.footer2': 'Each tab keeps its own workspace + layout.',

  // ── Multi-tab: ordinal numbering timeline ───────────────────────────
  'workbench.docs.diagrams.multiTab.numbering.aria':
    "Tab numbering timeline — ordinals are stable within a tab's lifetime; closing #1 does not renumber, " +
    'next tab gets #4',
  'workbench.docs.diagrams.multiTab.numbering.title': "Ordinals stay stable within a tab's lifetime",
  'workbench.docs.diagrams.multiTab.numbering.step1': '1 tab open',
  'workbench.docs.diagrams.multiTab.numbering.note1': 'no prefix',
  'workbench.docs.diagrams.multiTab.numbering.step2': 'open another',
  'workbench.docs.diagrams.multiTab.numbering.note2': 'prefixes appear',
  'workbench.docs.diagrams.multiTab.numbering.step3': 'open a third',
  'workbench.docs.diagrams.multiTab.numbering.step4': 'close #1',
  'workbench.docs.diagrams.multiTab.numbering.note4': '#2 #3 unchanged',
  'workbench.docs.diagrams.multiTab.numbering.step5': 'open one more',
  'workbench.docs.diagrams.multiTab.numbering.note5': 'next is #4',
  'workbench.docs.diagrams.multiTab.numbering.footer':
    'Numbering resets to #1 only after every workspace tab has closed.',

  // ── Multi-tab: navigation reuse ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.navigation.aria':
    'Navigation reuse — same-window first. Top: same window has a workspace tab, click activates it. Bottom: ' +
    "only another window has a workspace tab, a new one opens in the caller's window.",
  'workbench.docs.diagrams.multiTab.navigation.title': 'Click "edit rule" in the popup —',
  'workbench.docs.diagrams.multiTab.navigation.subtitle': 'the popup looks for a workspace tab in YOUR window first',
  'workbench.docs.diagrams.multiTab.navigation.sameWindow': 'Same window',
  'workbench.docs.diagrams.multiTab.navigation.sameWindowHint': '— already has a workspace tab',
  'workbench.docs.diagrams.multiTab.navigation.window1': 'Window 1',
  'workbench.docs.diagrams.multiTab.navigation.window1Caller': 'Window 1 (caller)',
  'workbench.docs.diagrams.multiTab.navigation.window2': 'Window 2',
  'workbench.docs.diagrams.multiTab.navigation.workspaceTab': '#1 Open Headers',
  'workbench.docs.diagrams.multiTab.navigation.otherTab': 'gmail',
  'workbench.docs.diagrams.multiTab.navigation.popup': 'popup',
  'workbench.docs.diagrams.multiTab.navigation.editRule': 'edit rule ▸',
  'workbench.docs.diagrams.multiTab.navigation.activates': 'existing tab activates · no new tab',
  'workbench.docs.diagrams.multiTab.navigation.otherWindow': 'Other window',
  'workbench.docs.diagrams.multiTab.navigation.otherWindowHint': '— your window has none',
  'workbench.docs.diagrams.multiTab.navigation.newTab': '+ new tab',
  'workbench.docs.diagrams.multiTab.navigation.untouched': 'untouched · no focus steal',
  'workbench.docs.diagrams.multiTab.navigation.footer1': "Same as how Chrome's own DevTools docks per window —",
  'workbench.docs.diagrams.multiTab.navigation.footer2': 'you stay in the window you were already in.',

  // ── Multi-tab: what syncs (shared pool) ─────────────────────────────
  'workbench.docs.diagrams.multiTab.synced.aria':
    'What syncs across tabs — chrome.storage holds rules, collections, folders, environments, variables, vault, ' +
    'requests, templates. Both tabs read and write through it.',
  'workbench.docs.diagrams.multiTab.synced.title': '✓ Syncs across tabs',
  'workbench.docs.diagrams.multiTab.synced.subtitle': 'every tab reads and writes the same chrome.storage',
  'workbench.docs.diagrams.multiTab.synced.sourceOfTruth': 'single source of truth',
  'workbench.docs.diagrams.multiTab.synced.pillRules': 'rules',
  'workbench.docs.diagrams.multiTab.synced.pillCollections': 'collections',
  'workbench.docs.diagrams.multiTab.synced.pillFolders': 'folders',
  'workbench.docs.diagrams.multiTab.synced.pillEnvironments': 'environments',
  'workbench.docs.diagrams.multiTab.synced.pillVariables': 'variables',
  'workbench.docs.diagrams.multiTab.synced.pillVault': 'vault',
  'workbench.docs.diagrams.multiTab.synced.pillRequests': 'requests',
  'workbench.docs.diagrams.multiTab.synced.pillTemplates': 'templates',
  'workbench.docs.diagrams.multiTab.synced.tab1': 'Tab #1',
  'workbench.docs.diagrams.multiTab.synced.tab2': 'Tab #2',
  'workbench.docs.diagrams.multiTab.synced.liveData': 'live data',
  'workbench.docs.diagrams.multiTab.synced.footer': 'Save in either tab — the other re-hydrates instantly.',

  // ── Multi-tab: what stays local ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.local.aria':
    'What stays in each tab — layout splitter ratio and unsaved drafts. Two tabs visibly differ: 25/75 vs 65/35 ' +
    'splits, one with a draft and one without.',
  'workbench.docs.diagrams.multiTab.local.title': '✗ Stays in each tab',
  'workbench.docs.diagrams.multiTab.local.subtitle': 'splitter ratio + unsaved typing — private to where you did them',
  'workbench.docs.diagrams.multiTab.local.tabTitle': 'Tab {ordinal}',
  'workbench.docs.diagrams.multiTab.local.layoutLabel': 'layout',
  'workbench.docs.diagrams.multiTab.local.draftLabel': 'unsaved draft',
  'workbench.docs.diagrams.multiTab.local.unsavedBadge': '● unsaved',
  'workbench.docs.diagrams.multiTab.local.noUnsaved': 'no unsaved changes',
  'workbench.docs.diagrams.multiTab.local.footer1': 'Each tab keeps its own splitter + draft.',
  'workbench.docs.diagrams.multiTab.local.footer2': 'A tab opened AFTER your drag inherits the new layout.',

  // ── Header actions: shared kickers ──────────────────────────────────
  'workbench.docs.diagrams.headerActions.shared.ruleKicker': 'RULE',
  'workbench.docs.diagrams.headerActions.shared.beforeKicker': 'BEFORE',
  'workbench.docs.diagrams.headerActions.shared.afterKicker': 'AFTER',
  'workbench.docs.diagrams.headerActions.shared.wontFireKicker': "WHEN IT DOESN'T FIRE",
  'workbench.docs.diagrams.headerActions.shared.suggestion': 'Suggestion',

  // ── Header actions: operations overview ─────────────────────────────
  'workbench.docs.diagrams.headerActions.overview.aria':
    'Four header operations applied to the same starting header — Override replaces, Append adds duplicate, Remove ' +
    'deletes, Merge concatenates.',
  'workbench.docs.diagrams.headerActions.overview.title': 'Same starting header → four outcomes',
  'workbench.docs.diagrams.headerActions.overview.before': 'Cookie: a=1',
  'workbench.docs.diagrams.headerActions.overview.opOverride': 'Override',
  'workbench.docs.diagrams.headerActions.overview.opAppend': 'Append',
  'workbench.docs.diagrams.headerActions.overview.opRemove': 'Remove',
  'workbench.docs.diagrams.headerActions.overview.opMerge': 'Merge',
  'workbench.docs.diagrams.headerActions.overview.engineDnr': 'DNR',
  'workbench.docs.diagrams.headerActions.overview.engineScript': 'Script',
  'workbench.docs.diagrams.headerActions.overview.afterOverrideNew': 'Z',
  'workbench.docs.diagrams.headerActions.overview.afterAppendKept': 'a=1 ·',
  'workbench.docs.diagrams.headerActions.overview.afterAppendNew': '+Cookie: Z',
  'workbench.docs.diagrams.headerActions.overview.afterRemoveGone': '(header gone)',
  'workbench.docs.diagrams.headerActions.overview.afterMergeNew': '; new=val',
  'workbench.docs.diagrams.headerActions.overview.legendDnr': 'DNR — native, applied by Chrome',
  'workbench.docs.diagrams.headerActions.overview.legendScript': 'Script — patched fetch / XHR (Merge only)',

  // ── Header actions: add / replace ───────────────────────────────────
  'workbench.docs.diagrams.headerActions.override.aria':
    'Add / Replace — same rule covers both cases. Replaces an existing X-Auth header value, or adds the header when ' +
    'absent. Both arrive at the same outcome.',
  'workbench.docs.diagrams.headerActions.override.rule': 'Override X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.replaceLabel': 'Replace',
  'workbench.docs.diagrams.headerActions.override.addLabel': 'Add',
  'workbench.docs.diagrams.headerActions.override.replaceSub': 'header already present',
  'workbench.docs.diagrams.headerActions.override.addSub': 'no X-Auth header yet',
  'workbench.docs.diagrams.headerActions.override.beforeOld': 'X-Auth: old-value',
  'workbench.docs.diagrams.headerActions.override.lineContentType': 'Content-Type: html',
  'workbench.docs.diagrams.headerActions.override.afterNew': 'X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.noHeaderNote': '(no X-Auth)',
  'workbench.docs.diagrams.headerActions.override.arrowReplaced': 'value replaced',
  'workbench.docs.diagrams.headerActions.override.arrowAdded': 'header added',
  'workbench.docs.diagrams.headerActions.override.stamp': 'Either way → one X-Auth header with your value',
  'workbench.docs.diagrams.headerActions.override.wontAria':
    "Add / Replace won't apply when the rule's conditions don't match the request — it silently no-ops. Suggestion: " +
    'check Request Domains or URL Pattern conditions.',
  'workbench.docs.diagrams.headerActions.override.wontTitle': 'Request to a non-matching domain',
  'workbench.docs.diagrams.headerActions.override.wontDetail': 'Conditions gate the action — no match, no-op.',
  'workbench.docs.diagrams.headerActions.override.wontSuggestion': "Check the rule's Request Domains or URL Pattern.",

  // ── Header actions: append ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.append.aria':
    'Append adds a second header row with the same name — both delivered. BEFORE has one Set-Cookie row; AFTER has ' +
    'two, the new one highlighted.',
  'workbench.docs.diagrams.headerActions.append.rule': 'Append Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.lineSession': 'Set-Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.append.arrowLabel': '+1 duplicate row',
  'workbench.docs.diagrams.headerActions.append.afterNew': 'Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.stamp1': 'Two Set-Cookie rows — both delivered.',
  'workbench.docs.diagrams.headerActions.append.stamp2':
    'Use for Set-Cookie, Link, Via — headers that allow duplicates.',
  'workbench.docs.diagrams.headerActions.append.wontAria':
    "Append won't apply cleanly to headers that don't support duplicates — the browser keeps only one. Use Override " +
    'to replace or Merge to concatenate.',
  'workbench.docs.diagrams.headerActions.append.wontTitle': "Headers that don't allow duplicates",
  'workbench.docs.diagrams.headerActions.append.wontDetail':
    'e.g. Authorization, Host, Content-Type — browser keeps only one.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion1': 'Use Override to replace the value.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion2': 'Use Merge to append to the existing value.',

  // ── Header actions: remove ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.remove.aria':
    'Remove deletes the targeted header. BEFORE shows X-Frame-Options struck through; AFTER shows only the ' +
    'surviving Content-Type header.',
  'workbench.docs.diagrams.headerActions.remove.rule': 'Remove X-Frame-Options',
  'workbench.docs.diagrams.headerActions.remove.beforeStruck': 'X-Frame-Options: DENY',
  'workbench.docs.diagrams.headerActions.remove.lineContentType': 'Content-Type: text/html',
  'workbench.docs.diagrams.headerActions.remove.arrowLabel': 'target removed',
  'workbench.docs.diagrams.headerActions.remove.stamp1': 'All instances of X-Frame-Options deleted.',
  'workbench.docs.diagrams.headerActions.remove.stamp2': 'Duplicate rows of the same header are all removed at once.',
  'workbench.docs.diagrams.headerActions.remove.wontAria':
    "Remove is a no-op when the targeted header isn't present — no error fires. Use Override if you wanted to set a " +
    'different value instead.',
  'workbench.docs.diagrams.headerActions.remove.wontTitle': 'Header already absent',
  'workbench.docs.diagrams.headerActions.remove.wontDetail':
    'No-op — no error, the request just goes through unchanged.',
  'workbench.docs.diagrams.headerActions.remove.wontSuggestion':
    'Use Override if you wanted to set the value, not remove it.',

  // ── Header actions: merge ───────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.merge.aria':
    'Merge reads the existing header value at runtime, joins your value with a separator, and replaces the original.',
  'workbench.docs.diagrams.headerActions.merge.rule': "Merge Cookie + new=val  (sep: '; ')",
  'workbench.docs.diagrams.headerActions.merge.lineSession': 'Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.merge.arrowLabel': 'join with separator',
  'workbench.docs.diagrams.headerActions.merge.afterNew': 'new=val',
  'workbench.docs.diagrams.headerActions.merge.stamp1': 'Existing value + your value, joined by the separator.',
  'workbench.docs.diagrams.headerActions.merge.stamp2': "Default separator: '; ' for Cookie, ', ' for other headers.",
  'workbench.docs.diagrams.headerActions.merge.wontAria':
    'Merge only intercepts JS-initiated fetch / XHR — page navigations and static resources flow through unchanged. ' +
    'Use Override or Append (DNR) for those.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle1': 'Page navigations',
  'workbench.docs.diagrams.headerActions.merge.wontDetail1':
    'Only JS-initiated fetch / XHR pass through the script engine.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle2': 'Static resources (img, script, link)',
  'workbench.docs.diagrams.headerActions.merge.wontDetail2': 'Browser-issued — never touch fetch / XHR.',
  'workbench.docs.diagrams.headerActions.merge.wontSuggestion': 'For page-level headers, use Override or Append (DNR).',

  // ── Conditions: shared ──────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.shared.ruleLabel': 'Rule:',
  'workbench.docs.diagrams.conditions.shared.testRequests': 'Test requests:',
  'workbench.docs.diagrams.conditions.shared.testedAgainst': 'Tested against URLs:',
  'workbench.docs.diagrams.conditions.shared.beforeKicker': 'BEFORE',
  'workbench.docs.diagrams.conditions.shared.afterKicker': 'AFTER',
  'workbench.docs.diagrams.conditions.shared.legendLiteral': 'literal — exact match',
  'workbench.docs.diagrams.conditions.shared.usePrefix': 'Use ',
  'workbench.docs.diagrams.conditions.shared.useSuffix': ' instead.',
  'workbench.docs.diagrams.conditions.shared.requestDomainsName': 'Request Domains',
  'workbench.docs.diagrams.conditions.shared.urlPatternName': 'URL Pattern',
  'workbench.docs.diagrams.conditions.shared.initiatorDomainsName': 'Initiator Domains',

  // ── Conditions: host vs origin ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.hostVsOrigin.aria':
    'Two URLs in one fetch — the address bar URL is the origin (Initiator Domains); the fetch destination URL is ' +
    'the host (Request Domains)',
  'workbench.docs.diagrams.conditions.hostVsOrigin.title': 'Two URLs, two conditions',
  'workbench.docs.diagrams.conditions.hostVsOrigin.pageDoes': 'JS in this page does:',
  'workbench.docs.diagrams.conditions.hostVsOrigin.fetchOpen': "fetch('",
  'workbench.docs.diagrams.conditions.hostVsOrigin.sameFetch': 'Same fetch — two different URLs.',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginTerm': 'origin',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginRest': ' — the page URL → checked by ',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostTerm': 'host',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostRest': ' — the fetch destination → checked by ',

  // ── Conditions: matching attributes ─────────────────────────────────
  'workbench.docs.diagrams.conditions.matching.aria':
    'Each condition checks one attribute of a request — colored pills on the right name the condition type that ' +
    "checks each row's attribute. All conditions are AND-combined.",
  'workbench.docs.diagrams.conditions.matching.title': 'Each condition checks one attribute of a request',
  'workbench.docs.diagrams.conditions.matching.colAttribute': 'REQUEST ATTRIBUTE',
  'workbench.docs.diagrams.conditions.matching.colCheckedBy': 'CHECKED BY',
  'workbench.docs.diagrams.conditions.matching.attrMethod': 'method:',
  'workbench.docs.diagrams.conditions.matching.attrUrl': 'URL:',
  'workbench.docs.diagrams.conditions.matching.attrHost': 'host:',
  'workbench.docs.diagrams.conditions.matching.attrOrigin': 'origin:',
  'workbench.docs.diagrams.conditions.matching.attrType': 'type:',
  'workbench.docs.diagrams.conditions.matching.attrParty': 'party:',
  'workbench.docs.diagrams.conditions.matching.attrHeader': 'header:',
  'workbench.docs.diagrams.conditions.matching.condMethods': 'Methods',
  'workbench.docs.diagrams.conditions.matching.condUrlPattern': 'URL Pattern',
  'workbench.docs.diagrams.conditions.matching.condRequestDomains': 'Request Domains',
  'workbench.docs.diagrams.conditions.matching.condInitiatorDomains': 'Initiator Domains',
  'workbench.docs.diagrams.conditions.matching.condResourceTypes': 'Resource Types',
  'workbench.docs.diagrams.conditions.matching.condDomainType': 'Domain Type',
  'workbench.docs.diagrams.conditions.matching.condHeaders': 'Headers',
  'workbench.docs.diagrams.conditions.matching.allMustMatch': 'All must match (AND)',
  'workbench.docs.diagrams.conditions.matching.ruleFires': '→ rule fires',

  // ── Conditions: rule fires ──────────────────────────────────────────
  'workbench.docs.diagrams.conditions.ruleFires.aria':
    'When all conditions match, the rule fires — the Authorization header is replaced before the request leaves ' +
    'the browser',
  'workbench.docs.diagrams.conditions.ruleFires.title': 'Conditions match → rule fires → request changes',
  'workbench.docs.diagrams.conditions.ruleFires.opOverride': 'Override',
  'workbench.docs.diagrams.conditions.ruleFires.ruleValue': 'Authorization: Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.beforeOld': 'Bearer OLD',
  'workbench.docs.diagrams.conditions.ruleFires.afterNew': 'Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.lineSession': 'session=abc',
  'workbench.docs.diagrams.conditions.ruleFires.arrowRule': 'rule',
  'workbench.docs.diagrams.conditions.ruleFires.arrowFires': 'fires',
  'workbench.docs.diagrams.conditions.ruleFires.footer': 'Rule changes only its target — rest passes through.',

  // ── Conditions: request domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.requestDomains.aria':
    'Request Domains: one entry auto-includes the apex domain plus every subdomain, on any path or query',
  'workbench.docs.diagrams.conditions.requestDomains.title': 'Request Domains — one entry, all subdomains, any path',
  'workbench.docs.diagrams.conditions.requestDomains.autoIncludes': 'auto-includes',
  'workbench.docs.diagrams.conditions.requestDomains.hostOnly': 'host-only match — any path or query string qualifies',
  'workbench.docs.diagrams.conditions.requestDomains.doesntMatch': "Doesn't match:",
  'workbench.docs.diagrams.conditions.requestDomains.reasonTld': 'different TLD (.com ≠ .io)',
  'workbench.docs.diagrams.conditions.requestDomains.reasonNotSub':
    'not a true subdomain — no dot before "openheaders.io"',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathPrefix': 'Need to scope by path? Add ',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathSuffix': ' to the rule.',
  'workbench.docs.diagrams.conditions.requestDomains.footerCross': 'Cross-domain? Add each domain as a separate entry.',

  // ── Conditions: exclude domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.excludeDomains.aria':
    "Exclude Domains subtracts hosts from another condition's matches; it does not match anything on its own",
  'workbench.docs.diagrams.conditions.excludeDomains.title': 'Exclude Domains — subtracts from another condition',
  'workbench.docs.diagrams.conditions.excludeDomains.subtitle': "Subtracts from another condition's matches",
  'workbench.docs.diagrams.conditions.excludeDomains.includeKicker': '+ REQUEST DOMAINS',
  'workbench.docs.diagrams.conditions.excludeDomains.excludeKicker': '− EXCLUDE DOMAINS',
  'workbench.docs.diagrams.conditions.excludeDomains.finalHosts': 'Final matched hosts:',
  'workbench.docs.diagrams.conditions.excludeDomains.excluded': 'excluded',
  'workbench.docs.diagrams.conditions.excludeDomains.excludedSub': 'excluded — subdomain rule applies to Exclude too',
  'workbench.docs.diagrams.conditions.excludeDomains.warnTitle': 'Exclude alone matches nothing.',
  'workbench.docs.diagrams.conditions.excludeDomains.warnBody': "It only subtracts from another condition's matches.",

  // ── Conditions: initiator domains ───────────────────────────────────
  'workbench.docs.diagrams.conditions.initiatorDomains.aria':
    'Initiator Domains: same destination, different page origins, opposite outcomes',
  'workbench.docs.diagrams.conditions.initiatorDomains.title': 'Initiator Domains — match by which page made the call',
  'workbench.docs.diagrams.conditions.initiatorDomains.subtitle': 'Same fetch, two page contexts → different outcomes',
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Initiator Domains: portal.openheaders.io',
  'workbench.docs.diagrams.conditions.initiatorDomains.openPage': 'OPEN PAGE',
  'workbench.docs.diagrams.conditions.initiatorDomains.fetches': '↓ fetches',
  'workbench.docs.diagrams.conditions.initiatorDomains.matches': '✓ MATCHES',
  'workbench.docs.diagrams.conditions.initiatorDomains.noMatch': '✗ NO MATCH',
  'workbench.docs.diagrams.conditions.initiatorDomains.initiatorEq': 'initiator =',
  'workbench.docs.diagrams.conditions.initiatorDomains.footerQ': 'Want to match by destination, not origin?',

  // ── Conditions: methods ─────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.methods.aria':
    'Methods — multi-select HTTP verbs; only the selected (orange) methods match',
  'workbench.docs.diagrams.conditions.methods.title': 'Methods — pick which HTTP verbs match',
  'workbench.docs.diagrams.conditions.methods.subtitle':
    "Multi-select — orange methods match; the rest don't trigger the rule",
  'workbench.docs.diagrams.conditions.methods.testGet': 'GET /api/users',
  'workbench.docs.diagrams.conditions.methods.testPost': 'POST /api/login',
  'workbench.docs.diagrams.conditions.methods.testPut': 'PUT /api/users/1',
  'workbench.docs.diagrams.conditions.methods.testDelete': 'DELETE /api/users/1',
  'workbench.docs.diagrams.conditions.methods.notSelected': 'method not in selected list',
  'workbench.docs.diagrams.conditions.methods.footerQ': 'Want to match every method?',
  'workbench.docs.diagrams.conditions.methods.footerA': 'Remove this condition — it defaults to all methods.',

  // ── Conditions: resource types ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.resourceTypes.aria':
    'Resource Types — multi-select request kinds; selected purple types match, others are skipped',
  'workbench.docs.diagrams.conditions.resourceTypes.title': 'Resource Types — multi-select request kinds',
  'workbench.docs.diagrams.conditions.resourceTypes.subtitle': "Purple kinds match; the rest don't trigger the rule",
  'workbench.docs.diagrams.conditions.resourceTypes.testVisit': 'visit /dashboard',
  'workbench.docs.diagrams.conditions.resourceTypes.testImage': 'GET /img/logo.png',
  'workbench.docs.diagrams.conditions.resourceTypes.testScript': 'GET /js/app.js',
  'workbench.docs.diagrams.conditions.resourceTypes.kindXhr': 'xhr',
  'workbench.docs.diagrams.conditions.resourceTypes.kindPage': 'page',
  'workbench.docs.diagrams.conditions.resourceTypes.kindImageSkipped': 'image — skipped',
  'workbench.docs.diagrams.conditions.resourceTypes.kindScriptSkipped': 'script — skipped',
  'workbench.docs.diagrams.conditions.resourceTypes.footerQ': 'Want to match every resource type?',
  'workbench.docs.diagrams.conditions.resourceTypes.footerA': 'Remove this condition — it defaults to all kinds.',

  // ── Conditions: domain type ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.domainType.aria':
    'Domain Type — each request is classified first-party (same registrable domain) or third-party; the rule ' +
    'selector decides which type matches',
  'workbench.docs.diagrams.conditions.domainType.title': 'Domain Type — first-party vs third-party',
  'workbench.docs.diagrams.conditions.domainType.subtitle':
    'Classified by relationship between the page and the request URL',
  'workbench.docs.diagrams.conditions.domainType.pageLabel': 'Page:',
  'workbench.docs.diagrams.conditions.domainType.ruleSelection': 'Rule selection:',
  'workbench.docs.diagrams.conditions.domainType.pillFirstParty': 'firstParty',
  'workbench.docs.diagrams.conditions.domainType.pillThirdParty': 'thirdParty',
  'workbench.docs.diagrams.conditions.domainType.colDestination': 'DESTINATION',
  'workbench.docs.diagrams.conditions.domainType.colType': 'TYPE',
  'workbench.docs.diagrams.conditions.domainType.colMatch': 'MATCH',
  'workbench.docs.diagrams.conditions.domainType.partyFirst': 'first-party',
  'workbench.docs.diagrams.conditions.domainType.partyThird': 'third-party',
  'workbench.docs.diagrams.conditions.domainType.footerBoth': 'Want both? Select firstParty AND thirdParty.',
  'workbench.docs.diagrams.conditions.domainType.footerRemove': 'Or remove the condition — defaults to both.',

  // ── Conditions: response headers ────────────────────────────────────
  'workbench.docs.diagrams.conditions.headers.aria':
    "Response Headers condition — exact name plus exact value, response-side only (Chrome DNR doesn't match on " +
    'request headers)',
  'workbench.docs.diagrams.conditions.headers.title': 'Response Headers — exact name + exact value',
  'workbench.docs.diagrams.conditions.headers.subtitle':
    "Response-side only — Chrome DNR doesn't match request headers",
  'workbench.docs.diagrams.conditions.headers.exactName': 'exact name',
  'workbench.docs.diagrams.conditions.headers.exactValue': 'exact value',
  'workbench.docs.diagrams.conditions.headers.testHeaders': 'Test response headers:',
  'workbench.docs.diagrams.conditions.headers.testJson': 'Content-Type: application/json',
  'workbench.docs.diagrams.conditions.headers.testHtml': 'Content-Type: text/html',
  'workbench.docs.diagrams.conditions.headers.testServer': 'Server: nginx',
  'workbench.docs.diagrams.conditions.headers.reasonValue': 'name matches, but value differs',
  'workbench.docs.diagrams.conditions.headers.reasonName': 'different header name',
  'workbench.docs.diagrams.conditions.headers.absentLine': '(response without Content-Type)',
  'workbench.docs.diagrams.conditions.headers.reasonAbsent': 'header absent — must be present to match',
  'workbench.docs.diagrams.conditions.headers.footer':
    'Common use: filter rules by response Content-Type or custom flags',

  // ── Conditions: URL pattern ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlPattern.aria':
    'URL Pattern uses wildcards on the full URL — pattern anatomy plus match and no-match examples',
  'workbench.docs.diagrams.conditions.urlPattern.title': 'URL Pattern — wildcards (*) on the full URL',
  'workbench.docs.diagrams.conditions.urlPattern.labelAny': 'any',
  'workbench.docs.diagrams.conditions.urlPattern.labelProtocol': 'protocol',
  'workbench.docs.diagrams.conditions.urlPattern.labelLiteralHost': 'literal host',
  'workbench.docs.diagrams.conditions.urlPattern.labelNoWildcards': '(no wildcards)',
  'workbench.docs.diagrams.conditions.urlPattern.labelAnyPath': 'any path',
  'workbench.docs.diagrams.conditions.urlPattern.labelQueryString': '+ query string',
  'workbench.docs.diagrams.conditions.urlPattern.legendWildcard': 'wildcard — matches anything',
  'workbench.docs.diagrams.conditions.urlPattern.reasonSubdomain': '"cdn" ≠ "api" — subdomain mismatch',
  'workbench.docs.diagrams.conditions.urlPattern.reasonHost': 'different host entirely',
  'workbench.docs.diagrams.conditions.urlPattern.footerQ': 'Need to match all subdomains at once?',
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Request Domains: openheaders.io',

  // ── Conditions: URL regex ───────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlRegex.aria':
    'URL Regex anatomy plus match and no-match examples — purple bits are real regex; everything else is literal',
  'workbench.docs.diagrams.conditions.urlRegex.title': 'URL Regex — RE2 regex on the full URL',
  'workbench.docs.diagrams.conditions.urlRegex.labelStart': 'start',
  'workbench.docs.diagrams.conditions.urlRegex.labelAnchor': 'anchor',
  'workbench.docs.diagrams.conditions.urlRegex.labelLiteralChars': 'literal characters',
  'workbench.docs.diagrams.conditions.urlRegex.labelDotNote': '(\\. matches the . character)',
  'workbench.docs.diagrams.conditions.urlRegex.labelOneOrMore': 'one or more',
  'workbench.docs.diagrams.conditions.urlRegex.labelDigits': 'digits',
  'workbench.docs.diagrams.conditions.urlRegex.legendRegex': 'regex syntax — special meaning',
  'workbench.docs.diagrams.conditions.urlRegex.reasonHttp': "regex specifies https:// — http isn't matched",
  'workbench.docs.diagrams.conditions.urlRegex.reasonLatest': '"latest" doesn\'t match /v[0-9]+',
  'workbench.docs.diagrams.conditions.urlRegex.footerQ': 'Want both http and https?',
  'workbench.docs.diagrams.conditions.urlRegex.footerUsePrefix': 'Use ',
  'workbench.docs.diagrams.conditions.urlRegex.footerMid': ' — the ',
  'workbench.docs.diagrams.conditions.urlRegex.footerEnd': ' makes the s optional.',

  // ── Actions: rule anatomy ───────────────────────────────────────────
  'workbench.docs.diagrams.actions.ruleAnatomy.aria':
    "Rule anatomy — an outgoing HTTP request is matched against the rule's AND-joined conditions; if all match, " +
    'the action mutates the request before it leaves the browser.',
  'workbench.docs.diagrams.actions.ruleAnatomy.title': 'A rule = Conditions + Action',
  'workbench.docs.diagrams.actions.ruleAnatomy.subtitle':
    'Conditions decide whether the rule fires. The action decides what changes.',
  'workbench.docs.diagrams.actions.ruleAnatomy.outgoingRequest': 'Outgoing request',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideBefore': 'before',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideAfter': 'after',
  'workbench.docs.diagrams.actions.ruleAnatomy.addedTag': 'ADDED',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowCheck': 'check',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowApply': 'apply',
  'workbench.docs.diagrams.actions.ruleAnatomy.ruleLabel': 'Rule',
  'workbench.docs.diagrams.actions.ruleAnatomy.editorEntity': 'editor entity',
  'workbench.docs.diagrams.actions.ruleAnatomy.conditionsKicker': 'CONDITIONS',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionKicker': 'ACTION',
  'workbench.docs.diagrams.actions.ruleAnatomy.condMethods': 'Methods',
  'workbench.docs.diagrams.actions.ruleAnatomy.condRequestDomains': 'Request Domains',
  'workbench.docs.diagrams.actions.ruleAnatomy.condHeaders': 'Headers',
  'workbench.docs.diagrams.actions.ruleAnatomy.allMustMatch': 'ALL MUST MATCH (AND)',
  'workbench.docs.diagrams.actions.ruleAnatomy.onePerRule': 'one per rule',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionCard': 'Header Action · Add',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionValue': 'Bearer abc123…',
  'workbench.docs.diagrams.actions.ruleAnatomy.categoryLine': 'category: Modify Request',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictConditions': 'Conditions filter',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictAction': 'action transforms',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictResult': 'request goes out modified',

  // ── Actions: taxonomy ───────────────────────────────────────────────
  'workbench.docs.diagrams.actions.taxonomy.aria':
    'Actions taxonomy — three categories (Modify Request, Modify Response, Run Code) listing every action with ' +
    'its execution engine (DNR or Script).',
  'workbench.docs.diagrams.actions.taxonomy.title': 'Actions — by category',
  'workbench.docs.diagrams.actions.taxonomy.subtitle':
    'Every action belongs to one of three categories. The engine tag tells you where it executes.',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequest': 'Modify Request',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequestSub': 'before it leaves the browser',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponse': 'Modify Response',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponseSub': 'before the page sees it',
  'workbench.docs.diagrams.actions.taxonomy.catRunCode': 'Run Code',
  'workbench.docs.diagrams.actions.taxonomy.catRunCodeSub': 'inside the page or its scheduler',
  'workbench.docs.diagrams.actions.taxonomy.nameHeaderActions': 'Header Actions',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderOps': 'Add · Append · Remove · Merge',
  'workbench.docs.diagrams.actions.taxonomy.nameBlock': 'Block',
  'workbench.docs.diagrams.actions.taxonomy.subBlock': 'cancel at the network layer',
  'workbench.docs.diagrams.actions.taxonomy.nameRedirect': 'Redirect',
  'workbench.docs.diagrams.actions.taxonomy.subRedirect': 'static URL or regex',
  'workbench.docs.diagrams.actions.taxonomy.nameQueryParams': 'Query Params',
  'workbench.docs.diagrams.actions.taxonomy.subQueryParams': 'add · replace · remove',
  'workbench.docs.diagrams.actions.taxonomy.nameRequestBody': 'Request Body',
  'workbench.docs.diagrams.actions.taxonomy.subRequestBody': 'static · dynamic · GraphQL',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderResponse': 'response-side headers',
  'workbench.docs.diagrams.actions.taxonomy.nameResponseBody': 'Response Body',
  'workbench.docs.diagrams.actions.taxonomy.subResponseBody': 'mock body · status · headers',
  'workbench.docs.diagrams.actions.taxonomy.nameInject': 'Inject JS / CSS',
  'workbench.docs.diagrams.actions.taxonomy.subInject': 'pre-page-script or after DOM',
  'workbench.docs.diagrams.actions.taxonomy.nameDelay': 'Delay',
  'workbench.docs.diagrams.actions.taxonomy.subDelay': 'navigations + fetch / XHR',
  'workbench.docs.diagrams.actions.taxonomy.verdict': 'Pick a category · pick an action · pair it with conditions',
} as const satisfies Catalog;
