import { describe, expect, it } from 'vitest';
import { diffChars } from '@/shared/merge-editor/diff/char-diff';

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
