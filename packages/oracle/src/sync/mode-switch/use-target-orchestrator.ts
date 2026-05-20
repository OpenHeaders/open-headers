/**
 * Mode-switch Use-Target (U5.4) — local-only orchestrator.
 *
 * The "use the target's data only" arm of the Phase U5 mode-switch
 * model (`UNIFIED_ORACLE_STATUS.md` Phase U5). After a join (U5.2)
 * folds the target backend's `Org` into this host's authorized set,
 * Use-Target retires THIS host's own workspaces — exports them to a
 * local backup file, then deletes them — so the user works purely
 * against the target's data going forward.
 *
 * The key distinction from a plain Discard: Use-Target retires ONLY
 * the workspaces bound to an `Org` other than the joined target. The
 * target's own workspaces, having synced down after the join, stay
 * put — deleting them would discard the very data the user chose to
 * adopt. A plain Discard (the standalone backup-and-wipe feature)
 * retires every resident workspace; Use-Target is the join-time subset.
 *
 * Mechanically identical to Discard once the subset is chosen — export
 * to the host-installed {@link BackupWriter}, then delete through the
 * standard mutator path, archive-before-delete atomicity intact. So
 * this orchestrator filters to the host's own workspaces and delegates
 * the proven collect → write → delete sequence to
 * {@link orchestrateDiscardWithBackup}; the result contract is shared
 * ({@link DiscardResult}) — both produce "backed up N workspaces to
 * <path>".
 *
 * **Posture.** Unlike Combine (U5.3), Use-Target is offered on every
 * backend posture — it never pushes the joiner's data up, it retires
 * it locally. The mode-switch dialog (U5.5) owns option presentation.
 *
 * Host-neutral: extension SW + desktop main both call this through the
 * `oh.sync.executeUseTarget` channel.
 */

import type { WorkspaceSnapshot } from '@openheaders/core/protocol';
import type { DiscardResult } from '@openheaders/core/sync';
import { orchestrateDiscardWithBackup } from './discard-orchestrator';

export interface UseTargetWorkspaceInput {
  readonly id: string;
  readonly name: string;
  /** The workspace's current `Org` binding. */
  readonly orgId: string;
}

export interface OrchestrateUseTargetDeps {
  /**
   * The joined backend's `Org` (U5.2). Workspaces bound to it are kept;
   * everything else is this host's own and gets retired. The dispatcher
   * verifies it is in the authorized set before calling in.
   */
  readonly targetOrgId: string;
  /** Resident workspaces on this host with their current `Org` binding. */
  readonly workspaces: ReadonlyArray<UseTargetWorkspaceInput>;
  /** Produces a full snapshot for the archive; `null` for cross-Org workspaces. */
  readonly buildSnapshot: (workspaceId: string) => Promise<WorkspaceSnapshot | null>;
  /** Removes a workspace through the standard mutator path. */
  readonly deleteWorkspace: (workspaceId: string) => Promise<unknown>;
  /** ISO-8601 clock, injected so the run pins one moment. */
  readonly now: () => string;
}

export async function orchestrateUseTarget(deps: OrchestrateUseTargetDeps): Promise<DiscardResult> {
  // This host's own workspaces — anything not already bound to the
  // joined target. An empty subset falls through to the discard
  // orchestrator's `no-source-data` ("nothing of yours to retire").
  const ownWorkspaces = deps.workspaces.filter((w) => w.orgId !== deps.targetOrgId);
  return orchestrateDiscardWithBackup({
    workspaces: ownWorkspaces.map((w) => ({ id: w.id, name: w.name })),
    buildSnapshot: deps.buildSnapshot,
    deleteWorkspace: deps.deleteWorkspace,
    now: deps.now,
  });
}
