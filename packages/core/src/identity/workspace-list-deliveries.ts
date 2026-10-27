/**
 * The hub's delivered-row ledger (the workspace-list scope plan, Part
 * 4) — which workspaces' `__global__` list-row history this host has
 * handed to which directory principal in full.
 *
 * The row-filtered catch-up resumes from the vector the peer presents,
 * like every other scope. A grant mutates no row, so a workspace
 * granted while the user was away sits entirely below their vector and
 * the delta stream alone would never reveal it; the responder streams
 * the full row history of every granted workspace this ledger has not
 * marked, and the handshake marks them once its SYNCED frame goes out.
 * A revoke clears the pair: the retraction evicts the user's copy, and
 * a later re-grant mints no row the vector could carry, so the next
 * join must reveal the workspace again.
 *
 * Host-local vocabulary beside the WRA rows (`OH.workspaceRoleAssignments`):
 * never on a wire, never in a mutation log, never in a snapshot. One
 * read-modify-write at a time through the module's own mutex.
 */

import { hostStorage } from '../storage/host-storage';
import { OH, type WorkspaceListDeliveryRecord } from '../storage/keys';
import { createMutex } from '../utils/mutex';

const ledgerLock = createMutex();

/** The workspace ids whose full row history `principalId` holds. */
export async function listDeliveredWorkspaceIds(principalId: string): Promise<ReadonlySet<string>> {
  const persisted = (await hostStorage.get(OH.workspaceListDeliveries)) ?? [];
  const delivered = new Set<string>();
  for (const row of persisted) {
    if (row.principalId === principalId) delivered.add(row.workspaceId);
  }
  return delivered;
}

/** Record that `principalId` now holds the full row history of each of `workspaceIds`. */
export function markWorkspaceListDelivered(principalId: string, workspaceIds: Iterable<string>): Promise<void> {
  return ledgerLock(async () => {
    const persisted = (await hostStorage.get(OH.workspaceListDeliveries)) ?? [];
    const held = new Set(persisted.filter((row) => row.principalId === principalId).map((row) => row.workspaceId));
    const additions: WorkspaceListDeliveryRecord[] = [];
    for (const workspaceId of workspaceIds) {
      if (held.has(workspaceId)) continue;
      held.add(workspaceId);
      additions.push({ principalId, workspaceId });
    }
    if (additions.length === 0) return;
    await hostStorage.set(OH.workspaceListDeliveries, [...persisted, ...additions]);
  });
}

/** Forget that `principalId` holds the row history of each of `workspaceIds`. */
export function clearWorkspaceListDelivered(principalId: string, workspaceIds: Iterable<string>): Promise<void> {
  return ledgerLock(async () => {
    const cleared = new Set(workspaceIds);
    const persisted = (await hostStorage.get(OH.workspaceListDeliveries)) ?? [];
    const next = persisted.filter((row) => !(row.principalId === principalId && cleared.has(row.workspaceId)));
    if (next.length === persisted.length) return;
    await hostStorage.set(OH.workspaceListDeliveries, next);
  });
}
