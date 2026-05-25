/**
 * `TabLifecycles` LRU container — invariant: per-tab eviction at cap.
 * Backs deliverable S4 + T6.
 */

import { describe, expect, it } from 'vitest';

import { TabLifecycles } from '../../src/request-lifecycle-store/tab-lifecycles';
import { makeLifecycle } from './factories';

describe('TabLifecycles — bounded LRU', () => {
  it('rejects non-positive maxEntries at construction', () => {
    expect(() => new TabLifecycles(0)).toThrow();
    expect(() => new TabLifecycles(-1)).toThrow();
  });

  it('stores up to maxEntries without eviction', () => {
    const tab = new TabLifecycles(3);
    for (let i = 0; i < 3; i++) {
      const { evicted } = tab.set(`req-${i}`, makeLifecycle({ requestId: `req-${i}` }));
      expect(evicted).toBeUndefined();
    }
    expect(tab.size).toBe(3);
  });

  it('evicts the oldest entry when exceeding maxEntries', () => {
    const tab = new TabLifecycles(2);
    tab.set('req-0', makeLifecycle({ requestId: 'req-0', url: 'https://openheaders.io/0' }));
    tab.set('req-1', makeLifecycle({ requestId: 'req-1', url: 'https://openheaders.io/1' }));
    const { evicted } = tab.set(
      'req-2',
      makeLifecycle({ requestId: 'req-2', url: 'https://openheaders.io/2' }),
    );
    expect(evicted?.requestId).toBe('req-0');
    expect(tab.size).toBe(2);
    expect(tab.has('req-0')).toBe(false);
    expect(tab.has('req-2')).toBe(true);
  });

  it('re-setting an existing entry bumps it to most-recent (LRU)', () => {
    const tab = new TabLifecycles(2);
    tab.set('req-0', makeLifecycle({ requestId: 'req-0' }));
    tab.set('req-1', makeLifecycle({ requestId: 'req-1' }));
    // Touch req-0 → it becomes most-recent; req-1 is now oldest.
    tab.set('req-0', makeLifecycle({ requestId: 'req-0', phase: 'completed' }));
    const { evicted } = tab.set('req-2', makeLifecycle({ requestId: 'req-2' }));
    expect(evicted?.requestId).toBe('req-1');
    expect(tab.has('req-0')).toBe(true);
  });

  it('delete returns true on hit, false on miss; values() iterates remaining', () => {
    const tab = new TabLifecycles(4);
    tab.set('req-0', makeLifecycle({ requestId: 'req-0' }));
    tab.set('req-1', makeLifecycle({ requestId: 'req-1' }));
    expect(tab.delete('req-0')).toBe(true);
    expect(tab.delete('req-0')).toBe(false);
    const ids = [...tab.values()].map((l) => l.requestId);
    expect(ids).toEqual(['req-1']);
  });
});
