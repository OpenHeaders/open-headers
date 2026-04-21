/**
 * Coverage for the per-workspace LRU recents cache used by
 * TemplateInput (docs/VARIABLE_AUTOCOMPLETE_PLAN.md §Phase B).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addRecent,
  listRecents,
  pruneRecents,
  RECENTS_CAP,
  RECENTS_SCHEMA_VERSION,
  type VariableRecents,
} from '@/rules/components/template-input/recents';

// ── chrome.storage.local backed by an in-memory map ────────────────

let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
  vi.useRealTimers();
});

vi.mock('@/shared/storage/extension-storage', () => ({
  extensionStorage: {
    get: vi.fn(async (spec: { key: string }) => store[spec.key]),
    set: vi.fn(async (spec: { key: string }, value: unknown) => {
      store[spec.key] = value;
    }),
  },
}));

// ── Tests ──────────────────────────────────────────────────────────

describe('listRecents', () => {
  it('returns empty when the slot is absent', async () => {
    const result = await listRecents('ws-1');
    expect(result).toEqual({ schemaVersion: RECENTS_SCHEMA_VERSION, entries: [] });
  });

  it('returns empty when workspaceId is null', async () => {
    const result = await listRecents(null);
    expect(result.entries).toEqual([]);
  });

  it('returns empty when the stored blob has the wrong schemaVersion', async () => {
    store['oh.ws.ws-1.variableRecents'] = { schemaVersion: 99, entries: [] };
    const result = await listRecents('ws-1');
    expect(result.entries).toEqual([]);
  });

  it('filters malformed entries without poisoning the whole list', async () => {
    store['oh.ws.ws-1.variableRecents'] = {
      schemaVersion: RECENTS_SCHEMA_VERSION,
      entries: [
        { reference: 'env.OK', insertedAt: 123 },
        { reference: null, insertedAt: 456 }, // malformed — dropped
        'garbage', // malformed — dropped
        { reference: 'vault.ALSO_OK', insertedAt: 789 },
      ],
    };
    const result = await listRecents('ws-1');
    expect(result.entries.map((e) => e.reference)).toEqual(['env.OK', 'vault.ALSO_OK']);
  });
});

describe('addRecent', () => {
  it('prepends a new reference at the front', async () => {
    await addRecent('ws-1', 'env.FIRST');
    await addRecent('ws-1', 'env.SECOND');
    const result = await listRecents('ws-1');
    expect(result.entries.map((e) => e.reference)).toEqual(['env.SECOND', 'env.FIRST']);
  });

  it('dedupes — inserting an existing reference moves it to the front', async () => {
    await addRecent('ws-1', 'env.A');
    await addRecent('ws-1', 'env.B');
    await addRecent('ws-1', 'env.A');
    const result = await listRecents('ws-1');
    expect(result.entries.map((e) => e.reference)).toEqual(['env.A', 'env.B']);
    expect(result.entries).toHaveLength(2);
  });

  it(`caps the list at ${RECENTS_CAP} entries (LRU)`, async () => {
    for (let i = 0; i < RECENTS_CAP + 3; i++) {
      await addRecent('ws-1', `env.VAR_${i}`);
    }
    const result = await listRecents('ws-1');
    expect(result.entries).toHaveLength(RECENTS_CAP);
    // Most recent-first ordering — oldest 3 evicted.
    expect(result.entries[0].reference).toBe(`env.VAR_${RECENTS_CAP + 2}`);
    expect(result.entries[RECENTS_CAP - 1].reference).toBe('env.VAR_3');
  });

  it('no-ops when workspaceId is null', async () => {
    await addRecent(null, 'env.X');
    expect(Object.keys(store)).toEqual([]);
  });

  it('isolates recents per workspace', async () => {
    await addRecent('ws-a', 'env.A');
    await addRecent('ws-b', 'env.B');
    const a = await listRecents('ws-a');
    const b = await listRecents('ws-b');
    expect(a.entries.map((e) => e.reference)).toEqual(['env.A']);
    expect(b.entries.map((e) => e.reference)).toEqual(['env.B']);
  });
});

describe('pruneRecents', () => {
  it('removes references not in the valid set', async () => {
    await addRecent('ws-1', 'env.KEEP');
    await addRecent('ws-1', 'env.STALE');
    await addRecent('ws-1', 'vault.KEEP');
    const pruned = await pruneRecents('ws-1', new Set(['env.KEEP', 'vault.KEEP']));
    expect(pruned.entries.map((e) => e.reference)).toEqual(['vault.KEEP', 'env.KEEP']);
  });

  it('returns the same list when nothing needs pruning (skip disk write)', async () => {
    await addRecent('ws-1', 'env.A');
    await addRecent('ws-1', 'env.B');
    const before = (store['oh.ws.ws-1.variableRecents'] as VariableRecents).entries;
    const pruned = await pruneRecents('ws-1', new Set(['env.A', 'env.B']));
    const after = (store['oh.ws.ws-1.variableRecents'] as VariableRecents).entries;
    expect(pruned.entries).toHaveLength(2);
    // Identity-preserving on no-op (we don't rewrite disk in that case).
    expect(before).toBe(after);
  });

  it('returns empty when workspaceId is null', async () => {
    const result = await pruneRecents(null, new Set(['env.X']));
    expect(result.entries).toEqual([]);
  });
});
