/**
 * Origin-scoped IDB {@link HostStorage} adapter — the web host's
 * persistent KV. One row per storage key in a single object store;
 * the whole store hydrates into memory once on first access so every
 * read after that is synchronous-fast and `getMany` never fans out
 * IDB transactions. Writes go through per-key `put`/`delete` on a
 * serialized chain, so a burst of writes can't interleave.
 *
 * Secrets posture mirrors the headless daemon: this host has no
 * at-rest cipher, so slots flagged `sensitive: true` (vault, oauth)
 * are REFUSED on write rather than persisted as plaintext, and read
 * as absent. A cipher (and with it the vault) is a later phase.
 *
 * Coherence scope is one tab. A second Workbench tab on the same
 * origin gets its own in-memory image; cross-tab convergence rides
 * the Phase-4b WS join through the daemon, not IDB change events.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { type ParseEntityOptions, parseEntity, parseEntityArray } from '@openheaders/core/schemas';
import type { HostStorage, StorageKey } from '@openheaders/core/storage';
import type * as v from 'valibot';

const SCOPE = 'IdbHostStorage';

const DB_NAME = 'oh.host-storage';
const DB_VERSION = 1;
const STORE = 'kv';

interface StoredRow {
  key: string;
  value: unknown;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'));
  });
}

const wrap = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
  });

const txDone = (tx: IDBTransaction, label: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`${label} tx failed`));
  });

type ChangeListener = (next: unknown) => void;

export class IdbHostStorage implements HostStorage {
  private readonly values = new Map<string, unknown>();
  private readonly listeners = new Map<string, Set<ChangeListener>>();
  private dbPromise: Promise<IDBDatabase> | null = null;
  private loadPromise: Promise<void> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
    await this.ensureLoaded();
    return this.readSlot(spec);
  }

  async getMany<M extends Record<string, StorageKey<unknown>>>(
    specs: M,
  ): Promise<{ [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never }> {
    await this.ensureLoaded();
    const out: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(specs)) {
      out[name] = this.readSlot(spec);
    }
    return out as { [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never };
  }

  async set<T>(spec: StorageKey<T>, value: T): Promise<void> {
    await this.ensureLoaded();
    this.refuseSensitive(spec);
    this.values.set(spec.key, value);
    await this.persistPut([{ key: spec.key, value }]);
    this.fire(spec.key, value);
  }

  async setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void> {
    await this.ensureLoaded();
    for (const [spec] of writes) this.refuseSensitive(spec);
    const rows: StoredRow[] = [];
    for (const [spec, value] of writes) {
      this.values.set(spec.key, value);
      rows.push({ key: spec.key, value });
    }
    await this.persistPut(rows);
    for (const [spec, value] of writes) this.fire(spec.key, value);
  }

  async remove(specs: StorageKey<unknown> | ReadonlyArray<StorageKey<unknown>>): Promise<void> {
    await this.ensureLoaded();
    const list = Array.isArray(specs) ? specs : [specs as StorageKey<unknown>];
    const keys: string[] = [];
    for (const spec of list) {
      this.values.delete(spec.key);
      keys.push(spec.key);
    }
    await this.persistDelete(keys);
    for (const key of keys) this.fire(key, undefined);
  }

  async getValidated<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<v.InferOutput<TSchema>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<v.InferOutput<TSchema> | null> {
    const raw = await this.get(spec);
    if (raw === undefined) return null;
    return parseEntity(schema, raw, options);
  }

  async getValidatedArray<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<Array<v.InferOutput<TSchema>>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<Array<v.InferOutput<TSchema>>> {
    const raw = await this.get(spec);
    if (raw === undefined) return [];
    return parseEntityArray(schema, raw, options);
  }

  subscribe<T>(spec: StorageKey<T>, fn: (next: T | undefined) => void): () => void {
    const key = spec.key;
    const bucket = this.listeners.get(key) ?? new Set<ChangeListener>();
    const cast = fn as ChangeListener;
    bucket.add(cast);
    this.listeners.set(key, bucket);
    return () => {
      const current = this.listeners.get(key);
      if (!current) return;
      current.delete(cast);
      if (current.size === 0) this.listeners.delete(key);
    };
  }

  // ── Internal ────────────────────────────────────────────────────

  private ensureLoaded(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.load();
    return this.loadPromise;
  }

  private openOnce(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  private async load(): Promise<void> {
    try {
      const db = await this.openOnce();
      const tx = db.transaction(STORE, 'readonly');
      const rows = await wrap<StoredRow[]>(tx.objectStore(STORE).getAll() as IDBRequest<StoredRow[]>);
      for (const row of rows) {
        this.values.set(row.key, row.value);
      }
    } catch (err) {
      logger.error(SCOPE, 'hydrate failed; starting empty', err);
    }
  }

  private readSlot<T>(spec: StorageKey<T>): T | undefined {
    // No cipher on this host — sensitive slots are never written, so a
    // read is always absent regardless of what a stray row contains.
    if (spec.sensitive === true) return undefined;
    return this.values.get(spec.key) as T | undefined;
  }

  private refuseSensitive(spec: StorageKey<unknown>): void {
    if (spec.sensitive === true) {
      throw new Error(`IdbHostStorage: no cipher; refusing to write sensitive slot "${spec.key}"`);
    }
  }

  private persistPut(rows: StoredRow[]): Promise<void> {
    return this.chainWrite(async () => {
      const db = await this.openOnce();
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const row of rows) store.put(row);
      await txDone(tx, 'put');
    });
  }

  private persistDelete(keys: string[]): Promise<void> {
    return this.chainWrite(async () => {
      const db = await this.openOnce();
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const key of keys) store.delete(key);
      await txDone(tx, 'delete');
    });
  }

  private chainWrite(op: () => Promise<void>): Promise<void> {
    const next = this.writeChain.then(op);
    this.writeChain = next.catch(() => undefined);
    return next;
  }

  private fire(key: string, value: unknown): void {
    const bucket = this.listeners.get(key);
    if (!bucket) return;
    for (const listener of bucket) {
      try {
        listener(value);
      } catch (err) {
        logger.warn(SCOPE, `subscriber for ${key} threw`, err);
      }
    }
  }
}

export const idbHostStorage: HostStorage = new IdbHostStorage();
