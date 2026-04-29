/**
 * Phase B — vault cache subscribes to broadcast, re-projects to V5.Vault,
 * persists to chrome.storage.local. Mirrors workspace-variables-cache.test.ts.
 */

import { setVaultSecret } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { createVaultCache } from '@/background/sync/vault-cache';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const makeVault = (secrets: V5.VaultSecret[]): V5.Vault => ({
  schemaVersion: 5,
  version: 1,
  secrets,
});

const ctxFactory = () => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: Date.now(), logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
});

afterEach(() => {
  // No global state to reset.
});

describe('VaultCache', () => {
  it('returns an empty default before seeding', () => {
    const cache = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    const snap = cache.getVault();
    expect(snap.secrets).toEqual([]);
    cache.dispose();
  });

  it('seeds the oracle from a persisted singleton and projects it back', async () => {
    const cache = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedVault(
      makeVault([
        { kind: 'string', name: 'API_KEY', value: 'sek' },
        {
          kind: 'totp',
          name: 'OTP',
          seed: 'JBSWY3DPEHPK3PXP',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        },
      ]),
    );
    const snap = cache.getVault();
    expect(snap.secrets.map((s) => s.name).sort()).toEqual(['API_KEY', 'OTP']);
    cache.dispose();
  });

  it('updates the cache when a new secret is set via the catalog', async () => {
    const cache = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedVault(
      makeVault([{ kind: 'string', name: 'A', value: '1' }]),
    );
    const intent = setVaultSecret(ctxFactory(), {
      secret: { kind: 'string', name: 'B', value: '2' },
    });
    await oracle.apply(intent.batch, []);
    const snap = cache.getVault();
    expect(snap.secrets.map((s) => s.name).sort()).toEqual(['A', 'B']);
    cache.dispose();
  });

  it('ignores Rule envelopes — vault state stays empty', () => {
    const cache = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    let listenerFires = 0;
    cache.onChange(() => {
      listenerFires += 1;
    });
    broadcast.publish({
      envelope: {
        mutationId: 'r1',
        hlc: { physicalMs: 1, logical: 0, nodeId: 'n0' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: 'ws-1',
        mutatorVersion: 1,
        body: { kind: 'setField', type: 'rule', id: 'rule-x', path: 'name', value: 'x' },
      },
      outcome: { status: 'applied' },
    });
    expect(listenerFires).toBe(0);
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createVaultCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedVault(
      makeVault([{ kind: 'string', name: 'A', value: '1' }]),
    );
    cache.dispose();
    const intent = setVaultSecret(ctxFactory(), {
      secret: { kind: 'string', name: 'B', value: '2' },
    });
    await oracle.apply(intent.batch, []);
    expect(cache.getVault().secrets.map((s) => s.name)).toEqual(['A']);
  });
});
