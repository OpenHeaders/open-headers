/**
 * IDB-backed {@link PendingIntents} (Phase A R6 production impl).
 *
 * Database layout:
 *   • Database: `oh.sync.intents`. Single store across workspaces;
 *     workspaceId is the high-order prefix on the primary key.
 *   • Object store: `entries`. KeyPath = `pk` =
 *     `${workspaceId}|${kind}\x1f${key}`. Coalescing is built in:
 *     `put` overwrites prior entries for the same `(kind, key)`.
 *     The HLC compare happens before writing (§18.1 latest-wins).
 */

import { compareHlc, type SideEffectIntent } from '@openheaders/core/sync';
import type { PendingIntents } from '@openheaders/oracle/sync/pending-intents';

const DB_NAME = 'oh.sync.intents';
const DB_VERSION = 1;
const STORE = 'entries';
const SEP = '\x1f';

interface StoredIntent {
  pk: string;
  workspaceId: string;
  kind: string;
  key: string;
  intent: SideEffectIntent;
}

const pkOf = (workspaceId: string, kind: string, key: string): string => `${workspaceId}|${kind}${SEP}${key}`;

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

export class IdbPendingIntents implements PendingIntents {
  constructor(private readonly workspaceId: string) {}

  async enqueue(intent: SideEffectIntent): Promise<void> {
    const db = await openDb();
    const pk = pkOf(this.workspaceId, intent.kind, intent.key);
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const existing = await wrap<StoredIntent | undefined>(store.get(pk) as IDBRequest<StoredIntent | undefined>);
    if (existing && compareHlc(intent.hlc, existing.intent.hlc) <= 0) return;
    store.put({
      pk,
      workspaceId: this.workspaceId,
      kind: intent.kind,
      key: intent.key,
      intent,
    } satisfies StoredIntent);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('enqueue tx failed'));
    });
  }

  async enqueueAll(intents: SideEffectIntent[]): Promise<void> {
    for (const i of intents) await this.enqueue(i);
  }

  async list(): Promise<SideEffectIntent[]> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const range = IDBKeyRange.bound(`${this.workspaceId}|`, `${this.workspaceId}|~`, false, true);
    const entries = await wrap<StoredIntent[]>(store.getAll(range) as IDBRequest<StoredIntent[]>);
    return entries
      .map((e) => e.intent)
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
        return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
      });
  }

  async drain(kind: string, key: string): Promise<SideEffectIntent | null> {
    const db = await openDb();
    const pk = pkOf(this.workspaceId, kind, key);
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const existing = await wrap<StoredIntent | undefined>(store.get(pk) as IDBRequest<StoredIntent | undefined>);
    if (!existing) return null;
    store.delete(pk);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('drain tx failed'));
    });
    return existing.intent;
  }

  async clear(): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(IDBKeyRange.bound(`${this.workspaceId}|`, `${this.workspaceId}|~`, false, true));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('clear tx failed'));
    });
  }
}
