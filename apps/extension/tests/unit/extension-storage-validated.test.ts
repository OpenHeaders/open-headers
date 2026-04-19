/**
 * Coverage for `extensionStorage.getValidated` + `.getValidatedArray` —
 * the Phase 2 schema-validated read helpers that wrap `parseEntity` /
 * `parseEntityArray` over the typed `StorageKey<T>` adapter.
 */

import { VariableSchema, VaultSchema } from '@openheaders/core/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const localStore: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(localStore)) delete localStore[key];
  const api = (globalThis as unknown as { chrome: typeof chrome }).chrome;
  const localArea = api.storage.local as unknown as {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  localArea.get.mockImplementation((keys: unknown, callback: (items: Record<string, unknown>) => void) => {
    const result: Record<string, unknown> = {};
    const names = Array.isArray(keys) ? (keys as string[]) : keys == null ? Object.keys(localStore) : [keys as string];
    for (const k of names) {
      if (k in localStore) result[k] = localStore[k];
    }
    callback(result);
  });
  localArea.set.mockImplementation((items: Record<string, unknown>, callback?: () => void) => {
    Object.assign(localStore, items);
    callback?.();
  });
});

import type { V5 } from '@openheaders/core/types';
import { extensionStorage, storageKey } from '@/shared/storage';

describe('extensionStorage.getValidated', () => {
  it('returns null when the slot is empty', async () => {
    const spec = storageKey<V5.Vault>('oh.ws.test.vault');
    expect(await extensionStorage.getValidated(spec, VaultSchema)).toBeNull();
  });

  it('returns the parsed value on a valid blob', async () => {
    const spec = storageKey<V5.Vault>('oh.ws.test.vault');
    await extensionStorage.set(spec, {
      schemaVersion: 5,
      version: 1,
      secrets: [{ name: 'TOKEN', value: 'abc' }],
    });
    const parsed = await extensionStorage.getValidated(spec, VaultSchema);
    expect(parsed).toEqual({
      schemaVersion: 5,
      version: 1,
      secrets: [{ name: 'TOKEN', value: 'abc' }],
    });
  });

  it('returns null when the blob fails the schema (pre-5 schemaVersion floor)', async () => {
    const spec = storageKey<V5.Vault>('oh.ws.test.vault');
    localStore['oh.ws.test.vault'] = { schemaVersion: 1, secrets: [] };
    expect(await extensionStorage.getValidated(spec, VaultSchema)).toBeNull();
  });

  it('invokes onError with the raw value + issues on schema failure', async () => {
    const spec = storageKey<V5.Vault>('oh.ws.test.vault');
    localStore['oh.ws.test.vault'] = { schemaVersion: 1, secrets: [] };
    const onError = vi.fn();
    await extensionStorage.getValidated(spec, VaultSchema, { onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toEqual({ schemaVersion: 1, secrets: [] });
    expect(Array.isArray(onError.mock.calls[0]?.[1])).toBe(true);
  });
});

describe('extensionStorage.getValidatedArray', () => {
  it('returns [] when the slot is empty', async () => {
    const spec = storageKey<V5.Variable[]>('oh.ws.test.vars');
    expect(await extensionStorage.getValidatedArray(spec, VariableSchema)).toEqual([]);
  });

  it('returns [] when the stored raw is not an array', async () => {
    const spec = storageKey<V5.Variable[]>('oh.ws.test.vars');
    localStore['oh.ws.test.vars'] = { not: 'an array' };
    expect(await extensionStorage.getValidatedArray(spec, VariableSchema)).toEqual([]);
  });

  it('drops individual bad entries but keeps the valid ones', async () => {
    const spec = storageKey<V5.Variable[]>('oh.ws.test.vars');
    localStore['oh.ws.test.vars'] = [
      { name: 'OK', value: 'yes', type: 'default' },
      { name: 'BAD', value: 'no', type: 'not-a-valid-type' },
      { name: 'TWO', value: '2', type: 'secret' },
    ];
    const onError = vi.fn();
    const parsed = await extensionStorage.getValidatedArray(spec, VariableSchema, { onError });
    expect(parsed).toEqual([
      { name: 'OK', value: 'yes', type: 'default' },
      { name: 'TWO', value: '2', type: 'secret' },
    ]);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
