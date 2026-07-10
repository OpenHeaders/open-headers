/**
 * Identity-ACL TypeScript types — derived from
 * `../schemas/identity-acl.ts`. Companion to `./identity.ts`; the split
 * mirrors the schema layout (entity-level shapes vs. membership / role
 * grants).
 */

import type * as v from 'valibot';
import type {
  AuditDecisionSchema,
  AuditLogEntrySchema,
  CapabilityDenyReasonSchema,
  CapabilitySchema,
  DaemonAdminSchema,
  OrgMembershipSchema,
  OrgPrimaryRoleSchema,
  PrincipalSchema,
  WorkspaceRoleAssignmentSchema,
  WorkspaceRoleOriginSchema,
  WorkspaceRoleSchema,
} from '../schemas/identity-acl';

export type OrgPrimaryRole = v.InferOutput<typeof OrgPrimaryRoleSchema>;
export type WorkspaceRole = v.InferOutput<typeof WorkspaceRoleSchema>;
export type WorkspaceRoleOrigin = v.InferOutput<typeof WorkspaceRoleOriginSchema>;

export type OrgMembership = v.InferOutput<typeof OrgMembershipSchema>;
export type Principal = v.InferOutput<typeof PrincipalSchema>;
export type WorkspaceRoleAssignment = v.InferOutput<typeof WorkspaceRoleAssignmentSchema>;
export type DaemonAdmin = v.InferOutput<typeof DaemonAdminSchema>;

export type AuditDecision = v.InferOutput<typeof AuditDecisionSchema>;
export type AuditLogEntry = v.InferOutput<typeof AuditLogEntrySchema>;
export type AuditCapability = v.InferOutput<typeof CapabilitySchema>;
export type AuditCapabilityDenyReason = v.InferOutput<typeof CapabilityDenyReasonSchema>;
