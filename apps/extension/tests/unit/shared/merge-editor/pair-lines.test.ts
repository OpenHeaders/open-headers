import { describe, expect, it } from 'vitest';
import { pairLines } from '@/shared/merge-editor/diff/pair-lines';

describe('pairLines', () => {
  it('pairs by index when both sides are length 1', () => {
    const r = pairLines(['FOO'], ['BAR']);
    expect(r).toEqual([{ aIdx: 0, bIdx: 0, exactMatch: false }]);
  });

  it('pairs identical content with exactMatch=true', () => {
    const r = pairLines(['A', 'B', 'C'], ['A', 'B', 'C']);
    expect(r).toEqual([
      { aIdx: 0, bIdx: 0, exactMatch: true },
      { aIdx: 1, bIdx: 1, exactMatch: true },
      { aIdx: 2, bIdx: 2, exactMatch: true },
    ]);
  });

  it('aligns shifted matching lines via LCS (not index)', () => {
    // theirs=[B,A,C], mine=[X,B,Y]: LCS finds B at theirs[0]/mine[1].
    // Index-pairing would mis-pair B↔X. LCS-pairing aligns B↔B.
    const r = pairLines(['B', 'A', 'C'], ['X', 'B', 'Y']);
    const exactMatches = r.filter((p) => p.exactMatch);
    expect(exactMatches).toHaveLength(1);
    expect(exactMatches[0]).toEqual({ aIdx: 0, bIdx: 1, exactMatch: true });
  });

  it('handles uneven line counts — pairs the matching anchor + adjacency for the rest', () => {
    // theirs=[A,SAME,C], mine=[SAME,Y]. LCS finds SAME at (1,0).
    // No pre-anchor adjacency (A would pair with nothing valid).
    // Post-anchor: theirs has [C], mine has [Y] → pair C↔Y.
    const r = pairLines(['A', 'SAME', 'C'], ['SAME', 'Y']);
    expect(r).toEqual([
      { aIdx: 1, bIdx: 0, exactMatch: true },
      { aIdx: 2, bIdx: 1, exactMatch: false },
    ]);
  });

  it('returns empty when either side is empty', () => {
    expect(pairLines([], ['A'])).toEqual([]);
    expect(pairLines(['A'], [])).toEqual([]);
    expect(pairLines([], [])).toEqual([]);
  });

  it('all-different inputs pair by index up to the min length', () => {
    const r = pairLines(['A', 'B', 'C'], ['X', 'Y']);
    expect(r).toEqual([
      { aIdx: 0, bIdx: 0, exactMatch: false },
      { aIdx: 1, bIdx: 1, exactMatch: false },
    ]);
  });

  it('multiple anchors split adjacency into per-gap fallback regions', () => {
    // theirs=[A,SAME1,C,SAME2,E], mine=[X,SAME1,Y,SAME2,Z]. Two
    // anchors at SAME1 and SAME2; gaps [A↔X], [C↔Y], [E↔Z].
    const r = pairLines(['A', 'SAME1', 'C', 'SAME2', 'E'], ['X', 'SAME1', 'Y', 'SAME2', 'Z']);
    expect(r).toEqual([
      { aIdx: 0, bIdx: 0, exactMatch: false },
      { aIdx: 1, bIdx: 1, exactMatch: true },
      { aIdx: 2, bIdx: 2, exactMatch: false },
      { aIdx: 3, bIdx: 3, exactMatch: true },
      { aIdx: 4, bIdx: 4, exactMatch: false },
    ]);
  });
});
