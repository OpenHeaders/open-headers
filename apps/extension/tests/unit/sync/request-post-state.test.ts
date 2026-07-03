/**
 * Phase B Request — projector reads post-commit state for Request
 * envelopes; returns null for non-Request envelopes / deletes /
 * unknown ids. Mirrors rule-post-state's contract.
 */

import {
  addRequestHeader,
  addRequestParam,
  type MutationEnvelope,
  type MutatorContext,
  REQUEST_HEADERS_PATH,
  REQUEST_PARAMS_PATH,
  deleteRequest,
  setRequestField,
} from '@openheaders/core/sync';
import type { Request } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { projectRequestByUid, projectRequestPostState } from '@openheaders/oracle/sync/post-state/request-post-state';
import { seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number, hlc: [number, number] = [ms, 0]): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: hlc[0], logical: hlc[1], nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeRequest = (uid: string): Request =>
  ({
    schemaVersion: 5,
    uid,
    path: `requests/col-1/req-${uid}`,
    name: `req-${uid}`,
    method: 'GET',
    url: 'https://api.openheaders.io/v1',
    headers: [{ uid: 'hdrdflt1', key: 'X-Default', value: 'd' }],
    params: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
  }) as unknown as Request;

async function newOracle(): Promise<EntityOracle> {
  return new EntityOracle({
    workspaceId: wsId,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
}

describe('projectRequestPostState', () => {
  it('returns post-state for a Request envelope after seed + add header', async () => {
    const oracle = await newOracle();
    const request = makeRequest(generateUid());
    await oracle.apply(seedRequest(request, ctx(1)), []);

    const intent = addRequestHeader(ctx(2), {
      requestUid: request.uid,
      header: { uid: 'hdr00050', key: 'X-Trace', value: 't1' },
      itemId: 'h-trace',
    });
    await oracle.apply(intent.batch, []);

    const env = intent.batch.mutations[0];
    const post = projectRequestPostState(oracle, env);
    expect(post).not.toBeNull();
    expect(post?.request.headers.length).toBe(2);
    expect(post?.setItemIds[REQUEST_HEADERS_PATH]).toContain('h-trace');
  });

  it('returns null for non-Request envelopes', async () => {
    const oracle = await newOracle();
    const env: MutationEnvelope = {
      mutationId: 'm-1',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n0' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: wsId,
      orgId: 'org-test',
      mutatorVersion: 1,
      body: { kind: 'setField', type: 'rule', id: 'rule-x', path: 'name', value: 'x' },
    };
    expect(projectRequestPostState(oracle, env)).toBeNull();
  });

  it('returns null for unknown request id', async () => {
    const oracle = await newOracle();
    expect(projectRequestByUid(oracle, 'no-such-uid')).toBeNull();
  });

  it('returns null after the request is deleted (tombstone)', async () => {
    const oracle = await newOracle();
    const request = makeRequest('rq-del');
    await oracle.apply(seedRequest(request, ctx(1)), []);
    await oracle.apply(deleteRequest(ctx(2), { requestUid: 'rq-del' }).batch, []);
    expect(projectRequestByUid(oracle, 'rq-del')).toBeNull();
  });

  it('omits empty set paths from setItemIds', async () => {
    const oracle = await newOracle();
    const request = makeRequest('rq-empty');
    // Seed without any headers/params so both set paths are empty.
    request.headers = [];
    request.params = [];
    await oracle.apply(seedRequest(request, ctx(1)), []);
    const post = projectRequestByUid(oracle, 'rq-empty');
    expect(post).not.toBeNull();
    expect(post?.setItemIds[REQUEST_HEADERS_PATH]).toBeUndefined();
    expect(post?.setItemIds[REQUEST_PARAMS_PATH]).toBeUndefined();
  });

  it('exposes per-itemId order keys at every populated set path', async () => {
    const oracle = await newOracle();
    const request = makeRequest('rq-okeys');
    request.headers = [
      { uid: 'hdrdflt1', key: 'X-Default', value: 'd' },
      { uid: 'hdrdflt2', key: 'X-Other', value: 'o' },
    ];
    request.params = [];
    await oracle.apply(seedRequest(request, ctx(1)), []);
    const post = projectRequestByUid(oracle, 'rq-okeys');
    expect(post).not.toBeNull();
    const headerOrder = post?.setOrderKeys[REQUEST_HEADERS_PATH];
    expect(headerOrder?.length).toBe(2);
    expect(headerOrder?.[0]?.itemId).toBe('hdrdflt1');
    expect(headerOrder?.[1]?.itemId).toBe('hdrdflt2');
    // Order keys are non-empty strings derived from fractional indexing.
    expect(headerOrder?.[0]?.orderKey.length).toBeGreaterThan(0);
    expect(headerOrder?.[1]?.orderKey.length).toBeGreaterThan(0);
    expect(post?.setOrderKeys[REQUEST_PARAMS_PATH]).toBeUndefined();
  });

  it('reflects param adds at the params path', async () => {
    const oracle = await newOracle();
    const request = makeRequest('rq-params');
    await oracle.apply(seedRequest(request, ctx(1)), []);
    await oracle.apply(
      addRequestParam(ctx(2), {
        requestUid: 'rq-params',
        param: { uid: 'qpr00050', key: 'q', value: '1' },
        itemId: 'p-q',
      }).batch,
      [],
    );
    const post = projectRequestByUid(oracle, 'rq-params');
    expect(post?.setItemIds[REQUEST_PARAMS_PATH]).toEqual(['p-q']);
  });

  it('reflects scalar setField on the request shape', async () => {
    const oracle = await newOracle();
    const request = makeRequest('rq-scalar');
    await oracle.apply(seedRequest(request, ctx(1)), []);
    const intent = setRequestField(ctx(2), {
      requestUid: 'rq-scalar',
      path: 'name',
      value: 'updated',
    });
    await oracle.apply(intent.batch, []);
    const post = projectRequestByUid(oracle, 'rq-scalar');
    expect(post?.request.name).toBe('updated');
  });

});
