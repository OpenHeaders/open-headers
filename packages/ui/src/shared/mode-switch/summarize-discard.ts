/**
 * Mode-switch Discard (M5) — toast-copy generators.
 *
 * Kept separate from BackendPane so messaging is unit-testable without
 * mounting Antd. Success quotes the resolved backup path so the user
 * can find the archive; failure translates the structured
 * {@link DiscardFailureReason} into copy that tells the user what
 * happened to their data.
 *
 * Discard semantics differ from Coexist (M3) + Import (M4): there's no
 * peer-side outcome to summarize. The success message describes what
 * was retired locally + where the archive lives; failure messages
 * explicitly say "your data is intact" when no delete ran.
 */

import type { DiscardResult } from '@openheaders/core/sync';

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralForm}`;
}

/**
 * Build the success toast for a Discard run. Caller passes the
 * user-facing label for the target host so the copy can name the
 * back-end the user is now using rather than the wire identifier.
 */
export function summarizeDiscardSuccess(
  result: Extract<DiscardResult, { ok: true }>,
  toLabel: string,
): string {
  const wsCopy = plural(result.discardedWorkspaces.length, 'workspace');
  const totalEntities = result.discardedWorkspaces.reduce((sum, w) => sum + w.entityCount, 0);
  const entCopy =
    totalEntities > 0 ? ` (${plural(totalEntities, 'item')})` : '';
  return `Backed up ${wsCopy}${entCopy} to ${result.backupPath}; ${toLabel} is now the active back-end.`;
}

/**
 * Build the failure toast. Each branch tells the user (a) what
 * happened and (b) whether any data was lost.
 *
 *   - `backup-writer-unavailable` — boot race or platform restriction;
 *     no archive written, no workspace deleted.
 *   - `no-source-data` — defensive race; nothing to back up.
 *   - `backup-failed` — writer rejected (user cancelled, disk full,
 *     permission revoked). No workspace deleted.
 *   - `delete-failed` — archive landed on disk but a delete rejected;
 *     surface the path so the user can restore via M6 if they choose.
 */
export function summarizeDiscardFailure(
  result: Extract<DiscardResult, { ok: false }>,
): string {
  switch (result.reason) {
    case 'backup-writer-unavailable':
      return 'Discard unavailable — this host can\'t write a backup. Mode unchanged; your data is intact.';
    case 'no-source-data':
      return 'No source data to back up. You can switch back-ends directly without the dialog.';
    case 'backup-failed':
      return 'Backup failed before any workspace was removed. Mode unchanged; your data is intact.';
    case 'delete-failed': {
      const pathPart = result.backupPath ? ` Archive saved to ${result.backupPath}.` : '';
      return `Backup written but a workspace could not be removed.${pathPart} Mode left unchanged; retry or restore from the archive.`;
    }
  }
}
