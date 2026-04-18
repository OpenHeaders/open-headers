import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock rule-store before importing the store under test. The store reads
// rule + collection state through getRules / getCollectionTrees when
// computing owner hashes — the mocks let each test feed a tailored snapshot.
vi.mock('@/background/modules/rule-store', () => ({
  getRules: vi.fn(() => [] as V5.Rule[]),
  getCollectionTrees: vi.fn(() => [] as V5.CollectionTree[]),
}));

// Workspace-store is a singleton; the test-run-store keys its I/O off
// `getActiveWorkspaceId()`, so we pin a deterministic id per test.
vi.mock('@/background/modules/workspace-store', () => ({
  getActiveWorkspaceId: vi.fn(() => 'test-ws'),
}));

vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getCollectionTrees, getRules } from '@/background/modules/rule-store';
import {
  computeOwnerHash,
  deleteAllTestRunsForOwner,
  deleteTestRunById,
  getTestRunById,
  listTestRunsForOwner,
  persistTestRun,
  pruneOrphanOwners,
  type StoredTestRun,
} from '@/background/modules/test-run-store';

const mockGetRules = getRules as unknown as ReturnType<typeof vi.fn>;
const mockGetTrees = getCollectionTrees as unknown as ReturnType<typeof vi.fn>;

// In-memory storage backing for chrome.storage.local. The chrome mock
// declared in tests/__mocks__/chrome.ts is a noop; we override per-test
// so reads see what writes put in.
let storageData: Record<string, unknown> = {};

beforeEach(() => {
  storageData = {};
  const local = (globalThis as unknown as { chrome: { storage: { local: { get: unknown; set: unknown } } } }).chrome
    .storage.local;
  (local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (_keys: string | string[], cb: (data: Record<string, unknown>) => void) => {
      cb({ ...storageData });
    },
  );
  (local.set as ReturnType<typeof vi.fn>).mockImplementation((items: Record<string, unknown>, cb?: () => void) => {
    Object.assign(storageData, items);
    cb?.();
  });
  mockGetRules.mockReturnValue([]);
  mockGetTrees.mockReturnValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Fixture helpers ──────────────────────────────────────────────────

function makeHeaderRule(overrides: Partial<V5.HeaderRule> = {}): V5.HeaderRule {
  return {
    uid: 'rule-1',
    path: 'rules/col-1/rule-1',
    name: 'Auth header',
    type: 'header',
    enabled: true,
    conditions: [{ type: 'request-domains', values: ['*.openheaders.io'] }],
    action: {
      requestHeaders: [{ operation: 'override', headerName: 'X-Test', value: 'v1' }],
      responseHeaders: [],
    },
    ...overrides,
  } as V5.HeaderRule;
}

function makeRun(overrides: Partial<StoredTestRun> = {}): StoredTestRun {
  return {
    id: 'sess-1',
    ownerType: 'rule',
    ownerId: 'rule-1',
    ownerNameAtRun: 'Auth header',
    ruleUids: ['rule-1'],
    url: 'https://openheaders.io/api',
    startedAt: 1000,
    endedAt: 2000,
    waitSeconds: 5,
    fires: [],
    ruleStatuses: { 'rule-1': 'executed' },
    ownerHashAtRun: 'abc',
    ...overrides,
  };
}

function makeCollectionTree(uid: string, ruleNodes: V5.TreeNode[]): V5.CollectionTree {
  return {
    uid,
    path: `rules/${uid}`,
    name: uid,
    variables: [],
    tree: ruleNodes,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('test-run-store', () => {
  describe('persistTestRun + listTestRunsForOwner', () => {
    it('persists a run into its owner bucket and lists it back', async () => {
      mockGetRules.mockReturnValue([makeHeaderRule()]);
      const run = makeRun({ ownerHashAtRun: computeOwnerHash({ type: 'rule', id: 'rule-1' }) ?? '' });
      await persistTestRun(run);

      const listed = await listTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      expect(listed).toHaveLength(1);
      expect(listed[0].id).toBe('sess-1');
      expect(listed[0].isStale).toBe(false);
    });

    it('keeps owner buckets isolated', async () => {
      await persistTestRun(makeRun({ id: 's1', ownerType: 'rule', ownerId: 'rule-1' }));
      await persistTestRun(makeRun({ id: 's2', ownerType: 'folder', ownerId: 'folder-1' }));
      await persistTestRun(makeRun({ id: 's3', ownerType: 'collection', ownerId: 'col-1' }));

      const ruleRuns = await listTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      const folderRuns = await listTestRunsForOwner({ type: 'folder', id: 'folder-1' });
      const colRuns = await listTestRunsForOwner({ type: 'collection', id: 'col-1' });
      expect(ruleRuns.map((s) => s.id)).toEqual(['s1']);
      expect(folderRuns.map((s) => s.id)).toEqual(['s2']);
      expect(colRuns.map((s) => s.id)).toEqual(['s3']);
    });

    it('returns runs newest-first', async () => {
      await persistTestRun(makeRun({ id: 'old', endedAt: 1_000 }));
      await persistTestRun(makeRun({ id: 'new', endedAt: 5_000 }));
      const listed = await listTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      expect(listed.map((s) => s.id)).toEqual(['new', 'old']);
    });

    it('caps the per-owner bucket at the ring buffer size', async () => {
      // Push 25 runs into one bucket; the cap is 20.
      for (let i = 0; i < 25; i++) {
        await persistTestRun(makeRun({ id: `s${i}`, endedAt: i }));
      }
      const listed = await listTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      expect(listed).toHaveLength(20);
      // Newest 20 retained, oldest 5 dropped.
      expect(listed[0].id).toBe('s24');
      expect(listed[listed.length - 1].id).toBe('s5');
    });

    it('overwrites an existing run id rather than duplicating', async () => {
      await persistTestRun(makeRun({ id: 'sess-1', endedAt: 1_000, ownerHashAtRun: 'a' }));
      await persistTestRun(makeRun({ id: 'sess-1', endedAt: 2_000, ownerHashAtRun: 'b' }));
      const listed = await listTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      expect(listed).toHaveLength(1);
      expect(listed[0].endedAt).toBe(2_000);
      expect(listed[0].ownerHashAtRun).toBe('b');
    });
  });

  describe('stale detection', () => {
    it('flags a run as stale when the rule content changes after the run', async () => {
      mockGetRules.mockReturnValue([makeHeaderRule()]);
      const hash = computeOwnerHash({ type: 'rule', id: 'rule-1' }) ?? '';
      await persistTestRun(makeRun({ ownerHashAtRun: hash }));

      // Mutate the rule's action — the cosmetic name change must NOT
      // matter, but a value change must.
      mockGetRules.mockReturnValue([
        makeHeaderRule({
          action: {
            requestHeaders: [{ operation: 'override', headerName: 'X-Test', value: 'changed' }],
            responseHeaders: [],
          },
        }),
      ]);
      const listed = await listTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      expect(listed[0].isStale).toBe(true);
    });

    it('does not flag stale on pure rename', async () => {
      mockGetRules.mockReturnValue([makeHeaderRule()]);
      const hash = computeOwnerHash({ type: 'rule', id: 'rule-1' }) ?? '';
      await persistTestRun(makeRun({ ownerHashAtRun: hash }));
      mockGetRules.mockReturnValue([makeHeaderRule({ name: 'Renamed header' })]);
      const listed = await listTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      expect(listed[0].isStale).toBe(false);
    });

    it('flags stale on a collection when a child rule is added', async () => {
      const ruleA = makeHeaderRule({ uid: 'rule-a' });
      const ruleNodeA: V5.TreeNode = {
        type: 'rule',
        uid: 'rule-a',
        name: 'A',
        path: 'rules/col-1/a',
        ruleType: 'header',
        enabled: true,
      };
      mockGetRules.mockReturnValue([ruleA]);
      mockGetTrees.mockReturnValue([makeCollectionTree('col-1', [ruleNodeA])]);

      const hash = computeOwnerHash({ type: 'collection', id: 'col-1' }) ?? '';
      await persistTestRun(
        makeRun({
          ownerType: 'collection',
          ownerId: 'col-1',
          ruleUids: ['rule-a'],
          ownerHashAtRun: hash,
        }),
      );

      // Add a sibling rule — collection content changed, hash drifts.
      const ruleB = makeHeaderRule({ uid: 'rule-b' });
      const ruleNodeB: V5.TreeNode = {
        type: 'rule',
        uid: 'rule-b',
        name: 'B',
        path: 'rules/col-1/b',
        ruleType: 'header',
        enabled: true,
      };
      mockGetRules.mockReturnValue([ruleA, ruleB]);
      mockGetTrees.mockReturnValue([makeCollectionTree('col-1', [ruleNodeA, ruleNodeB])]);

      const listed = await listTestRunsForOwner({ type: 'collection', id: 'col-1' });
      expect(listed[0].isStale).toBe(true);
    });
  });

  describe('delete + cascade', () => {
    it('deletes a single run by id', async () => {
      await persistTestRun(makeRun({ id: 's1' }));
      await persistTestRun(makeRun({ id: 's2', endedAt: 9_000 }));
      await deleteTestRunById('s1');
      const listed = await listTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      expect(listed.map((s) => s.id)).toEqual(['s2']);
    });

    it('deletes the whole bucket for an owner', async () => {
      await persistTestRun(makeRun({ id: 's1' }));
      await persistTestRun(makeRun({ id: 's2', endedAt: 9_000 }));
      await deleteAllTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      const listed = await listTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      expect(listed).toEqual([]);
    });

    it('prunes orphan owners whose entity is gone', async () => {
      await persistTestRun(makeRun({ id: 's-rule', ownerType: 'rule', ownerId: 'rule-1' }));
      await persistTestRun(makeRun({ id: 's-folder', ownerType: 'folder', ownerId: 'folder-gone' }));
      await persistTestRun(makeRun({ id: 's-col', ownerType: 'collection', ownerId: 'col-keep' }));
      await persistTestRun(makeRun({ id: 's-ws', ownerType: 'workspace', ownerId: 'all' }));

      // Live ids: rule-1 kept, folder-gone gone, col-keep kept. Workspace
      // is the singleton "all rules" history — must always survive a prune.
      await pruneOrphanOwners(new Set(['rule-1']), new Set(['col-keep']));

      const ruleRuns = await listTestRunsForOwner({ type: 'rule', id: 'rule-1' });
      const folderRuns = await listTestRunsForOwner({ type: 'folder', id: 'folder-gone' });
      const colRuns = await listTestRunsForOwner({ type: 'collection', id: 'col-keep' });
      const wsRuns = await listTestRunsForOwner({ type: 'workspace', id: 'all' });
      expect(ruleRuns).toHaveLength(1);
      expect(folderRuns).toHaveLength(0);
      expect(colRuns).toHaveLength(1);
      expect(wsRuns).toHaveLength(1);
    });

    it('hashes the workspace owner over every live rule', async () => {
      const ruleA = makeHeaderRule({ uid: 'rule-a' });
      const ruleB = makeHeaderRule({ uid: 'rule-b' });
      mockGetRules.mockReturnValue([ruleA, ruleB]);
      const hash1 = computeOwnerHash({ type: 'workspace', id: 'all' });
      expect(hash1).toBeTruthy();

      // Removing a rule must drift the hash.
      mockGetRules.mockReturnValue([ruleA]);
      const hash2 = computeOwnerHash({ type: 'workspace', id: 'all' });
      expect(hash2).not.toBe(hash1);

      // Adding rule-b back, but with different action — drift again.
      mockGetRules.mockReturnValue([
        ruleA,
        makeHeaderRule({
          uid: 'rule-b',
          action: {
            requestHeaders: [{ operation: 'override', headerName: 'X-Test', value: 'changed' }],
            responseHeaders: [],
          },
        }),
      ]);
      const hash3 = computeOwnerHash({ type: 'workspace', id: 'all' });
      expect(hash3).not.toBe(hash1);
    });
  });

  describe('getTestRunById', () => {
    it('finds a run by id across all buckets', async () => {
      await persistTestRun(makeRun({ id: 's-rule', ownerType: 'rule', ownerId: 'rule-1' }));
      await persistTestRun(makeRun({ id: 's-folder', ownerType: 'folder', ownerId: 'folder-1' }));

      const found = await getTestRunById('s-folder');
      expect(found?.id).toBe('s-folder');
      expect(found?.ownerType).toBe('folder');
    });

    it('returns null when the id is not present', async () => {
      const found = await getTestRunById('does-not-exist');
      expect(found).toBeNull();
    });
  });
});
