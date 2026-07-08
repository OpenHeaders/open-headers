/**
 * IndexedDB read + delete planes (STORAGE_PANEL_PLAN.md §5, slice 4) —
 * the injected enumeration/cursor/delete funcs run against
 * fake-indexeddb (real IDB semantics: versionless opens, upgrade
 * events, cursors, blocked deletes), plus the SW wrappers' clamps and
 * wire mapping over the mocked `chrome.scripting` transport.
 */

import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, type vi } from 'vitest';
import {
  clearIdbStoreInPage,
  clearIndexedDbStore,
  deleteIdbDatabaseInPage,
  deleteIdbRecordInPage,
  deleteIndexedDbDatabase,
  deleteIndexedDbRecord,
  getIndexedDbRecordDocument,
  getIndexedDbRecords,
  IDB_DOCUMENT_TEXT_MAX,
  IDB_PAGE_SIZE_DEFAULT,
  IDB_PAGE_SIZE_MAX,
  listIdbDatabasesInPage,
  listIndexedDbDatabases,
  putIdbRecordInPage,
  putIndexedDbRecord,
  readIdbRecordDocumentInPage,
  readIdbRecordsInPage,
} from '@/background/modules/storage-inspector/standard-plane-idb';

const executeScriptSpy = (): ReturnType<typeof vi.fn> =>
  chrome.scripting.executeScript as unknown as ReturnType<typeof vi.fn>;

function seedDb(name: string, version: number, setup: (db: IDBDatabase) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = () => setup(req.result);
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

function putRecords(name: string, store: string, values: Array<{ key?: IDBValidKey; value: unknown }>): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(store, 'readwrite');
      for (const { key, value } of values) {
        if (key !== undefined) tx.objectStore(store).put(value, key);
        else tx.objectStore(store).put(value);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

beforeEach(() => {
  // Fresh IDB universe per test.
  globalThis.indexedDB = new IDBFactory();
  executeScriptSpy().mockReset();
});

describe('listIdbDatabasesInPage', () => {
  it('enumerates databases with store shapes (keyPath, autoIncrement, indexes)', async () => {
    await seedDb('oh-app', 2, (db) => {
      const kv = db.createObjectStore('kv', { keyPath: 'id' });
      kv.createIndex('byName', 'name');
      db.createObjectStore('blobs', { autoIncrement: true });
    });

    const { databases } = await listIdbDatabasesInPage(100);
    expect(databases).toHaveLength(1);
    expect(databases?.[0]).toMatchObject({ name: 'oh-app', version: 2 });
    const stores = databases?.[0]?.objectStores ?? [];
    expect(stores).toContainEqual({ name: 'kv', keyPath: 'id', autoIncrement: false, indexNames: ['byName'] });
    expect(stores).toContainEqual({ name: 'blobs', keyPath: null, autoIncrement: true, indexNames: [] });
  });

  it('joins a composite keyPath into a display string', async () => {
    await seedDb('oh-composite', 1, (db) => {
      db.createObjectStore('pairs', { keyPath: ['a', 'b'] });
    });
    const { databases } = await listIdbDatabasesInPage(100);
    expect(databases?.[0]?.objectStores[0]?.keyPath).toBe('a, b');
  });

  it('caps the enumeration at maxDatabases', async () => {
    await seedDb('oh-one', 1, (db) => db.createObjectStore('s'));
    await seedDb('oh-two', 1, (db) => db.createObjectStore('s'));
    const { databases } = await listIdbDatabasesInPage(1);
    expect(databases).toHaveLength(1);
  });
});

describe('readIdbRecordsInPage', () => {
  it('pages through a store with the cursor and flags truncation', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv', { keyPath: 'id' }));
    await putRecords(
      'oh-app',
      'kv',
      Array.from({ length: 120 }, (_, i) => ({ value: { id: i, name: `item-${i}` } })),
    );

    const first = await readIdbRecordsInPage('oh-app', 'kv', 0, 50, 1024);
    expect(first.records).toHaveLength(50);
    expect(first.truncated).toBe(true);
    expect(first.records?.[0]).toMatchObject({ keyPreview: '0', primaryKeyPreview: '0' });
    expect(first.records?.[0]?.valuePreview).toContain('name: "item-0"');

    const last = await readIdbRecordsInPage('oh-app', 'kv', 2, 50, 1024);
    expect(last.records).toHaveLength(20);
    expect(last.truncated).toBe(false);
    expect(last.records?.[0]?.keyPreview).toBe('100');
  });

  it('reports a missing store as unreadable', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    const result = await readIdbRecordsInPage('oh-app', 'gone', 0, 50, 1024);
    expect(result.records).toBeNull();
  });

  it('reads through an index: key column is the index key, identity stays the primary key', async () => {
    await seedDb('oh-app', 1, (db) => {
      const orders = db.createObjectStore('orders', { keyPath: 'id' });
      orders.createIndex('by-user', 'user');
    });
    await putRecords('oh-app', 'orders', [{ value: { id: 1, user: 'zoe' } }, { value: { id: 2, user: 'amy' } }]);

    const viaIndex = await readIdbRecordsInPage('oh-app', 'orders', 0, 50, 1024, 'by-user');
    expect(viaIndex.records?.map((r) => r.keyPreview)).toEqual(['"amy"', '"zoe"']);
    expect(viaIndex.records?.map((r) => r.primaryKeyPreview)).toEqual(['2', '1']);

    // A delete from the index view rides the same primary-key wire.
    const wire = viaIndex.records?.[0]?.primaryKeyWire;
    expect((await deleteIdbRecordInPage('oh-app', 'orders', wire as string)).ok).toBe(true);
    const after = await readIdbRecordsInPage('oh-app', 'orders', 0, 50, 1024);
    expect(after.records?.map((r) => r.keyPreview)).toEqual(['1']);
  });

  it('reports a missing index as unreadable', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    const result = await readIdbRecordsInPage('oh-app', 'kv', 0, 50, 1024, 'gone');
    expect(result.records).toBeNull();
  });

  it('does not CREATE a database that was deleted since enumeration', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    const result = await readIdbRecordsInPage('oh-ghost', 'kv', 0, 50, 1024);
    expect(result.records).toBeNull();
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toEqual(['oh-app']);
  });

  it('preview-serializes structured-clone values type-tagged, depth- and length-capped', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    // No ArrayBuffer/Blob here: fake-indexeddb's structured clone doesn't
    // preserve their identities the way a real page does, so their tags
    // can't be asserted through this harness.
    await putRecords('oh-app', 'kv', [
      {
        key: 'rich',
        value: {
          when: new Date('2026-07-07T00:00:00.000Z'),
          list: Array.from({ length: 15 }, (_, i) => i),
          nested: { a: { b: { c: 1 } } },
        },
      },
      { key: 'long', value: 'x'.repeat(500) },
    ]);

    const { records } = await readIdbRecordsInPage('oh-app', 'kv', 0, 50, 100);
    const rich = records?.find((r) => r.keyPreview === '"rich"');
    // previewMax 100 clips the whole preview string with an ellipsis…
    expect(rich?.valuePreview.length).toBe(101);
    expect(rich?.valuePreview.endsWith('…')).toBe(true);

    // …so re-read with room to assert the tags and caps themselves.
    const wide = await readIdbRecordsInPage('oh-app', 'kv', 0, 50, 2048);
    const richWide = wide.records?.find((r) => r.keyPreview === '"rich"');
    expect(richWide?.valuePreview).toContain('Date(2026-07-07T00:00:00.000Z)');
    expect(richWide?.valuePreview).toContain('… +5 more');
    // Depth cap (3 levels in): the deepest object renders as a stub.
    expect(richWide?.valuePreview).toContain('b: {…1}');
    expect(richWide?.valuePreview).not.toContain('c: 1');

    const long = wide.records?.find((r) => r.keyPreview === '"long"');
    expect(long?.valuePreview.startsWith('"xxx')).toBe(true);
  });
});

describe('primary-key wire encoding', () => {
  it('encodes string / number / Date / array / ±Infinity keys losslessly', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    await putRecords('oh-app', 'kv', [
      { key: 'str-key', value: 1 },
      { key: 42.5, value: 2 },
      { key: new Date('2026-07-08T10:20:30.456Z'), value: 3 },
      { key: ['tenant', 7, new Date('2026-01-01T00:00:00.000Z')], value: 4 },
      { key: Number.POSITIVE_INFINITY, value: 5 },
      { key: Number.NEGATIVE_INFINITY, value: 6 },
    ]);

    const { records } = await readIdbRecordsInPage('oh-app', 'kv', 0, 50, 1024);
    expect(records).toHaveLength(6);
    const wires = (records ?? []).map((r) => r.primaryKeyWire);
    expect(JSON.parse(wires.find((w) => w?.includes('str-key')) as string)).toEqual({ s: 'str-key' });
    expect(JSON.parse(wires.find((w) => w?.includes('42.5')) as string)).toEqual({ n: 42.5 });
    expect(JSON.parse(wires.find((w) => w?.includes('10:20:30')) as string)).toEqual({
      d: '2026-07-08T10:20:30.456Z',
    });
    expect(JSON.parse(wires.find((w) => w?.includes('tenant')) as string)).toEqual({
      a: [{ s: 'tenant' }, { n: 7 }, { d: '2026-01-01T00:00:00.000Z' }],
    });
    const infinity = records?.find((r) => r.keyPreview === 'Infinity');
    expect(JSON.parse(infinity?.primaryKeyWire as string)).toEqual({ inf: 1 });
    const negInfinity = records?.find((r) => r.keyPreview === '-Infinity');
    expect(JSON.parse(negInfinity?.primaryKeyWire as string)).toEqual({ inf: -1 });
  });

  it('encodes binary keys as base64 bytes', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    await putRecords('oh-app', 'kv', [{ key: new Uint8Array([1, 2, 3]).buffer, value: 'bin' }]);

    const { records } = await readIdbRecordsInPage('oh-app', 'kv', 0, 50, 1024);
    expect(records).toHaveLength(1);
    expect(JSON.parse(records?.[0]?.primaryKeyWire as string)).toEqual({ b: 'AQID' });
  });
});

describe('readIdbRecordDocumentInPage', () => {
  it('ships a JSON-safe value as exact pretty JSON that round-trips (editable)', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    const value = {
      user: 'user-1',
      seq: 1,
      total: 10.5,
      active: true,
      note: null,
      tags: ['a', 'b'],
      nested: { deep: { deeper: 1 } },
    };
    await putRecords('oh-app', 'kv', [{ key: 'plain', value }]);

    const { document } = await readIdbRecordDocumentInPage('oh-app', 'kv', '{"s":"plain"}', 1_000_000);
    expect(document?.editable).toBe(true);
    expect(document?.truncated).toBeUndefined();
    expect(document?.text).toBe(JSON.stringify(value, null, 2));
    expect(JSON.parse(document?.text as string)).toEqual(value);
  });

  it('ships non-JSON structured-clone content as a readable JSON-ish rendering (read-only)', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    await putRecords('oh-app', 'kv', [
      {
        key: 'rich',
        value: {
          when: new Date('2026-07-08T00:00:00.000Z'),
          lookup: new Map<string, number>([['a', 1]]),
          tags: new Set(['x']),
          items: [1, 'two'],
          missing: undefined,
        },
      },
    ]);

    const { document } = await readIdbRecordDocumentInPage('oh-app', 'kv', '{"s":"rich"}', 1_000_000);
    expect(document?.editable).toBe(false);
    expect(document?.text).toContain('"when": Date("2026-07-08T00:00:00.000Z")');
    expect(document?.text).toContain('Map(1) {');
    expect(document?.text).toContain('"a" => 1');
    expect(document?.text).toContain('Set(1) {');
    expect(document?.text).toContain('"missing": undefined');
    // The JSON-safe corner still prints as JSON.
    expect(document?.text).toContain('"two"');
  });

  it('renders a cyclic value as [Circular] and a literal undefined record honestly', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    const cyclic: { name: string; self?: unknown } = { name: 'loop' };
    cyclic.self = cyclic;
    await putRecords('oh-app', 'kv', [
      { key: 'cyclic', value: cyclic },
      { key: 'nothing', value: undefined },
    ]);

    const cyclicDoc = (await readIdbRecordDocumentInPage('oh-app', 'kv', '{"s":"cyclic"}', 1_000_000)).document;
    expect(cyclicDoc?.editable).toBe(false);
    expect(cyclicDoc?.text).toContain('[Circular]');

    const nothingDoc = (await readIdbRecordDocumentInPage('oh-app', 'kv', '{"s":"nothing"}', 1_000_000)).document;
    expect(nothingDoc?.editable).toBe(false);
    expect(nothingDoc?.text).toBe('undefined');
  });

  it('cuts the text at the size cap and turns the document read-only (value stays explorable)', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    await putRecords('oh-app', 'kv', [{ key: 'big', value: { blob: 'x'.repeat(500) } }]);

    const { document } = await readIdbRecordDocumentInPage('oh-app', 'kv', '{"s":"big"}', 100);
    expect(document?.truncated).toBe(true);
    expect(document?.editable).toBe(false);
    expect(document?.text.length).toBe(101);
    expect(document?.text.endsWith('…')).toBe(true);
    // The bounded preview tree still carries the whole (small) value.
    expect(document?.preview?.kind).toBe('container');
  });

  it('ships a bounded preview tree alongside read-only documents; editable ones carry none', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    await putRecords('oh-app', 'kv', [
      { key: 'plain', value: { id: 1 } },
      {
        key: 'rich',
        value: {
          when: new Date('2026-07-08T00:00:00.000Z'),
          lookup: new Map<string, number>([['a', 1]]),
          tags: new Set(['x']),
          items: [1, 'two'],
          missing: undefined,
        },
      },
    ]);

    const plain = (await readIdbRecordDocumentInPage('oh-app', 'kv', '{"s":"plain"}', 1_000_000)).document;
    expect(plain?.editable).toBe(true);
    expect(plain?.preview).toBeUndefined();

    const rich = (await readIdbRecordDocumentInPage('oh-app', 'kv', '{"s":"rich"}', 1_000_000)).document;
    const root = rich?.preview;
    if (root?.kind !== 'container') throw new Error('expected a container root');
    expect(root.label).toBe('{5}');
    // Alphabetical property order — browser object-view parity.
    expect(root.entries.map((e) => e.key)).toEqual(['"items": ', '"lookup": ', '"missing": ', '"tags": ', '"when": ']);
    const byKey = new Map(root.entries.map((e) => [e.key, e.node]));

    expect(byKey.get('"when": ')).toEqual({ kind: 'atom', type: 'tag', text: 'Date("2026-07-08T00:00:00.000Z")' });
    expect(byKey.get('"missing": ')).toEqual({ kind: 'atom', type: 'tag', text: 'undefined' });

    const lookup = byKey.get('"lookup": ');
    if (lookup?.kind !== 'container') throw new Error('expected a Map container');
    expect(lookup.label).toBe('Map(1)');
    expect(lookup.entries).toEqual([{ key: '"a" => ', node: { kind: 'atom', type: 'number', text: '1' } }]);

    const tags = byKey.get('"tags": ');
    if (tags?.kind !== 'container') throw new Error('expected a Set container');
    expect(tags.label).toBe('Set(1)');
    expect(tags.entries).toEqual([{ key: '', node: { kind: 'atom', type: 'string', text: 'x' } }]);

    const items = byKey.get('"items": ');
    if (items?.kind !== 'container') throw new Error('expected an Array container');
    expect(items.label).toBe('Array(2)');
    expect(items.entries).toEqual([
      { key: '0: ', node: { kind: 'atom', type: 'number', text: '1' } },
      { key: '1: ', node: { kind: 'atom', type: 'string', text: 'two' } },
    ]);
  });

  it('caps preview containers and marks cycles', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    const wide: Record<string, unknown> = { when: new Date('2026-07-08T00:00:00.000Z') };
    for (let i = 0; i < 150; i++) wide[`k${i}`] = i;
    const cyclic: { name: string; self?: unknown; when?: Date } = { name: 'loop' };
    cyclic.self = cyclic;
    cyclic.when = new Date('2026-07-08T00:00:00.000Z');
    await putRecords('oh-app', 'kv', [
      { key: 'wide', value: wide },
      { key: 'cyclic', value: cyclic },
    ]);

    const wideDoc = (await readIdbRecordDocumentInPage('oh-app', 'kv', '{"s":"wide"}', 1_000_000)).document;
    const wideRoot = wideDoc?.preview;
    if (wideRoot?.kind !== 'container') throw new Error('expected a container root');
    expect(wideRoot.entries).toHaveLength(101);
    expect(wideRoot.entries[100]).toEqual({ key: '', node: { kind: 'atom', type: 'tag', text: '… +51 more' } });

    const cyclicDoc = (await readIdbRecordDocumentInPage('oh-app', 'kv', '{"s":"cyclic"}', 1_000_000)).document;
    const cyclicRoot = cyclicDoc?.preview;
    if (cyclicRoot?.kind !== 'container') throw new Error('expected a container root');
    const self = cyclicRoot.entries.find((e) => e.key === '"self": ');
    expect(self?.node).toEqual({ kind: 'atom', type: 'tag', text: '[Circular]' });
  });

  it('reports a gone record, an undecodable key and a ghost database as null', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    await putRecords('oh-app', 'kv', [{ key: 'present', value: 1 }]);

    expect((await readIdbRecordDocumentInPage('oh-app', 'kv', '{"s":"gone"}', 1_000_000)).document).toBeNull();
    expect((await readIdbRecordDocumentInPage('oh-app', 'kv', 'not-json', 1_000_000)).document).toBeNull();
    expect((await readIdbRecordDocumentInPage('oh-ghost', 'kv', '{"s":"present"}', 1_000_000)).document).toBeNull();
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toEqual(['oh-app']);
  });
});

describe('putIdbRecordInPage', () => {
  function readValue(name: string, store: string, key: IDBValidKey): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => {
        const db = req.result;
        const get = db.transaction(store, 'readonly').objectStore(store).get(key);
        get.onsuccess = () => {
          db.close();
          resolve(get.result);
        };
        get.onerror = () => reject(get.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function countRecords(name: string, store: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => {
        const db = req.result;
        const count = db.transaction(store, 'readonly').objectStore(store).count();
        count.onsuccess = () => {
          db.close();
          resolve(count.result);
        };
        count.onerror = () => reject(count.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  it('round-trips an edited value for an in-value keyPath store', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('bulk', { keyPath: 'id' }));
    await putRecords('oh-app', 'bulk', [{ value: { id: 7, label: 'orig' } }]);

    const text = JSON.stringify({ id: 7, label: 'edited', extra: true });
    expect(await putIdbRecordInPage('oh-app', 'bulk', '{"n":7}', text)).toEqual({ ok: true });
    expect(await readValue('oh-app', 'bulk', 7)).toEqual({ id: 7, label: 'edited', extra: true });
    expect(await countRecords('oh-app', 'bulk')).toBe(1);
  });

  it('rejects text that is not valid JSON before touching the store', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('bulk', { keyPath: 'id' }));
    await putRecords('oh-app', 'bulk', [{ value: { id: 7, label: 'orig' } }]);

    expect(await putIdbRecordInPage('oh-app', 'bulk', '{"n":7}', '{not json')).toEqual({
      ok: false,
      reason: 'parse',
    });
    expect(await readValue('oh-app', 'bulk', 7)).toEqual({ id: 7, label: 'orig' });
  });

  it('rejects an in-value key that changed or went missing — no silent duplicate', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('bulk', { keyPath: 'id' }));
    await putRecords('oh-app', 'bulk', [{ value: { id: 7, label: 'orig' } }]);

    expect(await putIdbRecordInPage('oh-app', 'bulk', '{"n":7}', '{"id":8,"label":"moved"}')).toEqual({
      ok: false,
      reason: 'key-changed',
    });
    expect(await putIdbRecordInPage('oh-app', 'bulk', '{"n":7}', '{"label":"keyless"}')).toEqual({
      ok: false,
      reason: 'key-changed',
    });
    expect(await countRecords('oh-app', 'bulk')).toBe(1);
    expect(await readValue('oh-app', 'bulk', 7)).toEqual({ id: 7, label: 'orig' });
  });

  it('compares a composite keyPath element-wise', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('orders', { keyPath: ['user', 'seq'] }));
    await putRecords('oh-app', 'orders', [{ value: { user: 'user-1', seq: 1, total: 10 } }]);
    const wire = '{"a":[{"s":"user-1"},{"n":1}]}';

    expect(await putIdbRecordInPage('oh-app', 'orders', wire, '{"user":"user-1","seq":2,"total":10}')).toEqual({
      ok: false,
      reason: 'key-changed',
    });
    expect(await putIdbRecordInPage('oh-app', 'orders', wire, '{"user":"user-1","seq":1,"total":99}')).toEqual({
      ok: true,
    });
    expect(await readValue('oh-app', 'orders', ['user-1', 1])).toEqual({ user: 'user-1', seq: 1, total: 99 });
    expect(await countRecords('oh-app', 'orders')).toBe(1);
  });

  it('walks a dotted keyPath into the value', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('nested', { keyPath: 'meta.id' }));
    await putRecords('oh-app', 'nested', [{ value: { meta: { id: 'k1' }, label: 'orig' } }]);

    expect(await putIdbRecordInPage('oh-app', 'nested', '{"s":"k1"}', '{"meta":{"id":"k2"},"label":"x"}')).toEqual({
      ok: false,
      reason: 'key-changed',
    });
    expect(await putIdbRecordInPage('oh-app', 'nested', '{"s":"k1"}', '{"meta":{"id":"k1"},"label":"edited"}')).toEqual(
      { ok: true },
    );
    expect(await readValue('oh-app', 'nested', 'k1')).toEqual({ meta: { id: 'k1' }, label: 'edited' });
  });

  it('puts with the decoded wire key for out-of-line keys', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    await putRecords('oh-app', 'kv', [{ key: 'plain', value: { tag: 'orig' } }]);

    expect(await putIdbRecordInPage('oh-app', 'kv', '{"s":"plain"}', '{"tag":"edited"}')).toEqual({ ok: true });
    expect(await readValue('oh-app', 'kv', 'plain')).toEqual({ tag: 'edited' });
    expect(await countRecords('oh-app', 'kv')).toBe(1);
  });

  it('reports a gone store, an undecodable key and a ghost database honestly', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));

    expect(await putIdbRecordInPage('oh-app', 'gone', '{"s":"k"}', '{}')).toEqual({ ok: false, reason: 'gone' });
    expect(await putIdbRecordInPage('oh-app', 'kv', 'not-json', '{}')).toEqual({ ok: false, reason: 'gone' });
    expect(await putIdbRecordInPage('oh-app', 'kv', '{"x":1}', '{}')).toEqual({ ok: false, reason: 'gone' });
    expect(await putIdbRecordInPage('oh-ghost', 'kv', '{"s":"k"}', '{}')).toEqual({ ok: false, reason: 'gone' });
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toEqual(['oh-app']);
  });
});

describe('injected delete plane', () => {
  it('deletes one record by its wire key for every encodable key type', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    await putRecords('oh-app', 'kv', [
      { key: 'str-key', value: 'a' },
      { key: 7, value: 'b' },
      { key: new Date('2026-07-08T00:00:00.000Z'), value: 'c' },
      { key: [1, 'two'], value: 'd' },
      { key: Number.POSITIVE_INFINITY, value: 'e' },
      { key: Number.NEGATIVE_INFINITY, value: 'f' },
      { key: new Uint8Array([9, 8]).buffer, value: 'g' },
    ]);

    const { records } = await readIdbRecordsInPage('oh-app', 'kv', 0, 50, 1024);
    expect(records).toHaveLength(7);
    for (const record of records ?? []) {
      const result = await deleteIdbRecordInPage('oh-app', 'kv', record.primaryKeyWire as string);
      expect(result.ok).toBe(true);
    }
    const after = await readIdbRecordsInPage('oh-app', 'kv', 0, 50, 1024);
    expect(after.records).toHaveLength(0);
  });

  it('rejects an undecodable wire key', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    expect((await deleteIdbRecordInPage('oh-app', 'kv', 'not-json')).ok).toBe(false);
    expect((await deleteIdbRecordInPage('oh-app', 'kv', '{"x":1}')).ok).toBe(false);
  });

  it('reports a missing store as failure and never creates a ghost database', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    expect((await deleteIdbRecordInPage('oh-app', 'gone', '{"s":"k"}')).ok).toBe(false);
    expect((await deleteIdbRecordInPage('oh-ghost', 'kv', '{"s":"k"}')).ok).toBe(false);
    expect((await clearIdbStoreInPage('oh-ghost', 'kv')).ok).toBe(false);
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toEqual(['oh-app']);
  });

  it('clears a whole store', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    await putRecords(
      'oh-app',
      'kv',
      Array.from({ length: 5 }, (_, i) => ({ key: i, value: `v${i}` })),
    );
    expect((await clearIdbStoreInPage('oh-app', 'kv')).ok).toBe(true);
    const after = await readIdbRecordsInPage('oh-app', 'kv', 0, 50, 1024);
    expect(after.records).toHaveLength(0);
  });

  it('deletes a whole database', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    await seedDb('oh-keep', 1, (db) => db.createObjectStore('kv'));
    expect((await deleteIdbDatabaseInPage('oh-app')).ok).toBe(true);
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).toEqual(['oh-keep']);
  });

  it('reports a blocked database delete as failure', async () => {
    await seedDb('oh-app', 1, (db) => db.createObjectStore('kv'));
    // A held connection with no versionchange handler blocks the delete.
    const held = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('oh-app');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect((await deleteIdbDatabaseInPage('oh-app')).ok).toBe(false);
    held.close();
  });
});

describe('SW wrappers over the injection transport', () => {
  it('clamps page and pageSize before injecting', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { records: [], truncated: false } }]);
    await getIndexedDbRecords(1, 0, 'oh-app', 'kv', -5, 99_999);
    const [{ args }] = executeScriptSpy().mock.calls[0] as [{ args: unknown[] }];
    expect(args[2]).toBe(0);
    expect(args[3]).toBe(IDB_PAGE_SIZE_MAX);
    expect(args[5]).toBeNull();

    executeScriptSpy().mockClear();
    executeScriptSpy().mockResolvedValue([{ result: { records: [], truncated: false } }]);
    await getIndexedDbRecords(1, 0, 'oh-app', 'kv', 2, 0);
    const [{ args: args2 }] = executeScriptSpy().mock.calls[0] as [{ args: unknown[] }];
    expect(args2[2]).toBe(2);
    expect(args2[3]).toBe(IDB_PAGE_SIZE_DEFAULT);
  });

  it('passes the index through to the injected reader and rejects a non-string one', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { records: [], truncated: false } }]);
    await getIndexedDbRecords(1, 0, 'oh-app', 'kv', 0, 50, 'by-user');
    const [{ args }] = executeScriptSpy().mock.calls[0] as [{ args: unknown[] }];
    expect(args[5]).toBe('by-user');

    executeScriptSpy().mockClear();
    expect((await getIndexedDbRecords(1, 0, 'oh-app', 'kv', 0, 50, 7 as unknown as string)).records).toBeNull();
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('maps the injected database list to the wire shape (null keyPath omitted)', async () => {
    executeScriptSpy().mockResolvedValue([
      {
        result: {
          databases: [
            {
              name: 'oh-app',
              version: 1,
              objectStores: [{ name: 'kv', keyPath: null, autoIncrement: true, indexNames: [] }],
            },
          ],
        },
      },
    ]);
    const { databases } = await listIndexedDbDatabases(1, 0);
    expect(databases?.[0]?.objectStores[0]).toEqual({ name: 'kv', autoIncrement: true, indexNames: [] });
  });

  it('reports injection failure as null', async () => {
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await listIndexedDbDatabases(1, 0)).databases).toBeNull();
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await getIndexedDbRecords(1, 0, 'a', 'b', 0, 50)).records).toBeNull();
  });

  it('reports delete-op injection failure and bad args as { ok: false }', async () => {
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await deleteIndexedDbRecord(1, 0, 'a', 'b', '{"s":"k"}')).ok).toBe(false);
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await clearIndexedDbStore(1, 0, 'a', 'b')).ok).toBe(false);
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await deleteIndexedDbDatabase(1, 0, 'a')).ok).toBe(false);

    executeScriptSpy().mockClear();
    expect((await deleteIndexedDbRecord(1, 0, 'a', 'b', undefined as unknown as string)).ok).toBe(false);
    expect((await clearIndexedDbStore(1, 0, 'a', undefined as unknown as string)).ok).toBe(false);
    expect((await deleteIndexedDbDatabase(1, 0, undefined as unknown as string)).ok).toBe(false);
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('relays the record-document read with its size cap and rejects bad args', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { document: { text: '{}', editable: true } } }]);
    const { document } = await getIndexedDbRecordDocument(1, 0, 'oh-app', 'kv', '{"s":"k"}');
    expect(document).toEqual({ text: '{}', editable: true });
    const [{ args }] = executeScriptSpy().mock.calls[0] as [{ args: unknown[] }];
    expect(args).toEqual(['oh-app', 'kv', '{"s":"k"}', IDB_DOCUMENT_TEXT_MAX]);

    executeScriptSpy().mockClear();
    expect(
      (await getIndexedDbRecordDocument(1, 0, 'oh-app', 'kv', undefined as unknown as string)).document,
    ).toBeNull();
    expect(executeScriptSpy()).not.toHaveBeenCalled();

    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await getIndexedDbRecordDocument(1, 0, 'oh-app', 'kv', '{"s":"k"}')).document).toBeNull();
  });

  it('relays the record put with its args and passes the failure reason through', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { ok: false, reason: 'key-changed' } }]);
    expect(await putIndexedDbRecord(1, 0, 'oh-app', 'bulk', '{"n":7}', '{"id":8}')).toEqual({
      ok: false,
      reason: 'key-changed',
    });
    const [{ args }] = executeScriptSpy().mock.calls[0] as [{ args: unknown[] }];
    expect(args).toEqual(['oh-app', 'bulk', '{"n":7}', '{"id":8}']);

    executeScriptSpy().mockClear();
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    expect(await putIndexedDbRecord(1, 0, 'oh-app', 'bulk', '{"n":7}', '{"id":7}')).toEqual({ ok: true });
  });

  it('reports put injection failure as gone and rejects bad args without injecting', async () => {
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect(await putIndexedDbRecord(1, 0, 'oh-app', 'bulk', '{"n":7}', '{}')).toEqual({ ok: false, reason: 'gone' });

    executeScriptSpy().mockClear();
    expect(await putIndexedDbRecord(1, 0, 'oh-app', 'bulk', '{"n":7}', undefined as unknown as string)).toEqual({
      ok: false,
    });
    expect(await putIndexedDbRecord(1, 0, 'oh-app', undefined as unknown as string, '{"n":7}', '{}')).toEqual({
      ok: false,
    });
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('relays a successful injected delete as { ok: true }', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    expect((await deleteIndexedDbRecord(1, 0, 'a', 'b', '{"s":"k"}')).ok).toBe(true);
    const [{ args }] = executeScriptSpy().mock.calls[0] as [{ args: unknown[] }];
    expect(args).toEqual(['a', 'b', '{"s":"k"}']);
  });
});
