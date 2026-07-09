/**
 * Handshake coordinator — composed FSM coverage (U6.3 Part B).
 *
 * Pure unit; every dep is mocked. Verifies the lifecycle the wiring
 * in `background.ts` relies on after the FSM split: HELLO on `start()`,
 * WELCOME → connection `connected` → the `__global__` catch-up scope
 * auto-starts (STATE_VECTOR sent), SNAPSHOT → 'catching-up' + applies,
 * SYNCED → 'synced' + drives the C16 post-flush hook, REJECT →
 * 'rejected', missing workspace → 'aborted'.
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
import { EXTENSION_WORKSPACE_GLOBAL_SCOPE } from '@openheaders/core/sync';
import { describe, expect, it, vi } from 'vitest';

import { createSyncHandshakeInitiator } from '../../../src/sync/client/sync-handshake-initiator';

const GLOBAL = EXTENSION_WORKSPACE_GLOBAL_SCOPE;

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
    liveValues: [],
    liveFallbackPriority: [],
    oauthBundles: [],
    pauseMarkers: [],
    layoutState: [],
    files: [],
  };
}

function makeDeps(overrides: Partial<Parameters<typeof createSyncHandshakeInitiator>[0]> = {}) {
  const send = vi.fn<(frame: object) => boolean>(() => true);
  const applySnapshot = vi.fn<(snapshot: WorkspaceSnapshot) => Promise<void>>(async () => {});
  const onSynced = vi.fn<(scope: string, peerVector: unknown) => Promise<void>>(async () => {});
  const onRejected = vi.fn<(reason: string, detail?: string) => void>();
  const onJoinedOrg = vi.fn<(org: unknown, activeWorkspaceId?: string) => Promise<void>>(async () => {});
  const deps = {
    send,
    role: HANDSHAKE_ROLES.EXTENSION,
    getActiveWorkspaceId: () => 'ws-1',
    getNodeId: () => 'sw-1',
    getAgent: () => '@openheaders/extension@0.0.0-test',
    readStateVector: async () => ({}),
    applySnapshot,
    onSynced,
    onRejected,
    onJoinedOrg,
    ...overrides,
  };
  return { deps, send, applySnapshot, onSynced, onRejected, onJoinedOrg };
}

const TEST_BACKEND_ORG = {
  id: '01900000-0000-7000-8000-0000000000bb',
  name: 'Backend Org',
  hostKind: 'desktop',
  isPrivate: true,
};

const welcomeAccept: SyncWelcomeAccept = {
  type: SYNC_WELCOME_TYPE,
  accepted: true,
  protocolVersion: PROTOCOL_VERSION,
  role: HANDSHAKE_ROLES.DESKTOP,
  nodeId: 'desktop-1',
  workspaceId: 'ws-1',
  agent: '@openheaders/desktop@0.0.0-test',
};

function globalSynced(stateVectorAfter: SyncSyncedMessage['stateVectorAfter'] = {}): SyncSyncedMessage {
  return { type: SYNC_SYNCED_TYPE, workspaceId: GLOBAL, stateVectorAfter };
}

function globalSnapshot(): SyncSnapshotMessage {
  return { type: SYNC_SNAPSHOT_TYPE, workspaceId: GLOBAL, snapshot: emptySnapshot(GLOBAL) };
}

describe('createSyncHandshakeInitiator — outbound start()', () => {
  it('sends HELLO only on start; transitions hello-sent', async () => {
    const { deps, send } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ type: SYNC_HELLO_TYPE, workspaceId: 'ws-1', nodeId: 'sw-1' });
    expect(initiator.state()).toBe('hello-sent');
  });

  it('aborts when no active workspace', async () => {
    const { deps, send } = makeDeps({ getActiveWorkspaceId: () => null });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    expect(send).not.toHaveBeenCalled();
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
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('createSyncHandshakeInitiator — WELCOME → __global__ catch-up', () => {
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

  it('WELCOME (accept) reaches welcomed + sends STATE_VECTOR for the __global__ scope', async () => {
    const { deps, send, onRejected } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    expect(initiator.state()).toBe('welcomed');
    expect(onRejected).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toMatchObject({
      type: SYNC_STATE_VECTOR_TYPE,
      workspaceId: GLOBAL,
      perNodeMaxHlc: {},
    });
  });

  it('WELCOME (accept) carrying a backend Org fires onJoinedOrg before catch-up (U5.2)', async () => {
    const { deps, onJoinedOrg } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle({ ...welcomeAccept, org: TEST_BACKEND_ORG });
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

  it('SNAPSHOT for the __global__ scope lands on applySnapshot + transitions to catching-up', async () => {
    const { deps, applySnapshot } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle(globalSnapshot());
    expect(applySnapshot).toHaveBeenCalledTimes(1);
    expect(initiator.state()).toBe('catching-up');
  });

  it('drops a SNAPSHOT whose scope does not match the catch-up scope', async () => {
    const { deps, applySnapshot } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle({ type: SYNC_SNAPSHOT_TYPE, workspaceId: 'ws-other', snapshot: emptySnapshot('ws-other') });
    expect(applySnapshot).not.toHaveBeenCalled();
    expect(initiator.state()).toBe('welcomed');
  });

  it('SYNCED fires onSynced with the scope + peer vector + transitions to synced', async () => {
    const { deps, onSynced } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    const synced = globalSynced({ 'desktop-1': { physicalMs: 1_000, logical: 0, nodeId: 'desktop-1' } });
    await initiator.handle(synced);
    expect(onSynced).toHaveBeenCalledWith(GLOBAL, synced.stateVectorAfter);
    expect(initiator.state()).toBe('synced');
  });

  it('drops a SYNCED whose scope does not match the catch-up scope', async () => {
    const { deps, onSynced } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle({ type: SYNC_SYNCED_TYPE, workspaceId: 'ws-other', stateVectorAfter: {} });
    expect(onSynced).not.toHaveBeenCalled();
    expect(initiator.state()).toBe('welcomed');
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
    expect(send).toHaveBeenCalledTimes(1);
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
    // A late snapshot should NOT re-enter the FSM — catch-up never started.
    await initiator.handle(globalSnapshot());
    expect(applySnapshot).not.toHaveBeenCalled();
    expect(initiator.state()).toBe('rejected');
  });
});

describe('createSyncHandshakeInitiator — subscribe()', () => {
  it('fires the observer on every composed transition with the new state', async () => {
    const { deps } = makeDeps();
    const initiator = createSyncHandshakeInitiator(deps);
    const observed: string[] = [];
    initiator.subscribe((s) => observed.push(s));
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle(globalSynced());
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
  it('transitions to timed-out when WELCOME never arrives', async () => {
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

  it('transitions to timed-out when SYNCED never arrives during catch-up', async () => {
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
    // setTimer fired twice — connection then catch-up; `fired` is the catch-up timer.
    expect(setTimer).toHaveBeenCalledTimes(2);
    expect(initiator.state()).toBe('welcomed');
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
    await initiator.handle(globalSynced());
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
    await initiator.handle(globalSynced());
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
    await initiator.handle(globalSnapshot());
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
    await initiator.handle(globalSynced());
    expect(initiator.state()).toBe('failed');
    expect(initiator.failureDetail()).toMatch(/queue write failed/);
  });

  it('transitions to failed when readStateVector throws at catch-up start', async () => {
    const { deps } = makeDeps({
      readStateVector: async () => {
        throw new Error('log unreachable');
      },
    });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    expect(initiator.state()).toBe('failed');
    expect(initiator.failureDetail()).toMatch(/log unreachable/);
  });
});

describe('createSyncHandshakeInitiator — consumed-workspace fan-out (U6.4 / U6.5)', () => {
  function wsSynced(id: string): SyncSyncedMessage {
    return { type: SYNC_SYNCED_TYPE, workspaceId: id, stateVectorAfter: {} };
  }

  /** Drain microtasks so a non-awaited `catchup.start` reaches its send. */
  const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

  /** STATE_VECTOR scopes the initiator has put on the wire, in order. */
  function vectorScopes(send: ReturnType<typeof vi.fn>): string[] {
    return send.mock.calls
      .map((c) => c[0] as { type: string; workspaceId?: string })
      .filter((f) => f.type === SYNC_STATE_VECTOR_TYPE)
      .map((f) => f.workspaceId as string);
  }

  it('fans a STATE_VECTOR out for each consumed workspace after __global__ SYNCED', async () => {
    const { deps, send } = makeDeps({ listConsumedWorkspaceIds: () => ['ws-a', 'ws-b'] });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    expect(vectorScopes(send)).toEqual([GLOBAL]);
    await initiator.handle(globalSynced());
    // First consumed scope starts immediately; the second waits.
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-a']);
    await initiator.handle(wsSynced('ws-a'));
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-a', 'ws-b']);
    await initiator.handle(wsSynced('ws-b'));
    expect(initiator.state()).toBe('synced');
  });

  it('sequences one scope at a time — the next start waits for the prior SYNCED', async () => {
    const { deps, send } = makeDeps({ listConsumedWorkspaceIds: () => ['ws-a', 'ws-b'] });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle(globalSynced());
    // ws-b's STATE_VECTOR must not be on the wire while ws-a is catching up.
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-a']);
  });

  it('no fan-out when no workspaces are consumed', async () => {
    const { deps, send } = makeDeps({ listConsumedWorkspaceIds: () => [] });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle(globalSynced());
    expect(vectorScopes(send)).toEqual([GLOBAL]);
    expect(initiator.state()).toBe('synced');
  });

  it('a failed consumed-workspace catch-up does not strand the rest of the queue', async () => {
    let firstStateVector = true;
    const readStateVector = vi.fn(async (scope: string) => {
      if (scope === 'ws-a' && firstStateVector) {
        firstStateVector = false;
        throw new Error('log unreachable');
      }
      return {};
    });
    const { deps, send } = makeDeps({ listConsumedWorkspaceIds: () => ['ws-a', 'ws-b'], readStateVector });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle(globalSynced());
    // ws-a's catch-up failed at STATE_VECTOR read — ws-b still runs.
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-b']);
    await initiator.handle(wsSynced('ws-b'));
    expect(initiator.state()).toBe('synced');
  });

  it('refreshFanOut before __global__ synced is a no-op', async () => {
    const { deps, send } = makeDeps({ listConsumedWorkspaceIds: () => ['ws-a'] });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    // __global__ catch-up is still in flight — refreshFanOut must not
    // fan out a workspace scope yet.
    initiator.refreshFanOut();
    expect(vectorScopes(send)).toEqual([GLOBAL]);
  });

  it('refreshFanOut picks up a consumed workspace that arrived after __global__ SYNCED', async () => {
    // Models the real race: the __global__ workspace list lands as
    // MUTATION frames applied after SYNCED, so the enumeration at
    // SYNCED time sees an empty list.
    let consumed: string[] = [];
    const { deps, send } = makeDeps({ listConsumedWorkspaceIds: () => consumed });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle(globalSynced());
    // Nothing fanned out — the workspace list had not applied yet.
    expect(vectorScopes(send)).toEqual([GLOBAL]);
    // The workspace store catches up; the host re-runs the fan-out.
    consumed = ['ws-late'];
    initiator.refreshFanOut();
    await flush();
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-late']);
    await initiator.handle(wsSynced('ws-late'));
    expect(initiator.state()).toBe('synced');
  });

  it('refreshFanOut does not re-queue an already-caught-up workspace', async () => {
    let consumed = ['ws-a'];
    const { deps, send } = makeDeps({ listConsumedWorkspaceIds: () => consumed });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle(globalSynced());
    await initiator.handle(wsSynced('ws-a'));
    // ws-a is done; a refresh that still lists ws-a + a new ws-b only
    // fans out ws-b.
    consumed = ['ws-a', 'ws-b'];
    initiator.refreshFanOut();
    await flush();
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-a', 'ws-b']);
  });

  it('refreshFanOut while a catch-up is in flight appends without double-starting', async () => {
    let consumed = ['ws-a'];
    const { deps, send } = makeDeps({ listConsumedWorkspaceIds: () => consumed });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle(globalSynced());
    // ws-a is mid-catch-up (STATE_VECTOR sent, no SYNCED yet).
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-a']);
    consumed = ['ws-a', 'ws-b'];
    initiator.refreshFanOut();
    // ws-b queued, not started — the wire still shows only ws-a.
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-a']);
    await initiator.handle(wsSynced('ws-a'));
    // ws-a's SYNCED drains the queue → ws-b's STATE_VECTOR goes out.
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-a', 'ws-b']);
  });

  it('reset() drops a queued fan-out so the next socket re-enumerates', async () => {
    const { deps, send } = makeDeps({ listConsumedWorkspaceIds: () => ['ws-a', 'ws-b'] });
    const initiator = createSyncHandshakeInitiator(deps);
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle(globalSynced());
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-a']);
    initiator.reset();
    send.mockClear();
    // A fresh socket: ws-b must NOT auto-resume — the next __global__
    // SYNCED re-enumerates from scratch.
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle(globalSynced());
    expect(vectorScopes(send)).toEqual([GLOBAL, 'ws-a']);
  });
});
