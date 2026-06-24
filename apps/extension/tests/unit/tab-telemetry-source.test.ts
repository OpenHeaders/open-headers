/**
 * Lifecycle → tab-telemetry projection — contract.
 *
 * Drives a `RequestLifecycleStore` through `startTabTelemetrySource` and
 * asserts that the surviving projection side effects (phase-driven
 * delivery-mode back-fill, main-frame error promotion) land on
 * tab-telemetry. URL discovery is verified by reading the store
 * snapshot via `deriveObservedUrls` — the projection no longer forwards
 * per-request observation events.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';

import { clearMainFrameId, setMainFrameId } from '@/background/correlator-host/main-frame-registry';
import { startTabTelemetrySource } from '@/background/tab-telemetry-source';
import { mainFrameRequestIdsMatchingCommit } from '@/background/tab-telemetry-source/main-frame-chain';
import { deriveObservedUrls } from '@/background/tab-telemetry-source/observed-urls';
import {
  __internals,
  __resetForTests,
  getTabSnapshot,
  onPageCommit,
  recordObservedFire,
  startTracking,
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
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

let store: RequestLifecycleStore;
let bus: TabLifecycleBus;
let dispose: () => void;

beforeEach(() => {
  __resetForTests();
  store = new RequestLifecycleStore();
  bus = new TabLifecycleBus();
  const handle = startTabTelemetrySource({ store, bus });
  dispose = handle.dispose;
});

afterEach(() => {
  dispose();
  clearMainFrameId(1);
});

describe('tab-telemetry-source — started projection', () => {
  it('is a no-op on tab-telemetry surfaces for untracked tabs', () => {
    store.apply({ kind: 'started', lifecycle: makeLifecycle({ tabId: 1 }) });
    expect(__internals.getState(1)).toBeUndefined();
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });

  it('tracked started lifecycle surfaces the URL via the store snapshot derivation', () => {
    startTracking(1, 'test:t1');
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
    expect(__internals.getState(1)?.pendingFires).toHaveLength(1);
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

  it('records both source and target URLs via the store snapshot after a redirect hop', () => {
    store.apply({
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
    });

    expect(observed(1).has('https://openheaders.io/a')).toBe(true);
    expect(observed(1).has('https://openheaders.io/b')).toBe(true);
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

  it('promotes buffered main-frame fires when the navigation fails', () => {
    startTracking(1, 'test:t1');
    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({
        tabId: 1,
        requestId: 'mf-err',
        url: 'https://openheaders.io/',
        resourceType: 'main_frame',
      }),
    });
    recordObservedFire(1, 'rule-block', 'https://openheaders.io/', 'mf-err', 1_000, {
      resourceType: 'main_frame',
      pattern: 'https://openheaders.io/',
      deferred: false,
    });
    expect(getTabSnapshot(1).fires).toHaveLength(0);

    store.apply({
      kind: 'phase',
      tabId: 1,
      requestId: 'mf-err',
      patch: { phase: 'failed' },
    });

    expect(getTabSnapshot(1).counters['rule-block']).toBe(1);
  });

  it('promotes a failed CDP-document navigation fire (registry-resolved main frame)', () => {
    // CDP tags navigations `document`; the driver buffered the fire as
    // main_frame via the registry, so the failed-nav promotion must resolve
    // the same way or the fire is stranded (no rule attribution).
    setMainFrameId(1, 'frame-main');
    startTracking(1, 'test:t1');
    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({
        tabId: 1,
        requestId: 'cdp-err',
        url: 'https://openheaders.io/',
        resourceType: 'document',
        frameId: 'frame-main',
      }),
    });
    recordObservedFire(1, 'rule-block', 'https://openheaders.io/', 'cdp-err', 1_000, {
      resourceType: 'main_frame',
      pattern: 'https://openheaders.io/',
      deferred: false,
    });
    expect(getTabSnapshot(1).fires).toHaveLength(0);

    store.apply({ kind: 'phase', tabId: 1, requestId: 'cdp-err', patch: { phase: 'failed' } });

    expect(getTabSnapshot(1).counters['rule-block']).toBe(1);
  });

  it('does NOT promote a failed CDP sub-frame document fire (registry says not main frame)', () => {
    setMainFrameId(1, 'frame-main');
    startTracking(1, 'test:t1');
    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({
        tabId: 1,
        requestId: 'cdp-iframe',
        url: 'https://openheaders.io/embed',
        resourceType: 'document',
        frameId: 'frame-child',
      }),
    });
    // A sub-frame document fire is recorded immediately (not buffered), so a
    // failed phase must not double-count via main-frame promotion.
    recordObservedFire(1, 'rule-block', 'https://openheaders.io/embed', 'cdp-iframe', 1_000, {
      resourceType: 'sub_frame',
      pattern: 'https://openheaders.io/embed',
      deferred: false,
    });
    const before = getTabSnapshot(1).counters['rule-block'];

    store.apply({ kind: 'phase', tabId: 1, requestId: 'cdp-iframe', patch: { phase: 'failed' } });

    expect(getTabSnapshot(1).counters['rule-block']).toBe(before);
  });
});

describe('tab-telemetry-source — main-frame chain via store snapshot', () => {
  it('redirect → commit on original URL: pending fires promote via the derived requestId set', () => {
    startTracking(1, 'test:t1');
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

    const matches = mainFrameRequestIdsMatchingCommit(store.snapshotTab(1), 'https://openheaders.io/', () => false);
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

    const matches = mainFrameRequestIdsMatchingCommit(store.snapshotTab(1), 'https://elsewhere.example/', () => false);
    expect(matches.size).toBe(0);
    onPageCommit(1, 'https://elsewhere.example/', matches);
    expect(getTabSnapshot(1).fires).toHaveLength(0);
  });
});

describe('tab-telemetry-source — tab-forgotten via bus', () => {
  it('clears tab-telemetry state when the bus fires tab-forgotten', () => {
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
    expect(__internals.getState(1)).toBeDefined();

    bus.notifyTabForgotten(1);

    expect(__internals.getState(1)).toBeUndefined();
  });

  it('dispose detaches the bus subscription', () => {
    startTracking(2, 'test:t2');
    store.apply({
      kind: 'started',
      lifecycle: makeLifecycle({ tabId: 2, requestId: 'r2', url: 'https://api.openheaders.io/y' }),
    });
    recordObservedFire(2, 'rule-b', 'https://api.openheaders.io/y', 'r2', 1_000, {
      resourceType: 'xmlhttprequest',
      pattern: '*://*.openheaders.io/*',
      deferred: false,
    });

    dispose();
    dispose = () => {};

    bus.notifyTabForgotten(2);
    expect(__internals.getState(2)).toBeDefined();
  });
});

describe('tab-telemetry-source — dispose', () => {
  it('detaches the store subscription so phase projections stop applying', () => {
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

    dispose();
    dispose = () => {};

    store.apply({
      kind: 'phase',
      tabId: 1,
      requestId: 'r1',
      patch: { phase: 'completed', fromCache: true },
    });
    expect(getTabSnapshot(1).fires[0].deliveryMode).toBeUndefined();
  });
});
