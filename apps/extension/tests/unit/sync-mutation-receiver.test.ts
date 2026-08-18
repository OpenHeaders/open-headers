/**
 * Phase C C8 — inbound mutation-stream receiver.
 *
 * Validates the parse → gate → apply → seen-set flow without touching
 * the WS layer: the receiver is a pure function of the frame plus the
 * delivering connection's handle. The per-connection gates
 * (the multi-backend plan §3, invariants 2 + 4) are pinned here: a
 * connection delivers only envelopes stamped with an Org bound to ITS
 * backend record, and local-only envelopes (active-workspace pointer,
 * vault) pass only over a loopback wire.
 */

import { getIdentitySnapshot } from '@openheaders/core/identity';
import { SYNC_MUTATION_BATCH_TYPE, SYNC_MUTATION_TYPE } from '@openheaders/core/protocol';
import {
  type MutatorContext,
  mintBatch,
  RULE_ENTITY_TYPE,
  setActiveExtensionWorkspace,
  VAULT_ENTITY_TYPE,
  VAULT_ID,
} from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { BackendConnection, Org, Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import {
  __resetMutationStreamBridgeForTests,
  __seenMutationStreamCountForTests,
  hasRecentlyApplied,
} from '@openheaders/oracle/sync';
import type { BackendWireHandle } from '@openheaders/oracle/sync/client/backend-connection-manager';
import { handleIncomingMutationFrame } from '@openheaders/oracle/sync/client/mutation-receiver';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
  getOracleForCurrentWorkspace,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSyntheticIdentityForTests, TEST_BACKEND_ID } from './sync/_identity-test-setup';

const wsId = 'ws-recv';

// The receiver's per-connection Org gate accepts only envelopes whose
// Org is bound to the delivering wire's backend record, so the ctx
// stamps envelopes with an Org joined from the test backend.
const BOUND_ORG: Org = { id: 'org-recv-backend', name: 'Backend Org', hostKind: 'desktop', isPrivate: false };

const ctx = (ms: number, nodeId = 'peer'): MutatorContext => ({
  workspaceId: wsId,
  orgId: BOUND_ORG.id,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'peer-device',
});

// The delivering connection. Loopback by default so the local-only
// gates are no-ops for the plain apply/dedup cases.
let wireLoopback = true;

const wire = (overrides: Partial<BackendWireHandle> = {}): BackendWireHandle => ({
  backendId: TEST_BACKEND_ID,
  record: () =>
    ({
      id: TEST_BACKEND_ID,
      label: '',
      url: wireLoopback ? 'ws://127.0.0.1:59210' : 'ws://192.168.1.50:59210',
      authToken: '',
      autoConnect: true,
      enabled: true,
      addedAt: '2026-07-01T00:00:00.000Z',
      lastConnectedAt: null,
    }) as BackendConnection,
  isLoopback: () => wireLoopback,
  isConnected: () => true,
  send: () => true,
  ...overrides,
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
  wireLoopback = true;
  teardownIdentity = await installSyntheticIdentityForTests([], [BOUND_ORG]);
  __initSyncServiceForTests(wsId);
  __resetMutationStreamBridgeForTests();
});

afterEach(() => {
  __resetMutationStreamBridgeForTests();
  disposeSyncService();
  teardownIdentity();
});

describe('handleIncomingMutationFrame', () => {
  it('ignores non-mutation-stream frames', async () => {
    const handled = await handleIncomingMutationFrame({ type: 'pong', t: 123 }, wire());
    expect(handled).toBe(false);
  });

  it('applies a single-envelope frame and records it in the seen set', async () => {
    const r = makeRule(generateUid(), 'one');
    const batch = seedRule(r, ctx(1_000));
    const envelope = batch.mutations[0]!;

    const handled = await handleIncomingMutationFrame(
      {
        type: SYNC_MUTATION_TYPE,
        workspaceId: wsId,
        envelope,
      },
      wire(),
    );
    expect(handled).toBe(true);
    expect(hasRecentlyApplied(envelope.mutationId)).toBe(true);
  });

  it('applies a batch frame end-to-end', async () => {
    const r = makeRule(generateUid(), 'two');
    const batch = seedRule(r, ctx(2_000));

    await handleIncomingMutationFrame({ type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch }, wire());
    for (const env of batch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(true);

    const oracle = getOracleForCurrentWorkspace();
    expect(oracle?.materializeOne(RULE_ENTITY_TYPE, r.uid)).toBeDefined();
  });

  it('dedups a re-delivered single envelope', async () => {
    const r = makeRule(generateUid(), 'dup');
    const batch = seedRule(r, ctx(3_000));
    const envelope = batch.mutations[0]!;

    await handleIncomingMutationFrame({ type: SYNC_MUTATION_TYPE, workspaceId: wsId, envelope }, wire());
    const seenAfterFirst = __seenMutationStreamCountForTests();

    // Same envelope re-delivered — should not grow the seen set or
    // re-apply (idempotent at the oracle layer too, but the receiver
    // short-circuits before the round-trip).
    await handleIncomingMutationFrame({ type: SYNC_MUTATION_TYPE, workspaceId: wsId, envelope }, wire());
    expect(__seenMutationStreamCountForTests()).toBe(seenAfterFirst);
  });

  it('short-circuits a batch where every envelope is already known', async () => {
    const r = makeRule(generateUid(), 'short');
    const batch = seedRule(r, ctx(4_000));

    await handleIncomingMutationFrame({ type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch }, wire());
    const before = __seenMutationStreamCountForTests();

    await handleIncomingMutationFrame({ type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch }, wire());
    expect(__seenMutationStreamCountForTests()).toBe(before);
  });

  it('drops malformed frames without throwing', async () => {
    const handled = await handleIncomingMutationFrame({ type: SYNC_MUTATION_TYPE, workspaceId: 'x' }, wire());
    expect(handled).toBe(true); // matched the type, then dropped after parse failure
  });

  it('drops an envelope stamped with an Org not bound to the delivering connection (invariant 2)', async () => {
    const r = makeRule(generateUid(), 'cross');
    const batch = seedRule(r, ctx(5_500));
    const envelope = batch.mutations[0]!;

    const handled = await handleIncomingMutationFrame(
      { type: SYNC_MUTATION_TYPE, workspaceId: wsId, envelope },
      wire({ backendId: 'backend-other' }),
    );
    expect(handled).toBe(true);
    // Gated before the bridge — a misbehaving backend cannot inject
    // into another backend's Orgs.
    expect(hasRecentlyApplied(envelope.mutationId)).toBe(false);
  });

  it('drops an envelope stamped with the home Org — no connection owns it', async () => {
    const homeOrgId = getIdentitySnapshot()!.user.homeOrgId;
    const r = makeRule(generateUid(), 'home');
    const batch = seedRule(r, { ...ctx(5_600), orgId: homeOrgId });
    const envelope = batch.mutations[0]!;

    const handled = await handleIncomingMutationFrame(
      { type: SYNC_MUTATION_TYPE, workspaceId: wsId, envelope },
      wire(),
    );
    expect(handled).toBe(true);
    expect(hasRecentlyApplied(envelope.mutationId)).toBe(false);
  });

  it('strips cross-Org envelopes from a batch, applying the rest', async () => {
    const homeOrgId = getIdentitySnapshot()!.user.homeOrgId;
    const r = makeRule(generateUid(), 'mixed-org');
    const ruleBatch = seedRule(r, ctx(5_700));
    const homeBatch = mintBatch({ ...ctx(5_800), orgId: homeOrgId }, [
      { kind: 'delete', type: RULE_ENTITY_TYPE, id: 'r-injected' },
    ]);
    const injected = homeBatch.mutations[0]!;

    await handleIncomingMutationFrame(
      {
        type: SYNC_MUTATION_BATCH_TYPE,
        workspaceId: wsId,
        batch: { batchId: 'mixed-org-1', mutations: [...ruleBatch.mutations, injected] },
      },
      wire(),
    );

    for (const env of ruleBatch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(true);
    expect(hasRecentlyApplied(injected.mutationId)).toBe(false);
  });

  it('drops an inbound active-workspace pointer envelope from a non-loopback backend', async () => {
    wireLoopback = false;
    const { batch } = setActiveExtensionWorkspace(ctx(6_000), { id: 'ws-from-lan-peer' });
    const pointer = batch.mutations[0]!;

    const handled = await handleIncomingMutationFrame(
      {
        type: SYNC_MUTATION_TYPE,
        workspaceId: wsId,
        envelope: pointer,
      },
      wire(),
    );
    expect(handled).toBe(true);
    // Gated before the bridge — never applied, never recorded as seen.
    expect(hasRecentlyApplied(pointer.mutationId)).toBe(false);
  });

  it('strips only the pointer from a non-loopback batch, applying the rest', async () => {
    wireLoopback = false;
    const r = makeRule(generateUid(), 'mixed');
    const ruleBatch = seedRule(r, ctx(7_000));
    const { batch: pointerBatch } = setActiveExtensionWorkspace(ctx(7_100), { id: 'ws-from-lan-peer' });
    const pointer = pointerBatch.mutations[0]!;

    await handleIncomingMutationFrame(
      {
        type: SYNC_MUTATION_BATCH_TYPE,
        workspaceId: wsId,
        batch: { batchId: 'mixed-1', mutations: [...ruleBatch.mutations, pointer] },
      },
      wire(),
    );

    for (const env of ruleBatch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(true);
    expect(hasRecentlyApplied(pointer.mutationId)).toBe(false);
  });

  it('drops an inbound same-device-only (vault) mutation from a non-loopback backend', async () => {
    wireLoopback = false;
    const batch = mintBatch(ctx(8_000), [{ kind: 'delete', type: VAULT_ENTITY_TYPE, id: VAULT_ID }]);
    const vault = batch.mutations[0]!;

    const handled = await handleIncomingMutationFrame(
      {
        type: SYNC_MUTATION_TYPE,
        workspaceId: wsId,
        envelope: vault,
      },
      wire(),
    );
    expect(handled).toBe(true);
    // The backend strips the vault host-side; this receive-side mirror gates
    // it before the bridge so a buggy/hostile LAN backend can't push a seed.
    expect(hasRecentlyApplied(vault.mutationId)).toBe(false);
  });

  it('strips the vault from a non-loopback batch, applying the rest', async () => {
    wireLoopback = false;
    const r = makeRule(generateUid(), 'mixed-vault');
    const ruleBatch = seedRule(r, ctx(8_100));
    const vaultBatch = mintBatch(ctx(8_200), [{ kind: 'delete', type: VAULT_ENTITY_TYPE, id: VAULT_ID }]);
    const vault = vaultBatch.mutations[0]!;

    await handleIncomingMutationFrame(
      {
        type: SYNC_MUTATION_BATCH_TYPE,
        workspaceId: wsId,
        batch: { batchId: 'mixed-vault-1', mutations: [...ruleBatch.mutations, vault] },
      },
      wire(),
    );

    for (const env of ruleBatch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(true);
    expect(hasRecentlyApplied(vault.mutationId)).toBe(false);
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
