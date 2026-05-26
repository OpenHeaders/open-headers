import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { computeCascadeSummary } from '@openheaders/ui/panel/data/cascade-summary';
import { describe, expect, it } from 'vitest';

let _seq = 0;
function lifecycle(
  url: string,
  opts: { bytes?: number; duration?: number; status?: number } = {},
): RequestLifecycle {
  const startedAtMs = ++_seq * 100;
  const har: InspectorHarEntry = {
    startedDateTime: new Date(startedAtMs).toISOString(),
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: {
      status: opts.status ?? 200,
      statusText: 'OK',
      headers: [],
      bodySize: opts.bytes ?? 0,
      content: { size: opts.bytes ?? 0, mimeType: 'text/plain' },
    },
  } as InspectorHarEntry;
  return {
    tabId: 1,
    requestId: `r-${_seq}-${url}`,
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    ...(opts.duration != null ? { completedAtMs: startedAtMs + opts.duration } : {}),
    statusCode: opts.status ?? 200,
    har: new Map([[0, har]]),
    harBodyByHop: new Map(),
  };
}

function getChildrenFrom(map: Map<string, RequestLifecycle[]>) {
  return (url: string) => map.get(url) ?? [];
}

describe('computeCascadeSummary', () => {
  it('returns zero stats when root has no children', () => {
    const root = lifecycle('https://openheaders.io/');
    const out = computeCascadeSummary(root, () => [], 'https://openheaders.io');
    expect(out.requestCount).toBe(0);
    expect(out.transferredBytes).toBe(0);
    expect(out.cumulativeMs).toBe(0);
    expect(out.failedCount).toBe(0);
  });

  it('aggregates direct children + grandchildren into totals', () => {
    const root = lifecycle('https://openheaders.io/');
    const a = lifecycle('https://openheaders.io/a.js', { bytes: 1000, duration: 100 });
    const b = lifecycle('https://openheaders.io/b.css', { bytes: 2000, duration: 200 });
    const c = lifecycle('https://openheaders.io/c.woff', { bytes: 3000, duration: 50 });
    const map = new Map<string, RequestLifecycle[]>([
      [root.url, [a, b]],
      [b.url, [c]],
    ]);
    const out = computeCascadeSummary(root, getChildrenFrom(map), 'https://openheaders.io');
    expect(out.requestCount).toBe(3);
    expect(out.transferredBytes).toBe(6000);
    expect(out.cumulativeMs).toBe(350);
    expect(out.subtreeStats.get(b.requestId)?.count).toBe(1);
    expect(out.subtreeStats.get(b.requestId)?.bytes).toBe(3000);
  });

  it('counts failures across the cascade', () => {
    const root = lifecycle('https://openheaders.io/');
    const a = lifecycle('https://openheaders.io/a.js', { bytes: 100, status: 404 });
    const b = lifecycle('https://openheaders.io/b.js', { bytes: 100, status: 200 });
    const map = new Map([[root.url, [a, b]]]);
    const out = computeCascadeSummary(root, getChildrenFrom(map), 'https://openheaders.io');
    expect(out.failedCount).toBe(1);
  });

  it('attributes third-party bytes correctly against pageOrigin', () => {
    const root = lifecycle('https://openheaders.io/');
    const own = lifecycle('https://openheaders.io/local.js', { bytes: 1000 });
    const third = lifecycle('https://cdn.example.com/lib.js', { bytes: 2500 });
    const map = new Map([[root.url, [own, third]]]);
    const out = computeCascadeSummary(root, getChildrenFrom(map), 'https://openheaders.io');
    expect(out.transferredBytes).toBe(3500);
    expect(out.thirdPartyBytes).toBe(2500);
  });

  it('groups bytes by host', () => {
    const root = lifecycle('https://openheaders.io/');
    const a = lifecycle('https://cdn.example.com/x', { bytes: 100 });
    const b = lifecycle('https://cdn.example.com/y', { bytes: 200 });
    const c = lifecycle('https://other.example.com/z', { bytes: 50 });
    const map = new Map([[root.url, [a, b, c]]]);
    const out = computeCascadeSummary(root, getChildrenFrom(map), 'https://openheaders.io');
    expect(out.byHost.get('cdn.example.com')?.count).toBe(2);
    expect(out.byHost.get('cdn.example.com')?.bytes).toBe(300);
    expect(out.byHost.get('other.example.com')?.bytes).toBe(50);
  });

  it('cycle-guards self-referencing chains', () => {
    const root = lifecycle('https://openheaders.io/');
    const a = lifecycle('https://openheaders.io/a.js', { bytes: 100 });
    const map = new Map<string, RequestLifecycle[]>([
      [root.url, [a]],
      [a.url, [root]],
    ]);
    const out = computeCascadeSummary(root, getChildrenFrom(map), 'https://openheaders.io');
    expect(out.requestCount).toBe(1);
  });
});
