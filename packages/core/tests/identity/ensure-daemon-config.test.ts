/**
 * Coverage for `ensureDaemonConfig` — the host-neutral entry point for
 * minting + persisting `hostInstallId` (U1.4 per UNIFIED_ORACLE_STATUS.md).
 *
 * Uses a tiny in-memory `HostStorage` fake so the test exercises the real
 * proxy + key plumbing without coupling to any host's storage adapter.
 */

import type * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';
import { ensureDaemonConfig } from '../../src/identity';
import type { ParseEntityOptions } from '../../src/schemas';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH, type StorageKey } from '../../src/storage/keys';
import type { HostStorage } from '../../src/storage/host-storage';

function createFakeHostStorage(): HostStorage & { snapshot(): Map<string, unknown> } {
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

describe('ensureDaemonConfig', () => {
  let fake: ReturnType<typeof createFakeHostStorage>;

  beforeEach(() => {
    fake = createFakeHostStorage();
    setHostStorage(fake);
  });

  it('mints + persists a hostInstallId on first boot', async () => {
    const cfg = await ensureDaemonConfig();
    expect(typeof cfg.hostInstallId).toBe('string');
    expect(cfg.hostInstallId.length).toBeGreaterThan(0);
    const persisted = await hostStorage.get(OH.daemonConfig);
    expect(persisted).toEqual(cfg);
  });

  it('returns the persisted record on subsequent calls (idempotent)', async () => {
    const first = await ensureDaemonConfig();
    const second = await ensureDaemonConfig();
    expect(second).toEqual(first);
    expect(second.hostInstallId).toBe(first.hostInstallId);
  });

  it('does not re-mint when a config already exists in storage', async () => {
    await hostStorage.set(OH.daemonConfig, { hostInstallId: 'preexisting-host-id' });
    const cfg = await ensureDaemonConfig();
    expect(cfg.hostInstallId).toBe('preexisting-host-id');
  });

  it('distinct hosts (fresh storages) mint distinct ids', async () => {
    const first = await ensureDaemonConfig();
    // Simulate a different host with a fresh storage backend.
    setHostStorage(createFakeHostStorage());
    const second = await ensureDaemonConfig();
    expect(second.hostInstallId).not.toBe(first.hostInstallId);
  });
});
