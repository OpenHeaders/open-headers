/**
 * Character-level intra-line diff via prefix/suffix common-strip.
 *
 * Given two strings, returns the character spans on each side that
 * differ. Algorithm: strip the longest common prefix, then the longest
 * common suffix (not crossing the stripped prefix), then mark the
 * remaining middle as "different" on each side. Cheap (O(n+m)) and
 * captures the typical "I changed this word" case well enough for
 * inline-highlight UX. Pathological middle-substring matches don't get
 * sub-divided — the whole middle is one diff span on each side. That
 * trade-off is fine for an inline highlight; users still see WHERE
 * the change is, just slightly wider than minimal.
 *
 * Phase 0a state-machine spec is silent on intra-hunk granularity;
 * this is a renderer-only enhancement that doesn't affect pick
 * regions.
 */

export interface CharDiffSpan {
  /** 0-based start column. */
  start: number;
  /** 0-based exclusive end column. */
  end: number;
}

export interface CharDiffResult {
  /** Spans in `a` that differ from `b`. */
  aSpans: CharDiffSpan[];
  /** Spans in `b` that differ from `a`. */
  bSpans: CharDiffSpan[];
}

export function diffChars(a: string, b: string): CharDiffResult {
  // Longest common prefix.
  let prefix = 0;
  const minLen = Math.min(a.length, b.length);
  while (prefix < minLen && a.charCodeAt(prefix) === b.charCodeAt(prefix)) prefix++;

  // Longest common suffix that doesn't overlap the prefix on either side.
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a.charCodeAt(a.length - 1 - suffix) === b.charCodeAt(b.length - 1 - suffix)
  ) {
    suffix++;
  }

  const aMidEnd = a.length - suffix;
  const bMidEnd = b.length - suffix;

  const aSpans: CharDiffSpan[] = aMidEnd > prefix ? [{ start: prefix, end: aMidEnd }] : [];
  const bSpans: CharDiffSpan[] = bMidEnd > prefix ? [{ start: prefix, end: bMidEnd }] : [];

  return { aSpans, bSpans };
}
