/**
 * `InFlightFifo` join semantics: closest-timestamp matching, method
 * gating, staleness sweep, per-tab LRU. H8/H9 extension: each `record`
 * stamps the hop the URL belongs to, and `popMatching` returns
 * `{ requestId, hopIndex }` so the caller can mint per-hop HAR + body
 * attachments without re-deriving the hop later.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  InFlightFifo,
  IN_FLIGHT_MAX_AGE_MS,
  MAX_IN_FLIGHT_URLS_PER_TAB,
} from '../../src/correlator-heuristic/in-flight-fifo';

const TAB = 1;
const URL = 'https://api.openheaders.io/x';

describe('InFlightFifo — record + popMatching basics', () => {
  it('returns the recorded { requestId, hopIndex } for an exact match', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 1_000, 'GET', 0);
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toEqual({
      requestId: 'req-a',
      hopIndex: 0,
    });
  });

  it('returns undefined when no entries for the url', () => {
    const fifo = new InFlightFifo();
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toBeUndefined();
  });

  it('consumes the entry on match — a second pop misses', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 1_000, 'GET', 0);
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toEqual({
      requestId: 'req-a',
      hopIndex: 0,
    });
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toBeUndefined();
  });

  it('per-tab isolation — a record on TAB does not satisfy a pop on TAB+1', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 1_000, 'GET', 0);
    expect(fifo.popMatching(TAB + 1, URL, 1_000, 'GET')).toBeUndefined();
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toEqual({
      requestId: 'req-a',
      hopIndex: 0,
    });
  });
});

describe('InFlightFifo — closest-timestamp join semantics', () => {
  it('picks the entry whose t is closest to harTimestamp', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 1_000, 'GET', 0);
    fifo.record(TAB, URL, 'req-b', 1_050, 'GET', 0);
    expect(fifo.popMatching(TAB, URL, 1_048, 'GET')).toEqual({
      requestId: 'req-b',
      hopIndex: 0,
    });
    expect(fifo.popMatching(TAB, URL, 1_010, 'GET')).toEqual({
      requestId: 'req-a',
      hopIndex: 0,
    });
  });

  it('matches an in-flight entry seconds newer than the HAR start (processing skew)', () => {
    const fifo = new InFlightFifo();
    // The webRequest event was processed ~10s after the request's true
    // start under SW load, so entry.t sits well ahead of the HAR
    // startedDateTime — still the same request, must still match.
    fifo.record(TAB, URL, 'req-a', 2_000 + 10_000, 'GET', 0);
    expect(fifo.popMatching(TAB, URL, 2_000, 'GET')).toEqual({
      requestId: 'req-a',
      hopIndex: 0,
    });
  });

  it('refuses an entry further than IN_FLIGHT_MAX_AGE_MS into the future', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req-a', 2_000 + IN_FLIGHT_MAX_AGE_MS + 1, 'GET', 0);
    expect(fifo.popMatching(TAB, URL, 2_000, 'GET')).toBeUndefined();
  });

  it('method gate: POST HAR does not consume a GET in-flight on the same URL', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'get-req', 1_000, 'GET', 0);
    fifo.record(TAB, URL, 'post-req', 1_010, 'POST', 0);
    expect(fifo.popMatching(TAB, URL, 1_011, 'POST')).toEqual({
      requestId: 'post-req',
      hopIndex: 0,
    });
    expect(fifo.popMatching(TAB, URL, 1_001, 'GET')).toEqual({
      requestId: 'get-req',
      hopIndex: 0,
    });
  });

  it('empty harMethod (defensive) matches any method', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'req', 1_000, 'POST', 0);
    expect(fifo.popMatching(TAB, URL, 1_000, '')).toEqual({
      requestId: 'req',
      hopIndex: 0,
    });
  });
});

describe('InFlightFifo — hop-index attribution (H8/H9)', () => {
  const URL_A = 'https://api.openheaders.io/a';
  const URL_B = 'https://api.openheaders.io/b';
  const URL_C = 'https://api.openheaders.io/c';

  it('returns the hopIndex stamped at record time', () => {
    const fifo = new InFlightFifo();
    // Same requestId across redirect chain — different URLs per hop.
    fifo.record(TAB, URL_A, 'req-1', 1_000, 'GET', 0);
    fifo.record(TAB, URL_B, 'req-1', 1_050, 'GET', 1);
    fifo.record(TAB, URL_C, 'req-1', 1_100, 'GET', 2);

    expect(fifo.popMatching(TAB, URL_A, 1_000, 'GET')).toEqual({
      requestId: 'req-1',
      hopIndex: 0,
    });
    expect(fifo.popMatching(TAB, URL_B, 1_050, 'GET')).toEqual({
      requestId: 'req-1',
      hopIndex: 1,
    });
    expect(fifo.popMatching(TAB, URL_C, 1_100, 'GET')).toEqual({
      requestId: 'req-1',
      hopIndex: 2,
    });
  });

  it('a chain that revisits the same URL keeps hops disambiguated by timestamp', () => {
    const fifo = new InFlightFifo();
    // A → B → A — hop 0 and hop 2 share URL_A but the queue holds both.
    fifo.record(TAB, URL_A, 'req-1', 1_000, 'GET', 0);
    fifo.record(TAB, URL_A, 'req-1', 1_500, 'GET', 2);

    // HAR for hop 0 (closer to t=1_000) picks the hop-0 entry.
    expect(fifo.popMatching(TAB, URL_A, 1_010, 'GET')).toEqual({
      requestId: 'req-1',
      hopIndex: 0,
    });
    // HAR for hop 2 — the remaining entry — comes out with hopIndex 2.
    expect(fifo.popMatching(TAB, URL_A, 1_505, 'GET')).toEqual({
      requestId: 'req-1',
      hopIndex: 2,
    });
  });

  it('method gate composes with hop attribution (303 GET vs prior POST share URL)', () => {
    const fifo = new InFlightFifo();
    // Hop 0: POST. After 303 redirect to same URL the method rewrites
    // to GET on hop 1. Both entries coexist; method gate filters.
    fifo.record(TAB, URL, 'req-1', 1_000, 'POST', 0);
    fifo.record(TAB, URL, 'req-1', 1_010, 'GET', 1);

    expect(fifo.popMatching(TAB, URL, 1_011, 'GET')).toEqual({
      requestId: 'req-1',
      hopIndex: 1,
    });
    expect(fifo.popMatching(TAB, URL, 1_001, 'POST')).toEqual({
      requestId: 'req-1',
      hopIndex: 0,
    });
  });
});

describe('InFlightFifo — staleness sweep', () => {
  it('drops entries older than IN_FLIGHT_MAX_AGE_MS at pop time', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'stale', 1_000, 'GET', 0);
    fifo.record(TAB, URL, 'fresh', 1_000 + IN_FLIGHT_MAX_AGE_MS + 100, 'GET', 0);
    // Pop with a HAR timestamp aligned to the fresh entry — the stale
    // entry is far outside the lower window and must be dropped.
    expect(
      fifo.popMatching(TAB, URL, 1_000 + IN_FLIGHT_MAX_AGE_MS + 100, 'GET'),
    ).toEqual({ requestId: 'fresh', hopIndex: 0 });
    // The stale entry was swept; no further match for the URL.
    expect(
      fifo.popMatching(TAB, URL, 1_000 + IN_FLIGHT_MAX_AGE_MS + 100, 'GET'),
    ).toBeUndefined();
  });

  it('record sweeps the FIFO head before appending — stale entry is gone', () => {
    const fifo = new InFlightFifo();
    fifo.record(TAB, URL, 'stale', 1_000, 'GET', 0);
    fifo.record(TAB, URL, 'fresh', 1_000 + IN_FLIGHT_MAX_AGE_MS + 100, 'GET', 0);
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
      fifo.record(TAB, `https://api.openheaders.io/r${i}`, `req-${i}`, 1_000 + i, 'GET', 0);
    }
    expect(fifo.size()).toBe(MAX_IN_FLIGHT_URLS_PER_TAB);

    fifo.record(TAB, 'https://api.openheaders.io/extra', 'req-extra', 99_999, 'GET', 0);
    expect(fifo.size()).toBe(MAX_IN_FLIGHT_URLS_PER_TAB);
    // The oldest URL (r0) was evicted.
    expect(fifo.popMatching(TAB, 'https://api.openheaders.io/r0', 1_000, 'GET')).toBeUndefined();
    // The newest is still present.
    expect(
      fifo.popMatching(TAB, 'https://api.openheaders.io/extra', 99_999, 'GET'),
    ).toEqual({ requestId: 'req-extra', hopIndex: 0 });
  });

  it('fires onEviction when a non-empty queue is evicted', () => {
    const onEviction = vi.fn();
    const fifo = new InFlightFifo({ onEviction });
    for (let i = 0; i < MAX_IN_FLIGHT_URLS_PER_TAB; i++) {
      fifo.record(TAB, `https://api.openheaders.io/r${i}`, `req-${i}`, 1_000 + i, 'GET', 0);
    }
    fifo.record(TAB, 'https://api.openheaders.io/extra', 'req-extra', 99_999, 'GET', 0);
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
    fifo.record(TAB, URL, 'req-a', 1_000, 'GET', 0);
    fifo.record(TAB + 1, URL, 'req-b', 1_000, 'GET', 0);
    fifo.forgetTab(TAB);
    expect(fifo.popMatching(TAB, URL, 1_000, 'GET')).toBeUndefined();
    expect(fifo.popMatching(TAB + 1, URL, 1_000, 'GET')).toEqual({
      requestId: 'req-b',
      hopIndex: 0,
    });
  });
});
