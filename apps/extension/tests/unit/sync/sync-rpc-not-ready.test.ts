/**
 * Boot-window not-ready contract for the mirror-bootstrap read channels.
 *
 * Pins:
 *   - While the host reports `isSnapshotPlaneReady() === false`, every
 *     `oh.sync.snapshot*` / `oh.awareness.snapshot` dispatch answers
 *     `{ notReady: true }` synchronously — no PermissionDeniedError, no
 *     audit entry (a request that raced the boot is not a privilege
 *     decision).
 *   - `oh.sync.apply` (a write) is NOT covered by the readiness gate.
 *   - Ready (or unwired) hosts keep today's behavior: a snapshot read
 *     with no identity snapshot installed still denies.
 *   - `oh.awareness.snapshot` answers the contract's nullable
 *     workspaceId shape when no workspace is active, instead of
 *     throwing.
 */

import {
  clearIdentitySnapshot,
  type ResolvedAuditEntry,
  resetAuditSink,
  setAuditSink,
} from '@openheaders/core/identity';
import { type HostStorage, setHostStorage } from '@openheaders/core/storage';
import { dispatchSyncRpc, PermissionDeniedError } from '@openheaders/oracle/rpc';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const WS = '0193a8ff-c000-7000-8000-000000000001';

function createHostStorageFake(): HostStorage {
  const map = new Map<string, unknown>();
  return {
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
}

describe('sync-rpc not-ready gate', () => {
  let audits: ResolvedAuditEntry[];

  beforeEach(() => {
    clearIdentitySnapshot();
    setHostStorage(createHostStorageFake());
    audits = [];
    setAuditSink((entry) => audits.push(entry));
  });

  afterEach(() => {
    setOracleHostHooks({});
    resetAuditSink();
    clearIdentitySnapshot();
  });

  it('answers a workspace-scoped snapshot read with notReady while the host is booting', () => {
    setOracleHostHooks({ isSnapshotPlaneReady: () => false });
    const result = dispatchSyncRpc({ type: 'oh.sync.snapshotRules', workspaceId: WS });
    expect(result).toEqual({ kind: 'sync', response: { notReady: true } });
    expect(audits).toHaveLength(0);
  });

  it('answers the workspace-list snapshot with notReady while the host is booting', () => {
    setOracleHostHooks({ isSnapshotPlaneReady: () => false });
    const result = dispatchSyncRpc({ type: 'oh.sync.snapshotExtensionWorkspaces' });
    expect(result).toEqual({ kind: 'sync', response: { notReady: true } });
    expect(audits).toHaveLength(0);
  });

  it('answers the awareness snapshot with notReady while the host is booting', () => {
    setOracleHostHooks({ isSnapshotPlaneReady: () => false });
    const result = dispatchSyncRpc({ type: 'oh.awareness.snapshot' });
    expect(result).toEqual({ kind: 'sync', response: { notReady: true } });
    expect(audits).toHaveLength(0);
  });

  it('does NOT gate the write channel on readiness — oh.sync.apply still hits the capability gate', () => {
    setOracleHostHooks({ isSnapshotPlaneReady: () => false });
    expect(() =>
      dispatchSyncRpc({
        type: 'oh.sync.apply',
        batch: {
          batchId: '01900000-cccc-7000-8000-000000000001',
          mutations: [
            {
              mutationId: '01900000-dddd-7000-8000-000000000001',
              hlc: { physicalMs: 0, logical: 0, nodeId: 'dev' },
              origin: { surfaceId: 'test', deviceId: 'dev' },
              workspaceId: WS,
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
        },
        sideEffects: [],
      }),
    ).toThrow(PermissionDeniedError);
    expect(audits).toHaveLength(1);
  });

  it('a ready host keeps the identity deny for snapshot reads (no silent notReady leak)', () => {
    setOracleHostHooks({ isSnapshotPlaneReady: () => true });
    expect(() => dispatchSyncRpc({ type: 'oh.sync.snapshotRules', workspaceId: WS })).toThrow(PermissionDeniedError);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.decision.reason).toBe('no-current-user');
  });

  it('an unwired host behaves as ready (deny path preserved)', () => {
    expect(() => dispatchSyncRpc({ type: 'oh.sync.snapshotRules', workspaceId: WS })).toThrow(PermissionDeniedError);
  });

  it('oh.awareness.snapshot answers { workspaceId: null, presence: [] } when no workspace is active', () => {
    // No hooks wired: peekActiveWorkspaceId → null; the responder must
    // honor the contract's nullable shape instead of throwing.
    const result = dispatchSyncRpc({ type: 'oh.awareness.snapshot' });
    expect(result).toEqual({ kind: 'sync', response: { workspaceId: null, presence: [] } });
  });
});
