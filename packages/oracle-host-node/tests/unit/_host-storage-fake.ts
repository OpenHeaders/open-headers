/**
 * In-memory `HostStorage` fake for oracle-host-node integration tests
 * that need a real token ledger (e.g. minting a daemon auth token so a
 * handshake can authenticate). Lives under `_host-storage-fake.ts`
 * (leading underscore so vitest's default test glob skips it).
 *
 * Mirrors the core identity-test fake; `get` / `set` / `remove` /
 * `subscribe` carry real behaviour (the runtime-switch tools drive
 * pointer writes through subscriptions) — the validated readers return
 * safe defaults so unrelated code paths don't crash.
 */

import type { ParseEntityOptions } from '@openheaders/core/schemas';
import type { HostStorage, StorageKey } from '@openheaders/core/storage';
import type * as v from 'valibot';

export interface HostStorageFake extends HostStorage {
  snapshot(): Map<string, unknown>;
}

export function createHostStorageFake(): HostStorageFake {
  const store = new Map<string, unknown>();
  const subscribers = new Map<string, Set<(next: unknown) => void>>();
  const notify = (key: string): void => {
    for (const fn of subscribers.get(key) ?? []) fn(store.get(key));
  };
  const fake: HostStorage = {
    async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
      return store.get(spec.key) as T | undefined;
    },
    async getMany<M extends Record<string, StorageKey<unknown>>>(
      specs: M,
    ): Promise<{ [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never }> {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) {
        out[k] = store.get(spec.key);
      }
      return out as { [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never };
    },
    async set<T>(spec: StorageKey<T>, value: T): Promise<void> {
      store.set(spec.key, value);
      notify(spec.key);
    },
    async setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void> {
      for (const [spec, value] of writes) {
        store.set(spec.key, value);
        notify(spec.key);
      }
    },
    async remove(specs: StorageKey<unknown> | ReadonlyArray<StorageKey<unknown>>): Promise<void> {
      const list = Array.isArray(specs) ? specs : [specs as StorageKey<unknown>];
      for (const spec of list) {
        store.delete(spec.key);
        notify(spec.key);
      }
    },
    async getValidated<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
      _spec: StorageKey<v.InferOutput<TSchema>>,
      _schema: TSchema,
      _options?: ParseEntityOptions,
    ): Promise<v.InferOutput<TSchema> | null> {
      return null;
    },
    async getValidatedArray<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
      _spec: StorageKey<Array<v.InferOutput<TSchema>>>,
      _schema: TSchema,
      _options?: ParseEntityOptions,
    ): Promise<Array<v.InferOutput<TSchema>>> {
      return [];
    },
    subscribe<T>(spec: StorageKey<T>, fn: (next: T | undefined) => void): () => void {
      let set = subscribers.get(spec.key);
      if (!set) {
        set = new Set();
        subscribers.set(spec.key, set);
      }
      const typed = fn as (next: unknown) => void;
      set.add(typed);
      return () => {
        set.delete(typed);
      };
    },
  };
  return Object.assign(fake, { snapshot: () => new Map(store) });
}
