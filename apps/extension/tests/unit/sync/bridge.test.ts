/**
 * Bridge protocol contract: an apply request with a multi-mutation
 * batch round-trips through `handleSyncApply` to the oracle, and the
 * oracle's broadcast events are funnelled through `wireBroadcastToSink`
 * as wire `SyncBroadcastEvent` payloads.
 */

import {
  type SyncApplyRequest,
  type SyncBroadcastEvent,
  SYNC_APPLY_TYPE,
  SYNC_BROADCAST_TYPE,
} from '@openheaders/core/protocol';
import { type RuleMutatorContext, toggleEnabled } from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { handleSyncApply, wireBroadcastToSink } from '@/background/sync/bridge';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, RuleOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): RuleMutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

describe('sync bridge', () => {
  it('handleSyncApply forwards to the oracle and returns a typed ack', async () => {
    const broadcast = new InMemoryBroadcast();
    const oracle = new RuleOracle({
      workspaceId: wsId,
      lock,
      log: new InMemoryMutationLog(),
      intents: new InMemoryPendingIntents(),
      broadcast,
    });
    const intent = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    const req: SyncApplyRequest = {
      type: SYNC_APPLY_TYPE,
      batch: intent.batch,
      sideEffects: intent.sideEffects,
    };
    const ack = await handleSyncApply(oracle, req);
    expect(ack.ok).toBe(true);
    if (ack.ok) {
      expect(ack.outcomes).toHaveLength(1);
      expect(ack.outcomes[0].outcome.status).toBe('applied');
    }
  });

  it('wireBroadcastToSink relays committed envelopes as SyncBroadcastEvents', async () => {
    const broadcast = new InMemoryBroadcast();
    const oracle = new RuleOracle({
      workspaceId: wsId,
      lock,
      log: new InMemoryMutationLog(),
      intents: new InMemoryPendingIntents(),
      broadcast,
    });
    const sink: SyncBroadcastEvent[] = [];
    const off = wireBroadcastToSink(broadcast, (e) => sink.push(e));
    const intent = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    await oracle.apply(intent.batch, intent.sideEffects);
    off();
    expect(sink).toHaveLength(1);
    expect(sink[0].type).toBe(SYNC_BROADCAST_TYPE);
    expect(sink[0].envelope.mutationId).toBe(intent.batch.mutations[0].mutationId);
    expect(sink[0].batchId).toBe(intent.batch.batchId);
  });
});
