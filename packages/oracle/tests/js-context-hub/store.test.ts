import type { JsContext } from '@openheaders/core/js-contexts';
import { describe, expect, it } from 'vitest';

import { JsContextStore } from '../../src/js-context-hub/store';

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

describe('JsContextStore — replace semantics', () => {
  it('set adds, replaces on change, and short-circuits a field-identical re-add', () => {
    const store = new JsContextStore();
    expect(store.set(1, context('page::1'))).toBe(true);
    // The standing Runtime.enable replays live contexts on attach — a
    // field-identical re-add must not read as a change.
    expect(store.set(1, context('page::1'))).toBe(false);
    expect(store.set(1, context('page::1', { name: 'renamed' }))).toBe(true);
    expect(store.snapshotTab(1)).toHaveLength(1);
    expect(store.snapshotTab(1)[0].name).toBe('renamed');
  });

  it('remove deletes by key and reports whether it existed', () => {
    const store = new JsContextStore();
    store.set(1, context('page::1'));
    expect(store.remove(1, 'page::1')).toBe(true);
    expect(store.remove(1, 'page::1')).toBe(false);
    expect(store.remove(2, 'page::1')).toBe(false);
    expect(store.snapshotTab(1)).toEqual([]);
  });

  it('clearSession drops exactly the session-prefixed subset and returns the removed keys', () => {
    const store = new JsContextStore();
    store.set(1, context('page::1'));
    store.set(1, context('page::2'));
    store.set(1, context('child-a::1', { targetKind: 'iframe' }));
    expect(store.clearSession(1, 'page')).toEqual(['page::1', 'page::2']);
    expect(store.snapshotTab(1).map((c) => c.contextKey)).toEqual(['child-a::1']);
    expect(store.clearSession(1, 'page')).toEqual([]);
  });

  it('keeps tabs isolated and forgets a tab wholesale', () => {
    const store = new JsContextStore();
    store.set(1, context('page::1'));
    store.set(2, context('page::1'));
    expect(store.forgetTab(1)).toBe(true);
    expect(store.forgetTab(1)).toBe(false);
    expect(store.snapshotTab(1)).toEqual([]);
    expect(store.snapshotTab(2)).toHaveLength(1);
  });

  it('snapshots in first-add order with replaces keeping their slot', () => {
    const store = new JsContextStore();
    store.set(1, context('page::1'));
    store.set(1, context('page::2'));
    store.set(1, context('page::1', { name: 'replaced' }));
    expect(store.snapshotTab(1).map((c) => c.contextKey)).toEqual(['page::1', 'page::2']);
  });
});
