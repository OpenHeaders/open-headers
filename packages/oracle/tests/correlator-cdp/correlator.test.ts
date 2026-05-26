/**
 * K2 + K4 — `CdpCorrelatorStub` driven by an in-memory event source +
 * the `fromChromeDebugger` factory throws `NotImplementedError`.
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  RequestLifecycleListener,
  RequestLifecycleUpdate,
} from '@openheaders/core/request-lifecycle';

import {
  CdpCorrelatorStub,
  NotImplementedError,
} from '../../src/correlator-cdp/correlator';
import type { CdpNetworkEvent } from '../../src/correlator-cdp/events';

import { InMemoryCdpSource } from './in-memory-source';

const TAB = 11;

const startEvent: CdpNetworkEvent = {
  method: 'Network.requestWillBeSent',
  tabId: TAB,
  requestId: 'r-1',
  loaderId: 'L1',
  documentURL: 'https://app.openheaders.io/',
  request: { url: 'https://api.openheaders.io/x', method: 'GET' },
  timestamp: 1,
  wallTime: 1_700_000_000,
  type: 'XHR',
};

describe('CdpCorrelatorStub — production-instantiation guard (K4)', () => {
  it('fromChromeDebugger throws NotImplementedError', () => {
    expect(() => CdpCorrelatorStub.fromChromeDebugger()).toThrowError(NotImplementedError);
  });
});

describe('CdpCorrelatorStub — attach / subscribe / emit (K2)', () => {
  it('does not emit before any tab is attached', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelatorStub(source);
    const listener: RequestLifecycleListener = vi.fn();
    correlator.subscribe(listener);
    source.emit(startEvent);
    expect(listener).not.toHaveBeenCalled();
    correlator.dispose();
  });

  it('emits the mapped update for an attached tab', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelatorStub(source);
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    source.emit(startEvent);
    expect(collected).toHaveLength(1);
    expect(collected[0]?.kind).toBe('started');
    correlator.dispose();
  });

  it('detachTab stops further emissions for that tab', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelatorStub(source);
    const fn = vi.fn();
    correlator.subscribe(fn);
    correlator.attachTab(TAB);
    source.emit(startEvent);
    correlator.detachTab(TAB);
    source.emit({ ...startEvent, requestId: 'r-2' });
    expect(fn).toHaveBeenCalledTimes(1);
    correlator.dispose();
  });

  it('dispose unsubscribes from the source and clears state', () => {
    const source = new InMemoryCdpSource();
    const correlator = new CdpCorrelatorStub(source);
    const fn = vi.fn();
    correlator.subscribe(fn);
    correlator.attachTab(TAB);
    correlator.dispose();
    source.emit(startEvent);
    expect(fn).not.toHaveBeenCalled();
  });
});
