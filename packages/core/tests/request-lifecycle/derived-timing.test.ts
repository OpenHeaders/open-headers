/**
 * Pure unit tests for `deriveHopNetworkStartMs` — the shared rule both the
 * engine reducer and its client-side mirror apply to recover a hop's network
 * start (the footer's anchor) from its attached HAR's queueing leg.
 */

import { describe, expect, it } from 'vitest';
import { deriveHopNetworkStartMs } from '../../src/request-lifecycle/derived-timing';
import type { RequestLifecycle } from '../../src/request-lifecycle/types';
import type { InspectorHarEntry } from '../../src/types/har-source';

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/v1/items',
    method: 'GET',
    resourceType: 'document',
    phase: 'headers-received',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1000,
    hopStartedAtMs: 1000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

function harWithQueueing(queueing: number | undefined): InspectorHarEntry {
  return {
    startedDateTime: '2026-05-25T00:00:00.000Z',
    ...(queueing !== undefined ? { timings: { _blocked_queueing: queueing } } : {}),
  } as InspectorHarEntry;
}

describe('deriveHopNetworkStartMs', () => {
  it('adds the current hop queueing leg to the issue instant', () => {
    const lc = makeLifecycle({ hopStartedAtMs: 1000 });
    expect(deriveHopNetworkStartMs(lc, 0, harWithQueueing(0.843))).toBe(1000.843);
  });

  it('keeps an upstream-stamped network start (CDP precision wins over the HAR)', () => {
    const lc = makeLifecycle({ hopStartedAtMs: 1000, hopNetworkStartMs: 1000.7 });
    expect(deriveHopNetworkStartMs(lc, 0, harWithQueueing(0.843))).toBeUndefined();
  });

  it('ignores a HAR for an earlier hop than the current one', () => {
    const lc = makeLifecycle({ redirectHopCount: 1, hopStartedAtMs: 2000 });
    expect(deriveHopNetworkStartMs(lc, 0, harWithQueueing(0.843))).toBeUndefined();
  });

  it('returns undefined when no queueing leg was measured (sentinel)', () => {
    const lc = makeLifecycle({ hopStartedAtMs: 1000 });
    expect(deriveHopNetworkStartMs(lc, 0, harWithQueueing(-1))).toBeUndefined();
    expect(deriveHopNetworkStartMs(lc, 0, harWithQueueing(0))).toBeUndefined();
    expect(deriveHopNetworkStartMs(lc, 0, harWithQueueing(undefined))).toBeUndefined();
  });
});
