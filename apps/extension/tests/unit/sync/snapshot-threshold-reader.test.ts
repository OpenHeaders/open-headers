/**
 * Phase C C6 — `computeSnapshotThresholdInputsForWorkspace` integration.
 *
 * Pure decision-function math is covered in core; this verifies the
 * oracle-side reader correctly walks the log and counts envelopes
 * the peer is missing.
 */

import { type MutatorContext, type StateVector } from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import {
  computeSnapshotThresholdInputsForWorkspace,
  readWorkspaceStateVector,
} from '@openheaders/oracle/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-thresh';

const ctx = (ms: number, nodeId = 'sw'): MutatorContext => ({
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
    conditions: [{ uid: 'cnd00001', type: 'url-filter', values: ['https://openheaders.io/*'] }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'override', value: '1' }],
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

describe('computeSnapshotThresholdInputsForWorkspace', () => {
  it('returns zero deltas for an empty workspace', async () => {
    const inputs = await computeSnapshotThresholdInputsForWorkspace(wsId, {});
    expect(inputs.estimatedDeltaCount).toBe(0);
    expect(inputs.peerVector).toEqual({});
  });

  it('counts the envelopes a cold peer would receive', async () => {
    await applySyncRequest({
      type: 'oh.sync.apply',
      batch: seedRule(makeRule(generateUid()), ctx(1_000)),
      sideEffects: [],
    });
    await applySyncRequest({
      type: 'oh.sync.apply',
      batch: seedRule(makeRule(generateUid()), ctx(2_000)),
      sideEffects: [],
    });

    // Each rule's seedRule produces a `create` + N `addToSet` (per the rule's
    // set-modeled paths). Exact count is implementation-dependent, but it
    // must be at least the two creates (one per rule).
    const inputs = await computeSnapshotThresholdInputsForWorkspace(wsId, {});
    expect(inputs.estimatedDeltaCount).toBeGreaterThanOrEqual(2);
  });

  it('returns zero deltas when the peer is fully caught up', async () => {
    await applySyncRequest({
      type: 'oh.sync.apply',
      batch: seedRule(makeRule(generateUid()), ctx(1_000)),
      sideEffects: [],
    });
    const local: StateVector = await readWorkspaceStateVector(wsId);
    const inputs = await computeSnapshotThresholdInputsForWorkspace(wsId, local);
    expect(inputs.estimatedDeltaCount).toBe(0);
  });

  it('optionally returns a byte estimate', async () => {
    await applySyncRequest({
      type: 'oh.sync.apply',
      batch: seedRule(makeRule(generateUid()), ctx(1_000)),
      sideEffects: [],
    });

    const without = await computeSnapshotThresholdInputsForWorkspace(wsId, {});
    expect(without.estimatedDeltaBytes).toBeUndefined();

    const withBytes = await computeSnapshotThresholdInputsForWorkspace(wsId, {}, { withByteEstimate: true });
    expect(withBytes.estimatedDeltaBytes).toBeGreaterThan(0);
  });
});
