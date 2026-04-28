/**
 * Phase A A1 — SW awareness store.
 *
 * Verifies the SW-side GC + emission contract:
 *   - upsert by surfaceId
 *   - prune by HLC physical-time TTL on each publish
 *   - emit canonical presence only when the visible set changes
 *   - sensitive-entity rule strips fieldFocus
 */

import type { AwarenessState } from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createAwarenessStore } from '@/background/sync/awareness';

function makeState(overrides: Partial<AwarenessState> = {}): AwarenessState {
  return {
    surfaceId: 'workbench',
    deviceId: 'd1',
    entityFocus: { type: 'rule', id: 'r1' },
    fieldFocus: { type: 'rule', id: 'r1', path: 'name' },
    dirtyFields: [],
    lastActivityHlc: { physicalMs: 1000, logical: 0, nodeId: 'n1' },
    ...overrides,
  };
}

describe('awareness store', () => {
  it('publishes and emits canonical presence', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws', emit, now: () => 1000 });
    const presence = store.publish(makeState());
    expect(presence).toHaveLength(1);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenLastCalledWith(presence);
  });

  it('dedups identical publishes — no emit when nothing changed', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws', emit, now: () => 1000 });
    store.publish(makeState());
    store.publish(makeState());
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('emits when fieldFocus changes', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws', emit, now: () => 1000 });
    store.publish(makeState());
    store.publish(makeState({ fieldFocus: { type: 'rule', id: 'r1', path: 'enabled' } }));
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('prunes entries older than TTL on next publish', () => {
    const emit = vi.fn();
    let now = 1000;
    const store = createAwarenessStore({
      workspaceId: 'ws',
      emit,
      now: () => now,
      ttlMs: 30_000,
    });
    store.publish(makeState({ surfaceId: 'workbench' }));
    expect(store.list()).toHaveLength(1);

    now = 1000 + 30_001;
    store.publish(
      makeState({
        surfaceId: 'popup',
        lastActivityHlc: { physicalMs: now, logical: 0, nodeId: 'n2' },
      }),
    );
    const after = store.list();
    expect(after.map((s) => s.surfaceId)).toEqual(['popup']);
  });

  it('strips fieldFocus for sensitive entity types', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({
      workspaceId: 'ws',
      emit,
      now: () => 1000,
      sensitiveEntityTypes: new Set(['vault']),
    });
    store.publish(
      makeState({
        entityFocus: { type: 'vault', id: 'v1' },
        fieldFocus: { type: 'vault', id: 'v1', path: 'entries.PROD_KEY' },
      }),
    );
    const list = store.list();
    expect(list[0].fieldFocus).toBeNull();
    expect(list[0].entityFocus).toEqual({ type: 'vault', id: 'v1' });
  });

  it('remove() drops a surface and emits the change', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws', emit, now: () => 1000 });
    store.publish(makeState({ surfaceId: 's1' }));
    store.publish(makeState({ surfaceId: 's2' }));
    emit.mockClear();
    store.remove('s1');
    expect(emit).toHaveBeenCalledTimes(1);
    expect(store.list().map((s) => s.surfaceId)).toEqual(['s2']);
  });

  it('list() returns surfaces sorted by surfaceId for stable wire shape', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws', emit, now: () => 1000 });
    store.publish(makeState({ surfaceId: 'popup' }));
    store.publish(makeState({ surfaceId: 'devpanel' }));
    store.publish(makeState({ surfaceId: 'workbench' }));
    expect(store.list().map((s) => s.surfaceId)).toEqual(['devpanel', 'popup', 'workbench']);
  });

  it('dispose stops subsequent emissions', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws', emit, now: () => 1000 });
    store.publish(makeState());
    emit.mockClear();
    store.dispose();
    store.publish(makeState({ surfaceId: 's2' }));
    expect(emit).not.toHaveBeenCalled();
    expect(store.list()).toEqual([]);
  });
});
