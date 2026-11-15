/**
 * Whose turn a history search has: a surface's newer search ends its
 * older one, a workspace runs no more than its bound at once (the
 * oldest gives way), one workspace's searches never end another's, and
 * a search that is over frees its turn.
 */

import { describe, expect, it } from 'vitest';
import { createSearchTurns } from '../../src/workspace-tree/search-turns';

describe('search turns', () => {
  it('a newer search under the same key ends the older one, and no other', () => {
    const turns = createSearchTurns(4);
    const first = turns.take('ws', 'log-1');
    const other = turns.take('ws', 'log-2');
    const second = turns.take('ws', 'log-1');
    expect(first.signal.aborted).toBe(true);
    expect(other.signal.aborted).toBe(false);
    expect(second.signal.aborted).toBe(false);
  });

  it('one more than the bound ends the oldest in flight', () => {
    const turns = createSearchTurns(2);
    const a = turns.take('ws', 'a');
    const b = turns.take('ws', 'b');
    const c = turns.take('ws', 'c');
    expect([a, b, c].map((turn) => turn.signal.aborted)).toEqual([true, false, false]);
    const d = turns.take('ws', 'd');
    expect([b, c, d].map((turn) => turn.signal.aborted)).toEqual([true, false, false]);
  });

  it('a key that searches again counts as the newest', () => {
    const turns = createSearchTurns(2);
    turns.take('ws', 'a');
    const b = turns.take('ws', 'b');
    const again = turns.take('ws', 'a');
    turns.take('ws', 'c');
    expect(b.signal.aborted).toBe(true);
    expect(again.signal.aborted).toBe(false);
  });

  it('a search that is over frees its turn', () => {
    const turns = createSearchTurns(2);
    const a = turns.take('ws', 'a');
    const b = turns.take('ws', 'b');
    a.done();
    const c = turns.take('ws', 'c');
    expect([a, b, c].map((turn) => turn.signal.aborted)).toEqual([false, false, false]);
  });

  it('an ended search that says it is over leaves the turn of the one that took its place', () => {
    const turns = createSearchTurns(1);
    const first = turns.take('ws', 'log-1');
    const second = turns.take('ws', 'log-1');
    first.done();
    const third = turns.take('ws', 'log-2');
    expect(second.signal.aborted).toBe(true);
    expect(third.signal.aborted).toBe(false);
  });

  it('one workspace’s searches never end another’s', () => {
    const turns = createSearchTurns(1);
    const mine = turns.take('ws-a', 'log-1');
    const theirs = turns.take('ws-b', 'log-1');
    expect([mine, theirs].map((turn) => turn.signal.aborted)).toEqual([false, false]);
  });

  it('ends every search in flight when the host goes away', () => {
    const turns = createSearchTurns(4);
    const held = [turns.take('ws-a', 'a'), turns.take('ws-a', 'b'), turns.take('ws-b', 'a')];
    turns.endAll();
    expect(held.map((turn) => turn.signal.aborted)).toEqual([true, true, true]);
  });
});
