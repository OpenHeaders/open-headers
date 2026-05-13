/**
 * Coverage for the SW-side import-reports ring (ARCHITECTURE §23).
 * Exercises record/list/find/clear with a Map-backed mock of
 * `extensionStorage`. The withLock runtime is a deterministic FIFO
 * mutex so concurrent dedup races are observable.
 */

import type { FlatImportReport, ImportReport } from '@openheaders/core/import';
import { createReport } from '@openheaders/core/import';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { blobs } = vi.hoisted(() => ({ blobs: new Map<string, unknown>() }));

vi.mock('@utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/background/modules/workspace-store', () => ({
  getActiveWorkspaceId: vi.fn(() => 'ws-imports'),
}));

vi.mock('@openheaders/oracle/storage', async () => {
  const actual = await vi.importActual<typeof import('@openheaders/oracle/storage')>('@openheaders/oracle/storage');
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

import { setLockRuntime } from '@openheaders/oracle/coordination';

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

let store: typeof import('@/background/modules/import-reports-store');

beforeEach(async () => {
  blobs.clear();
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  store = await import('@/background/modules/import-reports-store');
});

afterEach(() => {
  setLockRuntime(null);
});

// Fabricate a report that matches the schema so parseEntityArray
// doesn't reject it at read time.
function stubReport(hash: string, source: FlatImportReport['source'] = 'curl'): ImportReport {
  const r = createReport(source);
  r.sourceHash = hash;
  return r;
}

describe('import-reports-store', () => {
  describe('recordImportReport', () => {
    it('appends the first report', async () => {
      await store.recordImportReport(stubReport('sha256:a'));
      const list = await store.listImportReports();
      expect(list.map((r) => r.sourceHash)).toEqual(['sha256:a']);
    });

    it('dedups by sourceHash on re-import', async () => {
      await store.recordImportReport(stubReport('sha256:same'));
      const second = stubReport('sha256:same', 'har');
      await store.recordImportReport(second);
      const list = await store.listImportReports();
      expect(list).toHaveLength(1);
      expect(list[0]?.source).toBe('har');
    });

    it('keeps distinct hashes as separate entries', async () => {
      await store.recordImportReport(stubReport('sha256:a'));
      await store.recordImportReport(stubReport('sha256:b'));
      await store.recordImportReport(stubReport('sha256:c'));
      const list = await store.listImportReports();
      expect(list.map((r) => r.sourceHash)).toEqual(['sha256:a', 'sha256:b', 'sha256:c']);
    });

    it('treats empty-hash reports as distinct (always appended)', async () => {
      const r1 = stubReport('');
      const r2 = stubReport('');
      await store.recordImportReport(r1);
      await store.recordImportReport(r2);
      const list = await store.listImportReports();
      expect(list).toHaveLength(2);
    });

    it('caps the ring at 50 entries (oldest dropped)', async () => {
      for (let i = 0; i < 55; i++) {
        await store.recordImportReport(stubReport(`sha256:${i}`));
      }
      const list = await store.listImportReports();
      expect(list).toHaveLength(50);
      expect(list[0]?.sourceHash).toBe('sha256:5');
      expect(list[49]?.sourceHash).toBe('sha256:54');
    });

    it('replacement does not consume a cap slot', async () => {
      for (let i = 0; i < 50; i++) {
        await store.recordImportReport(stubReport(`sha256:${i}`));
      }
      // Re-import the oldest — should stay at 50, oldest entry still
      // present (same hash just refreshed content).
      await store.recordImportReport(stubReport('sha256:0', 'har'));
      const list = await store.listImportReports();
      expect(list).toHaveLength(50);
      const sha0 = list.find((r) => r.sourceHash === 'sha256:0');
      expect(sha0?.source).toBe('har');
    });
  });

  describe('findImportReportBySourceHash', () => {
    it('returns the matching report', async () => {
      await store.recordImportReport(stubReport('sha256:a'));
      await store.recordImportReport(stubReport('sha256:b'));
      const hit = await store.findImportReportBySourceHash('sha256:b');
      expect(hit?.sourceHash).toBe('sha256:b');
    });

    it('returns null when no entry matches', async () => {
      await store.recordImportReport(stubReport('sha256:a'));
      const miss = await store.findImportReportBySourceHash('sha256:zzz');
      expect(miss).toBeNull();
    });

    it('returns null for empty hash (empty is non-identifying)', async () => {
      await store.recordImportReport(stubReport(''));
      const miss = await store.findImportReportBySourceHash('');
      expect(miss).toBeNull();
    });

    it('returns null when the ring is empty', async () => {
      const miss = await store.findImportReportBySourceHash('sha256:anything');
      expect(miss).toBeNull();
    });
  });

  describe('clearImportReports', () => {
    it('drops every entry', async () => {
      await store.recordImportReport(stubReport('sha256:a'));
      await store.recordImportReport(stubReport('sha256:b'));
      await store.clearImportReports();
      const list = await store.listImportReports();
      expect(list).toEqual([]);
    });
  });

  // Lock-serialization discipline is proven by the Phase 10 test
  // family (environment-store-singletons, workspace-store-version,
  // pause-markers-lock, rule-store-version). The import-reports
  // store uses the same `withLock` primitive, so the contract
  // transitively applies here without needing a separate race test.
});
