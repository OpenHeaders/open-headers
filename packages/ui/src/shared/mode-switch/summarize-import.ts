/**
 * Mode-switch Import (M4) — toast-copy generators.
 *
 * Kept separate from the BackendPane so messaging is unit-testable
 * without mounting Antd. The success path summarizes how many entities
 * landed plus the HLC-merge conflict count; the failure path translates
 * the structured {@link ImportFailureReason} into copy that tells the
 * user what to do next.
 *
 * The "ignored" rollup (workspaces present on the source whose id
 * wasn't on the target) is surfaced as a trailer when present. v1 v.s.
 * M4b: the suggested fallback in that case is Coexist, which mints a
 * fresh workspace per source rather than requiring an id match.
 */

import type { ImportResult } from '@openheaders/core/sync';

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralForm}`;
}

/**
 * Build the success toast for an Import run. Caller passes the
 * user-facing labels for the source and target hosts so the copy can
 * refer to them by name rather than wire-level mode identifiers.
 */
export function summarizeImportSuccess(
  result: Extract<ImportResult, { ok: true }>,
  fromLabel: string,
  toLabel: string,
): string {
  const wsCopy = plural(result.mergedWorkspaces.length, 'workspace');
  const entCopy = plural(result.totalEntitiesApplied, 'item');
  const conflictCopy =
    result.totalConflicts > 0
      ? ` ${plural(result.totalConflicts, 'conflict')} merged (newer wins).`
      : '';
  const ignoredCopy =
    result.ignored.length > 0
      ? ` Skipped ${plural(result.ignored.length, 'workspace')} with no match on ${toLabel}; use Coexist to copy them as new workspaces.`
      : '';
  return `Merged ${wsCopy} (${entCopy}) from ${fromLabel} into ${toLabel}.${conflictCopy}${ignoredCopy}`;
}

/**
 * Build the failure toast. Each branch nudges the user toward the
 * recovery path that matches the failure mode:
 *
 *   - `peer-write-unavailable` — connect the target first.
 *   - `no-source-data` — defensive race; the switch is safe via the
 *     dropdown directly.
 *   - `no-matching-workspace` — every source workspace had a different
 *     id on the target; suggest Coexist (which mints fresh ids).
 *   - `apply-failed` — recommend Discard-with-backup so they have a
 *     restorable export before retrying.
 */
export function summarizeImportFailure(
  result: Extract<ImportResult, { ok: false }>,
  toLabel: string,
): string {
  switch (result.reason) {
    case 'peer-write-unavailable':
      return `Couldn't reach ${toLabel} — connect the target first, then try again.`;
    case 'no-source-data':
      return 'No source data to merge. You can switch back-ends directly without the dialog.';
    case 'no-matching-workspace':
      return `No workspaces on ${toLabel} share an id with the source — use Coexist to copy them as new workspaces.`;
    case 'apply-failed':
      return `Import failed partway through. Mode left unchanged; try Discard with backup if you want to retire the current back-end.`;
  }
}
