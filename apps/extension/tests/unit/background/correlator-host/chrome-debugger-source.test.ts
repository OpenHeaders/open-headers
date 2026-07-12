/**
 * `ChromeDebuggerEventSource` — the SW-side `chrome.debugger` adapter that
 * backs the oracle's `CdpEventSource` seam (Slice 2).
 *
 * Coverage:
 *   - normalize `onEvent` → `CdpNetworkEvent` for the four base variants
 *     with the HAR fields the builder reads populated, plus the two
 *     `*ExtraInfo` on-the-wire header variants;
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

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import type { CdpFetchEvent, CdpNetworkEvent, CdpPageEvent } from '@openheaders/oracle/correlator-cdp';
import { CdpCorrelator, cdpStoreRequestId } from '@openheaders/oracle/correlator-cdp';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { OH_BINDING } from '@openheaders/rule-engine/content-scripts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type CdpBindingFire,
  type CdpJsContextEvent,
  ChromeDebuggerEventSource,
} from '@/background/correlator-host/chrome-debugger-source';
import { clearMainFrameId, isMainFrame } from '@/background/correlator-host/main-frame-registry';
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
      headers: { 'content-type': 'application/json; charset=utf-8' },
      mimeType: 'application/json',
      charset: 'utf-8',
      remoteIPAddress: '93.184.216.34',
      protocol: 'h2',
      timing: { requestTime: 100, sendStart: 1, sendEnd: 2, receiveHeadersEnd: 5 },
    },
  };
}

function rawDataReceived(requestId: string, dataLength: number): object {
  return { requestId, timestamp: 100.6, dataLength, encodedDataLength: Math.round(dataLength / 3) };
}

function rawLoadingFinished(requestId: string): object {
  return { requestId, timestamp: 100.9, encodedDataLength: 2048 };
}

function rawRequestWillBeSentExtraInfo(requestId: string, headers: Record<string, string>): object {
  // CDP carries associatedCookies / connectTiming alongside the headers;
  // the adapter reads only requestId + headers.
  return { requestId, associatedCookies: [], headers, connectTiming: { requestTime: 100 } };
}

function rawResponseReceivedExtraInfo(requestId: string, headers: Record<string, string>): object {
  // CDP also carries blockedCookies / statusCode / headersText; only the
  // headers are part of the consumed subset.
  return { requestId, blockedCookies: [], headers, statusCode: 200 };
}

function rawLoadingFailed(requestId: string): object {
  return { requestId, timestamp: 100.7, type: 'XHR', errorText: 'net::ERR_FAILED', canceled: false };
}

function rawRequestPaused(requestId: string, url: string, overrides: Record<string, unknown> = {}): object {
  // CDP carries responseErrorReason / responseHeaders / authChallenge too;
  // the adapter reads only the request-stage subset.
  return {
    requestId,
    request: { url, method: 'GET', headers: { Accept: '*/*' } },
    frameId: 'F1',
    resourceType: 'Document',
    networkId: 'net-1',
    ...overrides,
  };
}

function rawAuthRequired(requestId: string, url: string, overrides: Record<string, unknown> = {}): object {
  return {
    requestId,
    request: { url, method: 'GET', headers: { Accept: '*/*' } },
    frameId: 'F1',
    resourceType: 'Document',
    authChallenge: { source: 'Proxy', origin: 'https://proxy.openheaders.io', scheme: 'basic', realm: 'staging' },
    ...overrides,
  };
}

function rawBindingCalled(payload: unknown, name: string = OH_BINDING): object {
  // CDP carries executionContextId too; the adapter reads only name + payload.
  return { name, payload: typeof payload === 'string' ? payload : JSON.stringify(payload), executionContextId: 7 };
}

function rawConsoleApiCalled(type: string, args: object[], overrides: Record<string, unknown> = {}): object {
  // CDP carries executionContextId / stackTrace too; the normalizer reads the
  // type, args, timestamp, and (optionally) the stack's top frame.
  return { type, args, executionContextId: 1, timestamp: 1700, ...overrides };
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
        charset: 'utf-8',
        timing: { requestTime: 100, receiveHeadersEnd: 5 },
      },
    });
    expect(finished).toMatchObject({
      method: 'Network.loadingFinished',
      sessionId: 'page',
      encodedDataLength: 2048,
    });
  });

  it('normalizes initialPriority, remotePort, and connectionId for the HAR per-entry fields', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot(
      'Network.requestWillBeSent',
      rawRequestWillBeSent('r-p', 'https://api.openheaders.io/users', {
        request: { url: 'https://api.openheaders.io/users', method: 'GET', initialPriority: 'VeryHigh' },
      }),
    );
    emitRoot('Network.responseReceived', {
      requestId: 'r-p',
      timestamp: 100.5,
      type: 'XHR',
      response: {
        url: 'https://api.openheaders.io/users',
        status: 200,
        statusText: 'OK',
        remoteIPAddress: '93.184.216.34',
        remotePort: 443,
        connectionId: 17,
      },
    });

    const started = out[0];
    if (started?.method !== 'Network.requestWillBeSent') throw new Error('expected requestWillBeSent');
    expect(started.request.initialPriority).toBe('VeryHigh');

    const response = out.at(-1);
    expect(response).toMatchObject({
      method: 'Network.responseReceived',
      response: { remotePort: 443, connectionId: 17 },
    });
  });

  it('normalizes dataReceived (decoded chunk size) and request postData through', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot(
      'Network.requestWillBeSent',
      rawRequestWillBeSent('r-d', 'https://api.openheaders.io/users', {
        request: {
          url: 'https://api.openheaders.io/users',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          hasPostData: true,
          postData: '{"name":"core"}',
        },
      }),
    );
    emitRoot('Network.dataReceived', rawDataReceived('r-d', 3000));

    const started = out[0];
    if (started?.method !== 'Network.requestWillBeSent') throw new Error('expected requestWillBeSent');
    expect(started.request.postData).toBe('{"name":"core"}');

    const data = out.at(-1);
    expect(data).toMatchObject({
      method: 'Network.dataReceived',
      tabId: TAB,
      sessionId: 'page',
      requestId: 'r-d',
      dataLength: 3000,
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

  it('normalizes the initiator call-frame stack through to the oracle event', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot(
      'Network.requestWillBeSent',
      rawRequestWillBeSent('r-s', 'https://api.openheaders.io/z', {
        initiator: {
          type: 'script',
          url: 'https://app.openheaders.io/main.js',
          lineNumber: 41,
          columnNumber: 7,
          stack: {
            description: 'Promise.then',
            callFrames: [
              {
                functionName: 'loadUsers',
                scriptId: '7',
                url: 'https://app.openheaders.io/main.js',
                lineNumber: 41,
                columnNumber: 7,
              },
            ],
          },
        },
      }),
    );
    const started = out[0];
    if (started?.method !== 'Network.requestWillBeSent') throw new Error('expected requestWillBeSent');
    expect(started.initiator).toEqual({
      type: 'script',
      url: 'https://app.openheaders.io/main.js',
      lineNumber: 41,
      columnNumber: 7,
      stack: {
        description: 'Promise.then',
        callFrames: [
          {
            functionName: 'loadUsers',
            scriptId: '7',
            url: 'https://app.openheaders.io/main.js',
            lineNumber: 41,
            columnNumber: 7,
          },
        ],
      },
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

  it('normalizes the two *ExtraInfo events into the on-the-wire header variants', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot(
      'Network.requestWillBeSentExtraInfo',
      rawRequestWillBeSentExtraInfo('r-1', { Cookie: 'sid=wire', 'X-Browser-Added': 'yes' }),
    );
    emitRoot(
      'Network.responseReceivedExtraInfo',
      rawResponseReceivedExtraInfo('r-1', { 'Set-Cookie': 'sess=raw; HttpOnly' }),
    );

    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      method: 'Network.requestWillBeSentExtraInfo',
      tabId: TAB,
      sessionId: 'page',
      requestId: 'r-1',
      headers: { Cookie: 'sid=wire', 'X-Browser-Added': 'yes' },
    });
    expect(out[1]).toEqual({
      method: 'Network.responseReceivedExtraInfo',
      tabId: TAB,
      sessionId: 'page',
      requestId: 'r-1',
      headers: { 'Set-Cookie': 'sess=raw; HttpOnly' },
    });
  });

  it('routes *ExtraInfo on a flattened child session by sessionId', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitChild(
      CHILD_SESSION,
      'Network.responseReceivedExtraInfo',
      rawResponseReceivedExtraInfo('r-1', { 'Set-Cookie': 'child=1' }),
    );

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      method: 'Network.responseReceivedExtraInfo',
      sessionId: CHILD_SESSION,
      requestId: 'r-1',
      headers: { 'Set-Cookie': 'child=1' },
    });
  });

  it('drops events for tabs that were never attached', () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));

    emitRoot('Network.requestWillBeSent', rawRequestWillBeSent('r-x', 'https://api.openheaders.io/x'));
    expect(out).toHaveLength(0);
  });
});

describe('ChromeDebuggerEventSource — Page-domain events (page timings)', () => {
  it('enables the Page domain on the root target during attach', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    const methods = chromeMock.debugger.sendCommand.mock.calls.map((c) => c[1]);
    expect(methods).toContain('Page.enable');
  });

  it('normalizes frameNavigated / domContentEventFired / loadEventFired from the root session', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpPageEvent[] = [];
    source.subscribePage((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Page.frameNavigated', {
      frame: { id: 'F1', loaderId: 'L1', url: 'https://app.openheaders.io/', parentId: undefined },
    });
    emitRoot('Page.domContentEventFired', { timestamp: 101.5 });
    emitRoot('Page.loadEventFired', { timestamp: 102.5 });

    expect(out).toEqual([
      {
        method: 'Page.frameNavigated',
        tabId: TAB,
        sessionId: 'page',
        frame: { id: 'F1', loaderId: 'L1', url: 'https://app.openheaders.io/' },
      },
      { method: 'Page.domContentEventFired', tabId: TAB, sessionId: 'page', timestamp: 101.5 },
      { method: 'Page.loadEventFired', tabId: TAB, sessionId: 'page', timestamp: 102.5 },
    ]);
  });

  it('normalizes frameId on requestWillBeSent, omitting it when absent', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot(
      'Network.requestWillBeSent',
      rawRequestWillBeSent('r-1', 'https://api.openheaders.io/a', { frameId: 'F1' }),
    );
    emitRoot('Network.requestWillBeSent', rawRequestWillBeSent('r-2', 'https://api.openheaders.io/b'));

    expect(out[0]).toMatchObject({ method: 'Network.requestWillBeSent', frameId: 'F1' });
    expect(out[1]?.method).toBe('Network.requestWillBeSent');
    expect(out[1] && 'frameId' in out[1] && out[1].frameId !== undefined).toBe(false);
  });

  it('seeds the main-frame registry from Page.getFrameTree at attach', async () => {
    clearMainFrameId(TAB);
    chromeMock.debugger.sendCommand.mockImplementation((_t, method: string) =>
      Promise.resolve<object | undefined>(
        method === 'Page.getFrameTree' ? { frameTree: { frame: { id: 'F-main' } } } : undefined,
      ),
    );
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    expect(isMainFrame(TAB, 'F-main')).toBe(true);
    expect(isMainFrame(TAB, 'F-iframe')).toBe(false);
    chromeMock.debugger.sendCommand.mockImplementation(() => Promise.resolve<object | undefined>(undefined));
    await source.detach(TAB);
    expect(isMainFrame(TAB, 'F-main')).toBe(false);
  });

  it('refreshes the registry on a parentless frameNavigated and ignores sub-frame navs', async () => {
    clearMainFrameId(TAB);
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);

    emitRoot('Page.frameNavigated', {
      frame: { id: 'F-sub', loaderId: 'L2', url: 'https://x.openheaders.io/', parentId: 'F-main' },
    });
    expect(isMainFrame(TAB, 'F-sub')).toBe(false);

    emitRoot('Page.frameNavigated', { frame: { id: 'F-main', loaderId: 'L3', url: 'https://app.openheaders.io/' } });
    expect(isMainFrame(TAB, 'F-main')).toBe(true);

    chromeMock.debugger.emitDetach({ tabId: TAB }, 'target_closed');
    expect(isMainFrame(TAB, 'F-main')).toBe(false);
  });

  it('preserves a sub-frame parentId on frameNavigated', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpPageEvent[] = [];
    source.subscribePage((e) => out.push(e));
    await source.attach(TAB);
    emitRoot('Page.frameNavigated', {
      frame: { id: 'F2', loaderId: 'L2', url: 'https://widget.openheaders.io/', parentId: 'F1' },
    });
    expect(out[0]).toMatchObject({ method: 'Page.frameNavigated', frame: { parentId: 'F1' } });
  });

  it('drops Page events from a child (non-root) session — page timing is main-frame only', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpPageEvent[] = [];
    source.subscribePage((e) => out.push(e));
    await source.attach(TAB);
    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitChild(CHILD_SESSION, 'Page.loadEventFired', { timestamp: 5 });
    expect(out).toHaveLength(0);
  });

  it('does not fan Page events onto the Network subscriber', async () => {
    source = new ChromeDebuggerEventSource();
    const net: CdpNetworkEvent[] = [];
    const pages: CdpPageEvent[] = [];
    source.subscribe((e) => net.push(e));
    source.subscribePage((e) => pages.push(e));
    await source.attach(TAB);
    emitRoot('Page.loadEventFired', { timestamp: 5 });
    expect(net).toHaveLength(0);
    expect(pages).toHaveLength(1);
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
    // Body-buffer sizes matched to the browser's own DevTools session, so
    // body retention (getResponseBody / streamResourceContent) is at parity.
    const enableCall = chromeMock.debugger.sendCommand.mock.calls.find((c) => c[1] === 'Network.enable');
    expect(enableCall?.[2]).toEqual({ maxTotalBufferSize: 250 * 1024 * 1024, maxPostDataSize: 64 * 1024 });
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

  it('enables the Page domain on a kept iframe child (Page-plane control delivery into the OOPIF)', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));

    // An OOPIF is page-like, so the fanned bootstrap / bypassCSP commands need
    // its Page domain enabled to land — distinct from the root's Page.enable.
    const childPageEnable = chromeMock.debugger.sendCommand.mock.calls.find(
      (c) => c[1] === 'Page.enable' && (c[0] as chrome.debugger.DebuggerSession).sessionId === CHILD_SESSION,
    );
    expect(childPageEnable).toBeDefined();
  });

  it('does not enable the Page domain on a kept worker child (no Page domain)', async () => {
    const WORKER_SESSION = 'child-worker-1';
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(WORKER_SESSION, 'worker'));

    const onWorker = (method: string) =>
      chromeMock.debugger.sendCommand.mock.calls.find(
        (c) => c[1] === method && (c[0] as chrome.debugger.DebuggerSession).sessionId === WORKER_SESSION,
      );
    // The worker is kept for Network interception (Fetch reach) but gets no
    // Page plane — its wrapper delivery is a separate, deferred mechanism.
    expect(onWorker('Network.enable')).toBeDefined();
    expect(onWorker('Page.enable')).toBeUndefined();
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

describe('ChromeDebuggerEventSource — child-session control observers (D2)', () => {
  it('fires onChildAttached with the target kind and tracks it in childSessionsOf', async () => {
    source = new ChromeDebuggerEventSource();
    const attached: Array<[number, string, string]> = [];
    source.onChildAttached((tabId, sessionId, kind) => attached.push([tabId, sessionId, kind]));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'worker'));

    expect(attached).toEqual([[TAB, CHILD_SESSION, 'worker']]);
    expect(source.childSessionsOf(TAB)).toEqual([{ sessionId: CHILD_SESSION, kind: 'worker' }]);
  });

  it('does not fire onChildAttached for an un-kept target type (service_worker)', async () => {
    source = new ChromeDebuggerEventSource();
    const attached: Array<[number, string, string]> = [];
    source.onChildAttached((tabId, sessionId, kind) => attached.push([tabId, sessionId, kind]));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget('sw-session', 'service_worker'));

    expect(attached).toHaveLength(0);
    expect(source.childSessionsOf(TAB)).toEqual([]);
  });

  it('fires onChildDetached with the target kind and forgets the child', async () => {
    source = new ChromeDebuggerEventSource();
    const detached: Array<[number, string, string]> = [];
    source.onChildDetached((tabId, sessionId, kind) => detached.push([tabId, sessionId, kind]));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitRoot('Target.detachedFromTarget', { sessionId: CHILD_SESSION });

    expect(detached).toEqual([[TAB, CHILD_SESSION, 'iframe']]);
    expect(source.childSessionsOf(TAB)).toEqual([]);
  });

  it('fires onChildDetached for every child when the tab detaches', async () => {
    source = new ChromeDebuggerEventSource();
    const detached: string[] = [];
    source.onChildDetached((_tabId, sessionId) => detached.push(sessionId));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitRoot('Target.attachedToTarget', attachedToTarget('child-2', 'worker'));
    await source.detach(TAB);

    expect(detached.sort()).toEqual(['child-2', CHILD_SESSION].sort());
    expect(source.childSessionsOf(TAB)).toEqual([]);
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

describe('ChromeDebuggerEventSource — fetchResponseBody (on-demand pull seam)', () => {
  function getBodyCall() {
    return chromeMock.debugger.sendCommand.mock.calls.find((c) => c[1] === 'Network.getResponseBody');
  }

  it('issues Network.getResponseBody on the root page target and returns the result', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ body: '{"ok":true}', base64Encoded: false });

    const result = await source.fetchResponseBody(TAB, 'page', 'r-1');

    expect(result).toEqual({ body: '{"ok":true}', base64Encoded: false });
    const call = getBodyCall();
    // Root session maps to a bare {tabId} debuggee (no sessionId).
    expect(call?.[0]).toEqual({ tabId: TAB });
    expect(call?.[2]).toEqual({ requestId: 'r-1' });
  });

  it('routes on a flattened child session and passes base64 through', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ body: 'AQID', base64Encoded: true });

    const result = await source.fetchResponseBody(TAB, CHILD_SESSION, 'r-7');

    expect(result).toEqual({ body: 'AQID', base64Encoded: true });
    expect(getBodyCall()?.[0]).toEqual({ tabId: TAB, sessionId: CHILD_SESSION });
  });

  it('rejects when the host has evicted the body', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    chromeMock.debugger.sendCommand.mockRejectedValueOnce(new Error('No resource with given identifier found'));

    await expect(source.fetchResponseBody(TAB, 'page', 'r-gone')).rejects.toThrow();
  });

  it('rejects on a malformed result so the empty-body slot is never poisoned', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce(undefined);

    await expect(source.fetchResponseBody(TAB, 'page', 'r-1')).rejects.toThrow();
  });

  it('rejects when chrome.debugger is absent (inert host)', async () => {
    vi.stubGlobal('chrome', { ...chromeMock, debugger: undefined });
    try {
      const inert = new ChromeDebuggerEventSource();
      await expect(inert.fetchResponseBody(TAB, 'page', 'r-1')).rejects.toThrow();
      inert.dispose();
    } finally {
      vi.stubGlobal('chrome', chromeMock);
    }
  });
});

describe('ChromeDebuggerEventSource — streamResponseBody (in-flight pull seam)', () => {
  function getStreamCall() {
    return chromeMock.debugger.sendCommand.mock.calls.find((c) => c[1] === 'Network.streamResourceContent');
  }

  it('issues Network.streamResourceContent on the root page target and returns the buffer', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ bufferedData: 'PCFkb2N0eXBlIGh0bWw+' });

    const result = await source.streamResponseBody(TAB, 'page', 'r-1');

    expect(result).toEqual({ bufferedData: 'PCFkb2N0eXBlIGh0bWw+' });
    const call = getStreamCall();
    expect(call?.[0]).toEqual({ tabId: TAB });
    expect(call?.[2]).toEqual({ requestId: 'r-1' });
  });

  it('routes on a flattened child session', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ bufferedData: 'AQID' });

    const result = await source.streamResponseBody(TAB, CHILD_SESSION, 'r-7');

    expect(result).toEqual({ bufferedData: 'AQID' });
    expect(getStreamCall()?.[0]).toEqual({ tabId: TAB, sessionId: CHILD_SESSION });
  });

  it('rejects when the request cannot be streamed (already finished)', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    chromeMock.debugger.sendCommand.mockRejectedValueOnce(new Error('Unable to stream'));

    await expect(source.streamResponseBody(TAB, 'page', 'r-done')).rejects.toThrow();
  });

  it('rejects on a malformed result so the empty-body slot is never poisoned', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce(undefined);

    await expect(source.streamResponseBody(TAB, 'page', 'r-1')).rejects.toThrow();
  });

  it('rejects when chrome.debugger is absent (inert host)', async () => {
    vi.stubGlobal('chrome', { ...chromeMock, debugger: undefined });
    try {
      const inert = new ChromeDebuggerEventSource();
      await expect(inert.streamResponseBody(TAB, 'page', 'r-1')).rejects.toThrow();
      inert.dispose();
    } finally {
      vi.stubGlobal('chrome', chromeMock);
    }
  });
});

describe('ChromeDebuggerEventSource — Fetch.requestPaused (control-input stream)', () => {
  it('normalizes a paused request on the root session with its request-stage subset', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpFetchEvent[] = [];
    source.subscribeFetch((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Fetch.requestPaused', rawRequestPaused('fetch-1', 'https://api.openheaders.io/users'));

    expect(out).toEqual([
      {
        method: 'Fetch.requestPaused',
        tabId: TAB,
        sessionId: 'page',
        requestId: 'fetch-1',
        request: { url: 'https://api.openheaders.io/users', method: 'GET', headers: { Accept: '*/*' } },
        resourceType: 'Document',
        frameId: 'F1',
        networkId: 'net-1',
      },
    ]);
  });

  it('omits frameId / networkId when absent (worker-originated pause)', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpFetchEvent[] = [];
    source.subscribeFetch((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Fetch.requestPaused', {
      requestId: 'fetch-w',
      request: { url: 'https://api.openheaders.io/worker', method: 'POST' },
      resourceType: 'Fetch',
    });

    expect(out[0]).toEqual({
      method: 'Fetch.requestPaused',
      tabId: TAB,
      sessionId: 'page',
      requestId: 'fetch-w',
      request: { url: 'https://api.openheaders.io/worker', method: 'POST' },
      resourceType: 'Fetch',
    });
  });

  it('routes a paused request on a flattened child session by sessionId', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpFetchEvent[] = [];
    source.subscribeFetch((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitChild(CHILD_SESSION, 'Fetch.requestPaused', rawRequestPaused('fetch-c', 'https://widgets.openheaders.io/x'));

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ method: 'Fetch.requestPaused', sessionId: CHILD_SESSION, requestId: 'fetch-c' });
  });

  it('drops a paused request from an unkept child session (target-type filter)', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpFetchEvent[] = [];
    source.subscribeFetch((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget('sw-session', 'service_worker'));
    emitChild('sw-session', 'Fetch.requestPaused', rawRequestPaused('fetch-sw', 'https://api.openheaders.io/sync'));

    expect(out).toHaveLength(0);
  });

  it('does not fan Fetch events onto the Network or Page subscribers', async () => {
    source = new ChromeDebuggerEventSource();
    const net: CdpNetworkEvent[] = [];
    const pages: CdpPageEvent[] = [];
    const fetches: CdpFetchEvent[] = [];
    source.subscribe((e) => net.push(e));
    source.subscribePage((e) => pages.push(e));
    source.subscribeFetch((e) => fetches.push(e));
    await source.attach(TAB);

    emitRoot('Fetch.requestPaused', rawRequestPaused('fetch-iso', 'https://api.openheaders.io/iso'));

    expect(net).toHaveLength(0);
    expect(pages).toHaveLength(0);
    expect(fetches).toHaveLength(1);
  });
});

describe('ChromeDebuggerEventSource — Fetch.authRequired (auth-challenge control-input, D3)', () => {
  it('normalizes an auth challenge on the root session', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpFetchEvent[] = [];
    source.subscribeFetch((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Fetch.authRequired', rawAuthRequired('fetch-a1', 'https://staging.openheaders.io/'));

    expect(out).toEqual([
      {
        method: 'Fetch.authRequired',
        tabId: TAB,
        sessionId: 'page',
        requestId: 'fetch-a1',
        request: { url: 'https://staging.openheaders.io/', method: 'GET', headers: { Accept: '*/*' } },
        resourceType: 'Document',
        frameId: 'F1',
        authChallenge: {
          source: 'Proxy',
          origin: 'https://proxy.openheaders.io',
          scheme: 'basic',
          realm: 'staging',
        },
      },
    ]);
  });

  it('defaults challenge source to Server when omitted, and omits frameId when absent', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpFetchEvent[] = [];
    source.subscribeFetch((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Fetch.authRequired', {
      requestId: 'fetch-a2',
      request: { url: 'https://staging.openheaders.io/api', method: 'POST' },
      resourceType: 'XHR',
      authChallenge: { origin: 'https://staging.openheaders.io', scheme: 'basic', realm: '' },
    });

    expect(out[0]).toEqual({
      method: 'Fetch.authRequired',
      tabId: TAB,
      sessionId: 'page',
      requestId: 'fetch-a2',
      request: { url: 'https://staging.openheaders.io/api', method: 'POST' },
      resourceType: 'XHR',
      authChallenge: { source: 'Server', origin: 'https://staging.openheaders.io', scheme: 'basic', realm: '' },
    });
  });

  it('routes an auth challenge on a flattened child session by sessionId', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpFetchEvent[] = [];
    source.subscribeFetch((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitChild(CHILD_SESSION, 'Fetch.authRequired', rawAuthRequired('fetch-ac', 'https://widgets.openheaders.io/x'));

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ method: 'Fetch.authRequired', sessionId: CHILD_SESSION, requestId: 'fetch-ac' });
  });

  it('drops an auth challenge from an unkept child session (target-type filter)', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpFetchEvent[] = [];
    source.subscribeFetch((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget('sw-session', 'service_worker'));
    emitChild('sw-session', 'Fetch.authRequired', rawAuthRequired('fetch-asw', 'https://api.openheaders.io/sync'));

    expect(out).toHaveLength(0);
  });
});

describe('ChromeDebuggerEventSource — Runtime.bindingCalled (private fire-bridge, E4)', () => {
  const onSession = (method: string, sessionId?: string) =>
    chromeMock.debugger.sendCommand.mock.calls.find(
      (c) => c[1] === method && (c[0] as chrome.debugger.DebuggerSession).sessionId === sessionId,
    );

  it('attach enables Runtime and adds the fire binding on the page target', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);

    // bindingCalled is delivered only to a Runtime-enabled client, so both are
    // issued on the root (sessionId undefined → bare {tabId} debuggee).
    expect(onSession('Runtime.enable', undefined)).toBeDefined();
    expect(onSession('Runtime.addBinding', undefined)?.[2]).toEqual({ name: OH_BINDING });
  });

  it('adds the fire binding on a kept iframe AND a kept worker child (uniform across child types)', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitRoot('Target.attachedToTarget', attachedToTarget('child-worker-1', 'worker'));

    // Unlike Page.enable (iframe-only), the binding fans to every kept child —
    // a worker has a Runtime domain + global, so the transport is uniform.
    expect(onSession('Runtime.enable', CHILD_SESSION)).toBeDefined();
    expect(onSession('Runtime.addBinding', CHILD_SESSION)?.[2]).toEqual({ name: OH_BINDING });
    expect(onSession('Runtime.enable', 'child-worker-1')).toBeDefined();
    expect(onSession('Runtime.addBinding', 'child-worker-1')?.[2]).toEqual({ name: OH_BINDING });
  });

  it('routes a bindingCalled on the root by tabId, dropping kind', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpBindingFire[] = [];
    source.subscribeBinding((f) => out.push(f));
    await source.attach(TAB);

    emitRoot(
      'Runtime.bindingCalled',
      rawBindingCalled({ ruleUid: 'wsr00001', url: 'wss://stream.openheaders.io/feed', kind: 'ws', t: 1234 }),
    );

    expect(out).toEqual([{ tabId: TAB, ruleUid: 'wsr00001', url: 'wss://stream.openheaders.io/feed', t: 1234 }]);
  });

  it('routes a bindingCalled on a kept child by the owning tabId (OOPIF wrapper fire)', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpBindingFire[] = [];
    source.subscribeBinding((f) => out.push(f));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitChild(
      CHILD_SESSION,
      'Runtime.bindingCalled',
      rawBindingCalled({ ruleUid: 'dly00001', url: 'https://widgets.openheaders.io/x', kind: 'delay', t: 9 }),
    );

    // A child wrapper's fire belongs to the tab — routed by tabId, not session.
    expect(out).toEqual([{ tabId: TAB, ruleUid: 'dly00001', url: 'https://widgets.openheaders.io/x', t: 9 }]);
  });

  it('drops a bindingCalled from an unkept child session (target-type filter)', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpBindingFire[] = [];
    source.subscribeBinding((f) => out.push(f));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget('sw-session', 'service_worker'));
    emitChild('sw-session', 'Runtime.bindingCalled', rawBindingCalled({ ruleUid: 'x', url: 'u', kind: 'ws', t: 1 }));

    expect(out).toHaveLength(0);
  });

  it('drops a residual Runtime.* outside the consumed subset on every plane', async () => {
    source = new ChromeDebuggerEventSource();
    const fires: CdpBindingFire[] = [];
    const net: CdpNetworkEvent[] = [];
    const pages: CdpPageEvent[] = [];
    const console: ConsoleEntry[] = [];
    const contexts: CdpJsContextEvent[] = [];
    source.subscribeBinding((f) => fires.push(f));
    source.subscribe((e) => net.push(e));
    source.subscribePage((e) => pages.push(e));
    source.subscribeConsole((_tabId, entry) => console.push(entry));
    source.subscribeContexts((e) => contexts.push(e));
    await source.attach(TAB);

    // consoleAPICalled / exceptionThrown (console capture) and the
    // executionContext lifecycle (contexts registry) are consumed; anything
    // else Runtime emits stays dropped on every plane.
    emitRoot('Runtime.inspectRequested', { object: { type: 'object' }, hints: {} });

    expect(fires).toHaveLength(0);
    expect(net).toHaveLength(0);
    expect(pages).toHaveLength(0);
    expect(console).toHaveLength(0);
    expect(contexts).toHaveLength(0);
  });

  it('drops a malformed or foreign-name bindingCalled (a page can call the fixed-name binding)', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpBindingFire[] = [];
    source.subscribeBinding((f) => out.push(f));
    await source.attach(TAB);

    emitRoot('Runtime.bindingCalled', rawBindingCalled('not-json{')); // unparseable payload
    emitRoot('Runtime.bindingCalled', rawBindingCalled({ ruleUid: 'r', t: 'soon' })); // wrong shape
    emitRoot('Runtime.bindingCalled', rawBindingCalled({ ruleUid: 'r', url: 'u', t: 1 }, 'someOtherBinding')); // not ours

    expect(out).toHaveLength(0);
  });
});

describe('ChromeDebuggerEventSource — Runtime console capture (Phase G)', () => {
  it('routes a consoleAPICalled on the root by tabId, bucketing the level', async () => {
    source = new ChromeDebuggerEventSource();
    const out: Array<{ tabId: number; entry: ConsoleEntry }> = [];
    source.subscribeConsole((tabId, entry) => out.push({ tabId, entry }));
    await source.attach(TAB);

    emitRoot('Runtime.consoleAPICalled', rawConsoleApiCalled('warning', [{ type: 'string', value: 'careful' }]));

    expect(out).toHaveLength(1);
    expect(out[0].tabId).toBe(TAB);
    expect(out[0].entry.source).toBe('console-api');
    expect(out[0].entry.level).toBe('warning');
    expect(out[0].entry.args).toEqual([{ type: 'string', text: 'careful' }]);
    // The context join key is minted from the session + executionContextId.
    expect(out[0].entry.contextKey).toBe('page::1');
  });

  it('routes an exceptionThrown as an error entry with location on the root', async () => {
    source = new ChromeDebuggerEventSource();
    const out: ConsoleEntry[] = [];
    source.subscribeConsole((_tabId, entry) => out.push(entry));
    await source.attach(TAB);

    emitRoot('Runtime.exceptionThrown', {
      timestamp: 1800,
      exceptionDetails: {
        text: 'Uncaught',
        lineNumber: 4,
        columnNumber: 9,
        url: 'https://app.openheaders.io/a.js',
        exception: {
          type: 'object',
          subtype: 'error',
          className: 'TypeError',
          description: 'TypeError: x is not a function',
        },
      },
    });

    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('exception');
    expect(out[0].level).toBe('error');
    expect(out[0].args[0].text).toBe('TypeError: x is not a function');
    expect(out[0].url).toBe('https://app.openheaders.io/a.js');
    expect(out[0].lineNumber).toBe(4);
  });

  it('routes a consoleAPICalled on a kept child by the owning tabId (OOPIF console)', async () => {
    source = new ChromeDebuggerEventSource();
    const out: Array<{ tabId: number; entry: ConsoleEntry }> = [];
    source.subscribeConsole((tabId, entry) => out.push({ tabId, entry }));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitChild(
      CHILD_SESSION,
      'Runtime.consoleAPICalled',
      rawConsoleApiCalled('log', [{ type: 'string', value: 'from iframe' }]),
    );

    // A child's console line belongs to the tab — routed by tabId, not session.
    expect(out).toHaveLength(1);
    expect(out[0].tabId).toBe(TAB);
    expect(out[0].entry.args[0].text).toBe('from iframe');
  });

  it('drops a consoleAPICalled from an unkept child session (target-type filter)', async () => {
    source = new ChromeDebuggerEventSource();
    const out: ConsoleEntry[] = [];
    source.subscribeConsole((_tabId, entry) => out.push(entry));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget('sw-session', 'service_worker'));
    emitChild('sw-session', 'Runtime.consoleAPICalled', rawConsoleApiCalled('log', [{ type: 'string', value: 'sw' }]));

    expect(out).toHaveLength(0);
  });

  const onSession = (method: string, sessionId?: string) =>
    chromeMock.debugger.sendCommand.mock.calls.find(
      (c) => c[1] === method && (c[0] as chrome.debugger.DebuggerSession).sessionId === sessionId,
    );

  it('attach enables the Log domain on the page target and on kept children (browser plane)', async () => {
    source = new ChromeDebuggerEventSource();
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitRoot('Target.attachedToTarget', attachedToTarget('child-worker-1', 'worker'));

    // Log.enable both turns on entryAdded delivery and replays the target's
    // retained backlog, so pre-attach history reaches the panel.
    expect(onSession('Log.enable', undefined)).toBeDefined();
    expect(onSession('Log.enable', CHILD_SESSION)).toBeDefined();
    expect(onSession('Log.enable', 'child-worker-1')).toBeDefined();
  });

  it('routes a Log.entryAdded on the root by tabId as a browser-sourced entry', async () => {
    source = new ChromeDebuggerEventSource();
    const out: Array<{ tabId: number; entry: ConsoleEntry }> = [];
    source.subscribeConsole((tabId, entry) => out.push({ tabId, entry }));
    await source.attach(TAB);

    emitRoot('Log.entryAdded', {
      entry: {
        source: 'network',
        level: 'error',
        text: 'POST https://collector.openheaders.io/collect net::ERR_BLOCKED_BY_CLIENT',
        timestamp: 1900,
        url: 'https://collector.openheaders.io/collect',
        networkRequestId: '77.3',
      },
    });

    expect(out).toHaveLength(1);
    expect(out[0].tabId).toBe(TAB);
    expect(out[0].entry.source).toBe('browser');
    expect(out[0].entry.category).toBe('network');
    expect(out[0].entry.level).toBe('error');
    expect(out[0].entry.args[0].text).toContain('net::ERR_BLOCKED_BY_CLIENT');
    // The join id is namespaced with the ROOT session, matching the store
    // key the correlator mints for the same request.
    expect(out[0].entry.requestId).toBe('page::77.3');
  });

  it('routes a Log.entryAdded on a kept child by the owning tabId and drops one from an unkept child', async () => {
    source = new ChromeDebuggerEventSource();
    const out: Array<{ tabId: number; entry: ConsoleEntry }> = [];
    source.subscribeConsole((tabId, entry) => out.push({ tabId, entry }));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitRoot('Target.attachedToTarget', attachedToTarget('sw-session', 'service_worker'));
    const entry = {
      source: 'deprecation',
      level: 'warning',
      text: 'Deprecated API',
      timestamp: 1910,
      networkRequestId: '9.1',
    };
    emitChild(CHILD_SESSION, 'Log.entryAdded', { entry });
    emitChild('sw-session', 'Log.entryAdded', { entry });

    expect(out).toHaveLength(1);
    expect(out[0].tabId).toBe(TAB);
    expect(out[0].entry.category).toBe('deprecation');
    // Child entries join under the child's own session namespace.
    expect(out[0].entry.requestId).toBe(`${CHILD_SESSION}::9.1`);
  });

  it('console capture does not perturb the fire bridge — bindingCalled still routes (E4 regression guard)', async () => {
    source = new ChromeDebuggerEventSource();
    const fires: CdpBindingFire[] = [];
    const consoleOut: ConsoleEntry[] = [];
    source.subscribeBinding((f) => fires.push(f));
    source.subscribeConsole((_tabId, entry) => consoleOut.push(entry));
    await source.attach(TAB);

    emitRoot('Runtime.consoleAPICalled', rawConsoleApiCalled('log', [{ type: 'string', value: 'hi' }]));
    emitRoot(
      'Runtime.bindingCalled',
      rawBindingCalled({ ruleUid: 'wsr00001', url: 'wss://stream.openheaders.io/feed', kind: 'ws', t: 1234 }),
    );

    expect(consoleOut).toHaveLength(1);
    expect(fires).toEqual([{ tabId: TAB, ruleUid: 'wsr00001', url: 'wss://stream.openheaders.io/feed', t: 1234 }]);
  });

  it('mints the child-session contextKey on an OOPIF console entry and the exception contextKey when named', async () => {
    source = new ChromeDebuggerEventSource();
    const out: ConsoleEntry[] = [];
    source.subscribeConsole((_tabId, entry) => out.push(entry));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitChild(
      CHILD_SESSION,
      'Runtime.consoleAPICalled',
      rawConsoleApiCalled('log', [{ type: 'string', value: 'x' }], { executionContextId: 4 }),
    );
    emitRoot('Runtime.exceptionThrown', {
      timestamp: 1800,
      exceptionDetails: { text: 'Uncaught', lineNumber: 1, columnNumber: 1, executionContextId: 2 },
    });
    emitRoot('Runtime.exceptionThrown', {
      timestamp: 1801,
      exceptionDetails: { text: 'Uncaught', lineNumber: 1, columnNumber: 1 },
    });

    expect(out[0].contextKey).toBe(`${CHILD_SESSION}::4`);
    expect(out[1].contextKey).toBe('page::2');
    // No executionContextId on the details — no join key is invented.
    expect(out[2].contextKey).toBeUndefined();
  });
});

describe('ChromeDebuggerEventSource — Runtime executionContext lifecycle (JS contexts Phase A)', () => {
  function rawContextCreated(id: number, overrides: Record<string, unknown> = {}): object {
    return {
      context: {
        id,
        origin: 'https://app.openheaders.io',
        name: '',
        auxData: { frameId: 'F1', isDefault: true, type: 'default' },
        ...overrides,
      },
    };
  }

  it('fans a context-created on the root as a page-kind JsContext with the minted key', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpJsContextEvent[] = [];
    source.subscribeContexts((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Runtime.executionContextCreated', rawContextCreated(1));

    expect(out).toEqual([
      {
        kind: 'context-created',
        tabId: TAB,
        context: {
          contextKey: 'page::1',
          origin: 'https://app.openheaders.io',
          name: '',
          isDefault: true,
          frameId: 'F1',
          targetKind: 'page',
          worldType: 'default',
        },
      },
    ]);
  });

  it('carries an isolated world through with its name and world type', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpJsContextEvent[] = [];
    source.subscribeContexts((e) => out.push(e));
    await source.attach(TAB);

    emitRoot(
      'Runtime.executionContextCreated',
      rawContextCreated(5, { name: 'Open Headers', auxData: { frameId: 'F1', isDefault: false, type: 'isolated' } }),
    );

    expect(out[0]).toMatchObject({
      kind: 'context-created',
      context: { contextKey: 'page::5', name: 'Open Headers', isDefault: false, worldType: 'isolated' },
    });
  });

  it('stamps isTopFrame from the main-frame registry on root-session contexts only', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpJsContextEvent[] = [];
    source.subscribeContexts((e) => out.push(e));
    await source.attach(TAB);

    // Seed the registry the production way — a parentless frameNavigated.
    emitRoot('Page.frameNavigated', { frame: { id: 'F1', loaderId: 'L1', url: 'https://app.openheaders.io/' } });

    emitRoot('Runtime.executionContextCreated', rawContextCreated(1));
    emitRoot(
      'Runtime.executionContextCreated',
      rawContextCreated(2, { auxData: { frameId: 'F2', isDefault: true, type: 'default' } }),
    );
    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitChild(CHILD_SESSION, 'Runtime.executionContextCreated', rawContextCreated(3));

    // Main-frame context carries the flag; a same-process sub-frame and a
    // kept child (even reusing the main frame's id in auxData) never do.
    expect(out[0]).toMatchObject({ kind: 'context-created', context: { contextKey: 'page::1', isTopFrame: true } });
    expect((out[1] as { context: { isTopFrame?: boolean } }).context.isTopFrame).toBeUndefined();
    expect((out[2] as { context: { isTopFrame?: boolean } }).context.isTopFrame).toBeUndefined();
  });

  it('fans child-session contexts with the child target kind and session-scoped keys', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpJsContextEvent[] = [];
    source.subscribeContexts((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitRoot('Target.attachedToTarget', attachedToTarget('child-worker-1', 'worker'));
    emitChild(CHILD_SESSION, 'Runtime.executionContextCreated', rawContextCreated(1));
    emitChild(
      'child-worker-1',
      'Runtime.executionContextCreated',
      rawContextCreated(1, { auxData: { isDefault: true, type: 'worker' } }),
    );

    // Same numeric id on two sessions — distinct keys by session.
    expect(out[0]).toMatchObject({
      kind: 'context-created',
      context: { contextKey: `${CHILD_SESSION}::1`, targetKind: 'iframe', frameId: 'F1' },
    });
    expect(out[1]).toMatchObject({
      kind: 'context-created',
      context: { contextKey: 'child-worker-1::1', targetKind: 'worker', worldType: 'worker' },
    });
    expect(out[1].kind === 'context-created' && 'frameId' in out[1].context).toBe(false);
  });

  it('fans context-destroyed with the session-scoped key', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpJsContextEvent[] = [];
    source.subscribeContexts((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Runtime.executionContextDestroyed', { executionContextId: 3 });

    expect(out).toEqual([{ kind: 'context-destroyed', tabId: TAB, contextKey: 'page::3' }]);
  });

  it('fans session-cleared for executionContextsCleared on the emitting session', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpJsContextEvent[] = [];
    source.subscribeContexts((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    // The cleared event carries no parameters on the wire — the router must
    // dispatch it without a params object.
    chromeMock.debugger.emitEvent({ tabId: TAB }, 'Runtime.executionContextsCleared', undefined);
    emitChild(CHILD_SESSION, 'Runtime.executionContextsCleared', {});

    expect(out).toEqual([
      { kind: 'session-cleared', tabId: TAB, sessionKey: 'page' },
      { kind: 'session-cleared', tabId: TAB, sessionKey: CHILD_SESSION },
    ]);
  });

  it('fans session-cleared when a kept child detaches', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpJsContextEvent[] = [];
    source.subscribeContexts((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));
    emitRoot('Target.detachedFromTarget', { sessionId: CHILD_SESSION });

    expect(out).toEqual([{ kind: 'session-cleared', tabId: TAB, sessionKey: CHILD_SESSION }]);
  });

  it('fans tab-detached on chrome-initiated detach and on our own detach', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpJsContextEvent[] = [];
    source.subscribeContexts((e) => out.push(e));
    await source.attach(TAB);

    chromeMock.debugger.emitDetach({ tabId: TAB }, 'canceled_by_user');
    expect(out).toEqual([{ kind: 'tab-detached', tabId: TAB }]);

    out.length = 0;
    await source.attach(TAB);
    await source.detach(TAB);
    expect(out).toEqual([{ kind: 'tab-detached', tabId: TAB }]);
  });

  it('drops executionContext events from an unkept child session (target-type filter)', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpJsContextEvent[] = [];
    source.subscribeContexts((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Target.attachedToTarget', attachedToTarget('sw-session', 'service_worker'));
    emitChild('sw-session', 'Runtime.executionContextCreated', rawContextCreated(1));
    emitChild('sw-session', 'Runtime.executionContextDestroyed', { executionContextId: 1 });

    expect(out).toHaveLength(0);
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

describe('ChromeDebuggerEventSource — WebSocket / EventSource vocabulary', () => {
  it('normalizes the full WS event sequence on the page session', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Network.webSocketCreated', {
      requestId: 'ws-1',
      url: 'wss://api.openheaders.io/socket',
      initiator: { type: 'script', url: 'https://app.openheaders.io/' },
    });
    emitRoot('Network.webSocketWillSendHandshakeRequest', {
      requestId: 'ws-1',
      timestamp: 100,
      wallTime: 1_700_000_000,
      request: { headers: { Upgrade: 'websocket' } },
    });
    emitRoot('Network.webSocketHandshakeResponseReceived', {
      requestId: 'ws-1',
      timestamp: 100.2,
      response: {
        status: 101,
        statusText: 'Switching Protocols',
        headers: { Upgrade: 'websocket' },
        headersText: 'HTTP/1.1 101 Switching Protocols\r\n\r\n',
        requestHeaders: { Upgrade: 'websocket', 'Sec-WebSocket-Key': 'k==' },
        requestHeadersText: 'GET wss://api.openheaders.io/socket HTTP/1.1\r\n\r\n',
      },
    });
    emitRoot('Network.webSocketFrameSent', {
      requestId: 'ws-1',
      timestamp: 101,
      response: { opcode: 1, mask: true, payloadData: 'ping' },
    });
    emitRoot('Network.webSocketFrameReceived', {
      requestId: 'ws-1',
      timestamp: 101.1,
      response: { opcode: 2, mask: false, payloadData: '3q2+7w==' },
    });
    emitRoot('Network.webSocketFrameError', {
      requestId: 'ws-1',
      timestamp: 101.5,
      errorMessage: 'Invalid frame header',
    });
    emitRoot('Network.webSocketClosed', { requestId: 'ws-1', timestamp: 102 });

    expect(out.map((e) => e.method)).toEqual([
      'Network.webSocketCreated',
      'Network.webSocketWillSendHandshakeRequest',
      'Network.webSocketHandshakeResponseReceived',
      'Network.webSocketFrameSent',
      'Network.webSocketFrameReceived',
      'Network.webSocketFrameError',
      'Network.webSocketClosed',
    ]);
    const created = out[0];
    if (created?.method !== 'Network.webSocketCreated') throw new Error('expected created');
    expect(created).toMatchObject({
      tabId: TAB,
      sessionId: 'page',
      requestId: 'ws-1',
      url: 'wss://api.openheaders.io/socket',
      initiator: { type: 'script', url: 'https://app.openheaders.io/' },
    });
    // The arrival stamp stands in for the event's missing timestamp.
    expect(typeof created.atWallMs).toBe('number');
    expect(created.atWallMs).toBeGreaterThan(0);

    expect(out[1]).toMatchObject({ wallTime: 1_700_000_000, headers: { Upgrade: 'websocket' } });
    expect(out[2]).toMatchObject({
      response: {
        status: 101,
        requestHeaders: { 'Sec-WebSocket-Key': 'k==' },
        headersText: 'HTTP/1.1 101 Switching Protocols\r\n\r\n',
      },
    });
    expect(out[3]).toMatchObject({ response: { opcode: 1, mask: true, payloadData: 'ping' } });
    expect(out[4]).toMatchObject({ response: { opcode: 2, mask: false, payloadData: '3q2+7w==' } });
    expect(out[5]).toMatchObject({ errorMessage: 'Invalid frame header' });
    expect(out[6]).toMatchObject({ method: 'Network.webSocketClosed', requestId: 'ws-1', timestamp: 102 });
  });

  it('normalizes eventSourceMessageReceived with the parsed SSE fields', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);

    emitRoot('Network.eventSourceMessageReceived', {
      requestId: 'sse-1',
      timestamp: 101,
      eventName: 'tick',
      eventId: '3',
      data: '{"seq":3}\n{"named":true}',
    });

    expect(out).toEqual([
      {
        method: 'Network.eventSourceMessageReceived',
        tabId: TAB,
        sessionId: 'page',
        requestId: 'sse-1',
        timestamp: 101,
        eventName: 'tick',
        eventId: '3',
        data: '{"seq":3}\n{"named":true}',
      },
    ]);
  });

  it('routes WS events on a flattened child session by sessionId', async () => {
    source = new ChromeDebuggerEventSource();
    const out: CdpNetworkEvent[] = [];
    source.subscribe((e) => out.push(e));
    await source.attach(TAB);
    emitRoot('Target.attachedToTarget', attachedToTarget(CHILD_SESSION, 'iframe'));

    emitChild(CHILD_SESSION, 'Network.webSocketCreated', {
      requestId: 'ws-c',
      url: 'wss://widgets.openheaders.io/socket',
    });

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ method: 'Network.webSocketCreated', sessionId: CHILD_SESSION, requestId: 'ws-c' });
  });
});
