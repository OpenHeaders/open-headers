/**
 * Workbench editors — shared editor chrome: the script editor,
 * response examples, grid decoders, ancestor script/auth banners, and
 * section info. The per-editor families live in the sibling
 * `workbench-editors-*.ts` files (request / rule / grpc / spec); all
 * merge under `workbench.editors.*` in `index.ts`.
 */

import type { Catalog } from '../../types';

export const workbenchEditors = {
  'workbench.editors.sectionInfo.moreInformation': 'More information',

  // ── Session chrome (shared: WS/MQTT session panes) ─────────────────
  'workbench.editors.session.connectionDetails': 'Connection details',
  'workbench.editors.session.subprotocol': 'Subprotocol',
  'workbench.editors.session.extensions': 'Extensions',
  'workbench.editors.session.closeCode': 'Close code',

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': 'Key',
  'workbench.editors.grid.value': 'Value',
  'workbench.editors.grid.description': 'Description',
  'workbench.editors.grid.showColumns': 'Show columns',
  'workbench.editors.grid.tableOptions': 'Table options',
  'workbench.editors.grid.bulk': 'Bulk',
  'workbench.editors.grid.keyValue': 'Key-Value',
  'workbench.editors.grid.selectAllAria': 'Enable or disable all rows',
  'workbench.editors.grid.selectAllTitle': 'Enable / disable all',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': 'Resize {column} column',
  'workbench.editors.grid.overriddenBy': 'Duplicate — overridden by the {header} row you added.',
  'workbench.editors.grid.suggestionValueAria': '{key} value',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.notFoundCollection': 'Request collection not found.',
  'workbench.editors.ancestorScripts.notFoundFolder': 'Folder not found.',
  'workbench.editors.ancestorScripts.saveFailed': 'Could not save scripts.',
  'workbench.editors.ancestorScripts.saveFailedDetail': 'Could not save scripts: {message}',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.notFoundCollection': 'Request collection not found.',
  'workbench.editors.ancestorAuth.notFoundFolder': 'Folder not found.',
  'workbench.editors.ancestorAuth.saveFailed': 'Could not save authorization.',
  'workbench.editors.ancestorAuth.saveFailedDetail': 'Could not save authorization: {message}',

  // ── Request container editor (a collection / folder: one tab, sections) ──
  'workbench.editors.requestContainer.tab.overview': 'Overview',
  'workbench.editors.requestContainer.auth.emptyTitle': 'No auth configured',
  'workbench.editors.requestContainer.auth.emptySubtitleCollection':
    'Select an authorization type for requests in this collection',
  'workbench.editors.requestContainer.auth.emptySubtitleFolder':
    'Select an authorization type for requests in this folder',
  'workbench.editors.requestContainer.auth.authTypes': 'Auth types',
  'workbench.editors.requestContainer.auth.addEntryAria': 'Add auth type',
  'workbench.editors.requestContainer.auth.change': 'Change',
  'workbench.editors.requestContainer.auth.changeHint': 'Override the inherited auth configuration from {source}.',
  'workbench.editors.requestContainer.auth.inheritedTag': 'Inherited',
  'workbench.editors.requestContainer.auth.rename': 'Rename',
  'workbench.editors.requestContainer.auth.noneEntryNote': 'Requests using this entry send without authorization.',
  'workbench.editors.requestContainer.auth.defaultTag': 'Default',
  'workbench.editors.requestContainer.auth.setDefault': 'Make default',
  'workbench.editors.requestContainer.auth.deleteEntry': 'Delete',
  'workbench.editors.requestContainer.auth.entryActionsAria': 'Entry actions',
  'workbench.editors.requestContainer.auth.appliesTo': 'Apply to host',
  'workbench.editors.requestContainer.auth.appliesToPlaceholder': '*.openheaders.com',
  'workbench.editors.requestContainer.auth.appliesToHelp':
    'Optional host pattern (* wildcard). A request set to Inherit whose URL host matches gets this entry ahead of the default. Empty \u2014 reached only as the default or by a request\u2019s pick.',
  'workbench.editors.requestContainer.auth.resetToInherited': 'Reset to inherited',
  'workbench.editors.requestContainer.auth.resetConfirm':
    'Remove the folder\u2019s entries? Requests fall through to the collection.',
  'workbench.editors.requestContainer.deletedElsewhere': 'This item was deleted in another window.',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': 'Loading example…',
  'workbench.editors.responseExample.notFound': 'Example not found.',
  'workbench.editors.responseExample.toast.deletedOtherTab': 'Example was deleted from another tab',
  'workbench.editors.responseExample.toast.saveFailed': 'Failed to save example',
  'workbench.editors.responseExample.toast.saveFailedDetail': 'Failed to save example: {message}',
  'workbench.editors.responseExample.openAsRequest': 'Open as Request',
  'workbench.editors.responseExample.openAsRequestTooltip':
    "Creates a new request draft seeded from this example's request",
  'workbench.editors.responseExample.editStatus': 'Edit status code',
  'workbench.editors.responseExample.statusPlaceholder': 'Enter response code',
  'workbench.editors.responseExample.capturedTooltip': 'Captured {date}',
  'workbench.editors.responseExample.moreActionsAria': 'More response actions',
  'workbench.editors.responseExample.tab.body': 'Body',
  'workbench.editors.responseExample.tab.headers': 'Headers ({count})',
  'workbench.editors.responseExample.bodyLanguageAria': 'Body language',
  'workbench.editors.responseExample.format': 'Format',
  'workbench.editors.responseExample.formatBody': 'Format body',
  'workbench.editors.responseExample.noFormatter': 'No formatter for {language}',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': 'Snippets',
  'workbench.editors.scriptEditor.packages': 'Packages',
  'workbench.editors.scriptEditor.searchSnippets': 'Search snippets',
  'workbench.editors.scriptEditor.searchPackages': 'Search packages',
  'workbench.editors.scriptEditor.noSnippetFound': 'No snippet found',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': 'No packages in this workspace yet',
  'workbench.editors.scriptEditor.noPackageFound': 'No package found',
  'workbench.editors.scriptEditor.openPackageLibrary': 'Open Package Library →',
  'workbench.editors.scriptEditor.saveToPackage': 'Save to Package Library',
  'workbench.editors.scriptEditor.newPackage': 'New Package',
  'workbench.editors.scriptEditor.newPackageName': 'New package name',
  'workbench.editors.scriptEditor.back': 'Back',
  'workbench.editors.scriptEditor.create': 'Create',
  'workbench.editors.scriptEditor.orAppend': 'Or append to an existing package:',
  'workbench.editors.scriptEditor.noPackagesYet': 'No packages yet',
  'workbench.editors.scriptEditor.savedTo': 'Saved to “{name}”',
  'workbench.editors.scriptEditor.packageCreated': 'Package “{name}” created',
  'workbench.editors.scriptEditor.duplicatePackage': 'A package named “{name}” already exists in this workspace.',
  'workbench.editors.scriptEditor.packageNotFound': 'Package not found — it may have been deleted.',
  'workbench.editors.scriptEditor.saveFailed': 'Save failed',
  'workbench.editors.scriptEditor.menuFind': 'Find',
  'workbench.editors.scriptEditor.find': 'Find',
  'workbench.editors.scriptEditor.replace': 'Replace',
  'workbench.editors.scriptEditor.beautify': 'Beautify',
  'workbench.editors.scriptEditor.group.request': 'Request',
  'workbench.editors.scriptEditor.group.workflows': 'Workflows',
  'workbench.editors.scriptEditor.group.packages': 'Packages',
  'workbench.editors.scriptEditor.group.variables': 'Variables',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.snippet.sendRequest': 'Send an HTTP request',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': 'Send an HTTP request with a JSON body',
  'workbench.editors.scriptEditor.snippet.getVariable': 'Get a variable',
  'workbench.editors.scriptEditor.snippet.setVariable': 'Set a variable',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': 'Get a vault secret',
  'workbench.editors.scriptEditor.snippet.usePackage': 'Use a package',
  'workbench.editors.scriptEditor.snippet.setHeader': 'Set a header',
  'workbench.editors.scriptEditor.snippet.removeHeader': 'Remove a header',
  'workbench.editors.scriptEditor.snippet.setQueryParam': 'Set a query parameter',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': 'Remove a query parameter',
  'workbench.editors.scriptEditor.snippet.setUrl': 'Set the URL',
  'workbench.editors.scriptEditor.snippet.setMethod': 'Set the method',
  'workbench.editors.scriptEditor.snippet.setJsonBody': 'Set a JSON body',
  'workbench.editors.scriptEditor.snippet.statusCode200': 'Status code is 200',
  'workbench.editors.scriptEditor.snippet.bodyContains': 'Response body contains a string',
  'workbench.editors.scriptEditor.snippet.bodyEquals': 'Response body equals a string',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': 'Response body JSON value check',
  'workbench.editors.scriptEditor.snippet.headerCheck': 'Response header check',
  'workbench.editors.scriptEditor.snippet.responseTime': 'Response time is below 200 ms',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': 'Save a response value to a variable',
  'workbench.editors.scriptEditor.group.connect': 'Connect',
  'workbench.editors.scriptEditor.group.send': 'Send',
  'workbench.editors.scriptEditor.group.message': 'Message',
  'workbench.editors.scriptEditor.snippet.wsSetSubprotocols': 'Set the subprotocol offer',
  'workbench.editors.scriptEditor.snippet.wsReconnectAttempt': 'Resume on a reconnect attempt',
  'workbench.editors.scriptEditor.snippet.wsSetMessage': 'Rewrite the outgoing message',
  'workbench.editors.scriptEditor.snippet.wsDropMessage': 'Drop the outgoing message',
  'workbench.editors.scriptEditor.snippet.wsSetEvent': 'Rename the Socket.IO event',
  'workbench.editors.scriptEditor.snippet.wsReply': 'Reply to a message',
  'workbench.editors.scriptEditor.snippet.wsCountMessages': 'Count messages across the session',
  'workbench.editors.scriptEditor.snippet.wsEmitEvent': 'Emit a Socket.IO event',
  'workbench.editors.scriptEditor.snippet.wsAssertJson': 'Message is JSON',
  'workbench.editors.scriptEditor.snippet.wsSaveMessageValue': 'Save a message value to a variable',
  'workbench.editors.scriptEditor.snippet.wsClosedClean': 'Session closed cleanly',
  'workbench.editors.scriptEditor.snippet.wsMessageCount': 'Messages arrived',
} as const satisfies Catalog;
