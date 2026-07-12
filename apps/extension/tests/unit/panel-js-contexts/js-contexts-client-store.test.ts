/**
 * JsContextsClientStore — replace-semantics live-set mirror with stable
 * snapshot identity. Sibling of `panel-console/console-client-store.test.ts`.
 */

import type { JsContext } from '@openheaders/core/js-contexts';
import { JsContextsClientStore } from '@openheaders/ui/panel/data/stores/js-contexts-client-store';
import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/stores/notify-scheduler';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Notify-on-mutate semantics are frame-independent; drive them
// synchronously. Frame coalescing is covered in `snapshot-publisher.test.ts`.
beforeEach(() => setNotifyScheduler(createSyncNotifyScheduler()));
afterEach(() => setNotifyScheduler(null));

function context(contextKey: string, over: Partial<JsContext> = {}): JsContext {
  return {
    contextKey,
    origin: 'https://app.openheaders.io',
    name: '',
    isDefault: true,
    targetKind: 'page',
    worldType: 'default',
    ...over,
  };
}

describe('JsContextsClientStore', () => {
  it('upserts by contextKey — add then replace in place', () => {
    const store = new JsContextsClientStore();
    store.upsert(context('page::1'));
    store.upsert(context('page::2'));
    store.upsert(context('page::1', { name: 'renamed' }));
    const { contexts } = store.getSnapshot();
    expect(contexts.map((c) => c.contextKey)).toEqual(['page::1', 'page::2']);
    expect(contexts[0].name).toBe('renamed');
  });

  it('removes by key; unknown keys leave snapshot identity untouched', () => {
    const store = new JsContextsClientStore();
    store.upsert(context('page::1'));
    const before = store.getSnapshot();
    store.remove('page::99');
    expect(store.getSnapshot()).toBe(before);
    store.remove('page::1');
    expect(store.getSnapshot().contexts).toEqual([]);
  });

  it('clear empties; clearing an empty store keeps snapshot identity', () => {
    const store = new JsContextsClientStore();
    const empty = store.getSnapshot();
    store.clear();
    expect(store.getSnapshot()).toBe(empty);
    store.upsert(context('page::1'));
    store.clear();
    expect(store.getSnapshot().contexts).toEqual([]);
  });

  it('notifies subscribers on mutation and returns a fresh snapshot', () => {
    const store = new JsContextsClientStore();
    let notified = 0;
    store.subscribe(() => {
      notified++;
    });
    const before = store.getSnapshot();
    store.upsert(context('page::1'));
    expect(notified).toBe(1);
    expect(store.getSnapshot()).not.toBe(before);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });
});
