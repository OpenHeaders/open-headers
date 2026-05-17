/**
 * Mode-switch Restore (M6) — toast-copy generators.
 *
 * Kept separate from the action handler so messaging is unit-testable.
 * Success quotes the per-workspace + per-entity counts so the user can
 * confirm the recovery's reach; failure translates the structured
 * {@link RestoreFailureReason} into copy that tells the user what
 * happened to the archive and what (if anything) DID mount.
 *
 * Restore semantics differ from Discard (M5): no path is quoted on
 * success (the user just opened the file themselves), and partial
 * recovery is surfaced explicitly on the `apply-failed` branch so the
 * user knows they don't have to start over.
 */

import type { RestoreResult } from '@openheaders/core/sync';

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralForm}`;
}

/** Build the success toast for a Restore run. */
export function summarizeRestoreSuccess(result: Extract<RestoreResult, { ok: true }>): string {
  const wsCopy = plural(result.restoredWorkspaces.length, 'workspace');
  const totalEntities = result.restoredWorkspaces.reduce((sum, w) => sum + w.entitiesApplied, 0);
  const entCopy = totalEntities > 0 ? ` (${plural(totalEntities, 'item')})` : '';
  return `Restored ${wsCopy}${entCopy} from backup.`;
}

/**
 * Build the failure toast. Each branch tells the user (a) what
 * happened and (b) whether any workspace did mount.
 *
 *   - `invalid-archive` — the picked file isn't a parsable backup.
 *     Nothing mounted; user is intact.
 *   - `no-workspaces` — the archive parsed but is empty. Nothing to do.
 *   - `apply-failed` — at least one workspace seeded before the
 *     applier rejected. Survivors are surfaced so the user can decide
 *     whether to keep them or roll forward.
 */
export function summarizeRestoreFailure(result: Extract<RestoreResult, { ok: false }>): string {
  switch (result.reason) {
    case 'invalid-archive':
      return "That file isn't a valid backup archive. Pick a JSON file produced by a Discard run.";
    case 'no-workspaces':
      return 'The backup archive is empty — nothing to restore.';
    case 'apply-failed': {
      const partial = result.restoredWorkspaces ?? [];
      if (partial.length === 0) {
        return 'Restore failed before any workspace was mounted. Your existing workspaces are intact; the backup file is unchanged.';
      }
      const wsCopy = plural(partial.length, 'workspace');
      return `Restore stopped after ${wsCopy} — the rest of the archive could not be applied. The mounted workspaces are kept; the backup file is unchanged.`;
    }
  }
}
