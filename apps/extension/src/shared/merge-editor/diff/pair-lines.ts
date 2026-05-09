/**
 * LCS-based line pairing for intra-hunk char-diff.
 *
 * Given two arrays of lines (the theirs/mine sides of a modification
 * hunk), pair lines by longest-common-subsequence so corresponding
 * unchanged lines align — even when the hunk has uneven line counts
 * or shifted-line content. Lines without a partner are dropped from
 * the output (no char-diff highlight; the whole-line hunk background
 * already signals "different").
 *
 * Use case is small (modification hunks are typically a handful of
 * lines), so plain DP O(n*m) is fine — same shape as `line-diff.ts`'s
 * LCS table.
 */

export interface LinePair {
  aIdx: number;
  bIdx: number;
  /** True when both sides have the SAME content at the paired
   *  indices (LCS match). False when callers chose to pair adjacent
   *  unmatched lines for fallback char-highlighting purposes. */
  exactMatch: boolean;
}

/**
 * Pair lines via LCS, returning all index pairs in order. Identical
 * line content yields `exactMatch: true`; the caller can skip
 * char-diff on those (they're the same string).
 *
 * Lines with no LCS-pair are emitted as best-effort adjacency pairs:
 * for each contiguous "between-anchors" gap, the leading lines on
 * each side pair up by index, and trailing extras drop. This gives
 * the char-diff overlay something to highlight on changed-line
 * regions while still respecting cross-hunk anchors.
 */
export function pairLines(a: readonly string[], b: readonly string[]): LinePair[] {
  const A = a.length;
  const B = b.length;
  if (A === 0 || B === 0) return [];

  // LCS DP table.
  const dp: Uint32Array[] = new Array(A + 1);
  for (let i = 0; i <= A; i++) dp[i] = new Uint32Array(B + 1);
  for (let i = 1; i <= A; i++) {
    for (let j = 1; j <= B; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Walk back to extract LCS-matched anchor pairs (in reverse).
  const anchors: LinePair[] = [];
  let i = A;
  let j = B;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      anchors.push({ aIdx: i - 1, bIdx: j - 1, exactMatch: true });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  anchors.reverse();

  // Fill in adjacency pairs for the gaps between anchors. For each
  // gap [aStart, aEnd) × [bStart, bEnd), pair indices from the start
  // up to the smaller of the two side lengths.
  const out: LinePair[] = [];
  let aCursor = 0;
  let bCursor = 0;
  for (const anchor of anchors) {
    const aGap = anchor.aIdx;
    const bGap = anchor.bIdx;
    const gapPairs = Math.min(aGap - aCursor, bGap - bCursor);
    for (let k = 0; k < gapPairs; k++) {
      out.push({ aIdx: aCursor + k, bIdx: bCursor + k, exactMatch: false });
    }
    out.push(anchor);
    aCursor = aGap + 1;
    bCursor = bGap + 1;
  }
  // Trailing gap.
  const tailPairs = Math.min(A - aCursor, B - bCursor);
  for (let k = 0; k < tailPairs; k++) {
    out.push({ aIdx: aCursor + k, bIdx: bCursor + k, exactMatch: false });
  }
  return out;
}
