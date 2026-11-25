/**
 * A workflow with steps this build does not know, at the engine (the
 * workflow runs plan, Laws — "A workflow with a step this build does
 * not know is read-only here").
 *
 * It reaches this host by sync. From there a rename, a switch-off and a
 * delete are local writes that go through the schema gate, the steps
 * stay as they came, and a stored read keeps the workflow instead of
 * dropping it. The gate still refuses what it refused before.
 */

import { LiveWorkflowSchema, parseEntityArray } from '@openheaders/core/schemas';
import { type HostStorage, type StorageKey, setHostStorage, wsKeys } from '@openheaders/core/storage';
import { LIVE_WORKFLOW_ENTITY_TYPE, type MutatorContext } from '@openheaders/core/sync';
import {
  buildDeleteLiveWorkflowBatch,
  buildUpdateLiveWorkflowBatch,
} from '@openheaders/core/sync-builders/mutations/live-workflow-mutations';
import { seedLiveWorkflow } from '@openheaders/core/sync-builders/projections/live-workflow-projection';
import type { LiveWorkflow } from '@openheaders/core/types';
import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '../../src/sync/broadcast';
import { createLiveWorkflowCache } from '../../src/sync/caches/live-workflow-cache';
import { buildLocalWriteValidator, buildSchemaRegistry, WORKSPACE_REGISTRY } from '../../src/sync/entity-registry';
import { InMemoryMutationLog } from '../../src/sync/mutation-log';
import { EntityOracle } from '../../src/sync/oracle';
import { InMemoryPendingIntents } from '../../src/sync/pending-intents';

const LISTEN = { uid: 'stplistn', id: 'probe', action: 'watch', session: 'mqttreq1' };
const CALL = { uid: 'stpcall0', id: 'reboot', requestUid: 'httpreq1', captures: [] };
const EXPECT = { uid: 'stpexpct', id: 'status', action: 'verify', on: 'probe', after: 'reboot', captures: [] };

const workflow: LiveWorkflow = v.parse(LiveWorkflowSchema, {
  schemaVersion: 5,
  uid: 'wfdevice',
  path: 'live-workflows/reboot-wfdevice',
  name: 'Reboot',
  steps: [LISTEN, CALL, EXPECT],
  refresh: { kind: 'manual' },
  enabled: true,
  published: true,
});

let clock = 1_000;
const ctx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: clock++, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

function createHostStorageFake(): HostStorage & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
      return store.get(spec.key) as T | undefined;
    },
    async set<T>(spec: StorageKey<T>, value: T): Promise<void> {
      store.set(spec.key, value);
    },
    async getValidatedArray(spec: StorageKey<unknown[]>, schema: Parameters<typeof parseEntityArray>[0]) {
      return parseEntityArray(schema, store.get(spec.key));
    },
  } as unknown as HostStorage & { store: Map<string, unknown> };
}

function makeEngine(): { oracle: EntityOracle; broadcast: InMemoryBroadcast } {
  const broadcast = new InMemoryBroadcast();
  const oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock: async (_ws, _type, _id, fn) => fn(),
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
    validateLocalWrite: buildLocalWriteValidator(WORKSPACE_REGISTRY),
  });
  return { oracle, broadcast };
}

const held = (oracle: EntityOracle): LiveWorkflow | null => {
  const materialized = oracle.materializeOne(LIVE_WORKFLOW_ENTITY_TYPE, workflow.uid);
  return materialized === null ? null : (materialized.data as LiveWorkflow);
};

let storage: ReturnType<typeof createHostStorageFake>;

beforeEach(() => {
  storage = createHostStorageFake();
  setHostStorage(storage);
});

describe('a workflow with steps this build does not know, at the engine', () => {
  it('lets a rename and a switch-off through the local-write gate, the steps as they came', async () => {
    const { oracle } = makeEngine();
    await oracle.apply(seedLiveWorkflow(workflow, ctx()), 'inbound');

    const renamed = await oracle.apply(
      buildUpdateLiveWorkflowBatch(workflow.uid, { name: 'Reboot dev-1' }, ctx()).batch,
      'local',
    );
    const switchedOff = await oracle.apply(
      buildUpdateLiveWorkflowBatch(workflow.uid, { enabled: false }, ctx()).batch,
      'local',
    );

    expect(renamed.failure).toBeUndefined();
    expect(switchedOff.failure).toBeUndefined();
    expect(held(oracle)).toMatchObject({ name: 'Reboot dev-1', enabled: false });
    expect(held(oracle)?.steps).toEqual([LISTEN, CALL, EXPECT]);
  });

  it('lets a delete through', async () => {
    const { oracle } = makeEngine();
    await oracle.apply(seedLiveWorkflow(workflow, ctx()), 'inbound');

    const deleted = await oracle.apply(buildDeleteLiveWorkflowBatch(workflow.uid, ctx()).batch, 'local');

    expect(deleted.ok).toBe(true);
    expect(held(oracle)).toBeNull();
  });

  it('still rolls back a local write that leaves a call step without its request', async () => {
    const { oracle } = makeEngine();
    await oracle.apply(seedLiveWorkflow(workflow, ctx()), 'inbound');

    const broken = [
      LISTEN,
      { uid: 'stpcall0', id: 'reboot', captures: [] },
      EXPECT,
    ] as unknown as LiveWorkflow['steps'];
    const result = await oracle.apply(
      buildUpdateLiveWorkflowBatch(workflow.uid, { steps: broken }, ctx()).batch,
      'local',
    );

    expect(result.failure?.status).toBe('schema-rejected');
    expect(result.failure?.detail).toMatch(/requestUid/);
    expect(held(oracle)?.steps).toEqual([LISTEN, CALL, EXPECT]);
  });

  it('keeps it on a stored read, and writes the slot back whole', async () => {
    storage.store.set(wsKeys('ws-1').liveWorkflows.key, [structuredClone(workflow)]);
    const { oracle, broadcast } = makeEngine();
    const cache = createLiveWorkflowCache('ws-1', oracle, broadcast, ctx);

    await cache.hydrateFromStorage();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cache.getLiveWorkflows().map((stored) => stored.steps)).toEqual([[LISTEN, CALL, EXPECT]]);
    expect(storage.store.get(wsKeys('ws-1').liveWorkflows.key)).toEqual([workflow]);
  });
});
