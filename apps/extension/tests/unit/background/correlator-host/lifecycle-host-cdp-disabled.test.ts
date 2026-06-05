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
