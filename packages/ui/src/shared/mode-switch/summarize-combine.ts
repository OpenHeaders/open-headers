/**
 * Mode-switch Combine (Phase U5.3) — toast-copy generators.
 *
 * Kept separate from the dialog so messaging is unit-testable without
 * mounting Antd. Success says how many workspaces moved into the target
 * backend; failure translates the structured {@link CombineFailureReason}
 * into copy that tells the user where their data ended up.
 */

import type { CombineResult } from '@openheaders/core/sync';

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralForm}`;
}

/**
 * Build the success toast for a Combine run. Caller passes the
 * user-facing labels for the source and target hosts so the copy names
 * them rather than the wire-level mode identifiers.
 */
export function summarizeCombineSuccess(
  result: Extract<CombineResult, { ok: true }>,
  fromLabel: string,
  toLabel: string,
): string {
  const moved = result.combinedWorkspaces.length;
  if (moved === 0) {
    return `Your workspaces were already part of ${toLabel}.`;
  }
  return `Moved ${plural(moved, 'workspace')} from ${fromLabel} into ${toLabel} — they now sync both ways.`;
}

/**
 * Build the failure toast. Each branch tells the user where their data
 * is: Combine is local-only, so a failure always leaves the source
 * workspaces on this device — the mode still switched.
 *
 *   - `no-target-org` — the target backend reported no workspace
 *     identity; nothing to re-home into.
 *   - `target-not-authorized` — the join never landed (the backend
 *     didn't come online in time).
 *   - `no-source-data` — defensive race; no local workspaces.
 *   - `rehome-failed` — a flip rejected mid-run; partial progress is
 *     surfaced so the user knows a retry resumes rather than restarts.
 */
export function summarizeCombineFailure(result: Extract<CombineResult, { ok: false }>, toLabel: string): string {
  switch (result.reason) {
    case 'no-target-org':
      return `Switched to ${toLabel}, but it reported no workspace identity — your workspaces stayed on this device.`;
    case 'target-not-authorized':
      return `Switched to ${toLabel}, but it didn't come online in time — your workspaces stayed on this device. Retry from Settings once connected.`;
    case 'no-source-data':
      return `No workspaces on this device to combine — you're working with ${toLabel}'s data.`;
    case 'rehome-failed': {
      const moved = result.combinedWorkspaces?.length ?? 0;
      const movedCopy = moved > 0 ? ` ${plural(moved, 'workspace')} moved before it stopped;` : '';
      return `Combine stopped partway.${movedCopy} retry from Settings to finish moving the rest.`;
    }
  }
}
