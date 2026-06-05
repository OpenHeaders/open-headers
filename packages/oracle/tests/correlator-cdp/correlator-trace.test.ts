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

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import { describe, expect, it, vi } from 'vitest';

import { CdpCorrelator } from '../../src/correlator-cdp/correlator';
import { type CdpNetworkEvent, cdpStoreRequestId } from '../../src/correlator-cdp/events';
import { RequestLifecycleStore } from '../../src/request-lifecycle-store/store';

import { cdpFailed, cdpFinished, cdpRedirect, cdpResponse, cdpStart, PAGE_SESSION, type TraceCtx } from './builders';
import { InMemoryCdpSource } from './in-memory-source';

/** Store key the correlator emits for a trace context (child-session namespacing). */
const storeId = (ctx: TraceCtx): string => cdpStoreRequestId(ctx.sessionId ?? PAGE_SESSION, ctx.requestId);

interface Harness {
  readonly source: InMemoryCdpSource;
  readonly correlator: CdpCorrelator;
  readonly store: RequestLifecycleStore;
  readonly onReject: ReturnType<typeof vi.fn>;
  readonly applied: RequestLifecycleUpdate[];
}

function harness(ctx: TraceCtx): Harness {
  const source = new InMemoryCdpSource();
  const correlator = new CdpCorrelator(source);
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

    const lc = h.store.get(CTX.tabId, storeId(CTX));
    expect(lc).toBeDefined();
    if (lc === undefined) return;
    expect(lc.phase).toBe('completed');
    expect(lc.statusCode).toBe(200);
    expect(lc.statusText).toBe('OK');
    expect(lc.completedAtMs).toBe(100_900);
    expect(lc.redirectHopCount).toBe(0);
    expect(lc.redirectHops).toEqual([]);
    expect(h.onReject).not.toHaveBeenCalled();
    // Applied stream: started → phase(headers-received) + har-attached →
    // phase(completed) + refined har-attached. The builder emits a HAR at
    // responseReceived and refines it at loadingFinished.
    expect(h.applied.map((u) => u.kind)).toEqual(['started', 'phase', 'har-attached', 'phase', 'har-attached']);

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

    const lc = h.store.get(CTX.tabId, storeId(CTX));
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
    // Applied stream: started → redirect + har-attached(hop 0, synthesized
    // from redirectResponse) → phase(headers-received) + har-attached(hop 1)
    // → phase(completed) + refined har-attached(hop 1).
    expect(h.applied.map((u) => u.kind)).toEqual([
      'started',
      'redirect',
      'har-attached',
      'phase',
      'har-attached',
      'phase',
      'har-attached',
    ]);

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

    const lc = h.store.get(CTX.tabId, storeId(CTX));
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
    runTrace(h, [cdpStart(CTX), cdpFailed(CTX, { errorText: 'net::ERR_CONNECTION_RESET', blockedReason: 'tls' })]);

    const lc = h.store.get(CTX.tabId, storeId(CTX));
    if (lc === undefined) throw new Error('expected lifecycle');
    expect(lc.phase).toBe('failed');
    expect(lc.error?.code).toBe('net::ERR_CONNECTION_RESET');
    expect(lc.error?.reason).toBe('tls');
    expect(lc.completedAtMs).toBe(100_700);
    expect(h.onReject).not.toHaveBeenCalled();
    // A failed-before-response request still synthesizes a status-0 HAR entry
    // (Chrome parity), so a har-attached follows the phase update.
    expect(h.applied.map((u) => u.kind)).toEqual(['started', 'phase', 'har-attached']);
    expect(lc.har[0]?.response?.status).toBe(0);
    expect(lc.har[0]?.response?._error).toBe('net::ERR_CONNECTION_RESET');

    h.correlator.dispose();
  });
});

describe('CdpCorrelatorStub → RequestLifecycleStore — lazy body fetch round-trip', () => {
  const CTX: TraceCtx = { tabId: 31, requestId: 'cdp-body' };

  it('fetched body lands in harBodyByHop at the current hop with zero rejections', async () => {
    const h = harness(CTX);
    runTrace(h, [cdpStart(CTX), cdpResponse(CTX), cdpFinished(CTX)]);
    h.source.bodyResponder = () => Promise.resolve({ body: '{"users":[]}', base64Encoded: false });

    await h.correlator.requestBody(CTX.tabId, storeId(CTX), 0);

    // The fetch resolved the raw CDP identity off the builder's ref.
    expect(h.source.bodyCalls).toEqual([{ tabId: CTX.tabId, sessionId: PAGE_SESSION, rawRequestId: CTX.requestId }]);
    const lc = h.store.get(CTX.tabId, storeId(CTX));
    if (lc === undefined) throw new Error('expected lifecycle');
    expect(lc.harBodyByHop[0]?.content).toBe('{"users":[]}');
    expect(lc.harBodyByHop[0]?.encoding).toBe('');
    // body-attached is a legal refinement — the reducer never rejects it.
    expect(h.onReject).not.toHaveBeenCalled();

    h.correlator.dispose();
  });

  it('a seam rejection lands an empty body so the slot stops reading "loading"', async () => {
    const h = harness(CTX);
    runTrace(h, [cdpStart(CTX), cdpResponse(CTX), cdpFinished(CTX)]);
    h.source.bodyResponder = () => Promise.reject(new Error('No resource with given identifier found'));

    await h.correlator.requestBody(CTX.tabId, storeId(CTX), 0);

    const lc = h.store.get(CTX.tabId, storeId(CTX));
    if (lc === undefined) throw new Error('expected lifecycle');
    expect(lc.harBodyByHop[0]).toBeDefined();
    expect(lc.harBodyByHop[0]?.content).toBe('');
    expect(h.onReject).not.toHaveBeenCalled();

    h.correlator.dispose();
  });
});

describe('CdpCorrelatorStub → RequestLifecycleStore — tab scoping', () => {
  it('detachTab stops further events for that tab from entering the store', () => {
    const CTX: TraceCtx = { tabId: 99, requestId: 'cdp-detached' };
    const h = harness(CTX);
    runTrace(h, [cdpStart(CTX)]);
    expect(h.store.get(CTX.tabId, storeId(CTX))).toBeDefined();

    h.correlator.detachTab(CTX.tabId);
    runTrace(h, [cdpResponse(CTX), cdpFinished(CTX)]);

    const lc = h.store.get(CTX.tabId, storeId(CTX));
    if (lc === undefined) throw new Error('expected lifecycle');
    // Phase did not advance because the events were ignored at the correlator.
    expect(lc.phase).toBe('pending');
    expect(h.onReject).not.toHaveBeenCalled();

    h.correlator.dispose();
  });
});
