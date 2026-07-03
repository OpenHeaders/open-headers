/**
 * Coverage for the per-workspace post-import "scripts review pending"
 * store. Mirrors the chrome.storage layer with a Map-backed mock so we
 * can assert hydrate / mutate / switch / external-snapshot semantics
 * without the SW runtime.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { blobs } = vi.hoisted(() => ({ blobs: new Map<string, unknown>() }));

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/workspace/workspace-store', () => ({
  getActiveWorkspaceId: vi.fn(() => 'ws-active'),
}));

vi.mock('@openheaders/oracle/storage', async () => {
  const actual = await vi.importActual<typeof import('@openheaders/oracle/storage')>('@openheaders/oracle/storage');
  return {
    ...actual,
    hostStorage: {
      get: vi.fn(async (key: { key: string }) => blobs.get(key.key)),
      set: vi.fn(async (key: { key: string }, value: unknown) => {
        blobs.set(key.key, value);
      }),
    },
  };
});

import { setLockRuntime } from '@openheaders/oracle/coordination';

class ImmediateLockRuntime {
  async request<T>(_name: string, _options: unknown, callback: () => Promise<T> | T): Promise<T> {
    return await callback();
  }
}

let store: typeof import('@openheaders/oracle/entity/request-scripts-review-store');

beforeEach(async () => {
  blobs.clear();
  setLockRuntime(new ImmediateLockRuntime());
  vi.resetModules();
  const { setOracleHostHooks } = await import('@openheaders/oracle/sync');
  setOracleHostHooks({ getActiveWorkspaceId: () => 'ws-active' });
  store = await import('@openheaders/oracle/entity/request-scripts-review-store');
  store.__resetForTests();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RequestScriptsReviewStore — active workspace', () => {
  it('hydrates from storage', async () => {
    blobs.set('oh.ws.ws-active.requestScriptsReviewPending', ['req00001', 'req00002']);
    await store.hydrateRequestScriptsReviewFromStorage();
    expect(Array.from(store.getPendingScriptsReview()).sort()).toEqual(['req00001', 'req00002']);
  });

  it('hydrates an empty set when key is missing', async () => {
    await store.hydrateRequestScriptsReviewFromStorage();
    expect(store.getPendingScriptsReview().size).toBe(0);
  });

  it('marks new uids and persists them; skips duplicates', async () => {
    await store.hydrateRequestScriptsReviewFromStorage();
    await store.markPendingScriptsReview(['req00001', 'req00002']);
    await store.markPendingScriptsReview(['req00002', 'req00003']);
    expect(Array.from(store.getPendingScriptsReview()).sort()).toEqual(['req00001', 'req00002', 'req00003']);
    const persisted = blobs.get('oh.ws.ws-active.requestScriptsReviewPending') as string[];
    expect(persisted.sort()).toEqual(['req00001', 'req00002', 'req00003']);
  });

  it('clears a uid and persists', async () => {
    await store.hydrateRequestScriptsReviewFromStorage();
    await store.markPendingScriptsReview(['req00001', 'req00002']);
    await store.clearPendingScriptsReview('req00001');
    expect(store.getPendingScriptsReview().has('req00001')).toBe(false);
    expect(store.getPendingScriptsReview().has('req00002')).toBe(true);
    expect(blobs.get('oh.ws.ws-active.requestScriptsReviewPending')).toEqual(['req00002']);
  });

  it('clearing an unknown uid is a no-op', async () => {
    await store.hydrateRequestScriptsReviewFromStorage();
    await store.markPendingScriptsReview(['req00001']);
    await store.clearPendingScriptsReview('req99999');
    expect(blobs.get('oh.ws.ws-active.requestScriptsReviewPending')).toEqual(['req00001']);
  });

  it('throws when mutating before hydration', async () => {
    await expect(store.markPendingScriptsReview(['req00001'])).rejects.toThrow(/before hydration/);
  });

  it('switches to a different workspace and re-loads its set', async () => {
    blobs.set('oh.ws.ws-active.requestScriptsReviewPending', ['req00001']);
    blobs.set('oh.ws.ws-other.requestScriptsReviewPending', ['req99999']);
    await store.hydrateRequestScriptsReviewFromStorage();
    expect(Array.from(store.getPendingScriptsReview())).toEqual(['req00001']);
    await store.switchToWorkspace('ws-other');
    expect(Array.from(store.getPendingScriptsReview())).toEqual(['req99999']);
  });

  it('applies external snapshots (storage.onChanged path)', async () => {
    await store.hydrateRequestScriptsReviewFromStorage();
    let notified = 0;
    store.onRequestScriptsReviewChange(() => notified++);
    store.applyExternalSnapshot(['req00001', 'req00002']);
    expect(Array.from(store.getPendingScriptsReview()).sort()).toEqual(['req00001', 'req00002']);
    expect(notified).toBe(1);
  });
});

describe('RequestScriptsReviewStore — non-active workspace path', () => {
  it('marks uids on a workspace without touching the active mirror', async () => {
    await store.hydrateRequestScriptsReviewFromStorage();
    await store.markPendingScriptsReviewForWorkspace('ws-target', ['req00001']);
    expect(blobs.get('oh.ws.ws-target.requestScriptsReviewPending')).toEqual(['req00001']);
    expect(store.getPendingScriptsReview().size).toBe(0);
  });

  it('merges with an existing target ring without duplicating', async () => {
    blobs.set('oh.ws.ws-target.requestScriptsReviewPending', ['req00001']);
    await store.markPendingScriptsReviewForWorkspace('ws-target', ['req00001', 'req00002']);
    expect(blobs.get('oh.ws.ws-target.requestScriptsReviewPending')).toEqual(['req00001', 'req00002']);
  });

  it('lists pending entries for an arbitrary workspace via the read helper', async () => {
    blobs.set('oh.ws.ws-target.requestScriptsReviewPending', ['req00001']);
    expect(await store.listPendingScriptsReviewForWorkspace('ws-target')).toEqual(['req00001']);
    expect(await store.listPendingScriptsReviewForWorkspace('ws-empty')).toEqual([]);
  });
});
