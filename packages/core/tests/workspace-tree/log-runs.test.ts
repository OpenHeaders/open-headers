/**
 * The log graph's linear runs (the hover and fold unit): a plain commit
 * sits in the run between the ends around it, any other commit reads
 * the run below it along its first parent, a ref's commit and the
 * checked-out one are ends, the list's edge ends a run; a folded run
 * hides its stretch and the pointer into it reaches the bottom end,
 * flagged; two runs under one merge stay apart.
 */

import { describe, expect, it } from 'vitest';
import { foldRuns, linearRuns, runAt } from '../../src/workspace-tree';
import { commit, named } from './log-named';

// merge -> [m2, f2]; m2 -> m1; f2 -> f1; f1 -> base; m1 -> base; base -> r2 -> r1
const LOG = named([
  commit('merge', 'm2', 'f2'),
  commit('m2', 'm1'),
  commit('f2', 'f1'),
  commit('f1', 'base'),
  commit('m1', 'base'),
  commit('base', 'r2'),
  commit('r2', 'r1'),
  commit('r1', 'gone'),
]);

/** A run by name: its two ends and the commits between them. */
const runOf = (anchors: string[], at: string) => {
  const runs = linearRuns(LOG.skeleton, LOG.flags(...anchors));
  const run = runAt(LOG.skeleton, runs, LOG.row(at));
  if (run === -1) return null;
  const stretch = LOG.names(Int32Array.from(runs.runOf.keys()).filter((row) => runs.runOf[row] === run));
  return {
    top: LOG.names(runs.tops.subarray(run, run + 1))[0],
    bottom: LOG.names(runs.bottoms.subarray(run, run + 1))[0],
    first: LOG.names(runs.firsts.subarray(run, run + 1))[0],
    stretch,
    length: runs.lengths[run],
  };
};

describe('linearRuns', () => {
  it('puts a plain commit in the run between the fork and the merge around it', () => {
    expect(runOf([], 'f1')).toEqual({ top: 'merge', bottom: 'base', first: 'f2', stretch: ['f2', 'f1'], length: 2 });
    expect(runOf([], 'm1')).toEqual({ top: 'merge', bottom: 'base', first: 'm2', stretch: ['m2', 'm1'], length: 2 });
  });

  it('reads, from any other commit, the run below it along its first parent', () => {
    expect(runOf([], 'merge')?.stretch).toEqual(['m2', 'm1']);
  });

  it('ends a run at a commit a ref points at, and counts a run with nothing to hide as none', () => {
    expect(runOf(['f2'], 'f1')).toEqual({ top: 'f2', bottom: 'base', first: 'f1', stretch: ['f1'], length: 1 });
    expect(runOf(['f2', 'f1'], 'f2')).toBeNull();
  });

  it('ends the run below the fork on the last commit the list holds', () => {
    expect(runOf([], 'r2')).toEqual({ top: 'base', bottom: 'r1', first: 'r2', stretch: ['r2'], length: 1 });
    expect(runOf([], 'base')?.stretch).toEqual(['r2']);
    expect(runOf([], 'r1')).toBeNull();
  });

  it('numbers every run of the list once — both runs under the merge and the run below the fork', () => {
    const runs = linearRuns(LOG.skeleton, LOG.flags());
    expect(runs.count).toBe(3);
    expect(LOG.names(runs.tops)).toEqual(['merge', 'merge', 'base']);
    expect(LOG.names(runs.firsts)).toEqual(['m2', 'f2', 'r2']);
    expect(linearRuns(LOG.skeleton, LOG.flags('m2', 'm1', 'f2', 'f1', 'r2')).count).toBe(0);
  });
});

describe('foldRuns', () => {
  const runs = linearRuns(LOG.skeleton, LOG.flags());
  const folding = (...firsts: string[]): Uint8Array =>
    Uint8Array.from(LOG.names(runs.firsts).map((first) => (firsts.includes(first) ? 1 : 0)));

  it('hides the stretch and has the pointer into it reach the bottom end, flagged', () => {
    const { entries, skipped } = LOG.read(foldRuns(LOG.skeleton, runs, folding('f2')));
    expect(entries.map((entry) => entry.sha)).toEqual(['merge', 'm2', 'm1', 'base', 'r2', 'r1']);
    expect(entries[0].parents).toEqual(['m2', 'base']);
    expect(skipped).toEqual(['merge>base']);
  });

  it('folds two runs under one merge each on its own pointer', () => {
    const { entries, skipped } = LOG.read(foldRuns(LOG.skeleton, runs, folding('m2', 'f2', 'r2')));
    expect(entries).toEqual([commit('merge', 'base', 'base'), commit('base', 'r1'), commit('r1', 'outside')]);
    expect(skipped).toEqual(['merge>base', 'merge>base', 'base>r1']);
  });

  it('leaves the list as it is with nothing folded', () => {
    const { entries, skipped } = LOG.read(foldRuns(LOG.skeleton, runs, folding()));
    expect(entries.map((entry) => entry.sha)).toEqual(['merge', 'm2', 'f2', 'f1', 'm1', 'base', 'r2', 'r1']);
    expect(skipped).toEqual([]);
  });
});
