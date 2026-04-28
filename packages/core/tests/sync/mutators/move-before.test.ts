/**
 * Focused tests for the generic moveBefore mutator and its
 * interaction with addToSet's order seed. The convergence harness
 * covers interleaving; this file pins down the readable spec:
 *   - addToSet without an orderKey seeds with the canonical seed; ids
 *     tie-break on the materialized order.
 *   - addToSet with an orderKey lands the item at the chosen position.
 *   - moveBefore writes the carried key under LWW per (path, itemId).
 *   - removeFromSet hides the item from the materialized order.
 */

import { describe, expect, it } from 'vitest';
import {
  applyMutation,
  type EntityState,
  liveOrderedItemsAt,
  type MutationEnvelope,
  newEntityState,
  newMutationId,
} from '../../../src/sync';

const HLC_ZERO = { physicalMs: 0, logical: 0, nodeId: 'n0' };

const env = (
  body: MutationEnvelope['body'],
  hlc: MutationEnvelope['hlc'],
  origin: { surfaceId: string; deviceId: string } = { surfaceId: 's', deviceId: 'd' },
): MutationEnvelope => ({
  mutationId: newMutationId(),
  hlc,
  origin,
  workspaceId: 'ws-1',
  mutatorVersion: 1,
  body,
});

const seedRule = (state: EntityState, items: Array<{ itemId: string; item: unknown; orderKey?: string }>): void => {
  for (let i = 0; i < items.length; i += 1) {
    const { itemId, item, orderKey } = items[i];
    applyMutation(
      state,
      env(
        { kind: 'addToSet', type: 'rule', id: state.id, path: 'mods', itemId, item, orderKey },
        { ...HLC_ZERO, physicalMs: 100 + i },
      ),
    );
  }
};

describe('moveBefore', () => {
  it('addToSet without an orderKey seeds — itemId tie-breaks the materialized order', () => {
    const state = newEntityState('rule', 'r1');
    seedRule(state, [
      { itemId: 'c', item: { v: 1 } },
      { itemId: 'a', item: { v: 2 } },
      { itemId: 'b', item: { v: 3 } },
    ]);
    expect(liveOrderedItemsAt(state, 'mods').map((e) => e.itemId)).toEqual(['a', 'b', 'c']);
  });

  it('addToSet with explicit orderKeys preserves the chosen order', () => {
    const state = newEntityState('rule', 'r1');
    seedRule(state, [
      { itemId: 'a', item: {}, orderKey: 'mc' },
      { itemId: 'b', item: {}, orderKey: 'ma' },
      { itemId: 'c', item: {}, orderKey: 'mb' },
    ]);
    expect(liveOrderedItemsAt(state, 'mods').map((e) => e.itemId)).toEqual(['b', 'c', 'a']);
  });

  it('moveBefore writes the carried orderKey under LWW per (path, itemId)', () => {
    const state = newEntityState('rule', 'r1');
    seedRule(state, [
      { itemId: 'a', item: {}, orderKey: 'm' },
      { itemId: 'b', item: {}, orderKey: 'n' },
      { itemId: 'c', item: {}, orderKey: 'o' },
    ]);
    applyMutation(
      state,
      env({ kind: 'moveBefore', type: 'rule', id: 'r1', path: 'mods', itemId: 'a', orderKey: 'p' }, {
        ...HLC_ZERO,
        physicalMs: 200,
      }),
    );
    expect(liveOrderedItemsAt(state, 'mods').map((e) => e.itemId)).toEqual(['b', 'c', 'a']);
  });

  it('LWW: later HLC wins regardless of apply order', () => {
    const a = newEntityState('rule', 'r1');
    const b = newEntityState('rule', 'r1');
    seedRule(a, [
      { itemId: 'a', item: {} },
      { itemId: 'b', item: {} },
    ]);
    seedRule(b, [
      { itemId: 'a', item: {} },
      { itemId: 'b', item: {} },
    ]);
    const earlier = env(
      { kind: 'moveBefore', type: 'rule', id: 'r1', path: 'mods', itemId: 'a', orderKey: 'zz' },
      { ...HLC_ZERO, physicalMs: 200 },
    );
    const later = env(
      { kind: 'moveBefore', type: 'rule', id: 'r1', path: 'mods', itemId: 'a', orderKey: 'ab' },
      { ...HLC_ZERO, physicalMs: 300 },
    );
    applyMutation(a, earlier);
    applyMutation(a, later);
    applyMutation(b, later);
    applyMutation(b, earlier);
    expect(liveOrderedItemsAt(a, 'mods').map((e) => e.itemId)).toEqual(
      liveOrderedItemsAt(b, 'mods').map((e) => e.itemId),
    );
  });

  it('removeFromSet hides the item from the live order', () => {
    const state = newEntityState('rule', 'r1');
    seedRule(state, [
      { itemId: 'a', item: {} },
      { itemId: 'b', item: {} },
    ]);
    applyMutation(
      state,
      env({ kind: 'removeFromSet', type: 'rule', id: 'r1', path: 'mods', itemId: 'a' }, {
        ...HLC_ZERO,
        physicalMs: 200,
      }),
    );
    expect(liveOrderedItemsAt(state, 'mods').map((e) => e.itemId)).toEqual(['b']);
  });
});
