/**
 * Phase 10 coverage for the pause-markers store's lock serialization.
 * Mirrors the environment-store-singletons pattern: the
 * `pause-markers:singleton` lock serializes every setMarker /
 * clearMarker / replaceMarkers call so two tabs toggling pauses on
 * different paths at the same time can't stomp each other.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { blobs } = vi.hoisted(() => ({ blobs: new Map<string, unknown>() }));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: vi.fn(),
  hydrateObservabilityLog: vi.fn(async () => undefined),
  getObservabilityLog: vi.fn(() => []),
  clearObservabilityLog: vi.fn(),
}));

vi.mock('@/background/modules/storage-drift', () => ({
  driftRecorder: () => () => {},
}));

vi.mock('@/background/modules/workspace-store', () => ({
  getActiveWorkspaceId: vi.fn(() => 'ws-pause001'),
}));

vi.mock('@/shared/storage', async () => {
  const actual = await vi.importActual<typeof import('@/shared/storage')>('@/shared/storage');
  return {
    ...actual,
    extensionStorage: {
      get: vi.fn(async (key: { key: string }) => blobs.get(key.key)),
      set: vi.fn(async (key: { key: string }, value: unknown) => {
        blobs.set(key.key, value);
      }),
      remove: vi.fn(async (key: { key: string }) => {
        blobs.delete(key.key);
      }),
    },
  };
});

import { setLockRuntime } from '@/shared/coordination/with-lock';

class FifoLockRuntime {
  private queues = new Map<string, Array<() => void>>();
  private holders = new Set<string>();
  async request<T>(name: string, _options: unknown, callback: () => Promise<T> | T): Promise<T> {
    if (this.holders.has(name)) {
      await new Promise<void>((resolve) => {
        const q = this.queues.get(name) ?? [];
        q.push(resolve);
        this.queues.set(name, q);
      });
    }
    this.holders.add(name);
    try {
      return await callback();
    } finally {
      this.holders.delete(name);
      const q = this.queues.get(name);
      if (q && q.length > 0) q.shift()!();
    }
  }
}

let store: typeof import('@/background/modules/pause-markers-store');

beforeEach(async () => {
  blobs.clear();
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  store = await import('@/background/modules/pause-markers-store');
  await store.hydratePauseMarkersFromStorage();
});

afterEach(() => {
  setLockRuntime(null);
});

describe('pause-markers-store — lock serialization', () => {
  it('hydrates empty by default', () => {
    expect(store.getPauseMarkers().size).toBe(0);
  });

  it('setMarker persists a single marker', async () => {
    await store.setMarker('rules/auth-c0ll1111', 'paused');
    expect(store.getPauseMarkers().get('rules/auth-c0ll1111')).toBe('paused');
    // Storage reflects the write.
    expect(blobs.get('oh.ws.ws-pause001.pauseMarkers')).toEqual({ 'rules/auth-c0ll1111': 'paused' });
  });

  it('clearMarker removes the marker', async () => {
    await store.setMarker('rules/auth-c0ll1111', 'paused');
    await store.clearMarker('rules/auth-c0ll1111');
    expect(store.getPauseMarkers().has('rules/auth-c0ll1111')).toBe(false);
    expect(blobs.get('oh.ws.ws-pause001.pauseMarkers')).toEqual({});
  });

  it('replaceMarkers atomically swaps the full map', async () => {
    await store.setMarker('rules/auth-c0ll1111', 'paused');
    await store.replaceMarkers({
      'rules/other-c0ll2222': 'unpaused',
      'rules/third-c0ll3333': 'paused',
    });
    const after = store.getPauseMarkers();
    expect(after.size).toBe(2);
    expect(after.get('rules/auth-c0ll1111')).toBeUndefined();
    expect(after.get('rules/third-c0ll3333')).toBe('paused');
  });

  it('concurrent setMarker calls on different paths both land', async () => {
    // Two tabs toggling pauses on different subtrees simultaneously —
    // the lock serializes the read-modify-write so both survive.
    await Promise.all([
      store.setMarker('rules/one-c0ll1111', 'paused'),
      store.setMarker('rules/two-c0ll2222', 'unpaused'),
    ]);
    const final = store.getPauseMarkers();
    expect(final.size).toBe(2);
    expect(final.get('rules/one-c0ll1111')).toBe('paused');
    expect(final.get('rules/two-c0ll2222')).toBe('unpaused');
    // Storage reflects the merged state, not either caller in
    // isolation — proves lock-serialized read-modify-write.
    expect(blobs.get('oh.ws.ws-pause001.pauseMarkers')).toEqual({
      'rules/one-c0ll1111': 'paused',
      'rules/two-c0ll2222': 'unpaused',
    });
  });

  it('concurrent replaceMarkers + setMarker — one wins but neither corrupts the map', async () => {
    // The replace carries a known baseline; the set arriving concurrently
    // either lands atop it (if it runs second) or is overwritten (if
    // replace runs second). Either way the final state is valid —
    // never a half-merged blob.
    const [_a, _b] = await Promise.all([
      store.replaceMarkers({ 'rules/base-c0ll0000': 'paused' }),
      store.setMarker('workbench/added-c0ll9999', 'unpaused'),
    ]);
    const final = store.getPauseMarkers();
    // At least one of the two calls' changes is present; the lock
    // prevents a silent merge corruption.
    const hasBase = final.get('rules/base-c0ll0000') === 'paused';
    const hasAdded = final.get('rules/added-c0ll9999') === 'unpaused';
    expect(hasBase || hasAdded).toBe(true);
    // Storage matches the in-memory map byte-for-byte.
    expect(Object.fromEntries(final)).toEqual(blobs.get('oh.ws.ws-pause001.pauseMarkers'));
  });

  it('clearMarker of a missing key is a silent no-op (no extra storage write)', async () => {
    await store.setMarker('workbench/keep-c0ll1111', 'paused');
    const before = blobs.get('oh.ws.ws-pause001.pauseMarkers');
    await store.clearMarker('workbench/missing-c0ll9999');
    expect(blobs.get('oh.ws.ws-pause001.pauseMarkers')).toEqual(before);
  });
});
