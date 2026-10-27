/**
 * Vault cache — undecryptable-baseline lock surface (WS-B B2, commit 2),
 * narrowed by the workspace-list scope plan (Part 3): the log is the source.
 *
 * The storage layer's tri-state (`extension-storage-sensitive.test.ts`) and the
 * core lock derivation (`singleton-entity-cache-locked.test.ts`) are covered
 * elsewhere. This proves the vault-cache wrapper wires them together: with
 * no vault row in the log, a present-but-undecryptable persisted blob locks
 * the cache (`isVaultLocked()`) while `getVault()` reads empty, and a genuine
 * re-entry clears the lock; a log that holds the vault restores it over any
 * blob and never locks, and the blob is rewritten from the oracle.
 */

import { setHostStorage, wsKeys } from '@openheaders/core/storage';
import { setVaultSecret } from '@openheaders/core/sync';
import type { Vault } from '@openheaders/core/types';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { createVaultCache } from '@openheaders/oracle/sync/caches/vault-cache';
import { buildSchemaRegistry, VAULT_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserSecretCipher } from '@/host/browser-secret-cipher';
import { ExtensionStorage } from '@/host/extension-storage';

// Deterministic stub cipher: `SEALED(<plaintext>)` round-trips; anything else
// fails to decrypt (the lost-at-rest-key hazard).
function makeStubCipher(): BrowserSecretCipher {
  return {
    isAvailable: () => true,
    encrypt: (plaintext) => Promise.resolve(`SEALED(${plaintext})`),
    decrypt: (blob) => {
      const match = /^SEALED\(([\s\S]*)\)$/.exec(blob);
      if (!match) return Promise.reject(new Error('stub: unrecognized blob'));
      return Promise.resolve(match[1]);
    },
  };
}

type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void;

function installFakeChromeStorage(): { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const listeners = new Set<ChangeListener>();
  const local = {
    get: (keys: string[], cb: (items: Record<string, unknown>) => void) => {
      const out: Record<string, unknown> = {};
      for (const k of keys) if (data.has(k)) out[k] = data.get(k);
      cb(out);
    },
    set: (items: Record<string, unknown>, cb: () => void) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const [k, val] of Object.entries(items)) {
        changes[k] = { oldValue: data.get(k), newValue: val };
        data.set(k, val);
      }
      cb();
      for (const fn of listeners) fn(changes, 'local');
    },
    remove: (keys: string[], cb: () => void) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const k of keys) {
        changes[k] = { oldValue: data.get(k), newValue: undefined };
        data.delete(k);
      }
      cb();
      for (const fn of listeners) fn(changes, 'local');
    },
  };
  vi.stubGlobal('chrome', {
    storage: {
      local,
      sync: local,
      onChanged: {
        addListener: (fn: ChangeListener) => listeners.add(fn),
        removeListener: (fn: ChangeListener) => listeners.delete(fn),
      },
    },
  });
  return { data };
}

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctxFactory = () => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: Date.now(), logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});
const makeVault = (secrets: Vault['secrets']): Vault => ({ schemaVersion: 5, secrets });
const apiKey: Vault['secrets'][number] = { uid: 'scapikey', kind: 'string', name: 'API_KEY', value: 'sek' };

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function rowCount(log: InMemoryMutationLog): Promise<number> {
  let rows = 0;
  for await (const _ of log.readSince(null)) rows += 1;
  return rows;
}

describe('VaultCache — undecryptable-baseline lock', () => {
  let store: ReturnType<typeof installFakeChromeStorage>;
  let oracle: EntityOracle;
  let log: InMemoryMutationLog;
  let broadcast: InMemoryBroadcast;

  beforeEach(() => {
    store = installFakeChromeStorage();
    setHostStorage(new ExtensionStorage(makeStubCipher()));
    broadcast = new InMemoryBroadcast();
    log = new InMemoryMutationLog();
    oracle = new EntityOracle({
      workspaceId: 'ws-1',
      lock,
      log,
      intents: new InMemoryPendingIntents(),
      broadcast,
      // Production-faithful: the vault singleton's schema keeps it
      // observable without a create (the undecryptable-baseline
      // recovery writes into a never-seeded oracle).
      schemas: buildSchemaRegistry([VAULT_REGISTRATION]),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('locks and reads empty when the persisted blob is present but undecryptable', async () => {
    store.data.set(wsKeys('ws-1').vault.key, 'not-a-sealed-blob');
    const cache = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.hydrateFromStorage();

    expect(cache.isVaultLocked()).toBe(true);
    expect(cache.getVault().secrets).toEqual([]);
    cache.dispose();
  });

  it('stays unlocked and empty for an absent slot', async () => {
    const cache = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.hydrateFromStorage();

    expect(cache.isVaultLocked()).toBe(false);
    expect(cache.getVault().secrets).toEqual([]);
    cache.dispose();
  });

  it('hydrates a good persisted blob without locking', async () => {
    const cache = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedVault(makeVault([apiKey]));

    expect(cache.isVaultLocked()).toBe(false);
    expect(cache.getVault().secrets.map((s) => s.name)).toEqual(['API_KEY']);
    cache.dispose();
  });

  it('a log that holds the vault restores it over an undecryptable blob, never locks, and rewrites the blob', async () => {
    // The vault's envelopes in the log — what a replayed boot holds.
    await oracle.apply(setVaultSecret(ctxFactory(), { secret: apiKey }).batch);
    store.data.set(wsKeys('ws-1').vault.key, 'not-a-sealed-blob');
    const rows = await rowCount(log);

    const cache = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.hydrateFromStorage();

    expect(cache.isVaultLocked()).toBe(false);
    expect(cache.getVault().secrets.map((s) => s.name)).toEqual(['API_KEY']);
    expect(await rowCount(log)).toBe(rows);
    await flush();
    expect(String(store.data.get(wsKeys('ws-1').vault.key))).toMatch(/^SEALED\(/);
    cache.dispose();
  });

  it('migrates a decryptable blob into an empty log once; the next boot re-projects without seeding', async () => {
    store.data.set(wsKeys('ws-1').vault.key, `SEALED(${JSON.stringify(makeVault([apiKey]))})`);

    const first = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    await first.hydrateFromStorage();
    expect(first.isVaultLocked()).toBe(false);
    expect(first.getVault().secrets.map((s) => s.name)).toEqual(['API_KEY']);
    const rows = await rowCount(log);
    expect(rows).toBeGreaterThan(0);
    first.dispose();

    const second = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    await second.hydrateFromStorage();
    expect(second.getVault().secrets.map((s) => s.name)).toEqual(['API_KEY']);
    expect(await rowCount(log)).toBe(rows);
    second.dispose();
  });

  it('clears the lock when a re-entered secret yields a non-empty snapshot', async () => {
    store.data.set(wsKeys('ws-1').vault.key, 'not-a-sealed-blob');
    const cache = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.hydrateFromStorage();
    expect(cache.isVaultLocked()).toBe(true);

    const intent = setVaultSecret(ctxFactory(), {
      secret: { uid: 'scbxxxxxx', kind: 'string', name: 'RECOVERED', value: 're' },
    });
    await oracle.apply(intent.batch);

    expect(cache.isVaultLocked()).toBe(false);
    expect(cache.getVault().secrets.map((s) => s.name)).toEqual(['RECOVERED']);
    cache.dispose();
  });
});
