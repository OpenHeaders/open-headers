/**
 * IDB-backed {@link PendingOutQueue} — Phase C C13.
 *
 * Database / store layout:
 *   • Database: `oh.sync.pending-out` (origin-scoped). One database
 *     across workspaces + remotes; the keys carry the routing
 *     prefixes.
 *   • Object store: `entries`. KeyPath = `pk` =
 *     `${remoteId}|${workspaceId}|${hlcKey}|${mutationId}` —
 *     `remoteId` first so a range scan over one remote's pending set
 *     is contiguous; `hlcKey` second for HLC-ordered drain;
 *     `mutationId` tail-disambiguates identical HLCs (rare but
 *     possible across nodes with the same physical+logical pair).
 *   • Index `by_mutation_id` for {@link has} + {@link ack}.
 *
 * Same single-tx pattern as {@link IdbMutationLog}; failures bubble
 * out as the underlying IDBRequest's error.
 */
import { hlcToString, type MutationEnvelope } from '@openheaders/core/sync';

import type { PendingOutQueue } from './pending-out-queue';

const DB_NAME = 'oh.sync.pending-out';
const DB_VERSION = 1;
const STORE = 'entries';
const IDX_MUTATION_ID = 'by_mutation_id';

interface StoredEntry {
  pk: string;
  remoteId: string;
  workspaceId: string;
  hlcKey: string;
  mutationId: string;
  envelope: MutationEnvelope;
}

const pkOf = (remoteId: string, env: MutationEnvelope): string =>
  `${remoteId}|${env.workspaceId}|${hlcToString(env.hlc)}|${env.mutationId}`;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'pk' });
        store.createIndex(IDX_MUTATION_ID, ['remoteId', 'mutationId'], { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'));
  });
  return dbPromise;
}

const wrap = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
  });

export class IdbPendingOutQueue implements PendingOutQueue {
  async enqueue(remoteId: string, env: MutationEnvelope): Promise<void> {
    if (await this.has(remoteId, env.mutationId)) return;
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const entry: StoredEntry = {
      pk: pkOf(remoteId, env),
      remoteId,
      workspaceId: env.workspaceId,
      hlcKey: hlcToString(env.hlc),
      mutationId: env.mutationId,
      envelope: env,
    };
    tx.objectStore(STORE).put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
    });
  }

  async *drain(remoteId: string): AsyncIterable<MutationEnvelope> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const range = IDBKeyRange.bound(`${remoteId}|`, `${remoteId}|￿`);
    const cursorReq = tx.objectStore(STORE).openCursor(range);
    // Collect synchronously into an array — IDB cursors don't survive
    // the microtask gap between async iterations. The store is keyed
    // such that the natural cursor order is the HLC drain order, so
    // no in-memory sort is needed.
    const entries: StoredEntry[] = [];
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        entries.push(cursor.value as StoredEntry);
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error ?? new Error('IDB cursor failed'));
    });
    for (const e of entries) yield e.envelope;
  }

  async ack(remoteId: string, mutationId: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const idx = tx.objectStore(STORE).index(IDX_MUTATION_ID);
    const key = await wrap(idx.getKey([remoteId, mutationId]));
    if (key !== undefined) tx.objectStore(STORE).delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
    });
  }

  async ackAll(remoteId: string, mutationIds: readonly string[]): Promise<void> {
    if (mutationIds.length === 0) return;
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const idx = tx.objectStore(STORE).index(IDX_MUTATION_ID);
    const store = tx.objectStore(STORE);
    for (const id of mutationIds) {
      const key = await wrap(idx.getKey([remoteId, id]));
      if (key !== undefined) store.delete(key);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
    });
  }

  async has(remoteId: string, mutationId: string): Promise<boolean> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index(IDX_MUTATION_ID);
    const key = await wrap(idx.getKey([remoteId, mutationId]));
    return key !== undefined;
  }

  async size(remoteId: string): Promise<number> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const range = IDBKeyRange.bound(`${remoteId}|`, `${remoteId}|￿`);
    const count = await wrap(tx.objectStore(STORE).count(range));
    return count;
  }
}

/** Test-only — clear the per-tab IDB connection cache so `fake-indexeddb` resets land. */
export function __closeIdbPendingOutQueueForTests(): void {
  dbPromise = null;
}
