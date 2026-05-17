/**
 * Mode-switch Restore (M6) — local recovery from a Discard archive.
 *
 * Restore is the inverse of M5 Discard: the user picks a previously
 * written {@link DiscardBackupArchive} from disk and the host replays
 * every workspace it carries into freshly-minted target workspaces.
 * Unlike M3 Coexist + M4 Import, no payload crosses the wire by way of
 * the peer — the archive is read renderer-side from a file picker and
 * shipped through a single local channel.
 *
 * Two contracts live here:
 *
 *   - {@link RestoredWorkspace} — one success row per workspace the
 *     applier successfully mounted. The renderer quotes the row count
 *     and total entities applied in the toast so the user can confirm
 *     the recovery's reach.
 *   - {@link RestoreResult} — the applier's return contract. Failures
 *     fall into three structural buckets that the toast translates into
 *     copy.
 *
 * **Cross-id semantic.** Restore mints a FRESH UUIDv7 per workspace via
 * the host's `createWorkspace` seam — the source-host ids the archive
 * preserves are informational only. This matches Coexist's apply path
 * exactly and means restore can run on the same host that wrote the
 * archive, on a different browser profile, or after a full extension
 * reinstall, without colliding with any workspaces the target now has.
 *
 * **Partial-apply stance.** Same as Coexist + Import: the first per-
 * workspace apply rejection short-circuits and returns `apply-failed`.
 * Earlier workspaces in the archive stay mounted (their seeds already
 * committed); the user can rerun restore against the same archive and
 * skip the survivors manually, or accept the partial recovery.
 */

import type { WorkspaceSnapshot } from '../../protocol/snapshot';
import type { DiscardBackupArchive } from './discard-types';

/** Re-export so the restore namespace stays self-contained at the import surface. */
export type { DiscardBackupArchive };

/** Per-workspace success row in {@link RestoreResult.restoredWorkspaces}. */
export interface RestoredWorkspace {
  /** Workspace id captured in the archive at backup time. Informational; the live id is `newWorkspaceId`. */
  readonly sourceWorkspaceId: string;
  /** Workspace id minted on the restoring host. */
  readonly newWorkspaceId: string;
  /** Display name carried over from the archive (also the name of the freshly minted workspace). */
  readonly workspaceName: string;
  /** Count of entities the snapshot applier wrote into the freshly-minted workspace. */
  readonly entitiesApplied: number;
}

/**
 * Reasons Restore can refuse cleanly.
 *
 * - `invalid-archive` — the picked file isn't a parsable
 *   {@link DiscardBackupArchive}: missing/wrong `schemaVersion`,
 *   malformed snapshot bodies, etc. Reported BEFORE any workspace is
 *   minted so the target host is untouched.
 * - `no-workspaces` — the archive parsed but carries an empty
 *   `workspaces` array. Defensive — the writer never emits empty
 *   archives but a hand-edited file could.
 * - `apply-failed` — at least one workspace's seed batch rejected after
 *   one or more earlier workspaces had already been mounted. The
 *   earlier mounts are preserved; the user can rerun against a fresh
 *   archive or live with the partial recovery.
 */
export type RestoreFailureReason = 'invalid-archive' | 'no-workspaces' | 'apply-failed';

export type RestoreResult =
  | {
      ok: true;
      restoredWorkspaces: readonly RestoredWorkspace[];
    }
  | {
      ok: false;
      reason: RestoreFailureReason;
      /** Optional human-readable trailer for telemetry. */
      detail?: string;
      /**
       * On `apply-failed`, the rows for workspaces that DID mount before
       * the failing one. Lets the toast tell the user "5 of 7 restored"
       * instead of "restore failed" when partial recovery happened.
       */
      restoredWorkspaces?: readonly RestoredWorkspace[];
    };

/**
 * Renderer-side guard. Validates the on-disk shape just enough to
 * reject hand-edited or unrelated JSON before any mutator runs. The
 * per-workspace snapshot bodies are validated downstream by the oracle
 * apply path; this check exists so a wrong-file pick returns
 * `invalid-archive` cleanly rather than blowing up the dispatcher.
 */
export function isDiscardBackupArchiveShape(value: unknown): value is DiscardBackupArchive {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  if (o.schemaVersion !== 1) return false;
  if (typeof o.generatedAt !== 'string' || o.generatedAt.length === 0) return false;
  if (!Array.isArray(o.workspaces)) return false;
  for (const w of o.workspaces as unknown[]) {
    if (typeof w !== 'object' || w === null) return false;
    const ws = w as Record<string, unknown>;
    if (typeof ws.workspaceId !== 'string' || ws.workspaceId.length === 0) return false;
    if (typeof ws.workspaceName !== 'string' || ws.workspaceName.length === 0) return false;
    const snap = ws.snapshot;
    if (typeof snap !== 'object' || snap === null) return false;
    const s = snap as Record<string, unknown>;
    if (typeof s.workspaceId !== 'string' || s.workspaceId.length === 0) return false;
    if (typeof s.schemaVersion !== 'number') return false;
  }
  return true;
}

/** Pulled out so consumers needing the snapshot type don't have to reach across files. */
export type { WorkspaceSnapshot };
