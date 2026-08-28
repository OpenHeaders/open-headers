/**
 * Phase C F6.d — inverse-mutation generator contract.
 *
 * The generator reads the InverseEnvelopeContext captured by the F2
 * classifier at observe time, validates the proposed inverse against
 * the current materialized state, and emits an apply-ready batch (or
 * a structured reason for refusal).
 *
 * Tests use a real EntityOracle with the in-memory store so set-member
 * presence and tombstone checks exercise the same path the production
 * RPC uses; batches are hand-built so the test is independent of any
 * entity-specific mutator helper.
 */

import {
  type InverseEnvelopeContext,
  type MutationBatch,
  type MutationBody,
  type MutationEnvelope,
  type MutatorContext,
  newBatchId,
  newMutationId,
} from '@openheaders/core/sync';
import { generateInverseMutation } from '@openheaders/oracle/sync/activity/activity-revert';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { beforeEach, describe, expect, it } from 'vitest';

const WS = '0193a8ff-c000-7000-8000-000000000001';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

function ctx(physicalMs: number, logical = 0, surfaceId = 'test'): MutatorContext {
  return {
    workspaceId: WS,
    orgId: 'org-test',
    hlc: { physicalMs, logical, nodeId: 'n-local' },
    surfaceId,
    deviceId: 'd-local',
  };
}

function batchOf(c: MutatorContext, body: MutationBody): MutationBatch {
  const env: MutationEnvelope = {
    mutationId: newMutationId(),
    hlc: c.hlc,
    origin: { surfaceId: c.surfaceId, deviceId: c.deviceId, userId: c.userId },
    workspaceId: c.workspaceId,
    orgId: 'org-test',
    mutatorVersion: 1,
    body,
  };
  return { batchId: newBatchId(), mutations: [env] };
}

let oracle: EntityOracle;

beforeEach(() => {
  oracle = new EntityOracle({
    workspaceId: WS,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
});

describe('generateInverseMutation — structural', () => {
  it('refuses delete with delete-irreversible (§7.2 tombstone-wins)', () => {
    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 1,
      spec: { kind: 'unavailable', reason: 'delete-irreversible' },
    };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('delete-irreversible');
  });

  it('inverts create → delete and produces an apply-ready batch', async () => {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: {} }), []);
    expect(oracle.materializeOne('rule', 'r1')).not.toBeNull();

    const inverse: InverseEnvelopeContext = { mutatorVersion: 1, spec: { kind: 'create' } };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.mutations[0].body).toMatchObject({ kind: 'delete', type: 'rule', id: 'r1' });

    await oracle.apply(result.batch, []);
    expect(oracle.materializeOne('rule', 'r1')).toBeNull();
  });

  it('refuses non-create inverses against a tombstoned entity', async () => {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: {} }), []);
    await oracle.apply(batchOf(ctx(1_500), { kind: 'delete', type: 'rule', id: 'r1' }), []);

    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 1,
      spec: { kind: 'setField', path: 'name', priorExists: true, priorValue: 'old' },
    };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already-tombstoned');
  });
});

describe('generateInverseMutation — field paths', () => {
  it('emits setField path priorValue when prior existed', async () => {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: {} }), []);

    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 1,
      spec: { kind: 'setField', path: 'name', priorExists: true, priorValue: 'previous' },
    };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: 'rule',
      id: 'r1',
      path: 'name',
      value: 'previous',
    });
  });

  it('downgrades setField inverse to unsetField when prior was absent', async () => {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: {} }), []);

    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 1,
      spec: { kind: 'setField', path: 'name', priorExists: false },
    };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.mutations[0].body).toEqual({
      kind: 'unsetField',
      type: 'rule',
      id: 'r1',
      path: 'name',
    });
  });

  it('returns no-op when unsetField inverse has no prior value (both sides absent)', async () => {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: {} }), []);

    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 1,
      spec: { kind: 'unsetField', path: 'name', priorExists: false },
    };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-op');
  });
});

describe('generateInverseMutation — set paths', () => {
  it('inverts addToSet → removeFromSet against the live oracle', async () => {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: {} }), []);
    await oracle.apply(
      batchOf(ctx(1_100), {
        kind: 'addToSet',
        type: 'rule',
        id: 'r1',
        path: 'tags',
        itemId: 't-1',
        item: 'alpha',
      }),
      [],
    );

    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 1,
      spec: { kind: 'addToSet', path: 'tags', itemId: 't-1' },
    };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.mutations[0].body).toEqual({
      kind: 'removeFromSet',
      type: 'rule',
      id: 'r1',
      path: 'tags',
      itemId: 't-1',
    });
  });

  it('inverts removeFromSet → addToSet with item + orderKey carried in the spec', async () => {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: {} }), []);

    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 1,
      spec: {
        kind: 'removeFromSet',
        path: 'tags',
        itemId: 't-1',
        priorItem: 'alpha',
        priorOrderKey: 'a0',
      },
    };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.mutations[0].body).toEqual({
      kind: 'addToSet',
      type: 'rule',
      id: 'r1',
      path: 'tags',
      itemId: 't-1',
      item: 'alpha',
      orderKey: 'a0',
    });
  });

  it('refuses moveBefore when the prior set item no longer lives in the set', async () => {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: {} }), []);

    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 1,
      spec: {
        kind: 'moveBefore',
        path: 'tags',
        itemId: 't-vanished',
        priorOrderKey: 'a0',
      },
    };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('set-item-missing');
  });

  it('emits moveBefore inverse when the item is still live in the set', async () => {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: {} }), []);
    await oracle.apply(
      batchOf(ctx(1_100), {
        kind: 'addToSet',
        type: 'rule',
        id: 'r1',
        path: 'tags',
        itemId: 't-1',
        item: 'alpha',
        orderKey: 'm0',
      }),
      [],
    );

    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 1,
      spec: { kind: 'moveBefore', path: 'tags', itemId: 't-1', priorOrderKey: 'a0' },
    };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.mutations[0].body).toEqual({
      kind: 'moveBefore',
      type: 'rule',
      id: 'r1',
      path: 'tags',
      itemId: 't-1',
      orderKey: 'a0',
    });
  });
});

describe('generateInverseMutation — envelope stamping', () => {
  it('preserves the original envelope mutatorVersion (wire compatibility with the inbound)', async () => {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: {} }), []);

    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 7,
      spec: { kind: 'setField', path: 'name', priorExists: true, priorValue: 'prev' },
    };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse,
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.mutations[0].mutatorVersion).toBe(7);
  });

  it('stamps the supplied MutatorContext hlc + origin onto the new envelope', () => {
    const inverse: InverseEnvelopeContext = { mutatorVersion: 1, spec: { kind: 'create' } };
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r-absent',
      inverse,
      oracle,
      ctx: ctx(3_141, 5, 'panel'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const env = result.batch.mutations[0];
    expect(env.hlc).toEqual({ physicalMs: 3_141, logical: 5, nodeId: 'n-local' });
    expect(env.origin).toEqual({ surfaceId: 'panel', deviceId: 'd-local', userId: undefined });
    expect(env.workspaceId).toBe(WS);
  });
});

describe('generateInverseMutation — slotTransfer (rehome undo)', () => {
  const ITEMS = 'items';
  const spec = (): InverseEnvelopeContext => ({
    mutatorVersion: 2,
    spec: {
      kind: 'slotTransfer',
      from: { type: 'collection', id: 'col-1', path: ITEMS },
      to: { type: 'folder', id: 'fold-1', path: ITEMS },
      itemId: 'r1',
      item: { uid: 'r1', type: 'rule' },
      orderKey: 'k',
    },
  });

  async function seedParked(withFolder: boolean): Promise<void> {
    await oracle.apply(batchOf(ctx(1_000), { kind: 'create', type: 'rule', id: 'r1', payload: { name: 'r' } }), []);
    await oracle.apply(
      batchOf(ctx(1_001), { kind: 'create', type: 'collection', id: 'col-1', payload: { name: 'c' } }),
      [],
    );
    if (withFolder) {
      await oracle.apply(
        batchOf(ctx(1_002), { kind: 'create', type: 'folder', id: 'fold-1', payload: { name: 'f' } }),
        [],
      );
    }
    await oracle.apply(
      batchOf(ctx(1_003), {
        kind: 'addToSet',
        type: 'collection',
        id: 'col-1',
        path: ITEMS,
        itemId: 'r1',
        item: { uid: 'r1', type: 'rule' },
      }),
      [],
    );
  }

  it('mints the atomic remove + add that moves the child back onto its original container', async () => {
    await seedParked(true);
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse: spec(),
      oracle,
      ctx: ctx(2_000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'removeFromSet', type: 'collection', id: 'col-1', path: ITEMS, itemId: 'r1' },
      {
        kind: 'addToSet',
        type: 'folder',
        id: 'fold-1',
        path: ITEMS,
        itemId: 'r1',
        item: { uid: 'r1', type: 'rule' },
        orderKey: 'k',
      },
    ]);
    expect(result.batch.mutations.every((m) => m.mutatorVersion === 2)).toBe(true);
    expect(result.batch.mutations[0].hlc.logical < result.batch.mutations[1].hlc.logical).toBe(true);
    const applied = await oracle.apply(result.batch, []);
    expect(applied.ok).toBe(true);
    expect(oracle.liveOrderedSetItems('collection', 'col-1', ITEMS)).toEqual([]);
    expect(oracle.liveOrderedSetItems('folder', 'fold-1', ITEMS).map((e) => e.itemId)).toEqual(['r1']);
  });

  it('refuses with original-parent-gone when the container to return to is tombstoned', async () => {
    await seedParked(false);
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse: spec(),
      oracle,
      ctx: ctx(2_000),
    });
    expect(result).toEqual({ ok: false, reason: 'original-parent-gone' });
  });

  it('refuses with set-item-missing when the child no longer sits where the rehome parked it', async () => {
    await seedParked(true);
    await oracle.apply(
      batchOf(ctx(1_500), { kind: 'removeFromSet', type: 'collection', id: 'col-1', path: ITEMS, itemId: 'r1' }),
      [],
    );
    const result = generateInverseMutation({
      entityType: 'rule',
      entityId: 'r1',
      inverse: spec(),
      oracle,
      ctx: ctx(2_000),
    });
    expect(result).toEqual({ ok: false, reason: 'set-item-missing' });
  });

  it('surfaces the recorded unavailable reason verbatim', () => {
    const inverse: InverseEnvelopeContext = {
      mutatorVersion: 2,
      spec: { kind: 'unavailable', reason: 'original-parent-gone' },
    };
    const result = generateInverseMutation({ entityType: 'rule', entityId: 'r1', inverse, oracle, ctx: ctx(2_000) });
    expect(result).toEqual({ ok: false, reason: 'original-parent-gone' });
  });
});
