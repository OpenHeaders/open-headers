/**
 * `CdpCorrelator` driven by an in-memory event source — attach /
 * subscribe / detach / dispose plumbing.
 */

import type { RequestLifecycleListener, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import { describe, expect, it, vi } from 'vitest';

import { CdpCorrelator } from '../../src/correlator-cdp/correlator';
import type { CdpNetworkEvent } from '../../src/correlator-cdp/events';

import { InMemoryCdpSource } from './in-memory-source';

const TAB = 11;

const startEvent: CdpNetworkEvent = {
  method: 'Network.requestWillBeSent',
  tabId: TAB,
  sessionId: 'session-page',
  requestId: 'r-1',
  loaderId: 'L1',
  documentURL: 'https://app.openheaders.io/',
  request: { url: 'https://api.openheaders.io/x', method: 'GET' },
  timestamp: 1,
  wallTime: 1_700_000_000,
  type: 'XHR',
};

describe('CdpCorrelator — attach / subscribe / emit', () => {
  it('does not emit before any tab is attached', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelator(source);
    const listener: RequestLifecycleListener = vi.fn();
    correlator.subscribe(listener);
    source.emit(startEvent);
    expect(listener).not.toHaveBeenCalled();
    correlator.dispose();
  });

  it('emits the mapped update for an attached tab', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelator(source);
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    source.emit(startEvent);
    // `started` (lifecycle spine) is followed by the builder's request-header
    // patch — the current hop's cooked/provisional set, surfaced before any HAR.
    expect(collected).toHaveLength(2);
    expect(collected[0]?.kind).toBe('started');
    expect(collected[1]).toMatchObject({ kind: 'phase', patch: { requestHeadersProvisional: true } });
    correlator.dispose();
  });

  it('detachTab stops further emissions for that tab', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelator(source);
    const fn = vi.fn();
    correlator.subscribe(fn);
    correlator.attachTab(TAB);
    source.emit(startEvent);
    correlator.detachTab(TAB);
    source.emit({ ...startEvent, requestId: 'r-2' });
    // One `requestWillBeSent` emits two updates (`started` + request headers);
    // after detach the second event emits nothing.
    expect(fn).toHaveBeenCalledTimes(2);
    correlator.dispose();
  });

  it('dispose unsubscribes from the source and clears state', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelator(source);
    const fn = vi.fn();
    correlator.subscribe(fn);
    correlator.attachTab(TAB);
    correlator.dispose();
    source.emit(startEvent);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('CdpCorrelator — requestBody (lazy on-demand body fetch)', () => {
  const STORE_ID = 'session-page::r-1';

  function attachedWithRequest() {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelator(source);
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    // requestWillBeSent records the body ref the fetch resolves against.
    source.emit(startEvent);
    return { source, correlator, collected };
  }

  function bodyAttached(updates: RequestLifecycleUpdate[]) {
    return updates.find((u) => u.kind === 'body-attached');
  }

  it('resolves the raw (sessionId, rawRequestId) and emits body-attached at the hop', async () => {
    const { source, correlator, collected } = attachedWithRequest();
    source.bodyResponder = () => Promise.resolve({ body: '{"ok":true}', base64Encoded: false });
    await correlator.requestBody(TAB, STORE_ID, 0);
    expect(source.bodyCalls).toEqual([{ tabId: TAB, sessionId: 'session-page', rawRequestId: 'r-1' }]);
    const body = bodyAttached(collected);
    expect(body).toMatchObject({ kind: 'body-attached', tabId: TAB, requestId: STORE_ID, hopIndex: 0 });
    if (body?.kind === 'body-attached') {
      expect(body.body.content).toBe('{"ok":true}');
      expect(body.body.encoding).toBe('');
    }
    correlator.dispose();
  });

  it('maps a base64 body through to encoding base64', async () => {
    const { source, correlator, collected } = attachedWithRequest();
    source.bodyResponder = () => Promise.resolve({ body: 'AQID', base64Encoded: true });
    await correlator.requestBody(TAB, STORE_ID, 0);
    const body = bodyAttached(collected);
    if (body?.kind === 'body-attached') expect(body.body.encoding).toBe('base64');
    correlator.dispose();
  });

  it('emits an empty body when the seam rejects (host evicted the body)', async () => {
    const { source, correlator, collected } = attachedWithRequest();
    source.bodyResponder = () => Promise.reject(new Error('No resource with given identifier found'));
    await correlator.requestBody(TAB, STORE_ID, 0);
    const body = bodyAttached(collected);
    expect(body?.kind).toBe('body-attached');
    if (body?.kind === 'body-attached') expect(body.body.content).toBe('');
    correlator.dispose();
  });

  it('emits an empty body for an unknown request id without hitting the seam', async () => {
    const { source, correlator, collected } = attachedWithRequest();
    await correlator.requestBody(TAB, 'session-page::missing', 0);
    expect(source.bodyCalls).toHaveLength(0);
    const body = bodyAttached(collected);
    expect(body?.kind).toBe('body-attached');
    if (body?.kind === 'body-attached') expect(body.body.content).toBe('');
    correlator.dispose();
  });

  it('is a no-op for a tab not attached to this correlator', async () => {
    const { source, correlator, collected } = attachedWithRequest();
    correlator.detachTab(TAB);
    await correlator.requestBody(TAB, STORE_ID, 0);
    expect(source.bodyCalls).toHaveLength(0);
    expect(bodyAttached(collected)).toBeUndefined();
    correlator.dispose();
  });
});
