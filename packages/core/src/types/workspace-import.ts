/**
 * Workspace-import dedup result types.
 *
 * The dedup walker (engine-side) scans prior import reports across
 * workspaces and surfaces matches; the import-preview UI renders them as
 * the soft-dedup banner. The data shapes live here so UI can read them
 * without depending on engine internals.
 */

import type { CollisionStrategy } from '../workspace-export';

export interface DedupMatchEntry {
  workspaceId: string;
  workspaceName: string;
  importedAt: string;
  exportId: string;
  /**
   * Snapshot of the prior import's per-entity strategies — keys are
   * `<entityType>:<uid>`, values are the collision strategy applied.
   * Carried only on `exportIdSameTarget` matches (the only arm where a
   * meaningful diff against the incoming envelope makes sense). Drives
   * the "show changes since last import" affordance in the soft-dedup
   * banner.
   */
  perEntityStrategies?: Record<string, CollisionStrategy>;
}

export interface DedupMatchesResult {
  /** Prior imports of the same `exportId` into the current target. */
  exportIdSameTarget: DedupMatchEntry[];
  /** Prior imports of the same `exportId` into other workspaces. */
  exportIdOtherTargets: DedupMatchEntry[];
  /** Workspaces whose `workspace.uid` matches the export's source workspace
   *  (and aren't already covered by an `exportId` match). */
  workspaceUidMatches: { workspaceId: string; workspaceName: string }[];
}

export interface FindMatchesArgs {
  exportId: string;
  /** Source workspace's uid from the incoming export envelope. */
  workspaceUid: string;
  /** The currently-selected import target id. `null` when target=new. */
  currentTargetWorkspaceId: string | null;
}
