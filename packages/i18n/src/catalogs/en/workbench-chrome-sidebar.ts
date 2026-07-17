/**
 * Workbench chrome — the navigator plane: sidebar tree chrome, the
 * overview/home surface, the activity feed, and the collection
 * picker. Entity names, collection names, and counts ride raw inside
 * keyed values.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchChromeSidebar = {
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
  'workbench.sidebar.section.specs': 'SPECS',

  // ── Sidebar: per-view header title ──────────────────────────────────
  'workbench.sidebar.view.httpRules': 'HTTP Rules',
  'workbench.sidebar.view.apiRequests': 'API Requests',
  'workbench.sidebar.view.workflows': 'Workflows',
  'workbench.sidebar.view.variables': 'Variables',

  // ── Sidebar: header action cluster ──────────────────────────────────
  'workbench.sidebar.header.newRule': 'New rule',
  'workbench.sidebar.header.addRequest': 'Add request',
  'workbench.sidebar.header.createNewEnvironment': 'Create new environment',
  'workbench.sidebar.header.createNewSpec': 'Create new specification',
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
  'workbench.sidebar.menu.addGrpcRequest': 'Add gRPC Request',
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
  'workbench.sidebar.badge.specDrift': 'changed',
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
  // the save modals became their second converted consumer; New
  // Environment followed when App's env-selector create flow converted.)
  'workbench.sidebar.defaults.newFolder': 'New Folder',

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
  'workbench.sidebar.toast.createSpecFailed': 'Failed to create specification',
  'workbench.sidebar.toast.renameSpecFailed': 'Failed to rename specification',
  'workbench.sidebar.toast.deleteSpecFailed': 'Failed to delete specification',

  // ── Sidebar: folder drag-and-drop ───────────────────────────────────
  'workbench.sidebar.dnd.dragToReorderFolder': 'Drag to reorder folder',

  // ── Activity feed panel + cards ─────────────────────────────────────
  'workbench.activityFeed.reverted': 'Change reverted',
  'workbench.activityFeed.revertFailed': 'Revert failed: {reason}',
  'workbench.activityFeed.emptyTitle': 'No activity yet',
  'workbench.activityFeed.emptyHint': 'Inbound changes from peers will appear here.',
  'workbench.activityFeed.view': 'View',
  'workbench.activityFeed.mute': 'Mute',
  'workbench.activityFeed.unmute': 'Unmute',
  'workbench.activityFeed.muteTip': 'Suppress further inbound activity rows for this entity. Past rows are kept.',
  'workbench.activityFeed.unmuteTip': 'Stop suppressing inbound activity for this entity.',
  'workbench.activityFeed.revert': 'Revert',
  'workbench.activityFeed.revertTip':
    'Apply the inverse of this change. Emits a new mutation that brings the entity back to its pre-inbound state.',
  'workbench.activityFeed.revertUnavailableDelete': 'Deletes are permanent and cannot be reverted (§7.2 delete-wins).',
  'workbench.activityFeed.revertUnavailable': 'This change cannot be reverted.',
  'workbench.activityFeed.kind.created': 'Created',
  'workbench.activityFeed.kind.createdTip': 'New entity arrived from a peer.',
  'workbench.activityFeed.kind.edited': 'Edited',
  'workbench.activityFeed.kind.editedTip': 'A peer edited fields on this entity.',
  'workbench.activityFeed.kind.deleted': 'Deleted',
  'workbench.activityFeed.kind.deletedTip': 'A peer deleted this entity.',
  'workbench.activityFeed.kind.superseded': 'Overrode local edit',
  'workbench.activityFeed.kind.supersededTip': 'An inbound mutation overrode your in-flight local edit.',
  'workbench.activityFeed.kind.sensitiveRotation': 'Sensitive field rotated',
  'workbench.activityFeed.kind.sensitiveRotationTip':
    'A sensitive field (secret / token / sensitive header) was replaced.',
  'workbench.activityFeed.kind.scopeWidened': 'Scope widened',
  'workbench.activityFeed.kind.scopeWidenedTip':
    'A rule condition was loosened — the rule now matches a wider URL/method set.',

  // ── Overview tabs (collection / folder, all three families). The
  // folder-suffix chunks carry their leading '· ' — the JSX supplies
  // only the separating space. ────────────────────────────────────────
  'workbench.overview.stats.rules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} rule',
      other: '{count} rules',
    }),
  'workbench.overview.stats.requests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} request',
      other: '{count} requests',
    }),
  'workbench.overview.stats.templates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} template',
      other: '{count} templates',
    }),
  'workbench.overview.stats.foldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} folder',
      other: '· {count} folders',
    }),
  'workbench.overview.stats.subfoldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} subfolder',
      other: '· {count} subfolders',
    }),
  'workbench.overview.stats.activeTag': '{count} active',
  'workbench.overview.stats.disabledTag': '{count} disabled',
  'workbench.overview.stats.draftTag': '{count} draft',
  'workbench.overview.stats.pausedTag': 'Paused',
  'workbench.overview.cell.folderRules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Folder · {count} rule',
      other: 'Folder · {count} rules',
    }),
  'workbench.overview.cell.folderRequests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Folder · {count} request',
      other: 'Folder · {count} requests',
    }),
  'workbench.overview.cell.folderTemplates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Folder · {count} template',
      other: 'Folder · {count} templates',
    }),
  'workbench.overview.status.draft': 'Draft',
  'workbench.overview.status.incomplete': 'Incomplete',
  'workbench.overview.status.disabled': 'Disabled',
  'workbench.overview.status.paused': 'Paused',
  'workbench.overview.status.active': 'Active',
  'workbench.overview.action.addRule': 'Add Rule',
  'workbench.overview.action.addRequest': 'Add Request',
  'workbench.overview.action.pause': 'Pause',
  'workbench.overview.action.resume': 'Resume',
  'workbench.overview.action.pauseCollectionTooltip': 'Pause all rules in this collection',
  'workbench.overview.action.resumeCollectionTooltip': 'Resume all rules in this collection',
  'workbench.overview.action.pauseFolderTooltip': 'Pause all rules in this folder',
  'workbench.overview.action.resumeFolderTooltip': 'Resume all rules in this folder',
  'workbench.overview.action.variables': 'Variables',
  'workbench.overview.action.variablesTooltip': 'Edit variables scoped to this collection',
  'workbench.overview.action.variablesTooltipRequest': 'Edit variables scoped to this request collection',
  'workbench.overview.action.variablesTooltipTemplate': 'Edit variables scoped to this template collection',
  'workbench.overview.action.scripts': 'Scripts',
  'workbench.overview.action.scriptsTooltipCollection': 'Edit scripts that run for every request in this collection',
  'workbench.overview.action.scriptsTooltipFolder': 'Edit scripts that run for every request in this folder',
  'workbench.overview.action.auth': 'Authorization',
  'workbench.overview.action.authTooltipCollection':
    'Set the default authorization inherited by every request in this collection',
  'workbench.overview.action.authTooltipFolder':
    'Set the default authorization inherited by every request in this folder',
  'workbench.overview.caption.description': 'Description',
  'workbench.overview.caption.contents': 'Contents',
  'workbench.overview.empty.collectionNotFound': 'Collection not found',
  'workbench.overview.empty.folderNotFound': 'Folder not found',
  'workbench.overview.empty.requestCollectionNotFound': 'Request collection not found',
  'workbench.overview.empty.templateCollectionNotFound': 'Template collection not found',
  'workbench.overview.empty.noItems': 'No items yet',
  'workbench.overview.empty.noRequests': 'No requests yet',
  'workbench.overview.empty.templatesCollection':
    'No templates in this collection. Save a rule as a template to populate this collection.',
  'workbench.overview.empty.templatesFolder':
    'No templates yet — save a rule as a template from the rule editor to populate this folder.',

  // ── Collection picker panel (import flows) ──────────────────────────
  'workbench.collectionPicker.searchPlaceholder': 'Search for collection',
  'workbench.collectionPicker.empty': 'No collections yet — one is created for you on import.',
  'workbench.collectionPicker.noMatch': 'No matching collections.',
  'workbench.collectionPicker.newCollection': 'New collection',
} as const satisfies Catalog;
