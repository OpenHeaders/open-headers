/**
 * Client-side reducer (P1) — trust-but-apply over the six
 * `RequestLifecycleUpdate` variants. The engine already enforced
 * invariants; the client side only verifies the shape of `next`.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { describe, expect, it } from 'vitest';

import { NOOP, reduceClientUpdate } from '@openheaders/ui/panel/data/lifecycle';

function makeLifecycle(over: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'r1',
    url: 'https://openheaders.io/a',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 100,
    hopStartedAtMs: 100,
    har: [],
    harBodyByHop: [],
    ...over,
  };
}

describe('reduceClientUpdate — started', () => {
  it('inserts a new lifecycle when none exists', () => {
    const lifecycle = makeLifecycle();
    const result = reduceClientUpdate(undefined, { kind: 'started', lifecycle });
    expect(result).toBe(lifecycle);
  });

  it('noops when a lifecycle for the same requestId already exists', () => {
    const prev = makeLifecycle();
    const result = reduceClientUpdate(prev, { kind: 'started', lifecycle: makeLifecycle({ url: 'https://other.example' }) });
    expect(result).toBe(NOOP);
  });
});

describe('reduceClientUpdate — phase', () => {
  it('merges patch fields, leaving other fields untouched', () => {
    const prev = makeLifecycle({ statusCode: undefined });
    const result = reduceClientUpdate(prev, {
      kind: 'phase',
      tabId: 1,
      requestId: 'r1',
      patch: { phase: 'headers-received', statusCode: 200, statusText: 'OK' },
    });
    expect(result).not.toBe(NOOP);
    expect(result).not.toBeNull();
    const next = result as RequestLifecycle;
    expect(next.phase).toBe('headers-received');
    expect(next.statusCode).toBe(200);
    expect(next.statusText).toBe('OK');
    expect(next.url).toBe(prev.url);
    expect(next.method).toBe(prev.method);
  });

  it('noops when target lifecycle is unknown', () => {
    const result = reduceClientUpdate(undefined, {
      kind: 'phase',
      tabId: 1,
      requestId: 'missing',
      patch: { phase: 'completed' },
    });
    expect(result).toBe(NOOP);
  });
});

describe('reduceClientUpdate — redirect', () => {
  it('appends hop, resets per-hop fields, advances hop count', () => {
    const prev = makeLifecycle({ statusCode: 301, statusText: 'Moved' });
    const result = reduceClientUpdate(prev, {
      kind: 'redirect',
      tabId: 1,
      requestId: 'r1',
      hop: { sourceUrl: prev.url, redirectUrl: 'https://openheaders.io/b', statusCode: 301, timestampMs: 110 },
      nextUrl: 'https://openheaders.io/b',
    });
    const next = result as RequestLifecycle;
    expect(next.url).toBe('https://openheaders.io/b');
    expect(next.phase).toBe('pending');
    expect(next.redirectHopCount).toBe(1);
    expect(next.redirectHops).toHaveLength(1);
    expect(next.hopStartedAtMs).toBe(110);
    expect(next.statusCode).toBeUndefined();
    expect(next.statusText).toBeUndefined();
  });
});

describe('reduceClientUpdate — har-attached / body-attached', () => {
  it('stores HAR at hopIndex, copying the array (no shared mutation)', () => {
    const prev = makeLifecycle();
    const harEntry = { request: {}, response: {} } as never;
    const result = reduceClientUpdate(prev, {
      kind: 'har-attached',
      tabId: 1,
      requestId: 'r1',
      hopIndex: 0,
      har: harEntry,
    });
    const next = result as RequestLifecycle;
    expect(next.har[0]).toBe(harEntry);
    expect(next.har).not.toBe(prev.har);
  });

  it('stores body under hopIndex', () => {
    const prev = makeLifecycle();
    const body = { encoding: 'utf-8', text: 'hi' } as never;
    const result = reduceClientUpdate(prev, {
      kind: 'body-attached',
      tabId: 1,
      requestId: 'r1',
      hopIndex: 0,
      body,
    });
    const next = result as RequestLifecycle;
    expect(next.harBodyByHop[0]).toBe(body);
  });
});

describe('reduceClientUpdate — gone', () => {
  it('returns null when the lifecycle exists', () => {
    const prev = makeLifecycle();
    const result = reduceClientUpdate(prev, { kind: 'gone', tabId: 1, requestId: 'r1' });
    expect(result).toBeNull();
  });

  it('noops when the lifecycle is unknown', () => {
    const result = reduceClientUpdate(undefined, { kind: 'gone', tabId: 1, requestId: 'r1' });
    expect(result).toBe(NOOP);
  });
});
