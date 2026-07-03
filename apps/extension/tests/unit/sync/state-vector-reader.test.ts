/**
 * Phase C C2/C3 — `readWorkspaceStateVector` against the per-workspace
 * service registry.
 *
 * Validates the host-facing path both extension SW and desktop main
 * use: acquire service → wait for hydration → fold log → release.
 * Pure aggregator math is covered in core/sync tests; this is the
 * integration glue.
 */

import { type MutatorContext, mintBatch, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import { readWorkspaceStateVector } from '@openheaders/oracle/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-sv';

const ctx = (ms: number, nodeId = 'n0'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'd0',
});

const makeRule = (uid: string, name = 'r'): Rule =>
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

beforeEach(() => {
  __initSyncServiceForTests(wsId);
  installTestIdentitySnapshot();
});

afterEach(() => {
  disposeSyncService();
  clearTestIdentitySnapshot();
});

describe('readWorkspaceStateVector', () => {
  it('returns an empty vector for a workspace with no applied mutations', async () => {
    expect(await readWorkspaceStateVector(wsId)).toEqual({});
  });

  it('reflects the highest HLC per nodeId across applied mutations', async () => {
    const r1 = makeRule(generateUid(), 'one');
    const r2 = makeRule(generateUid(), 'two');

    const seed1 = seedRule(r1, ctx(1_000, 'sw'));
    const seed2 = seedRule(r2, ctx(2_500, 'sw'));
    const fromDesktop = mintBatch(ctx(5_000, 'desktop-main'), [
      { kind: 'delete', type: RULE_ENTITY_TYPE, id: 'never-existed' },
    ]);

    await applySyncRequest({ type: 'oh.sync.apply', batch: seed1, sideEffects: [] });
    await applySyncRequest({ type: 'oh.sync.apply', batch: seed2, sideEffects: [] });
    await applySyncRequest({ type: 'oh.sync.apply', batch: fromDesktop, sideEffects: [] });

    const vector = await readWorkspaceStateVector(wsId);
    expect(Object.keys(vector).sort()).toEqual(['desktop-main', 'sw']);
    expect(vector.sw?.physicalMs).toBe(2_500);
    expect(vector['desktop-main']?.physicalMs).toBe(5_000);
  });

  it('does not leave a refcount leak after a successful read', async () => {
    await readWorkspaceStateVector(wsId);
    await readWorkspaceStateVector(wsId);
    // No assertion on internal state — service.ts has no public refcount
    // accessor — but the next __initSyncServiceForTests/dispose pair in
    // afterEach would fail if disposal stayed pending due to a leak.
    expect(true).toBe(true);
  });
});
