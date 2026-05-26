import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { computeConnectionReuse } from '@openheaders/ui/panel/data/connection-reuse';
import { describe, expect, it } from 'vitest';

let _counter = 0;
function lifecycle(url: string, connection?: string, startedAtMs?: number): RequestLifecycle {
  const t = startedAtMs ?? ++_counter * 100;
  const id = `req-${_counter}`;
  const har: InspectorHarEntry = {
    startedDateTime: new Date(t).toISOString(),
    time: 0,
    request: { method: 'GET', url, httpVersion: '', headers: [], queryString: [], cookies: [], headersSize: -1, bodySize: -1 },
    timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 0, receive: 0 },
    ...(connection ? { connection } : {}),
  };
  return {
    tabId: 1,
    requestId: id,
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: t,
    hopStartedAtMs: t,
    har: new Map([[0, har]]),
    harBodyByHop: new Map(),
  };
}

describe('computeConnectionReuse', () => {
  it('returns reused=false when the lifecycle has no connection id', () => {
    const e = lifecycle('https://openheaders.io/a');
    const out = computeConnectionReuse(e, [e]);
    expect(out.reused).toBe(false);
    expect(out.connectionId).toBeNull();
  });

  it('returns reused=false when the lifecycle is the only one on its connection', () => {
    const e = lifecycle('https://openheaders.io/a', 'CONN-1');
    const out = computeConnectionReuse(e, [e]);
    expect(out.reused).toBe(false);
  });

  it('marks reused=true when an earlier lifecycle shares the connection', () => {
    const a = lifecycle('https://openheaders.io/a', 'CONN-1', 100);
    const b = lifecycle('https://openheaders.io/b', 'CONN-1', 200);
    const out = computeConnectionReuse(b, [a, b]);
    expect(out.reused).toBe(true);
    expect(out.openedBy?.url).toBe('https://openheaders.io/a');
    expect(out.openedBy?.startedAtMs).toBe(100);
  });

  it('does not mark itself as the opener', () => {
    const a = lifecycle('https://openheaders.io/a', 'CONN-1', 100);
    const b = lifecycle('https://openheaders.io/b', 'CONN-1', 200);
    expect(computeConnectionReuse(a, [a, b]).reused).toBe(false);
  });

  it('ignores lifecycles on a different connection', () => {
    const a = lifecycle('https://openheaders.io/a', 'CONN-1', 100);
    const b = lifecycle('https://openheaders.io/b', 'CONN-2', 200);
    expect(computeConnectionReuse(b, [a, b]).reused).toBe(false);
  });
});
