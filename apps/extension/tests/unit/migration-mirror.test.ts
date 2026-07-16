/**
 * Migration pull mirroring + RPCs in the SW — the extension leg of the
 * S5 addendum's "progress auto-syncs to every connected surface", plus
 * the Phase B local run host seams:
 *   - the inbound frame handler claims `migrationPullEvent` frames off
 *     the backend wire and re-broadcasts the payload to every open
 *     extension surface (malformed frames are still claimed, but
 *     dropped; other frame types pass to the next handler); a frame
 *     carrying a run this SW itself started is claimed but NOT
 *     re-broadcast — the local run host already delivered it;
 *   - `oh.migration.postmanPull.listWorkspaces` / `.start` run LOCALLY
 *     through the run host, mirroring the desktop pair's vocabulary
 *     (missing-key refusals included) so the stepper stays host-blind;
 *   - `oh.migration.postmanPull.getState` answers local-first; with no
 *     local run it forwards over the wire to the desktop's
 *     operator-gated peer plane, and answers the idle run state on
 *     every failure leg (no wire, wire error) so the tenant's
 *     `runId === null` guard makes it a no-op.
 */

import { initialPullRunState } from '@openheaders/core/import';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBroadcast, mockWsRequest, mockIsLocalRun, mockStopLocal, mockHost } = vi.hoisted(() => ({
  mockBroadcast: vi.fn(),
  mockWsRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  mockIsLocalRun: vi.fn(() => false),
  mockStopLocal: vi.fn(() => false),
  mockHost: {
    listWorkspaces: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
      ok: true,
      workspaces: [],
      budget: {},
    })),
    start: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ started: true, runId: 'run-local' })),
    getState: vi.fn(() => initialPullRunState()),
    isLocalRun: vi.fn(() => false),
    settled: vi.fn(async () => undefined),
  },
}));

vi.mock('@utils/bridge', () => ({
  broadcast: mockBroadcast,
}));

vi.mock('@/background/ws-request', () => ({
  wsRequest: mockWsRequest,
}));

vi.mock('@/background/modules/migration-run/run-host', () => ({
  getSwMigrationRunHost: () => mockHost,
  isLocalMigrationPullRun: mockIsLocalRun,
  stopLocalMigrationPull: mockStopLocal,
}));

import { migrationHandlers } from '@/background/modules/message-handler/handlers/migration';
import type { HandlerArgs } from '@/background/modules/message-handler/types';
import { handleIncomingMigrationPullFrame } from '@/background/modules/migration-mirror';

const PAYLOAD = { runId: 'run-1', seq: 3, event: { kind: 'importing' } };

beforeEach(() => {
  mockBroadcast.mockReset();
  mockWsRequest.mockReset();
  mockIsLocalRun.mockReset();
  mockIsLocalRun.mockReturnValue(false);
  mockHost.listWorkspaces.mockClear();
  mockHost.start.mockClear();
  mockHost.getState.mockReset();
  mockHost.getState.mockReturnValue(initialPullRunState());
  mockStopLocal.mockReset();
  mockStopLocal.mockReturnValue(false);
});

function invoke(type: string, extra: Record<string, unknown> = {}, connected = false) {
  const handler = migrationHandlers[type];
  const respond = vi.fn();
  const args = {
    message: { type, ...extra },
    sender: {} as chrome.runtime.MessageSender,
    respond,
    ctx: { isWebSocketConnected: () => connected },
  } as unknown as HandlerArgs;
  const result = handler(args) ? true : undefined;
  return { respond, result };
}

describe('handleIncomingMigrationPullFrame', () => {
  it('claims a migrationPullEvent frame and re-broadcasts the payload to surfaces', () => {
    const claimed = handleIncomingMigrationPullFrame({ type: 'migrationPullEvent', payload: PAYLOAD });
    expect(claimed).toBe(true);
    expect(mockBroadcast).toHaveBeenCalledWith('migrationPullEvent', PAYLOAD);
  });

  it('claims but does not re-broadcast a frame for a locally-run pull', () => {
    mockIsLocalRun.mockReturnValue(true);
    const claimed = handleIncomingMigrationPullFrame({ type: 'migrationPullEvent', payload: PAYLOAD });
    expect(claimed).toBe(true);
    expect(mockIsLocalRun).toHaveBeenCalledWith('run-1');
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('leaves other frame types to the next handler', () => {
    expect(handleIncomingMigrationPullFrame({ type: 'oh.awareness.presence', payload: {} })).toBe(false);
    expect(handleIncomingMigrationPullFrame(null)).toBe(false);
    expect(handleIncomingMigrationPullFrame('migrationPullEvent')).toBe(false);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('claims but drops a malformed frame', () => {
    const claimed = handleIncomingMigrationPullFrame({
      type: 'migrationPullEvent',
      payload: { runId: 42, seq: 'x', event: null },
    });
    expect(claimed).toBe(true);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});

describe('oh.migration.postmanPull.listWorkspaces handler', () => {
  it('runs the enumeration preflight locally with the trimmed key', async () => {
    const list = { ok: true, workspaces: [{ id: 'ws-1', name: 'Team', collections: 2, environments: 1 }], budget: {} };
    mockHost.listWorkspaces.mockResolvedValueOnce(list);

    const { respond, result } = invoke('oh.migration.postmanPull.listWorkspaces', { apiKey: '  PMAK-test-key  ' });
    expect(result).toBe(true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(list));
    expect(mockHost.listWorkspaces).toHaveBeenCalledWith('PMAK-test-key');
  });

  it('refuses a missing key with the desktop pair vocabulary', () => {
    const { respond } = invoke('oh.migration.postmanPull.listWorkspaces', { apiKey: '   ' });
    expect(respond).toHaveBeenCalledWith({ ok: false, reason: 'An API key is required to list workspaces.' });
    expect(mockHost.listWorkspaces).not.toHaveBeenCalled();
  });
});

describe('oh.migration.postmanPull.start handler', () => {
  it('starts a local run with the trimmed key and the string-filtered selection', async () => {
    const { respond, result } = invoke('oh.migration.postmanPull.start', {
      apiKey: ' PMAK-test-key ',
      workspaceIds: ['ws-1', 7, 'ws-2'],
    });
    expect(result).toBe(true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith({ started: true, runId: 'run-local' }));
    expect(mockHost.start).toHaveBeenCalledWith('PMAK-test-key', ['ws-1', 'ws-2']);
  });

  it('refuses a missing key with the desktop pair vocabulary', () => {
    const { respond } = invoke('oh.migration.postmanPull.start', { apiKey: '' });
    expect(respond).toHaveBeenCalledWith({ started: false, reason: 'An API key is required to start the pull.' });
    expect(mockHost.start).not.toHaveBeenCalled();
  });
});

describe('oh.migration.postmanPull.getState handler', () => {
  it('answers the local run state when this host has one, without touching the wire', () => {
    const local = { ...initialPullRunState(), runId: 'run-local', phase: 'pulling' as const };
    mockHost.getState.mockReturnValue(local);

    const { respond } = invoke('oh.migration.postmanPull.getState', {}, true);
    expect(respond).toHaveBeenCalledWith(local);
    expect(mockWsRequest).not.toHaveBeenCalled();
  });

  it('forwards over the wire when connected with no local run and answers the peer state', async () => {
    const state = { runId: 'run-1', phase: 'pulling' };
    mockWsRequest.mockResolvedValueOnce(state);

    const { respond, result } = invoke('oh.migration.postmanPull.getState', {}, true);
    expect(result).toBe(true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(state));
    expect(mockWsRequest).toHaveBeenCalledWith({ type: 'oh.migration.postmanPull.getState' });
  });

  it('answers the idle run state without a connected wire', () => {
    const { respond } = invoke('oh.migration.postmanPull.getState', {}, false);
    expect(respond).toHaveBeenCalledWith(initialPullRunState());
    expect(mockWsRequest).not.toHaveBeenCalled();
  });

  it('answers the idle run state when the wire request fails', async () => {
    mockWsRequest.mockRejectedValueOnce(new Error('timeout'));
    const { respond } = invoke('oh.migration.postmanPull.getState', {}, true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(initialPullRunState()));
  });
});

describe('oh.migration.postmanPull.stop handler', () => {
  it('stops the local run and answers the outcome', () => {
    mockStopLocal.mockReturnValue(true);
    const { respond } = invoke('oh.migration.postmanPull.stop');
    expect(respond).toHaveBeenCalledWith({ stopped: true });
    expect(mockStopLocal).toHaveBeenCalledTimes(1);
  });

  it('answers stopped: false when nothing local is stoppable — never touches the wire', () => {
    const { respond } = invoke('oh.migration.postmanPull.stop', {}, true);
    expect(respond).toHaveBeenCalledWith({ stopped: false });
    expect(mockWsRequest).not.toHaveBeenCalled();
  });
});
