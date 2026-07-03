/**
 * IDB-backed {@link ActivityLog} — Phase C F1.
 *
 * Database / store layout:
 *   • Database: `oh.sync.activity` (origin-scoped). One database
 *     across workspaces; the keys carry the workspace prefix.
 *   • Object store: `entries`. KeyPath = `pk` =
 *     `${workspaceId}|${hlcKey}|${mutationId}|${kind}`.
 *     - `workspaceId` first so a range scan over one workspace is
 *       contiguous (and reads from other workspaces never bleed in).
 *     - `hlcKey` second so the natural cursor order is HLC ascending;
 *       the `list` path collects then reverses for newest-first.
 *     - `mutationId|kind` tail-disambiguates: one envelope can fan
 *       out to multiple kinds, and rare same-HLC mutations from
 *       different nodes need to coexist.
 *   • Index `by_mutation_id` on `(workspaceId, mutationId, kind)` for
 *     {@link has}.
 *   • Index `by_unread` on `(workspaceId, read)` for
 *     {@link countUnread} + the unread-only list path.
 *   • Index `by_observed_at` on `(workspaceId, observedAt)` for
 *     {@link prune}.
 *
 * Mirrors the single-tx pattern of {@link IdbPendingOutQueue};
 * failures bubble out as the underlying IDBRequest's error.
 */

import {
  activityEntryId,
  hlcToString,
  type ActivityEntry,
  type ActivityEntryKind,
} from '@openheaders/core/sync';

import type { ActivityLog, ActivityLogListOptions } from '@openheaders/oracle/sync/activity/activity-log';

const DB_NAME = 'oh.sync.activity';
const DB_VERSION = 1;
const STORE = 'entries';
const IDX_MUTATION = 'by_mutation_id';
const IDX_UNREAD = 'by_unread';
const IDX_OBSERVED_AT = 'by_observed_at';

interface StoredEntry {
  pk: string;
  workspaceId: string;
  hlcKey: string;
  mutationId: string;
  kind: ActivityEntryKind;
  /** IDB has no native boolean index; encode as 0/1. */
  readByte: 0 | 1;
  observedAt: number;
  entry: ActivityEntry;
}

const pkOf = (entry: ActivityEntry): string =>
  `${entry.workspaceId}|${hlcToString(entry.hlc)}|${entry.mutationId}|${entry.kind}`;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'pk' });
        store.createIndex(IDX_MUTATION, ['workspaceId', 'mutationId', 'kind'], { unique: true });
        store.createIndex(IDX_UNREAD, ['workspaceId', 'readByte'], { unique: false });
        store.createIndex(IDX_OBSERVED_AT, ['workspaceId', 'observedAt'], { unique: false });
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

function resolveEntryId(entry: ActivityEntry): string {
  return entry.id.length > 0 ? entry.id : activityEntryId(entry);
}

function toStored(entry: ActivityEntry): StoredEntry {
  const id = resolveEntryId(entry);
  const normalized: ActivityEntry = { ...entry, id };
  return {
    pk: pkOf(normalized),
    workspaceId: normalized.workspaceId,
    hlcKey: hlcToString(normalized.hlc),
    mutationId: normalized.mutationId,
    kind: normalized.kind,
    readByte: normalized.read ? 1 : 0,
    observedAt: normalized.observedAt,
    entry: normalized,
  };
}

export class IdbActivityLog implements ActivityLog {
  async append(entry: ActivityEntry): Promise<void> {
    const stored = toStored(entry);
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const idx = tx.objectStore(STORE).index(IDX_MUTATION);
    const existingKey = await wrap(
      idx.getKey([stored.workspaceId, stored.mutationId, stored.kind]),
    );
    if (existingKey === undefined) {
      tx.objectStore(STORE).put(stored);
    }
    await awaitTx(tx);
  }

  async list(workspaceId: string, opts: ActivityLogListOptions = {}): Promise<ActivityEntry[]> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const range = workspaceRange(workspaceId);
    const cursorReq = tx.objectStore(STORE).openCursor(range);
    // Cursors don't survive the microtask gap between async iterations,
    // so collect synchronously and post-process in JS.
    const collected: StoredEntry[] = [];
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        collected.push(cursor.value as StoredEntry);
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error ?? new Error('IDB cursor failed'));
    });
    // Natural cursor order is HLC ascending; reverse for newest-first.
    collected.reverse();
    let rows = collected;
    if (opts.unreadOnly) rows = rows.filter((r) => r.readByte === 0);
    if (opts.sinceHlcKey !== undefined) {
      const cutoff = opts.sinceHlcKey;
      rows = rows.filter((r) => r.hlcKey > cutoff);
    }
    if (opts.limit !== undefined) rows = rows.slice(0, Math.max(0, opts.limit));
    return rows.map((r) => r.entry);
  }

  async markRead(workspaceId: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const cursorReq = store.openCursor(workspaceRange(workspaceId));
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        const row = cursor.value as StoredEntry;
        if (idSet.has(row.entry.id) && row.readByte === 0) {
          cursor.update({ ...row, readByte: 1, entry: { ...row.entry, read: true } });
        }
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error ?? new Error('IDB cursor failed'));
    });
    await awaitTx(tx);
  }

  async countUnread(workspaceId: string): Promise<number> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index(IDX_UNREAD);
    return wrap(idx.count(IDBKeyRange.only([workspaceId, 0])));
  }

  async prune(workspaceId: string, beforeObservedAtMs: number): Promise<number> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const idx = tx.objectStore(STORE).index(IDX_OBSERVED_AT);
    // observedAt is non-negative per schema; 0 is the lower bound.
    const range = IDBKeyRange.bound([workspaceId, 0], [workspaceId, beforeObservedAtMs], false, true);
    let removed = 0;
    const cursorReq = idx.openCursor(range);
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        removed++;
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error ?? new Error('IDB cursor failed'));
    });
    await awaitTx(tx);
    return removed;
  }

  async has(workspaceId: string, mutationId: string, kind: ActivityEntryKind): Promise<boolean> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index(IDX_MUTATION);
    const key = await wrap(idx.getKey([workspaceId, mutationId, kind]));
    return key !== undefined;
  }
}

/** Test-only — clear the per-tab connection cache so `fake-indexeddb` resets land. */
export function __closeIdbActivityLogForTests(): void {
  dbPromise = null;
}
