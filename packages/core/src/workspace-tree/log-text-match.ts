/**
 * The log's text matcher — what the text-or-hash field of a history
 * view matches a commit by: its subject, its author's name, or the
 * start of its hash (a pattern reads the whole hash). ONE definition
 * for the host that searches a history and the view that paints where
 * a row matched, so what is listed is what is painted. Pure.
 *
 * A plain text is matched as itself — no pattern engine runs. A
 * pattern is the caller's to bound: it is compiled here and run by
 * whoever calls a test.
 *
 * A matcher says what it is made of — the test of one text, the test
 * of a hash, the pattern behind them — so whoever matches a whole
 * history tests an author's name once, spells no hash out for a text
 * that can match none, and runs a pattern where it can be ended.
 */

export interface LogTextFields {
  subject: string;
  authorName: string;
  sha: string;
}

/** A stretch of a text the filter matched: `[start, end)`. */
export type LogTextRange = readonly [number, number];

export type LogTextMatcher =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | {
      kind: 'match';
      /** The pattern every test runs; null for a plain text, which runs none. */
      pattern: RegExp | null;
      /** Whether one text — a subject, an author's name — matches. */
      testText: (text: string) => boolean;
      /** Whether a hash matches; null for a text that can match no hash at all. */
      testSha: ((sha: string) => boolean) | null;
      /** Whether a commit matches: by its subject, its author's name or its hash. */
      test: (entry: LogTextFields) => boolean;
      /** Every stretch of `text` the filter matches, in order — what a row paints. */
      ranges: (text: string) => LogTextRange[];
    };

type LogTextMatch = Extract<LogTextMatcher, { kind: 'match' }>;

/** The start of a hash, as a plain text can spell one: hex digits, no more of them than the longest hash has. */
const HASH_START = /^[0-9a-f]{1,64}$/;

/** Every non-empty match of a global pattern in `text`. */
function patternRanges(pattern: RegExp, text: string): LogTextRange[] {
  const ranges: LogTextRange[] = [];
  for (const match of text.matchAll(pattern)) {
    if (match[0].length > 0) ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

/** A literal text as a pattern that matches it and nothing else. */
function literalPattern(needle: string, matchCase: boolean): RegExp {
  return new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
}

/** The matcher its parts make: a commit matches by any one of its fields. */
function matcherOf(parts: Omit<LogTextMatch, 'kind' | 'test'>): LogTextMatch {
  const { testText, testSha } = parts;
  return {
    kind: 'match',
    ...parts,
    test: (entry) => testText(entry.subject) || testText(entry.authorName) || testSha?.(entry.sha) === true,
  };
}

export function makeLogTextMatcher(filter: string, regex: boolean, matchCase: boolean): LogTextMatcher {
  const needle = filter.trim();
  if (needle === '') return { kind: 'none' };
  if (regex) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(needle, matchCase ? '' : 'i');
    } catch {
      return { kind: 'invalid' };
    }
    const everywhere = new RegExp(needle, matchCase ? 'g' : 'gi');
    return matcherOf({
      pattern,
      testText: (text) => pattern.test(text),
      testSha: (sha) => pattern.test(sha),
      ranges: (text) => patternRanges(everywhere, text),
    });
  }
  const lowered = needle.toLowerCase();
  const literal = literalPattern(needle, matchCase);
  return matcherOf({
    pattern: null,
    testText: matchCase ? (text) => text.includes(needle) : (text) => text.toLowerCase().includes(lowered),
    testSha: HASH_START.test(lowered) ? (sha) => sha.startsWith(lowered) : null,
    ranges: (text) => patternRanges(literal, text),
  });
}
