/**
 * Phase U2 slice 1 — renderer→SW dispatch gate coverage.
 *
 * Pins:
 *   - `oh.sync.apply` is gated through the host-neutral resolver: synthetic
 *     boot → LocalAdmin → ALLOW → dispatcher reaches its existing handler.
 *   - No installed snapshot → `PermissionDeniedError` thrown synchronously
 *     so the outer message-handler can surface a uniform error frame.
 *   - Non-gated message types (e.g. `oh.sync.listActivityMutes`) pass
 *     through the gate without consulting the resolver.
 *   - The audit-emit hook fires once per gate evaluation (allow or deny).
 */

import {
  clearIdentitySnapshot,
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
  type ResolvedAuditEntry,
  refreshIdentitySnapshotFromHostStorage,
  resetAuditSink,
  setAuditSink,
} from '@openheaders/core/identity';
import { type HostStorage, hostStorage, setHostStorage } from '@openheaders/core/storage';
import type { MutationBatch } from '@openheaders/core/sync';
import { dispatchSyncRpc, PermissionDeniedError } from '@openheaders/oracle/rpc';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const WS = '0193a8ff-c000-7000-8000-000000000001';
const NOW = '2026-05-19T00:00:00.000Z';

function createHostStorageFake(): HostStorage {
  const map = new Map<string, unknown>();
  const fake: HostStorage = {
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) out[k] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) map.set(spec.key, value);
    },
    remove: async (specs) => {
      const list = Array.isArray(specs) ? specs : [specs];
      for (const spec of list) map.delete(spec.key);
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: () => () => undefined,
  };
  return fake;
}

function makeApplyBatch(workspaceId: string): MutationBatch {
  return {
    batchId: '01900000-cccc-7000-8000-000000000001',
    mutations: [
      {
        mutationId: '01900000-dddd-7000-8000-000000000001',
        hlc: { physicalMs: 0, logical: 0, nodeId: 'dev' },
        origin: { surfaceId: 'test', deviceId: 'dev' },
        workspaceId,
        orgId: 'org-test',
        mutatorVersion: 1,
        body: {
          kind: 'create',
          type: 'workspaceVariables',
          id: '01900000-eeee-7000-8000-000000000001',
          payload: {},
        },
      },
    ],
  };
}

describe('sync-rpc permission gate', () => {
  let audits: ResolvedAuditEntry[];

  beforeEach(() => {
    clearIdentitySnapshot();
    setHostStorage(createHostStorageFake());
    audits = [];
    setAuditSink((entry) => audits.push(entry));
  });

  afterEach(() => {
    resetAuditSink();
    clearIdentitySnapshot();
  });

  it('denies oh.sync.apply when no identity snapshot is installed', () => {
    expect(() => dispatchSyncRpc({ type: 'oh.sync.apply', batch: makeApplyBatch(WS), sideEffects: [] })).toThrow(
      PermissionDeniedError,
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.decision.allow).toBe(false);
    expect(audits[0]?.decision.reason).toBe('no-current-user');
    expect(audits[0]?.capability).toBe('workspace.write');
    expect(audits[0]?.workspaceId).toBe(WS);
  });

  it('allows oh.sync.apply for the synthetic LocalAdmin', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await ensureWorkspaceRoleAssignments([WS]);
    await refreshIdentitySnapshotFromHostStorage();

    // The gate allowed; the underlying handler may still reject for
    // unrelated reasons (no oracle bootstrapped in this isolated test) —
    // we only assert the gate passed (no throw) and the audit recorded ALLOW.
    let threw: unknown = null;
    try {
      const result = dispatchSyncRpc({ type: 'oh.sync.apply', batch: makeApplyBatch(WS), sideEffects: [] });
      // Drain async result to surface any underlying handler error.
      if (result && result.kind === 'async') await result.promise.catch(() => undefined);
    } catch (err) {
      threw = err;
    }
    expect(threw).not.toBeInstanceOf(PermissionDeniedError);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.decision.allow).toBe(true);
    expect(audits[0]?.capability).toBe('workspace.write');
  });

  it('skips the gate for explicitly ungated types', async () => {
    // `oh.sync.getDataPresence` is local-only metadata used by the
    // mode-switch dialog before any identity may be resolved; the gate
    // pass-through is by design.
    const result = dispatchSyncRpc({ type: 'oh.sync.getDataPresence' });
    expect(result).not.toBeNull();
    if (result?.kind === 'async') await result.promise.catch(() => undefined);
    expect(audits).toHaveLength(0);
  });

  it('skips the gate for peer-driven mutation-stream types', async () => {
    // SYNC_MUTATION_TYPE / BATCH_TYPE / AWARENESS_PRESENCE_TYPE ride the
    // SW→peer handshake gate + per-envelope forwarder/receiver gate; the
    // renderer-side dispatcher must NOT re-gate them.
    const result = dispatchSyncRpc({
      type: 'oh.sync.mutation',
      workspaceId: WS,
      envelope: {} as never,
    });
    // The mutation receiver may reject the malformed envelope downstream,
    // but the gate itself did not throw and did not audit.
    if (result?.kind === 'async') await result.promise.catch(() => undefined);
    expect(audits).toHaveLength(0);
  });

  it('denies a snapshot read when no identity snapshot is installed', () => {
    expect(() => dispatchSyncRpc({ type: 'oh.sync.snapshotRules', workspaceId: WS })).toThrow(PermissionDeniedError);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.capability).toBe('workspace.read');
    expect(audits[0]?.decision.allow).toBe(false);
  });

  it('denies a mode-switch orchestrator without LocalAdmin context', () => {
    // No snapshot installed → daemon.admin resolves to no-current-user.
    expect(() => dispatchSyncRpc({ type: 'oh.sync.executeDiscardWithBackup' })).toThrow(PermissionDeniedError);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.capability).toBe('daemon.admin');
  });

  it('gates the Use-Target orchestrator behind daemon.admin (U5.4)', () => {
    expect(() => dispatchSyncRpc({ type: 'oh.sync.executeUseTarget', targetOrgId: 'org-x' })).toThrow(
      PermissionDeniedError,
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]?.capability).toBe('daemon.admin');
  });

  it('allows workspace.list snapshot read for any installed snapshot', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await refreshIdentitySnapshotFromHostStorage();

    let threw: unknown = null;
    try {
      const result = dispatchSyncRpc({ type: 'oh.sync.snapshotExtensionWorkspaces' });
      if (result && result.kind === 'async') await result.promise.catch(() => undefined);
    } catch (err) {
      threw = err;
    }
    expect(threw).not.toBeInstanceOf(PermissionDeniedError);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.capability).toBe('workspace.list');
    expect(audits[0]?.decision.allow).toBe(true);
  });

  it('audit entry carries the synthetic user id once the snapshot is installed', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await ensureWorkspaceRoleAssignments([WS]);
    await refreshIdentitySnapshotFromHostStorage();

    try {
      const result = dispatchSyncRpc({ type: 'oh.sync.apply', batch: makeApplyBatch(WS), sideEffects: [] });
      if (result && result.kind === 'async') await result.promise.catch(() => undefined);
    } catch {
      // Underlying handler may throw; we only assert audit correctness.
    }
    expect(audits[0]?.actorUserId).toBe(record.user.id);
    // hostStorage retention check — both stores wrote through the same fake.
    expect(await hostStorage.get((await import('@openheaders/core/storage')).OH.syntheticIdentity)).toBeTruthy();
  });
});
