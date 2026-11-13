/**
 * Sort › Topologically — the reference's order over the window: the
 * checked-out commit leads, every other head's own run is listed above
 * the trunk (the window's order), the checked-out branch's upstream
 * last, then the trunk unbroken with a merged branch's commit directly
 * under its merge. The first case is the rig's seed, row for row as the
 * reference lists it.
 */

import { topologicalOrder } from '@openheaders/ui/workbench/components/panels/git/log-topological';
import { describe, expect, it } from 'vitest';

const commit = (sha: string, ...parents: string[]) => ({ sha, parents });
const order = (window: ReturnType<typeof commit>[], lead: string | null, ...last: string[]) =>
  topologicalOrder(window, { lead, last: new Set(last) }).map((entry) => entry.sha);

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

describe('topologicalOrder', () => {
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

  it('never lists a parent above one of its children', () => {
    const listed = order(seed, 'docs', 'dana');
    for (const entry of seed) {
      for (const parent of entry.parents) {
        expect(listed.indexOf(entry.sha), `${entry.sha} over ${parent}`).toBeLessThan(listed.indexOf(parent));
      }
    }
  });

  it('keeps the window’s order of heads when none is checked out or an upstream', () => {
    // Two branches whose commits interleave in time: each run stays together.
    const interleaved = [commit('a2', 'a1'), commit('b2', 'b1'), commit('a1', 'r'), commit('b1', 'r'), commit('r')];
    expect(order(interleaved, null)).toEqual(['a2', 'a1', 'b2', 'b1', 'r']);
    expect(order(interleaved, 'b2')).toEqual(['b2', 'b1', 'a2', 'a1', 'r']);
  });

  it('takes a merge’s side before its first parent, and leaves a linear window as it is', () => {
    const merged = [commit('m', 'p', 's'), commit('p', 'b'), commit('s', 'b'), commit('b')];
    expect(order(merged, 'm')).toEqual(['m', 's', 'p', 'b']);
    const line = [commit('c', 'b'), commit('b', 'a'), commit('a', 'gone')];
    expect(order(line, 'c')).toEqual(['c', 'b', 'a']);
  });

  it('answers the same entries it was handed', () => {
    const listed = topologicalOrder(seed, { lead: 'docs', last: new Set(['dana']) });
    expect(listed).toHaveLength(seed.length);
    expect(listed.every((entry) => seed.includes(entry))).toBe(true);
  });
});
