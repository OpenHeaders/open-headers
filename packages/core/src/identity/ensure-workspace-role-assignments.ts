/**
 * `ensureWorkspaceRoleAssignments` — host-neutral reconcile pass that
 * keeps `OH.workspaceRoleAssignments` aligned with the live workspace
 * set (U1.8 per UNIFIED_ORACLE_STATUS.md).
 *
 * Semantics:
 *
 *   - For every workspace id in the input set where the SYNTHETIC
 *     principal has no WRA → mint one with `role='owner'`. The mint
 *     check is principal-scoped: another principal's grant on a
 *     workspace (a daemon directory user's WRA, Phase 5) never
 *     suppresses the operator's owner row. The row id is derived
 *     deterministically from `(hostInstallId, workspaceId)` so a
 *     wipe-and-rebuild reproduces the same WRA id; orphan data
 *     referencing that id reconnects automatically.
 *   - For every persisted WRA — any principal's — whose `workspaceId`
 *     is no longer in the input set → drop it. A deleted workspace's
 *     grants are meaningless for every principal. Workspace deletion is
 *     the only WRA-drop path this reconcile owns; directory-user grant
 *     revocation lives in `workspace-role-grants.ts`, and promotion
 *     does not touch the principal-id (ADR-3) so WRAs stay stable
 *     across the synthetic-to-real transition.
 *   - A no-op call (no additions, no deletions) skips the storage write
 *     entirely.
 *
 * The helper requires `ensureSyntheticIdentity` to have already
 * persisted the synthetic principal — every host's boot path calls them
 * in that order.
 */

import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import type { Principal, WorkspaceRoleAssignment } from '../types';
import { createMutex } from '../utils/mutex';
import { deriveSyntheticUuidV7, SYNTHETIC_SEEDS } from './derive-uuid';
import { ensureDaemonConfig } from './ensure-daemon-config';

/**
 * Serializes every `OH.workspaceRoleAssignments` read-modify-write. Both
 * hosts fire this reconcile fire-and-forget from `onWorkspaceStoreChange`;
 * a burst of workspace mutations would otherwise overlap two
 * `get`-compute-`set` cycles, and the one that *completes* last wins —
 * not the one that read the latest workspace list — leaving the slot
 * stale until the next change. The mutex keeps reconciles strictly
 * ordered, so the last-fired call (which carries the latest list) also
 * writes last.
 *
 * Exported (as {@link withWorkspaceRoleAssignmentsLock}) because the slot
 * has a second writer since Phase 5: the directory-user grant surface in
 * `workspace-role-grants.ts`. A grant racing a reconcile under separate
 * mutexes would clobber one side's write; sharing the lock keeps every
 * writer strictly ordered.
 */
const reconcileLock = createMutex();

/** Run `fn` holding the `OH.workspaceRoleAssignments` writer lock. */
export function withWorkspaceRoleAssignmentsLock<T>(fn: () => Promise<T>): Promise<T> {
  return reconcileLock(fn);
}

/**
 * Reconcile the persisted WRA list against `workspaceIds`. Returns the
 * new list (post-reconciliation). Pure of any per-host transport beyond
 * the `HostStorage` proxy. Concurrent calls are serialized.
 */
export function ensureWorkspaceRoleAssignments(
  workspaceIds: ReadonlyArray<string>,
): Promise<WorkspaceRoleAssignment[]> {
  return reconcileLock(() => reconcileWorkspaceRoleAssignments(workspaceIds));
}

async function reconcileWorkspaceRoleAssignments(
  workspaceIds: ReadonlyArray<string>,
): Promise<WorkspaceRoleAssignment[]> {
  const principal = await readSyntheticPrincipalOrThrow();
  const { hostInstallId } = await ensureDaemonConfig();
  const persisted = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];

  const liveSet = new Set(workspaceIds);
  const kept = persisted.filter((wra) => liveSet.has(wra.workspaceId));
  // Mint-decision set is scoped to the SYNTHETIC principal's rows —
  // another principal's grant must not suppress the operator's owner WRA.
  const haveWorkspaceIds = new Set(
    kept.filter((wra) => wra.principalId === principal.id).map((wra) => wra.workspaceId),
  );

  const additions: WorkspaceRoleAssignment[] = [];
  for (const workspaceId of workspaceIds) {
    // `haveWorkspaceIds` also absorbs ids minted in this pass so a
    // duplicated entry in `workspaceIds` mints exactly one WRA.
    if (haveWorkspaceIds.has(workspaceId)) continue;
    haveWorkspaceIds.add(workspaceId);
    const id = await deriveSyntheticUuidV7(SYNTHETIC_SEEDS.workspaceRoleAssignment(hostInstallId, workspaceId));
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
