/**
 * Phase U5.4 — mode-switch Use-Target orchestrator.
 *
 * Pins `orchestrateUseTarget`: the "use the target's data only" arm of
 * the Phase U5 mode-switch model. Use-Target retires THIS host's own
 * workspaces (backup-then-delete) while keeping the target's
 * synced-down workspaces intact — it is a Discard restricted to the
 * non-target-Org subset, delegating to the proven discard sequence.
 */

import type { WorkspaceSnapshot } from '@openheaders/core/protocol';
import type { DiscardBackupArchive } from '@openheaders/core/sync';
import { orchestrateUseTarget, setBackupWriter } from '@openheaders/oracle/sync';
import { afterEach, describe, expect, it, vi } from 'vitest';

const HOME_ORG = '0193a8ff-c000-7000-8000-0000000000a0';
const TARGET_ORG = '0193a8ff-c000-7000-8000-0000000000b0';
const FIXED_NOW = '2026-05-20T12:00:00.000Z';

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
    liveValues: [],
    liveFallbackPriority: [],
    oauthBundles: [],
    pauseMarkers: [],
    layoutState: [],
    files: [],
  };
}

describe('orchestrateUseTarget', () => {
  afterEach(() => {
    setBackupWriter(null);
  });

  it('retires only this host own workspaces, keeping the target Org workspaces', async () => {
    const writer = vi.fn(async (_archive: DiscardBackupArchive) => ({ backupPath: '/tmp/oh-use-target.json' }));
    setBackupWriter(writer);
    const deleteWorkspace = vi.fn(async () => undefined);

    const result = await orchestrateUseTarget({
      targetOrgId: TARGET_ORG,
      workspaces: [
        { id: 'ws-own', name: 'Mine', orgId: HOME_ORG },
        { id: 'ws-synced', name: 'Theirs', orgId: TARGET_ORG },
      ],
      buildSnapshot: async (id) => makeSnapshot(id),
      deleteWorkspace,
      now: () => FIXED_NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.discardedWorkspaces).toEqual([{ workspaceId: 'ws-own', workspaceName: 'Mine', entityCount: 0 }]);
    // The target's synced-down workspace is never archived or deleted.
    expect(deleteWorkspace.mock.calls).toEqual([['ws-own']]);
    expect(writer.mock.calls[0][0].workspaces.map((w) => w.workspaceId)).toEqual(['ws-own']);
  });

  it('returns no-source-data when every workspace is already on the target', async () => {
    setBackupWriter(vi.fn(async () => ({ backupPath: '/tmp/x.json' })));
    const deleteWorkspace = vi.fn(async () => undefined);

    const result = await orchestrateUseTarget({
      targetOrgId: TARGET_ORG,
      workspaces: [{ id: 'ws-synced', name: 'Theirs', orgId: TARGET_ORG }],
      buildSnapshot: async (id) => makeSnapshot(id),
      deleteWorkspace,
      now: () => FIXED_NOW,
    });

    expect(result).toEqual({ ok: false, reason: 'no-source-data' });
    expect(deleteWorkspace).not.toHaveBeenCalled();
  });

  it('refuses with backup-writer-unavailable when no writer is installed', async () => {
    const deleteWorkspace = vi.fn(async () => undefined);
    const result = await orchestrateUseTarget({
      targetOrgId: TARGET_ORG,
      workspaces: [{ id: 'ws-own', name: 'Mine', orgId: HOME_ORG }],
      buildSnapshot: async (id) => makeSnapshot(id),
      deleteWorkspace,
      now: () => FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('backup-writer-unavailable');
    expect(deleteWorkspace).not.toHaveBeenCalled();
  });
});
