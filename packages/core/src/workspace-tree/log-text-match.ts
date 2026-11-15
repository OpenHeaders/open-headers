/**
 * The log's text matcher — what the text-or-hash field of a history
 * view matches a commit by: its subject, its author's name, or the
 * start of its hash (a pattern reads the whole hash). ONE definition
 * for the host that searches a history and the view that paints where
 * a row matched, so what is listed is what is painted. Pure.
 *
 * A plain text is matched as itself — no pattern engine runs. A
 * pattern is the caller's to bound: it is compiled here and run by
 * whoever calls `test`.
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
      test: (entry: LogTextFields) => boolean;
      /** Every stretch of `text` the filter matches, in order — what a row paints. */
      ranges: (text: string) => LogTextRange[];
    };

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
    return {
      kind: 'match',
      test: (entry) => pattern.test(entry.subject) || pattern.test(entry.authorName) || pattern.test(entry.sha),
      ranges: (text) => patternRanges(everywhere, text),
    };
  }
  const lowered = needle.toLowerCase();
  const literal = literalPattern(needle, matchCase);
  return {
    kind: 'match',
    ranges: (text) => patternRanges(literal, text),
    test: (entry) => {
      if (matchCase) {
        return entry.subject.includes(needle) || entry.authorName.includes(needle) || entry.sha.startsWith(lowered);
      }
      return (
        entry.subject.toLowerCase().includes(lowered) ||
        entry.authorName.toLowerCase().includes(lowered) ||
        entry.sha.startsWith(lowered)
      );
    },
  };
}
