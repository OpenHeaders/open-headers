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

function rangesOverlap(a: { startLine: number; endLine: number }, b: { startLine: number; endLine: number }): boolean {
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
