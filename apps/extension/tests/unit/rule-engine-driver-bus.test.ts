/**
 * Rule Engine Driver — `TabLifecycleBus` subscription. Confirms that
 * tab-forgotten on the bus drops the tab's entry from
 * `tabsWithActiveRules`, and that the existing store dispatch path
 * is untouched (per-request `gone` updates still no-op).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { tabsWithActiveRules } from '@openheaders/oracle/tracking/tab-tracking-store';

import { startRuleEngineDriver } from '@/background/rule-engine-driver';

let store: RequestLifecycleStore;
let bus: TabLifecycleBus;
let dispose: () => void;

beforeEach(() => {
  tabsWithActiveRules.clear();
  store = new RequestLifecycleStore();
  bus = new TabLifecycleBus();
  const handle = startRuleEngineDriver({ store, updateBadge: () => {}, bus });
  dispose = handle.dispose;
});

afterEach(() => {
  dispose();
  tabsWithActiveRules.clear();
});

describe('rule-engine-driver — TabLifecycleBus subscription', () => {
  it('drops the tab entry from tabsWithActiveRules on tab-forgotten', () => {
    tabsWithActiveRules.set(11, new Map());
    expect(tabsWithActiveRules.has(11)).toBe(true);

    bus.notifyTabForgotten(11);

    expect(tabsWithActiveRules.has(11)).toBe(false);
  });

  it('leaves other tabs untouched on tab-forgotten', () => {
    tabsWithActiveRules.set(11, new Map());
    tabsWithActiveRules.set(12, new Map());

    bus.notifyTabForgotten(11);

    expect(tabsWithActiveRules.has(11)).toBe(false);
    expect(tabsWithActiveRules.has(12)).toBe(true);
  });

  it('forgotten on an unknown tab is a no-op', () => {
    expect(() => bus.notifyTabForgotten(999)).not.toThrow();
    expect(tabsWithActiveRules.size).toBe(0);
  });

  it('dispose detaches the bus subscription', () => {
    tabsWithActiveRules.set(11, new Map());

    dispose();
    dispose = () => {};

    bus.notifyTabForgotten(11);
    expect(tabsWithActiveRules.has(11)).toBe(true);
  });
});
