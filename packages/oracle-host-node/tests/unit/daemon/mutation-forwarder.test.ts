/**
 * Hub egress mutation forwarder — the host-local floor.
 *
 * A layout-state mutation (per-surface UI state) must never leave the
 * hub toward WS peers, on any reach tier — the egress mirror of the
 * catch-up responder's strip and the client outbound gate's floor.
 * Everything else keeps riding `broadcastFrame` with the reach +
 * originator-exclusion options the S12 relay contract pinned.
 */

import type { MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';
import { LAYOUT_STATE_ENTITY_TYPE, LAYOUT_STATE_ID, RULE_ENTITY_TYPE, VAULT_ENTITY_TYPE } from '@openheaders/core/sync';
import { afterEach, describe, expect, it } from 'vitest';
import { forwardMutationToWsPeers, setMutationForwarderWsServer } from '../../../src/daemon/mutation-forwarder';
import type { OracleWsServer } from '../../../src/host-runtime/ws-server';

interface RecordedBroadcast {
  frame: Record<string, unknown>;
  opts?: { loopbackOnly?: boolean; excludeNodeId?: string; filterPeer?: unknown };
}

/** The forwarder queues sends behind an async read-filter resolution. */
function flushForwarderQueue(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

const APPLIED: MutatorOutcome = { status: 'applied' };

function makeEnvelope(type: string, id: string): MutationEnvelope {
  return {
    mutationId: `m-${type}`,
    hlc: { physicalMs: 1_000, logical: 0, nodeId: 'peer-a' },
    origin: { surfaceId: 's', deviceId: 'd' },
    workspaceId: 'ws-1',
    orgId: 'org-1',
    mutatorVersion: 1,
    body: { kind: 'setField', type, id, path: 'p', value: {} },
  };
}

afterEach(() => {
  setMutationForwarderWsServer(null);
});

describe('forwardMutationToWsPeers', () => {
  it('never puts a host-local (layout) mutation on the wire', async () => {
    const { server, broadcasts } = makeRecordingServer();
    setMutationForwarderWsServer(server);

    forwardMutationToWsPeers({
      envelope: makeEnvelope(LAYOUT_STATE_ENTITY_TYPE, LAYOUT_STATE_ID),
      outcome: APPLIED,
      applyOrigin: 'local',
    });
    await flushForwarderQueue();
    expect(broadcasts).toHaveLength(0);
  });

  it('forwards a synced entity with the originator excluded and the read filter attached', async () => {
    const { server, broadcasts } = makeRecordingServer();
    setMutationForwarderWsServer(server);

    forwardMutationToWsPeers({
      envelope: makeEnvelope(RULE_ENTITY_TYPE, 'r-1'),
      outcome: APPLIED,
      applyOrigin: 'inbound',
    });
    await flushForwarderQueue();
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]?.opts).toMatchObject({ loopbackOnly: false, excludeNodeId: 'peer-a' });
    expect(typeof broadcasts[0]?.opts?.filterPeer).toBe('function');
  });

  it('keeps the vault loopback-only (reach tier, not host-local)', async () => {
    const { server, broadcasts } = makeRecordingServer();
    setMutationForwarderWsServer(server);

    forwardMutationToWsPeers({
      envelope: makeEnvelope(VAULT_ENTITY_TYPE, 'vault'),
      outcome: APPLIED,
      applyOrigin: 'local',
    });
    await flushForwarderQueue();
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]?.opts?.loopbackOnly).toBe(true);
  });

  it('preserves commit order across queued sends', async () => {
    const { server, broadcasts } = makeRecordingServer();
    setMutationForwarderWsServer(server);

    forwardMutationToWsPeers({
      envelope: makeEnvelope(RULE_ENTITY_TYPE, 'r-1'),
      outcome: APPLIED,
      applyOrigin: 'local',
    });
    forwardMutationToWsPeers({
      envelope: makeEnvelope(RULE_ENTITY_TYPE, 'r-2'),
      outcome: APPLIED,
      applyOrigin: 'local',
    });
    await flushForwarderQueue();
    const bodyIds = broadcasts.map((b) => {
      const envelope = (b.frame as unknown as { envelope: MutationEnvelope }).envelope;
      return envelope.body.id;
    });
    expect(bodyIds).toEqual(['r-1', 'r-2']);
  });
});
