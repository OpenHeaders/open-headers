/**
 * Conflict classification for Phase 2.5 (non-conflicting filter +
 * bulk apply).
 *
 * A hunk is a "conflict" when both sides have diverged from the
 * result buffer in overlapping line ranges. Non-conflicting hunks
 * are pure single-sided changes — only theirs differs from result,
 * or only mine differs — and can be auto-applied without ambiguity.
 *
 * Range-overlap is computed against the *result-side* range (which
 * is the `mineRange` field on hunks computed via `diffLines(side,
 * result)`; that field's name is overloaded — it's the right-pane
 * range of whichever diff was computed).
 */

import type { Hunk } from './line-diff';

export interface ConflictClassification {
  /** Set of theirs-hunk ids that overlap a mine-hunk's result range. */
  theirsConflictIds: ReadonlySet<string>;
  /** Set of mine-hunk ids that overlap a theirs-hunk's result range. */
  mineConflictIds: ReadonlySet<string>;
}

export function rangesOverlap(
  a: { startLine: number; endLine: number },
  b: { startLine: number; endLine: number },
): boolean {
  // Empty ranges (insertions): treat zero-line ranges as a 1-line
  // sentinel for overlap purposes — an insertion at line N conflicts
  // with another change touching line N.
  const aStart = a.startLine;
  const aEnd = a.endLine <= a.startLine ? a.startLine + 1 : a.endLine;
  const bStart = b.startLine;
  const bEnd = b.endLine <= b.startLine ? b.startLine + 1 : b.endLine;
  return aStart < bEnd && bStart < aEnd;
}

export function classifyConflicts(theirsHunks: readonly Hunk[], mineHunks: readonly Hunk[]): ConflictClassification {
  const theirsConflictIds = new Set<string>();
  const mineConflictIds = new Set<string>();
  for (const t of theirsHunks) {
    for (const m of mineHunks) {
      if (rangesOverlap(t.mineRange, m.mineRange)) {
        theirsConflictIds.add(t.id);
        mineConflictIds.add(m.id);
      }
    }
  }
  return { theirsConflictIds, mineConflictIds };
}

/**
 * 3-way classification overlay (real merge semantics).
 *
 * The 2-way classifier above flags any pair of overlapping
 * theirs↔result and mine↔result hunks as conflict — conservative,
 * but a false positive when only one side actually changed vs base
 * (e.g. the user's edit propagated through `result === mine` and
 * theirs's hunk just reflects the same region without a real peer
 * change).
 *
 * The 3-way classifier consumes ADDITIONAL diff axes —
 * `theirsBaseHunks = diff(base, theirs)` and `mineBaseHunks = diff(base,
 * mine)` — to confirm which side actually changed vs base. Mapping is
 * range-overlap on the base-side ranges of the original axes:
 *
 *   - `theirsHunk.theirsRange` overlaps any `theirsBaseHunk.mineRange`?
 *     → theirs changed at this region vs base.
 *   - `mineHunk.mineRange` overlaps any `mineBaseHunk.mineRange`?
 *     → mine changed at this region vs base.
 *
 * (Recall: `Hunk.mineRange` is the right-side range of whichever diff
 * produced it — `diff(base, X)` makes mineRange the X-side range.)
 *
 * Output adds two subsets of the 2-way conflict sets:
 *   - `theirsCleanIds`: theirs↔result hunks WHERE theirs didn't actually
 *     change vs base (so result diverged via mine alone — no real peer
 *     edit). Auto-applicable.
 *   - `mineCleanIds`: mine↔result hunks WHERE mine didn't actually change
 *     vs base (the change came purely from theirs flowing through, OR
 *     from manual user edits in result that the user implicitly
 *     accepts).
 *
 * A hunk in the 2-way conflict set is a TRUE conflict iff it's NOT in
 * the corresponding clean set.
 */
export interface ConflictClassification3Way extends ConflictClassification {
  theirsCleanIds: ReadonlySet<string>;
  mineCleanIds: ReadonlySet<string>;
  /**
   * True-conflict supersets: a theirs hunk is in `theirsTrueConflicts`
   * iff theirs AND mine both changed the same BASE region — even when
   * the 2-way overlap doesn't catch it. The 2-way classifier requires
   * theirs↔result and mine↔result hunks to overlap; that fails the
   * common case where the dialog opens with `result === mine` (draft
   * untouched), making `mineHunks` empty and every theirs hunk
   * spuriously "non-conflicting." The base-region check fires on the
   * actual divergence axes (theirs↔base + mine↔base) and produces a
   * conflict signal independent of the result-pane state.
   */
  theirsTrueConflicts: ReadonlySet<string>;
  mineTrueConflicts: ReadonlySet<string>;
}

export interface ClassifyConflicts3WayArgs {
  theirsHunks: readonly Hunk[];
  mineHunks: readonly Hunk[];
  /** `diff(base, theirs)` hunks. `mineRange` on each hunk = theirs-side range. */
  theirsBaseHunks: readonly Hunk[];
  /** `diff(base, mine)` hunks. `mineRange` on each hunk = mine-side range. */
  mineBaseHunks: readonly Hunk[];
}

export function classifyConflicts3Way(args: ClassifyConflicts3WayArgs): ConflictClassification3Way {
  const base = classifyConflicts(args.theirsHunks, args.mineHunks);
  const theirsCleanIds = new Set<string>();
  const mineCleanIds = new Set<string>();
  const theirsTrueConflicts = new Set<string>();
  const mineTrueConflicts = new Set<string>();

  for (const t of args.theirsHunks) {
    let theirsActuallyChanged = false;
    // Collect the BASE-side ranges this theirs hunk maps to via the
    // theirs-vs-base diff. `theirsBaseHunks = diff(base, theirs)` →
    // mineRange = theirs-side range, theirsRange = base-side range.
    const baseRangesForTheirs: Array<{ startLine: number; endLine: number }> = [];
    for (const tb of args.theirsBaseHunks) {
      if (rangesOverlap(t.theirsRange, tb.mineRange)) {
        theirsActuallyChanged = true;
        baseRangesForTheirs.push(tb.theirsRange);
      }
    }
    if (!theirsActuallyChanged) theirsCleanIds.add(t.id);
    // True-conflict check: did mine also change in any of these base
    // regions? `mineBaseHunks = diff(base, mine)` → theirsRange =
    // base-side range. If yes, this is a real 3-way conflict
    // regardless of the 2-way overlap state.
    if (theirsActuallyChanged) {
      for (const mb of args.mineBaseHunks) {
        let overlap = false;
        for (const br of baseRangesForTheirs) {
          if (rangesOverlap(br, mb.theirsRange)) {
            overlap = true;
            break;
          }
        }
        if (overlap) {
          theirsTrueConflicts.add(t.id);
          break;
        }
      }
    }
  }
  for (const m of args.mineHunks) {
    let mineActuallyChanged = false;
    const baseRangesForMine: Array<{ startLine: number; endLine: number }> = [];
    for (const mb of args.mineBaseHunks) {
      if (rangesOverlap(m.mineRange, mb.mineRange)) {
        mineActuallyChanged = true;
        baseRangesForMine.push(mb.theirsRange);
      }
    }
    if (!mineActuallyChanged) mineCleanIds.add(m.id);
    if (mineActuallyChanged) {
      for (const tb of args.theirsBaseHunks) {
        let overlap = false;
        for (const br of baseRangesForMine) {
          if (rangesOverlap(br, tb.theirsRange)) {
            overlap = true;
            break;
          }
        }
        if (overlap) {
          mineTrueConflicts.add(m.id);
          break;
        }
      }
    }
  }
  return { ...base, theirsCleanIds, mineCleanIds, theirsTrueConflicts, mineTrueConflicts };
}
