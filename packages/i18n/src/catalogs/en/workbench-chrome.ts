/**
 * Workbench chrome — the shell plane: topbar, tab bar, tool-window
 * registry, save/dirty chrome, shortcuts overlay, docs navigation,
 * markdown toolbar, and small chrome singles. The sidebar/navigator
 * and workspace planes live in the sibling `workbench-chrome-*.ts`
 * files; all merge under the same `workbench.*` namespaces in
 * `index.ts`.
 */

import type { Catalog } from '../../types';

export const workbenchChrome = {
  // ── Tab strip: context menu ─────────────────────────────────────────
  'workbench.tabbar.menu.duplicateTab': 'Duplicate Tab',
  'workbench.tabbar.menu.close': 'Close',
  'workbench.tabbar.menu.closeOther': 'Close Other Tabs',
  'workbench.tabbar.menu.closeAll': 'Close All Tabs',
  'workbench.tabbar.menu.closeUnmodified': 'Close Unmodified Tabs',
  'workbench.tabbar.menu.closeLeft': 'Close Tabs to the Left',
  'workbench.tabbar.menu.closeRight': 'Close Tabs to the Right',
  'workbench.tabbar.menu.splitAndMove': 'Split and Move',
  'workbench.tabbar.menu.right': 'Right',
  'workbench.tabbar.menu.left': 'Left',
  'workbench.tabbar.menu.down': 'Down',
  'workbench.tabbar.menu.up': 'Up',
  'workbench.tabbar.menu.moveOpposite': 'Move To Opposite Group',
  'workbench.tabbar.menu.changeSplitterOrientation': 'Change Splitter Orientation',
  'workbench.tabbar.menu.unsplit': 'Unsplit',
  'workbench.tabbar.menu.unsplitAll': 'Unsplit All',

  // ── Tab strip: close guard confirms (useTabLifecycle) ───────────────
  // The dialog bodies follow a bolded tab label in the JSX, so they key
  // as the sentence remainder (OnboardingTour bold-prefix idiom).
  'workbench.tabbar.closeGuard.unsavedTitle': 'Save changes?',
  'workbench.tabbar.closeGuard.unsavedBody': 'has unsaved changes. Save these changes to avoid losing your work.',
  'workbench.tabbar.closeGuard.dontSave': 'Don’t save',
  'workbench.tabbar.closeGuard.cancel': 'Cancel',
  'workbench.tabbar.closeGuard.save': 'Save changes',
  'workbench.tabbar.closeGuard.draftTitle': 'Discard draft?',
  'workbench.tabbar.closeGuard.draftBody':
    'hasn’t been published yet. Discarding deletes the draft; keeping leaves it in your sidebar to finish later.',
  'workbench.tabbar.closeGuard.discard': 'Discard',
  'workbench.tabbar.closeGuard.keep': 'Keep as draft',

  // ── Tab strip: bar chrome + search overlay ──────────────────────────
  'workbench.tabbar.createApiRequest': 'Create API Request',
  'workbench.tabbar.createItem': 'Create item',
  'workbench.tabbar.searchTabs': 'Search tabs',
  'workbench.tabbar.search.placeholder': 'Search tabs...',
  'workbench.tabbar.search.noMatch': 'No open tabs match your search',
  'workbench.tabbar.search.noOpenTabs': 'No open tabs',
  'workbench.tabbar.search.noClosedMatch': 'No closed tabs match your search',
  'workbench.tabbar.search.recentlyClosed': 'Recently Closed ({count})',
  'workbench.tabbar.search.recentlyClosedFiltered': 'Recently Closed ({matched} of {total})',
  'workbench.tabbar.envPinnedAria': 'Environment pinned',
  'workbench.tabbar.fromExample': 'from “{name}”',

  // ── Scratch segment labels (tab tooltip + breadcrumb bar) ───────────
  'workbench.scratch.request': 'Scratch Request',
  'workbench.scratch.rule': 'Scratch Rule',
  'workbench.scratch.variable': 'Scratch Variable',
  'workbench.scratch.workflow': 'Scratch Workflow',

  // ── Shell: command palette ──────────────────────────────────────────
  'workbench.shell.commandPalette.collectionsDivider': 'Collections',
  'workbench.shell.commandPalette.searchInGroup': 'Search in {name}...',
  'workbench.shell.commandPalette.placeholder': 'Search rules, collections, or type > for commands...',
  'workbench.shell.commandPalette.noResults': 'No results found',
  'workbench.shell.commandPalette.emptyHint': 'Type to search or > for commands',
  'workbench.shell.commandPalette.footer.navigate': '↑↓ navigate',
  'workbench.shell.commandPalette.footer.back': '← back',
  'workbench.shell.commandPalette.footer.open': '→ open',
  'workbench.shell.commandPalette.footer.select': '↵ select',
  'workbench.shell.commandPalette.footer.close': 'esc close',
  'workbench.shell.commandPalette.group.rules': 'Rules',
  'workbench.shell.commandPalette.group.templates': 'Templates',
  'workbench.shell.commandPalette.group.requests': 'Requests',
  'workbench.shell.commandPalette.group.systemTemplates': 'System Templates',
  'workbench.shell.commandPalette.group.settings': 'Settings',
  'workbench.shell.commandPalette.section.create': 'Create',
  'workbench.shell.commandPalette.section.commands': 'Commands',
  'workbench.shell.commandPalette.section.variables': 'Variables',
  'workbench.shell.commandPalette.cmd.createItem': 'Create Item...',
  'workbench.shell.commandPalette.cmd.newRuleType': 'New {type}',
  'workbench.shell.commandPalette.cmd.toggleLeftSidebar': 'Toggle Left Sidebar',
  'workbench.shell.commandPalette.cmd.toggleRightSidebar': 'Toggle Right Sidebar',
  'workbench.shell.commandPalette.cmd.toggleBottomPanel': 'Toggle Bottom Panel',
  'workbench.shell.commandPalette.cmd.toggleActivityFeed': 'Toggle Activity Feed',
  'workbench.shell.commandPalette.cmd.keyboardShortcuts': 'Keyboard Shortcuts',
  'workbench.shell.commandPalette.cmd.openSettings': 'Open Settings',
  'workbench.shell.commandPalette.cmd.openWorkspaceVariables': 'Open Workspace Variables',
  'workbench.shell.commandPalette.cmd.openVault': 'Open Vault',
  'workbench.shell.commandPalette.cmd.openLiveVariables': 'Open Live Variables',
  'workbench.shell.commandPalette.cmd.openPackageLibrary': 'Open Package Library',
  'workbench.shell.commandPalette.cmd.openEnvironment': 'Open Environment: {name}',

  // ── Shell: top bar (search button, layout menu, panel toggles) ──────
  'workbench.shell.topbar.search': 'Search or run a command...',
  'workbench.shell.topbar.layout.bottomAlignment': 'Bottom Panel Alignment',
  'workbench.shell.topbar.layout.alignCenter': 'Center (nested)',
  'workbench.shell.topbar.layout.alignLeft': 'Left',
  'workbench.shell.topbar.layout.alignRight': 'Right',
  'workbench.shell.topbar.layout.alignJustify': 'Justify (full width)',
  'workbench.shell.topbar.layout.showToolWindowNames': 'Show Tool Window Names',
  'workbench.shell.topbar.layout.activityBarLayout': 'Activity Bar Layout',
  'workbench.shell.topbar.layout.sidebarProportional': 'Proportional (even halves)',
  'workbench.shell.topbar.layout.sidebarCompact': 'Compact (bottom pinned)',
  'workbench.shell.topbar.layout.sidebarStacked': 'Stacked (all at top)',
  'workbench.shell.topbar.layout.sidebarDynamic': 'Dynamic (follows panel heights)',
  'workbench.shell.topbar.layout.defaultLayoutDonor': 'Default layout {unit}',
  'workbench.shell.topbar.layout.inheritsDefault': 'Inherits default layout',
  'workbench.shell.topbar.layout.donorTooltip': 'This {unit} is the default — new {units} inherit this layout.',
  'workbench.shell.topbar.layout.nonDonorTooltip': 'Another {unit} is the default — new {units} inherit from there.',
  'workbench.shell.topbar.layout.resetToDefaults': 'Reset layout to defaults',
  'workbench.shell.topbar.layout.restoreHidden': 'Restore Hidden Activity Bar Tools',
  'workbench.shell.topbar.toggle.leftSidebar': 'Left sidebar',
  'workbench.shell.topbar.toggle.bottomPanel': 'Bottom panel',
  'workbench.shell.topbar.toggle.rightSidebar': 'Right sidebar',
  'workbench.shell.topbar.bottomAlign.center': 'Bottom panel: center (nested)',
  'workbench.shell.topbar.bottomAlign.left': 'Bottom panel: left-aligned',
  'workbench.shell.topbar.bottomAlign.right': 'Bottom panel: right-aligned',
  'workbench.shell.topbar.bottomAlign.justify': 'Bottom panel: full width',
  'workbench.shell.topbar.bottomAlign.chooseAria': 'Choose bottom panel alignment',
  'workbench.shell.topbar.layoutOptions': 'Layout options',

  // ── Shell: status bar ───────────────────────────────────────────────
  'workbench.shell.statusbar.theme.light': 'Light',
  'workbench.shell.statusbar.theme.dark': 'Dark',
  'workbench.shell.statusbar.theme.auto': 'Auto',
  'workbench.shell.statusbar.systemStatus': 'System',

  // ── Shell: activity bar ─────────────────────────────────────────────
  'workbench.shell.activityBar.hideLabels': 'Hide labels',
  'workbench.shell.activityBar.showLabels': 'Show labels',

  // ── Shell: editor empty state ───────────────────────────────────────
  'workbench.shell.empty.createRule': 'Create rule',
  'workbench.shell.empty.createRuleDesc': 'Headers, redirects, blocking, and more',
  'workbench.shell.empty.createVariable': 'Create variable',
  'workbench.shell.empty.createVariableDesc': 'Environment, workspace, live, and more',
  'workbench.shell.empty.createRequest': 'Create API request',
  'workbench.shell.empty.createRequestDesc': 'Build, send, and save HTTP requests',
  'workbench.shell.empty.createWorkflow': 'Create workflow',
  'workbench.shell.empty.createWorkflowDesc': 'Chain and schedule API requests',
  'workbench.shell.empty.import': 'Import',
  'workbench.shell.empty.importDesc': 'Curl, HAR, Postman, and more',
  'workbench.shell.empty.migrate': 'Migrate from another tool',
  'workbench.shell.empty.migrateDesc': 'Bring your Postman, Insomnia, or Bruno data',
  'workbench.shell.empty.browseTemplates': 'Browse all templates…',
  'workbench.shell.empty.varEnvironment': 'Environment variable',
  'workbench.shell.empty.varWorkspace': 'Workspace variable',
  'workbench.shell.empty.varLive': 'Live variable',
  'workbench.shell.empty.varVault': 'Vault secret',
  'workbench.shell.empty.varCollection': 'Collection variable',
  'workbench.shell.empty.varCollectionTooltip': 'Collection variables are created from within a collection.',

  // ── Shell: environment selector ─────────────────────────────────────
  'workbench.shell.envSelector.noEnvironment': 'No environment',
  'workbench.shell.envSelector.defaultPill': 'DEFAULT',
  'workbench.shell.envSelector.defaultTooltip':
    'Default environment is auto-selected while working with the collection.',
  'workbench.shell.envSelector.openEnv': 'Edit variables',
  'workbench.shell.envSelector.pinToTab': 'Pin to this tab',
  'workbench.shell.envSelector.unpinFromTab': 'Unpin from this tab',
  'workbench.shell.envSelector.pinToTabDesc': 'Switches to this environment whenever the tab is focused.',
  'workbench.shell.envSelector.pinToCollection': 'Pin to collection',
  'workbench.shell.envSelector.unpinFromCollection': 'Unpin from collection',
  'workbench.shell.envSelector.pinToCollectionDesc': 'Shows this environment in the collection’s pinned list.',
  'workbench.shell.envSelector.pinAria': 'Pin environment',
  'workbench.shell.envSelector.setCollectionDefault': 'Set as collection default',
  'workbench.shell.envSelector.clearCollectionDefault': 'Clear collection default',
  'workbench.shell.envSelector.searchPlaceholder': 'Search environments…',
  'workbench.shell.envSelector.modeLabel': 'Mode: {mode}',
  'workbench.shell.envSelector.switchBehavior.title': 'When switching between collections',
  'workbench.shell.envSelector.switchBehavior.keep': 'Keep selected environment',
  'workbench.shell.envSelector.switchBehavior.keepDesc':
    'Your selection stays put across collections and everything inside them.',
  'workbench.shell.envSelector.switchBehavior.applyDefaults': 'Apply collection defaults',
  'workbench.shell.envSelector.switchBehavior.applyDefaultsDesc':
    'Defaults take over while inside. Your last manual pick is restored elsewhere.',
  'workbench.shell.envSelector.switchBehavior.follow': 'Follow each collection',
  'workbench.shell.envSelector.switchBehavior.followDesc':
    "Collections with a default switch to it (and remember your picks). Others don't switch.",
  'workbench.shell.envSelector.switchBehavior.aria': 'Environment switching behavior',
  'workbench.shell.envSelector.pinnedBanner': 'Pinned to the current tab — picking an environment moves the pin.',
  'workbench.shell.envSelector.unpin': 'Unpin',
  'workbench.shell.envSelector.createNew': 'Create new environment',
  'workbench.shell.envSelector.pinnedSection': 'Pinned to this collection',
  'workbench.shell.envSelector.othersSection': 'Other environments',
  'workbench.shell.envSelector.noMatches': 'No matching environments',
  'workbench.shell.envSelector.footer.vault': 'Vault',
  'workbench.shell.envSelector.footer.collection': 'Collection',
  'workbench.shell.envSelector.footer.workspace': 'Workspace',
  'workbench.shell.envSelector.footer.live': 'Live',
  'workbench.shell.envSelector.triggerAriaActive': 'Active environment: {name}',
  'workbench.shell.envSelector.triggerAriaActivePinned': 'Active environment: {name} (pinned by this tab)',
  'workbench.shell.envSelector.triggerAriaNone': 'No environment selected',
  'workbench.shell.envSelector.triggerAriaNonePinned': 'No environment selected (pinned by this tab)',

  // ── Shell: breadcrumb root nouns ────────────────────────────────────
  'workbench.shell.breadcrumbs.settings': 'Settings',
  'workbench.shell.breadcrumbs.whatsNew': "What's New",
  'workbench.shell.breadcrumbs.workspaces': 'Workspaces',
  'workbench.shell.breadcrumbs.serverAdmin': 'Server admin',
  'workbench.shell.breadcrumbs.environments': 'Environments',
  'workbench.shell.breadcrumbs.specs': 'Specs',
  'workbench.shell.breadcrumbs.workspaceVariables': 'Workspace Variables',
  'workbench.shell.breadcrumbs.vault': 'Vault',
  'workbench.shell.breadcrumbs.packageLibrary': 'Package Library',
  'workbench.shell.breadcrumbs.rules': 'Rules',
  'workbench.shell.breadcrumbs.requests': 'Requests',
  'workbench.shell.breadcrumbs.templates': 'Templates',
  'workbench.shell.breadcrumbs.variables': 'Variables',
  'workbench.shell.breadcrumbs.apiRequests': 'API Requests',
  'workbench.shell.breadcrumbs.workflows': 'Workflows',
  'workbench.shell.breadcrumbs.liveVariables': 'Live Variables',

  // ── Shell: fallback entity labels ───────────────────────────────────
  'workbench.shell.fallback.workflow': 'Workflow',
  'workbench.shell.fallback.template': 'Template',
  'workbench.shell.fallback.environment': 'Environment',

  // ── Shell: tab-label compositions + draft seeds. Singleton tab
  // labels resolve live through the breadcrumb root nouns; only copy
  // with no breadcrumb twin lives here. Draft seeds persist as entity
  // names BY DESIGN (V5 fresh start) — keyed at mint time. ────────────
  'workbench.shell.tabLabel.collectionVariables': '{name} · Variables',
  'workbench.shell.tabLabel.collectionScripts': '{name} · Scripts',
  'workbench.shell.tabLabel.collectionAuth': '{name} · Authorization',
  'workbench.shell.tabLabel.newRequest': 'New Request',
  'workbench.shell.tabLabel.newGrpcRequest': 'New gRPC Request',
  'workbench.shell.tabLabel.newWebSocketRequest': 'New WebSocket Request',
  'workbench.shell.tabLabel.newSocketIoRequest': 'New Socket.IO Request',
  'workbench.shell.tabLabel.newWorkflow': 'New Workflow',
  'workbench.shell.tabLabel.newLiveVariable': 'New Live Variable',

  // ── Shell: App glue — workspace-switch toast, dirty-close confirm,
  // create-flow toasts. `{unit}` interpolates the host-vocabulary
  // instance noun (tab / window). ─────────────────────────────────────
  'workbench.shell.appGlue.switchedTo': 'Switched this {unit} to',
  'workbench.shell.appGlue.andMadeActive': ' and made it active',
  'workbench.shell.appGlue.discardTitle': 'Discard unsaved drafts?',
  'workbench.shell.appGlue.discardBody': 'Switching workspaces will close editor tabs with unsaved changes.',
  'workbench.shell.appGlue.discardOk': 'Switch and discard',
  'workbench.shell.appGlue.cancel': 'Cancel',
  'workbench.shell.toast.createEnvironmentFailed': 'Failed to create environment',
  'workbench.shell.toast.noActiveWorkspace': 'No active workspace',
  'workbench.shell.toast.createRuleFailed': 'Failed to create rule',

  // ── Save: collection modal chrome ───────────────────────────────────
  'workbench.save.title': 'SAVE',
  'workbench.save.newFolder': 'New folder',
  'workbench.save.newFolderTooltip': 'New folder ({chord})',
  'workbench.save.newCollection': 'New collection',
  'workbench.save.newCollectionTooltip': 'New collection ({chord})',
  'workbench.save.cancel': 'Cancel',
  'workbench.save.save': 'Save',
  'workbench.save.selectCollectionFirst': 'Select a collection first',
  'workbench.save.enterName': 'Enter a name',
  'workbench.save.saveWithChord': 'Save ({chord})',
  'workbench.save.footer.navigate': '↑↓ navigate',
  'workbench.save.footer.open': '→ open',
  'workbench.save.footer.back': '← back',
  'workbench.save.footer.new': '{chord} new',
  'workbench.save.footer.save': '{chord} save',
  'workbench.save.footer.close': 'esc close',
  'workbench.save.nameLabel': 'Name',
  'workbench.save.saveTo': 'Save to ',
  'workbench.save.rootCrumb': 'Local Rules',
  'workbench.save.searchFolders': 'Search folders',
  'workbench.save.searchCollections': 'Search for collection',
  'workbench.save.nameYourCollection': 'Name your collection',
  'workbench.save.create': 'Create',
  'workbench.save.noCollections': 'No collections yet.',
  'workbench.save.noMatchingCollections': 'No matching collections.',
  'workbench.save.createCollection': 'Create collection',
  'workbench.save.orPressPrefix': 'or press',
  'workbench.save.nameYourFolder': 'Name your folder',
  'workbench.save.folderEmpty': 'This folder is empty.',
  'workbench.save.collectionEmpty': 'This collection is empty.',
  'workbench.save.pressPrefix': 'Press',
  'workbench.save.pressMiddle': 'to save here, or',
  'workbench.save.pressSuffix': 'for a new folder.',

  // ── Save: as-template step ──────────────────────────────────────────
  'workbench.save.template.title': 'Save as User Template',
  'workbench.save.template.next': 'Next',
  'workbench.save.template.intro': 'Save the current {type} configuration as a reusable template.',
  'workbench.save.template.iconLabel': 'Icon',
  'workbench.save.template.nameLabel': 'Name *',
  'workbench.save.template.namePlaceholder': 'My template name',
  'workbench.save.template.descriptionLabel': 'Description',
  'workbench.save.template.descriptionPlaceholder': 'What does this template do? (optional)',
  'workbench.save.template.includeConditions': 'Include conditions',
  'workbench.save.template.includeActions': 'Include actions',
  'workbench.save.template.ruleFallback': 'Rule',

  // ── Save: per-surface rule-type vocabulary ──────────────────────────
  'workbench.save.ruleType.header': 'Header',
  'workbench.save.ruleType.block': 'Block',
  'workbench.save.ruleType.redirect': 'Redirect',
  'workbench.save.ruleType.queryParam': 'Query Param',
  'workbench.save.ruleType.inject': 'Inject',
  'workbench.save.ruleType.delay': 'Delay',
  'workbench.save.ruleType.requestBody': 'API Request Body',
  'workbench.save.ruleType.response': 'API Response',

  // ── Shell: rule-type entity names ('New {name}' draft seeds, command
  //    palette scope column + New-rule rows). Draft names persist as
  //    entity names — keyed at mint time (V5 fresh start, no back-compat). ─
  'workbench.shell.ruleTypeName.header': 'Header Rule',
  'workbench.shell.ruleTypeName.block': 'Block Rule',
  'workbench.shell.ruleTypeName.redirect': 'Redirect Rule',
  'workbench.shell.ruleTypeName.queryParam': 'Query Param Rule',
  'workbench.shell.ruleTypeName.inject': 'Inject Rule',
  'workbench.shell.ruleTypeName.delay': 'Delay Rule',
  'workbench.shell.ruleTypeName.requestBody': 'API Request Body Rule',
  'workbench.shell.ruleTypeName.response': 'API Response Rule',
  'workbench.shell.ruleTypeName.ws': 'WebSocket Rule',
  'workbench.shell.ruleTypeName.sse': 'SSE Rule',
  'workbench.shell.ruleTypeName.fallback': 'Rule',
  'workbench.shell.ruleTypeName.draftName': 'New {name}',

  // ── Tool-window registry (activity bars, dock tab strips, restore
  //    rows, drag previews) ───────────────────────────────────────────
  'workbench.toolWindows.httpRules': 'HTTP Rules',
  'workbench.toolWindows.apiRequests': 'API Requests',
  'workbench.toolWindows.workflows': 'Workflows',
  'workbench.toolWindows.notifications': 'Notifications',
  'workbench.toolWindows.docs': 'Docs',
  'workbench.toolWindows.varScope': 'Variable Scope',
  'workbench.toolWindows.variables': 'Variables',
  'workbench.toolWindows.workflowStatus': 'Workflow Status',
  'workbench.toolWindows.activity': 'Activity',
  'workbench.toolWindows.activityTooltip': 'Activity Feed — inbound changes from peers',
  'workbench.toolWindows.trafficMonitor': 'Traffic Monitor',
  'workbench.toolWindows.terminal': 'Terminal',
  'workbench.toolWindows.git': 'Git',

  // ── Tool-window `(i)` info popovers. `{{live.*}}` / `{{name}}`
  //    reference chips compose raw in JSX between the keyed prefix/
  //    suffix fragments; the Notifications entry stays on the shared
  //    NOTIFICATIONS_PANEL_INFO corpus (panel co-consumer, Phase D). ───
  'workbench.toolWindows.info.httpRules.summary':
    'Create rules that rewrite outgoing requests and incoming responses. Rules live in collections and can ' +
    'inject values from variables, the vault, and live workflows.',
  'workbench.toolWindows.info.httpRules.ruleTypesHeading': 'Rule types',
  'workbench.toolWindows.info.workflows.summaryPrefix':
    'A scheduled-refresh variable producer: a request chain plus an extraction rule. Its output surfaces as a',
  'workbench.toolWindows.info.workflows.summarySuffix': 'reference you can use anywhere a variable is accepted.',
  'workbench.toolWindows.info.docs.summary':
    'In-app documentation for rules, variables, workflows, and the workbench itself — browse without leaving ' +
    'the app.',
  'workbench.toolWindows.info.varScope.summaryPrefix':
    'The variables the active tab references and every scope they resolve against. A bare',
  'workbench.toolWindows.info.varScope.summaryMiddle': 'falls through the priority order below; namespaced refs like',
  'workbench.toolWindows.info.varScope.summarySuffix': 'target one scope directly.',
  'workbench.toolWindows.info.varScope.priorityHeading': 'Priority order',
  'workbench.toolWindows.info.varScope.vaultLabel': 'Vault',
  'workbench.toolWindows.info.varScope.vaultDesc': 'Per-user secrets, never synced — highest priority.',
  'workbench.toolWindows.info.varScope.environmentLabel': 'Environment',
  'workbench.toolWindows.info.varScope.environmentDesc':
    'The active environment, falling back to the default environment.',
  'workbench.toolWindows.info.varScope.collectionLabel': 'Collection',
  'workbench.toolWindows.info.varScope.collectionDesc': "The active entity's collection.",
  'workbench.toolWindows.info.varScope.workspaceLabel': 'Workspace',
  'workbench.toolWindows.info.varScope.workspaceDesc': 'Shared across the workspace — lowest priority.',
  'workbench.toolWindows.info.varScope.namespacedHeading': 'Namespaced',
  'workbench.toolWindows.info.varScope.liveLabel': 'Live',
  'workbench.toolWindows.info.varScope.liveDescPrefix': 'Workflow-backed; reached only via',
  'workbench.toolWindows.info.varScope.liveDescSuffix': ', resolved from the latest run.',
  'workbench.toolWindows.info.variables.summary':
    'The variable catalogue — everything defined across environments, collections, the workspace, and the ' +
    'vault. Use Scope to see what is actually in scope for the active tab.',
  'workbench.toolWindows.info.variables.typesHeading': 'Variable types',
  'workbench.toolWindows.info.variables.vaultDesc': 'Per-user secrets — stored locally, never synced.',
  'workbench.toolWindows.info.variables.environmentDesc': 'Defined per environment; the active one supplies values.',
  'workbench.toolWindows.info.variables.collectionDesc': 'Defined on a collection; apply to the entities inside it.',
  'workbench.toolWindows.info.variables.workspaceDesc': 'Shared across the whole workspace.',
  'workbench.toolWindows.info.variables.liveDescPrefix': 'Workflow-produced values, referenced as',
  'workbench.toolWindows.info.variables.liveDescSuffix': '.',
  'workbench.toolWindows.info.apiRequests.summary':
    'Saved API requests and the environments they run against, organized into collections and folders.',
  'workbench.toolWindows.info.apiRequests.editorHeading': 'Request editor',
  'workbench.toolWindows.info.apiRequests.docsLabel': 'Docs',
  'workbench.toolWindows.info.apiRequests.docsDesc': 'Free-form notes for the request — Markdown supported.',
  'workbench.toolWindows.info.apiRequests.paramsLabel': 'Params',
  'workbench.toolWindows.info.apiRequests.paramsDesc': 'Query parameters appended to the request URL.',
  'workbench.toolWindows.info.apiRequests.authorizationLabel': 'Authorization',
  'workbench.toolWindows.info.apiRequests.authorizationDesc':
    'Inherit from parent, Basic, Bearer Token, API Key, or OAuth 2.0 — applied at send time.',
  'workbench.toolWindows.info.apiRequests.headersLabel': 'Headers',
  'workbench.toolWindows.info.apiRequests.headersDesc': 'Request headers, with variable references resolved at send.',
  'workbench.toolWindows.info.apiRequests.bodyLabel': 'Body',
  'workbench.toolWindows.info.apiRequests.bodyDesc':
    'Form data, URL-encoded, raw (Text, JavaScript, JSON, HTML, XML), or GraphQL.',
  'workbench.toolWindows.info.apiRequests.scriptsLabel': 'Scripts',
  'workbench.toolWindows.info.apiRequests.scriptsDesc': 'Pre-request and post-response JavaScript hooks.',
  'workbench.toolWindows.info.apiRequests.settingsLabel': 'Settings',
  'workbench.toolWindows.info.apiRequests.settingsDesc':
    'Per-request behavior — SSL verification, redirects, and more.',
  'workbench.toolWindows.info.trafficMonitor.summary':
    'The unified live traffic view — pick a source on the right: a connected browser tab (the extension streams its ' +
    'traffic live) or the wire capture (any tool on this machine pointed at the local proxy port). Both render the ' +
    'same network log the DevTools panel uses; nothing streams until a source is selected.',
  'workbench.toolWindows.info.workflowStatus.summary':
    'Per-workflow circuit-breaker dashboard — state, consecutive failures, openings, and next-attempt ' +
    'countdown, with manual Retry and Reset-circuit actions.',
  'workbench.toolWindows.info.activity.summary':
    'Workspace-wide feed of inbound changes from peers, with classifier highlights for sensitive-field ' +
    'rotations, permission-scope expansions, and local-edit supersedes.',
  'workbench.terminal.sessionEnded': 'Session ended',
  'workbench.terminal.restart': 'Restart shell',
  'workbench.terminal.tabLocal': 'Local',
  'workbench.terminal.tabLocalN': 'Local ({n})',
  'workbench.terminal.newTab': 'New terminal tab',
  'workbench.terminal.newTabWithProfile': 'New tab from profile',
  'workbench.terminal.closeTab': 'Close tab',
  'workbench.terminal.openTui': 'TUI',
  'workbench.terminal.closeConfirm.title': 'Process is running',
  'workbench.terminal.closeConfirm.bodyPrefix': 'A process is still running in ',
  'workbench.terminal.closeConfirm.bodySuffix': '. Terminate it?',
  'workbench.terminal.closeConfirm.ok': 'Terminate',
  'workbench.terminal.closeConfirm.bodyMany':
    'Processes are still running in {count} of the tabs being closed. Terminate them?',
  'workbench.terminal.menu.rename': 'Rename',
  'workbench.terminal.rename.title': 'Rename Tab',
  'workbench.terminal.settings': 'Settings',
  'workbench.terminal.cliGate.title': 'Connect the OpenHeaders CLI',
  'workbench.terminal.cliGate.body':
    'TUI mode is powered by the oh command-line tool, which isn’t connected to this app yet.',
  'workbench.terminal.cliGate.bodyInfo.title': 'CLI connection',
  'workbench.terminal.cliGate.bodyInfo.summary':
    'Connecting mints an access token and writes it to {path}. The oh CLI reads that file to authenticate ' +
    'against the local daemon, so after connecting oh works in any terminal on this machine. Cancel mints ' +
    'nothing.',
  'workbench.terminal.cliGate.enableMcp': 'Enable MCP Server',
  'workbench.terminal.cliGate.enableMcpRider':
    'While the endpoint is off the TUI reports the daemon as unreachable. Uncheck to provision the token only.',
  'workbench.terminal.cliGate.ok': 'Connect and open',
  'workbench.terminal.cliGate.openSettings': 'Open Settings',
  'workbench.terminal.cliGate.installTitle': 'Install the OpenHeaders CLI',
  'workbench.terminal.cliGate.installBody':
    'TUI mode is powered by the oh command-line tool, which isn’t installed on this machine yet. ' +
    'Run this in any terminal to install it, then open TUI mode again:',
  'workbench.terminal.cliGate.installOk': 'Open a terminal',
  'workbench.toolWindows.info.terminal.summary':
    'An integrated terminal running your shell in a real pty — anything you can run in a stand-alone ' +
    'terminal runs here, including the oh CLI against the local app.',
  'workbench.toolWindows.info.git.summary':
    'Commit history for the active workspace’s Git binding — the workspace timeline with per-commit ' +
    'changed files, authorship, and per-file history.',

  // ── Git tool window (log view) ───────────────────────────────────
  'workbench.gitLog.filterPlaceholder': 'Filter by message, author, or hash',
  'workbench.gitLog.refresh': 'Refresh',
  'workbench.gitLog.empty':
    'No commits yet — commits land on your configured cadence, or commit manually under Settings › Git.',
  'workbench.gitLog.selectCommit': 'Select a commit to view its changes',
  'workbench.gitLog.notBound.title': 'This workspace has no Git binding',
  'workbench.gitLog.notBound.body': 'Bind the workspace to a folder under Settings › Git to see its history.',
  'workbench.gitLog.notBound.cta': 'Open Git settings',
  'workbench.gitLog.loadFailed': 'Could not load history: {detail}',
  'workbench.gitLog.authorLine': '{author} <{email}> on {date}',
  'workbench.gitLog.coAuthors': 'Co-authored by {authors}',
  'workbench.gitLog.filesHeading': 'Changed files',
  'workbench.gitLog.diff.title': 'Diff — {path}',
  'workbench.gitLog.diff.binary': 'Binary file — no text preview.',
  'workbench.gitLog.diff.tooLarge': 'File too large to preview ({size} KB).',
  'workbench.gitLog.refs.toggle': 'Show branches and tags',
  'workbench.gitLog.refs.local': 'Local',
  'workbench.gitLog.refs.remote': 'Remote',
  'workbench.gitLog.refs.tags': 'Tags',
  'workbench.gitLog.refs.empty': 'Branches appear after the first commit.',

  // ── Proxy capture tool window (control strip) ────────────────────
  'workbench.proxyCapture.running': 'Running · :{port}',
  'workbench.proxyCapture.stopped': 'Stopped',
  'workbench.proxyCapture.start': 'Start',
  'workbench.proxyCapture.stop': 'Stop',
  'workbench.proxyCapture.port': 'Port',
  'workbench.proxyCapture.scope': 'Decrypt scope',
  'workbench.proxyCapture.scopeCount': 'Decrypt scope · {count}',
  'workbench.proxyCapture.scopePlaceholder': 'example.com, *.example.com',
  'workbench.proxyCapture.scopeHint':
    'Only listed hosts are decrypted; all other HTTPS traffic passes through as an opaque tunnel.',
  'workbench.proxyCapture.scopeSaved': 'Decrypt scope updated',
  'workbench.proxyCapture.scopeFailed': 'Could not update scope: {message}',
  'workbench.proxyCapture.startFailed': 'Could not start the proxy: {message}',
  'workbench.proxyCapture.emptyRunning': 'Waiting for proxied traffic…',
  'workbench.proxyCapture.emptyRunningHint':
    'Point any app — CLI tools, scripts, another device — at http://127.0.0.1:{port} to capture its requests',
  'workbench.proxyCapture.emptyStopped': 'Proxy is stopped',
  'workbench.proxyCapture.emptyStoppedHint': 'Start the proxy to begin capturing traffic',
  'workbench.proxyCapture.noCa':
    'No CA trusted — HTTP is captured in full; HTTPS stays an opaque tunnel until you install it.',
  'workbench.proxyCapture.noCaAction': 'Install CA',
  'workbench.proxyCapture.routing': 'Route browsers',
  'workbench.proxyCapture.routingFailed': 'Could not update routing: {message}',
  'workbench.proxyCapture.routingActiveLead':
    'These browsers now send decrypt-scope hosts through the capture proxy; everything else stays direct.',
  'workbench.proxyCapture.routingCaveat':
    'HTTP/3 falls back to HTTP/2 or 1.1 on routed hosts, and certificate-pinned endpoints may fail.',
  'workbench.proxyCapture.routingInactive': 'Browsers route scoped hosts once the proxy is running.',
  'workbench.proxyCapture.routingUnsupported': '{agent} · not supported',
  'workbench.proxyCapture.scopeInfo.exampleCaption': 'Example scope',
  'workbench.proxyCapture.scopeInfo.exampleDecrypted': 'decrypted',
  'workbench.proxyCapture.scopeInfo.exampleOpaque': 'opaque tunnel',
  'workbench.proxyCapture.scopeInfo.summary':
    'Only listed hosts are TLS-decrypted and inspected — every other HTTPS connection passes through as an opaque ' +
    'tunnel, never intercepted.',
  'workbench.proxyCapture.scopeInfo.description':
    'An empty list decrypts nothing: interception is always an explicit choice, host by host.',
  'workbench.proxyCapture.scopeInfo.patternsHeading': 'Patterns',
  'workbench.proxyCapture.scopeInfo.exactDesc': 'Exact hostname — matches the apex only.',
  'workbench.proxyCapture.scopeInfo.wildcardDesc': 'Any subdomain — never the apex itself.',
  'workbench.proxyCapture.scopeInfo.ipDesc': 'An IP literal matches exactly.',
  'workbench.proxyCapture.routingInfo.exampleCaption': 'Example routing',
  'workbench.proxyCapture.routingInfo.summary':
    'Connected browsers send decrypt-scope hosts through the capture proxy — no OS proxy settings, no manual setup; ' +
    'everything else stays direct. Mainly for browsers you can’t watch or debug directly.',
  'workbench.proxyCapture.routingInfo.description':
    'Routing persists until you switch it off — an app restart or connection drop never leaves the browser stuck ' +
    'behind a dead proxy.',
  'workbench.proxyCapture.routingInfo.behaviorHeading': 'Behavior',
  'workbench.proxyCapture.routingInfo.appliedDesc':
    'Chromium browsers apply a generated PAC; Firefox routes per request.',
  'workbench.proxyCapture.routingInfo.failoverDesc':
    'If the capture port is unreachable, traffic falls back to a direct connection — a capture gap, never broken browsing.',
  'workbench.proxyCapture.routingInfo.h3Desc':
    'Routed hosts fall back from HTTP/3 to HTTP/2 or 1.1; certificate-pinned endpoints may fail while routed.',
  'workbench.proxyCapture.routingPopoverHint':
    'Routes decrypt-scope hosts from connected browsers through the wire. Mainly for browsers you can’t watch or ' +
    'debug directly — a watchable tab gets more via Debug mode on its row.',
  'workbench.proxyCapture.routingOnTag': 'On',

  // ── Traffic Monitor tool window (unified observability surface) ─────
  'workbench.trafficMonitor.browserConnected': 'Connected browsers: {count}',
  'workbench.trafficMonitor.noBrowser': 'No browser connected',
  'workbench.trafficMonitor.refreshTabs': 'Refresh tab list',
  'workbench.trafficMonitor.untitledTab': 'Untitled tab',
  'workbench.trafficMonitor.extensionVersion': 'v{version}',
  'workbench.trafficMonitor.emptyWatching': 'Waiting for traffic…',
  'workbench.trafficMonitor.emptyWatchingHint': 'Browse in the watched tab — its requests appear here live',
  'workbench.trafficMonitor.sources': 'Sources',
  'workbench.trafficMonitor.browserTabs': 'Browser tabs',
  'workbench.trafficMonitor.windowLabel': 'Window {n}',
  'workbench.trafficMonitor.wire': 'Wire',
  'workbench.trafficMonitor.wireCapture': 'Wire capture',
  'workbench.trafficMonitor.wireCaptureHint':
    'Non-browser & un-watchable traffic — anything routed through the capture port: CLI tools, native apps, other devices',
  'workbench.trafficMonitor.emptyNoSource': 'No source selected',
  'workbench.trafficMonitor.emptyNoSourceHint':
    'Pick a browser tab or the wire capture on the right to watch its traffic',
  'workbench.trafficMonitor.debugTab': 'Debug this tab — full fidelity: bodies, exact headers, timing',
  'workbench.trafficMonitor.debugAttached': 'Debugging this tab — full fidelity via the browser’s debugger',
  'workbench.trafficMonitor.debugPinned': 'Pinned for debugging — attaches once Debug mode is on',
  'workbench.trafficMonitor.debugPinAria': 'Toggle debugging for this tab',
  'workbench.trafficMonitor.debugModeHint':
    'Debug mode — attaches the browser’s debugger to scoped and pinned tabs for bodies and exact headers. The browser ' +
    'shows a banner on each attached tab.',
  'workbench.trafficMonitor.noBrowsersHint':
    'No browsers connected. Open a browser with the extension installed, or install it:',
  'workbench.trafficMonitor.installExtension': 'Install {browser} extension',
  'workbench.trafficMonitor.watchConsentOff': 'View off',
  'workbench.trafficMonitor.watchConsentOffHint':
    'This browser’s extension doesn’t allow the desktop app to view its traffic, storage, or console. Rules and sync ' +
    'keep working. Turn on “Let the desktop app view this browser” in the extension’s settings to watch it here.',
  'workbench.trafficMonitor.watchConsentOffEmpty': 'Live view is turned off in this browser',
  'workbench.trafficMonitor.watchConsentOffEmptyHint':
    'Enable “Let the desktop app view this browser” in the extension’s settings to watch this tab’s traffic, storage, and console here',

  // ── Shared markdown widgets (toolbar + highlighted code block) ──────
  'workbench.markdown.heading': 'Heading',
  'workbench.markdown.bold': 'Bold',
  'workbench.markdown.italic': 'Italic',
  'workbench.markdown.strikethrough': 'Strikethrough',
  'workbench.markdown.codeBlock': 'Code block',
  'workbench.markdown.link': 'Link',
  'workbench.markdown.bulletedList': 'Bulleted list',
  'workbench.markdown.numberedList': 'Numbered list',
  'workbench.markdown.table': 'Table',
  'workbench.markdown.copyCode': 'Copy code',
  'workbench.markdown.copied': 'Copied',

  // ── Two-tone icon picker ────────────────────────────────────────────
  'workbench.iconPicker.searchPlaceholder': 'Search icons...',

  // ── Template editor ─────────────────────────────────────────────────
  'workbench.templateEditor.toast.saved': 'Template saved',
  'workbench.templateEditor.toast.saveFailed': 'Failed to save template',
  'workbench.templateEditor.notFound': 'Template not found',
  'workbench.templateEditor.namePlaceholder': 'Template name',
  'workbench.templateEditor.descriptionPlaceholder': 'Description (optional)',
  'workbench.templateEditor.includeConditions': 'Include conditions',
  'workbench.templateEditor.includeActions': 'Include actions',
  'workbench.templateEditor.conditionsTitle': 'Conditions',

  // ── What's New tab ──────────────────────────────────────────────────
  'workbench.whatsNew.title': "What's New in {version}",
  'workbench.whatsNew.noNotes': 'This build ships without release notes.',
  'workbench.whatsNew.historyTitle': 'Previous releases',
  'workbench.whatsNew.historyShowNotes': 'Show notes',
  'workbench.whatsNew.historyHideNotes': 'Hide notes',
  'workbench.whatsNew.historyNotesUnavailable': 'Release notes could not be loaded.',
  'workbench.whatsNew.historyBetaTag': 'Beta',
  'workbench.whatsNew.historySecurityTag': 'Security',

  // ── Keyboard shortcuts: SHORTCUTS registry action names + the docs
  // cheatsheet chrome around them. Chords, key caps (?, ⌘, Ctrl) and
  // the regions diagram internals stay raw. ──────────────────────────
  'workbench.shortcuts.action.toggleLeftSidebar': 'Toggle left sidebar',
  'workbench.shortcuts.action.toggleRightSidebar': 'Toggle right sidebar',
  'workbench.shortcuts.action.toggleBottomPanel': 'Toggle bottom panel',
  'workbench.shortcuts.action.toggleActivityFeed': 'Toggle activity feed',
  'workbench.shortcuts.action.terminalNewTab': 'New terminal tab',
  'workbench.shortcuts.action.closeTab': 'Close tab',
  'workbench.shortcuts.action.newTab': 'New tab',
  'workbench.shortcuts.action.prevTab': 'Previous tab',
  'workbench.shortcuts.action.nextTab': 'Next tab',
  'workbench.shortcuts.action.tabSearch': 'Search tabs',
  'workbench.shortcuts.action.commandPalette': 'Command palette',
  'workbench.shortcuts.action.focusFilter': 'Focus active section filter',
  'workbench.shortcuts.action.focusLeftSidebar': 'Focus left sidebar',
  'workbench.shortcuts.action.focusEditor': 'Focus editor',
  'workbench.shortcuts.action.focusRightSidebar': 'Focus right sidebar',
  'workbench.shortcuts.action.focusBottomPanel': 'Focus bottom panel',
  'workbench.shortcuts.action.save': 'Save',
  'workbench.shortcuts.action.newRule': 'Create item',
  'workbench.shortcuts.action.import': 'Import',
  'workbench.shortcuts.action.showShortcuts': 'Keyboard shortcuts',
  'workbench.shortcuts.action.openSettings': 'Open settings',
  'workbench.shortcuts.action.find': 'Find in editor',
  'workbench.shortcuts.action.replace': 'Replace in editor',
  'workbench.shortcuts.action.formatCode': 'Format code',
  'workbench.shortcuts.category.panels': 'Panels',
  'workbench.shortcuts.category.tabs': 'Tabs',
  'workbench.shortcuts.category.navigation': 'Navigation',
  'workbench.shortcuts.category.actions': 'Actions',
  'workbench.shortcuts.allSurfacesTitle': 'All surfaces',
  'workbench.shortcuts.toggleDebugMode': 'Toggle debug mode',
  'workbench.shortcuts.goToTab': 'Go to tab 1–9 (9 = last)',
  'workbench.shortcuts.introPrefix': 'Press',
  'workbench.shortcuts.introMiddle': 'anytime to jump here. Shortcuts use',
  'workbench.shortcuts.introSuffix': 'as the modifier key.',
  'workbench.shortcuts.regionsCaption': 'Four chords park your focus in one of four shell regions.',

  // ── Docs navigator plane: group labels + section titles/summaries
  // from the workbench DOC_GROUPS registry (raw-or-key DocSection
  // idiom). Section body corpus + diagrams are their own station. ────
  'workbench.docs.nav.group.openHeaders': 'Open Headers',
  'workbench.docs.nav.group.concepts': 'Concepts',
  'workbench.docs.nav.group.modifyRequests': 'Modify Requests',
  'workbench.docs.nav.group.modifyResponses': 'Modify Responses',
  'workbench.docs.nav.group.runCode': 'Run Code',
  'workbench.docs.nav.group.reference': 'Reference',
  'workbench.docs.nav.paradigm.title': 'What do we do (differently)',
  'workbench.docs.nav.paradigm.summary':
    'A browser extension that does what used to need a proxy, a desktop binary, or a cloud account.',
  'workbench.docs.nav.comparison.title': 'How we compare',
  'workbench.docs.nav.comparison.summary':
    'How Open Headers lands against cloud platforms, desktop proxies, and header-only extensions.',
  'workbench.docs.nav.roadmap.title': 'Every surface, shipped',
  'workbench.docs.nav.roadmap.summary':
    'The shipped milestones — Git workspaces, desktop app, MCP server, self-hosted server, CLI, web app, importers.',
  'workbench.docs.nav.conditions.title': 'Conditions',
  'workbench.docs.nav.conditions.summary':
    'AND-matching filters that gate every rule — domains, URL patterns, methods, headers.',
  'workbench.docs.nav.actions.title': 'Actions',
  'workbench.docs.nav.actions.summary':
    'The "do" half of a rule — modify request, modify response, or run code. Pairs with conditions.',
  'workbench.docs.nav.variables.title': 'Variables',
  'workbench.docs.nav.variables.summary':
    'Five variable scopes — vault, environment, collection, workspace, live — and how references resolve.',
  'workbench.docs.nav.requestTracking.title': 'Request Tracking',
  'workbench.docs.nav.requestTracking.summary':
    'How matched requests are observed, recorded, and surfaced as badges in the popup.',
  'workbench.docs.nav.execution.title': 'How rules execute',
  'workbench.docs.nav.execution.summary': 'The two engines (DNR and script-based) that decide where each rule applies.',
  'workbench.docs.nav.multiTab.title': 'Multi-tab Behavior',
  'workbench.docs.nav.multiTab.summary':
    'What syncs across workspace tabs (data) and what stays per-tab (layout, drafts).',
  'workbench.docs.nav.systemStatus.title': 'System Status',
  'workbench.docs.nav.systemStatus.summary':
    'The traffic-light pill — what each subsystem reports and what red / yellow / green mean.',
  'workbench.docs.nav.debugMode.title': 'Debug Mode',
  'workbench.docs.nav.debugMode.summary':
    'Attach to the browser debugging protocol — deeper reach for requests, injection, and tab environment.',
  'workbench.docs.nav.headerActions.title': 'Header Actions',
  'workbench.docs.nav.headerActions.summary': 'Add, replace, append, remove, or merge request and response headers.',
  'workbench.docs.nav.block.title': 'Block',
  'workbench.docs.nav.block.summary': 'Cancel matching requests at the network layer.',
  'workbench.docs.nav.redirect.title': 'Redirect',
  'workbench.docs.nav.redirect.summary': 'Send matching requests to a different URL — static or regex-substituted.',
  'workbench.docs.nav.queryParam.title': 'Query Params',
  'workbench.docs.nav.queryParam.summary': 'Add, replace, or remove URL query parameters before the request leaves.',
  'workbench.docs.nav.requestBody.title': 'Request Body',
  'workbench.docs.nav.requestBody.summary':
    'Override or transform outgoing fetch / XHR bodies — static, dynamic, or GraphQL-filtered.',
  'workbench.docs.nav.response.title': 'Modify Response',
  'workbench.docs.nav.response.summary':
    'Mock or modify API responses — synthetic or transformed body, status, and headers.',
  'workbench.docs.nav.inject.title': 'Inject JS / CSS',
  'workbench.docs.nav.inject.summary':
    'Run JavaScript or CSS in the page context — pre-page-script or after DOM is ready.',
  'workbench.docs.nav.delay.title': 'Delay',
  'workbench.docs.nav.delay.summary': 'Add artificial latency to navigations and JS-initiated fetch / XHR.',
  'workbench.docs.nav.resourceTypes.title': 'Resource Types',
  'workbench.docs.nav.resourceTypes.summary':
    'Lookup table for the Chrome ResourceType values — Page, Frame, Fetch/XHR, Script, and the rest.',
  'workbench.docs.nav.keyboardShortcuts.title': 'Keyboard Shortcuts',
  'workbench.docs.nav.keyboardShortcuts.summary':
    'Every workbench shortcut, grouped by surface — panels, tabs, navigation, actions.',
  'workbench.docs.nav.limitations.title': 'Limitations',
  'workbench.docs.nav.limitations.summary':
    'Known surprises in one place — DevTools visibility, script reach, header matching, Merge.',

  // ── Copy-as-snippet toasts (sidebar row menu + request editor ⋯) ────
  'workbench.copySnippet.copied': 'Copied as {format}',
  'workbench.copySnippet.failed': "Couldn't copy",
  'workbench.copySnippet.failedDetail': "Couldn't copy: {message}",
} as const satisfies Catalog;
