/**
 * Phase C M5 — mode-switch Discard host-neutral pieces.
 *
 * Pins the source collector + orchestrator (including the writer
 * registry + the atomic backup-before-delete sequencing) + the renderer
 * bridge wrapper + the toast summarizer. Mirrors the structure of
 * `import.test.ts`; the writer install test lives in its own file at
 * `tests/unit/install-backup-writer.test.ts`.
 */

import type {
  DiscardBackupArchive,
  DiscardResult,
} from '@openheaders/core/sync';
import {
  collectDiscardArchive,
  orchestrateDiscardWithBackup,
  setBackupWriter,
} from '@openheaders/oracle/sync';
import type { WorkspaceSnapshot } from '@openheaders/core/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';
const WS_B = '0193a8ff-c000-7000-8000-00000000000b';
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
    oauthBundles: [],
    pauseMarkers: [],
    layoutState: [],
    files: [],
    ...overrides,
  };
}

describe('collectDiscardArchive', () => {
  it('returns an empty workspaces list when the host has none', async () => {
    const archive = await collectDiscardArchive({
      workspaces: [],
      buildSnapshot: () => Promise.reject(new Error('should not be called')),
      generatedAt: FIXED_NOW,
    });
    expect(archive).toEqual({ schemaVersion: 1, generatedAt: FIXED_NOW, workspaces: [] });
  });

  it('includes EVERY workspace — singleton-only workspaces are NOT skipped', async () => {
    const buildSnapshot = vi.fn(async (id: string) => makeSnapshot(id));
    const archive = await collectDiscardArchive({
      workspaces: [
        { id: WS_A, name: 'Alpha' },
        { id: WS_B, name: 'Beta' },
      ],
      buildSnapshot,
      generatedAt: FIXED_NOW,
    });
    expect(archive.workspaces).toHaveLength(2);
    expect(archive.workspaces[0]).toMatchObject({ workspaceId: WS_A, workspaceName: 'Alpha' });
    expect(archive.workspaces[1]).toMatchObject({ workspaceId: WS_B, workspaceName: 'Beta' });
    expect(buildSnapshot).toHaveBeenCalledTimes(2);
  });

  it('propagates buildSnapshot rejections (no partial archive)', async () => {
    await expect(
      collectDiscardArchive({
        workspaces: [{ id: WS_A, name: 'Alpha' }],
        buildSnapshot: () => Promise.reject(new Error('snap-failed')),
        generatedAt: FIXED_NOW,
      }),
    ).rejects.toThrow('snap-failed');
  });
});

describe('orchestrateDiscardWithBackup', () => {
  afterEach(() => {
    setBackupWriter(null);
  });

  function noopDeps() {
    return {
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      buildSnapshot: async (id: string) => makeSnapshot(id),
      deleteWorkspace: vi.fn(async () => undefined),
      now: () => FIXED_NOW,
    };
  }

  it('returns backup-writer-unavailable when no writer is installed', async () => {
    const deps = noopDeps();
    const result = await orchestrateDiscardWithBackup(deps);
    expect(result).toMatchObject({ ok: false, reason: 'backup-writer-unavailable' });
    expect(deps.deleteWorkspace).not.toHaveBeenCalled();
  });

  it('returns no-source-data when the host has no resident workspaces', async () => {
    setBackupWriter(vi.fn());
    const deleteWorkspace = vi.fn(async () => undefined);
    const result = await orchestrateDiscardWithBackup({
      workspaces: [],
      buildSnapshot: () => Promise.reject(new Error('unreached')),
      deleteWorkspace,
      now: () => FIXED_NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'no-source-data' });
    expect(deleteWorkspace).not.toHaveBeenCalled();
  });

  it('returns backup-failed and does not delete anything when buildSnapshot rejects', async () => {
    setBackupWriter(vi.fn());
    const deleteWorkspace = vi.fn(async () => undefined);
    const result = await orchestrateDiscardWithBackup({
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      buildSnapshot: () => Promise.reject(new Error('snap-boom')),
      deleteWorkspace,
      now: () => FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: 'backup-failed' });
    if (result.ok) return;
    expect(result.detail).toBe('snap-boom');
    expect(deleteWorkspace).not.toHaveBeenCalled();
  });

  it('returns backup-failed and does not delete anything when the writer rejects', async () => {
    setBackupWriter(async () => {
      throw new Error('disk-full');
    });
    const deleteWorkspace = vi.fn(async () => undefined);
    const result = await orchestrateDiscardWithBackup({
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      buildSnapshot: async (id) => makeSnapshot(id),
      deleteWorkspace,
      now: () => FIXED_NOW,
    });
    expect(result).toMatchObject({ ok: false, reason: 'backup-failed' });
    if (result.ok) return;
    expect(result.detail).toBe('disk-full');
    expect(deleteWorkspace).not.toHaveBeenCalled();
  });

  it('writes the archive THEN deletes every workspace and returns the resolved path on success', async () => {
    const writer = vi.fn(async (_archive: DiscardBackupArchive) => ({
      backupPath: '/tmp/oh-backup-12345.json',
    }));
    setBackupWriter(writer);
    const deleteOrder: string[] = [];
    const deleteWorkspace = vi.fn(async (id: string) => {
      deleteOrder.push(id);
    });
    const result = await orchestrateDiscardWithBackup({
      workspaces: [
        { id: WS_A, name: 'Alpha' },
        { id: WS_B, name: 'Beta' },
      ],
      buildSnapshot: async (id) => makeSnapshot(id),
      deleteWorkspace,
      now: () => FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backupPath).toBe('/tmp/oh-backup-12345.json');
    expect(result.discardedWorkspaces).toEqual([
      { workspaceId: WS_A, workspaceName: 'Alpha', entityCount: 0 },
      { workspaceId: WS_B, workspaceName: 'Beta', entityCount: 0 },
    ]);
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer.mock.calls[0][0]).toMatchObject({
      schemaVersion: 1,
      generatedAt: FIXED_NOW,
    });
    expect(deleteOrder).toEqual([WS_A, WS_B]);
  });

  it('writes BEFORE deleting — invocation order is archive-write first, deletes second', async () => {
    const events: string[] = [];
    setBackupWriter(async () => {
      events.push('write');
      return { backupPath: '/tmp/oh-backup-x.json' };
    });
    const deleteWorkspace = vi.fn(async (id: string) => {
      events.push(`delete:${id}`);
    });
    await orchestrateDiscardWithBackup({
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      buildSnapshot: async (id) => makeSnapshot(id),
      deleteWorkspace,
      now: () => FIXED_NOW,
    });
    expect(events).toEqual(['write', `delete:${WS_A}`]);
  });

  it('counts user-content entities via enumerateSnapshotEntities (singletons excluded)', async () => {
    setBackupWriter(async () => ({ backupPath: '/p.json' }));
    const snap = makeSnapshot(WS_A, {
      rules: [
        { rule: { uid: 'r-1' } },
        { rule: { uid: 'r-2' } },
      ] as unknown as WorkspaceSnapshot['rules'],
      requests: [{ request: { uid: 'req-1' } }] as unknown as WorkspaceSnapshot['requests'],
    });
    const result = await orchestrateDiscardWithBackup({
      workspaces: [{ id: WS_A, name: 'Alpha' }],
      buildSnapshot: async () => snap,
      deleteWorkspace: vi.fn(async () => undefined),
      now: () => FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.discardedWorkspaces[0].entityCount).toBe(3);
  });

  it('never deletes a workspace the collector dropped (null snapshot — outside the authorized Org set)', async () => {
    setBackupWriter(async () => ({ backupPath: '/tmp/oh-backup-Y.json' }));
    const deleteWorkspace = vi.fn(async () => undefined);
    const result = await orchestrateDiscardWithBackup({
      workspaces: [
        { id: WS_A, name: 'Alpha' },
        { id: WS_B, name: 'Beta' },
      ],
      // WS_B is outside the authorized Org set — buildSnapshot returns null,
      // the collector drops it from the archive. It must NOT be deleted:
      // deleting an un-backed-up workspace is unrecoverable data loss.
      buildSnapshot: async (id) => (id === WS_B ? null : makeSnapshot(id)),
      deleteWorkspace,
      now: () => FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.discardedWorkspaces).toEqual([
      { workspaceId: WS_A, workspaceName: 'Alpha', entityCount: 0 },
    ]);
    expect(deleteWorkspace).toHaveBeenCalledTimes(1);
    expect(deleteWorkspace).toHaveBeenCalledWith(WS_A);
  });

  it('returns delete-failed with the preserved backupPath when a delete rejects mid-loop', async () => {
    setBackupWriter(async () => ({ backupPath: '/tmp/oh-backup-X.json' }));
    const deleteWorkspace = vi
      .fn<(id: string) => Promise<unknown>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('mutator-rejected'));
    const result = await orchestrateDiscardWithBackup({
      workspaces: [
        { id: WS_A, name: 'Alpha' },
        { id: WS_B, name: 'Beta' },
      ],
      buildSnapshot: async (id) => makeSnapshot(id),
      deleteWorkspace,
      now: () => FIXED_NOW,
    });
    expect(result).toMatchObject({
      ok: false,
      reason: 'delete-failed',
      backupPath: '/tmp/oh-backup-X.json',
    });
    if (result.ok) return;
    expect(result.detail).toContain('Beta');
    expect(result.detail).toContain('mutator-rejected');
    expect(deleteWorkspace).toHaveBeenCalledTimes(2);
  });
});

describe('executeDiscard (renderer bridge wrapper)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the bridge response on success', async () => {
    const { executeDiscard } = await import('@openheaders/ui/shared/mode-switch');
    const stub: DiscardResult = {
      ok: true,
      backupPath: '/tmp/x.json',
      discardedWorkspaces: [],
    };
    const result = await executeDiscard({ bridgeCall: async () => stub });
    expect(result).toBe(stub);
  });

  it('folds bridge rejections into backup-writer-unavailable', async () => {
    const { executeDiscard } = await import('@openheaders/ui/shared/mode-switch');
    const result = await executeDiscard({
      bridgeCall: () => Promise.reject(new Error('ipc-down')),
    });
    expect(result).toMatchObject({ ok: false, reason: 'backup-writer-unavailable' });
    if (result.ok) return;
    expect(result.detail).toBe('ipc-down');
  });

  it('coerces non-Error throws into a string detail', async () => {
    const { executeDiscard } = await import('@openheaders/ui/shared/mode-switch');
    const result = await executeDiscard({
      bridgeCall: () => Promise.reject('nope'),
    });
    expect(result).toMatchObject({
      ok: false,
      reason: 'backup-writer-unavailable',
      detail: 'nope',
    });
  });
});

describe('summarizeDiscard toast copy', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('success copy quotes the backup path + the active back-end label', async () => {
    const { summarizeDiscardSuccess } = await import('@openheaders/ui/shared/mode-switch');
    const copy = summarizeDiscardSuccess(
      {
        ok: true,
        backupPath: '/tmp/oh-backup-1.json',
        discardedWorkspaces: [
          { workspaceId: WS_A, workspaceName: 'Alpha', entityCount: 5 },
          { workspaceId: WS_B, workspaceName: 'Beta', entityCount: 7 },
        ],
      },
      'Desktop Application',
    );
    expect(copy).toContain('2 workspaces');
    expect(copy).toContain('12 items');
    expect(copy).toContain('/tmp/oh-backup-1.json');
    expect(copy).toContain('Desktop Application');
  });

  it('success copy omits the entity-count fragment when nothing user-content was retired', async () => {
    const { summarizeDiscardSuccess } = await import('@openheaders/ui/shared/mode-switch');
    const copy = summarizeDiscardSuccess(
      {
        ok: true,
        backupPath: '/tmp/p.json',
        discardedWorkspaces: [{ workspaceId: WS_A, workspaceName: 'Alpha', entityCount: 0 }],
      },
      'Desktop',
    );
    expect(copy).toContain('1 workspace');
    expect(copy).not.toContain('items');
    expect(copy).not.toContain('item)');
  });

  it('renders a distinct line per failure reason and mentions data safety where applicable', async () => {
    const { summarizeDiscardFailure } = await import('@openheaders/ui/shared/mode-switch');
    expect(summarizeDiscardFailure({ ok: false, reason: 'backup-writer-unavailable' })).toContain(
      'intact',
    );
    expect(summarizeDiscardFailure({ ok: false, reason: 'no-source-data' })).toContain(
      'No source data',
    );
    expect(summarizeDiscardFailure({ ok: false, reason: 'backup-failed' })).toContain('intact');
    expect(
      summarizeDiscardFailure({
        ok: false,
        reason: 'delete-failed',
        backupPath: '/tmp/oh-backup-Z.json',
      }),
    ).toContain('/tmp/oh-backup-Z.json');
  });
});
