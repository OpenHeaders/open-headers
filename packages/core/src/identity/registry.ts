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

import type { SyntheticIdentityRecord, WorkspaceRoleAssignment } from '../types';
import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import type { IdentitySnapshot } from './resolver';

let current: IdentitySnapshot | null = null;

export interface InstallIdentitySnapshotInput {
  record: SyntheticIdentityRecord;
  wras: ReadonlyArray<WorkspaceRoleAssignment>;
}

/** Replace the in-memory snapshot. Called by the host after each ensure-*. */
export function installIdentitySnapshot(input: InstallIdentitySnapshotInput): IdentitySnapshot {
  const wraByWorkspaceId = new Map<string, WorkspaceRoleAssignment>();
  for (const wra of input.wras) {
    wraByWorkspaceId.set(wra.workspaceId, wra);
  }
  current = {
    user: input.record.user,
    principal: input.record.principal,
    membership: input.record.membership,
    localAdmin: input.record.localAdmin,
    wraByWorkspaceId,
    // Multi-org-native: `orgs` is a set on every host. V5 seeds the one
    // synthetic home-org row; real Orgs joined later fold in here with
    // no change to the resolver or the org-catalogue helpers downstream.
    orgs: new Map([[input.record.org.id, input.record.org]]),
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
  return installIdentitySnapshot({ record, wras });
}
