/**
 * Mode-switch Import (M4) — wire shapes shared by source + target hosts.
 *
 * Import is the destructive-converge arm of the §11.2 three-option
 * dialog: the user's CURRENT-host data is merged into the TARGET host's
 * existing workspaces by routing every source envelope through the
 * standard HLC compare. Unlike Coexist (M3), no new workspaces are
 * minted — the source's workspaceId must already exist on the target,
 * and the source snapshot replays AGAINST it. Convergence is per-leaf
 * "newer wins" (§11.7).
 *
 * Wire framing reuses {@link WorkspaceSnapshot} verbatim — the
 * snapshot-builder/applier pair on the oracle already encodes every
 * user-content entity type the dialog talks about. M4 adds no per-entity
 * codec; the applier just routes the seed batches at the EXISTING target
 * workspace rather than a freshly-minted one.
 *
 * **v1 scope.** Same-workspaceId case only. A source workspace whose id
 * doesn't already exist on the target is recorded in
 * {@link ImportResult.ignored} and skipped — no rename, no Coexist
 * fallthrough. The cross-id branch is queued for M4b.
 */

import type { WorkspaceSnapshot } from '../../protocol/snapshot';

/**
 * One source workspace inside an {@link ImportPayload}. Structurally
 * identical to {@link CoexistSourceWorkspace}, kept as its own type so
 * the wire surface for Import is independently typed end-to-end —
 * changing the Coexist shape can't silently change Import's.
 */
export interface ImportSourceWorkspace {
  /** Source-host workspace id. The target replays into the workspace WITH THIS SAME ID, if any. */
  readonly sourceWorkspaceId: string;
  /** Source-host workspace display name. Used for log/telemetry strings; never mutated on the target. */
  readonly sourceWorkspaceName: string;
  /** Materialized post-state for every user-content entity in this workspace. */
  readonly snapshot: WorkspaceSnapshot;
}

/** Source → target wire frame. Empty `workspaces` means "nothing worth merging". */
export interface ImportPayload {
  readonly workspaces: readonly ImportSourceWorkspace[];
}

/**
 * One entity that existed on both the source and the target prior to
 * Import. Recorded after pre-apply id-intersection; the per-field HLC
 * winner is NOT carried — the toast surfaces the conflict count, and the
 * mutation log on each side already preserves the per-field history.
 */
export interface ImportConflictRow {
  readonly workspaceId: string;
  readonly entityType: string;
  readonly entityId: string;
}

/** Per-workspace success row in {@link ImportResult.mergedWorkspaces}. */
export interface ImportMergedWorkspace {
  /** Workspace id on both sides (Import is same-id by definition). */
  readonly workspaceId: string;
  /** Display name on the target side at apply time. */
  readonly workspaceName: string;
  /** Total user-content entities seeded into the target workspace. */
  readonly entitiesApplied: number;
  /** Pre-apply intersection of (type, id) pairs — entities present on both sides. */
  readonly conflicts: readonly ImportConflictRow[];
}

/**
 * One source workspace the target couldn't find a matching workspace
 * for. v1 ignores these (no rename, no Coexist fallthrough); M4b will
 * route them through a rename-or-defer decision.
 */
export interface ImportIgnoredWorkspace {
  readonly sourceWorkspaceId: string;
  readonly sourceWorkspaceName: string;
  /** `'no-matching-target'` is the only v1 reason; future variants enumerate cross-id resolutions. */
  readonly reason: 'no-matching-target';
}

/**
 * Reasons Import can refuse without a partial write.
 *
 * - `peer-write-unavailable` — current host can't push to the peer (no
 *   client transport, WS not connected, or the peer rejected the
 *   request). Same UX surface as Coexist's identical reason.
 * - `no-source-data` — defensive; the dialog only mounts when both
 *   sides have data, so this never fires end-to-end. Kept so the
 *   orchestrator has a non-throwing path if a race trims the source
 *   between presence collection and execute.
 * - `no-matching-workspace` — at least one source workspace was
 *   carried, but none of them matched a target workspace by id. The
 *   user is told to use Coexist instead (which mints fresh ids).
 * - `apply-failed` — the target attempted the apply but at least one
 *   workspace's seed batch rejected. Detail carries the underlying
 *   reason for telemetry; the renderer collapses to a generic toast.
 */
export type ImportFailureReason =
  | 'peer-write-unavailable'
  | 'no-source-data'
  | 'no-matching-workspace'
  | 'apply-failed';

export type ImportResult =
  | {
      ok: true;
      mergedWorkspaces: readonly ImportMergedWorkspace[];
      ignored: readonly ImportIgnoredWorkspace[];
      /** Sum of {@link ImportMergedWorkspace.entitiesApplied} across mergedWorkspaces. */
      totalEntitiesApplied: number;
      /** Sum of {@link ImportMergedWorkspace.conflicts}.length across mergedWorkspaces. */
      totalConflicts: number;
    }
  | {
      ok: false;
      reason: ImportFailureReason;
      /** Human-readable trailer for telemetry; the UI does not render it verbatim. */
      detail?: string;
    };
