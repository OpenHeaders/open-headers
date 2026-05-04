/**
 * Phase B — environment cache subscribes to broadcast, re-projects to
 * V5.Environment[], persists to chrome.storage.local. Mirrors
 * rule-cache test shape.
 */

import { setEnvVar } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { createEnvironmentCache } from '@/background/sync/environment-cache';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const makeEnv = (uid: string): V5.Environment =>
  ({
    schemaVersion: 5,
    uid,
    name: `env-${uid}`,
    variables: [{ uid: '624adb9a', name: 'A', value: '1', type: 'default' }],
    version: 1,
  }) as unknown as V5.Environment;

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

describe('EnvironmentCache', () => {
  it('seeds the oracle from persisted environments and projects them back', async () => {
    const cache = createEnvironmentCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedEnvironments([makeEnv('a'), makeEnv('b')]);
    const envs = cache.getEnvironments();
    expect(envs.map((e) => e.uid).sort()).toEqual(['a', 'b']);
    expect(envs[0].variables[0].name).toBe('A');
    cache.dispose();
  });

  it('updates the cache when a new var is set via the catalog', async () => {
    const cache = createEnvironmentCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedEnvironments([makeEnv('a')]);
    const intent = setEnvVar(ctxFactory(), { envId: 'a', variable: { uid: 'vrenvvb12', name: 'B', value: '2', type: 'default' } });
    await oracle.apply(intent.batch, []);
    const envs = cache.getEnvironments();
    expect(envs[0].variables.map((v) => v.name).sort()).toEqual(['A', 'B']);
    cache.dispose();
  });

  it('ignores Rule envelopes — env state stays empty when rules are committed', async () => {
    const cache = createEnvironmentCache('ws-1', oracle, broadcast, ctxFactory);
    let listenerFires = 0;
    cache.onChange(() => {
      listenerFires += 1;
    });
    // Manually publish a Rule-type envelope through the broadcast.
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
    expect(cache.getEnvironments()).toEqual([]);
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createEnvironmentCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedEnvironments([makeEnv('a')]);
    cache.dispose();
    const intent = setEnvVar(ctxFactory(), { envId: 'a', variable: { uid: 'vrenvvb12', name: 'B', value: '2', type: 'default' } });
    await oracle.apply(intent.batch, []);
    // Cache stays at the pre-dispose state.
    expect(cache.getEnvironments()[0].variables.map((v) => v.name)).toEqual(['A']);
  });
});
