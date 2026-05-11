/**
 * Visual treatment mapping for merge hunks.
 *
 * Pure functions from (`HunkAnalysis`, pick state) → visual treatment.
 * Every palette decision the merge editor makes lives here:
 *
 *   - Line tint           green / red / amber per side
 *   - Frame variant       orange (pending conflict) / blue (pending
 *                         clean) / grey (resolved) — around the whole
 *                         action zone + content rectangle
 *   - Missing-side body   red ("Removed here") vs grey ("No content
 *                         here") for empty-side placeholders
 *   - Result status zone  the inline "Incoming Accepted" / "No Changes
 *                         Accepted" / etc. labels + their "Remove …"
 *                         affordances
 *
 * Hooks in `monaco/` consume these treatments directly. No more inline
 * palette logic in three different files; the entire design language
 * lives in one module that a designer can read end-to-end.
 *
 * Strictly platform-agnostic — imports nothing from Monaco. Lifts
 * cleanly into the future shared-UI package.
 */

import type { HunkAnalysis } from '../diff/hunk-analysis';
import type { HunkPickState, SideState } from '../use-hunk-pick-state';

export type HunkSide = 'theirs' | 'mine';

/** Per-side line-tint kind — maps to the existing
 *  `oh-merge__hunk-addition` / `-removal` / `-modification` CSS classes. */
export type LineTint = 'addition' | 'removal' | 'modification';

/** Frame variant for the action zone + per-line frame decorations.
 *
 *   pending-conflict — orange. True 3-way conflict, awaiting decision.
 *   pending-clean    — blue. Single-side change, auto-mergeable.
 *   resolved         — grey. Both sides reached a terminal state.
 */
export type FrameVariant = 'pending-conflict' | 'pending-clean' | 'resolved';

/** Empty-side placeholder color. `removal` ⇒ red ("this side deleted
 *  base content"); `neutral` ⇒ grey ("absence — content lives on the
 *  other side"). */
export type MissingVariant = 'removal' | 'neutral';

export interface MissingTreatment {
  variant: MissingVariant;
  /** Caption rendered in the action-slot strip above the hashed body. */
  label: string;
}

/** Status label + revert affordances for the result-pane status zone. */
export interface ResultStatusTreatment {
  label: string;
  removable: ReadonlyArray<{ slot: 'left' | 'right'; label: string }>;
}

/** Whether the hunk has reached a terminal state on both sides. */
function isResolved(state: HunkPickState): boolean {
  return state.theirs !== 'pending' && state.mine !== 'pending';
}

function pendingOnSide(state: HunkPickState, side: HunkSide): boolean {
  return side === 'theirs' ? state.theirs === 'pending' : state.mine === 'pending';
}

/**
 * Line tint for a side. Empty sides return null (the placeholder
 * carries the visual instead). `'unchanged'` sides fall back to the
 * pair-diff classification — the row still sits inside a conflict
 * zone and the user expects to see WHERE the divergence is, even when
 * THIS side is the unchanged baseline.
 */
export function lineTintFor(analysis: HunkAnalysis, side: HunkSide): LineTint | null {
  const change = side === 'theirs' ? analysis.theirs : analysis.mine;
  if (change.isEmpty) return null;
  switch (change.kind) {
    case 'added':
      return 'addition';
    case 'modified':
      return 'modification';
    case 'removed':
      // A populated side marked 'removed' is contradictory — guard by
      // falling through to the pair-diff fallback rather than emitting
      // a red tint on rows that visibly exist.
      return null;
    case 'unchanged': {
      const pairKind = analysis.hunk.classification;
      // Match `useHunkDecorations`' legacy flip: removals (other side
      // has extra content) display as additions on the populated side.
      if (pairKind === 'removal') return 'addition';
      if (pairKind === 'addition') return 'addition';
      return 'modification';
    }
  }
}

export function frameForSide(analysis: HunkAnalysis, side: HunkSide, state: HunkPickState): FrameVariant {
  if (!pendingOnSide(state, side)) return 'resolved';
  return analysis.conflict === 'true' ? 'pending-conflict' : 'pending-clean';
}

export function frameForResult(analysis: HunkAnalysis, state: HunkPickState): FrameVariant {
  if (isResolved(state)) return 'resolved';
  return analysis.conflict === 'true' ? 'pending-conflict' : 'pending-clean';
}

export function missingFor(analysis: HunkAnalysis, side: HunkSide): MissingTreatment | null {
  const change = side === 'theirs' ? analysis.theirs : analysis.mine;
  if (!change.isEmpty) return null;
  const other = side === 'theirs' ? analysis.mine : analysis.theirs;
  // Both sides empty would mean an empty hunk — pickHunks shouldn't
  // produce these, but guard so we never emit a phantom placeholder.
  if (other.isEmpty) return null;
  if (change.kind === 'removed') {
    return { variant: 'removal', label: 'Removed here' };
  }
  return { variant: 'neutral', label: 'No content here' };
}

// ── Result-pane status label + revert affordances ─────────────────────

export function resultStatusLabelFor(state: HunkPickState): ResultStatusTreatment | null {
  if (state.theirs === 'pending' && state.mine === 'pending') {
    return { label: 'No Changes Accepted', removable: [] };
  }
  if (state.theirs === 'accepted' && state.mine === 'accepted') {
    return {
      label: 'Incoming + Current',
      removable: [
        { slot: 'left', label: 'Remove Incoming' },
        { slot: 'right', label: 'Remove Current' },
      ],
    };
  }
  if (state.theirs === 'accepted') {
    return { label: 'Incoming', removable: [{ slot: 'left', label: 'Remove Incoming' }] };
  }
  if (state.mine === 'accepted') {
    return { label: 'Current', removable: [{ slot: 'right', label: 'Remove Current' }] };
  }
  if (state.theirs === 'dismissed' && state.mine === 'pending') {
    return { label: 'Incoming Skipped', removable: [] };
  }
  if (state.mine === 'dismissed' && state.theirs === 'pending') {
    return { label: 'Current Skipped', removable: [] };
  }
  if (state.theirs === 'dismissed' && state.mine === 'dismissed') {
    // Both dismissed — keep a bordered (grey) rectangle around the
    // hunk so the user reads "this conflict was reviewed and skipped"
    // instead of "this region is uninvolved."
    return { label: 'No Changes Accepted', removable: [] };
  }
  return null;
}

/** Whether the per-side state machine's `'Accept Combination'` button
 *  should appear — depends on whether stacking both sides into the
 *  result would produce a different outcome than accepting this side
 *  alone. Encapsulated here so the action-zone hook doesn't re-derive
 *  it inline. */
export function isCombineMeaningful(args: { analysis: HunkAnalysis; side: HunkSide; state: HunkPickState }): boolean {
  const { analysis, side, state } = args;
  const otherSideAccepted: SideState = side === 'theirs' ? state.mine : state.theirs;
  if (otherSideAccepted === 'accepted') return false;
  if (state.theirs === 'dismissed' || state.mine === 'dismissed') return false;
  const otherLines = side === 'theirs' ? analysis.mine.lines : analysis.theirs.lines;
  // Combination collapses to "just this side" when the other side has
  // no content (pure add / pure remove on the other side) or when
  // this side is a single-line hunk (stacking is indistinguishable
  // from accept).
  if (otherLines.length === 0) return false;
  const ownRange = side === 'theirs' ? analysis.theirs.range : analysis.mine.range;
  return ownRange.endLine > ownRange.startLine + 1;
}
