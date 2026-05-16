/**
 * IDB-backed {@link ActivityMuteStore} — Phase C F6.b.
 *
 * Database / store layout:
 *   • Database: `oh.sync.activity-mute` (origin-scoped). One database
 *     across workspaces; the keys carry the workspace prefix.
 *   • Object store: `mutes`. KeyPath = `pk` =
 *     `${workspaceId}|${entityType}|${entityId}`.
 *     - `workspaceId` first so a range scan over one workspace is
 *       contiguous; cross-workspace reads never bleed in.
 *
 * Mirrors the single-tx pattern of {@link IdbActivityLog}; failures
 * bubble out as the underlying IDBRequest's error.
 */

import type { ActivityMuteEntry } from '@openheaders/core/sync';

import type { ActivityMuteStore } from './activity-mute-store';

const DB_NAME = 'oh.sync.activity-mute';
const DB_VERSION = 1;
const STORE = 'mutes';

interface StoredMute {
  pk: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  entry: ActivityMuteEntry;
}

const pkOf = (workspaceId: string, entityType: string, entityId: string): string =>
  `${workspaceId}|${entityType}|${entityId}`;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'pk' });
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

const awaitTx = (tx: IDBTransaction): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB tx aborted'));
  });

function workspaceRange(workspaceId: string): IDBKeyRange {
  return IDBKeyRange.bound(`${workspaceId}|`, `${workspaceId}|￿`);
}

export class IdbActivityMuteStore implements ActivityMuteStore {
  async put(entry: ActivityMuteEntry): Promise<void> {
    const stored: StoredMute = {
      pk: pkOf(entry.workspaceId, entry.entityType, entry.entityId),
      workspaceId: entry.workspaceId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entry: { ...entry },
    };
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(stored);
    await awaitTx(tx);
  }

  async remove(workspaceId: string, entityType: string, entityId: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(pkOf(workspaceId, entityType, entityId));
    await awaitTx(tx);
  }

  async has(workspaceId: string, entityType: string, entityId: string): Promise<boolean> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const key = await wrap(tx.objectStore(STORE).getKey(pkOf(workspaceId, entityType, entityId)));
    return key !== undefined;
  }

  async list(workspaceId: string): Promise<ActivityMuteEntry[]> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const cursorReq = tx.objectStore(STORE).openCursor(workspaceRange(workspaceId));
    const collected: ActivityMuteEntry[] = [];
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        collected.push((cursor.value as StoredMute).entry);
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error ?? new Error('IDB cursor failed'));
    });
    return collected;
  }
}

/** Test-only — clear the per-tab connection cache so `fake-indexeddb` resets land. */
export function __closeIdbActivityMuteStoreForTests(): void {
  dbPromise = null;
}
