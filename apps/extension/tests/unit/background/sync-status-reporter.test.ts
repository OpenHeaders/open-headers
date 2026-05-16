/**
 * Sync handshake → Status subsystem bridge — pure mapping + install.
 *
 * Covers describeHandshakeStatus exhaustively across the FSM states +
 * verifies installHandshakeStatusReporter wires the subscription so
 * the UI gets phase-by-phase pill updates.
 */
import {
  HANDSHAKE_REJECT_REASONS,
  PROTOCOL_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  SYNC_SYNCED_TYPE,
  SYNC_WELCOME_TYPE,
  type SyncWelcomeAccept,
} from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';

import { createSyncHandshakeInitiator } from '@/background/sync-handshake-initiator';
import {
  describeHandshakeStatus,
  installHandshakeStatusReporter,
  type SyncStatusEntry,
} from '@/background/sync-status-reporter';

const welcomeAccept: SyncWelcomeAccept = {
  type: SYNC_WELCOME_TYPE,
  accepted: true,
  protocolVersion: PROTOCOL_VERSION,
  role: 'desktop',
  nodeId: 'desktop-1',
  workspaceId: 'ws-1',
  agent: '@openheaders/desktop@0.0.0-test',
};

describe('describeHandshakeStatus', () => {
  it('returns null for idle and aborted (wire-level reporter retains pill)', () => {
    expect(describeHandshakeStatus('idle', null, null)).toBeNull();
    expect(describeHandshakeStatus('aborted', null, null)).toBeNull();
  });

  it('reports yellow during hello-sent / welcomed', () => {
    for (const phase of ['hello-sent', 'welcomed'] as const) {
      const entry = describeHandshakeStatus(phase, null, null);
      expect(entry).not.toBeNull();
      expect(entry!.state).toBe('yellow');
      expect(entry!.message).toMatch(/handshak/i);
    }
  });

  it('reports yellow Catching up… during catching-up', () => {
    const entry = describeHandshakeStatus('catching-up', null, null);
    expect(entry?.state).toBe('yellow');
    expect(entry?.message).toMatch(/catching up/i);
  });

  it('reports green Synced on synced', () => {
    const entry = describeHandshakeStatus('synced', null, null);
    expect(entry?.state).toBe('green');
    expect(entry?.message).toMatch(/synced/i);
  });

  it('reports red with specific message per rejectReason', () => {
    const cases: ReadonlyArray<[keyof typeof HANDSHAKE_REJECT_REASONS, RegExp]> = [
      ['PROTOCOL_TOO_OLD', /update extension/i],
      ['PROTOCOL_TOO_NEW', /update back-end/i],
      ['WORKSPACE_UNKNOWN', /workspace/i],
      ['AUTH_REQUIRED', /authentication/i],
    ];
    for (const [k, pattern] of cases) {
      const reason = HANDSHAKE_REJECT_REASONS[k];
      const entry = describeHandshakeStatus('rejected', reason, null);
      expect(entry?.state).toBe('red');
      expect(entry?.message).toMatch(pattern);
      expect(entry?.context).toMatchObject({ phase: 'rejected', reason });
    }
  });

  it('reports red on timed-out', () => {
    const entry = describeHandshakeStatus('timed-out', null, null);
    expect(entry?.state).toBe('red');
    expect(entry?.message).toMatch(/didn't respond/i);
  });

  it('reports red on failed with the failure detail', () => {
    const entry = describeHandshakeStatus('failed', null, 'snapshot apply failed: x');
    expect(entry?.state).toBe('red');
    expect(entry?.message).toMatch(/snapshot apply failed/);
    expect(entry?.context).toMatchObject({ phase: 'failed', detail: 'snapshot apply failed: x' });
  });
});

describe('installHandshakeStatusReporter', () => {
  function makeInitiatorDeps() {
    return {
      send: vi.fn<(frame: object) => boolean>(() => true),
      getActiveWorkspaceId: () => 'ws-1',
      getExtensionNodeId: () => 'sw-1',
      getExtensionAgent: () => '@openheaders/extension@0.0.0-test',
      readStateVector: async () => ({}),
      applySnapshot: vi.fn(async () => {}),
      onSynced: vi.fn(async () => {}),
    };
  }

  it('emits a Status entry on every meaningful transition', async () => {
    const initiator = createSyncHandshakeInitiator(makeInitiatorDeps());
    const report = vi.fn<(entry: SyncStatusEntry) => void>();
    const unsubscribe = installHandshakeStatusReporter({ initiator, report });
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle({
      type: SYNC_SYNCED_TYPE,
      workspaceId: 'ws-1',
      stateVectorAfter: {},
    });
    // hello-sent → welcomed → synced = 3 entries
    expect(report).toHaveBeenCalledTimes(3);
    expect(report.mock.calls[0][0].state).toBe('yellow');
    expect(report.mock.calls[2][0].state).toBe('green');
    unsubscribe();
  });

  it('skips reports for null-returning states (aborted)', async () => {
    const deps = makeInitiatorDeps();
    const initiator = createSyncHandshakeInitiator({
      ...deps,
      getActiveWorkspaceId: () => null,
    });
    const report = vi.fn<(entry: SyncStatusEntry) => void>();
    installHandshakeStatusReporter({ initiator, report });
    await initiator.start();
    expect(initiator.state()).toBe('aborted');
    expect(report).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe that stops further reports', async () => {
    const initiator = createSyncHandshakeInitiator(makeInitiatorDeps());
    const report = vi.fn<(entry: SyncStatusEntry) => void>();
    const unsubscribe = installHandshakeStatusReporter({ initiator, report });
    unsubscribe();
    await initiator.start();
    expect(report).not.toHaveBeenCalled();
  });

  it('emits failed entries with the failure detail surfaced', async () => {
    const deps = makeInitiatorDeps();
    deps.applySnapshot = vi.fn(async () => {
      throw new Error('boom');
    });
    const initiator = createSyncHandshakeInitiator(deps);
    const report = vi.fn<(entry: SyncStatusEntry) => void>();
    installHandshakeStatusReporter({ initiator, report });
    await initiator.start();
    await initiator.handle(welcomeAccept);
    await initiator.handle({
      type: 'oh.sync.snapshot',
      workspaceId: 'ws-1',
      snapshot: {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        workspaceId: 'ws-1',
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
      },
    });
    const lastCall = report.mock.calls.at(-1);
    expect(lastCall?.[0].state).toBe('red');
    expect(lastCall?.[0].message).toMatch(/boom/);
  });
});
