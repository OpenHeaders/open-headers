/**
 * Shared merge-editor family — the three-way merge surface under
 * `packages/ui/src/shared/merge-editor/` consumed via
 * `EntityConflictDialog` by every entity editor and by the import
 * preview shell: the `MergeConflictModal` toolbar / menus / session
 * confirms / footer, the default pane headers + resize-sash arias
 * (`MergePane` / `merge-pane-chrome`), the file-list sidebar
 * tooltips + status pills, the result-pane action-gutter affordances,
 * and the resolution-command ARIA announcements.
 *
 * Raw by design inside keyed sentences: keyboard chords
 * (`Cmd/Ctrl+K  P` — byte-faithful, double space included), the
 * ✕ ▶ ◀ ↘ ↙ · glyphs, file / entity labels and caller-supplied group
 * names ({label} / {scope} holes carry data; only the ungrouped
 * `Other` fallback keys), adapter error text, and the session title
 * (arrives pre-keyed from callers). The Monaco view-zone plane keys
 * here too (`zone.*` for `view/hunk-visual.ts` vocabulary +
 * `hunk-zone-dom.ts` builders, `action.*` for the
 * `use-merge-actions.ts` palette labels) — these are the primary
 * conflict-resolution controls, not Monaco chrome, so they translate
 * even though they render inside the editor surface via raw DOM view
 * zones. The `+ − ~ =` kind-label glyph prefixes ride raw inside the
 * keyed values.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedMergeEditor = {
  // ── Toolbar ────────────────────────────────────────────────────────
  'shared.mergeEditor.toolbar.prevHunk': 'Previous hunk · Cmd/Ctrl+K  P',
  'shared.mergeEditor.toolbar.nextHunk': 'Next hunk · Cmd/Ctrl+K  N',
  'shared.mergeEditor.toolbar.allResolved': 'All hunks resolved',
  'shared.mergeEditor.toolbar.hunksRemaining': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} hunk remaining', other: '{count} hunks remaining' }),
  'shared.mergeEditor.toolbar.conflictsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} conflict', other: '{count} conflicts' }),
  'shared.mergeEditor.toolbar.nonConflictingCount': '{count} non-conflicting',
  'shared.mergeEditor.toolbar.applyNonConflictingTooltip':
    'Apply every hunk only one side touched, in one undo step. Conflicts stay for manual resolution. · Cmd/Ctrl+K  A',
  'shared.mergeEditor.toolbar.applyNonConflicting': 'Apply non-conflicting',
  'shared.mergeEditor.toolbar.acceptAll': 'Accept all',
  'shared.mergeEditor.toolbar.acceptAllIncomingFile': 'Accept all incoming (this file)',
  'shared.mergeEditor.toolbar.acceptAllCurrentFile': 'Accept all current (this file)',
  'shared.mergeEditor.toolbar.acceptAllIncomingSession': 'Accept all incoming (whole session)',
  'shared.mergeEditor.toolbar.acceptAllCurrentSession': 'Accept all current (whole session)',
  'shared.mergeEditor.toolbar.acceptAllIncoming': 'Accept all incoming',
  'shared.mergeEditor.toolbar.acceptAllCurrent': 'Accept all current',
  'shared.mergeEditor.toolbar.baseUnavailable': 'Base view unavailable — no common ancestor in this session.',
  'shared.mergeEditor.toolbar.resetLayout': 'Reset pane sizes for the current layout',

  // ── Layout segments ────────────────────────────────────────────────
  'shared.mergeEditor.layout.column': 'Column',
  'shared.mergeEditor.layout.baseOnTop': 'Base on top',
  'shared.mergeEditor.layout.baseInCenter': 'Base in center',

  // ── View toggles ───────────────────────────────────────────────────
  'shared.mergeEditor.toggle.showNonConflicting': 'Show non-conflicting',
  'shared.mergeEditor.toggle.compactView': 'Compact view',
  'shared.mergeEditor.toggle.compactViewTooltip':
    'Collapse unchanged regions across all panes — only hunk areas (plus a few lines of context) stay visible. Useful for files where most lines are unchanged.',
  'shared.mergeEditor.toggle.singleClickResolve': 'Single-click resolve',
  'shared.mergeEditor.toggle.singleClickResolveTooltip':
    'When on, accepting one side of a hunk auto-dismisses the other so the hunk resolves in one click. Off keeps the diagonal-append (↘ / ↙) affordance so you can stack both sides.',
  'shared.mergeEditor.toggle.inlineLabels': 'Inline labels',
  'shared.mergeEditor.toggle.inlineLabelsTooltip':
    "Show '{accept} | {combine} | {ignore}' labels above each pending hunk in the side panes. Layout-agnostic.",
  'shared.mergeEditor.toggle.sideGutters': 'Side gutters',
  'shared.mergeEditor.toggle.sideGuttersTooltip': 'Show ✕ ▶ / ◀ ✕ glyphs flanking the result editor.',
  'shared.mergeEditor.toggle.sideGuttersUnavailable':
    'Side gutters are only available in Column layout — base-on-top and base-in-center put the result on a separate row from theirs / mine.',

  // ── Session-wide Accept-all confirms ───────────────────────────────
  'shared.mergeEditor.confirm.acceptIncomingTitle': 'Accept all incoming (session)',
  'shared.mergeEditor.confirm.acceptCurrentTitle': 'Accept all current (session)',
  'shared.mergeEditor.confirm.replaceWithIncoming': 'Replace {scope} with the incoming version.',
  'shared.mergeEditor.confirm.resetToCurrent': 'Reset {scope} to your current version.',
  'shared.mergeEditor.confirm.discardsLocal': 'This discards your local edits for every file in the session.',
  'shared.mergeEditor.confirm.discardsIncoming': 'This discards every incoming change for every file in the session.',
  'shared.mergeEditor.confirm.okIncoming': 'Accept all incoming',
  'shared.mergeEditor.confirm.okCurrent': 'Accept all current',
  'shared.mergeEditor.confirm.cancel': 'Cancel',
  'shared.mergeEditor.sessionScope.files': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} file', other: '{count} files' }),
  'shared.mergeEditor.groupOther': 'Other',

  // ── Apply errors + footer + empty state ────────────────────────────
  'shared.mergeEditor.errors.applyReported': 'Apply reported errors:',
  'shared.mergeEditor.errors.unknown': 'unknown error',
  'shared.mergeEditor.emptySession': 'No files in this merge session.',
  'shared.mergeEditor.footer.cancel': 'Cancel',
  'shared.mergeEditor.footer.completeMerge': 'Complete Merge',

  // ── Pane headers + sash arias ──────────────────────────────────────
  'shared.mergeEditor.pane.incoming': 'Incoming (theirs)',
  'shared.mergeEditor.pane.result': 'Result',
  'shared.mergeEditor.pane.yoursEditHere': 'Yours (mine, edit here)',
  'shared.mergeEditor.pane.current': 'Current (mine)',
  'shared.mergeEditor.pane.base': 'Base (common ancestor)',
  'shared.mergeEditor.sash.columns12': 'Resize column 1 / column 2',
  'shared.mergeEditor.sash.columns23': 'Resize column 2 / column 3',
  'shared.mergeEditor.sash.rows': 'Resize top row / bottom row',

  // ── File-list sidebar ──────────────────────────────────────────────
  'shared.mergeEditor.fileList.kindAdded': 'Added',
  'shared.mergeEditor.fileList.kindModified': 'Modified',
  'shared.mergeEditor.fileList.kindRemoved': 'Removed',
  'shared.mergeEditor.fileList.statusUnresolved': 'unresolved',
  'shared.mergeEditor.fileList.statusPartial': 'partial',
  'shared.mergeEditor.fileList.statusResolved': 'resolved',
  'shared.mergeEditor.fileList.statusFailed': 'failed',
  'shared.mergeEditor.fileList.pairedWith': 'Paired with: {label}',
  'shared.mergeEditor.fileList.hunksRemaining': '{count} hunks remaining',

  // ── Monaco view-zone plane ─────────────────────────────────────────
  'shared.mergeEditor.zone.acceptIncoming': 'Accept Incoming',
  'shared.mergeEditor.zone.acceptCurrent': 'Accept Current',
  'shared.mergeEditor.zone.acceptCombination': 'Accept Combination',
  'shared.mergeEditor.zone.ignore': 'Ignore',
  'shared.mergeEditor.zone.combineTooltip': 'Stack both sides — incoming first, then current',
  'shared.mergeEditor.zone.removeIncoming': 'Remove Incoming',
  'shared.mergeEditor.zone.removeCurrent': 'Remove Current',
  'shared.mergeEditor.zone.revertIncomingTitle': 'Revert incoming to pending so you can re-decide',
  'shared.mergeEditor.zone.revertCurrentTitle': 'Revert current to pending so you can re-decide',
  'shared.mergeEditor.zone.statusNoChanges': 'No Changes Accepted',
  'shared.mergeEditor.zone.statusIncomingPlusCurrent': 'Incoming + Current',
  'shared.mergeEditor.zone.statusIncoming': 'Incoming',
  'shared.mergeEditor.zone.statusCurrent': 'Current',
  'shared.mergeEditor.zone.statusIncomingSkipped': 'Incoming Skipped',
  'shared.mergeEditor.zone.statusCurrentSkipped': 'Current Skipped',
  'shared.mergeEditor.zone.kindAdds': '+ Adds',
  'shared.mergeEditor.zone.kindRemoves': '− Removes',
  'shared.mergeEditor.zone.kindModifies': '~ Modifies',
  'shared.mergeEditor.zone.kindUnchanged': '= Unchanged',

  // ── Monaco command-palette actions ─────────────────────────────────
  'shared.mergeEditor.action.nextHunk': 'Merge: Go to next hunk',
  'shared.mergeEditor.action.prevHunk': 'Merge: Go to previous hunk',
  'shared.mergeEditor.action.acceptIncomingAtCursor': 'Merge: Accept incoming hunk at cursor',
  'shared.mergeEditor.action.acceptCurrentAtCursor': 'Merge: Accept current hunk at cursor',
  'shared.mergeEditor.action.applyNonConflicting': 'Merge: Apply non-conflicting changes',
  'shared.mergeEditor.action.acceptAllIncoming': 'Merge: Accept all incoming',
  'shared.mergeEditor.action.acceptAllCurrent': 'Merge: Accept all current',
  'shared.mergeEditor.action.undo': 'Merge: Undo (buffer + pick state)',
  'shared.mergeEditor.action.redo': 'Merge: Redo (buffer + pick state)',

  // ── Result-pane action gutter ──────────────────────────────────────
  'shared.mergeEditor.gutter.acceptIncoming': 'Accept incoming',
  'shared.mergeEditor.gutter.acceptCurrent': 'Accept current',
  'shared.mergeEditor.gutter.appendIncoming': 'Also append incoming after current',
  'shared.mergeEditor.gutter.appendCurrent': 'Also append current after incoming',
  'shared.mergeEditor.gutter.skipIncoming': 'Skip incoming for this hunk',
  'shared.mergeEditor.gutter.skipCurrent': 'Skip current for this hunk',

  // ── ARIA live announcements ────────────────────────────────────────
  'shared.mergeEditor.announce.allResolved': 'All hunks resolved.',
  'shared.mergeEditor.announce.remaining': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} hunk remaining.', other: '{count} hunks remaining.' }),
  'shared.mergeEditor.announce.acceptedIncoming': 'Accepted incoming hunk.',
  'shared.mergeEditor.announce.acceptedCurrent': 'Accepted current hunk.',
  'shared.mergeEditor.announce.appliedNonConflicting': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Applied {count} non-conflicting hunk.',
      other: 'Applied {count} non-conflicting hunks.',
    }),
  'shared.mergeEditor.announce.acceptedAllIncoming': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Accepted all {count} incoming hunk.',
      other: 'Accepted all {count} incoming hunks.',
    }),
  'shared.mergeEditor.announce.acceptedAllCurrent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Accepted all {count} current hunk.',
      other: 'Accepted all {count} current hunks.',
    }),
} as const satisfies Catalog;
