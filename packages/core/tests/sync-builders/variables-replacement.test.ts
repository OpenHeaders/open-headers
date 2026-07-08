/**
 * Order-preserving diff behavior of the shared `buildVariablesReplacement`
 * builder — the collection (rule / request / template) variable scopes all
 * fold through it. Variable rows persist as a uid-keyed set that
 * materializes back in fractional-index (orderKey) order; the builder
 * delegates to the LIS-optimal `synthesizeSetDiff`, so a content edit
 * re-emits at the row's existing key, a pure reorder emits the minimal
 * `moveBefore` set, and a row unchanged in both content AND position
 * emits nothing.
 */

import { describe, expect, it } from 'vitest';
import { COLLECTION_ENTITY_TYPE, COLLECTION_VARS_PATH, type MutatorContext } from '../../src/sync';
import type { VariableLike } from '../../src/sync-builders/variables-replacement';
import { buildVariablesReplacement } from '../../src/sync-builders/variables-replacement';

const ctx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

const bindings = { entityType: COLLECTION_ENTITY_TYPE, varsPath: COLLECTION_VARS_PATH };

function variable(uid: string, name: string, value: string): VariableLike {
  return { uid, name, value, type: 'default' };
}

/** Monotonic single-char keys in the given uid order, matching the write
 *  clients' mirror read. */
function keys(orderedUids: readonly string[]): Map<string, string> {
  return new Map(orderedUids.map((uid, i) => [uid, String.fromCharCode(0x6d + i)] as const));
}

function adds(payload: ReturnType<typeof buildVariablesReplacement>) {
  return (payload?.batch.mutations ?? []).filter((m) => m.body.kind === 'addToSet');
}
function removes(payload: ReturnType<typeof buildVariablesReplacement>) {
  return (payload?.batch.mutations ?? []).filter((m) => m.body.kind === 'removeFromSet');
}

describe('buildVariablesReplacement — order keys', () => {
  it('returns null when nothing changed (content + keys identical)', () => {
    const vars = [variable('v1', 'A', 'a'), variable('v2', 'B', 'b')];
    const payload = buildVariablesReplacement(bindings, ctx(), {
      entityUid: 'coll-1',
      newVars: vars,
      oldVars: vars,
      currentKeys: keys(['v1', 'v2']),
    });
    expect(payload).toBeNull();
  });

  it('emits removeFromSet per vanished uid + addToSet per added/edited uid', () => {
    const oldVars = [variable('v1', 'KEEP', 'keep'), variable('v2', 'GONE', 'gone'), variable('v3', 'RENAMED', 'val')];
    const newVars = [variable('v1', 'KEEP', 'keep'), variable('v3', 'NEW_NAME', 'val'), variable('v4', 'NEW', 'fresh')];
    const payload = buildVariablesReplacement(bindings, ctx(), {
      entityUid: 'coll-1',
      newVars,
      oldVars,
      currentKeys: keys(['v1', 'v2', 'v3']),
    });
    expect(removes(payload).map((m) => (m.body as { itemId: string }).itemId)).toEqual(['v2']);
    expect(
      adds(payload)
        .map((m) => (m.body as { itemId: string }).itemId)
        .sort(),
    ).toEqual(['v3', 'v4']);
  });

  it('a content edit re-emits the row with its EXISTING orderKey (position preserved)', () => {
    const oldVars = [variable('v1', 'A', 'a'), variable('v2', 'B', 'b')];
    const newVars = [variable('v1', 'A', 'a2'), variable('v2', 'B', 'b')]; // edit v1's value only
    const payload = buildVariablesReplacement(bindings, ctx(), {
      entityUid: 'coll-1',
      newVars,
      oldVars,
      currentKeys: keys(['v1', 'v2']), // v1='m', v2='n'
    });
    const a = adds(payload);
    expect(a).toHaveLength(1);
    expect(a[0].body).toMatchObject({ itemId: 'v1', orderKey: 'm' });
  });

  it('a pure reorder emits a single moveBefore (LIS-optimal) — materialized key order follows the editor', () => {
    const rows = (order: string[]) => order.map((u) => variable(u, u.toUpperCase(), u));
    const payload = buildVariablesReplacement(bindings, ctx(), {
      entityUid: 'coll-1',
      newVars: rows(['v3', 'v1', 'v2']), // drag v3 to the top
      oldVars: rows(['v1', 'v2', 'v3']),
      currentKeys: keys(['v1', 'v2', 'v3']), // v1='m' < v2='n' < v3='o'
    });
    const mutations = payload?.batch.mutations ?? [];
    // v1+v2 form the LIS and stay put — only the dragged row moves.
    expect(mutations).toHaveLength(1);
    expect(mutations[0].body).toMatchObject({ kind: 'moveBefore', itemId: 'v3' });
    const finalKeys = new Map<string, string>([
      ['v1', 'm'],
      ['v2', 'n'],
      ['v3', (mutations[0].body as { orderKey: string }).orderKey],
    ]);
    const materialized = [...finalKeys.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1)).map(([uid]) => uid);
    expect(materialized).toEqual(['v3', 'v1', 'v2']);
  });

  it('drops new entries whose trimmed name is empty', () => {
    const payload = buildVariablesReplacement(bindings, ctx(), {
      entityUid: 'coll-1',
      newVars: [variable('v-blank', '   ', 'value'), variable('v-keep', 'OK', 'value')],
      oldVars: [],
      currentKeys: new Map(),
    });
    expect(adds(payload).map((m) => (m.body as { itemId: string }).itemId)).toEqual(['v-keep']);
  });
});
