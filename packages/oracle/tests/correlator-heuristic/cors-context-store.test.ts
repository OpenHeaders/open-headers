/**
 * `CorsContextStore` — per-(tabId, requestId) origin + verdict buffer.
 */

import { describe, expect, it, vi } from 'vitest';

import type { CorsVerdict } from '@openheaders/core/request-lifecycle';

import { MAX_CORS_ENTRIES_PER_TAB } from '../../src/correlator-heuristic/cors-constants';
import { CorsContextStore } from '../../src/correlator-heuristic/cors-context-store';

const TAB = 9;
const verdict = (): CorsVerdict => ({
  isCrossOrigin: true,
  rejection: { kind: 'missing-acao' },
});

describe('CorsContextStore — record / finalize / consume', () => {
  it('consume returns undefined when nothing was recorded', () => {
    const store = new CorsContextStore();
    expect(store.consume(TAB, 'wr-1')).toBeUndefined();
  });

  it('consume returns undefined when origin was recorded but verdict was not finalized', () => {
    const store = new CorsContextStore();
    store.recordOrigin(TAB, 'wr-1', 'https://app.openheaders.io');
    expect(store.consume(TAB, 'wr-1')).toBeUndefined();
    // Consumed regardless — entry is gone.
    expect(store.size()).toBe(0);
  });

  it('finalize then consume returns the verdict and drops the entry', () => {
    const store = new CorsContextStore();
    store.recordOrigin(TAB, 'wr-1', 'https://app.openheaders.io');
    const v = verdict();
    store.finalize(TAB, 'wr-1', v);
    expect(store.consume(TAB, 'wr-1')).toEqual(v);
    expect(store.consume(TAB, 'wr-1')).toBeUndefined();
  });

  it('getOrigin returns the captured origin without consuming', () => {
    const store = new CorsContextStore();
    store.recordOrigin(TAB, 'wr-1', 'https://app.openheaders.io');
    expect(store.getOrigin(TAB, 'wr-1')).toBe('https://app.openheaders.io');
    expect(store.getOrigin(TAB, 'wr-1')).toBe('https://app.openheaders.io');
    expect(store.size()).toBe(1);
  });

  it('getOrigin returns null for unknown (tab, request)', () => {
    const store = new CorsContextStore();
    expect(store.getOrigin(TAB, 'wr-x')).toBeNull();
  });

  it('recordOrigin overwrites and preserves nothing of the previous verdict', () => {
    const store = new CorsContextStore();
    store.recordOrigin(TAB, 'wr-1', 'https://app.openheaders.io');
    store.finalize(TAB, 'wr-1', verdict());
    // Simulates a redirect hop: same requestId fires onSendHeaders again.
    store.recordOrigin(TAB, 'wr-1', 'https://other.openheaders.io');
    expect(store.getOrigin(TAB, 'wr-1')).toBe('https://other.openheaders.io');
    expect(store.consume(TAB, 'wr-1')).toBeUndefined();
  });

  it('finalize without a prior recordOrigin still stores the verdict', () => {
    const store = new CorsContextStore();
    store.finalize(TAB, 'wr-1', verdict());
    expect(store.consume(TAB, 'wr-1')).toEqual(verdict());
  });
});

describe('CorsContextStore — LRU + tab scope', () => {
  it('exceeding MAX_CORS_ENTRIES_PER_TAB evicts the oldest entry and fires onDrop', () => {
    const onDrop = vi.fn();
    const store = new CorsContextStore(onDrop);
    for (let i = 0; i < MAX_CORS_ENTRIES_PER_TAB; i++) {
      store.recordOrigin(TAB, `wr-${i}`, 'https://app.openheaders.io');
    }
    expect(store.size()).toBe(MAX_CORS_ENTRIES_PER_TAB);
    store.recordOrigin(TAB, 'wr-overflow', 'https://app.openheaders.io');
    expect(store.size()).toBe(MAX_CORS_ENTRIES_PER_TAB);
    expect(onDrop).toHaveBeenCalledWith({ tabId: TAB, requestId: 'wr-0', reason: 'lru' });
  });

  it('forgetTab drops every entry for that tab', () => {
    const store = new CorsContextStore();
    store.recordOrigin(TAB, 'wr-1', 'https://app.openheaders.io');
    store.recordOrigin(TAB, 'wr-2', 'https://app.openheaders.io');
    store.recordOrigin(TAB + 1, 'wr-3', 'https://app.openheaders.io');
    store.forgetTab(TAB);
    expect(store.size()).toBe(1);
    expect(store.getOrigin(TAB, 'wr-1')).toBeNull();
    expect(store.getOrigin(TAB + 1, 'wr-3')).toBe('https://app.openheaders.io');
  });

  it('forgetTab fires onDrop with tab-forgotten for each entry', () => {
    const onDrop = vi.fn();
    const store = new CorsContextStore(onDrop);
    store.recordOrigin(TAB, 'wr-1', 'https://app.openheaders.io');
    store.recordOrigin(TAB, 'wr-2', 'https://app.openheaders.io');
    store.forgetTab(TAB);
    expect(onDrop).toHaveBeenCalledTimes(2);
    expect(onDrop).toHaveBeenCalledWith({ tabId: TAB, requestId: 'wr-1', reason: 'tab-forgotten' });
    expect(onDrop).toHaveBeenCalledWith({ tabId: TAB, requestId: 'wr-2', reason: 'tab-forgotten' });
  });
});
