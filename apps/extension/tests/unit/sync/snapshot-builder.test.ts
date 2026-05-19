/**
 * Phase C C5 — `buildSnapshotForWorkspace` against the per-workspace
 * service registry.
 *
 * Walks the producer-side path: seed rules into the oracle, capture a
 * snapshot, verify the blob matches the materialized state + carries
 * the workspace's current state vector. Pure shape + redaction tests
 * are in core/tests/protocol/snapshot.test.ts; this exercises the
 * compose-from-caches glue both extension SW and desktop main use.
 */

import {
  SENSITIVE_SNAPSHOT_KEYS,
  SNAPSHOT_SCHEMA_VERSION,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import { type MutatorContext } from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import { buildSnapshotForWorkspace } from '@openheaders/oracle/sync';
import { seedRule } from '@openheaders/core/sync-builders/rule-projection';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-snap';

const ctx = (ms: number, nodeId = 'sw'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId },
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
  __initSyncServiceForTests(wsId);
  installTestIdentitySnapshot();
});

afterEach(() => {
  disposeSyncService();
  clearTestIdentitySnapshot();
});

describe('buildSnapshotForWorkspace', () => {
  it('emits a well-formed empty snapshot for a fresh workspace', async () => {
    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');

    expect(snap.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(snap.workspaceId).toBe(wsId);
    expect(snap.takenAtHlc).toEqual({});

    for (const key of Object.keys(snap) as Array<keyof WorkspaceSnapshot>) {
      if (key === 'schemaVersion' || key === 'workspaceId' || key === 'takenAtHlc') continue;
      expect(Array.isArray(snap[key])).toBe(true);
      expect((snap[key] as unknown[]).length).toBe(0);
    }
  });

  it('captures materialized rules + carries the workspace state vector', async () => {
    const r1 = seedRule(makeRule(generateUid(), 'one'), ctx(1_000));
    const r2 = seedRule(makeRule(generateUid(), 'two'), ctx(2_500));
    await applySyncRequest({ type: 'oh.sync.apply', batch: r1, sideEffects: [] });
    await applySyncRequest({ type: 'oh.sync.apply', batch: r2, sideEffects: [] });

    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');

    expect(snap.rules.map((r) => r.rule.name).sort()).toEqual(['one', 'two']);
    expect(snap.takenAtHlc.sw?.physicalMs).toBe(2_500);

    // Non-rule arrays are all empty for this minimal seed.
    expect(snap.environments).toEqual([]);
    expect(snap.collections).toEqual([]);
  });

  it('all sensitive arrays present (transport-layer strips, not producer)', async () => {
    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');
    for (const key of SENSITIVE_SNAPSHOT_KEYS) {
      expect(snap[key]).toBeDefined();
    }
  });
});
