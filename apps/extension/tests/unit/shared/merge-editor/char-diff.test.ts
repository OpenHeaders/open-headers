import { describe, expect, it } from 'vitest';
import { diffChars, diffWords } from '@openheaders/ui/shared/merge-editor/diff/char-diff';

describe('diffChars', () => {
  it('returns no spans for identical input', () => {
    const r = diffChars('hello', 'hello');
    expect(r.aSpans).toEqual([]);
    expect(r.bSpans).toEqual([]);
  });

  it('marks the differing middle when both sides differ', () => {
    const r = diffChars('value: red', 'value: blue');
    expect(r.aSpans).toEqual([{ start: 7, end: 10 }]);
    expect(r.bSpans).toEqual([{ start: 7, end: 11 }]);
  });

  it('marks a pure-addition tail on the b side', () => {
    const r = diffChars('hello', 'hello world');
    expect(r.aSpans).toEqual([]);
    expect(r.bSpans).toEqual([{ start: 5, end: 11 }]);
  });

  it('marks a pure-removal tail on the a side', () => {
    const r = diffChars('hello world', 'hello');
    expect(r.aSpans).toEqual([{ start: 5, end: 11 }]);
    expect(r.bSpans).toEqual([]);
  });

  it('handles a leading change', () => {
    const r = diffChars('abc-tail', 'xyz-tail');
    expect(r.aSpans).toEqual([{ start: 0, end: 3 }]);
    expect(r.bSpans).toEqual([{ start: 0, end: 3 }]);
  });

  it('totally different strings give whole-string spans', () => {
    const r = diffChars('abc', 'xyz');
    expect(r.aSpans).toEqual([{ start: 0, end: 3 }]);
    expect(r.bSpans).toEqual([{ start: 0, end: 3 }]);
  });

  it('handles empty inputs', () => {
    expect(diffChars('', '').aSpans).toEqual([]);
    expect(diffChars('', 'hello').bSpans).toEqual([{ start: 0, end: 5 }]);
    expect(diffChars('hello', '').aSpans).toEqual([{ start: 0, end: 5 }]);
  });
});

describe('diffWords', () => {
  it('returns no spans for identical input', () => {
    const r = diffWords('hello world', 'hello world');
    expect(r.aSpans).toEqual([]);
    expect(r.bSpans).toEqual([]);
  });

  it('handles empty inputs', () => {
    expect(diffWords('', '')).toEqual({ aSpans: [], bSpans: [] });
    expect(diffWords('', 'hello')).toEqual({ aSpans: [], bSpans: [{ start: 0, end: 5 }] });
    expect(diffWords('hello', '')).toEqual({ aSpans: [{ start: 0, end: 5 }], bSpans: [] });
  });

  it('isolates a single changed word with surrounding punctuation untouched', () => {
    // a tokens: ['value', ': ', 'red'] · b tokens: ['value', ': ', 'blue']
    // LCS matches the first two tokens, so only the trailing word
    // gets a span — width matches each side's word length.
    const r = diffWords('value: red', 'value: blue');
    expect(r.aSpans).toEqual([{ start: 7, end: 10 }]);
    expect(r.bSpans).toEqual([{ start: 7, end: 11 }]);
  });

  it('subdivides identifier-rename inside a long line into per-word spans', () => {
    // The win over diffChars: char-diff's prefix/suffix common-strip
    // would smush this into one giant span (`UserName(userId` →
    // `CustomerName(customerId`). Word-LCS keeps `(` and `)` matched,
    // so each renamed identifier highlights as its own span.
    const a = 'getUserName(userId)';
    const b = 'getCustomerName(customerId)';
    const r = diffWords(a, b);
    // a tokens: getUserName ( userId )  → indices 0..11, 11..12, 12..18, 18..19
    // b tokens: getCustomerName ( customerId )
    expect(r.aSpans).toEqual([
      { start: 0, end: 11 },
      { start: 12, end: 18 },
    ]);
    expect(r.bSpans).toEqual([
      { start: 0, end: 15 },
      { start: 16, end: 26 },
    ]);
  });

  it('marks pure-addition / pure-removal tails on the diverging side', () => {
    expect(diffWords('hello', 'hello world')).toEqual({
      aSpans: [],
      bSpans: [{ start: 5, end: 11 }],
    });
    expect(diffWords('hello world', 'hello')).toEqual({
      aSpans: [{ start: 5, end: 11 }],
      bSpans: [],
    });
  });

  it('totally different word gives whole-string spans on each side', () => {
    const r = diffWords('abc', 'xyz');
    expect(r.aSpans).toEqual([{ start: 0, end: 3 }]);
    expect(r.bSpans).toEqual([{ start: 0, end: 3 }]);
  });

  it('handles a leading word change', () => {
    // a tokens: 'abc' '-' 'tail' · b tokens: 'xyz' '-' 'tail'
    const r = diffWords('abc-tail', 'xyz-tail');
    expect(r.aSpans).toEqual([{ start: 0, end: 3 }]);
    expect(r.bSpans).toEqual([{ start: 0, end: 3 }]);
  });

  it('coalesces adjacent unmatched tokens into one span per side', () => {
    // a: 'foo bar baz' · b: 'foo qux baz' — middle word + the
    // surrounding spaces are all unmatched on each side, but they're
    // contiguous so they collapse into one span (start of unmatched
    // run → end of unmatched run).
    const r = diffWords('foo bar baz', 'foo qux baz');
    expect(r.aSpans).toEqual([{ start: 4, end: 7 }]);
    expect(r.bSpans).toEqual([{ start: 4, end: 7 }]);
  });
});
