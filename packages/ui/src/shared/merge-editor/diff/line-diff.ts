/**
 * Phase 2 foundation — own-the-IDs line diff.
 *
 * Renderer Interface §5 (state-machine spec) treats `hunkId` as opaque
 * from the state-machine layer's perspective. Owning hunk identity is
 * the primary architectural reason Option B beat Option A in the
 * Phase 0b bake-off (§5 decision in the merge-conflict bake-off notes):
 * IDs survive non-intersecting edits because they're content-hashed,
 * not derived from any pane's diff recompute ordinal.
 *
 * Algorithm: classic line-LCS via dynamic programming over hashed
 * lines, then walking the table to emit equal / addition / removal /
 * modification hunks. Same well-known shape every line-merge tool
 * uses — git, diff3 and the mainstream editor diff engines.
 *
 * Known limitation (carried forward from the deleted Option B
 * prototype + the merge-conflict-editor status log Session 3 notes):
 * line-LCS coalesces adjacent unrelated changes when no anchor line
 * separates them. The fix path is Patience or schema-aware structural
 * regions per state-machine spec §3.2; both are larger investments
 * scheduled for a later Phase 2 slice. The current shape is the
 * known-imperfect baseline the rest of the rendering stack composes
 * against.
 *
 * No Monaco coupling here — this module is pure data and lifts
 * unchanged into the future shared-UI package.
 */

export type HunkClassification = 'addition' | 'removal' | 'modification';

export interface LineRange {
  /** 1-based inclusive line number. */
  startLine: number;
  /** 1-based exclusive line number (`startLine === endLine` ⇒ zero
   *  lines, used for pure-addition or pure-removal regions on the
   *  side that has no content). */
  endLine: number;
}

export interface Hunk {
  /** Content-hashed identity. Stable across non-intersecting edits;
   *  the load-bearing C1 property the bake-off was decided on. */
  id: string;
  classification: HunkClassification;
  theirsRange: LineRange;
  mineRange: LineRange;
  /** Theirs-side lines (empty for `addition`). */
  theirsLines: readonly string[];
  /** Mine-side lines (empty for `removal`). */
  mineLines: readonly string[];
}

export interface DiffOptions {
  /** Splits on `\n`. Trailing-newline semantics: a value ending in
   *  `\n` produces a final empty trailing line that the caller can
   *  ignore at render time. The diff routine treats it as content
   *  for stability. */
  splitter?: (text: string) => string[];
}

const DEFAULT_SPLITTER = (text: string): string[] => text.split('\n');

const FNV_OFFSET = 0x811c9dc5 >>> 0;
const FNV_PRIME = 0x01000193;

/** FNV-1a (32-bit). Cheap, well-distributed for short lines, no deps.
 *  Identity-of-content only — collision probability is negligible at
 *  the line counts the merge editor handles (low thousands per file).
 *  Hex-string output keeps Hunk IDs stable across JS engines that
 *  normalize numeric → string differently. */
function fnv1a(text: string): string {
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Hash a sequence of lines via cumulative FNV; the result composes
 *  the hashes of all input lines so adjacent identical content
 *  produces identical sequence-hashes regardless of line index. */
function hashLines(lines: readonly string[]): string {
  let h = FNV_OFFSET;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      h ^= line.charCodeAt(i);
      h = Math.imul(h, FNV_PRIME) >>> 0;
    }
    // Newline-equivalent separator so `["ab","c"]` and `["a","bc"]`
    // hash differently.
    h ^= 0x0a;
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Compute the LCS DP table of (theirsLines × mineLines). Cell
 *  `dp[i][j]` is the LCS length of `theirs[0..i)` vs `mine[0..j)`. */
function computeLcsTable(theirs: readonly string[], mine: readonly string[]): Uint32Array[] {
  const T = theirs.length;
  const M = mine.length;
  const dp: Uint32Array[] = new Array(T + 1);
  for (let i = 0; i <= T; i++) dp[i] = new Uint32Array(M + 1);
  for (let i = 1; i <= T; i++) {
    const tline = theirs[i - 1];
    for (let j = 1; j <= M; j++) {
      if (tline === mine[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/** Walk the DP table back-to-front emitting equal / mine-only /
 *  theirs-only segments in forward order. */
interface Segment {
  kind: 'equal' | 'theirs-only' | 'mine-only';
  /** 0-based start indices in each input. */
  theirsStart: number;
  theirsEnd: number;
  mineStart: number;
  mineEnd: number;
}

function walkLcs(theirs: readonly string[], mine: readonly string[], dp: Uint32Array[]): Segment[] {
  const segs: Segment[] = [];
  let i = theirs.length;
  let j = mine.length;
  // Emit reverse-order single-step kinds first; coalesce + flip later.
  type Step = { kind: 'equal' | 'theirs-only' | 'mine-only'; theirsIdx: number; mineIdx: number };
  const steps: Step[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && theirs[i - 1] === mine[j - 1]) {
      steps.push({ kind: 'equal', theirsIdx: i - 1, mineIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      steps.push({ kind: 'mine-only', theirsIdx: i, mineIdx: j - 1 });
      j--;
    } else {
      steps.push({ kind: 'theirs-only', theirsIdx: i - 1, mineIdx: j });
      i--;
    }
  }
  steps.reverse();

  // Coalesce contiguous same-kind steps into segments.
  for (const step of steps) {
    const last = segs[segs.length - 1];
    if (last && last.kind === step.kind && step.kind === 'equal') {
      last.theirsEnd = step.theirsIdx + 1;
      last.mineEnd = step.mineIdx + 1;
      continue;
    }
    if (last && last.kind === step.kind && step.kind === 'theirs-only') {
      last.theirsEnd = step.theirsIdx + 1;
      continue;
    }
    if (last && last.kind === step.kind && step.kind === 'mine-only') {
      last.mineEnd = step.mineIdx + 1;
      continue;
    }
    segs.push({
      kind: step.kind,
      theirsStart: step.kind === 'mine-only' ? step.theirsIdx : step.theirsIdx,
      theirsEnd: step.kind === 'mine-only' ? step.theirsIdx : step.theirsIdx + 1,
      mineStart: step.kind === 'theirs-only' ? step.mineIdx : step.mineIdx,
      mineEnd: step.kind === 'theirs-only' ? step.mineIdx : step.mineIdx + 1,
    });
  }
  return segs;
}

/**
 * Compute the line-level diff between `theirs` and `mine`. Returns
 * an ordered list of hunks; equal regions are NOT emitted (they're
 * the regions WITHOUT decorations). Adjacent theirs-only +
 * mine-only segments coalesce into a single `modification` hunk —
 * matching how IDE merge tools render "this block changed."
 */
export function diffLines(theirsText: string, mineText: string, options: DiffOptions = {}): Hunk[] {
  const split = options.splitter ?? DEFAULT_SPLITTER;
  const theirs = split(theirsText);
  const mine = split(mineText);

  const dp = computeLcsTable(theirs, mine);
  const segs = walkLcs(theirs, mine, dp);

  // Coalesce adjacent theirs-only + mine-only into modification hunks.
  // Order doesn't matter (theirs-only-then-mine-only and the reverse
  // both compose into the same "block changed" rendering).
  const hunks: Hunk[] = [];
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s];
    if (seg.kind === 'equal') continue;

    let theirsStart = seg.theirsStart;
    let theirsEnd = seg.theirsEnd;
    let mineStart = seg.mineStart;
    let mineEnd = seg.mineEnd;
    let kind = seg.kind;

    const next = segs[s + 1];
    if (
      next &&
      ((kind === 'theirs-only' && next.kind === 'mine-only') || (kind === 'mine-only' && next.kind === 'theirs-only'))
    ) {
      theirsStart = Math.min(theirsStart, next.theirsStart);
      theirsEnd = Math.max(theirsEnd, next.theirsEnd);
      mineStart = Math.min(mineStart, next.mineStart);
      mineEnd = Math.max(mineEnd, next.mineEnd);
      kind = 'theirs-only'; // marker overwritten below
      s++; // consume the paired segment
      const theirsLines = theirs.slice(theirsStart, theirsEnd);
      const mineLines = mine.slice(mineStart, mineEnd);
      hunks.push({
        id: hunkIdFor('modification', theirsLines, mineLines),
        classification: 'modification',
        theirsRange: { startLine: theirsStart + 1, endLine: theirsEnd + 1 },
        mineRange: { startLine: mineStart + 1, endLine: mineEnd + 1 },
        theirsLines,
        mineLines,
      });
      continue;
    }

    if (kind === 'theirs-only') {
      const theirsLines = theirs.slice(theirsStart, theirsEnd);
      hunks.push({
        id: hunkIdFor('removal', theirsLines, []),
        classification: 'removal',
        theirsRange: { startLine: theirsStart + 1, endLine: theirsEnd + 1 },
        mineRange: { startLine: mineStart + 1, endLine: mineStart + 1 },
        theirsLines,
        mineLines: [],
      });
    } else {
      const mineLines = mine.slice(mineStart, mineEnd);
      hunks.push({
        id: hunkIdFor('addition', [], mineLines),
        classification: 'addition',
        theirsRange: { startLine: theirsStart + 1, endLine: theirsStart + 1 },
        mineRange: { startLine: mineStart + 1, endLine: mineEnd + 1 },
        theirsLines: [],
        mineLines,
      });
    }
  }
  return hunks;
}

function hunkIdFor(
  classification: HunkClassification,
  theirsLines: readonly string[],
  mineLines: readonly string[],
): string {
  // Composing classification + both side hashes prevents a degenerate
  // "this addition has the same content as that removal" collision
  // from yielding the same id.
  return `${classification}-${hashLines(theirsLines)}-${hashLines(mineLines)}-${fnv1a(classification)}`;
}

// Exported for tests; the rest of the module treats hashing as an
// implementation detail.
export const __test__ = { fnv1a, hashLines };
