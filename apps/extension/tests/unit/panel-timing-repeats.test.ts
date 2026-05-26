import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { computeRepeatStats } from '@openheaders/ui/panel/data/timing-repeats';
import { describe, expect, it } from 'vitest';

let _counter = 0;
function lifecycle(
  url: string,
  durationMs: number,
  method = 'GET',
  fromCache?: 'memory' | 'disk' | 'service-worker',
): RequestLifecycle {
  const startedAtMs = ++_counter * 1000;
  const completedAtMs = startedAtMs + durationMs;
  const har: InspectorHarEntry = {
    startedDateTime: new Date(startedAtMs).toISOString(),
    time: durationMs,
    request: { method, url, httpVersion: '', headers: [], queryString: [], cookies: [], headersSize: -1, bodySize: -1 },
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
    ...(fromCache === 'service-worker'
      ? { _fetchedViaServiceWorker: true }
      : fromCache
        ? { _fromCache: fromCache }
        : {}),
  };
  return {
    tabId: 1,
    requestId: `req-${_counter}`,
    url,
    method,
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    completedAtMs,
    har: new Map([[0, har]]),
    harBodyByHop: new Map(),
  };
}

describe('computeRepeatStats', () => {
  it('returns null when the URL only appears once', () => {
    const e = lifecycle('https://openheaders.io/a', 100);
    expect(computeRepeatStats(e, [e])).toBeNull();
  });

  it('reports fastest / median / slowest across same-URL same-method lifecycles', () => {
    const a = lifecycle('https://openheaders.io/a', 100);
    const b = lifecycle('https://openheaders.io/a', 200);
    const c = lifecycle('https://openheaders.io/a', 300);
    const out = computeRepeatStats(b, [a, b, c]);
    expect(out).not.toBeNull();
    expect(out!.count).toBe(3);
    expect(out!.fastestMs).toBe(100);
    expect(out!.medianMs).toBe(200);
    expect(out!.slowestMs).toBe(300);
    expect(out!.selectedIsSlowest).toBe(false);
    expect(out!.selectedIsFastest).toBe(false);
  });

  it('flags selectedIsSlowest / Fastest correctly', () => {
    const a = lifecycle('https://openheaders.io/a', 100);
    const b = lifecycle('https://openheaders.io/a', 200);
    expect(computeRepeatStats(a, [a, b])!.selectedIsFastest).toBe(true);
    expect(computeRepeatStats(b, [a, b])!.selectedIsSlowest).toBe(true);
  });

  it('does not pair lifecycles with different methods', () => {
    const a = lifecycle('https://openheaders.io/a', 100, 'GET');
    const b = lifecycle('https://openheaders.io/a', 200, 'POST');
    expect(computeRepeatStats(a, [a, b])).toBeNull();
  });

  it('tallies cache outcomes across the repeat set', () => {
    const a = lifecycle('https://openheaders.io/a', 100, 'GET');
    const b = lifecycle('https://openheaders.io/a', 5, 'GET', 'memory');
    const c = lifecycle('https://openheaders.io/a', 30, 'GET', 'disk');
    const d = lifecycle('https://openheaders.io/a', 12, 'GET', 'service-worker');
    const out = computeRepeatStats(a, [a, b, c, d]);
    expect(out!.cacheCounts).toEqual({ miss: 1, memory: 1, disk: 1, serviceWorker: 1 });
  });
});
