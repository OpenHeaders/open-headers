/**
 * Phase C M4 — mode-switch Import host-neutral pieces.
 *
 * Pins the source collector + target applier (including the snapshot-id
 * enumerator + the conflict-diff intersection) + source-side
 * orchestrator. Bridge wrappers + UI summary helpers live in their own
 * describe-blocks at the bottom; they bind to `@openheaders/core/bridge`
 * and don't benefit from sharing fixtures with the oracle-side helpers.
 */

import type { WorkspaceSnapshot } from '@openheaders/core/protocol';
import type { ImportPayload, ImportResult } from '@openheaders/core/sync';
import {
  applyImportPayload,
  collectImportPayload,
  enumerateSnapshotEntities,
  type ImportSourceOracle,
  orchestrateImportToPeer,
  setImportPeerPusher,
} from '@openheaders/oracle/sync';
import { afterEach, describe, expect, it, vi } from 'vitest';

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';
const WS_B = '0193a8ff-c000-7000-8000-00000000000b';

function makeOracle(entities: ReadonlyArray<{ type: string }>): ImportSourceOracle {
  return { materializeAll: () => entities };
}

function makeSnapshot(workspaceId: string, overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    takenAtHlc: {},
    rules: [],
    environments: [],
    collections: [],
    workspaceVariables: [],
    vault: [],
    folders: [],
    requests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    liveVariables: [],
    liveWorkflows: [],
    oauthBundles: [],
    pauseMarkers: [],
    layoutState: [],
    files: [],
    ...overrides,
  };
}

describe('collectImportPayload', () => {
  it('returns an empty payload when no workspaces are resident', async () => {
    const payload = await collectImportPayload({
      workspaces: [],
      getOracle: () => null,
      buildSnapshot: () => Promise.reject(new Error('should not be called')),
    });
    expect(payload).toEqual({ workspaces: [] });
  });

  it('skips workspaces whose oracle is not hydrated', async () => {
    const buildSnapshot = vi.fn();
    const payload = await collectImportPayload({
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      getOracle: () => null,
      buildSnapshot,
    });
    expect(payload.workspaces).toHaveLength(0);
    expect(buildSnapshot).not.toHaveBeenCalled();
  });

  it('skips workspaces whose materialized state has only singletons', async () => {
    const buildSnapshot = vi.fn();
    const payload = await collectImportPayload({
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      getOracle: () => makeOracle([{ type: 'workspace-variables' }, { type: 'vault' }, { type: 'layout-state' }]),
      buildSnapshot,
    });
    expect(payload.workspaces).toHaveLength(0);
    expect(buildSnapshot).not.toHaveBeenCalled();
  });

  it('includes workspaces with at least one user-content entity', async () => {
    const buildSnapshot = vi.fn(async (id: string) => makeSnapshot(id));
    const payload = await collectImportPayload({
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      getOracle: () => makeOracle([{ type: 'rule' }, { type: 'vault' }]),
      buildSnapshot,
    });
    expect(payload.workspaces).toHaveLength(1);
    expect(payload.workspaces[0]).toMatchObject({
      sourceWorkspaceId: WS_A,
      sourceWorkspaceName: 'Alpha',
    });
    expect(buildSnapshot).toHaveBeenCalledWith(WS_A);
  });

  it('propagates buildSnapshot rejections (no partial payload)', async () => {
    await expect(
      collectImportPayload({
        workspaces: [{ id: WS_A, name: 'Alpha' }],
        getOracle: () => makeOracle([{ type: 'rule' }]),
        buildSnapshot: () => Promise.reject(new Error('snap-failed')),
      }),
    ).rejects.toThrow('snap-failed');
  });
});

describe('enumerateSnapshotEntities', () => {
  it('returns an empty list for a snapshot with no user-content entries', () => {
    expect(enumerateSnapshotEntities(makeSnapshot(WS_A))).toEqual([]);
  });

  it('extracts uid as the entity id for every per-type post-state array', () => {
    const snap = makeSnapshot(WS_A, {
      // Cast through unknown so the test doesn't have to construct every
      // schema field; the enumerator only reads `<entry>.<kind>.uid`.
      rules: [{ rule: { uid: 'rule-1' } }] as unknown as WorkspaceSnapshot['rules'],
      environments: [{ environment: { uid: 'env-1' } }] as unknown as WorkspaceSnapshot['environments'],
      collections: [{ collection: { uid: 'col-1' } }] as unknown as WorkspaceSnapshot['collections'],
      folders: [{ folder: { uid: 'fol-1' } }] as unknown as WorkspaceSnapshot['folders'],
      requests: [{ request: { uid: 'req-1' } }] as unknown as WorkspaceSnapshot['requests'],
      liveWorkflows: [{ workflow: { uid: 'wf-1' } }] as unknown as WorkspaceSnapshot['liveWorkflows'],
    });
    const enumerated = enumerateSnapshotEntities(snap);
    expect(enumerated).toContainEqual({ type: 'rule', id: 'rule-1' });
    expect(enumerated).toContainEqual({ type: 'environment', id: 'env-1' });
    expect(enumerated).toContainEqual({ type: 'collection', id: 'col-1' });
    expect(enumerated).toContainEqual({ type: 'folder', id: 'fol-1' });
    expect(enumerated).toContainEqual({ type: 'request', id: 'req-1' });
    expect(enumerated).toContainEqual({ type: 'live-workflow', id: 'wf-1' });
  });

  it('surfaces oauth-bundle keyed by workspaceId when the bundle is populated', () => {
    const snap = makeSnapshot(WS_A, {
      oauthBundles: [{ tokens: [], configs: [], refreshErrors: [] }] as unknown as WorkspaceSnapshot['oauthBundles'],
    });
    expect(enumerateSnapshotEntities(snap)).toContainEqual({ type: 'oauth-bundle', id: WS_A });
  });
});

describe('applyImportPayload', () => {
  it('returns no-source-data when the payload is empty', async () => {
    const result = await applyImportPayload(
      { workspaces: [] },
      {
        lookupWorkspace: vi.fn(),
        listEntityIds: vi.fn(),
        applySnapshot: vi.fn(),
      },
    );
    expect(result).toEqual({ ok: false, reason: 'no-source-data' });
  });

  it('records workspaces without a matching target id as ignored (no apply attempt)', async () => {
    const applySnapshot = vi.fn();
    const result = await applyImportPayload(
      {
        workspaces: [{ sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Alpha', snapshot: makeSnapshot(WS_A) }],
      },
      {
        lookupWorkspace: () => null,
        listEntityIds: () => [],
        applySnapshot,
      },
    );
    expect(applySnapshot).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: 'no-matching-workspace' });
  });

  it('mixes matched + unmatched workspaces — ignored rows surface alongside merged rows', async () => {
    const applySnapshot = vi.fn(async () => ({ entitiesApplied: 5 }));
    const result = await applyImportPayload(
      {
        workspaces: [
          { sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Alpha', snapshot: makeSnapshot(WS_A) },
          { sourceWorkspaceId: WS_B, sourceWorkspaceName: 'Beta', snapshot: makeSnapshot(WS_B) },
        ],
      },
      {
        lookupWorkspace: (id: string) => (id === WS_A ? { id: WS_A, name: 'Alpha (target)' } : null),
        listEntityIds: () => [],
        applySnapshot,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mergedWorkspaces).toHaveLength(1);
    expect(result.mergedWorkspaces[0]).toMatchObject({
      workspaceId: WS_A,
      workspaceName: 'Alpha (target)',
      entitiesApplied: 5,
      conflicts: [],
    });
    expect(result.ignored).toEqual([
      { sourceWorkspaceId: WS_B, sourceWorkspaceName: 'Beta', reason: 'no-matching-target' },
    ]);
    expect(result.totalEntitiesApplied).toBe(5);
  });

  it('emits one conflict row per (type, id) that exists on BOTH sides pre-apply', async () => {
    const snap = makeSnapshot(WS_A, {
      rules: [{ rule: { uid: 'r-1' } }, { rule: { uid: 'r-2' } }] as unknown as WorkspaceSnapshot['rules'],
      environments: [{ environment: { uid: 'e-1' } }] as unknown as WorkspaceSnapshot['environments'],
    });
    const result = await applyImportPayload(
      {
        workspaces: [{ sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Alpha', snapshot: snap }],
      },
      {
        lookupWorkspace: () => ({ id: WS_A, name: 'Alpha' }),
        listEntityIds: () => [
          // r-1 exists on both → conflict
          { type: 'rule', id: 'r-1' },
          // r-3 exists on target only → not a conflict (no source twin)
          { type: 'rule', id: 'r-3' },
          // e-1 exists on both → conflict
          { type: 'environment', id: 'e-1' },
          // singletons must be filtered out of the conflict count
          { type: 'workspace-variables', id: WS_A },
        ],
        applySnapshot: async () => ({ entitiesApplied: 3 }),
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mergedWorkspaces[0].conflicts).toEqual([
      { workspaceId: WS_A, entityType: 'rule', entityId: 'r-1' },
      { workspaceId: WS_A, entityType: 'environment', entityId: 'e-1' },
    ]);
    expect(result.totalConflicts).toBe(2);
  });

  it('honors workspaceIdRemap: retargets the snapshot at the mapped target id and records renamedFromSourceId', async () => {
    const captured: WorkspaceSnapshot[] = [];
    const applySnapshot = vi.fn(async (snap: WorkspaceSnapshot) => {
      captured.push(snap);
      return { entitiesApplied: 6 };
    });
    const result = await applyImportPayload(
      {
        workspaces: [{ sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Production', snapshot: makeSnapshot(WS_A) }],
        workspaceIdRemap: { [WS_A]: WS_B },
      },
      {
        // Only WS_B exists on the target; without the remap this row would be ignored.
        lookupWorkspace: (id: string) => (id === WS_B ? { id: WS_B, name: 'Production (target)' } : null),
        listEntityIds: () => [],
        applySnapshot,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mergedWorkspaces).toHaveLength(1);
    expect(result.mergedWorkspaces[0]).toMatchObject({
      workspaceId: WS_B,
      workspaceName: 'Production (target)',
      entitiesApplied: 6,
      renamedFromSourceId: WS_A,
    });
    expect(result.ignored).toEqual([]);
    // The snapshot routed into applySnapshot must carry the target id, not the source's.
    expect(captured[0].workspaceId).toBe(WS_B);
  });

  it('records remap-pointing-at-missing-target as ignored (same channel as legacy no-match)', async () => {
    const applySnapshot = vi.fn();
    const result = await applyImportPayload(
      {
        workspaces: [{ sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Production', snapshot: makeSnapshot(WS_A) }],
        // Remap points at WS_B but lookupWorkspace returns null for it.
        workspaceIdRemap: { [WS_A]: WS_B },
      },
      {
        lookupWorkspace: () => null,
        listEntityIds: () => [],
        applySnapshot,
      },
    );
    expect(applySnapshot).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: 'no-matching-workspace' });
  });

  it('leaves non-remapped sources on the same-id path while remapping others', async () => {
    const captured: WorkspaceSnapshot[] = [];
    const applySnapshot = vi.fn(async (snap: WorkspaceSnapshot) => {
      captured.push(snap);
      return { entitiesApplied: 1 };
    });
    const result = await applyImportPayload(
      {
        workspaces: [
          // Remapped source: WS_A → WS_B
          { sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Production', snapshot: makeSnapshot(WS_A) },
          // Same-id source: ws-c → ws-c
          { sourceWorkspaceId: 'ws-c', sourceWorkspaceName: 'Staging', snapshot: makeSnapshot('ws-c') },
        ],
        workspaceIdRemap: { [WS_A]: WS_B },
      },
      {
        lookupWorkspace: (id: string) => {
          if (id === WS_B) return { id: WS_B, name: 'Production (target)' };
          if (id === 'ws-c') return { id: 'ws-c', name: 'Staging (target)' };
          return null;
        },
        listEntityIds: () => [],
        applySnapshot,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mergedWorkspaces).toHaveLength(2);
    expect(result.mergedWorkspaces[0]).toMatchObject({ workspaceId: WS_B, renamedFromSourceId: WS_A });
    expect(result.mergedWorkspaces[1]).toMatchObject({ workspaceId: 'ws-c' });
    expect(result.mergedWorkspaces[1].renamedFromSourceId).toBeUndefined();
    expect(captured[0].workspaceId).toBe(WS_B);
    expect(captured[1].workspaceId).toBe('ws-c');
  });

  it('returns apply-failed and short-circuits on the first applySnapshot rejection', async () => {
    const applySnapshot = vi
      .fn()
      .mockResolvedValueOnce({ entitiesApplied: 3 })
      .mockRejectedValueOnce(new Error('apply-boom'));

    const result = await applyImportPayload(
      {
        workspaces: [
          { sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Alpha', snapshot: makeSnapshot(WS_A) },
          { sourceWorkspaceId: WS_B, sourceWorkspaceName: 'Beta', snapshot: makeSnapshot(WS_B) },
        ],
      },
      {
        lookupWorkspace: (id: string) => ({ id, name: id }),
        listEntityIds: () => [],
        applySnapshot,
      },
    );

    expect(result).toMatchObject({ ok: false, reason: 'apply-failed' });
    if (result.ok) return;
    expect(result.detail).toContain('Beta');
    expect(result.detail).toContain('apply-boom');
    expect(applySnapshot).toHaveBeenCalledTimes(2);
  });
});

describe('orchestrateImportToPeer', () => {
  afterEach(() => {
    setImportPeerPusher(null);
  });

  function noopDeps() {
    return {
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      getOracle: () => makeOracle([{ type: 'rule' }]),
      buildSnapshot: (id: string) => Promise.resolve(makeSnapshot(id)),
    };
  }

  it('returns peer-write-unavailable when no pusher is installed', async () => {
    const result = await orchestrateImportToPeer(noopDeps());
    expect(result).toMatchObject({ ok: false, reason: 'peer-write-unavailable' });
  });

  it('returns no-source-data when local collection is empty', async () => {
    setImportPeerPusher(vi.fn());
    const result = await orchestrateImportToPeer({
      workspaces: [],
      getOracle: () => null,
      buildSnapshot: () => Promise.reject(new Error('unreached')),
    });
    expect(result).toEqual({ ok: false, reason: 'no-source-data' });
  });

  it('forwards local payload to the installed pusher and returns its response', async () => {
    const received: ImportPayload[] = [];
    const peerResponse: ImportResult = {
      ok: true,
      mergedWorkspaces: [{ workspaceId: WS_A, workspaceName: 'Alpha', entitiesApplied: 4, conflicts: [] }],
      ignored: [],
      totalEntitiesApplied: 4,
      totalConflicts: 0,
    };
    setImportPeerPusher(async (payload: ImportPayload) => {
      received.push(payload);
      return peerResponse;
    });
    const result = await orchestrateImportToPeer(noopDeps());
    expect(received).toHaveLength(1);
    expect(received[0].workspaces[0].sourceWorkspaceId).toBe(WS_A);
    expect(result).toBe(peerResponse);
  });

  it('converts pusher rejections into peer-write-unavailable with the underlying detail', async () => {
    setImportPeerPusher(async () => {
      throw new Error('not-connected');
    });
    const result = await orchestrateImportToPeer(noopDeps());
    expect(result).toMatchObject({ ok: false, reason: 'peer-write-unavailable' });
    if (result.ok) return;
    expect(result.detail).toBe('not-connected');
  });

  it('stamps the workspaceIdRemap onto the payload before push when provided', async () => {
    const received: ImportPayload[] = [];
    setImportPeerPusher(async (payload) => {
      received.push(payload);
      return {
        ok: true,
        mergedWorkspaces: [],
        ignored: [],
        totalEntitiesApplied: 0,
        totalConflicts: 0,
      };
    });
    await orchestrateImportToPeer({
      ...noopDeps(),
      workspaceIdRemap: { [WS_A]: WS_B },
    });
    expect(received[0].workspaceIdRemap).toEqual({ [WS_A]: WS_B });
  });

  it('omits the workspaceIdRemap field when the input remap is empty', async () => {
    const received: ImportPayload[] = [];
    setImportPeerPusher(async (payload) => {
      received.push(payload);
      return {
        ok: true,
        mergedWorkspaces: [],
        ignored: [],
        totalEntitiesApplied: 0,
        totalConflicts: 0,
      };
    });
    await orchestrateImportToPeer({ ...noopDeps(), workspaceIdRemap: {} });
    expect(received[0].workspaceIdRemap).toBeUndefined();
  });

  it('propagates an explicit { ok: false } from the peer verbatim', async () => {
    const peerFailure: ImportResult = {
      ok: false,
      reason: 'apply-failed',
      detail: 'Alpha: peer rejected',
    };
    setImportPeerPusher(async () => peerFailure);
    const result = await orchestrateImportToPeer(noopDeps());
    expect(result).toEqual(peerFailure);
  });
});
