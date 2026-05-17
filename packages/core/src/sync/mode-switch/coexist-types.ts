/**
 * Mode-switch Coexist (M3) — wire shapes shared by source + target hosts.
 *
 * Coexist is the non-destructive arm of the §11.2 three-option dialog:
 * the user's CURRENT-host data is replicated onto the TARGET host as a
 * freshly-minted `"<source name> (imported)"` workspace per source
 * workspace; the target's existing workspaces are untouched.
 *
 * Identity model (§11.3): every imported workspace gets a brand-new
 * UUIDv7 on the target. Source workspace ids never cross the wire as
 * the new workspace's identity — they are carried only as a back-pointer
 * for telemetry. This is the same anti-collision rule as the rest of
 * the data plane: two hosts that coincidentally share a workspaceId
 * (e.g. legacy non-UUIDv7 import) MUST not auto-merge.
 *
 * Wire framing reuses {@link WorkspaceSnapshot} verbatim — the
 * `snapshot-builder` + `snapshot-applier` pair on the oracle already
 * encodes every user-content entity type the dialog talks about. M3
 * adds no per-entity codec.
 */

import type { WorkspaceSnapshot } from '../../protocol/snapshot';

/**
 * One source workspace inside a {@link CoexistPayload}. The snapshot is
 * the full materialized post-state of every per-workspace entity at the
 * moment Coexist fires; the source name is the user-visible label that
 * gets the `" (imported)"` suffix when the target mints its replacement
 * workspace.
 */
export interface CoexistSourceWorkspace {
  /** Source-host workspace id. Carried for telemetry only — never reused as the target id. */
  readonly sourceWorkspaceId: string;
  /** Source-host workspace display name. The target appends `" (imported)"` when minting. */
  readonly sourceWorkspaceName: string;
  /** Materialized post-state for every user-content entity in this workspace. */
  readonly snapshot: WorkspaceSnapshot;
}

/** Source → target wire frame. Empty `workspaces` array means "nothing worth copying". */
export interface CoexistPayload {
  readonly workspaces: readonly CoexistSourceWorkspace[];
}

/** Per-workspace success row in {@link CoexistResult}. */
export interface CoexistImportedWorkspace {
  readonly sourceWorkspaceId: string;
  readonly sourceWorkspaceName: string;
  /** Freshly-minted UUIDv7 on the target host. */
  readonly newWorkspaceId: string;
  /** Display name actually written on the target (source name + `" (imported)"`). */
  readonly newWorkspaceName: string;
  /** Total user-content entities seeded into the new workspace. */
  readonly entitiesApplied: number;
}

/**
 * Reasons Coexist can refuse without a partial write.
 *
 * - `peer-write-unavailable` — current host can't push to the peer
 *   (no client transport, WS not connected, or the peer rejected the
 *   request). The dialog falls back to advising Discard-with-backup.
 * - `no-source-data` — defensive; the dialog only mounts when both
 *   sides have data, so this should never fire end-to-end. Kept so the
 *   orchestrator has a non-throwing path if a race trims the source
 *   between presence collection and execute.
 * - `apply-failed` — the target attempted the apply but at least one
 *   workspace's seed batch rejected. Detail carries the underlying
 *   reason for telemetry; the renderer collapses to a generic toast.
 */
export type CoexistFailureReason =
  | 'peer-write-unavailable'
  | 'no-source-data'
  | 'apply-failed';

export type CoexistResult =
  | {
      ok: true;
      imported: readonly CoexistImportedWorkspace[];
      /** Sum of {@link CoexistImportedWorkspace.entitiesApplied} across `imported`. */
      totalEntitiesApplied: number;
    }
  | {
      ok: false;
      reason: CoexistFailureReason;
      /** Human-readable trailer for telemetry; the UI does not render it verbatim. */
      detail?: string;
    };
