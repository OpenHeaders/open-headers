/**
 * Phase A A1 — renderer-side awareness mirror.
 *
 * Verifies the mirror folds `awarenessBroadcast` events, supports
 * entity- and field-level queries, and notifies subscribers.
 */

import type { AwarenessState } from '@openheaders/core/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSubscribe, mockCall } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockCall: vi.fn(),
}));

vi.mock('@utils/bridge', () => ({
  call: mockCall,
  subscribe: mockSubscribe,
  broadcast: vi.fn(),
  receive: vi.fn(),
  presence: vi.fn(),
  tabCall: vi.fn(),
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  createAwarenessMirror,
  disposeActiveAwarenessMirror,
  getActiveAwarenessMirror,
} from '@/context/awareness-mirror';

type Handler = (event: { workspaceId: string; presence: AwarenessState[] }) => void;

let lastHandler: Handler | null = null;
let unsub: ReturnType<typeof vi.fn>;

beforeEach(() => {
  lastHandler = null;
  unsub = vi.fn();
  mockSubscribe.mockReset();
  mockSubscribe.mockImplementation((type: string, handler: Handler) => {
    if (type === 'awarenessBroadcast') lastHandler = handler;
    return unsub;
  });
  mockCall.mockReset();
  mockCall.mockResolvedValue({ workspaceId: null, presence: [] });
});

afterEach(() => {
  disposeActiveAwarenessMirror();
});

function s(overrides: Partial<AwarenessState> = {}): AwarenessState {
  return {
    surfaceId: 'workbench',
    deviceId: 'd1',
    entityFocus: { type: 'rule', id: 'r1' },
    fieldFocus: { type: 'rule', id: 'r1', path: 'name' },
    dirtyFields: [],
    lastActivityHlc: { physicalMs: 100, logical: 0, nodeId: 'n1' },
    ...overrides,
  };
}

describe('awareness mirror', () => {
  it('folds broadcast presence into local state', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    expect(lastHandler).not.toBeNull();
    lastHandler!({ workspaceId: 'ws', presence: [s({ surfaceId: 'popup' })] });
    expect(m.getWorkspaceId()).toBe('ws');
    expect(m.getPresence().map((p) => p.surfaceId)).toEqual(['popup']);
  });

  it('getPresenceForEntity filters by (type, id) and supports excludeSurfaceId', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    lastHandler!({
      workspaceId: 'ws',
      presence: [
        s({ surfaceId: 'workbench', entityFocus: { type: 'rule', id: 'r1' } }),
        s({ surfaceId: 'popup', entityFocus: { type: 'rule', id: 'r2' } }),
        s({ surfaceId: 'devpanel', entityFocus: { type: 'rule', id: 'r1' } }),
      ],
    });
    const r1 = m.getPresenceForEntity({ type: 'rule', id: 'r1' });
    expect(r1.map((p) => p.surfaceId).sort()).toEqual(['devpanel', 'workbench']);
    const r1NotMe = m.getPresenceForEntity({ type: 'rule', id: 'r1' }, { excludeSurfaceId: 'workbench' });
    expect(r1NotMe.map((p) => p.surfaceId)).toEqual(['devpanel']);
  });

  it('getPresenceForField matches type+id+path exactly', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    lastHandler!({
      workspaceId: 'ws',
      presence: [
        s({ surfaceId: 'a', fieldFocus: { type: 'rule', id: 'r1', path: 'name' } }),
        s({ surfaceId: 'b', fieldFocus: { type: 'rule', id: 'r1', path: 'enabled' } }),
        s({ surfaceId: 'c', fieldFocus: null }),
      ],
    });
    const matches = m.getPresenceForField({ type: 'rule', id: 'r1', path: 'name' });
    expect(matches.map((p) => p.surfaceId)).toEqual(['a']);
  });

  it('subscribeEntity notifies on entity changes', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    const cb = vi.fn();
    m.subscribeEntity({ type: 'rule', id: 'r1' }, cb);
    lastHandler!({ workspaceId: 'ws', presence: [s({ entityFocus: { type: 'rule', id: 'r1' } })] });
    expect(cb).toHaveBeenCalledTimes(1);
    // Unrelated entity → still notifies because all-listeners fire on
    // every broadcast, but entity-specific listeners only when the
    // entity is involved on either side of the diff.
    cb.mockClear();
    lastHandler!({ workspaceId: 'ws', presence: [s({ entityFocus: { type: 'rule', id: 'r2' } })] });
    // r1 disappeared and r2 appeared → r1's bucket should still fire
    // because r1 left the visible set.
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('subscribe() fires on every broadcast', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    const cb = vi.fn();
    m.subscribe(cb);
    lastHandler!({ workspaceId: 'ws', presence: [] });
    lastHandler!({ workspaceId: 'ws', presence: [s()] });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('singleton accessor returns the same instance until disposed', () => {
    const m1 = getActiveAwarenessMirror();
    const m2 = getActiveAwarenessMirror();
    expect(m1).toBe(m2);
    disposeActiveAwarenessMirror();
    const m3 = getActiveAwarenessMirror();
    expect(m3).not.toBe(m1);
  });

  it('bootstrap snapshot seeds when no broadcast has landed yet', async () => {
    mockCall.mockResolvedValueOnce({ workspaceId: 'ws-init', presence: [s({ surfaceId: 'popup' })] });
    const m = createAwarenessMirror({ bootstrap: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(m.getWorkspaceId()).toBe('ws-init');
    expect(m.getPresence().map((p) => p.surfaceId)).toEqual(['popup']);
  });

  it('bootstrap defers to a broadcast that landed mid-flight', async () => {
    let resolveSnapshot!: (v: { workspaceId: string; presence: AwarenessState[] }) => void;
    mockCall.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveSnapshot = res;
        }),
    );
    const m = createAwarenessMirror({ bootstrap: true });
    // Broadcast lands first
    lastHandler!({ workspaceId: 'ws-live', presence: [s({ surfaceId: 'live' })] });
    // Then snapshot resolves with stale data
    resolveSnapshot({ workspaceId: 'ws-stale', presence: [s({ surfaceId: 'stale' })] });
    await Promise.resolve();
    await Promise.resolve();
    expect(m.getWorkspaceId()).toBe('ws-live');
    expect(m.getPresence().map((p) => p.surfaceId)).toEqual(['live']);
  });

  it('dispose drops the bridge subscription', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    m.dispose();
    expect(unsub).toHaveBeenCalledTimes(1);
    expect(m.getPresence()).toEqual([]);
    expect(m.getWorkspaceId()).toBeNull();
  });
});
