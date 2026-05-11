import { describe, expect, it } from 'vitest';
import { analyzeHunks } from '@/shared/merge-editor/diff/hunk-analysis';
import { diffLines } from '@/shared/merge-editor/diff/line-diff';

describe('analyzeHunks', () => {
  describe('3-pane (base provided)', () => {
    it('classifies delete-vs-modify: theirs removed B, mine modified B', () => {
      const base = 'A\nB\nC\n';
      const theirs = 'A\nC\n';
      const mine = 'A\nB-CHANGED\nC\n';
      const pickHunks = diffLines(theirs, mine);
      const theirsBaseHunks = diffLines(base, theirs);
      const mineBaseHunks = diffLines(base, mine);

      const analyses = analyzeHunks({ pickHunks, theirsBaseHunks, mineBaseHunks });
      expect(analyses).toHaveLength(1);
      const a = analyses[0];
      expect(a.theirs.kind).toBe('removed');
      expect(a.theirs.isEmpty).toBe(true);
      expect(a.mine.kind).toBe('modified');
      expect(a.mine.isEmpty).toBe(false);
      expect(a.conflict).toBe('true');
      expect(a.hasBase).toBe(true);
    });

    it('classifies pure peer-add as clean: theirs added C, mine untouched', () => {
      const base = 'A\nB\n';
      const theirs = 'A\nB\nC\n';
      const mine = 'A\nB\n';
      const pickHunks = diffLines(theirs, mine);
      const theirsBaseHunks = diffLines(base, theirs);
      const mineBaseHunks = diffLines(base, mine);

      const analyses = analyzeHunks({ pickHunks, theirsBaseHunks, mineBaseHunks });
      expect(analyses).toHaveLength(1);
      const a = analyses[0];
      expect(a.theirs.kind).toBe('added');
      expect(a.mine.kind).toBe('unchanged');
      expect(a.mine.isEmpty).toBe(true);
      expect(a.conflict).toBe('clean');
    });

    it('classifies pure mine-add as clean: mine added C, theirs untouched', () => {
      const base = 'A\nB\n';
      const theirs = 'A\nB\n';
      const mine = 'A\nB\nC\n';
      const pickHunks = diffLines(theirs, mine);
      const theirsBaseHunks = diffLines(base, theirs);
      const mineBaseHunks = diffLines(base, mine);

      const analyses = analyzeHunks({ pickHunks, theirsBaseHunks, mineBaseHunks });
      expect(analyses).toHaveLength(1);
      const a = analyses[0];
      expect(a.theirs.kind).toBe('unchanged');
      expect(a.mine.kind).toBe('added');
      expect(a.conflict).toBe('clean');
    });

    it('classifies both-modify-differently as true conflict', () => {
      const base = 'A\nB\nC\n';
      const theirs = 'A\nB-THEIRS\nC\n';
      const mine = 'A\nB-MINE\nC\n';
      const pickHunks = diffLines(theirs, mine);
      const theirsBaseHunks = diffLines(base, theirs);
      const mineBaseHunks = diffLines(base, mine);

      const analyses = analyzeHunks({ pickHunks, theirsBaseHunks, mineBaseHunks });
      expect(analyses).toHaveLength(1);
      const a = analyses[0];
      expect(a.theirs.kind).toBe('modified');
      expect(a.mine.kind).toBe('modified');
      expect(a.conflict).toBe('true');
    });

    it('classifies mine-deletes / theirs-modifies (mirror of delete-vs-modify)', () => {
      const base = 'A\nB\nC\n';
      const theirs = 'A\nB-CHANGED\nC\n';
      const mine = 'A\nC\n';
      const pickHunks = diffLines(theirs, mine);
      const theirsBaseHunks = diffLines(base, theirs);
      const mineBaseHunks = diffLines(base, mine);

      const analyses = analyzeHunks({ pickHunks, theirsBaseHunks, mineBaseHunks });
      expect(analyses).toHaveLength(1);
      const a = analyses[0];
      expect(a.theirs.kind).toBe('modified');
      expect(a.mine.kind).toBe('removed');
      expect(a.mine.isEmpty).toBe(true);
      expect(a.conflict).toBe('true');
    });
  });

  describe('2-pane fallback (no base)', () => {
    it('classifies pair-diff addition as mine-added / theirs-unchanged', () => {
      const theirs = 'A\nB\n';
      const mine = 'A\nB\nC\n';
      const pickHunks = diffLines(theirs, mine);

      const analyses = analyzeHunks({ pickHunks });
      expect(analyses).toHaveLength(1);
      const a = analyses[0];
      expect(a.hasBase).toBe(false);
      expect(a.theirs.kind).toBe('unchanged');
      expect(a.mine.kind).toBe('added');
      // No base means we can't tell convergent vs single-sided —
      // pair-diff modification is the only true-conflict signal we
      // have.
      expect(a.conflict).toBe('clean');
    });

    it('classifies pair-diff modification as true conflict', () => {
      const theirs = 'A\nTHEIRS\nC\n';
      const mine = 'A\nMINE\nC\n';
      const pickHunks = diffLines(theirs, mine);

      const analyses = analyzeHunks({ pickHunks });
      expect(analyses).toHaveLength(1);
      const a = analyses[0];
      expect(a.theirs.kind).toBe('modified');
      expect(a.mine.kind).toBe('modified');
      expect(a.conflict).toBe('true');
    });
  });
});
