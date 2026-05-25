/**
 * `FinalizedRetention` — backward retention of terminal-phase
 * lifecycle keys for the H7 late-arrival window.
 */

import { describe, expect, it } from 'vitest';

import { FinalizedRetention } from '../../src/correlator-heuristic/finalized-retention';
import { LATE_ARRIVAL_WINDOW_MS } from '../../src/correlator-heuristic/late-arrival-constants';

const TAB = 7;
const T0 = 1_700_000_000_000;

describe('FinalizedRetention — markFinalized / gcExpired', () => {
  it('returns no expired entries when nothing has been marked', () => {
    const ret = new FinalizedRetention();
    expect(ret.gcExpired(T0)).toEqual([]);
  });

  it('returns nothing while every entry is within the window', () => {
    const ret = new FinalizedRetention();
    ret.markFinalized(TAB, 'wr-1', T0);
    ret.markFinalized(TAB, 'wr-2', T0 + 10);
    expect(ret.gcExpired(T0 + LATE_ARRIVAL_WINDOW_MS - 1)).toEqual([]);
    expect(ret.size()).toBe(2);
  });

  it('expires entries whose finalizedAtMs is past the window', () => {
    const ret = new FinalizedRetention();
    ret.markFinalized(TAB, 'wr-1', T0);
    ret.markFinalized(TAB, 'wr-2', T0 + 10);

    const expired = ret.gcExpired(T0 + LATE_ARRIVAL_WINDOW_MS + 1);
    expect(expired).toEqual([{ tabId: TAB, requestId: 'wr-1' }]);
    expect(ret.size()).toBe(1);
  });

  it('expires in insertion order and stops at the first in-window entry', () => {
    const ret = new FinalizedRetention();
    ret.markFinalized(TAB, 'wr-old', T0);
    ret.markFinalized(TAB, 'wr-mid', T0 + 100);
    ret.markFinalized(TAB, 'wr-new', T0 + LATE_ARRIVAL_WINDOW_MS);

    const expired = ret.gcExpired(T0 + LATE_ARRIVAL_WINDOW_MS + 200);
    expect(expired.map((e) => e.requestId)).toEqual(['wr-old', 'wr-mid']);
    expect(ret.size()).toBe(1);
  });

  it('re-marking refreshes the finalizedAtMs (longest window wins)', () => {
    const ret = new FinalizedRetention();
    ret.markFinalized(TAB, 'wr-1', T0);
    ret.markFinalized(TAB, 'wr-1', T0 + LATE_ARRIVAL_WINDOW_MS);

    expect(ret.gcExpired(T0 + LATE_ARRIVAL_WINDOW_MS + 1)).toEqual([]);
    expect(ret.size()).toBe(1);
  });
});

describe('FinalizedRetention — tab scope', () => {
  it('forgetTab drops every retention for that tab', () => {
    const ret = new FinalizedRetention();
    ret.markFinalized(TAB, 'wr-1', T0);
    ret.markFinalized(TAB, 'wr-2', T0);
    ret.markFinalized(TAB + 1, 'wr-3', T0);

    ret.forgetTab(TAB);
    expect(ret.size()).toBe(1);
    expect(ret.gcExpired(T0 + LATE_ARRIVAL_WINDOW_MS + 1)).toEqual([
      { tabId: TAB + 1, requestId: 'wr-3' },
    ]);
  });

  it('forget(tabId, requestId) drops a single entry', () => {
    const ret = new FinalizedRetention();
    ret.markFinalized(TAB, 'wr-1', T0);
    ret.markFinalized(TAB, 'wr-2', T0);

    ret.forget(TAB, 'wr-1');
    expect(ret.size()).toBe(1);
  });
});
