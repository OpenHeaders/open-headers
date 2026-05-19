/**
 * Identity-ACL TypeScript types — derived from
 * `../schemas/identity-acl.ts`. Companion to `./identity.ts`; the split
 * mirrors the schema layout (entity-level shapes vs. membership / role
 * grants).
 */

import type * as v from 'valibot';
import type {
  DaemonAdminSchema,
  OrgMembershipSchema,
  OrgPrimaryRoleSchema,
  PrincipalSchema,
  WorkspaceRoleAssignmentSchema,
  WorkspaceRoleSchema,
} from '../schemas/identity-acl';

export type OrgPrimaryRole = v.InferOutput<typeof OrgPrimaryRoleSchema>;
export type WorkspaceRole = v.InferOutput<typeof WorkspaceRoleSchema>;

export type OrgMembership = v.InferOutput<typeof OrgMembershipSchema>;
export type Principal = v.InferOutput<typeof PrincipalSchema>;
export type WorkspaceRoleAssignment = v.InferOutput<typeof WorkspaceRoleAssignmentSchema>;
export type DaemonAdmin = v.InferOutput<typeof DaemonAdminSchema>;
