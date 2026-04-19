/**
 * Phase 10 coverage for the workspace-scoped singletons in
 * environment-store: `setWorkspaceVariables` and `setVault`. Both are
 * per-workspace blobs (one instance each) rather than multi-entity
 * stores, so the contract is a simplified `RuleWriteResult`:
 * `ok: true | stale-draft` — there's no "not-found" case.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The mocked storage closure persists across `vi.resetModules()`, so
// we hoist `blobs` to module scope (via `vi.hoisted`) and clear it in
// `beforeEach` — otherwise each test inherits the previous test's
// saved version counters and the singleton-store increments pile up.
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

vi.mock('@/background/modules/workspace-store', () => ({
  getActiveWorkspaceId: vi.fn(() => 'ws-singleton'),
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

let store: typeof import('@/background/modules/environment-store');

beforeEach(async () => {
  blobs.clear();
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  store = await import('@/background/modules/environment-store');
  await store.hydrateEnvironmentsFromStorage();
});

afterEach(() => {
  setLockRuntime(null);
});

describe('workspace-vars — version stamping + stale-draft', () => {
  it('hydrates with version: 1 as a fresh default', () => {
    expect(store.getWorkspaceVariables().version).toBe(1);
  });

  it('setWorkspaceVariables increments version and returns the new value', async () => {
    const r = await store.setWorkspaceVariables({ variables: [{ name: 'X', value: '1', type: 'default' }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
    expect(store.getWorkspaceVariables().version).toBe(2);
  });

  it('rejects stale expectedVersion with server copy', async () => {
    await store.setWorkspaceVariables({ variables: [{ name: 'A', value: '1', type: 'default' }] });
    const r = await store.setWorkspaceVariables(
      { variables: [{ name: 'B', value: '2', type: 'default' }] },
      { expectedVersion: 1 },
    );
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'stale-draft') {
      expect(r.serverVersion).toBe(2);
      expect(r.serverWorkspaceVariables.variables[0]?.name).toBe('A');
    } else {
      throw new Error('expected stale-draft');
    }
  });

  it('concurrent setWorkspaceVariables — one wins, one stale-drafts', async () => {
    const [a, b] = await Promise.all([
      store.setWorkspaceVariables({ variables: [{ name: 'A', value: '1', type: 'default' }] }, { expectedVersion: 1 }),
      store.setWorkspaceVariables({ variables: [{ name: 'B', value: '2', type: 'default' }] }, { expectedVersion: 1 }),
    ]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect([a, b].filter((r) => !r.ok)).toHaveLength(1);
    expect(store.getWorkspaceVariables().version).toBe(2);
  });
});

describe('vault — version stamping + stale-draft', () => {
  it('hydrates with version: 1 as a fresh default', () => {
    expect(store.getVault().version).toBe(1);
  });

  it('setVault increments version', async () => {
    const r = await store.setVault({ secrets: [{ name: 'TOKEN', value: 'abc' }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
  });

  it('rejects stale expectedVersion with server copy', async () => {
    await store.setVault({ secrets: [{ name: 'A', value: '1' }] });
    const r = await store.setVault({ secrets: [{ name: 'B', value: '2' }] }, { expectedVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'stale-draft') {
      expect(r.serverVersion).toBe(2);
      expect(r.serverVault.secrets[0]?.name).toBe('A');
    } else {
      throw new Error('expected stale-draft');
    }
  });
});
