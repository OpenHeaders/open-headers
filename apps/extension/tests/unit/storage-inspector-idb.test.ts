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
  getIndexedDbRecords,
  IDB_PAGE_SIZE_DEFAULT,
  IDB_PAGE_SIZE_MAX,
  listIdbDatabasesInPage,
  listIndexedDbDatabases,
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

    executeScriptSpy().mockClear();
    executeScriptSpy().mockResolvedValue([{ result: { records: [], truncated: false } }]);
    await getIndexedDbRecords(1, 0, 'oh-app', 'kv', 2, 0);
    const [{ args: args2 }] = executeScriptSpy().mock.calls[0] as [{ args: unknown[] }];
    expect(args2[2]).toBe(2);
    expect(args2[3]).toBe(IDB_PAGE_SIZE_DEFAULT);
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

  it('relays a successful injected delete as { ok: true }', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    expect((await deleteIndexedDbRecord(1, 0, 'a', 'b', '{"s":"k"}')).ok).toBe(true);
    const [{ args }] = executeScriptSpy().mock.calls[0] as [{ args: unknown[] }];
    expect(args).toEqual(['a', 'b', '{"s":"k"}']);
  });
});
