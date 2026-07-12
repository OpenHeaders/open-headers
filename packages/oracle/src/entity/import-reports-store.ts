/**
 * Import Reports Store — SW-side owner of the structured per-workspace
 * import-report ring (ARCHITECTURE.md §23).
 *
 * Every importer (curl today; HAR / Postman / etc. later) emits an
 * `ImportReport` summarizing what came in, what was dropped, and what
 * was transformed. We persist the last N reports per workspace so:
 *   • Users can audit past imports long after the fact (ARCHITECTURE
 *     §23 — "actionable, not descriptive").
 *   • The re-import-diff flow has a baseline to compare against when
 *     the same source is re-imported (keyed by `sourceHash`).
 *   • Bug reports can attach the import history alongside the
 *     observability log — same export ergonomics.
 *
 * Semantics:
 *   • **Dedup by sourceHash.** A re-import of the same source
 *     replaces the previous entry rather than appending. Sparse
 *     sourceHash values (empty string on legacy entries) are always
 *     appended — they're treated as distinct events.
 *   • **Ring cap** (default 50). Oldest entries fall out when full.
 *   • **Per-workspace key** (`oh.ws.<id>.importReports`). Workspace
 *     delete purges the ring along with every other per-workspace
 *     data key.
 *   • **No telemetry.** Same trust commitment as the observability
 *     log — nothing leaves the device.
 */

import type { ImportReport } from '@openheaders/core/import';
import { ImportReportSchema } from '@openheaders/core/import';
import { parseEntityArray } from '@openheaders/core/schemas';
import { logger } from '@openheaders/core/utils';
import { entityLockName, withLock } from '@openheaders/oracle/coordination';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';

const RING_CAP = 50;

/** Locked-down async wrapper for any read-modify-write on the ring.
 *  The lock is origin-scoped (single tab per workspace) so cross-tab
 *  concurrent imports serialize at the storage boundary. */
async function withReportsLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(entityLockName(workspaceId, 'import-reports', 'singleton'), fn, { op: 'import-reports-mutate' });
}

async function readRing(workspaceId: string): Promise<ImportReport[]> {
  const key = wsKeys(workspaceId).importReports;
  const raw = await hostStorage.get(key);
  if (!Array.isArray(raw)) return [];
  // Validate each entry with the schema; drop the ones that don't
  // parse rather than letting a corrupt blob poison the list. The
  // ring is user-audit data (not a source of truth), so silent-drop
  // is the right failure mode here.
  return parseEntityArray(ImportReportSchema, raw);
}

async function writeRing(workspaceId: string, reports: ImportReport[]): Promise<void> {
  const key = wsKeys(workspaceId).importReports;
  await hostStorage.set(key, reports);
}

/**
 * Record a new import report. If a report with the same `sourceHash`
 * already exists (and the hash is non-empty), it's replaced;
 * otherwise the report is appended. Ring is capped at {@link RING_CAP}
 * entries — oldest fall out.
 *
 * `workspaceId` targets an explicit workspace's ring (background
 * imports landing outside the active workspace, e.g. the migration
 * pull's landing workspace); omitted, the active workspace applies.
 */
export async function recordImportReport(report: ImportReport, targetWorkspaceId?: string): Promise<void> {
  const workspaceId = targetWorkspaceId ?? requireActiveWorkspaceId();
  await withReportsLock(workspaceId, async () => {
    const current = await readRing(workspaceId);
    let next: ImportReport[];
    if (report.sourceHash && report.sourceHash.length > 0) {
      const idx = current.findIndex((r) => r.sourceHash === report.sourceHash);
      if (idx >= 0) {
        next = [...current.slice(0, idx), report, ...current.slice(idx + 1)];
      } else {
        next = [...current, report];
      }
    } else {
      // No hash — treat as a distinct event. Still subject to the cap.
      next = [...current, report];
    }
    if (next.length > RING_CAP) next = next.slice(next.length - RING_CAP);
    await writeRing(workspaceId, next);
    logger.debug('ImportReportsStore', `Recorded ${report.source} report (${next.length}/${RING_CAP})`);
  });
}

/**
 * Read the current ring. Ordering is insertion order — oldest first,
 * newest last. Callers rendering a list typically reverse() for a
 * "most-recent-first" UX.
 */
export async function listImportReports(): Promise<ImportReport[]> {
  const workspaceId = requireActiveWorkspaceId();
  return readRing(workspaceId);
}

/**
 * Look up a prior report for the active workspace by `sourceHash`.
 * Empty-hash queries always return `null` — the empty string means
 * "unhashed" and isn't identifying. Used by the re-import-diff flow
 * to detect a re-paste of the same source text and render a diff
 * panel against the prior report.
 */
export async function findImportReportBySourceHash(
  sourceHash: string,
  targetWorkspaceId?: string,
): Promise<ImportReport | null> {
  if (!sourceHash || sourceHash.length === 0) return null;
  const workspaceId = targetWorkspaceId ?? requireActiveWorkspaceId();
  const current = await readRing(workspaceId);
  return current.find((r) => r.sourceHash === sourceHash) ?? null;
}

/** Drop every report for the active workspace. */
export async function clearImportReports(): Promise<void> {
  const workspaceId = requireActiveWorkspaceId();
  await withReportsLock(workspaceId, async () => {
    await writeRing(workspaceId, []);
    logger.info('ImportReportsStore', `Cleared import reports (ws=${workspaceId})`);
  });
}

// Per-workspace purge-on-delete is handled by the orchestrator's
// `perWorkspaceDataKeys` list (includes `importReports`) — no
// dedicated purge helper needed since we only own one storage key.
