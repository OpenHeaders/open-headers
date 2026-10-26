/**
 * Path params ride the request projection as the third set-modeled
 * path: `seedRequest` emits one `addToSet` per row at `pathParams` and
 * strips the field off the create shell; the materialized entity
 * projects back to the same rows in seed order; a request without the
 * field materializes without the key. An UPDATE carrying the rows is a
 * set diff (add / remove per uid), never a scalar `setField`, and an
 * empty list tombstones every stored row.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutatorContext, REQUEST_PATH_PARAMS_PATH } from '../../src/sync';
import {
  buildUpdateBatch,
  type LiveSetEntries,
  type RequestMutationPayload,
} from '../../src/sync-builders/mutations/request-mutations';
import { projectRequest, seedRequest } from '../../src/sync-builders/projections/request-projection';
import type { Request } from '../../src/types';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'rq-1',
    path: 'requests/api/spacecraft',
    name: 'Spacecraft',
    method: 'GET',
    url: 'https://api.openheaders.io/spacecrafts/:spacecraftId/parts/:partId',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

const ROWS = [
  { uid: 'pth00001', key: 'spacecraftId', value: '{{env.SPACECRAFT}}', description: "The spacecraft's id." },
  { uid: 'pth00002', key: 'partId', value: '' },
];

function materialize(request: Request): Request {
  const store = new InMemoryDocumentStore();
  for (const env of seedRequest(request, ctx(1_000)).mutations) store.apply(env);
  return read(store, request.uid);
}

function read(store: InMemoryDocumentStore, uid: string): Request {
  const m = store.materializeOne('request', uid);
  const projected = m ? projectRequest(m) : null;
  if (!projected) throw new Error('request did not materialize');
  return projected;
}

function applyBatch(store: InMemoryDocumentStore, payload: Pick<RequestMutationPayload, 'batch'>): void {
  for (const env of payload.batch.mutations) store.apply(env);
}

/** The renderer write client's adapter: the live `(itemId, orderKey)`
 *  pairs at a set path joined to the materialized rows by uid. */
const liveSets =
  (store: InMemoryDocumentStore): LiveSetEntries =>
  (uid, path) => {
    const rows = path === REQUEST_PATH_PARAMS_PATH ? (read(store, uid).pathParams ?? []) : [];
    return store.liveOrderedSetItems('request', uid, path).map((e) => ({
      itemId: e.itemId,
      orderKey: e.key,
      item: rows.find((r) => r.uid === e.itemId),
    }));
  };

describe('request projection — path params', () => {
  it('seeds one addToSet per row at the pathParams path, keyed by the row uid, and strips the field off the shell', () => {
    const batch = seedRequest(makeRequest({ pathParams: ROWS }), ctx(1_000));
    const create = batch.mutations.find((m) => m.body.kind === 'create');
    if (create?.body.kind !== 'create') throw new Error('no create');
    expect(create.body.payload).not.toHaveProperty(REQUEST_PATH_PARAMS_PATH);
    const adds = batch.mutations.filter((m) => m.body.kind === 'addToSet' && m.body.path === REQUEST_PATH_PARAMS_PATH);
    expect(adds.map((m) => (m.body.kind === 'addToSet' ? [m.body.itemId, m.body.item] : null))).toEqual([
      ['pth00001', ROWS[0]],
      ['pth00002', ROWS[1]],
    ]);
  });

  it('round-trips the rows in seed order', () => {
    expect(materialize(makeRequest({ pathParams: ROWS })).pathParams).toEqual(ROWS);
  });

  it('a request without the field materializes without the key', () => {
    expect(materialize(makeRequest())).not.toHaveProperty(REQUEST_PATH_PARAMS_PATH);
  });
});

describe('request update — path params', () => {
  it('diffs the rows as a set: a changed value re-adds its uid, a dropped name tombstones, a new name adds; no setField', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequest(makeRequest({ pathParams: ROWS }), ctx(1_000)) });

    const next = [
      { uid: 'pth00001', key: 'spacecraftId', value: 'voyager-1', description: "The spacecraft's id." },
      { uid: 'pth00003', key: 'sensorId', value: '' },
    ];
    const payload = buildUpdateBatch('rq-1', { pathParams: next }, ctx(2_000), liveSets(store), () => undefined);
    const kinds = payload.batch.mutations.map((m) => m.body.kind);
    expect(kinds).not.toContain('setField');
    expect(kinds.filter((k) => k === 'addToSet')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'removeFromSet')).toHaveLength(1);
    applyBatch(store, payload);
    expect(read(store, 'rq-1').pathParams).toEqual(next);
  });

  it('an empty list tombstones every stored row', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequest(makeRequest({ pathParams: ROWS }), ctx(1_000)) });
    const payload = buildUpdateBatch('rq-1', { pathParams: [] }, ctx(2_000), liveSets(store), () => undefined);
    expect(payload.batch.mutations.map((m) => m.body.kind)).toEqual(['removeFromSet', 'removeFromSet']);
    applyBatch(store, payload);
    // The emptied set materializes as `[]`; the codec reads that as absent.
    expect(read(store, 'rq-1').pathParams ?? []).toEqual([]);
  });
});
