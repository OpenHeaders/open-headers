/**
 * IdbHostStorage contract — hydrate-once reads, write-through
 * persistence across instances (the reload path), subscriptions, and
 * the no-cipher sensitive-slot posture (refuse writes, read absent).
 * Runs against fake-indexeddb: real IDB semantics, fresh factory per
 * case.
 */

import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { storageKey } from '@openheaders/core/storage';
import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';
import { IdbHostStorage } from '@/host/idb-host-storage';

const K_PLAIN = storageKey<string>('test.plain');
const K_LIST = storageKey<Array<{ id: string; name: string }>>('test.list');
const K_OTHER = storageKey<number>('test.other');
const K_SECRET = storageKey<string>('test.secret', undefined, true);

const EntrySchema = v.object({ id: v.string(), name: v.string() });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('IdbHostStorage', () => {
  it('round-trips single and batched writes', async () => {
    const storage = new IdbHostStorage();
    await storage.set(K_PLAIN, 'hello');
    await storage.setMany([
      [K_LIST, [{ id: 'a', name: 'openheaders.io' }]],
      [K_OTHER, 42],
    ]);
    expect(await storage.get(K_PLAIN)).toBe('hello');
    const many = await storage.getMany({ list: K_LIST, other: K_OTHER });
    expect(many.list).toEqual([{ id: 'a', name: 'openheaders.io' }]);
    expect(many.other).toBe(42);
  });

  it('persists across instances — the reload path', async () => {
    const first = new IdbHostStorage();
    await first.set(K_PLAIN, 'survives');
    await first.set(K_OTHER, 7);
    await first.remove(K_OTHER);

    const second = new IdbHostStorage();
    expect(await second.get(K_PLAIN)).toBe('survives');
    expect(await second.get(K_OTHER)).toBeUndefined();
  });

  it('validated reads parse against the schema and default on empty', async () => {
    const storage = new IdbHostStorage();
    expect(await storage.getValidated(K_PLAIN, v.string())).toBeNull();
    expect(await storage.getValidatedArray(K_LIST, EntrySchema)).toEqual([]);
    await storage.set(K_LIST, [{ id: 'a', name: 'openheaders.io' }]);
    expect(await storage.getValidatedArray(K_LIST, EntrySchema)).toEqual([{ id: 'a', name: 'openheaders.io' }]);
  });

  it('fires subscribers on set and remove, and unsubscribes cleanly', async () => {
    const storage = new IdbHostStorage();
    const seen: Array<string | undefined> = [];
    const unsubscribe = storage.subscribe(K_PLAIN, (next) => {
      seen.push(next);
    });
    await storage.set(K_PLAIN, 'one');
    await storage.remove(K_PLAIN);
    unsubscribe();
    await storage.set(K_PLAIN, 'two');
    expect(seen).toEqual(['one', undefined]);
  });

  it('refuses sensitive writes and reads sensitive slots as absent', async () => {
    const storage = new IdbHostStorage();
    await expect(storage.set(K_SECRET, 'nope')).rejects.toThrow(/refusing to write sensitive slot/);
    await expect(storage.setMany([[K_SECRET, 'nope']])).rejects.toThrow(/refusing to write sensitive slot/);
    expect(await storage.get(K_SECRET)).toBeUndefined();
    expect(await storage.getValidated(K_SECRET, v.string())).toBeNull();
  });
});
