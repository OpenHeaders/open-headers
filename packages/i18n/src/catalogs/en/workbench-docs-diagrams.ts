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
} as const satisfies Catalog;
