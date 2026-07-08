/**
 * IndexedDB plane e2e (STORAGE_PANEL_PLAN.md §5, slice 4) — drives the
 * SW storage-inspector handlers end-to-end over the real bridge against
 * a REAL browser IndexedDB (the unit tier rides fake-indexeddb, whose
 * structured clone loses ArrayBuffer/Blob identity — the binary preview
 * tags and binary-key legs only execute here). Seeding rides the storage
 * matrix playground page's `window.ohStorage` API; every mutation is
 * asserted PAGE-SIDE.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { STORAGE_PAGE_URL } from './pages/storage-matrix-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

/** Opt-in demo pacing: OH_E2E_SLOWMO=<ms> delays every RPC and page op. */
const slowMo = Number(process.env.OH_E2E_SLOWMO ?? '0') || 0;
const pagePace = slowMo > 0 ? `?pace=${slowMo}` : '';

let context: BrowserContext;
let rpcPage: Page;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = sw.url().split('/')[2]!;

  rpcPage = await context.newPage();
  await rpcPage.goto(`chrome-extension://${extensionId}/workbench.html`);
  await rpcPage.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
});

test.afterAll(async () => {
  await context.close();
});

async function rpc<T = unknown>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (slowMo > 0) await new Promise((resolve) => setTimeout(resolve, slowMo));
  return rpcPage.evaluate(
    ({ type: t, payload: p }: { type: string; payload: Record<string, unknown> }) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: t, ...p }, (response) => {
          void chrome.runtime.lastError;
          resolve(response);
        });
      }),
    { type, payload },
  ) as Promise<T>;
}

interface ScopeWire {
  frameId: number;
  origin: string;
  isMainFrame: boolean;
}

interface StoreWire {
  name: string;
  keyPath?: string;
  autoIncrement: boolean;
  indexNames: string[];
}

interface DatabaseWire {
  name: string;
  version: number;
  objectStores: StoreWire[];
}

interface RecordWire {
  keyPreview: string;
  primaryKeyPreview: string;
  valuePreview: string;
  primaryKeyWire?: string;
}

interface RecordsResult {
  records: RecordWire[] | null;
  truncated?: boolean;
}

type PreviewNodeWire =
  | { kind: 'atom'; type: string; text: string }
  | { kind: 'container'; label: string; entries: Array<{ key: string; node: PreviewNodeWire }> };

interface RecordDocumentWire {
  text: string;
  editable: boolean;
  truncated?: boolean;
  preview?: PreviewNodeWire;
}

test('IndexedDB reads, previews, key wire, writes and deletes ride the plane end-to-end', async () => {
  test.setTimeout(slowMo > 0 ? 600_000 : 120_000);
  const page = await context.newPage();
  await page.goto(`${STORAGE_PAGE_URL}${pagePace}`);

  await page.evaluate(async () => {
    await window.ohStorage.reset();
    await window.ohStorage.seedIdb();
  });

  const tabId = await rpcPage.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url: `${url}*` });
    return tab?.id ?? null;
  }, STORAGE_PAGE_URL);
  expect(tabId).not.toBeNull();

  const { scopes } = await rpc<{ scopes: ScopeWire[] | null }>('listStorageScopes', { tabId });
  const scope = scopes?.find((s) => s.isMainFrame);
  expect(scope).toBeDefined();
  const base = { tabId, frameId: scope?.frameId };

  // ── Enumeration: shapes, versions, keyPaths, indexes ───────────────
  const listed = await rpc<{ databases: DatabaseWire[] | null }>('listIndexedDbDatabases', base);
  const app = listed.databases?.find((d) => d.name === 'oh-store-app');
  const aux = listed.databases?.find((d) => d.name === 'oh-store-aux');
  expect(app?.version).toBe(1);
  expect(aux?.version).toBe(3);

  const storesByName = new Map((app?.objectStores ?? []).map((s) => [s.name, s]));
  expect([...storesByName.keys()].sort()).toEqual(['bulk', 'kv', 'orders', 'rich']);
  expect(storesByName.get('kv')?.keyPath).toBeUndefined();
  expect(storesByName.get('kv')?.autoIncrement).toBe(false);
  expect(storesByName.get('rich')?.autoIncrement).toBe(true);
  expect(storesByName.get('orders')?.keyPath).toBe('user, seq');
  expect(storesByName.get('orders')?.indexNames).toEqual(['by-user']);
  expect(storesByName.get('bulk')?.keyPath).toBe('id');

  // ── kv store: real cursor order + previews + lossless key wire ─────
  // IDB key order across types: number < date < string < binary < array.
  const kv = await rpc<RecordsResult>('getIndexedDbRecords', {
    ...base,
    database: 'oh-store-app',
    store: 'kv',
    page: 0,
    pageSize: 50,
  });
  expect(kv.truncated).toBeFalsy();
  const kvKeys = (kv.records ?? []).map((r) => r.keyPreview);
  expect(kvKeys).toEqual([
    '-Infinity',
    '0',
    'Infinity',
    'Date(2026-01-02T03:04:05.000Z)',
    '""',
    '"alpha"',
    'ArrayBuffer(3 B)',
    '["user-1", 7]',
  ]);
  const kvByKey = new Map((kv.records ?? []).map((r) => [r.keyPreview, r]));
  expect(kvByKey.get('"alpha"')?.valuePreview).toBe('{tag: "string-key"}');
  expect(kvByKey.get('0')?.valuePreview).toBe('"zero-key"');
  // The key codec is total over the practical key space — every row,
  // binary and ±Infinity included, carries the lossless wire.
  for (const keyPreview of kvKeys) {
    expect(kvByKey.get(keyPreview)?.primaryKeyWire).toBeDefined();
  }

  // ── rich store: structured-clone previews against a REAL browser ───
  const rich = await rpc<RecordsResult>('getIndexedDbRecords', {
    ...base,
    database: 'oh-store-app',
    store: 'rich',
    page: 0,
    pageSize: 50,
  });
  const richValue = rich.records?.[0]?.valuePreview ?? '';
  expect(rich.records?.[0]?.keyPreview).toBe('1');
  expect(richValue).toContain('when: Date(2026-03-04T05:06:07.000Z)');
  expect(richValue).toContain('buf: ArrayBuffer(8 B)');
  expect(richValue).toContain('view: Uint8Array(3 B)');
  expect(richValue).toContain('blob: Blob(10 B, text/plain)');
  expect(richValue).toContain('map: Map(1) {"a" => 1}');
  expect(richValue).toContain('set: Set(2) {"x", "y"}');
  // The 2000-char member pushes the preview past the 1024 clip.
  expect(richValue.endsWith('…')).toBe(true);
  expect(richValue.length).toBe(1025);

  // ── bulk store: real cursor paging with the one-past probe ─────────
  const page0 = await rpc<RecordsResult>('getIndexedDbRecords', {
    ...base,
    database: 'oh-store-app',
    store: 'bulk',
    page: 0,
    pageSize: 50,
  });
  expect(page0.records?.length).toBe(50);
  expect(page0.truncated).toBe(true);
  expect(page0.records?.[0]?.valuePreview).toBe('{id: 0, label: "bulk-0"}');

  const page1 = await rpc<RecordsResult>('getIndexedDbRecords', {
    ...base,
    database: 'oh-store-app',
    store: 'bulk',
    page: 1,
    pageSize: 50,
  });
  expect(page1.records?.length).toBe(15);
  expect(page1.truncated).toBeFalsy();
  expect(page1.records?.[0]?.valuePreview).toBe('{id: 50, label: "bulk-50"}');

  // ── Index-scoped read: the cursor walks the index (key column = the
  // index key); record identity stays the primary key ────────────────
  const byUser = await rpc<RecordsResult>('getIndexedDbRecords', {
    ...base,
    database: 'oh-store-app',
    store: 'orders',
    page: 0,
    pageSize: 50,
    index: 'by-user',
  });
  expect(byUser.records?.map((r) => r.keyPreview)).toEqual(['"user-1"', '"user-2"']);
  expect(byUser.records?.map((r) => r.primaryKeyPreview)).toEqual(['["user-1", 1]', '["user-2", 1]']);
  const missingIndex = await rpc<RecordsResult>('getIndexedDbRecords', {
    ...base,
    database: 'oh-store-app',
    store: 'orders',
    page: 0,
    pageSize: 50,
    index: 'gone',
  });
  expect(missingIndex.records).toBeNull();

  // ── Record document: lazy one-shot read of one record's full text ──
  // The rich record carries structured-clone extras ⇒ a readable
  // JSON-ish rendering, honestly read-only.
  const richWire = rich.records?.[0]?.primaryKeyWire;
  expect(richWire).toBeDefined();
  const richDoc = await rpc<{ document: RecordDocumentWire | null }>('getIndexedDbRecordDocument', {
    ...base,
    database: 'oh-store-app',
    store: 'rich',
    primaryKeyWire: richWire,
  });
  expect(richDoc.document?.editable).toBe(false);
  expect(richDoc.document?.truncated).toBeFalsy();
  const richText = richDoc.document?.text ?? '';
  expect(richText).toContain('"when": Date("2026-03-04T05:06:07.000Z")');
  expect(richText).toContain('"buf": ArrayBuffer(8 B)');
  expect(richText).toContain('"view": Uint8Array(3 B)');
  expect(richText).toContain('"blob": Blob(10 B, text/plain)');
  expect(richText).toContain('"a" => 1');
  expect(richText).toContain('Set(2) {');
  // The full document carries the whole 2000-char member — no preview clip.
  expect(richText).toContain('y'.repeat(2000));

  // The read-only document also carries the bounded preview tree —
  // real structured-clone types against a REAL browser.
  const richPreview = richDoc.document?.preview;
  expect(richPreview?.kind).toBe('container');
  if (richPreview?.kind === 'container') {
    const byKey = new Map(richPreview.entries.map((e) => [e.key, e.node]));
    expect(byKey.get('"when": ')).toEqual({ kind: 'atom', type: 'tag', text: 'Date("2026-03-04T05:06:07.000Z")' });
    expect(byKey.get('"buf": ')).toEqual({ kind: 'atom', type: 'tag', text: 'ArrayBuffer(8 B)' });
    expect(byKey.get('"view": ')).toEqual({ kind: 'atom', type: 'tag', text: 'Uint8Array(3 B)' });
    const mapNode = byKey.get('"map": ');
    expect(mapNode?.kind).toBe('container');
    if (mapNode?.kind === 'container') {
      expect(mapNode.label).toBe('Map(1)');
      expect(mapNode.entries).toEqual([{ key: '"a" => ', node: { kind: 'atom', type: 'number', text: '1' } }]);
    }
    const setNode = byKey.get('"set": ');
    expect(setNode?.kind).toBe('container');
    if (setNode?.kind === 'container') expect(setNode.label).toBe('Set(2)');
  }

  // A plain-JSON record ⇒ exact pretty JSON that round-trips (editable).
  const bulkWire = page0.records?.[0]?.primaryKeyWire;
  const bulkDoc = await rpc<{ document: RecordDocumentWire | null }>('getIndexedDbRecordDocument', {
    ...base,
    database: 'oh-store-app',
    store: 'bulk',
    primaryKeyWire: bulkWire,
  });
  expect(bulkDoc.document?.editable).toBe(true);
  expect(bulkDoc.document?.preview).toBeUndefined();
  expect(JSON.parse(bulkDoc.document?.text ?? '')).toEqual({ id: 0, label: 'bulk-0' });

  const goneDoc = await rpc<{ document: RecordDocumentWire | null }>('getIndexedDbRecordDocument', {
    ...base,
    database: 'oh-store-app',
    store: 'rich',
    primaryKeyWire: '{"n":999}',
  });
  expect(goneDoc.document).toBeNull();

  // ── Record writes: the editable document round-trips back ──────────
  // Same-key edit of an in-value keyPath record; asserted PAGE-SIDE.
  const editedBulk = { ...(JSON.parse(bulkDoc.document?.text ?? '{}') as { id: number }), label: 'bulk-0-edited' };
  const bulkPut = await rpc<{ ok: boolean; reason?: string }>('putIndexedDbRecord', {
    ...base,
    database: 'oh-store-app',
    store: 'bulk',
    primaryKeyWire: bulkWire,
    valueText: JSON.stringify(editedBulk, null, 2),
  });
  expect(bulkPut).toEqual({ ok: true });
  const bulkAfter = await page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const req = indexedDB.open('oh-store-app');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction('bulk', 'readonly').objectStore('bulk').get(0);
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
  expect(bulkAfter).toEqual({ id: 0, label: 'bulk-0-edited' });

  // A key change is rejected honestly — never a silent new record.
  const keyChanged = await rpc<{ ok: boolean; reason?: string }>('putIndexedDbRecord', {
    ...base,
    database: 'oh-store-app',
    store: 'bulk',
    primaryKeyWire: bulkWire,
    valueText: '{"id":999,"label":"moved"}',
  });
  expect(keyChanged).toEqual({ ok: false, reason: 'key-changed' });

  // Invalid JSON never opens a transaction.
  const parseFail = await rpc<{ ok: boolean; reason?: string }>('putIndexedDbRecord', {
    ...base,
    database: 'oh-store-app',
    store: 'bulk',
    primaryKeyWire: bulkWire,
    valueText: '{not json',
  });
  expect(parseFail).toEqual({ ok: false, reason: 'parse' });
  const bulkState = await page.evaluate(
    () =>
      new Promise<{ count: number; ghost: unknown }>((resolve, reject) => {
        const req = indexedDB.open('oh-store-app');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('bulk', 'readonly');
          const count = tx.objectStore('bulk').count();
          const ghost = tx.objectStore('bulk').get(999);
          tx.oncomplete = () => {
            db.close();
            resolve({ count: count.result, ghost: ghost.result });
          };
        };
      }),
  );
  expect(bulkState.count).toBe(65);
  expect(bulkState.ghost).toBeUndefined();

  // Out-of-line key: the put rides the decoded wire key.
  const alphaWire = kvByKey.get('"alpha"')?.primaryKeyWire;
  const kvPut = await rpc<{ ok: boolean; reason?: string }>('putIndexedDbRecord', {
    ...base,
    database: 'oh-store-app',
    store: 'kv',
    primaryKeyWire: alphaWire,
    valueText: '{"tag":"edited-alpha"}',
  });
  expect(kvPut).toEqual({ ok: true });
  const alphaAfter = await page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const req = indexedDB.open('oh-store-app');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction('kv', 'readonly').objectStore('kv').get('alpha');
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
  expect(alphaAfter).toEqual({ tag: 'edited-alpha' });

  // Composite in-value key: same-key edit passes, element drift rejects.
  const orderPut = await rpc<{ ok: boolean; reason?: string }>('putIndexedDbRecord', {
    ...base,
    database: 'oh-store-app',
    store: 'orders',
    primaryKeyWire: byUser.records?.[0]?.primaryKeyWire,
    valueText: '{"user":"user-1","seq":1,"total":123}',
  });
  expect(orderPut).toEqual({ ok: true });
  const orderMoved = await rpc<{ ok: boolean; reason?: string }>('putIndexedDbRecord', {
    ...base,
    database: 'oh-store-app',
    store: 'orders',
    primaryKeyWire: byUser.records?.[0]?.primaryKeyWire,
    valueText: '{"user":"user-1","seq":2,"total":123}',
  });
  expect(orderMoved).toEqual({ ok: false, reason: 'key-changed' });

  // ── Record deletes: string, falsy, binary and ±Infinity keys ───────
  for (const keyPreview of ['"alpha"', '0', 'Infinity', '-Infinity', 'ArrayBuffer(3 B)']) {
    const wire = kvByKey.get(keyPreview)?.primaryKeyWire;
    const deleted = await rpc<{ ok: boolean }>('deleteIndexedDbRecord', {
      ...base,
      database: 'oh-store-app',
      store: 'kv',
      primaryKeyWire: wire,
    });
    expect(deleted.ok).toBe(true);
  }
  // A composite-array primary key, deleted with the wire the INDEX view
  // returned — the identity channel survives the cursor swap.
  const orderWire = byUser.records?.[0]?.primaryKeyWire;
  expect(orderWire).toBeDefined();
  const orderDeleted = await rpc<{ ok: boolean }>('deleteIndexedDbRecord', {
    ...base,
    database: 'oh-store-app',
    store: 'orders',
    primaryKeyWire: orderWire,
  });
  expect(orderDeleted.ok).toBe(true);

  // Page-side truth: exactly the deleted records are gone.
  const counts = await page.evaluate(
    () =>
      new Promise<{ kv: number; orders: number }>((resolve, reject) => {
        const req = indexedDB.open('oh-store-app');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['kv', 'orders'], 'readonly');
          const kvCount = tx.objectStore('kv').count();
          const ordersCount = tx.objectStore('orders').count();
          tx.oncomplete = () => {
            db.close();
            resolve({ kv: kvCount.result, orders: ordersCount.result });
          };
        };
      }),
  );
  expect(counts.kv).toBe(3);
  expect(counts.orders).toBe(1);

  // ── Store clear ────────────────────────────────────────────────────
  const cleared = await rpc<{ ok: boolean }>('clearIndexedDbStore', {
    ...base,
    database: 'oh-store-app',
    store: 'orders',
  });
  expect(cleared.ok).toBe(true);
  const clearedRead = await rpc<RecordsResult>('getIndexedDbRecords', {
    ...base,
    database: 'oh-store-app',
    store: 'orders',
    page: 0,
    pageSize: 50,
  });
  expect(clearedRead.records).toEqual([]);

  // ── Database delete: blocked while the page holds a connection ─────
  const held = await page.evaluate(() => window.ohStorage.holdIdbOpen('oh-store-app'));
  expect(held).toBe(true);
  const blocked = await rpc<{ ok: boolean }>('deleteIndexedDbDatabase', { ...base, database: 'oh-store-app' });
  expect(blocked.ok).toBe(false);
  await page.evaluate(() => window.ohStorage.releaseIdbHold());

  const auxDeleted = await rpc<{ ok: boolean }>('deleteIndexedDbDatabase', { ...base, database: 'oh-store-aux' });
  expect(auxDeleted.ok).toBe(true);
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))).not.toContain(
    'oh-store-aux',
  );

  // ── Ghost guard: reading the deleted database never recreates it ───
  const ghost = await rpc<RecordsResult>('getIndexedDbRecords', {
    ...base,
    database: 'oh-store-aux',
    store: 'notes',
    page: 0,
    pageSize: 50,
  });
  expect(ghost.records).toBeNull();
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))).not.toContain(
    'oh-store-aux',
  );

  await page.evaluate(() => window.ohStorage.reset());
  await page.close();
});
