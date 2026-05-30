/**
 * Phase C M6 — mode-switch Restore host-neutral pieces.
 *
 * Pins the applier (mint + retarget + apply sequencing, partial-fail
 * survivor surfacing, no-workspaces guard), the archive shape guard,
 * the renderer bridge wrapper (success passthrough + transport-error
 * fold), and the toast summarizer. Mirrors the structure of
 * discard.test.ts.
 */

import type { WorkspaceSnapshot } from '@openheaders/core/protocol';
import type { DiscardBackupArchive, RestoreResult } from '@openheaders/core/sync';
import { isDiscardBackupArchiveShape } from '@openheaders/core/sync';
import { applyDiscardRestoreArchive } from '@openheaders/oracle/sync';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';
const WS_B = '0193a8ff-c000-7000-8000-00000000000b';
const NEW_A = '0193b000-c000-7000-8000-00000000000a';
const NEW_B = '0193b000-c000-7000-8000-00000000000b';
const FIXED_NOW = '2026-05-17T12:00:00.000Z';

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
    liveValues: [],
    liveFallbackPriority: [],
    oauthBundles: [],
    pauseMarkers: [],
    layoutState: [],
    files: [],
    ...overrides,
  };
}

function makeArchive(
  entries: Array<{ workspaceId: string; workspaceName: string; snapshot?: WorkspaceSnapshot }>,
): DiscardBackupArchive {
  return {
    schemaVersion: 1,
    generatedAt: FIXED_NOW,
    workspaces: entries.map((e) => ({
      workspaceId: e.workspaceId,
      workspaceName: e.workspaceName,
      snapshot: e.snapshot ?? makeSnapshot(e.workspaceId),
    })),
  };
}

describe('isDiscardBackupArchiveShape', () => {
  it('accepts a well-formed archive', () => {
    expect(isDiscardBackupArchiveShape(makeArchive([{ workspaceId: WS_A, workspaceName: 'Alpha' }]))).toBe(true);
  });

  it('accepts an empty workspaces array (defensive — applier handles emptiness)', () => {
    expect(isDiscardBackupArchiveShape({ schemaVersion: 1, generatedAt: FIXED_NOW, workspaces: [] })).toBe(true);
  });

  it('rejects null + non-objects', () => {
    expect(isDiscardBackupArchiveShape(null)).toBe(false);
    expect(isDiscardBackupArchiveShape('hello')).toBe(false);
    expect(isDiscardBackupArchiveShape(42)).toBe(false);
  });

  it('rejects wrong schemaVersion', () => {
    expect(isDiscardBackupArchiveShape({ schemaVersion: 2, generatedAt: FIXED_NOW, workspaces: [] })).toBe(false);
    expect(isDiscardBackupArchiveShape({ schemaVersion: '1', generatedAt: FIXED_NOW, workspaces: [] })).toBe(false);
  });

  it('rejects missing generatedAt', () => {
    expect(isDiscardBackupArchiveShape({ schemaVersion: 1, workspaces: [] })).toBe(false);
    expect(isDiscardBackupArchiveShape({ schemaVersion: 1, generatedAt: '', workspaces: [] })).toBe(false);
  });

  it('rejects a workspace entry missing required fields', () => {
    expect(
      isDiscardBackupArchiveShape({
        schemaVersion: 1,
        generatedAt: FIXED_NOW,
        workspaces: [{ workspaceId: WS_A, workspaceName: 'Alpha' }],
      }),
    ).toBe(false);
  });

  it('rejects a snapshot whose workspaceId is empty', () => {
    const arch = makeArchive([{ workspaceId: WS_A, workspaceName: 'Alpha', snapshot: makeSnapshot('') }]);
    expect(isDiscardBackupArchiveShape(arch)).toBe(false);
  });
});

describe('applyDiscardRestoreArchive', () => {
  function deps(
    overrides: Partial<{
      createWorkspace: (input: { name: string }) => Promise<{ id: string; name: string }>;
      applySnapshot: (snapshot: WorkspaceSnapshot) => Promise<{ entitiesApplied: number }>;
    }> = {},
  ) {
    const ids = [NEW_A, NEW_B];
    let i = 0;
    return {
      createWorkspace:
        overrides.createWorkspace ??
        vi.fn(async ({ name }: { name: string }) => ({ id: ids[i++] ?? `mint-${i}`, name })),
      applySnapshot: overrides.applySnapshot ?? vi.fn(async () => ({ entitiesApplied: 0 })),
    };
  }

  it('returns no-workspaces when the archive is empty', async () => {
    const d = deps();
    const result = await applyDiscardRestoreArchive(makeArchive([]), d);
    expect(result).toEqual({ ok: false, reason: 'no-workspaces' });
    expect(d.createWorkspace).not.toHaveBeenCalled();
    expect(d.applySnapshot).not.toHaveBeenCalled();
  });

  it('mints fresh ids, retargets the snapshot, and applies each workspace', async () => {
    const applied: WorkspaceSnapshot[] = [];
    const d = deps({
      applySnapshot: async (snapshot) => {
        applied.push(snapshot);
        return { entitiesApplied: 3 };
      },
    });
    const archive = makeArchive([
      { workspaceId: WS_A, workspaceName: 'Alpha' },
      { workspaceId: WS_B, workspaceName: 'Beta' },
    ]);
    const result = await applyDiscardRestoreArchive(archive, d);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.restoredWorkspaces).toEqual([
      { sourceWorkspaceId: WS_A, newWorkspaceId: NEW_A, workspaceName: 'Alpha', entitiesApplied: 3 },
      { sourceWorkspaceId: WS_B, newWorkspaceId: NEW_B, workspaceName: 'Beta', entitiesApplied: 3 },
    ]);
    // Retarget pins the new id onto the snapshot BEFORE apply.
    expect(applied[0].workspaceId).toBe(NEW_A);
    expect(applied[1].workspaceId).toBe(NEW_B);
  });

  it('preserves invocation order: createWorkspace then applySnapshot, per entry', async () => {
    const events: string[] = [];
    const ids = [NEW_A, NEW_B];
    let i = 0;
    const result = await applyDiscardRestoreArchive(
      makeArchive([
        { workspaceId: WS_A, workspaceName: 'Alpha' },
        { workspaceId: WS_B, workspaceName: 'Beta' },
      ]),
      {
        createWorkspace: async ({ name }: { name: string }) => {
          events.push(`mint:${name}`);
          return { id: ids[i++], name };
        },
        applySnapshot: async (snap: WorkspaceSnapshot) => {
          events.push(`apply:${snap.workspaceId}`);
          return { entitiesApplied: 0 };
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(events).toEqual([`mint:Alpha`, `apply:${NEW_A}`, `mint:Beta`, `apply:${NEW_B}`]);
  });

  it('returns apply-failed with the survivor list when a later workspace rejects', async () => {
    const d = deps({
      applySnapshot: vi
        .fn<(snapshot: WorkspaceSnapshot) => Promise<{ entitiesApplied: number }>>()
        .mockResolvedValueOnce({ entitiesApplied: 2 })
        .mockRejectedValueOnce(new Error('apply-boom')),
    });
    const result = await applyDiscardRestoreArchive(
      makeArchive([
        { workspaceId: WS_A, workspaceName: 'Alpha' },
        { workspaceId: WS_B, workspaceName: 'Beta' },
      ]),
      d,
    );
    expect(result).toMatchObject({ ok: false, reason: 'apply-failed' });
    if (result.ok) return;
    expect(result.detail).toContain('Beta');
    expect(result.detail).toContain('apply-boom');
    expect(result.restoredWorkspaces).toEqual([
      { sourceWorkspaceId: WS_A, newWorkspaceId: NEW_A, workspaceName: 'Alpha', entitiesApplied: 2 },
    ]);
  });

  it('returns apply-failed with an empty survivor list when the first workspace rejects', async () => {
    const d = deps({
      applySnapshot: () => Promise.reject(new Error('first-fail')),
    });
    const result = await applyDiscardRestoreArchive(makeArchive([{ workspaceId: WS_A, workspaceName: 'Alpha' }]), d);
    expect(result).toMatchObject({ ok: false, reason: 'apply-failed' });
    if (result.ok) return;
    expect(result.restoredWorkspaces).toEqual([]);
  });

  it('coerces non-Error throws into a string detail', async () => {
    const d = deps({
      applySnapshot: () => Promise.reject('nope'),
    });
    const result = await applyDiscardRestoreArchive(makeArchive([{ workspaceId: WS_A, workspaceName: 'Alpha' }]), d);
    expect(result).toMatchObject({ ok: false, reason: 'apply-failed', detail: 'Alpha: nope' });
  });
});

describe('executeRestore (renderer bridge wrapper)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the bridge response on success', async () => {
    const { executeRestore } = await import('@openheaders/ui/shared/mode-switch');
    const archive = makeArchive([{ workspaceId: WS_A, workspaceName: 'Alpha' }]);
    const stub: RestoreResult = { ok: true, restoredWorkspaces: [] };
    const result = await executeRestore({ archive, bridgeCall: async () => stub });
    expect(result).toBe(stub);
  });

  it('passes the archive through to the bridge call', async () => {
    const { executeRestore } = await import('@openheaders/ui/shared/mode-switch');
    const archive = makeArchive([{ workspaceId: WS_A, workspaceName: 'Alpha' }]);
    const calls: DiscardBackupArchive[] = [];
    await executeRestore({
      archive,
      bridgeCall: async (a) => {
        calls.push(a);
        return { ok: true, restoredWorkspaces: [] };
      },
    });
    expect(calls).toEqual([archive]);
  });

  it('folds bridge rejections into apply-failed', async () => {
    const { executeRestore } = await import('@openheaders/ui/shared/mode-switch');
    const archive = makeArchive([{ workspaceId: WS_A, workspaceName: 'Alpha' }]);
    const result = await executeRestore({
      archive,
      bridgeCall: () => Promise.reject(new Error('ipc-down')),
    });
    expect(result).toMatchObject({ ok: false, reason: 'apply-failed' });
    if (result.ok) return;
    expect(result.detail).toBe('ipc-down');
  });

  it('coerces non-Error bridge throws into a string detail', async () => {
    const { executeRestore } = await import('@openheaders/ui/shared/mode-switch');
    const archive = makeArchive([{ workspaceId: WS_A, workspaceName: 'Alpha' }]);
    const result = await executeRestore({
      archive,
      bridgeCall: () => Promise.reject('nope'),
    });
    expect(result).toMatchObject({ ok: false, reason: 'apply-failed', detail: 'nope' });
  });
});

describe('summarizeRestore toast copy', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('success copy quotes workspace + item counts', async () => {
    const { summarizeRestoreSuccess } = await import('@openheaders/ui/shared/mode-switch');
    const copy = summarizeRestoreSuccess({
      ok: true,
      restoredWorkspaces: [
        { sourceWorkspaceId: WS_A, newWorkspaceId: NEW_A, workspaceName: 'Alpha', entitiesApplied: 5 },
        { sourceWorkspaceId: WS_B, newWorkspaceId: NEW_B, workspaceName: 'Beta', entitiesApplied: 7 },
      ],
    });
    expect(copy).toContain('2 workspaces');
    expect(copy).toContain('12 items');
  });

  it('success copy omits the item-count fragment when nothing was applied', async () => {
    const { summarizeRestoreSuccess } = await import('@openheaders/ui/shared/mode-switch');
    const copy = summarizeRestoreSuccess({
      ok: true,
      restoredWorkspaces: [
        { sourceWorkspaceId: WS_A, newWorkspaceId: NEW_A, workspaceName: 'Alpha', entitiesApplied: 0 },
      ],
    });
    expect(copy).toContain('1 workspace');
    expect(copy).not.toContain('items');
    expect(copy).not.toContain('item)');
  });

  it('renders a distinct line per failure reason; partial recovery surfaced on apply-failed', async () => {
    const { summarizeRestoreFailure } = await import('@openheaders/ui/shared/mode-switch');
    expect(summarizeRestoreFailure({ ok: false, reason: 'invalid-archive' })).toContain('valid backup');
    expect(summarizeRestoreFailure({ ok: false, reason: 'no-workspaces' })).toContain('empty');
    expect(summarizeRestoreFailure({ ok: false, reason: 'apply-failed' })).toContain('intact');
    const partial = summarizeRestoreFailure({
      ok: false,
      reason: 'apply-failed',
      restoredWorkspaces: [
        { sourceWorkspaceId: WS_A, newWorkspaceId: NEW_A, workspaceName: 'Alpha', entitiesApplied: 1 },
      ],
    });
    expect(partial).toContain('1 workspace');
    expect(partial).toContain('mounted');
  });
});
