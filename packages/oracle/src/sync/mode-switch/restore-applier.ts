/**
 * Mode-switch Restore (M6) — local-only applier for a discard archive.
 *
 * Reads a {@link DiscardBackupArchive} the user picked from disk and
 * replays every workspace it carries through the standard
 * {@link applyWorkspaceSnapshot} path. Identity is cross-id by design:
 * the applier mints a FRESH UUIDv7 per archive entry via the host's
 * `createWorkspace` seam and retargets each snapshot at the freshly
 * minted id. The source-host ids the archive preserves are
 * informational only — the workspace ids the user discarded are
 * irretrievably gone and a clean restore must NOT collide with any
 * unrelated workspace that happens to live on the target host today.
 *
 * Structurally identical to {@link applyCoexistPayload} for that
 * reason — the only differences are the source of the snapshots (a
 * parsed file rather than a wire payload) and the per-workspace
 * success-row shape ({@link RestoredWorkspace}).
 *
 * Per-workspace error isolation is INTENTIONALLY ABSENT in the v1
 * slice (matches Coexist + Import). The first apply rejection short-
 * circuits with `apply-failed`; earlier workspaces that already mounted
 * stay mounted, and their rows are surfaced on the failure branch so
 * the toast can quote partial recovery. A rerun against the same
 * archive after fixing the underlying cause re-mounts the survivors
 * under different ids (createWorkspace mints fresh every time) — the
 * user can prune duplicates manually.
 */

import type {
  DiscardBackupArchive,
  DiscardBackupWorkspace,
  RestoreResult,
  RestoredWorkspace,
} from '@openheaders/core/sync';
import type { WorkspaceSnapshot } from '@openheaders/core/protocol';

/** Minimum surface the applier needs to mint a fresh workspace on the restoring host. */
export interface RestoreTargetMinter {
  /**
   * Mint a new workspace with the given name. Implementations MUST
   * generate a fresh UUIDv7 id; the returned tuple is what the applier
   * stamps into the rewritten snapshot.
   */
  createWorkspace: (input: { name: string }) => Promise<{ id: string; name: string }>;
}

export interface ApplyRestoreDeps extends RestoreTargetMinter {
  /**
   * Replay a snapshot into the workspace named by `snapshot.workspaceId`.
   * Production wires {@link applyWorkspaceSnapshot} under a freshly
   * acquired per-workspace service; tests inject a deterministic stub.
   * Throws → applier aborts with `apply-failed`.
   */
  applySnapshot: (snapshot: WorkspaceSnapshot) => Promise<{ entitiesApplied: number }>;
}

/**
 * Rewrite a snapshot's `workspaceId` to point at the freshly-minted
 * target workspace. Matches the Coexist applier's retarget — per-entity
 * post-state arrays don't carry their own workspaceId, so a shallow
 * rewrite is sufficient.
 */
function retargetSnapshot(snapshot: WorkspaceSnapshot, newWorkspaceId: string): WorkspaceSnapshot {
  return { ...snapshot, workspaceId: newWorkspaceId };
}

export async function applyDiscardRestoreArchive(
  archive: DiscardBackupArchive,
  deps: ApplyRestoreDeps,
): Promise<RestoreResult> {
  if (archive.workspaces.length === 0) {
    return { ok: false, reason: 'no-workspaces' };
  }

  const restored: RestoredWorkspace[] = [];

  for (const entry of archive.workspaces) {
    try {
      const row = await restoreOne(entry, deps);
      restored.push(row);
    } catch (err) {
      return {
        ok: false,
        reason: 'apply-failed',
        detail: errorDetail(err, entry.workspaceName),
        restoredWorkspaces: restored,
      };
    }
  }

  return { ok: true, restoredWorkspaces: restored };
}

async function restoreOne(
  entry: DiscardBackupWorkspace,
  deps: ApplyRestoreDeps,
): Promise<RestoredWorkspace> {
  const created = await deps.createWorkspace({ name: entry.workspaceName });
  const rewritten = retargetSnapshot(entry.snapshot, created.id);
  const { entitiesApplied } = await deps.applySnapshot(rewritten);
  return {
    sourceWorkspaceId: entry.workspaceId,
    newWorkspaceId: created.id,
    workspaceName: created.name,
    entitiesApplied,
  };
}

function errorDetail(err: unknown, sourceName: string): string {
  const base = err instanceof Error ? err.message : String(err);
  return `${sourceName}: ${base}`;
}
