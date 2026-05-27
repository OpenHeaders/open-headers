/**
 * `installTabLifecycleBridge` — integration coverage that the
 * chrome.tabs.onRemoved chain fires both downstream drivers via
 * `TabLifecycleBus`, in the correct order: correlator detach →
 * bus tab-forgotten (drivers run) → store forgetTab.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import {
  clearAllTracking,
  hasTrackedTab,
  setTrackedResource,
} from '@openheaders/oracle/tracking/tab-tracking-store';

import { installTabLifecycleBridge } from '@/background/correlator-host/tab-lifecycle-bridge';
import { startRuleEngineDriver } from '@/background/rule-engine-driver';
import { startTabTelemetrySource } from '@/background/tab-telemetry-source';
import { __internals, __resetForTests, startTracking } from '@/background/modules/tab-telemetry';

function captureOnRemoved(): (tabId: number) => void {
  const addListener = chrome.tabs.onRemoved.addListener as ReturnType<typeof vi.fn>;
  const last = addListener.mock.calls[addListener.mock.calls.length - 1];
  expect(last).toBeDefined();
  return last[0] as (tabId: number) => void;
}

let store: RequestLifecycleStore;
let bus: TabLifecycleBus;
let detachBridge: () => void;
let disposeRule: () => void;
let disposeTelemetry: () => void;
const detachTab = vi.fn();

beforeEach(() => {
  __resetForTests();
  clearAllTracking();
  detachTab.mockReset();
  (chrome.tabs.onRemoved.addListener as ReturnType<typeof vi.fn>).mockClear();

  store = new RequestLifecycleStore();
  bus = new TabLifecycleBus();

  detachBridge = installTabLifecycleBridge({
    correlator: { attachTab: vi.fn(), detachTab },
    store,
    bus,
  });
  disposeRule = startRuleEngineDriver({ store, updateBadge: () => {}, bus }).dispose;
  disposeTelemetry = startTabTelemetrySource({ store, bus }).dispose;
});

afterEach(() => {
  disposeTelemetry();
  disposeRule();
  detachBridge();
  clearAllTracking();
});

describe('tab-lifecycle-bridge — chrome.tabs.onRemoved → bus chain', () => {
  it('fires both drivers via the bus and respects ordering', () => {
    setTrackedResource(42, 'https://openheaders.io/a', 'main_frame', 'webRequest', false);
    startTracking(42, 'test:42');
    expect(__internals.getState(42)).toBeDefined();

    const forgetTab = vi.spyOn(store, 'forgetTab');

    const onRemoved = captureOnRemoved();
    onRemoved(42);

    expect(detachTab).toHaveBeenCalledWith(42);
    expect(hasTrackedTab(42)).toBe(false);
    expect(__internals.getState(42)).toBeUndefined();
    expect(forgetTab).toHaveBeenCalledWith(42);

    // Ordering: correlator.detachTab → drivers (via bus) → store.forgetTab.
    const detachOrder = detachTab.mock.invocationCallOrder[0];
    const storeOrder = forgetTab.mock.invocationCallOrder[0];
    expect(detachOrder).toBeLessThan(storeOrder);
  });
});
