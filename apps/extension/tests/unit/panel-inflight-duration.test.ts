/**
 * In-flight duration — the Time column and waterfall bar grow during a slow
 * download instead of reading "Pending" until the terminal event. The browser
 * shows `duration = endTime - startTime` and advances `endTime` on every body
 * chunk; OH mirrors that with `lastActivityAtMs` (the latest chunk's wall
 * instant). Both duration helpers must surface that interval while in flight,
 * and both must defer to the authoritative HAR `time` once the hop finishes.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { lifecycleDurationMs } from '@openheaders/ui/panel/data/inspector-row-projection';
import { durationMs } from '@openheaders/ui/panel/data/network-columns';
import { describe, expect, it } from 'vitest';

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'req-1',
    url: 'https://openheaders.io/big.bin',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'headers-received',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

describe('in-flight duration (lastActivityAtMs)', () => {
  it('reads the elapsed time to the latest body chunk while still streaming', () => {
    const lc = makeLifecycle({ lastActivityAtMs: 3_500 });
    expect(lifecycleDurationMs(lc)).toBe(2_500);
    expect(durationMs(lc)).toBe(2_500);
  });

  it('is unknown before the first byte (no chunk yet)', () => {
    const lc = makeLifecycle();
    expect(lifecycleDurationMs(lc)).toBeNull();
    expect(durationMs(lc)).toBe(-1);
  });

  it('defers to the authoritative HAR time once the hop has finished', () => {
    const har: InspectorHarEntry = {
      startedDateTime: '2026-04-17T00:00:00.000Z',
      time: 640,
      request: { method: 'GET', url: 'https://openheaders.io/big.bin', headers: [], queryString: [] },
      response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
      timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 640 },
    } as InspectorHarEntry;
    // A stale running interval must not override the finished HAR time.
    const lc = makeLifecycle({ phase: 'completed', completedAtMs: 1_640, lastActivityAtMs: 9_999, har: [har] });
    expect(lifecycleDurationMs(lc)).toBe(640);
    expect(durationMs(lc)).toBe(640);
  });
});
