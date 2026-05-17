/**
 * Mode-switch decision types — shared by extension + desktop hosts so
 * the gating logic that fires when a user changes `backend.mode` is the
 * same on both sides. Pure shapes; no runtime state, no host plumbing.
 *
 * See `docs/DATA_PLANE_TOPOLOGIES.md` §11.2 for the three-option dialog
 * spec and short-circuits (source-empty / target-empty / both-empty).
 */

import type { NameCollision } from './name-collision';

/** Per-workspace entity tally. Keys are entity types ('rule', 'environment', etc.). */
export type EntityCounts = Readonly<Record<string, number>>;

/** Per-workspace snapshot — feeds the rollup and the M2 dialog copy. */
export interface WorkspaceContentSnapshot {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly entityCounts: EntityCounts;
}

/**
 * Host-level data presence after rolling up every workspace on that
 * host. The dialog renders `totalEntityCount` and the per-type
 * breakdown; the gating logic only reads `hasUserContent` +
 * `workspaceCount`.
 */
export interface DataPresenceSummary {
  readonly workspaceCount: number;
  /** True when at least one workspace contains a user-authored entity. */
  readonly hasUserContent: boolean;
  /** Sum across all workspaces of every per-type count. */
  readonly totalEntityCount: number;
  readonly workspaces: readonly WorkspaceContentSnapshot[];
}

export type ModeSwitchVerdict =
  | { kind: 'no-change' }
  /** Source has nothing worth preserving — commit the target silently. */
  | { kind: 'silent-use-target' }
  /** Target is empty — merge the source over and commit silently. */
  | { kind: 'silent-import-source' }
  /** Both sides empty — commit silently with no work. */
  | { kind: 'both-empty' }
  /** Peer host couldn't be queried (e.g. desktop not running). */
  | { kind: 'peer-unreachable' }
  /** Both sides have data — M2 dialog handles the resolution. */
  | {
      kind: 'show-dialog';
      source: DataPresenceSummary;
      target: DataPresenceSummary;
      /**
       * Source ↔ target workspace pairs whose display names collapse to
       * the same canonical form (NFC + trim + case-fold). Surfaced by
       * the dialog so the user can spot "this is the same workspace I
       * authored on both hosts" before Coexist mints duplicates. Empty
       * array when no collisions detected. See {@link NameCollision}.
       */
      nameCollisions: readonly NameCollision[];
    };

export interface ModeSwitchInput {
  /** Mode identifier being switched FROM (opaque string; passed through for telemetry). */
  readonly fromMode: string;
  readonly toMode: string;
  /** Presence on the host the user is on right now. */
  readonly source: DataPresenceSummary;
  /** Presence on the host the new mode points to. `null` ⇒ unreachable. */
  readonly target: DataPresenceSummary | null;
}
