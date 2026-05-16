/**
 * Phase C C7 — outbound mutation forwarder.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SYNC_MUTATION_TYPE } from '@openheaders/core/protocol';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';

const sendMock = vi.fn<(data: Record<string, unknown>) => boolean>(() => true);

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/websocket', () => ({
  sendViaWebSocket: (data: Record<string, unknown>) => sendMock(data),
}));

import {
  __getDroppedOfflineCount,
  __resetMutationForwarderForTests,
  forwardMutationToBackend,
  setShouldForwardMutation,
} from '../../src/background/sync-mutation-forwarder';

const event = (overrides: Partial<OracleSyncBroadcastEvent> = {}): OracleSyncBroadcastEvent =>
  ({
    envelope: {
      mutationId: 'm-1',
      hlc: { physicalMs: 1000, logical: 0, nodeId: 'sw' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: 'ws-1',
      mutatorVersion: 1,
      body: { kind: 'delete', type: 'rule', id: 'r' },
    },
    outcome: { status: 'applied' },
    ...overrides,
  }) as OracleSyncBroadcastEvent;

beforeEach(() => {
  sendMock.mockClear();
  sendMock.mockReturnValue(true);
  __resetMutationForwarderForTests();
});

afterEach(() => {
  __resetMutationForwarderForTests();
});

describe('forwardMutationToBackend', () => {
  it('serializes the committed envelope as oh.sync.mutation', () => {
    forwardMutationToBackend(event());
    expect(sendMock).toHaveBeenCalledTimes(1);
    const sent = sendMock.mock.calls[0]![0];
    expect(sent.type).toBe(SYNC_MUTATION_TYPE);
    expect(sent.workspaceId).toBe('ws-1');
    expect((sent.envelope as { mutationId: string }).mutationId).toBe('m-1');
  });

  it('respects the shouldForward predicate (C11 plug-in seam)', () => {
    setShouldForwardMutation(() => false);
    forwardMutationToBackend(event());
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('counts drops while the backend is offline', () => {
    sendMock.mockReturnValue(false);
    forwardMutationToBackend(event({ envelope: { ...event().envelope, mutationId: 'm-a' } }));
    forwardMutationToBackend(event({ envelope: { ...event().envelope, mutationId: 'm-b' } }));
    expect(__getDroppedOfflineCount()).toBe(2);
  });

  it('resets the offline counter once a send succeeds', () => {
    sendMock.mockReturnValue(false);
    forwardMutationToBackend(event());
    expect(__getDroppedOfflineCount()).toBe(1);

    sendMock.mockReturnValue(true);
    forwardMutationToBackend(event());
    expect(__getDroppedOfflineCount()).toBe(0);
  });
});
