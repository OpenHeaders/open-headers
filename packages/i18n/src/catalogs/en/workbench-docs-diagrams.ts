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

  // ── Variables: per-scope references ─────────────────────────────────
  'workbench.docs.diagrams.variables.refs.shared.dont': "Don't:",
  'workbench.docs.diagrams.variables.refs.vault.aria':
    'Vault: reference secrets from synced entities via vault templates; never paste raw keys into rules or ' +
    'workspace variables',
  'workbench.docs.diagrams.variables.refs.vault.title': 'Vault — secrets that never leave this device',
  'workbench.docs.diagrams.variables.refs.vault.chipSub': 'Vault · kind: string',
  'workbench.docs.diagrams.variables.refs.vault.arrowCaption': 'resolved locally',
  'workbench.docs.diagrams.variables.refs.vault.good1Note': "synced rule — each teammate's own key fills in",
  'workbench.docs.diagrams.variables.refs.vault.good2Note': 'TOTP entry — resolves the current code, never the seed',
  'workbench.docs.diagrams.variables.refs.vault.goodFootnote': 'vault entries stay out of sync, exports, and git',
  'workbench.docs.diagrams.variables.refs.vault.bad1Text': 'Bearer sk-live-9f3d… in a rule',
  'workbench.docs.diagrams.variables.refs.vault.bad1Reason': 'pasted plaintext syncs to the whole workspace',
  'workbench.docs.diagrams.variables.refs.vault.bad2Text': 'api_key as a workspace variable',
  'workbench.docs.diagrams.variables.refs.vault.bad2Reason': 'synced too — the vault is the only local scope',
  'workbench.docs.diagrams.variables.refs.vault.footer1': 'Vault outranks every scope — a bare {{api_key}}',
  'workbench.docs.diagrams.variables.refs.vault.footer2': 'always picks the vault value when one exists.',
  'workbench.docs.diagrams.variables.refs.environment.aria':
    'Environment: one variable name resolves to a different value per stage; switch environments instead of ' +
    'duplicating rules, and keep secrets in the vault',
  'workbench.docs.diagrams.variables.refs.environment.title': 'Environment — one name, a value per stage',
  'workbench.docs.diagrams.variables.refs.environment.chipSub': 'Environments · staging (active)',
  'workbench.docs.diagrams.variables.refs.environment.arrowCaption': 'active environment wins',
  'workbench.docs.diagrams.variables.refs.environment.good1Note': 'while staging is active',
  'workbench.docs.diagrams.variables.refs.environment.good2Note': 'switch environments — same rules, zero edits',
  'workbench.docs.diagrams.variables.refs.environment.goodFootnote':
    'a miss falls back to the default environment first',
  'workbench.docs.diagrams.variables.refs.environment.bad1Text': 'sk-live key typed into production',
  'workbench.docs.diagrams.variables.refs.environment.bad1Reason': 'environments sync — secrets belong in the Vault',
  'workbench.docs.diagrams.variables.refs.environment.bad2Text': 'a staging copy of every rule',
  'workbench.docs.diagrams.variables.refs.environment.bad2Reason':
    "don't duplicate rules per stage — switch the environment",
  'workbench.docs.diagrams.variables.refs.environment.footer1': 'Same value in every stage? Use Workspace.',
  'workbench.docs.diagrams.variables.refs.environment.footer2': 'Per-user secret? Vault outranks every environment.',
  'workbench.docs.diagrams.variables.refs.collection.aria':
    'Collection: variables resolve only for rules and requests inside their collection; move workspace-wide ' +
    'values to workspace scope',
  'workbench.docs.diagrams.variables.refs.collection.title': 'Collection — scoped to one API',
  'workbench.docs.diagrams.variables.refs.collection.chipSub': 'Payments API · Variables',
  'workbench.docs.diagrams.variables.refs.collection.arrowCaption': 'resolves inside Payments API',
  'workbench.docs.diagrams.variables.refs.collection.good1Note': 'request in the Payments API collection',
  'workbench.docs.diagrams.variables.refs.collection.good2Note': 'rule in the Payments API collection',
  'workbench.docs.diagrams.variables.refs.collection.badsLabel': "Doesn't resolve:",
  'workbench.docs.diagrams.variables.refs.collection.bad1Text': '{{base_url}} in Billing API',
  'workbench.docs.diagrams.variables.refs.collection.bad1Reason': 'different collection — define it there instead',
  'workbench.docs.diagrams.variables.refs.collection.bad2Text': '{{base_url}} in an uncollected rule',
  'workbench.docs.diagrams.variables.refs.collection.bad2Reason': 'no collection → the reference walks past this scope',
  'workbench.docs.diagrams.variables.refs.collection.footer1': 'Needed by every collection? Move it to Workspace.',
  'workbench.docs.diagrams.variables.refs.collection.footer2': 'A same-named environment variable outranks it.',
  'workbench.docs.diagrams.variables.refs.workspace.aria':
    'Workspace: workspace variables resolve everywhere and rank lowest; keep secrets in the vault and per-stage ' +
    'values in environments',
  'workbench.docs.diagrams.variables.refs.workspace.title': 'Workspace — the shared base layer',
  'workbench.docs.diagrams.variables.refs.workspace.chipSub': 'Workspace Variables',
  'workbench.docs.diagrams.variables.refs.workspace.arrowCaption': 'resolves everywhere',
  'workbench.docs.diagrams.variables.refs.workspace.good1Note': 'header rule — any collection, any environment',
  'workbench.docs.diagrams.variables.refs.workspace.good2Note': 'request URL',
  'workbench.docs.diagrams.variables.refs.workspace.good3Note': 'pinned — even when a higher scope shadows the name',
  'workbench.docs.diagrams.variables.refs.workspace.bad1Reason': 'synced to everyone — keep secrets in the Vault',
  'workbench.docs.diagrams.variables.refs.workspace.bad2Reason': 'changes per stage — define it in each Environment',
  'workbench.docs.diagrams.variables.refs.workspace.footer1':
    'Secret? Use Vault. Different per stage? Use Environment.',
  'workbench.docs.diagrams.variables.refs.workspace.footer2': 'Workspace is for values that are true everywhere.',
  'workbench.docs.diagrams.variables.refs.live.aria':
    'Live: reference workflow-published values with the live prefix; a bare reference never resolves live, and ' +
    'hand-pasted tokens go stale',
  'workbench.docs.diagrams.variables.refs.live.title': 'Live — produced by a workflow run',
  'workbench.docs.diagrams.variables.refs.live.chipSub': 'Live Variables · OAuth login workflow',
  'workbench.docs.diagrams.variables.refs.live.arrowCaption': 'published by the last run',
  'workbench.docs.diagrams.variables.refs.live.good1Note': 'header rule that never goes stale',
  'workbench.docs.diagrams.variables.refs.live.good2Text': '{{live.token}} in requests & workflows',
  'workbench.docs.diagrams.variables.refs.live.good2Note': 'always the latest published value',
  'workbench.docs.diagrams.variables.refs.live.bad1Text': '{{token}} — bare',
  'workbench.docs.diagrams.variables.refs.live.bad1Reason': 'live never joins the bare walk — write {{live.token}}',
  'workbench.docs.diagrams.variables.refs.live.bad2Text': 'a pasted token in an env variable',
  'workbench.docs.diagrams.variables.refs.live.bad2Reason': 'expires silently — back it with a workflow instead',
  'workbench.docs.diagrams.variables.refs.live.footer1': 'Edited the workflow? The value shows stale —',
  'workbench.docs.diagrams.variables.refs.live.footer2': 'only the next successful run re-publishes it.',

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
    'not a true subdomain — no dot before "openheaders.com"',
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
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Initiator Domains: portal.openheaders.com',
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
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Request Domains: openheaders.com',

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

  // ── System status: shared ───────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.shared.sync': 'Sync',
  'workbench.docs.diagrams.systemStatus.shared.rules': 'Rules',
  'workbench.docs.diagrams.systemStatus.shared.requests': 'Requests',
  'workbench.docs.diagrams.systemStatus.shared.permissions': 'Permissions',
  'workbench.docs.diagrams.systemStatus.shared.secrets': 'Secrets',
  'workbench.docs.diagrams.systemStatus.shared.live': 'Live',
  'workbench.docs.diagrams.systemStatus.shared.systemStatus': 'System status',
  'workbench.docs.diagrams.systemStatus.shared.noEventsYet': 'No events yet',
  'workbench.docs.diagrams.systemStatus.shared.green': 'green',
  'workbench.docs.diagrams.systemStatus.shared.yellow': 'yellow',
  'workbench.docs.diagrams.systemStatus.shared.red': 'red',
  'workbench.docs.diagrams.systemStatus.shared.desktopApp': 'Desktop app',
  'workbench.docs.diagrams.systemStatus.shared.swWakes': 'SW wakes',

  // ── System status: surfaces ─────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.aria':
    'Workbench surface — the OpenHeaders workbench tab. The status row lives in the bottom footer with one pill ' +
    'per subsystem.',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.title': 'Workbench: status row in the footer',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.callout':
    '↑ six pills — one per subsystem, click any to open the popover.',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.aria':
    "Popup surface — the extension popup hangs from the toolbar icon. The status pill sits in the popup's bottom " +
    "footer as a dot plus 'System status' label.",
  'workbench.docs.diagrams.systemStatus.surfacesPopup.title': 'Popup: System status pill in the footer',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.wsChip': 'ws ▾',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.callout':
    '↑ dot + "System status" label sits in the popup\'s footer strip.',

  // ── System status: worst-level aggregator ───────────────────────────
  'workbench.docs.diagrams.systemStatus.worstLevel.aria':
    'Worst-state aggregator — six subsystem states feed into one composite dot. The worst color wins: red beats ' +
    'yellow beats green.',
  'workbench.docs.diagrams.systemStatus.worstLevel.title': 'Worst color wins',
  'workbench.docs.diagrams.systemStatus.worstLevel.subtitle':
    'red > yellow > green · grey = no events yet (treated as green)',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgConnected': 'connected',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgActive': '12 active',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgNoEvents': 'no events yet',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgHostNarrowed': 'host narrowed',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgCipher': 'cipher decrypt',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgFresh': '3 fresh',
  'workbench.docs.diagrams.systemStatus.worstLevel.maxFn': 'max()',
  'workbench.docs.diagrams.systemStatus.worstLevel.composite': 'composite',
  'workbench.docs.diagrams.systemStatus.worstLevel.dot': 'dot',
  'workbench.docs.diagrams.systemStatus.worstLevel.footer':
    'One red anywhere → composite is red. Drives the popup/sidepanel dot.',

  // ── System status: popover ──────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.popover.aria':
    'Status popover layout — grey rows for subsystems with no events yet appear above colored rows for subsystems ' +
    'that have reported.',
  'workbench.docs.diagrams.systemStatus.popover.title': 'Popover order: greys first, then coloreds',
  'workbench.docs.diagrams.systemStatus.popover.subtitle': 'Within each tier, canonical subsystem order is preserved',
  'workbench.docs.diagrams.systemStatus.popover.header': '● System status',
  'workbench.docs.diagrams.systemStatus.popover.msgConnected': 'Connected',
  'workbench.docs.diagrams.systemStatus.popover.msgActiveRules': '12 active rules',
  'workbench.docs.diagrams.systemStatus.popover.msgHostsNarrowed': 'Hosts narrowed',
  'workbench.docs.diagrams.systemStatus.popover.msgCipherFailed': 'Cipher decrypt failed',
  'workbench.docs.diagrams.systemStatus.popover.dividerNote': '↑ no events yet · ↓ have reported',
  'workbench.docs.diagrams.systemStatus.popover.footer': 'On first report, a row migrates from grey → colored once.',

  // ── System status: sync topology ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncTopology.aria':
    'Sync topology — the extension service worker holds one WebSocket to the desktop app on 127.0.0.1:8137, ' +
    'exchanging workspaces, variables, and team sync data.',
  'workbench.docs.diagrams.systemStatus.syncTopology.title': 'How the Sync subsystem connects',
  'workbench.docs.diagrams.systemStatus.syncTopology.extension': 'Extension',
  'workbench.docs.diagrams.systemStatus.syncTopology.serviceWorker': 'service worker',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsClient': 'WS client',
  'workbench.docs.diagrams.systemStatus.syncTopology.onYourMachine': 'on your machine',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsServer': 'WS server',
  'workbench.docs.diagrams.systemStatus.syncTopology.webSocket': 'WebSocket',
  'workbench.docs.diagrams.systemStatus.syncTopology.carries': 'Carries: dynamic variables · workspaces · team sync',
  'workbench.docs.diagrams.systemStatus.syncTopology.loopback': 'Loopback only — never leaves your machine.',

  // ── System status: sync lifecycle ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncLifecycle.aria':
    'Sync connection lifecycle as a sequence diagram — extension service worker connects to the desktop app, ' +
    'status pill transitions green to yellow to green over time',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.title': 'How the Sync pill changes over time',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.extensionSw': 'Extension SW',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.syncPill': 'Sync pill',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.readsSettings': 'reads settings',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.autoConnectOff': 'if auto-connect = off →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateDisabled': 'Disabled',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnecting': 'Connecting',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnected': 'Connected',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry1': 'Retry #1',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry2': 'Retry #2',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.otherwise': 'otherwise →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.wsConnect': 'WebSocket connect',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.handshakeOk': 'handshake OK',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.pingPong': 'ping ⇄ pong',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.connectionDrops': '✗ connection drops',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.backoff': 'backoff',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retryConnect': 'retry connect',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.footer':
    'Exponential backoff between retries · pings detect silent proxy drops',

  // ── System status: rules pipeline ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesPipeline.aria':
    'Rules pipeline — user rule compiles, resolves variables, passes cap check, then Chrome applies it. Each ' +
    'stage can emit a Status level if it goes wrong.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.title': 'How a rule becomes a live DNR entry',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageYourRule': 'Your rule',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCompile': 'Compile',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageResolve': 'Resolve {{VAR}}',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCapCheck': 'Cap check',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageChromeApply': 'Chrome apply',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageLiveRule': 'Live rule',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subToDnrJson': 'to DNR JSON',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subResolveScopes': 'vault · env · workspace',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subMatches': 'matches requests',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outUnresolved': 'unresolved → yellow',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outOverCap': 'over cap → yellow',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outRejected': 'rejected → red',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outActive': 'N active → green',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerRebuild': 'Rebuild fires on every save.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerPaused': 'Paused stays green ("Rule execution paused").',

  // ── System status: rules capacity ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesCapacity.aria':
    'DNR capacity bar — green up to the warning threshold, yellow up to the truncation cap, red beyond. Rules ' +
    'over the cap are dropped, so the red zone is never reached at runtime.',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.title': 'Rule capacity — where each rule count lands',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneHealthy': '✓ healthy',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneApproach': 'approach',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneTruncated': 'truncated',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countHealthy': '1,200',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countApproaching': '4,500',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countOver': '5,600',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnLabel': 'warn',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capLabel': 'cap',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnValue': '4,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capValue': '5,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerDrop':
    'Rules over the cap are dropped in match-order (top wins).',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerCeiling':
    "Chrome's hard ceiling sits much further out at 30,000.",

  // ── System status: request outcomes ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.aria':
    'Request executor outcomes — any HTTP response, including 4xx and 5xx, turns the pill green. Only ' +
    'network-level failures with no response turn it yellow.',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.title': 'What turns the Requests pill which color?',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.requestEditor': 'Request editor',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.sendButton': 'Send ▸',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.executorFires': 'Executor fires',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.gotResponse': '✓ got HTTP response',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.anyStatus': 'any status code counts',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOk': 'OK',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exNotFound': 'Not Found',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exServerError': 'Server Error',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exAborted': 'Aborted',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOffline': 'Offline / DNS',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillGreen': 'Pill → green',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillYellow': 'Pill → yellow',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.noResponse': '✗ no response',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.networkFailure': 'network-level failure',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.footer':
    'A 500 is still "green" — the request completed, you just got a 500.',

  // ── System status: request scope ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsScope.aria':
    'Request executor scope — only Send-button requests update the pill. Live workflow refreshes are silent; ' +
    'webpage traffic uses the Rules engine instead.',
  'workbench.docs.diagrams.systemStatus.requestsScope.title': 'What updates the Requests pill?',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcSend': 'Send ▸ in Request editor',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcLive': 'Live workflow refresh',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcWebpage': 'Webpage fetch / XHR',
  'workbench.docs.diagrams.systemStatus.requestsScope.subUser': 'user-initiated',
  'workbench.docs.diagrams.systemStatus.requestsScope.subBackground': 'background tick',
  'workbench.docs.diagrams.systemStatus.requestsScope.subObserved': 'observed by Rules engine',
  'workbench.docs.diagrams.systemStatus.requestsScope.updatesPill': 'updates pill',
  'workbench.docs.diagrams.systemStatus.requestsScope.differentSystem': 'different system',
  'workbench.docs.diagrams.systemStatus.requestsScope.noUpdate': 'no update',
  'workbench.docs.diagrams.systemStatus.requestsScope.footer': 'Only ad-hoc Send-button traffic shapes this pill.',

  // ── System status: permissions impact ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsImpact.aria':
    'Same rule, two permission states. With all_urls granted the DNR rule fires. With the host revoked the rule ' +
    'silently no-ops and the header never arrives.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.title': 'Same rule, two permission states',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.granted': 'Granted',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.narrowed': 'Narrowed',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.hostRevoked': 'host revoked',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.addHeader': 'Add header',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.page': 'Page',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.fetchCall': 'fetch()',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.applies': 'applies',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.noOp': 'no-op',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerArrives': '✓ header arrives',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerMissing': '✗ header missing',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.ruleFired': 'rule fired',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.silentNoOp': 'silent no-op',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer1':
    "Narrowed hosts don't error — rules just silently do nothing.",
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer2':
    "The pill's red is the only hint until you restore access.",

  // ── System status: permissions audit ────────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsAudit.aria':
    'When the audit runs and which Status level each outcome reports.',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.title':
    'When does the audit run, and what does each branch report?',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.firstHydration': 'first hydration',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.happyPath': 'happy path',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.userRevoked': 'user revoked a host',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.apiUnavailable': 'API unavailable',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.throws': 'throws',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAllGranted': '"All granted"',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgHostsNarrowed': '"Hosts narrowed"',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAuditFailed': '"Audit failed"',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer1': 'MV3 has no permission-change observer —',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer2': 're-check fires on every SW wake.',

  // ── System status: vault hydration ──────────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultHydration.aria':
    'Vault hydration — vault blob loads from storage, every entry runs through the schema. Matches are kept; ' +
    'drift entries are dropped and reported as yellow.',
  'workbench.docs.diagrams.systemStatus.vaultHydration.title': 'Vault hydrate on SW wake',
  'workbench.docs.diagrams.systemStatus.vaultHydration.blobSuffix': ' (encrypted blob)',
  'workbench.docs.diagrams.systemStatus.vaultHydration.schemaValidator': 'Schema validator',
  'workbench.docs.diagrams.systemStatus.vaultHydration.matchesSchema': 'matches schema',
  'workbench.docs.diagrams.systemStatus.vaultHydration.driftOldShape': 'drift: old shape',
  'workbench.docs.diagrams.systemStatus.vaultHydration.kept': '✓ kept',
  'workbench.docs.diagrams.systemStatus.vaultHydration.dropped': '✗ dropped',
  'workbench.docs.diagrams.systemStatus.vaultHydration.secretsYellow': 'Secrets · yellow',
  'workbench.docs.diagrams.systemStatus.vaultHydration.keptEntries': 'kept entries',
  'workbench.docs.diagrams.systemStatus.vaultHydration.hydrateCleanly': 'hydrate cleanly',

  // ── System status: vault drift detail ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultDrift.aria':
    'What schema drift actually looks like — a valid entry has uid, label, and cipher; a drift entry might be ' +
    'missing the cipher field. The validator drops the bad row and emits a yellow status.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.title': 'What "schema drift" actually looks like',
  'workbench.docs.diagrams.systemStatus.vaultDrift.validEntry': 'Valid entry',
  'workbench.docs.diagrams.systemStatus.vaultDrift.driftEntry': 'Drift entry',
  'workbench.docs.diagrams.systemStatus.vaultDrift.apiToken': 'API token',
  'workbench.docs.diagrams.systemStatus.vaultDrift.oldToken': 'Old token',
  'workbench.docs.diagrams.systemStatus.vaultDrift.missing': '— missing —',
  'workbench.docs.diagrams.systemStatus.vaultDrift.issue': '2 schema issues → dropped',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer1':
    'Drift entries are dropped on hydrate and the pill goes yellow.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer2':
    "Re-saving from the Vault editor restores the entry's current shape.",

  // ── System status: live freshness ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveFreshness.aria':
    'Live workflow per-state rules — fresh, stale/faltering, failing — pinned to the actual thresholds.',
  'workbench.docs.diagrams.systemStatus.liveFreshness.title': 'Per-workflow state rules',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFresh': 'fresh',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateStale': 'stale / faltering',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFailing': 'failing',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFresh': 'last run OK · within 2× cadence · 0 failures',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleStale': 'past 2× cadence  · OR  1–4 consecutive failures',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFailing': '≥ 5 consecutive failures',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFresh': 'e.g. every refresh hits the 200',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egStale': 'e.g. one timeout, retrying',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFailing': 'e.g. API down for an hour',
  'workbench.docs.diagrams.systemStatus.liveFreshness.footer': "Cadence = the workflow's configured refresh interval.",

  // ── System status: live aggregation ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveAggregation.aria':
    'Live pill aggregation — three active-workspace workflows fold into one composite via max; inactive ' +
    'workspace workflows are excluded.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.title': 'Active-workspace workflows fold into one pill',
  'workbench.docs.diagrams.systemStatus.liveAggregation.activeWorkspace': 'Active workspace',
  'workbench.docs.diagrams.systemStatus.liveAggregation.contributes': 'contributes to the pill',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgFresh': 'fresh',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgConsecFails': '2 consecutive fails',
  'workbench.docs.diagrams.systemStatus.liveAggregation.otherWorkspaces': 'Other workspaces',
  'workbench.docs.diagrams.systemStatus.liveAggregation.excluded': 'deliberately excluded',
  'workbench.docs.diagrams.systemStatus.liveAggregation.skipped': "✗ user can't act on them — skipped",
  'workbench.docs.diagrams.systemStatus.liveAggregation.livePill': 'Live pill',
  'workbench.docs.diagrams.systemStatus.liveAggregation.maxYellow': 'max() = yellow',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer1': 'One worst-state workflow flips the whole pill.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer2':
    "Switch workspace and the pill recomputes against that workspace's runs.",

  // ── Open Headers: shared ────────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shared.openHeaders': 'Open Headers',
  'workbench.docs.diagrams.openHeaders.shared.stampBestInClass': 'BEST-IN-CLASS',
  'workbench.docs.diagrams.openHeaders.shared.badgeToday': 'TODAY',
  'workbench.docs.diagrams.openHeaders.shared.badgeRoadmap': 'ROADMAP',
  'workbench.docs.diagrams.openHeaders.shared.supports': 'SUPPORTS',
  'workbench.docs.diagrams.openHeaders.shared.inBrowser': 'In-browser',
  'workbench.docs.diagrams.openHeaders.shared.desktopApp': 'Desktop app',
  'workbench.docs.diagrams.openHeaders.shared.localServer': 'Local server',
  'workbench.docs.diagrams.openHeaders.shared.yourVm': 'Your VM',
  'workbench.docs.diagrams.openHeaders.shared.workbench': 'Workbench',
  'workbench.docs.diagrams.openHeaders.shared.devtools': 'DevTools',
  'workbench.docs.diagrams.openHeaders.shared.soon': 'soon',

  // ── Open Headers: paradigm shift ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shift.aria':
    'The paradigm shift — grouped contrasts between Open Headers and every other tool in the space. Everything in ' +
    'one browser extension, no account, local-only, no tracking, one engine for nine rule types, field-level sync, ' +
    'a full-featured free tier with no feature gates, seat-based pricing, and no lockout on lapse — versus the ' +
    'rest of the market.',
  'workbench.docs.diagrams.openHeaders.shift.title': 'THE PARADIGM SHIFT',
  'workbench.docs.diagrams.openHeaders.shift.everyoneElse': 'Everyone else',
  'workbench.docs.diagrams.openHeaders.shift.groupArchitecture': 'Architecture & Reach',
  'workbench.docs.diagrams.openHeaders.shift.groupPrivacy': 'Privacy & Ownership',
  'workbench.docs.diagrams.openHeaders.shift.groupCapability': 'Capability',
  'workbench.docs.diagrams.openHeaders.shift.groupSync': 'Sync & Resilience',
  'workbench.docs.diagrams.openHeaders.shift.groupPricing': 'Pricing & Trust',
  'workbench.docs.diagrams.openHeaders.shift.stampUnique': 'UNIQUE',
  'workbench.docs.diagrams.openHeaders.shift.stampUserControlled': 'USER-CONTROLLED',
  'workbench.docs.diagrams.openHeaders.shift.stampNoGates': 'NO FEATURE GATES',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserPrimary': 'Everything inside the browser',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserSub': 'back-end + front-end',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserTag': '- in the extension',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserPrimary': 'Back-end outside the browser',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserSub': 'desktop app / cloud, internet required',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostPrimary': 'Self-host the back-end',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostSub': 'browser · desktop app · server · VM',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostPrimary': 'Their cloud only',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostSub': 'no choice in where your data lives',
  'workbench.docs.diagrams.openHeaders.shift.usOfflinePrimary': 'Front-end works native offline',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineSub': 'extension · desktop · CLI · web',
  'workbench.docs.diagrams.openHeaders.shift.themOfflinePrimary': 'Cloud-only front-end (Online)',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineSub': 'needs internet for back-end access',
  'workbench.docs.diagrams.openHeaders.shift.usAccountPrimary': 'No account',
  'workbench.docs.diagrams.openHeaders.shift.usAccountSub': 'no sign-in, no login wall',
  'workbench.docs.diagrams.openHeaders.shift.themAccountPrimary': 'Sign in required',
  'workbench.docs.diagrams.openHeaders.shift.themAccountSub': 'to use your own data',
  'workbench.docs.diagrams.openHeaders.shift.usLocalPrimary': 'Local-only',
  'workbench.docs.diagrams.openHeaders.shift.usLocalSub': 'no cloud relay',
  'workbench.docs.diagrams.openHeaders.shift.themLocalPrimary': 'Cloud-relayed',
  'workbench.docs.diagrams.openHeaders.shift.themLocalSub': 'your traffic goes through them',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingPrimary': 'No tracking',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingSub': 'anonymous counters · one-switch off',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingPrimary': 'Tracked by default',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingSub': 'usage data sent home',
  'workbench.docs.diagrams.openHeaders.shift.usEnginePrimary': 'Rule Engine',
  'workbench.docs.diagrams.openHeaders.shift.usEngineSub': 'intercept & modify requests',
  'workbench.docs.diagrams.openHeaders.shift.themEnginePrimary': 'No in-browser engine',
  'workbench.docs.diagrams.openHeaders.shift.themEngineSub': 'separate proxy or app required',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogPrimary': 'API Requests Catalog',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogSub': 'HTTP, WS, GraphQL — all in-browser',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogPrimary': 'Sign in to a platform',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogSub': 'and install their app',
  'workbench.docs.diagrams.openHeaders.shift.usAutomatePrimary': 'Automate your workspace',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateSub': 'your AI agent, local or remote',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateTag': '- you decide',
  'workbench.docs.diagrams.openHeaders.shift.themAutomatePrimary': 'Private or their cloud AI only',
  'workbench.docs.diagrams.openHeaders.shift.themAutomateSub': 'no open or programmatic access',
  'workbench.docs.diagrams.openHeaders.shift.usSyncPrimary': 'Real-time Sync Engine',
  'workbench.docs.diagrams.openHeaders.shift.usSyncSub': 'multi-device, browser, surface',
  'workbench.docs.diagrams.openHeaders.shift.themSyncPrimary': 'Last-write-wins',
  'workbench.docs.diagrams.openHeaders.shift.themSyncSub': 'or no sync at all',
  'workbench.docs.diagrams.openHeaders.shift.usSavePrimary': 'Conflict-free concurrent Save',
  'workbench.docs.diagrams.openHeaders.shift.usSaveSub': 'field-level, all changes committed',
  'workbench.docs.diagrams.openHeaders.shift.themSavePrimary': 'Entity-level overwrite',
  'workbench.docs.diagrams.openHeaders.shift.themSaveSub': 'saves can wipe each other',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditPrimary': 'Works offline, fully editable',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditSub': "syncs automatically when you're back",
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditPrimary': 'Needs online connection',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditSub': 'or no access at all',
  'workbench.docs.diagrams.openHeaders.shift.usTierPrimary': 'Everything today, on every tier',
  'workbench.docs.diagrams.openHeaders.shift.usTierSub': 'free ≤ 6 users · paid = team seats',
  'workbench.docs.diagrams.openHeaders.shift.themTierPrimary': 'Feature-gated tiers',
  'workbench.docs.diagrams.openHeaders.shift.themTierSub': 'core capabilities behind upsells',
  'workbench.docs.diagrams.openHeaders.shift.usSsoPrimary': 'SSO & security always free',
  'workbench.docs.diagrams.openHeaders.shift.usSsoSub': 'SSO/OIDC · RBAC · audit · SIEM',
  'workbench.docs.diagrams.openHeaders.shift.themSsoPrimary': 'The SSO tax',
  'workbench.docs.diagrams.openHeaders.shift.themSsoSub': 'security sold as enterprise add-on',
  'workbench.docs.diagrams.openHeaders.shift.usLapsePrimary': 'A lapse never locks you out',
  'workbench.docs.diagrams.openHeaders.shift.usLapseSub': 'grace, then free tier — data yours',
  'workbench.docs.diagrams.openHeaders.shift.themLapsePrimary': 'Stop paying, lose access',
  'workbench.docs.diagrams.openHeaders.shift.themLapseSub': 'paywall over your own data',
  'workbench.docs.diagrams.openHeaders.shift.footer': 'Local-first. By design. Not as an afterthought.',

  // ── Open Headers: API catalog ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.apiCatalog.aria':
    'API Requests Catalog — a stylized request-editor mockup showing the method picker, URL bar, tab strip, and ' +
    'body preview, plus a feature strip covering protocols, auth, scripts, variables, files, collections, and ' +
    'cookies.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.title': 'API Requests Catalog',
  'workbench.docs.diagrams.openHeaders.apiCatalog.subtitle':
    'Full request building, sending, and collection management — inside the extension.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.send': 'Send ▸',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabParams': 'Params',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabAuth': 'Auth',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabHeaders': 'Headers',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabBody': 'Body',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabScripts': 'Scripts',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabSettings': 'Settings',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuth': 'Auth',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuthSub': 'OAuth 2.0 · Basic · Bearer · API Key',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScripts': 'Scripts',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScriptsSub': 'pre-request + post-response',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariables': 'Variables',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariablesSub': '5 scopes · structured diagnostics',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFiles': 'Files',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFilesSub': 'multipart · {{file.X}} resolution',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollections': 'Collections',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollectionsSub': 'folders · environments · per-request',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookies': 'Cookies',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookiesSub': 'opt-in credentialsMode',
  'workbench.docs.diagrams.openHeaders.apiCatalog.kicker': 'EVERYTHING A DESKTOP API CLIENT SHIPS — IN-EXTENSION',
  'workbench.docs.diagrams.openHeaders.apiCatalog.footer': 'A full API platform — without the platform.',

  // ── Open Headers: rule engine ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.ruleEngine.aria':
    'Open Headers rule engine — two execution paths (DNR-native and script-based intercept), nine rule type ' +
    'categories grouped by engine, plus the shared condition language and variable scope chain that every rule ' +
    'reads from.',
  'workbench.docs.diagrams.openHeaders.ruleEngine.title': 'Rule Engine',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subtitle': 'MV3 native · two engines · nine rule categories',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerDnr': 'DNR · native',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerScript': 'Script · intercept',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeaders': 'Headers',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeaders': 'Override · Append · Remove',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameBlock': 'Block',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subBlock': 'cancel at network layer',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRedirect': 'Redirect',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRedirect': 'static URL or regex',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameQueryParams': 'Query Params',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subQueryParams': 'add · replace · remove · strip-all',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeadersMerge': 'Headers (Merge)',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeadersMerge': 'value concatenation',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameInject': 'Inject',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subInject': 'JS or CSS, two timings',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameDelay': 'Delay',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subDelay': 'navigation + fetch/XHR',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRequestBody': 'Request Body',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRequestBody': 'static · dynamic · GraphQL filter',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameResponseBody': 'Response Body',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subResponseBody': 'body + status + headers',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionDnr': 'catches every browser-issued request',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionScript': 'catches JS-initiated fetch / XHR',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsKicker': 'ONE CONDITION LANGUAGE',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsList':
    'Request Domains · URL Pattern · URL Regex · Methods · Resource · Initiator · Headers · Domain Type',
  'workbench.docs.diagrams.openHeaders.ruleEngine.scopesKicker': 'FIVE VARIABLE SCOPES',
  'workbench.docs.diagrams.openHeaders.ruleEngine.footer':
    'One engine. Two execution paths. Full condition + variable language. Inside the extension.',

  // ── Open Headers: convergence ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.convergence.aria':
    'Three legacy product categories — desktop proxies, cloud API platforms, header-only extensions — converge ' +
    "into one Open Headers browser extension. A stylized Chromium browser shows the extension's workbench page " +
    'open, and every capability the three legacy categories used to provide lives inside that single tab.',
  'workbench.docs.diagrams.openHeaders.convergence.title': 'Three tool categories. One extension.',
  'workbench.docs.diagrams.openHeaders.convergence.subtitle':
    'What used to take three separate installs now lives in one browser tab.',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxies': 'Desktop proxies',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxiesSub': 'HTTP interception · CA cert · separate binary',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatforms': 'API platforms',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatformsSub':
    'requests + collections · cloud-hosted · account',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensions': 'Header extensions',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensionsSub': 'one rule type · no scripts · no auth',
  'workbench.docs.diagrams.openHeaders.convergence.allInOneTab': '▼ ALL OPEN IN ONE TAB',
  'workbench.docs.diagrams.openHeaders.convergence.tabTitle': '#1 Open Headers',
  'workbench.docs.diagrams.openHeaders.convergence.workbenchSurface': 'the workbench surface',
  'workbench.docs.diagrams.openHeaders.convergence.mv3Chip': 'MV3 native',
  'workbench.docs.diagrams.openHeaders.convergence.pillRuleEngine': 'Rule Engine',
  'workbench.docs.diagrams.openHeaders.convergence.pillApiCatalog': 'API Requests Catalog',
  'workbench.docs.diagrams.openHeaders.convergence.pillSync': 'Real-time Sync Engine',
  'workbench.docs.diagrams.openHeaders.convergence.pillSave': 'Conflict-free Save',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoAccount': 'No account · no sign-in',
  'workbench.docs.diagrams.openHeaders.convergence.pillLocalOnly': 'Local-only · no cloud relay',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoTracking': 'No tracking · no personal data',
  'workbench.docs.diagrams.openHeaders.convergence.pillMultiSurface': 'Multi-surface UI',
  'workbench.docs.diagrams.openHeaders.convergence.footerStrip':
    'Multi-surface · cross-device sync · local-only by design',
  'workbench.docs.diagrams.openHeaders.convergence.caption':
    'Blue = capabilities · purple = posture · all eight live inside one tab',

  // ── Open Headers: field sync ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.fieldSync.aria':
    'Two surfaces edit the same rule simultaneously. DevTools adds, modifies, and removes headers; the Workbench ' +
    'edits three different fields of the same rule. All six edits land in the merged rule without a banner or ' +
    'overwrite.',
  'workbench.docs.diagrams.openHeaders.fieldSync.title': 'Two surfaces, same rule, both edits land',
  'workbench.docs.diagrams.openHeaders.fieldSync.subtitle': 'Per-field sync — no banner, no overwrite, no lost work',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceA': 'surface A',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceB': 'surface B',
  'workbench.docs.diagrams.openHeaders.fieldSync.editingHeaders': 'editing headers',
  'workbench.docs.diagrams.openHeaders.fieldSync.ruleX': 'Rule X',
  'workbench.docs.diagrams.openHeaders.fieldSync.headersTag': 'headers',
  'workbench.docs.diagrams.openHeaders.fieldSync.syncBand': 'SYNC ENGINE · per-field merge',
  'workbench.docs.diagrams.openHeaders.fieldSync.mergedTag': 'merged snapshot · headers',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupAdded': 'Added',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupModified': 'Modified',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupRemoved': 'Removed',
  'workbench.docs.diagrams.openHeaders.fieldSync.fromPrefix': '← from ',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict1': '✓ both edits applied — no banner, no conflict',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict2':
    'Same path scales: extension today → extension + desktop + CLI tomorrow',

  // ── Open Headers: front-ends ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.frontEnds.aria':
    'Choose your front-end — how you access and manage your data. Four front-end form factors stacked vertically: ' +
    'browser extension, desktop app, CLI app, and web app. Each card lists the surfaces it exposes, the back-ends ' +
    'it can connect to (first chip is the default), and the platforms it runs on.',
  'workbench.docs.diagrams.openHeaders.frontEnds.title': 'Choose your front-end — how you access & manage your data',
  'workbench.docs.diagrams.openHeaders.frontEnds.subtitle':
    'Same data, any front-end — pick one, use all, every surface stays in sync.',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleExtension': 'Browser Extension',
  'workbench.docs.diagrams.openHeaders.frontEnds.subExtension': 'inside a browser',
  'workbench.docs.diagrams.openHeaders.frontEnds.subDesktop': 'native window',
  'workbench.docs.diagrams.openHeaders.frontEnds.subCli': 'command-line',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleWeb': 'Web App',
  'workbench.docs.diagrams.openHeaders.frontEnds.subWeb': 'browser tab',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfPopup': 'Popup',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfSidePanel': 'Side-panel',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfCommandLine': 'Command-line',
  'workbench.docs.diagrams.openHeaders.frontEnds.chipEmbedded': 'Embedded',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectSurfaces': 'SURFACES',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectBackEnds': 'CONNECTS TO BACK-END',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip1': "PICK A FRONT-END, OR PICK THEM ALL — IT'S THE SAME DATA",
  'workbench.docs.diagrams.openHeaders.frontEnds.strip2':
    '✓ extension · ✓ desktop · ✓ CLI · ✓ web — all reading the same canonical entities',
  'workbench.docs.diagrams.openHeaders.frontEnds.footer':
    'Same data, any way you reach it — every surface stays in sync.',

  // ── Open Headers: local-first ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.localFirst.aria':
    'Choose your back-end — where your data lives. Four hosting options stacked vertically. Each tier inherits ' +
    'all capabilities from the previous tier and adds new ones, highlighted in a green dotted rectangle. A ' +
    'SUPPORTS column on the right lists the browsers, operating systems, and cloud providers each tier runs on. ' +
    'All four tiers local-only.',
  'workbench.docs.diagrams.openHeaders.localFirst.title': 'Choose your back-end — where your data lives',
  'workbench.docs.diagrams.openHeaders.localFirst.subtitle':
    "Each tier inherits the previous tier — green box shows what's new — right column shows where it runs.",
  'workbench.docs.diagrams.openHeaders.localFirst.subBrowser': 'extension service worker',
  'workbench.docs.diagrams.openHeaders.localFirst.subDesktop': 'embedded back-end',
  'workbench.docs.diagrams.openHeaders.localFirst.subServer': 'standalone process',
  'workbench.docs.diagrams.openHeaders.localFirst.subVm': 'host it anywhere',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletZeroSetup': 'zero setup',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSingleDevice': 'single device',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerBrowser': 'per-browser instance',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiSurface': 'multi-surface concurrent editing',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiWindow': 'multi-window concurrent editing',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLocalhostOnly': 'Localhost-only',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiBrowser': 'multi-browser instances',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerApp': 'per-app instance',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFilesystem': 'native filesystem',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletYaml': 'YAML on disk',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletGit': 'git integration (local/remote)',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMinimalSetup': 'minimal setup',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLan': 'LAN-reachable',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiApp': 'multi-app instances',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiDevice': 'multiple devices',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFrontEnds': 'browser ext · desktop app · CLI',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletStandardSetup': 'standard setup',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletWan': 'WAN/Internet-reachable',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletTeamReady': 'team-ready',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSso': 'SSO Auth',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletRbac': 'RBAC user management',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletAudit': 'audit logs & reports',
  'workbench.docs.diagrams.openHeaders.localFirst.platAllOs': 'All OS',
  'workbench.docs.diagrams.openHeaders.localFirst.platEmbedded': 'Embedded',
  'workbench.docs.diagrams.openHeaders.localFirst.platHyperscalers': 'Hyperscalers',
  'workbench.docs.diagrams.openHeaders.localFirst.platEuNative': 'EU-native',
  'workbench.docs.diagrams.openHeaders.localFirst.platOther': 'Other',
  'workbench.docs.diagrams.openHeaders.localFirst.platEnterprise': 'Enterprise',
  'workbench.docs.diagrams.openHeaders.localFirst.itemMiniPc': 'Mini PC',
  'workbench.docs.diagrams.openHeaders.localFirst.itemHomeServer': 'Home server',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOldLaptop': 'Old laptop',
  'workbench.docs.diagrams.openHeaders.localFirst.itemYourCloud': 'Your cloud',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOnPrem': 'On-prem',
  'workbench.docs.diagrams.openHeaders.localFirst.inheritsFrom': 'INHERITS FROM {tier}',
  'workbench.docs.diagrams.openHeaders.localFirst.newInTier': '+ NEW IN THIS TIER',
  'workbench.docs.diagrams.openHeaders.localFirst.strip1': 'WHATEVER YOU PICK — YOU OWN IT, END-TO-END',
  'workbench.docs.diagrams.openHeaders.localFirst.strip2':
    '✓ no account · ✓ no cloud relay · ✓ no tracking · ✓ no personal data',
  'workbench.docs.diagrams.openHeaders.localFirst.footer': 'Your data, your back-end, your choice — at every step.',

  // ── Open Headers: comparison matrix ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.matrix.aria':
    'Four category cards comparing SaaS API platforms, desktop proxies, and header-only extensions against ' +
    'Open Headers.',
  'workbench.docs.diagrams.openHeaders.matrix.title': 'WHERE OPEN HEADERS LANDS',
  'workbench.docs.diagrams.openHeaders.matrix.catSaas': 'SaaS API platforms',
  'workbench.docs.diagrams.openHeaders.matrix.catProxies': 'Desktop proxies',
  'workbench.docs.diagrams.openHeaders.matrix.catHeaderOnly': 'Header-only extensions',
  'workbench.docs.diagrams.openHeaders.matrix.tagCloud': 'cloud',
  'workbench.docs.diagrams.openHeaders.matrix.tagNative': 'native',
  'workbench.docs.diagrams.openHeaders.matrix.tagLite': 'lite',
  'workbench.docs.diagrams.openHeaders.matrix.tagUs': 'us',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasData': 'Your data lives on their servers',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasAccount': 'Account + login required',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasFeatures': 'Broad feature set',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyBinary': 'Separate binary to install + run',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyCert': 'CA cert + per-app proxy config',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyTraffic': 'Sees every kind of traffic',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoSetup': 'In-browser, no setup',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteOneRule': 'One rule type — headers only',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoScripts': 'No scripts, no auth, no body edits',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsLocal': 'In-browser · local-only · no account',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsNine': 'Nine rule types · one condition language',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsScripts': 'Scripts + OAuth + files in the extension',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsSurfaces': 'Four surfaces share one store',

  // ── Open Headers: vs cloud ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsCloud.aria':
    'vs cloud API platforms. Cloud platforms keep credentials, rule definitions and request logs on a vendor ' +
    "server. Open Headers keeps all three on the user's device.",
  'workbench.docs.diagrams.openHeaders.vsCloud.title': 'Where your data ends up',
  'workbench.docs.diagrams.openHeaders.vsCloud.subtitle':
    'Credentials, rule definitions, request logs — local or remote?',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowCredentials': 'credentials',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowRules': 'rule definitions',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowLogs': 'request logs',
  'workbench.docs.diagrams.openHeaders.vsCloud.onDevice': 'on your device',
  'workbench.docs.diagrams.openHeaders.vsCloud.onVendor': 'on vendor server',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloudPlatform': 'Cloud API platform',
  'workbench.docs.diagrams.openHeaders.vsCloud.you': 'you',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourData': 'your data',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloud': 'cloud',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourDevice': 'your device',
  'workbench.docs.diagrams.openHeaders.vsCloud.deviceContents': 'credentials · rules · logs',
  'workbench.docs.diagrams.openHeaders.vsCloud.allInOnePlace': 'all in one place',
  'workbench.docs.diagrams.openHeaders.vsCloud.verdict': 'Your data never leaves your machine',

  // ── Open Headers: vs header-only ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.aria':
    'vs header-only extensions. Header-only extensions handle one rule type. Open Headers handles nine — headers, ' +
    'block, redirect, query params, headers merge, inject, delay, request body, response body.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.title': 'How many rule types',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.subtitle':
    'One tool that does one thing — or one tool that does nine.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.headerOnlyExtension': 'Header-only extension',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeaders': 'Headers',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeadersSub': 'override',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlock': 'Block',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlockSub': 'cancel',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirect': 'Redirect',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirectSub': 'static / regex',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuery': 'Query',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuerySub': 'add · remove',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMerge': 'Merge',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMergeSub': 'headers ⊕',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInject': 'Inject',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInjectSub': 'JS / CSS',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelay': 'Delay',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelaySub': 'nav / fetch',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBody': 'Req Body',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBodySub': 'static · dyn',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBody': 'Res Body',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBodySub': 'body / status',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionLeft':
    'Need any of the other 8? — install another extension',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionRight': 'Same conditions, same surface, one workspace',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.verdict':
    'Nine rule types, one condition language, one observable surface',

  // ── Open Headers: vs proxy ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsProxy.aria':
    'vs desktop proxies. Proxies route traffic through a separate process behind a CA certificate. Open Headers ' +
    "applies rules inline through the browser's native APIs — no proxy port, no certificate.",
  'workbench.docs.diagrams.openHeaders.vsProxy.title': 'How requests get shaped',
  'workbench.docs.diagrams.openHeaders.vsProxy.subtitle':
    'Inline rules in the browser — no proxy port, no CA certificate, no per-app config.',
  'workbench.docs.diagrams.openHeaders.vsProxy.desktopProxy': 'Desktop proxy',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampDetour': 'DETOUR',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampInline': 'INLINE',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeApp': 'App',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeAppSub': 'configured',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodePortSub': 'proxy port',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxy': 'Proxy',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxySub': 'CA cert',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeInternet': 'Internet',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeBrowser': 'Browser',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallBinary': 'install binary',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallCert': 'install CA cert',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipPerApp': 'per-app config',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallExtension': 'install extension',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipThatsIt': "that's it",
  'workbench.docs.diagrams.openHeaders.vsProxy.verdict':
    "One install · zero certificates · rules run with the page's own permissions",

  // ── Open Headers: roadmap CLI ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapCli.aria':
    'Roadmap milestone — CLI. A terminal window showing example commands for listing rules, switching ' +
    'environments, and sending a saved request — all talking to the same server as the UI.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.title': 'CLI · headless scripting',
  'workbench.docs.diagrams.openHeaders.roadmapCli.subtitle':
    'Same server as the UI — automation stays in sync with what you see.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.termTitle': 'oh · terminal',
  'workbench.docs.diagrams.openHeaders.roadmapCli.comment': '# same server · same workspace as the UI',
  'workbench.docs.diagrams.openHeaders.roadmapCli.verdict': 'List · toggle · send · diff — straight from the shell',

  // ── Open Headers: roadmap daemon ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapServer.aria':
    'Roadmap milestone — Local / LAN server. A server in the center; extension, desktop app, and CLI all ' +
    'connect as clients across your LAN.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.title': 'Local / LAN server · one sync hub',
  'workbench.docs.diagrams.openHeaders.roadmapServer.subtitle':
    'Extension · desktop · CLI — all clients of the same server, all on your network.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackWorkspaces': 'workspaces',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackRules': 'rules · vault',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackSync': 'sync engine',
  'workbench.docs.diagrams.openHeaders.roadmapServer.lanReachable': 'LAN-reachable',
  'workbench.docs.diagrams.openHeaders.roadmapServer.clientExtension': 'Browser ext',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideLaptop': 'laptop',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideWorkstation': 'workstation',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfExtension': 'Popup · Workbench · DevTools',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfDesktop': 'Workbench · multi-window',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfCli': 'any machine · $ oh rules · $ oh env',
  'workbench.docs.diagrams.openHeaders.roadmapServer.verdict': 'One server · many clients · stays on your network',

  // ── Open Headers: roadmap desktop app ───────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.aria':
    'Roadmap milestone — Desktop app. Browser extension and native desktop app both expose the Workbench surface ' +
    'over the same on-disk store. The desktop app adds protocols a browser extension cannot host natively: AI, ' +
    'MCP, gRPC, MQTT.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.title': 'Native window · same store · extra reach',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.subtitle':
    "Same Workbench, same workspace — desktop adds protocols a browser can't host.",
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.cardExtension': 'Browser extension',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.tagToday': 'today',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerSurface': 'SURFACE',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerFeatures': 'FEATURES',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerApiCatalog': 'API CATALOG',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featHttpRules': 'Interceptor',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featVariables': 'Variables',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featApiCatalog': 'API Catalog',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.noteLocalRemote': 'local / remote',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.desktopOnly': '+ DESKTOP-ONLY',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.browserFeasible': 'All four are browser-feasible.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.storePill': 'same on-disk workspace store',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.verdict':
    "One workspace, two front-ends, the extra reach where the browser can't go",

  // ── Open Headers: roadmap git workspaces ────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapGit.aria':
    'Roadmap milestone — Team workspaces via Git. Two devices each hold a workspace; both push to and pull from a ' +
    'shared Git repository. The repo is the sync layer; no vendor server in the middle.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.title': 'Workspaces as Git repositories',
  'workbench.docs.diagrams.openHeaders.roadmapGit.subtitle':
    'Pull syncs · push shares · merge through Git — no vendor server.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceA': 'device A',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceB': 'device B',
  'workbench.docs.diagrams.openHeaders.roadmapGit.workspace': 'Workspace',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceContents': 'rules · environments · vault',
  'workbench.docs.diagrams.openHeaders.roadmapGit.verdict': 'Your data, your repo, your auditable history',

  // ── Open Headers: roadmap importers ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapImporters.aria':
    'Importers. Six source formats funnel into one Open Headers workspace — cURL, HAR headers, Postman, HAR full ' +
    'requests, Insomnia, OpenAPI — all live today.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.title': 'Importers · bring your collection across',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.subtitle':
    'cURL, HAR, Postman, Insomnia, OpenAPI, full HAR requests — all live today.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarNote': 'headers',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcPostman': 'Postman collection',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarFull': 'HAR (full requests)',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcInsomnia': 'Insomnia collection',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcOpenApi': 'OpenAPI spec',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagToday': 'TODAY',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagNext': 'NEXT',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.sideWorkspace': 'workspace',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.kickerImported': 'IMPORTED INTO',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetRules': 'Interceptor',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetCollections': 'API Request Collections',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetEnvironments': 'Environments',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetVault': 'Vault entries',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.verdict': 'Bring it across in one step — keep working',

  // ── Open Headers: roadmap MCP architecture ──────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpArch.aria':
    'Roadmap milestone — MCP Server architecture. An AI client connects to Open Headers through the Model Context ' +
    "Protocol (stdio for local, HTTP/SSE for remote). The OH MCP server mutates the user's workspace; the result " +
    'shows up in the Workbench.',
  'workbench.docs.diagrams.openHeaders.mcpArch.title': 'MCP Server · your workspace, any AI client',
  'workbench.docs.diagrams.openHeaders.mcpArch.subtitle':
    'Open Headers speaks Model Context Protocol — any MCP-capable agent can drive your workspace.',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientTitle': 'AI client',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientSideTag': 'your agent',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerAnyClient': 'ANY MCP CLIENT',
  'workbench.docs.diagrams.openHeaders.mcpArch.serverTitle': 'OH MCP Server',
  'workbench.docs.diagrams.openHeaders.mcpArch.sideTagOpenHeaders': 'open headers',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerExposes': 'EXPOSES',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRules': 'Rules · CRUD',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRequests': 'API Requests',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeEnvironments': 'Environments',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeVariables': 'Variables · Vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportLocal': 'local',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportRemote': 'remote',
  'workbench.docs.diagrams.openHeaders.mcpArch.mutates': 'mutates',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbTitle': 'Workbench · your workspace',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbLive': 'live',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbContents': 'rules · environments · variables · workflows · vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.verdict': 'Drive your workspace with any AI agent · local or remote',

  // ── Open Headers: roadmap MCP tools ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpTools.aria':
    'Roadmap milestone — MCP Server tools catalog. Seven domains exposing {n} tools total: rules, requests, ' +
    'environments, variables, workflows, workspaces, activity.',
  'workbench.docs.diagrams.openHeaders.mcpTools.title': 'What the AI agent can do',
  'workbench.docs.diagrams.openHeaders.mcpTools.subtitle':
    "Seven domains — full CRUD where it makes sense, scoped read-only where it doesn't.",
  'workbench.docs.diagrams.openHeaders.mcpTools.domRules': 'Rules',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRules': 'header · block · redirect · response',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRequests': 'Requests',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRequests': 'API Catalog',
  'workbench.docs.diagrams.openHeaders.mcpTools.domEnvironments': 'Environments',
  'workbench.docs.diagrams.openHeaders.mcpTools.subEnvironments': 'per workspace',
  'workbench.docs.diagrams.openHeaders.mcpTools.domVariables': 'Variables',
  'workbench.docs.diagrams.openHeaders.mcpTools.subVariables': 'all scopes · vault',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkflows': 'chained API calls',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkspaces': 'Workspaces',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkspaces': 'multi-workspace',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCount': '{n} TOOLS',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCountOne': '1 TOOL',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityTitle': 'Activity',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityNote':
    'the change feed — an agent sees what changed before acting',
  'workbench.docs.diagrams.openHeaders.mcpTools.verdict': '{n} tools · seven domains · the full Open Headers surface',

  // ── Open Headers: roadmap milestones ────────────────────────────────
  'workbench.docs.diagrams.openHeaders.milestones.aria':
    'Milestones — ordered cards inside a browser-window frame: Git workspaces, desktop app, MCP server, local ' +
    'server, CLI, self-hosted web app, importers — all live.',
  'workbench.docs.diagrams.openHeaders.milestones.chromeTitle': 'Every surface, shipped',
  'workbench.docs.diagrams.openHeaders.milestones.addrSubtitle':
    'Shipped in sequence — local-only stayed the product through every milestone.',
  'workbench.docs.diagrams.openHeaders.milestones.tagLive': 'LIVE',
  'workbench.docs.diagrams.openHeaders.milestones.badgeUserControlled': 'USER-CONTROLLED',
  'workbench.docs.diagrams.openHeaders.milestones.msGit': 'Workspace collaboration via Git (Team-ready)',
  'workbench.docs.diagrams.openHeaders.milestones.descGit':
    'YAML in a Git repo you control — pull, push, merge via Git.',
  'workbench.docs.diagrams.openHeaders.milestones.descDesktop':
    "Native binary on the same store — reaches what an extension can't.",
  'workbench.docs.diagrams.openHeaders.milestones.msMcp': 'MCP Server (AI agent control)',
  'workbench.docs.diagrams.openHeaders.milestones.descMcp':
    'Open Headers over MCP — let an AI agent drive your workspace.',
  'workbench.docs.diagrams.openHeaders.milestones.msServer': 'Local / LAN server',
  'workbench.docs.diagrams.openHeaders.milestones.descServer':
    'Server on your machine or LAN — extension, desktop, CLI as clients.',
  'workbench.docs.diagrams.openHeaders.milestones.descCli':
    'Headless scripting and CI — list, toggle, send from the shell.',
  'workbench.docs.diagrams.openHeaders.milestones.msVm': 'Self-hosted VM deployment + Web App',
  'workbench.docs.diagrams.openHeaders.milestones.descVm':
    'Web bundle on your VM — locked-down browsers or branded deploys.',
  'workbench.docs.diagrams.openHeaders.milestones.msImporters': 'More importers',
  'workbench.docs.diagrams.openHeaders.milestones.descImporters':
    'Beyond Postman — Insomnia, OpenAPI specs, full HAR imports.',
  'workbench.docs.diagrams.openHeaders.milestones.footer':
    'Cross-user sync ships through Git and self-hosted deployments — no vendor-hosted cloud.',

  // ── Open Headers: roadmap web app ───────────────────────────────────
  'workbench.docs.diagrams.openHeaders.webApp.aria':
    'Roadmap milestone — Self-hosted web app. Your origin serves the same UI bundle; users open it as a browser ' +
    'tab on a domain you control. Same Workbench surface, no extension required.',
  'workbench.docs.diagrams.openHeaders.webApp.title': 'Self-hosted VM deployment + Web App',
  'workbench.docs.diagrams.openHeaders.webApp.subtitle':
    'Your VM serves the web bundle — your origin, your domain, your users.',
  'workbench.docs.diagrams.openHeaders.webApp.serves': 'serves',
  'workbench.docs.diagrams.openHeaders.webApp.chromeTitle': 'Open Headers · web',
  'workbench.docs.diagrams.openHeaders.webApp.bodySub': 'same surface as extension + desktop',
  'workbench.docs.diagrams.openHeaders.webApp.verdict': 'Same UI · your origin · no extension required',

  // ── Root shared — kickers recurring across root-level diagrams ──────
  'workbench.docs.diagrams.shared.ruleKicker': 'RULE',
  'workbench.docs.diagrams.shared.useCasesKicker': 'COMMON USE CASES',
  'workbench.docs.diagrams.shared.wontFireKicker': "WHEN IT DOESN'T FIRE",
  'workbench.docs.diagrams.shared.suggestion': 'Suggestion',
  'workbench.docs.diagrams.shared.beforeKicker': 'BEFORE',
  'workbench.docs.diagrams.shared.afterKicker': 'AFTER',

  // ── Block ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.block.aria':
    'Block cancels matching requests at the network layer — the page sees a network error. main_frame blocks ' +
    'render ERR_BLOCKED_BY_CLIENT; sub-resource blocks fail silently.',
  'workbench.docs.diagrams.block.rule': 'Block · Request Domains: ads.openheaders.com',
  'workbench.docs.diagrams.block.pageTitle': 'Page',
  'workbench.docs.diagrams.block.dnrBlock': 'DNR block',
  'workbench.docs.diagrams.block.network': 'Network',
  'workbench.docs.diagrams.block.neverReached': 'never reached',
  'workbench.docs.diagrams.block.requestCancelled': 'request cancelled',
  'workbench.docs.diagrams.block.pageSeesKicker': 'WHAT THE PAGE SEES',
  'workbench.docs.diagrams.block.chromeBlockPage': "Chrome's block page",
  'workbench.docs.diagrams.block.silentFailure': 'Silent failure',
  'workbench.docs.diagrams.block.pageHandlesError': 'page handles its own error',
  'workbench.docs.diagrams.block.useCasesAria':
    'Block — common use cases: ads & trackers, outage simulation, endpoint denial, and page-only block.',
  'workbench.docs.diagrams.block.card1Title': 'Ads & trackers',
  'workbench.docs.diagrams.block.card1Example': 'Block ads.openheaders.com',
  'workbench.docs.diagrams.block.card2Title': 'Outage simulation',
  'workbench.docs.diagrams.block.card2Example': 'Take a host offline to test',
  'workbench.docs.diagrams.block.card3Title': 'Endpoint denial',
  'workbench.docs.diagrams.block.card3Example': 'Block /api/admin only',
  'workbench.docs.diagrams.block.card4Title': 'Page-only block',
  'workbench.docs.diagrams.block.card4Example': 'Add main_frame condition',
  'workbench.docs.diagrams.block.useCasesFooter': 'Pair Block with Conditions to scope it down.',
  'workbench.docs.diagrams.block.wontApplyAria':
    "Block doesn't retro-cancel already-loaded resources. Reload the page after enabling the rule to catch " +
    'future requests.',
  'workbench.docs.diagrams.block.alreadyLoaded': 'Already-loaded resources',
  'workbench.docs.diagrams.block.alreadyLoadedSub': 'Only future requests are intercepted — past ones stay loaded.',
  'workbench.docs.diagrams.block.suggestionText': 'Reload the page after enabling the rule.',

  // ── Redirect ────────────────────────────────────────────────────────
  'workbench.docs.diagrams.redirect.staticAria':
    'Static redirect — every matching request is rewritten to the same destination URL.',
  'workbench.docs.diagrams.redirect.ruleStatic': 'Redirect → https://openheaders.com/new-page',
  'workbench.docs.diagrams.redirect.originalRequestKicker': 'ORIGINAL REQUEST',
  'workbench.docs.diagrams.redirect.urlRewritten': 'URL rewritten',
  'workbench.docs.diagrams.redirect.redirectedToKicker': 'REDIRECTED TO',
  'workbench.docs.diagrams.redirect.staticStamp': 'Every match → same destination URL.',
  'workbench.docs.diagrams.redirect.staticStampSub': 'Browser navigates as if the server returned a redirect.',
  'workbench.docs.diagrams.redirect.regexAria':
    "Regex redirect — the URL pattern's capture groups are referenced as \\1, \\2 in the destination URL.",
  'workbench.docs.diagrams.redirect.ruleRegexLine1': 'URL Regex: ^http://(openheaders\\.io/.*)$',
  'workbench.docs.diagrams.redirect.ruleRegexLine2': 'Redirect → https://\\1',
  'workbench.docs.diagrams.redirect.originalUrlKicker': 'ORIGINAL URL',
  'workbench.docs.diagrams.redirect.captureChip': '\\1 = openheaders.com/page',
  'workbench.docs.diagrams.redirect.substituted': '\\1 substituted',
  'workbench.docs.diagrams.redirect.regexStamp': '\\1 inherits whatever the capture group matched.',
  'workbench.docs.diagrams.redirect.useCasesAria':
    'Redirect — common use cases: HTTP→HTTPS upgrade, domain migration, path rewrite, local dev proxy.',
  'workbench.docs.diagrams.redirect.card1Example': 'Force all http to https',
  'workbench.docs.diagrams.redirect.card2Title': 'Domain migration',
  'workbench.docs.diagrams.redirect.card3Title': 'Path rewrite',
  'workbench.docs.diagrams.redirect.card4Title': 'Local dev proxy',
  'workbench.docs.diagrams.redirect.useCasesFooter': 'Use URL Regex with backreferences for path-preserving rewrites.',
  'workbench.docs.diagrams.redirect.wontApplyAria':
    "Redirect doesn't retro-apply to loaded pages, and redirect loops are capped by Chrome to prevent infinite " +
    'cycles.',
  'workbench.docs.diagrams.redirect.pageLoaded': 'Page already loaded',
  'workbench.docs.diagrams.redirect.pageLoadedSub': 'Only future navigations and fetches are intercepted.',
  'workbench.docs.diagrams.redirect.loops': 'Redirect loops',
  'workbench.docs.diagrams.redirect.loopsSub': 'Chrome caps it — ERR_TOO_MANY_REDIRECTS.',
  'workbench.docs.diagrams.redirect.suggestionText': "Reload. Make sure conditions don't loop.",

  // ── Inject JS / CSS ─────────────────────────────────────────────────
  'workbench.docs.diagrams.inject.timingAria':
    'Inject timing — ASAP runs pre-page-script; After Load runs once DOM is parsed.',
  'workbench.docs.diagrams.inject.timeAxis': 'time →',
  'workbench.docs.diagrams.inject.navigation': 'navigation',
  'workbench.docs.diagrams.inject.domParsed': 'DOM parsed',
  'workbench.docs.diagrams.inject.loadEvent': 'load event',
  'workbench.docs.diagrams.inject.asap': 'ASAP',
  'workbench.docs.diagrams.inject.prePageScript': 'pre-page-script',
  'workbench.docs.diagrams.inject.afterLoad': 'After Load',
  'workbench.docs.diagrams.inject.domSafe': 'DOM-safe',
  'workbench.docs.diagrams.inject.timingFooter': 'ASAP for races · After Load for DOM',
  'workbench.docs.diagrams.inject.scriptAria':
    'Script injection — JavaScript runs inside the page, either ASAP (pre-page-script) or After Load (DOM-safe).',
  'workbench.docs.diagrams.inject.ruleScript': 'Script (ASAP): wrap fetch to log every call',
  'workbench.docs.diagrams.inject.injectedComment': '<script> // injected by extension',
  'workbench.docs.diagrams.inject.runsInPage': 'Runs in the page context — sees the same globals as page JS.',
  'workbench.docs.diagrams.inject.scriptFooter': 'ASAP wins races before app code; After Load reads a parsed DOM.',
  'workbench.docs.diagrams.inject.cssAria':
    "CSS injection — a <style> tag is appended to the page's head, hiding the banner element.",
  'workbench.docs.diagrams.inject.ruleCss': 'CSS: header.banner { display: none }',
  'workbench.docs.diagrams.inject.ruleApplied1': 'rule',
  'workbench.docs.diagrams.inject.ruleApplied2': 'applied',
  'workbench.docs.diagrams.inject.hidden': '(hidden)',
  'workbench.docs.diagrams.inject.cssFooter': 'Injected as a <style> tag — same CSS specificity as page CSS.',
  'workbench.docs.diagrams.inject.wontApplyAria':
    "Inject doesn't apply to sandboxed iframes or pages with strict CSP that blocks inline scripts.",
  'workbench.docs.diagrams.inject.sandboxed': 'Sandboxed iframes',
  'workbench.docs.diagrams.inject.sandboxedSub': 'Pages with sandbox="" that disables scripts.',
  'workbench.docs.diagrams.inject.strictCsp': "Strict CSP (script-src 'self')",
  'workbench.docs.diagrams.inject.strictCspSub': "Inline injected scripts get blocked by the page's policy.",
  'workbench.docs.diagrams.inject.suggestionText': 'Inject in the parent page; postMessage into the iframe.',
  'workbench.docs.diagrams.inject.useCasesAria':
    'Inject JS / CSS — common use cases: monkey-patching, dark mode, hiding elements, feature flags.',
  'workbench.docs.diagrams.inject.card1Title': 'Monkey-patch',
  'workbench.docs.diagrams.inject.card1Example': 'Wrap fetch / XHR (ASAP)',
  'workbench.docs.diagrams.inject.card2Title': 'Dark mode',
  'workbench.docs.diagrams.inject.card2Example': 'Force a CSS theme',
  'workbench.docs.diagrams.inject.card3Title': 'Hide noise',
  'workbench.docs.diagrams.inject.card3Example': 'display: none banners',
  'workbench.docs.diagrams.inject.card4Title': 'Feature flags',
  'workbench.docs.diagrams.inject.card4Example': 'Set window flags ASAP',
  'workbench.docs.diagrams.inject.useCasesFooter': 'Use ASAP for code that must run first; After Load for DOM reads.',

  // ── Delay ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.delay.routingAria':
    'Delay routing across navigation, fetch, and sub-resource lanes — only the first two are intercepted, ' +
    'sub-resources pass through.',
  'workbench.docs.diagrams.delay.matchedRequest': 'Matched request',
  'workbench.docs.diagrams.delay.document': 'Document',
  'workbench.docs.diagrams.delay.documentSub': 'iframe nav',
  'workbench.docs.diagrams.delay.navCap': '≤ 30,000 ms',
  'workbench.docs.diagrams.delay.viaWaitingPage': 'via waiting page',
  'workbench.docs.diagrams.delay.fetchXhr': 'Fetch / XHR',
  'workbench.docs.diagrams.delay.jsInitiated': 'JS-initiated',
  'workbench.docs.diagrams.delay.xhrCap': '≤ 5,000 ms',
  'workbench.docs.diagrams.delay.monkeyPatched': 'monkey-patched',
  'workbench.docs.diagrams.delay.subResource': 'Sub-resource',
  'workbench.docs.diagrams.delay.subResourceSub': 'img / css / js',
  'workbench.docs.diagrams.delay.notDelayed': 'not delayed',
  'workbench.docs.diagrams.delay.passesThrough': 'passes through',
  'workbench.docs.diagrams.delay.routingFooter': 'Higher caps require a real local proxy',
  'workbench.docs.diagrams.delay.navAria':
    'Navigation delay — the browser is redirected to a local waiting page that holds for N ms before ' +
    'forwarding to the real target URL.',
  'workbench.docs.diagrams.delay.ruleNav': 'Delay 8,000 ms · page navigation',
  'workbench.docs.diagrams.delay.click': 'Click',
  'workbench.docs.diagrams.delay.waitingPage': 'Waiting page',
  'workbench.docs.diagrams.delay.holds8s': '⏱ holds 8s',
  'workbench.docs.diagrams.delay.loadsNow': 'loads now',
  'workbench.docs.diagrams.delay.navStamp': "Honored up to 30,000 ms — Chrome's redirect ceiling.",
  'workbench.docs.diagrams.delay.navStampSub': 'Implemented as a DNR redirect to a local waiting page.',
  'workbench.docs.diagrams.delay.xhrAria':
    'JS-initiated fetch/XHR delay — a monkey-patched setTimeout holds the resolution. Capped at 5000ms.',
  'workbench.docs.diagrams.delay.ruleXhr': 'Delay 3,000 ms · JS fetch / XHR',
  'workbench.docs.diagrams.delay.intercept': 'intercept',
  'workbench.docs.diagrams.delay.network': 'network',
  'workbench.docs.diagrams.delay.hold3000': '3,000 ms hold',
  'workbench.docs.diagrams.delay.realRequest': 'real request',
  'workbench.docs.diagrams.delay.responseDelayed': 'response (delayed by 3s)',
  'workbench.docs.diagrams.delay.xhrStamp': 'Capped at 5,000 ms — values above are clamped on the wire.',
  'workbench.docs.diagrams.delay.wontApplyAria':
    "Delay doesn't apply to sub-resources (img/css/js) or service-worker fetches that bypass the page-level " +
    'monkey-patch.',
  'workbench.docs.diagrams.delay.subResources': 'Sub-resources (img, css, js, fonts)',
  'workbench.docs.diagrams.delay.subResourcesSub': 'Browser issues these — no monkey-patch can hold them.',
  'workbench.docs.diagrams.delay.swFetches': 'Service-worker fetches',
  'workbench.docs.diagrams.delay.swFetchesSub': "Run in a different scope; page-level patches don't reach them.",
  'workbench.docs.diagrams.delay.suggestionText': 'Sub-resource throttling lands with the desktop app soon.',
  'workbench.docs.diagrams.delay.useCasesAria':
    'Delay — common use cases: loading-state QA, debounce testing, race-condition surfacing, slow-network ' +
    'simulation.',
  'workbench.docs.diagrams.delay.card1Title': 'Loading states',
  'workbench.docs.diagrams.delay.card1Example': 'Show spinners reliably',
  'workbench.docs.diagrams.delay.card2Title': 'Debounce checks',
  'workbench.docs.diagrams.delay.card2Example': 'Test typing throttles',
  'workbench.docs.diagrams.delay.card3Title': 'Race conditions',
  'workbench.docs.diagrams.delay.card3Example': 'Surface request orders',
  'workbench.docs.diagrams.delay.card4Title': 'Slow network sim',
  'workbench.docs.diagrams.delay.card4Example': 'Approx 3G-ish latency',
  'workbench.docs.diagrams.delay.useCasesFooter': "Static resources need a real proxy — extensions can't hold them.",

  // ── Query Params ────────────────────────────────────────────────────
  'workbench.docs.diagrams.queryParams.ruleAdd': 'Add / Replace · debug = true',
  'workbench.docs.diagrams.queryParams.addArrow': 'param added or replaced',
  'workbench.docs.diagrams.queryParams.addStamp': 'Adds when missing, replaces when present.',
  'workbench.docs.diagrams.queryParams.replaceOnlyAria':
    'Replace only — replaces existing query param values, but leaves URLs without the param untouched.',
  'workbench.docs.diagrams.queryParams.ruleReplaceOnly': 'Replace only · region = eu',
  'workbench.docs.diagrams.queryParams.present': 'Present',
  'workbench.docs.diagrams.queryParams.presentSub': 'param already there',
  'workbench.docs.diagrams.queryParams.absent': 'Absent',
  'workbench.docs.diagrams.queryParams.absentSub': 'no region param',
  'workbench.docs.diagrams.queryParams.valueReplaced': 'value replaced',
  'workbench.docs.diagrams.queryParams.unchanged': 'unchanged',
  'workbench.docs.diagrams.queryParams.replaceOnlyStamp': 'Replaces, never adds — URLs without the param pass through.',
  'workbench.docs.diagrams.queryParams.ruleRemove': 'Remove · utm_source',
  'workbench.docs.diagrams.queryParams.removeArrow': 'param stripped',
  'workbench.docs.diagrams.queryParams.removeStamp': 'Named param removed; everything else passes through.',
  'workbench.docs.diagrams.queryParams.ruleRemoveAll': 'Remove All',
  'workbench.docs.diagrams.queryParams.noQueryString': '(no query string)',
  'workbench.docs.diagrams.queryParams.removeAllArrow': 'entire query stripped',
  'workbench.docs.diagrams.queryParams.removeAllStamp': 'Whole query string removed in one step.',
  'workbench.docs.diagrams.queryParams.wontApplyAria':
    "Query Params gotcha — Remove All can't be combined with Add/Replace in the same rule.",
  'workbench.docs.diagrams.queryParams.watchForKicker': 'WHAT TO WATCH FOR',
  'workbench.docs.diagrams.queryParams.combining': 'Combining Remove All with Add / Replace',
  'workbench.docs.diagrams.queryParams.combiningSub':
    'DNR rejects rules that strip the whole query and add new params.',
  'workbench.docs.diagrams.queryParams.suggestionText': 'Use two rules — Remove All first, then Add / Replace.',
  'workbench.docs.diagrams.queryParams.suggestionSub': 'Rule order matters; both must match the same request.',
  'workbench.docs.diagrams.queryParams.useCasesAria':
    'Query Params — common use cases: force a flag, canonicalize a value, strip trackers, privacy-mode strip-all.',
  'workbench.docs.diagrams.queryParams.card1Title': 'Force a flag',
  'workbench.docs.diagrams.queryParams.card1Example': 'Add debug=true',
  'workbench.docs.diagrams.queryParams.card2Title': 'Canonicalize',
  'workbench.docs.diagrams.queryParams.card2Example': 'Replace region only',
  'workbench.docs.diagrams.queryParams.card3Title': 'Strip trackers',
  'workbench.docs.diagrams.queryParams.card3Example': 'Remove utm_* params',
  'workbench.docs.diagrams.queryParams.card4Title': 'Privacy mode',
  'workbench.docs.diagrams.queryParams.card4Example': 'Strip all queries',
  'workbench.docs.diagrams.queryParams.useCasesFooter': 'Pair with URL Pattern or Domains to scope to specific routes.',

  // ── Request Body ────────────────────────────────────────────────────
  'workbench.docs.diagrams.requestBody.interceptAria':
    'Request body interception pipeline — page.js call enters the script-engine intercept, branches into ' +
    'Static / Dynamic / GraphQL transforms, then leaves for the real network.',
  'workbench.docs.diagrams.requestBody.pageSub': 'fetch / XHR call',
  'workbench.docs.diagrams.requestBody.intercept': 'Intercept',
  'workbench.docs.diagrams.requestBody.interceptSub': 'extension monkey-patch',
  'workbench.docs.diagrams.requestBody.branchStatic': 'Static',
  'workbench.docs.diagrams.requestBody.branchStaticSub1': 'replace body',
  'workbench.docs.diagrams.requestBody.branchStaticSub2': 'wholesale',
  'workbench.docs.diagrams.requestBody.branchDynamic': 'Dynamic',
  'workbench.docs.diagrams.requestBody.branchDynamicSub1': 'fn(orig) →',
  'workbench.docs.diagrams.requestBody.branchDynamicSub2': 'modified body',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub1': 'match op? →',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub2': 'apply : skip',
  'workbench.docs.diagrams.requestBody.realNetwork': 'real network',
  'workbench.docs.diagrams.requestBody.originalBodyKicker': 'ORIGINAL BODY',
  'workbench.docs.diagrams.requestBody.bodySentKicker': 'BODY SENT',
  'workbench.docs.diagrams.requestBody.ruleStatic': 'Static body: { "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.staticArrow': 'body substituted wholesale',
  'workbench.docs.diagrams.requestBody.staticStamp': 'Whole body replaced; rule never inspects the original.',
  'workbench.docs.diagrams.requestBody.ruleDynamic': 'Dynamic body: fn(orig) → stamped',
  'workbench.docs.diagrams.requestBody.fnReads': '→ fn reads & rewrites',
  'workbench.docs.diagrams.requestBody.dynamicArrow': 'function transforms',
  'workbench.docs.diagrams.requestBody.dynamicStamp': 'Function receives the original; returns the new body.',
  'workbench.docs.diagrams.requestBody.graphqlAria':
    "GraphQL filter — the rule only fires when the JSON body's named field matches. Other operations pass " +
    'through untouched.',
  'workbench.docs.diagrams.requestBody.ruleGraphql': 'GraphQL: operationName Equals "GetUser"',
  'workbench.docs.diagrams.requestBody.ruleGraphqlAction': '→ static body substitution',
  'workbench.docs.diagrams.requestBody.match': 'Match',
  'workbench.docs.diagrams.requestBody.noMatch': 'No match',
  'workbench.docs.diagrams.requestBody.noMatchSub': 'any other operation',
  'workbench.docs.diagrams.requestBody.ruleFires': 'rule fires',
  'workbench.docs.diagrams.requestBody.passesThrough': 'passes through',
  'workbench.docs.diagrams.requestBody.graphqlStamp': 'Field-level filter — only matching ops apply.',
  'workbench.docs.diagrams.requestBody.graphqlStampSub':
    'Requests with missing fields or non-JSON bodies skip the rule.',
  'workbench.docs.diagrams.requestBody.wontApplyAria':
    'Body rules only fire on JS-initiated fetch/XHR with a body. GET and HEAD requests have nothing to ' +
    'replace; static resources never enter the script intercept.',
  'workbench.docs.diagrams.requestBody.getHead': 'GET / HEAD requests',
  'workbench.docs.diagrams.requestBody.getHeadSub': 'Spec-wise no body — nothing to replace.',
  'workbench.docs.diagrams.requestBody.staticResources': 'Static resources (img, script, link)',
  'workbench.docs.diagrams.requestBody.staticResourcesSub': 'Browser-issued — never touch fetch / XHR.',
  'workbench.docs.diagrams.requestBody.suggestionText': 'Confirm the request is a POST/PUT/PATCH from page JS.',
  'workbench.docs.diagrams.requestBody.useCasesAria':
    'Request Body — common use cases: test fixtures, metadata stamping, GraphQL operation mocking, PII ' +
    'anonymization.',
  'workbench.docs.diagrams.requestBody.card1Title': 'Test fixtures',
  'workbench.docs.diagrams.requestBody.card1Example': 'Force a known payload',
  'workbench.docs.diagrams.requestBody.card2Title': 'Stamp metadata',
  'workbench.docs.diagrams.requestBody.card2Example': 'Add debug: true',
  'workbench.docs.diagrams.requestBody.card3Title': 'GraphQL ops',
  'workbench.docs.diagrams.requestBody.card3Example': 'Mock one operationName',
  'workbench.docs.diagrams.requestBody.card4Title': 'Replay shaping',
  'workbench.docs.diagrams.requestBody.card4Example': 'Anonymize PII fields',
  'workbench.docs.diagrams.requestBody.useCasesFooter': 'Script-engine only — applies to JS-initiated fetch / XHR.',

  // ── Sequence primitives ─────────────────────────────────────────────
  'workbench.docs.diagrams.sequence.later': 'later',

  // ── Debug mode ──────────────────────────────────────────────────────
  'workbench.docs.diagrams.debugMode.surfaceAria':
    'Debug mode lives in the footer — an inline switch toggles it; the dot and label open a popover with ' +
    'scope, the per-tab pin, and the attached-tabs list.',
  'workbench.docs.diagrams.debugMode.surfaceTitle': 'Debug mode lives in the footer',
  'workbench.docs.diagrams.debugMode.surfaceCaption': 'Switch toggles it · dot + label open the popover.',
  'workbench.docs.diagrams.debugMode.debugMode': 'Debug mode',
  'workbench.docs.diagrams.debugMode.systemStatus': 'System status',
  'workbench.docs.diagrams.debugMode.inspectLabel': 'Inspect',
  'workbench.docs.diagrams.debugMode.scopeBoth': 'Both ▾',
  'workbench.docs.diagrams.debugMode.includeThisTab': 'Include this tab',
  'workbench.docs.diagrams.debugMode.attachedTabs': 'Attached tabs (1)',
  'workbench.docs.diagrams.debugMode.tabRow': 'Tab #11 · example.com',
  'workbench.docs.diagrams.debugMode.scopeAria':
    'The attached set is derived: the chosen scope unioned with pinned tabs, intersected with the master ' +
    'switch. With debug mode off, nothing attaches.',
  'workbench.docs.diagrams.debugMode.scopeTitle': 'What gets attached',
  'workbench.docs.diagrams.debugMode.scopeFormula': '( scope ∪ pins ) ∩ master switch',
  'workbench.docs.diagrams.debugMode.inspectBoth': 'Inspect: Both',
  'workbench.docs.diagrams.debugMode.devtoolsUnion': 'DevTools ∪ focused tab',
  'workbench.docs.diagrams.debugMode.pinnedTab': 'Pinned: Tab #11',
  'workbench.docs.diagrams.debugMode.candidates': 'candidates',
  'workbench.docs.diagrams.debugMode.gateLabel': '∩ Debug ON',
  'workbench.docs.diagrams.debugMode.attached': 'Attached',
  'workbench.docs.diagrams.debugMode.attachedTab1': 'Tab #7',
  'workbench.docs.diagrams.debugMode.attachedTab2': 'Tab #11',
  'workbench.docs.diagrams.debugMode.scopeFooter1': 'Debug OFF → nothing attaches, whatever the scope.',
  'workbench.docs.diagrams.debugMode.scopeFooter2': 'Re-attach replays from this — never a stored snapshot.',
  'workbench.docs.diagrams.debugMode.reachAria':
    'Standard mode reaches only page fetch and XHR. An attached debug-mode tab also reaches navigations, ' +
    'workers, cross-origin iframes, and the tab environment.',
  'workbench.docs.diagrams.debugMode.reachTitle': 'What each mode can touch',
  'workbench.docs.diagrams.debugMode.standardMode': 'Standard mode',
  'workbench.docs.diagrams.debugMode.rowFetch': 'Page fetch / XHR',
  'workbench.docs.diagrams.debugMode.rowNavigations': 'Navigations',
  'workbench.docs.diagrams.debugMode.rowWorkers': 'Workers',
  'workbench.docs.diagrams.debugMode.rowIframes': 'Cross-origin iframes',
  'workbench.docs.diagrams.debugMode.rowTabEnv': 'Tab environment',
  'workbench.docs.diagrams.debugMode.bannerFree': 'banner-free',
  'workbench.docs.diagrams.debugMode.showsBanner': 'shows the banner',
  'workbench.docs.diagrams.debugMode.statesAria':
    'The dot has four states: grey off, green on and attached, yellow fell back to heuristic when the ' +
    'banner was dismissed, and red when a tab failed to attach.',
  'workbench.docs.diagrams.debugMode.statesTitle': 'The dot at a glance',
  'workbench.docs.diagrams.debugMode.stateOff': 'Off',
  'workbench.docs.diagrams.debugMode.stateOffMsg': 'debug mode disabled',
  'workbench.docs.diagrams.debugMode.stateOn': 'On · 2 tabs',
  'workbench.docs.diagrams.debugMode.stateOnMsg': 'attached & healthy',
  'workbench.docs.diagrams.debugMode.stateFellBack': 'Fell back',
  'workbench.docs.diagrams.debugMode.stateFellBackMsg': 'banner dismissed → heuristic',
  'workbench.docs.diagrams.debugMode.stateFailed': 'Attach failed',
  'workbench.docs.diagrams.debugMode.stateFailedMsg': "couldn't engage the protocol",

  // ── Request Tracking ────────────────────────────────────────────────
  'workbench.docs.diagrams.requestTracking.phasesAria':
    'Two phases of every connection — request and response — each with its own captured fields.',
  'workbench.docs.diagrams.requestTracking.phasesTitle': 'Every connection has two phases',
  'workbench.docs.diagrams.requestTracking.phaseRequest': 'REQUEST',
  'workbench.docs.diagrams.requestTracking.phaseRequestDir': 'Page → Network',
  'workbench.docs.diagrams.requestTracking.outbound': 'outbound',
  'workbench.docs.diagrams.requestTracking.capMethod': 'Method',
  'workbench.docs.diagrams.requestTracking.capHeaders': 'Headers',
  'workbench.docs.diagrams.requestTracking.capBody': 'Body',
  'workbench.docs.diagrams.requestTracking.phaseResponse': 'RESPONSE',
  'workbench.docs.diagrams.requestTracking.phaseResponseDir': 'Network → Page',
  'workbench.docs.diagrams.requestTracking.inbound': 'inbound',
  'workbench.docs.diagrams.requestTracking.capStatus': 'Status code',
  'workbench.docs.diagrams.requestTracking.capTimings': 'Timings',
  'workbench.docs.diagrams.requestTracking.perRoundtrip': 'per HTTP roundtrip',
  'workbench.docs.diagrams.requestTracking.capturedKicker': 'CAPTURED',
  'workbench.docs.diagrams.requestTracking.sameConnection': 'same connection',
  'workbench.docs.diagrams.requestTracking.phasesFooter':
    'Both phases contribute data to the badge count in This Page.',
  'workbench.docs.diagrams.requestTracking.seqAria':
    'Sequence diagram: request observed, matched, recorded, then read by the popup',
  'workbench.docs.diagrams.requestTracking.pBrowser': 'Browser',
  'workbench.docs.diagrams.requestTracking.pBrowserSub': 'network stack',
  'workbench.docs.diagrams.requestTracking.pExtension': 'Extension',
  'workbench.docs.diagrams.requestTracking.pExtensionSub': 'service worker',
  'workbench.docs.diagrams.requestTracking.pPopup': 'Popup',
  'workbench.docs.diagrams.requestTracking.pPopupSub': 'This Page tab',
  'workbench.docs.diagrams.requestTracking.msgRequest': 'webRequest (request)',
  'workbench.docs.diagrams.requestTracking.noteMatch': 'match against rules',
  'workbench.docs.diagrams.requestTracking.noteRecord1': 'record (rule + URL +',
  'workbench.docs.diagrams.requestTracking.noteRecord2': 'resource type)',
  'workbench.docs.diagrams.requestTracking.msgResponse': 'webRequest (response)',
  'workbench.docs.diagrams.requestTracking.noteResponse': 'record response phase',
  'workbench.docs.diagrams.requestTracking.msgOpenPopup': 'user opens popup',
  'workbench.docs.diagrams.requestTracking.msgReadBack': 'matched rules + badges',
  'workbench.docs.diagrams.requestTracking.seqFooter': 'Recording happens live; the popup just reads it back.',
  'workbench.docs.diagrams.requestTracking.uiAria':
    'UI anatomy — collapsed badge expands into a list of matched requests',
  'workbench.docs.diagrams.requestTracking.uiTitle': 'Rule row in the popup',
  'workbench.docs.diagrams.requestTracking.uiRule': 'Block ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.clickBadge': 'click badge',
  'workbench.docs.diagrams.requestTracking.matchedPattern': 'matched: ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.legendFields': 'timestamp · URL · resource type · matched pattern',
  'workbench.docs.diagrams.requestTracking.legendBadge': 'badge count = number of rows',

  // ── Resource Types ──────────────────────────────────────────────────
  'workbench.docs.diagrams.resourceTypes.anatomyAria':
    'Resource Types anatomy — a stylised page mockup with callouts to each Chrome ResourceType: Page, ' +
    'Frame, Script, CSS, Image, Font, Media, Fetch/XHR, WebSocket, Ping, Other.',
  'workbench.docs.diagrams.resourceTypes.anatomyTitle': 'Each kind of request maps to one ResourceType',
  'workbench.docs.diagrams.resourceTypes.otherExamples': 'favicon, manifest, …',
  'workbench.docs.diagrams.resourceTypes.legendKicker': 'LEGEND',
  'workbench.docs.diagrams.resourceTypes.footer': "Each entry maps 1:1 — there's no overlap between rows.",

  // ── Limitations ─────────────────────────────────────────────────────
  'workbench.docs.diagrams.limitations.overviewAria':
    'Common limitations — DevTools blind spot for modified headers; script engine only sees fetch/XHR; ' +
    'Merge only sees page-set headers; header matching needs Chrome 128+.',
  'workbench.docs.diagrams.limitations.gotchasKicker': 'COMMON GOTCHAS',
  'workbench.docs.diagrams.limitations.devtoolsTitle': 'DevTools blind',
  'workbench.docs.diagrams.limitations.devtoolsLine1': 'Network tab shows',
  'workbench.docs.diagrams.limitations.devtoolsLine2': 'the original headers.',
  'workbench.docs.diagrams.limitations.scriptTitle': 'Script reach',
  'workbench.docs.diagrams.limitations.scriptLine1': 'Only fetch / XHR —',
  'workbench.docs.diagrams.limitations.scriptLine2': 'no nav, no static.',
  'workbench.docs.diagrams.limitations.mergeTitle': 'Merge scope',
  'workbench.docs.diagrams.limitations.mergeLine1': 'Sees only headers',
  'workbench.docs.diagrams.limitations.mergeLine2': 'set by page code.',
  'workbench.docs.diagrams.limitations.chromeTitle': 'Chrome 128+',
  'workbench.docs.diagrams.limitations.chromeLine1': 'Older browsers',
  'workbench.docs.diagrams.limitations.chromeLine2': 'skip header match.',
  'workbench.docs.diagrams.limitations.seeCallout': 'See callout below.',
  'workbench.docs.diagrams.limitations.footer': 'Each gotcha is also called out inline in the section it affects.',

  // ── How rules execute ───────────────────────────────────────────────
  'workbench.docs.diagrams.execution.stackAria':
    'Where each engine intercepts the request flow — JS goes through Script then DNR; static and ' +
    'navigation skip Script',
  'workbench.docs.diagrams.execution.stackTitle': 'Where each engine intercepts',
  'workbench.docs.diagrams.execution.stackJsLane': 'JS-initiated',
  'workbench.docs.diagrams.execution.stackStaticLane': 'Static / navigation',
  'workbench.docs.diagrams.execution.stackPageJs': 'Page JS',
  'workbench.docs.diagrams.execution.stackPageJsSub': 'fetch / XHR',
  'workbench.docs.diagrams.execution.stackBrowser': 'Browser',
  'workbench.docs.diagrams.execution.stackBrowserSub': '<img>, nav, etc.',
  'workbench.docs.diagrams.execution.stackScriptEngine': 'Script engine',
  'workbench.docs.diagrams.execution.stackScriptEngineSub': 'monkey-patch',
  'workbench.docs.diagrams.execution.stackBypasses1': 'bypasses',
  'workbench.docs.diagrams.execution.stackBypasses2': 'script engine',
  'workbench.docs.diagrams.execution.stackDnrEngine': 'DNR engine',
  'workbench.docs.diagrams.execution.stackDnrEngineSub': 'Chrome network — catches everything',
  'workbench.docs.diagrams.execution.stackNetwork': 'Network',
  'workbench.docs.diagrams.execution.stackFooter': 'DNR is broad; Script is narrow but can read response bodies.',
  'workbench.docs.diagrams.execution.dnrAria':
    "DNR's broad reach — every resource type the browser fetches is intercepted",
  'workbench.docs.diagrams.execution.dnrTitle': 'DNR catches every kind of request',
  'workbench.docs.diagrams.execution.dnrItemNav': 'page navigation',
  'workbench.docs.diagrams.execution.dnrItemSubFrame': 'sub-frame',
  'workbench.docs.diagrams.execution.dnrItemFetch': 'fetch / XHR',
  'workbench.docs.diagrams.execution.dnrItemScripts': 'scripts',
  'workbench.docs.diagrams.execution.dnrItemStylesheets': 'stylesheets',
  'workbench.docs.diagrams.execution.dnrItemImages': 'images',
  'workbench.docs.diagrams.execution.dnrItemFonts': 'fonts',
  'workbench.docs.diagrams.execution.dnrItemMedia': 'media',
  'workbench.docs.diagrams.execution.dnrItemWebsocket': 'websocket',
  'workbench.docs.diagrams.execution.dnrItemPing': 'ping / beacon',
  'workbench.docs.diagrams.execution.dnrFooter': 'every resource type the browser fetches',
  'workbench.docs.diagrams.execution.reachAria': 'Script engine reach — what it catches versus what it bypasses',
  'workbench.docs.diagrams.execution.reachTitle': 'What the script engine actually sees',
  'workbench.docs.diagrams.execution.reachCaught': '✓ caught',
  'workbench.docs.diagrams.execution.reachCaughtSub': 'the engine sees these',
  'workbench.docs.diagrams.execution.reachFetch': 'fetch()',
  'workbench.docs.diagrams.execution.reachXhr': 'XMLHttpRequest',
  'workbench.docs.diagrams.execution.reachSwFetch': 'SW fetch',
  'workbench.docs.diagrams.execution.reachInScope': '(in scope)',
  'workbench.docs.diagrams.execution.reachMissed': '✗ missed',
  'workbench.docs.diagrams.execution.reachMissedSub': 'bypasses entirely',
  'workbench.docs.diagrams.execution.reachImgSrc': '<img src>',
  'workbench.docs.diagrams.execution.reachScriptSrc': '<script src>',
  'workbench.docs.diagrams.execution.reachPageNav': 'page navigation',
  'workbench.docs.diagrams.execution.reachBrowserInternal': 'browser-internal',
  'workbench.docs.diagrams.execution.reachFaviconEtc': '(favicon, etc.)',

  // ── Direct vs Indirect ──────────────────────────────────────────────
  'workbench.docs.diagrams.directVsIndirect.aria': 'Direct vs indirect matches — same rule, two page contexts',
  'workbench.docs.diagrams.directVsIndirect.ruleLabel': 'Rule',
  'workbench.docs.diagrams.directVsIndirect.ruleBanner': 'Request Domains: openheaders.com',
  'workbench.docs.diagrams.directVsIndirect.directTitle': 'Direct',
  'workbench.docs.diagrams.directVsIndirect.directSub': 'page URL itself matches',
  'workbench.docs.diagrams.directVsIndirect.pageLabel': 'page',
  'workbench.docs.diagrams.directVsIndirect.directCaption1': 'Page + same-host',
  'workbench.docs.diagrams.directVsIndirect.directCaption2': 'sub-resources tracked',
  'workbench.docs.diagrams.directVsIndirect.badgePrefix': 'badge:',
  'workbench.docs.diagrams.directVsIndirect.badgeDirect': 'direct',
  'workbench.docs.diagrams.directVsIndirect.badgeIndirect': 'indirect',
  'workbench.docs.diagrams.directVsIndirect.indirectTitle': 'Indirect',
  'workbench.docs.diagrams.directVsIndirect.indirectSub': 'only a sub-resource matches',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption1': 'Only the matching',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption2': 'sub-resource tracked',
  'workbench.docs.diagrams.directVsIndirect.legendMatches': 'matches rule',
  'workbench.docs.diagrams.directVsIndirect.legendNoMatch': 'does not match',

  // ── Response Body + Status (Mock) ───────────────────────────────────
  'workbench.docs.diagrams.mock.flowAria':
    'Static skips the network entirely; Dynamic hits it first, then transforms the real response.',
  'workbench.docs.diagrams.mock.flowStatic': 'Static',
  'workbench.docs.diagrams.mock.flowDynamic': 'Dynamic',
  'workbench.docs.diagrams.mock.flowIntercept': 'Intercept',
  'workbench.docs.diagrams.mock.flowNeverHit1': '(real network',
  'workbench.docs.diagrams.mock.flowNeverHit2': 'never hit)',
  'workbench.docs.diagrams.mock.flowRealNetwork': 'real network',
  'workbench.docs.diagrams.mock.flowRealNetworkSub': 'real response',
  'workbench.docs.diagrams.mock.flowSynthetic': 'synthetic body',
  'workbench.docs.diagrams.mock.flowFnResponse': 'fn(response)',
  'workbench.docs.diagrams.mock.flowPageReceives': 'page receives',
  'workbench.docs.diagrams.mock.staticRule': 'Static response: 200 { "users": [] }',
  'workbench.docs.diagrams.mock.staticBeforeKicker': 'REAL NETWORK',
  'workbench.docs.diagrams.mock.staticNever1': '(never reached)',
  'workbench.docs.diagrams.mock.staticNever2': '— request short-circuited',
  'workbench.docs.diagrams.mock.pageReceivesKicker': 'PAGE RECEIVES',
  'workbench.docs.diagrams.mock.staticAfterLine1': '200 OK · Content-Type: application/json',
  'workbench.docs.diagrams.mock.staticAfterBody': '{ "users": [] }',
  'workbench.docs.diagrams.mock.staticArrow': 'synthetic response served',
  'workbench.docs.diagrams.mock.staticStamp': 'Fixed body + status + headers — server is never contacted.',
  'workbench.docs.diagrams.mock.dynamicRule': 'Dynamic response: redact PII fields',
  'workbench.docs.diagrams.mock.dynamicBeforeKicker': 'REAL RESPONSE',
  'workbench.docs.diagrams.mock.dynBodyOpen': '{ "user":',
  'workbench.docs.diagrams.mock.dynBodyEmail': '  { "email": "alice@openheaders.com" } }',
  'workbench.docs.diagrams.mock.dynAfterPrefix': '  { "email": ',
  'workbench.docs.diagrams.mock.dynRedacted': '"[redacted]"',
  'workbench.docs.diagrams.mock.dynamicArrow': 'fn(real response) →',
  'workbench.docs.diagrams.mock.dynamicStamp': 'Real call still happens; your function rewrites the body.',
  'workbench.docs.diagrams.mock.wontAria':
    'Mocks only intercept JS-initiated fetch / XHR — static resources flow through unchanged. Use a real ' +
    'local proxy for sub-resource fixtures.',
  'workbench.docs.diagrams.mock.wontStatic': 'Static resources (img, script, link)',
  'workbench.docs.diagrams.mock.wontStaticSub': 'Browser-issued — never touch fetch / XHR.',
  'workbench.docs.diagrams.mock.wontNav': 'Page navigations',
  'workbench.docs.diagrams.mock.wontNavSub': 'Top-level HTML loads bypass the script engine entirely.',
  'workbench.docs.diagrams.mock.suggestionText': 'Use a real local proxy for sub-resource fixtures.',
  'workbench.docs.diagrams.mock.useCasesAria':
    'Response Body + Status — common use cases: offline dev, error simulation, PII redaction, edge-case ' +
    'payload shapes.',
  'workbench.docs.diagrams.mock.caseOffline': 'Offline dev',
  'workbench.docs.diagrams.mock.caseOfflineEx': 'Stub the whole API',
  'workbench.docs.diagrams.mock.caseError': 'Error simulation',
  'workbench.docs.diagrams.mock.caseErrorEx': 'Force 500 on one route',
  'workbench.docs.diagrams.mock.casePii': 'PII redaction',
  'workbench.docs.diagrams.mock.casePiiEx': 'Mask emails on the wire',
  'workbench.docs.diagrams.mock.caseEdge': 'Corner cases',
  'workbench.docs.diagrams.mock.caseEdgeEx': 'Empty arrays, huge payloads',
  'workbench.docs.diagrams.mock.useCasesFooter': 'Static = fixture mode · Dynamic = real-call passthrough + edit.',

  // ── Keyboard Shortcuts ──────────────────────────────────────────────
  'workbench.docs.diagrams.keyboardShortcuts.aria':
    'Workbench focus regions — left sidebar, editor, right sidebar, and bottom panel — each labeled with its ' +
    'focus-shortcut chord.',
  'workbench.docs.diagrams.keyboardShortcuts.title': 'Focus chords land you in one of four regions',
  'workbench.docs.diagrams.keyboardShortcuts.windowTitle': 'Open Headers — Workbench',
  'workbench.docs.diagrams.keyboardShortcuts.leftSidebar': 'Left sidebar',
  'workbench.docs.diagrams.keyboardShortcuts.editor': 'Editor',
  'workbench.docs.diagrams.keyboardShortcuts.rightSidebar': 'Right sidebar',
  'workbench.docs.diagrams.keyboardShortcuts.bottomPanel': 'Bottom panel',
  'workbench.docs.diagrams.keyboardShortcuts.footer': 'Rebind any chord in Settings → Keyboard.',

  // ── Wire mirrors (whole-raw in every locale) ────────────────────────
  'workbench.docs.diagrams.block.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireSetTimeout': 'setTimeout',
  'workbench.docs.diagrams.inject.wireDoctype': '<!doctype html>',
  'workbench.docs.diagrams.inject.wireHookLine': 'const _f = window.fetch;',
  'workbench.docs.diagrams.inject.wireBodyOpen': '<body>',
  'workbench.docs.diagrams.inject.wireScriptSrc': '<script src="app.js"></script>',
  'workbench.docs.diagrams.limitations.wireFn': 'fn',
  'workbench.docs.diagrams.multiTab.sync.wireStagingEnv': 'staging',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePush': 'push',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePull': 'pull',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wireRepoName': '⎇ workspace.git',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireStdio': 'stdio',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireHttpSse': 'HTTP / SSE',
  'workbench.docs.diagrams.openHeaders.mcpTools.wireList': 'list',
  'workbench.docs.diagrams.queryParams.wirePage': '?page=1',
  'workbench.docs.diagrams.queryParams.wireDebugParam': '&debug=true',
  'workbench.docs.diagrams.queryParams.wireAmpPage': '&page=1',
  'workbench.docs.diagrams.requestBody.wirePostSave': 'POST /api/save  body:',
  'workbench.docs.diagrams.requestBody.wireBodyAbc': '{ "userId": "abc" }',
  'workbench.docs.diagrams.requestBody.wireBodyTest': '{ "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.wireBodyAbcOpen': '{ "userId": "abc", ',
  'workbench.docs.diagrams.requestBody.wireDebugTrue': '"debug": true',
  'workbench.docs.diagrams.requestBody.wireOpEquals': 'operationName = GetUser',
  'workbench.docs.diagrams.requestBody.wireGetUser': '  "GetUser", ...',
  'workbench.docs.diagrams.requestBody.wireListPosts': '  "ListPosts", ...',
  'workbench.docs.diagrams.requestTracking.wireTagXhr': 'xhr',
  'workbench.docs.diagrams.requestTracking.wireTagImage': 'image',
  'workbench.docs.diagrams.requestTracking.wireTagPing': 'ping',
  'workbench.docs.diagrams.resourceTypes.wireAa': 'Aa',
  'workbench.docs.diagrams.resourceTypes.wireScriptTag': '<script>',
  'workbench.docs.diagrams.resourceTypes.wireLinkCss': '<link css>',
  'workbench.docs.diagrams.resourceTypes.wireImgTag': '<img>',
  'workbench.docs.diagrams.resourceTypes.wireVideoTag': '<video>',
  'workbench.docs.diagrams.resourceTypes.wireIframeTag': '<iframe>',
  'workbench.docs.diagrams.resourceTypes.wireNewWebSocket': "new WebSocket('wss://…')",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.wireOrigins': "{ origins: ['<all_urls>'] }",
  'workbench.docs.diagrams.systemStatus.vaultHydration.wireId': '<id>',
} as const satisfies Catalog;
