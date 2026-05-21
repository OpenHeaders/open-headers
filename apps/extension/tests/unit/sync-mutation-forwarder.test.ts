/**
 * Phase C C7 / C15 — outbound mutation forwarder + reconnect-flush.
 */

import { SYNC_MUTATION_TYPE } from '@openheaders/core/protocol';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import {
  __resetOutboundGateForTests,
  DEFAULT_REMOTE_ID,
  InMemoryPendingOutQueue,
  setOutboundEchoGuard,
} from '@openheaders/oracle/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn<(data: Record<string, unknown>) => boolean>(() => true);
const isConnectedMock = vi.fn<() => boolean>(() => true);

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/websocket', () => ({
  sendViaWebSocket: (data: Record<string, unknown>) => sendMock(data),
  isWebSocketConnected: () => isConnectedMock(),
}));

import {
  __getDroppedNoQueueCount,
  __resetMutationForwarderForTests,
  flushPendingOutToBackend,
  forwardMutationToBackend,
  setPendingOutQueue,
} from '../../src/background/sync-mutation-forwarder';
import { installSyntheticIdentityForTests } from './sync/_identity-test-setup';

// Every test envelope is stamped `orgId: 'org-test'`; the outbound gate
// only forwards envelopes whose Org is *consumed* (a joined backend's
// Org). Joining `org-test` puts it in the consumed set so the forward /
// flush mechanics under test aren't tenancy-filtered away.
const CONSUMED_TEST_ORG = { id: 'org-test', name: 'Test Backend Org', isSynthetic: false };

const event = (overrides: Partial<OracleSyncBroadcastEvent> = {}): OracleSyncBroadcastEvent =>
  ({
    envelope: {
      mutationId: 'm-1',
      hlc: { physicalMs: 1000, logical: 0, nodeId: 'sw' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: 'ws-1',
      orgId: 'org-test',
      mutatorVersion: 1,
      body: { kind: 'delete', type: 'rule', id: 'r' },
    },
    outcome: { status: 'applied' },
    ...overrides,
  }) as OracleSyncBroadcastEvent;

const eventWith = (mutationId: string, ms: number): OracleSyncBroadcastEvent =>
  event({ envelope: { ...event().envelope, mutationId, hlc: { physicalMs: ms, logical: 0, nodeId: 'sw' } } });

let teardownIdentity: () => void = () => undefined;

beforeEach(async () => {
  teardownIdentity = await installSyntheticIdentityForTests([], [CONSUMED_TEST_ORG]);
  sendMock.mockReset();
  sendMock.mockReturnValue(true);
  isConnectedMock.mockReset();
  isConnectedMock.mockReturnValue(true);
  __resetMutationForwarderForTests();
  __resetOutboundGateForTests();
});

afterEach(() => {
  __resetMutationForwarderForTests();
  __resetOutboundGateForTests();
  teardownIdentity();
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

  it('skips an envelope the outbound gate flags as a wire echo (C11)', () => {
    setOutboundEchoGuard(() => true);
    forwardMutationToBackend(event());
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('withholds an envelope whose Org is not consumed (U6.2 tenancy filter)', () => {
    forwardMutationToBackend(event({ envelope: { ...event().envelope, orgId: 'org-home-not-consumed' } }));
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('enqueues to pending-out queue on send failure when queue is installed', async () => {
    const queue = new InMemoryPendingOutQueue();
    setPendingOutQueue(queue);
    sendMock.mockReturnValue(false);
    forwardMutationToBackend(eventWith('m-offline', 1_000));
    // Enqueue is fire-and-forget — yield to microtasks.
    await Promise.resolve();
    expect(await queue.size(DEFAULT_REMOTE_ID)).toBe(1);
    expect(await queue.has(DEFAULT_REMOTE_ID, 'm-offline')).toBe(true);
  });

  it('counts drops only when no queue is installed', async () => {
    sendMock.mockReturnValue(false);
    forwardMutationToBackend(eventWith('m-a', 1_000));
    forwardMutationToBackend(eventWith('m-b', 2_000));
    expect(__getDroppedNoQueueCount()).toBe(2);
  });
});

describe('flushPendingOutToBackend', () => {
  it('drains queued envelopes in HLC order and acks each', async () => {
    const queue = new InMemoryPendingOutQueue();
    setPendingOutQueue(queue);
    sendMock.mockReturnValue(false);
    isConnectedMock.mockReturnValue(false);

    forwardMutationToBackend(eventWith('m-2', 2_000));
    forwardMutationToBackend(eventWith('m-1', 1_000));
    forwardMutationToBackend(eventWith('m-3', 3_000));
    await Promise.resolve();
    expect(await queue.size(DEFAULT_REMOTE_ID)).toBe(3);

    // Reconnect: send + isConnected now return true; flush drains.
    sendMock.mockClear();
    sendMock.mockReturnValue(true);
    isConnectedMock.mockReturnValue(true);
    await flushPendingOutToBackend();

    const orderedSentIds = sendMock.mock.calls
      .filter((c) => (c[0]! as { type?: string }).type === SYNC_MUTATION_TYPE)
      .map((c) => (c[0]! as { envelope: { mutationId: string } }).envelope.mutationId);
    expect(orderedSentIds).toEqual(['m-1', 'm-2', 'm-3']);
    expect(await queue.size(DEFAULT_REMOTE_ID)).toBe(0);
  });

  it('stops mid-drain if the connection drops; remainder stays queued', async () => {
    const queue = new InMemoryPendingOutQueue();
    setPendingOutQueue(queue);
    sendMock.mockReturnValue(false);
    isConnectedMock.mockReturnValue(false);

    forwardMutationToBackend(eventWith('m-1', 1_000));
    forwardMutationToBackend(eventWith('m-2', 2_000));
    forwardMutationToBackend(eventWith('m-3', 3_000));
    await Promise.resolve();

    // Reconnect: first send succeeds, second send fails (transport breaks
    // mid-drain). isConnected stays true for both attempts; flush should
    // still stop after the failing send.
    isConnectedMock.mockReturnValue(true);
    sendMock.mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValue(true);
    await flushPendingOutToBackend();

    // m-1 acked, m-2 + m-3 still pending.
    expect(await queue.has(DEFAULT_REMOTE_ID, 'm-1')).toBe(false);
    expect(await queue.has(DEFAULT_REMOTE_ID, 'm-2')).toBe(true);
    expect(await queue.has(DEFAULT_REMOTE_ID, 'm-3')).toBe(true);
  });

  it('is a no-op when no queue is installed', async () => {
    await flushPendingOutToBackend();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('coalesces concurrent flush calls onto one in-flight promise', async () => {
    const queue = new InMemoryPendingOutQueue();
    setPendingOutQueue(queue);
    sendMock.mockReturnValue(false);
    isConnectedMock.mockReturnValue(false);
    forwardMutationToBackend(eventWith('m-1', 1_000));
    await Promise.resolve();

    sendMock.mockReturnValue(true);
    isConnectedMock.mockReturnValue(true);

    const a = flushPendingOutToBackend();
    const b = flushPendingOutToBackend();
    expect(a).toBe(b);
    await a;
    expect(await queue.size(DEFAULT_REMOTE_ID)).toBe(0);
  });
});
