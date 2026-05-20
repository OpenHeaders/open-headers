/**
 * Mode-switch Use-Target (Phase U5.4) — toast-copy generators.
 *
 * Kept separate from the dialog so messaging is unit-testable without
 * mounting Antd. Use-Target reports a {@link DiscardResult} — it is a
 * Discard scoped to this device's own workspaces. Success quotes the
 * backup path; failure says explicitly whether anything was removed.
 */

import type { DiscardResult } from '@openheaders/core/sync';

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralForm}`;
}

/**
 * Build the success toast for a Use-Target run. Caller passes the
 * user-facing label for the target host so the copy names the backend
 * the user is now working against.
 */
export function summarizeUseTargetSuccess(result: Extract<DiscardResult, { ok: true }>, toLabel: string): string {
  const retired = result.discardedWorkspaces.length;
  if (retired === 0) {
    return `You're now working with ${toLabel}'s data.`;
  }
  const totalEntities = result.discardedWorkspaces.reduce((sum, w) => sum + w.entityCount, 0);
  const entCopy = totalEntities > 0 ? ` (${plural(totalEntities, 'item')})` : '';
  const them = retired === 1 ? 'it' : 'them';
  return `Backed up ${plural(retired, 'workspace')}${entCopy} to ${result.backupPath} and removed ${them}. You're now working with ${toLabel}'s data.`;
}

/**
 * Build the failure toast. Each branch tells the user (a) what
 * happened and (b) whether any workspace was removed.
 *
 *   - `backup-writer-unavailable` — this host can't write a backup;
 *     nothing removed.
 *   - `no-source-data` — no local workspaces to retire.
 *   - `backup-failed` — the writer rejected before any delete ran.
 *   - `delete-failed` — the archive landed but a delete rejected;
 *     surface the path for an M6 restore.
 */
export function summarizeUseTargetFailure(result: Extract<DiscardResult, { ok: false }>, toLabel: string): string {
  switch (result.reason) {
    case 'backup-writer-unavailable':
      return `Switched to ${toLabel}, but this host can't write a backup — your workspaces were kept, not removed.`;
    case 'no-source-data':
      return `No local workspaces to retire — you're already working with ${toLabel}'s data.`;
    case 'backup-failed':
      return 'Backup failed before any workspace was removed. Your workspaces are intact.';
    case 'delete-failed': {
      const pathPart = result.backupPath ? ` Archive saved to ${result.backupPath}.` : '';
      return `Backup written but a workspace could not be removed.${pathPart} Retry, or restore from the archive.`;
    }
  }
}
