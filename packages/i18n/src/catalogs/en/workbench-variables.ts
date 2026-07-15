/**
 * Workbench variables station (Phase C) — the five sibling variables
 * pages (Workspace / Environment / Collection / Vault / Live Variables)
 * plus their shared spreadsheet editor (`VariableTable` +
 * `VariableTableRow`) and the TOTP live preview (`workbench.totpPreview.*`
 * — a workbench-pane-shared component: mounted by the vault table rows
 * AND the variables panel).
 *
 * Namespaces: page copy under `workbench.variables.<page>.*`, the shared
 * table chrome under `workbench.variables.table.*`, the live-variables
 * list page under `workbench.variables.live.*`.
 *
 * Technical plane stays raw inside keyed sentences: `{{live.NAME}}`
 * reference syntax, TOTP algorithm names (SHA1/SHA256/SHA512), PEM /
 * Base32 / TOTP spec vocabulary (glossary duty), masking bullets,
 * variable/workflow names ({name}), server error text ({message}).
 * The conflict-adapter labels (prettyPath / rowLabel / summary) render
 * only through the deferred shared-conflicts family and convert with it.
 */

import type { Catalog } from '../../types';

export const workbenchVariables = {
  // ── Shared table chrome (VariableTable + VariableTableRow) ─────────
  'workbench.variables.table.headerVariable': 'Variable',
  'workbench.variables.table.headerSecret': 'Secret',
  'workbench.variables.table.headerValue': 'Value',
  'workbench.variables.table.namePlaceholder': 'Name',
  'workbench.variables.table.valuePlaceholder': 'Value',
  'workbench.variables.table.addVariable': 'Add variable…',
  'workbench.variables.table.addSecret': 'Add secret…',
  'workbench.variables.table.enableRow': 'Enable variable',
  'workbench.variables.table.disableRow': 'Disable variable',
  'workbench.variables.table.markSensitive': 'Mark as sensitive',
  'workbench.variables.table.unmarkSensitive': 'Unmark as sensitive',
  'workbench.variables.table.showValue': 'Show value',
  'workbench.variables.table.hideValue': 'Hide value',
  'workbench.variables.table.kindText': 'Text',
  'workbench.variables.table.kindTotp': 'TOTP',
  'workbench.variables.table.kindCertificate': 'Certificate',
  'workbench.variables.table.certPlaceholder': 'Certificate (PEM)',
  'workbench.variables.table.certKeyPlaceholder': 'Private key (PEM)',
  'workbench.variables.table.passphrasePlaceholder': 'Key passphrase (optional)',
  'workbench.variables.table.showCertificate': 'Show certificate',
  'workbench.variables.table.hideCertificate': 'Hide certificate',
  'workbench.variables.table.seedPlaceholder': 'Base32 seed',
  'workbench.variables.table.showSeed': 'Show seed',
  'workbench.variables.table.hideSeed': 'Hide seed',
  'workbench.variables.table.totpSummary': '{algorithm} · {digits} digits · {period}s',
  'workbench.variables.table.totpSummaryIssuer': '{algorithm} · {digits} digits · {period}s · {issuer}',
  'workbench.variables.table.issuerPlaceholder': 'Issuer',

  // ── Shared page chrome ──────────────────────────────────────────────
  'workbench.variables.variablesCount': 'VARIABLES ({count})',

  // ── Workspace variables page ────────────────────────────────────────
  'workbench.variables.workspace.title': 'Workspace Variables',
  'workbench.variables.workspace.description':
    'Shared across every environment in this workspace. Lowest priority — overridden by collection, environment, and vault scopes.',
  'workbench.variables.workspace.saveFailed': 'Failed to save workspace variables',
  'workbench.variables.workspace.saveFailedDetail': 'Failed to save workspace variables: {message}',

  // ── Environment page ────────────────────────────────────────────────
  'workbench.variables.environment.notFound': 'Environment not found.',
  'workbench.variables.environment.activeTag': 'Active',
  'workbench.variables.environment.defaultTag': 'Default',
  'workbench.variables.environment.defaultTooltip':
    'Resolver falls back here when the active env is missing a variable.',
  'workbench.variables.environment.setActive': 'Set active',
  'workbench.variables.environment.setDefault': 'Set as default',
  'workbench.variables.environment.unsetDefault': 'Unset default',
  'workbench.variables.environment.setDefaultTooltip':
    'Set as default — resolver falls back here when the active env is missing a variable.',
  'workbench.variables.environment.unsetDefaultTooltip':
    'Unset as default — resolver will stop falling back to this env.',
  'workbench.variables.environment.deletedElsewhere': 'Environment was deleted from another tab',
  'workbench.variables.environment.updateFailed': 'Failed to update environment',
  'workbench.variables.environment.updateFailedDetail': 'Failed to update environment: {message}',

  // ── Collection variables page ───────────────────────────────────────
  'workbench.variables.collection.notFound': 'Collection not found.',
  'workbench.variables.collection.title': '{name} · Variables',
  'workbench.variables.collection.descriptionRule':
    'Variables available to every rule inside this collection. Overridden by environment and vault scopes; overrides the workspace scope. Stored in plain text — use the Vault for secrets.',
  'workbench.variables.collection.descriptionRequest':
    'Variables available to every request inside this collection. Overridden by environment and vault scopes; overrides the workspace scope. Stored in plain text — use the Vault for secrets.',
  'workbench.variables.collection.descriptionTemplate':
    'Variables available to every template inside this collection. Overridden by environment and vault scopes; overrides the workspace scope. Stored in plain text — use the Vault for secrets.',
  'workbench.variables.collection.deletedElsewhere': 'Collection was deleted from another tab',
  'workbench.variables.collection.saveFailed': 'Failed to save collection variables',
  'workbench.variables.collection.saveFailedDetail': 'Failed to save collection variables: {message}',

  // ── Vault page ──────────────────────────────────────────────────────
  'workbench.variables.vault.title': 'Vault',
  'workbench.variables.vault.infoBanner':
    'Vault secrets are encrypted at rest, never leave this device, and take priority over every other scope.',
  'workbench.variables.vault.cipherLocked':
    'Secrets storage is locked — the system denied access to its keychain, so vault secrets cannot be read or saved this session.',
  'workbench.variables.vault.cipherLockedRelaunch': 'Relaunch app',
  'workbench.variables.vault.lockedTitle': 'Vault locked — at-rest key lost',
  'workbench.variables.vault.lockedDescription':
    "This vault's secrets are still stored on this device but can no longer be decrypted: the at-rest key that sealed them is gone (cleared browser data, a new profile, or a reset extension key). Editing is disabled so a new entry can't overwrite the sealed data. Re-enter the secrets to unlock the vault — the existing entries will be replaced.",
  'workbench.variables.vault.secretsCount': 'SECRETS ({strings} string · {totps} TOTP · {certs} certificate)',
  'workbench.variables.vault.saveFailed': 'Failed to save vault',
  'workbench.variables.vault.saveFailedDetail': 'Failed to save vault: {message}',

  // ── Live variables list page ────────────────────────────────────────
  'workbench.variables.live.title': 'Live Variables',
  'workbench.variables.live.newVariable': 'New live variable',
  'workbench.variables.live.descriptionPrefix':
    'Each binding maps a name to a capture from a Workflow (a scheduled request chain). Referenced in rules and requests as',
  'workbench.variables.live.descriptionSuffix': '.',
  'workbench.variables.live.headerName': 'Name',
  'workbench.variables.live.headerValue': 'Value',
  'workbench.variables.live.headerWorkflow': 'Workflow',
  'workbench.variables.live.empty': "No live variables yet. Create one to bind a name to a workflow's captured value.",
  'workbench.variables.live.draftMarker': 'draft',
  'workbench.variables.live.offMarker': 'off',
  'workbench.variables.live.overrideMarker': 'override',
  'workbench.variables.live.clickEyeToReveal': 'Click eye to reveal',
  'workbench.variables.live.showValue': 'Show value',
  'workbench.variables.live.hideValue': 'Hide value',
  'workbench.variables.live.notCapturedYet': 'not captured yet',
  'workbench.variables.live.missingWorkflow': 'missing workflow',
  'workbench.variables.live.refreshNow': 'Refresh workflow now',
  'workbench.variables.live.refreshAria': 'Refresh {name}',
  'workbench.variables.live.editBinding': 'Edit binding (name / enabled / override)',
  'workbench.variables.live.editAria': 'Edit {name}',
  'workbench.variables.live.delete': 'Delete',
  'workbench.variables.live.deleteAria': 'Delete {name}',
  'workbench.variables.live.deleteFailed': 'Failed to delete "{name}"',

  // ── TOTP preview (workbench-pane-shared component) ─────────────────
  'workbench.totpPreview.copyCode': 'Copy code',
  'workbench.totpPreview.copied': 'Copied',
  'workbench.totpPreview.refreshesTooltip': 'Refreshes in {seconds}s',
  'workbench.totpPreview.refreshesAria': 'TOTP code refreshes in {seconds} seconds',
} as const satisfies Catalog;
