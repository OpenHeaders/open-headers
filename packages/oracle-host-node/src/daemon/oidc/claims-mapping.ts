/**
 * IdP claims→grant mapping (enterprise Phase 2) — the pure half of the
 * fold `completeLogin` runs on every SSO login. Extracts the configured
 * claim's values from the verified ID-token payload and folds the
 * mapping rules into the desired per-workspace grant set; the stateful
 * reconcile against persisted WRA rows lives in
 * `@openheaders/core/identity` (`reconcileIdpWorkspaceRoles`).
 */

import type { DesiredIdpGrant } from '@openheaders/core/identity';
import type { WorkspaceRole } from '@openheaders/core/types';
import type { OidcClaimMappingRule } from './oidc-config';

/** Higher wins when several rules map the same workspace. */
const ROLE_RANK: Record<WorkspaceRole, number> = { viewer: 0, editor: 1, owner: 2 };

/**
 * Read the mapped claim's values off the verified payload. `path` is a
 * dot-path (`groups`, `realm_access.roles`); the leaf may be a string
 * array (the common groups shape) or a single string. Anything else —
 * missing segments, non-string leaves — yields the empty set, which the
 * reconcile treats as "no mapped grants": fail-closed, never fail-open.
 */
export function extractClaimValues(payload: Record<string, unknown>, path: string): readonly string[] {
  let node: unknown = payload;
  for (const segment of path.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return [];
    node = (node as Record<string, unknown>)[segment];
  }
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.filter((v): v is string => typeof v === 'string');
  return [];
}

export interface DesiredGrantsResult {
  readonly desired: readonly DesiredIdpGrant[];
  /** Rule-matched workspace ids that don't exist on this daemon. */
  readonly unknownWorkspaceIds: readonly string[];
}

/**
 * Fold the mapping rules over the claim values: a rule contributes when
 * its `value` is among the claims; several rules landing on one
 * workspace keep the highest role. Workspaces the daemon doesn't hold
 * are reported, not desired — the boot WRA reconcile would drop such
 * rows anyway, so they are refused up front (same posture as the
 * manual-grant RPC).
 */
export function desiredGrantsFromClaims(
  claimValues: readonly string[],
  rules: readonly OidcClaimMappingRule[],
  workspaceExists: (workspaceId: string) => boolean,
): DesiredGrantsResult {
  const values = new Set(claimValues);
  const byWorkspace = new Map<string, WorkspaceRole>();
  const unknown = new Set<string>();
  for (const rule of rules) {
    if (!values.has(rule.value)) continue;
    if (!workspaceExists(rule.workspaceId)) {
      unknown.add(rule.workspaceId);
      continue;
    }
    const held = byWorkspace.get(rule.workspaceId);
    if (held === undefined || ROLE_RANK[rule.role] > ROLE_RANK[held]) {
      byWorkspace.set(rule.workspaceId, rule.role);
    }
  }
  return {
    desired: [...byWorkspace.entries()].map(([workspaceId, role]) => ({ workspaceId, role })),
    unknownWorkspaceIds: [...unknown],
  };
}
