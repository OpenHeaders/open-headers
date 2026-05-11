/**
 * Base-aware semantic analysis of merge hunks.
 *
 * The pair-diff primitive (`line-diff.ts`) describes only the theirs↔result
 * delta — addition / removal / modification of the right operand vs the
 * left. That's the wrong shape for a merge editor: a row MODIFIED on mine
 * but DELETED on theirs is a pair-diff `addition` (mine has lines theirs
 * lacks), losing the "what happened on each side vs the common ancestor"
 * semantics the user needs to read.
 *
 * `analyzeHunks` consumes a stable pick-state hunk set plus the optional
 * base→side diff axes and produces one `HunkAnalysis` per hunk with the
 * per-side kind vs base baked in. Downstream visual mapping
 * (`view/hunk-visual.ts`) reads from analyses, not from pair-diff
 * classifications — so palette decisions track real merge semantics.
 *
 * 2-pane fallback (no base): per-side kinds are derived from the
 * pair-diff classification so the analysis shape stays the same and
 * downstream consumers don't branch on `hasBase`. The conflict flag
 * uses the pair-diff `modification` heuristic in that case (both sides
 * have differing content for the same region ⇒ true conflict).
 */

import { rangesOverlap } from './conflict-classify';
import type { Hunk, LineRange } from './line-diff';

/** Per-side, per-hunk kind vs base.
 *
 *   added      — this side has content not in base
 *   removed    — base had content here, this side dropped it
 *   modified   — base content changed on this side
 *   unchanged  — this side matches base in this region (the other
 *                side drove the divergence)
 */
export type SideKind = 'added' | 'removed' | 'modified' | 'unchanged';

export interface SideChange {
  kind: SideKind;
  lines: readonly string[];
  range: LineRange;
  /** `range.endLine <= range.startLine` — i.e. zero-extent. Cached
   *  so consumers don't recompute on every read. */
  isEmpty: boolean;
}

/** Conflict shape:
 *
 *   true  — both sides changed vs base in the same region. Requires a
 *           user decision (orange action zone).
 *   clean — at most one side changed vs base; the other is unchanged
 *           (auto-mergeable, blue action zone).
 */
export type HunkConflict = 'true' | 'clean';

export interface HunkAnalysis {
  id: string;
  /** The pick-state hunk this analysis refers to. Carries the line
   *  ranges + identity. */
  hunk: Hunk;
  theirs: SideChange;
  mine: SideChange;
  conflict: HunkConflict;
  /** True when base info was supplied (3-pane). False = 2-pane
   *  fallback; per-side kinds were derived from pair-diff. */
  hasBase: boolean;
}

export interface AnalyzeHunksArgs {
  /** Stable pick-state hunks (`diff(theirs, initialResult)`). Identity
   *  domain for the per-side state machine + every downstream
   *  decoration. */
  pickHunks: readonly Hunk[];
  /** `diff(base, theirs)`. Each hunk's `mineRange` is the theirs-side
   *  range (right operand). Omit for 2-pane fallback. */
  theirsBaseHunks?: readonly Hunk[];
  /** `diff(base, mine)`. Each hunk's `mineRange` is the mine-side
   *  range. Omit for 2-pane fallback. */
  mineBaseHunks?: readonly Hunk[];
}

/** Map a base→side diff hunk classification to a per-side kind.
 *  `mineRange` on the base→side hunk is the side's range; classification
 *  describes what the side did vs base. */
function kindFromBaseDelta(classification: 'addition' | 'removal' | 'modification'): SideKind {
  if (classification === 'addition') return 'added';
  if (classification === 'removal') return 'removed';
  return 'modified';
}

function isEmptyRange(range: LineRange): boolean {
  return range.endLine <= range.startLine;
}

/**
 * Resolve per-side kind by overlapping the pick-state hunk's pane
 * range against the base→side diff. The first overlap wins — pick-state
 * hunks are coarse-grained enough that more than one base-side hunk
 * inside a single pick-state hunk is rare and would all share the same
 * semantic anyway (a region where this side diverged from base).
 */
function classifySideAgainstBase(ownRange: LineRange, baseSideHunks: readonly Hunk[]): SideKind {
  for (const bh of baseSideHunks) {
    if (rangesOverlap(ownRange, bh.mineRange)) {
      return kindFromBaseDelta(bh.classification);
    }
  }
  return 'unchanged';
}

/** 2-pane fallback: each side's kind comes from the pair-diff alone.
 *  Preserves the prior "removal → addition flip on the populated side"
 *  semantics so existing fixtures + visual tests stay stable. */
function classifySidesFromPairDiff(h: Hunk): { theirs: SideKind; mine: SideKind } {
  switch (h.classification) {
    case 'addition':
      // Mine has extra content; theirs has nothing here.
      return { theirs: 'unchanged', mine: 'added' };
    case 'removal':
      // Theirs has extra content; mine has nothing here.
      return { theirs: 'added', mine: 'unchanged' };
    case 'modification':
      return { theirs: 'modified', mine: 'modified' };
  }
}

export function analyzeHunks(args: AnalyzeHunksArgs): readonly HunkAnalysis[] {
  const hasBase = args.theirsBaseHunks !== undefined && args.mineBaseHunks !== undefined;
  const result: HunkAnalysis[] = [];
  for (const h of args.pickHunks) {
    let theirsKind: SideKind;
    let mineKind: SideKind;
    if (hasBase && args.theirsBaseHunks && args.mineBaseHunks) {
      theirsKind = classifySideAgainstBase(h.theirsRange, args.theirsBaseHunks);
      mineKind = classifySideAgainstBase(h.mineRange, args.mineBaseHunks);
    } else {
      const pair = classifySidesFromPairDiff(h);
      theirsKind = pair.theirs;
      mineKind = pair.mine;
    }

    // Conflict shape:
    //   3-pane: both sides moved vs base ⇒ true conflict (the orange
    //   "decide me" frame). Single-sided change ⇒ clean (auto-mergeable).
    //   2-pane: pair-diff modification means both sides have differing
    //   content for the same region — best heuristic available without
    //   base.
    let conflict: HunkConflict;
    if (hasBase) {
      const theirsChanged = theirsKind !== 'unchanged';
      const mineChanged = mineKind !== 'unchanged';
      conflict = theirsChanged && mineChanged ? 'true' : 'clean';
    } else {
      conflict = h.classification === 'modification' ? 'true' : 'clean';
    }

    result.push({
      id: h.id,
      hunk: h,
      theirs: {
        kind: theirsKind,
        lines: h.theirsLines,
        range: h.theirsRange,
        isEmpty: isEmptyRange(h.theirsRange),
      },
      mine: {
        kind: mineKind,
        lines: h.mineLines,
        range: h.mineRange,
        isEmpty: isEmptyRange(h.mineRange),
      },
      conflict,
      hasBase,
    });
  }
  return result;
}
