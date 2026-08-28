/**
 * Phase B Request — request cache subscribes to broadcast,
 * re-projects, persists to chrome.storage.local. Mirrors
 * rule-cache's contract.
 */

import {
  addRequestHeader,
  addRequestParam,
  type ChildPlacement,
  createRequestFolder,
  deleteRequest,
  moveRequestFolder,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
  setRequestField,
} from '@openheaders/core/sync';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import { seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import type { Collection, Request } from '@openheaders/core/types';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { createRequestCache } from '@openheaders/oracle/sync/caches/request-cache';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { beforeEach, describe, expect, it } from 'vitest';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const makeRequest = (uid: string, overrides: Partial<Request> = {}): Request =>
  ({
    schemaVersion: 5,
    uid,
    path: `requests/col-1/req-${uid}`,
    name: `req-${uid}`,
    method: 'GET',
    url: 'https://api.openheaders.io/v1',
    headers: [{ key: 'X-Default', value: 'd' }],
    params: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
    ...overrides,
  }) as unknown as Request;

let hlcCounter = 0;
const ctxFactory = () => {
  hlcCounter += 1;
  return {
    workspaceId: 'ws-1',
    orgId: 'org-test',
    hlc: { physicalMs: 1_000 + hlcCounter, logical: 0, nodeId: 'n0' },
    surfaceId: 's',
    deviceId: 'd',
  };
};

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  hlcCounter = 0;
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
});

describe('RequestCache', () => {
  it('seeds requests + projects them with set-modeled headers as arrays', async () => {
    const cache = createRequestCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedRequests([makeRequest('a'), makeRequest('b')]);
    const requests = cache.getRequests();
    expect(requests.map((r) => r.uid).sort()).toEqual(['a', 'b']);
    const a = requests.find((r) => r.uid === 'a');
    expect(a?.headers).toEqual([{ key: 'X-Default', value: 'd' }]);
    cache.dispose();
  });

  it('refreshes the cache when a header is added through the catalog', async () => {
    const cache = createRequestCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedRequests([makeRequest('rq')]);

    const intent = addRequestHeader(ctxFactory(), {
      requestUid: 'rq',
      header: { uid: 'hdr00060', key: 'X-Trace', value: 't1' },
    });
    await oracle.apply(intent.batch, []);

    const headers = cache.getRequests()[0].headers;
    const keys = headers.map((h) => h.key).sort();
    expect(keys).toEqual(['X-Default', 'X-Trace']);
    cache.dispose();
  });

  it('refreshes when a param is added', async () => {
    const cache = createRequestCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedRequests([makeRequest('rq')]);
    await oracle.apply(
      addRequestParam(ctxFactory(), {
        requestUid: 'rq',
        param: { uid: 'qpr00060', key: 'q', value: '1' },
      }).batch,
      [],
    );
    expect(cache.getRequests()[0].params).toEqual([{ uid: 'qpr00060', key: 'q', value: '1' }]);
    cache.dispose();
  });

  it('reflects scalar setField on url', async () => {
    const cache = createRequestCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedRequests([makeRequest('rq')]);
    await oracle.apply(
      setRequestField(ctxFactory(), { requestUid: 'rq', path: 'url', value: 'https://openheaders.io/v2' }).batch,
      [],
    );
    expect(cache.getRequests()[0].url).toBe('https://openheaders.io/v2');
    cache.dispose();
  });

  it('drops a request from the cache after delete (tombstone wins)', async () => {
    const cache = createRequestCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedRequests([makeRequest('rq'), makeRequest('alt')]);
    await oracle.apply(
      deleteRequest(ctxFactory(), { requestUid: 'rq', parent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: 'col-1' } })
        .batch,
      [],
    );
    expect(cache.getRequests().map((r) => r.uid)).toEqual(['alt']);
    cache.dispose();
  });

  it('notifies listeners on cache change', async () => {
    const cache = createRequestCache('ws-1', oracle, broadcast, ctxFactory);
    let fires = 0;
    cache.onChange(() => {
      fires += 1;
    });
    await cache.seedFromPersistedRequests([makeRequest('rq')]);
    const before = fires;
    await oracle.apply(setRequestField(ctxFactory(), { requestUid: 'rq', path: 'name', value: 'updated' }).batch, []);
    expect(fires).toBeGreaterThan(before);
    cache.dispose();
  });

  it('bulk seed re-projects once — one listener fire for the whole batch', async () => {
    const cache = createRequestCache('ws-1', oracle, broadcast, ctxFactory);
    let fires = 0;
    cache.onChange(() => {
      fires += 1;
    });
    await cache.seedFromPersistedRequests([makeRequest('a'), makeRequest('b'), makeRequest('c')]);
    expect(fires).toBe(1);
    expect(cache.getRequests().map((r) => r.uid)).toEqual(['a', 'b', 'c']);
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createRequestCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedRequests([makeRequest('rq')]);
    cache.dispose();

    await oracle.apply(
      setRequestField(ctxFactory(), { requestUid: 'rq', path: 'name', value: 'after-dispose' }).batch,
      [],
    );
    // Cache view frozen at last refresh — name from seed.
    expect(cache.getRequests()[0].name).toBe('req-rq');
  });

  it('only emits the request shape, ignoring non-request entities in the oracle', async () => {
    const cache = createRequestCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedRequests([makeRequest('rq')]);

    // Publish a synthetic non-request envelope — the cache reprojects but
    // materializeAll filters to REQUEST_ENTITY_TYPE so the rule shape is
    // never surfaced in getRequests().
    broadcast.publish({
      envelope: {
        mutationId: 'm-x',
        hlc: { physicalMs: 9_000, logical: 0, nodeId: 'n0' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: 'ws-1',
        orgId: 'org-test',
        mutatorVersion: 1,
        body: { kind: 'setField', type: 'rule', id: 'rule-x', path: 'name', value: 'foreign' },
      },
      outcome: { status: 'applied' },
    });

    const requests = cache.getRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].uid).toBe('rq');
    expect((requests[0] as { type?: string }).type).toBeUndefined();
    expect(requests[0].name).toBe('req-rq');
    // Sanity — request shape stays request-shaped even after the broadcast.
    void REQUEST_ENTITY_TYPE;
    cache.dispose();
  });

  it('persists requests in tree order and cascades a folder move into their paths', async () => {
    const collection = {
      schemaVersion: 5,
      uid: 'rcol0001',
      name: 'API',
      path: 'requests/api-rcol0001',
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    } as unknown as Collection;
    await oracle.apply(seedRequestCollection(collection, ctxFactory()), []);
    await oracle.apply(
      createRequestFolder(ctxFactory(), {
        folderUid: 'rfol0001',
        parent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: collection.uid },
        name: 'v1',
      }).batch,
      [],
    );
    await oracle.apply(
      createRequestFolder(ctxFactory(), {
        folderUid: 'rfol0002',
        parent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: collection.uid },
        name: 'v2',
      }).batch,
      [],
    );
    const cache = createRequestCache('ws-1', oracle, broadcast, ctxFactory);
    const place = (uid: string, orderKey: string): ChildPlacement<RequestFolderParentRef> => ({
      parent: { type: REQUEST_FOLDER_ENTITY_TYPE, uid },
      orderKey,
    });
    await oracle.apply(
      seedRequest(
        makeRequest('zzz', { path: `${collection.path}/v1-rfol0001/req-zzz` }),
        ctxFactory(),
        place('rfol0001', 'a'),
      ),
      [],
    );
    await oracle.apply(
      seedRequest(
        makeRequest('aaa', { path: `${collection.path}/v1-rfol0001/req-aaa` }),
        ctxFactory(),
        place('rfol0001', 'b'),
      ),
      [],
    );
    expect(cache.getRequests().map((r) => r.uid)).toEqual(['zzz', 'aaa']);

    await oracle.apply(
      moveRequestFolder(ctxFactory(), {
        folderUid: 'rfol0001',
        oldParent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: collection.uid },
        newParent: { type: REQUEST_FOLDER_ENTITY_TYPE, uid: 'rfol0002' },
        orderKey: 'a',
      }).batch,
      [],
    );
    expect(cache.getRequests().map((r) => r.path)).toEqual([
      `${collection.path}/v2-rfol0002/v1-rfol0001/req-zzz`,
      `${collection.path}/v2-rfol0002/v1-rfol0001/req-aaa`,
    ]);
    cache.dispose();
  });
});
