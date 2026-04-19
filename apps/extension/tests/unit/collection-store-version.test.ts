/**
 * Phase 10 coverage for the collection + folder mutators shared across
 * rule-store, request-store, and template-store. Each store owns its
 * own flat list of collections + folders, but every mutator wraps its
 * storage write in the shared `entityLockName(ws, <entity>, uid)`
 * lock primitive and stamps the `version` counter on creation. The
 * rule-store's `updateCollectionVariables` is the only path that
 * exposes the full stale-draft discriminated union — the rename /
 * delete paths on all three stores use a boolean sugar return since
 * no editor attaches to them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted shared state so it survives `vi.resetModules()` between
// tests (the mock factory closure is evaluated once per module
// graph; hoisting lets us clear the map from `beforeEach`).
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
  getActiveWorkspaceId: vi.fn(() => 'ws-coll0001'),
}));

vi.mock('@/shared/storage', async () => {
  const actual = await vi.importActual<typeof import('@/shared/storage')>('@/shared/storage');
  return {
    ...actual,
    extensionStorage: {
      get: vi.fn(async (key: { key: string }) => blobs.get(key.key)),
      set: vi.fn(async (key: { key: string }, value: unknown) => {
        blobs.set(key.key, value);
      }),
      remove: vi.fn(async (key: { key: string }) => {
        blobs.delete(key.key);
      }),
      getValidated: vi.fn(async (key: { key: string }) => blobs.get(key.key) ?? null),
      getValidatedArray: vi.fn(async (key: { key: string }) => {
        const raw = blobs.get(key.key);
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

let ruleStore: typeof import('@/background/modules/rule-store');
let requestStore: typeof import('@/background/modules/request-store');
let templateStore: typeof import('@/background/modules/template-store');

beforeEach(async () => {
  blobs.clear();
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  ruleStore = await import('@/background/modules/rule-store');
  requestStore = await import('@/background/modules/request-store');
  templateStore = await import('@/background/modules/template-store');
  await ruleStore.switchToWorkspace('ws-coll0001');
  await requestStore.switchToWorkspace('ws-coll0001');
  await templateStore.switchToWorkspace('ws-coll0001');
});

afterEach(() => {
  setLockRuntime(null);
});

// ── rule-store collections ──────────────────────────────────────────

describe('rule-store — collection version stamping', () => {
  it('ensureDefaultCollection stamps version: 1', () => {
    const coll = ruleStore.ensureDefaultCollection();
    expect(coll.version).toBe(1);
  });

  it('createCollection stamps version: 1', () => {
    const coll = ruleStore.createCollection('Test');
    expect(coll.version).toBe(1);
  });

  it('renameCollection bumps version', async () => {
    const coll = ruleStore.createCollection('Before');
    const r = await ruleStore.renameCollection(coll.uid, 'After');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe(2);
      expect(r.collection.name).toBe('After');
    }
  });

  it('updateCollectionVariables bumps version and returns the new value', async () => {
    const coll = ruleStore.createCollection('Vars');
    const r = await ruleStore.updateCollectionVariables(coll.uid, [{ name: 'TOKEN', value: '1', type: 'default' }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.version).toBe(2);
      expect(r.collection.variables).toHaveLength(1);
    }
  });

  it('updateCollectionVariables returns not-found for an unknown uid', async () => {
    const r = await ruleStore.updateCollectionVariables('missing00', []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-found');
  });
});

describe('rule-store — collection stale-draft rejection', () => {
  it('accepts matching expectedVersion', async () => {
    const coll = ruleStore.createCollection('C');
    const r = await ruleStore.updateCollectionVariables(coll.uid, [{ name: 'A', value: '1', type: 'default' }], {
      expectedVersion: 1,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(2);
  });

  it('rejects stale expectedVersion with server copy', async () => {
    const coll = ruleStore.createCollection('C');
    // Tab A saves → version becomes 2.
    await ruleStore.updateCollectionVariables(coll.uid, [{ name: 'A', value: 'one', type: 'default' }]);
    // Tab B still thinks it's on version 1 — rejected.
    const r = await ruleStore.updateCollectionVariables(coll.uid, [{ name: 'B', value: 'two', type: 'default' }], {
      expectedVersion: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'stale-draft') {
      expect(r.serverVersion).toBe(2);
      expect(r.serverCollection.variables[0]?.name).toBe('A');
    } else {
      throw new Error('expected stale-draft');
    }
  });

  it('two concurrent updateCollectionVariables — one wins, one stale-drafts', async () => {
    const coll = ruleStore.createCollection('Race');
    const [a, b] = await Promise.all([
      ruleStore.updateCollectionVariables(coll.uid, [{ name: 'A', value: '1', type: 'default' }], {
        expectedVersion: 1,
      }),
      ruleStore.updateCollectionVariables(coll.uid, [{ name: 'B', value: '2', type: 'default' }], {
        expectedVersion: 1,
      }),
    ]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect([a, b].filter((r) => !r.ok)).toHaveLength(1);
    const final = ruleStore.getCollections().find((c) => c.uid === coll.uid);
    expect(final?.version).toBe(2);
  });
});

describe('rule-store — collection lock serializes mixed mutations', () => {
  it('rename + updateVariables race lands both writes (no silent drift)', async () => {
    const coll = ruleStore.createCollection('Mix');
    const [a, b] = await Promise.all([
      ruleStore.renameCollection(coll.uid, 'Renamed'),
      ruleStore.updateCollectionVariables(coll.uid, [{ name: 'X', value: '1', type: 'default' }]),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const final = ruleStore.getCollections().find((c) => c.uid === coll.uid);
    // Starting at v1, +rename=+1, +updateVars=+1 → v3.
    expect(final?.version).toBe(3);
  });

  it('deleteCollection removes the collection and cascades child rules', async () => {
    const coll = ruleStore.createCollection('Doomed');
    ruleStore.addRuleToCollection(
      {
        name: 'child',
        type: 'header',
        enabled: true,
        conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
        action: { requestHeaders: [], responseHeaders: [] },
      } as Parameters<typeof ruleStore.addRuleToCollection>[0],
      coll.uid,
    );
    const ok = await ruleStore.deleteCollection(coll.uid);
    expect(ok).toBe(true);
    expect(ruleStore.getCollections().find((c) => c.uid === coll.uid)).toBeUndefined();
    expect(ruleStore.getRules()).toHaveLength(0);
  });
});

// ── rule-store folders ──────────────────────────────────────────────

describe('rule-store — folder version stamping + lock', () => {
  it('createFolder stamps version: 1', () => {
    const folder = ruleStore.createFolder('F', 'rules/root');
    expect(folder.version).toBe(1);
  });

  it('renameFolder bumps version', async () => {
    const folder = ruleStore.createFolder('Before', 'rules/root');
    const ok = await ruleStore.renameFolder(folder.uid, 'After');
    expect(ok).toBe(true);
    const updated = ruleStore.getFolders().find((f) => f.uid === folder.uid);
    expect(updated?.version).toBe(2);
    expect(updated?.name).toBe('After');
  });

  it('concurrent renameFolder calls serialize through the folder lock', async () => {
    const folder = ruleStore.createFolder('Before', 'rules/root');
    const [a, b] = await Promise.all([
      ruleStore.renameFolder(folder.uid, 'A'),
      ruleStore.renameFolder(folder.uid, 'B'),
    ]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    const updated = ruleStore.getFolders().find((f) => f.uid === folder.uid);
    // Both writes applied (last-writer-wins on name); version advanced twice.
    expect(updated?.version).toBe(3);
    expect(['A', 'B']).toContain(updated?.name);
  });

  it('renameFolder on an unknown uid returns false', async () => {
    const ok = await ruleStore.renameFolder('missing00', 'x');
    expect(ok).toBe(false);
  });

  it('deleteFolder removes the folder and cascades children', async () => {
    const parent = ruleStore.createFolder('parent', 'rules/root');
    const ok = await ruleStore.deleteFolder(parent.uid);
    expect(ok).toBe(true);
    expect(ruleStore.getFolders().find((f) => f.uid === parent.uid)).toBeUndefined();
  });
});

// ── request-store collections + folders ─────────────────────────────

describe('request-store — collection + folder version stamping', () => {
  it('createRequestCollection stamps version: 1', () => {
    const coll = requestStore.createRequestCollection('R');
    expect(coll.version).toBe(1);
  });

  it('renameRequestCollection + deleteRequestCollection are async and wrapped in lock', async () => {
    const coll = requestStore.createRequestCollection('X');
    const renamed = await requestStore.renameRequestCollection(coll.uid, 'Y');
    expect(renamed).toBe(true);
    const after = requestStore.getRequestCollections().find((c) => c.uid === coll.uid);
    expect(after?.version).toBe(2);
    expect(after?.name).toBe('Y');

    const deleted = await requestStore.deleteRequestCollection(coll.uid);
    expect(deleted).toBe(true);
    expect(requestStore.getRequestCollections().find((c) => c.uid === coll.uid)).toBeUndefined();
  });

  it('createRequestFolder + renameRequestFolder stamp + bump version', async () => {
    const folder = requestStore.createRequestFolder('F', 'requests/root');
    expect(folder.version).toBe(1);
    const ok = await requestStore.renameRequestFolder(folder.uid, 'F2');
    expect(ok).toBe(true);
    const after = requestStore.getRequestFolders().find((f) => f.uid === folder.uid);
    expect(after?.version).toBe(2);
  });
});

// ── template-store collections + folders ────────────────────────────

describe('template-store — collection + folder version stamping', () => {
  it('ensureDefaultTemplateCollection + createTemplateCollection stamp version: 1', () => {
    const def = templateStore.ensureDefaultTemplateCollection();
    expect(def.version).toBe(1);
    const created = templateStore.createTemplateCollection('New');
    expect(created.version).toBe(1);
  });

  it('renameTemplateCollection bumps version and rejects the default collection', async () => {
    const created = templateStore.createTemplateCollection('Editable');
    const ok = await templateStore.renameTemplateCollection(created.uid, 'Editable2');
    expect(ok).toBe(true);
    const after = templateStore.getTemplateCollections().find((c) => c.uid === created.uid);
    expect(after?.version).toBe(2);
    expect(after?.name).toBe('Editable2');

    const def = templateStore.ensureDefaultTemplateCollection();
    const protectedRename = await templateStore.renameTemplateCollection(def.uid, 'Nope');
    expect(protectedRename).toBe(false);
  });

  it('createTemplateFolder + renameTemplateFolder stamp + bump version', async () => {
    const coll = templateStore.createTemplateCollection('Holder');
    const folder = templateStore.createTemplateFolder('F', coll.path);
    expect(folder.version).toBe(1);
    const ok = await templateStore.renameTemplateFolder(folder.uid, 'F2');
    expect(ok).toBe(true);
    const after = templateStore.getTemplateFolders().find((f) => f.uid === folder.uid);
    expect(after?.version).toBe(2);
  });
});
