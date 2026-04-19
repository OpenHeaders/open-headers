/**
 * Phase 10 coverage for workspace metadata versioning. The
 * WorkspaceManager rename dialog sends `expectedVersion` with every
 * save so a concurrent rename from another tab is rejected with the
 * server copy — ARCHITECTURE.md §13's "modified in another tab"
 * prompt.
 *
 * The workspace-store uses a shared `workspace-meta` lock family:
 *   - `entityLockName('global', 'workspace-meta', <id>)` for
 *     per-workspace writes (update / delete)
 *   - `entityLockName('global', 'workspace-meta', 'list')` for
 *     list-level mutations (create / reorder)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { blobs } = vi.hoisted(() => ({ blobs: new Map<string, unknown>() }));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: vi.fn(),
  hydrateObservabilityLog: vi.fn(async () => undefined),
  getObservabilityLog: vi.fn(() => []),
  clearObservabilityLog: vi.fn(),
}));

vi.mock('@/background/modules/storage-drift', () => ({
  driftRecorder: () => () => {},
}));

vi.mock('@/shared/storage', async () => {
  const actual = await vi.importActual<typeof import('@/shared/storage')>('@/shared/storage');
  return {
    ...actual,
    extensionStorage: {
      get: vi.fn(async (key: { name: string }) => blobs.get(key.name)),
      set: vi.fn(async (key: { name: string }, value: unknown) => {
        blobs.set(key.name, value);
      }),
      remove: vi.fn(async (key: { name: string }) => {
        blobs.delete(key.name);
      }),
      getValidated: vi.fn(async (key: { name: string }) => blobs.get(key.name) ?? null),
      getValidatedArray: vi.fn(async (key: { name: string }) => {
        const raw = blobs.get(key.name);
        return Array.isArray(raw) ? raw : [];
      }),
    },
  };
});

import { setLockRuntime } from '@/shared/coordination/with-lock';

class FifoLockRuntime {
  private queues = new Map<string, Array<() => void>>();
  private holders = new Set<string>();
  async request<T>(name: string, _options: unknown, callback: () => Promise<T> | T): Promise<T> {
    if (this.holders.has(name)) {
      await new Promise<void>((resolve) => {
        const q = this.queues.get(name) ?? [];
        q.push(resolve);
        this.queues.set(name, q);
      });
    }
    this.holders.add(name);
    try {
      return await callback();
    } finally {
      this.holders.delete(name);
      const q = this.queues.get(name);
      if (q && q.length > 0) q.shift()!();
    }
  }
}

let store: typeof import('@/background/modules/workspace-store');

beforeEach(async () => {
  blobs.clear();
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  store = await import('@/background/modules/workspace-store');
  await store.bootstrap(); // seeds a default workspace with version 1
});

afterEach(() => {
  setLockRuntime(null);
});

describe('workspace-store — version stamping', () => {
  it('seeded default workspace stamps version: 1', () => {
    const [first] = store.listWorkspaces();
    expect(first.version).toBe(1);
  });

  it('createWorkspace stamps version: 1', async () => {
    const created = await store.createWorkspace({ name: 'Another' });
    expect(created.version).toBe(1);
  });

  it('updateWorkspace bumps version + returns the new record', async () => {
    const [w] = store.listWorkspaces();
    const r = await store.updateWorkspace(w.id, { name: 'Renamed' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe(2);
      expect(r.workspace.name).toBe('Renamed');
    }
  });

  it('reorderWorkspaces bumps version on every touched workspace', async () => {
    const a = await store.createWorkspace({ name: 'A' });
    const b = await store.createWorkspace({ name: 'B' });
    await store.reorderWorkspaces([b.id, a.id]);
    const list = store.listWorkspaces();
    const aAfter = list.find((w) => w.id === a.id);
    const bAfter = list.find((w) => w.id === b.id);
    // Both touched → both advanced from 1 to 2.
    expect(aAfter?.version).toBe(2);
    expect(bAfter?.version).toBe(2);
  });
});

describe('workspace-store — stale-draft rejection', () => {
  it('accepts matching expectedVersion', async () => {
    const [w] = store.listWorkspaces();
    const r = await store.updateWorkspace(w.id, { name: 'A' }, { expectedVersion: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
  });

  it('rejects stale expectedVersion with server copy', async () => {
    const [w] = store.listWorkspaces();
    // Tab A saves → version 2.
    await store.updateWorkspace(w.id, { name: 'A' });
    // Tab B thinks it's still on v1 — rejected.
    const r = await store.updateWorkspace(w.id, { name: 'B' }, { expectedVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'stale-draft') {
      expect(r.serverVersion).toBe(2);
      expect(r.serverWorkspace.name).toBe('A');
    } else {
      throw new Error('expected stale-draft');
    }
  });

  it('returns not-found for unknown id', async () => {
    const r = await store.updateWorkspace('missing00', { name: 'x' }, { expectedVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-found');
  });

  it('two concurrent updates — one wins, one stale-drafts', async () => {
    const [w] = store.listWorkspaces();
    const [a, b] = await Promise.all([
      store.updateWorkspace(w.id, { name: 'A' }, { expectedVersion: 1 }),
      store.updateWorkspace(w.id, { name: 'B' }, { expectedVersion: 1 }),
    ]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect([a, b].filter((r) => !r.ok)).toHaveLength(1);
    const final = store.listWorkspaces().find((x) => x.id === w.id);
    expect(final?.version).toBe(2);
  });
});

describe('workspace-store — lock serialization', () => {
  it('concurrent update + delete serialize through the same per-workspace lock', async () => {
    const a = await store.createWorkspace({ name: 'A' });
    // Rename + delete concurrently on the same workspace id.
    const [updated, deletedId] = await Promise.all([
      store.updateWorkspace(a.id, { name: 'A2' }),
      store.deleteWorkspace(a.id),
    ]);
    // The deletion returns the new active workspace id (not null for
    // the surviving default); the update either lands (if lock ordering
    // put it first) or not-found (if delete won the lock race).
    expect(deletedId).not.toBeNull();
    if (!updated.ok) {
      expect(updated.reason).toBe('not-found');
    }
  });
});
