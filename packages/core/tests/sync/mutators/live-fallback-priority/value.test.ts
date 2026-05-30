import { describe, expect, it } from 'vitest';
import {
  enlistFallbackPriorityMember,
  LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
  LIVE_FALLBACK_PRIORITY_ID,
  LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
  LIVE_FALLBACK_PRIORITY_MUTATOR_VERSION,
  type MutatorContext,
  pruneFallbackPriorityMember,
  reorderFallbackPriorityMembers,
} from '../../../../src/sync';
import {
  maxFallbackPriorityOrder,
  orderFallbackPriorityMembers,
  seedLiveFallbackPriority,
} from '../../../../src/sync-builders/live-fallback-priority-projection';
import type { LiveFallbackPriorityMember } from '../../../../src/types/live-fallback-priority';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'sw',
  deviceId: 'device-a',
  ...overrides,
});

const member = (principalId: string, order: number, label = `host-${principalId}`): LiveFallbackPriorityMember => ({
  principalId,
  order,
  label,
});

describe('enlistFallbackPriorityMember', () => {
  it('emits one addToSet(members) keyed by principalId, no side-effects', () => {
    const intent = enlistFallbackPriorityMember(ctx(), { member: member('p-a', 0) });
    expect(intent.sideEffects).toEqual([]);
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].mutatorVersion).toBe(LIVE_FALLBACK_PRIORITY_MUTATOR_VERSION);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
      id: LIVE_FALLBACK_PRIORITY_ID,
      path: LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
      itemId: 'p-a',
      item: { principalId: 'p-a', order: 0 },
    });
  });
});

describe('reorderFallbackPriorityMembers', () => {
  it('re-emits every member as addToSet with order re-stamped from array index', () => {
    const intent = reorderFallbackPriorityMembers(ctx(), {
      orderedMembers: [member('p-b', 5, 'Firefox'), member('p-a', 2, 'Chrome'), member('p-c', 9, 'Edge')],
    });
    expect(intent.sideEffects).toEqual([]);
    expect(intent.batch.mutations).toHaveLength(3);
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      expect.objectContaining({
        kind: 'addToSet',
        type: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
        id: LIVE_FALLBACK_PRIORITY_ID,
        path: LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
        itemId: 'p-b',
        item: { principalId: 'p-b', order: 0, label: 'Firefox' },
      }),
      expect.objectContaining({ itemId: 'p-a', item: { principalId: 'p-a', order: 1, label: 'Chrome' } }),
      expect.objectContaining({ itemId: 'p-c', item: { principalId: 'p-c', order: 2, label: 'Edge' } }),
    ]);
  });

  it('emits an empty batch for an empty list', () => {
    expect(reorderFallbackPriorityMembers(ctx(), { orderedMembers: [] }).batch.mutations).toHaveLength(0);
  });
});

describe('pruneFallbackPriorityMember', () => {
  it('emits one removeFromSet tombstone keyed by principalId, no side-effects', () => {
    const intent = pruneFallbackPriorityMember(ctx(), { principalId: 'p-a' });
    expect(intent.sideEffects).toEqual([]);
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'removeFromSet',
      type: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
      id: LIVE_FALLBACK_PRIORITY_ID,
      path: LIVE_FALLBACK_PRIORITY_MEMBERS_PATH,
      itemId: 'p-a',
    });
  });
});

describe('seedLiveFallbackPriority', () => {
  it('emits a create shell + one addToSet per member', () => {
    const batch = seedLiveFallbackPriority(
      { schemaVersion: 5, members: { 'p-a': member('p-a', 0), 'p-b': member('p-b', 1) } },
      ctx(),
    );
    expect(batch.mutations).toHaveLength(3);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'create',
      type: LIVE_FALLBACK_PRIORITY_ENTITY_TYPE,
      id: LIVE_FALLBACK_PRIORITY_ID,
      payload: { schemaVersion: 5 },
    });
    const memberBodies = batch.mutations.slice(1).map((m) => m.body) as Array<{ kind: string; itemId: string }>;
    expect(memberBodies.every((b) => b.kind === 'addToSet')).toBe(true);
    expect(memberBodies.map((b) => b.itemId).sort()).toEqual(['p-a', 'p-b']);
  });
});

describe('orderFallbackPriorityMembers', () => {
  it('sorts by order ascending', () => {
    const members = { 'p-b': member('p-b', 2), 'p-a': member('p-a', 0), 'p-c': member('p-c', 1) };
    expect(orderFallbackPriorityMembers(members)).toEqual(['p-a', 'p-c', 'p-b']);
  });

  it('breaks an order tie by principalId so concurrent same-order appends converge', () => {
    // Two hosts each appended at order 1 (max was 0) before either synced.
    const fromHostA = { 'p-0': member('p-0', 0), 'p-zeta': member('p-zeta', 1), 'p-alpha': member('p-alpha', 1) };
    const fromHostB = { 'p-alpha': member('p-alpha', 1), 'p-0': member('p-0', 0), 'p-zeta': member('p-zeta', 1) };
    expect(orderFallbackPriorityMembers(fromHostA)).toEqual(['p-0', 'p-alpha', 'p-zeta']);
    // Identical result regardless of member insertion order — the property
    // the offline election relies on (no live coordination available).
    expect(orderFallbackPriorityMembers(fromHostB)).toEqual(orderFallbackPriorityMembers(fromHostA));
  });

  it('returns [] for an empty map', () => {
    expect(orderFallbackPriorityMembers({})).toEqual([]);
  });
});

describe('maxFallbackPriorityOrder', () => {
  it('returns -1 for an empty map so the first append takes 0', () => {
    expect(maxFallbackPriorityOrder({})).toBe(-1);
  });

  it('returns the highest order present', () => {
    expect(
      maxFallbackPriorityOrder({ 'p-a': member('p-a', 0), 'p-b': member('p-b', 4), 'p-c': member('p-c', 2) }),
    ).toBe(4);
  });
});
