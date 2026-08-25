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
  'workbench.workspace.leaveTitle': 'Leave "{name}"?',
  'workbench.workspace.leaveBody':
    'You give up your own access to this workspace — it disappears from all your open tabs. Everyone else keeps ' +
    'theirs, and an admin can grant it to you again.',
  'workbench.workspace.leaveOk': 'Leave',
  'workbench.workspace.leaveFailed': 'Failed to leave workspace',
  'workbench.workspace.leftToast': 'Left "{name}"',
  'workbench.workspace.leaveAria': 'Leave workspace',
  'workbench.workspace.members.title': 'Members of "{name}"',
  'workbench.workspace.members.openAria': 'Manage members',
  'workbench.workspace.members.loadFailed': 'Failed to load members',
  'workbench.workspace.members.updateFailed': 'Failed to update members',
  'workbench.workspace.members.operatorTag': 'Server operator',
  'workbench.workspace.members.managedTag': 'Managed',
  'workbench.workspace.members.managedTooltip': 'This grant is managed by the identity provider.',
  'workbench.workspace.members.removeConfirm': 'Remove {name} from this workspace?',
  'workbench.workspace.members.removeOk': 'Remove',
  'workbench.workspace.members.removeAria': 'Remove member',
  'workbench.workspace.members.removedToast': 'Removed {name}',
  'workbench.workspace.members.updatedToast': 'Updated {name}',
  'workbench.workspace.members.addedToast': 'Added {name}',
  'workbench.workspace.members.addPlaceholder': 'Add a person or service account…',
  'workbench.workspace.members.addButton': 'Add',
  'workbench.workspace.members.noneToAdd': 'Everyone on this server already has access.',
  'workbench.workspace.members.readOnlyHint': 'Only a workspace owner can change members.',
  'workbench.workspace.members.visibilityLabel': 'Access',
  'workbench.workspace.members.visibilityPrivate': 'Private',
  'workbench.workspace.members.visibilityInternal': 'Internal',
  'workbench.workspace.members.visibilityPrivateHint': 'Only invited members can see this workspace.',
  'workbench.workspace.members.visibilityInternalHint':
    'Every member of this server can view this workspace. Only members you add can edit.',
  'workbench.workspace.members.visibilityUpdatedToast': 'Workspace access updated',
  'workbench.workspace.members.visibilityPublic': 'Public',
  'workbench.workspace.members.visibilityPublicHint':
    'Anyone with the link can view a shared read-only snapshot of this workspace. Only members you add can edit.',
  'workbench.workspace.publicShare.heading': 'Public link',
  'workbench.workspace.publicShare.loadFailed': 'Failed to load the public sharing state',
  'workbench.workspace.publicShare.disabledHint':
    'Public workspaces are disabled on this server. An operator can enable them with publicWorkspaces in daemon.json.',
  'workbench.workspace.publicShare.notShared': 'No snapshot is shared yet — the link goes live when you share one.',
  'workbench.workspace.publicShare.sharedAt': 'Snapshot shared {when}',
  'workbench.workspace.publicShare.shareButton': 'Share publicly…',
  'workbench.workspace.publicShare.updateButton': 'Update public copy…',
  'workbench.workspace.publicShare.stopButton': 'Stop sharing',
  'workbench.workspace.publicShare.stopConfirm':
    'Stop sharing this workspace? The public link stops working immediately.',
  'workbench.workspace.publicShare.stopOk': 'Stop sharing',
  'workbench.workspace.publicShare.stoppedToast': 'Public link removed',
  'workbench.workspace.publicShare.sharedToast': 'Public snapshot shared',
  'workbench.workspace.publicShare.copyLink': 'Copy link',
  'workbench.workspace.publicShare.copiedToast': 'Link copied',
  'workbench.workspace.publicShare.reviewTitle': 'Share "{name}" publicly',
  'workbench.workspace.publicShare.reviewIntro':
    'Anyone with the link sees a read-only snapshot of this workspace as it is right now. Review what ships ' +
    'before confirming:',
  'workbench.workspace.publicShare.reviewUpdateNote': 'Sharing again replaces the public copy at the same link.',
  'workbench.workspace.publicShare.reviewStripped':
    'Never included: vault entries, OAuth tokens, live values, file contents, and the values of secret-typed ' +
    'variables.',
  'workbench.workspace.publicShare.reviewStrippedCount':
    '{count} secret variable values stay hidden — their names remain visible.',
  'workbench.workspace.publicShare.reviewContents': 'Contents',
  'workbench.workspace.publicShare.reviewEmpty': 'This workspace is empty — the published snapshot will be too.',
  'workbench.workspace.publicShare.reviewVariables': 'Variables ({count})',
  'workbench.workspace.publicShare.reviewNoVariables': 'No variables.',
  'workbench.workspace.publicShare.reviewValueHidden': 'hidden',
  'workbench.workspace.publicShare.confirmShare': 'Share snapshot',
  'workbench.workspace.publicShare.previewFailed': 'Failed to prepare the snapshot preview',
  'workbench.workspace.publicShare.shareFailed': 'Failed to share the snapshot',
  'workbench.workspace.publicShare.scope.workspace': 'Workspace',
  'workbench.workspace.publicShare.scope.environment': 'Environment',
  'workbench.workspace.publicShare.scope.collection': 'Collection',
  'workbench.workspace.publicShare.cat.requests': '{count} requests',
  'workbench.workspace.publicShare.cat.collections': '{count} collections',
  'workbench.workspace.publicShare.cat.folders': '{count} folders',
  'workbench.workspace.publicShare.cat.rules': '{count} rules',
  'workbench.workspace.publicShare.cat.environments': '{count} environments',
  'workbench.workspace.publicShare.cat.examples': '{count} response examples',
  'workbench.workspace.publicShare.cat.specs': '{count} API specs',
  'workbench.workspace.publicShare.cat.scripts': '{count} script packages',
  'workbench.workspace.publicShare.cat.templates': '{count} templates',
  'workbench.workspace.publicShare.cat.live': '{count} live workflows',
  'workbench.workspace.publicShare.cat.files': '{count} files',
  'workbench.workspace.publicView.bannerTag': 'Public snapshot',
  'workbench.workspace.publicView.banner':
    'Read-only public copy of "{name}". Edits you make here are not saved anywhere.',
  'workbench.workspace.publicView.loadFailed': 'This public workspace link is not available.',
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
