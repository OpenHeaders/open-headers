/**
 * log-reachability (S41): the loaded-window walk behind the rail wash
 * and the current-branch band — reachable commits, the window's edge,
 * a tip outside the window.
 */

import { reachableFrom } from '@openheaders/ui/workbench/components/panels/git/log-reachability';
import { describe, expect, it } from 'vitest';

const entries = [
  { sha: 'c4', parents: ['c3', 'b2'] },
  { sha: 'b2', parents: ['b1'] },
  { sha: 'c3', parents: ['c2'] },
  { sha: 'b1', parents: ['c1'] },
  { sha: 'c2', parents: ['c1'] },
  { sha: 'c1', parents: ['c0'] },
];

describe('reachableFrom', () => {
  it('walks every parent edge inside the window and stops at its edge', () => {
    expect([...(reachableFrom('c4', entries) ?? [])].sort()).toEqual(['b1', 'b2', 'c1', 'c2', 'c3', 'c4']);
    expect([...(reachableFrom('c3', entries) ?? [])].sort()).toEqual(['c1', 'c2', 'c3']);
    expect([...(reachableFrom('b2', entries) ?? [])].sort()).toEqual(['b1', 'b2', 'c1']);
  });

  it('a tip outside the window paints nothing', () => {
    expect(reachableFrom('c0', entries)).toBeNull();
    expect(reachableFrom('zz', entries)).toBeNull();
  });
});
