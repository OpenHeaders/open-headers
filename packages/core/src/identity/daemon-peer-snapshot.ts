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
import { daemonUserPrincipalKind } from './daemon-users';
import { getIdentitySnapshot } from './registry';
import type { IdentitySnapshot } from './resolver';
import { resolveInternalWorkspaceIds } from './visibility-provider';

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
    // F5: the resolved kind + the live internal-visibility set — what
    // lets the resolver's internal read arm judge "member AND human"
    // without the seams threading workspace records themselves.
    principalKind: daemonUserPrincipalKind(record),
    internalReadWorkspaceIds: resolveInternalWorkspaceIds(),
  };
}

/**
 * How the user a peer acts as reads out to a human — consumed by the
 * ungated `oh.daemon.admin.status` visibility probe so the served
 * tab's awaiting-access screen can say who is signed in. Answers only
 * the caller's OWN identity; `email` is the primary identity row's
 * value when it is an email, null otherwise (the operator's synthetic
 * `local` row, an SSO subject). `null` for an unknown or deactivated
 * user — the same fail-closed line the capability snapshot draws.
 */
export interface DaemonPeerDisplayIdentity {
  readonly displayName: string;
  readonly email: string | null;
}

export async function resolveDaemonPeerDisplayIdentity(userId: string): Promise<DaemonPeerDisplayIdentity | null> {
  const identity = await hostStorage.get(OH.syntheticIdentity);
  if (!identity) return null;
  if (identity.user.id === userId) {
    return {
      displayName: identity.user.displayName,
      email: identity.userIdentity.kind === 'email' ? identity.userIdentity.value : null,
    };
  }
  const users = (await hostStorage.get(OH.daemonUsers)) ?? [];
  const record = users.find((r) => r.user.id === userId);
  if (!record || record.deactivatedAt !== null) return null;
  return {
    displayName: record.user.displayName,
    email: record.userIdentity.kind === 'email' ? record.userIdentity.value : null,
  };
}
