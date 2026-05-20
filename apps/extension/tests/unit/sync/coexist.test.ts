/**
 * Phase C M3 — mode-switch Coexist host-neutral pieces.
 *
 * Pins the source collector + target applier + source-side orchestrator
 * in one file. Bridge wrappers + UI summary helpers live in their own
 * test files because they bind to `@openheaders/core/bridge` and don't
 * benefit from sharing fixtures with the oracle-side helpers.
 */

import type { WorkspaceSnapshot } from '@openheaders/core/protocol';
import type { CoexistPayload, CoexistResult } from '@openheaders/core/sync';
import {
  applyCoexistPayload,
  type CoexistSourceOracle,
  collectCoexistPayload,
  orchestrateCoexistToPeer,
  setCoexistPeerPusher,
} from '@openheaders/oracle/sync';
import { afterEach, describe, expect, it, vi } from 'vitest';

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';
const WS_B = '0193a8ff-c000-7000-8000-00000000000b';

function makeOracle(entities: ReadonlyArray<{ type: string }>): CoexistSourceOracle {
  return { materializeAll: () => entities };
}

/**
 * Skeletal {@link WorkspaceSnapshot}. The collector + applier only
 * touch `workspaceId`; the per-entity arrays are passed through
 * opaquely. Tests stub `applySnapshot` so they don't need real
 * post-states.
 */
function makeSnapshot(workspaceId: string): WorkspaceSnapshot {
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
  };
}

describe('collectCoexistPayload', () => {
  it('returns an empty payload when no workspaces are resident', async () => {
    const payload = await collectCoexistPayload({
      workspaces: [],
      getOracle: () => null,
      buildSnapshot: () => Promise.reject(new Error('should not be called')),
    });
    expect(payload).toEqual({ workspaces: [] });
  });

  it('skips workspaces whose oracle is not hydrated', async () => {
    const buildSnapshot = vi.fn();
    const payload = await collectCoexistPayload({
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      getOracle: () => null,
      buildSnapshot,
    });
    expect(payload.workspaces).toHaveLength(0);
    expect(buildSnapshot).not.toHaveBeenCalled();
  });

  it('skips workspaces whose materialized state has only singletons', async () => {
    const buildSnapshot = vi.fn();
    const payload = await collectCoexistPayload({
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      getOracle: () =>
        makeOracle([
          { type: 'workspace-variables' },
          { type: 'vault' },
          { type: 'layout-state' },
          { type: 'pause-markers' },
          { type: 'files' },
        ]),
      buildSnapshot,
    });
    expect(payload.workspaces).toHaveLength(0);
    expect(buildSnapshot).not.toHaveBeenCalled();
  });

  it('includes workspaces with at least one user-content entity', async () => {
    const buildSnapshot = vi.fn(async (id: string) => makeSnapshot(id));
    const payload = await collectCoexistPayload({
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

  it('preserves the input workspace order in the payload', async () => {
    const payload = await collectCoexistPayload({
      workspaces: [
        { id: WS_B, name: 'Beta' },
        { id: WS_A, name: 'Alpha' },
      ],
      getOracle: () => makeOracle([{ type: 'rule' }]),
      buildSnapshot: (id) => Promise.resolve(makeSnapshot(id)),
    });
    expect(payload.workspaces.map((w) => w.sourceWorkspaceId)).toEqual([WS_B, WS_A]);
  });

  it('propagates buildSnapshot rejections (no partial payload)', async () => {
    await expect(
      collectCoexistPayload({
        workspaces: [{ id: WS_A, name: 'Alpha' }],
        getOracle: () => makeOracle([{ type: 'rule' }]),
        buildSnapshot: () => Promise.reject(new Error('snap-failed')),
      }),
    ).rejects.toThrow('snap-failed');
  });
});

describe('applyCoexistPayload', () => {
  it('returns no-source-data when the payload is empty', async () => {
    const result = await applyCoexistPayload(
      { workspaces: [] },
      {
        createWorkspace: vi.fn(),
        applySnapshot: vi.fn(),
      },
    );
    expect(result).toEqual({ ok: false, reason: 'no-source-data' });
  });

  it('mints a fresh workspaceId per source workspace and routes the snapshot to it', async () => {
    let minted = 0;
    const createWorkspace = vi.fn(async ({ name }: { name: string }) => ({
      id: `new-${++minted}`,
      name,
    }));
    const applied: WorkspaceSnapshot[] = [];
    const applySnapshot = vi.fn(async (snap: WorkspaceSnapshot) => {
      applied.push(snap);
      return { entitiesApplied: 7 };
    });

    const result = await applyCoexistPayload(
      {
        workspaces: [
          { sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Alpha', snapshot: makeSnapshot(WS_A) },
          { sourceWorkspaceId: WS_B, sourceWorkspaceName: 'Beta', snapshot: makeSnapshot(WS_B) },
        ],
      },
      { createWorkspace, applySnapshot },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toHaveLength(2);
    expect(result.totalEntitiesApplied).toBe(14);
    expect(applied[0].workspaceId).toBe('new-1');
    expect(applied[1].workspaceId).toBe('new-2');
  });

  it('mints the imported workspace under the source name verbatim when there is no collision', async () => {
    const createWorkspace = vi.fn(async ({ name }: { name: string }) => ({ id: 'new-1', name }));
    await applyCoexistPayload(
      {
        workspaces: [{ sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Alpha', snapshot: makeSnapshot(WS_A) }],
      },
      {
        createWorkspace,
        existingWorkspaceNames: () => ['Beta'],
        applySnapshot: () => Promise.resolve({ entitiesApplied: 0 }),
      },
    );
    expect(createWorkspace).toHaveBeenCalledWith({ name: 'Alpha' });
  });

  it('trims surrounding whitespace from the imported name', async () => {
    const createWorkspace = vi.fn(async ({ name }: { name: string }) => ({ id: 'new', name }));
    await applyCoexistPayload(
      {
        workspaces: [{ sourceWorkspaceId: WS_A, sourceWorkspaceName: '  Alpha   ', snapshot: makeSnapshot(WS_A) }],
      },
      { createWorkspace, applySnapshot: () => Promise.resolve({ entitiesApplied: 0 }) },
    );
    expect(createWorkspace).toHaveBeenCalledWith({ name: 'Alpha' });
  });

  it('disambiguates with a numeric suffix on a genuine name collision', async () => {
    const createWorkspace = vi.fn(async ({ name }: { name: string }) => ({ id: `new-${name}`, name }));
    await applyCoexistPayload(
      {
        workspaces: [
          // Collides with a workspace already on the target...
          { sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Alpha', snapshot: makeSnapshot(WS_A) },
          // ...and a second source workspace also named Alpha collides
          // with the one imported just above.
          { sourceWorkspaceId: WS_B, sourceWorkspaceName: 'Alpha', snapshot: makeSnapshot(WS_B) },
        ],
      },
      {
        createWorkspace,
        existingWorkspaceNames: () => ['Alpha'],
        applySnapshot: () => Promise.resolve({ entitiesApplied: 0 }),
      },
    );
    expect(createWorkspace).toHaveBeenNthCalledWith(1, { name: 'Alpha (2)' });
    expect(createWorkspace).toHaveBeenNthCalledWith(2, { name: 'Alpha (3)' });
  });

  it('returns apply-failed and short-circuits on the first applySnapshot rejection', async () => {
    const createWorkspace = vi.fn(async ({ name }: { name: string }) => ({ id: 'new', name }));
    const applySnapshot = vi
      .fn()
      .mockResolvedValueOnce({ entitiesApplied: 3 })
      .mockRejectedValueOnce(new Error('apply-boom'));

    const result = await applyCoexistPayload(
      {
        workspaces: [
          { sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Alpha', snapshot: makeSnapshot(WS_A) },
          { sourceWorkspaceId: WS_B, sourceWorkspaceName: 'Beta', snapshot: makeSnapshot(WS_B) },
        ],
      },
      { createWorkspace, applySnapshot },
    );

    expect(result).toMatchObject({ ok: false, reason: 'apply-failed' });
    if (result.ok) return;
    expect(result.detail).toContain('Beta');
    expect(result.detail).toContain('apply-boom');
    // The first workspace was minted + applied before the failure;
    // applier intentionally doesn't try to roll back partial commits
    // (documented in coexist-applier.ts).
    expect(applySnapshot).toHaveBeenCalledTimes(2);
  });

  it('reports new workspace names verbatim in the success rows', async () => {
    const createWorkspace = vi.fn(async ({ name }: { name: string }) => ({
      id: 'new-1',
      name: `${name} [stored]`,
    }));
    const result = await applyCoexistPayload(
      {
        workspaces: [{ sourceWorkspaceId: WS_A, sourceWorkspaceName: 'Alpha', snapshot: makeSnapshot(WS_A) }],
      },
      { createWorkspace, applySnapshot: () => Promise.resolve({ entitiesApplied: 1 }) },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported[0].newWorkspaceName).toBe('Alpha [stored]');
  });
});

describe('orchestrateCoexistToPeer', () => {
  afterEach(() => {
    setCoexistPeerPusher(null);
  });

  function noopDeps() {
    return {
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      getOracle: () => makeOracle([{ type: 'rule' }]),
      buildSnapshot: (id: string) => Promise.resolve(makeSnapshot(id)),
    };
  }

  it('returns peer-write-unavailable when no pusher is installed', async () => {
    const result = await orchestrateCoexistToPeer(noopDeps());
    expect(result).toMatchObject({ ok: false, reason: 'peer-write-unavailable' });
  });

  it('returns no-source-data when local collection is empty', async () => {
    setCoexistPeerPusher(vi.fn());
    const result = await orchestrateCoexistToPeer({
      workspaces: [],
      getOracle: () => null,
      buildSnapshot: () => Promise.reject(new Error('unreached')),
    });
    expect(result).toEqual({ ok: false, reason: 'no-source-data' });
  });

  it('forwards local payload to the installed pusher and returns its response', async () => {
    const received: CoexistPayload[] = [];
    const peerResponse: CoexistResult = {
      ok: true,
      imported: [
        {
          sourceWorkspaceId: WS_A,
          sourceWorkspaceName: 'Alpha',
          newWorkspaceId: 'peer-new-1',
          newWorkspaceName: 'Alpha',
          entitiesApplied: 4,
        },
      ],
      totalEntitiesApplied: 4,
    };
    setCoexistPeerPusher(async (payload) => {
      received.push(payload);
      return peerResponse;
    });
    const result = await orchestrateCoexistToPeer(noopDeps());
    expect(received).toHaveLength(1);
    expect(received[0].workspaces[0].sourceWorkspaceId).toBe(WS_A);
    expect(result).toBe(peerResponse);
  });

  it('converts pusher rejections into peer-write-unavailable with the underlying detail', async () => {
    setCoexistPeerPusher(async () => {
      throw new Error('not-connected');
    });
    const result = await orchestrateCoexistToPeer(noopDeps());
    expect(result).toMatchObject({ ok: false, reason: 'peer-write-unavailable' });
    if (result.ok) return;
    expect(result.detail).toBe('not-connected');
  });

  it('propagates an explicit { ok: false } from the peer verbatim (distinguishable from transport failure)', async () => {
    const peerFailure: CoexistResult = {
      ok: false,
      reason: 'apply-failed',
      detail: 'Alpha: peer rejected',
    };
    setCoexistPeerPusher(async () => peerFailure);
    const result = await orchestrateCoexistToPeer(noopDeps());
    expect(result).toEqual(peerFailure);
  });
});
