/**
 * Phase 10 environment-store coverage — version stamping +
 * stale-draft rejection + Web Lock serialization. Parallels
 * `rule-store-version.test.ts` since the contract is identical;
 * rename / updateEnvironmentVariables / deleteEnvironment all wrap
 * the store's in-memory mutation + storage write in `withLock`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  getActiveWorkspaceId: vi.fn(() => 'ws-envtest1'),
}));

vi.mock('@/shared/storage', async () => {
  const actual = await vi.importActual<typeof import('@/shared/storage')>('@/shared/storage');
  const blobs: Record<string, unknown> = {};
  return {
    ...actual,
    extensionStorage: {
      get: vi.fn(async (key: { name: string }) => blobs[key.name]),
      set: vi.fn(async (key: { name: string }, value: unknown) => {
        blobs[key.name] = value;
      }),
      remove: vi.fn(async (key: { name: string }) => {
        delete blobs[key.name];
      }),
      getValidatedArray: vi.fn(async (key: { name: string }) => {
        const raw = blobs[key.name];
        return Array.isArray(raw) ? raw : [];
      }),
      getValidated: vi.fn(async (key: { name: string }) => blobs[key.name] ?? null),
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
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  store = await import('@/background/modules/environment-store');
  await store.hydrateEnvironmentsFromStorage();
});

afterEach(() => {
  setLockRuntime(null);
});

describe('environment-store — version stamping', () => {
  it('createEnvironment stamps version: 1', () => {
    const env = store.createEnvironment('staging', []);
    expect(env.version).toBe(1);
  });

  it('renameEnvironment increments version', async () => {
    const env = store.createEnvironment('staging', []);
    const r = await store.renameEnvironment(env.uid, 'prod');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe(2);
      expect(r.environment.name).toBe('prod');
    }
  });

  it('updateEnvironmentVariables increments version', async () => {
    const env = store.createEnvironment('dev', []);
    const r = await store.updateEnvironmentVariables(env.uid, [{ name: 'X', value: 'y', type: 'default' }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
  });
});

describe('environment-store — stale-draft rejection', () => {
  it('accepts matching expectedVersion', async () => {
    const env = store.createEnvironment('e1', []);
    const r = await store.updateEnvironmentVariables(env.uid, [{ name: 'FOO', value: '1', type: 'default' }], {
      expectedVersion: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
  });

  it('rejects stale expectedVersion with the server copy', async () => {
    const env = store.createEnvironment('e2', []);
    // Tab A wins.
    await store.updateEnvironmentVariables(env.uid, [{ name: 'A', value: '1', type: 'default' }]);
    // Tab B still on version=1.
    const r = await store.updateEnvironmentVariables(env.uid, [{ name: 'B', value: '2', type: 'default' }], {
      expectedVersion: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'stale-draft') {
      expect(r.serverVersion).toBe(2);
      expect(r.serverEnvironment.variables[0]?.name).toBe('A');
    } else {
      throw new Error('expected stale-draft');
    }
  });

  it('returns not-found when the env was deleted', async () => {
    const env = store.createEnvironment('ghost', []);
    await store.deleteEnvironment(env.uid);
    const r = await store.updateEnvironmentVariables(env.uid, [], { expectedVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-found');
  });
});

describe('environment-store — concurrent save race', () => {
  it('concurrent saves with the same expectedVersion — one wins, one stale-drafts', async () => {
    const env = store.createEnvironment('race', []);
    const [a, b] = await Promise.all([
      store.updateEnvironmentVariables(env.uid, [{ name: 'A', value: '1', type: 'default' }], { expectedVersion: 1 }),
      store.updateEnvironmentVariables(env.uid, [{ name: 'B', value: '2', type: 'default' }], { expectedVersion: 1 }),
    ]);
    const winners = [a, b].filter((r) => r.ok);
    const losers = [a, b].filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const loser = losers[0];
    if (!loser.ok) expect(loser.reason).toBe('stale-draft');
    const final = store.getEnvironments().find((e) => e.uid === env.uid);
    expect(final?.version).toBe(2);
  });

  it('rename and variable-update race on the same env serialize through the same lock', async () => {
    const env = store.createEnvironment('serial', []);
    const [a, b] = await Promise.all([
      store.renameEnvironment(env.uid, 'renamed'),
      store.updateEnvironmentVariables(env.uid, [{ name: 'X', value: 'y', type: 'default' }]),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // Both writes land. Final version is exactly 3 (create=1, two
    // serialized updates bump to 2 then 3). If the writes weren't
    // serialized, the version counter would collide and produce 2.
    const final = store.getEnvironments().find((e) => e.uid === env.uid);
    expect(final?.version).toBe(3);
  });
});
