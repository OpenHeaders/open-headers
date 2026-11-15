/**
 * Sort › Topologically over rows by number: the checked-out commit
 * leads, every other head's own run is listed above the trunk (the
 * list's order), the checked-out branch's upstream last, then the trunk
 * unbroken with a merged branch's commit directly under its merge. The
 * first case is the rig's seed, row for row as the reference lists it.
 */

import { describe, expect, it } from 'vitest';
import { type NamedLogEntry, topologicalRows } from '../../src/workspace-tree';
import { commit, named } from './log-named';

const order = (entries: readonly NamedLogEntry[], lead: string | null, ...last: string[]): string[] => {
  const list = named(entries);
  const rows = topologicalRows(list.skeleton, { lead: lead === null ? -1 : list.row(lead), last: list.flags(...last) });
  return list.names(rows);
};

// The seed in git's date order, newest first.
const seed = [
  commit('docs', 'orders'),
  commit('dana', 'orders'),
  commit('release', 'orders'),
  commit('orders', 'notes'),
  commit('orders-v2', 'notes'),
  commit('notes', 'status'),
  commit('status', 'merge'),
  commit('merge', 'bump', 'fix'),
  commit('fix', 'bump'),
  commit('local-test', 'bump'),
  commit('auth-two', 'auth-one'),
  commit('auth-one', 'bump'),
  commit('bump', 'rename'),
  commit('rename', 'initial'),
  commit('initial'),
];

describe('topologicalRows', () => {
  it('lists the seed as the reference does: heads above the trunk, the upstream last, the trunk unbroken', () => {
    expect(order(seed, 'docs', 'dana')).toEqual([
      'docs',
      'release',
      'orders-v2',
      'local-test',
      'auth-two',
      'auth-one',
      'dana',
      'orders',
      'notes',
      'status',
      'merge',
      'fix',
      'bump',
      'rename',
      'initial',
    ]);
  });

  it('never lists a parent above one of its children, and lists every commit once', () => {
    const listed = order(seed, 'docs', 'dana');
    expect([...listed].sort()).toEqual(seed.map((entry) => entry.sha).sort());
    for (const entry of seed) {
      for (const parent of entry.parents) {
        expect(listed.indexOf(entry.sha), `${entry.sha} over ${parent}`).toBeLessThan(listed.indexOf(parent));
      }
    }
  });

  it('keeps the list’s order of heads when none is checked out or an upstream', () => {
    // Two branches whose commits interleave in time: each run stays together.
    const interleaved = [commit('a2', 'a1'), commit('b2', 'b1'), commit('a1', 'r'), commit('b1', 'r'), commit('r')];
    expect(order(interleaved, null)).toEqual(['a2', 'a1', 'b2', 'b1', 'r']);
    expect(order(interleaved, 'b2')).toEqual(['b2', 'b1', 'a2', 'a1', 'r']);
    expect(order(interleaved, null, 'a2')).toEqual(['b2', 'b1', 'a2', 'a1', 'r']);
  });

  it('takes a merge’s side before its first parent, and leaves a line as it is', () => {
    const merged = [commit('m', 'p', 's'), commit('p', 'b'), commit('s', 'b'), commit('b')];
    expect(order(merged, 'm')).toEqual(['m', 's', 'p', 'b']);
    const line = [commit('c', 'b'), commit('b', 'a'), commit('a', 'gone')];
    expect(order(line, 'c')).toEqual(['c', 'b', 'a']);
  });
});
