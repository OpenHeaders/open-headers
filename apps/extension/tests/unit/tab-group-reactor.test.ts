/**
 * Tab-group reactor — in-browser feedback for AI capture. Asserts:
 *   - an unavailable tab-group API yields a silent no-op reactor
 *   - the first captured transition groups the tab into a decorated
 *     blue group; a re-push or a second backend never regroups
 *   - release restores the prior grouping: none → ungrouped, a live
 *     user group → back into it, a dissolved one → ungrouped
 *   - captured tabs in one window share one group; windows never share
 *   - a tab the user pulled out of the group is left out on release
 *   - a closed tab drops its bookkeeping without touching the browser
 *   - bookkeeping survives an SW restart: a release after hydration
 *     still restores, and the reconcile sweep ends orphaned groups
 */

import { getHostStorage, type HostStorage, OH, type StorageKey, setHostStorage } from '@openheaders/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __resetCapturedTabsForTests, capturedTabsDropBackend, capturedTabsReplace } from '@/background/captured-tabs';
import { startTabGroupReactor, type TabGroupPort, type TabGroupReactor } from '@/background/tab-group-reactor';

const NO_GROUP = -1;

/** Map-backed HostStorage — enough surface for the reactor's
 *  bookkeeping persistence (get/set/remove by key; the rest inert). */
function makeFakeStorage(data: Map<string, unknown>): HostStorage {
  return {
    get: async <T>(spec: StorageKey<T>) => data.get(spec.key) as T | undefined,
    getMany: async <M extends Record<string, StorageKey<unknown>>>(specs: M) => {
      const out: Record<string, unknown> = {};
      for (const [name, spec] of Object.entries(specs)) out[name] = data.get(spec.key);
      return out as { [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never };
    },
    set: async <T>(spec: StorageKey<T>, value: T) => {
      data.set(spec.key, value);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) data.set(spec.key, value);
    },
    remove: async (specs) => {
      for (const spec of Array.isArray(specs) ? specs : [specs]) data.delete(spec.key);
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: () => () => {},
  };
}

interface FakeTab {
  windowId: number;
  groupId: number;
}

class FakePort implements TabGroupPort {
  tabs = new Map<number, FakeTab>();
  /** groupId → windowId for every live group (user-made ones seeded). */
  groups = new Map<number, number>();
  decorated: number[] = [];
  calls: string[] = [];
  availableFlag = true;
  private nextGroupId = 100;
  private removedListeners: Array<(tabId: number) => void> = [];

  addTab(tabId: number, windowId: number, groupId = NO_GROUP): void {
    this.tabs.set(tabId, { windowId, groupId });
    if (groupId !== NO_GROUP) this.groups.set(groupId, windowId);
  }

  closeTab(tabId: number): void {
    this.tabs.delete(tabId);
    for (const listener of [...this.removedListeners]) listener(tabId);
  }

  available(): boolean {
    return this.availableFlag;
  }

  async tab(tabId: number): Promise<{ windowId: number; groupId: number } | null> {
    const tab = this.tabs.get(tabId);
    return tab ? { ...tab } : null;
  }

  async group(tabId: number, groupId?: number): Promise<number | null> {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;
    let target = groupId;
    if (target === undefined) {
      target = this.nextGroupId++;
      this.groups.set(target, tab.windowId);
    } else if (!this.groups.has(target)) {
      return null;
    }
    tab.groupId = target;
    this.calls.push(`group:${tabId}:${target}`);
    return target;
  }

  async ungroup(tabId: number): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (tab) tab.groupId = NO_GROUP;
    this.calls.push(`ungroup:${tabId}`);
  }

  async decorate(groupId: number): Promise<void> {
    this.decorated.push(groupId);
  }

  async windowOf(groupId: number): Promise<number | null> {
    return this.groups.get(groupId) ?? null;
  }

  onTabRemoved(listener: (tabId: number) => void): () => void {
    this.removedListeners.push(listener);
    return () => {
      this.removedListeners = this.removedListeners.filter((l) => l !== listener);
    };
  }
}

let port: FakePort;
let reactor: TabGroupReactor | null;

function start(options?: { reconcileDelayMs?: number }): TabGroupReactor {
  reactor = startTabGroupReactor({ port, ...options });
  return reactor;
}

async function storedEntries(): Promise<Record<string, { priorGroupId: number; groupId: number }>> {
  return (await getHostStorage()?.get(OH.tabGroupFeedback)) ?? {};
}

beforeEach(() => {
  __resetCapturedTabsForTests();
  setHostStorage(makeFakeStorage(new Map()));
  port = new FakePort();
  reactor = null;
});

afterEach(() => {
  reactor?.dispose();
});

describe('startTabGroupReactor', () => {
  it('a browser without tab groups gets a silent no-op', async () => {
    port.availableFlag = false;
    port.addTab(1, 10);
    const r = start();
    capturedTabsReplace('b1', [1]);
    await r.settled();
    expect(port.calls).toEqual([]);
    expect(await storedEntries()).toEqual({});
  });

  it('the first captured transition groups the tab; a re-push or second backend never regroups', async () => {
    port.addTab(1, 10);
    const r = start();
    capturedTabsReplace('b1', [1]);
    await r.settled();
    expect(port.tabs.get(1)?.groupId).toBe(100);
    expect(port.decorated).toEqual([100]);
    expect(await storedEntries()).toEqual({ '1': { priorGroupId: NO_GROUP, groupId: 100 } });

    // Idempotent full-set re-push + a second backend holding the same
    // tab — neither is a union edge, so no second group call.
    capturedTabsReplace('b1', [1]);
    capturedTabsReplace('b2', [1]);
    await r.settled();
    expect(port.calls.filter((c) => c.startsWith('group:'))).toHaveLength(1);
  });

  it('the last backend releasing ungroups a tab that had no prior group', async () => {
    port.addTab(1, 10);
    const r = start();
    capturedTabsReplace('b1', [1]);
    capturedTabsReplace('b2', [1]);
    await r.settled();
    capturedTabsReplace('b1', []);
    await r.settled();
    expect(port.tabs.get(1)?.groupId).toBe(100);
    // The other backend's wire closes — the drop is the release edge.
    capturedTabsDropBackend('b2');
    await r.settled();
    expect(port.tabs.get(1)?.groupId).toBe(NO_GROUP);
    expect(await storedEntries()).toEqual({});
  });

  it('release restores a live prior user group and falls back to ungroup for a dissolved one', async () => {
    port.addTab(1, 10, 50);
    const r = start();
    capturedTabsReplace('b1', [1]);
    await r.settled();
    expect(port.tabs.get(1)?.groupId).toBe(100);
    capturedTabsReplace('b1', []);
    await r.settled();
    expect(port.tabs.get(1)?.groupId).toBe(50);

    // Re-capture; the user group dissolves while captured — restore
    // falls back.
    capturedTabsReplace('b1', [1]);
    await r.settled();
    port.groups.delete(50);
    capturedTabsReplace('b1', []);
    await r.settled();
    expect(port.tabs.get(1)?.groupId).toBe(NO_GROUP);
  });

  it('captured tabs in one window share one group; windows never share', async () => {
    port.addTab(1, 10);
    port.addTab(2, 10);
    port.addTab(3, 20);
    const r = start();
    capturedTabsReplace('b1', [1, 2, 3]);
    await r.settled();
    expect(port.tabs.get(1)?.groupId).toBe(port.tabs.get(2)?.groupId);
    expect(port.tabs.get(3)?.groupId).not.toBe(port.tabs.get(1)?.groupId);
    expect(port.decorated).toHaveLength(2);
  });

  it('a tab the user pulled out of the group is left out on release', async () => {
    port.addTab(1, 10);
    const r = start();
    capturedTabsReplace('b1', [1]);
    await r.settled();
    // The user drags the tab out while it stays captured.
    const tab = port.tabs.get(1);
    if (tab) tab.groupId = NO_GROUP;
    const callsBefore = port.calls.length;
    capturedTabsReplace('b1', []);
    await r.settled();
    expect(port.calls).toHaveLength(callsBefore);
    expect(port.tabs.get(1)?.groupId).toBe(NO_GROUP);
    expect(await storedEntries()).toEqual({});
  });

  it('a closed tab drops its bookkeeping without touching the browser', async () => {
    port.addTab(1, 10);
    const r = start();
    capturedTabsReplace('b1', [1]);
    await r.settled();
    port.closeTab(1);
    await r.settled();
    expect(await storedEntries()).toEqual({});
    const callsBefore = port.calls.length;
    capturedTabsReplace('b1', []);
    await r.settled();
    expect(port.calls).toHaveLength(callsBefore);
  });

  it('bookkeeping survives a restart: a release after hydration restores the prior grouping', async () => {
    port.addTab(1, 10, 50);
    const first = start();
    capturedTabsReplace('b1', [1]);
    await first.settled();
    expect(port.tabs.get(1)?.groupId).toBe(100);
    first.dispose();
    // The SW dies — the in-memory ledger dies with it; the persisted
    // bookkeeping is what survives.
    __resetCapturedTabsForTests();

    // The daemon re-pushes the captured set after the restart.
    const second = start();
    capturedTabsReplace('b1', [1]);
    await second.settled();
    // Grouping happened at the original transition — no second group.
    expect(port.calls.filter((c) => c.startsWith('group:1:100'))).toHaveLength(1);
    capturedTabsReplace('b1', []);
    await second.settled();
    expect(port.tabs.get(1)?.groupId).toBe(50);
    expect(await storedEntries()).toEqual({});
  });

  it('the reconcile sweep ends groups whose capture never re-announced', async () => {
    port.addTab(1, 10);
    const first = start();
    capturedTabsReplace('b1', [1]);
    await first.settled();
    first.dispose();
    __resetCapturedTabsForTests();

    const second = start({ reconcileDelayMs: 5 });
    await new Promise((resolve) => setTimeout(resolve, 25));
    await second.settled();
    expect(port.tabs.get(1)?.groupId).toBe(NO_GROUP);
    expect(await storedEntries()).toEqual({});
  });
});
