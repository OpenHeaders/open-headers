/**
 * Phase C C11 — `mutationId` dedup at receive.
 *
 * Pins the design discipline: redelivery via any combination of
 * inbound transports must be a no-op.
 *   - Same envelope arriving twice over WS → applied once.
 *   - Same envelope arriving over WS after a local apply → not
 *     reapplied (the local apply also marks the id in the seen set
 *     via the broadcast hook in real wiring; here we exercise the
 *     wire-only redelivery path).
 *   - Batch redelivery → no double-apply at the oracle layer because
 *     `mutationId` is also idempotent at commit (the bridge's
 *     short-circuit + the oracle's per-id idempotency are layered).
 */

import { SYNC_MUTATION_BATCH_TYPE, SYNC_MUTATION_TYPE } from '@openheaders/core/protocol';
import type { MutatorContext } from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { dispatchSyncRpc } from '@openheaders/oracle/rpc';
import {
  __resetMutationStreamBridgeForTests,
  __seenMutationStreamCountForTests,
  hasRecentlyApplied,
  setOracleHostHooks,
} from '@openheaders/oracle/sync';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  getOracleForCurrentWorkspace,
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-dedup';

const ctx = (ms: number, nodeId = 'peer'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'peer-d',
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function logRows(log: InMemoryMutationLog): Promise<number> {
  let rows = 0;
  for await (const _ of log.readSince(null)) rows += 1;
  return rows;
}

const makeRule = (uid: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path: `rules/x/${uid}`,
    type: 'header',
    name: 'r',
    enabled: true,
    conditions: [{ uid: 'cnd00001', kind: 'url-pattern', urlPattern: 'https://openheaders.io/*' }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'set', value: '1' }],
      responseHeaders: [],
    },
  }) as unknown as Rule;

beforeEach(() => {
  // The inbound bridge's receiver-side org filter denies all envelopes
  // when no identity is installed (empty authorized set). The ctx
  // factory stamps no `orgId`, so envelopes carry the pre-bootstrap
  // sentinel — pin the snapshot's home-org to the same value.
  installTestIdentitySnapshot();
  __initSyncServiceForTests(wsId);
  __resetMutationStreamBridgeForTests();
});

afterEach(() => {
  __resetMutationStreamBridgeForTests();
  disposeSyncService();
  clearTestIdentitySnapshot();
});

describe('C11: mutationId dedup at receive', () => {
  it('single-envelope redelivery via dispatcher is a no-op', async () => {
    const envelope = seedRule(makeRule(generateUid()), ctx(1_000)).mutations[0]!;
    const frame = { type: SYNC_MUTATION_TYPE, workspaceId: wsId, envelope };

    const first = dispatchSyncRpc(frame as unknown as Record<string, unknown>);
    expect(first?.kind).toBe('async');
    if (first?.kind === 'async') await first.promise;

    const seenAfterFirst = __seenMutationStreamCountForTests();

    const second = dispatchSyncRpc(frame as unknown as Record<string, unknown>);
    if (second?.kind === 'async') await second.promise;

    expect(__seenMutationStreamCountForTests()).toBe(seenAfterFirst);
    expect(hasRecentlyApplied(envelope.mutationId)).toBe(true);
  });

  it('batch redelivery short-circuits when fully overlapping', async () => {
    const r = makeRule(generateUid());
    const batch = seedRule(r, ctx(2_000));
    const frame = { type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch };

    const first = dispatchSyncRpc(frame as unknown as Record<string, unknown>);
    if (first?.kind === 'async') await first.promise;
    const beforeRe = __seenMutationStreamCountForTests();

    const second = dispatchSyncRpc(frame as unknown as Record<string, unknown>);
    if (second?.kind === 'async') await second.promise;

    expect(__seenMutationStreamCountForTests()).toBe(beforeRe);

    // Rule still materialized exactly once — no double-create error.
    const oracle = getOracleForCurrentWorkspace();
    expect(oracle?.materializeOne('rule', r.uid)).toBeDefined();
  });

  it('partially-overlapping batch applies only the new envelopes', async () => {
    const r1 = makeRule(generateUid());
    const r2 = makeRule(generateUid());
    const batchA = seedRule(r1, ctx(3_000));
    const batchB = seedRule(r2, ctx(4_000));

    const frameA = { type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch: batchA };
    const aResult = dispatchSyncRpc(frameA as unknown as Record<string, unknown>);
    if (aResult?.kind === 'async') await aResult.promise;

    // Merge: A's envelopes + B's envelopes in one combined batch.
    const merged = {
      batchId: 'merged',
      mutations: [...batchA.mutations, ...batchB.mutations],
    };
    const mergedFrame = { type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch: merged };
    const mergedResult = dispatchSyncRpc(mergedFrame as unknown as Record<string, unknown>);
    if (mergedResult?.kind === 'async') await mergedResult.promise;

    // Both rules now materialized.
    const oracle = getOracleForCurrentWorkspace();
    expect(oracle?.materializeOne('rule', r1.uid)).toBeDefined();
    expect(oracle?.materializeOne('rule', r2.uid)).toBeDefined();
    for (const env of merged.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(true);
  });

  it('redelivery after a restart is silent: the durable log decides novelty, not the seen set', async () => {
    const log = new InMemoryMutationLog();
    const intents = new InMemoryPendingIntents();
    const recompiles: string[] = [];
    const boot = async () => {
      __initSyncServiceForTests(wsId, { log, intents, recompile: (reason) => recompiles.push(reason) });
      const svc = getOrCreateWorkspaceService(wsId);
      await svc.hydrated;
      releaseWorkspaceService(wsId);
      await flush();
    };
    await boot();
    const rule = makeRule(generateUid());
    const batch = seedRule(rule, ctx(5_000));
    const frame = { type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch };
    const first = dispatchSyncRpc(frame as unknown as Record<string, unknown>);
    if (first?.kind === 'async') await first.promise;
    await flush();
    expect(await logRows(log)).toBe(batch.mutations.length);
    expect(recompiles.length).toBeGreaterThan(0);

    // Restart: the in-memory seen set is gone; a fresh service opens
    // over the SAME log and replays it — the rule is back from the log
    // alone, with no storage mirror in this rig, and nothing is appended.
    __resetMutationStreamBridgeForTests();
    await boot();
    expect(hasRecentlyApplied(batch.mutations[0]!.mutationId)).toBe(false);
    expect(getOracleForCurrentWorkspace()?.materializeOne('rule', rule.uid)).not.toBeNull();
    expect(await logRows(log)).toBe(batch.mutations.length);
    const rows = await logRows(log);
    const pending = await intents.list();
    const recompilesAfterBoot = recompiles.length;
    const broadcasts: string[] = [];
    setOracleHostHooks({ broadcastSyncEvent: (event) => broadcasts.push(event.envelope.mutationId) });
    try {
      const second = dispatchSyncRpc(frame as unknown as Record<string, unknown>);
      if (second?.kind === 'async') await second.promise;
      await flush();
    } finally {
      setOracleHostHooks({});
    }

    expect(broadcasts).toEqual([]);
    expect(await logRows(log)).toBe(rows);
    expect(await intents.list()).toEqual(pending);
    expect(recompiles).toHaveLength(recompilesAfterBoot);
  });
});
