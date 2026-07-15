/**
 * Shared conflicts family — the entity-conflict rendering surfaces:
 * the editor-top aggregation banner, the merge-dialog shim, and the
 * two inline lightning-bolt chips (per-leaf value diff, set-row
 * removal). Shared-plane: every entity editor mounts them. The
 * adapter label plane (`prettyPath` / row summaries — pure-data
 * adapters, nine per-entity files) is a separate slice; its output
 * interpolates into these keys as data.
 */

import type { Catalog } from '../../types';

export const sharedConflicts = {
  // ── Entity banner ──────────────────────────────────────────────────
  'shared.conflicts.banner.changedExternally': '{noun} changed externally while you were editing.',
  'shared.conflicts.banner.fieldsNoun': 'fields',
  'shared.conflicts.banner.review': 'Review changes',
  'shared.conflicts.banner.keepAllMine': 'Keep all mine',
  'shared.conflicts.banner.useAllSaved': 'Use all saved',

  // ── Merge-dialog shim ──────────────────────────────────────────────
  'shared.conflicts.dialog.title': 'Resolve external changes',

  // ── Per-leaf diff chip ─────────────────────────────────────────────
  'shared.conflicts.chip.trigger': 'External change available — click to resolve',
  'shared.conflicts.chip.externalChange': 'External change',
  'shared.conflicts.chip.savedValue': 'Saved value',
  'shared.conflicts.chip.yourEdit': 'Your edit',
  'shared.conflicts.chip.keepMine': 'Keep mine',
  'shared.conflicts.chip.useSaved': 'Use saved',
  'shared.conflicts.chip.lastSyncedValue': 'Last synced value',
  'shared.conflicts.chip.empty': '(empty)',

  // ── Set-row removal chip ───────────────────────────────────────────
  'shared.conflicts.rowChip.trigger': 'Saved version removed this row — click to resolve',
  'shared.conflicts.rowChip.removedExternally': 'Row removed externally',
  'shared.conflicts.rowChip.lastSyncedRow': 'Last synced row',
  'shared.conflicts.rowChip.useSavedRemove': 'Use saved (remove)',
} as const satisfies Catalog;
