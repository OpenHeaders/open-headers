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
} as const satisfies Catalog;
