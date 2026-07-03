/**
 * Phase C C9 — host-neutral inbound mutation-stream bridge.
 *
 * Exercises the shared `applyInboundMutationEnvelope` /
 * `applyInboundMutationBatch` + seen-set used by every host (extension
 * SW, desktop main, daemon). Same shape as the extension's receiver
 * test but invoked at the oracle-package layer.
 */

import { type ResolvedAuditEntry, resetAuditSink, setAuditSink } from '@openheaders/core/identity';
import { type MutatorContext, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import {
  __resetMutationStreamBridgeForTests,
  __seenMutationStreamCountForTests,
  applyInboundMutationBatch,
  applyInboundMutationEnvelope,
  hasRecentlyApplied,
} from '@openheaders/oracle/sync';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  getOracleForCurrentWorkspace,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-bridge';
// The inbound bridge's receiver-side org filter (UNIFIED_ORACLE_MODEL.md
// §6.1 / §6.3) drops envelopes whose `orgId` is outside the host's
// authorized Org set. Pin the test snapshot's home-org to the same
// `orgId` the ctx factory stamps so the in-trust-zone envelopes apply.
const TEST_ORG_ID = 'org-test';

const ctx = (ms: number, nodeId = 'peer'): MutatorContext => ({
  workspaceId: wsId,
  orgId: TEST_ORG_ID,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'peer-device',
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
  installTestIdentitySnapshot(TEST_ORG_ID);
  __initSyncServiceForTests(wsId);
  __resetMutationStreamBridgeForTests();
});

afterEach(() => {
  __resetMutationStreamBridgeForTests();
  disposeSyncService();
  clearTestIdentitySnapshot();
});

describe('applyInboundMutationEnvelope', () => {
  it('applies a peer envelope and records it in the seen set', async () => {
    const r = makeRule(generateUid());
    const envelope = seedRule(r, ctx(1_000)).mutations[0]!;

    await applyInboundMutationEnvelope(envelope);
    expect(hasRecentlyApplied(envelope.mutationId)).toBe(true);
  });

  it('short-circuits a re-delivered envelope (idempotent)', async () => {
    const r = makeRule(generateUid());
    const envelope = seedRule(r, ctx(2_000)).mutations[0]!;

    await applyInboundMutationEnvelope(envelope);
    const after = __seenMutationStreamCountForTests();
    await applyInboundMutationEnvelope(envelope);
    expect(__seenMutationStreamCountForTests()).toBe(after);
  });
});

describe('applyInboundMutationBatch', () => {
  it('applies every envelope and materializes the rule end-to-end', async () => {
    const r = makeRule(generateUid());
    const batch = seedRule(r, ctx(3_000));

    await applyInboundMutationBatch(batch);
    for (const env of batch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(true);

    const oracle = getOracleForCurrentWorkspace();
    expect(oracle?.materializeOne(RULE_ENTITY_TYPE, r.uid)).toBeDefined();
  });

  it('short-circuits when every envelope is already known', async () => {
    const r = makeRule(generateUid());
    const batch = seedRule(r, ctx(4_000));

    await applyInboundMutationBatch(batch);
    const before = __seenMutationStreamCountForTests();
    await applyInboundMutationBatch(batch);
    expect(__seenMutationStreamCountForTests()).toBe(before);
  });

  it('runs the receiver-side workspace.write gate and audits the decision', async () => {
    // Symmetric with the extension SW receiver: every inbound batch is
    // gated on workspace.write for its workspace before apply. Synthetic
    // LocalAdmin allows; the audit entry is the wiring proof.
    const audits: ResolvedAuditEntry[] = [];
    setAuditSink((entry) => audits.push(entry));
    try {
      const r = makeRule(generateUid());
      const batch = seedRule(r, ctx(5_000));
      await applyInboundMutationBatch(batch);

      const writeGate = audits.find((a) => a.capability === 'workspace.write' && a.workspaceId === wsId);
      expect(writeGate).toBeDefined();
      expect(writeGate?.decision.allow).toBe(true);
      for (const env of batch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(true);
    } finally {
      resetAuditSink();
    }
  });
});
