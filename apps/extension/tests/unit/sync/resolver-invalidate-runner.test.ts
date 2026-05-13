/**
 * Resolver-invalidate runner — drains `invalidate-resolver` intents
 * on every broadcast for a configured entity-type set (Environment +
 * Collection in Phase B; Workspace + Vault join in later sessions),
 * and asks the rule engine to recompile (which re-reads variable
 * scope state from `getEnvironments()` / `getCollections()` / etc.).
 * Mirrors dnr-intent-runner.test.ts.
 */

import {
  COLLECTION_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
  INVALIDATE_RESOLVER,
  type MutatorContext,
  setCollectionVar,
  setEnvVar,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { createResolverInvalidateRunner } from '@openheaders/oracle/sync/resolver-invalidate-runner';

const wsId = 'ws-1';
const sequentialLock: LockAcquirer = async (_ws, _type, _id, fn) => fn();

const ctx = (physicalMs: number, nodeId = 'node-a'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs, logical: 0, nodeId },
  surfaceId: 'surface-test',
  deviceId: 'device-a',
});

interface Harness {
  oracle: EntityOracle;
  intents: InMemoryPendingIntents;
  broadcast: InMemoryBroadcast;
  recompileCalls: string[];
  dispose: () => void;
}

function makeHarness(): Harness {
  const log = new InMemoryMutationLog();
  const intents = new InMemoryPendingIntents();
  const broadcast = new InMemoryBroadcast();
  const recompileCalls: string[] = [];
  const oracle = new EntityOracle({ workspaceId: wsId, lock: sequentialLock, log, intents, broadcast });
  const runner = createResolverInvalidateRunner({
    broadcast,
    intents,
    entityTypes: new Set([ENVIRONMENT_ENTITY_TYPE, COLLECTION_ENTITY_TYPE]),
    recompile: (reason) => recompileCalls.push(reason),
  });
  return { oracle, intents, broadcast, recompileCalls, dispose: runner.dispose };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ResolverInvalidateRunner', () => {
  it('recompiles after a setEnvVar mutation lands', async () => {
    const h = makeHarness();
    const intent = setEnvVar(ctx(1_000), { envId: 'e1', variable: { uid: 'vrenvkey1', name: 'API_KEY', value: 'k', type: 'default' } });
    await h.oracle.apply(intent.batch, intent.sideEffects);
    await flush();
    expect(h.recompileCalls).toEqual(['rules']);
  });

  it('does not recompile when the broadcast carries no matching intent', async () => {
    const h = makeHarness();
    h.broadcast.publish({
      envelope: {
        mutationId: 'm-orphan',
        hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: wsId,
        mutatorVersion: 1,
        body: { kind: 'setField', type: ENVIRONMENT_ENTITY_TYPE, id: 'never-seen', path: 'name', value: 'x' },
      },
      outcome: { status: 'applied' },
    });
    await flush();
    expect(h.recompileCalls).toHaveLength(0);
  });

  it('ignores broadcasts for entity types outside the configured set', async () => {
    const h = makeHarness();
    h.broadcast.publish({
      envelope: {
        mutationId: 'm-rule',
        hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: wsId,
        mutatorVersion: 1,
        body: { kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: 'x' },
      },
      outcome: { status: 'applied' },
    });
    await flush();
    expect(h.recompileCalls).toHaveLength(0);
  });

  it('recompiles after a setCollectionVar mutation lands', async () => {
    const h = makeHarness();
    const intent = setCollectionVar(ctx(2_000), {
      collectionUid: 'c1',
      variable: { uid: 'vrcoltok1', name: 'TOKEN', value: 'tok', type: 'default' },
    });
    await h.oracle.apply(intent.batch, intent.sideEffects);
    await flush();
    expect(h.recompileCalls).toEqual(['rules']);
  });

  it('drains per-env intents in lockstep with broadcasts', async () => {
    const h = makeHarness();
    await h.intents.enqueue({
      kind: INVALIDATE_RESOLVER,
      key: 'e1',
      hlc: { physicalMs: 0, logical: 0, nodeId: 'n' },
    });
    const intent = setEnvVar(ctx(1_000), { envId: 'e1', variable: { uid: 'vrenvkey1', name: 'API_KEY', value: 'k', type: 'default' } });
    await h.oracle.apply(intent.batch, intent.sideEffects);
    await flush();
    expect(h.recompileCalls).toEqual(['rules']);
    expect(await h.intents.list()).toHaveLength(0);
  });

  it('dispose stops further recompile calls', async () => {
    const h = makeHarness();
    h.dispose();
    const intent = setEnvVar(ctx(1_000), { envId: 'e1', variable: { uid: 'vrenvkey1', name: 'API_KEY', value: 'k', type: 'default' } });
    await h.oracle.apply(intent.batch, intent.sideEffects);
    await flush();
    expect(h.recompileCalls).toHaveLength(0);
  });
});
