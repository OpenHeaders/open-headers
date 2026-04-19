/**
 * Phase 10 request-store coverage — version stamping + stale-draft
 * rejection + Web Lock serialization. Parallels the rule / environment
 * tests; the contract is identical — `updateRequest` wraps its
 * read-modify-write in `withLock(entityLockName(ws, 'request', uid))`.
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
  getActiveWorkspaceId: vi.fn(() => 'ws-reqtest1'),
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

let store: typeof import('@/background/modules/request-store');

beforeEach(async () => {
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  store = await import('@/background/modules/request-store');
  await store.switchToWorkspace('ws-reqtest1');
});

afterEach(() => {
  setLockRuntime(null);
});

function seed(name = 'R'): string {
  const coll = store.ensureDefaultRequestCollection();
  return store.addRequestToCollection(name, coll.uid).uid;
}

describe('request-store — version stamping', () => {
  it('addRequest stamps version: 1', () => {
    const uid = seed();
    const req = store.getRequests().find((r) => r.uid === uid);
    expect(req?.version).toBe(1);
  });

  it('updateRequest increments version', async () => {
    const uid = seed();
    const r = await store.updateRequest(uid, { name: 'R2' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
  });
});

describe('request-store — stale-draft rejection', () => {
  it('accepts matching expectedVersion', async () => {
    const uid = seed();
    const r = await store.updateRequest(uid, { url: 'https://x' }, { expectedVersion: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
  });

  it('rejects stale expectedVersion with server copy', async () => {
    const uid = seed();
    await store.updateRequest(uid, { name: 'A' });
    const r = await store.updateRequest(uid, { name: 'B' }, { expectedVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'stale-draft') {
      expect(r.serverVersion).toBe(2);
      expect(r.serverRequest.name).toBe('A');
    } else {
      throw new Error('expected stale-draft');
    }
  });

  it('returns not-found when the request was deleted', async () => {
    const uid = seed();
    await store.deleteRequest(uid);
    const r = await store.updateRequest(uid, { name: 'ghost' }, { expectedVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-found');
  });
});

describe('request-store — concurrent save race', () => {
  it('concurrent saves with the same expectedVersion — one wins, one stale-drafts', async () => {
    const uid = seed();
    const [a, b] = await Promise.all([
      store.updateRequest(uid, { name: 'A' }, { expectedVersion: 1 }),
      store.updateRequest(uid, { name: 'B' }, { expectedVersion: 1 }),
    ]);
    const winners = [a, b].filter((r) => r.ok);
    const losers = [a, b].filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const loser = losers[0];
    if (!loser.ok) expect(loser.reason).toBe('stale-draft');
    const finalReq = store.getRequests().find((r) => r.uid === uid);
    expect(finalReq?.version).toBe(2);
  });
});
