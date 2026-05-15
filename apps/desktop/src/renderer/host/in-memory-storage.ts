/**
 * In-memory {@link HostStorage} adapter — first-cut stub for the desktop
 * renderer.
 *
 * Honors the full {@link HostStorage} contract (`get` / `set` / `getMany`
 * / `setMany` / `remove` / `getValidated` / `getValidatedArray` /
 * `subscribe`) against a `Map`. Resets on every renderer reload — durable
 * persistence (electron-store-backed, IPC-proxied from a main-process
 * owner) lands with the engine-host milestone.
 *
 * The seam itself is what matters now: consumers under
 * `@openheaders/core/storage`'s `hostStorage` proxy run identically here
 * as they do against the extension's chrome-storage adapter, so when the
 * real backend swaps in nothing on the UI side has to change.
 */

import { type ParseEntityOptions, parseEntity, parseEntityArray } from '@openheaders/core/schemas';
import type { HostStorage, StorageKey } from '@openheaders/core/storage';
import type * as v from 'valibot';

export class InMemoryHostStorage implements HostStorage {
  private readonly slots = new Map<string, unknown>();
  private readonly listeners = new Map<string, Set<(next: unknown) => void>>();

  async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
    return this.slots.get(spec.key) as T | undefined;
  }

  async getMany<M extends Record<string, StorageKey<unknown>>>(
    specs: M,
  ): Promise<{ [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never }> {
    const out: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(specs) as [keyof M, StorageKey<unknown>][]) {
      out[name as string] = this.slots.get(spec.key);
    }
    return out as { [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never };
  }

  async set<T>(spec: StorageKey<T>, value: T): Promise<void> {
    this.slots.set(spec.key, value);
    this.fire(spec.key, value);
  }

  async setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void> {
    for (const [spec, value] of writes) {
      this.slots.set(spec.key, value);
      this.fire(spec.key, value);
    }
  }

  async remove(specs: StorageKey<unknown> | ReadonlyArray<StorageKey<unknown>>): Promise<void> {
    const list = Array.isArray(specs) ? specs : [specs as StorageKey<unknown>];
    for (const spec of list) {
      this.slots.delete(spec.key);
      this.fire(spec.key, undefined);
    }
  }

  async getValidated<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<v.InferOutput<TSchema>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<v.InferOutput<TSchema> | null> {
    const raw = this.slots.get(spec.key);
    if (raw === undefined) return null;
    return parseEntity(schema, raw, options);
  }

  async getValidatedArray<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<Array<v.InferOutput<TSchema>>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<Array<v.InferOutput<TSchema>>> {
    const raw = this.slots.get(spec.key);
    if (raw === undefined) return [];
    return parseEntityArray(schema, raw, options);
  }

  subscribe<T>(spec: StorageKey<T>, fn: (next: T | undefined) => void): () => void {
    const bucket = this.listeners.get(spec.key) ?? new Set();
    const cast = fn as (next: unknown) => void;
    bucket.add(cast);
    this.listeners.set(spec.key, bucket);
    return () => {
      const current = this.listeners.get(spec.key);
      if (!current) return;
      current.delete(cast);
      if (current.size === 0) this.listeners.delete(spec.key);
    };
  }

  private fire(key: string, value: unknown): void {
    const bucket = this.listeners.get(key);
    if (!bucket) return;
    for (const fn of bucket) fn(value);
  }
}

export const inMemoryHostStorage = new InMemoryHostStorage();
