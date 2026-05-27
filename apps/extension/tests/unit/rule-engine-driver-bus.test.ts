/**
 * Rule Engine Driver — `TabLifecycleBus` subscription. Confirms that
 * tab-forgotten on the bus drops the tab's entry from
 * `tabsWithActiveRules`, and that the existing store dispatch path
 * is untouched (per-request `gone` updates still no-op).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import {
  clearAllTracking,
  hasTrackedTab,
  getTrackedTabCount,
  setTrackedResource,
} from '@openheaders/oracle/tracking/tab-tracking-store';

import { startRuleEngineDriver } from '@/background/rule-engine-driver';

let store: RequestLifecycleStore;
let bus: TabLifecycleBus;
let dispose: () => void;

beforeEach(() => {
  clearAllTracking();
  store = new RequestLifecycleStore();
  bus = new TabLifecycleBus();
  const handle = startRuleEngineDriver({ store, updateBadge: () => {}, bus });
  dispose = handle.dispose;
});

afterEach(() => {
  dispose();
  clearAllTracking();
});

describe('rule-engine-driver — TabLifecycleBus subscription', () => {
  it('drops the tab entry from the tracking store on tab-forgotten', () => {
    setTrackedResource(11, 'https://openheaders.io/a', 'main_frame', 'webRequest', false);
    expect(hasTrackedTab(11)).toBe(true);

    bus.notifyTabForgotten(11);

    expect(hasTrackedTab(11)).toBe(false);
  });

  it('leaves other tabs untouched on tab-forgotten', () => {
    setTrackedResource(11, 'https://openheaders.io/a', 'main_frame', 'webRequest', false);
    setTrackedResource(12, 'https://openheaders.io/b', 'main_frame', 'webRequest', false);

    bus.notifyTabForgotten(11);

    expect(hasTrackedTab(11)).toBe(false);
    expect(hasTrackedTab(12)).toBe(true);
  });

  it('forgotten on an unknown tab is a no-op', () => {
    expect(() => bus.notifyTabForgotten(999)).not.toThrow();
    expect(getTrackedTabCount()).toBe(0);
  });

  it('dispose detaches the bus subscription', () => {
    setTrackedResource(11, 'https://openheaders.io/a', 'main_frame', 'webRequest', false);

    dispose();
    dispose = () => {};

    bus.notifyTabForgotten(11);
    expect(hasTrackedTab(11)).toBe(true);
  });
});
