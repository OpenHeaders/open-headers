/**
 * Renderer-side awareness mirror — folds `awarenessBroadcast` events,
 * supports entity- and field-level queries with identity-instanceId
 * filtering, and notifies subscribers.
 */

import type { AwarenessState, PresenceIdentity } from '@openheaders/core/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSubscribe, mockCall } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockCall: vi.fn(),
}));

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: {
    call: mockCall,
    subscribe: mockSubscribe,
    broadcast: vi.fn(),
    presence: vi.fn(),
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  createAwarenessMirror,
  disposeActiveAwarenessMirror,
  getActiveAwarenessMirror,
} from '@openheaders/ui/context';

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

function identity(overrides: Partial<PresenceIdentity> = {}): PresenceIdentity {
  return {
    instanceId: 'workbench-1',
    surfaceKind: 'workbench',
    appId: 'extension',
    label: 'Workbench',
    ...overrides,
  };
}

type StateOverrides = Omit<Partial<AwarenessState>, 'identity'> & { identity?: Partial<PresenceIdentity> };

function s(overrides: StateOverrides = {}): AwarenessState {
  const { identity: identityOverride, ...rest } = overrides;
  return {
    identity: identity(identityOverride),
    entityFocus: { type: 'rule', id: 'r1' },
    fieldFocus: { type: 'rule', id: 'r1', path: 'name' },
    dirtyFields: [],
    lastActivityHlc: { physicalMs: 100, logical: 0, nodeId: 'n1' },
    ...rest,
  };
}

describe('awareness mirror', () => {
  it('folds broadcast presence into local state', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    expect(lastHandler).not.toBeNull();
    lastHandler!({ workspaceId: 'ws', presence: [s({ identity: { instanceId: 'popup-1', surfaceKind: 'popup' } })] });
    expect(m.getWorkspaceId()).toBe('ws');
    expect(m.getPresence().map((p) => p.identity.instanceId)).toEqual(['popup-1']);
  });

  it('getPresenceForEntity filters by (type, id) and supports excludeInstanceId', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    lastHandler!({
      workspaceId: 'ws',
      presence: [
        s({ identity: { instanceId: 'wb-1' }, entityFocus: { type: 'rule', id: 'r1' } }),
        s({ identity: { instanceId: 'pp-1', surfaceKind: 'popup' }, entityFocus: { type: 'rule', id: 'r2' } }),
        s({ identity: { instanceId: 'dp-1', surfaceKind: 'devpanel' }, entityFocus: { type: 'rule', id: 'r1' } }),
      ],
    });
    const r1 = m.getPresenceForEntity({ type: 'rule', id: 'r1' });
    expect(r1.map((p) => p.identity.instanceId).sort()).toEqual(['dp-1', 'wb-1']);
    const r1NotMe = m.getPresenceForEntity({ type: 'rule', id: 'r1' }, { excludeInstanceId: 'wb-1' });
    expect(r1NotMe.map((p) => p.identity.instanceId)).toEqual(['dp-1']);
  });

  it('getPresenceForField matches type+id+path exactly', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    lastHandler!({
      workspaceId: 'ws',
      presence: [
        s({ identity: { instanceId: 'a' }, fieldFocus: { type: 'rule', id: 'r1', path: 'name' } }),
        s({ identity: { instanceId: 'b' }, fieldFocus: { type: 'rule', id: 'r1', path: 'enabled' } }),
        s({ identity: { instanceId: 'c' }, fieldFocus: null }),
      ],
    });
    const matches = m.getPresenceForField({ type: 'rule', id: 'r1', path: 'name' });
    expect(matches.map((p) => p.identity.instanceId)).toEqual(['a']);
  });

  it('subscribeEntity notifies on entity changes', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    const cb = vi.fn();
    m.subscribeEntity({ type: 'rule', id: 'r1' }, cb);
    lastHandler!({ workspaceId: 'ws', presence: [s({ entityFocus: { type: 'rule', id: 'r1' } })] });
    expect(cb).toHaveBeenCalledTimes(1);
    cb.mockClear();
    lastHandler!({ workspaceId: 'ws', presence: [s({ entityFocus: { type: 'rule', id: 'r2' } })] });
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
    mockCall.mockResolvedValueOnce({
      workspaceId: 'ws-init',
      presence: [s({ identity: { instanceId: 'popup-1', surfaceKind: 'popup' } })],
    });
    const m = createAwarenessMirror({ bootstrap: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(m.getWorkspaceId()).toBe('ws-init');
    expect(m.getPresence().map((p) => p.identity.instanceId)).toEqual(['popup-1']);
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
    lastHandler!({ workspaceId: 'ws-live', presence: [s({ identity: { instanceId: 'live' } })] });
    resolveSnapshot({ workspaceId: 'ws-stale', presence: [s({ identity: { instanceId: 'stale' } })] });
    await Promise.resolve();
    await Promise.resolve();
    expect(m.getWorkspaceId()).toBe('ws-live');
    expect(m.getPresence().map((p) => p.identity.instanceId)).toEqual(['live']);
  });

  it('dispose drops the bridge subscription', () => {
    const m = createAwarenessMirror({ bootstrap: false });
    m.dispose();
    expect(unsub).toHaveBeenCalledTimes(1);
    expect(m.getPresence()).toEqual([]);
    expect(m.getWorkspaceId()).toBeNull();
  });
});
