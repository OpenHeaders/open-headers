/**
 * Daemon-admin family — the workbench console for the daemon's team
 * tier (`workbench/components/daemon-admin/`): the user directory with
 * per-workspace grants, the password modal, and the audit-reports
 * surface.
 *
 * Raw by design inside keyed sentences: capability ids rendered as
 * monospace data (`daemon.admission` cell values), admission-status
 * enum values and audit `reason` strings ({status} / {reason} holes
 * carry server data), license ids ({id}), the `oh-license.` key prefix
 * and `openheaders.io/pricing` URL, `IdP` / `SSO` / `JSONL` vocabulary,
 * and the ` · ` separator glyphs.
 */

import type { Catalog } from '../../types';

export const workbenchDaemonAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.daemonAdmin.title': 'Daemon administration',
  'workbench.daemonAdmin.intro':
    "Directory users sign in with a bound token or SSO and see exactly the workspaces granted here. Deactivation revokes the user's tokens and disconnects them immediately.",
  'workbench.daemonAdmin.deniedDescription': 'Administering this daemon requires the daemon.admin capability.',
  'workbench.daemonAdmin.cancel': 'Cancel',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.daemonAdmin.users.sectionTitle': 'Users',
  'workbench.daemonAdmin.users.sectionHint':
    'Admit a user, then grant per-workspace roles below. Email joins SSO logins to the record.',
  'workbench.daemonAdmin.users.nameRequired': 'Name is required',
  'workbench.daemonAdmin.users.displayNamePlaceholder': 'Display name',
  'workbench.daemonAdmin.users.emailPlaceholder': 'Email (optional — required for SSO)',
  'workbench.daemonAdmin.users.seatKeyPlaceholder': 'Individual seat key (oh-license.…)',
  'workbench.daemonAdmin.users.addUser': 'Add user',
  'workbench.daemonAdmin.users.seatLimit':
    "This daemon is at its seat limit. Add seats to your team license, or paste the joining user's own individual seat key above — it admits them without using a pool seat.",
  'workbench.daemonAdmin.users.seatsSoldAt': 'Individual seats are sold at',
  'workbench.daemonAdmin.users.emptyDirectory':
    'No directory users yet — the daemon runs in its solo tier. Add a user to open the team tier.',
  'workbench.daemonAdmin.users.deactivatedOn': 'Deactivated {date}',
  'workbench.daemonAdmin.users.addedOn': 'added {date}',
  'workbench.daemonAdmin.users.loadFailed': 'Failed to load the user directory: {message}',
  'workbench.daemonAdmin.users.addFailed': 'Failed to add user: {message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.daemonAdmin.seat.tag': 'Individual seat',
  'workbench.daemonAdmin.seat.healthyTooltip':
    "Admitted by their own individual seat ({id}) — not counted against this daemon's pool.",
  'workbench.daemonAdmin.seat.lapsedTooltip':
    'Their individual seat ({id}) is {status}. They stay signed in — a lapse never evicts — but the seat no longer renews.',
  'workbench.daemonAdmin.seat.absorbTitle': 'Absorb this seat into the pool?',
  'workbench.daemonAdmin.seat.absorbDescription':
    'The user becomes a regular pool seat and their individual license stops renewing here. This cannot be undone.',
  'workbench.daemonAdmin.seat.absorbOk': 'Absorb',
  'workbench.daemonAdmin.seat.absorbCta': 'Absorb into pool',
  'workbench.daemonAdmin.seat.absorbed': 'Seat absorbed into the pool.',
  'workbench.daemonAdmin.seat.absorbFailed': 'Failed to absorb the seat: {message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.daemonAdmin.deactivate.title': 'Deactivate this user?',
  'workbench.daemonAdmin.deactivate.description':
    'Their tokens are revoked and live connections closed. Re-admit later by adding the same email anew.',
  'workbench.daemonAdmin.deactivate.cta': 'Deactivate',
  'workbench.daemonAdmin.deactivate.done': 'User deactivated. Their tokens were revoked and live connections closed.',
  'workbench.daemonAdmin.deactivate.failed': 'Failed to deactivate: {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.daemonAdmin.grants.roleViewer': 'Viewer',
  'workbench.daemonAdmin.grants.roleEditor': 'Editor',
  'workbench.daemonAdmin.grants.roleOwner': 'Owner',
  'workbench.daemonAdmin.grants.none': 'No workspace access yet.',
  'workbench.daemonAdmin.grants.idpTooltip':
    'Granted by the identity-provider mapping. Revoking holds only until their next SSO login re-applies it.',
  'workbench.daemonAdmin.grants.workspacePlaceholder': 'Workspace',
  'workbench.daemonAdmin.grants.grantCta': 'Grant',
  'workbench.daemonAdmin.grants.everyWorkspace': 'Granted on every workspace.',
  'workbench.daemonAdmin.grants.grantFailed': 'Failed to grant: {message}',
  'workbench.daemonAdmin.grants.revokeFailed': 'Failed to revoke grant: {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.daemonAdmin.password.setTitle': 'Set password — {name}',
  'workbench.daemonAdmin.password.resetTitle': 'Reset password — {name}',
  'workbench.daemonAdmin.password.explainer':
    "The user signs in with their email and this password at the daemon's web gate. Share it with them directly — it is hashed on the daemon and cannot be read back.",
  'workbench.daemonAdmin.password.placeholder': 'New password (min 8 characters)',
  'workbench.daemonAdmin.password.setCta': 'Set password',
  'workbench.daemonAdmin.password.resetCta': 'Reset password',
  'workbench.daemonAdmin.password.removeCta': 'Remove password',
  'workbench.daemonAdmin.password.setDone': 'Password set.',
  'workbench.daemonAdmin.password.removedDone': 'Password removed.',
  'workbench.daemonAdmin.password.updateFailed': 'Failed to update password: {message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.daemonAdmin.gitEmail.setTitle': 'Set Git email — {name}',
  'workbench.daemonAdmin.gitEmail.changeTitle': 'Change Git email — {name}',
  'workbench.daemonAdmin.gitEmail.explainer':
    "Commits carrying this user's work are authored with this address, so they link to the user's Git-hosting profile. Without one, the directory email is used, then a noreply address.",
  'workbench.daemonAdmin.gitEmail.placeholder': 'commit-author email',
  'workbench.daemonAdmin.gitEmail.setCta': 'Set Git email',
  'workbench.daemonAdmin.gitEmail.changeCta': 'Change Git email',
  'workbench.daemonAdmin.gitEmail.removeCta': 'Remove override',
  'workbench.daemonAdmin.gitEmail.setDone': 'Git email set.',
  'workbench.daemonAdmin.gitEmail.removedDone': 'Git email override removed.',
  'workbench.daemonAdmin.gitEmail.updateFailed': 'Failed to update Git email: {message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.daemonAdmin.git.sectionTitle': 'Git',
  'workbench.daemonAdmin.git.sectionHint':
    "Bind a daemon workspace to a repository and drive commit, pull, push, and branches remotely. Paths are on the daemon's own filesystem.",
  'workbench.daemonAdmin.git.workspaceLabel': 'Workspace',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.daemonAdmin.audit.sectionTitle': 'Reports',
  'workbench.daemonAdmin.audit.sectionHint':
    'Every permission decision this daemon makes, and each device admission, as a filterable audit trail. Export honors the active filters.',
  'workbench.daemonAdmin.audit.capAdmission': 'Admission (connect)',
  'workbench.daemonAdmin.audit.capAdminPlane': 'Admin plane',
  'workbench.daemonAdmin.audit.capSsoGrant': 'SSO grant (mapping)',
  'workbench.daemonAdmin.audit.capSsoRevoke': 'SSO revoke (mapping)',
  'workbench.daemonAdmin.audit.capWorkspaceRead': 'Workspace read',
  'workbench.daemonAdmin.audit.capWorkspaceWrite': 'Workspace write',
  'workbench.daemonAdmin.audit.capWorkspaceList': 'Workspace list',
  'workbench.daemonAdmin.audit.rangeLastHour': 'Last hour',
  'workbench.daemonAdmin.audit.rangeLast24Hours': 'Last 24 hours',
  'workbench.daemonAdmin.audit.rangeLast7Days': 'Last 7 days',
  'workbench.daemonAdmin.audit.rangeLast30Days': 'Last 30 days',
  'workbench.daemonAdmin.audit.colTime': 'Time',
  'workbench.daemonAdmin.audit.colEvent': 'Event',
  'workbench.daemonAdmin.audit.colCapability': 'Capability',
  'workbench.daemonAdmin.audit.colWorkspace': 'Workspace',
  'workbench.daemonAdmin.audit.colActor': 'Actor',
  'workbench.daemonAdmin.audit.eventAdmission': 'Admission',
  'workbench.daemonAdmin.audit.eventAdmissionRefused': 'Admission refused',
  'workbench.daemonAdmin.audit.eventSsoGrant': 'SSO grant',
  'workbench.daemonAdmin.audit.eventSsoRevoke': 'SSO revoke',
  'workbench.daemonAdmin.audit.eventAllow': 'Allow',
  'workbench.daemonAdmin.audit.eventDeny': 'Deny',
  'workbench.daemonAdmin.audit.filterActor': 'Actor',
  'workbench.daemonAdmin.audit.filterCapability': 'Capability',
  'workbench.daemonAdmin.audit.filterDecision': 'Decision',
  'workbench.daemonAdmin.audit.filterWorkspace': 'Workspace',
  'workbench.daemonAdmin.audit.filterAnyTime': 'Any time',
  'workbench.daemonAdmin.audit.decisionAllow': 'Allow',
  'workbench.daemonAdmin.audit.decisionDeny': 'Deny',
  'workbench.daemonAdmin.audit.refresh': 'Refresh',
  'workbench.daemonAdmin.audit.exportJsonl': 'Export JSONL',
  'workbench.daemonAdmin.audit.emptyText': 'No audit rows match.',
  'workbench.daemonAdmin.audit.loadMore': 'Load more',
} as const satisfies Catalog;
