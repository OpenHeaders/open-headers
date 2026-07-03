/**
 * SW awareness store — keys per identity.instanceId so multiple
 * instances of the same surface kind coexist as distinct rows.
 */

import type { AwarenessState, PresenceIdentity } from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createAwarenessStore } from '@openheaders/oracle/sync/awareness/awareness';

function makeIdentity(overrides: Partial<PresenceIdentity> = {}): PresenceIdentity {
  return {
    instanceId: 'workbench-1',
    surfaceKind: 'workbench',
    appId: 'extension',
    label: 'Workbench',
    ...overrides,
  };
}

type StateOverrides = Omit<Partial<AwarenessState>, 'identity'> & { identity?: Partial<PresenceIdentity> };

function makeState(overrides: StateOverrides = {}): AwarenessState {
  const { identity: identityOverride, ...rest } = overrides;
  return {
    identity: makeIdentity(identityOverride),
    entityFocus: { type: 'rule', id: 'r1' },
    fieldFocus: { type: 'rule', id: 'r1', path: 'name' },
    dirtyFields: [],
    lastActivityHlc: { physicalMs: 1000, logical: 0, nodeId: 'n1' },
    ...rest,
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

  it('two instances of the same surfaceKind coexist as distinct rows', () => {
    // Regression for the pre-identity bug where two workbench tabs
    // collided on `surfaceId='workbench'` and clobbered each other.
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws', emit, now: () => 1000 });
    store.publish(makeState({ identity: { instanceId: 'workbench-A' } }));
    store.publish(makeState({ identity: { instanceId: 'workbench-B' } }));
    const list = store.list();
    expect(list.map((s) => s.identity.instanceId)).toEqual(['workbench-A', 'workbench-B']);
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
    store.publish(makeState({ identity: { instanceId: 'workbench-A' } }));
    expect(store.list()).toHaveLength(1);

    now = 1000 + 30_001;
    store.publish(
      makeState({
        identity: { instanceId: 'popup-A', surfaceKind: 'popup', label: 'Popup' },
        lastActivityHlc: { physicalMs: now, logical: 0, nodeId: 'n2' },
      }),
    );
    const after = store.list();
    expect(after.map((s) => s.identity.instanceId)).toEqual(['popup-A']);
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

  it('remove() drops a presence row by instanceId and emits', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws', emit, now: () => 1000 });
    store.publish(makeState({ identity: { instanceId: 's1' } }));
    store.publish(makeState({ identity: { instanceId: 's2' } }));
    emit.mockClear();
    store.remove('s1');
    expect(emit).toHaveBeenCalledTimes(1);
    expect(store.list().map((s) => s.identity.instanceId)).toEqual(['s2']);
  });

  it('list() returns rows sorted by instanceId for stable wire shape', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws', emit, now: () => 1000 });
    store.publish(makeState({ identity: { instanceId: 'popup-1', surfaceKind: 'popup' } }));
    store.publish(makeState({ identity: { instanceId: 'devpanel-1', surfaceKind: 'devpanel' } }));
    store.publish(makeState({ identity: { instanceId: 'workbench-1', surfaceKind: 'workbench' } }));
    expect(store.list().map((s) => s.identity.instanceId)).toEqual(['devpanel-1', 'popup-1', 'workbench-1']);
  });

  it('dispose stops subsequent emissions', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws', emit, now: () => 1000 });
    store.publish(makeState());
    emit.mockClear();
    store.dispose();
    store.publish(makeState({ identity: { instanceId: 's2' } }));
    expect(emit).not.toHaveBeenCalled();
    expect(store.list()).toEqual([]);
  });
});
