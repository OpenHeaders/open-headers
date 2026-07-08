/**
 * Discard-removal sequencing — `orchestrateDiscardRemoval`.
 *
 * Pins the load-bearing order of the bound-record remove flow:
 *   - every workspace is backed up BEFORE any destructive step;
 *   - a failed backup aborts with the record and workspaces intact;
 *   - the backend record is removed BEFORE the workspace deletes, so
 *     the delete mutations run against unbound Orgs and can never
 *     forward to the still-running back-end;
 *   - a failed delete is reported, never silently swallowed.
 */

import { orchestrateDiscardRemoval } from '@openheaders/ui/workbench/settings/components/backend-remove-flow';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACES = [
  { id: 'ws-a', name: 'API openheaders.io' },
  { id: 'ws-b', name: 'Staging openheaders.io' },
];

function createDeps(overrides: Partial<Parameters<typeof orchestrateDiscardRemoval>[0]> = {}) {
  const calls: string[] = [];
  const deps = {
    workspaces: WORKSPACES,
    backupWorkspace: vi.fn(async (w: { id: string; name: string }) => {
      calls.push(`backup:${w.id}`);
      return true;
    }),
    removeBackend: vi.fn(async () => {
      calls.push('removeBackend');
    }),
    deleteWorkspace: vi.fn(async (id: string) => {
      calls.push(`delete:${id}`);
      return { success: true };
    }),
    onProgress: () => undefined,
    ...overrides,
  };
  return { deps, calls };
}

describe('orchestrateDiscardRemoval', () => {
  it('backs up everything, then removes the record, then deletes locally — in that order', async () => {
    const { deps, calls } = createDeps();

    const result = await orchestrateDiscardRemoval(deps);

    expect(result).toEqual({ ok: true, failedDeletes: [] });
    expect(calls).toEqual(['backup:ws-a', 'backup:ws-b', 'removeBackend', 'delete:ws-a', 'delete:ws-b']);
  });

  it('a failed backup aborts before any destructive step', async () => {
    const { deps, calls } = createDeps();
    deps.backupWorkspace = vi.fn(async (w: { id: string; name: string }) => {
      calls.push(`backup:${w.id}`);
      return w.id !== 'ws-b';
    });

    const result = await orchestrateDiscardRemoval(deps);

    expect(result).toEqual({ ok: false, aborted: 'backup' });
    expect(calls).toEqual(['backup:ws-a', 'backup:ws-b']);
    expect(deps.removeBackend).not.toHaveBeenCalled();
    expect(deps.deleteWorkspace).not.toHaveBeenCalled();
  });

  it('reports failed deletes by workspace name', async () => {
    const { deps } = createDeps();
    deps.deleteWorkspace = vi.fn(async (id: string) => ({ success: id !== 'ws-b' }));

    const result = await orchestrateDiscardRemoval(deps);

    expect(result).toEqual({ ok: true, failedDeletes: ['Staging openheaders.io'] });
  });

  it('an empty Org subset still removes the record', async () => {
    const { deps, calls } = createDeps({ workspaces: [] });

    const result = await orchestrateDiscardRemoval(deps);

    expect(result).toEqual({ ok: true, failedDeletes: [] });
    expect(calls).toEqual(['removeBackend']);
  });
});
