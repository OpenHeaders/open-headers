/**
 * Identity-ACL valibot validators — membership, principal, workspace-role,
 * and daemon-admin rows. Sit alongside the entity-level shapes in
 * `./identity.ts` (User, Org, UserIdentity, Session).
 *
 * Per UNIFIED_ORACLE_MODEL.md §5.2, every host materializes one
 * `OrgMembership(synthetic-user, synthetic-org, role='owner')`, one
 * `Principal(synthetic-user-in-synthetic-org)`, one `WRA` per workspace
 * (owner role on the synthetic principal), and a `DaemonAdmin` row whose
 * scope is "LocalAdmin" when the user owns the install (per §9.4 —
 * `LocalAdmin` is a logical role distinction, not a separate table).
 */

import * as v from 'valibot';
import { UuidV7Schema } from './common';

/**
 * Primary org-membership role. Functional roles (a future axis) ride on
 * top via the `functionalRoles` array; left empty on synthetic bootstrap.
 */
export const OrgPrimaryRoleSchema = v.picklist(['owner', 'admin', 'member']);

/**
 * Workspace-scoped role granted to a Principal. Mirrors the identity-doc
 * three-tier model; finer functional axes layer on top later.
 */
export const WorkspaceRoleSchema = v.picklist(['owner', 'editor', 'viewer']);

/**
 * `OrgMembership` — anchors a User in an Org with a primary role.
 * `functionalRoles` is the open-ended axis (e.g., `'billing-admin'`,
 * `'security-reviewer'`); empty on synthetic bootstrap.
 */
export const OrgMembershipSchema = v.object({
  id: UuidV7Schema,
  userId: UuidV7Schema,
  orgId: UuidV7Schema,
  primaryRole: OrgPrimaryRoleSchema,
  functionalRoles: v.array(v.string()),
});

/**
 * `Principal` — (User, Org) binding used as the subject of every
 * `WorkspaceRoleAssignment`. Decoupling principals from raw user ids lets
 * the same User have distinct WRAs in distinct Orgs without ambiguity
 * (identity doc §3 / UNIFIED_ORACLE_MODEL.md §5.2).
 */
export const PrincipalSchema = v.object({
  id: UuidV7Schema,
  userId: UuidV7Schema,
  orgId: UuidV7Schema,
});

/**
 * `WorkspaceRoleAssignment` — per-workspace grant. `workspaceId` keys to
 * the canonical workspace id (UUIDv7 per
 * `packages/core/src/utils/workspace-id.ts` — the value that travels on
 * the wire in `oh.sync.hello`, not the 8-char manifest uid). Minted on
 * every workspace creation (U1.8) with `role='owner'` for the synthetic
 * principal.
 */
export const WorkspaceRoleAssignmentSchema = v.object({
  id: UuidV7Schema,
  principalId: UuidV7Schema,
  workspaceId: UuidV7Schema,
  role: WorkspaceRoleSchema,
});

/**
 * `DaemonAdmin` — operator-of-the-install role. Per UNIFIED_ORACLE_MODEL.md
 * §9.4 the same row schema covers two logical scopes:
 *
 *   - `LocalAdmin`  — auto-assigned to the synthetic user on every host;
 *                     `isLocal: true`.
 *   - `DaemonAdmin` — operator of a real multi-user daemon;
 *                     `isLocal: false`.
 *
 * The flag carries the distinction in-band; resolvers can branch on it
 * without consulting a separate table.
 */
export const DaemonAdminSchema = v.object({
  id: UuidV7Schema,
  userId: UuidV7Schema,
  isLocal: v.boolean(),
});

/**
 * Capability key + deny-reason wire-shapes. Mirror the runtime
 * `Capability` / `CapabilityDenyReason` unions from
 * `../identity/resolver.ts`; the schema-side picklists let persisted
 * audit rows be re-parsed back into the same TypeScript types.
 *
 * Kept here (not in `identity.ts`) because audit log entries live on the
 * ACL axis — they're the forensic record of permission decisions.
 *
 * `daemon.admission` is audit-vocabulary only — the HELLO admission
 * gate's per-connect stamp (admit or auth-required refusal). It is not
 * grantable and never reaches the resolver, so it stays out of the
 * runtime `Capability` union; report surfaces render it as "admission"
 * rather than an enforcement decision.
 */
export const CapabilitySchema = v.picklist([
  'workspace.read',
  'workspace.write',
  'workspace.list',
  'daemon.admin',
  'daemon.admission',
]);

export const CapabilityDenyReasonSchema = v.picklist([
  'no-current-user',
  'workspace-id-required',
  'no-workspace-role-assignment',
  'insufficient-workspace-role',
  'not-daemon-admin',
  'unknown-capability',
  'auth-required',
]);

export const AuditDecisionSchema = v.object({
  allow: v.boolean(),
  reason: v.optional(CapabilityDenyReasonSchema),
});

/**
 * `AuditLogEntry` — one row per capability check, gapless within an Org
 * (UNIFIED_ORACLE_MODEL.md §9.5). `seq` is the per-Org sequence number;
 * `id` is `${orgId}:${seq}` so the row's key is content-addressable.
 *
 * `actorUserId` is immutable — the display layer always resolves
 * through `User.displayName` at view time (§9.3).
 */
export const AuditLogEntrySchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  orgId: UuidV7Schema,
  seq: v.pipe(v.number(), v.integer(), v.minValue(1)),
  actorUserId: v.pipe(v.string(), v.minLength(1)),
  capability: CapabilitySchema,
  workspaceId: v.optional(UuidV7Schema),
  decision: AuditDecisionSchema,
  occurredAt: v.string(),
});
