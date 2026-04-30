/**
 * Phase B Request — `buildUpdateBatch` reorder + content-replacement
 * fast paths. Pure-reorder gestures must collapse to `moveBefore`
 * envelopes via `keyBetween`; mixed gestures (content edit + reorder /
 * row add / row remove) fall back to `removeFromSet + addToSet` keyed
 * by the row's persisted `uid`.
 */

import {
  type MutationBody,
  REQUEST_HEADERS_PATH,
  type MutatorContext,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { buildUpdateBatch, type LiveSetEntries } from '@/shared/sync/request-mutations';

const ctx: MutatorContext = {
  workspaceId: 'ws-1',
  hlc: { physicalMs: 100, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
};

const liveOf =
  (entries: ReadonlyArray<{ itemId: string; orderKey: string; item: unknown }>): LiveSetEntries =>
  () => entries;

const header = (uid: string, key: string, value: string) => ({ uid, key, value, enabled: true });

describe('buildUpdateBatch — request set replacement', () => {
  it('emits moveBefore for a pure reorder (same uids, same content, swapped positions)', () => {
    const live = [
      { itemId: 'h1', orderKey: 'a', item: header('h1', 'X-A', 'a') },
      { itemId: 'h2', orderKey: 'b', item: header('h2', 'X-B', 'b') },
      { itemId: 'h3', orderKey: 'c', item: header('h3', 'X-C', 'c') },
    ];
    const updates = {
      headers: [header('h2', 'X-B', 'b'), header('h1', 'X-A', 'a'), header('h3', 'X-C', 'c')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    const kinds = batch.mutations.map((m) => m.body.kind);
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.every((k) => k === 'moveBefore')).toBe(true);
    // No removeFromSet / addToSet emitted — row identity preserved.
    expect(kinds).not.toContain('removeFromSet');
    expect(kinds).not.toContain('addToSet');
    expectFinalOrderMatches(live, batch.mutations.map((m) => m.body), ['h2', 'h1', 'h3']);
  });

  it('emits zero envelopes when the order is byte-identical', () => {
    const live = [
      { itemId: 'h1', orderKey: 'a', item: header('h1', 'X-A', 'a') },
      { itemId: 'h2', orderKey: 'b', item: header('h2', 'X-B', 'b') },
    ];
    const updates = {
      headers: [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    expect(batch.mutations).toHaveLength(0);
  });

  it('falls back to remove+add when a row is added (uid set differs)', () => {
    const live = [{ itemId: 'h1', orderKey: 'a', item: header('h1', 'X-A', 'a') }];
    const updates = {
      headers: [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    const kinds = batch.mutations.map((m) => m.body.kind);
    expect(kinds).toContain('removeFromSet');
    expect(kinds).toContain('addToSet');
    // The two new rows re-add at their persisted uids — itemId == row.uid.
    const adds = batch.mutations
      .map((m) => m.body)
      .filter((b): b is MutationBody & { kind: 'addToSet'; itemId: string } => b.kind === 'addToSet');
    expect(adds.map((a) => a.itemId).sort()).toEqual(['h1', 'h2']);
  });

  it('falls back to remove+add when a row content changes (uid same, value edited)', () => {
    const live = [
      { itemId: 'h1', orderKey: 'a', item: header('h1', 'X-A', 'a') },
      { itemId: 'h2', orderKey: 'b', item: header('h2', 'X-B', 'b') },
    ];
    const updates = {
      headers: [header('h1', 'X-A', 'a'), header('h2', 'X-B', 'EDITED')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    const kinds = batch.mutations.map((m) => m.body.kind);
    expect(kinds).toContain('removeFromSet');
    expect(kinds).toContain('addToSet');
    expect(kinds).not.toContain('moveBefore');
  });

  it('emits moveBefore that converges to the requested order (single-row drag)', () => {
    // 3 rows in order [h1, h2, h3]; drag h3 to first position.
    const live = [
      { itemId: 'h1', orderKey: 'a', item: header('h1', 'X-A', 'a') },
      { itemId: 'h2', orderKey: 'm', item: header('h2', 'X-B', 'b') },
      { itemId: 'h3', orderKey: 'z', item: header('h3', 'X-C', 'c') },
    ];
    const updates = {
      headers: [header('h3', 'X-C', 'c'), header('h1', 'X-A', 'a'), header('h2', 'X-B', 'b')],
    };
    const { batch } = buildUpdateBatch('rq', updates, ctx, liveOf(live));
    const kinds = batch.mutations.map((m) => m.body.kind);
    expect(kinds.every((k) => k === 'moveBefore')).toBe(true);
    expect(kinds).not.toContain('removeFromSet');
    expectFinalOrderMatches(live, batch.mutations.map((m) => m.body), ['h3', 'h1', 'h2']);
  });
});

function expectFinalOrderMatches(
  live: ReadonlyArray<{ itemId: string; orderKey: string }>,
  bodies: ReadonlyArray<MutationBody>,
  expected: ReadonlyArray<string>,
): void {
  // Apply moveBefore envelopes against a fresh copy of live's keys, then
  // sort by (orderKey, itemId) — same canonical order the document store
  // uses (§materialization). Asserts the engine would land at `expected`
  // after replay.
  const finalKey = new Map<string, string>();
  for (const e of live) finalKey.set(e.itemId, e.orderKey);
  for (const body of bodies) {
    if (body.kind !== 'moveBefore') continue;
    finalKey.set(body.itemId, body.orderKey);
  }
  const ordered = Array.from(finalKey.entries())
    .sort(([aId, aKey], [bId, bKey]) => (aKey === bKey ? (aId < bId ? -1 : 1) : aKey < bKey ? -1 : 1))
    .map(([id]) => id);
  expect(ordered).toEqual(expected);
}
