/**
 * Response examples as request children — the example index: `path`
 * and the parent uid project from the live `examples` slot on the
 * request (through the request's own projected path), a folder move
 * above the request carries every example by construction, a
 * slot-less example keeps its stored values as the net, and merged
 * conflicts (a shadowed slot, a dead slot) surface for the reconciler.
 */

import {
  createRequestFolder,
  type MutatorContext,
  mintBatch,
  moveRequestFolder,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_EXAMPLES_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  responseExampleChild,
} from '@openheaders/core/sync';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import { seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import { seedResponseExample } from '@openheaders/core/sync-builders/projections/response-example-projection';
import type { Collection, Request, ResponseExample } from '@openheaders/core/types';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { createResponseExampleCache } from '@openheaders/oracle/sync/caches/response-example-cache';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { exampleConflicts, resolveExampleParent } from '@openheaders/oracle/sync/post-state/example-tree-post-state';
import { projectResponseExampleByUid } from '@openheaders/oracle/sync/post-state/response-example-post-state';
import { beforeEach, describe, expect, it } from 'vitest';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
let clock = 0;
const ctx = (): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: 1_000 + ++clock, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeCollection = (uid: string, slug: string): Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: slug,
    path: `requests/${slug}-${uid}`,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  }) as unknown as Collection;

const makeRequest = (uid: string, parentPath: string): Request =>
  ({
    schemaVersion: 5,
    uid,
    path: `${parentPath}/get-${uid}`,
    pathSegment: `get-${uid}`,
    name: 'get',
    method: 'GET',
    url: 'https://api.openheaders.io/v1',
    headers: [],
    params: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
  }) as unknown as Request;

const makeExample = (uid: string, requestPath: string, requestUid: string): ResponseExample => ({
  schemaVersion: 5,
  uid,
  path: `${requestPath}/examples/ping-${uid}`,
  requestUid,
  name: 'ping',
  capturedAt: '2026-07-09T09:00:00.000Z',
  request: { method: 'GET', url: 'https://api.openheaders.io/ping', headers: [], params: [], body: { type: 'none' } },
  response: {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/ping',
    headers: [],
    body: '{"ok":true}',
    bodyTruncated: false,
    bodyBytes: 11,
    durationMs: 42,
  },
});

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;
const collection = { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'col00001' } as const;
const folder = { type: REQUEST_FOLDER_ENTITY_TYPE, uid: 'fol00001' } as const;
const request = { type: REQUEST_ENTITY_TYPE, uid: 'req00001' } as const;
const folderPath = 'requests/api-col00001/sub-fol00001';
const requestPath = `${folderPath}/get-req00001`;

beforeEach(async () => {
  clock = 0;
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: wsId,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
  await oracle.apply(seedRequestCollection(makeCollection('col00001', 'api'), ctx()), []);
  await oracle.apply(createRequestFolder(ctx(), { folderUid: folder.uid, parent: collection, name: 'Sub' }).batch, []);
  await oracle.apply(seedRequest(makeRequest(request.uid, folderPath), ctx(), { parent: folder, orderKey: 'm' }), []);
});

describe('example index', () => {
  it('projects path and requestUid from the live examples slot on the request', async () => {
    const example = { ...makeExample('ex000001', requestPath, request.uid), requestUid: 'req0stal' };
    await oracle.apply(seedResponseExample(example, ctx(), { parent: request, orderKey: 'm' }), []);
    expect(resolveExampleParent(oracle, 'ex000001')).toEqual({ path: requestPath, uid: request.uid });
    const projected = projectResponseExampleByUid(oracle, 'ex000001')?.responseExample;
    expect(projected?.path).toBe(`${requestPath}/examples/ping-ex000001`);
    expect(projected?.requestUid).toBe(request.uid);
    expect(projected?.pathSegment).toBe('ping-ex000001');
  });

  it('carries the examples with a folder move above their request', async () => {
    await oracle.apply(seedRequestCollection(makeCollection('col00002', 'other'), ctx()), []);
    const example = makeExample('ex000001', requestPath, request.uid);
    await oracle.apply(seedResponseExample(example, ctx(), { parent: request, orderKey: 'm' }), []);
    await oracle.apply(
      moveRequestFolder(ctx(), {
        folderUid: folder.uid,
        oldParent: collection,
        newParent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'col00002' },
        orderKey: 'a',
      }).batch,
      [],
    );
    expect(projectResponseExampleByUid(oracle, 'ex000001')?.responseExample.path).toBe(
      'requests/other-col00002/sub-fol00001/get-req00001/examples/ping-ex000001',
    );
  });

  it('keeps the stored path and requestUid for a slot-less example', async () => {
    const example = makeExample('ex000001', 'requests/old-col0dead/get-req0dead', 'req0dead');
    await oracle.apply(seedResponseExample(example, ctx()), []);
    expect(resolveExampleParent(oracle, 'ex000001')).toBeNull();
    expect(projectResponseExampleByUid(oracle, 'ex000001')?.responseExample).toMatchObject({
      path: example.path,
      requestUid: 'req0dead',
    });
  });

  it('keeps the higher add-HLC slot when an example sits on two requests and reports the loser', async () => {
    await oracle.apply(seedRequest(makeRequest('req00002', folderPath), ctx(), { parent: folder, orderKey: 'n' }), []);
    const example = makeExample('ex000001', requestPath, request.uid);
    await oracle.apply(seedResponseExample(example, ctx(), { parent: request, orderKey: 'm' }), []);
    const later = { type: REQUEST_ENTITY_TYPE, uid: 'req00002' } as const;
    await oracle.apply(mintBatch(ctx(), [responseExampleChild.slotAdd('ex000001', later, 'm')]), []);
    expect(resolveExampleParent(oracle, 'ex000001')?.uid).toBe('req00002');
    expect(projectResponseExampleByUid(oracle, 'ex000001')?.responseExample.requestUid).toBe('req00002');
    expect(exampleConflicts(oracle).shadowed).toEqual([
      {
        childUid: 'ex000001',
        parent: request,
        setPath: REQUEST_EXAMPLES_PATH,
        item: { uid: 'ex000001', type: 'response-example' },
        orderKey: 'm',
      },
    ]);
  });

  it('reports a slot whose example is not live as dead', async () => {
    await oracle.apply(mintBatch(ctx(), [responseExampleChild.slotAdd('ex0ghost', request, 'm')]), []);
    expect(exampleConflicts(oracle).deadSlots.map((s) => s.childUid)).toEqual(['ex0ghost']);
  });
});

describe('response-example cache', () => {
  it('persists examples in slot order under their request and re-projects on a folder move', async () => {
    const cache = createResponseExampleCache(wsId, oracle, broadcast, ctx);
    await oracle.apply(
      seedResponseExample(makeExample('ex000001', requestPath, request.uid), ctx(), { parent: request, orderKey: 'b' }),
      [],
    );
    await oracle.apply(
      seedResponseExample(makeExample('ex000002', requestPath, request.uid), ctx(), { parent: request, orderKey: 'a' }),
      [],
    );
    expect(cache.getResponseExamples().map((e) => e.uid)).toEqual(['ex000002', 'ex000001']);

    await oracle.apply(seedRequestCollection(makeCollection('col00002', 'other'), ctx()), []);
    await oracle.apply(
      moveRequestFolder(ctx(), {
        folderUid: folder.uid,
        oldParent: collection,
        newParent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'col00002' },
        orderKey: 'a',
      }).batch,
      [],
    );
    expect(cache.getResponseExamples().map((e) => e.path)).toEqual([
      'requests/other-col00002/sub-fol00001/get-req00001/examples/ping-ex000002',
      'requests/other-col00002/sub-fol00001/get-req00001/examples/ping-ex000001',
    ]);
    cache.dispose();
  });
});
