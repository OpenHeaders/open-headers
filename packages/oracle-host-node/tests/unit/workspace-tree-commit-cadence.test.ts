/**
 * The `auto` cadence's wait after an automated commit pass found the
 * index locked: the quiescence first, doubled per stand-down in a row,
 * never past the cap — so a lock that clears is retried at once and one
 * nobody releases costs a try a minute.
 */

import { describe, expect, it } from 'vitest';
import { standDownRetryMs } from '../../src/workspace-tree/runtime/commit';
import { COMMIT_QUIESCENCE_MS, COMMIT_STAND_DOWN_MAX_WAIT_MS } from '../../src/workspace-tree/runtime/core';

describe('standDownRetryMs', () => {
  it('waits the quiescence after the first stand-down and twice as long after each one that follows', () => {
    expect(standDownRetryMs(0)).toBe(COMMIT_QUIESCENCE_MS);
    expect(standDownRetryMs(1)).toBe(COMMIT_QUIESCENCE_MS * 2);
    expect(standDownRetryMs(3)).toBe(COMMIT_QUIESCENCE_MS * 8);
  });

  it('never waits past the cap, however long the lock is held', () => {
    expect(standDownRetryMs(5)).toBe(COMMIT_STAND_DOWN_MAX_WAIT_MS);
    expect(standDownRetryMs(40)).toBe(COMMIT_STAND_DOWN_MAX_WAIT_MS);
    expect(standDownRetryMs(2_000)).toBe(COMMIT_STAND_DOWN_MAX_WAIT_MS);
  });
});
