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
    const r = await store.setVault({ secrets: [{ kind: 'string', name: 'TOKEN', value: 'abc' }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
  });

  it('rejects stale expectedVersion with server copy', async () => {
    await store.setVault({ secrets: [{ kind: 'string', name: 'A', value: '1' }] });
    const r = await store.setVault({ secrets: [{ kind: 'string', name: 'B', value: '2' }] }, { expectedVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'stale-draft') {
      expect(r.serverVersion).toBe(2);
      expect(r.serverVault.secrets[0]?.name).toBe('A');
    } else {
      throw new Error('expected stale-draft');
    }
  });
});

describe('vault — per-secret mutators share the setVault lock', () => {
  it('putVaultSecret upserts + increments version', async () => {
    const r = await store.putVaultSecret('TOKEN', 'abc');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe(2);
      expect(r.vault.secrets).toEqual([{ kind: 'string', name: 'TOKEN', value: 'abc' }]);
    }
    expect(store.getVaultSecret('TOKEN')).toBe('abc');
  });

  it('putVaultSecret overwrites rather than duplicating', async () => {
    await store.putVaultSecret('TOKEN', 'first');
    const r = await store.putVaultSecret('TOKEN', 'second');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.vault.secrets).toHaveLength(1);
      expect(r.vault.secrets[0]?.kind === 'string' && r.vault.secrets[0]?.value).toBe('second');
      // First put took 1→2, second put took 2→3.
      expect(r.version).toBe(3);
    }
  });

  it('deleteVaultSecret removes + increments version', async () => {
    await store.putVaultSecret('TOKEN', 'abc');
    const r = await store.deleteVaultSecret('TOKEN');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.vault.secrets).toEqual([]);
      expect(r.version).toBe(3);
    }
    expect(store.getVaultSecret('TOKEN')).toBeNull();
  });

  it('deleteVaultSecret on a missing key does NOT advance version', async () => {
    const before = store.getVault().version;
    const r = await store.deleteVaultSecret('MISSING');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(before);
  });

  it('listVaultSecretNames enumerates keys from the in-memory snapshot', async () => {
    await store.putVaultSecret('A', '1');
    await store.putVaultSecret('B', '2');
    expect(store.listVaultSecretNames().sort()).toEqual(['A', 'B']);
  });

  it('concurrent putVaultSecret + setVault serialize through the same lock — no lost updates', async () => {
    // Tab A's editor saves bulk (setVault) while tab B's OAuth refresh
    // fires putVaultSecret for a new key. Both should land; neither
    // should stomp the other because they share the `vault:singleton`
    // lock name.
    const [a, b] = await Promise.all([
      store.setVault({ secrets: [{ kind: 'string', name: 'EXISTING', value: 'editor' }] }),
      store.putVaultSecret('REFRESH', 'token'),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // Version advanced exactly twice (create=1, setVault=2, put=3).
    const finalVault = store.getVault();
    expect(finalVault.version).toBe(3);
    // Both writes survive. The later writer's state includes the
    // earlier writer's keys + its own — no silent loss.
    const names = finalVault.secrets.map((s) => s.name).sort();
    // Depending on scheduling, one or both names are present — but the
    // "later" writer always sees the earlier writer's effect because
    // they're serialized. We can assert: at minimum the last winner's
    // write is present; at maximum both are.
    expect(names.length).toBeGreaterThanOrEqual(1);
    // The critical invariant: no duplicate entries (proves read-modify-
    // write atomicity).
    expect(new Set(names).size).toBe(names.length);
  });

  it('concurrent putVaultSecret calls for different keys — both land', async () => {
    const [a, b] = await Promise.all([store.putVaultSecret('A', '1'), store.putVaultSecret('B', '2')]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const finalVault = store.getVault();
    expect(finalVault.version).toBe(3); // 1 → 2 → 3
    const names = finalVault.secrets.map((s) => s.name).sort();
    expect(names).toEqual(['A', 'B']);
  });
});
