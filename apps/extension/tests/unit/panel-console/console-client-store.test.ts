import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { ConsoleClientStore } from '@openheaders/ui/panel/data/console-client-store';
import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/notify-scheduler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Notify-on-mutate semantics are frame-independent; drive them
// synchronously. Frame coalescing is covered in `snapshot-publisher.test.ts`.
beforeEach(() => setNotifyScheduler(createSyncNotifyScheduler()));
afterEach(() => setNotifyScheduler(null));

function entry(over: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return {
    source: 'console-api',
    level: 'log',
    args: [{ type: 'string', text: 'hello from openheaders.io' }],
    timestamp: 1000,
    ...over,
  };
}

describe('ConsoleClientStore', () => {
  it('starts empty + frozen snapshot', () => {
    const store = new ConsoleClientStore();
    expect(store.getSnapshot().entries).toEqual([]);
  });

  it('append pushes a new entry + notifies', () => {
    const store = new ConsoleClientStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.append(entry());
    expect(store.getSnapshot().entries).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('append keeps arrival order — console output never merges', () => {
    const store = new ConsoleClientStore();
    store.append(entry({ timestamp: 1 }));
    store.append(entry({ timestamp: 2 }));
    store.append(entry({ timestamp: 3 }));
    expect(store.getSnapshot().entries.map((e: ConsoleEntry) => e.timestamp)).toEqual([1, 2, 3]);
  });

  it('clear() empties + notifies; NOOP on already-empty', () => {
    const store = new ConsoleClientStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.clear();
    expect(listener).not.toHaveBeenCalled();
    store.append(entry());
    listener.mockClear();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().entries).toEqual([]);
  });

  it('caps the log at the engine retention window, evicting the oldest', () => {
    const store = new ConsoleClientStore();
    for (let i = 0; i < 1001; i++) store.append(entry({ timestamp: i }));
    const entries = store.getSnapshot().entries;
    expect(entries).toHaveLength(1000);
    // Entry 0 was evicted; the window holds the most recent 1000.
    expect(entries[0].timestamp).toBe(1);
    expect(entries[entries.length - 1].timestamp).toBe(1000);
  });

  it('snapshot identity is stable across getSnapshot calls until a mutation', () => {
    const store = new ConsoleClientStore();
    const a = store.getSnapshot();
    expect(store.getSnapshot()).toBe(a);
    store.append(entry());
    expect(store.getSnapshot()).not.toBe(a);
  });
});
