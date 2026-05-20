/**
 * Mode-switch decision types — shared by extension + desktop hosts so
 * the gating logic that fires when a user changes `backend.mode` is the
 * same on both sides. Pure shapes; no runtime state, no host plumbing.
 *
 * See `docs/DATA_PLANE_TOPOLOGIES.md` §11.2 for the three-option dialog
 * spec and short-circuits (source-empty / target-empty / both-empty).
 */

import type { Org } from '../../types';

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
  /** Both sides have data — the Phase U5 mode-switch dialog resolves it. */
  | {
      kind: 'show-dialog';
      source: DataPresenceSummary;
      target: DataPresenceSummary;
      /**
       * The target backend's home `Org`, read from the verdict probe's
       * WELCOME (Phase U5.2 carries it). The dialog's Combine / Use-
       * Target executors re-home into / retire against this `Org` id.
       * `null` when the target backend's handshake carried no `Org`
       * (a backend that doesn't bootstrap a synthetic identity) — the
       * dialog then disables the outcomes that need a target `Org`.
       */
      targetOrg: Org | null;
    };

export interface ModeSwitchInput {
  /** Mode identifier being switched FROM (opaque string; passed through for telemetry). */
  readonly fromMode: string;
  readonly toMode: string;
  /** Presence on the host the user is on right now. */
  readonly source: DataPresenceSummary;
  /** Presence on the host the new mode points to. `null` ⇒ unreachable. */
  readonly target: DataPresenceSummary | null;
  /**
   * The target backend's home `Org`, as carried by the probe's WELCOME
   * (Phase U5.2). Forwarded verbatim onto a `show-dialog` verdict so
   * the Combine / Use-Target executors know which `Org` to re-home
   * into. `null` / omitted when the target is unreachable or carried
   * no `Org`.
   */
  readonly targetOrg?: Org | null;
}
