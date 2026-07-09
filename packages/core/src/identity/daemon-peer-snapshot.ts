/**
 * Per-peer identity snapshot (Phase 5 team tier, slice 2).
 *
 * The admission gate resolved WHO a peer acts as (`resolveDaemonPeerUser`);
 * this module resolves WHAT that user may do: an {@link IdentitySnapshot}
 * the unchanged `hasCapability` resolver consumes, built per check so a
 * grant or revocation takes effect on live connections immediately —
 * the same freshness contract the `/mcp` handler already holds for the
 * user resolution itself.
 *
 * Two shapes come out of one function:
 *
 *   - The daemon OPERATOR's own user id → the registry's real snapshot,
 *     `localAdmin` present ⇒ allow-all. Today's solo-tier behavior,
 *     now derived from identity instead of assumed at the call site.
 *   - A directory user → a snapshot over their §5 rows: their principal's
 *     WRA grants, `localAdmin` absent, the daemon's own Org as the sole
 *     org. Unknown or deactivated users resolve to `null`, which the
 *     resolver denies as `no-current-user` — fail-closed.
 */

import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import type { WorkspaceRoleAssignment } from '../types';
import { getIdentitySnapshot } from './registry';
import type { IdentitySnapshot } from './resolver';

/**
 * Build the capability snapshot for the user a peer acts as. `null` when
 * the daemon identity is missing, or the user is unknown / deactivated —
 * every gated action then denies with `no-current-user`.
 */
export async function resolveDaemonPeerIdentitySnapshot(userId: string): Promise<IdentitySnapshot | null> {
  const identity = await hostStorage.get(OH.syntheticIdentity);
  if (!identity) return null;
  if (identity.user.id === userId) {
    return getIdentitySnapshot();
  }
  const users = (await hostStorage.get(OH.daemonUsers)) ?? [];
  const record = users.find((r) => r.user.id === userId);
  if (!record || record.deactivatedAt !== null) return null;

  const persisted = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];
  const wraByWorkspaceId = new Map<string, WorkspaceRoleAssignment>();
  for (const wra of persisted) {
    if (wra.principalId !== record.principal.id) continue;
    wraByWorkspaceId.set(wra.workspaceId, wra);
  }
  return {
    user: record.user,
    principal: record.principal,
    membership: record.membership,
    wraByWorkspaceId,
    orgs: new Map([[identity.org.id, identity.org]]),
  };
}
