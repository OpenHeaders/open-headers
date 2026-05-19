/**
 * Phase C C8 — inbound mutation-stream receiver.
 *
 * Validates the parse → apply → seen-set flow without touching the
 * WS layer (the receiver is a pure function of `applySyncRequest`).
 */

import { type MutatorContext, RULE_ENTITY_TYPE, mintBatch } from '@openheaders/core/sync';
import { SYNC_MUTATION_BATCH_TYPE, SYNC_MUTATION_TYPE } from '@openheaders/core/protocol';
import { generateUid } from '@openheaders/core/utils';
import type { Rule } from '@openheaders/core/types';
import { seedRule } from '@openheaders/core/sync-builders/rule-projection';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
  getOracleForCurrentWorkspace,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  __resetMutationReceiverForTests,
  __seenMutationCountForTests,
  handleIncomingMutationFrame,
  hasRecentlyApplied,
} from '../../src/background/sync-mutation-receiver';
import { installSyntheticIdentityForTests } from './sync/_identity-test-setup';

const wsId = 'ws-recv';

const ctx = (ms: number, nodeId = 'peer'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'peer-device',
});

const makeRule = (uid: string, name: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path: `rules/x/${uid}`,
    type: 'header',
    name,
    enabled: true,
    conditions: [{ uid: 'cnd00001', kind: 'url-pattern', urlPattern: 'https://openheaders.io/*' }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'set', value: '1' }],
      responseHeaders: [],
    },
  }) as unknown as Rule;

let teardownIdentity: () => void = () => undefined;

beforeEach(async () => {
  teardownIdentity = await installSyntheticIdentityForTests([]);
  __initSyncServiceForTests(wsId);
  __resetMutationReceiverForTests();
});

afterEach(() => {
  __resetMutationReceiverForTests();
  disposeSyncService();
  teardownIdentity();
});

describe('handleIncomingMutationFrame', () => {
  it('ignores non-mutation-stream frames', async () => {
    const handled = await handleIncomingMutationFrame({ type: 'pong', t: 123 });
    expect(handled).toBe(false);
  });

  it('applies a single-envelope frame and records it in the seen set', async () => {
    const r = makeRule(generateUid(), 'one');
    const batch = seedRule(r, ctx(1_000));
    const envelope = batch.mutations[0]!;

    const handled = await handleIncomingMutationFrame({
      type: SYNC_MUTATION_TYPE,
      workspaceId: wsId,
      envelope,
    });
    expect(handled).toBe(true);
    expect(hasRecentlyApplied(envelope.mutationId)).toBe(true);
  });

  it('applies a batch frame end-to-end', async () => {
    const r = makeRule(generateUid(), 'two');
    const batch = seedRule(r, ctx(2_000));

    await handleIncomingMutationFrame({ type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch });
    for (const env of batch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(true);

    const oracle = getOracleForCurrentWorkspace();
    expect(oracle?.materializeOne(RULE_ENTITY_TYPE, r.uid)).toBeDefined();
  });

  it('dedups a re-delivered single envelope', async () => {
    const r = makeRule(generateUid(), 'dup');
    const batch = seedRule(r, ctx(3_000));
    const envelope = batch.mutations[0]!;

    await handleIncomingMutationFrame({ type: SYNC_MUTATION_TYPE, workspaceId: wsId, envelope });
    const seenAfterFirst = __seenMutationCountForTests();

    // Same envelope re-delivered — should not grow the seen set or
    // re-apply (idempotent at the oracle layer too, but the receiver
    // short-circuits before the round-trip).
    await handleIncomingMutationFrame({ type: SYNC_MUTATION_TYPE, workspaceId: wsId, envelope });
    expect(__seenMutationCountForTests()).toBe(seenAfterFirst);
  });

  it('short-circuits a batch where every envelope is already known', async () => {
    const r = makeRule(generateUid(), 'short');
    const batch = seedRule(r, ctx(4_000));

    await handleIncomingMutationFrame({ type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch });
    const before = __seenMutationCountForTests();

    await handleIncomingMutationFrame({ type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch });
    expect(__seenMutationCountForTests()).toBe(before);
  });

  it('drops malformed frames without throwing', async () => {
    const handled = await handleIncomingMutationFrame({ type: SYNC_MUTATION_TYPE, workspaceId: 'x' });
    expect(handled).toBe(true); // matched the type, then dropped after parse failure
  });

  it('records mutationIds applied via the local oracle path so the forwarder can skip echo', async () => {
    // A local apply (not via WS) marks the envelope as "already known
    // to this node". The receiver's seen-set sees ONLY frames that
    // came through it; the forwarder's echo-prevention plug-in
    // composes this with its own seen-set via `hasRecentlyApplied`.
    const r = makeRule(generateUid(), 'local');
    const batch = mintBatch(ctx(5_000), [{ kind: 'delete', type: RULE_ENTITY_TYPE, id: r.uid }]);
    await applySyncRequest({ type: 'oh.sync.apply', batch, sideEffects: [] });

    expect(hasRecentlyApplied(batch.mutations[0]!.mutationId)).toBe(false);
  });
});
