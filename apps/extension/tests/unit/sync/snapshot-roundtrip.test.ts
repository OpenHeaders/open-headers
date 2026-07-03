/**
 * Phase C C5 — build → apply round-trip.
 *
 * Verifies the producer + consumer halves of the cold-start path:
 * 1. Seed source workspace with rules.
 * 2. Capture snapshot from source.
 * 3. Wipe + re-init the workspace.
 * 4. Apply the snapshot.
 * 5. Re-capture and verify the rule shape matches.
 */

import { type MutatorContext } from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import {
  applyWorkspaceSnapshot,
  buildSnapshotForWorkspace,
} from '@openheaders/oracle/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-roundtrip';
let clock = 0;

const ctx = (nodeId = 'receiver'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ++clock + 10_000, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'd0',
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

beforeEach(() => {
  clock = 0;
  __initSyncServiceForTests(wsId);
  installTestIdentitySnapshot();
});

afterEach(() => {
  disposeSyncService();
  clearTestIdentitySnapshot();
});

describe('snapshot build → apply round-trip', () => {
  it('rehydrates a workspace from a snapshot blob', async () => {
    const r1 = makeRule(generateUid(), 'rule-one');
    const r2 = makeRule(generateUid(), 'rule-two');
    await applySyncRequest({ type: 'oh.sync.apply', batch: seedRule(r1, ctx('source')), sideEffects: [] });
    await applySyncRequest({ type: 'oh.sync.apply', batch: seedRule(r2, ctx('source')), sideEffects: [] });

    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');
    expect(snap.rules.length).toBe(2);

    // Tear down + re-init: simulate a fresh receiver workspace.
    disposeSyncService();
    __initSyncServiceForTests(wsId);

    const result = await applyWorkspaceSnapshot(snap, { makeContext: () => ctx() });
    expect(result.entitiesApplied).toBe(2);
    expect(result.byType).toEqual({ rules: 2 });

    const reSnap = await buildSnapshotForWorkspace(wsId);
    if (reSnap === null) throw new Error('expected snapshot for authorized workspace');
    expect(reSnap.rules.map((r) => r.rule.name).sort()).toEqual(['rule-one', 'rule-two']);
    // Rule uids preserved end-to-end (the seed mutators key on the persisted uid).
    expect(reSnap.rules.map((r) => r.rule.uid).sort()).toEqual([r1.uid, r2.uid].sort());
  });

  it('rejects a snapshot with an unknown schemaVersion', async () => {
    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');
    await expect(
      applyWorkspaceSnapshot({ ...snap, schemaVersion: 99 }, { makeContext: () => ctx() }),
    ).rejects.toThrow(/schemaVersion/);
  });

  it('applies cleanly to an empty workspace with an empty snapshot', async () => {
    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');
    const result = await applyWorkspaceSnapshot(snap, { makeContext: () => ctx() });
    expect(result.entitiesApplied).toBe(0);
    expect(result.byType).toEqual({});
  });
});
