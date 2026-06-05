/**
 * K1 + K3 — CDP event trace → expected `RequestLifecycleUpdate`s.
 *
 * The trace below is the canonical "request, single redirect, response,
 * finished" sequence. The store does not run here; we assert the
 * mapper's shape directly.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { describe, expect, it } from 'vitest';

import { cdpEventToUpdates } from '../../src/correlator-cdp/cdp-to-update';
import type {
  CdpLoadingFailed,
  CdpLoadingFinished,
  CdpRequestWillBeSent,
  CdpResponseReceived,
} from '../../src/correlator-cdp/events';

const TAB = 7;

const initialRequest: CdpRequestWillBeSent = {
  method: 'Network.requestWillBeSent',
  tabId: TAB,
  sessionId: 'session-page',
  requestId: 'cdp-1',
  loaderId: 'L1',
  documentURL: 'https://app.openheaders.io/',
  request: { url: 'https://api.openheaders.io/users', method: 'GET' },
  timestamp: 100.5,
  wallTime: 1_700_000_000.25,
  initiator: { type: 'parser', url: 'https://app.openheaders.io/' },
  type: 'XHR',
};

const redirectStart: CdpRequestWillBeSent = {
  ...initialRequest,
  request: { url: 'https://api.openheaders.io/v2/users', method: 'GET' },
  timestamp: 100.6,
  redirectResponse: {
    url: 'https://api.openheaders.io/users',
    status: 301,
    statusText: 'Moved Permanently',
  },
};

const responseReceived: CdpResponseReceived = {
  method: 'Network.responseReceived',
  tabId: TAB,
  sessionId: 'session-page',
  requestId: 'cdp-1',
  timestamp: 100.8,
  type: 'XHR',
  response: { url: 'https://api.openheaders.io/v2/users', status: 200, statusText: 'OK' },
};

const loadingFinished: CdpLoadingFinished = {
  method: 'Network.loadingFinished',
  tabId: TAB,
  sessionId: 'session-page',
  requestId: 'cdp-1',
  timestamp: 100.9,
  encodedDataLength: 1024,
};

describe('cdpEventToUpdates — canonical redirect + completion trace', () => {
  it('first requestWillBeSent → started update', () => {
    const updates = cdpEventToUpdates(initialRequest);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u?.kind).toBe('started');
    if (u?.kind !== 'started') return;
    expect(u.lifecycle.tabId).toBe(TAB);
    expect(u.lifecycle.requestId).toBe('cdp-1');
    expect(u.lifecycle.url).toBe('https://api.openheaders.io/users');
    expect(u.lifecycle.phase).toBe('pending');
    expect(u.lifecycle.redirectHopCount).toBe(0);
    expect(u.lifecycle.startedAtMs).toBe(1_700_000_000_250);
    expect(u.lifecycle.initiator).toBe('https://app.openheaders.io/');
  });

  it('requestWillBeSent with redirectResponse → redirect update (not started)', () => {
    const updates = cdpEventToUpdates(redirectStart);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u?.kind).toBe('redirect');
    if (u?.kind !== 'redirect') return;
    expect(u.tabId).toBe(TAB);
    expect(u.requestId).toBe('cdp-1');
    expect(u.hop.sourceUrl).toBe('https://api.openheaders.io/users');
    expect(u.hop.redirectUrl).toBe('https://api.openheaders.io/v2/users');
    expect(u.hop.statusCode).toBe(301);
    expect(u.hop.timestampMs).toBe(100_600);
    expect(u.nextUrl).toBe('https://api.openheaders.io/v2/users');
  });

  it('responseReceived → phase: headers-received with status', () => {
    const updates = cdpEventToUpdates(responseReceived);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u?.kind).toBe('phase');
    if (u?.kind !== 'phase') return;
    expect(u.patch.phase).toBe('headers-received');
    expect(u.patch.statusCode).toBe(200);
    expect(u.patch.statusText).toBe('OK');
  });

  it('loadingFinished → phase: completed with completedAtMs', () => {
    const updates = cdpEventToUpdates(loadingFinished);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u?.kind).toBe('phase');
    if (u?.kind !== 'phase') return;
    expect(u.patch.phase).toBe('completed');
    expect(u.patch.completedAtMs).toBe(100_900);
  });

  it('loadingFailed → phase: failed with refined error', () => {
    const failed: CdpLoadingFailed = {
      method: 'Network.loadingFailed',
      tabId: TAB,
      sessionId: 'session-page',
      requestId: 'cdp-1',
      timestamp: 100.9,
      type: 'XHR',
      errorText: 'net::ERR_FAILED',
      blockedReason: 'mixed-content',
    };
    const updates = cdpEventToUpdates(failed);
    expect(updates).toHaveLength(1);
    const u = updates[0];
    expect(u?.kind).toBe('phase');
    if (u?.kind !== 'phase') return;
    expect(u.patch.phase).toBe('failed');
    expect(u.patch.error?.code).toBe('net::ERR_FAILED');
    expect(u.patch.error?.reason).toBe('mixed-content');
  });
});

describe('cdpEventToUpdates — full trace produces a coherent update stream', () => {
  // Walk the canonical CDP sequence through the mapper and assert the
  // emitted updates form a legal stream (kind ordering + identity
  // preservation). The store reducer is exercised separately.
  it('start → redirect → headers-received → completed produces a coherent path', () => {
    const trace = [initialRequest, redirectStart, responseReceived, loadingFinished];
    const updates = trace.flatMap((e) => cdpEventToUpdates(e));
    expect(updates.map((u) => u.kind)).toEqual(['started', 'redirect', 'phase', 'phase']);
    // The mapper preserves identity across the whole trace.
    const tabAndIds = updates.map((u) => {
      if (u.kind === 'started') return [u.lifecycle.tabId, u.lifecycle.requestId];
      return [u.tabId, u.requestId];
    });
    for (const [tabId, requestId] of tabAndIds) {
      expect(tabId).toBe(TAB);
      expect(requestId).toBe('cdp-1');
    }
  });

  // Pre-empt drift: the started lifecycle's type is the one the store
  // will reduce against, so its shape must satisfy `RequestLifecycle`.
  it('emitted started lifecycle satisfies the RequestLifecycle shape (compile-time)', () => {
    const updates = cdpEventToUpdates(initialRequest);
    const u = updates[0];
    if (u?.kind !== 'started') throw new Error('expected started');
    const lc: RequestLifecycle = u.lifecycle;
    expect(lc.har.length).toBe(0);
    expect(lc.harBodyByHop.length).toBe(0);
  });
});
