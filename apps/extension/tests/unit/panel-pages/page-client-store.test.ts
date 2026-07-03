import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/stores/notify-scheduler';
import { PageClientStore } from '@openheaders/ui/panel/data/stores/page-client-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Notify-on-mutate semantics are frame-independent; drive them
// synchronously. Frame coalescing is covered in `snapshot-publisher.test.ts`.
beforeEach(() => setNotifyScheduler(createSyncNotifyScheduler()));
afterEach(() => setNotifyScheduler(null));

describe('PageClientStore', () => {
  it('starts empty with a frozen snapshot', () => {
    const store = new PageClientStore();
    expect(store.getSnapshot().pages).toEqual([]);
  });

  it('notifies subscribers on real mutations and skips noops', () => {
    const store = new PageClientStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.apply({
      kind: 'page-started',
      tabId: 1,
      page: { id: 'page_1', startedAtMs: 1, url: null },
    });
    expect(listener).toHaveBeenCalledTimes(1);

    store.apply({
      kind: 'page-started',
      tabId: 1,
      page: { id: 'page_1', startedAtMs: 1, url: null },
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps snapshot identity stable until mutation', () => {
    const store = new PageClientStore();
    const a = store.getSnapshot();
    expect(store.getSnapshot()).toBe(a);
    store.apply({
      kind: 'page-started',
      tabId: 1,
      page: { id: 'page_1', startedAtMs: 1, url: 'https://openheaders.io' },
    });
    const b = store.getSnapshot();
    expect(b).not.toBe(a);
    expect(b.pages[0].url).toBe('https://openheaders.io');
  });

  it('clear() empties + notifies; NOOP on already-empty', () => {
    const store = new PageClientStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.clear();
    expect(listener).toHaveBeenCalledTimes(0);
    store.apply({
      kind: 'page-started',
      tabId: 1,
      page: { id: 'page_1', startedAtMs: 1, url: null },
    });
    listener.mockClear();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().pages).toEqual([]);
  });

  it('unsubscribe stops notifications', () => {
    const store = new PageClientStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.apply({
      kind: 'page-started',
      tabId: 1,
      page: { id: 'page_1', startedAtMs: 1, url: null },
    });
    expect(listener).not.toHaveBeenCalled();
  });
});
