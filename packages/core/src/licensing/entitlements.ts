/**
 * Entitlement vocabulary + the free-tier seat constant
 * (`LICENSING_PLAN.md` §2–§4).
 *
 * Entitlements are capability strings, never plan booleans. v1 licenses
 * carry an empty `entitlements` array — `seats` is the only live claim —
 * but the vocabulary is reserved now so a future paid debut of any of
 * these capabilities is a signing-config change, not a schema change.
 * Verifiers tolerate strings outside this list (a newer control plane
 * may sign vocabulary an older client hasn't heard of yet).
 */

export const RESERVED_ENTITLEMENTS = ['mock-server', 'workflows', 'scim', 'groups', 'audit-forwarding'] as const;

export type ReservedEntitlement = (typeof RESERVED_ENTITLEMENTS)[number];

/**
 * Active daemon users admitted without a license — enough to evaluate
 * team mode for real; actual teams pay. The seat gate
 * (`LICENSING_PLAN.md` §4) compares against
 * `license?.seats ?? FREE_SEAT_LIMIT`; degradation after grace reverts
 * to this limit for NEW user creation only.
 */
export const FREE_SEAT_LIMIT = 3;
