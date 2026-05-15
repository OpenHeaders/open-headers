/**
 * Renderer-side {@link HostStorage} adapter for the desktop app — wraps
 * `window.oh.storage.*` (set up by `apps/desktop/src/preload.ts`).
 *
 * Same `HostStorage` surface as the extension's chrome.storage adapter
 * and the future daemon-bound WS adapter: consumers in `packages/ui`
 * never know which host they're talking to.
 *
 * Subscriptions: one upstream IPC change listener fans out to per-key
 * subscriber buckets locally. On `subscribe(key)`, the adapter
 * registers interest with main and stores the returned `seq` so future
 * reconnects could resync (Mode-2 WS concern; harmless on IPC where
 * disconnects don't happen). Unsubscribing the last local listener for
 * a key drops the main-side subscription too.
 *
 * Schema validation (`getValidated` / `getValidatedArray`) runs
 * client-side — valibot schemas aren't serializable across the IPC
 * boundary. Behavior matches the extension's `ExtensionStorage` and the
 * oracle's `FileBackedHostStorage` (fetch raw, parse locally).
 */

import { type ParseEntityOptions, parseEntity, parseEntityArray } from '@openheaders/core/schemas';
import type { HostStorage, StorageKey } from '@openheaders/core/storage';
import { hostLogger as logger } from '@openheaders/core/logger';
import type * as v from 'valibot';

const SCOPE = 'IpcHostStorage';

interface OhStorageApi {
  get(req: { key: string }): Promise<{ value: unknown; seq: number }>;
  set(req: { key: string; value: unknown }): Promise<{ seq: number }>;
  getMany(req: { keys: string[] }): Promise<{ entries: Array<{ key: string; value: unknown; seq: number }> }>;
  setMany(req: { writes: Array<{ key: string; value: unknown }> }): Promise<{
    seqs: Array<{ key: string; seq: number }>;
  }>;
  remove(req: { keys: string[] }): Promise<{ seqs: Array<{ key: string; seq: number }> }>;
  subscribe(req: { key: string; lastSeenSeq?: number }): Promise<{
    value: unknown;
    seq: number;
    stale: boolean;
  }>;
  unsubscribe(req: { key: string }): Promise<void>;
  onChange(handler: (envelope: { key: string; value: unknown; seq: number }) => void): () => void;
}

function api(): OhStorageApi {
  const oh = (globalThis as { oh?: { storage?: OhStorageApi } }).oh;
  if (!oh?.storage) {
    throw new Error('IpcHostStorage: window.oh.storage is not exposed (preload script did not run)');
  }
  return oh.storage;
}

type ChangeListener = (next: unknown) => void;

class IpcHostStorageAdapter implements HostStorage {
  private readonly listeners = new Map<string, Set<ChangeListener>>();
  /** Highest seq seen per key — for future Mode-2 resync after reconnect. */
  private readonly lastSeenSeq = new Map<string, number>();
  private upstreamUnsubscribe: (() => void) | null = null;

  async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
    const { value, seq } = await api().get({ key: spec.key });
    this.noteSeq(spec.key, seq);
    return value === undefined || value === null ? (value as T | undefined) : (value as T);
  }

  async getMany<M extends Record<string, StorageKey<unknown>>>(
    specs: M,
  ): Promise<{ [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never }> {
    const names = Object.keys(specs);
    const keys = names.map((n) => specs[n].key);
    const { entries } = await api().getMany({ keys });
    const byKey = new Map(entries.map((e) => [e.key, e]));
    const out: Record<string, unknown> = {};
    for (const name of names) {
      const key = specs[name].key;
      const entry = byKey.get(key);
      if (entry) this.noteSeq(entry.key, entry.seq);
      out[name] = entry?.value;
    }
    return out as { [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never };
  }

  async set<T>(spec: StorageKey<T>, value: T): Promise<void> {
    const { seq } = await api().set({ key: spec.key, value });
    this.noteSeq(spec.key, seq);
  }

  async setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void> {
    const payload = writes.map(([spec, value]) => ({ key: spec.key, value }));
    const { seqs } = await api().setMany({ writes: payload });
    for (const { key, seq } of seqs) this.noteSeq(key, seq);
  }

  async remove(specs: StorageKey<unknown> | ReadonlyArray<StorageKey<unknown>>): Promise<void> {
    const list = Array.isArray(specs) ? specs : [specs as StorageKey<unknown>];
    const keys = list.map((s) => s.key);
    const { seqs } = await api().remove({ keys });
    for (const { key, seq } of seqs) this.noteSeq(key, seq);
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
    this.ensureUpstream();
    const key = spec.key;
    const bucket = this.listeners.get(key) ?? new Set<ChangeListener>();
    const cast = fn as ChangeListener;
    bucket.add(cast);
    this.listeners.set(key, bucket);

    if (bucket.size === 1) {
      // First local subscriber for this key — open the main-side
      // subscription. Fire-and-forget: any incoming `change` will land
      // through the upstream listener once the main-side registers.
      void api()
        .subscribe({ key, lastSeenSeq: this.lastSeenSeq.get(key) })
        .then(({ seq }) => {
          this.noteSeq(key, seq);
        })
        .catch((err) => {
          logger.warn(SCOPE, `subscribe(${key}) failed`, err);
        });
    }

    return () => {
      const current = this.listeners.get(key);
      if (!current) return;
      current.delete(cast);
      if (current.size === 0) {
        this.listeners.delete(key);
        void api()
          .unsubscribe({ key })
          .catch((err) => {
            logger.warn(SCOPE, `unsubscribe(${key}) failed`, err);
          });
      }
    };
  }

  private ensureUpstream(): void {
    if (this.upstreamUnsubscribe) return;
    this.upstreamUnsubscribe = api().onChange((envelope) => {
      this.noteSeq(envelope.key, envelope.seq);
      const bucket = this.listeners.get(envelope.key);
      if (!bucket) return;
      for (const listener of bucket) {
        try {
          listener(envelope.value);
        } catch (err) {
          logger.warn(SCOPE, `subscriber for ${envelope.key} threw`, err);
        }
      }
    });
  }

  private noteSeq(key: string, seq: number): void {
    const prev = this.lastSeenSeq.get(key);
    if (prev === undefined || seq > prev) this.lastSeenSeq.set(key, seq);
  }
}

export const ipcHostStorage: HostStorage = new IpcHostStorageAdapter();
