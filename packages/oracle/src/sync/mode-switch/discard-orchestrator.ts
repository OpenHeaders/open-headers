/**
 * Mode-switch Discard (M5) — local-only orchestrator.
 *
 * Glues {@link collectDiscardArchive} → {@link BackupWriter} → per-
 * workspace {@link deleteWorkspace}. The orchestrator owns three
 * sequencing decisions that don't belong in either half:
 *
 *   1. No writer installed → `backup-writer-unavailable` (skip
 *      collection + delete entirely; the user is intact).
 *   2. No resident workspaces → `no-source-data` (defensive — the
 *      dialog only mounts when source presence is non-empty, but a race
 *      could trim the source between gate and execute).
 *   3. Writer rejected → `backup-failed` (no delete runs; the user is
 *      intact). Delete loop rejected → `delete-failed` with the backup
 *      path preserved so the user can restore later.
 *
 * Order matters: the archive lands on disk BEFORE any workspace is
 * removed. A partial-write into a partial-delete would strand the user
 * with no recovery path. The same atomicity stance that M3 Coexist + M4
 * Import take for the apply path applies here for the destructive path.
 *
 * Host-neutral: extension SW + desktop main both call this through the
 * `oh.sync.executeDiscardWithBackup` channel and get the right behavior
 * based on whether {@link setBackupWriter} was called at boot and what
 * the writer was wired to.
 */

import type {
  DiscardBackupArchive,
  DiscardResult,
  DiscardedWorkspace,
} from '@openheaders/core/sync';
import { collectDiscardArchive } from './discard-collector';
import { getBackupWriter } from './backup-writer';
import { enumerateSnapshotEntities } from './import-applier';
import type { WorkspaceSnapshot } from '@openheaders/core/protocol';

export interface OrchestrateDiscardDeps {
  /** Resident workspaces on this host. Order is preserved into the archive + delete loop. */
  readonly workspaces: ReadonlyArray<{ id: string; name: string }>;
  /** Produces a full {@link WorkspaceSnapshot} for a workspace. Rejections → `backup-failed`. */
  readonly buildSnapshot: (workspaceId: string) => Promise<WorkspaceSnapshot>;
  /**
   * Removes the workspace through the standard mutator path. Rejections
   * → `delete-failed` with the resolved backup path preserved on the
   * result so the user can restore. The orchestrator does not stop on
   * the first delete rejection — it logs the offending workspace via
   * `detail` and returns; remaining workspaces stay in place rather
   * than being left in an indeterminate partial state.
   */
  readonly deleteWorkspace: (workspaceId: string) => Promise<unknown>;
  /**
   * ISO-8601 timestamp stamped onto the archive. Injected so the
   * orchestrator can pin a single moment-in-time across the whole run.
   * Production passes `new Date().toISOString()`; tests pass a fixed
   * value.
   */
  readonly now: () => string;
}

export async function orchestrateDiscardWithBackup(
  deps: OrchestrateDiscardDeps,
): Promise<DiscardResult> {
  const writer = getBackupWriter();
  if (!writer) {
    return {
      ok: false,
      reason: 'backup-writer-unavailable',
      detail: 'no backup writer installed',
    };
  }

  if (deps.workspaces.length === 0) {
    return { ok: false, reason: 'no-source-data' };
  }

  let archive: DiscardBackupArchive;
  try {
    archive = await collectDiscardArchive({
      workspaces: deps.workspaces,
      buildSnapshot: deps.buildSnapshot,
      generatedAt: deps.now(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'backup-failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  let backupPath: string;
  try {
    const written = await writer(archive);
    backupPath = written.backupPath;
  } catch (err) {
    return {
      ok: false,
      reason: 'backup-failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  // Pre-compute per-workspace user-content counts off the archive so
  // the toast can quote how much data was retired. enumerateSnapshotEntities
  // already skips singletons (workspace-variables, vault, …) — those
  // wouldn't change the user's mental model of "what did I just lose".
  const discardedWorkspaces: DiscardedWorkspace[] = archive.workspaces.map((w) => ({
    workspaceId: w.workspaceId,
    workspaceName: w.workspaceName,
    entityCount: enumerateSnapshotEntities(w.snapshot).length,
  }));

  for (const ws of deps.workspaces) {
    try {
      await deps.deleteWorkspace(ws.id);
    } catch (err) {
      return {
        ok: false,
        reason: 'delete-failed',
        detail: `${ws.name}: ${err instanceof Error ? err.message : String(err)}`,
        backupPath,
      };
    }
  }

  return {
    ok: true,
    backupPath,
    discardedWorkspaces,
  };
}
