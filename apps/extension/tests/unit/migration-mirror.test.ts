/**
 * Migration pull mirroring in the SW — the extension leg of the S5
 * addendum's "progress auto-syncs to every connected surface":
 *   - the inbound frame handler claims `migrationPullEvent` frames off
 *     the backend wire and re-broadcasts the payload to every open
 *     extension surface (malformed frames are still claimed, but
 *     dropped; other frame types pass to the next handler);
 *   - the `oh.migration.postmanPull.getState` bridge RPC forwards over
 *     the wire to the desktop's operator-gated peer plane, and answers
 *     the idle run state on every failure leg (no wire, wire error) so
 *     the tenant's `runId === null` guard makes it a no-op.
 */

import { initialPullRunState } from '@openheaders/core/import';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBroadcast, mockWsRequest } = vi.hoisted(() => ({
  mockBroadcast: vi.fn(),
  mockWsRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
}));

vi.mock('@utils/bridge', () => ({
  broadcast: mockBroadcast,
}));

vi.mock('@/background/ws-request', () => ({
  wsRequest: mockWsRequest,
}));

import { migrationHandlers } from '@/background/modules/message-handler/handlers/migration';
import type { HandlerArgs } from '@/background/modules/message-handler/types';
import { handleIncomingMigrationPullFrame } from '@/background/modules/migration-mirror';

const PAYLOAD = { runId: 'run-1', seq: 3, event: { kind: 'importing' } };

beforeEach(() => {
  mockBroadcast.mockReset();
  mockWsRequest.mockReset();
});

describe('handleIncomingMigrationPullFrame', () => {
  it('claims a migrationPullEvent frame and re-broadcasts the payload to surfaces', () => {
    const claimed = handleIncomingMigrationPullFrame({ type: 'migrationPullEvent', payload: PAYLOAD });
    expect(claimed).toBe(true);
    expect(mockBroadcast).toHaveBeenCalledWith('migrationPullEvent', PAYLOAD);
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

describe('oh.migration.postmanPull.getState handler', () => {
  const handler = migrationHandlers['oh.migration.postmanPull.getState'];

  function invoke(connected: boolean): { respond: ReturnType<typeof vi.fn>; result: boolean | undefined } {
    const respond = vi.fn();
    const args = {
      message: { type: 'oh.migration.postmanPull.getState' },
      sender: {} as chrome.runtime.MessageSender,
      respond,
      ctx: { isWebSocketConnected: () => connected },
    } as unknown as HandlerArgs;
    const result = handler(args) ? true : undefined;
    return { respond, result };
  }

  it('forwards over the wire when connected and answers the peer state', async () => {
    const state = { runId: 'run-1', phase: 'pulling' };
    mockWsRequest.mockResolvedValueOnce(state);

    const { respond, result } = invoke(true);
    expect(result).toBe(true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(state));
    expect(mockWsRequest).toHaveBeenCalledWith({ type: 'oh.migration.postmanPull.getState' });
  });

  it('answers the idle run state without a connected wire', () => {
    const { respond } = invoke(false);
    expect(respond).toHaveBeenCalledWith(initialPullRunState());
    expect(mockWsRequest).not.toHaveBeenCalled();
  });

  it('answers the idle run state when the wire request fails', async () => {
    mockWsRequest.mockRejectedValueOnce(new Error('timeout'));
    const { respond } = invoke(true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith(initialPullRunState()));
  });
});
