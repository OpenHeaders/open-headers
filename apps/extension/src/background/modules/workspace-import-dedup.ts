/**
 * Cross-workspace dedup walker for the workspace-import preview modal.
 *
 * Drives the **soft-dedup banner** (design §5.2). Walks every
 * workspace's `oh.ws.<id>.importReports` ring looking for prior imports
 * that match the incoming export by `exportId` (most specific) or by
 * `workspace.uid` (fallback — Alice→Bob refresh case).
 *
 * Pure read; no locks. The banner is a UX hint, not a guard rail —
 * users can re-import the same export as many times as they want.
 */

import type { WorkspaceExportImportReport } from '@openheaders/core/import';
import { ImportReportSchema } from '@openheaders/core/import';
import { parseEntityArray } from '@openheaders/core/schemas';
import type { CollisionStrategy } from '@openheaders/core/workspace-export';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { listWorkspaces } from './workspace-store';

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
   * banner (design §5.2 + §11 PR 5).
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

async function readRing(workspaceId: string): Promise<WorkspaceExportImportReport[]> {
  const key = wsKeys(workspaceId).importReports;
  const raw = await extensionStorage.get(key);
  if (!Array.isArray(raw)) return [];
  const parsed = parseEntityArray(ImportReportSchema, raw);
  return parsed.filter((r): r is WorkspaceExportImportReport => r.source === 'workspace-export');
}

export async function findExportImportMatches(args: FindMatchesArgs): Promise<DedupMatchesResult> {
  const workspaces = listWorkspaces();
  const exportIdSameTarget: DedupMatchEntry[] = [];
  const exportIdOtherTargets: DedupMatchEntry[] = [];
  const exportIdHits = new Set<string>();

  await Promise.all(
    workspaces.map(async (ws) => {
      const reports = await readRing(ws.id);
      for (const r of reports) {
        if (r.exportId === args.exportId) {
          const entry: DedupMatchEntry = {
            workspaceId: ws.id,
            workspaceName: ws.name,
            importedAt: r.importedAt,
            exportId: r.exportId,
          };
          if (ws.id === args.currentTargetWorkspaceId) {
            entry.perEntityStrategies = r.perEntityStrategies;
            exportIdSameTarget.push(entry);
          } else exportIdOtherTargets.push(entry);
          exportIdHits.add(ws.id);
        }
      }
    }),
  );

  // workspace.uid match — only for workspaces that don't already have an
  // exportId hit (those are the "more specific" signal per §5.2). The
  // gatherer fills `workspace.uid` from the ExtensionWorkspace's `id`
  // field, so we match against that.
  const workspaceUidMatches = workspaces
    .filter((w) => !exportIdHits.has(w.id) && w.id === args.workspaceUid)
    .map((w) => ({ workspaceId: w.id, workspaceName: w.name }));

  // Sort by importedAt desc — newest first.
  const byTimeDesc = (a: DedupMatchEntry, b: DedupMatchEntry) => b.importedAt.localeCompare(a.importedAt);
  exportIdSameTarget.sort(byTimeDesc);
  exportIdOtherTargets.sort(byTimeDesc);

  return { exportIdSameTarget, exportIdOtherTargets, workspaceUidMatches };
}
