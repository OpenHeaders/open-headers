/**
 * Phase C C4 — `readWorkspaceDeltaStream` against the per-workspace
 * service registry.
 *
 * Validates the host-facing path both extension SW and desktop main
 * use: acquire service → wait for hydration → walk log → filter
 * against peer vector → release. Pure delta-stream math is covered
 * in core/sync tests; this is the integration glue.
 */

import { type MutatorContext, mintBatch, RULE_ENTITY_TYPE, type StateVector } from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { readWorkspaceDeltaStream, readWorkspaceStateVector } from '@openheaders/oracle/sync';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-delta';

const ctx = (ms: number, nodeId = 'n0'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'd0',
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

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

beforeEach(() => {
  __initSyncServiceForTests(wsId);
  installTestIdentitySnapshot();
});

afterEach(() => {
  disposeSyncService();
  clearTestIdentitySnapshot();
});

describe('readWorkspaceDeltaStream', () => {
  it('yields nothing for an empty workspace regardless of peer vector', async () => {
    expect(await collect(readWorkspaceDeltaStream(wsId, {}))).toEqual([]);
    expect(
      await collect(readWorkspaceDeltaStream(wsId, { sw: { physicalMs: 100, logical: 0, nodeId: 'sw' } })),
    ).toEqual([]);
  });

  it("yields the local log's tail past the peer's vector", async () => {
    const r1 = seedRule(makeRule(generateUid()), ctx(1_000, 'sw'));
    const r2 = seedRule(makeRule(generateUid()), ctx(2_000, 'sw'));
    const fromDesktop = mintBatch(ctx(5_000, 'desktop-main'), [
      { kind: 'delete', type: RULE_ENTITY_TYPE, id: 'never-existed' },
    ]);

    await applySyncRequest({ type: 'oh.sync.apply', batch: r1, sideEffects: [] });
    await applySyncRequest({ type: 'oh.sync.apply', batch: r2, sideEffects: [] });
    await applySyncRequest({ type: 'oh.sync.apply', batch: fromDesktop, sideEffects: [] });

    // Peer has seen r1's whole batch only (its envelopes tick the
    // logical component, so "seen" means the batch's LAST hlc) —
    // should receive sw@2_000 + desktop-main@5_000.
    const peer: StateVector = { sw: r1.mutations[r1.mutations.length - 1].hlc };
    const delta = await collect(readWorkspaceDeltaStream(wsId, peer));
    const physMs = delta.map((e) => e.hlc.physicalMs).sort((a, b) => a - b);
    expect(physMs).toEqual([...r2.mutations.map(() => 2_000), 5_000]);
  });

  it('round-trips through state vector → delta → caught up', async () => {
    const r1 = seedRule(makeRule(generateUid()), ctx(1_000, 'sw'));
    await applySyncRequest({ type: 'oh.sync.apply', batch: r1, sideEffects: [] });

    const fullVector = await readWorkspaceStateVector(wsId);
    const delta = await collect(readWorkspaceDeltaStream(wsId, fullVector));
    expect(delta).toEqual([]);
  });
});
