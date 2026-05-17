/**
 * Mode-switch Discard (M5) — wire + archive shapes.
 *
 * Discard is the local-only arm of the §11.2 three-option dialog: the
 * user's CURRENT-host data is BACKED UP TO DISK then DROPPED. Unlike
 * Coexist (M3) and Import (M4), no payload crosses the wire — the entire
 * sequence runs against the source host's own oracle. The peer is never
 * contacted; the user picks Discard precisely BECAUSE the peer is
 * authoritative for their working set going forward.
 *
 * Two contracts live here:
 *
 *   - {@link DiscardBackupArchive} — the on-disk shape the host-installed
 *     {@link BackupWriter} serializes. M6's restore reads the same shape
 *     back. Versioned at the archive level so a future field addition
 *     can carry a schema bump without touching the channel surface.
 *   - {@link DiscardResult} — the orchestrator's return contract. Carries
 *     the resolved backup path on success so the UI can quote it in the
 *     toast ("Backed up N workspaces to <path>").
 *
 * **Atomicity discipline.** The orchestrator writes the archive FIRST
 * and only proceeds to deletes if the write resolves. A partial archive
 * → partial delete combination would strand the user with no recovery
 * path, so any writer rejection short-circuits before any workspace is
 * removed. Once the archive is on disk, delete failures still report
 * `delete-failed` but the backup remains valid for M6 restore.
 */

import type { WorkspaceSnapshot } from '../../protocol/snapshot';

/**
 * One workspace as it appears inside a {@link DiscardBackupArchive}. The
 * snapshot is the full materialized post-state — same shape M3 Coexist
 * + M4 Import ship over the wire — so restore (M6) can replay it through
 * the standard {@link applyWorkspaceSnapshot} path against a freshly
 * minted workspace.
 */
export interface DiscardBackupWorkspace {
  /** Source-host workspace id at backup time. Preserved for telemetry / restore-with-same-id flows. */
  readonly workspaceId: string;
  /** Source-host display name at backup time. Restore reuses this when minting the recovered workspace. */
  readonly workspaceName: string;
  /** Full materialized post-state. Singletons + user-content alike — discard backs EVERYTHING up. */
  readonly snapshot: WorkspaceSnapshot;
}

/**
 * The on-disk archive a single Discard invocation produces. Hosts
 * serialize this exactly as written; restore (M6) deserializes against
 * the same shape. The schemaVersion + generatedAt fields let future
 * tooling reason about archive provenance without re-parsing the
 * snapshot bodies.
 */
export interface DiscardBackupArchive {
  /** Bump when the archive shape changes. M5 ships v1. */
  readonly schemaVersion: 1;
  /** ISO-8601 timestamp the host minted at backup time. */
  readonly generatedAt: string;
  /** Every workspace resident on the source host at backup time. */
  readonly workspaces: readonly DiscardBackupWorkspace[];
}

/** Per-workspace success row in {@link DiscardResult.discardedWorkspaces}. */
export interface DiscardedWorkspace {
  readonly workspaceId: string;
  readonly workspaceName: string;
  /** Count of user-content entities the snapshot carried (singletons excluded). Informational for the toast. */
  readonly entityCount: number;
}

/**
 * Reasons Discard can refuse without leaving the host half-cleared.
 *
 * - `no-source-data` — defensive; the dialog only mounts when source
 *   presence is non-empty, but a race could trim the source between
 *   gate and execute. Returned BEFORE any backup or delete runs.
 * - `backup-writer-unavailable` — no host-installed writer (boot race
 *   or absent integration). UI nudges the user to retry or update.
 * - `backup-failed` — the writer rejected (disk full, user cancelled
 *   the file picker, permissions, etc.). No workspace was deleted; the
 *   user is intact.
 * - `delete-failed` — the archive landed on disk but at least one
 *   workspace's removal rejected. The user can keep the archive +
 *   retry, or roll forward with the partial state. Detail carries the
 *   underlying mutator error for telemetry.
 */
export type DiscardFailureReason =
  | 'no-source-data'
  | 'backup-writer-unavailable'
  | 'backup-failed'
  | 'delete-failed';

export type DiscardResult =
  | {
      ok: true;
      /** Writer-resolved path string (a file path or a directory path, host-dependent). */
      backupPath: string;
      discardedWorkspaces: readonly DiscardedWorkspace[];
    }
  | {
      ok: false;
      reason: DiscardFailureReason;
      /** Optional human-readable trailer for telemetry; the renderer does not render it verbatim. */
      detail?: string;
      /** When `reason === 'delete-failed'` the archive WAS written; surface its path so the user can restore later. */
      backupPath?: string;
    };
