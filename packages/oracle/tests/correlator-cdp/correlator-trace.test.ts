/**
 * T4 — known CDP event trace → expected `RequestLifecycle` terminal
 * state, end-to-end through `CdpCorrelatorStub` + `RequestLifecycleStore`.
 *
 * The two sibling tests cover the layers in isolation:
 *   - `cdp-to-update.test.ts` — pure mapper shape per event.
 *   - `correlator.test.ts` — attach/subscribe/detach/dispose plumbing.
 *
 * This file is the seam-completeness assertion: the CDP correlator
 * must satisfy the SAME `RequestLifecycleStore` contract as the
 * heuristic correlator. Concretely, a canonical trace must reduce
 * cleanly (zero `onReject` calls) and land at the expected terminal
 * lifecycle. If the contract is over-fit to webRequest, one of these
 * traces will surface a rejection here.
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  RequestLifecycleUpdate,
} from '@openheaders/core/request-lifecycle';

import { CdpCorrelatorStub } from '../../src/correlator-cdp/correlator';
import type { CdpNetworkEvent } from '../../src/correlator-cdp/events';
import { RequestLifecycleStore } from '../../src/request-lifecycle-store/store';

import {
  cdpFailed,
  cdpFinished,
  cdpRedirect,
  cdpResponse,
  cdpStart,
  type TraceCtx,
} from './builders';
import { InMemoryCdpSource } from './in-memory-source';

interface Harness {
  readonly source: InMemoryCdpSource;
  readonly correlator: CdpCorrelatorStub;
  readonly store: RequestLifecycleStore;
  readonly onReject: ReturnType<typeof vi.fn>;
  readonly applied: RequestLifecycleUpdate[];
}

function harness(ctx: TraceCtx): Harness {
  const source = new InMemoryCdpSource();
  const correlator = new CdpCorrelatorStub(source);
  const onReject = vi.fn();
  const store = new RequestLifecycleStore({ onReject });
  const applied: RequestLifecycleUpdate[] = [];
  store.subscribe((u) => applied.push(u));
  correlator.subscribe((u) => store.apply(u));
  correlator.attachTab(ctx.tabId);
  return { source, correlator, store, onReject, applied };
}

function runTrace(h: Harness, trace: readonly CdpNetworkEvent[]): void {
  for (const event of trace) h.source.emit(event);
}

describe('CdpCorrelatorStub → RequestLifecycleStore — canonical success trace', () => {
  const CTX: TraceCtx = { tabId: 31, requestId: 'cdp-ok' };

  it('start → response → finished produces a completed lifecycle with zero reducer rejections', () => {
    const h = harness(CTX);
    runTrace(h, [cdpStart(CTX), cdpResponse(CTX), cdpFinished(CTX)]);

    const lc = h.store.get(CTX.tabId, CTX.requestId);
    expect(lc).toBeDefined();
    if (lc === undefined) return;
    expect(lc.phase).toBe('completed');
    expect(lc.statusCode).toBe(200);
    expect(lc.statusText).toBe('OK');
    expect(lc.completedAtMs).toBe(100_900);
    expect(lc.redirectHopCount).toBe(0);
    expect(lc.redirectHops).toEqual([]);
    expect(h.onReject).not.toHaveBeenCalled();
    // Applied stream: started → phase(headers-received) → phase(completed).
    expect(h.applied.map((u) => u.kind)).toEqual(['started', 'phase', 'phase']);

    h.correlator.dispose();
  });
});

describe('CdpCorrelatorStub → RequestLifecycleStore — single-redirect trace', () => {
  const CTX: TraceCtx = { tabId: 31, requestId: 'cdp-redir' };

  it('start → redirect-RWBS → response → finished collapses to one lifecycle with one hop', () => {
    const h = harness(CTX);
    runTrace(h, [
      cdpStart(CTX),
      cdpRedirect(
        CTX,
        { url: 'https://api.openheaders.io/users', status: 301, statusText: 'Moved Permanently' },
        'https://api.openheaders.io/v2/users',
      ),
      cdpResponse(CTX, {
        timestamp: 100.6,
        response: { url: 'https://api.openheaders.io/v2/users', status: 200, statusText: 'OK' },
      }),
      cdpFinished(CTX, { timestamp: 100.8 }),
    ]);

    const lc = h.store.get(CTX.tabId, CTX.requestId);
    expect(lc).toBeDefined();
    if (lc === undefined) return;
    expect(lc.url).toBe('https://api.openheaders.io/v2/users');
    expect(lc.phase).toBe('completed');
    expect(lc.statusCode).toBe(200);
    expect(lc.redirectHopCount).toBe(1);
    expect(lc.redirectHops).toHaveLength(1);
    expect(lc.redirectHops[0]?.sourceUrl).toBe('https://api.openheaders.io/users');
    expect(lc.redirectHops[0]?.redirectUrl).toBe('https://api.openheaders.io/v2/users');
    expect(lc.redirectHops[0]?.statusCode).toBe(301);
    expect(h.onReject).not.toHaveBeenCalled();
    // Applied stream: started → redirect → phase(headers-received) → phase(completed).
    expect(h.applied.map((u) => u.kind)).toEqual(['started', 'redirect', 'phase', 'phase']);

    h.correlator.dispose();
  });
});

describe('CdpCorrelatorStub → RequestLifecycleStore — multi-hop redirect trace', () => {
  const CTX: TraceCtx = { tabId: 31, requestId: 'cdp-multi' };

  it('two redirects produce two hops and preserve initiator', () => {
    const h = harness(CTX);
    runTrace(h, [
      cdpStart(CTX, { request: { url: 'https://api.openheaders.io/a', method: 'GET' } }),
      cdpRedirect(
        CTX,
        { url: 'https://api.openheaders.io/a', status: 302, statusText: 'Found' },
        'https://api.openheaders.io/b',
      ),
      cdpRedirect(
        CTX,
        { url: 'https://api.openheaders.io/b', status: 302, statusText: 'Found' },
        'https://api.openheaders.io/c',
        { timestamp: 100.2 },
      ),
      cdpResponse(CTX, {
        timestamp: 100.6,
        response: { url: 'https://api.openheaders.io/c', status: 200, statusText: 'OK' },
      }),
      cdpFinished(CTX, { timestamp: 100.8 }),
    ]);

    const lc = h.store.get(CTX.tabId, CTX.requestId);
    if (lc === undefined) throw new Error('expected lifecycle to be present');
    expect(lc.redirectHopCount).toBe(2);
    expect(lc.redirectHops.map((hop) => hop.sourceUrl)).toEqual([
      'https://api.openheaders.io/a',
      'https://api.openheaders.io/b',
    ]);
    expect(lc.url).toBe('https://api.openheaders.io/c');
    expect(lc.phase).toBe('completed');
    expect(lc.initiator).toBe('https://app.openheaders.io/');
    expect(h.onReject).not.toHaveBeenCalled();

    h.correlator.dispose();
  });
});

describe('CdpCorrelatorStub → RequestLifecycleStore — failure trace', () => {
  const CTX: TraceCtx = { tabId: 31, requestId: 'cdp-fail' };

  it('start → loadingFailed lands in a failed phase with a populated error', () => {
    const h = harness(CTX);
    runTrace(h, [
      cdpStart(CTX),
      cdpFailed(CTX, { errorText: 'net::ERR_CONNECTION_RESET', blockedReason: 'tls' }),
    ]);

    const lc = h.store.get(CTX.tabId, CTX.requestId);
    if (lc === undefined) throw new Error('expected lifecycle');
    expect(lc.phase).toBe('failed');
    expect(lc.error?.code).toBe('net::ERR_CONNECTION_RESET');
    expect(lc.error?.reason).toBe('tls');
    expect(lc.completedAtMs).toBe(100_700);
    expect(h.onReject).not.toHaveBeenCalled();
    expect(h.applied.map((u) => u.kind)).toEqual(['started', 'phase']);

    h.correlator.dispose();
  });
});

describe('CdpCorrelatorStub → RequestLifecycleStore — tab scoping', () => {
  it('detachTab stops further events for that tab from entering the store', () => {
    const CTX: TraceCtx = { tabId: 99, requestId: 'cdp-detached' };
    const h = harness(CTX);
    runTrace(h, [cdpStart(CTX)]);
    expect(h.store.get(CTX.tabId, CTX.requestId)).toBeDefined();

    h.correlator.detachTab(CTX.tabId);
    runTrace(h, [cdpResponse(CTX), cdpFinished(CTX)]);

    const lc = h.store.get(CTX.tabId, CTX.requestId);
    if (lc === undefined) throw new Error('expected lifecycle');
    // Phase did not advance because the events were ignored at the correlator.
    expect(lc.phase).toBe('pending');
    expect(h.onReject).not.toHaveBeenCalled();

    h.correlator.dispose();
  });
});
