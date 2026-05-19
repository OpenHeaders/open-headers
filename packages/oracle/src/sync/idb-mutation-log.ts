/**
 * IDB-backed {@link MutationLog} (Phase A R5 production impl).
 *
 * Database / store layout:
 *   • Database: `oh.sync.mutations` (origin-scoped). One database
 *     across workspaces; the workspaceId becomes the high-order
 *     prefix on the primary key so `IDBKeyRange.bound` + a single
 *     range request gives "all mutations for workspace X since HLC Y"
 *     in one transaction.
 *   • Object store: `entries`. KeyPath = `pk` =
 *     `${workspaceId}|${hlcKey}|${mutationId}` — workspaceId first,
 *     HLC string codec second (lex matches HLC numeric order — see
 *     `hlcToString`), mutationId tail-disambiguates the rare case of
 *     two envelopes with identical HLC + workspace.
 *   • Index `by_mutation_id` for the dedup query.
 *   • Index `by_workspace_org` on `(workspaceId, orgId)` — denormalized
 *     per UNIFIED_ORACLE_MODEL.md §8.2 so transport filters can run
 *     `WHERE orgId IN (authorized set)` without unpacking each
 *     envelope blob (U2.7-U2.9).
 *
 * V5 fresh-start: no migration code path. The DB schema below is the
 * shape every install ships with.
 */

import { hlcToString, type MutationEnvelope } from '@openheaders/core/sync';
import type { MutationLog } from './mutation-log';

const DB_NAME = 'oh.sync.mutations';
const DB_VERSION = 2;
const STORE = 'entries';
const IDX_MUTATION_ID = 'by_mutation_id';
const IDX_WORKSPACE_ORG = 'by_workspace_org';

interface StoredEntry {
  pk: string;
  workspaceId: string;
  /** Denormalized from `envelope.orgId` for the transport-boundary filter. */
  orgId: string;
  hlcKey: string;
  mutationId: string;
  envelope: MutationEnvelope;
}

const pkOf = (workspaceId: string, env: MutationEnvelope): string =>
  `${workspaceId}|${hlcToString(env.hlc)}|${env.mutationId}`;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'pk' });
        store.createIndex(IDX_MUTATION_ID, 'mutationId', { unique: false });
        store.createIndex(IDX_WORKSPACE_ORG, ['workspaceId', 'orgId'], { unique: false });
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

export class IdbMutationLog implements MutationLog {
  constructor(private readonly workspaceId: string) {}

  async append(env: MutationEnvelope): Promise<void> {
    if (await this.hasMutation(env.mutationId)) return;
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const entry: StoredEntry = {
      pk: pkOf(this.workspaceId, env),
      workspaceId: this.workspaceId,
      orgId: env.orgId,
      hlcKey: hlcToString(env.hlc),
      mutationId: env.mutationId,
      envelope: env,
    };
    tx.objectStore(STORE).put(entry);
    await wrap<unknown>(tx.objectStore(STORE).get(entry.pk));
  }

  async appendAll(envs: MutationEnvelope[]): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const env of envs) {
      store.put({
        pk: pkOf(this.workspaceId, env),
        workspaceId: this.workspaceId,
        orgId: env.orgId,
        hlcKey: hlcToString(env.hlc),
        mutationId: env.mutationId,
        envelope: env,
      } satisfies StoredEntry);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('appendAll tx failed'));
      tx.onabort = () => reject(tx.error ?? new Error('appendAll tx aborted'));
    });
  }

  async *readSince(sinceHlcKey: string | null): AsyncIterable<MutationEnvelope> {
    const db = await openDb();
    const lo = sinceHlcKey === null ? `${this.workspaceId}|` : `${this.workspaceId}|${sinceHlcKey}|~`;
    const hi = `${this.workspaceId}|~`;
    const range = IDBKeyRange.bound(lo, hi, sinceHlcKey === null ? false : true, true);
    const tx = db.transaction(STORE, 'readonly');
    const cursorReq = tx.objectStore(STORE).openCursor(range);
    yield* readCursor(cursorReq);
  }

  async hasMutation(mutationId: string): Promise<boolean> {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index(IDX_MUTATION_ID).getKey(mutationId);
    const result = await wrap<IDBValidKey | undefined>(req as IDBRequest<IDBValidKey | undefined>);
    return result !== undefined;
  }

  async truncateBefore(beforeHlcKey: string): Promise<void> {
    const db = await openDb();
    const range = IDBKeyRange.bound(`${this.workspaceId}|`, `${this.workspaceId}|${beforeHlcKey}`, false, true);
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(range);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('truncate tx failed'));
    });
  }
}

async function* readCursor(req: IDBRequest<IDBCursorWithValue | null>): AsyncIterable<MutationEnvelope> {
  const queue: MutationEnvelope[] = [];
  let done = false;
  let error: unknown = null;
  let resume: (() => void) | null = null;

  req.onsuccess = () => {
    const cursor = req.result;
    if (!cursor) {
      done = true;
    } else {
      queue.push((cursor.value as StoredEntry).envelope);
      cursor.continue();
    }
    resume?.();
    resume = null;
  };
  req.onerror = () => {
    error = req.error;
    done = true;
    resume?.();
    resume = null;
  };

  while (!done || queue.length > 0) {
    if (queue.length > 0) {
      yield queue.shift() as MutationEnvelope;
      continue;
    }
    if (done) break;
    await new Promise<void>((r) => {
      resume = r;
    });
  }
  if (error) throw error;
}
