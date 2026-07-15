/**
 * Workbench chrome station (Phase C) — the sidebar (section headers,
 * tree-node hooks, container menus, placeholders, create actions,
 * confirm-delete modal), the tab strip (tab context menu, create
 * menu, tab search overlay, pill arias), the shell plane (top bar,
 * status bar, activity bar, command palette, environment selector,
 * editor empty state, breadcrumb root nouns), the workspace family
 * (manager, switcher, publish modal, home-Org identity card, grant
 * notices, identity picker), and the save modals. Namespaces:
 * `workbench.sidebar.*`, `workbench.tabbar.*`, `workbench.shell.*`,
 * `workbench.workspace.*`, `workbench.save.*`, plus the
 * surface-neutral `workbench.scratch.*` labels shared by the tab
 * tooltip and the breadcrumb bar.
 *
 * Technical plane stays raw: HTTP method tags (GET/POST…), entity
 * names, key glyphs (the ✓ checkmark composes in JSX ahead of the
 * keyed behavior labels), keyboard chords ({chord} interpolations),
 * host-unit nouns interpolated as {unit}/{units}, backend annotation
 * text, `{{ns.*}}` reference syntax inside the tool-window info
 * popovers, and the 'User Templates' default collection name
 * (identity-compared against the background seed — localizing it
 * would re-enable rename/delete on the default collection).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchChrome = {
  // ── Sidebar: section headers (caps in the value) ────────────────────
  'workbench.sidebar.section.rules': 'RULES',
  'workbench.sidebar.section.templates': 'TEMPLATES',
  'workbench.sidebar.section.requests': 'REQUESTS',
  'workbench.sidebar.section.workflows': 'WORKFLOWS',
  'workbench.sidebar.section.environments': 'ENVIRONMENTS',
  'workbench.sidebar.section.vault': 'VAULT',
  'workbench.sidebar.section.workspaceVariables': 'WORKSPACE VARIABLES',
  'workbench.sidebar.section.liveVariables': 'LIVE VARIABLES',
  'workbench.sidebar.section.packageLibrary': 'PACKAGE LIBRARY',

  // ── Sidebar: per-view header title ──────────────────────────────────
  'workbench.sidebar.view.httpRules': 'HTTP Rules',
  'workbench.sidebar.view.apiRequests': 'API Requests',
  'workbench.sidebar.view.workflows': 'Workflows',
  'workbench.sidebar.view.variables': 'Variables',

  // ── Sidebar: header action cluster ──────────────────────────────────
  'workbench.sidebar.header.newRule': 'New rule',
  'workbench.sidebar.header.addRequest': 'Add request',
  'workbench.sidebar.header.createNewEnvironment': 'Create new environment',
  'workbench.sidebar.header.newWorkflow': 'New workflow',
  'workbench.sidebar.header.newTemplateCollection': 'New template collection',
  'workbench.sidebar.header.exportSelected': 'Export {count} selected…',
  'workbench.sidebar.header.exportSelectedAria': 'Export {count} selected items',
  'workbench.sidebar.header.clearSelection': 'Clear selection',
  'workbench.sidebar.header.clearSelectionAria': 'Clear export selection',
  'workbench.sidebar.header.selectOpenedTab': 'Select Opened Tab',
  'workbench.sidebar.header.selectOpenedTabAria': 'Select opened tab',
  'workbench.sidebar.header.expandAll': 'Expand All',
  'workbench.sidebar.header.expandAllAria': 'Expand all',
  'workbench.sidebar.header.collapseAll': 'Collapse All',
  'workbench.sidebar.header.collapseAllAria': 'Collapse all',
  'workbench.sidebar.behavior.title': 'Behavior',
  'workbench.sidebar.behavior.openEntriesSingleClick': 'Open Entries with Single Click',
  'workbench.sidebar.behavior.openCollectionsSingleClick': 'Open Collections with Single Click',
  'workbench.sidebar.behavior.openFoldersSingleClick': 'Open Folders with Single Click',
  'workbench.sidebar.behavior.alwaysSelectOpened': 'Always Select Opened Tab',
  'workbench.sidebar.filterPlaceholder': 'Filter',

  // ── Sidebar: container + row menus ──────────────────────────────────
  'workbench.sidebar.menu.newCollection': 'New Collection',
  'workbench.sidebar.menu.newRequest': 'New Request',
  'workbench.sidebar.menu.import': 'Import…',
  'workbench.sidebar.menu.addRule': 'Add Rule',
  'workbench.sidebar.menu.addRequest': 'Add Request',
  'workbench.sidebar.menu.addFolder': 'Add Folder',
  'workbench.sidebar.menu.rename': 'Rename',
  'workbench.sidebar.menu.editVariables': 'Edit Variables',
  'workbench.sidebar.menu.createWorkflow': 'Create Workflow…',
  'workbench.sidebar.menu.export': 'Export…',
  'workbench.sidebar.menu.delete': 'Delete',
  'workbench.sidebar.menu.duplicate': 'Duplicate',
  'workbench.sidebar.menu.pauseCollection': 'Pause Collection',
  'workbench.sidebar.menu.unpauseCollection': 'Unpause Collection',
  'workbench.sidebar.menu.pauseFolder': 'Pause Folder',
  'workbench.sidebar.menu.unpauseFolder': 'Unpause Folder',
  'workbench.sidebar.menu.resetCollectionPauseOverride': 'Reset Collection Pause Override',
  'workbench.sidebar.menu.resetFolderPauseOverride': 'Reset Folder Pause Override',
  'workbench.sidebar.menu.clearNestedPauseOverrides': 'Clear Nested Pause Overrides',

  // ── Sidebar: row badges + hover actions ─────────────────────────────
  'workbench.sidebar.badge.paused': 'paused',
  'workbench.sidebar.badge.draft': 'draft',
  'workbench.sidebar.badge.unresolved': 'unresolved',
  'workbench.sidebar.badge.off': 'off',
  'workbench.sidebar.badge.incomplete': 'incomplete',
  'workbench.sidebar.badge.scratch': 'scratch',
  'workbench.sidebar.badge.scripts': 'scripts',
  'workbench.sidebar.badge.scriptsTooltip':
    'This imported request will execute JavaScript when run. Open it to review the scripts.',
  'workbench.sidebar.badge.dirtyAria': 'unsaved changes',
  'workbench.sidebar.rule.enable': 'Enable rule',
  'workbench.sidebar.rule.disable': 'Disable rule',
  'workbench.sidebar.env.setActive': 'Set active',
  'workbench.sidebar.env.setInactive': 'Set inactive',
  'workbench.sidebar.env.setDefault': 'Set as default',
  'workbench.sidebar.env.unsetDefault': 'Unset default',
  'workbench.sidebar.workflow.bindingsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} var',
      other: '{count} vars',
    }),
  'workbench.sidebar.workflow.bindingsTooltip': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} live variable bound to this workflow',
      other: '{count} live variables bound to this workflow',
    }),

  // ── Sidebar: empty placeholders ─────────────────────────────────────
  'workbench.sidebar.placeholder.folderEmptyTitle': 'Folder is empty',
  'workbench.sidebar.placeholder.collectionEmptyTitle': 'Collection is empty',
  'workbench.sidebar.placeholder.requestsEmptyTitle': 'No requests yet',
  'workbench.sidebar.placeholder.templatesEmptyTitle': 'No templates yet',
  'workbench.sidebar.placeholder.addRuleOrFolder': 'Add a rule or folder to get started.',
  'workbench.sidebar.placeholder.addRequestOrFolder': 'Add a request or folder to get started.',
  'workbench.sidebar.placeholder.templateFolderEmptyMessage': 'Save a rule as template to populate.',
  'workbench.sidebar.placeholder.templatesEmptyMessage': 'Save a rule as template from the editor.',
  'workbench.sidebar.placeholder.addRule': 'Add rule',
  'workbench.sidebar.placeholder.addFolder': 'Add folder',
  'workbench.sidebar.placeholder.addRequest': 'Add request',
  'workbench.sidebar.emptySection': 'No items in this section',
  'workbench.sidebar.emptySectionCreate': 'Create',

  // ── Sidebar: templates view ─────────────────────────────────────────
  'workbench.sidebar.templates.systemGroup': 'System Templates',
  'workbench.sidebar.ruleType.header': 'Header',
  'workbench.sidebar.ruleType.block': 'Block',
  'workbench.sidebar.ruleType.redirect': 'Redirect',
  'workbench.sidebar.ruleType.queryParam': 'Query Param',
  'workbench.sidebar.ruleType.inject': 'Inject',
  'workbench.sidebar.ruleType.delay': 'Delay',
  'workbench.sidebar.ruleType.requestBody': 'API Request Body',
  'workbench.sidebar.ruleType.response': 'API Response',

  // ── Sidebar: variables-view singleton rows ──────────────────────────
  'workbench.sidebar.singleton.vault': 'Vault',
  'workbench.sidebar.singleton.workspaceVariables': 'Workspace Variables',
  'workbench.sidebar.singleton.liveVariables': 'Live Variables',
  'workbench.sidebar.singleton.packageLibrary': 'Package Library',

  // ── Sidebar: default entity names ───────────────────────────────────
  // (New Rules/Requests Collection promoted to `shared.defaults.*` when
  // the save modals became their second converted consumer.)
  'workbench.sidebar.defaults.newFolder': 'New Folder',
  'workbench.sidebar.defaults.newEnvironment': 'New Environment',

  // ── Sidebar: confirm-delete modal + toasts ──────────────────────────
  'workbench.sidebar.confirmDelete.title': 'Delete item?',
  'workbench.sidebar.confirmDelete.bodyPrefix': 'Are you sure you want to delete ',
  'workbench.sidebar.confirmDelete.bodySuffix': '? This action cannot be undone.',
  'workbench.sidebar.confirmDelete.ok': 'Delete',
  'workbench.sidebar.toast.toggleRuleFailed': 'Failed to toggle rule',
  'workbench.sidebar.toast.renameExampleFailed': 'Failed to rename example',
  'workbench.sidebar.toast.duplicateExampleFailed': 'Failed to duplicate example',
  'workbench.sidebar.toast.deleteExampleFailed': 'Failed to delete example',
  'workbench.sidebar.toast.createRequestCollectionFailed': 'Failed to create request collection',
  'workbench.sidebar.toast.createEnvironmentFailed': 'Failed to create environment',

  // ── Sidebar: folder drag-and-drop ───────────────────────────────────
  'workbench.sidebar.dnd.dragToReorderFolder': 'Drag to reorder folder',

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
  'workbench.shell.statusbar.systemStatus': 'System status',

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
  'workbench.shell.envSelector.openEnv': 'Open {name}',
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
  'workbench.shell.breadcrumbs.daemonAdmin': 'Daemon admin',
  'workbench.shell.breadcrumbs.environments': 'Environments',
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

  // ── Workspace: manager page ─────────────────────────────────────────
  'workbench.workspace.title': 'Workspaces',
  'workbench.workspace.newWorkspace': 'New workspace',
  'workbench.workspace.intro':
    'Each workspace holds its own rules, collections, folders, templates, variables, and test run history. ' +
    'Drag to reorder.',
  'workbench.workspace.deleteTitle': 'Delete "{name}"?',
  'workbench.workspace.deleteBody':
    'This permanently deletes the workspace and all its rules, collections, folders, templates, variables, and ' +
    'test run history. This action cannot be undone.',
  'workbench.workspace.deleteOk': 'Delete',
  'workbench.workspace.deleteFailed': 'Failed to delete workspace',
  'workbench.workspace.deletedToast': 'Deleted "{name}"',
  'workbench.workspace.createOk': 'Create',
  'workbench.workspace.createFailed': 'Failed to create workspace',
  'workbench.workspace.createdToastPrefix': 'Created workspace',
  'workbench.workspace.duplicateTitle': 'Duplicate "{name}"',
  'workbench.workspace.duplicateTitleFallback': 'Duplicate workspace',
  'workbench.workspace.duplicateOk': 'Duplicate',
  'workbench.workspace.duplicateFailed': 'Failed to duplicate workspace',
  'workbench.workspace.duplicatedToast': 'Duplicated "{source}" → "{name}"',
  'workbench.workspace.publishFailed': 'Failed to publish workspace',
  'workbench.workspace.publishedToast': 'Published "{name}" to {org}',
  'workbench.workspace.selectedOrgFallback': 'the selected Org',
  'workbench.workspace.editTitle': 'Edit workspace',
  'workbench.workspace.saveOk': 'Save',
  'workbench.workspace.updatedToast': 'Updated "{name}"',
  'workbench.workspace.deletedElsewhere': 'This workspace was deleted from another tab',
  'workbench.workspace.updateFailed': 'Failed to update workspace',
  'workbench.workspace.updateFailedWithMessage': 'Failed to update workspace: {message}',
  'workbench.workspace.newWorkspacesGoTo': 'New workspaces go to',
  'workbench.workspace.orgPrefHint': 'Change it anytime — existing workspaces stay where they are.',
  'workbench.workspace.otherWorkspaces': 'Other workspaces',
  'workbench.workspace.dragToReorder': 'Drag to reorder',
  'workbench.workspace.activePill': 'Active',
  'workbench.workspace.switch': 'Switch',
  'workbench.workspace.renameAria': 'Rename workspace',
  'workbench.workspace.duplicateAria': 'Duplicate workspace',
  'workbench.workspace.publishAria': 'Publish workspace to a back-end',
  'workbench.workspace.deleteAria': 'Delete workspace',
  'workbench.workspace.prefixLabel': 'Prefix',
  'workbench.workspace.nameLabel': 'Name',
  'workbench.workspace.nameRequired': 'Name is required',
  'workbench.workspace.nameTooLong': 'Keep names under 60 characters',
  'workbench.workspace.namePlaceholder': 'My Workspace',
  'workbench.workspace.descriptionLabel': 'Description (optional)',
  'workbench.workspace.copyOfName': 'Copy of {name}',
  'workbench.workspace.copyOfPlaceholder': 'Copy of …',
  'workbench.workspace.intoOrg': 'Into Org',
  'workbench.workspace.includeSecrets': 'Include vault contents (secrets)',
  'workbench.workspace.includeSecretsHint':
    'Re-enter secrets in the copy if needed. OAuth connections are re-authorized either way.',

  // ── Workspace: switcher ─────────────────────────────────────────────
  'workbench.workspace.makeActiveTitle': 'Make "{name}" the active workspace?',
  'workbench.workspace.makeActiveBody':
    "The popup, side-panel, and any new {units} that aren't pinned to a specific workspace will switch " +
    'to "{name}".',
  'workbench.workspace.makeActiveOk': 'Make active',
  'workbench.workspace.cancel': 'Cancel',
  'workbench.workspace.nowActiveToast': '"{name}" is now the active workspace',
  'workbench.workspace.switcherAria': 'This {unit} is editing workspace: {name}. Click to switch.',

  // ── Workspace: publish modal ────────────────────────────────────────
  'workbench.workspace.publishTitle': 'Publish "{name}"',
  'workbench.workspace.publishTitleFallback': 'Publish workspace',
  'workbench.workspace.publishToOk': 'Publish to {org}',
  'workbench.workspace.publishOk': 'Publish',
  'workbench.workspace.publishIntro':
    'Publishing copies this workspace into the chosen Org, where it syncs through that back-end. The original ' +
    'stays here.',
  'workbench.workspace.toOrg': 'To Org',
  'workbench.workspace.pickTargetOrg': 'Pick a target Org',
  'workbench.workspace.includeSecretsPublishHint':
    'Re-enter secrets in the published copy if needed. OAuth connections are re-authorized either way.',

  // ── Workspace: home-Org identity card ───────────────────────────────
  'workbench.workspace.org.logoButton': 'Logo',
  'workbench.workspace.org.logoAria': "Change this organization's logo",
  'workbench.workspace.org.renameButton': 'Rename',
  'workbench.workspace.org.renameAria': 'Rename this organization',
  'workbench.workspace.org.renameTitle': 'Rename {hint}',
  'workbench.workspace.org.renameTitleFallback': 'Rename',
  'workbench.workspace.org.nameUpdated': 'Name updated',
  'workbench.workspace.org.identityLoading': 'Identity is still loading — try again in a moment',
  'workbench.workspace.org.renameExtra': 'Shown in the workspace switcher and to anyone you share workspaces with.',
  'workbench.workspace.org.nameTooLong': 'Keep names under {max} characters',
  'workbench.workspace.org.namePlaceholder': 'My Work Laptop',
  'workbench.workspace.org.logoTitle': '{hint} logo',
  'workbench.workspace.org.logoTitleFallback': 'Organization logo',
  'workbench.workspace.org.logoAlt': 'Current organization logo',
  'workbench.workspace.org.replace': 'Replace…',
  'workbench.workspace.org.upload': 'Upload…',
  'workbench.workspace.org.remove': 'Remove',
  'workbench.workspace.org.logoUpdated': 'Logo updated',
  'workbench.workspace.org.logoRemoved': 'Logo removed',
  'workbench.workspace.org.fileReadFailed': 'That file could not be read.',
  'workbench.workspace.org.logoHint':
    'PNG, JPEG, WebP, or SVG, up to {kb} KB. Square images look best. Shown to everyone who syncs with this ' +
    'organization.',
  'workbench.workspace.org.logoReject.notImage': 'That file could not be read as an image.',
  'workbench.workspace.org.logoReject.corruptImage': 'That file is not a valid image of its declared type.',
  'workbench.workspace.org.logoReject.unsupportedFormat': 'Use a PNG, JPEG, WebP, or SVG file.',
  'workbench.workspace.org.logoReject.tooLarge': 'Keep the logo under {kb} KB.',
  'workbench.workspace.org.logoReject.unsafeSvg':
    'This SVG contains scripts or external references — export a plain, self-contained SVG.',

  // ── Workspace: grant arrival + zero-grant banner ────────────────────
  'workbench.workspace.grant.arrivedActiveTitle': 'You now have access to a workspace',
  'workbench.workspace.grant.arrivedTitle': 'A workspace is now available',
  'workbench.workspace.grant.open': 'Open workspace',
  'workbench.workspace.grant.notifTitleActive': 'You now have access to "{name}"',
  'workbench.workspace.grant.notifTitle': 'Workspace "{name}" is now available',
  'workbench.workspace.grant.notifBodyActive': "An admin granted you access — you're working in it now.",
  'workbench.workspace.grant.notifBody': 'An admin granted you access — it appears in the workspace switcher.',
  'workbench.workspace.grant.orgFallback': 'your organization',
  'workbench.workspace.grant.zeroBanner':
    "Connected to {orgs} — no workspaces granted to you yet. You're working in a local workspace; granted " +
    'workspaces appear here automatically once an admin gives you access.',

  // ── Workspace: identity picker ──────────────────────────────────────
  'workbench.workspace.picker.colorAria': 'Color {name}',
  'workbench.workspace.picker.searchIcons': 'Search icons...',
  'workbench.workspace.picker.noIconTooltip': 'No icon — show color square only',
  'workbench.workspace.picker.noIconAria': 'No icon',
  'workbench.workspace.picker.triggerAria': 'Choose workspace prefix (color or icon)',

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
  'workbench.toolWindows.deepNetworkInspection': 'Deep Network Inspection',

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
  'workbench.toolWindows.info.deepNetworkInspection.summary':
    'Connection-level (L4) and HTTP (L7) inspection in one view — TCP/TLS health like RTT, retransmissions, ' +
    'and handshake timing alongside full request/response visibility, modification, and replay.',
  'workbench.toolWindows.info.workflowStatus.summary':
    'Per-workflow circuit-breaker dashboard — state, consecutive failures, openings, and next-attempt ' +
    'countdown, with manual Retry and Reset-circuit actions.',
  'workbench.toolWindows.info.activity.summary':
    'Workspace-wide feed of inbound changes from peers, with classifier highlights for sensitive-field ' +
    'rotations, permission-scope expansions, and local-edit supersedes.',
} as const satisfies Catalog;
