/**
 * `ensureWorkspaceRoleAssignments` — host-neutral reconcile pass that
 * keeps `OH.workspaceRoleAssignments` aligned with the live workspace
 * set (U1.8 per UNIFIED_ORACLE_STATUS.md).
 *
 * Semantics:
 *
 *   - For every workspace id in the input set with no existing WRA →
 *     mint one with `role='owner'` for the synthetic principal. The row
 *     id is derived deterministically from `(hostInstallId,
 *     workspaceId)` so a wipe-and-rebuild reproduces the same WRA id;
 *     orphan data referencing that id reconnects automatically.
 *   - For every persisted WRA whose `workspaceId` is no longer in the
 *     input set → drop it. Workspace deletion is the only WRA-drop path
 *     today; promotion does not touch the principal-id (ADR-3) so WRAs
 *     stay stable across the synthetic-to-real transition.
 *   - A no-op call (no additions, no deletions) skips the storage write
 *     entirely.
 *
 * The helper requires `ensureSyntheticIdentity` to have already
 * persisted the synthetic principal — every host's boot path calls them
 * in that order.
 */

import type { Principal, WorkspaceRoleAssignment } from '../types';
import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import { ensureDaemonConfig } from './ensure-daemon-config';
import { deriveSyntheticUuidV7, SYNTHETIC_SEEDS } from './derive-uuid';

/**
 * Serialization tail. Both hosts fire this reconcile fire-and-forget
 * from `onWorkspaceStoreChange`; a burst of workspace mutations would
 * otherwise overlap two `get`-compute-`set` cycles, and the one that
 * *completes* last wins — not the one that read the latest workspace
 * list — leaving `OH.workspaceRoleAssignments` stale until the next
 * change. Chaining each call off the previous keeps reconciles strictly
 * ordered, so the last-fired call (which carries the latest list) also
 * writes last. A rejection is swallowed on the chain so it never blocks
 * a following reconcile; the caller still observes its own rejection.
 */
let chain: Promise<unknown> = Promise.resolve();

/**
 * Reconcile the persisted WRA list against `workspaceIds`. Returns the
 * new list (post-reconciliation). Pure of any per-host transport beyond
 * the `HostStorage` proxy. Concurrent calls are serialized.
 */
export function ensureWorkspaceRoleAssignments(
  workspaceIds: ReadonlyArray<string>,
): Promise<WorkspaceRoleAssignment[]> {
  const run = (): Promise<WorkspaceRoleAssignment[]> => reconcileWorkspaceRoleAssignments(workspaceIds);
  const result = chain.then(run, run);
  chain = result.catch(() => undefined);
  return result;
}

async function reconcileWorkspaceRoleAssignments(
  workspaceIds: ReadonlyArray<string>,
): Promise<WorkspaceRoleAssignment[]> {
  const principal = await readSyntheticPrincipalOrThrow();
  const { hostInstallId } = await ensureDaemonConfig();
  const persisted = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];

  const liveSet = new Set(workspaceIds);
  const kept = persisted.filter((wra) => liveSet.has(wra.workspaceId));
  const haveWorkspaceIds = new Set(kept.map((wra) => wra.workspaceId));

  const additions: WorkspaceRoleAssignment[] = [];
  for (const workspaceId of workspaceIds) {
    // `haveWorkspaceIds` also absorbs ids minted in this pass so a
    // duplicated entry in `workspaceIds` mints exactly one WRA.
    if (haveWorkspaceIds.has(workspaceId)) continue;
    haveWorkspaceIds.add(workspaceId);
    const id = await deriveSyntheticUuidV7(
      SYNTHETIC_SEEDS.workspaceRoleAssignment(hostInstallId, workspaceId),
    );
    additions.push({
      id,
      principalId: principal.id,
      workspaceId,
      role: 'owner',
    });
  }

  const next = [...kept, ...additions];
  const noChange = persisted.length === next.length && additions.length === 0;
  if (!noChange) {
    await hostStorage.set(OH.workspaceRoleAssignments, next);
  }
  return next;
}

async function readSyntheticPrincipalOrThrow(): Promise<Principal> {
  const record = await hostStorage.get(OH.syntheticIdentity);
  if (!record) {
    throw new Error(
      'ensureWorkspaceRoleAssignments: synthetic identity record missing — call ensureSyntheticIdentity first.',
    );
  }
  return record.principal;
}
