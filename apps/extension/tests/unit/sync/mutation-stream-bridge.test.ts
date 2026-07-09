/**
 * Phase C C9 — host-neutral inbound mutation-stream bridge.
 *
 * Exercises the shared `applyInboundMutationEnvelope` /
 * `applyInboundMutationBatch` + seen-set used by every host (extension
 * SW, desktop main, daemon). Same shape as the extension's receiver
 * test but invoked at the oracle-package layer.
 */

import {
  type IdentitySnapshot,
  type ResolvedAuditEntry,
  resetAuditSink,
  setAuditSink,
} from '@openheaders/core/identity';
import {
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  LAYOUT_STATE_ENTITY_TYPE,
  LAYOUT_STATE_ID,
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import {
  __resetMutationStreamBridgeForTests,
  __seenMutationStreamCountForTests,
  applyInboundMutationBatch,
  applyInboundMutationEnvelope,
  hasRecentlyApplied,
  setOracleHostHooks,
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

const PEER_USER_ID = '01900000-0000-7000-8000-0000000000fe';
const PEER_PRINCIPAL_ID = '01900000-0000-7000-8000-0000000000fd';

/**
 * Directory-user snapshot the daemon's per-frame resolution would hand
 * the bridge: the peer principal's grants only, no localAdmin, the
 * daemon's own Org as the sole org.
 */
function makePeerSnapshot(role: 'owner' | 'editor' | 'viewer' | null): IdentitySnapshot {
  const wraByWorkspaceId = new Map(
    role === null
      ? []
      : [
          [
            wsId,
            { id: '01900000-0000-7000-8000-0000000000fc', principalId: PEER_PRINCIPAL_ID, workspaceId: wsId, role },
          ],
        ],
  );
  return {
    user: { id: PEER_USER_ID, displayName: 'Peer', homeOrgId: TEST_ORG_ID, isStandalone: false },
    principal: { id: PEER_PRINCIPAL_ID, userId: PEER_USER_ID, orgId: TEST_ORG_ID },
    membership: {
      id: '01900000-0000-7000-8000-0000000000fb',
      userId: PEER_USER_ID,
      orgId: TEST_ORG_ID,
      primaryRole: 'member',
      functionalRoles: [],
    },
    wraByWorkspaceId,
    orgs: new Map([[TEST_ORG_ID, { id: TEST_ORG_ID, name: 'Test Org', hostKind: 'daemon', isPrivate: false }]]),
  };
}

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

  it('marks the batch as an echo DURING the apply broadcast (catch-up stream is not re-forwarded)', async () => {
    // The oracle publishes each broadcast synchronously inside the
    // apply — the exact moment every host's outbound forwarder consults
    // hasRecentlyApplied. The in-flight bracket must make the inbound
    // batch read as an echo right there, or the catch-up stream bounces
    // back to the backend once per envelope.
    const echoAtBroadcast: boolean[] = [];
    const originsAtBroadcast: Array<string | undefined> = [];
    setOracleHostHooks({
      broadcastSyncEvent: (event) => {
        echoAtBroadcast.push(hasRecentlyApplied(event.envelope.mutationId));
        originsAtBroadcast.push(event.applyOrigin);
      },
    });
    try {
      const r = makeRule(generateUid());
      const batch = seedRule(r, ctx(6_000));
      await applyInboundMutationBatch(batch);

      expect(echoAtBroadcast).toHaveLength(batch.mutations.length);
      expect(echoAtBroadcast.every(Boolean)).toBe(true);
      // Forwarders route by provenance: every event of a peer-sourced
      // apply must carry the inbound origin.
      expect(originsAtBroadcast.every((origin) => origin === 'inbound')).toBe(true);
      // Post-apply the ids live in the seen set proper.
      for (const env of batch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(true);
    } finally {
      setOracleHostHooks({});
    }
  });

  it('leaves no echo marker behind when the apply throws (redelivery can retry)', async () => {
    // A mixed-workspace batch makes applySyncRequest throw after the
    // in-flight bracket opened — the finally must clear it so a later
    // redelivery of the same ids is not misread as an echo.
    const r = makeRule(generateUid());
    const batch = seedRule(r, ctx(7_000));
    const mixed = {
      batchId: batch.batchId,
      mutations: batch.mutations.map((env, i) => (i === 0 ? env : { ...env, workspaceId: 'ws-other' })),
    };

    await expect(applyInboundMutationBatch(mixed)).rejects.toThrow();
    for (const env of mixed.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(false);
    expect(__seenMutationStreamCountForTests()).toBe(0);
  });

  it('drops a host-local (layout) envelope at ingest — a peer cannot overwrite this host layout', async () => {
    // Mirror of the outbound gate's host-local floor: even if a peer
    // (old build, hostile) puts a layout-state envelope on the wire,
    // ingest refuses it before apply.
    const layoutEnvelope = {
      ...seedRule(makeRule(generateUid()), ctx(8_000)).mutations[0]!,
      mutationId: 'm-layout-inbound',
      body: {
        kind: 'setField' as const,
        type: LAYOUT_STATE_ENTITY_TYPE,
        id: LAYOUT_STATE_ID,
        path: 'layout',
        value: { panes: [] },
      },
    };

    await applyInboundMutationEnvelope(layoutEnvelope);
    expect(hasRecentlyApplied(layoutEnvelope.mutationId)).toBe(false);
    const oracle = getOracleForCurrentWorkspace();
    expect(oracle?.materializeOne(LAYOUT_STATE_ENTITY_TYPE, LAYOUT_STATE_ID)).toBeFalsy();
  });

  it('applies as the PEER actor when one is threaded — an editor grant admits the batch', async () => {
    const audits: ResolvedAuditEntry[] = [];
    setAuditSink((entry) => audits.push(entry));
    try {
      const r = makeRule(generateUid());
      const batch = seedRule(r, ctx(9_000));
      await applyInboundMutationBatch(batch, { snapshot: makePeerSnapshot('editor'), userId: PEER_USER_ID });

      const writeGate = audits.find((a) => a.capability === 'workspace.write' && a.workspaceId === wsId);
      expect(writeGate?.decision.allow).toBe(true);
      expect(writeGate?.actorUserId).toBe(PEER_USER_ID);
      for (const env of batch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(true);
    } finally {
      resetAuditSink();
    }
  });

  it('silently drops + audits a viewer actor batch — the daemon LocalAdmin never substitutes', async () => {
    const audits: ResolvedAuditEntry[] = [];
    setAuditSink((entry) => audits.push(entry));
    try {
      const r = makeRule(generateUid());
      const batch = seedRule(r, ctx(10_000));
      await applyInboundMutationBatch(batch, { snapshot: makePeerSnapshot('viewer'), userId: PEER_USER_ID });

      const writeGate = audits.find((a) => a.capability === 'workspace.write' && a.workspaceId === wsId);
      expect(writeGate?.decision).toEqual({ allow: false, reason: 'insufficient-workspace-role' });
      expect(writeGate?.actorUserId).toBe(PEER_USER_ID);
      for (const env of batch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(false);
      const oracle = getOracleForCurrentWorkspace();
      expect(oracle?.materializeOne(RULE_ENTITY_TYPE, r.uid)).toBeFalsy();
    } finally {
      resetAuditSink();
    }
  });

  it('a null actor snapshot denies fail-closed (deactivated/wiped mid-connection)', async () => {
    const audits: ResolvedAuditEntry[] = [];
    setAuditSink((entry) => audits.push(entry));
    try {
      const r = makeRule(generateUid());
      const batch = seedRule(r, ctx(11_000));
      await applyInboundMutationBatch(batch, { snapshot: null, userId: PEER_USER_ID });

      const writeGate = audits.find((a) => a.capability === 'workspace.write');
      expect(writeGate?.decision).toEqual({ allow: false, reason: 'no-current-user' });
      for (const env of batch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(false);
    } finally {
      resetAuditSink();
    }
  });

  describe('global-scope subject gate (peer actor)', () => {
    const globalEnvelope = (ms: number, body: MutationEnvelope['body']): MutationEnvelope => ({
      mutationId: `m-global-${ms}`,
      hlc: { physicalMs: ms, logical: 0, nodeId: 'peer' },
      origin: { surfaceId: 's', deviceId: 'peer-device' },
      workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      orgId: TEST_ORG_ID,
      mutatorVersion: 1,
      body,
    });

    const slotReplace = (ms: number): MutationEnvelope =>
      globalEnvelope(ms, {
        kind: 'addToSet',
        type: EXTENSION_WORKSPACE_ENTITY_TYPE,
        id: EXTENSION_WORKSPACE_ID,
        path: EXTENSION_WORKSPACES_SET_PATH,
        itemId: wsId,
        item: { id: wsId, name: 'renamed' },
      });

    const activeFlip = (ms: number): MutationEnvelope =>
      globalEnvelope(ms, {
        kind: 'setField',
        type: EXTENSION_WORKSPACE_ENTITY_TYPE,
        id: EXTENSION_WORKSPACE_ID,
        path: 'activeId',
        value: wsId,
      });

    it('an editor of the slotted workspace may replace its slot (rename rides the grant)', async () => {
      const audits: ResolvedAuditEntry[] = [];
      setAuditSink((entry) => audits.push(entry));
      try {
        const batch = { batchId: 'b-global-1', mutations: [slotReplace(12_000)] };
        await applyInboundMutationBatch(batch, {
          snapshot: makePeerSnapshot('editor'),
          userId: PEER_USER_ID,
        }).catch(() => undefined); // no __global__ oracle in this rig; the gate decision is the pin
        const gate = audits.find((a) => a.capability === 'workspace.write' && a.workspaceId === wsId);
        expect(gate?.decision.allow).toBe(true);
        expect(gate?.actorUserId).toBe(PEER_USER_ID);
      } finally {
        resetAuditSink();
      }
    });

    it('a viewer cannot replace the slot', async () => {
      const audits: ResolvedAuditEntry[] = [];
      setAuditSink((entry) => audits.push(entry));
      try {
        const batch = { batchId: 'b-global-2', mutations: [slotReplace(13_000)] };
        await applyInboundMutationBatch(batch, { snapshot: makePeerSnapshot('viewer'), userId: PEER_USER_ID });
        const gate = audits.find((a) => a.capability === 'workspace.write' && a.workspaceId === wsId);
        expect(gate?.decision).toEqual({ allow: false, reason: 'insufficient-workspace-role' });
        expect(hasRecentlyApplied(batch.mutations[0]!.mutationId)).toBe(false);
      } finally {
        resetAuditSink();
      }
    });

    it('subject-less global bodies (activeId flip) stay operator-only', async () => {
      const audits: ResolvedAuditEntry[] = [];
      setAuditSink((entry) => audits.push(entry));
      try {
        const batch = { batchId: 'b-global-3', mutations: [activeFlip(14_000)] };
        await applyInboundMutationBatch(batch, { snapshot: makePeerSnapshot('editor'), userId: PEER_USER_ID });
        const gate = audits.find((a) => a.capability === 'daemon.admin');
        expect(gate?.decision).toEqual({ allow: false, reason: 'not-daemon-admin' });
        expect(hasRecentlyApplied(batch.mutations[0]!.mutationId)).toBe(false);
      } finally {
        resetAuditSink();
      }
    });

    it('one denied body refuses the whole batch (all-or-nothing)', async () => {
      const audits: ResolvedAuditEntry[] = [];
      setAuditSink((entry) => audits.push(entry));
      try {
        const batch = { batchId: 'b-global-4', mutations: [slotReplace(15_000), activeFlip(16_000)] };
        await applyInboundMutationBatch(batch, { snapshot: makePeerSnapshot('editor'), userId: PEER_USER_ID });
        for (const env of batch.mutations) expect(hasRecentlyApplied(env.mutationId)).toBe(false);
      } finally {
        resetAuditSink();
      }
    });
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
