/**
 * Phase 10 coverage for the rule-store's version counter + stale-draft
 * rejection + Web Lock wrapping. Exercises the specific contract the
 * bridge exposes as `updateLocalRule`.
 *
 * We use the deterministic FIFO lock runtime from `with-lock.ts` via
 * `setLockRuntime` so the test locally reproduces Web Locks semantics
 * (one holder per name, FIFO among waiters) without needing a browser.
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
  getActiveWorkspaceId: vi.fn(() => 'ws-test0001'),
}));

vi.mock('@/shared/storage', async () => {
  const actual = await vi.importActual<typeof import('@/shared/storage')>('@/shared/storage');
  // In-memory store so persistence is synchronous + inspectable.
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
      // Needed by `readWorkspaceSnapshot`. We return whatever's in
      // the in-memory blob map as an array; this path is only hit on
      // the initial `switchToWorkspace` call which loads an empty
      // store (no seeded blobs).
      getValidatedArray: vi.fn(async (key: { name: string }) => {
        const raw = blobs[key.name];
        return Array.isArray(raw) ? raw : [];
      }),
    },
  };
});

import { setLockRuntime } from '@/shared/coordination/with-lock';

// Local FIFO runtime — same shape as tests/unit/with-lock.test.ts.
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
      if (q && q.length > 0) {
        const next = q.shift()!;
        next();
      }
    }
  }
}

let store: typeof import('@/background/modules/rule-store');

beforeEach(async () => {
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  store = await import('@/background/modules/rule-store');
  // Prime the store with an empty snapshot for the mocked
  // workspace id — `switchToWorkspace` sets `loadedWorkspaceId`
  // so subsequent `assertLoaded()` calls don't throw.
  await store.switchToWorkspace('ws-test0001');
});

afterEach(() => {
  setLockRuntime(null);
});

const COLLECTION_UID = 'col0a1b2';

async function seedRule(name = 'R'): Promise<string> {
  const coll = store.ensureDefaultCollection();
  const rule = store.addRuleToCollection(
    {
      name,
      type: 'header',
      enabled: true,
      conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'Authorization', value: 'X' }],
        responseHeaders: [],
      },
    } as Parameters<typeof store.addRuleToCollection>[0],
    coll.uid,
  );
  void COLLECTION_UID; // reserved for future collection-scoped tests
  return rule.uid;
}

describe('rule-store — version stamping', () => {
  it('addRule stamps version: 1 on creation', async () => {
    const uid = await seedRule();
    const rule = store.getRules().find((r) => r.uid === uid);
    expect(rule?.version).toBe(1);
  });

  it('updateRule increments version on each save', async () => {
    const uid = await seedRule();
    const r1 = await store.updateRule(uid, { name: 'R2' });
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.version).toBe(2);
    const r2 = await store.updateRule(uid, { name: 'R3' });
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.version).toBe(3);
  });

  it('toggleRule increments version too (even without expectedVersion)', async () => {
    const uid = await seedRule();
    const ok = await store.toggleRule(uid, false);
    expect(ok).toBe(true);
    const rule = store.getRules().find((r) => r.uid === uid);
    expect(rule?.version).toBe(2);
    expect(rule?.enabled).toBe(false);
  });
});

describe('rule-store — stale-draft rejection', () => {
  it('accepts matching expectedVersion', async () => {
    const uid = await seedRule();
    const result = await store.updateRule(uid, { name: 'R2' }, { expectedVersion: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.version).toBe(2);
  });

  it('rejects with stale-draft when expectedVersion is behind', async () => {
    const uid = await seedRule();
    // Tab A saves → version becomes 2.
    await store.updateRule(uid, { name: 'A' });
    // Tab B still thinks it's on version 1; its save must be rejected.
    const result = await store.updateRule(uid, { name: 'B' }, { expectedVersion: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'stale-draft') {
      expect(result.serverVersion).toBe(2);
      expect(result.serverRule.name).toBe('A'); // Tab A's write survives
    } else {
      throw new Error('expected stale-draft rejection');
    }
  });

  it('omitted expectedVersion disables the check (legacy last-write-wins)', async () => {
    const uid = await seedRule();
    await store.updateRule(uid, { name: 'A' }); // version → 2
    const result = await store.updateRule(uid, { name: 'B' }); // no expectedVersion
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.version).toBe(3);
  });

  it('returns not-found when the uid was deleted', async () => {
    const uid = await seedRule();
    await store.deleteRule(uid);
    const result = await store.updateRule(uid, { name: 'ghost' }, { expectedVersion: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-found');
  });
});

describe('rule-store — concurrent save race (the fuzz-lite case)', () => {
  it('two concurrent saves with the same expectedVersion — one wins, one stale-drafts', async () => {
    const uid = await seedRule();
    // Fire both saves in the same microtask so they race the lock.
    const [a, b] = await Promise.all([
      store.updateRule(uid, { name: 'A' }, { expectedVersion: 1 }),
      store.updateRule(uid, { name: 'B' }, { expectedVersion: 1 }),
    ]);
    const winners = [a, b].filter((r) => r.ok);
    const losers = [a, b].filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const loser = losers[0];
    if (!loser.ok) expect(loser.reason).toBe('stale-draft');
    // Storage carries exactly the winner's name — lock serialized the
    // writes, no read-modify-write race.
    const finalRule = store.getRules().find((r) => r.uid === uid);
    expect(finalRule?.version).toBe(2);
    expect(['A', 'B']).toContain(finalRule?.name);
  });

  it('100 concurrent saves converge to a single winner per lock round; no lost writes', async () => {
    const uid = await seedRule();
    // Each attempt passes expectedVersion=1. The first to acquire the
    // lock wins (version → 2). The remaining 99 all observe version=2
    // and stale-draft.
    const attempts = await Promise.all(
      Array.from({ length: 100 }, (_, i) => store.updateRule(uid, { name: `attempt-${i}` }, { expectedVersion: 1 })),
    );
    const winners = attempts.filter((r) => r.ok);
    const losers = attempts.filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(99);
    expect(losers.every((r) => !r.ok && r.reason === 'stale-draft')).toBe(true);
    // Storage carries exactly one write's worth of state.
    const finalRule = store.getRules().find((r) => r.uid === uid);
    expect(finalRule?.version).toBe(2);
  });

  it('successive saves with updated expectedVersion all succeed (serialized chain)', async () => {
    const uid = await seedRule();
    // Simulates: user saves, gets version 2, saves again with
    // expectedVersion=2, etc. Each save advances the baseline.
    let current = 1;
    for (let i = 0; i < 10; i++) {
      const r = await store.updateRule(uid, { name: `save-${i}` }, { expectedVersion: current });
      expect(r.ok).toBe(true);
      if (r.ok) current = r.version;
    }
    const finalRule = store.getRules().find((r) => r.uid === uid);
    expect(finalRule?.version).toBe(11);
    expect(finalRule?.name).toBe('save-9');
  });
});
