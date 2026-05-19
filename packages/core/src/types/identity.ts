/**
 * Identity-schema TypeScript types — derived from the valibot schemas in
 * `../schemas/identity.ts` so the runtime validator and the static type
 * stay locked together (same discipline as `Workspace` and `Variable`).
 *
 * The shapes are universal: every host materializes them (synthetic rows
 * in Mode-1 / Mode-2-localhost, real rows once promotion happens). See
 * UNIFIED_ORACLE_MODEL.md §5 for the synthetic-row catalogue.
 */

import type * as v from 'valibot';
import type {
  OrgSchema,
  SessionSchema,
  SessionSourceSchema,
  SyntheticIdentityRecordSchema,
  UserIdentityKindSchema,
  UserIdentitySchema,
  UserSchema,
} from '../schemas/identity';

export type UserIdentityKind = v.InferOutput<typeof UserIdentityKindSchema>;
export type SessionSource = v.InferOutput<typeof SessionSourceSchema>;

export type User = v.InferOutput<typeof UserSchema>;
export type Org = v.InferOutput<typeof OrgSchema>;
export type UserIdentity = v.InferOutput<typeof UserIdentitySchema>;
export type Session = v.InferOutput<typeof SessionSchema>;

/**
 * Persisted synthetic-identity row tuple (User + Org + UserIdentity +
 * Session + OrgMembership + Principal + LocalAdmin). Lives under
 * `OH.syntheticIdentity`; produced by `bootstrapSyntheticIdentity` and
 * consumed by every host-side resolver call once Phase U2 lands.
 */
export type SyntheticIdentityRecord = v.InferOutput<typeof SyntheticIdentityRecordSchema>;
