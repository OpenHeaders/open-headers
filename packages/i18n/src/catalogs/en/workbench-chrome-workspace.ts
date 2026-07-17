/**
 * Workbench chrome — the workspace plane: workspace switcher, create/
 * rename/delete flows, and workspace-level chrome. Workspace and org
 * names ride raw inside keyed values.
 */

import type { Catalog } from '../../types';

export const workbenchChromeWorkspace = {
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
} as const satisfies Catalog;
