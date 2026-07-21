/**
 * Migration pull peer plane — the same-user laws: the broadcast
 * forwarder only reaches peers authenticated as the host operator (and
 * goes nowhere without a server or an identity snapshot), and the
 * `getState` peer RPC answers the operator while refusing everyone
 * else — including when no operator identity exists to compare against.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  operatorId: 'user-op' as string | undefined,
}));

vi.mock('@openheaders/core/identity', () => ({
  getIdentitySnapshot: () => (h.operatorId === undefined ? null : { user: { id: h.operatorId } }),
}));

import { setWsPeerServer } from '../../../src/daemon/ws-peer-slot';
import type { OracleWsServer, PeerSummary } from '../../../src/host-runtime/ws-server';
import {
  broadcastMigrationPullToPeers,
  createMigrationPeerRpc,
  MIGRATION_STATE_OPERATOR_ONLY_MESSAGE,
} from '../../../src/migration/pull-peer-plane';

interface RecordedBroadcast {
  frame: Record<string, unknown>;
  opts?: { filterPeer?: (peer: PeerSummary) => boolean };
}

function makeRecordingServer(): { server: OracleWsServer; broadcasts: RecordedBroadcast[] } {
  const broadcasts: RecordedBroadcast[] = [];
  const server: OracleWsServer = {
    broadcast: () => undefined,
    broadcastFrame: (frame, opts) => {
      broadcasts.push({ frame, opts });
    },
    connectedCount: () => 0,
    connectedTokenIds: () => new Set(),
    closePeersByTokenId: () => 0,
    listConnectedPeers: () => [],
    subscribePeerChange: () => () => undefined,
    close: async () => undefined,
  };
  return { server, broadcasts };
}

function makePeer(userId: string | null): PeerSummary {
  return {
    peerId: 'peer-1',
    role: 'extension',
    agent: '@openheaders/extension@2026.7.1',
    workspaceId: 'ws-1',
    nodeId: 'node-1',
    installId: null,
    tokenId: 'tok-1',
    userId,
    isLoopback: true,
  };
}

beforeEach(() => {
  h.operatorId = 'user-op';
  setWsPeerServer(null);
});

describe('broadcastMigrationPullToPeers', () => {
  it('forwards the frame in the { type, payload } broadcast shape', () => {
    const { server, broadcasts } = makeRecordingServer();
    setWsPeerServer(server);

    const payload = { runId: 'run-1', seq: 1, event: { kind: 'importing' } };
    broadcastMigrationPullToPeers('migrationPullEvent', payload);

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]?.frame).toEqual({ type: 'migrationPullEvent', payload });
  });

  it('filters the fan-out to peers authenticated as the operator', () => {
    const { server, broadcasts } = makeRecordingServer();
    setWsPeerServer(server);

    broadcastMigrationPullToPeers('migrationPullEvent', { runId: 'run-1', seq: 1, event: { kind: 'importing' } });

    const filterPeer = broadcasts[0]?.opts?.filterPeer;
    expect(filterPeer).toBeTypeOf('function');
    expect(filterPeer?.(makePeer('user-op'))).toBe(true);
    expect(filterPeer?.(makePeer('user-other'))).toBe(false);
    expect(filterPeer?.(makePeer(null))).toBe(false);
  });

  it('reaches no peer while the identity snapshot is absent', () => {
    const { server, broadcasts } = makeRecordingServer();
    setWsPeerServer(server);
    h.operatorId = undefined;

    broadcastMigrationPullToPeers('migrationPullEvent', { runId: 'run-1', seq: 1, event: { kind: 'importing' } });

    const filterPeer = broadcasts[0]?.opts?.filterPeer;
    expect(filterPeer?.(makePeer('user-op'))).toBe(false);
  });

  it('is a no-op without a bound server', () => {
    const { broadcasts } = makeRecordingServer();
    broadcastMigrationPullToPeers('migrationPullEvent', { runId: 'run-1', seq: 1, event: { kind: 'importing' } });
    expect(broadcasts).toHaveLength(0);
  });
});

describe('createMigrationPeerRpc', () => {
  const state = { runId: 'run-1', phase: 'pulling' };
  const rpc = createMigrationPeerRpc({ getState: () => state as never });

  it('owns exactly the getState channel', () => {
    expect(rpc.owns('oh.migration.postmanPull.getState')).toBe(true);
    expect(rpc.owns('oh.migration.postmanPull.start')).toBe(false);
    expect(rpc.owns('executeRequest')).toBe(false);
  });

  it('answers the operator with the folded run state', async () => {
    await expect(rpc.dispatch({ type: 'oh.migration.postmanPull.getState' }, { userId: 'user-op' })).resolves.toBe(
      state,
    );
  });

  it('refuses a non-operator peer', async () => {
    await expect(rpc.dispatch({ type: 'oh.migration.postmanPull.getState' }, { userId: 'user-other' })).rejects.toThrow(
      MIGRATION_STATE_OPERATOR_ONLY_MESSAGE,
    );
  });

  it('refuses everyone while the identity snapshot is absent', async () => {
    h.operatorId = undefined;
    await expect(rpc.dispatch({ type: 'oh.migration.postmanPull.getState' }, { userId: 'user-op' })).rejects.toThrow(
      MIGRATION_STATE_OPERATOR_ONLY_MESSAGE,
    );
  });
});
