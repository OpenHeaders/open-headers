/**
 * `startLifecycleHost` — behavior-preserving guarantee for Slice 3.
 *
 * The host now constructs the CDP source + correlator alongside the
 * heuristic pipeline and subscribes both into the one store. With no
 * Slice 4/5 reconciler, no tab is ever `route`d to `'cdp'`: the CDP
 * correlator is never `attachTab`'d and `chrome.debugger.attach` is never
 * called. This test drives a heuristic webRequest trace through the host
 * and asserts the store lands the lifecycle exactly as before while the
 * CDP correlator emits nothing — the OFF path is byte-for-byte heuristic.
 */

import { HAR_FAILURE_HOLD_MS } from '@openheaders/oracle/correlator-heuristic';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startLifecycleHost } from '@/background/correlator-host/lifecycle-host';
import { chrome as chromeMock } from '../../../__mocks__/chrome';

const TAB = 12;

/** Capture the latest listener registered on a `vi.fn()` addListener mock. */
function latestListener<T>(addListener: unknown): T {
  const fn = addListener as ReturnType<typeof vi.fn>;
  const last = fn.mock.calls.at(-1);
  expect(last).toBeDefined();
  return last?.[0] as T;
}

/** Every listener registered on a `vi.fn()` addListener mock — chrome
 *  dispatches all of them, and several port adapters cohabit on
 *  `runtime.onConnect`. */
function allListeners<T>(addListener: unknown): T[] {
  const fn = addListener as ReturnType<typeof vi.fn>;
  return fn.mock.calls.map((call) => call[0] as T);
}

function onBeforeRequestDetails(): chrome.webRequest.OnBeforeRequestDetails {
  return {
    tabId: TAB,
    requestId: 'wr-1',
    url: 'https://api.openheaders.io/users',
    method: 'GET',
    type: 'xmlhttprequest',
    timeStamp: 1_700_000_000_000,
    frameId: 0,
    parentFrameId: -1,
  } as unknown as chrome.webRequest.OnBeforeRequestDetails;
}

let host: ReturnType<typeof startLifecycleHost>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  host?.dispose();
});

describe('startLifecycleHost — CDP-disabled is byte-for-byte heuristic', () => {
  it('drives a heuristic trace to the store while the CDP correlator stays silent', () => {
    host = startLifecycleHost({ bus: new TabLifecycleBus() });

    const cdpEmitted = vi.fn();
    host.cdpCorrelator.subscribe(cdpEmitted);

    // The lifecycle bridge attaches new tabs to the default (heuristic)
    // owner — never CDP.
    const onCreated = latestListener<(tab: chrome.tabs.Tab) => void>(chromeMock.tabs.onCreated.addListener);
    onCreated({ id: TAB } as chrome.tabs.Tab);

    // Drive a webRequest event through the heuristic source the host wired.
    const onBeforeRequest = latestListener<(d: chrome.webRequest.OnBeforeRequestDetails) => void>(
      chromeMock.webRequest.onBeforeRequest.addListener,
    );
    onBeforeRequest(onBeforeRequestDetails());

    // The heuristic stream reached the store under the raw requestId.
    const row = host.store.get(TAB, 'wr-1');
    expect(row?.url).toBe('https://api.openheaders.io/users');
    expect(row?.phase).toBe('pending');

    // The CDP correlator was never attached for this tab, so it emitted
    // nothing and `chrome.debugger.attach` was never called.
    expect(cdpEmitted).not.toHaveBeenCalled();
    expect(chromeMock.debugger.attach).not.toHaveBeenCalled();
  });
});

describe('startLifecycleHost — trailing HAR gc tick', () => {
  it('synthesizes the (canceled) row for an un-joined failure HAR once the trailing tick fires', () => {
    vi.useFakeTimers();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);
    try {
      host = startLifecycleHost({ bus: new TabLifecycleBus() });

      const onCreated = latestListener<(tab: chrome.tabs.Tab) => void>(chromeMock.tabs.onCreated.addListener);
      onCreated({ id: TAB } as chrome.tabs.Tab);

      // Connect a devtools HAR port and deliver a failure-shaped entry
      // (the canceled-while-renderer-queued shape) with no webRequest
      // counterpart. Chrome dispatches every onConnect listener (the HAR
      // and Resource Timing adapters cohabit on this port name) — drive
      // them all, then fan each message to every onMessage listener.
      const onConnects = allListeners<(port: chrome.runtime.Port) => void>(chromeMock.runtime.onConnect.addListener);
      const onPortMessages: Array<(msg: unknown) => void> = [];
      const port = {
        name: `devtools-har-source:${TAB}`,
        sender: { url: 'chrome-extension://test-id/panel.html' },
        onMessage: {
          addListener: (fn: (msg: unknown) => void) => {
            onPortMessages.push(fn);
          },
        },
        onDisconnect: { addListener: vi.fn() },
        postMessage: vi.fn(),
      } as unknown as chrome.runtime.Port;
      for (const onConnect of onConnects) onConnect(port);
      expect(onPortMessages.length).toBeGreaterThan(0);
      const onPortMessage = (msg: unknown) => {
        for (const fn of onPortMessages) fn(msg);
      };
      onPortMessage({
        type: 'har',
        entry: {
          startedDateTime: new Date(t0).toISOString(),
          time: 120,
          _resourceType: 'script',
          request: { method: 'GET', url: 'https://assets.openheaders.io/app.js', headers: [], queryString: [] },
          response: {
            status: 0,
            statusText: '',
            headers: [],
            content: { size: 0, mimeType: 'x-unknown' },
            _transferSize: 0,
            _error: 'net::ERR_ABORTED',
          },
        },
      });

      // Held, not yet synthesized — the tab then goes quiet.
      expect(host.store.snapshotTab(TAB)).toHaveLength(0);

      vi.advanceTimersByTime(HAR_FAILURE_HOLD_MS + 600);

      const rows = host.store.snapshotTab(TAB);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.requestId).toMatch(/^oh-har:/);
      expect(rows[0]?.phase).toBe('failed');
      expect(rows[0]?.error?.code).toBe('net::ERR_ABORTED');
    } finally {
      vi.useRealTimers();
    }
  });
});
