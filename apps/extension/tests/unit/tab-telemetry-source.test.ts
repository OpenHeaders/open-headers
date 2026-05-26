/**
 * Lifecycle → tab-telemetry projection — parity contract.
 *
 * Drives a `RequestLifecycleStore` through `startTabTelemetrySource` and
 * asserts that the side effects observable on `tab-telemetry` match the
 * surface the deleted `request-monitor` produced.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';

import { startTabTelemetrySource } from '@/background/tab-telemetry-source';
import { mainFrameRequestIdsMatchingCommit } from '@/background/tab-telemetry-source/main-frame-chain';
import { deriveObservedUrls } from '@/background/tab-telemetry-source/observed-urls';
import {
  __resetForTests,
  getTabSnapshot,
  onPageCommit,
  recordObservedFire,
  startTracking,
  subscribeRequestEvents,
  subscribeRequestRedirects,
  type RequestObservation,
  type RequestRedirect,
} from '@/background/modules/tab-telemetry';

function observed(tabId: number): ReadonlySet<string> {
  return deriveObservedUrls(store.snapshotTab(tabId));
}

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/users',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    har: new Map(),
    harBodyByHop: new Map(),
    ...overrides,
  };
}

let store: RequestLifecycleStore;
let dispose: () => void;

beforeEach(() => {
  __resetForTests();
  store = new RequestLifecycleStore();
  const handle = startTabTelemetrySource({ store });
  dispose = handle.dispose;
});

afterEach(() => {
  dispose();
});

describe('tab-telemetry-source — started projection', () => {
  it('is a no-op on tab-telemetry surfaces for untracked tabs', () => {
    const events: RequestObservation[] = [];
    subscribeRequestEvents(1, (e) => events.push(e));
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1 }) });
    expect(events).toHaveLength(0);
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });

  it('emits request observations for tracked tabs and surfaces the URL via the store snapshot', () => {
    startTracking(1, 'test:t1');
    const events: RequestObservation[] = [];
    subscribeRequestEvents(1, (e) => events.push(e));

    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({
        tabId: 1,
        requestId: 'r1',
        url: 'https://api.openheaders.io/x',
        method: 'POST',
        resourceType: 'xmlhttprequest',
        initiator: 'https://openheaders.io',
        startedAtMs: 1_500,
      }),
    });

    expect([...observed(1)]).toEqual(['https://api.openheaders.io/x']);
    expect(events).toEqual([
      {
        requestId: 'r1',
        method: 'POST',
        url: 'https://api.openheaders.io/x',
        resourceType: 'xmlhttprequest',
        initiator: 'https://openheaders.io',
        timestamp: 1_500,
      },
    ]);
  });

  it('omits initiator from the observation payload when absent on the lifecycle', () => {
    startTracking(1, 'test:t1');
    const events: RequestObservation[] = [];
    subscribeRequestEvents(1, (e) => events.push(e));

    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1, requestId: 'r1' }) });

    expect(events).toHaveLength(1);
    expect(events[0]).not.toHaveProperty('initiator');
  });

  it('main_frame lifecycle keeps observed fires buffered until commit', () => {
    startTracking(1, 'test:t1');
    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({
        tabId: 1,
        requestId: 'mf-1',
        url: 'https://openheaders.io/',
        resourceType: 'main_frame',
      }),
    });
    recordObservedFire(1, 'rule-mf', 'https://openheaders.io/', 'mf-1', 2_000, {
      resourceType: 'main_frame',
      pattern: 'https://openheaders.io/',
      deferred: false,
    });
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });
});

describe('tab-telemetry-source — redirect projection', () => {
  beforeEach(() => {
    startTracking(1, 'test:t1');
    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({
        tabId: 1,
        requestId: 'r1',
        url: 'https://openheaders.io/a',
        method: 'GET',
        resourceType: 'xmlhttprequest',
        startedAtMs: 1_000,
      }),
    });
  });

  it('emits a request observation + redirect event + observed URL for the new hop', () => {
    const obs: RequestObservation[] = [];
    const reds: RequestRedirect[] = [];
    subscribeRequestEvents(1, (e) => obs.push(e));
    subscribeRequestRedirects(1, (e) => reds.push(e));

    const redirect: Extract<RequestLifecycleUpdate, { kind: 'redirect' }> = {
      kind: 'redirect',
      tabId: 1,
      requestId: 'r1',
      hop: {
        sourceUrl: 'https://openheaders.io/a',
        redirectUrl: 'https://openheaders.io/b',
        statusCode: 302,
        timestampMs: 2_000,
      },
      nextUrl: 'https://openheaders.io/b',
    };
    store.apply(redirect);

    expect(observed(1).has('https://openheaders.io/b')).toBe(true);
    expect(observed(1).has('https://openheaders.io/a')).toBe(true);
    expect(obs).toEqual([
      {
        requestId: 'r1',
        method: 'GET',
        url: 'https://openheaders.io/b',
        resourceType: 'xmlhttprequest',
        timestamp: 2_000,
      },
    ]);
    expect(reds).toEqual([
      {
        requestId: 'r1',
        sourceUrl: 'https://openheaders.io/a',
        method: 'GET',
        resourceType: 'xmlhttprequest',
        statusCode: 302,
        redirectUrl: 'https://openheaders.io/b',
        timestamp: 2_000,
      },
    ]);
  });
});

describe('tab-telemetry-source — phase projection', () => {
  it('back-fills delivery mode when patch.fromCache is set', () => {
    startTracking(1, 'test:t1');
    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({ tabId: 1, requestId: 'r1', url: 'https://api.openheaders.io/x' }),
    });
    recordObservedFire(1, 'rule-a', 'https://api.openheaders.io/x', 'r1', 1_000, {
      resourceType: 'xmlhttprequest',
      pattern: '*://*.openheaders.io/*',
      deferred: false,
    });
    expect(getTabSnapshot(1).fires[0].deliveryMode).toBeUndefined();

    store.apply({
      kind: 'phase',
      tabId: 1,
      requestId: 'r1',
      patch: { phase: 'completed', fromCache: true },
    });
    expect(getTabSnapshot(1).fires[0].deliveryMode).toBe('cached');

    store.apply({
      kind: 'phase',
      tabId: 1,
      requestId: 'r1',
      patch: { fromCache: false },
    });
    expect(getTabSnapshot(1).fires[0].deliveryMode).toBe('network');
  });

  it('phase patches without fromCache do not touch delivery mode', () => {
    startTracking(1, 'test:t1');
    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({ tabId: 1, requestId: 'r1', url: 'https://api.openheaders.io/x' }),
    });
    recordObservedFire(1, 'rule-a', 'https://api.openheaders.io/x', 'r1', 1_000, {
      resourceType: 'xmlhttprequest',
      pattern: '*://*.openheaders.io/*',
      deferred: false,
    });
    store.apply({
      kind: 'phase',
      tabId: 1,
      requestId: 'r1',
      patch: { phase: 'headers-received', statusCode: 200 },
    });
    expect(getTabSnapshot(1).fires[0].deliveryMode).toBeUndefined();
  });
});

describe('tab-telemetry-source — main-frame chain via store snapshot', () => {
  it('redirect → commit on original URL: pending fires promote via the derived requestId set', () => {
    startTracking(1, 'test:t1');
    // Main-frame nav starts at openheaders.io/ and a delay-rule observation
    // is buffered for the same requestId.
    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({
        tabId: 1,
        requestId: 'mf-1',
        url: 'https://openheaders.io/',
        resourceType: 'main_frame',
        startedAtMs: 1_000,
      }),
    });
    recordObservedFire(1, 'rule-delay', 'https://openheaders.io/', 'mf-1', 1_000, {
      resourceType: 'main_frame',
      pattern: 'https://openheaders.io/',
      deferred: false,
    });

    // Redirect through a delay shim and back to the original URL — the
    // intermediate chrome-extension:// commit is transient.
    store.apply({
      kind: 'redirect',
      tabId: 1,
      requestId: 'mf-1',
      hop: {
        sourceUrl: 'https://openheaders.io/',
        redirectUrl: 'chrome-extension://abc/delay.html#https://openheaders.io/',
        statusCode: 302,
        timestampMs: 1_100,
      },
      nextUrl: 'chrome-extension://abc/delay.html#https://openheaders.io/',
    });

    // Caller (tab-listeners) computes the matching set from the store and
    // hands it to onPageCommit. The store reflects the redirect already.
    const matches = mainFrameRequestIdsMatchingCommit(store.snapshotTab(1), 'https://openheaders.io/');
    expect([...matches]).toEqual(['mf-1']);

    onPageCommit(1, 'https://openheaders.io/', matches);
    expect(getTabSnapshot(1).counters['rule-delay']).toBe(1);
  });

  it('commit landing on an unrelated URL drops the buffered fire', () => {
    startTracking(1, 'test:t1');
    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({
        tabId: 1,
        requestId: 'mf-1',
        url: 'https://openheaders.io/page',
        resourceType: 'main_frame',
      }),
    });
    recordObservedFire(1, 'rule-a', 'https://openheaders.io/page', 'mf-1', 1_000, {
      resourceType: 'main_frame',
      pattern: 'https://openheaders.io/*',
      deferred: false,
    });

    const matches = mainFrameRequestIdsMatchingCommit(store.snapshotTab(1), 'https://elsewhere.example/');
    expect(matches.size).toBe(0);
    onPageCommit(1, 'https://elsewhere.example/', matches);
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });
});

describe('tab-telemetry-source — dispose', () => {
  it('detaches the store subscription so projection side effects stop', () => {
    startTracking(1, 'test:t1');
    const events: RequestObservation[] = [];
    subscribeRequestEvents(1, (e) => events.push(e));

    dispose();
    dispose = () => {}; // afterEach safety

    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1 }) });
    expect(events).toHaveLength(0);
  });
});
