/**
 * Phase C M4 — mode-switch Import host-neutral pieces.
 *
 * Pins the source collector + target applier (including the snapshot-id
 * enumerator + the conflict-diff intersection) + source-side
 * orchestrator. Bridge wrappers + UI summary helpers live in their own
 * describe-blocks at the bottom; they bind to `@openheaders/core/bridge`
 * and don't benefit from sharing fixtures with the oracle-side helpers.
 */

import type { ImportPayload, ImportResult } from '@openheaders/core/sync';
import {
  applyImportPayload,
  collectImportPayload,
  enumerateSnapshotEntities,
  type ImportSourceOracle,
  orchestrateImportToPeer,
  setImportPeerPusher,
} from '@openheaders/oracle/sync';
import type { WorkspaceSnapshot } from '@openheaders/core/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      getOracle: () =>
        makeOracle([
          { type: 'workspace-variables' },
          { type: 'vault' },
          { type: 'layout-state' },
        ]),
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
        workspaces: [
          { sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Alpha', snapshot: makeSnapshot(WS_A) },
        ],
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
      mergedWorkspaces: [
        { workspaceId: WS_A, workspaceName: 'Alpha', entitiesApplied: 4, conflicts: [] },
      ],
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

describe('executeImport (renderer bridge wrapper)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the bridge response on success', async () => {
    const { executeImport } = await import('@openheaders/ui/shared/mode-switch');
    const stub: ImportResult = {
      ok: true,
      mergedWorkspaces: [],
      ignored: [],
      totalEntitiesApplied: 0,
      totalConflicts: 0,
    };
    const result = await executeImport({ bridgeCall: async () => stub });
    expect(result).toBe(stub);
  });

  it('folds bridge rejections into peer-write-unavailable', async () => {
    const { executeImport } = await import('@openheaders/ui/shared/mode-switch');
    const result = await executeImport({
      bridgeCall: () => Promise.reject(new Error('ipc-down')),
    });
    expect(result).toMatchObject({ ok: false, reason: 'peer-write-unavailable' });
    if (result.ok) return;
    expect(result.detail).toBe('ipc-down');
  });

  it('coerces non-Error throws into a string detail', async () => {
    const { executeImport } = await import('@openheaders/ui/shared/mode-switch');
    const result = await executeImport({
      bridgeCall: () => Promise.reject('nope'),
    });
    expect(result).toMatchObject({ ok: false, reason: 'peer-write-unavailable', detail: 'nope' });
  });
});

describe('summarizeImport toast copy', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('singular + plural counts in success copy, with conflict + ignored trailers when relevant', async () => {
    const { summarizeImportSuccess } = await import('@openheaders/ui/shared/mode-switch');
    const clean = summarizeImportSuccess(
      {
        ok: true,
        mergedWorkspaces: [
          { workspaceId: WS_A, workspaceName: 'Alpha', entitiesApplied: 1, conflicts: [] },
        ],
        ignored: [],
        totalEntitiesApplied: 1,
        totalConflicts: 0,
      },
      'Browser Extension',
      'Desktop Application',
    );
    expect(clean).toContain('1 workspace');
    expect(clean).toContain('1 item');
    expect(clean).toContain('Browser Extension');
    expect(clean).toContain('Desktop Application');
    expect(clean).not.toContain('conflict');
    expect(clean).not.toContain('Skipped');

    const withConflicts = summarizeImportSuccess(
      {
        ok: true,
        mergedWorkspaces: [
          { workspaceId: WS_A, workspaceName: 'Alpha', entitiesApplied: 5, conflicts: [] },
          { workspaceId: WS_B, workspaceName: 'Beta', entitiesApplied: 7, conflicts: [] },
        ],
        ignored: [
          { sourceWorkspaceId: 'ws-c', sourceWorkspaceName: 'Gamma', reason: 'no-matching-target' },
        ],
        totalEntitiesApplied: 12,
        totalConflicts: 3,
      },
      'Browser Extension',
      'Desktop Application',
    );
    expect(withConflicts).toContain('2 workspaces');
    expect(withConflicts).toContain('12 items');
    expect(withConflicts).toContain('3 conflicts');
    expect(withConflicts).toContain('Skipped 1 workspace');
    expect(withConflicts).toContain('Coexist');
  });

  it('renders a distinct line per failure reason', async () => {
    const { summarizeImportFailure } = await import('@openheaders/ui/shared/mode-switch');
    expect(summarizeImportFailure({ ok: false, reason: 'peer-write-unavailable' }, 'Desktop')).toContain(
      'connect',
    );
    expect(summarizeImportFailure({ ok: false, reason: 'no-source-data' }, 'Desktop')).toContain(
      'No source data',
    );
    expect(summarizeImportFailure({ ok: false, reason: 'no-matching-workspace' }, 'Desktop')).toContain(
      'Coexist',
    );
    expect(summarizeImportFailure({ ok: false, reason: 'apply-failed' }, 'Desktop')).toContain(
      'Discard',
    );
  });
});
