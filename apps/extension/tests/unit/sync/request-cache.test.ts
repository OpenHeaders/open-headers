/**
 * Phase B Request — request cache subscribes to broadcast,
 * re-projects, persists to chrome.storage.local. Mirrors
 * rule-cache's contract.
 */

import {
  addRequestHeader,
  addRequestParam,
  deleteRequest,
  REQUEST_ENTITY_TYPE,
  setRequestField,
} from '@openheaders/core/sync';
import type { Request } from '@openheaders/core/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { createRequestCache } from '@openheaders/oracle/sync/request-cache';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const makeRequest = (uid: string, overrides: Partial<Request> = {}): Request =>
  ({
    schemaVersion: 5,
    uid,
    path: `requests/col-1/req-${uid}`,
    name: `req-${uid}`,
    method: 'GET',
    url: 'https://api.openheaders.io/v1',
    headers: [
      { key: 'X-Default', value: 'd' },
    ],
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
    await oracle.apply(deleteRequest(ctxFactory(), { requestUid: 'rq' }).batch, []);
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
    await oracle.apply(
      setRequestField(ctxFactory(), { requestUid: 'rq', path: 'name', value: 'updated' }).batch,
      [],
    );
    expect(fires).toBeGreaterThan(before);
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
});
