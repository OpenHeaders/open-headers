/**
 * In-memory {@link HostStorage} for the anonymous public viewer (F5b).
 * The viewer hydrates a published snapshot into a throwaway oracle —
 * nothing it holds may touch the origin's IDB, where a signed-in
 * session's replica lives, and nothing needs to survive a reload (the
 * page re-fetches the payload). Sensitive slots refuse like every
 * cipher-less host.
 */

import { type ParseEntityOptions, parseEntity, parseEntityArray } from '@openheaders/core/schemas';
import type { HostStorage, StorageKey } from '@openheaders/core/storage';
import type * as v from 'valibot';

type ChangeListener = (next: unknown) => void;

export class MemoryHostStorage implements HostStorage {
  private readonly values = new Map<string, unknown>();
  private readonly listeners = new Map<string, Set<ChangeListener>>();

  async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
    if (spec.sensitive === true) return undefined;
    return this.values.get(spec.key) as T | undefined;
  }

  async getMany<M extends Record<string, StorageKey<unknown>>>(
    specs: M,
  ): Promise<{ [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never }> {
    const out: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(specs)) {
      out[name] = spec.sensitive === true ? undefined : this.values.get(spec.key);
    }
    return out as { [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never };
  }

  async set<T>(spec: StorageKey<T>, value: T): Promise<void> {
    this.refuseSensitive(spec);
    this.values.set(spec.key, value);
    this.fire(spec.key, value);
  }

  async setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void> {
    for (const [spec] of writes) this.refuseSensitive(spec);
    for (const [spec, value] of writes) {
      this.values.set(spec.key, value);
      this.fire(spec.key, value);
    }
  }

  async remove(specs: StorageKey<unknown> | ReadonlyArray<StorageKey<unknown>>): Promise<void> {
    const list = Array.isArray(specs) ? specs : [specs as StorageKey<unknown>];
    for (const spec of list) {
      this.values.delete(spec.key);
      this.fire(spec.key, undefined);
    }
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
    const bucket = this.listeners.get(spec.key) ?? new Set<ChangeListener>();
    const cast = fn as ChangeListener;
    bucket.add(cast);
    this.listeners.set(spec.key, bucket);
    return () => {
      const current = this.listeners.get(spec.key);
      if (!current) return;
      current.delete(cast);
      if (current.size === 0) this.listeners.delete(spec.key);
    };
  }

  private refuseSensitive(spec: StorageKey<unknown>): void {
    if (spec.sensitive === true) {
      throw new Error(`MemoryHostStorage: no cipher; refusing to write sensitive slot "${spec.key}"`);
    }
  }

  private fire(key: string, value: unknown): void {
    for (const listener of this.listeners.get(key) ?? []) {
      try {
        listener(value);
      } catch {
        // Subscriber errors never break the write path.
      }
    }
  }
}
