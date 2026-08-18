/**
 * IDB-backed {@link AuditLog} — Phase U2.4. Implements the
 * `audit_counters` pattern from the unified-oracle model §9.5: a separate
 * object store keyed by `orgId` holds the next sequence number, read +
 * incremented + written back inside the same transaction as the entry
 * insert. This gives gapless ids within an Org without depending on
 * IDB's per-store autoIncrement (which can't be partitioned by orgId).
 *
 * Database / store layout:
 *   • Database: `oh.identity.audit` (origin-scoped).
 *   • Object store `entries`. KeyPath = `id` = `${orgId}:${seq}`.
 *     - Index `by_org_seq` on `(orgId, seq)` for newest-first
 *       cursor scans.
 *     - Index `by_org_occurred_at` on `(orgId, occurredAt)` for
 *       `prune`.
 *   • Object store `counters`. KeyPath = `orgId`; value `{ orgId, next }`.
 */

import type { AuditLogEntry } from '@openheaders/core/types';

import type {
  AuditLog,
  AuditLogAppendInput,
  AuditLogListOptions,
} from '@openheaders/oracle/sync/audit-log';

const DB_NAME = 'oh.identity.audit';
const DB_VERSION = 1;
const ENTRIES = 'entries';
const COUNTERS = 'counters';
const IDX_ORG_SEQ = 'by_org_seq';
const IDX_ORG_OCCURRED_AT = 'by_org_occurred_at';

interface CounterRow {
  orgId: string;
  next: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ENTRIES)) {
        const store = db.createObjectStore(ENTRIES, { keyPath: 'id' });
        store.createIndex(IDX_ORG_SEQ, ['orgId', 'seq'], { unique: true });
        store.createIndex(IDX_ORG_OCCURRED_AT, ['orgId', 'occurredAt'], { unique: false });
      }
      if (!db.objectStoreNames.contains(COUNTERS)) {
        db.createObjectStore(COUNTERS, { keyPath: 'orgId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open(oh.identity.audit) failed'));
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

export class IdbAuditLog implements AuditLog {
  async append(input: AuditLogAppendInput): Promise<AuditLogEntry> {
    const db = await openDb();
    const tx = db.transaction([ENTRIES, COUNTERS], 'readwrite');
    const counters = tx.objectStore(COUNTERS);
    const existing = (await wrap(counters.get(input.orgId))) as CounterRow | undefined;
    const seq = (existing?.next ?? 0) + 1;
    counters.put({ orgId: input.orgId, next: seq } satisfies CounterRow);

    const entry: AuditLogEntry = {
      id: `${input.orgId}:${seq}`,
      orgId: input.orgId,
      seq,
      actorUserId: input.actorUserId,
      capability: input.capability,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      decision: input.decision,
      occurredAt: input.occurredAt,
    };
    tx.objectStore(ENTRIES).put(entry);
    await awaitTx(tx);
    return entry;
  }

  async list(orgId: string, opts: AuditLogListOptions = {}): Promise<AuditLogEntry[]> {
    const db = await openDb();
    const tx = db.transaction(ENTRIES, 'readonly');
    const idx = tx.objectStore(ENTRIES).index(IDX_ORG_SEQ);
    const lowerSeq = opts.sinceSeq !== undefined ? opts.sinceSeq + 1 : 1;
    const range = IDBKeyRange.bound([orgId, lowerSeq], [orgId, Number.MAX_SAFE_INTEGER]);
    // Walk newest-first via `prev` cursor; collect up to `limit`.
    const cursorReq = idx.openCursor(range, 'prev');
    const rows: AuditLogEntry[] = [];
    const cap = opts.limit ?? Number.POSITIVE_INFINITY;
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || rows.length >= cap) {
          resolve();
          return;
        }
        rows.push(cursor.value as AuditLogEntry);
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error ?? new Error('IDB cursor failed'));
    });
    return rows;
  }

  async prune(orgId: string, beforeIso: string): Promise<number> {
    const db = await openDb();
    const tx = db.transaction(ENTRIES, 'readwrite');
    const idx = tx.objectStore(ENTRIES).index(IDX_ORG_OCCURRED_AT);
    const range = IDBKeyRange.bound([orgId, ''], [orgId, beforeIso], false, true);
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
}

/** Test-only — clear the cached IDB connection so `fake-indexeddb` resets land. */
export function __closeIdbAuditLogForTests(): void {
  dbPromise = null;
}
