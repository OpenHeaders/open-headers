/**
 * The background fetch's throttle and the Console feed's membership:
 * a background fetch is queued only when none was asked for within the
 * minimum gap — whatever the trigger, so two that arrive together are
 * one fetch — and a console row belongs to a repo when its command ran
 * in that work tree.
 */

import { describe, expect, it } from 'vitest';
import { BACKGROUND_FETCH_MIN_GAP_MS } from '../../src/workspace-tree/runtime/core';
import { consoleRowIsOf } from '../../src/workspace-tree/runtime/history';
import { backgroundFetchDue } from '../../src/workspace-tree/runtime/sync';

describe('backgroundFetchDue', () => {
  const now = 1_800_000_000_000;

  it('is due on a binding that never fetched and once the gap has passed', () => {
    expect(backgroundFetchDue(0, now)).toBe(true);
    expect(backgroundFetchDue(now - BACKGROUND_FETCH_MIN_GAP_MS, now)).toBe(true);
    expect(backgroundFetchDue(now - 5 * 60_000, now)).toBe(true);
  });

  it('is not due right after a fetch was asked for — a second trigger of a burst queues nothing', () => {
    expect(backgroundFetchDue(now, now)).toBe(false);
    expect(backgroundFetchDue(now - 180, now)).toBe(false);
    expect(backgroundFetchDue(now - BACKGROUND_FETCH_MIN_GAP_MS + 1, now)).toBe(false);
  });
});

describe('consoleRowIsOf', () => {
  it('takes a command that ran in the work tree or under it, and no sibling whose name starts the same', () => {
    expect(consoleRowIsOf('/repos/ws', '/repos/ws')).toBe(true);
    expect(consoleRowIsOf('/repos/ws', '/repos/ws/sub')).toBe(true);
    expect(consoleRowIsOf('/repos/ws', '/repos/ws-other')).toBe(false);
    expect(consoleRowIsOf('/repos/ws', '/repos')).toBe(false);
  });
});
