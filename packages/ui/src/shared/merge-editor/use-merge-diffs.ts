/**
 * Diff + analysis derivation layer for `MergePane`. Produces the live
 * per-axis hunk lists (theirs↔result, mine↔result), the stable
 * pick-state hunks, and the per-hunk base-aware analyses every
 * decoration / action hook downstream consumes.
 */

import { useMemo } from 'react';
import { analyzeHunks, type HunkAnalysis } from './diff/hunk-analysis';
import type { Hunk } from './diff/line-diff';
import { diffLinesPatience } from './diff/patience-diff';
import type { MergeFile } from './types';

export interface MergeDiffs {
  /** Live theirs ↔ result hunks — recomputed on every result edit. */
  theirsHunks: readonly Hunk[];
  /** Live mine ↔ result hunks — recomputed on every result edit. */
  mineHunks: readonly Hunk[];
  /** Stable hunks against `file.initialResult` — identity domain for
   *  the pick-state machine and every visual decoration. */
  pickStateHunks: readonly Hunk[];
  /** Per-hunk base-aware analysis, one per pickStateHunk. */
  analyses: readonly HunkAnalysis[];
}

export function useMergeDiffs(file: MergeFile, resultText: string): MergeDiffs {
  // For `kind: 'add'` the entity has no local counterpart — `mine` is
  // empty by design, NOT a divergence the user has to resolve. The
  // `mine ↔ result` diff against an empty `mine` would otherwise emit
  // a phantom whole-content hunk that drives every add file to
  // permanent "unresolved" status (sidebar pill never flips, "Accept
  // all incoming" is a silent no-op because the result already equals
  // theirs). Symmetric for `kind: 'remove'` on the theirs side.
  const theirsHunks = useMemo(
    () => (file.kind === 'remove' ? [] : diffLinesPatience(file.theirs, resultText)),
    [file.theirs, resultText, file.kind],
  );
  const mineHunks = useMemo(
    () => (file.kind === 'add' ? [] : diffLinesPatience(file.mine, resultText)),
    [file.mine, resultText, file.kind],
  );

  // Base-axis diffs feed the analysis pipeline when base is available.
  // 2-pane fallback (file.base undefined) lets `analyzeHunks` derive
  // per-side kinds from the pair-diff alone.
  const theirsBaseHunks = useMemo(
    () => (file.base !== undefined ? diffLinesPatience(file.base, file.theirs) : []),
    [file.base, file.theirs],
  );
  const mineBaseHunks = useMemo(
    () => (file.base !== undefined ? diffLinesPatience(file.base, file.mine) : []),
    [file.base, file.mine],
  );

  // Hunks that participate in the per-side state machine AND drive
  // every visual decoration. Computed ONCE against
  // `file.initialResult` (not the live `resultText`) so hunk identity
  // is stable across the user's own pick-driven buffer edits. If we
  // used the live `theirsHunks`, accepting a hunk would write theirs
  // into result, causing diff(theirs, result) to drop that hunk
  // (content matches now) — which would tear down the OTHER side's
  // action zone too, destroying the user's affordance to also accept
  // the other side and produce a combination. Static hunks persist
  // until the file switches.
  //
  // pickStateHunks's range axes (theirsRange = positions in
  // file.theirs, mineRange = positions in file.initialResult ≈
  // file.mine) are stable, which is what the per-pane decorations
  // need — live hunks have result-side mineRange that drifts from
  // mine after each accept, causing decorations to land on the
  // wrong rows.
  const pickStateHunks = useMemo(
    () => (file.kind === 'remove' ? [] : diffLinesPatience(file.theirs, file.initialResult)),
    [file.theirs, file.initialResult, file.kind],
  );

  // Per-hunk base-aware analysis. One pass producing one HunkAnalysis
  // per pickStateHunk — every downstream visual decision (line tint,
  // frame color, missing-side placeholder, conflict counter, "apply
  // non-conflicting" gate) reads from this single source of truth.
  // Stable: depends on initialResult, not the live result text. Base
  // hunks are passed only when file.base is supplied; 2-pane fallback
  // derives kinds from the pair-diff inside `analyzeHunks`.
  const analyses = useMemo(
    () =>
      analyzeHunks({
        pickHunks: pickStateHunks,
        theirsBaseHunks: file.base !== undefined ? theirsBaseHunks : undefined,
        mineBaseHunks: file.base !== undefined ? mineBaseHunks : undefined,
      }),
    [pickStateHunks, file.base, theirsBaseHunks, mineBaseHunks],
  );

  return { theirsHunks, mineHunks, pickStateHunks, analyses };
}
