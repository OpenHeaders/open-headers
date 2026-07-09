/**
 * Phase C C12 — HLC monotonicity on inbound apply.
 *
 * After applying a remote envelope at HLC X, the local sequencer
 * must mint NEXT > X — even when the local wall clock would have
 * minted lower (machine sleep, NTP step). The bridge folds the
 * highest observed inbound HLC into the SwContextHandle's
 * `observe()` after a successful apply.
 */

import { compareHlc, type MutatorContext } from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import {
  __resetMutationStreamBridgeForTests,
  applyInboundMutationBatch,
  applyInboundMutationEnvelope,
} from '@openheaders/oracle/sync';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const wsId = 'ws-monotonic';

const ctx = (ms: number, nodeId = 'peer'): MutatorContext => ({
  workspaceId: wsId,
  orgId: 'org-test',
  hlc: { physicalMs: ms, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'peer-d',
});

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
  __initSyncServiceForTests(wsId);
  __resetMutationStreamBridgeForTests();
});

afterEach(() => {
  __resetMutationStreamBridgeForTests();
  disposeSyncService();
});

function peekServiceHlc() {
  const svc = getOrCreateWorkspaceService(wsId);
  try {
    return svc.context.peekHlc();
  } finally {
    releaseWorkspaceService(wsId);
  }
}

describe('C12: HLC monotonicity on inbound apply', () => {
  it('advances the local sequencer past an inbound envelope HLC', async () => {
    const remote = seedRule(makeRule(generateUid()), ctx(10_000_000_000, 'peer')).mutations[0]!;
    await applyInboundMutationEnvelope(remote);

    const localAfter = peekServiceHlc();
    // Local HLC must be > remote (lex order tie-break by nodeId
    // when physicalMs matches — but the recurrence adds at least
    // one logical tick so strictly greater holds).
    expect(compareHlc(localAfter, remote.hlc)).toBeGreaterThan(0);
  });

  it('folds the highest HLC out of a multi-node batch', async () => {
    const a = seedRule(makeRule(generateUid()), ctx(1_000_000, 'peer-a')).mutations[0]!;
    const b = seedRule(makeRule(generateUid()), ctx(2_000_000, 'peer-b')).mutations[0]!;
    const c = seedRule(makeRule(generateUid()), ctx(500_000, 'peer-c')).mutations[0]!;
    const merged = { batchId: 'multi', mutations: [a, b, c] };

    await applyInboundMutationBatch(merged);

    const localAfter = peekServiceHlc();
    // Must exceed the highest of the three (b at 2_000_000).
    expect(compareHlc(localAfter, b.hlc)).toBeGreaterThan(0);
  });

  it('advances the sequencer past a locally-minted multi-envelope batch', async () => {
    // `mintBatch` ticks each envelope's logical component past the
    // context's base HLC; without the post-apply observe, the NEXT
    // same-millisecond mint could collide with a ticked envelope.
    const svc = getOrCreateWorkspaceService(wsId);
    try {
      const batch = seedRule(makeRule(generateUid()), svc.context.next());
      const last = batch.mutations[batch.mutations.length - 1]!;
      expect(compareHlc(last.hlc, batch.mutations[0]!.hlc)).toBeGreaterThan(0);

      await applySyncRequest({ type: 'oh.sync.apply', batch, sideEffects: [], applyOrigin: 'local' });

      expect(compareHlc(svc.context.next().hlc, last.hlc)).toBeGreaterThan(0);
    } finally {
      releaseWorkspaceService(wsId);
    }
  });

  it('does not regress the sequencer on a lower inbound HLC', async () => {
    const high = seedRule(makeRule(generateUid()), ctx(9_999_999_999, 'peer-fast')).mutations[0]!;
    await applyInboundMutationEnvelope(high);
    const after1 = peekServiceHlc();

    const low = seedRule(makeRule(generateUid()), ctx(100, 'peer-slow')).mutations[0]!;
    await applyInboundMutationEnvelope(low);
    const after2 = peekServiceHlc();

    // Second apply must not have rewound below the first.
    expect(compareHlc(after2, after1)).toBeGreaterThanOrEqual(0);
  });
});
