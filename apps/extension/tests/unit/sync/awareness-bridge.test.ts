/**
 * Awareness bridge handler — pure adapter; verifies request → store
 * dispatch and the response shape.
 */

import type { AwarenessPublishRequest, AwarenessState, PresenceIdentity } from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';
import { type AwarenessStore, createAwarenessStore } from '@/background/sync/awareness';
import { handleAwarenessPublish } from '@/background/sync/awareness-bridge';

function identity(): PresenceIdentity {
  return {
    instanceId: 'workbench-1',
    surfaceKind: 'workbench',
    appId: 'extension',
    label: 'Workbench',
  };
}

function state(): AwarenessState {
  return {
    identity: identity(),
    entityFocus: { type: 'rule', id: 'r1' },
    fieldFocus: null,
    dirtyFields: [],
    lastActivityHlc: { physicalMs: 100, logical: 0, nodeId: 'n1' },
  };
}

describe('handleAwarenessPublish', () => {
  it('dispatches to the matching workspace store and returns post-GC presence', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws-1', emit, now: () => 100 });
    const req: AwarenessPublishRequest = {
      type: 'oh.awareness.publish',
      workspaceId: 'ws-1',
      state: state(),
    };
    const res = handleAwarenessPublish((id) => (id === 'ws-1' ? store : null), req);
    expect(res).toEqual({ ok: true, presence: store.list() });
  });

  it('returns empty presence when the workspace store is missing', () => {
    const req: AwarenessPublishRequest = {
      type: 'oh.awareness.publish',
      workspaceId: 'ws-other',
      state: state(),
    };
    const res = handleAwarenessPublish(() => null, req);
    expect(res).toEqual({ ok: true, presence: [] });
  });

  it('drops cross-workspace publishes (workspace mismatch)', () => {
    const emit = vi.fn();
    const store = createAwarenessStore({ workspaceId: 'ws-1', emit, now: () => 100 });
    const lookup = (id: string): AwarenessStore | null => (id === 'ws-1' ? store : null);
    const res = handleAwarenessPublish(lookup, {
      type: 'oh.awareness.publish',
      workspaceId: 'ws-2',
      state: state(),
    });
    expect(res.presence).toEqual([]);
    expect(store.list()).toEqual([]);
  });
});
