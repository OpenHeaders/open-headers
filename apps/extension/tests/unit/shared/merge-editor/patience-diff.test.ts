import { describe, expect, it } from 'vitest';
import { diffLinesPatience } from '@/shared/merge-editor/diff/patience-diff';

describe('diffLinesPatience', () => {
  it('returns no hunks for identical input', () => {
    expect(diffLinesPatience('a\nb\nc', 'a\nb\nc')).toEqual([]);
  });

  it('emits one modification hunk for a single-line change', () => {
    const hunks = diffLinesPatience('a\nFOO\nc', 'a\nBAR\nc');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].classification).toBe('modification');
    expect(hunks[0].theirsLines).toEqual(['FOO']);
    expect(hunks[0].mineLines).toEqual(['BAR']);
  });

  it('finds anchors via locally-unique lines and splits hunks correctly', () => {
    // Two unique-anchor lines (the section headers) separate two
    // independent edits; classic LCS might mis-align on the empty
    // lines. Patience uses the headers.
    const theirs = '# section1\nFOO\n# section2\nBAZ';
    const mine = '# section1\nBAR\n# section2\nQUX';
    const hunks = diffLinesPatience(theirs, mine);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].theirsLines).toEqual(['FOO']);
    expect(hunks[0].mineLines).toEqual(['BAR']);
    expect(hunks[1].theirsLines).toEqual(['BAZ']);
    expect(hunks[1].mineLines).toEqual(['QUX']);
  });

  it('emits an addition hunk for an appended line', () => {
    const hunks = diffLinesPatience('a\nb', 'a\nb\nc');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].classification).toBe('addition');
    expect(hunks[0].mineLines).toEqual(['c']);
  });

  it('emits a removal hunk when a line is dropped', () => {
    const hunks = diffLinesPatience('a\nb\nc', 'a\nc');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].classification).toBe('removal');
    expect(hunks[0].theirsLines).toEqual(['b']);
  });

  it('falls back gracefully when no unique-anchor lines exist', () => {
    // All lines repeat — no unique anchors at all.
    const theirs = 'x\nx\nx';
    const mine = 'x\nx\nx\nx';
    const hunks = diffLinesPatience(theirs, mine);
    // Should still produce a sensible diff (one addition).
    expect(hunks).toHaveLength(1);
    expect(hunks[0].classification).toBe('addition');
  });

  it('hunk ids are content-hashed (stable across non-intersecting edits)', () => {
    const before = diffLinesPatience('a\nFOO\nb\nc', 'a\nBAR\nb\nc');
    const after = diffLinesPatience('a\nFOO\nb\nc\nNEW', 'a\nBAR\nb\nc\nNEW');
    expect(before).toHaveLength(1);
    const matchingHunk = after.find((h) => h.id === before[0].id);
    expect(matchingHunk).toBeDefined();
  });

  it('ranges are 1-based inclusive/exclusive (Monaco convention)', () => {
    const hunks = diffLinesPatience('a\nFOO\nc', 'a\nBAR\nc');
    expect(hunks[0].theirsRange).toEqual({ startLine: 2, endLine: 3 });
    expect(hunks[0].mineRange).toEqual({ startLine: 2, endLine: 3 });
  });

  it('handles all-different inputs', () => {
    const hunks = diffLinesPatience('a\nb\nc', 'x\ny\nz');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].classification).toBe('modification');
    expect(hunks[0].theirsLines).toEqual(['a', 'b', 'c']);
    expect(hunks[0].mineLines).toEqual(['x', 'y', 'z']);
  });

  it('respects shared prefix and suffix trimming', () => {
    // Common prefix of 2 lines + common suffix of 2 lines + middle change.
    const theirs = 'p1\np2\nFOO\ns1\ns2';
    const mine = 'p1\np2\nBAR\ns1\ns2';
    const hunks = diffLinesPatience(theirs, mine);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].theirsLines).toEqual(['FOO']);
    expect(hunks[0].mineLines).toEqual(['BAR']);
    expect(hunks[0].theirsRange.startLine).toBe(3);
  });
});
