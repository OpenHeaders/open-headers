/**
 * What commits reach in a log: everything a set of tips descends from
 * (a scope, the current branch), and what a first-parent walk lists.
 */

import { describe, expect, it } from 'vitest';
import { firstParentOnly, firstParentReach, flaggedRows, pickRows, reachFrom } from '../../src/workspace-tree';
import { commit, named } from './log-named';

// status → merge (of bump and fix); fix → bump; side → bump is a line of its own.
const seed = named([
  commit('status', 'merge'),
  commit('side', 'bump'),
  commit('merge', 'bump', 'fix'),
  commit('fix', 'bump'),
  commit('bump'),
]);

describe('reachFrom', () => {
  it('flags the tips and every commit they descend from, and nothing beside them', () => {
    expect(seed.names(reachFrom(seed.skeleton, [seed.row('fix')]))).toEqual(['fix', 'bump']);
    expect(seed.names(reachFrom(seed.skeleton, [seed.row('status')]))).toEqual(['status', 'merge', 'fix', 'bump']);
    expect(seed.names(reachFrom(seed.skeleton, [seed.row('side'), seed.row('fix')]))).toEqual(['side', 'fix', 'bump']);
  });

  it('reaches nothing from a tip the list does not hold', () => {
    expect(seed.names(reachFrom(seed.skeleton, [-1, 99]))).toEqual([]);
  });
});

describe('a scope is the rows its tips reach, as a list of their own', () => {
  it('keeps the order and the parents, renumbered', () => {
    const scope = pickRows(seed.skeleton, flaggedRows(reachFrom(seed.skeleton, [seed.row('status')])));
    expect(seed.read(scope).entries).toEqual([
      commit('status', 'merge'),
      commit('merge', 'bump', 'fix'),
      commit('fix', 'bump'),
      commit('bump'),
    ]);
  });

  it('puts a parent that was not picked outside the list — each one apart', () => {
    const picked = pickRows(seed.skeleton, Int32Array.from([seed.row('status'), seed.row('merge')]));
    expect([...picked.skeleton.parents]).toEqual([1, 2, 3]);
  });
});

describe('firstParentReach', () => {
  const walk = named([
    commit('status', 'merge'),
    commit('merge', 'bump', 'fix'),
    commit('fix', 'bump'),
    commit('bump'),
  ]);

  it('lists a merged branch a tip still names, and not one no tip does', () => {
    expect(walk.names(firstParentReach(walk.skeleton, [walk.row('fix')]))).toEqual(['status', 'merge', 'fix', 'bump']);
    expect(walk.names(firstParentReach(walk.skeleton, []))).toEqual(['status', 'merge', 'bump']);
    expect(walk.names(firstParentReach(walk.skeleton, [-1]))).toEqual(['status', 'merge', 'bump']);
  });

  it('starts from every head of the list', () => {
    expect(seed.names(firstParentReach(seed.skeleton, []))).toEqual(['status', 'side', 'merge', 'bump']);
  });

  it('joins every commit to its first parent alone', () => {
    const first = firstParentOnly(walk.skeleton);
    expect(walk.read({ skeleton: first, rows: Int32Array.from([0, 1, 2, 3]) }).entries).toEqual([
      commit('status', 'merge'),
      commit('merge', 'bump'),
      commit('fix', 'bump'),
      commit('bump'),
    ]);
  });
});
