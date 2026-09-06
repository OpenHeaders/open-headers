/**
 * The introspected schema's LOCAL plane — an introspection result is
 * server truth of one moment (and large), so it never enters the sync
 * spine: it persists in the workbench page's own IndexedDB, keyed by
 * workspace + request uid with the fetched-at stamp, and an explicit
 * Refresh replaces it. The same store serves every host that runs the
 * workbench page (the desktop renderer, the extension's workbench, the
 * web tab); a runtime without IndexedDB keeps a renderer-lifetime map
 * so the plane degrades to "re-introspect after reload", never to an
 * error.
 */

const DB_NAME = 'openheaders-graphql-schema';
const STORE = 'introspection';
const DB_VERSION = 1;

export interface GraphqlIntrospectionCacheEntry {
  /** ISO-8601 — when the introspection answered. */
  readonly fetchedAt: string;
  /** The raw `{ __schema }` result (or the whole `{ data }` envelope) — rebuilt into the model on read. */
  readonly introspection: unknown;
}

const memory = new Map<string, GraphqlIntrospectionCacheEntry>();

function cacheKey(workspaceId: string, requestUid: string): string {
  return `${workspaceId}:${requestUid}`;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise === null) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = operation(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

function isEntry(value: unknown): value is GraphqlIntrospectionCacheEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { fetchedAt?: unknown }).fetchedAt === 'string' &&
    'introspection' in value
  );
}

export async function readIntrospectionCache(
  workspaceId: string,
  requestUid: string,
): Promise<GraphqlIntrospectionCacheEntry | null> {
  const key = cacheKey(workspaceId, requestUid);
  if (!hasIndexedDb()) return memory.get(key) ?? null;
  const value = await run('readonly', (store) => store.get(key)).catch(() => undefined);
  return isEntry(value) ? value : null;
}

export async function writeIntrospectionCache(
  workspaceId: string,
  requestUid: string,
  entry: GraphqlIntrospectionCacheEntry,
): Promise<void> {
  const key = cacheKey(workspaceId, requestUid);
  if (!hasIndexedDb()) {
    memory.set(key, entry);
    return;
  }
  await run('readwrite', (store) => store.put(entry, key)).catch(() => undefined);
}

export async function clearIntrospectionCache(workspaceId: string, requestUid: string): Promise<void> {
  const key = cacheKey(workspaceId, requestUid);
  if (!hasIndexedDb()) {
    memory.delete(key);
    return;
  }
  await run('readwrite', (store) => store.delete(key)).catch(() => undefined);
}
