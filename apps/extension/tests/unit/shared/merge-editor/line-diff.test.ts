import { describe, expect, it } from 'vitest';
import { __test__, diffLines } from '@openheaders/ui/shared/merge-editor/diff/line-diff';

describe('diffLines', () => {
  it('returns no hunks for identical input', () => {
    expect(diffLines('a\nb\nc', 'a\nb\nc')).toEqual([]);
  });

  it('emits an addition hunk for a single appended line', () => {
    const hunks = diffLines('a\nb', 'a\nb\nc');
    expect(hunks).toHaveLength(1);
    const h = hunks[0];
    expect(h.classification).toBe('addition');
    expect(h.mineLines).toEqual(['c']);
    expect(h.theirsLines).toEqual([]);
    expect(h.mineRange).toEqual({ startLine: 3, endLine: 4 });
    expect(h.theirsRange).toEqual({ startLine: 3, endLine: 3 });
  });

  it('emits a removal hunk when mine drops a line', () => {
    const hunks = diffLines('a\nb\nc', 'a\nc');
    expect(hunks).toHaveLength(1);
    const h = hunks[0];
    expect(h.classification).toBe('removal');
    expect(h.theirsLines).toEqual(['b']);
    expect(h.mineLines).toEqual([]);
  });

  it('emits a modification hunk when both sides changed the same lines', () => {
    const hunks = diffLines('a\nFOO\nc', 'a\nBAR\nc');
    expect(hunks).toHaveLength(1);
    const h = hunks[0];
    expect(h.classification).toBe('modification');
    expect(h.theirsLines).toEqual(['FOO']);
    expect(h.mineLines).toEqual(['BAR']);
    expect(h.theirsRange).toEqual({ startLine: 2, endLine: 3 });
    expect(h.mineRange).toEqual({ startLine: 2, endLine: 3 });
  });

  it('emits multiple hunks when changes are separated by an anchor', () => {
    const hunks = diffLines('a\nFOO\nb\nBAZ\nc', 'a\nBAR\nb\nQUX\nc');
    expect(hunks).toHaveLength(2);
    expect(hunks[0].classification).toBe('modification');
    expect(hunks[1].classification).toBe('modification');
    expect(hunks[0].theirsLines).toEqual(['FOO']);
    expect(hunks[1].theirsLines).toEqual(['BAZ']);
  });

  it('hunk ids are content-hashed and stable across non-intersecting edits', () => {
    const baseTheirs = 'a\nFOO\nb\nc\nd';
    const baseMine = 'a\nBAR\nb\nc\nd';
    const beforeHunks = diffLines(baseTheirs, baseMine);
    expect(beforeHunks).toHaveLength(1);
    const beforeId = beforeHunks[0].id;

    // Edit AFTER the hunk on both sides — non-intersecting region.
    const afterTheirs = 'a\nFOO\nb\nc\nd\nNEW';
    const afterMine = 'a\nBAR\nb\nc\nd\nNEW';
    const afterHunks = diffLines(afterTheirs, afterMine);
    // Should still have the original modification hunk.
    const matched = afterHunks.find((h) => h.id === beforeId);
    expect(matched).toBeDefined();
    expect(matched?.classification).toBe('modification');
  });

  it('hunk ids differ when content differs but range is the same', () => {
    const a = diffLines('a\nFOO\nc', 'a\nBAR\nc')[0];
    const b = diffLines('a\nFOO\nc', 'a\nQUX\nc')[0];
    expect(a.id).not.toBe(b.id);
  });

  it('addition vs removal with identical content produces distinct ids', () => {
    const additionHunk = diffLines('a\nb', 'a\nb\nX')[0];
    const removalHunk = diffLines('a\nb\nX', 'a\nb')[0];
    expect(additionHunk.classification).toBe('addition');
    expect(removalHunk.classification).toBe('removal');
    expect(additionHunk.id).not.toBe(removalHunk.id);
  });

  it('handles empty inputs', () => {
    // JS string split on `''` yields `['']` (one empty line) — both
    // sides have one line, so identical empty inputs produce no
    // hunks (the empty line equals itself).
    expect(diffLines('', '')).toEqual([]);

    // `''` vs `'a'` reads as one empty line vs one content line —
    // the algorithm classifies this as a modification (both sides
    // have a line; they differ). Pure-addition / pure-removal
    // emerge when the side has *no* lines at all, which JS string
    // semantics make unreachable from a string input. Documenting
    // the actual behavior so it doesn't drift unnoticed.
    const oneLineEachWay = diffLines('', 'a');
    expect(oneLineEachWay).toHaveLength(1);
    expect(oneLineEachWay[0].classification).toBe('modification');
    expect(oneLineEachWay[0].theirsLines).toEqual(['']);
    expect(oneLineEachWay[0].mineLines).toEqual(['a']);
  });

  it('a true addition (extra line) is classified as addition', () => {
    // Anchor on common prefix so the new line is unambiguous.
    const hunks = diffLines('a', 'a\nNEW');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].classification).toBe('addition');
    expect(hunks[0].mineLines).toEqual(['NEW']);
  });

  it('respects a custom splitter', () => {
    const hunks = diffLines('a;b;c', 'a;X;c', { splitter: (t) => t.split(';') });
    expect(hunks).toHaveLength(1);
    expect(hunks[0].classification).toBe('modification');
    expect(hunks[0].theirsLines).toEqual(['b']);
    expect(hunks[0].mineLines).toEqual(['X']);
  });

  it('coalesces adjacent unrelated changes into a single hunk (known limitation)', () => {
    // No anchor line between an addition and a removal — line-LCS
    // smushes them. This is the known limitation called out in the
    // module comment; the test pins it so we notice if a future diff
    // upgrade (Patience / schema-aware) changes the shape.
    const hunks = diffLines('a\nDEL\nb', 'a\nADD\nb');
    expect(hunks).toHaveLength(1);
    expect(hunks[0].classification).toBe('modification');
  });
});

describe('hash internals', () => {
  it('fnv1a is deterministic and 8 hex chars', () => {
    const a = __test__.fnv1a('hello');
    const b = __test__.fnv1a('hello');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('fnv1a discriminates similar strings', () => {
    expect(__test__.fnv1a('hello')).not.toBe(__test__.fnv1a('hellp'));
  });

  it('hashLines distinguishes split boundaries', () => {
    expect(__test__.hashLines(['ab', 'c'])).not.toBe(__test__.hashLines(['a', 'bc']));
  });
});
