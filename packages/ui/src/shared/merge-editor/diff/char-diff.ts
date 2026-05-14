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

/**
 * Tokenize a string into runs of word-chars (letters / digits /
 * underscore) and runs of non-word chars (whitespace, punctuation,
 * symbols). Each run is a single token. Concatenating the tokens
 * reproduces the input exactly.
 *
 * Word-vs-non-word is the right granularity for source code: an
 * identifier rename like `userId` → `customerId` produces two tokens
 * the diff can match-vs-mismatch cleanly; meanwhile the surrounding
 * `(`, `,`, ` ` punctuation lives in their own non-word tokens that
 * usually match across versions.
 */
function tokenizeWords(s: string): readonly string[] {
  if (s.length === 0) return [];
  const out: string[] = [];
  const isWord = (cc: number): boolean =>
    (cc >= 48 && cc <= 57) || // 0-9
    (cc >= 65 && cc <= 90) || // A-Z
    (cc >= 97 && cc <= 122) || // a-z
    cc === 95; // _
  let start = 0;
  let curIsWord = isWord(s.charCodeAt(0));
  for (let i = 1; i < s.length; i++) {
    const w = isWord(s.charCodeAt(i));
    if (w !== curIsWord) {
      out.push(s.slice(start, i));
      start = i;
      curIsWord = w;
    }
  }
  out.push(s.slice(start));
  return out;
}

/**
 * Word-level intra-line diff via token LCS.
 *
 * Tokenizes each side via `tokenizeWords`, runs LCS on token strings,
 * then walks the alignment to emit one span per contiguous run of
 * unmatched tokens on each side. Coalescing adjacent unmatched-token
 * spans into one keeps the inline-highlight UX consistent with
 * `diffChars` (one span per "thing that changed") while subdividing
 * the long-line / identifier-rename case `diffChars` smushed into one
 * giant span.
 *
 * Cost is O(n*m) DP where n, m are token counts (typically << char
 * counts). For typical lines this is comparable to or cheaper than
 * `diffChars`'s prefix/suffix common-strip on the same input.
 */
export function diffWords(a: string, b: string): CharDiffResult {
  if (a === b) return { aSpans: [], bSpans: [] };
  const A = tokenizeWords(a);
  const B = tokenizeWords(b);
  const n = A.length;
  const m = B.length;
  if (n === 0) return { aSpans: [], bSpans: b.length > 0 ? [{ start: 0, end: b.length }] : [] };
  if (m === 0) return { aSpans: a.length > 0 ? [{ start: 0, end: a.length }] : [], bSpans: [] };

  const dp: Uint32Array[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (A[i - 1] === B[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Walk back collecting matched (a-index, b-index) pairs in reverse.
  const matches: Array<{ ai: number; bi: number }> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) {
      matches.push({ ai: i - 1, bi: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  matches.reverse();

  // Walk a-side / b-side token streams in parallel with the match
  // sequence. Unmatched-token gaps coalesce by running through the
  // contiguous unmatched range and emitting one span per side from
  // first-unmatched-token start col to last-unmatched-token end col.
  const aTokenStarts = new Array<number>(n + 1);
  const bTokenStarts = new Array<number>(m + 1);
  let acc = 0;
  for (let k = 0; k < n; k++) {
    aTokenStarts[k] = acc;
    acc += A[k].length;
  }
  aTokenStarts[n] = acc;
  acc = 0;
  for (let k = 0; k < m; k++) {
    bTokenStarts[k] = acc;
    acc += B[k].length;
  }
  bTokenStarts[m] = acc;

  const aSpans: CharDiffSpan[] = [];
  const bSpans: CharDiffSpan[] = [];
  let aCursor = 0;
  let bCursor = 0;
  for (const match of matches) {
    if (match.ai > aCursor) {
      aSpans.push({ start: aTokenStarts[aCursor], end: aTokenStarts[match.ai] });
    }
    if (match.bi > bCursor) {
      bSpans.push({ start: bTokenStarts[bCursor], end: bTokenStarts[match.bi] });
    }
    aCursor = match.ai + 1;
    bCursor = match.bi + 1;
  }
  if (aCursor < n) aSpans.push({ start: aTokenStarts[aCursor], end: aTokenStarts[n] });
  if (bCursor < m) bSpans.push({ start: bTokenStarts[bCursor], end: bTokenStarts[m] });
  return { aSpans, bSpans };
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
