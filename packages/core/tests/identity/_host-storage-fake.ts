/**
 * In-memory `HostStorage` fake shared by the identity-helper tests. Lives
 * under `_host-storage-fake.ts` (leading underscore so vitest's default
 * test glob skips it).
 *
 * The fake is intentionally tiny — only the methods the identity helpers
 * actually exercise (`get` / `set` / `getMany` / `setMany` / `remove`).
 * `getValidated*` and `subscribe` return safe defaults so callers
 * exploring other code paths don't crash.
 */

import type * as v from 'valibot';
import type { ParseEntityOptions } from '../../src/schemas';
import type { HostStorage } from '../../src/storage/host-storage';
import type { StorageKey } from '../../src/storage/keys';

export interface HostStorageFake extends HostStorage {
  snapshot(): Map<string, unknown>;
}

export function createHostStorageFake(): HostStorageFake {
  const store = new Map<string, unknown>();
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
    },
    async setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void> {
      for (const [spec, value] of writes) {
        store.set(spec.key, value);
      }
    },
    async remove(specs: StorageKey<unknown> | ReadonlyArray<StorageKey<unknown>>): Promise<void> {
      const list = Array.isArray(specs) ? specs : [specs as StorageKey<unknown>];
      for (const spec of list) store.delete(spec.key);
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
    subscribe<T>(_spec: StorageKey<T>, _fn: (next: T | undefined) => void): () => void {
      return () => undefined;
    },
  };
  return Object.assign(fake, { snapshot: () => new Map(store) });
}
