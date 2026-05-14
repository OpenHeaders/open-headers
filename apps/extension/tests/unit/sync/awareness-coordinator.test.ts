/**
 * Awareness coordinator — surface-scoped slot manager.
 *
 * Verifies the architectural contract:
 *   - the most-recently-touched slot wins
 *   - unregister falls back to the next-most-recent slot
 *   - empty stack publishes a clearing state (entityFocus = null)
 *   - republish on demand for SW reconnect recovery
 *   - identical claims dedup; label change forces re-publish
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: {
    call: mockCall,
    subscribe: vi.fn(),
    broadcast: vi.fn(),
    presence: vi.fn(),
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { PresenceIdentity } from '@openheaders/core/protocol';
import { createAwarenessCoordinator } from '@/shared/awareness/awareness-coordinator';
import type { SurfaceIdentityHandle } from '@/shared/awareness/surface-identity';

function makeIdentityHandle(): SurfaceIdentityHandle {
  let identity: PresenceIdentity = {
    instanceId: 'workbench-A',
    surfaceKind: 'workbench',
    appId: 'extension',
    label: 'Workbench',
  };
  const labelListeners = new Set<(label: string) => void>();
  return {
    current: () => identity,
    setLabel: (label) => {
      identity = { ...identity, label };
      for (const l of labelListeners) l(label);
      return identity;
    },
    onLabelChange: (l) => {
      labelListeners.add(l);
      return () => labelListeners.delete(l);
    },
    dispose: () => labelListeners.clear(),
  };
}

let nextHlcLogical = 0;
function makeCtx(): { next: () => { hlc: { physicalMs: number; logical: number; nodeId: string } } } {
  return {
    next: () => ({ hlc: { physicalMs: 100, logical: nextHlcLogical++, nodeId: 'n' } }),
  };
}

beforeEach(() => {
  mockCall.mockReset();
  mockCall.mockResolvedValue({ ok: true, presence: [] });
  nextHlcLogical = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function lastPublished() {
  const calls = mockCall.mock.calls.filter(([type]) => type === 'oh.awareness.publish');
  if (calls.length === 0) return null;
  return calls[calls.length - 1][1] as { workspaceId: string; state: { entityFocus: unknown; fieldFocus: unknown } };
}

describe('awareness coordinator', () => {
  it('publishes the registered slot on register', () => {
    const id = makeIdentityHandle();
    // biome-ignore lint/suspicious/noExplicitAny: minimal ctx stub for tests
    const coordinator = createAwarenessCoordinator({ identity: id, resolveContext: () => makeCtx() as any });
    coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    expect(lastPublished()?.state.entityFocus).toEqual({ type: 'rule', id: 'r1' });
  });

  it('most-recently-registered slot wins', () => {
    const id = makeIdentityHandle();
    // biome-ignore lint/suspicious/noExplicitAny: minimal ctx stub for tests
    const coordinator = createAwarenessCoordinator({ identity: id, resolveContext: () => makeCtx() as any });
    coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'request', id: 'q1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    expect(lastPublished()?.state.entityFocus).toEqual({ type: 'request', id: 'q1' });
  });

  it('unregistering the active slot falls back to the next-most-recent', () => {
    const id = makeIdentityHandle();
    // biome-ignore lint/suspicious/noExplicitAny: minimal ctx stub for tests
    const coordinator = createAwarenessCoordinator({ identity: id, resolveContext: () => makeCtx() as any });
    const ruleSlot = coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    const reqSlot = coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'request', id: 'q1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    // Active is the request slot; unregister it → falls back to rule.
    reqSlot.unregister();
    expect(lastPublished()?.state.entityFocus).toEqual({ type: 'rule', id: 'r1' });
    void ruleSlot; // keep linter happy
  });

  it('clears entity focus when all slots unregister (the user-reported bug case)', () => {
    // Reproduces the bug: surface had rule X claim; user closes the
    // editor; coordinator must publish entityFocus=null so other
    // surfaces' badges stop counting this surface.
    const id = makeIdentityHandle();
    // biome-ignore lint/suspicious/noExplicitAny: minimal ctx stub for tests
    const coordinator = createAwarenessCoordinator({ identity: id, resolveContext: () => makeCtx() as any });
    const slot = coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    slot.unregister();
    const last = lastPublished();
    expect(last?.workspaceId).toBe('ws');
    expect(last?.state.entityFocus).toBeNull();
  });

  it('update bumps a slot back to the top (most-recently-active wins)', () => {
    const id = makeIdentityHandle();
    // biome-ignore lint/suspicious/noExplicitAny: minimal ctx stub for tests
    const coordinator = createAwarenessCoordinator({ identity: id, resolveContext: () => makeCtx() as any });
    const slotA = coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'request', id: 'q1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    // request is currently active. Re-update slot A → it bumps to top.
    slotA.update({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: { type: 'rule', id: 'r1', path: 'name' },
      dirtyFields: [],
    });
    expect(lastPublished()?.state.entityFocus).toEqual({ type: 'rule', id: 'r1' });
    expect(lastPublished()?.state.fieldFocus).toEqual({ type: 'rule', id: 'r1', path: 'name' });
  });

  it('dedups identical publishes', () => {
    const id = makeIdentityHandle();
    // biome-ignore lint/suspicious/noExplicitAny: minimal ctx stub for tests
    const coordinator = createAwarenessCoordinator({ identity: id, resolveContext: () => makeCtx() as any });
    const slot = coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    const before = mockCall.mock.calls.length;
    slot.update({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    expect(mockCall.mock.calls.length).toBe(before);
  });

  it('republish() forces a re-publish without a state change (SW reconnect recovery)', () => {
    const id = makeIdentityHandle();
    // biome-ignore lint/suspicious/noExplicitAny: minimal ctx stub for tests
    const coordinator = createAwarenessCoordinator({ identity: id, resolveContext: () => makeCtx() as any });
    coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    const before = mockCall.mock.calls.length;
    coordinator.republish();
    expect(mockCall.mock.calls.length).toBe(before + 1);
  });

  it('label change re-publishes the winning claim', () => {
    const id = makeIdentityHandle();
    // biome-ignore lint/suspicious/noExplicitAny: minimal ctx stub for tests
    const coordinator = createAwarenessCoordinator({ identity: id, resolveContext: () => makeCtx() as any });
    coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    const before = mockCall.mock.calls.length;
    id.setLabel('Workbench — Updated');
    expect(mockCall.mock.calls.length).toBe(before + 1);
  });

  it('after dispose, no further publishes happen', () => {
    const id = makeIdentityHandle();
    // biome-ignore lint/suspicious/noExplicitAny: minimal ctx stub for tests
    const coordinator = createAwarenessCoordinator({ identity: id, resolveContext: () => makeCtx() as any });
    const slot = coordinator.register({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r1' },
      fieldFocus: null,
      dirtyFields: [],
    });
    coordinator.dispose();
    const before = mockCall.mock.calls.length;
    slot.update({
      workspaceId: 'ws',
      entityFocus: { type: 'rule', id: 'r2' },
      fieldFocus: null,
      dirtyFields: [],
    });
    coordinator.republish();
    expect(mockCall.mock.calls.length).toBe(before);
  });
});
