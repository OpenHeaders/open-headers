/**
 * Phase 10 template-store coverage — version stamping + stale-draft
 * rejection + Web Lock serialization. Follows the same recipe as the
 * rule / environment / request tests.
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
  getActiveWorkspaceId: vi.fn(() => 'ws-tpltest1'),
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

let store: typeof import('@/background/modules/template-store');

beforeEach(async () => {
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  store = await import('@/background/modules/template-store');
  await store.switchToWorkspace('ws-tpltest1');
});

afterEach(() => {
  setLockRuntime(null);
});

function seedTemplate(name = 'T'): string {
  const coll = store.ensureDefaultTemplateCollection();
  const tpl = store.addTemplateToCollection(
    {
      name,
      ruleType: 'header',
      icon: 'api',
      description: 'test',
      includes: { conditions: true, formValues: true },
      conditions: [],
      formValues: {},
      createdAt: '2026-04-19T00:00:00Z',
      updatedAt: '2026-04-19T00:00:00Z',
    } as Parameters<typeof store.addTemplateToCollection>[0],
    coll.uid,
  );
  return tpl.uid;
}

describe('template-store — version stamping', () => {
  it('addTemplate stamps version: 1', () => {
    const uid = seedTemplate();
    const tpl = store.getTemplates().find((t) => t.uid === uid);
    expect(tpl?.version).toBe(1);
  });

  it('updateTemplate increments version', async () => {
    const uid = seedTemplate();
    const r = await store.updateTemplate(uid, { name: 'T2' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
  });
});

describe('template-store — stale-draft rejection', () => {
  it('accepts matching expectedVersion', async () => {
    const uid = seedTemplate();
    const r = await store.updateTemplate(uid, { name: 'T2' }, { expectedVersion: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
  });

  it('rejects stale expectedVersion with server copy', async () => {
    const uid = seedTemplate();
    await store.updateTemplate(uid, { name: 'A' });
    const r = await store.updateTemplate(uid, { name: 'B' }, { expectedVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'stale-draft') {
      expect(r.serverVersion).toBe(2);
      expect(r.serverTemplate.name).toBe('A');
    } else {
      throw new Error('expected stale-draft');
    }
  });

  it('returns not-found when the template was deleted', async () => {
    const uid = seedTemplate();
    await store.deleteTemplate(uid);
    const r = await store.updateTemplate(uid, { name: 'ghost' }, { expectedVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-found');
  });
});

describe('template-store — concurrent save race', () => {
  it('concurrent saves — one wins, one stale-drafts', async () => {
    const uid = seedTemplate();
    const [a, b] = await Promise.all([
      store.updateTemplate(uid, { name: 'A' }, { expectedVersion: 1 }),
      store.updateTemplate(uid, { name: 'B' }, { expectedVersion: 1 }),
    ]);
    const winners = [a, b].filter((r) => r.ok);
    const losers = [a, b].filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const finalTpl = store.getTemplates().find((t) => t.uid === uid);
    expect(finalTpl?.version).toBe(2);
  });
});
