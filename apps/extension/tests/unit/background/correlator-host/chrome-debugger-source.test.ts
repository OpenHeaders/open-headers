/**
 * `ChromeDebuggerEventSource` — the SW-side `chrome.debugger` adapter that
 * backs the oracle's `CdpEventSource` seam (Slice 2).
 *
 * Coverage:
 *   - normalize `onEvent` → `CdpNetworkEvent` for all four variants with
 *     the HAR fields the builder reads populated;
 *   - B1: a two-session page + OOPIF trace routes by `sessionId`;
 *   - the `iframe`/`worker` target-type filter (service-worker children
 *     are not enabled and their events are dropped);
 *   - `onDetach` propagation + state teardown;
 *   - attach idempotency + tolerance of chrome errors;
 *   - inert without `chrome.debugger`;
 *   - end-to-end into a real `CdpCorrelator` + `RequestLifecycleStore`:
 *     the OOPIF trace lands rows under distinct session-namespaced ids
 *     with zero reducer rejections.
 */

import type { CdpNetworkEvent } from '@openheaders/oracle/correlator-cdp';
import { CdpCorrelator, cdpStoreRequestId } from '@openheaders/oracle/correlator-cdp';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChromeDebuggerEventSource } from '@/background/correlator-host/chrome-debugger-source';
import { chrome as chromeMock } from '../../../__mocks__/chrome';

const TAB = 5;
const CHILD_SESSION = 'child-iframe-1';

// ── raw CDP param builders ───────────────────────────────────────────

function rawRequestWillBeSent(requestId: string, url: string, overrides: Record<string, unknown> = {}): object {
  return {
    requestId,
    loaderId: 'L1',
    documentURL: 'https://app.openheaders.io/',
    request: { url, method: 'GET', headers: { Accept: '*/*' } },
    timestamp: 100,
    wallTime: 1_700_000_000,
    initiator: { type: 'parser', url: 'https://app.openheaders.io/' },
    type: 'XHR',
    ...overrides,
  };
}

function rawResponseReceived(requestId: string, url: string): object {
  return {
    requestId,
    timestamp: 100.5,
    type: 'XHR',
    response: {
      url,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      mimeType: 'application/json',
      remoteIPAddress: '93.184.216.34',
      protocol: 'h2',
      timing: { requestTime: 100, sendStart: 1, sendEnd: 2, receiveHeadersEnd: 5 },
    },
  };
}

function rawLoadingFinished(requestId: string): object {
  return { requestId, timestamp: 100.9, encodedDataLength: 2048 };
}

function rawLoadingFailed(requestId: string): object {
  return { requestId, timestamp: 100.7, type: 'XHR', errorText: 'net::ERR_FAILED', canceled: false };
}

function attachedToTarget(sessionId: string, type: string): object {
  return {
    sessionId,
    targetInfo: { type, targetId: `${type}-target`, title: '', url: 'https://widgets.openheaders.io/', attached: true },
    waitingForDebugger: false,
  };
}

/** Drive an event on the root (page) session. */
function emitRoot(method: string, params: object): void {
  chromeMock.debugger.emitEvent({ tabId: TAB }, method, params);
}

/** Drive an event on a flattened child session. */
function emitChild(sessionId: string, method: string, params: object): void {
  chromeMock.debugger.emitEvent({ tabId: TAB, sessionId }, method, params);
}

let source: ChromeDebuggerEventSource;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  source?.dispose();
});

describe('ChromeDebuggerEventSource — normalize onEvent → CdpNetworkEvent', () => {
  it('normalizes all four Network variants on the page session with HAR fields', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Network.requestWillBeSent', rawRequestWillBeSent('r-1', 'https://api.openheaders.io/users'));
    emitRoot('Network.responseReceived', rawResponseReceived('r-1', 'https://api.openheaders.io/users'));
    emitRoot('Network.loadingFinished', rawLoadingFinished('r-1'));

    expect(out).toHaveLength(3);

    const [started, response, finished] = out;
    expect(started).toMatchObject({
      method: 'Network.requestWillBeSent',
      tabId: TAB,
      sessionId: 'page',
      requestId: 'r-1',
      request: { url: 'https://api.openheaders.io/users', method: 'GET' },
      wallTime: 1_700_000_000,
      initiator: { type: 'parser', url: 'https://app.openheaders.io/' },
    });
    expect(response).toMatchObject({
      method: 'Network.responseReceived',
      sessionId: 'page',
      response: {
        status: 200,
        remoteIPAddress: '93.184.216.34',
        protocol: 'h2',
        mimeType: 'application/json',
        timing: { requestTime: 100, receiveHeadersEnd: 5 },
      },
    });
    expect(finished).toMatchObject({
      method: 'Network.loadingFinished',
      sessionId: 'page',
      encodedDataLength: 2048,
    });
  });

  it('normalizes loadingFailed with canceled + blockedReason pass-through', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Network.requestWillBeSent', rawRequestWillBeSent('r-2', 'https://api.openheaders.io/x'));
    emitRoot('Network.loadingFailed', { ...rawLoadingFailed('r-2'), blockedReason: 'mixed-content' });

    const failed = out.at(-1);
    expect(failed).toMatchObject({
      method: 'Network.loadingFailed',
      errorText: 'net::ERR_FAILED',
      canceled: false,
      blockedReason: 'mixed-content',
    });
  });

  it('clamps an unknown initiator type onto the oracle union', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot(
      'Network.requestWillBeSent',
      rawRequestWillBeSent('r-3', 'https://api.openheaders.io/y', { initiator: { type: 'made-up' } }),
    );
    const started = out[0];
    expect(started?.method).toBe('Network.requestWillBeSent');
    if (started?.method !== 'Network.requestWillBeSent') return;
    expect(started.initiator?.type).toBe('other');
  });

  it('drops events for tabs that were never attached', () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));

    emitRoot('Network.requestWillBeSent', rawRequestWillBeSent('r-x', 'https://api.openheaders.io/x'));
    expect(out).toHaveLength(0);
  });
});

describe('ChromeDebuggerEventSource — attach handshake + child sessions (B1)', () => {
  it('attach runs Network.enable then Target.setAutoAttach{flatten} on the page target', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);

    expect(chromeMock.debugger.attach).toHaveBeenCalledWith({ tabId: TAB }, '1.3');
    const methods = chromeMock.debugger.sendCommand.mock.calls.map((c) => c[1]);
    expect(methods).toContain('Network.enable');
    expect(methods).toContain('Target.setAutoAttach');
    const autoAttachCall = chromeMock.debugger.sendCommand.mock.calls.find((c) => c[1] === 'Target.setAutoAttach');
    expect(autoAttachCall?.[2]).toMatchObject({ autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  });

  it('routes a page + OOPIF trace by sessionId; enables Network on the iframe child', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    // The child gets its own Network.enable + recursive auto-attach.
    const childEnable = chromeMock.debugger.sendCommand.mock.calls.find(
      (c) => c[1] === 'Network.enable' && (c[0] as chrome.debugger.DebuggerSession).sessionId === CHILD_SESSION,
    );
    expect(childEnable).toBeDefined();

    emitRoot('Network.requestWillBeSent', rawRequestWillBeSent('r-1', 'https://app.openheaders.io/main'));
    emitChild(
      CHILD_SESSION,
      'Network.requestWillBeSent',
      rawRequestWillBeSent('r-1', 'https://widgets.openheaders.io/chart'),
    );

    expect(out).toHaveLength(2);
    expect(out[0]?.sessionId).toBe('page');
    expect(out[1]?.sessionId).toBe(CHILD_SESSION);
    // Same CDP requestId on two sessions — distinct rows by sessionId.
    expect(out[0]?.requestId).toBe('r-1');
    expect(out[1]?.requestId).toBe('r-1');
  });

  it('does not enable Network on a service_worker child and drops its events (filter)', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget('sw-session', 'service_worker'));
    const swEnable = chromeMock.debugger.sendCommand.mock.calls.find(
      (c) => (c[0] as chrome.debugger.DebuggerSession).sessionId === 'sw-session',
    );
    expect(swEnable).toBeUndefined();

    emitChild(
      'sw-session',
      'Network.requestWillBeSent',
      rawRequestWillBeSent('sw-1', 'https://api.openheaders.io/sync'),
    );
    expect(out).toHaveLength(0);
  });

  it('drops child events after Target.detachedFromTarget', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitRoot('Target.detachedFromTarget', { sessionId: CHILD_SESSION });
    emitChild(
      CHILD_SESSION,
      'Network.requestWillBeSent',
      rawRequestWillBeSent('r-9', 'https://widgets.openheaders.io/x'),
    );

    expect(out).toHaveLength(0);
  });
});

describe('ChromeDebuggerEventSource — onDetach + lifecycle', () => {
  it('propagates onDetach with (tabId, reason) and stops routing that tab', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    const detaches: Array<[number, string]> = [];
    source.subscribe((e) => out.push(e));
    source.onDetach((tabId, reason) => detaches.push([tabId, reason]));
    await source.attach(TAB);

    chromeMock.debugger.emitDetach({ tabId: TAB }, 'canceled_by_user');
    expect(detaches).toEqual([[TAB, 'canceled_by_user']]);

    emitRoot('Network.requestWillBeSent', rawRequestWillBeSent('r-after', 'https://api.openheaders.io/x'));
    expect(out).toHaveLength(0);
  });

  it('attach is idempotent — a second attach for a live tab is a no-op', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    await source.attach(TAB);
    expect(chromeMock.debugger.attach).toHaveBeenCalledTimes(1);
  });

  it('tolerates an "already attached" attach error and still enables Network', async () => {
    source = new ChromeDebuggerEventSource();
    chromeMock.debugger.attach.mockRejectedValueOnce(
      new Error('Another debugger is already attached to the tab with id: 5'),
    );
    await source.attach(TAB);
    const methods = chromeMock.debugger.sendCommand.mock.calls.map((c) => c[1]);
    expect(methods).toContain('Network.enable');
  });

  it('rejects on an unexpected attach error without enabling Network', async () => {
    source = new ChromeDebuggerEventSource();
    chromeMock.debugger.attach.mockRejectedValueOnce(new Error('No tab with given id 5'));
    // The failure propagates so the reconciler leaves the tab
    // heuristic-owned instead of marking it CDP-owned with no session.
    await expect(source.attach(TAB)).rejects.toThrow('No tab with given id 5');
    expect(chromeMock.debugger.sendCommand).not.toHaveBeenCalled();
  });

  it('detach issues Network.disable then chrome.debugger.detach', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    await source.detach(TAB);
    const methods = chromeMock.debugger.sendCommand.mock.calls.map((c) => c[1]);
    expect(methods).toContain('Network.disable');
    expect(chromeMock.debugger.detach).toHaveBeenCalledWith({ tabId: TAB });
  });
});

describe('ChromeDebuggerEventSource — inert without chrome.debugger', () => {
  it('construction + attach are no-ops when the namespace is absent', async () => {
    vi.stubGlobal('chrome', { ...chromeMock, debugger: undefined });
    try {
      const inert = new ChromeDebuggerEventSource();
      const out: CdpNetworkEvent[] = [];
      inert.subscribe((e) => out.push(e));
      await expect(inert.attach(TAB)).resolves.toBeUndefined();
      expect(out).toHaveLength(0);
      inert.dispose();
    } finally {
      vi.stubGlobal('chrome', chromeMock);
    }
  });
});

describe('ChromeDebuggerEventSource → CdpCorrelator → RequestLifecycleStore (B1 end-to-end)', () => {
  it('page + OOPIF traces with a shared requestId land as two distinct rows, zero rejects', async () => {
    source = new ChromeDebuggerEventSource();
    const onReject = vi.fn();
    const store = new RequestLifecycleStore({ onReject });
    const correlator = new CdpCorrelator(source);
    correlator.subscribe((u) => store.apply(u));
    correlator.attachTab(TAB);
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));

    // Page trace (session 'page').
    emitRoot('Network.requestWillBeSent', rawRequestWillBeSent('r-1', 'https://app.openheaders.io/main.js'));
    emitRoot('Network.responseReceived', rawResponseReceived('r-1', 'https://app.openheaders.io/main.js'));
    emitRoot('Network.loadingFinished', rawLoadingFinished('r-1'));

    // OOPIF trace — SAME CDP requestId, different session.
    emitChild(
      CHILD_SESSION,
      'Network.requestWillBeSent',
      rawRequestWillBeSent('r-1', 'https://widgets.openheaders.io/chart-data'),
    );
    emitChild(
      CHILD_SESSION,
      'Network.responseReceived',
      rawResponseReceived('r-1', 'https://widgets.openheaders.io/chart-data'),
    );
    emitChild(CHILD_SESSION, 'Network.loadingFinished', rawLoadingFinished('r-1'));

    const pageRow = store.get(TAB, cdpStoreRequestId('page', 'r-1'));
    const iframeRow = store.get(TAB, cdpStoreRequestId(CHILD_SESSION, 'r-1'));

    expect(onReject).not.toHaveBeenCalled();
    expect(pageRow?.url).toBe('https://app.openheaders.io/main.js');
    expect(iframeRow?.url).toBe('https://widgets.openheaders.io/chart-data');
    expect(pageRow?.phase).toBe('completed');
    expect(iframeRow?.phase).toBe('completed');
    // Both rows carry synthesized HAR (rich columns populate under CDP).
    expect(pageRow?.har[0]?.response?.status).toBe(200);
    expect(iframeRow?.har[0]?.response?._transferSize).toBe(2048);

    correlator.dispose();
  });
});
