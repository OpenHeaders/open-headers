/**
 * Phase C handshake initiator — FSM coverage.
 *
 * Pure unit; every dep is mocked. Verifies the lifecycle the wiring
 * in `background.ts` relies on: HELLO+STATE_VECTOR on `start()`,
 * WELCOME → 'welcomed', SNAPSHOT → 'catching-up' + applies, SYNCED →
 * 'synced' + drives the C16 post-flush hook, REJECT → 'rejected' +
 * notifies the caller, missing workspace → 'aborted'.
 */
import {
  HANDSHAKE_REJECT_REASONS,
  HANDSHAKE_ROLES,
  PROTOCOL_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_SNAPSHOT_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  SYNC_WELCOME_TYPE,
  type SyncSnapshotMessage,
  type SyncSyncedMessage,
  type SyncWelcomeAccept,
  type SyncWelcomeReject,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';

import { createSyncHandshakeInitiator } from '@/background/sync-handshake-initiator';

function emptySnapshot(workspaceId: string): WorkspaceSnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    workspaceId,
    takenAtHlc: {},
    rules: [],
    environments: [],
    collections: [],
    workspaceVariables: [],
    vault: [],
    folders: [],
    requests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    liveVariables: [],
    liveWorkflows: [],
    oauthBundles: [],
    pauseMarkers: [],
    layoutState: [],
    files: [],
  };
}

function makeDeps(overrides: Partial<Parameters<typeof createSyncHandshakeInitiator>[0]> = {}) {
  const send = vi.fn<(frame: object) => boolean>(() => true);
  const applySnapshot = vi.fn<(snapshot: WorkspaceSnapshot) => Promise<void>>(async () => {});
  const onSynced = vi.fn<(peerVector: unknown) => Promise<void>>(async () => {});
  const onRejected = vi.fn<(reason: string, detail?: string) => void>();
  const onJoinedOrg = vi.fn<(org: unknown) => Promise<void>>(async () => {});
  const deps = {
    send,
    getActiveWorkspaceId: () => 'ws-1',
    getExtensionNodeId: () => 'sw-1',
    getExtensionAgent: () => '@openheaders/extension@0.0.0-test',
    readStateVector: async () => ({}),
    applySnapshot,
    onSynced,
    onRejected,
    onJoinedOrg,
    ...overrides,
  };
  return { deps, send, applySnapshot, onSynced, onRejected, onJoinedOrg };
}

const TEST_BACKEND_ORG = { id: '01900000-0000-7000-8000-0000000000bb', name: 'Backend Org', isSynthetic: true };

const welcomeAccept: SyncWelcomeAccept = {
  type: SYNC_WELCOME_TYPE,
  accepted: true,
  protocolVersion: PROTOCOL_VERSION,
  role: HANDSHAKE_ROLES.DESKTOP,
  nodeId: 'desktop-1',
  workspaceId: 'ws-1',
  agent: '@openheaders/desktop@0.0.0-test',
};

describe('createSyncHandshakeInitiator — outbound start()', () => {
  it('sends HELLO then STATE_VECTOR on start; transitions hello-sent', async () => {
    const { deps, send } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toMatchObject({ type: SYNC_HELLO_TYPE, workspaceId: 'ws-1', nodeId: 'sw-1' });
    expect(send.mock.calls[1][0]).toMatchObject({
      type: SYNC_STATE_VECTOR_TYPE,
      workspaceId: 'ws-1',
      perNodeMaxHlc: {},
    });
    expect(initiator.state()).toBe('hello-sent');
  });

  it('aborts when no active workspace', async () => {
    const { deps, send } = makeDeps({ getActiveWorkspaceId: () => null });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    expect(send).not.toHaveBeenCalled();
    expect(initiator.state()).toBe('aborted');
  });

  it('aborts when readStateVector throws', async () => {
    const { deps } = makeDeps({
      readStateVector: async () => {
        throw new Error('log unreachable');
      },
    });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    expect(initiator.state()).toBe('aborted');
  });

  it('aborts when HELLO send fails (wire gone)', async () => {
    const { deps } = makeDeps({ send: vi.fn<(frame: object) => boolean>(() => false) });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    expect(initiator.state()).toBe('aborted');
  });

  it('start is idempotent — repeat calls after hello-sent are no-ops', async () => {
    const { deps, send } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.start();
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('createSyncHandshakeInitiator — inbound handle()', () => {
  it('handles() claims only the five handshake-flow types', () => {
    const { deps } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    for (const t of [
      SYNC_HELLO_TYPE,
      SYNC_WELCOME_TYPE,
      SYNC_STATE_VECTOR_TYPE,
      SYNC_SNAPSHOT_TYPE,
      SYNC_SYNCED_TYPE,
    ]) {
      expect(initiator.handles({ type: t })).toBe(true);
    }
    expect(initiator.handles({ type: 'oh.sync.mutation' })).toBe(false);
    expect(initiator.handles({ type: 'pong' })).toBe(false);
    expect(initiator.handles(null)).toBe(false);
    expect(initiator.handles('x')).toBe(false);
  });

  it('WELCOME (accept) transitions to welcomed without firing onRejected', async () => {
    const { deps, onRejected, onJoinedOrg } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    expect(initiator.state()).toBe('welcomed');
    expect(onRejected).not.toHaveBeenCalled();
    // No `org` on this WELCOME — nothing to join (U5.2).
    expect(onJoinedOrg).not.toHaveBeenCalled();
  });

  it('WELCOME (accept) carrying a backend Org fires onJoinedOrg before welcomed (U5.2)', async () => {
    const { deps, onJoinedOrg } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle({ ...welcomeAccept, org: TEST_BACKEND_ORG });
    // No `activeWorkspaceId` on this WELCOME — second arg is undefined.
    expect(onJoinedOrg).toHaveBeenCalledWith(TEST_BACKEND_ORG, undefined);
    expect(initiator.state()).toBe('welcomed');
  });

  it('WELCOME (accept) passes the backend active workspace id to onJoinedOrg (U5.9)', async () => {
    const { deps, onJoinedOrg } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle({ ...welcomeAccept, org: TEST_BACKEND_ORG, activeWorkspaceId: 'backend-ws-7' });
    expect(onJoinedOrg).toHaveBeenCalledWith(TEST_BACKEND_ORG, 'backend-ws-7');
  });

  it('WELCOME (accept) still reaches welcomed when onJoinedOrg throws (U5.2)', async () => {
    const onJoinedOrg = vi.fn<(org: unknown) => Promise<void>>(async () => {
      throw new Error('storage write failed');
    });
    const { deps } = makeDeps({ onJoinedOrg });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle({ ...welcomeAccept, org: TEST_BACKEND_ORG });
    expect(onJoinedOrg).toHaveBeenCalledTimes(1);
    expect(initiator.state()).toBe('welcomed');
  });

  it('WELCOME (reject) transitions to rejected + fires onRejected with the reason', async () => {
    const { deps, onRejected } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    const reject: SyncWelcomeReject = {
      type: SYNC_WELCOME_TYPE,
      accepted: false,
      reason: HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_NEW,
      protocolVersion: PROTOCOL_VERSION,
      detail: 'server is older',
    };
    await initiator.start();
    await initiator.handle(reject);
    expect(initiator.state()).toBe('rejected');
    expect(initiator.rejectReason()).toBe(HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_NEW);
    expect(onRejected).toHaveBeenCalledWith(HANDSHAKE_REJECT_REASONS.PROTOCOL_TOO_NEW, 'server is older');
  });

  it('SNAPSHOT lands on applySnapshot + transitions to catching-up', async () => {
    const { deps, applySnapshot } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    const snap: SyncSnapshotMessage = {
      type: SYNC_SNAPSHOT_TYPE,
      workspaceId: 'ws-1',
      snapshot: emptySnapshot('ws-1'),
    };
    await initiator.handle(snap);
    expect(applySnapshot).toHaveBeenCalledTimes(1);
    expect(initiator.state()).toBe('catching-up');
  });

  it('SYNCED fires onSynced with the peer vector + transitions to synced', async () => {
    const { deps, onSynced } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    const synced: SyncSyncedMessage = {
      type: SYNC_SYNCED_TYPE,
      workspaceId: 'ws-1',
      stateVectorAfter: { 'desktop-1': { physicalMs: 1_000, logical: 0, nodeId: 'desktop-1' } },
    };
    await initiator.handle(synced);
    expect(onSynced).toHaveBeenCalledWith(synced.stateVectorAfter);
    expect(initiator.state()).toBe('synced');
  });

  it('reset() returns FSM to idle so the next reconnect re-runs start()', async () => {
    const { deps, send } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    expect(initiator.state()).toBe('hello-sent');
    initiator.reset();
    expect(initiator.state()).toBe('idle');
    expect(initiator.rejectReason()).toBeNull();
    send.mockClear();
    await initiator.start();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('drops server-only frames (HELLO / STATE_VECTOR) without state change', async () => {
    const { deps } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle({ type: SYNC_HELLO_TYPE });
    await initiator.handle({ type: SYNC_STATE_VECTOR_TYPE });
    expect(initiator.state()).toBe('hello-sent');
  });

  it('drops late frames after a terminal state (rejected)', async () => {
    const { deps, applySnapshot } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle({
      type: SYNC_WELCOME_TYPE,
      accepted: false,
      reason: HANDSHAKE_REJECT_REASONS.WORKSPACE_UNKNOWN,
      protocolVersion: PROTOCOL_VERSION,
    });
    expect(initiator.state()).toBe('rejected');
    // A late snapshot should NOT re-enter the FSM.
    await initiator.handle({
      type: SYNC_SNAPSHOT_TYPE,
      workspaceId: 'ws-1',
      snapshot: emptySnapshot('ws-1'),
    });
    expect(applySnapshot).not.toHaveBeenCalled();
    expect(initiator.state()).toBe('rejected');
  });
});

describe('createSyncHandshakeInitiator — subscribe()', () => {
  it('fires the observer on every transition with the new state', async () => {
    const { deps } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    const observed: string[] = [];
    initiator.subscribe((s) => observed.push(s));
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle({
      type: SYNC_SYNCED_TYPE,
      workspaceId: 'ws-1',
      stateVectorAfter: {},
    });
    expect(observed).toEqual(['hello-sent', 'welcomed', 'synced']);
  });

  it('unsubscribe stops further notifications', async () => {
    const { deps } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    const observed: string[] = [];
    const unsubscribe = initiator.subscribe((s) => observed.push(s));
    await initiator.start();
    unsubscribe();
    await initiator.handle(welcomeAccept);
    expect(observed).toEqual(['hello-sent']);
  });

  it('reset() fires the observer with idle', async () => {
    const { deps } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    const observed: string[] = [];
    initiator.subscribe((s) => observed.push(s));
    initiator.reset();
    expect(observed).toEqual(['idle']);
  });

  it('a throwing observer does not wedge the FSM', async () => {
    const { deps } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    initiator.subscribe(() => {
      throw new Error('boom');
    });
    await expect(initiator.start()).resolves.toBeUndefined();
    expect(initiator.state()).toBe('hello-sent');
  });
});

describe('createSyncHandshakeInitiator — handshake timeout', () => {
  it('transitions to timed-out when WELCOME / SYNCED never arrive', async () => {
    let fired: (() => void) | null = null;
    const setTimer = vi.fn((fn: () => void) => {
      fired = fn;
      return 1 as unknown;
    });
    const clearTimer = vi.fn();
    const { deps } = makeDeps({ setTimer, clearTimer, timeoutMs: 50 });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    expect(setTimer).toHaveBeenCalledTimes(1);
    expect(initiator.state()).toBe('hello-sent');
    fired!();
    expect(initiator.state()).toBe('timed-out');
  });

  it('clears the timer when SYNCED arrives in time', async () => {
    const clearTimer = vi.fn();
    const setTimer = vi.fn(() => 1 as unknown);
    const { deps } = makeDeps({ setTimer, clearTimer, timeoutMs: 5000 });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle({
      type: SYNC_SYNCED_TYPE,
      workspaceId: 'ws-1',
      stateVectorAfter: {},
    });
    expect(initiator.state()).toBe('synced');
    expect(clearTimer).toHaveBeenCalled();
  });

  it('timeout firing AFTER a terminal state is a no-op', async () => {
    let fired: (() => void) | null = null;
    const setTimer = vi.fn((fn: () => void) => {
      fired = fn;
      return 1 as unknown;
    });
    const clearTimer = vi.fn();
    const { deps } = makeDeps({ setTimer, clearTimer, timeoutMs: 50 });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle({
      type: SYNC_SYNCED_TYPE,
      workspaceId: 'ws-1',
      stateVectorAfter: {},
    });
    expect(initiator.state()).toBe('synced');
    fired!();
    expect(initiator.state()).toBe('synced');
  });
});

describe('createSyncHandshakeInitiator — catch-up failure', () => {
  it('transitions to failed when applySnapshot throws', async () => {
    const { deps } = makeDeps({
      applySnapshot: vi.fn(async () => {
        throw new Error('seed builder rejected');
      }),
    });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle({
      type: SYNC_SNAPSHOT_TYPE,
      workspaceId: 'ws-1',
      snapshot: emptySnapshot('ws-1'),
    });
    expect(initiator.state()).toBe('failed');
    expect(initiator.failureDetail()).toMatch(/seed builder rejected/);
  });

  it('transitions to failed when onSynced throws (post-flush failure)', async () => {
    const { deps } = makeDeps({
      onSynced: vi.fn(async () => {
        throw new Error('queue write failed');
      }),
    });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle({
      type: SYNC_SYNCED_TYPE,
      workspaceId: 'ws-1',
      stateVectorAfter: {},
    });
    expect(initiator.state()).toBe('failed');
    expect(initiator.failureDetail()).toMatch(/queue write failed/);
  });
});
