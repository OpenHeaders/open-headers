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
 * and `openheaders.com/pricing` URL, `IdP` / `SSO` / `JSONL` vocabulary,
 * and the ` · ` separator glyphs.
 */

import type { Catalog } from '../../types';

export const workbenchServerAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.serverAdmin.title': 'Server administration',
  'workbench.serverAdmin.intro':
    "Directory users sign in with a bound token or SSO and see exactly the workspaces granted here. Deactivation revokes the user's tokens and disconnects them immediately.",
  'workbench.serverAdmin.deniedDescription': 'Administering this server requires the daemon.admin capability.',
  'workbench.serverAdmin.cancel': 'Cancel',

  // ── Release-notes card ─────────────────────────────────────────────
  'workbench.serverAdmin.notes.sectionTitle': 'Release notes',
  'workbench.serverAdmin.notes.sectionHint': 'What shipped in the server build this console administers.',
  'workbench.serverAdmin.notes.versionLine': 'Server {version}',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.serverAdmin.users.sectionTitle': 'Users',
  'workbench.serverAdmin.users.sectionHint':
    'Admit a user, then grant per-workspace roles below. Email joins SSO logins to the record.',
  'workbench.serverAdmin.users.nameRequired': 'Name is required',
  'workbench.serverAdmin.users.displayNamePlaceholder': 'Display name',
  'workbench.serverAdmin.users.emailPlaceholder': 'Email (optional — required for SSO)',
  'workbench.serverAdmin.users.seatKeyPlaceholder': 'Individual seat key (oh-license.…)',
  'workbench.serverAdmin.users.addUser': 'Add user',
  'workbench.serverAdmin.users.seatLimit':
    "This server is at its seat limit. Add seats to your team license, or paste the joining user's own individual seat key above — it admits them without using a pool seat.",
  'workbench.serverAdmin.users.seatsSoldAt': 'Individual seats are sold at',
  'workbench.serverAdmin.users.emptyDirectory':
    'No directory users yet — the server runs in its solo tier. Add a user to open the team tier.',
  'workbench.serverAdmin.users.deactivatedOn': 'Deactivated {date}',
  'workbench.serverAdmin.users.addedOn': 'added {date}',
  'workbench.serverAdmin.users.loadFailed': 'Failed to load the user directory: {message}',
  'workbench.serverAdmin.users.addFailed': 'Failed to add user: {message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.serverAdmin.seat.tag': 'Individual seat',
  'workbench.serverAdmin.seat.healthyTooltip':
    "Admitted by their own individual seat ({id}) — not counted against this server's pool.",
  'workbench.serverAdmin.seat.lapsedTooltip':
    'Their individual seat ({id}) is {status}. They stay signed in — a lapse never evicts — but the seat no longer renews.',
  'workbench.serverAdmin.seat.absorbTitle': 'Absorb this seat into the pool?',
  'workbench.serverAdmin.seat.absorbDescription':
    'The user becomes a regular pool seat and their individual license stops renewing here. This cannot be undone.',
  'workbench.serverAdmin.seat.absorbOk': 'Absorb',
  'workbench.serverAdmin.seat.absorbCta': 'Absorb into pool',
  'workbench.serverAdmin.seat.absorbed': 'Seat absorbed into the pool.',
  'workbench.serverAdmin.seat.absorbFailed': 'Failed to absorb the seat: {message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.serverAdmin.deactivate.title': 'Deactivate this user?',
  'workbench.serverAdmin.deactivate.description':
    'Their tokens are revoked and live connections closed. Re-admit later by adding the same email anew.',
  'workbench.serverAdmin.deactivate.cta': 'Deactivate',
  'workbench.serverAdmin.deactivate.done': 'User deactivated. Their tokens were revoked and live connections closed.',
  'workbench.serverAdmin.deactivate.failed': 'Failed to deactivate: {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.serverAdmin.grants.roleViewer': 'Viewer',
  'workbench.serverAdmin.grants.roleEditor': 'Editor',
  'workbench.serverAdmin.grants.roleOwner': 'Owner',
  'workbench.serverAdmin.grants.none': 'No workspace access yet.',
  'workbench.serverAdmin.grants.idpTooltip':
    'Granted by the identity-provider mapping. Revoking holds only until their next SSO login re-applies it.',
  'workbench.serverAdmin.grants.workspacePlaceholder': 'Workspace',
  'workbench.serverAdmin.grants.grantCta': 'Grant',
  'workbench.serverAdmin.grants.everyWorkspace': 'Granted on every workspace.',
  'workbench.serverAdmin.grants.grantFailed': 'Failed to grant: {message}',
  'workbench.serverAdmin.grants.revokeFailed': 'Failed to revoke grant: {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.serverAdmin.password.setTitle': 'Set password — {name}',
  'workbench.serverAdmin.password.resetTitle': 'Reset password — {name}',
  'workbench.serverAdmin.password.explainer':
    "The user signs in with their email and this password at the server's web gate. Share it with them directly — it is hashed on the server and cannot be read back.",
  'workbench.serverAdmin.password.placeholder': 'New password (min 8 characters)',
  'workbench.serverAdmin.password.setCta': 'Set password',
  'workbench.serverAdmin.password.resetCta': 'Reset password',
  'workbench.serverAdmin.password.removeCta': 'Remove password',
  'workbench.serverAdmin.password.setDone': 'Password set.',
  'workbench.serverAdmin.password.removedDone': 'Password removed.',
  'workbench.serverAdmin.password.updateFailed': 'Failed to update password: {message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.serverAdmin.gitEmail.setTitle': 'Set Git email — {name}',
  'workbench.serverAdmin.gitEmail.changeTitle': 'Change Git email — {name}',
  'workbench.serverAdmin.gitEmail.explainer':
    "Commits carrying this user's work are authored with this address, so they link to the user's Git-hosting profile. Without one, the directory email is used, then a noreply address.",
  'workbench.serverAdmin.gitEmail.placeholder': 'commit-author email',
  'workbench.serverAdmin.gitEmail.setCta': 'Set Git email',
  'workbench.serverAdmin.gitEmail.changeCta': 'Change Git email',
  'workbench.serverAdmin.gitEmail.removeCta': 'Remove override',
  'workbench.serverAdmin.gitEmail.setDone': 'Git email set.',
  'workbench.serverAdmin.gitEmail.removedDone': 'Git email override removed.',
  'workbench.serverAdmin.gitEmail.updateFailed': 'Failed to update Git email: {message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.serverAdmin.git.sectionTitle': 'Git',
  'workbench.serverAdmin.git.sectionHint':
    "Bind a server workspace to a repository and drive commit, pull, push, and branches remotely. Paths are on the server's own filesystem.",
  'workbench.serverAdmin.git.workspaceLabel': 'Workspace',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.serverAdmin.audit.sectionTitle': 'Reports',
  'workbench.serverAdmin.audit.sectionHint':
    'Every permission decision this server makes, and each device admission, as a filterable audit trail. Export honors the active filters.',
  'workbench.serverAdmin.audit.capAdmission': 'Admission (connect)',
  'workbench.serverAdmin.audit.capAdminPlane': 'Admin plane',
  'workbench.serverAdmin.audit.capSsoGrant': 'SSO grant (mapping)',
  'workbench.serverAdmin.audit.capSsoRevoke': 'SSO revoke (mapping)',
  'workbench.serverAdmin.audit.capWorkspaceRead': 'Workspace read',
  'workbench.serverAdmin.audit.capWorkspaceWrite': 'Workspace write',
  'workbench.serverAdmin.audit.capWorkspaceList': 'Workspace list',
  'workbench.serverAdmin.audit.rangeLastHour': 'Last hour',
  'workbench.serverAdmin.audit.rangeLast24Hours': 'Last 24 hours',
  'workbench.serverAdmin.audit.rangeLast7Days': 'Last 7 days',
  'workbench.serverAdmin.audit.rangeLast30Days': 'Last 30 days',
  'workbench.serverAdmin.audit.colTime': 'Time',
  'workbench.serverAdmin.audit.colEvent': 'Event',
  'workbench.serverAdmin.audit.colCapability': 'Capability',
  'workbench.serverAdmin.audit.colWorkspace': 'Workspace',
  'workbench.serverAdmin.audit.colActor': 'Actor',
  'workbench.serverAdmin.audit.eventAdmission': 'Admission',
  'workbench.serverAdmin.audit.eventAdmissionRefused': 'Admission refused',
  'workbench.serverAdmin.audit.eventSsoGrant': 'SSO grant',
  'workbench.serverAdmin.audit.eventSsoRevoke': 'SSO revoke',
  'workbench.serverAdmin.audit.eventAllow': 'Allow',
  'workbench.serverAdmin.audit.eventDeny': 'Deny',
  'workbench.serverAdmin.audit.filterActor': 'Actor',
  'workbench.serverAdmin.audit.filterCapability': 'Capability',
  'workbench.serverAdmin.audit.filterDecision': 'Decision',
  'workbench.serverAdmin.audit.filterWorkspace': 'Workspace',
  'workbench.serverAdmin.audit.filterAnyTime': 'Any time',
  'workbench.serverAdmin.audit.decisionAllow': 'Allow',
  'workbench.serverAdmin.audit.decisionDeny': 'Deny',
  'workbench.serverAdmin.audit.refresh': 'Refresh',
  'workbench.serverAdmin.audit.exportJsonl': 'Export JSONL',
  'workbench.serverAdmin.audit.emptyText': 'No audit rows match.',
  'workbench.serverAdmin.audit.loadMore': 'Load more',
} as const satisfies Catalog;
