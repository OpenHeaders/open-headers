/**
 * Tab-memory {@link HostStorage} adapter — the Phase-4a stub half of the
 * web host. State lives in a `Map` for the lifetime of the tab: the
 * Workbench renders, settings toggle, and everything resets on reload.
 *
 * Phase 4b replaces this with the tab-oracle host's origin-scoped IDB
 * persistence (the extension's storage tiering, minus `chrome.storage`),
 * at which point edits survive reloads and sync to the daemon over the
 * WS join. The interface is the full `HostStorage` contract so consumers
 * in `@openheaders/ui` are already exercising the real seam.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { type ParseEntityOptions, parseEntity, parseEntityArray } from '@openheaders/core/schemas';
import type { HostStorage, StorageKey } from '@openheaders/core/storage';
import type * as v from 'valibot';

const SCOPE = 'MemoryHostStorage';

type ChangeListener = (next: unknown) => void;

class MemoryHostStorage implements HostStorage {
  private readonly values = new Map<string, unknown>();
  private readonly listeners = new Map<string, Set<ChangeListener>>();

  get<T>(spec: StorageKey<T>): Promise<T | undefined> {
    return Promise.resolve(this.values.get(spec.key) as T | undefined);
  }

  getMany<M extends Record<string, StorageKey<unknown>>>(
    specs: M,
  ): Promise<{ [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never }> {
    const out: Record<string, unknown> = {};
    for (const name of Object.keys(specs)) {
      out[name] = this.values.get(specs[name].key);
    }
    return Promise.resolve(out as { [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never });
  }

  set<T>(spec: StorageKey<T>, value: T): Promise<void> {
    this.values.set(spec.key, value);
    this.notify(spec.key, value);
    return Promise.resolve();
  }

  setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void> {
    for (const [spec, value] of writes) {
      this.values.set(spec.key, value);
      this.notify(spec.key, value);
    }
    return Promise.resolve();
  }

  remove(specs: StorageKey<unknown> | ReadonlyArray<StorageKey<unknown>>): Promise<void> {
    const list = Array.isArray(specs) ? specs : [specs as StorageKey<unknown>];
    for (const spec of list) {
      this.values.delete(spec.key);
      this.notify(spec.key, undefined);
    }
    return Promise.resolve();
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

  private notify(key: string, next: unknown): void {
    const bucket = this.listeners.get(key);
    if (!bucket) return;
    for (const listener of bucket) {
      try {
        listener(next);
      } catch (err) {
        logger.warn(SCOPE, `subscriber for ${key} threw`, err);
      }
    }
  }
}

export const memoryHostStorage: HostStorage = new MemoryHostStorage();
