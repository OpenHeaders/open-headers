/**
 * In-memory mirror of the persisted identity rows (`OH.syntheticIdentity`
 * + `OH.workspaceRoleAssignments`). The resolver reads from here
 * synchronously; the host's boot path keeps it warm by calling
 * `installIdentitySnapshot` after each `ensureSyntheticIdentity` /
 * `ensureWorkspaceRoleAssignments` cycle.
 *
 * Lives in core (not oracle) so the UI can consult the same snapshot for
 * button-gating without depending on the engine package.
 */

import type { Org, SyntheticIdentityRecord, WorkspaceRoleAssignment } from '../types';
import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import type { IdentitySnapshot } from './resolver';

let current: IdentitySnapshot | null = null;

export interface InstallIdentitySnapshotInput {
  record: SyntheticIdentityRecord;
  wras: ReadonlyArray<WorkspaceRoleAssignment>;
  /**
   * Orgs this host joined by connecting to other backends (Phase U5.2 —
   * "consume-first join"). Folded into `IdentitySnapshot.orgs` alongside
   * the synthetic home-org so `authorizedOrgIds` lets the joined
   * backend's workspaces sync down. Persisted under `OH.joinedOrgs`.
   */
  joinedOrgs?: ReadonlyArray<Org>;
}

/** Replace the in-memory snapshot. Called by the host after each ensure-*. */
export function installIdentitySnapshot(input: InstallIdentitySnapshotInput): IdentitySnapshot {
  const wraByWorkspaceId = new Map<string, WorkspaceRoleAssignment>();
  for (const wra of input.wras) {
    wraByWorkspaceId.set(wra.workspaceId, wra);
  }
  // Multi-org-native: `orgs` is a set on every host. The synthetic
  // home-org seeds it; Orgs joined via `recordJoinedOrg` fold in with no
  // change to the resolver or the org-catalogue helpers downstream. The
  // home-org row is written last so it always wins a same-id collision.
  const orgs = new Map<string, Org>();
  for (const org of input.joinedOrgs ?? []) {
    orgs.set(org.id, org);
  }
  orgs.set(input.record.org.id, input.record.org);
  current = {
    user: input.record.user,
    principal: input.record.principal,
    membership: input.record.membership,
    localAdmin: input.record.localAdmin,
    wraByWorkspaceId,
    orgs,
  };
  return current;
}

/** Read the current in-memory snapshot. Returns `null` before first install. */
export function getIdentitySnapshot(): IdentitySnapshot | null {
  return current;
}

/** Drop the in-memory snapshot. Test-only. */
export function clearIdentitySnapshot(): void {
  current = null;
}

/**
 * Refresh from `HostStorage` — useful when the snapshot is consumed in a
 * context that hasn't seen a boot-time install (e.g. a worker that
 * survives across SW restarts). Returns the resulting snapshot.
 */
export async function refreshIdentitySnapshotFromHostStorage(): Promise<IdentitySnapshot | null> {
  const record = await hostStorage.get(OH.syntheticIdentity);
  if (!record) {
    current = null;
    return null;
  }
  const wras = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];
  const joinedOrgs = (await hostStorage.get(OH.joinedOrgs)) ?? [];
  return installIdentitySnapshot({ record, wras, joinedOrgs });
}

/**
 * Record an Org joined by connecting to another backend (Phase U5.2).
 * Appends `org` to the persisted `OH.joinedOrgs` set (deduplicated by
 * id; the synthetic home-org is never stored here — it already rides
 * `OH.syntheticIdentity`), then rebuilds the in-memory snapshot so the
 * resolver's `authorizedOrgIds` immediately includes it and the joined
 * backend's workspaces sync down.
 *
 * Idempotent: re-joining the same backend (every reconnect re-sends
 * WELCOME) is a no-op once the Org is already on file.
 */
export async function recordJoinedOrg(org: Org): Promise<IdentitySnapshot | null> {
  const record = await hostStorage.get(OH.syntheticIdentity);
  if (record && record.org.id === org.id) {
    // The joiner's own home-org — nothing to record. Reached only if a
    // host somehow handshakes against itself; harmless to ignore.
    return refreshIdentitySnapshotFromHostStorage();
  }
  const existing = (await hostStorage.get(OH.joinedOrgs)) ?? [];
  const known = existing.find((o) => o.id === org.id);
  if (!known) {
    await hostStorage.set(OH.joinedOrgs, [...existing, org]);
  } else if (known.name !== org.name || known.isSynthetic !== org.isSynthetic) {
    // The backend renamed its Org since the last join — keep the
    // freshest copy so the org-catalogue UI doesn't render a stale name.
    await hostStorage.set(
      OH.joinedOrgs,
      existing.map((o) => (o.id === org.id ? org : o)),
    );
  }
  return refreshIdentitySnapshotFromHostStorage();
}
