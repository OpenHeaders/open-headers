import { describe, expect, it } from 'vitest';
import { classifyConflicts3Way } from '@openheaders/ui/shared/merge-editor/diff/conflict-classify';
import { diffLinesPatience } from '@openheaders/ui/shared/merge-editor/diff/patience-diff';

/**
 * 3-way classification flips the 2-way "overlap = conflict" heuristic
 * into a precise "did each side actually change vs base?" check.
 *
 * Test fixtures use the standard 4-text setup (base, theirs, mine,
 * result). `result` defaults to `mine` (the entity adapter's seed
 * convention) unless otherwise noted.
 */
describe('classifyConflicts3Way', () => {
  it('clean-from-theirs: peer changed vs base, mine matches base', () => {
    // Peer edited line 2; user did nothing → result == mine == base.
    const base = 'a\nb\nc';
    const theirs = 'a\nPEER\nc';
    const mine = base;
    const result = mine;

    const theirsHunks = diffLinesPatience(theirs, result);
    const mineHunks = diffLinesPatience(mine, result);
    const theirsBaseHunks = diffLinesPatience(base, theirs);
    const mineBaseHunks = diffLinesPatience(base, mine);

    const c = classifyConflicts3Way({ theirsHunks, mineHunks, theirsBaseHunks, mineBaseHunks });
    expect(theirsHunks).toHaveLength(1);
    expect(c.theirsCleanIds.has(theirsHunks[0].id)).toBe(false);
    // The theirs↔result hunk corresponds to a real peer edit, so it's
    // NOT in cleanFromTheirs; it IS in conflict-set heuristically only
    // if there's an overlapping mine hunk — there isn't here.
    expect(c.theirsConflictIds.size).toBe(0);
  });

  it('clean-from-mine: user changed vs base, theirs matches base — already in result', () => {
    const base = 'a\nb\nc';
    const theirs = base;
    const mine = 'a\nUSER\nc';
    const result = mine;

    const theirsHunks = diffLinesPatience(theirs, result);
    const mineHunks = diffLinesPatience(mine, result);
    const theirsBaseHunks = diffLinesPatience(base, theirs);
    const mineBaseHunks = diffLinesPatience(base, mine);

    const c = classifyConflicts3Way({ theirsHunks, mineHunks, theirsBaseHunks, mineBaseHunks });
    // theirs↔result has 1 hunk (theirs == base, result == mine != base).
    // theirs didn't actually change vs base → it's clean-from-theirs.
    expect(theirsHunks).toHaveLength(1);
    expect(c.theirsCleanIds.has(theirsHunks[0].id)).toBe(true);
  });

  it('true conflict: both sides changed vs base, user partially resolved → 2-way overlap fires', () => {
    // Both sides diverged from base; user accepted theirs for line 2,
    // so result diverges from mine (which still has USER) AND from
    // theirs (which still has PEER — wait, here result == theirs at line 2).
    // The interesting case is when result reflects a third state
    // (manual edit keeping neither side), so both axes have hunks
    // that overlap.
    const base = 'a\nb\nc';
    const theirs = 'a\nPEER\nc';
    const mine = 'a\nUSER\nc';
    const result = 'a\nMERGED\nc'; // user typed a third value

    const theirsHunks = diffLinesPatience(theirs, result);
    const mineHunks = diffLinesPatience(mine, result);
    const theirsBaseHunks = diffLinesPatience(base, theirs);
    const mineBaseHunks = diffLinesPatience(base, mine);

    const c = classifyConflicts3Way({ theirsHunks, mineHunks, theirsBaseHunks, mineBaseHunks });
    // theirs hunk corresponds to a real peer change → not clean.
    expect(c.theirsCleanIds.has(theirsHunks[0].id)).toBe(false);
    expect(c.mineCleanIds.has(mineHunks[0].id)).toBe(false);
    // 2-way overlap fires because both sides have hunks at line 2.
    expect(c.theirsConflictIds.size).toBe(1);
    expect(c.mineConflictIds.size).toBe(1);
  });

  it('agreed change: both sides made the same edit vs base', () => {
    const base = 'a\nb\nc';
    const theirs = 'a\nSAME\nc';
    const mine = 'a\nSAME\nc';
    const result = mine;

    const theirsHunks = diffLinesPatience(theirs, result);
    const mineHunks = diffLinesPatience(mine, result);
    const theirsBaseHunks = diffLinesPatience(base, theirs);
    const mineBaseHunks = diffLinesPatience(base, mine);

    const c = classifyConflicts3Way({ theirsHunks, mineHunks, theirsBaseHunks, mineBaseHunks });
    // theirs == result, so no theirs↔result hunks.
    expect(theirsHunks).toHaveLength(0);
    // mine == result, so no mine↔result hunks.
    expect(mineHunks).toHaveLength(0);
    expect(c.theirsCleanIds.size).toBe(0);
    expect(c.mineCleanIds.size).toBe(0);
  });

  it('no base hunks → all visible hunks are clean (manual user edit)', () => {
    // Edge case: user typed in result post-seed; theirs and mine both
    // equal base. The 2-way classifier sees a hunk on each axis; the
    // 3-way overlay marks both as clean because neither side actually
    // changed vs base.
    const base = 'a\nb\nc';
    const theirs = base;
    const mine = base;
    const result = 'a\nMANUAL\nc';

    const theirsHunks = diffLinesPatience(theirs, result);
    const mineHunks = diffLinesPatience(mine, result);
    const theirsBaseHunks = diffLinesPatience(base, theirs);
    const mineBaseHunks = diffLinesPatience(base, mine);

    const c = classifyConflicts3Way({ theirsHunks, mineHunks, theirsBaseHunks, mineBaseHunks });
    expect(theirsHunks).toHaveLength(1);
    expect(mineHunks).toHaveLength(1);
    expect(c.theirsCleanIds.has(theirsHunks[0].id)).toBe(true);
    expect(c.mineCleanIds.has(mineHunks[0].id)).toBe(true);
  });

  it('flags a true 3-way conflict via base-region overlap when result === mine masks the 2-way overlap', () => {
    // The dialog opens with `result === mine` (entity adapter's seed
    // convention — result starts as the user's draft). mineHunks =
    // diff(mine, result) is empty, so the 2-way overlap classifier
    // can't possibly flag any theirs hunk as conflicting. But base=1,
    // mine=2, theirs=3 means BOTH sides moved from base — a textbook
    // 3-way conflict that must surface in `theirsTrueConflicts`.
    const base = 'a\n1\nc';
    const theirs = 'a\n3\nc';
    const mine = 'a\n2\nc';
    const result = mine;

    const theirsHunks = diffLinesPatience(theirs, result);
    const mineHunks = diffLinesPatience(mine, result);
    const c = classifyConflicts3Way({
      theirsHunks,
      mineHunks,
      theirsBaseHunks: diffLinesPatience(base, theirs),
      mineBaseHunks: diffLinesPatience(base, mine),
    });
    expect(theirsHunks).toHaveLength(1);
    expect(mineHunks).toHaveLength(0);
    // 2-way overlap finds nothing (no mine hunks to overlap with).
    expect(c.theirsConflictIds.size).toBe(0);
    // 3-way base-region check correctly flags the conflict.
    expect(c.theirsTrueConflicts.has(theirsHunks[0].id)).toBe(true);
    // Theirs DID change vs base, so it's NOT clean.
    expect(c.theirsCleanIds.has(theirsHunks[0].id)).toBe(false);
  });

  it('does NOT flag a true conflict when only one side moved from base (clean-from-mine case)', () => {
    // base=1, mine=1, theirs=3. Only theirs moved → not a real
    // conflict, the auto-merge can take theirs cleanly.
    const base = 'a\n1\nc';
    const theirs = 'a\n3\nc';
    const mine = base;
    const result = mine;

    const theirsHunks = diffLinesPatience(theirs, result);
    const mineHunks = diffLinesPatience(mine, result);
    const c = classifyConflicts3Way({
      theirsHunks,
      mineHunks,
      theirsBaseHunks: diffLinesPatience(base, theirs),
      mineBaseHunks: diffLinesPatience(base, mine),
    });
    expect(theirsHunks).toHaveLength(1);
    expect(c.theirsTrueConflicts.size).toBe(0);
    expect(c.mineTrueConflicts.size).toBe(0);
  });

  it('preserves 2-way conflict ids alongside the new clean sets', () => {
    const base = 'a\nb\nc';
    const theirs = 'a\nT\nc';
    const mine = 'a\nM\nc';
    const result = mine;

    const theirsHunks = diffLinesPatience(theirs, result);
    const mineHunks = diffLinesPatience(mine, result);
    const c = classifyConflicts3Way({
      theirsHunks,
      mineHunks,
      theirsBaseHunks: diffLinesPatience(base, theirs),
      mineBaseHunks: diffLinesPatience(base, mine),
    });
    // 2-way fields still populated.
    expect(c.theirsConflictIds).toBeInstanceOf(Set);
    expect(c.mineConflictIds).toBeInstanceOf(Set);
  });
});
