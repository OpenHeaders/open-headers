/**
 * Phase C C7 / C15 — outbound mutation forwarder + reconnect-flush,
 * generalized to Org-binding routing (MULTI_BACKEND_PLAN.md §3):
 * every envelope goes to exactly the backend its Org is bound to, and
 * the pending-out queue keeps one cursor per backend.
 */

import { SYNC_MUTATION_TYPE } from '@openheaders/core/protocol';
import type { Org } from '@openheaders/core/types';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import { __resetOutboundGateForTests, InMemoryPendingOutQueue, setOutboundEchoGuard } from '@openheaders/oracle/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn<(backendId: string, data: Record<string, unknown>) => boolean>(() => true);
const isConnectedMock = vi.fn<(backendId: string) => boolean>(() => true);

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/websocket', () => ({
  sendToBackend: (backendId: string, data: Record<string, unknown>) => sendMock(backendId, data),
  isBackendConnected: (backendId: string) => isConnectedMock(backendId),
}));

import {
  __getDroppedNoQueueCount,
  __resetMutationForwarderForTests,
  flushPendingOutToBackend,
  forwardMutationToBackend,
  setPendingOutQueue,
} from '../../src/background/sync-mutation-forwarder';
import { installSyntheticIdentityForTests, TEST_BACKEND_ID } from './sync/_identity-test-setup';

// Every test envelope is stamped `orgId: 'org-test'`; the outbound gate
// only forwards envelopes whose Org is *consumed* (a joined backend's
// Org), and the router resolves the target from the Org's binding —
// here TEST_BACKEND_ID.
const CONSUMED_TEST_ORG: Org = { id: 'org-test', name: 'Test Backend Org', hostKind: 'desktop', isPrivate: false };

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
  it('serializes the committed envelope as oh.sync.mutation to the Org-bound backend', () => {
    forwardMutationToBackend(event());
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [backendId, sent] = sendMock.mock.calls[0]!;
    expect(backendId).toBe(TEST_BACKEND_ID);
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

  it('enqueues under the Org-bound backend on send failure when queue is installed', async () => {
    const queue = new InMemoryPendingOutQueue();
    setPendingOutQueue(queue);
    sendMock.mockReturnValue(false);
    forwardMutationToBackend(eventWith('m-offline', 1_000));
    // Enqueue is fire-and-forget — yield to microtasks.
    await Promise.resolve();
    expect(await queue.size(TEST_BACKEND_ID)).toBe(1);
    expect(await queue.has(TEST_BACKEND_ID, 'm-offline')).toBe(true);
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
    expect(await queue.size(TEST_BACKEND_ID)).toBe(3);

    // Reconnect: send + isConnected now return true; flush drains.
    sendMock.mockClear();
    sendMock.mockReturnValue(true);
    isConnectedMock.mockReturnValue(true);
    await flushPendingOutToBackend(TEST_BACKEND_ID);

    const orderedSentIds = sendMock.mock.calls
      .filter((c) => (c[1]! as { type?: string }).type === SYNC_MUTATION_TYPE)
      .map((c) => (c[1]! as { envelope: { mutationId: string } }).envelope.mutationId);
    expect(orderedSentIds).toEqual(['m-1', 'm-2', 'm-3']);
    expect(await queue.size(TEST_BACKEND_ID)).toBe(0);
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
    await flushPendingOutToBackend(TEST_BACKEND_ID);

    // m-1 acked, m-2 + m-3 still pending.
    expect(await queue.has(TEST_BACKEND_ID, 'm-1')).toBe(false);
    expect(await queue.has(TEST_BACKEND_ID, 'm-2')).toBe(true);
    expect(await queue.has(TEST_BACKEND_ID, 'm-3')).toBe(true);
  });

  it('is a no-op when no queue is installed', async () => {
    await flushPendingOutToBackend(TEST_BACKEND_ID);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('coalesces concurrent same-backend flush calls onto one in-flight promise', async () => {
    const queue = new InMemoryPendingOutQueue();
    setPendingOutQueue(queue);
    sendMock.mockReturnValue(false);
    isConnectedMock.mockReturnValue(false);
    forwardMutationToBackend(eventWith('m-1', 1_000));
    await Promise.resolve();

    sendMock.mockReturnValue(true);
    isConnectedMock.mockReturnValue(true);

    const a = flushPendingOutToBackend(TEST_BACKEND_ID);
    const b = flushPendingOutToBackend(TEST_BACKEND_ID);
    expect(a).toBe(b);
    await a;
    expect(await queue.size(TEST_BACKEND_ID)).toBe(0);
  });

  it("flushing one backend never touches another backend's cursor", async () => {
    const queue = new InMemoryPendingOutQueue();
    setPendingOutQueue(queue);
    const foreign = eventWith('m-foreign', 1_000).envelope;
    await queue.enqueue('backend-other', foreign);
    sendMock.mockReturnValue(false);
    isConnectedMock.mockReturnValue(false);
    forwardMutationToBackend(eventWith('m-mine', 2_000));
    await Promise.resolve();

    sendMock.mockClear();
    sendMock.mockReturnValue(true);
    isConnectedMock.mockImplementation((backendId) => backendId === TEST_BACKEND_ID);
    await flushPendingOutToBackend(TEST_BACKEND_ID);

    expect(sendMock.mock.calls.every((c) => c[0] === TEST_BACKEND_ID)).toBe(true);
    expect(await queue.has('backend-other', 'm-foreign')).toBe(true);
    expect(await queue.size(TEST_BACKEND_ID)).toBe(0);
  });
});
