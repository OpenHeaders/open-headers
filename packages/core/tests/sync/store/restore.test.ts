/**
 * The delete rule (§7.2): existence is last-writer-wins between a
 * `delete` and a restoring `create`, and nothing else writes it. A
 * restore starts the entity over; an edit or a plain create never
 * brings a deleted entity back; a write made after a restore shows
 * whether it arrived before the restore or after.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutationEnvelope, newMutationId } from '../../../src/sync';

const env = (body: MutationEnvelope['body'], ms: number): MutationEnvelope => ({
  mutationId: newMutationId(),
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  orgId: 'org-test',
  mutatorVersion: 1,
  body,
});

const create = (payload: unknown, ms: number) => env({ kind: 'create', type: 'rule', id: 'r1', payload }, ms);
const restore = (payload: unknown, ms: number) =>
  env({ kind: 'create', type: 'rule', id: 'r1', payload, restore: true }, ms);
const remove = (ms: number) => env({ kind: 'delete', type: 'rule', id: 'r1' }, ms);
const setName = (value: string, ms: number) =>
  env({ kind: 'setField', type: 'rule', id: 'r1', path: 'name', value }, ms);
const addMod = (itemId: string, ms: number, path = 'headerMods') =>
  env({ kind: 'addToSet', type: 'rule', id: 'r1', path, itemId, item: { name: itemId } }, ms);

const dataOf = (store: InMemoryDocumentStore) => store.materializeOne('rule', 'r1')?.data ?? null;

describe('delete and restore', () => {
  it('a restore later than the delete brings the entity back', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(2_000));
    expect(store.isTombstoned('rule', 'r1')).toBe(true);

    expect(store.apply(restore({ name: 'back' }, 3_000)).status).toBe('applied');
    expect(dataOf(store)).toEqual({ name: 'back' });
    expect(store.isTombstoned('rule', 'r1')).toBe(false);
  });

  it('a plain create later than the delete brings nothing back', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(2_000));

    expect(store.apply(create({ name: 'again' }, 3_000)).status).toBe('tombstoned');
    expect(dataOf(store)).toBeNull();
    expect(store.isTombstoned('rule', 'r1')).toBe(true);
  });

  it('an edit later than the delete brings nothing back', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(2_000));

    expect(store.apply(setName('edited', 3_000)).status).toBe('tombstoned');
    expect(store.apply(addMod('x', 3_100)).status).toBe('tombstoned');
    expect(dataOf(store)).toBeNull();
  });

  it('a restore older than the delete loses to it', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(3_000));

    expect(store.apply(restore({ name: 'back' }, 2_000)).status).toBe('tombstoned');
    expect(dataOf(store)).toBeNull();
  });

  it('a delete later than the restore deletes the entity again', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(2_000));
    store.apply(restore({ name: 'back' }, 3_000));

    expect(store.apply(remove(4_000)).status).toBe('applied');
    expect(dataOf(store)).toBeNull();
    expect(store.isTombstoned('rule', 'r1')).toBe(true);
  });

  it('a delete older than the restore changes nothing', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(2_000));
    store.apply(restore({ name: 'back' }, 4_000));

    expect(store.apply(remove(3_000)).status).toBe('superseded-by-hlc');
    expect(dataOf(store)).toEqual({ name: 'back' });
  });

  it('a restore starts the entity over: a field written before it does not show', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first', description: 'old' }, 1_000));
    store.apply(remove(2_000));
    store.apply(restore({ name: 'back' }, 3_000));

    expect(dataOf(store)).toEqual({ name: 'back' });
    expect(store.materializeOne('rule', 'r1')?.fieldOrigins).toEqual({ name: 'local' });
  });

  it('a restore starts the entity over: a set member and a set path from before do not show', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(addMod('old', 1_100));
    store.apply(addMod('other', 1_200, 'conditions'));
    store.apply(remove(2_000));
    store.apply(restore({ name: 'back' }, 3_000));
    store.apply(addMod('new', 3_100));

    expect(dataOf(store)).toEqual({ name: 'back', headerMods: [{ name: 'new' }] });
    expect(store.liveSetItems('rule', 'r1', 'headerMods').map((entry) => entry.itemId)).toEqual(['new']);
    expect(store.liveSetItems('rule', 'r1', 'conditions')).toEqual([]);
  });

  it('an edit written between the delete and the restore does not show', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(2_000));
    store.apply(env({ kind: 'setField', type: 'rule', id: 'r1', path: 'description', value: 'stale' }, 2_500));
    store.apply(restore({ name: 'back' }, 3_000));

    expect(dataOf(store)).toEqual({ name: 'back' });
  });

  it('a write made after the restore shows, though it arrived before the restore did', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(2_000));

    expect(store.apply(setName('after', 4_000)).status).toBe('tombstoned');
    expect(store.apply(addMod('x', 4_100)).status).toBe('tombstoned');
    store.apply(restore({ name: 'back' }, 3_000));

    expect(dataOf(store)).toEqual({ name: 'after', headerMods: [{ name: 'x' }] });
  });

  it('an edit older than the restore answers superseded on the restored entity', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(2_000));
    store.apply(restore({ name: 'back' }, 3_000));

    expect(
      store.apply(env({ kind: 'setField', type: 'rule', id: 'r1', path: 'description', value: 'late' }, 2_500)).status,
    ).toBe('superseded-by-hlc');
    expect(dataOf(store)).toEqual({ name: 'back' });
  });

  it('a second restore starts the entity over again', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(2_000));
    store.apply(restore({ name: 'back', description: 'one' }, 3_000));
    store.apply(remove(4_000));
    store.apply(restore({ name: 'twice' }, 5_000));

    expect(dataOf(store)).toEqual({ name: 'twice' });
  });

  it('a restore on a replica that never saw the delete starts the entity over all the same', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first', description: 'old' }, 1_000));
    store.apply(restore({ name: 'back' }, 3_000));
    expect(dataOf(store)).toEqual({ name: 'back' });

    store.apply(remove(2_000));
    expect(dataOf(store)).toEqual({ name: 'back' });
  });

  it('the store rollback carries the restore', () => {
    const store = new InMemoryDocumentStore();
    store.apply(create({ name: 'first' }, 1_000));
    store.apply(remove(2_000));
    store.apply(restore({ name: 'back' }, 3_000));
    const snapshot = store.snapshot();
    store.apply(remove(4_000));
    expect(dataOf(store)).toBeNull();

    store.restore(snapshot);
    expect(dataOf(store)).toEqual({ name: 'back' });
  });
});
