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
  const deps = {
    send,
    getActiveWorkspaceId: () => 'ws-1',
    getExtensionNodeId: () => 'sw-1',
    getExtensionAgent: () => '@openheaders/extension@0.0.0-test',
    readStateVector: async () => ({}),
    applySnapshot,
    onSynced,
    onRejected,
    ...overrides,
  };
  return { deps, send, applySnapshot, onSynced, onRejected };
}

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
    for (const t of [SYNC_HELLO_TYPE, SYNC_WELCOME_TYPE, SYNC_STATE_VECTOR_TYPE, SYNC_SNAPSHOT_TYPE, SYNC_SYNCED_TYPE]) {
      expect(initiator.handles({ type: t })).toBe(true);
    }
    expect(initiator.handles({ type: 'oh.sync.mutation' })).toBe(false);
    expect(initiator.handles({ type: 'pong' })).toBe(false);
    expect(initiator.handles(null)).toBe(false);
    expect(initiator.handles('x')).toBe(false);
  });

  it('WELCOME (accept) transitions to welcomed without firing onRejected', async () => {
    const { deps, onRejected } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    expect(initiator.state()).toBe('welcomed');
    expect(onRejected).not.toHaveBeenCalled();
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
});
