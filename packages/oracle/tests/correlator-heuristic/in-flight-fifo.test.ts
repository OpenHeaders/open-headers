/**
 * `InFlightFifo` — verbatim port from
 * `apps/extension/src/background/modules/devtools-inspector-port.ts`.
 * The tests exercise the same scenarios that hid in the legacy
 * `recordInFlight` / `popMatchingRequestId` logic.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  InFlightFifo,
  IN_FLIGHT_MAX_AGE_MS,
  MAX_IN_FLIGHT_URLS_PER_TAB,
  POP_FUTURE_SKEW_MS,
} from '../../src/correlator-heuristic/in-flight-fifo';

const TAB = 1;
const URL = 'https://api.openheaders.io/x';

describe('InFlightFifo — record + popMatching basics', () => {
  it('returns the recorded requestId for an exact (url, method, t) match', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 1_000, 'GET');
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toBe('req-a');
  });

  it('returns undefined when no entries for the url', () => {
    const fifo = new InFlightFifo();
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toBeUndefined();
  });

  it('consumes the entry on match — a second pop misses', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 1_000, 'GET');
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toBe('req-a');
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toBeUndefined();
  });

  it('per-tab isolation — a record on TAB does not satisfy a pop on TAB+1', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 1_000, 'GET');
    expect(fifo.popMatching(TAB + 1, URL, 1_000, 'GET')).toBeUndefined();
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toBe('req-a');
  });
});

describe('InFlightFifo — closest-timestamp join semantics', () => {
  it('picks the entry whose t is closest to harTimestamp', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 1_000, 'GET');
    fifo.record(TAB, URL, 'req-b', 1_050, 'GET');
    expect(fifo.popMatching(TAB, URL, 1_048, 'GET')).toBe('req-b');
    expect(fifo.popMatching(TAB, URL, 1_010, 'GET')).toBe('req-a');
  });

  it('respects POP_FUTURE_SKEW_MS — an entry slightly newer than the HAR still matches', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 2_000, 'GET');
    expect(fifo.popMatching(TAB, URL, 2_000 - POP_FUTURE_SKEW_MS + 1, 'GET')).toBe('req-a');
  });

  it('refuses entries whose t is past the future-skew upper bound', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 2_000 + POP_FUTURE_SKEW_MS + 1, 'GET');
    expect(fifo.popMatching(TAB, URL, 2_000, 'GET')).toBeUndefined();
  });

  it('method gate: POST HAR does not consume a GET in-flight on the same URL', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'get-req', 1_000, 'GET');
    fifo.record(TAB, URL, 'post-req', 1_010, 'POST');
    expect(fifo.popMatching(TAB, URL, 1_011, 'POST')).toBe('post-req');
    expect(fifo.popMatching(TAB, URL, 1_001, 'GET')).toBe('get-req');
  });

  it('empty harMethod (defensive) matches any method', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req', 1_000, 'POST');
    expect(fifo.popMatching(TAB, URL, 1_000, '')).toBe('req');
  });
});

describe('InFlightFifo — staleness sweep', () => {
  it('drops entries older than IN_FLIGHT_MAX_AGE_MS at pop time', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'stale', 1_000, 'GET');
    fifo.record(TAB, URL, 'fresh', 1_000 + IN_FLIGHT_MAX_AGE_MS + 100, 'GET');
    // Pop with a HAR timestamp aligned to the fresh entry — the stale
    // entry is far outside the lower window and must be dropped.
    expect(fifo.popMatching(TAB, URL, 1_000 + IN_FLIGHT_MAX_AGE_MS + 100, 'GET')).toBe('fresh');
    // The stale entry was swept; no further match for the URL.
    expect(fifo.popMatching(TAB, URL, 1_000 + IN_FLIGHT_MAX_AGE_MS + 100, 'GET')).toBeUndefined();
  });

  it('record sweeps the FIFO head before appending — stale entry is gone', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'stale', 1_000, 'GET');
    fifo.record(TAB, URL, 'fresh', 1_000 + IN_FLIGHT_MAX_AGE_MS + 100, 'GET');
    // A pop targeting the stale t must not return 'stale' — it was
    // swept on the second record.
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toBeUndefined();
  });
});

describe('InFlightFifo — LRU eviction at MAX_IN_FLIGHT_URLS_PER_TAB', () => {
  it('drops the least-recently-touched URL once the cap is exceeded', () => {
    const fifo = new InFlightFifo();
    // Fill to the cap, then push one more.
    for (let i = 0; i < MAX_IN_FLIGHT_URLS_PER_TAB; i++) {
      fifo.record(TAB, `https://api.openheaders.io/r${i}`, `req-${i}`, 1_000 + i, 'GET');
    }
    expect(fifo.size()).toBe(MAX_IN_FLIGHT_URLS_PER_TAB);

    fifo.record(TAB, 'https://api.openheaders.io/extra', 'req-extra', 99_999, 'GET');
    expect(fifo.size()).toBe(MAX_IN_FLIGHT_URLS_PER_TAB);
    // The oldest URL (r0) was evicted.
    expect(fifo.popMatching(TAB, 'https://api.openheaders.io/r0', 1_000, 'GET')).toBeUndefined();
    // The newest is still present.
    expect(fifo.popMatching(TAB, 'https://api.openheaders.io/extra', 99_999, 'GET')).toBe('req-extra');
  });

  it('fires onEviction when a non-empty queue is evicted', () => {
    const onEviction = vi.fn();
    const fifo = new InFlightFifo({ onEviction });
    for (let i = 0; i < MAX_IN_FLIGHT_URLS_PER_TAB; i++) {
      fifo.record(TAB, `https://api.openheaders.io/r${i}`, `req-${i}`, 1_000 + i, 'GET');
    }
    fifo.record(TAB, 'https://api.openheaders.io/extra', 'req-extra', 99_999, 'GET');
    expect(onEviction).toHaveBeenCalledTimes(1);
    expect(onEviction).toHaveBeenCalledWith({
      tabId: TAB,
      url: 'https://api.openheaders.io/r0',
      pendingCount: 1,
    });
  });
});

describe('InFlightFifo — forgetTab', () => {
  it('drops all in-flight state for the given tab and leaves siblings alone', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 1_000, 'GET');
    fifo.record(TAB + 1, URL, 'req-b', 1_000, 'GET');
    fifo.forgetTab(TAB);
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toBeUndefined();
    expect(fifo.popMatching(TAB + 1, URL, 1_000, 'GET')).toBe('req-b');
  });
});
