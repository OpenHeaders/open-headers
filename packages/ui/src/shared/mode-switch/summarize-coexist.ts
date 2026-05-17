/**
 * Mode-switch Coexist (M3) — toast-copy generators.
 *
 * Kept separate from the BackendPane so the messaging is unit-testable
 * without mounting Antd. The success path summarizes how many
 * workspaces and entities landed; the failure path translates the
 * structured {@link CoexistFailureReason} into copy that tells the user
 * what to do next rather than what went wrong internally.
 */

import type { CoexistResult } from '@openheaders/core/sync';

/** Pluralizer that prefers "1 rule" / "5 rules" without dragging in i18n. */
function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralForm}`;
}

/**
 * Build the success toast for a Coexist run. Caller passes the
 * user-facing labels for the source and target hosts so the copy can
 * refer to them by name ("Browser Extension", "Desktop Application")
 * rather than wire-level mode identifiers.
 */
export function summarizeCoexistSuccess(
  result: Extract<CoexistResult, { ok: true }>,
  fromLabel: string,
  toLabel: string,
): string {
  const wsCopy = plural(result.imported.length, 'workspace');
  const entCopy = plural(result.totalEntitiesApplied, 'item');
  return `Copied ${wsCopy} (${entCopy}) from ${fromLabel} to ${toLabel}.`;
}

/**
 * Build the failure toast. Each branch nudges the user toward the
 * recovery path that matches the failure mode:
 *
 *   - `peer-write-unavailable` — connect the target first (most common
 *     during transient bridge hiccups or first-time setup).
 *   - `no-source-data` — extremely rare race; tell the user the source
 *     is empty and the switch is safe to do via the dropdown directly.
 *   - `apply-failed` — recommend Discard-with-backup so they have a
 *     restorable export before retrying.
 */
export function summarizeCoexistFailure(
  result: Extract<CoexistResult, { ok: false }>,
  toLabel: string,
): string {
  switch (result.reason) {
    case 'peer-write-unavailable':
      return `Couldn't reach ${toLabel} — connect the target first, then try again.`;
    case 'no-source-data':
      return 'No source data to copy. You can switch back-ends directly without the dialog.';
    case 'apply-failed':
      return `Coexist failed partway through. Mode left unchanged; try Discard with backup if you want to retire the current back-end.`;
  }
}
