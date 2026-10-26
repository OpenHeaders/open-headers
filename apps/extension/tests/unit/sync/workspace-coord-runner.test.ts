/**
 * Workspace coordination runner — drains SWAP_PER_WORKSPACE_STORES +
 * PURGE_WORKSPACE_DATA intents on every global-scope broadcast and
 * routes them through the swap + purge primitives. Sync engine
 * session 53; the pointer moved to the host-local `active-workspace`
 * singleton in the workspace-list scope epic (slice 3).
 */

import {
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  EXTENSION_WORKSPACE_ID,
  type MutatorContext,
  mintExtensionWorkspaceBatch,
  removeExtensionWorkspace,
  setActiveWorkspace,
} from '@openheaders/core/sync';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { buildSchemaRegistry, GLOBAL_REGISTRY } from '@openheaders/oracle/sync/entity-registry';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { createWorkspaceCoordRunner } from '@openheaders/oracle/sync/workspace-coord-runner';
import { describe, expect, it } from 'vitest';

const sequentialLock: LockAcquirer = async (_ws, _type, _id, fn) => fn();

const ctx = (physicalMs: number, nodeId = 'node-a'): MutatorContext => ({
  workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  hlc: { physicalMs, logical: 0, nodeId },
  surfaceId: 'surface-test',
  deviceId: 'device-a',
});

/** The replicated pointer older builds wrote on the shared list record. */
const legacyActiveId = (physicalMs: number, id: string) =>
  mintExtensionWorkspaceBatch(ctx(physicalMs), [
    {
      kind: 'setField',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
      value: id,
    },
  ]);

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
    workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    lock: sequentialLock,
    log,
    intents,
    broadcast,
    schemas: buildSchemaRegistry(GLOBAL_REGISTRY),
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
  it('runs swap with the post-commit active id when the pointer singleton commits', async () => {
    const h = makeHarness();
    const intent = setActiveWorkspace(ctx(1000), { id: 'ws-B' });
    h.setActiveId('ws-B');
    await h.oracle.apply(intent.batch);
    await flush();
    expect(h.swapCalls).toEqual(['ws-B']);
    expect(h.purgeCalls).toEqual([]);
    h.dispose();
  });

  it('never swaps on a legacy activeId row — the list record derives no SWAP intent', async () => {
    const h = makeHarness();
    h.setActiveId('ws-B');
    await h.oracle.apply(legacyActiveId(1000, 'ws-B'));
    await flush();
    expect(h.swapCalls).toEqual([]);
    expect(await h.intents.list()).toEqual([]);
    h.dispose();
  });

  it('runs purge for each removed workspace id', async () => {
    const h = makeHarness();
    const removeA = removeExtensionWorkspace(ctx(1000), { id: 'ws-A' });
    await h.oracle.apply(removeA.batch);
    await flush();
    expect(h.purgeCalls).toEqual(['ws-A']);
    expect(h.swapCalls).toEqual([]);
    h.dispose();
  });

  it('reads the latest committed active id, not the per-envelope payload', async () => {
    const h = makeHarness();
    // Two pointer flips arrive in sequence. The runner reads
    // `getActiveWorkspaceId` at execution time (post-cache-update),
    // not the intent payload — so even the swap that fires for the
    // first batch sees the post-second-batch active id. This is the
    // §S4 "materialized snapshot at execution time" invariant.
    const first = setActiveWorkspace(ctx(1000), { id: 'ws-B' });
    const second = setActiveWorkspace(ctx(2000), { id: 'ws-C' });
    h.setActiveId('ws-C');
    await h.oracle.apply(first.batch);
    await h.oracle.apply(second.batch);
    await flush();
    expect(h.swapCalls.every((id) => id === 'ws-C')).toBe(true);
    expect(h.swapCalls.length).toBeGreaterThanOrEqual(1);
    h.dispose();
  });

  it('handles the bundled remove + pointer flip in a single two-entity batch (delete-of-active)', async () => {
    const h = makeHarness();
    const sharedCtx = ctx(1000);
    const remove = removeExtensionWorkspace({ ...sharedCtx, batchId: 'bundle' }, { id: 'ws-A' });
    const setActive = setActiveWorkspace({ ...sharedCtx, batchId: remove.batch.batchId }, { id: 'ws-B' });
    h.setActiveId('ws-B');
    const result = await h.oracle.apply({
      batchId: remove.batch.batchId,
      mutations: [...remove.batch.mutations, ...setActive.batch.mutations],
    });
    expect(result.ok).toBe(true);
    await flush();
    expect(h.swapCalls).toEqual(['ws-B']);
    expect(h.purgeCalls).toEqual(['ws-A']);
    h.dispose();
  });

  it('skips swap when getActiveWorkspaceId returns null (cold-wake race)', async () => {
    const h = makeHarness();
    const intent = setActiveWorkspace(ctx(1000), { id: 'ws-B' });
    // Don't update activeId — simulate the cache not yet pushing.
    await h.oracle.apply(intent.batch);
    await flush();
    expect(h.swapCalls).toEqual([]);
    h.dispose();
  });

  it('ignores broadcasts for unrelated entity types', async () => {
    const h = makeHarness();
    // Manually publish a non-global broadcast — runner should bail
    // out without touching the intents store.
    h.broadcast.publish({
      envelope: {
        mutationId: 'm-1',
        hlc: { physicalMs: 1000, logical: 0, nodeId: 'node-x' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: 'ws-1',
        orgId: 'org-test',
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
