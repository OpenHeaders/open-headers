/**
 * Workbench chrome station (Phase C) — the sidebar (section headers,
 * tree-node hooks, container menus, placeholders, create actions,
 * confirm-delete modal) and the tab strip (tab context menu, create
 * menu, tab search overlay, pill arias). Namespaces:
 * `workbench.sidebar.*`, `workbench.tabbar.*`, plus the surface-neutral
 * `workbench.scratch.*` labels shared by the tab tooltip and the
 * breadcrumb bar.
 *
 * Technical plane stays raw: HTTP method tags (GET/POST…), entity
 * names, key glyphs (the ✓ checkmark composes in JSX ahead of the
 * keyed behavior labels), and the 'User Templates' default collection
 * name (identity-compared against the background seed — localizing it
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
  'workbench.sidebar.defaults.newFolder': 'New Folder',
  'workbench.sidebar.defaults.newRulesCollection': 'New Rules Collection',
  'workbench.sidebar.defaults.newRequestsCollection': 'New Requests Collection',
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
} as const satisfies Catalog;
