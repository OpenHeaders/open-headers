/**
 * Phase A — `oh.sync.snapshotRules` SW handler.
 *
 * Verifies `snapshotRulePostStates()` returns one `(rule, setItemIds)`
 * entry per Rule the active oracle holds, omits tombstoned rules, and
 * returns an empty list when the service hasn't been initialized.
 */

import { type MutatorContext, RULE_ENTITY_TYPE, mintBatch, toggleEnabled } from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
  getOracleForCurrentWorkspace,
  snapshotRulePostStates,
} from '@openheaders/oracle/sync/service';
import { seedRule } from '@openheaders/oracle/sync-builders/rule-projection';

const wsId = 'ws-snap';
const ctx = (ms: number, surface = 's'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: surface,
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
});

afterEach(() => {
  disposeSyncService();
});

describe('snapshotRulePostStates', () => {
  it('returns one entry per live rule with rule + set itemIds', async () => {
    const oracle = getOracleForCurrentWorkspace()!;
    const r1 = makeRule(generateUid(), 'one');
    const r2 = makeRule(generateUid(), 'two');
    await oracle.apply(seedRule(r1, ctx(1_000)), []);
    await oracle.apply(seedRule(r2, ctx(2_000)), []);

    const entries = snapshotRulePostStates();
    expect(entries.map((e) => e.rule.name).sort()).toEqual(['one', 'two']);
    for (const entry of entries) {
      expect(entry.setItemIds.conditions?.length).toBe(1);
      expect(entry.setItemIds['action.requestHeaders']?.length).toBe(1);
    }
  });

  it('reflects post-toggle state', async () => {
    const oracle = getOracleForCurrentWorkspace()!;
    const r = makeRule(generateUid(), 'before');
    await oracle.apply(seedRule(r, ctx(1_000)), []);
    const intent = toggleEnabled(ctx(2_000), { ruleUid: r.uid, enabled: false });
    await applySyncRequest({
      type: 'oh.sync.apply',
      batch: intent.batch,
      sideEffects: intent.sideEffects,
    });

    const [entry] = snapshotRulePostStates();
    expect(entry.rule.uid).toBe(r.uid);
    expect(entry.rule.enabled).toBe(false);
  });

  it('omits tombstoned rules', async () => {
    const oracle = getOracleForCurrentWorkspace()!;
    const r = makeRule(generateUid());
    await oracle.apply(seedRule(r, ctx(1_000)), []);
    await oracle.apply(
      mintBatch(ctx(2_000), [{ kind: 'delete', type: RULE_ENTITY_TYPE, id: r.uid }]),
      [],
    );
    expect(snapshotRulePostStates()).toEqual([]);
  });

  it('returns empty when service is not initialized', () => {
    disposeSyncService();
    expect(snapshotRulePostStates()).toEqual([]);
  });
});
