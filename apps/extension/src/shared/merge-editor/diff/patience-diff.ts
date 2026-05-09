/**
 * Patience diff — Bram Cohen's algorithm for producing readable
 * line-level diffs.
 *
 *   1. Find lines that occur exactly ONCE in BOTH inputs (unique
 *      pairs).
 *   2. Compute the longest increasing subsequence (LIS) of their
 *      partner positions — these are anchor matches that must
 *      align in any sane diff.
 *   3. Between consecutive anchors (and outside them), recurse:
 *      run patience again on the sub-slice; fall back to line-LCS
 *      when there are no unique pairs left.
 *
 * Compared to plain LCS, patience anchors on locally-unique lines
 * (closing braces, blank lines, etc. — not unique; opening of a
 * named section, function name lines, etc. — usually unique). This
 * avoids the failure mode where LCS aligns on common short lines
 * (`}`, `};`, blank) and produces tangled hunks that span unrelated
 * sections. For source-like inputs (YAML, code) it's the standard
 * fix.
 *
 * The output is the same `Hunk[]` shape `diffLines` produces, so
 * callers swap implementations without other changes.
 */

import { diffLines, type Hunk } from './line-diff';

/** Patience-diff entry point. Same signature as `diffLines`. */
export function diffLinesPatience(theirsText: string, mineText: string): Hunk[] {
  const theirs = theirsText.split('\n');
  const mine = mineText.split('\n');
  const segments = patienceSegments(theirs, mine, 0, theirs.length, 0, mine.length);
  return segmentsToHunks(theirs, mine, segments);
}

interface DiffSegment {
  kind: 'equal' | 'theirs-only' | 'mine-only' | 'modification';
  theirsStart: number;
  theirsEnd: number;
  mineStart: number;
  mineEnd: number;
}

/**
 * Recursively build the segment list between [theirsStart, theirsEnd)
 * and [mineStart, mineEnd). Anchors come from unique-line matches
 * inside the slice; non-anchor regions delegate to line-LCS via
 * `diffLines` on the slice text.
 */
function patienceSegments(
  theirs: readonly string[],
  mine: readonly string[],
  theirsStart: number,
  theirsEnd: number,
  mineStart: number,
  mineEnd: number,
): DiffSegment[] {
  // Trim shared prefix + suffix — small optimization but also makes
  // the recursion well-behaved on long files.
  let ts = theirsStart;
  const te = theirsEnd;
  let ms = mineStart;
  const me = mineEnd;
  const out: DiffSegment[] = [];

  // Common prefix.
  let prefixLen = 0;
  while (ts + prefixLen < te && ms + prefixLen < me && theirs[ts + prefixLen] === mine[ms + prefixLen]) {
    prefixLen++;
  }
  if (prefixLen > 0) {
    out.push({
      kind: 'equal',
      theirsStart: ts,
      theirsEnd: ts + prefixLen,
      mineStart: ms,
      mineEnd: ms + prefixLen,
    });
    ts += prefixLen;
    ms += prefixLen;
  }

  // Common suffix.
  let suffixLen = 0;
  while (
    te - 1 - suffixLen >= ts &&
    me - 1 - suffixLen >= ms &&
    theirs[te - 1 - suffixLen] === mine[me - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  const teTrim = te - suffixLen;
  const meTrim = me - suffixLen;

  // Inner region [ts, teTrim) × [ms, meTrim).
  const anchors = findPatienceAnchors(theirs, mine, ts, teTrim, ms, meTrim);

  if (anchors.length === 0) {
    // Empty-slice short-circuits — diffLines treats `''` as one
    // empty line, which would mis-classify pure additions/removals
    // as modifications.
    if (ts === teTrim && ms < meTrim) {
      out.push({ kind: 'mine-only', theirsStart: ts, theirsEnd: ts, mineStart: ms, mineEnd: meTrim });
    } else if (ms === meTrim && ts < teTrim) {
      out.push({ kind: 'theirs-only', theirsStart: ts, theirsEnd: teTrim, mineStart: ms, mineEnd: ms });
    } else if (ts < teTrim || ms < meTrim) {
      // Both sides non-empty — fall back to line-LCS for this slice.
      const fallbackTheirs = theirs.slice(ts, teTrim).join('\n');
      const fallbackMine = mine.slice(ms, meTrim).join('\n');
      const sliceHunks = diffLines(fallbackTheirs, fallbackMine);
      // Translate the slice's 1-based hunk ranges back to absolute
      // segment positions.
      let cursorT = ts;
      let cursorM = ms;
      for (const h of sliceHunks) {
        const hT0 = ts + (h.theirsRange.startLine - 1);
        const hT1 = ts + (h.theirsRange.endLine - 1);
        const hM0 = ms + (h.mineRange.startLine - 1);
        const hM1 = ms + (h.mineRange.endLine - 1);
        // Equal stretch before this hunk.
        if (hT0 > cursorT || hM0 > cursorM) {
          out.push({
            kind: 'equal',
            theirsStart: cursorT,
            theirsEnd: hT0,
            mineStart: cursorM,
            mineEnd: hM0,
          });
        }
        out.push({
          kind:
            h.classification === 'addition'
              ? 'mine-only'
              : h.classification === 'removal'
                ? 'theirs-only'
                : 'modification',
          theirsStart: hT0,
          theirsEnd: hT1,
          mineStart: hM0,
          mineEnd: hM1,
        });
        cursorT = hT1;
        cursorM = hM1;
      }
      // Equal trailing stretch.
      if (cursorT < teTrim || cursorM < meTrim) {
        out.push({
          kind: 'equal',
          theirsStart: cursorT,
          theirsEnd: teTrim,
          mineStart: cursorM,
          mineEnd: meTrim,
        });
      }
    }
    // else: both slices empty — no segment.
  } else {
    // Walk anchors, recursing into each gap.
    let prevTheirs = ts;
    let prevMine = ms;
    for (const anchor of anchors) {
      // Gap before this anchor.
      if (prevTheirs < anchor.theirs || prevMine < anchor.mine) {
        out.push(...patienceSegments(theirs, mine, prevTheirs, anchor.theirs, prevMine, anchor.mine));
      }
      // The anchor line itself is an equal segment.
      out.push({
        kind: 'equal',
        theirsStart: anchor.theirs,
        theirsEnd: anchor.theirs + 1,
        mineStart: anchor.mine,
        mineEnd: anchor.mine + 1,
      });
      prevTheirs = anchor.theirs + 1;
      prevMine = anchor.mine + 1;
    }
    // Tail gap after the last anchor.
    if (prevTheirs < teTrim || prevMine < meTrim) {
      out.push(...patienceSegments(theirs, mine, prevTheirs, teTrim, prevMine, meTrim));
    }
  }

  if (suffixLen > 0) {
    out.push({
      kind: 'equal',
      theirsStart: teTrim,
      theirsEnd: te,
      mineStart: meTrim,
      mineEnd: me,
    });
  }

  return out;
}

interface Anchor {
  theirs: number;
  mine: number;
}

/**
 * Find unique-line matches between the two slices, then return the
 * longest increasing subsequence (by `theirs` position) of those
 * matches such that the `mine` positions are also increasing — the
 * patience-sort LIS gives us exactly the maximally-aligned anchor
 * set.
 */
function findPatienceAnchors(
  theirs: readonly string[],
  mine: readonly string[],
  ts: number,
  te: number,
  ms: number,
  me: number,
): Anchor[] {
  // Count occurrences of each line in each slice.
  const theirsCount = new Map<string, number>();
  const theirsIndex = new Map<string, number>();
  for (let i = ts; i < te; i++) {
    const line = theirs[i];
    theirsCount.set(line, (theirsCount.get(line) ?? 0) + 1);
    if (!theirsIndex.has(line)) theirsIndex.set(line, i);
  }
  const mineCount = new Map<string, number>();
  const mineIndex = new Map<string, number>();
  for (let i = ms; i < me; i++) {
    const line = mine[i];
    mineCount.set(line, (mineCount.get(line) ?? 0) + 1);
    if (!mineIndex.has(line)) mineIndex.set(line, i);
  }

  // Collect lines that appear exactly once on each side.
  const uniquePairs: Anchor[] = [];
  for (const [line, count] of theirsCount) {
    if (count !== 1) continue;
    if (mineCount.get(line) !== 1) continue;
    const tIdx = theirsIndex.get(line);
    const mIdx = mineIndex.get(line);
    if (tIdx === undefined || mIdx === undefined) continue;
    uniquePairs.push({ theirs: tIdx, mine: mIdx });
  }

  if (uniquePairs.length === 0) return [];

  // Sort by `theirs` position so the LIS over `mine` positions gives
  // the maximally-aligned strictly-increasing anchor sequence.
  uniquePairs.sort((a, b) => a.theirs - b.theirs);
  return longestIncreasingSubsequence(uniquePairs);
}

/**
 * Standard O(n log n) LIS via patience-sort piles, returning the
 * actual sequence (not just its length).
 */
function longestIncreasingSubsequence(pairs: readonly Anchor[]): Anchor[] {
  if (pairs.length === 0) return [];
  // tails[k] = index in `pairs` of the smallest possible tail of an
  // increasing subsequence of length k+1.
  const tails: number[] = [];
  // prev[i] = predecessor of pairs[i] in the chosen LIS.
  const prev: number[] = new Array(pairs.length).fill(-1);

  for (let i = 0; i < pairs.length; i++) {
    const m = pairs[i].mine;
    // Binary-search for the first tails[k] whose `mine` >= m.
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (pairs[tails[mid]].mine < m) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    if (lo === tails.length) tails.push(i);
    else tails[lo] = i;
  }

  // Reconstruct from the final tail.
  const result: Anchor[] = [];
  let cursor: number = tails[tails.length - 1];
  while (cursor >= 0) {
    result.push(pairs[cursor]);
    cursor = prev[cursor];
  }
  result.reverse();
  return result;
}

/**
 * Convert the segment list back to the `Hunk[]` shape. Same coalescing
 * rules `diffLines` uses: adjacent theirs-only + mine-only fold into
 * one `modification` hunk. `equal` segments are dropped.
 */
function segmentsToHunks(theirs: readonly string[], mine: readonly string[], segments: DiffSegment[]): Hunk[] {
  // Coalesce adjacent same-kind theirs-only / mine-only and merge
  // pairs into modifications.
  const merged: DiffSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (
      last &&
      ((last.kind === 'theirs-only' && seg.kind === 'mine-only') ||
        (last.kind === 'mine-only' && seg.kind === 'theirs-only'))
    ) {
      // Pair into modification.
      merged[merged.length - 1] = {
        kind: 'modification',
        theirsStart: Math.min(last.theirsStart, seg.theirsStart),
        theirsEnd: Math.max(last.theirsEnd, seg.theirsEnd),
        mineStart: Math.min(last.mineStart, seg.mineStart),
        mineEnd: Math.max(last.mineEnd, seg.mineEnd),
      };
      continue;
    }
    if (last && last.kind === seg.kind && last.theirsEnd === seg.theirsStart && last.mineEnd === seg.mineStart) {
      last.theirsEnd = seg.theirsEnd;
      last.mineEnd = seg.mineEnd;
      continue;
    }
    merged.push({ ...seg });
  }

  const hunks: Hunk[] = [];
  for (const seg of merged) {
    if (seg.kind === 'equal') continue;
    const theirsLines = theirs.slice(seg.theirsStart, seg.theirsEnd);
    const mineLines = mine.slice(seg.mineStart, seg.mineEnd);
    const classification: Hunk['classification'] =
      seg.kind === 'modification' ? 'modification' : seg.kind === 'theirs-only' ? 'removal' : 'addition';
    hunks.push({
      id: `${classification}-${hashFnv1a(theirsLines.join('\n'))}-${hashFnv1a(mineLines.join('\n'))}-${hashFnv1a(classification)}`,
      classification,
      theirsRange: { startLine: seg.theirsStart + 1, endLine: seg.theirsEnd + 1 },
      mineRange: { startLine: seg.mineStart + 1, endLine: seg.mineEnd + 1 },
      theirsLines,
      mineLines,
    });
  }
  return hunks;
}

const FNV_OFFSET = 0x811c9dc5 >>> 0;
const FNV_PRIME = 0x01000193;

function hashFnv1a(text: string): string {
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
