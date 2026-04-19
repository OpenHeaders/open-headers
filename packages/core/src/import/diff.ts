/**
 * Re-import diff — pure function that compares a new `ImportReport`
 * against a previous one (same `sourceHash`) and surfaces what
 * changed since the last import.
 *
 * ARCHITECTURE.md §23 prescribes: "On re-import, hash the source; if
 * it matches a prior import, the report is a diff against the
 * previous one: '3 new drops since last import, 1 previously dropped
 * thing is now supported.' Users re-importing a Postman collection
 * after every Postman update do not lose track of what's new."
 *
 * Design decisions:
 *   1. **Identity = `path`.** Drops and transforms are keyed by the
 *      source-path field (e.g. `collection.item[5].request.auth`).
 *      Drops describe a LOCATION that couldn't be mapped; if the
 *      same location's reason text changes (importer upgraded to
 *      partial support but still dropped), the entry is treated as
 *      "persistent" with the NEW reason visible — not duplicated as
 *      resolved + new. Users care about location-level churn.
 *   2. **Summary delta is `next - previous`.** Positive `dropped`
 *      means the new import dropped more entries than before — the
 *      importer got more lossy, or the source gained unsupported
 *      fields. Negative means things got better.
 *   3. **Pure function.** No side effects; inputs treated as
 *      readonly; outputs are fresh arrays/objects. Callers compose
 *      it freely (UI preview, CLI diff tool, test assertions).
 *   4. **Structurally compatible with re-import flow.** The caller
 *      locates the previous report via `sourceHash` (stored by the
 *      SW-side ring, keyed by `oh.ws.<id>.importReports`), passes
 *      both reports to `diffImportReports`, and renders the result
 *      in the import modal's diff panel.
 */

import type { ImportDrop, ImportReport, ImportSummary, ImportTransform } from './report';

export interface ImportSummaryDelta {
  imported: number;
  dropped: number;
  transformed: number;
}

/**
 * Shared shape for drop + transform partitioning:
 *   • `added`       — in `next` but not in `previous` (regression — importer lost ground)
 *   • `resolved`    — in `previous` but not in `next` (progress — importer gained ground)
 *   • `persistent`  — in both (still-unsolved entries; the new reason is carried)
 */
export interface ReportDiffPartition<T> {
  added: readonly T[];
  resolved: readonly T[];
  persistent: readonly T[];
}

export interface ImportReportDiff {
  source: ImportReport['source'];
  sourceHash: string;
  previousImportedAt: string;
  nextImportedAt: string;
  summaryDelta: ImportSummaryDelta;
  previousSummary: ImportSummary;
  nextSummary: ImportSummary;
  drops: ReportDiffPartition<ImportDrop>;
  transforms: ReportDiffPartition<ImportTransform>;
  /**
   * True when there is any user-visible change — drops/transforms
   * partition is non-trivial or summary counts differ. Consumers use
   * this to decide whether to render the diff panel at all (no point
   * showing "identical to previous import" as a banner).
   */
  hasChanges: boolean;
}

// ── Diff ────────────────────────────────────────────────────────────

/**
 * Compare two import reports. The caller is responsible for ensuring
 * both reports share the same `sourceHash` — the diff itself does not
 * validate that invariant (different-hash inputs produce a valid but
 * semantically meaningless diff, which is the caller's concern).
 *
 * The `previous` report's `source` is authoritative for the diff's
 * `source` field. If the source type changed (e.g., the user renamed
 * a curl importer's output to a HAR file), the diff's source reflects
 * the older report — the caller should detect this before invoking
 * and present an appropriate UI ("different importer than last time").
 */
export function diffImportReports(previous: ImportReport, next: ImportReport): ImportReportDiff {
  const drops = diffByPath(previous.drops, next.drops);
  const transforms = diffByPath(previous.transforms, next.transforms);

  const summaryDelta: ImportSummaryDelta = {
    imported: next.summary.imported - previous.summary.imported,
    dropped: next.summary.dropped - previous.summary.dropped,
    transformed: next.summary.transformed - previous.summary.transformed,
  };

  const hasChanges =
    drops.added.length > 0 ||
    drops.resolved.length > 0 ||
    transforms.added.length > 0 ||
    transforms.resolved.length > 0 ||
    summaryDelta.imported !== 0 ||
    summaryDelta.dropped !== 0 ||
    summaryDelta.transformed !== 0;

  return {
    source: previous.source,
    sourceHash: previous.sourceHash,
    previousImportedAt: previous.importedAt,
    nextImportedAt: next.importedAt,
    summaryDelta,
    previousSummary: previous.summary,
    nextSummary: next.summary,
    drops,
    transforms,
    hasChanges,
  };
}

/**
 * Partition two lists into added/resolved/persistent by `path`
 * identity. Preserves order within each partition: `added` and
 * `persistent` follow `next` order; `resolved` follows `previous`
 * order. Duplicate paths within either list are tolerated — the
 * first occurrence per path is kept for positional stability, later
 * duplicates are silently de-duped. Real-world importer output
 * shouldn't have duplicate paths, but the dedup keeps the diff from
 * double-counting if it does happen.
 */
function diffByPath<T extends { path: string }>(previous: readonly T[], next: readonly T[]): ReportDiffPartition<T> {
  const previousPaths = new Set<string>();
  for (const entry of previous) previousPaths.add(entry.path);
  const nextPaths = new Set<string>();
  for (const entry of next) nextPaths.add(entry.path);

  const added: T[] = [];
  const persistent: T[] = [];
  const seenInNext = new Set<string>();
  for (const entry of next) {
    if (seenInNext.has(entry.path)) continue;
    seenInNext.add(entry.path);
    if (previousPaths.has(entry.path)) {
      persistent.push(entry);
    } else {
      added.push(entry);
    }
  }

  const resolved: T[] = [];
  const seenInPrevious = new Set<string>();
  for (const entry of previous) {
    if (seenInPrevious.has(entry.path)) continue;
    seenInPrevious.add(entry.path);
    if (!nextPaths.has(entry.path)) resolved.push(entry);
  }

  return { added, resolved, persistent };
}
