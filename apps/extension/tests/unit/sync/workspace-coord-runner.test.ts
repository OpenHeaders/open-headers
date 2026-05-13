/**
 * Workspace coordination runner — drains SWAP_PER_WORKSPACE_STORES +
 * PURGE_WORKSPACE_DATA intents on every `extensionWorkspace` broadcast
 * and routes them through the swap + purge primitives. Sync engine
 * session 53.
 */

import {
  EXTENSION_WORKSPACE_ID,
  type MutatorContext,
  removeExtensionWorkspace,
  setActiveExtensionWorkspace,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { createWorkspaceCoordRunner } from '@openheaders/oracle/sync/workspace-coord-runner';

const sequentialLock: LockAcquirer = async (_ws, _type, _id, fn) => fn();

const ctx = (physicalMs: number, nodeId = 'node-a'): MutatorContext => ({
  workspaceId: EXTENSION_WORKSPACE_ID,
  hlc: { physicalMs, logical: 0, nodeId },
  surfaceId: 'surface-test',
  deviceId: 'device-a',
});

interface Harness {
  oracle: EntityOracle;
  intents: InMemoryPendingIntents;
  broadcast: InMemoryBroadcast;
  swapCalls: string[];
  purgeCalls: string[];
  setActiveId: (id: string) => void;
  dispose: () => void;
}

function makeHarness(initialActive: string | null = null): Harness {
  const log = new InMemoryMutationLog();
  const intents = new InMemoryPendingIntents();
  const broadcast = new InMemoryBroadcast();
  const swapCalls: string[] = [];
  const purgeCalls: string[] = [];
  let activeId: string | null = initialActive;
  const oracle = new EntityOracle({
    workspaceId: '__global__',
    lock: sequentialLock,
    log,
    intents,
    broadcast,
  });
  const runner = createWorkspaceCoordRunner({
    broadcast,
    intents,
    getActiveWorkspaceId: () => activeId,
    swap: async (newId) => {
      swapCalls.push(newId);
    },
    purge: async (workspaceId) => {
      purgeCalls.push(workspaceId);
    },
  });
  return {
    oracle,
    intents,
    broadcast,
    swapCalls,
    purgeCalls,
    setActiveId: (id) => {
      activeId = id;
    },
    dispose: runner.dispose,
  };
}

// Yield to the microtask queue so the serialized handle finishes before
// assertions.
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('WorkspaceCoordRunner', () => {
  it('runs swap with the post-commit active id when SWAP intent drained', async () => {
    const h = makeHarness();
    const intent = setActiveExtensionWorkspace(ctx(1000), { id: 'ws-B' });
    h.setActiveId('ws-B');
    await h.oracle.apply(intent.batch, intent.sideEffects);
    await flush();
    expect(h.swapCalls).toEqual(['ws-B']);
    expect(h.purgeCalls).toEqual([]);
    h.dispose();
  });

  it('runs purge for each removed workspace id', async () => {
    const h = makeHarness();
    const removeA = removeExtensionWorkspace(ctx(1000), { id: 'ws-A' });
    await h.oracle.apply(removeA.batch, removeA.sideEffects);
    await flush();
    expect(h.purgeCalls).toEqual(['ws-A']);
    expect(h.swapCalls).toEqual([]);
    h.dispose();
  });

  it('reads the latest committed active id, not the per-envelope payload', async () => {
    const h = makeHarness();
    // Two setActive batches arrive in sequence. The runner reads
    // `getActiveWorkspaceId` at execution time (post-cache-update),
    // not the intent payload — so even the swap that fires for the
    // first batch sees the post-second-batch active id. This is the
    // §S4 "materialized snapshot at execution time" invariant.
    const first = setActiveExtensionWorkspace(ctx(1000), { id: 'ws-B' });
    const second = setActiveExtensionWorkspace(ctx(2000), { id: 'ws-C' });
    h.setActiveId('ws-C');
    await h.oracle.apply(first.batch, first.sideEffects);
    await h.oracle.apply(second.batch, second.sideEffects);
    await flush();
    expect(h.swapCalls.every((id) => id === 'ws-C')).toBe(true);
    expect(h.swapCalls.length).toBeGreaterThanOrEqual(1);
    h.dispose();
  });

  it('handles bundled remove+setActive in a single batch (delete-of-active)', async () => {
    const h = makeHarness();
    const sharedCtx = ctx(1000);
    const remove = removeExtensionWorkspace({ ...sharedCtx, batchId: 'bundle' }, { id: 'ws-A' });
    const setActive = setActiveExtensionWorkspace(
      { ...sharedCtx, batchId: remove.batch.batchId },
      { id: 'ws-B' },
    );
    h.setActiveId('ws-B');
    await h.oracle.apply(
      {
        batchId: remove.batch.batchId,
        mutations: [...remove.batch.mutations, ...setActive.batch.mutations],
      },
      [...remove.sideEffects, ...setActive.sideEffects],
    );
    await flush();
    expect(h.swapCalls).toEqual(['ws-B']);
    expect(h.purgeCalls).toEqual(['ws-A']);
    h.dispose();
  });

  it('skips swap when getActiveWorkspaceId returns null (cold-wake race)', async () => {
    const h = makeHarness();
    const intent = setActiveExtensionWorkspace(ctx(1000), { id: 'ws-B' });
    // Don't update activeId — simulate the cache not yet pushing.
    await h.oracle.apply(intent.batch, intent.sideEffects);
    await flush();
    expect(h.swapCalls).toEqual([]);
    h.dispose();
  });

  it('ignores broadcasts for unrelated entity types', async () => {
    const h = makeHarness();
    // Manually publish a non-extensionWorkspace broadcast — runner should
    // bail out without touching the intents store.
    h.broadcast.publish({
      envelope: {
        mutationId: 'm-1',
        hlc: { physicalMs: 1000, logical: 0, nodeId: 'node-x' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: 'ws-1',
        mutatorVersion: 1,
        body: { kind: 'create', type: 'rule', id: 'r-1', payload: {} },
      },
      outcome: { status: 'applied' },
    });
    await flush();
    expect(h.swapCalls).toEqual([]);
    expect(h.purgeCalls).toEqual([]);
    h.dispose();
  });
});
