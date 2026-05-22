/**
 * Connection handshake — HELLO/WELCOME FSM coverage (U6.3 Part B).
 *
 * The connection handshake runs once per socket and owns auth + the
 * `onJoinedOrg` Org join. Per-scope catch-up is a separate concern
 * (see scope-catchup-driver.test.ts).
 */
import {
  HANDSHAKE_REJECT_REASONS,
  HANDSHAKE_ROLES,
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_WELCOME_TYPE,
  type SyncWelcomeAccept,
} from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';

import { createConnectionHandshake } from '@/background/connection-handshake';

const welcomeAccept: SyncWelcomeAccept = {
  type: SYNC_WELCOME_TYPE,
  accepted: true,
  protocolVersion: PROTOCOL_VERSION,
  role: HANDSHAKE_ROLES.DESKTOP,
  nodeId: 'desktop-1',
  workspaceId: 'ws-1',
  agent: '@openheaders/desktop@0.0.0-test',
};

const TEST_BACKEND_ORG = {
  id: '01900000-0000-7000-8000-0000000000bb',
  name: 'Backend Org',
  hostKind: 'desktop',
  isSynthetic: true,
};

function makeDeps(overrides: Partial<Parameters<typeof createConnectionHandshake>[0]> = {}) {
  const send = vi.fn<(frame: object) => boolean>(() => true);
  const onConnected = vi.fn<() => void>();
  const onJoinedOrg = vi.fn<(org: unknown, activeWorkspaceId?: string) => Promise<void>>(async () => {});
  const onRejected = vi.fn<(reason: string, detail?: string) => void>();
  const deps = {
    send,
    getActiveWorkspaceId: () => 'ws-1' as string | null,
    getExtensionNodeId: () => 'sw-1',
    getExtensionAgent: () => '@openheaders/extension@0.0.0-test',
    onConnected,
    onJoinedOrg,
    onRejected,
    ...overrides,
  };
  return { deps, send, onConnected, onJoinedOrg, onRejected };
}

describe('createConnectionHandshake', () => {
  it('start() sends HELLO carrying the active workspace + nodeId', async () => {
    const { deps, send } = makeDeps();
    const handshake = createConnectionHandshake(deps);
    await handshake.start();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ type: SYNC_HELLO_TYPE, workspaceId: 'ws-1', nodeId: 'sw-1' });
    expect(handshake.state()).toBe('hello-sent');
  });

  it('start() includes the auth token when configured', async () => {
    const { deps, send } = makeDeps({ getAuthToken: () => 'paired-token' });
    const handshake = createConnectionHandshake(deps);
    await handshake.start();
    expect(send.mock.calls[0][0]).toMatchObject({ authToken: 'paired-token' });
  });

  it('aborts when no active workspace', async () => {
    const { deps, send } = makeDeps({ getActiveWorkspaceId: () => null });
    const handshake = createConnectionHandshake(deps);
    await handshake.start();
    expect(send).not.toHaveBeenCalled();
    expect(handshake.state()).toBe('aborted');
  });

  it('WELCOME (accept) reaches connected + fires onConnected', async () => {
    const { deps, onConnected } = makeDeps();
    const handshake = createConnectionHandshake(deps);
    await handshake.start();
    await handshake.handle(welcomeAccept);
    expect(handshake.state()).toBe('connected');
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it('WELCOME (accept) fires onJoinedOrg before onConnected', async () => {
    const order: string[] = [];
    const { deps } = makeDeps({
      onJoinedOrg: async () => {
        order.push('joined');
      },
      onConnected: () => {
        order.push('connected');
      },
    });
    const handshake = createConnectionHandshake(deps);
    await handshake.start();
    await handshake.handle({ ...welcomeAccept, org: TEST_BACKEND_ORG, activeWorkspaceId: 'backend-ws-7' });
    expect(order).toEqual(['joined', 'connected']);
  });

  it('reaches connected even when onJoinedOrg throws', async () => {
    const { deps, onConnected } = makeDeps({
      onJoinedOrg: async () => {
        throw new Error('storage write failed');
      },
    });
    const handshake = createConnectionHandshake(deps);
    await handshake.start();
    await handshake.handle({ ...welcomeAccept, org: TEST_BACKEND_ORG });
    expect(handshake.state()).toBe('connected');
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it('WELCOME (reject) transitions to rejected + fires onRejected', async () => {
    const { deps, onRejected, onConnected } = makeDeps();
    const handshake = createConnectionHandshake(deps);
    await handshake.start();
    await handshake.handle({
      type: SYNC_WELCOME_TYPE,
      accepted: false,
      reason: HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED,
      protocolVersion: PROTOCOL_VERSION,
      detail: 'pairing required',
    });
    expect(handshake.state()).toBe('rejected');
    expect(handshake.rejectReason()).toBe(HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED);
    expect(onRejected).toHaveBeenCalledWith(HANDSHAKE_REJECT_REASONS.AUTH_REQUIRED, 'pairing required');
    expect(onConnected).not.toHaveBeenCalled();
  });

  it('times out when WELCOME never arrives', async () => {
    let fired: (() => void) | null = null;
    const setTimer = vi.fn((fn: () => void) => {
      fired = fn;
      return 1 as unknown;
    });
    const { deps } = makeDeps({ setTimer, clearTimer: vi.fn(), timeoutMs: 50 });
    const handshake = createConnectionHandshake(deps);
    await handshake.start();
    fired!();
    expect(handshake.state()).toBe('timed-out');
  });

  it('reset() returns to idle so the next socket re-runs start()', async () => {
    const { deps, send } = makeDeps();
    const handshake = createConnectionHandshake(deps);
    await handshake.start();
    handshake.reset();
    expect(handshake.state()).toBe('idle');
    send.mockClear();
    await handshake.start();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('handles() claims WELCOME + HELLO only', () => {
    const { deps } = makeDeps();
    const handshake = createConnectionHandshake(deps);
    expect(handshake.handles({ type: SYNC_WELCOME_TYPE })).toBe(true);
    expect(handshake.handles({ type: SYNC_HELLO_TYPE })).toBe(true);
    expect(handshake.handles({ type: 'oh.sync.synced' })).toBe(false);
    expect(handshake.handles(null)).toBe(false);
  });
});
