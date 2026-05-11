import { describe, expect, it } from 'vitest';
import { analyzeHunks, type HunkAnalysis } from '@/shared/merge-editor/diff/hunk-analysis';
import { diffLines } from '@/shared/merge-editor/diff/line-diff';
import { PENDING_HUNK } from '@/shared/merge-editor/use-hunk-pick-state';
import {
  frameForResult,
  frameForSide,
  kindLabelFor,
  lineTintFor,
  missingVariantFor,
  resultStatusLabelFor,
} from '@/shared/merge-editor/view/hunk-visual';

function makeDeleteVsModifyAnalysis(): HunkAnalysis {
  const base = 'A\nB\nC\n';
  const theirs = 'A\nC\n';
  const mine = 'A\nB-CHANGED\nC\n';
  const pickHunks = diffLines(theirs, mine);
  const theirsBaseHunks = diffLines(base, theirs);
  const mineBaseHunks = diffLines(base, mine);
  const [a] = analyzeHunks({ pickHunks, theirsBaseHunks, mineBaseHunks });
  return a;
}

describe('view/hunk-visual', () => {
  describe('lineTintFor', () => {
    it('paints mine pane amber when mine modified vs base', () => {
      const a = makeDeleteVsModifyAnalysis();
      expect(lineTintFor(a, 'mine')).toBe('modification');
    });

    it('returns null on the empty theirs side', () => {
      const a = makeDeleteVsModifyAnalysis();
      expect(lineTintFor(a, 'theirs')).toBeNull();
    });

    it('paints addition on a mine pure-add', () => {
      const base = 'A\nB\n';
      const theirs = 'A\nB\n';
      const mine = 'A\nB\nC\n';
      const pickHunks = diffLines(theirs, mine);
      const theirsBaseHunks = diffLines(base, theirs);
      const mineBaseHunks = diffLines(base, mine);
      const [a] = analyzeHunks({ pickHunks, theirsBaseHunks, mineBaseHunks });
      expect(lineTintFor(a, 'mine')).toBe('addition');
      expect(lineTintFor(a, 'theirs')).toBeNull();
    });
  });

  describe('missingVariantFor', () => {
    it('returns "removal" on the empty side that deleted base content', () => {
      const a = makeDeleteVsModifyAnalysis();
      expect(missingVariantFor(a, 'theirs')).toBe('removal');
    });

    it('returns null on the populated side', () => {
      const a = makeDeleteVsModifyAnalysis();
      expect(missingVariantFor(a, 'mine')).toBeNull();
    });

    it('returns "neutral" when the other side simply added new content', () => {
      const base = 'A\nB\n';
      const theirs = 'A\nB\nC\n';
      const mine = 'A\nB\n';
      const pickHunks = diffLines(theirs, mine);
      const theirsBaseHunks = diffLines(base, theirs);
      const mineBaseHunks = diffLines(base, mine);
      const [a] = analyzeHunks({ pickHunks, theirsBaseHunks, mineBaseHunks });
      // Mine pane is empty (theirs added C); mine never had this row.
      expect(missingVariantFor(a, 'mine')).toBe('neutral');
    });
  });

  describe('kindLabelFor', () => {
    it('maps side kinds to symbol + present-tense diff verb', () => {
      expect(kindLabelFor('added')).toBe('+ Adds');
      expect(kindLabelFor('removed')).toBe('− Removes');
      expect(kindLabelFor('modified')).toBe('~ Modifies');
      expect(kindLabelFor('unchanged')).toBe('= Unchanged');
    });
  });

  describe('frameForSide / frameForResult', () => {
    it('pending true conflict ⇒ orange', () => {
      const a = makeDeleteVsModifyAnalysis();
      expect(frameForSide(a, 'mine', PENDING_HUNK)).toBe('pending-conflict');
      expect(frameForResult(a, PENDING_HUNK)).toBe('pending-conflict');
    });

    it('resolved ⇒ grey regardless of conflict kind', () => {
      const a = makeDeleteVsModifyAnalysis();
      const resolved = { theirs: 'accepted', mine: 'dismissed' } as const;
      expect(frameForSide(a, 'mine', resolved)).toBe('resolved');
      expect(frameForResult(a, resolved)).toBe('resolved');
    });

    it('pending clean hunk ⇒ blue', () => {
      const base = 'A\nB\n';
      const theirs = 'A\nB\nC\n';
      const mine = 'A\nB\n';
      const pickHunks = diffLines(theirs, mine);
      const theirsBaseHunks = diffLines(base, theirs);
      const mineBaseHunks = diffLines(base, mine);
      const [a] = analyzeHunks({ pickHunks, theirsBaseHunks, mineBaseHunks });
      expect(frameForResult(a, PENDING_HUNK)).toBe('pending-clean');
    });
  });

  describe('resultStatusLabelFor', () => {
    it('all pending ⇒ "No Changes Accepted"', () => {
      expect(resultStatusLabelFor(PENDING_HUNK)).toEqual({ label: 'No Changes Accepted', removable: [] });
    });

    it('both accepted ⇒ combination with two removable buttons', () => {
      const status = resultStatusLabelFor({ theirs: 'accepted', mine: 'accepted' });
      expect(status?.label).toBe('Incoming + Current');
      expect(status?.removable).toHaveLength(2);
    });

    it('one side dismissed, other pending ⇒ skipped label', () => {
      expect(resultStatusLabelFor({ theirs: 'dismissed', mine: 'pending' })).toEqual({
        label: 'Incoming Skipped',
        removable: [],
      });
    });
  });
});
